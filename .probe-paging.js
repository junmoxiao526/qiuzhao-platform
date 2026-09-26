// 岗位清单分批渲染 + 保存防抖
// 覆盖：首批只渲染 200 行、加载更多、筛选变化重置、数据不丢
return (async function () {
  var R = []; function chk(n, c, e) { R.push((c ? "PASS" : "FAIL") + " :: " + n + (e !== undefined && !c ? " :: " + e : "")); }
  function section(t) { R.push('-- ' + t + ' --'); }
  function rowCount() { return document.querySelectorAll('.explore-table tbody tr').length; }
  function moreBtn() { return document.querySelector('#exploreMore button[data-act="explore-more"]'); }
  function moreHint() { var h = document.querySelector('#exploreMore .explore-more-hint'); return h ? h.textContent.trim() : ''; }
  function reset() {
    exploreFilters.provinces.clear(); exploreFilters.types.clear();
    exploreFilters.dateFrom = ''; exploreFilters.dateTo = '';
    var s = document.getElementById('exploreSearch'); if (s) s.value = '';
    var cb = document.getElementById('exploreUntracked'); if (cb) cb.checked = false;
  }

  section('A 少量数据时不出现加载更多');
  jobList = sanitizeJobList([
    { id: 'p1', qiuzhiId: 'k1', company: '小甲', positionRaw: 'A', positionTypes: ['A'], city: '上海', cities: ['上海'], companyType: '大厂', typeTags: [], openingDate: '2026-09-01', popular: 0 },
    { id: 'p2', qiuzhiId: 'k2', company: '小乙', positionRaw: 'B', positionTypes: ['B'], city: '北京', cities: ['北京'], companyType: '外企', typeTags: [], openingDate: '2026-09-02', popular: 0 }
  ]);
  jobs = [];
  reset(); renderExplore();
  chk('渲染 2 行', rowCount() === 2, rowCount());
  chk('无加载更多按钮', !moreBtn());
  chk('无提示文字', moreHint() === '', moreHint());

  section('B 大批数据只渲染首批 200 行');
  var big = [];
  for (var i = 0; i < 500; i++) {
    big.push({ id: 'b' + i, qiuzhiId: 'bk' + i, company: '批量公司' + i, positionRaw: '岗' + i, positionTypes: ['岗' + i], city: '上海', cities: ['上海'], companyType: '大厂', typeTags: ['互联网'], openingDate: '2026-09-01', popular: 0 });
  }
  jobList = sanitizeJobList(big);
  reset(); renderExplore();
  chk('只渲染 200 行（不是 500）', rowCount() === 200, rowCount());
  chk('出现加载更多按钮', !!moreBtn());
  chk('按钮显示剩余数量', !!moreBtn() && moreBtn().textContent.indexOf('还有 300 条') !== -1, moreBtn() && moreBtn().textContent.trim());
  chk('提示显示已显示/总数', moreHint().indexOf('200 / 500') !== -1, moreHint());
  var gridHtml = document.getElementById('exploreGrid').innerHTML.length;
  R.push('INFO :: 首批 innerHTML = ' + Math.round(gridHtml / 1024) + ' KB');

  section('C 加载更多逐批追加');
  moreBtn().click();
  chk('点击后渲染 400 行', rowCount() === 400, rowCount());
  chk('提示更新为 400 / 500', moreHint().indexOf('400 / 500') !== -1, moreHint());
  chk('仍显示剩余 100 条', !!moreBtn() && moreBtn().textContent.indexOf('还有 100 条') !== -1, moreBtn() && moreBtn().textContent.trim());
  moreBtn().click();
  chk('再点后渲染全部 500 行', rowCount() === 500, rowCount());
  chk('全部显示后按钮消失', !moreBtn());
  chk('提示变为「已显示全部 500 条」', moreHint().indexOf('已显示全部 500 条') !== -1, moreHint());

  section('D 筛选条件变化重置分批进度');
  // 先展开到 500
  chk('当前为全部 500 行', rowCount() === 500, rowCount());
  var s = document.getElementById('exploreSearch');
  s.value = '批量公司1';           // 匹配 批量公司1, 10-19, 100-199 → 111 条
  renderExplore();
  var matched = document.querySelectorAll('.explore-table tbody tr').length;
  R.push('INFO :: 搜索「批量公司1」命中并渲染 ' + matched + ' 行');
  chk('搜索命中数小于 500（证明筛选作用于全量）', matched > 0 && matched < 500, matched);
  s.value = '';
  renderExplore();
  chk('清空搜索后回到首批 200 行', rowCount() === 200, rowCount());

  section('E 筛选后结果少于一批时不显示加载更多');
  s.value = '批量公司7';
  renderExplore();
  var few = document.querySelectorAll('.explore-table tbody tr').length;
  R.push('INFO :: 搜索「批量公司7」命中 ' + few + ' 行');
  chk('命中数正确（7,70-79 → 11 条）', few === 11, few);
  chk('少于一批时不显示按钮', !moreBtn());
  s.value = '';

  section('F 加载更多不影响「当前筛选」计数');
  s.value = ''; renderExplore();
  var beforeVal = null;
  document.querySelectorAll('#exploreStats .stat-card').forEach(function (c) {
    if (c.querySelector('.stat-label').textContent.trim() === '当前筛选') beforeVal = Number(c.querySelector('.stat-value').textContent.trim());
  });
  moreBtn().click();
  var afterVal = null;
  document.querySelectorAll('#exploreStats .stat-card').forEach(function (c) {
    if (c.querySelector('.stat-label').textContent.trim() === '当前筛选') afterVal = Number(c.querySelector('.stat-value').textContent.trim());
  });
  chk('计数不随分批渲染变化（仍为全量公司数 500）', beforeVal === afterVal && afterVal === 500, beforeVal + ' -> ' + afterVal);

  section('G 保存防抖：连续调用只写一次，且数据最终落盘');
  var writes = 0;
  var origSet = lsSet;
  // 用计数器包一层观察真实写入次数
  window.__lsSetCount = 0;
  var origLocalSet = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (k, v) { if (k === 'campus_job_list') window.__lsSetCount++; return origLocalSet(k, v); };
  saveJobList(); saveJobList(); saveJobList();
  chk('防抖期间未立即写入', window.__lsSetCount === 0, window.__lsSetCount);
  await new Promise(function (r) { setTimeout(r, 1100); });
  chk('防抖后写入恰好 1 次', window.__lsSetCount === 1, window.__lsSetCount);
  chk('数据确实已落盘', !!localStorage.getItem('campus_job_list'));
  localStorage.setItem = origLocalSet;

  section('H 立即落盘接口可用（页面关闭前调用）');
  window.__lsSetCount = 0;
  localStorage.setItem = function (k, v) { if (k === 'campus_job_list') window.__lsSetCount++; return origLocalSet(k, v); };
  saveJobList();          // 挂起一个待写
  flushJobListNow();      // 立即补写
  chk('flushJobListNow 立即写入 1 次', window.__lsSetCount === 1, window.__lsSetCount);
  await new Promise(function (r) { setTimeout(r, 1100); });
  chk('挂起的防抖不会重复写入', window.__lsSetCount === 1, window.__lsSetCount);
  localStorage.setItem = origLocalSet;

  reset(); jobList = []; renderExplore();
  return R;
})();
