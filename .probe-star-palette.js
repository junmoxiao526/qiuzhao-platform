// 关掉缓存重新渲染，并直接回报页面里真实的配色与图例状态
const http = require('http'), fs = require('fs');
function j(u){return new Promise((res,rej)=>{http.get(u,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}
const PROBE = `(async function(){
  var stages=['pending','applied','assessment','exam','ai','interview1','interview2','hr','offer'];
  var names=['国家电投集团','国家开发银行','中石油','农夫山泉','杭州锦江集团','当纳利亚洲','龙湖集团','寒武纪','X-MOTORS','中国能建安徽院','福特中国','阿迪达斯','零跑汽车','龙旗科技','招商局船舶工业技术（上海）有限公司','华勤','中远海运重工','中国外运','镭目科技','卫龙'];
  jobs=[];
  for (var i=0;i<50;i++){
    jobs.push(sanitizeJob({id:'J'+i, company:names[i%names.length]+(i>=names.length?('#'+(i+1)):''), position:'岗位'+i,
      status:stages[i%stages.length], city:'上海', applyDate:'2026-09-01', notes:''}));
  }
  switchTab('track'); setTrackView('star');
  await new Promise(function(res){ requestAnimationFrame(function(){ requestAnimationFrame(function(){ setTimeout(res,150); }); }); });
  var legend=document.querySelector('.star-legend');
  var items=legend?Array.from(legend.querySelectorAll('.sl-item')).map(function(e){return e.textContent.trim()}):[];
  var ballColors={}; starStars.forEach(function(s){ ballColors[s.color]=(ballColors[s.color]||0)+1; });
  return JSON.stringify({
    statusDots: STATUSES.map(function(s){return s.key+'='+s.dot;}),
    stageColors: STAGE_COLORS,
    legendExists: !!legend,
    legendItems: items,
    legendNote: legend?(legend.querySelector('.sl-note')||{}).textContent:null,
    ballColorHistogram: ballColors,
    labels: {drawn:starLabelStats.drawn, skipped:starLabelStats.skipped, truncated:starLabelStats.truncated}
  }, null, 1);
})()`;
(async()=>{
  const [W,H] = (process.argv[3]||'1680x959').split('x').map(Number);
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
  await send('Network.setCacheDisabled',{cacheDisabled:true},sessionId);   // ← 关键：绕开缓存
  await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:false},sessionId);
  await send('Page.addScriptToEvaluateOnNewDocument',{source:'try{localStorage.clear();}catch(e){}'},sessionId);
  await send('Page.navigate',{url:'http://127.0.0.1:8099/index.html?cb='+Date.now()},sessionId);
  await new Promise(r=>setTimeout(r,3400));
  const r=await send('Runtime.evaluate',{expression:PROBE,returnByValue:true,awaitPromise:true},sessionId);
  if (r.exceptionDetails) console.log('页面异常:', JSON.stringify((r.exceptionDetails.exception||{}).description||r.exceptionDetails));
  else console.log(r.result.value);
  await new Promise(r=>setTimeout(r,700));
  const shot=await send('Page.captureScreenshot',{format:'png'},sessionId);
  fs.writeFileSync(process.argv[2],Buffer.from(shot.data,'base64'));
  console.log('截图已保存');
  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
