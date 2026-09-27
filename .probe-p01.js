return (async function () {
  var R=[]; function line(s){R.push(s);} function ms(t){return Math.round((performance.now()-t)*10)/10;}
  function chk(n,c,e){ R.push((c?"PASS":"FAIL")+" :: "+n+(e!==undefined&&!c?" :: "+e:"")); }
  await syncQiuzhiFangzhou();
  var sm=document.getElementById('syncResultModal'); if(sm) sm.style.display='none';
  line('INFO :: jobList=' + jobList.length);

  line('--- P0-1 省份筛选 ---');
  var t=performance.now();
  var n=0; jobList.forEach(function(j){ (j.cities||[]).forEach(function(c){ if(getProvinceForCity(c)) n++; }); });
  line('INFO :: 旧实现（各自遍历30个省份）等价的查表调用 × ' + n + ' 次 = ' + ms(t) + 'ms');
  t=performance.now(); exploreFilters.provinces.add('广东'); renderExplore();
  line('INFO :: ★ 带省份筛选 renderExplore() = ' + ms(t) + 'ms（重构前 20.1ms）');
  exploreFilters.provinces.clear(); renderExplore();

  line('--- P0-2 加入投递（局部更新）---');
  switchTab('explore');
  renderExplore();
  // 造一条可加入的岗位在最前面
  var target = null;
  for (var i=0;i<jobList.length;i++){ if (jobList[i].qiuzhiId && getTrackJobsByCompany(jobList[i].company).length===0) { target=jobList[i]; break; } }
  if (target) {
    // 把它挪到首位以便命中前 200 行的渲染范围
    jobList = [target].concat(jobList.filter(function(x){return x!==target;}));
    renderExplore();
    t=performance.now();
    addToTrack(target.id, 'pending');
    line('INFO :: ★ 一次加入投递（全链路）= ' + ms(t) + 'ms（重构前 11.3ms）');
    chk('加入后该行已变为徽章', !!document.querySelector('tr[data-id="'+target.id+'"] .tracked-badge'));
    chk('已无该行的下拉', !document.querySelector('tr[data-id="'+target.id+'"] select'));
    chk('投递管理计数已更新', Number(document.getElementById('trackCount').textContent) === jobs.length);
    // 公司徽章是否同步出现
    chk('公司名后出现徽章', document.querySelector('tr[data-id="'+target.id+'"] .expl-company .tracked-badge') !== null,
        (document.querySelector('tr[data-id="'+target.id+'"] .expl-company')||{}).innerHTML);
  }

  line('--- P1-2 重复渲染是否减少 ---');
  var calls={}; var origs={};
  ['renderExplore','renderTrack','renderTrackView','renderTrackStats','renderReviews'].forEach(function(fn){
    if(typeof window[fn]!=='function') return;
    origs[fn]=window[fn];
    window[fn]=function(){ var k=fn+'('+arguments.length+')'; calls[k]=(calls[k]||0)+1; return origs[fn].apply(this,arguments); };
  });
  // 一轮典型操作（与重构前同样的操作序列）
  switchTab('track'); trackView='list'; renderTrack(); trackView='board'; renderTrack();
  switchTab('explore');
  var se=document.getElementById('exploreSearch'); if(se){ se.value='科技'; renderExplore(); se.value=''; renderExplore(); }
  switchTab('review'); switchTab('explore');
  Object.keys(origs).forEach(function(fn){ window[fn]=origs[fn]; });
  line('INFO :: 一轮操作中的渲染调用次数：');
  Object.keys(calls).sort().forEach(function(k){ line('INFO ::   ' + k + ' → ' + calls[k] + ' 次'); });

  line('--- 关键：在岗位清单页改投递状态，是否还会重建看板 ---');
  var built = {board:0, list:0, star:0};
  var ob=window.renderBoard, ol=window.renderList, os=window.renderStarMap;
  window.renderBoard=function(){ built.board++; return ob.apply(this,arguments); };
  window.renderList=function(){ built.list++; return ol.apply(this,arguments); };
  window.renderStarMap=function(){ built.star++; return os.apply(this,arguments); };
  switchTab('explore');
  var t2=null;
  for (var k=0;k<jobList.length;k++){ if(jobList[k].qiuzhiId && getTrackJobsByCompany(jobList[k].company).length===0){ t2=jobList[k]; break; } }
  if(t2){ addToTrack(t2.id, 'applied'); }
  window.renderBoard=ob; window.renderList=ol; window.renderStarMap=os;
  line('INFO :: 在岗位清单页操作时，投递管理各视图被重建次数: 看板=' + built.board + ' 列表=' + built.list + ' 星图=' + built.star);
  chk('★ 未在不可见面板上浪费重建', built.board===0 && built.list===0 && built.star===0,
      'board='+built.board+' list='+built.list+' star='+built.star);
  return R;
})();
