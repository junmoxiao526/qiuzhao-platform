// 性能审计：加载耗时、localStorage 占用、mammoth 解析成本
const http = require('http');
function j(u){return new Promise((res,rej)=>{http.get(u,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}
const BASE = process.argv[2] || 'http://127.0.0.1:8099/index.html';

const PROBE = `(function(){
  const out = {};
  // 1) 导航计时
  try {
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav) {
      out.t_domInteractive = Math.round(nav.domInteractive);
      out.t_domContentLoaded = Math.round(nav.domContentLoadedEventEnd);
      out.t_loadComplete = Math.round(nav.loadEventEnd);
      out.t_responseEnd = Math.round(nav.responseEnd);
      out.transferSizeKB = Math.round((nav.transferSize||0)/1024);
      out.decodedKB = Math.round((nav.decodedBodySize||0)/1024);
    }
    out.t_now = Math.round(performance.now());
  } catch(e){ out.navErr = e.message; }

  // 2) localStorage 占用
  try {
    let total = 0, byKey = [];
    for (let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      const v = localStorage.getItem(k) || '';
      const bytes = (k.length + v.length) * 2;   // UTF-16
      total += bytes;
      byKey.push({k: k, KB: +(bytes/1024).toFixed(1)});
    }
    byKey.sort((a,b)=>b.KB-a.KB);
    out.storageTotalKB = +(total/1024).toFixed(1);
    out.storageQuotaPct = +((total/1024/1024)/5*100).toFixed(1);  // 按 5MB 估算
    out.storageTop = byKey.slice(0,6);
  } catch(e){ out.storageErr = e.message; }

  // 3) DOM 规模
  out.domNodes = document.querySelectorAll('*').length;
  out.scriptTags = document.querySelectorAll('script').length;

  // 4) mammoth 是否真的定义了（以及是否被引用）
  out.mammothDefined = typeof window.mammoth;
  let refs = 0;
  try {
    // 扫所有内联脚本，排除库自身所在的那一段
    Array.from(document.querySelectorAll('script')).forEach((s,idx)=>{
      const code = s.textContent;
      if (code.includes('mammoth.js v1.6.0')) return;   // 库本身
      if (/mammoth/i.test(code)) refs++;
    });
  } catch(e){}
  out.mammothRefsOutsideLib = refs;

  // 5) 解析成本：单独编译那 627KB 源码要多久
  try {
    const lib = Array.from(document.querySelectorAll('script')).find(s=>s.textContent.includes('mammoth.js v1.6.0'));
    if (lib) {
      const t0 = performance.now();
      // 只做编译（解析），不执行
      new Function(lib.textContent);
      out.mammothParseMs = Math.round(performance.now() - t0);
      out.mammothKB = Math.round(lib.textContent.length/1024);
    }
  } catch(e){ out.parseErr = e.message; }

  // 6) 岗位数量
  try { out.jobs = jobList.length; } catch(e){ out.jobs = 'undefined'; }

  return JSON.stringify(out, null, 1);
})()`;

(async()=>{
  const ver=await j('http://127.0.0.1:9222/json/version');
  const ws=new WebSocket(ver.webSocketDebuggerUrl);
  let id=0;const pend=new Map();const consoleMsgs=[];
  const send=(m,p,s)=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});const o={id:i,method:m,params:p||{}};if(s)o.sessionId=s;ws.send(JSON.stringify(o))});
  ws.addEventListener('message',e=>{
    const m=JSON.parse(e.data);
    if(m.id&&pend.has(m.id)){const q=pend.get(m.id);pend.delete(m.id);m.error?q.rej(new Error(m.error.message)):q.res(m.result);return}
    if(m.method==='Runtime.consoleAPICalled' && m.params.type==='warning') consoleMsgs.push(m.params.args.map(a=>a.value||a.description||'').join(' '));
  });
  await new Promise(r=>ws.addEventListener('open',r));
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  await send('Runtime.enable',{},sessionId); await send('Page.enable',{},sessionId);
  await send('Network.enable',{},sessionId);
  await send('Network.setCacheDisabled',{cacheDisabled:true},sessionId);
  await send('Emulation.setDeviceMetricsOverride',{width:1680,height:959,deviceScaleFactor:1,mobile:false},sessionId);
  await send('Page.navigate',{url:BASE+'?cb='+Date.now()},sessionId);

  // 等就绪
  let ready=false;
  for(let i=0;i<120;i++){
    const r=await send('Runtime.evaluate',{expression:'typeof jobList!=="undefined" && document.querySelectorAll("script").length===3',returnByValue:true},sessionId);
    if(r.result&&r.result.value===true){ ready=true; break; }
    await new Promise(x=>setTimeout(x,400));
  }
  await new Promise(x=>setTimeout(x,7000));   // 让自动同步也跑完

  const r=await send('Runtime.evaluate',{expression:PROBE,returnByValue:true},sessionId);
  console.log('目标: ' + BASE);
  console.log(ready ? '✅ 页面已就绪\n' : '⚠️ 就绪检测超时（数据可能仍有效）\n');
  console.log(r.exceptionDetails ? '异常: '+JSON.stringify(r.exceptionDetails.exception&&r.exceptionDetails.exception.description) : r.result.value);
  if(consoleMsgs.length) console.log('\n控制台警告: ' + consoleMsgs.slice(0,5).join(' | '));

  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
