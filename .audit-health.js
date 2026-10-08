// 体检：存储占用 + DOM 规模 + 渲染方式
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
  await send('Emulation.setDeviceMetricsOverride',{width:1680,height:959,deviceScaleFactor:1,mobile:false},sessionId);
  await send('Page.navigate',{url:BASE+'?cb='+Date.now()},sessionId);
  for(let i=0;i<80;i++){
    const r=await send('Runtime.evaluate',{expression:'typeof jobList !== "undefined"',returnByValue:true},sessionId);
    if(r.result&&r.result.value) break;
    await new Promise(x=>setTimeout(x,400));
  }
  await new Promise(x=>setTimeout(x,4500));

  const expr = `(function(){
    var out = {};
    out.jobs = jobList.length;
    out.campus_job_list_KB = +(((localStorage.getItem('campus_job_list')||'').length)/1024).toFixed(1);
    var sm = localStorage.getItem('qiuzhi_sync_meta') || '';
    out.sync_meta_KB = +((sm.length/1024).toFixed(1));
    try {
      var o = JSON.parse(sm);
      out.sync_meta_keys = Object.keys(o).map(function(k){
        var v = o[k];
        return k + ':' + (Array.isArray(v) ? ('数组'+v.length+'项') : typeof v);
      });
    } catch(e) { out.sync_meta_keys = ['(解析失败: ' + e.message.slice(0,40) + ')']; }
    out.domNodes = document.getElementsByTagName('*').length;
    // 列表/看板里实际渲染了多少行
    var sels = ['.job-card', 'tr[data-id]', '.job-row', '.list-item', 'table tbody tr'];
    out.rendered = {};
    sels.forEach(function(s){ var n = document.querySelectorAll(s).length; if (n) out.rendered[s] = n; });
    // 各视图容器子节点数
    out.containers = {};
    ['boardList','listView','listBody','starCanvasWrap'].forEach(function(id){
      var e = document.getElementById(id);
      if (e) out.containers[id] = e.children.length;
    });
    // 是否存在虚拟滚动/分页
    out.hasPagination = !!document.querySelector('.pagination, .pager, [data-page]');
    return JSON.stringify(out);
  })()`;

  const r = await send('Runtime.evaluate',{expression:expr,returnByValue:true},sessionId);
  const d = JSON.parse(r.result.value);
  console.log('岗位总数        :', d.jobs);
  console.log('campus_job_list :', d.campus_job_list_KB, 'KB');
  console.log('sync_meta       :', d.sync_meta_KB, 'KB');
  console.log('  sync_meta 字段:', (d.sync_meta_keys||[]).join('  '));
  console.log('DOM 节点数      :', d.domNodes);
  console.log('已渲染的行      :', JSON.stringify(d.rendered));
  console.log('容器子节点      :', JSON.stringify(d.containers));
  console.log('是否有分页      :', d.hasPagination);
  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
