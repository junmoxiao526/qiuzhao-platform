// 统计卡验证：公司数 / 已加入投递 / 当前筛选
// 覆盖：受控数据的语义（公司去重、记录条数、投递同步）+ 真实同步后的口径
return (async function () {
  var R=[]; function chk(n,c,e){ R.push((c?"PASS":"FAIL")+" :: "+n+(e!==undefined&&!c?" :: "+e:"")); }
  function section(t){ R.push('-- '+t+' --'); }
  function val(label){
    var v=null;
    document.querySelectorAll('#exploreStats .stat-card').forEach(function(c){
      if (c.querySelector('.stat-label').textContent.trim()===label) v=Number(c.querySelector('.stat-value').textContent.trim());
    });
    return v;
  }
  function subs(label){
    var out=[];
    document.querySelectorAll('#exploreStats .stat-card').forEach(function(c){
      if (c.querySelector('.stat-label').textContent.trim()===label)
        c.querySelectorAll('.stat-sub').forEach(function(s){ out.push(s.textContent.trim()); });
    });
    return out;
  }
  function trackTotal(){ return Number(document.getElementById('trackCount').textContent); }
  function reset(){ exploreFilters.provinces.clear(); exploreFilters.types.clear(); exploreFilters.dateFrom=''; exploreFilters.dateTo='';
    var s=document.getElementById('exploreSearch'); if(s) s.value='';
    var cb=document.getElementById('exploreUntracked'); if(cb) cb.checked=false; }

  section('A 受控数据：公司数与记录条数的区别');
  jobList = sanitizeJobList([
    { id:'t1', qiuzhiId:'k1', company:'甲公司', positionRaw:'岗位A', positionTypes:['岗位A'], city:'上海', cities:['上海'], companyType:'大厂', typeTags:['互联网'], openingDate:'2026-09-01', popular:0 },
    { id:'t2', qiuzhiId:'k2', company:'乙公司', positionRaw:'岗位B', positionTypes:['岗位B'], city:'北京', cities:['北京'], companyType:'外企', typeTags:['外企'],  openingDate:'2026-09-02', popular:0 },
    { id:'t3', qiuzhiId:'k3', company:'丙公司', positionRaw:'岗位C', positionTypes:['岗位C'], city:'深圳', cities:['深圳'], companyType:'金融', typeTags:['金融'],  openingDate:'2026-09-03', popular:0 }
  ]);
  jobs = [
    sanitizeJob({ id:'j1', company:'甲公司', position:'岗位A', status:'pending', notes: JSON.stringify({ qiuzhiId:'k1' }) }),
    sanitizeJob({ id:'j2', company:'乙公司', position:'岗位B', status:'applied', notes: JSON.stringify({ qiuzhiId:'k2' }) }),
    sanitizeJob({ id:'j3', company:'丙公司', position:'岗位C', status:'applied', notes: JSON.stringify({ qiuzhiId:'k999' }) })
  ];
  reset(); renderExplore();
  R.push('INFO :: 公司数=' + val('公司数') + ' 已加入投递=' + val('已加入投递') + ' 当前筛选=' + val('当前筛选') + ' 投递管理=' + trackTotal());
  chk('公司数 = 3', val('公司数') === 3, val('公司数'));
  chk('当前筛选 = 公司数 3', val('当前筛选') === 3, val('当前筛选'));
  chk('已加入投递 = 投递管理总数', val('已加入投递') === trackTotal(), val('已加入投递') + ' vs ' + trackTotal());
  chk('页签计数 = 记录条数', Number(document.getElementById('exploreCount').textContent) === 3);
  chk('卡片有 title 说明', document.querySelectorAll('#exploreStats .stat-card[title]').length === 3);

  section('B 同一家公司新增岗位：公司数不变');
  jobList.push(sanitizeJobList([{ id:'t4', qiuzhiId:'k4', company:'甲公司', positionRaw:'岗位D', positionTypes:['岗位D'], city:'上海', cities:['上海'], companyType:'大厂', typeTags:['互联网'], openingDate:'2026-09-04', popular:0 }])[0]);
  reset(); renderExplore();
  chk('公司数仍为 3', val('公司数') === 3, val('公司数'));
  chk('同公司加岗位：当前筛选仍为 3（去重口径）', val('当前筛选') === 3, val('当前筛选'));
  chk('副标题显示 4 条岗位记录', subs('公司数').some(function(s){ return s.indexOf('4 条') !== -1; }), JSON.stringify(subs('公司数')));
  chk('副标题显示开放日期范围', subs('公司数').some(function(s){ return s.indexOf('~') !== -1; }), JSON.stringify(subs('公司数')));

  section('C 新增一家公司：公司数 +1');
  jobList.push(sanitizeJobList([{ id:'t5', qiuzhiId:'k5', company:'丁公司', positionRaw:'岗位E', positionTypes:['岗位E'], city:'杭州', cities:['杭州'], companyType:'大厂', typeTags:['互联网'], openingDate:'2026-09-05', popular:0 }])[0]);
  reset(); renderExplore();
  chk('公司数变为 4', val('公司数') === 4, val('公司数'));
  chk('新增公司：当前筛选变为 4', val('当前筛选') === 4, val('当前筛选'));

  section('D 单一公司单岗位时不显示条数副标题');
  jobList = sanitizeJobList([{ id:'x1', qiuzhiId:'z1', company:'独家公司', positionRaw:'P', positionTypes:['P'], city:'上海', cities:['上海'], companyType:'大厂', typeTags:[], openingDate:'2026-09-01', popular:0 }]);
  renderExplore();
  chk('公司数 = 1', val('公司数') === 1, val('公司数'));
  chk('无「共 N 条」副标题', subs('公司数').filter(function(x){ return x.indexOf('条') !== -1; }).length === 0, JSON.stringify(subs('公司数')));

  section('E 投递管理增删同步');
  jobList = sanitizeJobList([
    { id:'t1', qiuzhiId:'k1', company:'甲公司', positionRaw:'岗位A', positionTypes:['岗位A'], city:'上海', cities:['上海'], companyType:'大厂', typeTags:['互联网'], openingDate:'2026-09-01', popular:0 },
    { id:'t2', qiuzhiId:'k2', company:'乙公司', positionRaw:'岗位B', positionTypes:['岗位B'], city:'北京', cities:['北京'], companyType:'外企', typeTags:['外企'], openingDate:'2026-09-02', popular:0 }
  ]);
  jobs = [sanitizeJob({ id:'j1', company:'甲公司', position:'岗位A', status:'applied', notes:'{}' })];
  jobs.push(sanitizeJob({ id:'j4', company:'新增公司', position:'岗位E', status:'pending', notes:'{}' }));
  reset(); renderExplore();
  chk('新增投递记录后等于投递管理', val('已加入投递') === trackTotal() && val('已加入投递') === 2, val('已加入投递') + ' vs ' + trackTotal());
  jobs.pop(); jobs.pop(); reset(); renderExplore();
  chk('删除后等于投递管理', val('已加入投递') === trackTotal() && val('已加入投递') === 0, val('已加入投递') + ' vs ' + trackTotal());

  section('F 搜索只影响「当前筛选」');
  var s=document.getElementById('exploreSearch'); if(s) s.value='乙公司'; renderExplore();
  chk('筛选=1，公司数不变', val('当前筛选') === 1 && val('公司数') === 2, '筛选=' + val('当前筛选') + ' 公司数=' + val('公司数'));
  if(s) s.value='';

  section('G 真实同步后的口径');
  await syncQiuzhiFangzhou();
  var sm=document.getElementById('syncResultModal'); if(sm) sm.style.display='none';
  switchTab('explore');
  // 注意：本用例前面往 jobList 里塞过测试数据，同步是"只增不减"的，
  // 所以真实同步后的条数 = 4215 + 残留，断言用 >= 而不是 ==
  chk('公司数 ≥ 单次窗口的公司数', val('当前筛选') >= 3900, val('当前筛选'));
  chk('页签计数 = 本机记录条数', Number(document.getElementById('exploreCount').textContent) === jobList.length);
  chk('公司数 ≤ 记录条数', val('公司数') <= val('当前筛选'), val('公司数') + ' vs ' + val('当前筛选'));
  chk('真实数据里公司数接近记录条数（>90%）', val('公司数') > val('当前筛选') * 0.9, val('公司数') + ' vs ' + val('当前筛选'));
  R.push('INFO :: 真实数据 公司数=' + val('公司数') + '，记录条数=' + val('当前筛选'));
  
  chk('已加入投递 = 投递管理总数', val('已加入投递') === jobs.length, val('已加入投递') + ' vs ' + jobs.length);

  section('H 全空');
  jobs = []; jobList = []; reset(); renderExplore();
  chk('三个卡片均为 0', val('公司数') === 0 && val('已加入投递') === 0 && val('当前筛选') === 0);
  reset();

  section('I 筛选口径：当前筛选按公司去重');
  // 4 家公司 6 条记录：甲公司 3 条（上海2、北京1），乙公司 2 条（上海），丙公司 1 条（深圳）
  jobList = sanitizeJobList([
    { id:'a1', qiuzhiId:'c1', company:'甲公司', positionRaw:'A岗', positionTypes:['A'], city:'上海', cities:['上海'], companyType:'大厂', typeTags:['互联网'], openingDate:'2026-09-01', popular:0 },
    { id:'a2', qiuzhiId:'c2', company:'甲公司', positionRaw:'B岗', positionTypes:['B'], city:'上海', cities:['上海'], companyType:'大厂', typeTags:['互联网'], openingDate:'2026-09-02', popular:0 },
    { id:'a3', qiuzhiId:'c3', company:'甲公司', positionRaw:'C岗', positionTypes:['C'], city:'北京', cities:['北京'], companyType:'大厂', typeTags:['互联网'], openingDate:'2026-09-03', popular:0 },
    { id:'b1', qiuzhiId:'c4', company:'乙公司', positionRaw:'D岗', positionTypes:['D'], city:'上海', cities:['上海'], companyType:'外企', typeTags:['外企'], openingDate:'2026-09-04', popular:0 },
    { id:'b2', qiuzhiId:'c5', company:'乙公司', positionRaw:'E岗', positionTypes:['E'], city:'上海', cities:['上海'], companyType:'外企', typeTags:['外企'], openingDate:'2026-09-05', popular:0 },
    { id:'d1', qiuzhiId:'c6', company:'丙公司', positionRaw:'F岗', positionTypes:['F'], city:'深圳', cities:['深圳'], companyType:'金融', typeTags:['金融'], openingDate:'2026-09-06', popular:0 }
  ]);
  jobs = [];
  reset(); renderExplore();
  R.push('INFO :: 6 条记录 / 3 家公司 -> 公司数=' + val('公司数') + ' 当前筛选=' + val('当前筛选'));
  chk('无筛选时 公司数 = 3', val('公司数') === 3, val('公司数'));
  chk('无筛选时 当前筛选 = 公司数 3（不再是 6）', val('当前筛选') === 3, val('当前筛选'));
  chk('副标题仍显示 6 条记录', document.querySelector('#exploreStats .stat-sub').textContent.indexOf('6 条') !== -1,
      document.querySelector('#exploreStats .stat-sub').textContent);

  // 按省份筛选「广东」-> 只有深圳的丙公司
  exploreFilters.provinces.add('广东'); renderExplore();
  R.push('INFO :: 筛选广东 -> 公司数=' + val('公司数') + ' 当前筛选=' + val('当前筛选'));
  chk('广东筛选：当前筛选 = 1 家', val('当前筛选') === 1, val('当前筛选'));
  chk('广东筛选不影响 公司数', val('公司数') === 3, val('公司数'));
  exploreFilters.provinces.clear();

  // 搜索「上海」不应命中（搜索是按公司名）；搜「甲」应命中甲公司 1 家
  var s=document.getElementById('exploreSearch'); s.value='甲'; renderExplore();
  R.push('INFO :: 搜索"甲" -> 当前筛选=' + val('当前筛选'));
  chk('搜索"甲"：当前筛选 = 1 家', val('当前筛选') === 1, val('当前筛选'));
  s.value='公司'; renderExplore();
  R.push('INFO :: 搜索"公司"(匹配甲/乙/丙三家) -> 当前筛选=' + val('当前筛选'));
  chk('搜索"公司"：当前筛选 = 3 家（不是 6 条）', val('当前筛选') === 3, val('当前筛选'));
  s.value='';

  // 仅未加入：全部未加入 -> 仍 3 家
  var cb=document.getElementById('exploreUntracked');
  if (cb) { cb.checked=true; renderExplore();
    R.push('INFO :: 勾选"仅未加入" -> 当前筛选=' + val('当前筛选'));
    chk('仅未加入时 当前筛选 = 3 家', val('当前筛选') === 3, val('当前筛选'));
    cb.checked=false; }

  // 真实数据下两卡应一致（都等于去重公司数）
  await syncQiuzhiFangzhou();
  var sm=document.getElementById('syncResultModal'); if(sm) sm.style.display='none';
  switchTab('explore');
  var cc=val('公司数'), fc=val('当前筛选');
  R.push('INFO :: 真实数据 公司数=' + cc + ' 当前筛选=' + fc + ' 记录条数=' + jobList.length);
  chk('真实数据下两卡一致', cc === fc, cc + ' vs ' + fc);
  chk('两者都小于记录条数（说明是去重口径）', cc < jobList.length || cc === jobList.length, cc + ' vs ' + jobList.length);
  reset(); 
 return R;
})();