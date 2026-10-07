// 只测星系本体：排除中心徽标(r<90)、排除图例区、排除边缘
// 并给出"旋臂对比度"—— 星系盘内亮区/暗区的中位亮度比
const http = require('http');
function j(u){return new Promise((res,rej)=>{http.get(u,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}
const BASE = process.argv[2] || 'http://127.0.0.1:8099/index.html';
const EMPTY = `(function(){ jobs=[]; switchTab('track'); setTrackView('star'); })()`;

const MEASURE = `(function(){
  var wrap=document.getElementById('starCanvasWrap');
  var c=wrap.querySelector('canvas'), g=c.getContext('2d');
  var dpr=window.devicePixelRatio||1;
  var W=wrap.clientWidth,H=wrap.clientHeight;
  var img=g.getImageData(0,0,Math.round(W*dpr),Math.round(H*dpr));
  var d=img.data, iw=img.width, ih=img.height;
  var cx=W*0.5*dpr, cy=(H-46)*0.5*dpr, RR=0.62;
  var maxr=Math.min(W,H)*0.52*dpr;

  function L(i){ return 0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2]; }

  // 只统计"星系盘、半径 110~0.95maxr、且低饱和"的像素
  var vals=[], NA=72, bins=new Array(NA).fill(0), cnt=new Array(NA).fill(0);
  var nz=0, tot=0;
  for (var y=0;y<ih;y+=1){
    for (var x=0;x<iw;x+=1){
      // 排除图例（左下角约 150x40）
      if (y > ih-140 && x < 420) continue;
      var i=(y*iw+x)*4;
      var dx=x-cx, dy=(y-cy)/RR;
      var dist=Math.sqrt(dx*dx+dy*dy);
      if (dist < 110 || dist > maxr*0.95) continue;
      var r=d[i],gg=d[i+1],b=d[i+2];
      var l=L(i);
      var mx=Math.max(r,gg,b), mn=Math.min(r,gg,b);
      if (mx>0 && (mx-mn)/mx > 0.42) continue;
      tot++; if (l>12) nz++;
      vals.push(l);
      var a=(Math.atan2(dy,dx)+Math.PI*2)%(Math.PI*2);
      var bi=Math.floor(a/(Math.PI*2)*NA);
      bins[bi]+=l; cnt[bi]++;
    }
  }
  vals.sort(function(a,b){return a-b});
  var q=function(p){ return vals.length? +vals[Math.floor(vals.length*p)].toFixed(2):0; };
  var prof=bins.map(function(v,i){return cnt[i]?v/cnt[i]:0});
  var mean=prof.reduce(function(a,b){return a+b},0)/NA;
  var sd=Math.sqrt(prof.reduce(function(a,b){return a+(b-mean)*(b-mean)},0)/NA);

  // 径向面亮度（应随半径衰减）
  var NB=8, rb=new Array(NB).fill(0), rc=new Array(NB).fill(0);
  for (var y2=0;y2<ih;y2+=2){
    for (var x2=0;x2<iw;x2+=2){
      if (y2 > ih-140 && x2 < 420) continue;
      var i2=(y2*iw+x2)*4;
      var DD=Math.sqrt(Math.pow(x2-cx,2)+Math.pow((y2-cy)/RR,2));
      if (DD<110 || DD>maxr) continue;
      var bi2=Math.floor((DD-110)/(maxr-110)*NB);
      if(bi2<0||bi2>=NB) continue;
      rb[bi2]+=L(i2); rc[bi2]++;
    }
  }
  var radial=rb.map(function(v,i){ return rc[i]? +(v/rc[i]).toFixed(2):0; });

  return JSON.stringify({
    pxInDisk: tot,
    coveragePct: +(nz/tot*100).toFixed(2),
    lum_p10:q(0.10), lum_p50:q(0.50), lum_p90:q(0.90), lum_max:+vals[vals.length-1].toFixed(2),
    armContrast: +(q(0.90)/(q(0.50)||1)).toFixed(2),
    angular_cv: +(sd/(mean||1)*100).toFixed(1),
    angular_min:+Math.min.apply(null,prof).toFixed(2), angular_max:+Math.max.apply(null,prof).toFixed(2),
    radialProfile: radial
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
  await send('Network.enable',{},sessionId);
  await send('Network.setCacheDisabled',{cacheDisabled:true},sessionId);
  await send('Emulation.setDeviceMetricsOverride',{width:1680,height:959,deviceScaleFactor:1,mobile:false},sessionId);
  await send('Page.addScriptToEvaluateOnNewDocument',{source:'try{localStorage.clear();}catch(e){}'},sessionId);
  await send('Page.navigate',{url:BASE+'?cb='+Date.now()},sessionId);
  for(let i=0;i<120;i++){
    const r=await send('Runtime.evaluate',{expression:'typeof jobList!=="undefined" && typeof starLabelStats!=="undefined"',returnByValue:true},sessionId);
    if(r.result&&r.result.value===true) break;
    await new Promise(x=>setTimeout(x,400));
  }
  await new Promise(x=>setTimeout(x,1200));
  const ev=async(e)=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true},sessionId);return r.exceptionDetails?('异常: '+JSON.stringify(r.exceptionDetails.exception&&r.exceptionDetails.exception.description).slice(0,200)):r.result.value;};

  console.log('=== 仅星系（0 岗位，排除徽标/图例）===');
  await ev(EMPTY);
  await new Promise(x=>setTimeout(x,2500));
  console.log(await ev(MEASURE));
  console.log('\n未捕获异常: ' + (exs.length?exs.slice(0,4).join(' | '):'（无）'));
  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
