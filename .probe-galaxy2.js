// 深度检查：核球是否被中心徽标压住、缩放后星系是否跟随、旋臂在角度上是否成对
const http = require('http');
function j(u){return new Promise((res,rej)=>{http.get(u,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}
const BASE = process.argv[2] || 'http://127.0.0.1:8099/index.html';

const SEED = `(function(){
  var stages=['pending','applied','assessment','exam','ai','interview1','interview2','hr','offer'];
  var names=['国家电投集团','国家开发银行','中石油','农夫山泉','杭州锦江集团','当纳利亚洲','龙湖集团','寒武纪','X-MOTORS','中国能建安徽院','福特中国','阿迪达斯','零跑汽车','龙旗科技','华勤','中远海运重工','中国外运','镭目科技','卫龙'];
  jobs=[];
  for (var i=0;i<50;i++){
    jobs.push(sanitizeJob({id:'J'+i, company:names[i%names.length]+(i>=names.length?('#'+(i+1)):''), position:'岗位'+i,
      status:stages[i%stages.length], city:'上海', applyDate:'2026-09-01', notes:''}));
  }
  switchTab('track'); setTrackView('star');
})()`;

// 采样画布指定点的颜色（用来查核球附近 vs 徽标区域）
const SAMPLE = `(function(){
  var c = document.querySelector('#starCanvasWrap canvas');
  var g = c.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var wrap = document.getElementById('starCanvasWrap');
  var W = wrap.clientWidth, H = wrap.clientHeight;
  var cx = W*0.5, cy = (H-46)*0.5;
  function at(px, py){
    var d = g.getImageData(Math.round(px*dpr), Math.round(py*dpr), 1, 1).data;
    return [d[0],d[1],d[2]];
  }
  function lum(p){ return Math.round(0.2126*p[0]+0.7152*p[1]+0.0722*p[2]); }
  // 沿一条水平线从中心向外采样，看核球→旋臂→边缘
  var prof = [];
  for (var k=0;k<=12;k++){
    var r = k*40;
    var p = at(cx + r, cy);
    prof.push({r:r, rgb:p, lum:lum(p)});
  }
  // 徽标半径 24：徽标内 vs 徽标外紧邻
  var inside = at(cx, cy);
  var justOutside = at(cx + 34, cy);
  var core30 = at(cx + 60, cy);
  return JSON.stringify({
    canvasW: W, canvasH: H, dpr: dpr,
    badgeCenter: {rgb: inside, lum: lum(inside)},
    justOutsideBadge: {rgb: justOutside, lum: lum(justOutside)},
    r60: {rgb: core30, lum: lum(core30)},
    radialProfile: prof
  }, null, 1);
})()`;

// 缩放后星系应跟随：检查非背景像素占比是否随缩放增大
const ZOOMCHECK = `(async function(){
  var wrap = document.getElementById('starCanvasWrap');
  var c = wrap.querySelector('canvas');
  var g = c.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  function coverage(){
    var W = wrap.clientWidth, H = wrap.clientHeight;
    var d = g.getImageData(0,0,Math.round(W*dpr),Math.round(H*dpr)).data;
    var n=0, tot=0;
    for (var i=0;i<d.length;i+=4*17){
      tot++;
      if (0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2] > 12) n++;
    }
    return +(n/tot*100).toFixed(1);
  }
  var out = {};
  out.scale100 = coverage();
  starZoomApi.set(2.0);
  await new Promise(r=>setTimeout(r,700));
  out.scale200 = coverage();
  starZoomApi.set(0.5);
  await new Promise(r=>setTimeout(r,700));
  out.scale50 = coverage();
  starZoomApi.set(1.0);
  await new Promise(r=>setTimeout(r,700));
  out.scale100_again = coverage();
  return JSON.stringify(out, null, 1);
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
  await send('Network.enable',{},sessionId);
  await send('Network.setCacheDisabled',{cacheDisabled:true},sessionId);
  await send('Emulation.setDeviceMetricsOverride',{width:1680,height:959,deviceScaleFactor:1,mobile:false},sessionId);
  await send('Page.addScriptToEvaluateOnNewDocument',{source:'try{localStorage.clear();}catch(e){}'},sessionId);
  await send('Page.navigate',{url:BASE+'?cb='+Date.now()},sessionId);
  for(let i=0;i<120;i++){
    const r=await send('Runtime.evaluate',{expression:'typeof jobList!=="undefined" && typeof starLabelStats!=="undefined"',returnByValue:true},sessionId);
    if(r.result&&r.result.value===true) break;
    await new Promise(x=>setTimeout(x,400));
  }
  await new Promise(x=>setTimeout(x,1000));
  await send('Runtime.evaluate',{expression:SEED,returnByValue:true},sessionId);
  await new Promise(x=>setTimeout(x,2500));

  console.log('=== 中心/核球采样（画布坐标）===');
  const r1=await send('Runtime.evaluate',{expression:SAMPLE,returnByValue:true},sessionId);
  console.log(r1.exceptionDetails ? '异常: '+JSON.stringify(r1.exceptionDetails.exception&&r1.exceptionDetails.exception.description).slice(0,200) : r1.result.value);

  console.log('\n=== 缩放时星系是否跟随 ===');
  const r2=await send('Runtime.evaluate',{expression:ZOOMCHECK,returnByValue:true,awaitPromise:true},sessionId);
  console.log(r2.exceptionDetails ? '异常: '+JSON.stringify(r2.exceptionDetails.exception&&r2.exceptionDetails.exception.description).slice(0,200) : r2.result.value);

  console.log('\n未捕获异常: ' + (exs.length ? exs.slice(0,5).join(' | ') : '（无）'));
  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
