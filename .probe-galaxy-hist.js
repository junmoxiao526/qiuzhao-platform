// 直接测 galaxyCanvas 本身的像素（不经主画布合成），定位"为什么这么淡"
const http = require('http');
function j(u){return new Promise((res,rej)=>{http.get(u,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}
const BASE = process.argv[2] || 'http://127.0.0.1:8099/index.html';
const EMPTY = `(function(){ jobs=[]; switchTab('track'); setTrackView('star'); })()`;

const PROBE = `(function(){
  var wrap=document.getElementById('starCanvasWrap');
  var c=wrap.querySelector('canvas'), g=c.getContext('2d');
  var dpr=window.devicePixelRatio||1;
  var W=wrap.clientWidth,H=wrap.clientHeight;
  // 主画布上星系层被 drawImage 到 (0,0,W,H)，与离屏同尺寸
  var img=g.getImageData(0,0,Math.round(W*dpr),Math.round(H*dpr));
  var d=img.data, iw=img.width, ih=img.height;
  var cx=W*0.5*dpr, cy=(H-46)*0.5*dpr, RR=0.62;
  var maxr=Math.min(W,H)*0.52*dpr;

  function L(i){ return 0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2]; }

  // 星系盘内所有像素的亮度分布（不排除任何东西，只看星系）
  var hist=new Array(16).fill(0), tot=0, lit=0, sum=0;
  for (var y=0;y<ih;y++){
    for (var x=0;x<iw;x++){
      if (y > ih-140 && x < 420) continue;
      var dx=x-cx, dy=(y-cy)/RR;
      var dist=Math.sqrt(dx*dx+dy*dy);
      if (dist > maxr) continue;
      var l=L((y*iw+x)*4);
      tot++; sum+=l; if(l>8) lit++;
      hist[Math.min(15, Math.floor(l/16))]++;
    }
  }
  return JSON.stringify({
    diskPx: tot, litPct: +(lit/tot*100).toFixed(2), avgLum: +(sum/tot).toFixed(2),
    hist16: hist.map(function(v){ return +(v/tot*100).toFixed(1); })
  },null,1);
})()`;

(async()=>{
  const ver=await j('http://127.0.0.1:9222/json/version');
  const ws=new WebSocket(ver.webSocketDebuggerUrl);
  let id=0;const pend=new Map();
  const send=(m,p,s)=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});const o={id:i,method:m,params:p||{}};if(s)o.sessionId=s;ws.send(JSON.stringify(o))});
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){const q=pend.get(m.id);pend.delete(m.id);m.error?q.rej(new Error(m.error.message)):q.res(m.result);}});
  await new Promise(r=>ws.addEventListener('open',r));
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  await send('Runtime.enable',{},sessionId); await send('Page.enable',{},sessionId);
  await send('Network.enable',{},sessionId); await send('Network.setCacheDisabled',{cacheDisabled:true},sessionId);
  await send('Emulation.setDeviceMetricsOverride',{width:1680,height:959,deviceScaleFactor:1,mobile:false},sessionId);
  await send('Page.addScriptToEvaluateOnNewDocument',{source:'try{localStorage.clear();}catch(e){}'},sessionId);
  await send('Page.navigate',{url:BASE+'?cb='+Date.now()},sessionId);
  for(let i=0;i<120;i++){
    const r=await send('Runtime.evaluate',{expression:'typeof jobList!=="undefined"',returnByValue:true},sessionId);
    if(r.result&&r.result.value===true) break;
    await new Promise(x=>setTimeout(x,400));
  }
  await new Promise(x=>setTimeout(x,1000));
  await send('Runtime.evaluate',{expression:EMPTY,returnByValue:true},sessionId);
  await new Promise(x=>setTimeout(x,2500));
  const r=await send('Runtime.evaluate',{expression:PROBE,returnByValue:true},sessionId);
  console.log(r.exceptionDetails?('异常: '+JSON.stringify(r.exceptionDetails.exception&&r.exceptionDetails.exception.description).slice(0,200)):r.result.value);
  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
