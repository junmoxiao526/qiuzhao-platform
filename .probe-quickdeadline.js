// 「快截止」一键筛选（含已截止）
return (async function () {
  var R = []; function chk(n, c, e) { R.push((c ? "PASS" : "FAIL") + " :: " + n + (e !== undefined && !c ? " :: " + e : "")); }
  function section(t) { R.push('-- ' + t + ' --'); }
  function off(n) { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function mk(o) { return sanitizeJob(Object.assign({ id: 'qd' + Math.random().toString(36).slice(2, 7),
    qiuzhiId: 'qqd' + Math.random().toString(36).slice(2, 7), company: '快截止公司', positionRaw: '岗位',
    positionTypes: ['岗位'], cities: ['上海'], batch: '27秋招', openingDate: off(-3),
    addedAt: new Date().toISOString() }, o)); }
  function reset() {
    exploreFilters.deadlineBuckets.clear(); exploreFilters.provinces.clear(); exploreFilters.types.clear();
    exploreFilters.dateFrom = ''; exploreFilters.dateTo = '';
  }
  function rowCount() { return document.querySelectorAll('.explore-table tbody tr').length; }

  // 造数据：覆盖全部 7 档
  jobList = [
    mk({ id: 'o1', company: '已截止甲', deadline: off(-10) }),
    mk({ id: 'o2', company: '已截止乙', deadline: off(-2) }),
    mk({ id: 't1', company: '今天截止', deadline: off(0) }),
    mk({ id: 'a1', company: '一天后截止', deadline: off(1) }),
    mk({ id: 'a2', company: '三天后截止', deadline: off(3) }),
    mk({ id: 'b1', company: '五天后截止', deadline: off(5) }),
    mk({ id: 'b2', company: '七天后截止', deadline: off(7) }),
    mk({ id: 'c1', company: '二十天后截止', deadline: off(20) }),
    mk({ id: 'd1', company: '一百天后截止', deadline: off(100) }),
    mk({ id: 'n1', company: '无截止日期', deadline: '' })
  ];

  section('A 按钮存在且带数量');
  reset(); renderExplore();
  var btn = document.getElementById('btnQuickDeadline');
  chk('按钮存在', !!btn);
  chk('按钮文案含「快截止」', btn.textContent.indexOf('快截止') !== -1, btn.textContent);
  // 一周内(含已截止) = 已截止2 + 今天1 + 1-3天2 + 4-7天2 = 7
  chk('★ 数量为 7（含 2 条已截止）', btn.textContent.indexOf('7') !== -1, btn.textContent);
  chk('未选中时无 active 类', !btn.classList.contains('active'));

  section('B 点击后选中 4 个分档');
  btn.click();
  chk('已截止已选中', exploreFilters.deadlineBuckets.has('overdue'));
  chk('今天截止已选中', exploreFilters.deadlineBuckets.has('today'));
  chk('1-3 天已选中', exploreFilters.deadlineBuckets.has('d3'));
  chk('4-7 天已选中', exploreFilters.deadlineBuckets.has('d7'));
  chk('未选中 8-30 天', !exploreFilters.deadlineBuckets.has('d30'));
  chk('未选中 30 天以上', !exploreFilters.deadlineBuckets.has('far'));
  chk('未选中无截止日期', !exploreFilters.deadlineBuckets.has('none'));

  section('C ★ 核心：已截止的确实显示出来');
  chk('渲染出 7 行', rowCount() === 7, rowCount());
  var txt = document.getElementById('exploreGrid').textContent;
  chk('★ 含「已截止甲」', txt.indexOf('已截止甲') !== -1);
  chk('★ 含「已截止乙」', txt.indexOf('已截止乙') !== -1);
  chk('含今天截止的', txt.indexOf('今天截止') !== -1);
  chk('含 5 天后截止的', txt.indexOf('五天后截止') !== -1);
  chk('不含 20 天后截止的', txt.indexOf('二十天后截止') === -1);
  chk('不含无截止日期的', txt.indexOf('无截止日期') === -1);
  chk('★ 表格里出现「已截止」标签', document.querySelectorAll('.explore-table .dl-over').length === 2,
      document.querySelectorAll('.explore-table .dl-over').length);

  section('D 自动切到临近截止排序，已截止排最前');
  chk('排序已切为 deadline', exploreSort === 'deadline', exploreSort);
  chk('排序按钮为选中态', document.querySelector('.sort-btn[data-sort="deadline"]').classList.contains('active'));
  var firstRowText = document.querySelector('.explore-table tbody tr').textContent;
  chk('★ 第一行是已截止的（最紧急）', firstRowText.indexOf('已截止') !== -1, firstRowText.slice(0, 40));

  section('E 按钮呈选中态');
  chk('有 active 类', btn.classList.contains('active'), btn.className);
  chk('title 提示可取消', btn.title.indexOf('取消') !== -1, btn.title);

  section('F 再点一次取消');
  btn.click();
  chk('★ 分档已全部清空', exploreFilters.deadlineBuckets.size === 0, exploreFilters.deadlineBuckets.size);
  chk('取消后渲染全部 10 行', rowCount() === 10, rowCount());
  chk('取消后无 active 类', !btn.classList.contains('active'));

  section('G 与筛选面板联动');
  toggleQuickDeadline();
  buildFilterPanel();
  var activeTags = document.querySelectorAll('#deadlineTags .deadline-tag.active');
  chk('面板里 4 个标签为选中态', activeTags.length === 4, activeTags.length);
  var activeLabels = Array.prototype.map.call(activeTags, function (t) { return t.textContent.replace(/\d+$/, '').trim(); });
  R.push('INFO :: 面板选中标签 = ' + activeLabels.join(' / '));
  chk('含「已截止」标签', activeLabels.some(function (l) { return l.indexOf('已截止') !== -1; }), activeLabels.join(','));
  // 从面板点掉一个，快截止按钮应自动取消选中
  var overdueTag = Array.prototype.find.call(document.querySelectorAll('#deadlineTags .deadline-tag'),
    function (t) { return t.textContent.indexOf('已截止') !== -1; });
  overdueTag.click();
  chk('★ 手动取消「已截止」后按钮变为未选中', !isQuickDeadlineOn());
  chk('此时不再显示已截止的', document.querySelectorAll('.explore-table .dl-over').length === 0,
      document.querySelectorAll('.explore-table .dl-over').length);

  section('H 筛选计数与清空');
  reset(); toggleQuickDeadline();
  updateFilterCount();
  chk('筛选计数为 4', document.getElementById('filterCount').textContent === '4',
      document.getElementById('filterCount').textContent);
  clearAllFilters();
  chk('★ 清空后快截止也取消', !isQuickDeadlineOn() && exploreFilters.deadlineBuckets.size === 0);
  renderExplore();
  chk('清空后渲染全部', rowCount() === 10, rowCount());

  section('I 数量随数据变化');
  jobList = [ mk({ id: 'x1', deadline: off(-1) }) ];
  reset(); renderExplore();
  chk('只剩 1 条已截止时数量为 1', btn.textContent.indexOf('1') !== -1, btn.textContent);
  jobList = [];
  reset(); renderExplore();
  chk('空列表不报错', btn.textContent.indexOf('快截止') !== -1, btn.textContent);

  jobList = [];
  reset();
  exploreSort = 'updated';
  renderExplore();
  return R;
})();
