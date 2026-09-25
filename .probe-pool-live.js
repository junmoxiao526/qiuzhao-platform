// 共享岗位池：真实 Supabase 端到端验证
// 覆盖：表结构是否存在、写入、读取、去重、以及个人数据是否外传
var R = [];
function chk(n, c, e) { R.push((c ? 'PASS' : 'FAIL') + ' :: ' + n + (e !== undefined && !c ? ' :: ' + e : '')); }
function section(t) { R.push('-- ' + t + ' --'); }

section('A 客户端已连上 Supabase');
chk('supabaseClient 已创建', typeof isPoolAvailable === 'function' && isPoolAvailable() === true, String(typeof isPoolAvailable === 'function' ? isPoolAvailable() : 'n/a'));
chk('客户端非空', !!supabaseClient);

section('B 探测 job_pool 表是否存在');
return (async function () {
  var exists = false, probeErr = '';
  try {
    var res = await supabaseClient.from('job_pool').select('qiuzhi_id').limit(1);
    if (res.error) { probeErr = res.error.message || JSON.stringify(res.error); }
    else { exists = true; }
  } catch (e) { probeErr = e.message; }
  chk('job_pool 表可访问', exists, probeErr);

  if (!exists) {
    R.push('SKIP :: 表尚未创建，后续写入/读取测试跳过（属预期，等待执行 job_pool.sql）');
    return R;
  }

  section('C 写入共享池');
  var testKey = '__probe_job_' + Date.now();
  var testRow = jobToPoolRow({
    qiuzhiId: testKey, company: '探针测试公司', positionRaw: '探针岗位',
    positionTypes: ['探针岗位'], industryRaw: '互联网', typeTags: ['互联网'],
    companyTypes: ['互联网'], cities: ['上海'], batch: '2026秋招',
    deadline: '2026-12-01', openingDate: '2026-09-01',
    url: 'https://example.com/probe', noticeUrl: 'https://example.com/notice',
    referralCode: '', popular: 1
  });
  var wres = await supabaseClient.from('job_pool').upsert([testRow], { onConflict: 'qiuzhi_id' });
  chk('匿名可写入共享池', !wres.error, wres.error && (wres.error.message || JSON.stringify(wres.error)));

  section('D 读回并校验字段');
  var rres = await supabaseClient.from('job_pool').select('*').eq('qiuzhi_id', testKey).maybeSingle();
  chk('匿名可读回刚写入的行', !rres.error && !!rres.data, rres.error && (rres.error.message || JSON.stringify(rres.error)));
  if (rres.data) {
    var d = rres.data;
    chk('company 正确', d.company === '探针测试公司', d.company);
    chk('position_types 保持数组', Array.isArray(d.position_types) && d.position_types[0] === '探针岗位', JSON.stringify(d.position_types));
    chk('cities 保持数组', Array.isArray(d.cities) && d.cities[0] === '上海', JSON.stringify(d.cities));
    chk('popular 保持数字', Number(d.popular) === 1, d.popular);
    chk('first_seen_at 自动填充', !!d.first_seen_at, d.first_seen_at);
    var back = poolRowToJob(d);
    chk('回读对象可用', back.company === '探针测试公司' && back.city === '上海', JSON.stringify({ c: back.company, city: back.city }));
  }

  section('E 去重（同 qiuzhi_id 重复 upsert 不应产生第二行）');
  testRow.company = '探针测试公司（已更新）';
  var w2 = await supabaseClient.from('job_pool').upsert([testRow], { onConflict: 'qiuzhi_id' });
  chk('重复 upsert 无错误', !w2.error, w2.error && w2.error.message);
  var cnt = await supabaseClient.from('job_pool').select('qiuzhi_id').eq('qiuzhi_id', testKey);
  chk('同 id 仍只有一行', !cnt.error && Array.isArray(cnt.data) && cnt.data.length === 1, cnt.data && cnt.data.length);
  var upd = await supabaseClient.from('job_pool').select('company').eq('qiuzhi_id', testKey).maybeSingle();
  chk('upsert 覆盖了旧值', upd.data && upd.data.company === '探针测试公司（已更新）', upd.data && upd.data.company);

  section('F 个人数据绝不出现在池中');
  chk('池表无简历相关列', !('basicInfo' in (rres.data || {})) && !('resume' in (rres.data || {})) && !('mobile' in (rres.data || {})));
  chk('池表无投递记录列', !('status' in (rres.data || {})) && !('notes' in (rres.data || {})) && !('review' in (rres.data || {})));

  section('G 清理探针数据');
  var del = await supabaseClient.from('job_pool').delete().eq('qiuzhi_id', testKey);
  chk('探针行已删除', !del.error, del.error && del.error.message);
  var after = await supabaseClient.from('job_pool').select('qiuzhi_id').eq('qiuzhi_id', testKey);
  chk('确认探针行已不存在', !after.error && Array.isArray(after.data) && after.data.length === 0, after.data && after.data.length);

  return R;
})();
