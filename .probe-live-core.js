// 在线上站点实测核心修复：圆心空隙是否已从 113px 收到 46px
const http = require('http');
function j(u){return new Promise((res,rej)=>{http.get(u,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}
const BASE = process.argv[2] || 'https://junmoxiao526.github.io/qiuzhao-platform/index.html';
const stageKeys = ['pending','applied','assessment','exam','ai','interview1','interview2','hr','offer'];

const SEED = `(function(){
  var counts=[6,6,6,6,6,5,5,5,5], keys=${JSON.stringify(stageKeys)};
  jobs=[]; var i=0;
  counts.forEach(function(c,si){ for(var k=0;k<c;k++){
    jobs.push(sanitizeJob({id:'J'+(i++), company:'公司'+i, position:'岗位'+i,
      status:keys[si], city:'上海', applyDate:'2026-09-01', notes:''})); }});
  switchTab('track'); setTrackView('star');
})()`;

const MEASURE = `(async function(){
  await new Promise(function(res){ requestAnimationFrame(function(){ requestAnimationFrame(function(){ setTimeout(res,300); }); }); });
  var byRing={};
  starStars.forEach(function(s){ var k=+s.rx.toFixed(2); (byRing[k]=byRing[k]||{rx:k,n:0}).n++; });
  var rings=Object.values(byRing).sort(function(a,b){return b.rx-a.rx;});
  var inner=rings.length?rings[rings.length-1].rx:null;
  var ov=0;
  for(var a=0;a<starStars.length;a++) for(var b=a+1;b<starStars.length;b++){
    var dx=starStars[a].screenX-starStars[b].screenX, dy=starStars[a].screenY-starStars[b].screenY;
    if(Math.sqrt(dx*dx+dy*dy) < (starStars[a].size+starStars[b].size)/2*0.92) ov++;
  }
  var gaps=[]; for(var q=1;q<rings.length;q++) gaps.push(+(rings[q-1].rx-rings[q].rx).toFixed(1));
  return JSON.stringify({
    ringCount: rings.length,
    innermostRx: inner!=null?+inner.toFixed(1):null,
    coreGap_fromBadgeEdge: inner!=null?+(inner-24).toFixed(1):null,
    gapRange: gaps.length?[Math.min.apply(null,gaps),Math.max.apply(null,gaps)]:null,
    overlaps: ov,
    labels: starLabelStats?starLabelStats.drawn+'/'+(starLabelStats.drawn+starLabelStats.skipped):null
  },null,1);
})()`;

(async()=>{
  const ver=await j('http://127.0.0.1:9222/json/version');
  const ws=new WebSocket(ver.webSocketDebuggerUrl);
  let id=0;const pend=new Map();
  const send=(m,p,s)=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});const o={id:i,method:m,params:p||{}};if(s)o.sessionId=s;ws.send(JSON.stringify(o))});
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){const q=pend.get(m.id);pend.delete(m.id);m.error?q.rej(new Error(m.error.message)):q.res(m.result)}});
  await new Promise(r=>ws.addEventListener('open',r));
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  await send('Runtime.enable',{},sessionId); await send('Page.enable',{},sessionId);
  await send('Network.enable',{},sessionId);
  await send('Network.setCacheDisabled',{cacheDisabled:true},sessionId);
  await send('Emulation.setDeviceMetricsOverride',{width:1680,height:959,deviceScaleFactor:1,mobile:false},sessionId);
  await send('Page.navigate',{url:BASE},sessionId);
  // 冷启动这份 940KB 的文件要好几秒，必须等 app 真就绪
  let ready=false;
  for(let i=0;i<120;i++){
    const r=await send('Runtime.evaluate',{expression:'typeof jobList!=="undefined" && typeof starLabelStats!=="undefined" && document.querySelectorAll("script").length===3',returnByValue:true},sessionId);
    if(r.result&&r.result.value===true){ ready=true; break; }
    await new Promise(x=>setTimeout(x,500));
  }
  if(!ready){ console.log('❌ 线上页面始终没就绪'); await send('Target.closeTarget',{targetId}); ws.close(); return; }
  console.log('✅ 线上页面已就绪（3 段脚本都在）');
  const s=await send('Runtime.evaluate',{expression:SEED,returnByValue:true},sessionId);
  if(s.exceptionDetails) console.log('SEED 异常:',JSON.stringify(s.exceptionDetails.exception&&s.exceptionDetails.exception.description));
  await new Promise(r=>setTimeout(r,2000));
  const r=await send('Runtime.evaluate',{expression:MEASURE,returnByValue:true,awaitPromise:true},sessionId);
  console.log(r.exceptionDetails ? '异常: '+JSON.stringify(r.exceptionDetails.exception&&r.exceptionDetails.exception.description) : r.result.value);
  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
