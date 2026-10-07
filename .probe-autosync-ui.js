// 校验自动同步的可见反馈 + 手动强制同步仍然有效
const http = require('http');
function j(u){return new Promise((res,rej)=>{http.get(u,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}

(async()=>{
  const [W,H] = (process.argv[2]||'1680x959').split('x').map(Number);
  const ver=await j('http://127.0.0.1:9222/json/version');
  const ws=new WebSocket(ver.webSocketDebuggerUrl);
  let id=0;const pend=new Map();let apiCalls=0;
  const send=(m,p,s)=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});const o={id:i,method:m,params:p||{}};if(s)o.sessionId=s;ws.send(JSON.stringify(o))});
  ws.addEventListener('message',e=>{
    const m=JSON.parse(e.data);
    if(m.id&&pend.has(m.id)){const q=pend.get(m.id);pend.delete(m.id);m.error?q.rej(new Error(m.error.message)):q.res(m.result)}
    else if(m.method==='Network.requestWillBeSent' && m.params.request.url.includes('qiuzhifangzhou') && m.params.request.method==='POST') apiCalls++;
  });
  await new Promise(r=>ws.addEventListener('open',r));
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  await send('Runtime.enable',{},sessionId); await send('Page.enable',{},sessionId);
  await send('Network.enable',{},sessionId);
  await send('Network.setCacheDisabled',{cacheDisabled:true},sessionId);
  await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:false},sessionId);

  // 只清一次
  await send('Page.navigate',{url:'http://127.0.0.1:8099/index.html?cb='+Date.now()},sessionId);
  await new Promise(r=>setTimeout(r,1500));
  await send('Runtime.evaluate',{expression:'try{localStorage.clear()}catch(e){}',returnByValue:true},sessionId);

  // 观察：进页面 1.5s 时 caption 应该已经是"自动同步中…"
  apiCalls = 0;
  await send('Page.navigate',{url:'http://127.0.0.1:8099/index.html?cb='+Date.now()},sessionId);
  await new Promise(r=>setTimeout(r,1200));
  const mid = await send('Runtime.evaluate',{expression:`(function(){var e=document.getElementById('syncCaption');
    return JSON.stringify({text:e?e.textContent:null, cls:e?e.className:null, btnDisabled:(document.getElementById('btnSyncQiuzhiFangzhou')||{}).disabled});})()`,returnByValue:true},sessionId);
  console.log('进页面 1.2s（同步进行中）:');
  console.log('  ' + mid.result.value);

  await new Promise(r=>setTimeout(r,8000));
  const done = await send('Runtime.evaluate',{expression:`(function(){var e=document.getElementById('syncCaption');
    return JSON.stringify({text:e?e.textContent:null, cls:e?e.className:null, jobs:jobList.length});})()`,returnByValue:true},sessionId);
  console.log('同步完成后:');
  console.log('  ' + done.result.value);

  // 手动强制：应再打一次接口
  const before = apiCalls;
  await send('Runtime.evaluate',{expression:'syncQiuzhiFangzhou({force:true})',returnByValue:true,awaitPromise:true},sessionId);
  await new Promise(r=>setTimeout(r,1500));
  console.log('\n手动点按钮是否强制联网: ' + (apiCalls>before ? '✅ 是（+'+ (apiCalls-before) +' 次）' : '❌ 否'));

  // TTL 内再进页面不应联网
  const b2 = apiCalls;
  await send('Page.navigate',{url:'http://127.0.0.1:8099/index.html?cb='+Date.now()},sessionId);
  await new Promise(r=>setTimeout(r,6000));
  console.log('TTL 内再进页面: ' + (apiCalls===b2 ? '✅ 没联网（用了缓存）' : '❌ 又联网了 '+(apiCalls-b2)+' 次'));

  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
