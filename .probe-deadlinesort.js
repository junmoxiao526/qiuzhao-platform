return (async function () {
  var R=[]; function chk(n,c,e){ R.push((c?"PASS":"FAIL")+" :: "+n+(e!==undefined&&!c?" :: "+e:"")); }
  function section(t){ R.push('-- '+t+' --'); }
  function off(n){ var d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+n);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function mk(o){ return sanitizeJob(Object.assign({ id:'s'+Math.random().toString(36).slice(2,7),
    qiuzhiId:'qs'+Math.random().toString(36).slice(2,7), company:'排序公司', positionRaw:'岗位',
    positionTypes:['岗位'], cities:['上海'], batch:'27秋招', openingDate: off(-5),
    addedAt: new Date().toISOString() }, o)); }

  section('A 排序按钮存在');
  var btns = document.querySelectorAll('.sort-btn');
  var labels = Array.prototype.map.call(btns, function(b){ return b.dataset.sort; });
  R.push('INFO :: 排序按钮 = ' + labels.join(', '));
  chk('有「临近截止」按钮', labels.indexOf('deadline') !== -1, labels.join(','));

  section('B 按截止日期由近到远');
  jobList = [
    mk({ id:'a', company:'还没截止', deadline: off(30) }),
    mk({ id:'b', company:'今天截止', deadline: off(0) }),
    mk({ id:'c', company:'已截止', deadline: off(-10) }),
    mk({ id:'d', company:'三天后', deadline: off(3) }),
    mk({ id:'e', company:'无截止', deadline: '' })
  ];
  var fakeBtn = document.querySelector('.sort-btn[data-sort="deadline"]');
  setSort(fakeBtn);
  var rows = document.querySelectorAll('.explore-table tbody tr');
  var order = Array.prototype.map.call(rows, function(r){
    var tds = r.children;
    return tds[3].textContent.trim().replace('🕒','');
  });
  R.push('INFO :: 排序结果 = ' + order.join(' → '));
  chk('★ 已截止排第一（最紧急）', order[0] === '已截止', order[0]);
  chk('今天截止第二', order[1] === '今天截止', order[1]);
  chk('三天后第三', order[2] === '三天后', order[2]);
  chk('远期第四', order[3] === '还没截止', order[3]);
  chk('★ 无截止日期的排最后', order[4] === '无截止', order[4]);

  section('C 无截止日期不会被误当成"今天截止"');
  jobList = [ mk({ id:'x', company:'无截止', deadline: '' }), mk({ id:'y', company:'有截止', deadline: off(5) }) ];
  renderExplore();
  var rows2 = document.querySelectorAll('.explore-table tbody tr');
  var names = Array.prototype.map.call(rows2, function(r){ return r.children[3].textContent.trim().replace('🕒',''); });
  chk('有截止的排前面', names[0] === '有截止', names.join(','));

  section('D 切回其它排序正常');
  setSort(document.querySelector('.sort-btn[data-sort="updated"]'));
  chk('切回最近更新', exploreSort === 'updated', exploreSort);
  setSort(document.querySelector('.sort-btn[data-sort="opened"]'));
  chk('切到最新开放', exploreSort === 'opened', exploreSort);

  jobList = []; renderExplore();
  setSort(document.querySelector('.sort-btn[data-sort="updated"]'));
  return R;
})();
