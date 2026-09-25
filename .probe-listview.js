// 列表视图排版回归：用截图里的真实数据断言
// 关键判据：状态徽章与日期不换行、操作按钮并排、岗位/城市按 2 行截断
var R = [];
function chk(n, c, e) { R.push((c ? 'PASS' : 'FAIL') + ' :: ' + n + (e !== undefined && !c ? ' :: ' + e : '')); }

// 截图中的 5 条真实数据
var rows = [
  { id: 'r1', company: '斯凯孚',   position: '产品设计工程师、产品制程工程师、质量管理', companyType: '外企',   city: '上海 / 北京 / 大连 / 绍兴 / 宁波 / 南京 / 苏州 / 芜湖 / 成都 / 贵阳', status: 'applied',  applyDate: '2026-09-24', deadline: '2026-11-20' },
  { id: 'r2', company: '农夫山泉', position: '人力',                                   companyType: '大厂',   city: '全国', status: 'applied',  applyDate: '2026-09-24', deadline: '' },
  { id: 'r3', company: '华虹集团', position: '软件研发类 / 硬件工程类 / 产品类',        companyType: '国央企', city: '上海', status: 'exam',     applyDate: '2026-09-24', deadline: '' },
  { id: 'r4', company: '杭州锦江集团', position: '化工类、仪器仪表类、自动化类',        companyType: '民营',   city: '全国 / 海外', status: 'applied', applyDate: '2026-09-21', deadline: '2026-11-20' },
  { id: 'r5', company: '当纳利亚洲', position: '供应商质量管理培训生、技术支持',        companyType: '外企',   city: '北京 / 上海 / 昆山 / 南安 / 安阳 / 广州 / 深圳 / 东莞 / 成都 / 海外', status: 'applied', applyDate: '2026-09-17', deadline: '2026-11-15' }
];
rows.forEach(function (r) { jobs.push(sanitizeJob(r)); });

setTrackView('list');
renderTrack();

var table = document.querySelector('.list-table');
chk('列表表格已渲染', !!table);
if (!table) { return R; }

// 1) 状态徽章：高度应约等于一行文字（不换行会被压成两行高度）
var badges = table.querySelectorAll('.status-badge');
chk('状态徽章数量正确', badges.length === 5, 'n=' + badges.length);
var badgeIssues = [];
badges.forEach(function (b, i) {
  var cs = getComputedStyle(b);
  var rect = b.getBoundingClientRect();
  // 单行：高度 < 26px（padding 3px*2 + 11px 字号 * 1.6 行高 ≈ 23-24px）
  if (rect.height > 28) badgeIssues.push('#' + i + ' h=' + Math.round(rect.height));
  if (cs.whiteSpace !== 'nowrap') badgeIssues.push('#' + i + ' ws=' + cs.whiteSpace);
  if (cs.display !== 'inline-block') badgeIssues.push('#' + i + ' display=' + cs.display);
});
chk('状态徽章单行显示', badgeIssues.length === 0, badgeIssues.join(', '));
chk('状态徽章文本完整', badges[0] && badges[0].textContent.trim() === '已投递', badges[0] && badges[0].textContent.trim());

// 2) 日期列：不得断行
var dateCells = table.querySelectorAll('.col-date');
var dateIssues = [];
dateCells.forEach(function (td) {
  var t = td.textContent.trim();
  if (t === '-') return;
  var rect = td.getBoundingClientRect();
  var cs = getComputedStyle(td);
  if (cs.whiteSpace !== 'nowrap') dateIssues.push(t + ' ws=' + cs.whiteSpace);
  if (rect.height > 30) dateIssues.push(t + ' h=' + Math.round(rect.height));
});
chk('日期单元不换行', dateIssues.length === 0, dateIssues.join(', '));

// 3) 操作列：两个按钮必须在同一行
var actionWraps = table.querySelectorAll('.row-actions');
chk('操作列容器数量正确', actionWraps.length === 5, 'n=' + actionWraps.length);
var btnIssues = [];
actionWraps.forEach(function (w, i) {
  var btns = w.querySelectorAll('.btn');
  if (btns.length !== 2) { btnIssues.push('#' + i + ' 按钮数=' + btns.length); return; }
  var a = btns[0].getBoundingClientRect();
  var b = btns[1].getBoundingClientRect();
  // 允许 2px 误差；同一行要求垂直中心接近且水平不重叠
  if (Math.abs(a.top - b.top) > 2) btnIssues.push('#' + i + ' 不同行 top=' + Math.round(a.top) + '/' + Math.round(b.top));
  if (b.left < a.right - 1) btnIssues.push('#' + i + ' 重叠');
  if (getComputedStyle(w).display !== 'flex') btnIssues.push('#' + i + ' display=' + getComputedStyle(w).display);
});
chk('操作按钮并排一行', btnIssues.length === 0, btnIssues.join(', '));

// 4) 长文本列按 2 行截断，不应把行撑得过高
var clamped = table.querySelectorAll('.clamp-2');
chk('长文本列已启用截断', clamped.length === 10, 'n=' + clamped.length);
var clampIssues = [];
clamped.forEach(function (c, i) {
  var cs = getComputedStyle(c);
  if (cs.webkitLineClamp !== '2') clampIssues.push('#' + i + ' clamp=' + cs.webkitLineClamp);
  if (cs.overflow !== 'hidden') clampIssues.push('#' + i + ' overflow=' + cs.overflow);
});
chk('截断样式生效', clampIssues.length === 0, clampIssues.join(', '));
// 最长的城市字段应被截断（scrollWidth <= clientWidth 或高度受限）
var lastCity = table.querySelectorAll('.col-city .clamp-2')[4];
if (lastCity) {
  var ch = lastCity.getBoundingClientRect().height;
  chk('超长城市未撑高行', ch <= 44, 'h=' + Math.round(ch));
}

// 5) 表格布局为 fixed（保证列宽按我们的分配执行）
chk('表格使用 fixed 布局', getComputedStyle(table).tableLayout === 'fixed', getComputedStyle(table).tableLayout);

// 5b) 窄屏不撑宽页面：表格应在滚动容器内横向滚动
var scrollWrap = document.querySelector('.list-scroll');
chk('存在横向滚动容器', !!scrollWrap);
if (scrollWrap) {
  chk('滚动容器 overflow-x 为 auto/scroll', /auto|scroll/.test(getComputedStyle(scrollWrap).overflowX), getComputedStyle(scrollWrap).overflowX);
  var docW = document.documentElement.scrollWidth;
  var winW = window.innerWidth;
  chk('页面未出现横向溢出', docW <= winW + 2, 'doc=' + docW + ' win=' + winW);
  var tblW = Math.round(table.getBoundingClientRect().width);
  var wrapW = Math.round(scrollWrap.getBoundingClientRect().width);
  chk('窄屏时表格宽于容器（触发内部滚动）', winW >= 1020 || tblW >= wrapW - 2, 'table=' + tblW + ' wrap=' + wrapW);
}

// 6) 行高均匀（不应有个别行被内容撑高太多）
var rowHeights = Array.prototype.map.call(table.querySelectorAll('tbody tr'), function (tr) {
  return Math.round(tr.getBoundingClientRect().height);
});
chk('行高记录', true, 'heights=' + rowHeights.join(','));
var maxH = Math.max.apply(null, rowHeights);
chk('最高行不超过 90px', maxH <= 90, 'max=' + maxH);

return R;
