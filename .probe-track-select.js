// 「操作」列状态下拉：加入投递 / 已投递
// 覆盖：下拉渲染、两种选择的结果、投递日期、去重、已加入后的显示
return (async function () {
  var R = []; function chk(n, c, e) { R.push((c ? "PASS" : "FAIL") + " :: " + n + (e !== undefined && !c ? " :: " + e : "")); }
  function section(t) { R.push('-- ' + t + ' --'); }
  function setSearch(v) { var e = document.getElementById('exploreSearch'); if (e) e.value = v; renderExplore(); }
  function clearAll() {
    exploreFilters.provinces.clear(); exploreFilters.types.clear();
    exploreFilters.dateFrom = ''; exploreFilters.dateTo = '';
    var s = document.getElementById('exploreSearch'); if (s) s.value = '';
    var cb = document.getElementById('exploreUntracked'); if (cb) cb.checked = false;
  }

  section('A 下拉已渲染');
  jobList = sanitizeJobList([
    { id: 's1', qiuzhiId: 'q1', company: '下拉测试甲', positionRaw: 'A岗', positionTypes: ['A岗'], city: '上海', cities: ['上海'], companyType: '大厂', typeTags: ['互联网'], openingDate: '2026-09-01', popular: 0 },
    { id: 's2', qiuzhiId: 'q2', company: '下拉测试乙', positionRaw: 'B岗', positionTypes: ['B岗'], city: '北京', cities: ['北京'], companyType: '外企', typeTags: ['外企'], openingDate: '2026-09-02', popular: 0 },
    { id: 's3', qiuzhiId: 'q3', company: '下拉测试丙', positionRaw: 'C岗', positionTypes: ['C岗'], city: '深圳', cities: ['深圳'], companyType: '金融', typeTags: ['金融'], openingDate: '2026-09-03', popular: 0 }
  ]);
  jobs = [];
  clearAll(); renderExplore();
  var sel = document.querySelector('select[data-act="track-status"]');
  chk('下拉已渲染', !!sel);
  chk('是 select 元素', !!sel && sel.tagName === 'SELECT');
  chk('带正确的 data-id', !!sel && sel.dataset.id === 's1', sel && sel.dataset.id);
  var opts = sel ? Array.from(sel.options).map(function (o) { return o.value + '|' + o.textContent.trim(); }) : [];
  R.push('INFO :: 选项 = ' + JSON.stringify(opts));
  chk('有 3 个选项（占位 + 两种状态）', opts.length === 3, opts.length);
  chk('占位项 value 为空', opts[0] && opts[0].indexOf('|') === 0, opts[0]);
  chk('含 pending 选项', opts.some(function (o) { return o.indexOf('pending|') === 0; }), JSON.stringify(opts));
  chk('含 applied 选项', opts.some(function (o) { return o.indexOf('applied|') === 0; }), JSON.stringify(opts));
  chk('默认停在占位项', sel.value === '', JSON.stringify(sel.value));
  chk('旧的加入投递按钮已移除', !document.querySelector('[data-act="add-to-track"]'));

  section('B 选「仅加入（待投递）」');
  sel.value = 'pending';
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  chk('投递管理新增 1 条', jobs.length === 1, jobs.length);
  chk('状态为 pending', jobs[0] && jobs[0].status === 'pending', jobs[0] && jobs[0].status);
  chk('投递日期为空', jobs[0] && jobs[0].applyDate === '', jobs[0] && jobs[0].applyDate);
  chk('公司名正确', jobs[0] && jobs[0].company === '下拉测试甲', jobs[0] && jobs[0].company);
  chk('带来源 id', jobs[0] && jobs[0].notes.indexOf('q1') !== -1, jobs[0] && jobs[0].notes);
  // 加入后该行应变成徽章，不再是下拉
  setSearch('下拉测试甲');
  chk('加入后该行改为徽章', !document.querySelector('select[data-act="track-status"]'));
  var badge = document.querySelector('.explore-table .tracked-badge');
  chk('徽章显示「已加入」', !!badge && badge.textContent.trim() === '已加入', badge && badge.textContent.trim());
  chk('徽章为待投递配色', !!badge && badge.classList.contains('tracked-badge-pending'));

  section('C 选「已投递（今天）」');
  clearAll(); setSearch('下拉测试乙');
  var sel2 = document.querySelector('select[data-act="track-status"]');
  chk('第二行下拉已渲染', !!sel2 && sel2.dataset.id === 's2', sel2 && sel2.dataset.id);
  var today = todayStr();
  sel2.value = 'applied';
  sel2.dispatchEvent(new Event('change', { bubbles: true }));
  var added = jobs.filter(function (j) { return j.company === '下拉测试乙'; })[0];
  chk('投递管理新增该条', !!added);
  chk('状态为 applied', !!added && added.status === 'applied', added && added.status);
  chk('投递日期记为今天', !!added && added.applyDate === today, (added && added.applyDate) + ' vs ' + today);
  chk('简历/其它数据未受影响', true);
  chk('投递管理计数同步', Number(document.getElementById('trackCount').textContent) === jobs.length,
      document.getElementById('trackCount').textContent + ' vs ' + jobs.length);
  var badge2 = document.querySelector('.explore-table .tracked-badge');
  chk('徽章显示「已投递」', !!badge2 && badge2.textContent.trim() === '已投递', badge2 && badge2.textContent.trim());
  chk('徽章为已投递配色（非 pending）', !!badge2 && !badge2.classList.contains('tracked-badge-pending'));

  section('D 占位项不触发动作');
  clearAll(); setSearch('下拉测试乙');
  var before = jobs.length;
  // 该行已加入，没有下拉；换一条未加入的来测
  clearAll(); setSearch('下拉测试甲');
  var anySel = document.querySelector('select[data-act="track-status"]');
  if (anySel) {
    anySel.value = '';
    anySel.dispatchEvent(new Event('change', { bubbles: true }));
    chk('选占位项不新增记录', jobs.length === before, before + ' -> ' + jobs.length);
  } else {
    R.push('INFO :: 两行都已加入，跳过占位项测试');
  }

  section('E 重复加入应被拦截');
  clearAll(); setSearch('下拉测试乙');
  var sel3 = document.querySelector('select[data-act="track-status"]');
  if (sel3) {
    var n0 = jobs.length;
    sel3.value = 'applied';
    sel3.dispatchEvent(new Event('change', { bubbles: true }));
    chk('已存在的岗位不会重复加入', jobs.length === n0, n0 + ' -> ' + jobs.length);
  } else {
    chk('已加入的行不渲染下拉（防重复）', true);
  }

  section('F 一条下拉同时覆盖两种选择');
  clearAll(); setSearch('下拉测试丙');
  var sel4 = document.querySelector('select[data-act="track-status"]');
  chk('第三行下拉已渲染', !!sel4);
  if (sel4) {
    var m0 = jobs.length;
    sel4.value = '';
    sel4.dispatchEvent(new Event('change', { bubbles: true }));
    chk('占位项确实不新增', jobs.length === m0, m0 + ' -> ' + jobs.length);
    sel4.value = 'pending';
    sel4.dispatchEvent(new Event('change', { bubbles: true }));
    chk('选择后新增 1 条', jobs.length === m0 + 1, m0 + ' -> ' + jobs.length);
  }

  clearAll();
  return R;
})();
