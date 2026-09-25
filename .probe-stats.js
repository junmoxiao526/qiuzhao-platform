return (async function () {
  var R=[]; function chk(n,c,e){ R.push((c?"PASS":"FAIL")+" :: "+n+(e!==undefined&&!c?" :: "+e:"")); }
  function cards(){
    var out={};
    document.querySelectorAll('#exploreStats .stat-card').forEach(function(c){
      out[c.querySelector('.stat-label').textContent.trim()] = Number(c.querySelector('.stat-value').textContent.trim());
    });
    return out;
  }
  function setSearch(v){ var e=document.getElementById('exploreSearch'); if(e) e.value=v; }
  function resetFilters(){
    exploreFilters.provinces.clear(); exploreFilters.types.clear();
    exploreFilters.dateFrom=''; exploreFilters.dateTo='';
    setSearch('');
    var cb=document.getElementById('onlyUntracked'); if(cb) cb.checked=false;
    var sb=document.getElementById('showOnlyUntracked'); if(sb) sb.checked=false;
  }

  // 受控数据：3 条岗位，其中 1 条"已加入投递"
  jobList = sanitizeJobList([
    { id:'t1', qiuzhiId:'k1', company:'甲公司', positionRaw:'岗位A', positionTypes:['岗位A'], city:'上海', cities:['上海'], companyType:'大厂', typeTags:['互联网'], batch:'2026', deadline:'', openingDate:'2026-09-01', url:'', noticeUrl:'', popular:0 },
    { id:'t2', qiuzhiId:'k2', company:'乙公司', positionRaw:'岗位B', positionTypes:['岗位B'], city:'北京', cities:['北京'], companyType:'外企', typeTags:['外企'],  batch:'2026', deadline:'', openingDate:'2026-09-02', url:'', noticeUrl:'', popular:0 },
    { id:'t3', qiuzhiId:'k3', company:'丙公司', positionRaw:'岗位C', positionTypes:['岗位C'], city:'深圳', cities:['深圳'], companyType:'金融', typeTags:['金融'],  batch:'2026', deadline:'', openingDate:'2026-09-03', url:'', noticeUrl:'', popular:0 }
  ]);
  jobs = [sanitizeJob({ id:'j1', company:'甲公司', position:'岗位A', status:'applied',
    notes: JSON.stringify({ qiuzhiId:'k1', positionTypes:['岗位A'] }) })];

  resetFilters();
  renderExplore();
  var c0 = cards();
  R.push('INFO :: 无筛选时 -> ' + JSON.stringify(c0));
  chk('岗位总数 = 3', c0['岗位总数'] === 3, c0['岗位总数']);
  chk('已加入投递 = 1', c0['已加入投递'] === 1, c0['已加入投递']);
  chk('当前筛选 = 3（无筛选）', c0['当前筛选'] === 3, c0['当前筛选']);

  // 搜索后：当前筛选应变小，另两个不变
  setSearch('乙公司'); renderExplore();
  var c1 = cards();
  R.push('INFO :: 搜索"乙公司" -> ' + JSON.stringify(c1));
  chk('搜索后 当前筛选 = 1', c1['当前筛选'] === 1, c1['当前筛选']);
  chk('搜索不影响 岗位总数', c1['岗位总数'] === 3, c1['岗位总数']);
  chk('搜索不影响 已加入投递', c1['已加入投递'] === 1, c1['已加入投递']);

  // 省份筛选：广东 -> 只有深圳那条
  resetFilters();
  exploreFilters.provinces.add('广东'); renderExplore();
  var c2 = cards();
  R.push('INFO :: 筛选"广东" -> ' + JSON.stringify(c2));
  chk('省份筛选生效（当前筛选 = 1）', c2['当前筛选'] === 1, c2['当前筛选']);

  // 仅未加入：应排除已加入的那条
  resetFilters();
  var cb = document.getElementById('onlyUntracked') || document.getElementById('showOnlyUntracked');
  R.push('INFO :: 仅未加入复选框 id = ' + (cb ? cb.id : '未找到'));
  if (cb) { cb.checked = true; renderExplore(); var c3 = cards();
    R.push('INFO :: 勾选"仅未加入" -> ' + JSON.stringify(c3));
    chk('仅未加入生效（当前筛选 = 2）', c3['当前筛选'] === 2, c3['当前筛选']);
  } else {
    R.push('INFO :: 页面无"仅未加入"复选框，跳过该项');
  }

  // 关键复现：投递记录里的岗位不在池中时，两个数字会不一致
  resetFilters();
  jobs.push(sanitizeJob({ id:'j2', company:'池外公司', position:'岗位X', status:'applied',
    notes: JSON.stringify({ qiuzhiId:'k999', positionTypes:['岗位X'] }) }));
  renderExplore();
  var c4 = cards();
  R.push('INFO :: 追加一条"池外"投递记录 -> ' + JSON.stringify(c4));
  R.push('INFO :: 投递管理计数 = ' + document.getElementById('trackCount').textContent);
  chk('已加入投递仍为 1（池外那条不计入）', c4['已加入投递'] === 1, c4['已加入投递']);
  chk('投递管理显示 2 条', Number(document.getElementById('trackCount').textContent) === 2, document.getElementById('trackCount').textContent);
  R.push('INFO :: 结论 —— 投递管理=' + document.getElementById('trackCount').textContent
    + ' 而 已加入投递=' + c4['已加入投递'] + '，差值 = ' + (Number(document.getElementById('trackCount').textContent) - c4['已加入投递']));

  resetFilters(); return R;
})();
