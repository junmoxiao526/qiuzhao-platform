// 回归：岗位清单里「点公司名跳到投递管理」这条链路是否还通
// 我把内联 onclick 改成了 data-* + 委托，这里验证属性名与处理器是否对得上
var R = [];
function chk(n, c, e) { R.push((c ? 'PASS' : 'FAIL') + ' :: ' + n + (e !== undefined && !c ? ' :: ' + e : '')); }

// 1) 造一条岗位清单数据，并让它在投递管理里存在同公司记录（否则不渲染公司链接）
var listId = 'list_test_1';
jobList.push({
  id: listId, qiuzhiId: 'qz_test_1', company: '回归测试公司',
  positionTypes: ['测试岗'], positionRaw: '测试岗', city: '上海',
  cities: ['上海'], typeTags: ['互联网'], industryRaw: '互联网',
  companyType: '大厂', url: 'https://example.com/apply', noticeUrl: 'https://example.com/notice',
  batch: '2026秋招', deadline: '2026-10-01', openingDate: '2026-09-01', popular: 3
});
jobs.push(sanitizeJob({
  id: 'job_test_1', company: '回归测试公司', position: '测试岗',
  status: 'applied', city: '上海', notes: JSON.stringify({ qiuzhiId: 'qz_test_1' })
}));

renderExplore();
var link = document.querySelector('[data-act="goto-track-company"]');
chk('公司链接已渲染', !!link, '找不到 [data-act="goto-track-company"]');
if (link) {
  chk('data-company 属性存在', link.dataset.company === '回归测试公司', JSON.stringify(link.dataset.company));
  var attr = link.getAttribute('data-company');
  chk('getAttribute 可读到', attr === '回归测试公司', JSON.stringify(attr));

  // 2) 点击后应把投递管理的搜索框设为该公司名
  var search = document.getElementById('trackSearch');
  if (search) search.value = '';
  link.click();
  chk('点击后 trackSearch 被设为公司名', search && search.value === '回归测试公司', JSON.stringify(search && search.value));
}

// 3) 顺带验证「加入投递」按钮链路（造一条没有对应投递记录的岗位）
// 注意：这里必须精确定位到本用例自己那条岗位的按钮。
// 岗位池可能有数千条真实岗位，用 querySelector 取"第一个"会拿到别人的按钮，
// 断言就会变成随机通过/失败（这正是本用例此前失效的原因）。
jobList.push({
  id: 'list_test_2', qiuzhiId: 'qz_test_2', company: '未投递测试公司',
  positionTypes: ['待投岗'], positionRaw: '待投岗', city: '北京',
  cities: ['北京'], typeTags: ['金融'], industryRaw: '金融',
  companyType: '金融', url: 'https://example.com/apply2', noticeUrl: '',
  batch: '2026秋招', deadline: '', openingDate: '2026-09-01', popular: 1
});
var searchBox = document.getElementById('exploreSearch');
if (searchBox) searchBox.value = '未投递测试公司';   // 过滤到只剩本用例这一条
renderExplore();
var addBtn = document.querySelector('[data-act="add-to-track"]');
chk('本用例的按钮已定位', !!addBtn && addBtn.dataset.id === 'list_test_2',
    addBtn ? ('实际 data-id=' + addBtn.dataset.id) : 'no button');
if (addBtn) {
  var before = jobs.length;
  addBtn.click();
  chk('加入投递按钮生效', jobs.length === before + 1, 'before=' + before + ' after=' + jobs.length);
  var added = jobs[jobs.length - 1];
  chk('新增记录带来源 id', added && !!added.notes && added.notes.indexOf('qz_test_2') !== -1, added && added.notes);
  chk('新增记录状态为待投递', added && added.status === 'pending', added && added.status);
  chk('新增记录公司正确', added && added.company === '未投递测试公司', added && added.company);
}
if (searchBox) searchBox.value = '';

return R;
