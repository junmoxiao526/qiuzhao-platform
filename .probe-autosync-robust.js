// 线上/本地通用：等 app 真正初始化完成再断言，避免"还在解析就取值"的假阴性
const http = require('http');
function j(u){return new Promise((res,rej)=>{http.get(u,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}
const BASE = process.argv[2] || 'http://127.0.0.1:8099/index.html';

(async()=>{
  const [W,H] = (process.argv[3]||'1680x959').split('x').map(Number);
  const ver=await j('http://127.0.0.1:9222/json/version');
  const ws=new WebSocket(ver.webSocketDebuggerUrl);
  let id=0;const pend=new Map();let apiPosts=0, apiOpts=0;
  const send=(m,p,s)=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});const o={id:i,method:m,params:p||{}};if(s)o.sessionId=s;ws.send(JSON.stringify(o))});
  ws.addEventListener('message',e=>{
    const m=JSON.parse(e.data);
    if(m.id&&pend.has(m.id)){const q=pend.get(m.id);pend.delete(m.id);m.error?q.rej(new Error(m.error.message)):q.res(m.result);return}
    if(m.method==='Network.requestWillBeSent' && m.params.request.url.includes('qiuzhifangzhou')){
      if(m.params.request.method==='POST') apiPosts++; else if(m.params.request.method==='OPTIONS') apiOpts++;
    }
  });
  await new Promise(r=>ws.addEventListener('open',r));
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  await send('Runtime.enable',{},sessionId); await send('Page.enable',{},sessionId);
  await send('Network.enable',{},sessionId);
  await send('Network.setCacheDisabled',{cacheDisabled:true},sessionId);
  await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:false},sessionId);

  // 等 app 就绪：jobList 存在且是三段脚本都在
  async function waitReady(timeoutMs){
    const t0=Date.now();
    while(Date.now()-t0 < timeoutMs){
      const r=await send('Runtime.evaluate',{expression:`(function(){
        try{ return JSON.stringify({scripts:document.querySelectorAll('script').length,
          ready: typeof jobList!=='undefined' && typeof maybeAutoSyncQiuzhi==='function',
          jobs: (typeof jobList!=='undefined')?jobList.length:-1,
          caption:(document.getElementById('syncCaption')||{}).textContent||''}); }catch(e){ return 'ERR'; }
      })()`,returnByValue:true},sessionId);
      if(!r.exceptionDetails){
        let v; try{ v=JSON.parse(r.result.value); }catch(e){ v=null; }
        if(v && v.ready) return v;
      }
      await new Promise(x=>setTimeout(x,500));
    }
    return null;
  }

  // 先访问一次，拿到同源上下文后清 localStorage（只清一次）
  await send('Page.navigate',{url:BASE},sessionId);
  const first = await waitReady(60000);
  console.log('首次加载（用于准备同源上下文）:', JSON.stringify(first));
  await send('Runtime.evaluate',{expression:'try{localStorage.clear()}catch(e){}',returnByValue:true},sessionId);

  // ── 正式测试 1：清空后进页面应自动同步
  console.log('\n== 测试1：清空 localStorage 后进页面，应自动同步（不点任何按钮）==');
  apiPosts=0; apiOpts=0;
  await send('Page.navigate',{url:BASE+(BASE.includes('?')?'&':'?')+'cb='+Date.now()},sessionId);
  const ready = await waitReady(60000);
  if(!ready){ console.log('  ❌ 页面始终没就绪（脚本没跑起来）'); await send('Target.closeTarget',{targetId}); ws.close(); return; }
  await new Promise(x=>setTimeout(x,6000));   // 给同步留时间
  const st = await send('Runtime.evaluate',{expression:`(function(){
    var m={}; try{ m=getQiuzhiSyncMeta(); }catch(e){}
    return JSON.stringify({ jobs:jobList.length, lastSyncAt:m.lastSyncAt||null, remote:m.totalRemote||null,
      modal:(document.getElementById('syncResultModal').style.display==='flex'),
      caption:(document.getElementById('syncCaption')||{}).textContent||'' },null,1); })()`,returnByValue:true},sessionId);
  console.log('  页内状态: ' + st.result.value);
  console.log('  POST 请求次数: ' + apiPosts + (apiPosts>=1 ? '  ✅ 自动同步已触发' : '  ❌ 没有自动请求'));
  const v1 = JSON.parse(st.result.value);
  console.log('  结果弹窗是否弹出: ' + (v1.modal ? '❌ 弹了（静默模式不该弹）' : '✅ 没弹'));

  // ── 正式测试 2：TTL 内再进，不应再联网
  console.log('\n== 测试2：TTL 内再进页面，不应重复请求 ==');
  apiPosts=0;
  await send('Page.navigate',{url:BASE+(BASE.includes('?')?'&':'?')+'cb='+Date.now()},sessionId);
  await waitReady(60000);
  await new Promise(x=>setTimeout(x,5000));
  console.log('  POST 请求次数: ' + apiPosts + (apiPosts===0 ? '  ✅ TTL 生效（用已存数据）' : '  ❌ 又请求了'));

  // ── 正式测试 3：手动按钮应强制联网
  console.log('\n== 测试3：手动点按钮应强制同步 ==');
  apiPosts=0;
  await send('Runtime.evaluate',{expression:'syncQiuzhiFangzhou({force:true})',returnByValue:true,awaitPromise:true},sessionId);
  await new Promise(x=>setTimeout(x,3000));
  console.log('  POST 请求次数: ' + apiPosts + (apiPosts>=1 ? '  ✅ 强制同步生效' : '  ❌ 没有联网'));

  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
