// 回归：不同岗位数 / 不同环数下，圆心空隙是否都合理、球是否还重叠
const http = require('http');
function j(u){return new Promise((res,rej)=>{http.get(u,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}

// 每组：[标签, 各阶段岗位数]
const CASES = [
  ['9 阶段 · 50 岗（每阶段 5-6）', [6,6,6,6,6,5,5,5,5]],
  ['9 阶段 · 18 岗（每阶段 2）',   [2,2,2,2,2,2,2,2,2]],
  ['3 阶段 · 12 岗',               [6,4,2,0,0,0,0,0,0]],
  ['2 阶段 · 4 岗',                [2,2,0,0,0,0,0,0,0]],
  ['1 阶段 · 3 岗',                [3,0,0,0,0,0,0,0,0]],
  ['9 阶段 · 120 岗（压力）',      [20,18,15,14,13,12,11,9,8]],
  ['9 阶段 · 200 岗（极限）',      [40,30,25,22,20,18,17,15,13]],
];

const stageKeys = ['pending','applied','assessment','exam','ai','interview1','interview2','hr','offer'];

function seedExpr(counts){
  return `(function(){
    var plan=${JSON.stringify(counts)}, keys=${JSON.stringify(stageKeys)};
    jobs=[]; var i=0;
    plan.forEach(function(c,si){
      for(var k=0;k<c;k++){
        jobs.push(sanitizeJob({id:'J'+(i++), company:'公司'+i, position:'岗位'+i,
          status:keys[si], city:'上海', applyDate:'2026-09-01', notes:''}));
      }
    });
    switchTab('track'); setTrackView('star');
  })()`;
}

const MEASURE = `(async function(){
  await new Promise(function(res){ requestAnimationFrame(function(){ requestAnimationFrame(function(){ setTimeout(res,260); }); }); });
  var byRing={};
  starStars.forEach(function(s){ var k=+s.rx.toFixed(2); (byRing[k]=byRing[k]||{rx:k,n:0}).n++; });
  var rings=Object.values(byRing).sort(function(a,b){return b.rx-a.rx;});
  if(!rings.length) return JSON.stringify({error:'no stars'});
  var inner=rings[rings.length-1].rx;
  var BADGE_R=24, GLOW=42;
  // 球重叠检测（屏幕上两两距离 < 两半径之和）
  var ov=0;
  for(var a=0;a<starStars.length;a++) for(var b=a+1;b<starStars.length;b++){
    var dx=starStars[a].screenX-starStars[b].screenX, dy=starStars[a].screenY-starStars[b].screenY;
    var rr=(starStars[a].size+starStars[b].size)/2;
    if(Math.sqrt(dx*dx+dy*dy) < rr*0.92) ov++;
  }
  var gaps=[];
  for(var q=1;q<rings.length;q++) gaps.push(+(rings[q-1].rx-rings[q].rx).toFixed(1));
  return JSON.stringify({
    jobs: starStars.length,
    rings: rings.length,
    innermost: +inner.toFixed(1),
    coreGap_afterBadge: +(inner-BADGE_R).toFixed(1),
    coreGap_afterGlow: +(inner-GLOW).toFixed(1),
    gapRange: gaps.length ? [Math.min.apply(null,gaps), Math.max.apply(null,gaps)] : null,
    ballSize: +starStars[0].size.toFixed(2),
    overlaps: ov,
    labels: starLabelStats ? {drawn:starLabelStats.drawn, skipped:starLabelStats.skipped} : null
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
    if(r.result && r.result.value===true) break;
    await new Promise(x=>setTimeout(x,400));
  }

  console.log('用例'.padEnd(30) + '环数  最内环  圆心空隙  间距范围        球径   重叠  标签');
  console.log('-'.repeat(96));
  for(const [label, counts] of CASES){
    const e=await send('Runtime.evaluate',{expression:seedExpr(counts),returnByValue:true},sessionId);
    if(e.exceptionDetails){ console.log(label.padEnd(30)+' SEED 异常: '+JSON.stringify(e.exceptionDetails.exception&&e.exceptionDetails.exception.description).slice(0,80)); continue; }
    await new Promise(r=>setTimeout(r,1200));
    const r=await send('Runtime.evaluate',{expression:MEASURE,returnByValue:true,awaitPromise:true},sessionId);
    if(r.exceptionDetails){ console.log(label.padEnd(30)+' 异常: '+JSON.stringify(r.exceptionDetails.exception&&r.exceptionDetails.exception.description).slice(0,80)); continue; }
    const v=JSON.parse(r.result.value);
    if(v.error){ console.log(label.padEnd(30)+' '+v.error); continue; }
    console.log(
      label.padEnd(30) +
      String(v.rings).padStart(3) + '  ' +
      String(v.innermost).padStart(6) + '  ' +
      String(v.coreGap_afterBadge).padStart(7) + '  ' +
      (v.gapRange?('['+v.gapRange[0]+', '+v.gapRange[1]+']'):'-').padEnd(16) +
      String(v.ballSize).padStart(5) + '  ' +
      String(v.overlaps).padStart(4) + '  ' +
      (v.labels?(v.labels.drawn+'/'+(v.labels.drawn+v.labels.skipped)):'-')
    );
  }
  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
