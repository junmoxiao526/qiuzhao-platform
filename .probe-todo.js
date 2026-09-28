// 今日待办 / 到期提醒
return (async function () {
  var R = []; function chk(n, c, e) { R.push((c ? "PASS" : "FAIL") + " :: " + n + (e !== undefined && !c ? " :: " + e : "")); }
  function section(t) { R.push('-- ' + t + ' --'); }
  function dayOffset(n) {
    var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function mkJob(o) {
    return sanitizeJob(Object.assign({
      id: 'tj' + Math.random().toString(36).slice(2, 7), company: '待办公司', position: '岗位',
      status: 'applied', applyDate: dayOffset(-1), deadline: '', assessDeadline: '', aiDeadline: '', interviewDate: '', notes: ''
    }, o));
  }

  section('A 基础工具函数');
  chk('daysUntil 今天 = 0', daysUntil(dayOffset(0)) === 0, daysUntil(dayOffset(0)));
  chk('daysUntil 明天 = 1', daysUntil(dayOffset(1)) === 1, daysUntil(dayOffset(1)));
  chk('daysUntil 昨天 = -1', daysUntil(dayOffset(-1)) === -1, daysUntil(dayOffset(-1)));
  chk('daysUntil 空值 = null', daysUntil('') === null);
  chk('daysUntil 非法 = null', daysUntil('2026-13-45') === null, daysUntil('2026-13-45'));
  chk('dueText 今天', dueText(0) === '今天', dueText(0));
  chk('dueText 明天', dueText(1) === '明天', dueText(1));
  chk('dueText 逾期', dueText(-2) === '已逾期 2 天', dueText(-2));
  chk('dueClass 逾期', dueClass(-1) === 'due-over', dueClass(-1));
  chk('dueClass 今天', dueClass(0) === 'due-today', dueClass(0));

  section('B 各类日期都会生成待办');
  reminderSettings = Object.assign({}, REMINDER_DEFAULT, { enabled: true, leadDays: 3, showJobList: false });
  todoSnoozed = {};
  reviews = [];
  jobList = [];
  jobs = [
    mkJob({ id: 'a1', company: '截止公司', deadline: dayOffset(0) }),
    mkJob({ id: 'a2', company: '测评公司', assessDeadline: dayOffset(2) }),
    mkJob({ id: 'a3', company: 'AI面公司', aiDeadline: dayOffset(3) }),
    mkJob({ id: 'a4', company: '面试公司', interviewDate: dayOffset(1) }),
    mkJob({ id: 'a5', company: '逾期公司', deadline: dayOffset(-2) })
  ];
  var t = computeTodos();
  chk('生成 5 条待办', t.length === 5, t.length + ' → ' + t.map(function (x) { return x.company + '/' + x.kind; }).join(', '));
  chk('含投递截止', t.some(function (x) { return x.kind === 'deadline' && x.company === '截止公司'; }));
  chk('含测评截止', t.some(function (x) { return x.kind === 'assess' && x.company === '测评公司'; }));
  chk('含 AI 面截止', t.some(function (x) { return x.kind === 'ai' && x.company === 'AI面公司'; }));
  chk('含面试', t.some(function (x) { return x.kind === 'interview' && x.company === '面试公司'; }));
  chk('逾期项排在第一位', t[0].company === '逾期公司' && t[0].days === -2, t[0].company + '/' + t[0].days);

  section('C 超出提醒窗口的不算');
  jobs = [mkJob({ id: 'c1', company: '很久以后', deadline: dayOffset(10) })];
  chk('10 天后截止不进待办（窗口 3 天）', computeTodos().length === 0, computeTodos().length);
  reminderSettings.leadDays = 30;
  chk('窗口调成 30 天后就进了', computeTodos().length === 1, computeTodos().length);
  reminderSettings.leadDays = 3;

  section('D 面试只在 1 天内提醒');
  jobs = [mkJob({ id: 'd1', company: '远面试', interviewDate: dayOffset(3) })];
  chk('3 天后的面试不提醒', computeTodos().length === 0, computeTodos().length);
  jobs = [mkJob({ id: 'd2', company: '明天面试', interviewDate: dayOffset(1) })];
  chk('明天的面试提醒', computeTodos().length === 1);
  jobs = [mkJob({ id: 'd3', company: '今天面试', interviewDate: dayOffset(0) })];
  chk('今天的面试提醒', computeTodos().length === 1);

  section('E 已结束的投递不再催办');
  ['failed', 'rejected', 'offer'].forEach(function (st) {
    jobs = [mkJob({ id: 'e' + st, company: '结束-' + st, status: st, deadline: dayOffset(0) })];
    chk(st + ' 状态的投递不产生待办', computeTodos().length === 0, computeTodos().length);
  });
  ['pending', 'applied', 'assessment', 'interview1', 'hr'].forEach(function (st) {
    jobs = [mkJob({ id: 'f' + st, company: '进行-' + st, status: st, deadline: dayOffset(0) })];
    chk(st + ' 状态的投递正常产生待办', computeTodos().length === 1, computeTodos().length);
  });

  section('F 复盘里的「下一步」');
  jobs = [];
  reviews = [
    sanitizeReview({ id: 'r1', company: '复盘公司', stage: 'interview1', date: dayOffset(0), next: '要问 HR 结果', title: 'x', content: 'y', files: [] }),
    sanitizeReview({ id: 'r2', company: '无下一步', stage: 'interview1', date: dayOffset(0), next: '', title: 'x', content: 'y', files: [] }),
    sanitizeReview({ id: 'r3', company: '老复盘', stage: 'interview1', date: dayOffset(-30), next: '很久以前的事', title: 'x', content: 'y', files: [] }),
    sanitizeReview({ id: 'r4', company: '昨天复盘', stage: 'interview1', date: dayOffset(-1), next: '昨天的待办', title: 'x', content: 'y', files: [] })
  ];
  var rt = computeTodos();
  chk('有「下一步」的复盘进待办', rt.some(function (x) { return x.company === '复盘公司' && x.kind === 'reviewNext'; }),
      rt.map(function (x) { return x.company; }).join(','));
  chk('没有「下一步」的不进', !rt.some(function (x) { return x.company === '无下一步'; }));
  chk('日期太老的不进（超过 7 天）', !rt.some(function (x) { return x.company === '老复盘'; }));
  chk('昨天的不算太老，仍然提醒', rt.some(function (x) { return x.company === '昨天复盘'; }),
      rt.map(function (x) { return x.company; }).join(','));
  reviews = [];

  section('G 清单岗位默认不计入（避免被数千条淹没）');
  jobList = sanitizeJobList([
    { id: 'k1', qiuzhiId: 'q1', company: '清单公司', positionRaw: '岗位', positionTypes: ['岗位'], deadline: dayOffset(0), batch: '27秋招', cities: ['上海'] }
  ]);
  chk('默认不计入清单岗位', computeTodos().length === 0, computeTodos().length);
  reminderSettings.showJobList = true;
  chk('开启后计入', computeTodos().length === 1, computeTodos().length);
  reminderSettings.showJobList = false;

  section('H 稍后提醒：当天不再出现');
  jobList = [];
  jobs = [mkJob({ id: 'h1', company: '要稍后的', deadline: dayOffset(0) })];
  var h = computeTodos();
  chk('先有 1 条', h.length === 1, h.length);
  snoozeTodo(h[0].key);
  chk('稍后之后消失', computeTodos().length === 0, computeTodos().length);
  todoSnoozed = {};
  chk('清掉稍后记录后回来', computeTodos().length === 1, computeTodos().length);

  section('I 渲染到 DOM');
  jobs = [
    mkJob({ id: 'i1', company: '渲染甲', deadline: dayOffset(0) }),
    mkJob({ id: 'i2', company: '渲染乙', assessDeadline: dayOffset(1) })
  ];
  renderTodos();
  var bar = document.getElementById('todoBar');
  chk('待办栏可见', bar.style.display === 'block', bar.style.display);
  chk('显示了 2 个待办项', bar.querySelectorAll('.todo-item').length === 2, bar.querySelectorAll('.todo-item').length);
  chk('文案提到今天', bar.querySelector('.todo-title').textContent.indexOf('今天') !== -1, bar.querySelector('.todo-title').textContent);
  chk('公司名可点击跳转', bar.querySelectorAll('[data-act="todo-jump"]').length === 2);
  chk('每项都有「稍后」按钮', bar.querySelectorAll('[data-act="todo-snooze"]').length === 2);
  chk('有设置入口', !!bar.querySelector('[data-act="todo-settings"]'));

  section('J 关闭开关后隐藏');
  reminderSettings.enabled = false;
  renderTodos();
  chk('关闭后待办栏隐藏', document.getElementById('todoBar').style.display === 'none', document.getElementById('todoBar').style.display);
  reminderSettings.enabled = true;

  section('K 无待办时不显示空栏');
  jobs = [];
  renderTodos();
  chk('无待办时隐藏', document.getElementById('todoBar').style.display === 'none', document.getElementById('todoBar').style.display);

  section('L 设置持久化');
  reminderSettings = Object.assign({}, REMINDER_DEFAULT, { leadDays: 7, enabled: false, showJobList: true });
  saveReminderSettings();
  reminderSettings = Object.assign({}, REMINDER_DEFAULT);
  loadReminderSettings();
  chk('leadDays 已保存', reminderSettings.leadDays === 7, reminderSettings.leadDays);
  chk('enabled 已保存', reminderSettings.enabled === false, reminderSettings.enabled);
  chk('showJobList 已保存', reminderSettings.showJobList === true, reminderSettings.showJobList);

  section('M 待办随数据变化自动更新');
  // 显式设定，不要依赖上一段存进 localStorage 的值（L 段故意存了 enabled:false）
  reminderSettings = Object.assign({}, REMINDER_DEFAULT, { leadDays: 3, enabled: true, showJobList: false });
  todoSnoozed = {};
  jobs = [];
  renderTodos();
  chk('先无待办', document.getElementById('todoBar').style.display === 'none');
  jobs.push(mkJob({ id: 'm1', company: '新增后', deadline: dayOffset(0) }));
  refreshAfterJobChange({ save: false });
  chk('新增投递后待办栏自动出现', document.getElementById('todoBar').style.display === 'block',
      document.getElementById('todoBar').style.display);

  // 清理
  jobs = []; reviews = []; jobList = []; todoSnoozed = {};
  reminderSettings = Object.assign({}, REMINDER_DEFAULT);
  saveReminderSettings();
  renderTodos();
  return R;
})();
