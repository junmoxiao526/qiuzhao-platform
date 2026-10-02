// 在指定视口下渲染 50 个岗位，量拥挤程度并截图
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
  // 等两帧 + 一点时间，让动画循环算出 screenX/screenY 并跑完标签布局
  await new Promise(function(res){ requestAnimationFrame(function(){ requestAnimationFrame(function(){ setTimeout(res,150); }); }); });
  var wrap=document.getElementById('starCanvasWrap'), wr=wrap.getBoundingClientRect();
  var sv=document.getElementById('starView'), svr=sv.getBoundingClientRect();
  var over=0, worst=null;
  for (var a=0;a<starStars.length;a++) for (var b=a+1;b<starStars.length;b++){
    var A=starStars[a], B=starStars[b];
    var d=Math.hypot(A.screenX-B.screenX, A.screenY-B.screenY);
    var rr=(A.size+B.size);
    if (d<rr){ over++; if(worst===null||d/rr<worst) worst=d/rr; }
  }
  var rs=Array.from(new Set(starStars.map(function(s){return +s.rx.toFixed(1)}))).sort(function(x,y){return y-x;});
  var xs=starStars.map(function(s){return s.screenX}), ys=starStars.map(function(s){return s.screenY});
  var bbW=Math.max.apply(null,xs)-Math.min.apply(null,xs), bbH=Math.max.apply(null,ys)-Math.min.apply(null,ys);
  return JSON.stringify({
    viewport: window.innerWidth+'x'+window.innerHeight,
    canvas: Math.round(wr.width)+'x'+Math.round(wr.height),
    starView: Math.round(svr.top)+'~'+Math.round(svr.bottom),
    scrollHeight: document.documentElement.scrollHeight,
    scrollable: document.documentElement.scrollHeight>window.innerHeight,
    planets: starStars.length,
    ringRadii: rs,
    outerRingWidthPct: (rs[0]*2/wr.width*100).toFixed(1)+'%',
    bbox: Math.round(bbW)+'x'+Math.round(bbH)+' = '+(bbW/wr.width*100).toFixed(0)+'% x '+(bbH/wr.height*100).toFixed(0)+'% of canvas',
    planetOverlaps: over,
    worstOverlapRatio: worst===null?'none':worst.toFixed(2),
    labels: starLabelStats
  }, null, 1);
})()`;
(async()=>{
  const [W,H] = (process.argv[3]||'1868x710').split('x').map(Number);
  const ver=await j('http://127.0.0.1:9222/json/version');
  const ws=new WebSocket(ver.webSocketDebuggerUrl);
  let id=0;const pend=new Map();
  const send=(m,p,s)=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});const o={id:i,method:m,params:p||{}};if(s)o.sessionId=s;ws.send(JSON.stringify(o))});
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){const q=pend.get(m.id);pend.delete(m.id);m.error?q.rej(new Error(m.error.message)):q.res(m.result)}});
  await new Promise(r=>ws.addEventListener('open',r));
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  await send('Runtime.enable',{},sessionId); await send('Page.enable',{},sessionId);
  await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:false},sessionId);
  await send('Page.addScriptToEvaluateOnNewDocument',{source:'try{localStorage.clear();}catch(e){}'},sessionId);
  await send('Page.navigate',{url:'http://127.0.0.1:8099/index.html'},sessionId);
  await new Promise(r=>setTimeout(r,3200));
  const r=await send('Runtime.evaluate',{expression:PROBE,returnByValue:true,awaitPromise:true},sessionId);
  if (r.exceptionDetails) console.log('页面异常:', JSON.stringify((r.exceptionDetails.exception||{}).description||r.exceptionDetails));
  else console.log(r.result.value);
  await new Promise(r=>setTimeout(r,600));
  const shot=await send('Page.captureScreenshot',{format:'png'},sessionId);
  fs.writeFileSync(process.argv[2],Buffer.from(shot.data,'base64'));
  console.log('截图已保存');
  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
