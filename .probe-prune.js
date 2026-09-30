// 已截止岗位自动清理
return (async function () {
  var R = []; function chk(n, c, e) { R.push((c ? "PASS" : "FAIL") + " :: " + n + (e !== undefined && !c ? " :: " + e : "")); }
  function section(t) { R.push('-- ' + t + ' --'); }
  function off(n) { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function mk(o) { return sanitizeJob(Object.assign({ id: 'pe' + Math.random().toString(36).slice(2, 7),
    qiuzhiId: 'qpe' + Math.random().toString(36).slice(2, 7), company: '清理公司', positionRaw: '岗位',
    positionTypes: ['岗位'], cities: ['上海'], batch: '27秋招', openingDate: off(-10),
    addedAt: new Date().toISOString() }, o)); }
  function names() { return jobList.map(function (j) { return j.company; }).sort().join(','); }

  section('A ★ 边界：只删严格早于今天的');
  jobList = [
    mk({ id: 'a', company: '昨天截止', deadline: off(-1) }),
    mk({ id: 'b', company: '十天前截止', deadline: off(-10) }),
    mk({ id: 'c', company: '今天截止', deadline: off(0) }),
    mk({ id: 'd', company: '明天截止', deadline: off(1) }),
    mk({ id: 'e', company: '无截止日期', deadline: '' }),
    mk({ id: 'f', company: '日期不合法', deadline: '待定' })
  ];
  var removed = pruneExpiredJobs();
  R.push('INFO :: 剩余 = ' + names());
  chk('删除 2 条', removed === 2, removed);
  chk('★ 昨天截止的被删', names().indexOf('昨天截止') === -1);
  chk('★ 十天前截止的被删', names().indexOf('十天前截止') === -1);
  chk('★★ 今天截止的必须保留', names().indexOf('今天截止') !== -1, names());
  chk('明天截止的保留', names().indexOf('明天截止') !== -1);
  chk('★ 无截止日期的保留（判断不了就不删）', names().indexOf('无截止日期') !== -1, names());
  chk('★ 日期不合法的保留', names().indexOf('日期不合法') !== -1, names());
  chk('剩余 4 条', jobList.length === 4, jobList.length);

  section('B 幂等：再跑一次不再变化');
  chk('第二次删除 0 条', pruneExpiredJobs() === 0);
  chk('数量不变', jobList.length === 4, jobList.length);

  section('C 全部已截止 → 清空');
  jobList = [ mk({ id: 'z1', deadline: off(-1) }), mk({ id: 'z2', deadline: off(-5) }) ];
  chk('删除 2 条', pruneExpiredJobs() === 2);
  chk('清单为空', jobList.length === 0, jobList.length);

  section('D 全部有效 → 一条不删');
  jobList = [ mk({ id: 'v1', deadline: off(0) }), mk({ id: 'v2', deadline: off(30) }), mk({ id: 'v3', deadline: '' }) ];
  chk('★ 不误删', pruneExpiredJobs() === 0 && jobList.length === 3, jobList.length);

  section('E 清理结果已落盘（重载后不会回来）');
  jobList = [ mk({ id: 'p1', deadline: off(-3) }), mk({ id: 'p2', deadline: off(5) }) ];
  pruneExpiredJobs();
  flushJobListNow();   // 岗位清单是防抖写入，测试里手动落盘
  var stored = lsGet('campus_job_list');
  chk('存储里只剩 1 条', Array.isArray(stored) && stored.length === 1, Array.isArray(stored) ? stored.length : '非数组');
  chk('存储里保留的是未截止的那条', Array.isArray(stored) && stored[0].deadline === off(5),
      Array.isArray(stored) ? stored[0].deadline : '-');

  section('F 与去重、筛选的协作');
  // 同一公司同岗位同批次的两条，其中一条已截止 → 应该先合并再清理，不残留
  jobList = [
    mk({ qiuzhiId: 'dup1', company: '重复公司', positionRaw: 'X', batch: '27秋招', deadline: off(-2) }),
    mk({ qiuzhiId: 'dup2', company: '重复公司', positionRaw: 'X', batch: '27秋招', deadline: off(5) })
  ];
  dedupeJobList();               // 合并成 1 条（保留公告更新/信息更全的）
  pruneExpiredJobs();            // 再清理
  R.push('INFO :: 去重+清理后 = ' + jobList.length + ' 条，deadline=' + (jobList[0] && jobList[0].deadline));
  chk('最终不残留已截止的记录', jobList.length <= 1 &&
      jobList.every(function (j) { return daysFromToday(j.deadline) >= 0; }), jobList.length);

  section('G 清理后筛选面板/统计不报错');
  jobList = [ mk({ id: 'g1', deadline: off(-1) }), mk({ id: 'g2', deadline: off(3) }), mk({ id: 'g3', deadline: '' }) ];
  pruneExpiredJobs();
  var err = null;
  try { renderExplore(); buildFilterPanel(); updateFilterCount(); } catch (e) { err = e; }
  chk('渲染与面板构建不抛错', !err, err && err.message);
  chk('已截止分档归零', (function () {
    var n = 0; jobList.forEach(function (j) { if (deadlineBucketOf(j) === 'overdue') n++; }); return n === 0;
  })());
  var btn = document.getElementById('btnQuickDeadline');
  chk('快截止按钮数量已更新（只剩 3 天那条）', btn.textContent.indexOf('1') !== -1, btn.textContent);

  section('H 已加入投递管理的岗位被清理后，投递记录不受影响');
  jobs = [ sanitizeJob({ id: 'tk1', company: '跟踪公司', position: '岗位', status: 'applied', applyDate: off(-20), notes: '' }) ];
  jobList = [ sanitizeJobList([{ id: 'lk1', qiuzhiId: 'qlk1', company: '跟踪公司', positionRaw: '岗位',
    positionTypes: ['岗位'], cities: ['上海'], deadline: off(-1), openingDate: off(-30) }])[0] ];
  pruneExpiredJobs();
  chk('清单里已删掉', jobList.length === 0, jobList.length);
  chk('★ 投递记录仍在', jobs.length === 1, jobs.length);
  chk('★ 投递记录内容完好', jobs[0].company === '跟踪公司' && jobs[0].status === 'applied');
  var err2 = null;
  try { renderTrack(); openCompanyTimeline('跟踪公司'); closeTimeline(); } catch (e) { err2 = e; }
  chk('投递看板与公司时间线不报错', !err2, err2 && err2.message);

  jobList = []; jobs = []; exploreFilters.deadlineBuckets.clear();
  renderExplore();
  return R;
})();
