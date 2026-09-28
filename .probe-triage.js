return (async function () {
  var R=[]; function chk(n,c,e){ R.push((c?"PASS":"FAIL")+" :: "+n+(e!==undefined&&!c?" :: "+e:"")); }
  function section(t){ R.push('-- '+t+' --'); }
  function mk(o){ return sanitizeJob(Object.assign({ id:'t'+Math.random().toString(36).slice(2,7),
    qiuzhiId:'q'+Math.random().toString(36).slice(2,7), company:'分诊公司', positionRaw:'岗位', positionTypes:['岗位'],
    city:'上海', cities:['上海'], batch:'27秋招', deadline:'2026-12-31', openingDate:'2026-09-20' }, o)); }

  section('A 标记基础操作');
  triage = { starred:{}, ignored:{}, updatedAt:'' };
  var j1 = mk({ id:'s1', qiuzhiId:'qs1', company:'甲' });
  jobList = [j1];
  chk('初始未标记', !isStarred(j1) && !isIgnored(j1));
  setTriage('s1','star');
  chk('关注后 isStarred', isStarred(jobList[0]));
  chk('关注后不属于忽略', !isIgnored(jobList[0]));
  setTriage('s1','ignore');
  chk('改为忽略后不再是关注', !isStarred(jobList[0]), 'star='+isStarred(jobList[0]));
  chk('改为忽略后 isIgnored', isIgnored(jobList[0]));
  setTriage('s1','star');
  chk('★ 关注与忽略互斥（改关注会清掉忽略）', isStarred(jobList[0]) && !isIgnored(jobList[0]));

  section('B 再点一次 = 取消');
  // 此时处于"已关注"状态，先点忽略会切换过去（互斥），再点一次才是取消
  setTriage('s1','ignore');
  chk('已关注时点忽略 → 变为忽略', isIgnored(jobList[0]) && !isStarred(jobList[0]));
  setTriage('s1','ignore');
  chk('再点忽略取消忽略', !isIgnored(jobList[0]));
  setTriage('s1','star');
  chk('点关注 → 变为关注', isStarred(jobList[0]));
  setTriage('s1','star');
  chk('再点关注取消关注', !isStarred(jobList[0]));

  section('C 按 qiuzhiId 存标记（同步后仍有效）');
  triage = { starred:{}, ignored:{}, updatedAt:'' };
  jobList = [mk({ id:'c1', qiuzhiId:'stable-id', company:'稳定' })];
  setTriage('c1','star');
  chk('标记键是 q:stable-id', !!triage.starred['q:stable-id'], JSON.stringify(triage.starred));
  // 模拟重新同步：同 qiuzhiId，但本地 id 变了
  jobList = [mk({ id:'NEW-local-id', qiuzhiId:'stable-id', company:'稳定' })];
  chk('★ 本地 id 变化后关注仍在', isStarred(jobList[0]), JSON.stringify(triage.starred));

  section('D 无 qiuzhiId 的岗位用手动 id');
  triage = { starred:{}, ignored:{}, updatedAt:'' };
  jobList = [sanitizeJob({ id:'manual-x', company:'手动的', positionRaw:'岗位', positionTypes:['岗位'], cities:['上海'] })];
  setTriage('manual-x','star');
  chk('手动岗位也能标记', !!triage.starred['i:manual-x'], JSON.stringify(triage.starred));

  section('E 筛选：仅关注 / 隐藏已忽略');
  triage = { starred:{}, ignored:{}, updatedAt:'' };
  jobList = [
    mk({ id:'e1', qiuzhiId:'qe1', company:'关注的公司' }),
    mk({ id:'e2', qiuzhiId:'qe2', company:'忽略的公司' }),
    mk({ id:'e3', qiuzhiId:'qe3', company:'普通的公司' })
  ];
  setTriage('e1','star');
  setTriage('e2','ignore');
  var sel = document.getElementById('exploreTriage');
  chk('筛选下拉存在', !!sel);
  sel.value = 'star'; renderExplore();
  var rows = document.querySelectorAll('.explore-table tbody tr');
  chk('仅关注 = 1 行', rows.length === 1, rows.length);
  chk('筛选出的是关注的那家', rows[0].textContent.indexOf('关注的公司') !== -1, rows[0].textContent.slice(0,30));
  sel.value = 'hideIgnored'; renderExplore();
  var rows2 = document.querySelectorAll('.explore-table tbody tr');
  chk('隐藏已忽略 = 2 行', rows2.length === 2, rows2.length);
  chk('忽略的那家不在结果里', !Array.prototype.some.call(rows2, function(r){ return r.textContent.indexOf('忽略的公司')!==-1; }));
  sel.value = ''; renderExplore();

  section('F DOM 渲染标记按钮');
  var r0 = document.querySelector('.expl-row[data-id="e1"]');
  chk('行上有标记单元格', !!r0.querySelector('.expl-triage'));
  chk('关注的显示实心星', r0.querySelector('[data-act="triage-star"]').textContent.trim() === '★',
      r0.querySelector('[data-act="triage-star"]').textContent.trim());
  chk('标记为关注的加上 expl-starred 类', r0.classList.contains('expl-starred'));
  var r1 = document.querySelector('.expl-row[data-id="e2"]');
  chk('忽略的加上 expl-ignored 类', r1.classList.contains('expl-ignored'), r1.className);
  chk('忽略的显示实心忽略符', r1.querySelector('[data-act="triage-ignore"]').textContent.trim() === '✕',
      r1.querySelector('[data-act="triage-ignore"]').textContent.trim());
  var r2 = document.querySelector('.expl-row[data-id="e3"]');
  chk('未标记的显示空心星', r2.querySelector('[data-act="triage-star"]').textContent.trim() === '☆');

  section('G 汇总文案');
  renderExplore();
  var sum = document.getElementById('triageSummary').textContent;
  chk('汇总显示关注数', sum.indexOf('已关注 1') !== -1, sum);
  chk('汇总显示忽略数', sum.indexOf('已忽略 1') !== -1, sum);

  section('H 批量标记');
  triage = { starred:{}, ignored:{}, updatedAt:'' };
  jobList = [];
  for (var i=0;i<10;i++) jobList.push(mk({ id:'b'+i, qiuzhiId:'qb'+i, company:'批量'+i }));
  sel.value = ''; renderExplore();
  bulkTriage('ignore');
  chk('批量忽略 10 个', jobList.filter(isIgnored).length === 10, jobList.filter(isIgnored).length);
  // 批量关注应把忽略清掉
  bulkTriage('star');
  chk('批量关注后忽略清零', jobList.filter(isIgnored).length === 0, jobList.filter(isIgnored).length);
  chk('批量关注 10 个', jobList.filter(isStarred).length === 10, jobList.filter(isStarred).length);
  bulkTriage('clearAll');
  chk('批量清除标记', jobList.filter(isStarred).length === 0 && jobList.filter(isIgnored).length === 0);

  section('I 批量只作用于"当前筛选结果"');   // 注意：公司名不能包含被测关键词，否则会真的被搜到
  triage = { starred:{}, ignored:{}, updatedAt:'' };
  jobList = [
    mk({ id:'f1', qiuzhiId:'qf1', company:'匹配关键词' }),
    mk({ id:'f2', qiuzhiId:'qf2', company:'另一家公司' })
  ];
  var search = document.getElementById('exploreSearch');
  search.value = '匹配'; renderExplore();
  bulkTriage('ignore');
  chk('只忽略了筛选命中的那 1 个', jobList.filter(isIgnored).length === 1, jobList.filter(isIgnored).length);
  chk('命中的是「匹配关键词」', isIgnored(jobList[0]), jobList.map(function(j){return j.company+'='+isIgnored(j);}).join(','));
  search.value = '';

  section('J 持久化');
  saveTriage();
  var saved = JSON.parse(localStorage.getItem('qiuzhao_triage') || '{}');
  chk('已写入 localStorage', Object.keys(saved.ignored||{}).length === 1, JSON.stringify(saved.ignored));
  triage = { starred:{}, ignored:{}, updatedAt:'' };
  loadTriage();
  chk('重新加载后标记仍在', jobList.filter(isIgnored).length === 1, jobList.filter(isIgnored).length);

  section('K 不删除任何岗位数据');
  var before = jobList.length;
  bulkTriage('ignore');
  chk('★ 批量忽略后岗位数量不变（只标记不删除）', jobList.length === before, before + ' → ' + jobList.length);

  triage = { starred:{}, ignored:{}, updatedAt:'' }; saveTriage();
  jobList = []; jobs = []; reviews = [];
  document.getElementById('exploreTriage').value = '';
  renderExplore();
  return R;
})();
