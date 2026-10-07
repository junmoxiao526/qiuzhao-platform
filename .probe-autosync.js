// 验证：进页面自动同步招聘方舟 —— 全程不点任何按钮
const http = require('http'), fs = require('fs');
function j(u){return new Promise((res,rej)=>{http.get(u,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}

const API = 'api.qiuzhifangzhou.com';

(async()=>{
  const [W,H] = (process.argv[2]||'1680x959').split('x').map(Number);
  const ver=await j('http://127.0.0.1:9222/json/version');
  const ws=new WebSocket(ver.webSocketDebuggerUrl);
  let id=0;const pend=new Map();const events=[];
  const send=(m,p,s)=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});const o={id:i,method:m,params:p||{}};if(s)o.sessionId=s;ws.send(JSON.stringify(o))});
  ws.addEventListener('message',e=>{
    const m=JSON.parse(e.data);
    if(m.id&&pend.has(m.id)){const q=pend.get(m.id);pend.delete(m.id);m.error?q.rej(new Error(m.error.message)):q.res(m.result)}
    else if(m.method) events.push(m);
  });
  await new Promise(r=>ws.addEventListener('open',r));
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  await send('Runtime.enable',{},sessionId); await send('Page.enable',{},sessionId);
  await send('Network.enable',{},sessionId);
  await send('Network.setCacheDisabled',{cacheDisabled:true},sessionId);
  await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:false},sessionId);

  // 只清一次 localStorage，不要用 addScriptToEvaluateOnNewDocument ——
  // 那样每次导航都会清，把自动同步刚写下的 lastSyncAt 也擦掉，
  // 于是 TTL 永远失效，看起来像"每次都重新同步"（假阳性）。
  await send('Page.navigate',{url:'http://127.0.0.1:8099/index.html?cb='+Date.now()},sessionId);
  await new Promise(r=>setTimeout(r,1200));
  await send('Runtime.evaluate',{expression:'try{localStorage.clear()}catch(e){}',returnByValue:true},sessionId);
  events.length = 0;

  console.log('== 第 1 次进页面（localStorage 已清空）==');
  await send('Page.navigate',{url:'http://127.0.0.1:8099/index.html?cb='+Date.now()},sessionId);
  await new Promise(r=>setTimeout(r,9000));

  const reqs = events.filter(e=>e.method==='Network.requestWillBeSent')
    .map(e=>e.params.request.method+' '+e.params.request.url).filter(u=>u.includes(API));
  const resps = events.filter(e=>e.method==='Network.responseReceived')
    .map(e=>({url:e.params.response.url, status:e.params.response.status})).filter(r=>r.url.includes(API));
  console.log('  发往招聘方舟的请求: ' + JSON.stringify(reqs, null, 1));
  console.log('  响应: ' + JSON.stringify(resps));

  // 页面内状态
  const st = await send('Runtime.evaluate',{expression:`(function(){
    var m = getQiuzhiSyncMeta();
    return JSON.stringify({
      lastSyncAt: m.lastSyncAt || null,
      totalRemote: m.totalRemote || null,
      jobListLength: jobList.length,
      modalVisible: document.getElementById('syncResultModal').style.display==='flex',
      btnText: (document.getElementById('btnSyncQiuzhiFangzhou')||{}).textContent
    }, null, 1);
  })()`,returnByValue:true},sessionId);
  console.log('  页内状态: ' + st.result.value);

  console.log('\n== 第 2 次进页面（TTL 内，应跳过）==');
  events.length = 0;
  await send('Page.navigate',{url:'http://127.0.0.1:8099/index.html?cb='+Date.now()},sessionId);
  await new Promise(r=>setTimeout(r,6000));
  const reqs2 = events.filter(e=>e.method==='Network.requestWillBeSent')
    .map(e=>e.params.request.url).filter(u=>u.includes(API));
  console.log('  发往招聘方舟的请求数: ' + reqs2.length + (reqs2.length===0?'  ✅ TTL 生效，没有重复请求':'  ⚠️ 又请求了一次'));

  const shot=await send('Page.captureScreenshot',{format:'png'},sessionId);
  fs.writeFileSync(process.argv[3]||'autosync.png',Buffer.from(shot.data,'base64'));
  console.log('\n截图已保存 ' + (process.argv[3]||'autosync.png'));
  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
