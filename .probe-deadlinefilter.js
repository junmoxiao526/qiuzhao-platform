// 「截止日期」筛选（快截止筛选）
return (async function () {
  var R = []; function chk(n, c, e) { R.push((c ? "PASS" : "FAIL") + " :: " + n + (e !== undefined && !c ? " :: " + e : "")); }
  function section(t) { R.push('-- ' + t + ' --'); }
  function off(n) { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function mk(o) { return sanitizeJob(Object.assign({ id: 'db' + Math.random().toString(36).slice(2, 7),
    qiuzhiId: 'qdb' + Math.random().toString(36).slice(2, 7), company: '筛选公司', positionRaw: '岗位',
    positionTypes: ['岗位'], cities: ['上海'], batch: '27秋招', openingDate: off(-3),
    addedAt: new Date().toISOString() }, o)); }
  function reset() { exploreFilters.deadlineBuckets.clear(); exploreFilters.provinces.clear(); exploreFilters.types.clear();
    exploreFilters.dateFrom = ''; exploreFilters.dateTo = ''; }

  section('A 分档定义：互不重叠且覆盖全部');
  var allJobs = [
    mk({ id: 'a1', deadline: off(-5) }),    // overdue
    mk({ id: 'a2', deadline: off(0) }),     // today
    mk({ id: 'a3', deadline: off(1) }),     // d3
    mk({ id: 'a4', deadline: off(3) }),     // d3
    mk({ id: 'a5', deadline: off(4) }),     // d7
    mk({ id: 'a6', deadline: off(7) }),     // d7
    mk({ id: 'a7', deadline: off(8) }),     // d30
    mk({ id: 'a8', deadline: off(30) }),    // d30
    mk({ id: 'a9', deadline: off(31) }),    // far
    mk({ id: 'a10', deadline: '' })         // none
  ];
  var buckets = allJobs.map(deadlineBucketOf);
  R.push('INFO :: 各岗位落档 = ' + allJobs.map(function (j, i) { return j.deadline.slice(5) + '→' + buckets[i]; }).join(', '));
  chk('已过 5 天 → overdue', buckets[0] === 'overdue', buckets[0]);
  chk('今天 → today', buckets[1] === 'today', buckets[1]);
  chk('1 天 → d3', buckets[2] === 'd3', buckets[2]);
  chk('3 天 → d3', buckets[3] === 'd3', buckets[3]);
  chk('4 天 → d7', buckets[4] === 'd7', buckets[4]);
  chk('7 天 → d7', buckets[5] === 'd7', buckets[5]);
  chk('8 天 → d30', buckets[6] === 'd30', buckets[6]);
  chk('30 天 → d30', buckets[7] === 'd30', buckets[7]);
  chk('31 天 → far', buckets[8] === 'far', buckets[8]);
  chk('无截止 → none', buckets[9] === 'none', buckets[9]);

  section('B 每条岗位只落一档（互不重叠）');
  var dupCount = 0;
  allJobs.forEach(function (j) {
    var d = daysFromToday(j.deadline);
    var hit = DEADLINE_BUCKETS.filter(function (b) { return b.test(d); });
    if (hit.length !== 1) dupCount++;
  });
  chk('★ 全部岗位命中且仅命中一档', dupCount === 0, dupCount + ' 条异常');

  section('C 覆盖全部（数量之和 = 总数）');
  jobList = allJobs;
  var counts = {};
  jobList.forEach(function (j) { var k = deadlineBucketOf(j); counts[k] = (counts[k] || 0) + 1; });
  var sum = DEADLINE_BUCKETS.reduce(function (a, b) { return a + (counts[b.key] || 0); }, 0);
  R.push('INFO :: 各档数量 = ' + JSON.stringify(counts));
  chk('★ 各档数量之和 = 岗位总数', sum === jobList.length, sum + ' vs ' + jobList.length);

  section('D 单选筛选');
  reset(); renderExplore();
  chk('无筛选 = 10 行', document.querySelectorAll('.explore-table tbody tr').length === 10,
      document.querySelectorAll('.explore-table tbody tr').length);
  exploreFilters.deadlineBuckets.add('today'); renderExplore();
  var rows = document.querySelectorAll('.explore-table tbody tr');
  chk('选「今天截止」= 1 行', rows.length === 1, rows.length);
  chk('筛出的是今天那条', rows[0].textContent.indexOf(off(0).slice(5)) !== -1, rows[0].textContent.slice(0, 40));

  exploreFilters.deadlineBuckets.clear();
  exploreFilters.deadlineBuckets.add('d3'); renderExplore();
  chk('选「1-3 天」= 2 行', document.querySelectorAll('.explore-table tbody tr').length === 2,
      document.querySelectorAll('.explore-table tbody tr').length);

  exploreFilters.deadlineBuckets.clear();
  exploreFilters.deadlineBuckets.add('overdue'); renderExplore();
  chk('选「已截止」= 1 行', document.querySelectorAll('.explore-table tbody tr').length === 1,
      document.querySelectorAll('.explore-table tbody tr').length);

  exploreFilters.deadlineBuckets.clear();
  exploreFilters.deadlineBuckets.add('none'); renderExplore();
  chk('选「无截止日期」= 1 行', document.querySelectorAll('.explore-table tbody tr').length === 1,
      document.querySelectorAll('.explore-table tbody tr').length);

  section('E 多选 = 并集');
  reset();
  exploreFilters.deadlineBuckets.add('overdue');
  exploreFilters.deadlineBuckets.add('today');
  exploreFilters.deadlineBuckets.add('d3');
  renderExplore();
  chk('★ 已截止+今天+1-3天 = 4 行', document.querySelectorAll('.explore-table tbody tr').length === 4,
      document.querySelectorAll('.explore-table tbody tr').length);

  section('F 「快截止」一步到位：今天+3天内');
  reset();
  exploreFilters.deadlineBuckets.add('today');
  exploreFilters.deadlineBuckets.add('d3');
  renderExplore();
  var soon = document.querySelectorAll('.explore-table tbody tr').length;
  chk('★ 今天+1-3天 = 3 行（这就是「快截止」）', soon === 3, soon);
  // 逐行核对：这些行的截止都在 3 天内
  var allWithin3 = true;
  for (var i = 0; i < soon; i++) {
    var id = document.querySelectorAll('.explore-table tbody tr')[i].dataset.id;
    var j = jobList.find(function (x) { return String(x.id) === String(id); });
    var d = daysFromToday(j.deadline);
    if (!(d >= 0 && d <= 3)) allWithin3 = false;
  }
  chk('★ 筛出的每一条都在 3 天内', allWithin3);

  section('G 与其它筛选叠加');
  reset();
  exploreFilters.deadlineBuckets.add('today');
  exploreFilters.deadlineBuckets.add('d3');
  exploreFilters.provinces.add('上海');   // 全部都在上海
  renderExplore();
  chk('叠加同省份筛选仍为 3 行', document.querySelectorAll('.explore-table tbody tr').length === 3,
      document.querySelectorAll('.explore-table tbody tr').length);
  exploreFilters.provinces.clear();
  exploreFilters.provinces.add('北京');   // 没有北京的
  renderExplore();
  chk('叠加不匹配的省份 → 0 行', document.querySelectorAll('.explore-table tbody tr').length === 0,
      document.querySelectorAll('.explore-table tbody tr').length);

  section('H 面板渲染出分档标签与数量');
  reset(); renderExplore();
  buildFilterPanel();
  var tags = document.querySelectorAll('#deadlineTags .deadline-tag');
  chk('渲染 7 个分档', tags.length === 7, tags.length);
  var texts = Array.prototype.map.call(tags, function (t) { return t.textContent.trim(); });
  R.push('INFO :: 分档标签 = ' + texts.join(' | '));
  chk('含「今天截止」', texts.some(function (t) { return t.indexOf('今天截止') !== -1; }));
  chk('含「1-3 天」', texts.some(function (t) { return t.indexOf('1-3 天') !== -1; }));
  chk('含「无截止日期」', texts.some(function (t) { return t.indexOf('无截止日期') !== -1; }));
  chk('★ 每个标签都带数量', Array.prototype.every.call(tags, function (t) { return !!t.querySelector('.dt-n'); }));
  chk('今天截止数量为 1', (function () {
    var t = Array.prototype.find.call(tags, function (x) { return x.textContent.indexOf('今天截止') !== -1; });
    return t.querySelector('.dt-n').textContent === '1';
  })(), texts.join(','));

  section('I 点标签切换筛选');
  var todayTag = Array.prototype.find.call(tags, function (x) { return x.textContent.indexOf('今天截止') !== -1; });
  todayTag.click();
  chk('点击后进入筛选集合', exploreFilters.deadlineBuckets.has('today'));
  chk('点击后渲染出 1 行', document.querySelectorAll('.explore-table tbody tr').length === 1,
      document.querySelectorAll('.explore-table tbody tr').length);
  buildFilterPanel();
  var todayTag2 = Array.prototype.find.call(document.querySelectorAll('#deadlineTags .deadline-tag'),
    function (x) { return x.textContent.indexOf('今天截止') !== -1; });
  chk('再次构建时标签为选中态', todayTag2.classList.contains('active'), todayTag2.className);
  todayTag2.click();
  chk('再点一次取消筛选', !exploreFilters.deadlineBuckets.has('today'));

  section('J 筛选计数与清空');
  reset();
  exploreFilters.deadlineBuckets.add('today');
  exploreFilters.deadlineBuckets.add('d3');
  updateFilterCount();
  chk('筛选计数 = 2', document.getElementById('filterCount').textContent === '2',
      document.getElementById('filterCount').textContent);
  chk('清空按钮出现', document.getElementById('btnClearFilters').style.display !== 'none');
  clearAllFilters();
  chk('清空后筛选集合为空', exploreFilters.deadlineBuckets.size === 0);
  chk('清空后计数隐藏', document.getElementById('filterCount').style.display === 'none' ||
      document.getElementById('filterCount').textContent === '0',
      document.getElementById('filterCount').textContent);

  section('K 无截止日期的岗位不会被误筛进其它档');
  reset();
  jobList = [ mk({ id: 'n1', deadline: '' }), mk({ id: 'n2', deadline: '非法日期' }) ];
  renderExplore();
  chk('无截止的进 none 档', deadlineBucketOf(jobList[0]) === 'none', deadlineBucketOf(jobList[0]));
  chk('非法日期也进 none 档', deadlineBucketOf(jobList[1]) === 'none', deadlineBucketOf(jobList[1]));
  exploreFilters.deadlineBuckets.add('today'); renderExplore();
  chk('★ 选「今天截止」不会把无截止的筛进来', document.querySelectorAll('.explore-table tbody tr').length === 0,
      document.querySelectorAll('.explore-table tbody tr').length);
  exploreFilters.deadlineBuckets.clear();
  exploreFilters.deadlineBuckets.add('far');
  renderExplore();
  chk('★ 选「30天以上」也不会把无截止的筛进来', document.querySelectorAll('.explore-table tbody tr').length === 0,
      document.querySelectorAll('.explore-table tbody tr').length);

  reset();
  jobList = []; renderExplore();
  return R;
})();
