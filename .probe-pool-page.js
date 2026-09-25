// 验证分页修复：必须能拉全 4215+ 行，而非被 1000 行上限静默截断
return (async function () {
  var R = []; function chk(n, c, e) { R.push((c ? "PASS" : "FAIL") + " :: " + n + (e !== undefined && !c ? " :: " + e : "")); }
  function section(t) { R.push("-- " + t + " --"); }

  section('A 共享池真实总行数');
  var total = await supabaseClient.from('job_pool').select('qiuzhi_id', { count: 'exact', head: true });
  var poolCount = total.count || 0;
  R.push('INFO :: 共享池总行数 = ' + poolCount);
  chk('共享池有数据', poolCount > 0);

  section('B 统计分页请求次数（应 > 1，证明在翻页）');
  var origFetch = window.fetch, gets = 0;
  window.fetch = function (u, opt) {
    var s = String(u);
    if (s.indexOf('job_pool') !== -1 && (!opt || !opt.method || opt.method === 'GET')) gets++;
    return origFetch.apply(this, arguments);
  };

  section('C 强制全量拉取');
  jobList = [];                       // 清空本机，确保全量走一遍
  try { localStorage.removeItem('qiuzhao_pool_last_pull'); } catch (e) {}
  var t0 = performance.now();
  var ok = await pullJobPool(false, true);   // forceFull
  var t1 = performance.now();
  window.fetch = origFetch;
  chk('全量拉取成功', ok === true);
  R.push('INFO :: GET 请求次数 = ' + gets + '（每页 1000 行，期望 ceil(' + poolCount + '/1000) = ' + Math.ceil(poolCount / 1000) + '）');
  chk('请求次数与页数相符', gets === Math.ceil(poolCount / 1000), '实际 ' + gets);
  chk('翻页生效（请求数 > 1）', gets > 1, '实际 ' + gets);
  R.push('INFO :: 全量拉取耗时 = ' + Math.round(t1 - t0) + ' ms');

  section('D 拉到的行数是否等于池子总行数（关键：不再被截断）');
  R.push('INFO :: 本机岗位数 = ' + jobList.length + '，共享池 = ' + poolCount);
  chk('拉到的数量与池子相符（±1%）', Math.abs(jobList.length - poolCount) <= Math.max(5, poolCount * 0.01),
      jobList.length + ' vs ' + poolCount);

  section('E 增量拉取（第二次应几乎无新数据）');
  var origFetch2 = window.fetch, gets2 = 0;
  window.fetch = function (u, opt) { var s = String(u); if (s.indexOf('job_pool') !== -1 && (!opt || !opt.method || opt.method === 'GET')) gets2++; return origFetch2.apply(this, arguments); };
  var t2 = performance.now();
  var ok2 = await pullJobPool(false, false);
  var t3 = performance.now();
  window.fetch = origFetch2;
  chk('增量拉取成功', ok2 === true);
  var beforeCount = jobList.length;
  R.push('INFO :: 增量拉取请求数 = ' + gets2 + '，耗时 = ' + Math.round(t3 - t2) + ' ms');

  section('F 本机存储占用（确认没撑爆 localStorage）');
  var raw = 0, comp = 0;
  try {
    raw = (localStorage.getItem('campus_job_list') || '').length;
    R.push('INFO :: campus_job_list 存储长度 = ' + Math.round(raw / 1024) + ' KB（已压缩）');
  } catch (e) {}
  var totalBytes = 0;
  try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); totalBytes += k.length + (localStorage.getItem(k) || '').length; } } catch (e) {}
  R.push('INFO :: localStorage 总占用 ≈ ' + Math.round(totalBytes / 1024) + ' KB');
  chk('存储未超常见 5MB 上限', totalBytes < 5 * 1024 * 1024, Math.round(totalBytes / 1024) + ' KB');

  section('G 抽样校验渲染字段完整');
  var s = jobList.filter(function (j) { return j.qiuzhiId; })[0];
  if (s) {
    chk('有公司名', !!s.company, s.company);
    chk('有城市数组', Array.isArray(s.cities), JSON.stringify(s.cities));
    chk('有 companyType 派生值', !!s.companyType, s.companyType);
    R.push('INFO :: 样本 = ' + s.company + ' / ' + (s.positionRaw || '').slice(0, 40) + ' / ' + s.city);
  }

  return R;
})();
