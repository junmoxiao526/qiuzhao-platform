// 拆解星系烘焙的耗时构成：分别给各阶段计时。
// 手法：在页面里用 monkey-patch 包住 CanvasRenderingContext2D 的
// createRadialGradient / createLinearGradient / fill，统计调用次数与总耗时。
const http = require('http');
function j(u){return new Promise((res,rej)=>{http.get(u,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}
const BASE = process.argv[2] || 'http://127.0.0.1:8099/index.html';

const INSTRUMENT = `(function(){
  if (window.__cgPatched) return;
  window.__cgPatched = true;
  window.__cgStats = {rg:0, lg:0, fill:0, ellipse:0, arc:0};
  var P = CanvasRenderingContext2D.prototype;
  var org = P.createRadialGradient;
  P.createRadialGradient = function(){ window.__cgStats.rg++; return org.apply(this, arguments); };
  var olg = P.createLinearGradient;
  P.createLinearGradient = function(){ window.__cgStats.lg++; return olg.apply(this, arguments); };
  var of = P.fill;
  P.fill = function(){ window.__cgStats.fill++; return of.apply(this, arguments); };
  var oe = P.ellipse;
  P.ellipse = function(){ window.__cgStats.ellipse++; return oe.apply(this, arguments); };
  var oa = P.arc;
  P.arc = function(){ window.__cgStats.arc++; return oa.apply(this, arguments); };
})()`;

const MEASURE = `(async function(){
  jobs=[];
  for (var i=0;i<53;i++) jobs.push({id:'J'+i,company:'公司'+i,position:'岗位',status:'pending',city:'上海'});
  var out={};
  window.__cgStats = {rg:0,lg:0,fill:0,ellipse:0,arc:0};
  switchTab('track'); setTrackView('star');
  await new Promise(function(r){setTimeout(r,900)});
  out.bake_stats = JSON.parse(JSON.stringify(window.__cgStats));

  // 稳定后每一帧的绘制调用数（1 秒内）
  window.__cgStats = {rg:0,lg:0,fill:0,ellipse:0,arc:0};
  await new Promise(function(res){
    var n=0;
    function tick(){ n++; if(n<30) requestAnimationFrame(tick); else res(); }
    requestAnimationFrame(tick);
  });
  out.per_30frames = JSON.parse(JSON.stringify(window.__cgStats));
  return JSON.stringify(out,null,1);
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
  await send('Page.addScriptToEvaluateOnNewDocument',{source:INSTRUMENT},sessionId);
  await send('Page.addScriptToEvaluateOnNewDocument',{source:'try{localStorage.clear();}catch(e){}'},sessionId);
  await send('Page.navigate',{url:BASE+'?cb='+Date.now()},sessionId);
  for(let i=0;i<120;i++){
    const r=await send('Runtime.evaluate',{expression:'typeof jobList!=="undefined" && typeof starLabelStats!=="undefined"',returnByValue:true},sessionId);
    if(r.result&&r.result.value===true) break;
    await new Promise(x=>setTimeout(x,400));
  }
  await new Promise(x=>setTimeout(x,1200));
  const r=await send('Runtime.evaluate',{expression:MEASURE,returnByValue:true,awaitPromise:true},sessionId);
  console.log(r.exceptionDetails?('异常: '+JSON.stringify(r.exceptionDetails.exception&&r.exceptionDetails.exception.description).slice(0,300)):r.result.value);
  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
