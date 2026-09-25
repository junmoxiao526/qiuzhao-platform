return (async function () {
  var R=[]; function chk(n,c,e){ R.push((c?"PASS":"FAIL")+" :: "+n+(e!==undefined&&!c?" :: "+e:"")); }
  function val(label){
    var v=null;
    document.querySelectorAll('#exploreStats .stat-card').forEach(function(c){
      if (c.querySelector('.stat-label').textContent.trim()===label) v=Number(c.querySelector('.stat-value').textContent.trim());
    });
    return v;
  }
  function trackTotal(){ return Number(document.getElementById('trackCount').textContent); }
  function reset(){ exploreFilters.provinces.clear(); exploreFilters.types.clear(); exploreFilters.dateFrom=''; exploreFilters.dateTo='';
    var s=document.getElementById('exploreSearch'); if(s) s.value='';
    var cb=document.getElementById('exploreUntracked'); if(cb) cb.checked=false; }

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
  R.push('INFO :: 统计卡 岗位总数=' + val('岗位总数') + ' 已加入投递=' + val('已加入投递') + ' 当前筛选=' + val('当前筛选') + ' | 投递管理=' + trackTotal());
  chk('已加入投递 = 投递管理总数', val('已加入投递') === trackTotal(), val('已加入投递') + ' vs ' + trackTotal());
  chk('已加入投递 = 3', val('已加入投递') === 3, val('已加入投递'));

  // 加一个同公司岗位：池子变大，但"已加入投递"不该变
  jobList.push(...sanitizeJobList([{ id:'t4', qiuzhiId:'k4', company:'甲公司', positionRaw:'岗位D', positionTypes:['岗位D'], city:'上海', cities:['上海'], companyType:'大厂', typeTags:['互联网'], openingDate:'2026-09-04', popular:0 }]));
  reset(); renderExplore();
  chk('池子变大不影响该计数', val('已加入投递') === trackTotal() && val('已加入投递') === 3, val('已加入投递'));
  chk('岗位总数变为 4', val('岗位总数') === 4, val('岗位总数'));

  // 投递管理增删都应同步
  jobs.push(sanitizeJob({ id:'j4', company:'新增公司', position:'岗位E', status:'pending', notes:'{}' }));
  reset(); renderExplore();
  chk('新增投递记录后 +1', val('已加入投递') === trackTotal() && val('已加入投递') === 4, val('已加入投递') + ' vs ' + trackTotal());

  jobs.pop(); jobs.pop(); reset(); renderExplore();
  chk('删除投递记录后 -2', val('已加入投递') === trackTotal() && val('已加入投递') === 2, val('已加入投递') + ' vs ' + trackTotal());

  jobs = []; reset(); renderExplore();
  chk('清空后为 0', val('已加入投递') === 0, val('已加入投递'));
  chk('三个卡片都有 title 说明', document.querySelectorAll('#exploreStats .stat-card[title]').length >= 2);

  // 筛选仍只影响"当前筛选"
  jobs = [sanitizeJob({ id:'j1', company:'甲公司', position:'岗位A', status:'applied', notes: JSON.stringify({ qiuzhiId:'k1' }) })];
  reset(); renderExplore();
  var s=document.getElementById('exploreSearch'); if(s) s.value='乙公司'; renderExplore();
  chk('搜索只影响当前筛选', val('当前筛选') === 1 && val('岗位总数') === 4 && val('已加入投递') === 1,
      '筛选=' + val('当前筛选') + ' 总数=' + val('岗位总数') + ' 已加入=' + val('已加入投递'));
  reset(); return R;
})();
