// 精确拆解 rerender 耗时：把 renderStarMap 内部各阶段分别计时。
// 手段：包住 CanvasRenderingContext2D 的耗时方法，累计"每阶段"的绘制时间。
// 用 performance.mark 分段更准，但阶段在闭包里 —— 改用"进入 setTrackView 后
// 按时间片采样 rAF 看不到"。所以这里退一步：分别构造 3 个对照，
// 逐个禁用可疑成本项，看 rerender 掉多少。
const http = require('http');
function j(u){return new Promise((res,rej)=>{http.get(u,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}
const BASE = process.argv[2] || 'http://127.0.0.1:8099/index.html';

const MEASURE = (label) => `(async function(){
  jobs=[];
  for (var i=0;i<53;i++) jobs.push({id:'J'+i,company:'公司'+i,position:'岗位',status:'pending',city:'上海'});
  switchTab('track'); setTrackView('list');
  await new Promise(function(r){setTimeout(r,600)});
  var t=[];
  for (var k=0;k<6;k++){
    var a=performance.now(); setTrackView('star'); t.push(performance.now()-a);
    setTrackView('list'); await new Promise(function(r){setTimeout(r,120)});
  }
  t.sort(function(x,y){return x-y});
  return JSON.stringify({label:'${label}', min:+t[0].toFixed(1), median:+t[3].toFixed(1), max:+t[5].toFixed(1)});
})()`;

async function run(wsUrl, base, label, patch) {
  const jj = await j('http://127.0.0.1:9222/json/version');
  const ws = new WebSocket(jj.webSocketDebuggerUrl);
  let id=0; const pend=new Map();
  const send=(m,p,s)=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});const o={id:i,method:m,params:p||{}};if(s)o.sessionId=s;ws.send(JSON.stringify(o))});
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){const q=pend.get(m.id);pend.delete(m.id);m.error?q.rej(new Error(m.error.message)):q.res(m.result);}});
  await new Promise(r=>ws.addEventListener('open',r));
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  await send('Runtime.enable',{},sessionId); await send('Page.enable',{},sessionId);
  await send('Network.enable',{},sessionId); await send('Network.setCacheDisabled',{cacheDisabled:true},sessionId);
  await send('Emulation.setDeviceMetricsOverride',{width:1680,height:959,deviceScaleFactor:1,mobile:false},sessionId);
  await send('Page.addScriptToEvaluateOnNewDocument',{source:'try{localStorage.clear();}catch(e){}'},sessionId);
  if (patch) await send('Page.addScriptToEvaluateOnNewDocument',{source:patch},sessionId);
  await send('Page.navigate',{url:base+'?cb='+Date.now()},sessionId);
  for(let i=0;i<120;i++){
    const r=await send('Runtime.evaluate',{expression:'typeof jobList!=="undefined" && typeof starLabelStats!=="undefined"',returnByValue:true},sessionId);
    if(r.result&&r.result.value===true) break;
    await new Promise(x=>setTimeout(x,400));
  }
  await new Promise(x=>setTimeout(x,1200));
  const r=await send('Runtime.evaluate',{expression:MEASURE(label),returnByValue:true,awaitPromise:true},sessionId);
  console.log(r.exceptionDetails?('异常: '+JSON.stringify(r.exceptionDetails.exception&&r.exceptionDetails.exception.description).slice(0,200)):r.result.value);
  await send('Target.closeTarget',{targetId}); ws.close();
}

(async()=>{
  await run('', BASE, 'baseline');
  // 禁用 getImageData 去饱和那一步（把 getImageData 变成返回空白 → 直接跳过处理）
  await run('', BASE, 'no-desaturate', `(function(){
    var P = CanvasRenderingContext2D.prototype;
    P.__origGet = P.getImageData;
    P.getImageData = function(){ return {data:new Uint8ClampedArray(4), width:1, height:1}; };
    P.putImageData = function(){};
  })()`);
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
