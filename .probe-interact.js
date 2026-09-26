// 交互性能剖析：逐一点击各功能，量每个动作的主线程耗时与长任务
return (async function () {
  var R = [];
  function line(s) { R.push(s); }
  function chk(n, c, e) { R.push((c ? "PASS" : "FAIL") + " :: " + n + (e !== undefined && !c ? " :: " + e : "")); }
  function ms(t) { return Math.round((performance.now() - t) * 10) / 10; }

  // 灌入真实数据规模
  await syncQiuzhiFangzhou();
  var sm = document.getElementById('syncResultModal'); if (sm) sm.style.display = 'none';
  line('INFO :: jobList=' + jobList.length + ' jobs=' + jobs.length);

  // 为了测「投递管理」有内容的开销，造一些投递记录
  if (jobs.length < 30) {
    for (var k = 0; k < 30; k++) {
      jobs.push(sanitizeJob({
        id: 'perfjob' + k, company: '性能测试公司' + k, position: '岗位' + k,
        status: (k % 5 === 0) ? 'applied' : 'pending', city: '上海',
        applyDate: '2026-09-0' + ((k % 9) + 1), deadline: '2026-11-0' + ((k % 9) + 1),
        notes: JSON.stringify({ qiuzhiId: 'perf' + k })
      }));
    }
    line('INFO :: 补造 30 条投递记录用于测量');
  }

  // 长任务观察器
  var longTasks = [];
  try {
    if (window.PerformanceObserver && PerformanceObserver.supportedEntryTypes.indexOf('longtask') !== -1) {
      var po = new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (e) { longTasks.push(Math.round(e.duration)); });
      });
      po.observe({ entryTypes: ['longtask'] });
    }
  } catch (e) {}

  // 给渲染函数打点
  var timings = {};
  var origs = {};
  ['renderExplore', 'renderTrack', 'renderReviews', 'renderResume', 'renderAiRecommend', 'renderTrackStats', 'renderPoolStatus'].forEach(function (name) {
    if (typeof window[name] !== 'function') return;
    origs[name] = window[name];
    window[name] = function () {
      var t0 = performance.now();
      var r = origs[name].apply(this, arguments);
      var d = performance.now() - t0;
      var key = name + '(' + arguments.length + ')';
      if (!timings[key]) timings[key] = { n: 0, total: 0, max: 0 };
      timings[key].n++; timings[key].total += d; if (d > timings[key].max) timings[key].max = d;
      return r;
    };
  });

  function measure(label, fn) {
    var t0 = performance.now();
    try { fn(); } catch (e) { line('INFO :: ' + label + ' 抛错 ' + e.message); return 0; }
    var d = performance.now() - t0;
    line('INFO :: ' + label + ' = ' + Math.round(d * 10) / 10 + ' ms');
    return d;
  }

  line('-- A 切换各个 Tab（真实点击） --');
  var tabs = [
    ['投递管理', function () { switchTab('track'); }],
    ['简历管理', function () { switchTab('resume'); }],
    ['复盘', function () { switchTab('review'); }],
    ['AI 推荐', function () { switchTab('aiRecommend'); }],
    ['岗位清单', function () { switchTab('explore'); }]
  ];
  var tabCost = {};
  tabs.forEach(function (t) { tabCost[t[0]] = measure('切到「' + t[0] + '」', t[1]); });

  line('-- B 投递管理内部视图切换 --');
  switchTab('track');
  measure('看板视图 renderTrack', function () { trackView = 'board'; renderTrack(); });
  measure('列表视图 renderTrack', function () { trackView = 'list'; renderTrack(); });
  trackView = 'board'; renderTrack();

  line('-- C 岗位清单常用交互 --');
  switchTab('explore');
  measure('搜索输入一次（含防抖渲染）', function () {
    var s = document.getElementById('exploreSearch'); s.value = '科技'; renderExplore(); s.value = '';
  });
  measure('打开筛选面板', function () { toggleFilterPanel(); });
  measure('勾选一个省份', function () { exploreFilters.provinces.add('广东'); renderExplore(); });
  measure('取消省份筛选', function () { exploreFilters.provinces.clear(); renderExplore(); });
  measure('排序切换（最新开放）', function () { exploreSort = 'opened'; renderExplore(); exploreSort = 'updated'; renderExplore(); });
  measure('点击一行打开详情', function () {
    var row = document.querySelector('[data-act="open-explore"]');
    if (row) row.click();
    var m = document.getElementById('detailModal'); if (m) m.style.display = 'none';
  });
  measure('点「加载更多」', function () {
    var btn = document.querySelector('#exploreMore button[data-act="explore-more"]');
    if (btn) btn.click(); else line('INFO ::   （无加载更多按钮，跳过分批开销测量）');
  });

  line('-- D 星图（若可用） --');
  // 包一层 rAF，统计"应用自身"是否还在排队下一帧（排除测量代码自己的循环）
  var appRafCount = 0;
  var origRaf = window.requestAnimationFrame;
  window.requestAnimationFrame = function (cb) { appRafCount++; return origRaf.call(window, cb); };
  measure('切到星图视图', function () { setTrackView('star'); });
  var rafInStar = 0;
  await new Promise(function (resolve) {
    var start = performance.now();
    function loop() { rafInStar++; if (performance.now() - start < 600) origRaf.call(window, loop); else resolve(); }
    origRaf.call(window, loop);
  });
  line('INFO :: 星图视图下，应用自身 600ms 内排了 ' + appRafCount + ' 帧（动画应在跑）');
  chk('星图在运行时确实在排帧', appRafCount > 5, appRafCount);

  appRafCount = 0;
  measure('切回看板视图', function () { setTrackView('board'); });
  await new Promise(function (resolve) { origRaf.call(window, function () { origRaf.call(window, resolve); }); });
  appRafCount = 0;                       // 清掉切换过程中的残留
  await new Promise(function (resolve) {
    var start = performance.now();
    function loop() { if (performance.now() - start < 700) origRaf.call(window, loop); else resolve(); }
    origRaf.call(window, loop);
  });
  line('INFO :: 离开星图后，应用自身 700ms 内排了 ' + appRafCount + ' 帧（应为 0）');
  chk('★ 离开星图后动画循环已停止（不再排帧）', appRafCount === 0, appRafCount);
  chk('★ starAnimId 已清空', starAnimId === null || starAnimId === undefined, String(starAnimId));
  window.requestAnimationFrame = origRaf;

  line('-- E 渲染函数被调用的次数与耗时 --');
  Object.keys(timings).sort(function (a, b) { return timings[b].total - timings[a].total; }).forEach(function (k) {
    var t = timings[k];
    line('INFO :: ' + k + ' 调用 ' + t.n + ' 次，合计 ' + Math.round(t.total) + 'ms，单次最大 ' + Math.round(t.max) + 'ms');
  });

  line('-- F 主线程长任务 --');
  if (longTasks.length) {
    longTasks.sort(function (a, b) { return b - a; });
    line('INFO :: 检测到 ' + longTasks.length + ' 个长任务(>50ms)，最长几个: ' + longTasks.slice(0, 8).join(', ') + ' ms');
  } else {
    line('INFO :: 未检测到 >50ms 的长任务' + (window.PerformanceObserver ? '' : '（浏览器不支持 longtask）'));
  }

  // 还原
  Object.keys(origs).forEach(function (n) { window[n] = origs[n]; });
  return R;
})();
