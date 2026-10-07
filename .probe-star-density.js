// 直接在**画布像素**上量星场密度，绕开截图/整页 UI 的干扰。
// 做法：把 jobs 清空 → 画布上只剩"星系+星场"，没有任何星球/标签，
// 这样数出来的亮孤立点就是星场的真实密度。
const http = require('http');
function j(u){return new Promise((res,rej)=>{http.get(u,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}
const BASE = process.argv[2] || 'http://127.0.0.1:8099/index.html';

const CHECK = `(function(){
  var wrap=document.getElementById('starCanvasWrap');
  var c=wrap.querySelector('canvas'), g=c.getContext('2d');
  var iw=c.width, ih=c.height;
  var img=g.getImageData(0,0,iw,ih);
  var d=img.data;
  function L(x,y){ if(x<0||y<0||x>=iw||y>=ih) return -1; var i=(y*iw+x)*4; return 0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2]; }

  // 局部均值（13x13 步长抽样近似）
  var K=13, lm=new Float32Array(iw*ih);
  for(var y=0;y<ih;y+=1){
    for(var x=0;x<iw;x+=1){
      var s=0,n=0;
      for(var dy=-K;dy<=K;dy+=K){
        for(var dx=-K;dx<=K;dx+=K){
          var v=L(x+dx,y+dy); if(v>=0){s+=v;n++;}
        }
      }
      lm[y*iw+x]= n? s/n : 0;
    }
  }
  // 局部极大 + 明显亮于邻域
  var nstar=0, warmDark=0, darkish=0, black=0;
  var sumR=0,sumG=0,sumB=0, nsc=0;
  for(var y=1;y<ih-1;y++){
    for(var x=1;x<iw-1;x++){
      var v=L(x,y), i=(y*iw+x)*4;
      var r0=d[i],g0=d[i+1],b0=d[i+2];
      var lum=0.2126*r0+0.7152*g0+0.0722*b0;
      if(lum<4) black++;
      if(lum>12 && lum<78){ darkish++; if(r0-b0>8) warmDark++; }
      if(v>lm[y*iw+x]+26 && v>72){
        var ismax=true;
        for(var dy=-1;dy<=1&&ismax;dy++) for(var dx=-1;dx<=1;dx++){
          if(dx===0&&dy===0) continue;
          if(L(x+dx,y+dy)>=v){ismax=false;break;}
        }
        if(ismax){ nstar++; sumR+=r0; sumG+=g0; sumB+=b0; nsc++; }
      }
    }
  }
  var area_k = (iw*ih)/1000;
  // 画布布局诊断：wrap 里有几个 canvas、缩放多少、亮度在 5x5 网格上的分布
  var cvAll = wrap.querySelectorAll('canvas');
  var cvInfo = [];
  for (var ci=0; ci<cvAll.length; ci++) cvInfo.push(cvAll[ci].width+'x'+cvAll[ci].height+' vis='+(cvAll[ci].style.display||'?'));
  var zscale = null;
  try { zscale = starZoomApi && starZoomApi.get ? starZoomApi.get().scale : null; } catch(e) { zscale = 'err'; }
  var grid = [];
  for (var gy=0; gy<5; gy++) {
    var row = [];
    for (var gx=0; gx<5; gx++) {
      var sx = Math.round((gx+0.5)/5*iw), sy2 = Math.round((gy+0.5)/5*ih);
      row.push(Math.round(L(sx,sy2)));
    }
    grid.push(row);
  }
  // 亮度直方图
  var hist=new Array(8).fill(0), tot=0;
  for(var y=0;y<ih;y+=2) for(var x=0;x<iw;x+=2){
    var v=L(x,y); if(v<0) continue; hist[Math.min(7,Math.floor(v/32))]++; tot++;
  }
  hist = hist.map(function(h){return +(h/tot*100).toFixed(1)});
  function px(x,y){ var i=(y*iw+x)*4; return [d[i],d[i+1],d[i+2]]; }
  return JSON.stringify({
    canvas: iw+'x'+ih,
    desatRan: window.__desatRan || 0,
    galaxyStarN_expected: Math.round((wrap.clientWidth*wrap.clientHeight)/105),
    bgStarCount: (typeof bgStars!=='undefined'&&bgStars)? bgStars.length : 'n/a',
    canvases_in_wrap: cvInfo,
    zoom_scale: zscale,
    lum_grid_5x5: grid,
    stars: nstar,
    density_per_1000px2: +(nstar/area_k).toFixed(1),
    star_avg_color: nsc? 'rgb('+Math.round(sumR/nsc)+','+Math.round(sumG/nsc)+','+Math.round(sumB/nsc)+')' : null,
    lum_hist_32buckets_pct: hist,
    sample_corner_tl: px(6,6),
    sample_corner_br: px(iw-6,ih-6),
    sample_center: px(Math.round(iw/2), Math.round(ih/2)),
    pure_black_pct: +(black/area_k/1000*100).toFixed(1),
    dark_to_78_pct: +(darkish/area_k/1000*100).toFixed(1),
    warmdark_of_dark_pct: darkish? +(warmDark/darkish*100).toFixed(1) : 0
  },null,1);
})()`;

(async()=>{
  const ver=await j('http://127.0.0.1:9222/json/version');
  const ws=new WebSocket(ver.webSocketDebuggerUrl);
  let id=0;const pend=new Map();const exs=[];
  const send=(m,p,s)=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});const o={id:i,method:m,params:p||{}};if(s)o.sessionId=s;ws.send(JSON.stringify(o))});
  ws.addEventListener('message',e=>{
    const m=JSON.parse(e.data);
    if(m.id&&pend.has(m.id)){const q=pend.get(m.id);pend.delete(m.id);m.error?q.rej(new Error(m.error.message)):q.res(m.result);return}
    if(m.method==='Runtime.exceptionThrown'){const dd=m.params.exceptionDetails;exs.push(((dd.exception&&dd.exception.description)||dd.text||'').split('\n')[0]);}
  });
  await new Promise(r=>ws.addEventListener('open',r));
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  await send('Runtime.enable',{},sessionId); await send('Page.enable',{},sessionId);
  await send('Network.enable',{},sessionId); await send('Network.setCacheDisabled',{cacheDisabled:true},sessionId);
  await send('Emulation.setDeviceMetricsOverride',{width:1680,height:959,deviceScaleFactor:1,mobile:false},sessionId);
  await send('Page.addScriptToEvaluateOnNewDocument',{source:'try{localStorage.clear();}catch(e){}'},sessionId);
  await send('Page.navigate',{url:BASE+'?cb='+Date.now()},sessionId);
  for(let i=0;i<120;i++){
    const r=await send('Runtime.evaluate',{expression:'typeof jobList!=="undefined" && typeof starLabelStats!=="undefined"',returnByValue:true},sessionId);
    if(r.result&&r.result.value===true) break;
    await new Promise(x=>setTimeout(x,400));
  }
  await new Promise(x=>setTimeout(x,1200));
  // 53 个岗位（正常状态）。注意：jobs=[] 会走空状态分支，测不到真实的星系绘制。
  await send('Runtime.evaluate',{expression:"(function(){var st=['pending','applied','assessment','exam','ai','interview1','interview2','hr','offer'];jobs=[];for(var i=0;i<53;i++)jobs.push(sanitizeJob({id:'J'+i,company:'公司'+i,position:'岗位'+i,status:st[i%9],city:'上海',applyDate:'2026-09-01',notes:''}));switchTab('track');setTrackView('star');})()",returnByValue:true},sessionId);
  await new Promise(x=>setTimeout(x,3000));
  const r=await send('Runtime.evaluate',{expression:CHECK,returnByValue:true},sessionId);
  console.log(r.exceptionDetails?('异常: '+JSON.stringify(r.exceptionDetails.exception&&r.exceptionDetails.exception.description).slice(0,300)):r.result.value);
  console.log('未捕获异常: '+(exs.length?exs.slice(0,3).join(' | '):'（无）'));
  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
