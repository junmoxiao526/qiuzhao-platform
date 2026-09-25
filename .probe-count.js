return (async function () {
  var R=[]; function chk(n,c,e){ R.push((c?"PASS":"FAIL")+" :: "+n+(e!==undefined&&!c?" :: "+e:"")); }
  // 先拉全量共享池，复现用户看到的规模
  await pullJobPool(false, true);
  R.push('INFO :: jobList.length = ' + jobList.length);
  R.push('INFO :: 有 qiuzhiId 的岗位数 = ' + jobList.filter(function(j){return j.qiuzhiId;}).length);

  // 复刻页面统计逻辑
  var tracked = getTrackedStarJobIds();
  R.push('INFO :: tracked 集合大小（键总数，含 q: 与 s: 前缀） = ' + tracked.size);
  var qKeys = [], sKeys = [];
  tracked.forEach(function(k){ if (k.indexOf('q:')===0) qKeys.push(k); else if (k.indexOf('s:')===0) sKeys.push(k); });
  R.push('INFO :: tracked 中 q: 前缀 = ' + qKeys.length + '，s: 前缀 = ' + sKeys.length);

  var totalAll = jobList.length;
  var trackedAll = jobList.filter(function(j){ var k = j.qiuzhiId ? 'q:'+j.qiuzhiId : (j.starjobId ? 's:'+j.starjobId : ''); return k ? tracked.has(k) : false; }).length;
  R.push('INFO :: 统计卡 岗位总数 = ' + totalAll + '，已加入投递 = ' + trackedAll);

  // 关键：找出"有投递记录但池中查无此岗"的那些
  var matched = {}, poolKeys = {};
  jobList.forEach(function(j){ if (j.qiuzhiId) poolKeys['q:'+String(j.qiuzhiId)] = j.company; });
  var orphan = [];
  qKeys.forEach(function(k){ if (!poolKeys[k]) orphan.push(k); });
  R.push('INFO :: 投递记录里"池中查无此岗"的条数 = ' + orphan.length);
  orphan.slice(0,15).forEach(function(k){ R.push('INFO ::   孤儿键 ' + k); });

  // 另外：投递记录里有多少条根本没有 qiuzhiId（手动添加或旧数据）
  var noSrc = jobs.filter(function(j){
    try { var n = JSON.parse(j.notes||'{}'); return !(n.qiuzhiId||n.starjobId); } catch(e){ return true; }
  });
  R.push('INFO :: 投递记录总数 = ' + jobs.length);
  R.push('INFO :: 其中没有来源 id（手动/旧数据）= ' + noSrc.length);
  noSrc.slice(0,15).forEach(function(j){ R.push('INFO ::   无来源: ' + j.company + ' / ' + j.position + ' / 状态=' + j.status); });

  // 真实投递记录里有多少能匹配上岗位池
  var matchedJobs = jobs.filter(function(j){
    try { var n = JSON.parse(j.notes||'{}'); return n.qiuzhiId && poolKeys['q:'+String(n.qiuzhiId)]; } catch(e){ return false; }
  });
  R.push('INFO :: 投递记录能在池中匹配到岗位的 = ' + matchedJobs.length);
  return R;
})();
