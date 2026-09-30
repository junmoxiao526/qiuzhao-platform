// 岗位清单「截止日期」列
return (async function () {
  var R = []; function chk(n, c, e) { R.push((c ? "PASS" : "FAIL") + " :: " + n + (e !== undefined && !c ? " :: " + e : "")); }
  function section(t) { R.push('-- ' + t + ' --'); }
  function off(n) { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function mk(o) { return sanitizeJob(Object.assign({ id: 'dl' + Math.random().toString(36).slice(2, 7),
    qiuzhiId: 'qdl' + Math.random().toString(36).slice(2, 7), company: '截止公司', positionRaw: '岗位',
    positionTypes: ['岗位'], city: '上海', cities: ['上海'], batch: '27秋招', openingDate: off(-5) }, o)); }

  section('A daysFromToday 不依赖提醒设置');
  chk('今天 = 0', daysFromToday(off(0)) === 0, daysFromToday(off(0)));
  chk('明天 = 1', daysFromToday(off(1)) === 1);
  chk('昨天 = -1', daysFromToday(off(-1)) === -1);
  chk('空值 = null', daysFromToday('') === null);
  chk('非法 = null', daysFromToday('2026-99-99') === null);
  // 关键：把提醒设置关掉/改乱，截止日期列仍应正确
  var saved = reminderSettings;
  reminderSettings = { enabled: false, leadDays: 0, followUpDays: 1 };
  chk('★ 关闭提醒设置后仍能算天数', daysFromToday(off(0)) === 0);
  chk('★ 截止日期单元格不读设置', deadlineCell({ deadline: off(0) }).indexOf('今天截止') !== -1);
  reminderSettings = saved;

  section('B 无截止日期显示占位');
  var none = deadlineCell({ deadline: '' });
  chk('显示 -', none.indexOf('expl-dim') !== -1 && none.indexOf('>-<') !== -1, none);
  chk('带说明 title', none.indexOf('没有截止日期') !== -1);
  chk('undefined 也不报错', deadlineCell({}).indexOf('expl-dim') !== -1);

  section('C 紧急度分级');
  var over = deadlineCell({ deadline: off(-3) });
  chk('已过期 → dl-over', over.indexOf('dl-over') !== -1, over);
  chk('已过期文案', over.indexOf('已截止') !== -1, over);
  var today = deadlineCell({ deadline: off(0) });
  chk('今天 → dl-urgent', today.indexOf('dl-urgent') !== -1, today);
  chk('今天文案', today.indexOf('今天截止') !== -1, today);
  var d1 = deadlineCell({ deadline: off(1) });
  chk('还剩1天 → dl-urgent', d1.indexOf('dl-urgent') !== -1, d1);
  chk('还剩1天文案', d1.indexOf('<b>1天</b>') !== -1, d1);
  var d3 = deadlineCell({ deadline: off(3) });
  chk('还剩3天 → dl-urgent', d3.indexOf('dl-urgent') !== -1, d3);
  var d4 = deadlineCell({ deadline: off(4) });
  chk('还剩4天 → dl-soon', d4.indexOf('dl-soon') !== -1 && d4.indexOf('dl-urgent') === -1, d4);
  var d7 = deadlineCell({ deadline: off(7) });
  chk('还剩7天 → dl-soon', d7.indexOf('dl-soon') !== -1, d7);

  section('D 超过一周保持安静（不加紧急度）');
  var d8 = deadlineCell({ deadline: off(8) });
  chk('还剩8天无紧急类', d8.indexOf('dl-urgent') === -1 && d8.indexOf('dl-soon') === -1 && d8.indexOf('dl-over') === -1, d8);
  chk('但仍显示日期', d8.indexOf('expl-deadline') !== -1 && d8.indexOf('<b>') === -1, d8);
  var far = deadlineCell({ deadline: '2027-06-30' });
  chk('远期截止安静显示', far.indexOf('<b>') === -1, far);

  section('E 显示格式是 MM-DD');
  var fmt = deadlineCell({ deadline: '2026-11-24' });
  chk('显示 11-24', fmt.indexOf('11-24') !== -1, fmt);
  chk('title 里有完整日期', fmt.indexOf('2026-11-24') !== -1, fmt);

  section('F 渲染进表格、位置在公司右边');
  jobList = sanitizeJobList([
    { id: 'k1', qiuzhiId: 'qk1', company: '甲公司', positionRaw: 'A', positionTypes: ['A'], cities: ['上海'], batch: '27秋招', openingDate: off(-5), deadline: off(2), addedAt: new Date().toISOString() },
    { id: 'k2', qiuzhiId: 'qk2', company: '乙公司', positionRaw: 'B', positionTypes: ['B'], cities: ['北京'], batch: '27秋招', openingDate: off(-5), deadline: '', addedAt: new Date().toISOString() }
  ]);
  renderExplore();
  var rows = document.querySelectorAll('.explore-table tbody tr');
  chk('渲染 2 行', rows.length === 2, rows.length);

  var ths = document.querySelectorAll('.explore-table thead th');
  var headTexts = Array.prototype.map.call(ths, function (t) { return t.textContent.trim(); });
  R.push('INFO :: 表头 = ' + headTexts.join(' | '));
  var coIdx = headTexts.indexOf('公司');
  var dlIdx = headTexts.indexOf('截止日期');
  chk('表头有「公司」列', coIdx !== -1, coIdx);
  chk('表头有「截止日期」列', dlIdx !== -1, dlIdx);
  chk('★ 截止日期紧挨在公司右边', dlIdx === coIdx + 1, '公司@' + coIdx + ' 截止@' + dlIdx);

  // 按公司名定位，不要依赖行序（列表按"最近更新"排序，两行时间戳相同，顺序不保证）
  var rowA = Array.prototype.find.call(rows, function (r) { return r.textContent.indexOf('甲公司') !== -1; });
  var rowB = Array.prototype.find.call(rows, function (r) { return r.textContent.indexOf('乙公司') !== -1; });
  chk('找到甲公司那行', !!rowA);
  chk('找到乙公司那行', !!rowB);
  var aCells = Array.prototype.map.call(rowA.children, function (c) { return c.textContent.trim(); });
  R.push('INFO :: 甲公司行 = ' + aCells.join(' | '));
  chk('甲公司（有截止）显示天数提示', aCells[dlIdx].indexOf('2天') !== -1, aCells[dlIdx]);
  chk('甲公司行单元格数与表头一致', rowA.children.length === ths.length, rowA.children.length + ' vs ' + ths.length);
  var bCells = Array.prototype.map.call(rowB.children, function (c) { return c.textContent.trim(); });
  chk('乙公司（无截止）显示 -', bCells[dlIdx] === '-', JSON.stringify(bCells[dlIdx]));
  chk('两行截止列内容不同，证明取自各自数据', aCells[dlIdx] !== bCells[dlIdx]);

  section('G 局部更新时新列也在');
  // 改状态走局部更新路径，重渲染后的行必须仍然包含截止日期列
  renderExplore();
  var needFull = updateExploreRowsFor(['k1']);
  var row0 = document.querySelector('.expl-row[data-id="k1"]');
  chk('局部更新后找到该行', !!row0);
  chk('局部更新后截止日期列仍在', row0.children.length === ths.length, row0.children.length + ' vs ' + ths.length);
  chk('局部更新后截止内容正确', row0.children[dlIdx].textContent.indexOf('2天') !== -1,
      row0.children[dlIdx].textContent.trim());

  section('H 安全：deadline 来自 API，需转义');
  var evil = deadlineCell({ deadline: '"><img src=x onerror=alert(1)>' });
  chk('★ 非法日期不会注入标签', evil.indexOf('<img') === -1, evil);
  var evil2 = deadlineCell({ deadline: '2026-12-31"><script>x</script>' });
  chk('★ 带引号的值不破坏属性', evil2.indexOf('<script') === -1, evil2);

  jobList = []; renderExplore();
  return R;
})();
