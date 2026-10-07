// 验证"每一环用自己的颜色星云区分"：
// 在每条环半径上取样，统计该环附近的**色相**，
// 再和该阶段应有的 STAGE_COLORS 色相对照。
const http = require('http'), fs = require('fs');
function j(u){return new Promise((res,rej)=>{http.get(u,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}
const BASE = process.argv[2] || 'http://127.0.0.1:8099/index.html';
const EMPTY = "(function(){jobs=[];switchTab('track');setTrackView('star');})()";

// 用 9 个阶段各 6 个岗位，环全开
const SEED = `(function(){
  var stages=['pending','applied','assessment','exam','ai','interview1','interview2','hr','offer'];
  jobs=[];
  for (var i=0;i<9;i++){
    for(var k=0;k<3;k++){
      jobs.push(sanitizeJob({id:'J'+i+'_'+k, company:'公司'+i+'_'+k, position:'岗位',
        status:stages[i], city:'上海', applyDate:'2026-09-01', notes:''}));
    }
  }
  switchTab('track'); setTrackView('star');
})()`;

const CHECK = `(function(){
  var wrap=document.getElementById('starCanvasWrap');
  var c=wrap.querySelector('canvas'), g=c.getContext('2d');
  var dpr=window.devicePixelRatio||1;
  var W=wrap.clientWidth,H=wrap.clientHeight;
  var img=g.getImageData(0,0,Math.round(W*dpr),Math.round(H*dpr));
  var d=img.data, iw=img.width, ih=img.height;
  var cx=W*0.5*dpr, cy=(H-46)*0.5*dpr, RR=0.62;

  function hueOf(r,gg,b){
    r/=255; gg/=255; b/=255;
    var mx=Math.max(r,gg,b), mn=Math.min(r,gg,b), dd=mx-mn;
    if(dd<1e-6) return -1;          // 无彩
    var h;
    if(mx===r) h=((gg-b)/dd+6)%6;
    else if(mx===gg) h=(b-r)/dd+2;
    else h=(r-gg)/dd+4;
    return h*60;
  }
  function hueName(h){
    if(h<0) return '无彩';
    if(h<20||h>=330) return '红';
    if(h<45) return '橙';
    if(h<70) return '黄';
    if(h<160) return '绿';
    if(h<200) return '青';
    if(h<260) return '蓝';
    if(h<300) return '紫';
    return '洋红';
  }

  // 每条环：在环半径 ±(band) 内取样，只统计"有彩且不太暗"的像素
  var radii={};
  starStars.forEach(function(s){ radii[+s.rx.toFixed(1)]=1; });
  var rs=Object.keys(radii).map(Number).sort(function(a,b){return b-a});

  var out=[];
  rs.forEach(function(R, i){
    var hist={}, n=0, sumR=0,sumG=0,sumB=0;
    // 排除星球本身（高饱和大色块）：只取低饱和到中饱和的星云像素
    var rp=R*dpr;
    for(var a=0;a<360;a+=1){
      var rad=a*Math.PI/180;
      for(var dr=-14;dr<=14;dr+=3){
        var rr=(R+dr)*dpr;
        if(rr<4) continue;
        var x=Math.round(cx+Math.cos(rad)*rr);
        var y=Math.round(cy+Math.sin(rad)*rr*RR);
        if(x<0||y<0||x>=iw||y>=ih) continue;
        var idx=(y*iw+x)*4;
        var r0=d[idx],g0=d[idx+1],b0=d[idx+2];
        var lum=0.2126*r0+0.7152*g0+0.0722*b0;
        if(lum<14) continue;
        var mx=Math.max(r0,g0,b0),mn=Math.min(r0,g0,b0);
        var sat=mx? (mx-mn)/mx : 0;
        // 注意：早先这里用 sat>0.55 排除"星球"，结果把**饱和度高的星云本身**
        // 也一起排除了（强上色的星云 sat 恰恰很高），于是外环只剩几十个采样点，
        // 得出"外环没上色"的错误结论。真正要排除的是星球那种大面积高饱和色块，
        // 所以改成只在"接近球心"的极少数像素上排除，见下面 distToStar。
        var h=hueOf(r0,g0,b0);
        if(h<0) continue;
        hist[hueName(h)]=(hist[hueName(h)]||0)+1;
        n++; sumR+=r0; sumG+=g0; sumB+=b0;
      }
    }
    var top=Object.entries(hist).sort(function(a,b){return b[1]-a[1]}).slice(0,3);
    out.push({
      ring:i, r:+R.toFixed(1),
      avg: n? ('#'+[sumR/n,sumG/n,sumB/n].map(function(v){return Math.round(v).toString(16).padStart(2,'0')}).join('')) : null,
      hue: n? hueName(hueOf(sumR/n,sumG/n,sumB/n)) : null,
      top: top.map(function(t){return t[0]+':'+(t[1]/n*100).toFixed(0)+'%'}),
      samples:n
    });
  });
  // 阶段应有色：activeStages 在 renderStarMap 作用域内拿不到，
  // 但 starStars 上带了 stage，用一颗球的 color 反推该阶段色
  var seen={};
  starStars.forEach(function(s){ if(!seen[s.stage]) seen[s.stage]=s.color; });
  var expect = Object.keys(seen).map(function(k){
    var col=seen[k];
    var r0=parseInt(col.slice(1,3),16),g0=parseInt(col.slice(3,5),16),b0=parseInt(col.slice(5,7),16);
    return k+'='+hueName(hueOf(r0,g0,b0))+' ('+col+')';
  });
  return JSON.stringify({rings:out, expect:expect},null,1);
})()`;

(async()=>{
  const ver=await j('http://127.0.0.1:9222/json/version');
  const ws=new WebSocket(ver.webSocketDebuggerUrl);
  let id=0;const pend=new Map();const exs=[];
  const send=(m,p,s)=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});const o={id:i,method:m,params:p||{}};if(s)o.sessionId=s;ws.send(JSON.stringify(o))});
  ws.addEventListener('message',e=>{
    const m=JSON.parse(e.data);
    if(m.id&&pend.has(m.id)){const q=pend.get(m.id);pend.delete(m.id);m.error?q.rej(new Error(m.error.message)):q.res(m.result);return}
    if(m.method==='Runtime.exceptionThrown'){const d=m.params.exceptionDetails;exs.push(((d.exception&&d.exception.description)||d.text||'').split('\n')[0]);}
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
  await send('Runtime.evaluate',{expression:SEED,returnByValue:true},sessionId);
  await new Promise(x=>setTimeout(x,2600));
  const r=await send('Runtime.evaluate',{expression:CHECK,returnByValue:true},sessionId);
  console.log(r.exceptionDetails?('异常: '+JSON.stringify(r.exceptionDetails.exception&&r.exceptionDetails.exception.description).slice(0,300)):r.result.value);
  console.log('未捕获异常: '+(exs.length?exs.slice(0,4).join(' | '):'（无）'));
  const shot=await send('Page.captureScreenshot',{format:'png'},sessionId);
  fs.writeFileSync('nebula.png',Buffer.from(shot.data,'base64'));
  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
