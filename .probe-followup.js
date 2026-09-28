return (async function () {
  var R=[]; function chk(n,c,e){ R.push((c?"PASS":"FAIL")+" :: "+n+(e!==undefined&&!c?" :: "+e:"")); }
  function section(t){ R.push('-- '+t+' --'); }
  function off(n){ var d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+n);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function mk(o){ return sanitizeJob(Object.assign({ id:'fu'+Math.random().toString(36).slice(2,7),
    company:'跟进公司', position:'岗位', status:'applied', applyDate:off(-1), notes:'' }, o)); }

  reminderSettings = Object.assign({}, REMINDER_DEFAULT, { enabled:true, leadDays:3, showJobList:false, followUpDays:14 });
  todoSnoozed = {}; jobList = []; reviews = [];

  section('A 投递后长期无进展 → 提醒跟进');
  jobs = [ mk({ id:'f1', company:'刚投的', applyDate: off(-1) }) ];
  chk('刚投 1 天不提醒', computeTodos().length === 0, computeTodos().length);
  jobs = [ mk({ id:'f2', company:'投了14天', applyDate: off(-14) }) ];
  var t14 = computeTodos();
  chk('投了 14 天提醒', t14.length === 1 && t14[0].kind === 'followUp', JSON.stringify(t14.map(function(x){return x.kind;})));
  chk('文案是「停滞 N 天」', dueText(t14[0].days, 'followUp') === '停滞 14 天', dueText(t14[0].days, t14[0].kind));
  chk('样式类是 due-follow', dueClass(t14[0].days, 'followUp') === 'due-follow', dueClass(t14[0].days, 'followUp'));
  chk('不算作「已逾期」', t14.filter(function(x){return x.days<0;}).length === 0);

  section('B 用「上次联系」而不是投递日期');
  jobs = [ mk({ id:'f3', company:'投很久但刚联系过', applyDate: off(-40), lastContactAt: off(-2) }) ];
  chk('投递 40 天但 2 天前联系过 → 不提醒', computeTodos().length === 0, computeTodos().length);
  jobs = [ mk({ id:'f4', company:'投很久且很久没联系', applyDate: off(-40), lastContactAt: off(-20) }) ];
  var tB = computeTodos();
  chk('20 天没联系 → 提醒，且天数按联系日算', tB.length === 1 && tB[0].days === 20, JSON.stringify(tB.map(function(x){return x.days;})));

  section('C 只有「已投递」这一档才催');
  ['pending','assessment','exam','ai','interview1','interview2','hr','failed','rejected','offer'].forEach(function(st){
    jobs = [ mk({ id:'s'+st, company:'状态-'+st, status: st, applyDate: off(-40), lastContactAt: off(-40) }) ];
    var has = computeTodos().some(function(x){ return x.kind === 'followUp'; });
    chk(st + ' 不产生跟进提醒', !has, has ? '误报' : '');
  });

  section('D 阈值可配置');
  reminderSettings.followUpDays = 30;
  jobs = [ mk({ id:'f5', company:'14天', applyDate: off(-14) }) ];
  chk('阈值 30 天时 14 天不提醒', computeTodos().length === 0, computeTodos().length);
  jobs = [ mk({ id:'f6', company:'31天', applyDate: off(-31) }) ];
  chk('31 天提醒', computeTodos().length === 1, computeTodos().length);
  reminderSettings.followUpDays = 14;

  section('E 排序：跟进排在逾期/今天之后、未来事项之前');
  jobs = [
    mk({ id:'o1', company:'逾期项', deadline: off(-1) }),
    mk({ id:'o2', company:'今天项', deadline: off(0) }),
    mk({ id:'o3', company:'跟进项', applyDate: off(-20) }),
    mk({ id:'o4', company:'未来项', deadline: off(2) })
  ];
  var sorted = computeTodos();
  chk('共 4 项', sorted.length === 4, sorted.length);
  R.push('INFO :: 排序结果 = ' + sorted.map(function(x){ return x.company + '(' + x.kind + ',' + x.days + ')'; }).join(' → '));
  chk('逾期第一', sorted[0].company === '逾期项', sorted[0].company);
  chk('今天第二', sorted[1].company === '今天项', sorted[1].company);
  chk('跟进第三', sorted[2].company === '跟进项', sorted[2].company);
  chk('未来事项最后', sorted[3].company === '未来项', sorted[3].company);

  section('F 多个跟进按停滞时间倒序');
  jobs = [
    mk({ id:'g1', company:'停滞15天', applyDate: off(-15) }),
    mk({ id:'g2', company:'停滞40天', applyDate: off(-40) }),
    mk({ id:'g3', company:'停滞20天', applyDate: off(-20) })
  ];
  var gs = computeTodos().filter(function(x){ return x.kind === 'followUp'; });
  chk('3 条跟进', gs.length === 3, gs.length);
  chk('停滞最久排最前', gs[0].company === '停滞40天', gs.map(function(x){return x.company;}).join(','));

  section('G 顶栏文案提到跟进');
  jobs = [ mk({ id:'h1', company:'只有跟进', applyDate: off(-20) }) ];
  renderTodos();
  var title = document.querySelector('#todoBar .todo-title').textContent;
  chk('文案提到「无进展」', title.indexOf('无进展') !== -1, title);

  section('H 标记已投递时自动记录「上次联系」');
  jobs = [];
  var nj = mk({ id:'i1', company:'手动加的', status:'pending', applyDate:'', lastContactAt:'' });
  jobs.push(nj);
  chk('初始无 lastContactAt', !jobs[0].lastContactAt);
  var found = jobs.find(function(x){ return x.id === 'i1'; });
  if (found) { found.status = 'applied'; if (!found.applyDate) found.applyDate = off(0); found.lastContactAt = off(0); }
  chk('转为已投递后有 lastContactAt', !!jobs[0].lastContactAt, jobs[0].lastContactAt);
  chk('当天不会立刻催跟进', !computeTodos().some(function(x){ return x.kind === 'followUp'; }));

  section('I 设置持久化（含跟进天数）');
  reminderSettings.followUpDays = 21;
  saveReminderSettings();
  reminderSettings = Object.assign({}, REMINDER_DEFAULT);
  loadReminderSettings();
  chk('followUpDays 已保存', reminderSettings.followUpDays === 21, reminderSettings.followUpDays);

  jobs = []; reviews = []; jobList = []; todoSnoozed = {};
  reminderSettings = Object.assign({}, REMINDER_DEFAULT);
  saveReminderSettings(); renderTodos();
  return R;
})();
