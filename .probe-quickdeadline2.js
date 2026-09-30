return (async function () {
  var R=[]; function chk(n,c,e){ R.push((c?"PASS":"FAIL")+" :: "+n+(e!==undefined&&!c?" :: "+e:"")); }
  function section(t){ R.push('-- '+t+' --'); }
  function ms(t){ return Math.round((performance.now()-t)*10)/10; }

  await syncQiuzhiFangzhou();
  var m=document.getElementById('syncResultModal'); if(m)m.style.display='none';
  R.push('INFO :: 真实岗位 = ' + jobList.length);

  section('A 快截止数量（真实数据）');
  var btn = document.getElementById('btnQuickDeadline');
  R.push('INFO :: 按钮 = ' + btn.textContent.trim());
  R.push('INFO :: title = ' + btn.title);
  var expect = 0;
  jobList.forEach(function(j){ if(QUICK_DEADLINE_BUCKETS.indexOf(deadlineBucketOf(j))!==-1) expect++; });
  chk('★ 按钮数量与实际一致（' + expect + '）', btn.textContent.indexOf(String(expect)) !== -1, btn.textContent);

  section('B 点击后已截止的一定在结果里');
  exploreFilters.deadlineBuckets.clear();
  toggleQuickDeadline();
  var rows = document.querySelectorAll('.explore-table tbody tr');
  var overRows = document.querySelectorAll('.explore-table .dl-over').length;
  R.push('INFO :: 渲染 ' + rows.length + ' 行，其中已截止 ' + overRows + ' 个');
  chk('★ 结果里有已截止的', overRows > 0, overRows);
  chk('行数 = 快截止总数（' + expect + '）或首批 200', rows.length === Math.min(200, expect),
      rows.length + ' vs ' + Math.min(200, expect));
  chk('★ 第一行就是已截止的', document.querySelector('.explore-table tbody tr').textContent.indexOf('已截止') !== -1,
      document.querySelector('.explore-table tbody tr').textContent.slice(0,46));
  chk('排序已切到临近截止', exploreSort === 'deadline', exploreSort);
  chk('不含 30 天以上的', document.querySelectorAll('.explore-table tbody tr').length <= expect);

  section('C 性能：加了缓存后渲染没变慢');
  toggleQuickDeadline();   // 取消
  renderExplore();
  var t = performance.now(); renderExplore(); var t1 = ms(t);
  t = performance.now(); buildFilterPanel(); var t2 = ms(t);
  t = performance.now(); for (var i=0;i<jobList.length;i++) deadlineBucketOf(jobList[i]); var t3 = ms(t);
  R.push('INFO :: renderExplore=' + t1 + 'ms  buildFilterPanel=' + t2 + 'ms  全量分档查询×' + jobList.length + '=' + t3 + 'ms');
  chk('全量分档查询 < 5ms（走缓存）', t3 < 5, t3);
  chk('renderExplore < 60ms', t1 < 60, t1);

  section('D 取消后恢复全部');
  var total = jobList.length;
  var rowsAll = document.querySelectorAll('.explore-table tbody tr').length;
  chk('取消后恢复（首批 200 或全部）', rowsAll === Math.min(200, total), rowsAll + ' vs ' + Math.min(200, total));

  exploreFilters.deadlineBuckets.clear();
  jobList = []; renderExplore();
  return R;
})();
