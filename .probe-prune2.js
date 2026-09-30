return (async function () {
  var R=[]; function chk(n,c,e){ R.push((c?"PASS":"FAIL")+" :: "+n+(e!==undefined&&!c?" :: "+e:"")); }
  function section(t){ R.push('-- '+t+' --'); }

  var before = jobList.length;
  var overBefore = 0; jobList.forEach(function(j){ if(deadlineBucketOf(j)==='overdue') overBefore++; });
  R.push('INFO :: 清理前 jobList=' + before + '，其中已截止 ' + overBefore);

  section('同步（会自动清理已截止）');
  await syncQiuzhiFangzhou();
  var m=document.getElementById('syncResultModal'); if(m)m.style.display='none';
  var summary = (document.getElementById('syncSummary').textContent||'').replace(/\s+/g,' ');
  R.push('INFO :: 同步结果 = ' + summary.slice(0,200));
  chk('★ 同步结果显示已清理', summary.indexOf('已清理') !== -1, summary.slice(-60));

  var overAfter = 0; jobList.forEach(function(j){ if(deadlineBucketOf(j)==='overdue') overAfter++; });
  R.push('INFO :: 清理后 jobList=' + jobList.length + '，其中已截止 ' + overAfter);
  chk('★ 清单里已无已截止岗位', overAfter === 0, overAfter);

  section('今天截止的仍在');
  var todayN = 0; jobList.forEach(function(j){ if(deadlineBucketOf(j)==='today') todayN++; });
  R.push('INFO :: 今天截止 = ' + todayN);
  chk('★ 今天截止的保留下来', todayN > 0, todayN);

  section('筛选面板已截止归零');
  buildFilterPanel();
  var tags = Array.prototype.map.call(document.querySelectorAll('#deadlineTags .deadline-tag'), function(t){ return t.textContent.trim(); });
  R.push('INFO :: 分档 = ' + tags.join(' | '));
  var overTag = tags.filter(function(t){ return t.indexOf('已截止') === 0; })[0];
  chk('★ 「已截止」数量为 0', overTag && overTag.replace(/\D/g,'') === '0', overTag);

  section('快截止按钮数量随之更新');
  var btn = document.getElementById('btnQuickDeadline');
  R.push('INFO :: 按钮 = ' + btn.textContent.trim());
  var expect = 0;
  jobList.forEach(function(j){ if(QUICK_DEADLINE_BUCKETS.indexOf(deadlineBucketOf(j))!==-1) expect++; });
  chk('★ 按钮数量与实际一致（' + expect + '）', btn.textContent.indexOf(String(expect)) !== -1, btn.textContent);

  section('落盘确认');
  flushJobListNow();
  var stored = lsGet('campus_job_list');
  var storedOver = 0;
  if (Array.isArray(stored)) stored.forEach(function(j){ if(deadlineBucketOf(j)==='overdue') storedOver++; });
  chk('★ 存储里也无已截止', Array.isArray(stored) && storedOver === 0,
      (Array.isArray(stored)?stored.length:'非数组') + ' 条，已截止 ' + storedOver);
  chk('落盘条数与内存一致', Array.isArray(stored) && stored.length === jobList.length,
      (Array.isArray(stored)?stored.length:'?') + ' vs ' + jobList.length);
  R.push('INFO :: 本次共清理 ' + (before - jobList.length) + ' 条');

  jobList = []; renderExplore();
  return R;
})();
