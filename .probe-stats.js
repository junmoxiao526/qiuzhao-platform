// 统计卡语义验证（公司数 / 已加入投递 / 当前筛选）
// 2026-09 调整：主卡由「岗位总数（记录条数）」改为「公司数（去重）」
return (async function () {
  var R=[]; function chk(n,c,e){ R.push((c?"PASS":"FAIL")+" :: "+n+(e!==undefined&&!c?" :: "+e:"")); }
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

  // 3 家公司、3 条记录
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
  chk('当前筛选 = 记录条数 3', val('当前筛选') === 3, val('当前筛选'));
  chk('已加入投递 = 投递管理总数', val('已加入投递') === trackTotal(), val('已加入投递') + ' vs ' + trackTotal());

  // 同一家公司再加一个岗位：公司数不变，记录条数 +1
  jobList.push(sanitizeJobList([{ id:'t4', qiuzhiId:'k4', company:'甲公司', positionRaw:'岗位D', positionTypes:['岗位D'], city:'上海', cities:['上海'], companyType:'大厂', typeTags:['互联网'], openingDate:'2026-09-04', popular:0 }])[0]);
  reset(); renderExplore();
  chk('同公司加岗位：公司数仍为 3', val('公司数') === 3, val('公司数'));
  chk('同公司加岗位：记录条数变为 4', val('当前筛选') === 4, val('当前筛选'));
  chk('副标题显示 4 条岗位记录', subs('公司数').some(function(s){ return s.indexOf('4 条') !== -1; }), JSON.stringify(subs('公司数')));

  // 新增一家公司：公司数 +1
  jobList.push(sanitizeJobList([{ id:'t5', qiuzhiId:'k5', company:'丁公司', positionRaw:'岗位E', positionTypes:['岗位E'], city:'杭州', cities:['杭州'], companyType:'大厂', typeTags:['互联网'], openingDate:'2026-09-05', popular:0 }])[0]);
  reset(); renderExplore();
  chk('新增公司：公司数变为 4', val('公司数') === 4, val('公司数'));
  chk('记录条数变为 5', val('当前筛选') === 5, val('当前筛选'));

  // 投递管理增删应同步「已加入投递」
  jobs.push(sanitizeJob({ id:'j4', company:'新增公司', position:'岗位E', status:'pending', notes:'{}' }));
  reset(); renderExplore();
  chk('新增投递记录后 +1 且等于投递管理', val('已加入投递') === trackTotal() && val('已加入投递') === 4, val('已加入投递') + ' vs ' + trackTotal());
  jobs.pop(); jobs.pop(); reset(); renderExplore();
  chk('删除投递记录后 -2 且等于投递管理', val('已加入投递') === trackTotal() && val('已加入投递') === 2, val('已加入投递') + ' vs ' + trackTotal());

  // 搜索只影响「当前筛选」
  var s=document.getElementById('exploreSearch'); if(s) s.value='乙公司'; renderExplore();
  chk('搜索只影响当前筛选', val('当前筛选') === 1 && val('公司数') === 4 && val('已加入投递') === 2,
      '筛选=' + val('当前筛选') + ' 公司数=' + val('公司数') + ' 已加入=' + val('已加入投递'));
  if(s) s.value='';

  // 清空
  jobs = []; jobList = []; reset(); renderExplore();
  chk('全空时三个卡片均为 0', val('公司数') === 0 && val('已加入投递') === 0 && val('当前筛选') === 0);
  reset(); return R;
})();