// 启动数据恢复验证：写入 localStorage 后重载，确认投递管理/岗位清单/复盘都能读回来
// 用法: node .startup-data-test.js <cdp端口> <页面URL>
const fs = require('fs');
const http = require('http');
const path = require('path');

const cdpPort = process.argv[2] || '9222';
const pageUrl = process.argv[3];
if (!pageUrl) { console.error('用法: node .startup-data-test.js <port> <url>'); process.exit(2); }

function httpJson(url) {
  return new Promise((res, rej) => {
    const req = http.get(url, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); });
    req.on('error', rej); req.setTimeout(5000, () => req.destroy(new Error('timeout')));
  });
}

(async () => {
  const ver = await httpJson(`http://127.0.0.1:${cdpPort}/json/version`);
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  let id = 0; const pend = new Map(); const exceptions = [];
  const send = (m, p, s) => new Promise((resolve, reject) => {
    const i = ++id; pend.set(i, { resolve, reject });
    const o = { id: i, method: m, params: p || {} };
    if (s) o.sessionId = s;
    ws.send(JSON.stringify(o));
  });
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { const q = pend.get(m.id); pend.delete(m.id); m.error ? q.reject(new Error(m.error.message)) : q.resolve(m.result); return; }
    if (m.method === 'Runtime.exceptionThrown') exceptions.push((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text);
  });
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', () => rej(new Error('ws error'))); });

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Runtime.enable', {}, sessionId);
  await send('Page.enable', {}, sessionId);

  const OUT = [];
  const chk = (n, c, extra) => OUT.push((c ? 'PASS' : 'FAIL') + ' :: ' + n + (extra !== undefined && !c ? ' :: ' + extra : ''));

  // ---- 第 1 步：在一个干净页面里写入测试数据并落盘 ----
  // 注意：清空脚本只能在**首次**导航前注册，注册后必须在重载前移除，
  // 否则重载时它会把刚写入的数据清掉，测出来永远是"数据丢失"。
  const { identifier: clearScript } = await send('Page.addScriptToEvaluateOnNewDocument',
    { source: 'try{localStorage.clear();}catch(e){}' }, sessionId);
  await send('Page.navigate', { url: pageUrl }, sessionId);
  await new Promise(r => setTimeout(r, 3000));
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: clearScript }, sessionId);

  const seeded = await send('Runtime.evaluate', {
    expression: `(function(){
      // 造 5 条投递记录 + 3 条岗位清单 + 2 条复盘，全部走应用自己的保存函数
      jobs = [
        { id:'j1', company:'测试甲公司', position:'前端工程师', status:'applied',   city:'上海', applyDate:'2026-09-01', deadline:'2026-10-01', notes:'' },
        { id:'j2', company:'测试乙公司', position:'后端工程师', status:'pending',   city:'北京', applyDate:'',           deadline:'',           notes:'' },
        { id:'j3', company:'测试丙公司', position:'产品经理',   status:'interview1',city:'深圳', applyDate:'2026-09-05', deadline:'',           notes:'' },
        { id:'j4', company:'测试丁公司', position:'测试开发',   status:'offer',     city:'杭州', applyDate:'2026-09-08', deadline:'',           notes:'' },
        { id:'j5', company:'测试戊公司', position:'数据开发',   status:'pending',   city:'广州', applyDate:'',           deadline:'',           notes:'' }
      ].map(sanitizeJob).filter(Boolean);
      jobList = sanitizeJobList([
        { id:'k1', qiuzhiId:'q1', company:'清单甲公司', positionRaw:'岗位A', positionTypes:['岗位A'], city:'上海', cities:['上海'], companyType:'大厂', typeTags:['互联网'], openingDate:'2026-09-10', popular:3 },
        { id:'k2', qiuzhiId:'q2', company:'清单乙公司', positionRaw:'岗位B', positionTypes:['岗位B'], city:'北京', cities:['北京'], companyType:'外企', typeTags:['外企'], openingDate:'2026-09-11', popular:1 },
        { id:'k3', qiuzhiId:'q3', company:'清单丙公司', positionRaw:'岗位C', positionTypes:['岗位C'], city:'深圳', cities:['深圳'], companyType:'央国企', typeTags:['央国企'], openingDate:'2026-09-12', popular:0 }
      ]);
      reviews = [
        { id:'r1', company:'复盘甲公司', job:'岗位', stage:'interview1', title:'一面', content:'内容一', next:'', date:'2026-09-20', files:[] },
        { id:'r2', company:'复盘乙公司', stage:'interview2', title:'二面', content:'内容二', next:'等结果', date:'2026-09-21', files:[] }
      ].map(sanitizeReview).filter(Boolean);
      saveJobs(); saveJobList(); saveReviews();
      flushJobListNow();   // 岗位清单有防抖，立即落盘
      return JSON.stringify({ jobs: jobs.length, jobList: jobList.length, reviews: reviews.length,
        raw: { jobs: (localStorage.getItem('campus_recruit_jobs')||'').length,
               jobList: (localStorage.getItem('campus_job_list')||'').length,
               reviews: (localStorage.getItem('campus_reviews')||'').length } });
    })()`, returnByValue: true
  }, sessionId);
  console.log('已写入数据:', seeded.result.value);

  // ---- 第 2 步：重载页面（不清空 localStorage），检查是否读回 ----
  await send('Page.navigate', { url: 'about:blank' }, sessionId);
  await new Promise(r => setTimeout(r, 500));
  exceptions.length = 0;
  await send('Page.navigate', { url: pageUrl }, sessionId);
  await new Promise(r => setTimeout(r, 4000));

  const after = await send('Runtime.evaluate', {
    expression: `(function(){
      var statsVal = null;
      var cards = document.querySelectorAll('#trackStats .stat-card');
      var total = null;
      cards.forEach(function(c){ if (c.querySelector('.stat-label').textContent.trim()==='总计') total = c.querySelector('.stat-value').textContent.trim(); });
      // 切到投递管理，看看板/列表有没有内容
      switchTab('track');
      var boardCards = document.querySelectorAll('#board .card').length;
      trackView='list'; renderTrack();
      var listRows = document.querySelectorAll('#listView .list-row, #listView tbody tr').length;
      trackView='board'; renderTrack();
      switchTab('explore');
      var exploreRows = document.querySelectorAll('.explore-table tbody tr').length;
      switchTab('review');
      var reviewCards = document.querySelectorAll('.review-card').length;
      return JSON.stringify({
        jobsInMemory: jobs.length,
        jobListInMemory: jobList.length,
        reviewsInMemory: reviews.length,
        trackTotal: total,
        boardCards: boardCards,
        listRows: listRows,
        exploreRows: exploreRows,
        reviewCards: reviewCards,
        jobsLoadedFrom: jobs.length ? 'ok' : 'EMPTY'
      });
    })()`, returnByValue: true
  }, sessionId);
  const r = JSON.parse(after.result.value);
  console.log('\n重载后状态:', JSON.stringify(r, null, 2).replace(/\n/g, '\n  '));

  chk('投递记录已从本机读回（jobs=5）', r.jobsInMemory === 5, r.jobsInMemory);
  chk('岗位清单已读回（jobList=3）', r.jobListInMemory === 3, r.jobListInMemory);
  chk('复盘已读回（reviews=2）', r.reviewsInMemory === 2, r.reviewsInMemory);
  chk('投递管理「总计」显示 5', r.trackTotal === '5', r.trackTotal);
  chk('看板渲染出 5 张卡片', r.boardCards === 5, r.boardCards);
  chk('列表视图渲染出 5 行', r.listRows === 5, r.listRows);
  chk('岗位清单渲染出 3 行', r.exploreRows === 3, r.exploreRows);
  chk('复盘渲染出 2 张卡片', r.reviewCards === 2, r.reviewCards);

  if (exceptions.length) {
    OUT.push('-- 页面异常 --');
    exceptions.slice(0, 5).forEach(x => OUT.push('  ' + x));
  }

  console.log('\n========== 启动数据恢复 ==========');
  OUT.forEach(l => console.log(l));
  const failed = OUT.filter(l => l.indexOf('FAIL') === 0).length;
  console.log('\n' + (OUT.length - failed) + ' passed, ' + failed + ' failed' + (exceptions.length ? ', ' + exceptions.length + ' 页面异常' : ''));
  await send('Target.closeTarget', { targetId });
  ws.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('driver error:', e.message); process.exit(1); });
