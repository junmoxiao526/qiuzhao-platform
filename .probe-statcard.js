return (async function () {
  var R=[]; function chk(n,c,e){ R.push((c?"PASS":"FAIL")+" :: "+n+(e!==undefined&&!c?" :: "+e:"")); }
  function card(label){
    var v=null;
    document.querySelectorAll('#exploreStats .stat-card').forEach(function(c){
      if (c.querySelector('.stat-label').textContent.trim()===label) v=Number(c.querySelector('.stat-value').textContent.trim());
    });
    return v;
  }
  await syncQiuzhiFangzhou();
  var sm=document.getElementById('syncResultModal'); if(sm) sm.style.display='none';
  switchTab('explore');
  chk('同步后 岗位总数 = 本机条数', card('岗位总数') === jobList.length, card('岗位总数') + ' vs ' + jobList.length);
  chk('同步后 岗位总数 = 4215', card('岗位总数') === 4215, card('岗位总数'));
  var sub=document.querySelector('#exploreStats .stat-card .stat-sub');
  chk('显示了开放日期范围', !!sub && sub.textContent.indexOf('~') !== -1, sub ? sub.textContent : 'missing');
  R.push('INFO :: 副标题 = ' + (sub ? sub.textContent : '(无)'));
  chk('已加入投递仍等于投递管理总数', card('已加入投递') === jobs.length);
  renderExplore();
  chk('重渲染后依然一致', card('岗位总数') === jobList.length);
  return R;
})();
