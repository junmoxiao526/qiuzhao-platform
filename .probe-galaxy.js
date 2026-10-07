// 星系渲染验证：截图 + 量化检查（像素统计，不依赖人眼看图）
const http = require('http'), fs = require('fs');
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

const CHECK = `(async function(){
  await new Promise(res=>{ requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(res,500))); });
  const out = {};
  // 星系画布是否建好
  const gc = document.querySelector('#starCanvasWrap canvas');
  out.canvasSize = gc ? [gc.width, gc.height] : null;
  out.starCount = starStars.length;
  out.rings = (function(){ var s=new Set(); starStars.forEach(x=>s.add(+x.rx.toFixed(1))); return s.size; })();
  out.labels = starLabelStats ? starLabelStats.drawn + '/' + starStars.length : null;
  // 帧率：数 1 秒内的 rAF 次数
  out.fps = await new Promise(res=>{
    let n=0; const t0=performance.now();
    function tick(){ n++; if(performance.now()-t0 < 1000) requestAnimationFrame(tick); else res(n); }
    requestAnimationFrame(tick);
  });
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
  let ready=false;
  for(let i=0;i<120;i++){
    const r=await send('Runtime.evaluate',{expression:'typeof jobList!=="undefined" && typeof starLabelStats!=="undefined"',returnByValue:true},sessionId);
    if(r.result&&r.result.value===true){ready=true;break;}
    await new Promise(x=>setTimeout(x,400));
  }
  console.log(ready?'✅ 就绪':'⚠️ 超时');
  await new Promise(x=>setTimeout(x,1200));
  const s=await send('Runtime.evaluate',{expression:SEED,returnByValue:true},sessionId);
  if(s.exceptionDetails) console.log('SEED 异常: '+JSON.stringify(s.exceptionDetails.exception&&s.exceptionDetails.exception.description).slice(0,250));
  await new Promise(x=>setTimeout(x,2500));
  const r=await send('Runtime.evaluate',{expression:CHECK,returnByValue:true,awaitPromise:true},sessionId);
  console.log(r.exceptionDetails ? '异常: '+JSON.stringify(r.exceptionDetails.exception&&r.exceptionDetails.exception.description).slice(0,250) : r.result.value);
  console.log('未捕获异常: ' + (exs.length ? '\n  '+exs.slice(0,6).join('\n  ') : '（无）✅'));

  // 截图（只截星图区域，裁掉头部）
  const shot=await send('Page.captureScreenshot',{format:'png'},sessionId);
  const f=process.argv[3]||'galaxy.png';
  fs.writeFileSync(f,Buffer.from(shot.data,'base64'));
  console.log('截图 '+f);
  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
