return (async function () {
  var R=[]; function chk(n,c,e){ R.push((c?"PASS":"FAIL")+" :: "+n+(e!==undefined&&!c?" :: "+e:"")); }
  function section(t){ R.push('-- '+t+' --'); }
  function off(n){ var d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+n);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }

  section('A 汇总四块数据');
  jobList = sanitizeJobList([{ id:'k1', qiuzhiId:'qk1', company:'时间线公司', positionRaw:'前端', positionTypes:['前端'],
    batch:'27秋招', cities:['上海'], deadline: off(10), openingDate: off(-5), addedAt: new Date(Date.now()-5*86400000).toISOString() }]);
  jobs = [sanitizeJob({ id:'j1', company:'时间线公司', position:'前端工程师', status:'interview1',
    applyDate: off(-20), lastContactAt: off(-2), deadline: off(10), interviewDate: off(1),
    assessDeadline: off(-10), aiDeadline: off(-15), resumeVersion:'后端版 v2', notes:'' })];
  reviews = [ sanitizeReview({ id:'r1', company:'时间线公司', stage:'interview1', date: off(-3),
    title:'一面复盘', content:'内容', next:'等结果', files:[] }) ];

  var tl = buildCompanyTimeline('时间线公司');
  R.push('INFO :: 时间线条目 = ' + tl.map(function(e){ return e.date+':'+e.title; }).join(' | '));
  chk('包含清单收录', tl.some(function(e){ return e.title==='清单收录'; }));
  chk('包含投递', tl.some(function(e){ return e.title==='投递'; }));
  chk('包含面试', tl.some(function(e){ return e.title==='面试'; }));
  chk('包含测评截止', tl.some(function(e){ return e.title==='测评截止'; }));
  chk('包含 AI 面截止', tl.some(function(e){ return e.title==='AI 面截止'; }));
  chk('包含最近联系', tl.some(function(e){ return e.title==='最近联系'; }));
  chk('包含复盘', tl.some(function(e){ return e.kind==='review'; }));
  chk('包含简历版本', tl.some(function(e){ return e.title==='简历版本'; }));

  section('B 按时间倒序，新的在上');
  var dated = tl.filter(function(e){ return e.date; });
  var sorted = true;
  for (var i=1;i<dated.length;i++) if (String(dated[i-1].date) < String(dated[i].date)) { sorted=false; break; }
  chk('日期倒序', sorted, dated.map(function(e){return e.date;}).join(','));
  chk('无日期的排最后（简历版本）', tl[tl.length-1].title === '简历版本', tl[tl.length-1].title);

  section('C 公司别名匹配（与清单徽章同一套口径）');
  jobs = [sanitizeJob({ id:'j2', company:'华勤', position:'岗位', status:'applied', applyDate: off(-3), notes:'' })];
  var tl2 = buildCompanyTimeline('华勤技术');
  chk('用别名「华勤技术」能查到记录的「华勤」', tl2.some(function(e){ return e.title==='投递'; }),
      tl2.map(function(e){return e.title;}).join(','));

  section('D 空数据不报错');
  chk('无记录的公司返回空数组', buildCompanyTimeline('完全不存在的公司').length === 0);
  chk('空公司名返回空数组', buildCompanyTimeline('').length === 0);
  chk('null 不抛错', buildCompanyTimeline(null).length === 0);

  section('E 弹窗渲染与跳转入口');
  jobList = sanitizeJobList([{ id:'k9', qiuzhiId:'qk9', company:'渲染公司', positionRaw:'岗位', positionTypes:['岗位'],
    cities:['上海'], deadline: off(5), openingDate: off(-2), addedAt: new Date().toISOString() }]);
  jobs = [sanitizeJob({ id:'j9', company:'渲染公司', position:'岗位', status:'applied', applyDate: off(-1), notes:'' })];
  reviews = [];
  openCompanyTimeline('渲染公司');
  var modal = document.getElementById('timelineModal');
  chk('弹窗已打开', modal.style.display === 'flex', modal.style.display);
  chk('标题含公司名', document.getElementById('timelineTitle').textContent.indexOf('渲染公司') !== -1,
      document.getElementById('timelineTitle').textContent);
  var body = document.getElementById('timelineBody');
  chk('渲染出时间线条目', body.querySelectorAll('.tl-item').length >= 2, body.querySelectorAll('.tl-item').length);
  chk('有条目可跳转', body.querySelectorAll('[data-act="tl-jump"]').length >= 1);
  chk('显示了四块数据的汇总', body.querySelector('.tl-meta').textContent.indexOf('投递记录') !== -1, body.querySelector('.tl-meta').textContent);
  chk('日期显示出来', !!body.querySelector('.tl-date'));
  closeTimeline();
  chk('关闭后隐藏', modal.style.display === 'none', modal.style.display);

  section('F 清单行有时间线按钮');
  renderExplore();
  var row = document.querySelector('.expl-row[data-id="k9"]');
  chk('行渲染出来', !!row);
  var btn = row.querySelector('[data-act="open-timeline"]');
  chk('行上有时间线按钮', !!btn);
  chk('按钮带上公司名', btn && btn.dataset.company === '渲染公司', btn && btn.dataset.company);

  section('G 汇总元信息计数正确');
  jobList = sanitizeJobList([
    { id:'ka', qiuzhiId:'qa', company:'计数公司', positionRaw:'A', positionTypes:['A'], cities:['上海'], deadline: off(3), openingDate: off(-1), addedAt: new Date().toISOString() },
    { id:'kb', qiuzhiId:'qb', company:'计数公司', positionRaw:'B', positionTypes:['B'], cities:['北京'], deadline: off(4), openingDate: off(-1), addedAt: new Date().toISOString() }
  ]);
  jobs = [
    sanitizeJob({ id:'jc', company:'计数公司', position:'A', status:'applied', applyDate: off(-1), notes:'' }),
    sanitizeJob({ id:'jd', company:'计数公司', position:'B', status:'pending', applyDate:'', notes:'' })
  ];
  reviews = [ sanitizeReview({ id:'rc', company:'计数公司', stage:'interview1', date: off(-1), title:'t', content:'c', next:'', files:[] }) ];
  openCompanyTimeline('计数公司');
  var metaTxt = document.querySelector('#timelineBody .tl-meta').textContent;
  R.push('INFO :: 汇总 = ' + metaTxt);
  chk('清单岗位 2 个', metaTxt.indexOf('清单岗位 2') !== -1, metaTxt);
  chk('投递记录 2 条', metaTxt.indexOf('投递记录 2') !== -1, metaTxt);
  chk('复盘 1 条', metaTxt.indexOf('复盘 1') !== -1, metaTxt);
  closeTimeline();

  jobList = []; jobs = []; reviews = [];
  renderExplore();
  return R;
})();
