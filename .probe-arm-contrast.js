// 用页面里的离屏 galaxyCanvas 重建一张 PNG，单独看星系本身。
// 这是最干净的诊断：不受星球/徽标/主画布合成影响。
const http = require('http'), fs = require('fs');
function j(u){return new Promise((res,rej)=>{http.get(u,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}
const BASE = process.argv[2] || 'http://127.0.0.1:8099/index.html';

const DUMP = `(function(){
  // 主画布里每次帧都 drawImage 了星系层；这里改为直接找离屏 canvas 不现实
  // （它是闭包变量）。所以退一步：把主画布**只画星系**——
  // 清空后手动重放一次 drawImage 是做不到的，改用量化统计代替。
  var wrap=document.getElementById('starCanvasWrap');
  var c=wrap.querySelector('canvas'), g=c.getContext('2d');
  var dpr=window.devicePixelRatio||1;
  var W=wrap.clientWidth,H=wrap.clientHeight;
  var img=g.getImageData(0,0,Math.round(W*dpr),Math.round(H*dpr));
  var d=img.data, iw=img.width, ih=img.height;
  var cx=W*0.5*dpr, cy=(H-46)*0.5*dpr, RR=0.62;
  var maxr=Math.min(W,H)*0.52*dpr;
  function L(i){ return 0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2]; }
  // 沿螺旋线采样 vs 沿"臂间"采样，比较亮度 —— 这才能证明旋臂存在
  var TWIST=3.0, ARMS=2;
  function sample(armOffset, tFrom, tTo, n){
    var s=0,cnt=0;
    for (var k=0;k<n;k++){
      var t=tFrom+(tTo-tFrom)*(k/(n-1));
      var th=t*TWIST+armOffset;
      var rr=t*maxr*0.98;
      var x=cx+Math.cos(th)*rr, y=cy+Math.sin(th)*rr*RR;
      if (x<0||y<0||x>=iw||y>=ih) continue;
      s+=L((Math.round(y)*iw+Math.round(x))*4); cnt++;
    }
    return cnt? s/cnt : 0;
  }
  // 臂上取 8 条不同相位；臂间取偏移 π/ARMS 的位置
  var onArm=0, offArm=0;
  for (var a=0;a<8;a++){
    var off=a*Math.PI*2/8;
    onArm  += sample(off, 0.15, 0.95, 400);
    offArm += sample(off+Math.PI/ARMS, 0.15, 0.95, 400);
  }
  onArm/=8; offArm/=8;
  return JSON.stringify({
    onArm:+onArm.toFixed(2), offArm:+offArm.toFixed(2),
    contrast:+(onArm/(offArm||1)).toFixed(2)
  });
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
  await new Promise(x=>setTimeout(x,1200));
  await send('Runtime.evaluate',{expression:"(function(){jobs=[];switchTab('track');setTrackView('star');})()",returnByValue:true},sessionId);
  await new Promise(x=>setTimeout(x,2500));
  const r=await send('Runtime.evaluate',{expression:DUMP,returnByValue:true},sessionId);
  console.log(r.exceptionDetails?('异常: '+JSON.stringify(r.exceptionDetails.exception&&r.exceptionDetails.exception.description).slice(0,200)):r.result.value);

  // 导出"只有星系"的视图：隐藏所有 DOM 覆盖层后截图
  await send('Runtime.evaluate',{expression:"(function(){document.querySelectorAll('.star-legend,.star-zoom').forEach(function(e){e.style.display='none';});})()",returnByValue:true},sessionId);
  await new Promise(x=>setTimeout(x,600));
  const shot=await send('Page.captureScreenshot',{format:'png'},sessionId);
  fs.writeFileSync('galaxy-only.png',Buffer.from(shot.data,'base64'));
  console.log('已导出 galaxy-only.png');
  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
