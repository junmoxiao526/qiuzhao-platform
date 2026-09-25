// 隔离验证：本 profile 相当于「另一个人」的浏览器
// 纯本地架构下应满足：看不到任何别人的个人数据；自己也不上传任何数据
return (async function () {
  var R = [], P = window.__PROFILE_TAG || 'PROFILE';
  function chk(n, c, e) { R.push((c ? "PASS" : "FAIL") + " :: [" + P + "] " + n + (e !== undefined && !c ? " :: " + e : "")); }
  function section(t) { R.push('-- ' + t + ' --'); }

  section('1 本机个人数据状态');
  var keys = {};
  ['campus_recruit_jobs', 'campus_reviews', 'campus_resume', 'campus_summary', 'campus_job_list'].forEach(function (k) {
    try { keys[k] = localStorage.getItem(k); } catch (e) { keys[k] = null; }
  });
  var personalEmpty = !keys['campus_recruit_jobs'] && !keys['campus_reviews'] && !keys['campus_resume'] && !keys['campus_summary'];
  R.push('INFO :: [' + P + '] 投递=' + (keys['campus_recruit_jobs'] ? keys['campus_recruit_jobs'].length + '字符' : '空')
    + ' 复盘=' + (keys['campus_reviews'] ? keys['campus_reviews'].length + '字符' : '空')
    + ' 简历=' + (keys['campus_resume'] ? keys['campus_resume'].length + '字符' : '空')
    + ' 总结=' + (keys['campus_summary'] ? keys['campus_summary'].length + '字符' : '空')
    + ' 岗位清单=' + (keys['campus_job_list'] ? keys['campus_job_list'].length + '字符' : '空'));
  R.push('INFO :: [' + P + '] 界面「投递管理」计数 = ' + (document.getElementById('trackCount') ? document.getElementById('trackCount').textContent : '?'));
  chk('个人数据为空（本 profile 是全新访客）', personalEmpty || window.__PROBE_SEED_PERSONAL === '1',
      personalEmpty ? '' : '含有种入的私人数据（本次为「你」这一侧，属预期）');

  section('2 岗位清单只存在本机');
  chk('岗位清单存于 localStorage', !!keys['campus_job_list'] || jobList.length === 0,
      keys['campus_job_list'] ? '有' : '无');
  R.push('INFO :: [' + P + '] 本机岗位数 = ' + jobList.length);

  section('3 没有共享/云同步机制');
  chk('页面无云同步开关', !document.getElementById('cloudToggleBtn'));
  chk('页面无共享池状态区', !document.getElementById('poolInfo'));
  chk('全局无 supabase 客户端', typeof supabaseClient === 'undefined');
  chk('全局无 pullJobPool', typeof pullJobPool === 'undefined');
  chk('全局无 cloudPush', typeof cloudPush === 'undefined');

  section('4 页面源码不含任何后端凭据');
  var big = null;
  for (var i = 0; i < document.scripts.length; i++) {
    if ((document.scripts[i].textContent || '').length > 100000) big = document.scripts[i];
  }
  chk('能取到主脚本', !!big);
  if (big) {
    var s = big.textContent;
    chk('无 supabase 字样', s.indexOf('supabase') === -1);
    chk('无 anon key', s.indexOf('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9') === -1);
    chk('无 sync_data / job_pool', s.indexOf('sync_data') === -1 && s.indexOf('job_pool') === -1);
  }

  section('5 保存个人数据不产生网络请求（关键）');
  var calls = [];
  var of = window.fetch;
  window.fetch = function (u) { calls.push(String(u)); return of.apply(this, arguments); };
  saveJobs(); saveReviews(); saveSummary(); saveResumeData(loadResumeData());
  window.fetch = of;
  chk('无任何网络请求', calls.length === 0, calls.slice(0, 3).join(' | '));

  return R;
})();
