return (async function () {
  var R=[]; function chk(n,c,e){ R.push((c?"PASS":"FAIL")+" :: "+n+(e!==undefined&&!c?" :: "+e:"")); }
  function section(t){ R.push('-- '+t+' --'); }

  reminderSettings = Object.assign({}, REMINDER_DEFAULT, { autoCleanExpired:true, autoCleanInternship:true });
  jobList = []; renderExplore();

  section('同步（自动清理已截止 + 实习）');
  await syncQiuzhiFangzhou();
  var m=document.getElementById('syncResultModal'); if(m)m.style.display='none';
  var summary = (document.getElementById('syncSummary').textContent||'').replace(/\s+/g,' ');
  R.push('INFO :: 同步结果 = ' + summary.slice(0,240));
  chk('★ 结果里报了清理', summary.indexOf('已自动清理') !== -1, summary.slice(-70));

  section('清单里已无实习岗');
  var intern = jobList.filter(isInternshipJob);
  R.push('INFO :: 剩余批次分布 = ' + JSON.stringify((function(){
    var c={}; jobList.forEach(function(j){ var b=String(j.batch||'').trim()||'(空)'; c[b]=(c[b]||0)+1; }); return c; })()));
  chk('★ 实习岗 = 0', intern.length === 0, intern.length);
  chk('★ 含「实习」的批次一个不剩', jobList.every(function(j){ return String(j.batch||'').indexOf('实习')===-1; }));

  section('提前批没被误删');
  var early = jobList.filter(function(j){ return String(j.batch||'').indexOf('提前批') !== -1; });
  R.push('INFO :: 提前批 = ' + early.length + ' 条');
  chk('★ 提前批保留', early.length > 0, early.length);
  var qz = jobList.filter(function(j){ return String(j.batch||'').indexOf('秋招') !== -1 || String(j.batch||'').indexOf('校招') !== -1; });
  R.push('INFO :: 秋招/校招 = ' + qz.length + ' 条');
  chk('★ 秋招保留', qz.length > 0, qz.length);

  section('已截止也没了，今天截止的还在');
  var over=0, today=0;
  jobList.forEach(function(j){ var b=deadlineBucketOf(j); if(b==='overdue') over++; if(b==='today') today++; });
  R.push('INFO :: 已截止 = ' + over + '，今天截止 = ' + today);
  chk('已截止 = 0', over === 0, over);
  chk('★ 今天截止仍在', today > 0, today);

  section('落盘一致');
  flushJobListNow();
  var stored = lsGet('campus_job_list');
  chk('落盘条数与内存一致', Array.isArray(stored) && stored.length === jobList.length,
      (Array.isArray(stored)?stored.length:'?') + ' vs ' + jobList.length);
  chk('★ 落盘里也没有实习岗', Array.isArray(stored) && stored.every(function(j){ return String(j.batch||'').indexOf('实习')===-1; }));

  section('二次同步不再重复清理');
  var before = jobList.length;
  await syncQiuzhiFangzhou();
  document.getElementById('syncResultModal').style.display='none';
  R.push('INFO :: 二次同步后 ' + jobList.length + ' 条（变化 ' + (jobList.length-before) + '）');
  chk('无实习岗残留', jobList.filter(isInternshipJob).length === 0);

  jobList = []; renderExplore();
  return R;
})();
