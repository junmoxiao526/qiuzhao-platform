// 真正有意义的性能指标：**渲染一帧的实际 CPU 时间**，而不是 rAF 回调节奏。
// 背景：headless Edge 跑在 30Hz vsync 上，rAF 天然就是 33.3ms 一次，
// 用"每秒 rAF 次数"当 fps 会把两版都测成 31，掩盖真实差异。
// 这里改为直接测 renderStarMap() 的耗时（含星系烘焙），
// 以及手动连续调用 frame 的净计算时间。
const http = require('http');
function j(u){return new Promise((res,rej)=>{http.get(u,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}
const BASE = process.argv[2] || 'http://127.0.0.1:8099/index.html';
const SEED = `(function(){
  var stages=['pending','applied','assessment','exam','ai','interview1','interview2','hr','offer'];
  jobs=[];
  for (var i=0;i<53;i++) jobs.push(sanitizeJob({id:'J'+i, company:'公司'+i, position:'岗位'+i,status:stages[i%stages.length],city:'上海',applyDate:'2026-09-01',notes:''}));
  switchTab('track'); setTrackView('star');
})()`;

const CHECK = `(async function(){
  var out={};
  // renderStarMap / getPlanetSprite 都在闭包里取不到，
  // 改用公开入口 setTrackView('star') —— 它会完整重建星图（含星系烘焙）。
  var t=[];
  for (var k=0;k<5;k++){
    var a=performance.now();
    setTrackView('star');
    t.push(performance.now()-a);
  }
  t.sort(function(x,y){return x-y});
  out.rerender_ms = { min:+t[0].toFixed(1), median:+t[2].toFixed(1), max:+t[4].toFixed(1) };

  // 切走再切回，量"离开星图后是否停止动画"（应该有 cancel）
  setTrackView('list');
  await new Promise(function(r){setTimeout(r,300)});
  setTrackView('star');
  await new Promise(function(r){setTimeout(r,500)});

  var gc=document.querySelector('#starCanvasWrap canvas');
  out.canvas = gc? gc.width+'x'+gc.height : null;
  out.starCount = starStars.length;
  out.labels = starLabelStats ? starLabelStats.drawn+'/'+starLabelStats.planets : null;

  // rAF 间隔（用于说明 vsync 频率，不当作帧率结论）
  var iv=[];
  await new Promise(function(res){
    var last=performance.now(), n=0;
    function tick(){ var now=performance.now(); iv.push(now-last); last=now; n++; if(n<60) requestAnimationFrame(tick); else res(); }
    requestAnimationFrame(tick);
  });
  iv.sort(function(a,b){return a-b});
  out.vsync_interval_ms = +iv[30].toFixed(2);
  return JSON.stringify(out,null,1);
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
  const r=await send('Runtime.evaluate',{expression:CHECK,returnByValue:true,awaitPromise:true},sessionId);
  console.log(r.exceptionDetails?('异常: '+JSON.stringify(r.exceptionDetails.exception&&r.exceptionDetails.exception.description).slice(0,300)):r.result.value);
  console.log('未捕获异常: '+(exs.length?exs.slice(0,3).join(' | '):'（无）'));
  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
