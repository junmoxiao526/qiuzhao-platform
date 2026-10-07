// 把星图画布**单独**截出来（clip 到 canvas 元素），用于看清上面到底画了什么。
const http = require('http'), fs = require('fs');
function j(u){return new Promise((res,rej)=>{http.get(u,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}
const BASE = process.argv[2] || 'http://127.0.0.1:8099/index.html';
const OUT  = process.argv[3] || 'canvas-only.png';

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
    const r=await send('Runtime.evaluate',{expression:'typeof jobList!=="undefined" && typeof starLabelStats!=="undefined"',returnByValue:true},sessionId);
    if(r.result&&r.result.value===true) break;
    await new Promise(x=>setTimeout(x,400));
  }
  await new Promise(x=>setTimeout(x,1200));
  await send('Runtime.evaluate',{expression:"(function(){var st=['pending','applied','assessment','exam','ai','interview1','interview2','hr','offer'];jobs=[];for(var i=0;i<53;i++)jobs.push(sanitizeJob({id:'J'+i,company:'公司'+i,position:'岗位'+i,status:st[i%9],city:'上海',applyDate:'2026-09-01',notes:''}));switchTab('track');setTrackView('star');})()",returnByValue:true},sessionId);
  await new Promise(x=>setTimeout(x,3000));
  const rect=await send('Runtime.evaluate',{expression:"(function(){var c=document.querySelector('#starCanvasWrap canvas');var r=c.getBoundingClientRect();return JSON.stringify({x:r.x,y:r.y,w:r.width,h:r.height});})()",returnByValue:true},sessionId);
  const R=JSON.parse(rect.result.value);
  console.log('canvas rect', JSON.stringify(R));
  const shot=await send('Page.captureScreenshot',{format:'png',clip:{x:R.x,y:R.y,width:R.w,height:R.h,scale:1}},sessionId);
  fs.writeFileSync(OUT, Buffer.from(shot.data,'base64'));
  console.log('saved', OUT);
  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
