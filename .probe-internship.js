// 批次含「实习」的岗位自动清理
return (async function () {
  var R = []; function chk(n, c, e) { R.push((c ? "PASS" : "FAIL") + " :: " + n + (e !== undefined && !c ? " :: " + e : "")); }
  function section(t) { R.push('-- ' + t + ' --'); }
  function off(n) { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function mk(o) { return sanitizeJob(Object.assign({ id: 'it' + Math.random().toString(36).slice(2, 7),
    qiuzhiId: 'qit' + Math.random().toString(36).slice(2, 7), company: '实习公司', positionRaw: '岗位',
    positionTypes: ['岗位'], cities: ['上海'], openingDate: off(-5), deadline: off(30),
    addedAt: new Date().toISOString() }, o)); }
  function cos() { return jobList.map(function (j) { return j.company; }).sort().join(','); }
  function resetSettings() {
    reminderSettings = Object.assign({}, REMINDER_DEFAULT, { autoCleanExpired: true, autoCleanInternship: true });
  }

  section('A ★ 判定只看「批次」字段，不碰职位名');
  chk('日常实习 → 是实习', isInternshipJob({ batch: '日常实习' }) === true);
  chk('27届实习 → 是实习', isInternshipJob({ batch: '27届实习' }) === true);
  chk('暑期实习 → 是实习', isInternshipJob({ batch: '暑期实习' }) === true);
  chk('寒假实习 → 是实习', isInternshipJob({ batch: '寒假实习' }) === true);
  chk('实习 → 是实习', isInternshipJob({ batch: '实习' }) === true);
  chk('★ 提前批 → 不是实习（不含"实习"二字）', isInternshipJob({ batch: '提前批' }) === false,
      isInternshipJob({ batch: '提前批' }));
  chk('27秋招 → 不是实习', isInternshipJob({ batch: '27秋招' }) === false);
  chk('批次为空 → 不是实习', isInternshipJob({ batch: '' }) === false);
  chk('batch=undefined → 不是实习（不报错）', isInternshipJob({}) === false);
  chk('★ 职位名含实习但批次是秋招 → 不算实习（不会误伤）',
      isInternshipJob({ batch: '27秋招', positionRaw: '实习生、助理实习生' }) === false);
  chk('★ 职位名含实习但批次为空 → 不算实习', isInternshipJob({ batch: '', positionRaw: '实习生' }) === false);

  section('B 清理行为');
  resetSettings();
  jobList = [
    mk({ id: 'a1', company: '日常实习公司', batch: '日常实习' }),
    mk({ id: 'a2', company: '届实习公司', batch: '27届实习' }),
    mk({ id: 'a3', company: '暑期实习公司', batch: '暑期实习' }),
    mk({ id: 'k1', company: '秋招公司', batch: '27秋招' }),
    mk({ id: 'k2', company: '提前批公司', batch: '提前批' }),
    mk({ id: 'k3', company: '空批次公司', batch: '' }),
    mk({ id: 'k4', company: '职位名带实习', batch: '27秋招', positionRaw: '实习生、助理' })
  ];
  var removed = pruneInternshipJobs();
  R.push('INFO :: 剩余 = ' + cos());
  chk('删除 3 条', removed === 3, removed);
  chk('★ 日常实习被删', cos().indexOf('日常实习公司') === -1);
  chk('★ 27届实习被删', cos().indexOf('届实习公司') === -1);
  chk('暑期实习被删', cos().indexOf('暑期实习公司') === -1);
  chk('★★ 提前批必须保留', cos().indexOf('提前批公司') !== -1, cos());
  chk('★ 秋招保留', cos().indexOf('秋招公司') !== -1);
  chk('空批次保留', cos().indexOf('空批次公司') !== -1);
  chk('★ 职位名带实习但批次是秋招的保留（不误伤）', cos().indexOf('职位名带实习') !== -1, cos());
  chk('剩余 4 条', jobList.length === 4, jobList.length);

  section('C 幂等');
  chk('第二次删除 0 条', pruneInternshipJobs() === 0);

  section('D 与已截止清理一起跑');
  resetSettings();
  jobList = [
    mk({ id: 'd1', company: '已截止实习', batch: '日常实习', deadline: off(-3) }),
    mk({ id: 'd2', company: '有效实习', batch: '日常实习', deadline: off(10) }),
    mk({ id: 'd3', company: '已截止秋招', batch: '27秋招', deadline: off(-3) }),
    mk({ id: 'd4', company: '有效秋招', batch: '27秋招', deadline: off(10) }),
    mk({ id: 'd5', company: '今天截止秋招', batch: '27秋招', deadline: off(0) })
  ];
  var res = pruneJobList();
  R.push('INFO :: pruneJobList 结果 = ' + JSON.stringify(res) + '，剩余 = ' + cos());
  // 注意：两条规则依次执行，"已截止的实习"会被第一步先删掉，
  // 所以实习档只统计它自己删掉的那条 —— 各档不重复计数，总数即真实删除数。
  chk('清理已截止 2 条', res.expired === 2, res.expired);
  chk('★ 实习档只算自己删的（已截止的那条已被前一步删掉）', res.internship === 1, res.internship);
  chk('★ 总数不重复计数 = 3', res.total === 3, res.total);
  chk('★ 总数 = 清单实际减少数', res.total === 5 - jobList.length, res.total + ' vs ' + (5 - jobList.length));
  chk('★ 只剩有效秋招 + 今天截止', jobList.length === 2, jobList.length);
  chk('★ 今天截止的保留', cos().indexOf('今天截止秋招') !== -1, cos());
  chk('提示文案拼装正确', pruneSummaryText(res) === '2 个已截止、1 个实习岗位', pruneSummaryText(res));

  section('E 设置开关');
  reminderSettings.autoCleanInternship = false;
  jobList = [ mk({ id: 'e1', company: '实习甲', batch: '日常实习' }), mk({ id: 'e2', company: '秋招乙', batch: '27秋招' }) ];
  var r2 = pruneJobList();
  chk('★ 关掉实习清理后不删实习', r2.internship === 0 && jobList.length === 2, jobList.length);
  reminderSettings.autoCleanInternship = true;
  var r3 = pruneJobList();
  chk('★ 打开后立刻清掉', r3.internship === 1 && jobList.length === 1, jobList.length);

  reminderSettings.autoCleanExpired = false;
  jobList = [ mk({ id: 'e3', company: '已截止', batch: '27秋招', deadline: off(-5) }) ];
  var r4 = pruneJobList();
  chk('★ 关掉已截止清理后不删', r4.expired === 0 && jobList.length === 1, jobList.length);
  reminderSettings.autoCleanExpired = true;

  section('F 落盘');
  reminderSettings.autoCleanInternship = true;
  jobList = [ mk({ id: 'f1', company: '实习丙', batch: '日常实习' }), mk({ id: 'f2', company: '秋招丁', batch: '27秋招' }) ];
  pruneJobList();
  flushJobListNow();
  var stored = lsGet('campus_job_list');
  chk('存储里只剩 1 条', Array.isArray(stored) && stored.length === 1, Array.isArray(stored) ? stored.length : '非数组');
  chk('存储里留的是秋招那条', Array.isArray(stored) && stored[0].batch === '27秋招',
      Array.isArray(stored) ? stored[0].batch : '-');

  section('G 已加入投递管理的岗位被清理后，投递记录不受影响');
  jobs = [ sanitizeJob({ id: 'tk2', company: '实习跟踪', position: '岗位', status: 'applied', applyDate: off(-5), notes: '' }) ];
  jobList = [ mk({ id: 'g1', company: '实习跟踪', batch: '日常实习' }) ];
  pruneJobList();
  chk('清单里已删掉', jobList.length === 0, jobList.length);
  chk('★ 投递记录仍在', jobs.length === 1 && jobs[0].company === '实习跟踪');
  var err = null;
  try { renderTrack(); renderExplore(); buildFilterPanel(); updateFilterCount(); } catch (e) { err = e; }
  chk('渲染不报错', !err, err && err.message);

  section('H 设置弹窗读写');
  resetSettings();
  reminderSettings.autoCleanExpired = false;
  reminderSettings.autoCleanInternship = true;
  openReminderSettings();
  chk('★ 弹窗回显 autoCleanExpired=false', document.getElementById('remCleanExpired').checked === false);
  chk('★ 弹窗回显 autoCleanInternship=true', document.getElementById('remCleanInternship').checked === true);
  document.getElementById('remCleanExpired').checked = true;
  document.getElementById('remCleanInternship').checked = false;
  await saveReminderSettingsFromForm();
  chk('★ 保存后设置更新（已截止=true）', reminderSettings.autoCleanExpired === true, reminderSettings.autoCleanExpired);
  chk('★ 保存后设置更新（实习=false）', reminderSettings.autoCleanInternship === false, reminderSettings.autoCleanInternship);
  reminderSettings = Object.assign({}, REMINDER_DEFAULT);
  saveReminderSettings();

  jobList = []; jobs = []; renderExplore();
  return R;
})();
