// 验收「使用说明」的四种行为
const http = require('http');
function j(u){return new Promise((res,rej)=>{http.get(u,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}
const BASE = process.argv[2] || 'http://127.0.0.1:8099/index.html';

(async()=>{
  const ver=await j('http://127.0.0.1:9222/json/version');
  const ws=new WebSocket(ver.webSocketDebuggerUrl);
  let id=0;const pend=new Map();
  const send=(m,p,s)=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});const o={id:i,method:m,params:p||{}};if(s)o.sessionId=s;ws.send(JSON.stringify(o))});
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){const q=pend.get(m.id);pend.delete(m.id);m.error?q.rej(new Error(m.error.message)):q.res(m.result);}});
  await new Promise(r=>ws.addEventListener('open',r));
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  await send('Runtime.enable',{},sessionId); await send('Page.enable',{},sessionId);
  await send('Network.enable',{},sessionId); await send('Network.setCacheDisabled',{cacheDisabled:true},sessionId);
  await send('Emulation.setDeviceMetricsOverride',{width:1680,height:959,deviceScaleFactor:1,mobile:false},sessionId);
  const _clr = await send('Page.addScriptToEvaluateOnNewDocument',{source:'try{localStorage.clear();}catch(e){}'},sessionId);

  const ev=async(ex)=>{const r=await send('Runtime.evaluate',{expression:ex,returnByValue:true},sessionId); return r.result&&r.result.value;};
  const guideVisible = "((document.getElementById('guideModal')||{}).style||{}).display === 'flex'";
  async function load(){
    await send('Page.navigate',{url:BASE+'?cb='+Date.now()},sessionId);
    for(let i=0;i<60;i++){
      const r=await send('Runtime.evaluate',{expression:'typeof jobList !== "undefined"',returnByValue:true},sessionId);
      if(r.result&&r.result.value) break;
      await new Promise(x=>setTimeout(x,400));
    }
    await new Promise(x=>setTimeout(x,3000));   // 等 maybeShowGuide 的 1.2s 延时
  }

  // ① 首次进入
  await load();
  // 首次加载后移除"清存储"脚本，否则每次重新进入都会把刚写入的标记一起清掉，
  // 导致「不再弹出」的验证变成假失败（这是探针的问题，不是应用的问题）。
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:_clr.identifier},sessionId);
  console.log('① 首次进入                 -> 弹出:', await ev(guideVisible) ? '是 [OK]' : '否 [FAIL]');
  console.log('   说明正文长度            ->', await ev("(document.querySelector('#guideModal .modal-body')||{}).innerText ? document.querySelector('#guideModal .modal-body').innerText.length : 0"), '字符');

  // ② 点「关闭」→ 下次还应弹
  await ev("document.querySelector('#guideModal .modal-footer button.btn.btn-sm').click()");
  await new Promise(x=>setTimeout(x,600));
  console.log('② 点「关闭」后立刻           -> 隐藏:', await ev(guideVisible) ? '否 [FAIL]' : '是 [OK]');
  await load();
  console.log('   重新进入（未设不再弹出）  -> 弹出:', await ev(guideVisible) ? '是 [OK]' : '否 [FAIL]');

  // ③ 点「不再弹出」→ 以后不弹
  await ev("document.querySelector('#guideModal .modal-footer button.btn-primary').click()");
  await new Promise(x=>setTimeout(x,600));
  console.log('③ 点「不再弹出」后           -> 隐藏:', await ev(guideVisible) ? '否 [FAIL]' : '是 [OK]');
  console.log('   localStorage 标记         ->', await ev("localStorage.getItem('qiuzhao_guide_dismissed')"));
  await load();
  console.log('   重新进入                  -> 弹出:', await ev(guideVisible) ? '是 [FAIL]' : '否 [OK]');

  // ④ 点 📖 手动重新打开
  await ev("document.getElementById('btnGuide').click()");
  await new Promise(x=>setTimeout(x,500));
  console.log('④ 点右上角 📖 重新打开      -> 弹出:', await ev(guideVisible) ? '是 [OK]' : '否 [FAIL]');

  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
