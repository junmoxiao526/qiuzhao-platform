// 岗位去重：同公司+岗位+批次合并；跨批次、手动岗位、内容不同者一律保留
return (async function () {
  var R = []; function chk(n, c, e) { R.push((c ? "PASS" : "FAIL") + " :: " + n + (e !== undefined && !c ? " :: " + e : "")); }
  function section(t) { R.push('-- ' + t + ' --'); }
  function mk(o) {
    return sanitizeJob(Object.assign({
      id: 'id' + Math.random().toString(36).slice(2, 8),
      company: '甲公司', positionRaw: '前端工程师', positionTypes: ['前端工程师'],
      batch: '27秋招', city: '上海', cities: ['上海'], openingDate: '2026-09-20',
      deadline: '', url: '', noticeUrl: '', popular: 0
    }, o));
  }
  function sigList() { return jobList.map(function (j) { return j.company + '/' + j.positionRaw + '/' + (j.batch || '-') + '/q=' + (j.qiuzhiId || '-'); }).sort(); }

  section('A 同公司+同岗位+同批次 → 合并为一条');
  var j1 = mk({ qiuzhiId: 'A1', openingDate: '2026-09-14', noticeUrl: 'https://a.example/1', addedAt: '2026-09-14T00:00:00Z' });
  var j2 = mk({ qiuzhiId: 'A2', openingDate: '2026-09-23', noticeUrl: 'https://a.example/2', url: 'https://apply.example/2', addedAt: '2026-09-23T00:00:00Z' });
  jobList = [j1, j2];
  var removed = dedupeJobList();
  chk('合并掉 1 条', removed === 1, removed);
  chk('只剩 1 条', jobList.length === 1, jobList.length);
  chk('★ 保留信息更全的那条（有投递链接）', jobList[0].qiuzhiId === 'A2', jobList[0].qiuzhiId);
  chk('★ 保留最早的加入时间（不覆盖"我早就加过它"）', jobList[0].addedAt === '2026-09-14T00:00:00Z', jobList[0].addedAt);

  section('B 同公司+同岗位但批次不同 → 都要保留');
  jobList = [ mk({ qiuzhiId: 'B1', batch: '27秋招' }), mk({ qiuzhiId: 'B2', batch: '26秋招' }) ];
  chk('跨批次不合并', dedupeJobList() === 0 && jobList.length === 2, jobList.length);

  section('C 岗位描述不同 → 都要保留');
  jobList = [ mk({ qiuzhiId: 'C1', positionRaw: '前端工程师' }), mk({ qiuzhiId: 'C2', positionRaw: '后端工程师' }) ];
  chk('不同岗位不合并', dedupeJobList() === 0 && jobList.length === 2, jobList.length);

  section('D 公司不同 → 都要保留');
  jobList = [ mk({ qiuzhiId: 'D1', company: '甲公司' }), mk({ qiuzhiId: 'D2', company: '乙公司' }) ];
  chk('不同公司不合并', dedupeJobList() === 0 && jobList.length === 2, jobList.length);

  section('E 手动添加的岗位（无 qiuzhiId）一律保留');
  jobList = [ mk({ qiuzhiId: 'E1' }), mk({ qiuzhiId: '', id: 'manual1' }), mk({ qiuzhiId: '', id: 'manual2' }) ];
  chk('手动岗位不参与合并', dedupeJobList() === 0 && jobList.length === 3, jobList.length);

  section('F 大小写/空白差异视为同一岗位');
  jobList = [ mk({ qiuzhiId: 'F1', company: ' 甲公司 ' }), mk({ qiuzhiId: 'F2', company: '甲公司' }) ];
  chk('前后空格差异仍合并', dedupeJobList() === 1 && jobList.length === 1, jobList.map(function(j){return JSON.stringify(j.company);}).join(','));

  section('G 三胞胎 → 合并为一条');
  jobList = [ mk({ qiuzhiId: 'G1' }), mk({ qiuzhiId: 'G2' }), mk({ qiuzhiId: 'G3' }) ];
  chk('3 条合并为 1 条', dedupeJobList() === 2 && jobList.length === 1, jobList.length);

  section('H 幂等：重复调用不再变化');
  jobList = [ mk({ qiuzhiId: 'H1' }), mk({ qiuzhiId: 'H2' }) ];
  var r1 = dedupeJobList(), snap = sigList(), r2 = dedupeJobList(), snap2 = sigList();
  chk('第一次合并 1 条', r1 === 1, r1);
  chk('第二次无变化', r2 === 0, r2);
  chk('结果稳定', snap.join('|') === snap2.join('|'));

  section('I 全唯一时不误删');
  var uniq = [];
  for (var i = 0; i < 200; i++) uniq.push(mk({ qiuzhiId: 'U' + i, company: '公司' + i, positionRaw: '岗位' + i, batch: '' }));
  jobList = uniq;
  chk('200 条各不相同的岗位一条不删', dedupeJobList() === 0 && jobList.length === 200, jobList.length);

  section('J 保留"有截止日期 / 城市更全"的那条');
  jobList = [
    mk({ qiuzhiId: 'J1', deadline: '', cities: [] }),
    mk({ qiuzhiId: 'J2', deadline: '2026-11-30', cities: ['上海', '北京'] })
  ];
  dedupeJobList();
  chk('保留信息更全的一条', jobList.length === 1 && jobList[0].qiuzhiId === 'J2', jobList.length ? jobList[0].qiuzhiId : '空');

  section('K 顺序稳定：保留原列表位置');
  var k1 = mk({ qiuzhiId: 'K1', company: '公司X' });
  var k2 = mk({ qiuzhiId: 'K9', company: '公司A' });
  var k3 = mk({ qiuzhiId: 'K2', company: '公司X' });
  jobList = [k1, k2, k3];   // K1 与 K2 重复，K2 在最后
  dedupeJobList();
  chk('合并不打乱顺序（公司X 仍在首位）', jobList[0].company === '公司X', jobList.map(function(j){return j.company;}).join(','));

  jobList = []; renderExplore();
  return R;
})();
