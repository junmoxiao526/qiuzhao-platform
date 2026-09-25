return (async function () {
  var R=[]; function chk(n,c,e){ R.push((c?"PASS":"FAIL")+" :: "+n+(e!==undefined&&!c?" :: "+e:"")); }
  function section(t){ R.push("-- "+t+" --"); }

  section('A 岗位字段拆分（用真实 API 返回的原文）');
  var cases = [
    ['光学工程师、激光工程师、光机工程师、机械工程师', 3, '光学工程师'],
    ['股票高频量化研究员、模型研究员、C++开发工程师', 3, '股票高频量化研究员'],
    ['管理培训生、研发工程师、调试工程师、销售工程师', 3, '管理培训生'],
    ['后端开发/前端开发', 2, '后端开发'],
    ['后端开发、前端开发', 2, '后端开发']
  ];
  cases.forEach(function(c){
    var out = qzSplitPositions(c[0]);
    chk('拆分「' + c[0].slice(0,18) + '…」得到 ' + c[1] + ' 项', out.length === c[1], JSON.stringify(out));
    chk('  首项为「' + c[2] + '」', out[0] === c[2], out[0]);
  });
  // 截断阈值是 12 个字；注意 '光子学研发工程师博士后' 只有 11 字，不该被截断
  chk('11 字不截断', qzSplitPositions('光子学研发工程师博士后、B')[0] === '光子学研发工程师博士后', qzSplitPositions('光子学研发工程师博士后、B')[0]);
  var longOne = qzSplitPositions('光子学研发工程师博士后岗位、B');
  chk('超 12 字截断加省略号', longOne[0].indexOf('…') !== -1 && longOne[0].length === 13, longOne[0]);
  chk('最多返回 3 项', qzSplitPositions('a、b、c、d、e、f').length === 3);

  section('B 城市字段拆分（对照，本就正确）');
  chk('顿号城市拆分', sjParseLocations('北京、上海').length === 2, JSON.stringify(sjParseLocations('北京、上海')));
  chk('多地城市拆分', sjParseLocations('烟台、广州、深圳、上海').length === 4, JSON.stringify(sjParseLocations('烟台、广州、深圳、上海')));

  section('C 端到端：同步后岗位类型正确落库并渲染');
  var origFetch = window.fetch;
  window.fetch = function () {
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ campusList: [{ date:'2026-09-01', datas: [
      { id: 91001, company: '顿号测试公司', positions: '算法工程师、软件工程师、硬件工程师、测试工程师',
        industry: '互联网/科技', typeTag: ['互联网'], locations: '北京、上海、深圳',
        createTime: '2026-09-01', deadline: '2026-12-01', batch: '2026秋招',
        applyUrl: 'https://example.com/a', noticeUrl: '', referralCode: '', popular: '3' }
    ] }] }); } });
  };
  await syncQiuzhiFangzhou();
  window.fetch = origFetch;
  var j = jobList.filter(function(x){ return String(x.qiuzhiId)==='91001'; })[0];
  chk('岗位已入库', !!j);
  if (j) {
    chk('positionTypes 拆成 3 项且不含顿号', j.positionTypes.length === 3 && j.positionTypes.join('').indexOf('、') === -1, JSON.stringify(j.positionTypes));
    chk('cities 拆成 3 项', j.cities.length === 3, JSON.stringify(j.cities));
    R.push('INFO :: 拆分结果 positionTypes=' + JSON.stringify(j.positionTypes) + ' cities=' + JSON.stringify(j.cities));
  }
  var sm=document.getElementById('syncResultModal'); if(sm) sm.style.display='none';

  section('D 表格渲染不再出现"整串截断"的岗位');
  var s=document.getElementById('exploreSearch'); if(s) s.value='顿号测试公司';
  renderExplore();
  var row=document.querySelector('[data-act="open-explore"]');
  chk('目标行已渲染', !!row);
  if (row) {
    var posCell = row.querySelector('.expl-pos');
    var txt = posCell ? posCell.textContent.trim() : '';
    R.push('INFO :: 岗位列文本 = ' + txt);
    chk('岗位列用「、」连接多个类型', txt.indexOf('、') !== -1, txt);
    chk('岗位列不再是单独的省略号截断', txt.indexOf('算法工程师、软件工程师、硬件工程师') === 0, txt);
  }
  if(s) s.value='';
  renderExplore();
  return R;
})();
