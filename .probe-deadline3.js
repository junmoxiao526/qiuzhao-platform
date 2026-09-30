return (async function () {
  var R=[]; function chk(n,c,e){ R.push((c?"PASS":"FAIL")+" :: "+n+(e!==undefined&&!c?" :: "+e:"")); }
  function section(t){ R.push('-- '+t+' --'); }
  await syncQiuzhiFangzhou();
  var m=document.getElementById('syncResultModal'); if(m)m.style.display='none';
  R.push('INFO :: 真实岗位 = ' + jobList.length);

  section('默认排序（最近更新）下，紧急岗位看不到');
  switchTab('explore');
  setSort(document.querySelector('.sort-btn[data-sort="updated"]'));
  R.push('INFO :: 默认排序前 200 行：紧急(≤3天)=' + document.querySelectorAll('.dl-urgent').length +
         ' 较近(≤7天)=' + document.querySelectorAll('.dl-soon').length +
         ' 已截止=' + document.querySelectorAll('.dl-over').length);

  section('切到「临近截止」后');
  setSort(document.querySelector('.sort-btn[data-sort="deadline"]'));
  var urgent = document.querySelectorAll('.dl-urgent').length;
  var over = document.querySelectorAll('.dl-over').length;
  var soon = document.querySelectorAll('.dl-soon').length;
  R.push('INFO :: 临近截止排序前 200 行：紧急(≤3天)=' + urgent + ' 较近(≤7天)=' + soon + ' 已截止=' + over);
  chk('★ 紧急项浮到首屏', urgent > 0, urgent);
  // 同步会自动清理已截止岗位，所以这里已截止应当为 0（不是缺陷，是预期行为）
  chk('★ 已截止已被自动清理（不在清单里）', over === 0, over);
  chk('★ 今天截止的没有被误删', (function () {
    var n = 0; jobList.forEach(function (j) { if (deadlineBucketOf(j) === 'today') n++; }); return n > 0;
  })());

  section('首屏内容确实是最近截止的');
  var rows = document.querySelectorAll('.explore-table tbody tr');
  var listed = [];
  for (var i=0;i<10;i++){
    var id = rows[i].dataset.id;
    var j = jobList.find(function(x){ return String(x.id)===String(id); });
    if (j) listed.push(j.deadline + '(' + (j.company||'').slice(0,6) + ')');
  }
  R.push('INFO :: 前 10 行截止日期 = ' + listed.join(' , '));
  var allSorted = true;
  for (var k=1;k<listed.length;k++) if (listed[k-1].slice(0,10) > listed[k].slice(0,10)) allSorted = false;
  chk('★ 前 10 行按截止日期升序', allSorted, listed.join(','));

  section('逐行核对排序与截止列一致（抽查 100 行）');
  var bad = 0, prev = null, checked = 0;
  jobList.length && (function(){
    var shown = [];
    for (var i=0;i<rows.length && i<100;i++){
      var j2 = jobList.find(function(x){ return String(x.id)===String(rows[i].dataset.id); });
      if (j2 && j2.deadline) { shown.push(j2.deadline); checked++; }
    }
    for (var n=1;n<shown.length;n++) if (shown[n-1] > shown[n]) bad++;
  })();
  chk('★ 排序单调递增（' + checked + ' 行抽查）', bad === 0, bad + ' 处逆序');

  switchTab('explore');
  setSort(document.querySelector('.sort-btn[data-sort="updated"]'));
  jobList = []; renderExplore();
  return R;
})();
