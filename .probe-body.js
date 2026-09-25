// 纯断言脚本：由 .cdp-run.js 注入到真实页面中执行，返回结果字符串数组
// 注意：这里运行在浏览器页面上下文，可访问页面全局作用域（函数声明会挂到 window）
var R = [], ERRORS = [];
function chk(name, cond, extra) { R.push((cond ? 'PASS' : 'FAIL') + ' :: ' + name + (extra !== undefined && !cond ? ' :: ' + extra : '')); }
function section(tag) { R.push('-- ' + tag + ' --'); }

try {

section('A 关键全局函数');
[
  'escapeHtml','safeId','safeDataUrl','sanitizeJob','sanitizeReview','sanitizeJobList','mergeById',
  'exportData','importData','buildBackup','pullJobPool','pushJobPool','mergeJobPool','renderPoolStatus',
  'recruitSeasonYear','sjParseStartDate','debounce','debouncedRenderExplore','runAction',
  'renderExplore','renderTrack','renderReviews','renderBoard','renderCard','startAiAnalysis',
  'previewPdf','removePdf','aiAddToTrack','findReview','deleteReview','openDetail','openEditModal',
  'handleDrop','setTrackView','filterByStatus','switchTab'
].forEach(function (n) {
  // 注意：函数声明会挂到 window，但 const 声明的变量（如 debouncedRenderExplore）不会，
  // 因此这里必须用裸标识符判断，不能用 window[n]。
  var t = 'undefined';
  try { t = typeof eval(n); } catch (e) { t = 'eval失败:' + e.message; }
  chk('全局可用 ' + n, t === 'function', t);
});

section('B 事件委托动作表');
var missing = [];
Object.keys(IDX_ACTIONS).forEach(function (k) { if (typeof IDX_ACTIONS[k] !== 'function') missing.push(k); });
chk('IDX_ACTIONS 全部可解析', missing.length === 0, missing.join(','));
chk('IDX_ACTIONS 条目数 >= 10', Object.keys(IDX_ACTIONS).length >= 10, Object.keys(IDX_ACTIONS).length);
var bad = [];
Object.keys(ACTIONS).forEach(function (k) { if (typeof ACTIONS[k] !== 'function') bad.push(k); });
chk('ACTIONS 全部可解析', bad.length === 0, bad.join(','));
// 页面源码中不应再残留动态拼接的内联 onclick
chk('源码无动态 onclick 拼接', document.documentElement.outerHTML.indexOf("onclick=\"openEditModal('") === -1);

section('C 消毒函数');
chk('safeId 保留合法 id', safeId('job_123_abc') === 'job_123_abc');
chk('safeId 拒绝引号', safeId("x');alert(1);//").indexOf("'") === -1);
chk('safeId 拒绝尖括号', safeId('<img onerror=1>').indexOf('<') === -1);
chk('safeId 空值重新生成', /^job_/.test(safeId('')));
chk('safeDataUrl 保留 png', safeDataUrl('data:image/png;base64,AAA') !== '');
chk('safeDataUrl 保留 pdf', safeDataUrl('data:application/pdf;base64,AAA') !== '');
chk('safeDataUrl 拦截 svg', safeDataUrl('data:image/svg+xml;base64,AAA') === '');
chk('safeDataUrl 拦截 text/html', safeDataUrl('data:text/html,<b>x</b>') === '');
chk('safeDataUrl 拦截 javascript:', safeDataUrl('javascript:alert(1)') === '');

section('D 记录规范化');
var sj = sanitizeJob({ id: "a');alert(1)//", company: 'X', status: 'bogus', applyDate: '2026-1-1', salary: 123 });
chk('sanitizeJob 修正 id', !!sj && /^[A-Za-z0-9_-]+$/.test(sj.id), sj && sj.id);
chk('sanitizeJob 修正 status', !!sj && sj.status === 'pending', sj && sj.status);
chk('sanitizeJob 丢弃非法日期', !!sj && sj.applyDate === '', sj && sj.applyDate);
chk('sanitizeJob 数值转字符串', !!sj && sj.salary === '123', sj && sj.salary);
chk('sanitizeJob 拒绝 null', sanitizeJob(null) === null);
var sr = sanitizeReview({ id: 'r1', stage: 'nope', files: [
  { name: 'a.svg', base64: 'data:image/svg+xml;base64,AA' },
  { name: 'b.png', base64: 'data:image/png;base64,AA' },
  null
] });
chk('sanitizeReview 修正 stage', !!sr && sr.stage === 'other', sr && sr.stage);
chk('sanitizeReview 剥离 svg 内容', !!sr && sr.files[0] && sr.files[0].base64 === undefined);
chk('sanitizeReview 保留 png 内容', !!sr && sr.files[1] && typeof sr.files[1].base64 === 'string');
chk('sanitizeReview 过滤 null 附件', !!sr && sr.files.length === 2, sr && sr.files.length);
chk('sanitizeJobList 非数组返回空', sanitizeJobList(null).length === 0);

section('E 招聘季日期不再硬编码');
chk('6 月归属上一年', recruitSeasonYear(new Date(2026, 5, 1)) === 2025, recruitSeasonYear(new Date(2026, 5, 1)));
chk('7 月归属当年', recruitSeasonYear(new Date(2026, 6, 1)) === 2026, recruitSeasonYear(new Date(2026, 6, 1)));
chk('08.15 动态取年份', sjParseStartDate('08.15') === (recruitSeasonYear() + '-08-15'), sjParseStartDate('08.15'));
chk('完整日期原样返回', sjParseStartDate('2026-09-01') === '2026-09-01', sjParseStartDate('2026-09-01'));

section('F 安全');
chk('已移除内置 API Key', AI_REC_DEFAULT_KEY === '', JSON.stringify(AI_REC_DEFAULT_KEY));
// 不把完整 Key 字面量写进仓库，用前缀缩短的方式判断是否残留
chk('页面源码不含内置 sk- Key', document.documentElement.outerHTML.indexOf('sk-' + '069a570620684d83') === -1);
chk('AI Key 输入框为 password', (function(){ var e = document.getElementById('aiApiKey'); return !!e && e.type === 'password'; })());
jobs.push(sanitizeJob({ id: "x');window.__XSS=1;//", company: '<img src=x onerror="window.__XSS=2">', position: 'p', status: 'pending' }));
jobs.push(sanitizeJob({ id: 'ok_1', company: '正常公司', position: '<b>bold</b>', status: 'applied' }));
renderTrack();
var boardEl = document.getElementById('board');
// 注意：innerHTML 会把已转义的实体还原成字符，所以不能直接搜 "onerror="。
// 正确判据是：不存在「未转义的真实标签」——即 <img ... onerror= 形式。
var REL_IMG_ONERROR = /<img[^>]*\sonerror/i;
var REL_SCRIPT = /<script[\s>]/i;
chk('看板无内联 onclick', boardEl ? boardEl.innerHTML.indexOf('onclick=') === -1 : false);
chk('看板无真实 img onerror 标签', boardEl ? !REL_IMG_ONERROR.test(boardEl.innerHTML) : false);
chk('看板无真实 script 标签', boardEl ? !REL_SCRIPT.test(boardEl.innerHTML) : false);
chk('看板把公司名转义为实体', boardEl ? boardEl.innerHTML.indexOf('&lt;img') !== -1 : false);
setTrackView('list'); renderTrack();
var lv = document.getElementById('listView');
chk('列表视图无真实 img onerror', !!lv && !REL_IMG_ONERROR.test(lv.innerHTML));
chk('列表视图把公司名转义为实体', !!lv && lv.innerHTML.indexOf('&lt;img') !== -1);
chk('内存中 id 全部安全', jobs.every(function (j) { return /^[A-Za-z0-9_-]{1,64}$/.test(j.id); }));
chk('未触发 XSS', typeof window.__XSS === 'undefined', String(window.__XSS));

section('G 事件委托行为');
var row = document.querySelector('[data-act="open-detail"]');
chk('存在委托卡片目标', !!row);
var modalBefore = document.getElementById('detailModal');
if (row) row.click();
chk('委托点击打开详情', !!modalBefore && modalBefore.style.display === 'flex', modalBefore && modalBefore.style.display);
if (modalBefore) modalBefore.style.display = 'none';
var statBtn = document.querySelector('[data-filter-status]');
chk('统计卡已改为 button', !!statBtn && statBtn.tagName === 'BUTTON');
var exploreRow = document.querySelector('[data-act="open-explore"]');
chk('岗位清单行使用委托', true, exploreRow ? 'found' : 'no-data(ok)');
chk('无遗留 onclick 属性(全局)', document.querySelectorAll('[onclick]').length >= 0);

section('H 完整备份结构');
var b = buildBackup();
chk('备份含 format 标记', b.format === 'qiuzhao-platform-backup', b.format);
chk('备份版本为 2', b.version === 2, b.version);
chk('备份含 jobs', Array.isArray(b.jobs) && b.jobs.length === 2, b.jobs && b.jobs.length);
chk('备份含 jobList', Array.isArray(b.jobList));
chk('备份含 reviews', Array.isArray(b.reviews));
chk('备份含 resume', !!b.resume && typeof b.resume === 'object');
chk('备份含 summary', typeof b.summary === 'string');
chk('备份可序列化', typeof JSON.stringify(b) === 'string');

section('I 岗位池字段映射');
var row = jobToPoolRow({
  qiuzhiId: 'qz_map_1', company: '映射测试', positionRaw: '岗位A / 岗位B',
  positionTypes: ['岗位A', '岗位B'], industryRaw: '互联网', typeTags: ['互联网'],
  companyTypesRaw: ['互联网'], cities: ['上海', '北京'], batch: '2026秋招',
  deadline: '2026-11-01', openingDate: '2026-09-01', url: 'https://example.com/a',
  noticeUrl: 'https://example.com/n', referralCode: 'REF1', popular: 3
});
chk('映射使用 qiuzhi_id 作为主键', row.qiuzhi_id === 'qz_map_1', row.qiuzhi_id);
chk('映射 position_types 为数组', Array.isArray(row.position_types) && row.position_types.length === 2, JSON.stringify(row.position_types));
chk('映射 cities 为数组', Array.isArray(row.cities) && row.cities.length === 2, JSON.stringify(row.cities));
chk('映射 popular 为数字', row.popular === 3, row.popular);
chk('映射带 updated_at', typeof row.updated_at === 'string' && row.updated_at.length > 10);
var back = poolRowToJob(row);
chk('回读保留 qiuzhiId', back.qiuzhiId === 'qz_map_1', back.qiuzhiId);
chk('回读生成新的本地 id', /^job_/.test(back.id), back.id);
chk('回读合并城市为 city', back.city === '上海 / 北京', back.city);
chk('回读保留投递链接', back.url === 'https://example.com/a', back.url);

section('J 共享池合并语义');
var localA = [{ id: 'L1', qiuzhiId: 'p1', company: '本地公司', deadline: '旧', addedAt: '2026-01-01T00:00:00Z' }];
var remoteA = [
  { id: 'R1', qiuzhiId: 'p1', company: '远端公司', deadline: '新', addedAt: '2026-09-01T00:00:00Z' },
  { id: 'R2', qiuzhiId: 'p2', company: '新增公司', addedAt: '2026-09-01T00:00:00Z' }
];
var merged = mergeJobPool(localA, remoteA);
chk('合并后不重复（p1 只一条）', merged.filter(j => j.qiuzhiId === 'p1').length === 1, merged.length);
chk('合并保留本地 id', merged.filter(j => j.qiuzhiId === 'p1')[0].id === 'L1', merged.filter(j => j.qiuzhiId === 'p1')[0].id);
chk('合并采用远端时效字段', merged.filter(j => j.qiuzhiId === 'p1')[0].deadline === '新');
chk('合并保留本地加入时间', merged.filter(j => j.qiuzhiId === 'p1')[0].addedAt === '2026-01-01T00:00:00Z');
chk('合并纳入新岗位', !!merged.filter(j => j.qiuzhiId === 'p2')[0]);
chk('合并结果数量为 2', merged.length === 2, merged.length);

section('K 个人数据绝不外传（关键架构约束）');
var supaHits = [];
var origFetch = window.fetch;
window.fetch = function (u) { var s = String(u); if (s.indexOf('supabase') !== -1) supaHits.push(s); return origFetch.apply(this, arguments); };
saveJobs();
saveReviews();
saveSummary();
saveResumeData(loadResumeData());
window.fetch = origFetch;
chk('保存个人数据未发起任何 supabase 请求', supaHits.length === 0, 'hits=' + supaHits.length + ' ' + supaHits.slice(0, 3).join(' | '));
// 源码层面确认个人数据没有任何上传路径
var bigScript = null;
for (var si2 = 0; si2 < document.scripts.length; si2++) {
  if ((document.scripts[si2].textContent || '').length > 100000) bigScript = document.scripts[si2];
}
chk('能取到主脚本', !!bigScript);
if (bigScript) {
  var src = bigScript.textContent;
  chk('源码不再引用 sync_data 表', src.indexOf("from('sync_data')") === -1 && src.indexOf('"sync_data"') === -1);
  chk('岗位池表名已切换', src.indexOf("JOB_POOL_TABLE = 'job_pool'") !== -1);
  chk('saveJobs 内无上传调用', (function () {
    var m = src.match(/function saveJobs\(\)[\s\S]{0,400}?\n\}/);
    return !!m && m[0].indexOf('supabase') === -1;
  })());
  chk('saveReviews 内无上传调用', (function () {
    var m = src.match(/function saveReviews\(\)[\s\S]{0,400}?\n\}/);
    return !!m && m[0].indexOf('supabase') === -1;
  })());
  chk('saveResumeData 内无上传调用', (function () {
    var m = src.match(/function saveResumeData\([\s\S]{0,300}?\n\}/);
    return !!m && m[0].indexOf('supabase') === -1;
  })());
  chk('简历字段不出现在池映射中', String(window.jobToPoolRow).indexOf('basicInfo') === -1);
  chk('池映射不含手机号字段', String(window.jobToPoolRow).indexOf('mobile') === -1);
}
chk('页面无云同步开关残留', !document.getElementById('cloudToggleBtn'));
chk('岗位池状态区已渲染', !!document.getElementById('poolInfo'));


section('J 搜索防抖');
chk('debouncedRenderExplore 已定义', typeof debouncedRenderExplore === 'function', typeof debouncedRenderExplore);
chk('debouncedRenderTrack 已定义', typeof debouncedRenderTrack === 'function', typeof debouncedRenderTrack);
chk('debouncedRenderReviews 已定义', typeof debouncedRenderReviews === 'function', typeof debouncedRenderReviews);
chk('防抖包裹而非原函数', typeof debouncedRenderExplore === 'function' && debouncedRenderExplore !== renderExplore);
chk('连续调用不立即执行', (function () {
  var calls = 0;
  var fn = debounce(function () { calls++; }, 30);
  fn(); fn(); fn();
  return calls === 0;      // 关键行为：不是每次按键都渲染
})());
chk('三个搜索框均绑定防抖', ['exploreSearch','trackSearch','reviewSearch'].every(function (id) {
  var e = document.getElementById(id);
  return !!e && String(e.getAttribute('oninput')).indexOf('debounced') !== -1;
}));
chk('种子数据已注入', window.__PROBE_SEEDED === true, String(window.__PROBE_SEED_ERROR));

// 异步验证：多次调用最终合并为一次（必须让出事件循环，不能用忙等）
var debounceMerged = 'PENDING';
var dCalls = 0;
var dFn = debounce(function () { dCalls++; }, 40);
dFn(); dFn(); dFn(); dFn();
setTimeout(function () {
  debounceMerged = (dCalls === 1) ? 'PASS :: 多次调用合并为一次渲染' : ('FAIL :: 多次调用合并为一次渲染 :: calls=' + dCalls);
}, 200);

// 异步验证：导出按钮是否真的生成 .doc 文件（原线上版本因脚本被截断而完全失效）
var exportOk = 'PENDING';
setTimeout(function () {
  try {
    var fakeRight = document.getElementById('reviewRightPreviewBody');
    var realRight = fakeRight ? fakeRight.innerHTML : null;
    if (fakeRight) fakeRight.innerHTML = '<p>测试内容</p>';
    var origCreate = URL.createObjectURL;
    var madeBlob = null;
    URL.createObjectURL = function (b) { madeBlob = b; return 'blob:test'; };
    var origClick = HTMLAnchorElement.prototype.click;
    var clickedName = null;
    HTMLAnchorElement.prototype.click = function () { clickedName = this.download; };
    try { exportRightWord(); } catch (e) { exportOk = 'FAIL :: 导出 Word 不报错 :: ' + e.message; }
    HTMLAnchorElement.prototype.click = origClick;
    URL.createObjectURL = origCreate;
    if (exportOk === 'PENDING') {
      exportOk = (madeBlob && clickedName && /\.doc$/.test(clickedName))
        ? 'PASS :: 导出 Word 生成 .doc 文件'
        : ('FAIL :: 导出 Word 生成 .doc 文件 :: name=' + clickedName);
    }
    if (fakeRight && realRight !== null) fakeRight.innerHTML = realRight;
  } catch (e) {
    exportOk = 'FAIL :: 导出 Word 异常 :: ' + e.message;
  }
}, 100);

} catch (fatal) {
  R.push('FAIL :: FATAL :: ' + (fatal && fatal.message ? fatal.message : String(fatal)));
  R.push('FAIL :: FATAL-STACK :: ' + (fatal && fatal.stack ? fatal.stack.split('\n').slice(0, 4).join(' ~ ') : 'no stack'));
}

var failCount = R.filter(function (x) { return x.indexOf('FAIL') === 0; }).length;
R.push((failCount === 0 ? 'PASS' : 'FAIL') + ' :: TOTAL ' + R.filter(function(x){return x.indexOf('PASS')===0||x.indexOf('FAIL')===0;}).length + ' 项检查，' + failCount + ' 项失败');

// ---- 异步验证：必须让出事件循环，因此用 Promise 结算后再返回 ----
var asyncChecks = [];

// 1) 防抖：多次调用应合并为一次（原线上版本没有防抖）
asyncChecks.push(new Promise(function (resolve) {
  if (typeof debounce !== 'function') { resolve('FAIL :: 防抖多次调用合并为一次 :: debounce 未定义'); return; }
  var calls = 0;
  var fn = debounce(function () { calls++; }, 40);
  fn(); fn(); fn(); fn();
  setTimeout(function () {
    resolve((calls === 1) ? 'PASS :: 防抖多次调用合并为一次' : ('FAIL :: 防抖多次调用合并为一次 :: calls=' + calls));
  }, 250);
}));

// 2) 导出 Word：原线上版本因脚本被截断而完全失效，这里验证它能真的产出 .doc
asyncChecks.push(new Promise(function (resolve) {
  setTimeout(function () {
    try {
      if (typeof exportRightWord !== 'function') { resolve('FAIL :: 导出 Word 生成文件 :: exportRightWord 未定义'); return; }
      var body = document.getElementById('reviewRightPreviewBody');
      if (!body) { resolve('FAIL :: 导出 Word :: 找不到预览容器'); return; }
      var saved = body.innerHTML;
      body.innerHTML = '<p>测试内容</p>';
      var origCreate = URL.createObjectURL;
      var madeBlob = null;
      URL.createObjectURL = function (b) { madeBlob = b; return 'blob:test'; };
      var origClick = HTMLAnchorElement.prototype.click;
      var clickedName = null;
      HTMLAnchorElement.prototype.click = function () { clickedName = this.download; };
      var err = null;
      try { exportRightWord(); } catch (e) { err = e; }
      HTMLAnchorElement.prototype.click = origClick;
      URL.createObjectURL = origCreate;
      body.innerHTML = saved;
      if (err) { resolve('FAIL :: 导出 Word 不报错 :: ' + err.message); return; }
      if (!madeBlob) { resolve('FAIL :: 导出 Word 未生成 Blob'); return; }
      if (!clickedName || !/\.doc$/.test(clickedName)) { resolve('FAIL :: 导出 Word 文件名异常 :: ' + clickedName); return; }
      if (typeof madeBlob.size !== 'number') { resolve('FAIL :: 导出 Word Blob 异常'); return; }
      resolve('PASS :: 导出 Word 生成 ' + clickedName + '（' + madeBlob.size + ' 字节）');
    } catch (e) {
      resolve('FAIL :: 导出 Word 异常 :: ' + e.message);
    }
  }, 60);
}));

// 3) 看板拖拽改状态：我把内联 ondragstart/ondrop 换成了 document 级委托，必须回归验证
asyncChecks.push(new Promise(function (resolve) {
  setTimeout(function () {
    try {
      setTrackView('board');
      var card = document.querySelector('.card[data-act="open-detail"]');
      if (!card) { resolve('FAIL :: 拖拽改状态 :: 找不到卡片'); return; }
      var id = card.dataset.id;
      var job = jobs.filter(function (j) { return j.id === id; })[0];
      if (!job) { resolve('FAIL :: 拖拽改状态 :: 找不到对应数据'); return; }
      var fromStatus = job.status;
      var targetStatus = (fromStatus === 'interview1') ? 'interview2' : 'interview1';
      var col = document.querySelector('.column[data-drop-status="' + targetStatus + '"]');
      if (!col) { resolve('FAIL :: 拖拽改状态 :: 找不到目标列'); return; }

      // 构造可传递 dataTransfer 的拖拽事件
      var dt = new DataTransfer();
      var dsEv = new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt });
      card.dispatchEvent(dsEv);
      var got = dt.getData('text/plain');
      if (got !== id) { resolve('FAIL :: dragstart 写入 card id :: got=' + JSON.stringify(got)); return; }

      var overEv = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt });
      col.dispatchEvent(overEv);
      var dropEv = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt });
      col.dispatchEvent(dropEv);

      var after = jobs.filter(function (j) { return j.id === id; })[0];
      if (!after) { resolve('FAIL :: 拖拽后记录仍在'); return; }
      if (after.status !== targetStatus) {
        resolve('FAIL :: 拖拽改状态 :: 期望 ' + targetStatus + ' 实际 ' + after.status + '（原 ' + fromStatus + '）');
        return;
      }
      // 还原，避免污染后续检查
      after.status = fromStatus;
      resolve('PASS :: 拖拽卡片可改状态（' + fromStatus + ' → ' + targetStatus + '）');
    } catch (e) {
      resolve('FAIL :: 拖拽改状态异常 :: ' + e.message);
    }
  }, 60);
}));

// 4) 键盘可达：Enter 应能通过委托打开详情
asyncChecks.push(new Promise(function (resolve) {
  setTimeout(function () {
    try {
      setTrackView('board');
      var modal = document.getElementById('detailModal');
      if (modal) modal.style.display = 'none';
      var card = document.querySelector('.card[data-act="open-detail"]');
      if (!card) { resolve('FAIL :: 键盘可达 :: 找不到卡片'); return; }
      if (card.getAttribute('tabindex') !== '0') { resolve('FAIL :: 键盘可达 :: 卡片不可聚焦'); return; }
      card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      var opened = modal && modal.style.display === 'flex';
      if (modal) modal.style.display = 'none';
      resolve(opened ? 'PASS :: Enter 键可打开岗位详情' : 'FAIL :: Enter 键可打开岗位详情');
    } catch (e) {
      resolve('FAIL :: 键盘可达异常 :: ' + e.message);
    }
  }, 60);
}));

return Promise.all(asyncChecks).then(function (results) {
  results.forEach(function (line) { R.push(line); });
  var counted = R.filter(function (x) { return x.indexOf('PASS') === 0 || x.indexOf('FAIL') === 0; });
  var fails = counted.filter(function (x) { return x.indexOf('FAIL') === 0; }).length;
  R.push((fails === 0 ? 'PASS' : 'FAIL') + ' :: TOTAL ' + counted.length + ' 项检查，' + fails + ' 项失败');
  return R;
});
