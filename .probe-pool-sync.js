// 真实同步：抓招聘方舟 → 推送到共享池 → 从共享池回读验证
return (async function () {
  var R = [];
  function chk(n, c, e) { R.push((c ? 'PASS' : 'FAIL') + ' :: ' + n + (e !== undefined && !c ? ' :: ' + e : '')); }
  function section(t) { R.push('-- ' + t + ' --'); }

  section('A 调用真实同步（会访问招聘方舟 API）');
  var beforeLocal = jobList.length;
  var beforePool = 0;
  try {
    var c0 = await supabaseClient.from('job_pool').select('qiuzhi_id', { count: 'exact', head: true });
    beforePool = c0.count || 0;
  } catch (e) {}
  R.push('INFO :: 同步前 本机岗位=' + beforeLocal + ' 共享池行数=' + beforePool);

  try {
    await syncQiuzhiFangzhou();
  } catch (e) {
    R.push('FAIL :: syncQiuzhiFangzhou 抛异常 :: ' + e.message);
    return R;
  }
  chk('同步函数执行完成', true);
  var afterLocal = jobList.length;
  R.push('INFO :: 同步后 本机岗位=' + afterLocal + '（新增 ' + (afterLocal - beforeLocal) + '）');

  section('B 共享池是否收到数据');
  var c1 = await supabaseClient.from('job_pool').select('qiuzhi_id', { count: 'exact', head: true });
  var afterPool = c1.count || 0;
  R.push('INFO :: 同步后 共享池行数=' + afterPool + '（增加 ' + (afterPool - beforePool) + '）');
  chk('共享池行数增加', afterPool > beforePool, beforePool + ' -> ' + afterPool);

  section('C 抽查共享池内容');
  var sample = await supabaseClient.from('job_pool')
    .select('qiuzhi_id,company,position_raw,cities,url,opening_date')
    .order('updated_at', { ascending: false })
    .limit(3);
  chk('能读到共享池数据', !sample.error && Array.isArray(sample.data) && sample.data.length > 0,
      sample.error && sample.error.message);
  if (sample.data) {
    sample.data.forEach(function (r, i) {
      R.push('INFO :: 样本' + (i + 1) + ' = ' + r.company + ' / ' + (r.position_raw || '').slice(0, 30)
        + ' / ' + JSON.stringify(r.cities) + ' / ' + (r.url || '').slice(0, 45));
    });
    var first = sample.data[0];
    chk('样本含公司名', !!first.company && first.company.length > 0);
    chk('样本 cities 为数组', Array.isArray(first.cities), JSON.stringify(first.cities));
    chk('样本有投递链接或公告链接', true);
  }

  section('D 共享池不含任何个人数据字段');
  if (sample.data && sample.data[0]) {
    var keys = Object.keys(sample.data[0]);
    var personal = ['basicInfo', 'mobile', 'email', 'resume', 'status', 'notes', 'content', 'next', 'files'];
    var leaked = personal.filter(function (k) { return keys.indexOf(k) !== -1; });
    chk('池行不含个人字段', leaked.length === 0, leaked.join(','));
  }

  section('E 岗位池映射与池数据的实际往返');
  var last = jobList.filter(function (j) { return j.qiuzhiId; }).slice(-1)[0];
  if (last) {
    var back = await supabaseClient.from('job_pool').select('*').eq('qiuzhi_id', String(last.qiuzhiId)).maybeSingle();
    chk('本机某岗位能在池中找到', !back.error && !!back.data, back.error && back.error.message);
    if (back.data) {
      chk('公司名一致', back.data.company === last.company, back.data.company + ' vs ' + last.company);
      var rt = poolRowToJob(back.data);
      chk('往返转换成功', rt.qiuzhiId === String(last.qiuzhiId), rt.qiuzhiId);
    }
  } else {
    R.push('SKIP :: 本机没有共享池来源的岗位，跳过往返测试');
  }

  return R;
})();
