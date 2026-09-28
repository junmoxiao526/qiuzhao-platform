return (async function () {
  var R=[]; function chk(n,c,e){ R.push((c?"PASS":"FAIL")+" :: "+n+(e!==undefined&&!c?" :: "+e:"")); }
  function section(t){ R.push('-- '+t+' --'); }
  function mk(o){ return sanitizeJob(Object.assign({ id:'st'+Math.random().toString(36).slice(2,7),
    company:'统计公司', position:'岗位', status:'applied', applyDate:'2026-09-01',
    companyType:'互联网', resumeVersion:'', notes:'' }, o)); }

  section('A 漏斗是单调递减的');
  jobs = [
    mk({ id:'a1', company:'A', status:'applied' }),
    mk({ id:'a2', company:'B', status:'assessment' }),
    mk({ id:'a3', company:'C', status:'interview1' }),
    mk({ id:'a4', company:'D', status:'hr' }),
    mk({ id:'a5', company:'E', status:'offer' }),
    mk({ id:'a6', company:'F', status:'failed' }),
    mk({ id:'a7', company:'G', status:'pending' })
  ];
  reviews = [];
  var f = buildFunnel(jobs);
  R.push('INFO :: 漏斗 = ' + f.steps.map(function(s){ return s.label+':'+s.count+'('+s.rate+'%)'; }).join(' → '));
  chk('基数 = 6（不含待投递）', f.base === 6, f.base);
  chk('已投递 = 6', f.steps[0].count === 6, f.steps[0].count);
  chk('进测评 = 5', f.steps[1].count === 5, f.steps[1].count);
  chk('进面试 = 4', f.steps[2].count === 4, f.steps[2].count);
  chk('进终面 = 3', f.steps[3].count === 3, f.steps[3].count);
  chk('拿 Offer = 1', f.steps[4].count === 1, f.steps[4].count);
  var mono = true;
  for (var i=1;i<f.steps.length;i++) if (f.steps[i].count > f.steps[i-1].count) mono = false;
  chk('★ 各档单调递减（漏斗图形才有意义）', mono, f.steps.map(function(s){return s.count;}).join(','));

  section('B 已挂的记录按"走到过哪一步"算');
  jobs = [
    mk({ id:'b1', company:'挂在一面', status:'failed' }),
    mk({ id:'b2', company:'挂在终面', status:'failed', applyDate:'2026-09-02' }),
    mk({ id:'b3', company:'正常进面', status:'interview2' })
  ];
  reviews = [
    sanitizeReview({ id:'r1', company:'挂在一面', stage:'interview1', date:'2026-09-10', title:'t', content:'c', next:'', files:[] }),
    sanitizeReview({ id:'r2', company:'挂在终面', stage:'hr', date:'2026-09-11', title:'t', content:'c', next:'', files:[] })
  ];
  var f2 = buildFunnel(jobs);
  R.push('INFO :: 含已挂的漏斗 = ' + f2.steps.map(function(s){ return s.label+':'+s.count; }).join(' → '));
  chk('已投递 = 3', f2.steps[0].count === 3, f2.steps[0].count);
  chk('★ 进面试 = 3（两条失败记录用复盘阶段兜底算进来）', f2.steps[2].count === 3, f2.steps[2].count);
  chk('进终面 = 2', f2.steps[3].count === 2, f2.steps[3].count);
  chk('拿 Offer = 0', f2.steps[4].count === 0, f2.steps[4].count);

  section('C 分维度统计');
  jobs = [
    mk({ id:'c1', companyType:'互联网', status:'interview1' }),
    mk({ id:'c2', companyType:'互联网', status:'applied' }),
    mk({ id:'c3', companyType:'外企', status:'offer' }),
    mk({ id:'c4', companyType:'', status:'applied' })
  ];
  reviews = [];
  var byType = groupStats(jobs, function(j){ return j.companyType; });
  R.push('INFO :: 按性质 = ' + byType.map(function(g){ return g.label+' 投'+g.total+' 面'+g.interview+'('+g.rate+'%)'; }).join(' | '));
  chk('互联网：投 2 进面 1', byType.some(function(g){ return g.label==='互联网' && g.total===2 && g.interview===1; }));
  chk('外企：投 1 进面 1', byType.some(function(g){ return g.label==='外企' && g.total===1 && g.interview===1; }));
  chk('空性质归入「未标注」', byType.some(function(g){ return g.label==='未标注'; }), byType.map(function(g){return g.label;}).join(','));
  chk('按投递数排序（互联网在前）', byType[0].label === '互联网', byType[0].label);

  section('D 按简历版本对比');
  jobs = [
    mk({ id:'d1', resumeVersion:'后端版 v1', status:'applied' }),
    mk({ id:'d2', resumeVersion:'后端版 v1', status:'applied' }),
    mk({ id:'d3', resumeVersion:'后端版 v2', status:'interview1' }),
    mk({ id:'d4', resumeVersion:'后端版 v2', status:'offer' }),
    mk({ id:'d5', resumeVersion:'', status:'applied' })
  ];
  var byV = groupStats(jobs, function(j){ return j.resumeVersion; });
  R.push('INFO :: 按简历版本 = ' + byV.map(function(g){ return g.label+' 投'+g.total+' 面'+g.interview+' offer'+g.offer+'('+g.rate+'%)'; }).join(' | '));
  chk('v1：投 2 进面 0', byV.some(function(g){ return g.label==='后端版 v1' && g.total===2 && g.interview===0; }));
  chk('v2：投 2 进面 2', byV.some(function(g){ return g.label==='后端版 v2' && g.total===2 && g.interview===2; }));
  chk('★ v2 的进面率 100%', byV.some(function(g){ return g.label==='后端版 v2' && g.rate===100; }));

  section('E 渲染到弹窗');
  jobs = [ mk({ id:'e1', status:'interview1', companyType:'互联网', resumeVersion:'v1' }),
           mk({ id:'e2', status:'applied', companyType:'互联网' }) ];
  openStats();
  var modal = document.getElementById('statsModal');
  chk('弹窗打开', modal.style.display === 'flex', modal.style.display);
  var body = document.getElementById('statsBody');
  chk('渲染出漏斗', body.querySelectorAll('.fn-row').length === 5, body.querySelectorAll('.fn-row').length);
  chk('渲染出结果卡', body.querySelectorAll('.fn-card').length === 4, body.querySelectorAll('.fn-card').length);
  chk('渲染出两张分组表', body.querySelectorAll('.fn-table').length === 2, body.querySelectorAll('.fn-table').length);
  chk('提示还有多少条没填简历版本', body.textContent.indexOf('没有填「这版投的简历」') !== -1);
  closeStats();
  chk('关闭后隐藏', modal.style.display === 'none', modal.style.display);

  section('F 没有已投递记录时的空态');
  jobs = [ mk({ id:'f1', status:'pending' }) ];
  openStats();
  chk('显示引导文案', document.getElementById('statsBody').textContent.indexOf('还没有「已投递」') !== -1,
      document.getElementById('statsBody').textContent.slice(0,40));
  chk('不渲染漏斗', document.querySelectorAll('#statsBody .fn-row').length === 0);
  closeStats();

  section('G 全部填了简历版本时不显示提示');
  jobs = [ mk({ id:'g1', status:'applied', resumeVersion:'v1' }) ];
  openStats();
  chk('无提示', document.getElementById('statsBody').textContent.indexOf('没有填「这版投的简历」') === -1);
  closeStats();

  jobs = []; reviews = [];
  return R;
})();
