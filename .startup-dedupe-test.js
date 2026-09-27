// 模拟"老版本遗留的重复数据"，重载后确认启动时自动清理
const fs = require('fs'), http = require('http');
function j(u){return new Promise((res,rej)=>{http.get(u,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}
(async()=>{
  const ver=await j('http://127.0.0.1:9222/json/version');
  const ws=new WebSocket(ver.webSocketDebuggerUrl);
  let id=0;const pend=new Map();const exceptions=[];
  const send=(m,p,s)=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});const o={id:i,method:m,params:p||{}};if(s)o.sessionId=s;ws.send(JSON.stringify(o))});
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);
    if(m.id&&pend.has(m.id)){const q=pend.get(m.id);pend.delete(m.id);m.error?q.rej(new Error(m.error.message)):q.res(m.result);return}
    if(m.method==='Runtime.exceptionThrown')exceptions.push((m.params.exceptionDetails.exception||{}).description||m.params.exceptionDetails.text);});
  await new Promise(r=>ws.addEventListener('open',r));
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  await send('Runtime.enable',{},sessionId); await send('Page.enable',{},sessionId);
  await send('Log.enable',{},sessionId).catch(()=>{});

  const {identifier:clear}=await send('Page.addScriptToEvaluateOnNewDocument',{source:'try{localStorage.clear();}catch(e){}'},sessionId);
  await send('Page.navigate',{url:process.argv[2]},sessionId);
  await new Promise(r=>setTimeout(r,3000));
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:clear},sessionId);

  // 写入"老版本遗留"的重复数据：同公司+同岗位+同批次，但 id 不同
  const seeded=await send('Runtime.evaluate',{expression:`(function(){
    var mk=function(qid,co,pos,batch,open,url){
      return sanitizeJob({id:'old_'+qid, qiuzhiId:qid, company:co, positionRaw:pos, positionTypes:[pos],
        batch:batch, city:'上海', cities:['上海'], openingDate:open, url:url||'', noticeUrl:'https://n.example/'+qid,
        popular:1, addedAt:'2026-09-01T00:00:00Z'});
    };
    jobList = [
      mk('901','遗留甲公司','前端工程师','27秋招','2026-09-10'),
      mk('902','遗留甲公司','前端工程师','27秋招','2026-09-18','https://apply.example/902'),
      mk('903','遗留甲公司','前端工程师','26秋招','2026-08-01'),
      mk('904','遗留乙公司','后端工程师','27秋招','2026-09-12'),
      mk('905','遗留乙公司','后端工程师','27秋招','2026-09-20'),
      mk('906','遗留丙公司','产品经理','27秋招','2026-09-15')
    ];
    saveJobList(); flushJobListNow();
    return JSON.stringify({count: jobList.length, dupKeys: 2});
  })()`,returnByValue:true},sessionId);
  console.log('写入老版本遗留数据:', seeded.result.value);

  // 重载 → 启动时应该自动去重
  await send('Page.navigate',{url:'about:blank'},sessionId);
  await new Promise(r=>setTimeout(r,400));
  exceptions.length=0;
  await send('Page.navigate',{url:process.argv[2]},sessionId);
  await new Promise(r=>setTimeout(r,4000));

  const after=await send('Runtime.evaluate',{expression:`(function(){
    var g=new Map();
    jobList.forEach(function(j){ if(!j.qiuzhiId) return;
      var k=[String(j.company||'').trim(),String(j.positionRaw||'').trim(),String(j.batch||'').trim()].join('||');
      g.set(k,(g.get(k)||0)+1); });
    var dup=0; g.forEach(function(c){ if(c>1) dup+=c-1; });
    var stored = JSON.parse(LZString.decompressFromUTF16(localStorage.getItem('campus_job_list')||'') || '[]');
    return JSON.stringify({
      inMemory: jobList.length,
      dupRemaining: dup,
      storedCount: Array.isArray(stored)? stored.length : -1,
      detail: jobList.map(function(j){ return j.company+'/'+j.batch+'/q='+j.qiuzhiId; }),
      keptAddedAt: jobList.filter(function(j){return j.company==='遗留甲公司' && j.batch==='27秋招';}).map(function(j){return j.addedAt;})
    });
  })()`,returnByValue:true},sessionId);
  const r=JSON.parse(after.result.value);
  console.log('\n重载后:', JSON.stringify(r,null,2).replace(/\n/g,'\n  '));
  console.log('\n========== 老数据自动清理 ==========');
  const chk=(n,c,e)=>console.log((c?'PASS':'FAIL')+' :: '+n+(e!==undefined&&!c?' :: '+e:''));
  chk('6 条遗留数据合并为 4 条', r.inMemory===4, r.inMemory);
  chk('无残留重复', r.dupRemaining===0, r.dupRemaining);
  chk('清理结果已落盘（存储里也是 4 条）', r.storedCount===4, r.storedCount);
  chk('跨批次的两条都保留（27秋招 + 26秋招）', r.detail.filter(function(s){return s.indexOf('遗留甲公司')===0;}).length===2,
      r.detail.filter(function(s){return s.indexOf('遗留甲公司')===0;}).join(' , '));
  chk('保留了最早的加入时间', r.keptAddedAt.length===1 && r.keptAddedAt[0]==='2026-09-01T00:00:00Z', JSON.stringify(r.keptAddedAt));
  if(exceptions.length){ console.log('-- 页面异常 --'); exceptions.slice(0,3).forEach(x=>console.log('  '+x)); }
  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
