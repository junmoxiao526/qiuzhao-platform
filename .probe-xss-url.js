// 安全回归：链接协议白名单（safeHref）
// 背景：岗位池（jobList）是共享且匿名可写的。攻击者可插入 url/noticeUrl 为
// javascript: 的记录；escapeHtml 只挡引号尖括号，挡不住协议 —— 用户点一下
// 「投递官网」就会在自己浏览器里执行攻击者的脚本。
var R = [];
function chk(n, c, e) { R.push((c ? 'PASS' : 'FAIL') + ' :: ' + n + (e !== undefined && !c ? ' :: ' + e : '')); }
function section(t) { R.push('-- ' + t + ' --'); }

section('A safeHref 白名单');
chk('safeHref 已定义', typeof safeHref === 'function');
chk('放行 https', safeHref('https://example.com/apply') === 'https://example.com/apply');
chk('放行 http', safeHref('http://example.com') === 'http://example.com');
chk('放行 mailto', safeHref('mailto:a@b.com') === 'mailto:a@b.com');
chk('放行 tel', safeHref('tel:12345') === 'tel:12345');
chk('拦截 javascript:', safeHref('javascript:alert(1)') === '', safeHref('javascript:alert(1)'));
chk('拦截大小写混写 Javascript:', safeHref('JaVaScRiPt:alert(1)') === '', safeHref('JaVaScRiPt:alert(1)'));
chk('拦截前置空白 javascript:', safeHref('  javascript:alert(1)') === '', JSON.stringify(safeHref('  javascript:alert(1)')));
chk('拦截制表符构造', safeHref('java\tscript:alert(1)') === '', JSON.stringify(safeHref('java\tscript:alert(1)')));
chk('拦截换行构造', safeHref('java\nscript:alert(1)') === '', JSON.stringify(safeHref('java\nscript:alert(1)')));
chk('拦截 vbscript:', safeHref('vbscript:msgbox(1)') === '');
chk('拦截 data:text/html', safeHref('data:text/html,<script>alert(1)<\/script>') === '');
chk('拦截 data:image/svg+xml', safeHref('data:image/svg+xml;base64,AAA') === '');
chk('拦截 file:', safeHref('file:///C:/Windows/System32/calc.exe') === '');
chk('拦截 blob:', safeHref('blob:https://evil.com/x') === '');
chk('拒绝空值', safeHref('') === '' && safeHref(null) === '' && safeHref(undefined) === '');
chk('拒绝畸形 URL', safeHref('http://') === '', JSON.stringify(safeHref('http://')));
chk('拒绝相对路径', safeHref('/etc/passwd') === '' && safeHref('foo.html') === '');

section('B 岗位清单渲染不产生可点击的恶意链接');
jobList.length = 0;
jobList.push({
  id: 'evil_list_1', qiuzhiId: 'qz_evil_1', company: '恶意测试公司',
  positionTypes: ['测试岗'], positionRaw: '测试岗', city: '上海', cities: ['上海'],
  typeTags: ['互联网'], industryRaw: '互联网', companyType: '大厂',
  url: 'javascript:window.__HREF_XSS=1', noticeUrl: 'javascript:window.__HREF_XSS=2',
  batch: '2026秋招', deadline: '', openingDate: '2026-09-01', popular: 1
});
var searchEl = document.getElementById('exploreSearch');
if (searchEl) searchEl.value = '';
renderExplore();
var rowEl = document.querySelector('[data-act="open-explore"]');
chk('岗位清单行已渲染', !!rowEl);
var rowHtml = rowEl ? rowEl.innerHTML : '';
chk('未生成 javascript: 的 href', rowHtml.indexOf('javascript:') === -1, rowHtml.indexOf('javascript:') !== -1 ? rowHtml.slice(Math.max(0, rowHtml.indexOf('javascript:') - 120), rowHtml.indexOf('javascript:') + 60) : '');
chk('恶意链接降级为占位符', rowHtml.indexOf('expl-dim') !== -1);
chk('未触发 href XSS', typeof window.__HREF_XSS === 'undefined', String(window.__HREF_XSS));

section('C 星图面板转义与链接校验');
var evilJob = sanitizeJob({
  id: 'evil_star_1', status: 'applied',
  company: '<img src=x onerror="window.__STAR_XSS=1">',
  position: '<script>window.__STAR_XSS=2<\/script>',
  city: '<b>bold</b>', companyType: '<i>type</i>',
  link: 'javascript:window.__STAR_XSS=3'
});
jobs.push(evilJob);
openStarPanel(evilJob);
var panel = document.getElementById('starPanel');
var pHtml = panel ? panel.innerHTML : '';
chk('星图面板已渲染', !!pHtml);
var REL_IMG_ONERROR = /<img[^>]*\sonerror/i;
var REL_SCRIPT = /<script[\s>]/i;
chk('面板无真实 img onerror', !REL_IMG_ONERROR.test(pHtml), pHtml.slice(Math.max(0, pHtml.search(/<img/i) - 60), pHtml.search(/<img/i) + 120));
chk('面板无真实 script 标签', !REL_SCRIPT.test(pHtml));
chk('面板无 javascript: 链接', pHtml.indexOf('javascript:') === -1);
chk('面板中公司名已转义', pHtml.indexOf('&lt;img') !== -1);
chk('未触发星图 XSS', typeof window.__STAR_XSS === 'undefined', String(window.__STAR_XSS));
var panelBtn = panel ? panel.querySelector('.sp-btn.primary') : null;
chk('面板按钮改用事件委托', !!panelBtn && panelBtn.dataset.act === 'edit', panelBtn && (panelBtn.dataset.act + '|' + panelBtn.getAttribute('onclick')));
chk('面板按钮无内联 onclick', !!panelBtn && !panelBtn.getAttribute('onclick'));

section('D 记录规范化拒绝协议');
var sj = sanitizeJob({ id: 'x1', company: 'A', link: 'javascript:alert(1)' });
chk('sanitizeJob 清空恶意 link', sj && sj.link === '', sj && sj.link);
var sj2 = sanitizeJob({ id: 'x2', company: 'B', link: 'https://ok.com' });
chk('sanitizeJob 保留正常 link', sj2 && sj2.link === 'https://ok.com', sj2 && sj2.link);

section('E 详情弹窗转义');
var dtlJob = sanitizeJob({ id: 'dtl_1', company: '详情公司', status: 'applied' });
dtlJob.applyDate = '2026-01-01'; dtlJob.deadline = '<img src=x onerror="window.__DTL_XSS=1">';
jobs.push(dtlJob);
openDetail('dtl_1');
var detailBody = document.getElementById('detailBody');
var dHtml = detailBody ? detailBody.innerHTML : '';
chk('详情弹窗已渲染', !!dHtml);
chk('详情弹窗无真实 img onerror', !REL_IMG_ONERROR.test(dHtml));
chk('详情弹窗未触发 XSS', typeof window.__DTL_XSS === 'undefined', String(window.__DTL_XSS));
var dm = document.getElementById('detailModal'); if (dm) dm.style.display = 'none';

section('F 源码层面不再有裸 href 拼接');
// 用主脚本自身的源码判断，而不是渲染后的 DOM
var big = null;
for (var si = 0; si < document.scripts.length; si++) {
  if ((document.scripts[si].textContent || '').length > 100000) big = document.scripts[si];
}
chk('能取到主脚本', !!big);
if (big) {
  var s = big.textContent;
  chk('源码无 href="+job.link 裸拼', s.indexOf('href="\' + job.link') === -1 && s.indexOf('"\' + job.link + \'"') === -1);
  chk('源码无 onclick="openEditModal 裸拼', s.indexOf("onclick=\"openEditModal('") === -1);
  chk('源码已引入 safeHref', s.indexOf('function safeHref') !== -1);
}

return R;
