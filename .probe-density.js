// 不看图，用几何指标判断"环间距相对球径是否过疏/过密"
const http = require('http');
function j(u){return new Promise((res,rej)=>{http.get(u,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}
const stageKeys = ['pending','applied','assessment','exam','ai','interview1','interview2','hr','offer'];
const CASES = [
  ['9 阶段 · 50 岗',  [6,6,6,6,6,5,5,5,5]],
  ['3 阶段 · 12 岗',  [6,4,2,0,0,0,0,0,0]],
  ['2 阶段 · 4 岗',   [2,2,0,0,0,0,0,0,0]],
  ['4 阶段 · 30 岗',  [10,8,7,5,0,0,0,0,0]],
];
function seedExpr(counts){
  return `(function(){
    var plan=${JSON.stringify(counts)}, keys=${JSON.stringify(stageKeys)};
    jobs=[]; var i=0;
    plan.forEach(function(c,si){ for(var k=0;k<c;k++){
      jobs.push(sanitizeJob({id:'J'+(i++), company:'公司'+i, position:'岗位'+i,
        status:keys[si], city:'上海', applyDate:'2026-09-01', notes:''})); }});
    switchTab('track'); setTrackView('star');
  })()`;
}
const MEASURE = `(async function(){
  await new Promise(function(res){ requestAnimationFrame(function(){ requestAnimationFrame(function(){ setTimeout(res,260); }); }); });
  var byRing={};
  starStars.forEach(function(s){ var k=+s.rx.toFixed(2); (byRing[k]=byRing[k]||{rx:k,n:0}).n++; });
  var rings=Object.values(byRing).sort(function(a,b){return b.rx-a.rx;});
  var gaps=[]; for(var q=1;q<rings.length;q++) gaps.push(+(rings[q-1].rx-rings[q].rx).toFixed(1));
  var sz=starStars.length?+starStars[0].size.toFixed(2):0;
  var g=gaps.length?gaps[0]:0;
  return JSON.stringify({
    rings: rings.length, innermost:+rings[rings.length-1].rx.toFixed(1),
    coreGap:+(rings[rings.length-1].rx-24).toFixed(1),
    gap: g, ballSize: sz,
    // 视觉密度：环间距 / 球直径。经验上 2~6 看着舒服，>10 就太空
    densityRatio: +(g/(sz*2)).toFixed(2),
    // 纵向实际空隙（椭圆压扁后）
    visualGapY: +(g*0.62 - sz).toFixed(1)
  });
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
  for(let i=0;i<80;i++){
    const r=await send('Runtime.evaluate',{expression:'typeof jobList!=="undefined" && typeof starLabelStats!=="undefined"',returnByValue:true},sessionId);
    if(r.result&&r.result.value===true) break; await new Promise(x=>setTimeout(x,400));
  }
  console.log('用例'.padEnd(18)+'环数  最内环  圆心空隙   环间距   球径   间距/球径   纵向净空');
  console.log('-'.repeat(88));
  for(const [label,counts] of CASES){
    const e=await send('Runtime.evaluate',{expression:seedExpr(counts),returnByValue:true},sessionId);
    if(e.exceptionDetails){ console.log(label.padEnd(18)+' SEED 异常'); continue; }
    await new Promise(r=>setTimeout(r,1200));
    const r=await send('Runtime.evaluate',{expression:MEASURE,returnByValue:true,awaitPromise:true},sessionId);
    if(r.exceptionDetails){ console.log(label.padEnd(18)+' 异常 '+JSON.stringify(r.exceptionDetails.exception&&r.exceptionDetails.exception.description).slice(0,60)); continue; }
    const v=JSON.parse(r.result.value);
    console.log(label.padEnd(18)+String(v.rings).padStart(3)+'  '+
      String(v.innermost).padStart(6)+'  '+String(v.coreGap).padStart(7)+'  '+
      String(v.gap).padStart(7)+'  '+String(v.ballSize).padStart(5)+'  '+
      String(v.densityRatio).padStart(7)+'   '+String(v.visualGapY).padStart(6));
  }
  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
