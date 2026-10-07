// 定位 fps 下降：是"星系烘焙"一次性变慢，还是每帧变慢？
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
  // 1) 纯帧率（渲染已经稳定后）
  function fps(){ return new Promise(function(res){
    var n=0,t0=performance.now();
    function tick(){ n++; if(performance.now()-t0<1500) requestAnimationFrame(tick); else res(Math.round(n/1.5)); }
    requestAnimationFrame(tick);
  });}
  out.fps_idle = await fps();
  // 2) 重新渲染星图（含星系烘焙）要多久
  var t0=performance.now();
  renderStarMap();
  out.rerender_ms = Math.round(performance.now()-t0);
  await new Promise(function(r){setTimeout(r,1200)});
  out.fps_after_rerender = await fps();
  // 3) 单帧耗时：在 frame 里插桩不方便，改为量 60 帧的总时长分布
  var times=[];
  await new Promise(function(res){
    var last=performance.now(), n=0;
    function tick(){
      var now=performance.now(); times.push(now-last); last=now; n++;
      if(n<120) requestAnimationFrame(tick); else res();
    }
    requestAnimationFrame(tick);
  });
  times.sort(function(a,b){return a-b});
  out.frame_ms_p50 = +times[60].toFixed(2);
  out.frame_ms_p90 = +times[108].toFixed(2);
  out.frame_ms_max = +times[119].toFixed(2);
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
  await new Promise(x=>setTimeout(x,3000));
  const r=await send('Runtime.evaluate',{expression:CHECK,returnByValue:true,awaitPromise:true},sessionId);
  console.log(r.exceptionDetails?('异常: '+JSON.stringify(r.exceptionDetails.exception&&r.exceptionDetails.exception.description).slice(0,300)):r.result.value);
  console.log('未捕获异常: '+(exs.length?exs.slice(0,3).join(' | '):'（无）'));
  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
