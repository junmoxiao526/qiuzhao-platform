// 自包含 CDP 驱动：
//  1) 连到 browser 级 WebSocket，自己新建一个干净 target（规避缓存与残留页面）
//  2) 从导航开始就监听 Runtime.exceptionThrown / Log.entryAdded，拿到首个语法错误
//  3) 注入断言脚本并回收结果
// 用法: node .cdp-run.js <断言脚本文件> <页面URL>
const fs = require('fs');
const http = require('http');

const probeFile = process.argv[2];
const pageUrl = process.argv[3];
const cdpPort = process.env.CDP_PORT || '9222';
if (!probeFile || !pageUrl) { console.error('用法: node .cdp-run.js <probe.js> <url>'); process.exit(2); }
const probeSrc = fs.readFileSync(probeFile, 'utf8');

function httpJson(url) {
  return new Promise((res, rej) => {
    const req = http.get(url, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); });
    req.on('error', rej);
    req.setTimeout(5000, () => req.destroy(new Error('timeout')));
  });
}

(async () => {
  const ver = await httpJson(`http://127.0.0.1:${cdpPort}/json/version`);
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  let id = 0;
  const pend = new Map();
  const events = [];

  const send = (method, params, sessionId) => new Promise((resolve, reject) => {
    const msgId = ++id;
    pend.set(msgId, { resolve, reject });
    const payload = { id: msgId, method, params: params || {} };
    if (sessionId) payload.sessionId = sessionId;
    ws.send(JSON.stringify(payload));
  });

  ws.addEventListener('message', ev => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.id && pend.has(m.id)) {
      const p = pend.get(m.id); pend.delete(m.id);
      if (m.error) p.reject(new Error(m.error.message)); else p.resolve(m.result);
      return;
    }
    if (m.method) events.push(m);
  });

  await new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', () => rej(new Error('browser websocket error')));
  });

  // 新建 target（about:blank），避免复用任何已有页面
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

  await send('Runtime.enable', {}, sessionId);
  await send('Log.enable', {}, sessionId);
  await send('Page.enable', {}, sessionId);
  await send('Network.enable', {}, sessionId);
  await send('Network.setCacheDisabled', { cacheDisabled: true }, sessionId);

  // 在任何页面脚本执行之前注入种子状态。
  // 这样被测页面可以是未经任何改动的 index.html —— 不做字符串替换，
  // 避免替换动作本身破坏被测文件（之前正是这样制造了一个假的语法错误）。
  // 环境变量：
  //   PROBE_TAG           标识当前 profile（打印用）
  //   PROBE_SEED_PERSONAL =1 时写入一份「私人数据」，用于隔离验证
  //   PROBE_KEEP_STORAGE  =1 时不清空 localStorage（用于性能测量：
  //                       需要先灌入真实数据，再量"带着数据启动"的耗时）
  const seedTag = process.env.PROBE_TAG || '';
  const seedPersonal = process.env.PROBE_SEED_PERSONAL === '1';
  const keepStorage = process.env.PROBE_KEEP_STORAGE === '1';
  const seedLines = keepStorage
    ? [
        '    window.__PROBE_SEEDED = true;',
        '    window.__PROBE_SEED_PERSONAL = "kept";',
        '    window.__PROFILE_TAG = ' + JSON.stringify(seedTag) + ';'
      ]
    : [
        '    localStorage.clear();',
        seedPersonal
          ? '    localStorage.setItem("campus_recruit_jobs", JSON.stringify([{id:"p1",company:"我的私人公司",position:"私人岗位",status:"applied",city:"上海",applyDate:"2026-09-01",notes:""}]));'
          : '    localStorage.removeItem("campus_recruit_jobs");',
        seedPersonal
          ? '    localStorage.setItem("campus_reviews", JSON.stringify([{id:"r1",company:"私人公司",title:"私人面经标题",content:"这是绝不应该被别人看到的私人面经内容",stage:"interview1",date:"2026-09-02",next:"",files:[]}]));'
          : '    localStorage.removeItem("campus_reviews");',
        seedPersonal
          ? '    localStorage.setItem("campus_resume", JSON.stringify({basicInfo:{name:"私人姓名",mobile:"13900000000",email:"private@example.com"},settings:{title:"个人简历",skin:"#607a9d",lastSyncAt:null}}));'
          : '    localStorage.removeItem("campus_resume");',
        seedPersonal
          ? '    localStorage.setItem("campus_summary", JSON.stringify("我的私人投递总结"));'
          : '    localStorage.removeItem("campus_summary");',
        '    localStorage.removeItem("campus_job_list");',
        '    window.__PROBE_SEEDED = true;',
        '    window.__PROBE_SEED_PERSONAL = ' + (seedPersonal ? '1' : '0') + ';',
        '    window.__PROFILE_TAG = ' + JSON.stringify(seedTag) + ';'
      ];
  const seedSource = ['(function(){', '  try {', ...seedLines, '  } catch(e) { window.__PROBE_SEED_ERROR = String(e); }', '})();'].join('\n');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: seedSource }, sessionId);

  const navStart = events.length;
  await send('Page.navigate', { url: pageUrl }, sessionId);
  await new Promise(r => setTimeout(r, 4000));

  const reloadEvents = events.slice(navStart);

  // 健全性检查：应用脚本是否真的执行了
  const sanity = await send('Runtime.evaluate', {
    expression: 'JSON.stringify({ url: location.href, scripts: document.scripts.length, fn: typeof escapeHtml, consts: typeof STATUSES })',
    returnByValue: true
  }, sessionId);
  console.log('sanity:', sanity.result.value);

  const parseErrors = reloadEvents.filter(e =>
    e.method === 'Runtime.exceptionThrown' ||
    (e.method === 'Log.entryAdded' && e.params.entry.level === 'error' && e.params.entry.source !== 'network')
  );
  if (parseErrors.length) {
    console.log('\n---------- 页面加载期错误 ----------');
    parseErrors.forEach(e => {
      if (e.method === 'Runtime.exceptionThrown') {
        const d = e.params.exceptionDetails;
        console.log(`[Exception] ${d.text} @${d.lineNumber}:${d.columnNumber} ${d.url || ''}`);
        if (d.exception && d.exception.description) console.log('    ' + String(d.exception.description).split('\n').slice(0, 3).join('\n    '));
      } else {
        const n = e.params.entry;
        console.log(`[Log.error] ${n.text} ${n.url || ''}:${n.lineNumber || ''}`);
      }
    });
  }

  // 注入断言
  let result, evalException = null;
  try {
    const r = await send('Runtime.evaluate', {
      expression: `(function(){ ${probeSrc} })()`,
      returnByValue: true,
      awaitPromise: true
    }, sessionId);
    result = r.result && r.result.value;
    if (r.exceptionDetails) evalException = JSON.stringify(r.exceptionDetails.exception || r.exceptionDetails.text);
  } catch (e) { evalException = e.message; }

  await new Promise(r => setTimeout(r, 500));

  const lines = Array.isArray(result) ? result : ['FAIL :: 断言脚本未返回结果 (' + typeof result + ')'];
  console.log('\n========== PROBE OUTPUT ==========');
  lines.forEach(l => console.log(l));
  if (evalException) console.log('\n[注入异常] ' + evalException);

  const runtimeExceptions = reloadEvents.filter(e => e.method === 'Runtime.exceptionThrown');
  const fails = lines.filter(l => l.indexOf('FAIL') === 0).length;
  const passes = lines.filter(l => l.indexOf('PASS') === 0).length;
  console.log(`\n========== ${passes} passed, ${fails} failed, ${runtimeExceptions.length} 页面异常 ==========`);

  await send('Target.closeTarget', { targetId });
  ws.close();
  process.exit(fails || runtimeExceptions.length ? 1 : 0);
})().catch(e => { console.error('driver error:', e.message); process.exit(2); });
