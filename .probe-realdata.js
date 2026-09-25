return (async function () {
  var R=[]; function chk(n,c,e){ R.push((c?"PASS":"FAIL")+" :: "+n+(e!==undefined&&!c?" :: "+e:"")); }
  // 完全真实的 API 样本（从招聘方舟实际返回中摘取）
  var real = [
    { company:'新毅东', positions:'光学工程师、激光工程师、光机工程师、机械工程师、电气工程师、控制工程师、算法工程师、软件工程师', locations:'北京、上海', industry:'电子/半导体', typeTag:['科技'], createTime:'09.20', deadline:'2026-10-31', batch:'2026秋招', applyUrl:'https://example.com/x', noticeUrl:'', popular:'4', id:80001 },
    { company:'鸣熙资本', positions:'股票高频量化研究员、模型研究员、C++开发工程师、高性能计算与GPU加速工程师、金融业务管培生', locations:'上海', industry:'金融', typeTag:['金融'], createTime:'09.18', deadline:'', batch:'2026秋招', applyUrl:'https://example.com/y', noticeUrl:'', popular:'2', id:80002 },
    { company:'绿林工具', positions:'工业设计工程师、结构工程师、采购工程师、采购专员、电商运营、短视频内容、品牌推广、跨境运营', locations:'烟台、广州、深圳、上海', industry:'制造业', typeTag:['其他'], createTime:'09.15', deadline:'', batch:'', applyUrl:'https://example.com/z', noticeUrl:'', popular:'1', id:80003 }
  ];
  var out = qzTransformJobs([{ date:'2026-09-20', datas: real }]);
  chk('转换出 3 条', out.length === 3, out.length);
  out.forEach(function(j, i){
    R.push('INFO :: ' + j.company + ' | positionTypes=' + JSON.stringify(j.positionTypes) + ' | cities=' + JSON.stringify(j.cities) + ' | openingDate=' + j.openingDate);
  });
  chk('每条 positionTypes 都不含顿号', out.every(function(j){ return j.positionTypes.join('').indexOf('、') === -1; }));
  chk('每条 positionTypes 至少 2 项', out.every(function(j){ return j.positionTypes.length >= 2; }), JSON.stringify(out.map(function(j){return j.positionTypes.length;})));
  chk('每条 cities 至少 1 项', out.every(function(j){ return j.cities.length >= 1; }));
  chk('每条都不含空项', out.every(function(j){ return j.positionTypes.every(function(p){ return p && p.trim().length; }); }));
  chk('cities 也不含顿号', out.every(function(j){ return j.cities.join('').indexOf('、') === -1; }));
  chk('日期按招聘季推导（非硬编码）', out.every(function(j){ return j.openingDate.indexOf(String(recruitSeasonYear())) === 0; }), JSON.stringify(out.map(function(j){return j.openingDate;})));
  chk('popular 转为数字', out.every(function(j){ return typeof j.popular === 'number'; }));
  return R;
})();
