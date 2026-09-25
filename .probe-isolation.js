// 隔离验证：本 profile 相当于「另一个人」的浏览器
// 证明：能看到共享岗位池；看不到任何别人的个人数据
return (async function () {
  var R = [], P = window.__PROFILE_TAG || 'PROFILE';
  function chk(n, c, e) { R.push((c ? "PASS" : "FAIL") + " :: [" + P + "] " + n + (e !== undefined && !c ? " :: " + e : "")); }
  function section(t) { R.push('-- ' + t + ' --'); }

  section('1 本机个人数据状态（应完全为空）');
  var keys = { jobs: null, reviews: null, resume: null, summary: null };
  try {
    keys.jobs = localStorage.getItem('campus_recruit_jobs');
    keys.reviews = localStorage.getItem('campus_reviews');
    keys.resume = localStorage.getItem('campus_resume');
    keys.summary = localStorage.getItem('campus_summary');
  } catch (e) {}
  chk('本机无投递记录', !keys.jobs, keys.jobs ? keys.jobs.length + ' 字符' : '');
  chk('本机无复盘记录', !keys.reviews, keys.reviews ? keys.reviews.length + ' 字符' : '');
  chk('本机无简历数据', !keys.resume, keys.resume ? keys.resume.length + ' 字符' : '');
  chk('本机无投递总结', !keys.summary, keys.summary ? keys.summary.length + ' 字符' : '');
  R.push('INFO :: [' + P + '] 界面「投递管理」计数 = ' + (document.getElementById('trackCount') ? document.getElementById('trackCount').textContent : '?'));

  section('2 能否看到共享岗位池（应能看到）');
  var ok = await pullJobPool(false, true);
  chk('能从共享池拉取岗位', ok === true);
  var shared = jobList.filter(function (j) { return j.qiuzhiId; });
  R.push('INFO :: [' + P + '] 共享池来源岗位数 = ' + shared.length);
  chk('共享池岗位数 > 0', shared.length > 0, String(shared.length));
  if (shared.length) {
    R.push('INFO :: [' + P + '] 首个岗位 = ' + shared[0].company + ' / ' + (shared[0].positionRaw || '').slice(0, 30));
  }
  chk('页面渲染了岗位清单', !!document.querySelector('[data-act="open-explore"]'));

  section('3 能否看到别人的个人数据（应完全不能）');
  // 尝试直接读取存放个人数据的表
  var blocked = null;
  try {
    var res = await supabaseClient.from('sync_data').select('key,payload').limit(5);
    if (res.error) { blocked = res.error.message || JSON.stringify(res.error); }
    else if (!res.data || res.data.length === 0) { blocked = 'empty'; }
    else { blocked = 'LEAKED:' + res.data.length + ' rows'; }
  } catch (e) { blocked = e.message; }
  chk('个人数据表 sync_data 不可读', blocked === 'empty' || (blocked && blocked.indexOf('LEAKED') !== 0), String(blocked));
  R.push('INFO :: [' + P + '] sync_data 查询结果 = ' + String(blocked).slice(0, 120));

  // 逐项点名尝试
  var personalKeys = ['resume', 'reviews', 'jobs', 'jobList', 'summary'];
  for (var i = 0; i < personalKeys.length; i++) {
    var k = personalKeys[i];
    var got = null;
    try {
      var r2 = await supabaseClient.from('sync_data').select('payload').eq('key', k);
      got = r2.error ? 'error' : ((r2.data && r2.data.length) ? 'LEAKED' : 'empty');
    } catch (e) { got = 'error'; }
    chk('sync_data["' + k + '"] 读不到', got !== 'LEAKED', String(got));
  }

  section('4 共享池里是否混入了个人数据');
  var sample = await supabaseClient.from('job_pool').select('*').limit(1);
  if (sample.data && sample.data[0]) {
    var cols = Object.keys(sample.data[0]);
    var bad = ['basicInfo', 'mobile', 'email', 'resume', 'status', 'notes', 'content', 'files', 'owner']
      .filter(function (c) { return cols.indexOf(c) !== -1; });
    chk('池表结构不含个人字段', bad.length === 0, bad.join(','));
    R.push('INFO :: [' + P + '] job_pool 列 = ' + cols.join(','));
  }

  section('5 界面文案是否明确告知隐私边界');
  var infoEl = document.getElementById('poolInfo');
  var warnEl = document.querySelector('.cloud-warn');
  chk('有岗位池状态区', !!infoEl);
  chk('有隐私说明文案', !!warnEl && warnEl.textContent.indexOf('本机') !== -1, warnEl ? warnEl.textContent.slice(0, 60) : 'missing');
  R.push('INFO :: [' + P + '] 状态文案 = ' + (infoEl ? infoEl.textContent.trim().slice(0, 100) : '?'));

  return R;
})();
