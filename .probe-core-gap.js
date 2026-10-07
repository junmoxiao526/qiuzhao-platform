// 量"中心徽标 → 最内环"的空隙，验证圆心不再有大空洞
const http = require('http'), fs = require('fs');
function j(u){return new Promise((res,rej)=>{http.get(u,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}

const SEED = `(function(){
  var stages=['pending','applied','assessment','exam','ai','interview1','interview2','hr','offer'];
  var names=['国家电投集团','国家开发银行','中石油','农夫山泉','杭州锦江集团','当纳利亚洲','龙湖集团','寒武纪','X-MOTORS','中国能建安徽院','福特中国','阿迪达斯','零跑汽车','龙旗科技','招商局船舶工业技术（上海）有限公司','华勤','中远海运重工','中国外运','镭目科技','卫龙'];
  jobs=[];
  for (var i=0;i<50;i++){
    jobs.push(sanitizeJob({id:'J'+i, company:names[i%names.length]+(i>=names.length?('#'+(i+1)):''), position:'岗位'+i,
      status:stages[i%stages.length], city:'上海', applyDate:'2026-09-01', notes:''}));
  }
  switchTab('track'); setTrackView('star');
})()`;

const MEASURE = `(async function(){
  await new Promise(function(res){ requestAnimationFrame(function(){ requestAnimationFrame(function(){ setTimeout(res,300); }); }); });
  var byRing={};
  starStars.forEach(function(s){
    var k=+s.rx.toFixed(2);
    (byRing[k]=byRing[k]||{rx:k,n:0}).n++;
  });
  var rings=Object.values(byRing).sort(function(a,b){return b.rx-a.rx;});
  rings.forEach(function(r,i){ r.gap=i===0?null:+(rings[i-1].rx-r.rx).toFixed(2); });
  var inner = rings.length ? rings[rings.length-1].rx : null;
  var BADGE_R = 24, BADGE_GLOW = 42;
  return JSON.stringify({
    ringCount: rings.length,
    outermostRx: rings.length?rings[0].rx:null,
    innermostRx: inner,
    // 关键指标：中心徽标边缘 → 最内环 的空隙
    coreGap_fromBadgeEdge: inner!=null ? +(inner-BADGE_R).toFixed(1) : null,
    coreGap_fromGlow: inner!=null ? +(inner-BADGE_GLOW).toFixed(1) : null,
    gaps: rings.map(function(r){return r.gap;}),
    gapMin: Math.min.apply(null, rings.slice(1).map(function(r){return r.gap;})),
    gapMax: Math.max.apply(null, rings.slice(1).map(function(r){return r.gap;})),
    ballSize: starStars.length?+starStars[0].size.toFixed(2):null
  }, null, 1);
})()`;

(async()=>{
  const [W,H] = (process.argv[2]||'1680x959').split('x').map(Number);
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
  await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:false},sessionId);
  await send('Page.addScriptToEvaluateOnNewDocument',{source:'try{localStorage.clear();}catch(e){}'},sessionId);
  await send('Page.navigate',{url:'http://127.0.0.1:8099/index.html?cb='+Date.now()},sessionId);
  // 等就绪（这份文件很大，冷启动要几秒）
  for(let i=0;i<80;i++){
    const r=await send('Runtime.evaluate',{expression:'typeof jobList!=="undefined" && typeof starStars!=="undefined"',returnByValue:true},sessionId);
    if(r.result && r.result.value===true) break;
    await new Promise(x=>setTimeout(x,400));
  }
  await new Promise(r=>setTimeout(r,1500));
  const s=await send('Runtime.evaluate',{expression:SEED,returnByValue:true},sessionId);
  if(s.exceptionDetails) console.log('SEED 异常:',JSON.stringify(s.exceptionDetails.exception&&s.exceptionDetails.exception.description));
  await new Promise(r=>setTimeout(r,1500));
  const r=await send('Runtime.evaluate',{expression:MEASURE,returnByValue:true,awaitPromise:true},sessionId);
  console.log(r.exceptionDetails ? '异常: '+JSON.stringify(r.exceptionDetails.exception&&r.exceptionDetails.exception.description) : r.result.value);
  const shot=await send('Page.captureScreenshot',{format:'png'},sessionId);
  fs.writeFileSync(process.argv[3]||'core.png',Buffer.from(shot.data,'base64'));
  console.log('截图 ' + (process.argv[3]||'core.png'));
  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
