// 验证「进页面自动同步」：不点任何按钮，只看页面加载后是否真的发起了同步请求。
// 用 CDP 的 Network 事件监听 —— 这是最权威的判据（不依赖 UI 文案）。
const http = require('http');
function j(u){return new Promise((res,rej)=>{http.get(u,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}
const BASE = process.argv[2] || 'http://127.0.0.1:8099/index.html';

(async()=>{
  const ver=await j('http://127.0.0.1:9222/json/version');
  const ws=new WebSocket(ver.webSocketDebuggerUrl);
  let id=0;const pend=new Map();
  const reqs=[]; const logs=[];
  const send=(m,p,s)=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});const o={id:i,method:m,params:p||{}};if(s)o.sessionId=s;ws.send(JSON.stringify(o))});
  ws.addEventListener('message',e=>{
    const m=JSON.parse(e.data);
    if(m.id&&pend.has(m.id)){const q=pend.get(m.id);pend.delete(m.id);m.error?q.rej(new Error(m.error.message)):q.res(m.result);return}
    if(m.method==='Network.requestWillBeSent'){
      const u=m.params.request.url;
      if(!/\.(js|css|png|jpg|svg|woff2?|ico)(\?|$)/i.test(u) && !u.startsWith('data:')) reqs.push(u);
    }
    if(m.method==='Runtime.consoleAPICalled'){
      const t=(m.params.args||[]).map(a=>a.value||a.description||'').join(' ');
      if(t.includes('自动同步')||t.includes('同步')) logs.push(t.slice(0,120));
    }
  });
  await new Promise(r=>ws.addEventListener('open',r));
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  await send('Runtime.enable',{},sessionId); await send('Page.enable',{},sessionId);
  await send('Network.enable',{},sessionId); await send('Network.setCacheDisabled',{cacheDisabled:true},sessionId);
  await send('Emulation.setDeviceMetricsOverride',{width:1680,height:959,deviceScaleFactor:1,mobile:false},sessionId);
  // 关键：清掉 lastSyncAt，模拟"隔天再打开"
  await send('Page.addScriptToEvaluateOnNewDocument',{source:'try{localStorage.clear();}catch(e){}'},sessionId);
  await send('Page.navigate',{url:BASE+'?cb='+Date.now()},sessionId);
  await new Promise(x=>setTimeout(x,9000));   // 留足时间让后台同步发起
  const cap=await send('Runtime.evaluate',{expression:"(document.getElementById('syncCaption')||{}).textContent||''",returnByValue:true},sessionId);
  console.log('同步状态文案:', JSON.stringify(cap.result.value));
  console.log('非静态资源请求:');
  reqs.forEach(u=>console.log('   ', u.slice(0,110)));
  console.log('控制台相关日志:');
  logs.slice(0,6).forEach(l=>console.log('   ', l));
  const hit = reqs.some(u=>/qiuzhi|fangzhou|job|api|json/i.test(u));
  console.log('\n=> 未点击任何按钮即发起同步请求:', hit ? '是 [OK]' : '未检出（可能被网络/CORS 拦住，看文案与日志）');
  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
