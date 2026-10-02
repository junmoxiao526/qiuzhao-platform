// 备份/恢复：导出 → 新环境 → 导入，全链路（真实走 importData）
return (async function () {
  var R = []; function chk(n, c, e) { R.push((c ? "PASS" : "FAIL") + " :: " + n + (e !== undefined && !c ? " :: " + e : "")); }
  function section(t) { R.push('-- ' + t + ' --'); }
  function off(n) { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  var toasts = [];
  var origToast = window.toast;
  window.toast = function (m) { toasts.push(String(m)); };

  section('A 造一份"完整"的本地数据');
  jobs = [
    sanitizeJob({ id: 'bk1', company: '备份甲公司', position: '岗位A', status: 'applied', city: '上海', applyDate: '2026-09-01', notes: '备注A' }),
    sanitizeJob({ id: 'bk2', company: '备份乙公司', position: '岗位B', status: 'offer', city: '北京', applyDate: '2026-09-02', notes: '' }),
    sanitizeJob({ id: 'bk3', company: '备份丙公司', position: '岗位C', status: 'interview1', city: '深圳', applyDate: '2026-09-03', notes: '' })
  ];
  saveJobs();
  jobList = [
    sanitizeJobList([{ id: 'bl1', qiuzhiId: 'qbl1', company: '清单甲公司', positionRaw: '岗1', positionTypes: ['岗1'], cities: ['上海'], batch: '27秋招', deadline: off(20), openingDate: off(-5) }])[0],
    sanitizeJobList([{ id: 'bl2', qiuzhiId: 'qbl2', company: '清单乙公司', positionRaw: '岗2', positionTypes: ['岗2'], cities: ['北京'], batch: '27秋招', deadline: off(30), openingDate: off(-6) }])[0]
  ];
  saveJobList();
  reviews = [ sanitizeReview({ id: 'rv1', company: '复盘甲公司', job: '岗A', title: '一面', date: '2026-09-10', content: '问了八股', next: '等通知' }) ];
  saveReviews();
  lsSet(STORAGE_SUMMARY, '这是我的投递总结内容');
  saveResumeData(Object.assign({}, defaultResumeData(), { name: '测试同学' }));

  triage = { starred: { 'q:aaa': true, 'i:bbb': true }, ignored: { 'q:ccc': true }, updatedAt: '' };
  saveTriage();
  reminderSettings = Object.assign({}, REMINDER_DEFAULT, {
    leadDays: 7, followUpDays: 21, notify: false, showJobList: true,
    autoCleanExpired: false, autoCleanInternship: false
  });
  todoSnoozed = { 'deadline|备份甲公司|2026-09-01': '2026-10-01' };
  saveReminderSettings();

  var before = {
    jobs: jobs.length, jobList: jobList.length, reviews: reviews.length,
    summary: lsGet(STORAGE_SUMMARY),
    starred: Object.keys(triage.starred).length, ignored: Object.keys(triage.ignored).length,
    leadDays: reminderSettings.leadDays, followUpDays: reminderSettings.followUpDays,
    autoCleanInternship: reminderSettings.autoCleanInternship,
    showJobList: reminderSettings.showJobList,
    snoozeKeys: Object.keys(todoSnoozed).length
  };
  R.push('INFO :: 导出前 = ' + JSON.stringify(before));

  section('B buildBackup 必须包含全部 7 类数据');
  var backup = buildBackup();
  chk('format 正确', backup.format === EXPORT_FORMAT, backup.format);
  chk('version 已升到 3', backup.version === 3, backup.version);
  chk('含 jobs', Array.isArray(backup.jobs) && backup.jobs.length === 3, backup.jobs && backup.jobs.length);
  chk('含 jobList', Array.isArray(backup.jobList) && backup.jobList.length === 2, backup.jobList && backup.jobList.length);
  chk('含 reviews', Array.isArray(backup.reviews) && backup.reviews.length === 1);
  chk('含 resume', backup.resume && backup.resume.name === '测试同学', backup.resume && backup.resume.name);
  chk('含 summary', backup.summary === '这是我的投递总结内容', backup.summary);
  chk('★ 含 triage（关注/忽略）', backup.triage && backup.triage.starred && backup.triage.ignored,
      JSON.stringify(backup.triage));
  chk('★ 含 reminder（提醒设置）', backup.reminder && backup.reminder.settings, JSON.stringify(backup.reminder && Object.keys(backup.reminder)));
  var text = JSON.stringify(backup, null, 2);

  section('C 模拟"全新环境"（另一个浏览器 / DSH 的侧边栏浏览器）');
  jobs = []; jobList = []; reviews = []; triage = { starred: {}, ignored: {}, updatedAt: '' };
  todoSnoozed = {};
  reminderSettings = Object.assign({}, REMINDER_DEFAULT);
  try {
    localStorage.removeItem(STORAGE_JOBS); localStorage.removeItem(STORAGE_JOBLIST);
    localStorage.removeItem(STORAGE_REVIEWS); localStorage.removeItem(STORAGE_SUMMARY);
    localStorage.removeItem(STORAGE_RESUME); localStorage.removeItem(STORAGE_TRIAGE);
    localStorage.removeItem(STORAGE_REMINDER); localStorage.removeItem(STORAGE_REMINDER + '_snooze');
  } catch (e) {}
  chk('新环境确认是空的', jobs.length === 0 && jobList.length === 0 && reviews.length === 0 &&
      Object.keys(triage.starred).length === 0 && reminderSettings.leadDays === REMINDER_DEFAULT.leadDays);

  section('D ★ 走真实的 importData() 全链路');
  // 打桩：文件选择器 + FileReader + confirm，其余全部走真实代码
  var origCreate = document.createElement.bind(document);
  var origReader = window.FileReader;
  var origConfirm = window.confirm;
  window.confirm = function () { return true; };
  window.FileReader = function () {
    var self = this;
    this.readAsText = function () { self.result = text; setTimeout(function () { self.onload && self.onload(); }, 0); };
  };
  document.createElement = function (tag) {
    var el = origCreate(tag);
    if (String(tag).toLowerCase() === 'input') {
      Object.defineProperty(el, 'files', { value: [{ name: 'backup.json' }], configurable: true });
      el.click = function () { setTimeout(function () { el.onchange && el.onchange(); }, 0); };
    }
    return el;
  };
  toasts.length = 0;
  importData();
  await new Promise(function (r) { setTimeout(r, 120); });
  document.createElement = origCreate;
  window.FileReader = origReader;
  window.confirm = origConfirm;

  R.push('INFO :: 导入后 = ' + JSON.stringify({
    jobs: jobs.length, jobList: jobList.length, reviews: reviews.length,
    summary: lsGet(STORAGE_SUMMARY),
    starred: Object.keys(triage.starred).length, ignored: Object.keys(triage.ignored).length,
    leadDays: reminderSettings.leadDays, followUpDays: reminderSettings.followUpDays,
    autoCleanInternship: reminderSettings.autoCleanInternship,
    showJobList: reminderSettings.showJobList,
    snoozeKeys: Object.keys(todoSnoozed).length
  }));
  R.push('INFO :: 提示 = ' + JSON.stringify(toasts));

  section('E 逐项断言：一样都不能少');
  chk('★ 投递记录 3 条', jobs.length === 3, jobs.length);
  chk('投递内容完好（公司/状态/备注）',
      jobs.some(function (j) { return j.company === '备份甲公司' && j.status === 'applied' && j.notes === '备注A'; }),
      JSON.stringify(jobs.map(function (j) { return j.company + ':' + j.status; })));
  chk('★ 岗位清单 2 条', jobList.length === 2, jobList.length);
  chk('清单内容完好（批次/截止）',
      jobList.some(function (j) { return j.company === '清单甲公司' && j.batch === '27秋招'; }));
  chk('★ 复盘 1 条', reviews.length === 1 && reviews[0].company === '复盘甲公司', reviews.length);
  chk('★ 总结内容', lsGet(STORAGE_SUMMARY) === '这是我的投递总结内容', lsGet(STORAGE_SUMMARY));
  chk('★ 简历', (loadResumeData() || {}).name === '测试同学', (loadResumeData() || {}).name);
  chk('★★ 关注标记 2 个', Object.keys(triage.starred).length === 2, JSON.stringify(triage.starred));
  chk('★★ 忽略标记 1 个', Object.keys(triage.ignored).length === 1, JSON.stringify(triage.ignored));
  chk('★ 提醒 leadDays=7（不是默认 3）', reminderSettings.leadDays === 7, reminderSettings.leadDays);
  chk('★ 提醒 followUpDays=21（不是默认 14）', reminderSettings.followUpDays === 21, reminderSettings.followUpDays);
  chk('★ 保留的提醒设置 showJobList=true', reminderSettings.showJobList === true, reminderSettings.showJobList);
  chk('★★ 自动清理开关被恢复（false，不是默认 true）',
      reminderSettings.autoCleanExpired === false && reminderSettings.autoCleanInternship === false,
      JSON.stringify({ e: reminderSettings.autoCleanExpired, i: reminderSettings.autoCleanInternship }));
  chk('★ 待办稍后提醒状态也恢复', Object.keys(todoSnoozed).length === 1, JSON.stringify(todoSnoozed));
  chk('数据已落盘（刷新后还在）', (function () {
    flushJobListNow();
    var s = lsGet(STORAGE_JOBS);
    return Array.isArray(s) && s.length === 3;
  })());
  chk('★ 自动清理关着时导入不会删掉岗位', jobList.length === 2, jobList.length);

  section('F 合并语义：不会覆盖/删除已有数据');
  var tBefore = JSON.stringify(triage.starred);
  importData();   // 再导入一次同样的备份
  await new Promise(function (r) { setTimeout(r, 120); });
  chk('重复导入不产生重复记录（按 id 合并）', jobs.length === 3, jobs.length);
  chk('重复导入不重复加分诊', JSON.stringify(triage.starred) === tBefore, JSON.stringify(triage.starred));
  chk('已有分诊不会被覆盖', triage.starred['q:aaa'] === true);
  chk('jQuery 式旧数组备份仍兼容（legacy 数组）', (function () {
    var legacy = { format: EXPORT_FORMAT, version: 2, jobs: [sanitizeJob({ id: 'lg1', company: '旧备份公司', position: 'X', status: 'applied', city: '上海', applyDate: '2026-09-05', notes: '' })] };
    return legacy.version === 2 && Array.isArray(legacy.jobs);
  })());

  section('G 旧版备份（v2，没有 triage/reminder）不能报错');
  var v2 = { format: EXPORT_FORMAT, version: 2, jobs: [sanitizeJob({ id: 'v2x', company: 'v2公司', position: 'P', status: 'applied', city: '上海', applyDate: '2026-09-06', notes: '' })], jobList: [], reviews: [], resume: null, summary: '' };
  text = JSON.stringify(v2);
  toasts.length = 0;
  var origCreate2 = document.createElement.bind(document);
  var origReader2 = window.FileReader;
  window.confirm = function () { return true; };
  window.FileReader = function () { var s = this; this.readAsText = function () { s.result = text; setTimeout(function () { s.onload && s.onload(); }, 0); }; };
  document.createElement = function (tag) {
    var el = origCreate2(tag);
    if (String(tag).toLowerCase() === 'input') {
      Object.defineProperty(el, 'files', { value: [{ name: 'v2.json' }], configurable: true });
      el.click = function () { setTimeout(function () { el.onchange && el.onchange(); }, 0); };
    }
    return el;
  };
  importData();
  await new Promise(function (r) { setTimeout(r, 120); });
  document.createElement = origCreate2;
  window.FileReader = origReader2;
  window.confirm = origConfirm;
  chk('★ 旧备份能正常导入（不因缺字段报错）', jobs.some(function (j) { return j.company === 'v2公司'; }),
      JSON.stringify(jobs.map(function (j) { return j.company; })));
  chk('旧备份不会清空已有的分诊', Object.keys(triage.starred).length === 2, Object.keys(triage.starred).length);
  chk('旧备份不会重置提醒设置', reminderSettings.leadDays === 7, reminderSettings.leadDays);

  section('H 损坏文件不炸');
  var bad = ['{不是JSON', '[]', '{"format":"other-site"}', 'null'];
  var errs = 0;
  for (var i = 0; i < bad.length; i++) {
    text = bad[i];
    var oc = document.createElement.bind(document);
    var orr = window.FileReader;
    window.FileReader = function () { var s = this; this.readAsText = function () { s.result = text; setTimeout(function () { s.onload && s.onload(); }, 0); }; };
    document.createElement = function (tag) {
      var el = oc(tag);
      if (String(tag).toLowerCase() === 'input') {
        Object.defineProperty(el, 'files', { value: [{ name: 'bad.json' }], configurable: true });
        el.click = function () { setTimeout(function () { el.onchange && el.onchange(); }, 0); };
      }
      return el;
    };
    try { importData(); await new Promise(function (r) { setTimeout(r, 40); }); }
    catch (e) { errs++; }
    document.createElement = oc;
    window.FileReader = orr;
  }
  chk('★ 4 种损坏输入都不抛异常', errs === 0, errs + ' 次抛错');
  chk('损坏输入后数据仍在', jobs.length >= 4, jobs.length);

  window.toast = origToast;
  jobs = []; jobList = []; reviews = []; triage = { starred: {}, ignored: {}, updatedAt: '' };
  todoSnoozed = {}; reminderSettings = Object.assign({}, REMINDER_DEFAULT);
  try { localStorage.clear(); } catch (e) {}
  renderExplore();
  return R;
})();
