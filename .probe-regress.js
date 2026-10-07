// 删掉 mammoth 后的全功能回归：四个页面 + 星图 + 同步 + 附件
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
  reviews=[];
  for (var r=0;r<8;r++){
    reviews.push(sanitizeReview({id:'R'+r, company:names[r], position:'岗位'+r, stage:stages[r%9],
      date:'2026-09-'+((r%28)+1), content:'复盘'+r, next:''}));
  }
  saveJobList(); saveReviews();
})()`;

const CHECK = `(async function(){
  const out = {};
  const errs = [];
  window.onerror = function(m){ errs.push(String(m)); };

  function tryStep(name, fn){ try { fn(); out[name] = 'ok'; } catch(e){ out[name] = 'ERR: ' + e.message; } }

  // 四个 tab
  ['explore','track','resume','review'].forEach(t=>{
    tryStep('tab_'+t, ()=>{ switchTab(t); });
  });

  // 三种投递视图
  ['board','list','star'].forEach(v=>{
    tryStep('view_'+v, ()=>{ switchTab('track'); setTrackView(v); });
  });

  // 星图几何
  switchTab('track'); setTrackView('star');
  await new Promise(res=>{ requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(res,400))); });
  var byRing = {};
  starStars.forEach(s=>{ var k=+s.rx.toFixed(2); (byRing[k]=byRing[k]||{rx:k,n:0}).n++; });
  var rings = Object.values(byRing).sort((a,b)=>b.rx-a.rx);
  out.star_rings = rings.length;
  out.star_innermost = rings.length ? +rings[rings.length-1].rx.toFixed(1) : null;
  out.star_coreGap = rings.length ? +(rings[rings.length-1].rx - 24).toFixed(1) : null;
  out.star_drawn = starLabelStats ? starLabelStats.drawn : null;
  out.star_labels = starStars.length;

  // 关键：mammoth 删掉后不应有谁还依赖它
  out.mammoth = typeof window.mammoth;

  // 压缩存储（LZString）仍可用
  try {
    saveJobList();
    var raw = localStorage.getItem('campus_job_list');
    out.storage_joblist_KB = +(raw.length/1024).toFixed(1);
    out.storage_isCompressed = raw.slice(0,1) !== '[';   // 压缩后不是明文 JSON 数组
  } catch(e){ out.storage = 'ERR: '+e.message; }

  // 附件（.docx 走 base64，不解析）
  try {
    out.fileIcon_docx = fileIcon('简历.docx');
    out.fileIcon_pdf  = fileIcon('简历.pdf');
  } catch(e){ out.fileIcon = 'ERR: '+e.message; }

  // 导出 / 导入 函数存在
  out.fn_export = typeof exportData;
  out.fn_import = typeof importData;

  out.errors = errs;
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
    if(m.method==='Runtime.exceptionThrown'){ const d=m.params.exceptionDetails; exs.push(((d.exception&&d.exception.description)||d.text||'').split('\n')[0]); }
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
    const r=await send('Runtime.evaluate',{expression:'typeof jobList!=="undefined" && document.querySelectorAll("script").length===2',returnByValue:true},sessionId);
    if(r.result&&r.result.value===true){ ready=true; break; }
    await new Promise(x=>setTimeout(x,400));
  }
  console.log(ready ? '✅ 页面就绪（2 段脚本）' : '⚠️ 就绪检测超时');
  await new Promise(x=>setTimeout(x,1500));

  const s=await send('Runtime.evaluate',{expression:SEED,returnByValue:true},sessionId);
  if(s.exceptionDetails) console.log('SEED 异常: ' + JSON.stringify(s.exceptionDetails.exception&&s.exceptionDetails.exception.description).slice(0,200));
  await new Promise(x=>setTimeout(x,1200));

  const r=await send('Runtime.evaluate',{expression:CHECK,returnByValue:true,awaitPromise:true},sessionId);
  console.log(r.exceptionDetails ? '异常: '+JSON.stringify(r.exceptionDetails.exception&&r.exceptionDetails.exception.description) : r.result.value);

  console.log('\n未捕获异常: ' + (exs.length ? '\n  ' + exs.slice(0,8).join('\n  ') : '（无）✅'));

  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
