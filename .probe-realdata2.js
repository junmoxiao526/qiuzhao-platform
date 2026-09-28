return (async function () {
  var R=[]; function chk(n,c,e){ R.push((c?"PASS":"FAIL")+" :: "+n+(e!==undefined&&!c?" :: "+e:"")); }
  function section(t){ R.push('-- '+t+' --'); }

  await syncQiuzhiFangzhou();
  var sm=document.getElementById('syncResultModal'); if(sm) sm.style.display='none';
  R.push('INFO :: 真实岗位清单 = ' + jobList.length + ' 条');

  section('功能1 今日待办（真实数据）');
  reminderSettings = Object.assign({}, REMINDER_DEFAULT, { enabled:true, leadDays:7, showJobList:false, followUpDays:14 });
  todoSnoozed = {};
  // 造几条真实感的投递记录
  var co = jobList.slice(0, 6).map(function(j){ return j.company; });
  function off(n){ var d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+n);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  jobs = [
    sanitizeJob({ id:'r1', company:co[0], position:'岗位A', status:'applied', applyDate:off(-20), deadline:off(0), notes:'' }),
    sanitizeJob({ id:'r2', company:co[1], position:'岗位B', status:'assessment', applyDate:off(-5), assessDeadline:off(2), notes:'' }),
    sanitizeJob({ id:'r3', company:co[2], position:'岗位C', status:'interview1', applyDate:off(-10), interviewDate:off(1), notes:'' }),
    sanitizeJob({ id:'r4', company:co[3], position:'岗位D', status:'applied', applyDate:off(-30), notes:'' }),
    sanitizeJob({ id:'r5', company:co[4], position:'岗位E', status:'offer', applyDate:off(-40), deadline:off(0), notes:'' }),
    sanitizeJob({ id:'r6', company:co[0], position:'岗位F', status:'applied', applyDate:off(-15), deadline:off(-3), notes:'' })
  ];
  renderTodos();
  var bar = document.getElementById('todoBar');
  R.push('INFO :: 待办栏 display=' + bar.style.display + '，条目=' + bar.querySelectorAll('.todo-item').length);
  R.push('INFO :: 标题=' + (bar.querySelector('.todo-title')||{}).textContent);
  R.push('INFO :: 条目=' + Array.prototype.map.call(bar.querySelectorAll('.todo-item'), function(e){ return e.textContent.replace(/\s+/g,' ').trim().slice(0,42); }).join(' || '));
  chk('待办栏显示出来', bar.style.display === 'block', bar.style.display);
  chk('逾期项被识别', bar.querySelector('.todo-due.due-over') !== null);
  chk('今天的项被识别', bar.querySelector('.todo-due.due-today') !== null);
  chk('面试项出现', bar.textContent.indexOf('面试') !== -1);
  chk('Offer 的不再催办', bar.textContent.indexOf(co[4]) === -1, co[4]);
  chk('跟进项出现（30天无进展）', bar.textContent.indexOf('无进展') !== -1 || bar.textContent.indexOf('停滞') !== -1);

  section('功能2 分诊（真实数据）');
  triage = { starred:{}, ignored:{}, updatedAt:'' };
  var beforeList = jobList.length;
  var pick = jobList.filter(function(j){ return j.qiuzhiId; }).slice(0, 20);
  pick.slice(0,8).forEach(function(j){ setTriage(j.id, 'star'); });
  pick.slice(8,20).forEach(function(j){ setTriage(j.id, 'ignore'); });
  R.push('INFO :: 已关注 ' + jobList.filter(isStarred).length + ' 个，已忽略 ' + jobList.filter(isIgnored).length + ' 个');
  chk('关注 8 个', jobList.filter(isStarred).length === 8, jobList.filter(isStarred).length);
  chk('忽略 12 个', jobList.filter(isIgnored).length === 12, jobList.filter(isIgnored).length);
  chk('★ 岗位总数未变（只标记不删除）', jobList.length === beforeList, beforeList + ' → ' + jobList.length);
  var sel = document.getElementById('exploreTriage');
  sel.value='star'; renderExplore();
  chk('仅关注筛选出 8 行', document.querySelectorAll('.explore-table tbody tr').length === 8,
      document.querySelectorAll('.explore-table tbody tr').length);
  sel.value='hideIgnored'; renderExplore();
  chk('隐藏已忽略后行数 = 总数-12', document.querySelectorAll('.explore-table tbody tr').length === Math.min(200, beforeList-12),
      document.querySelectorAll('.explore-table tbody tr').length + ' vs ' + (beforeList-12));
  sel.value=''; renderExplore();
  chk('分诊汇总文案', document.getElementById('triageSummary').textContent.indexOf('已关注 8') !== -1,
      document.getElementById('triageSummary').textContent);

  section('功能4 公司时间线（真实公司）');
  var target = jobList[0].company;
  var tl = buildCompanyTimeline(target);
  R.push('INFO :: 「' + target + '」时间线 ' + tl.length + ' 条：' + tl.slice(0,4).map(function(e){ return e.date+':'+e.title; }).join(' | '));
  chk('能构建出时间线', tl.length > 0, tl.length);
  openCompanyTimeline(target);
  chk('弹窗渲染', document.getElementById('timelineModal').style.display === 'flex');
  chk('渲染出条目', document.querySelectorAll('#timelineBody .tl-item').length > 0);
  closeTimeline();

  section('功能5 面经题库（真实公司名）');
  questions = [
    sanitizeQuestion({ id:'qq1', company:target, position:'开发', category:'algorithm', date:off(-1), question:'手写快排', answer:'分治', mastery:'new' }),
    sanitizeQuestion({ id:'qq2', company:target, position:'开发', category:'project', date:off(-2), question:'讲讲你的项目', answer:'STAR 法则', mastery:'solid' })
  ];
  saveQuestions();
  switchTab('questions');
  chk('题库页签渲染出 2 张卡', document.querySelectorAll('#questionList .q-card').length === 2,
      document.querySelectorAll('#questionList .q-card').length);
  chk('统计卡显示总数 2', document.getElementById('questionStats').textContent.indexOf('2') !== -1);
  chk('分类下拉已构建', document.getElementById('questionCategoryFilter').options.length === 11,
      document.getElementById('questionCategoryFilter').options.length);

  section('功能6 转化统计（真实数据）');
  openStats();
  var sb = document.getElementById('statsBody').textContent;
  R.push('INFO :: 统计弹窗渲染，长度=' + sb.length);
  chk('漏斗渲染出 5 档', document.querySelectorAll('#statsBody .fn-row').length === 5,
      document.querySelectorAll('#statsBody .fn-row').length);
  chk('分组表渲染', document.querySelectorAll('#statsBody .fn-table').length === 2);
  chk('提示补简历版本', sb.indexOf('没有填「这版投的简历」') !== -1);
  closeStats();

  section('清理');
  triage = { starred:{}, ignored:{}, updatedAt:'' }; saveTriage();
  jobs = []; questions = []; saveQuestions();
  jobList = []; renderExplore(); renderTodos();
  chk('清理完成', jobList.length === 0);
  return R;
})();
