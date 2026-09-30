return (async function () {
  var R=[]; function chk(n,c,e){ R.push((c?"PASS":"FAIL")+" :: "+n+(e!==undefined&&!c?" :: "+e:"")); }
  function section(t){ R.push('-- '+t+' --'); }
  await syncQiuzhiFangzhou();
  var m=document.getElementById('syncResultModal'); if(m)m.style.display='none';
  R.push('INFO :: 真实岗位 = ' + jobList.length + ' 条');

  section('真实数据里截止日期的分布');
  var withDl = jobList.filter(function(j){ return j.deadline; }).length;
  R.push('INFO :: 有截止日期的 = ' + withDl + ' / ' + jobList.length);
  var buckets = {};
  jobList.forEach(function(j){
    if(!j.deadline) return;
    var d = daysFromToday(j.deadline);
    var k = d===null ? '非法日期' : (d<0 ? '已截止' : d===0 ? '今天' : d<=3 ? '3天内' : d<=7 ? '7天内' : '7天以上');
    buckets[k] = (buckets[k]||0)+1;
  });
  R.push('INFO :: 分布 = ' + JSON.stringify(buckets));

  section('真实数据渲染');
  switchTab('explore'); renderExplore();
  var rows = document.querySelectorAll('.explore-table tbody tr');
  var ths = document.querySelectorAll('.explore-table thead th');
  R.push('INFO :: 渲染 ' + rows.length + ' 行，表头 ' + ths.length + ' 列');
  var headTexts = Array.prototype.map.call(ths, function(t){ return t.textContent.trim(); });
  var dlIdx = headTexts.indexOf('截止日期');
  var coIdx = headTexts.indexOf('公司');
  chk('表头顺序正确（公司在截止日期左边）', dlIdx === coIdx + 1, '公司@'+coIdx+' 截止@'+dlIdx);

  // 逐行核对：每行的截止单元格应与该行数据一致
  var bad = 0, checked = 0, samples = [];
  for (var i=0;i<Math.min(rows.length, 60);i++){
    var id = rows[i].dataset.id;
    var j = jobList.find(function(x){ return String(x.id)===String(id); });
    if (!j) continue;
    var cell = rows[i].children[dlIdx];
    if (!cell) { bad++; continue; }
    var txt = cell.textContent.trim();
    checked++;
    if (!j.deadline) { if (txt !== '-') bad++; }
    else {
      var dd = daysFromToday(j.deadline);
      var mmdd = j.deadline.slice(5);
      if (txt.indexOf(mmdd) === -1) bad++;
      if (dd !== null && dd >= 0 && dd <= 3 && cell.querySelector('.dl-urgent') === null) bad++;
      if (dd !== null && dd > 7 && cell.querySelector('b') !== null) bad++;
    }
    if (samples.length < 6) samples.push(txt);
  }
  R.push('INFO :: 抽查 ' + checked + ' 行，样例 = ' + samples.join(' , '));
  chk('★ 逐行核对全部一致（' + checked + ' 行）', bad === 0, bad + ' 行不符');

  section('紧急度机制确实生效');
  // 注意：不能断言"默认排序首屏必有紧急项" —— 默认按最近更新排，
  // 新收录的岗位截止日期往往还很远，首屏可能一个紧急项都没有（这不是 bug）。
  // 正确的判据是：切到「临近截止」排序后，紧急项必须浮上来。
  var hadUrgent = document.querySelectorAll('.explore-table .dl-urgent').length;
  var hadOver = document.querySelectorAll('.explore-table .dl-over').length;
  R.push('INFO :: 默认排序首屏：紧急=' + hadUrgent + ' 已截止=' + hadOver);
  setSort(document.querySelector('.sort-btn[data-sort="deadline"]'));
  var nowUrgent = document.querySelectorAll('.explore-table .dl-urgent').length;
  var nowOver = document.querySelectorAll('.explore-table .dl-over').length;
  var nowSoon = document.querySelectorAll('.explore-table .dl-soon').length;
  R.push('INFO :: 临近截止排序首屏：紧急=' + nowUrgent + ' 较近=' + nowSoon + ' 已截止=' + nowOver);
  chk('★ 切到临近截止后出现紧急标记', nowUrgent > 0, nowUrgent);
  chk('★ 紧急度标记数量比默认排序更多', (nowUrgent + nowOver) > (hadUrgent + hadOver),
      (nowUrgent + nowOver) + ' vs ' + (hadUrgent + hadOver));
  setSort(document.querySelector('.sort-btn[data-sort="updated"]'));

  section('与「仅临近截止」筛选一致');
  var dlSoon = document.getElementById('showDeadlineSoon');
  chk('该筛选属于投递管理，不影响清单', !!dlSoon);

  jobList = []; renderExplore();
  return R;
})();
