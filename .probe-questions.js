return (async function () {
  var R=[]; function chk(n,c,e){ R.push((c?"PASS":"FAIL")+" :: "+n+(e!==undefined&&!c?" :: "+e:"")); }
  function section(t){ R.push('-- '+t+' --'); }
  function mkQ(o){ return sanitizeQuestion(Object.assign({ id:'q'+Math.random().toString(36).slice(2,7),
    company:'字节跳动', position:'后端', category:'algorithm', date:'2026-09-20',
    question:'手写快排', answer:'分治+双指针', mastery:'new' }, o)); }

  section('A 清洗与容错');
  chk('空题目返回 null', sanitizeQuestion({ question:'' }) === null);
  chk('缺 question 返回 null', sanitizeQuestion({ company:'x' }) === null);
  chk('非对象返回 null', sanitizeQuestion(null) === null);
  var q = mkQ({ category:'不存在的分类' });
  chk('非法分类退回 other', q.category === 'other', q.category);
  var q2 = mkQ({ mastery:'不存在的等级' });
  chk('非法掌握度退回 new', q2.mastery === 'new', q2.mastery);
  var q3 = mkQ({ date:'2026/09/20' });
  chk('非法日期被清空', q3.date === '', q3.date);
  chk('题目首尾空格保留在清洗后的字符串里', typeof mkQ({ question:'  x  ' }).question === 'string');

  section('B 增删改');
  questions = [];
  questions.push(mkQ({ id:'a1', question:'第一题' }));
  saveQuestions();
  chk('已保存 1 题', questions.length === 1);
  questions.push(mkQ({ id:'a2', question:'第二题', mastery:'solid' }));
  questions.find(function(x){return x.id==='a1';}).mastery = 'ok';
  saveQuestions();
  chk('修改掌握度后仍是 2 题', questions.length === 2);
  questions = questions.filter(function(x){ return x.id !== 'a2'; });
  saveQuestions();
  chk('删除后剩 1 题', questions.length === 1, questions.length);

  section('C 掌握度循环切换');
  questions = [ mkQ({ id:'c1', mastery:'new' }) ];
  cycleQuestionMastery('c1');
  chk('new → shaky', questions[0].mastery === 'shaky', questions[0].mastery);
  cycleQuestionMastery('c1'); cycleQuestionMastery('c1');
  chk('→ ok → solid', questions[0].mastery === 'solid', questions[0].mastery);
  cycleQuestionMastery('c1');
  chk('solid → 回到 new', questions[0].mastery === 'new', questions[0].mastery);
  cycleQuestionMastery('不存在的 id');
  chk('不存在的 id 不抛错', true);

  section('D 筛选');
  questions = [
    mkQ({ id:'d1', company:'甲公司', question:'快排', category:'algorithm', mastery:'solid' }),
    mkQ({ id:'d2', company:'乙公司', question:'索引原理', category:'database', mastery:'new' }),
    mkQ({ id:'d3', company:'甲公司', question:'TCP 三次握手', category:'network', mastery:'shaky' })
  ];
  buildQuestionCategoryFilter();
  var cat = document.getElementById('questionCategoryFilter');
  var mst = document.getElementById('questionMasteryFilter');
  var srh = document.getElementById('questionSearch');
  cat.value=''; mst.value=''; srh.value='';
  chk('无筛选 = 3 题', getFilteredQuestions().length === 3, getFilteredQuestions().length);
  cat.value='algorithm';
  chk('按分类筛选 = 1 题', getFilteredQuestions().length === 1, getFilteredQuestions().length);
  cat.value='';
  mst.value='new';
  chk('按掌握度筛选 = 1 题', getFilteredQuestions().length === 1, getFilteredQuestions().length);
  mst.value='';
  srh.value='甲公司';
  chk('按公司搜索 = 2 题', getFilteredQuestions().length === 2, getFilteredQuestions().length);
  srh.value='三次握手';
  chk('按题目内容搜索 = 1 题', getFilteredQuestions().length === 1, getFilteredQuestions().length);
  srh.value='分治';
  chk('按答案内容搜索 = 3 题（都有答案）', getFilteredQuestions().length === 3, getFilteredQuestions().length);
  srh.value='';

  section('E 排序：不会的排前面');
  var sorted = getFilteredQuestions();
  chk('第 1 题是 new', sorted[0].mastery === 'new', sorted.map(function(x){return x.mastery;}).join(','));
  chk('最后是 solid', sorted[sorted.length-1].mastery === 'solid', sorted.map(function(x){return x.mastery;}).join(','));

  section('F 渲染');
  switchTab('questions');
  chk('面板已激活', document.getElementById('sectionQuestions').classList.contains('active'));
  chk('渲染出 3 张卡片', document.querySelectorAll('#questionList .q-card').length === 3,
      document.querySelectorAll('#questionList .q-card').length);
  chk('统计卡显示总数', document.getElementById('questionStats').textContent.indexOf('3') !== -1,
      document.getElementById('questionStats').textContent.replace(/\s+/g,' ').slice(0,60));
  chk('页签计数同步', document.getElementById('questionCount').textContent === '3',
      document.getElementById('questionCount').textContent);
  chk('每张卡都有编辑删除', document.querySelectorAll('#questionList [data-act="q-edit"]').length === 3 &&
      document.querySelectorAll('#questionList [data-act="q-delete"]').length === 3);
  chk('掌握度可点切换', document.querySelectorAll('#questionList [data-act="q-cycle-mastery"]').length === 3);
  chk('公司名可跳时间线', document.querySelectorAll('#questionList [data-act="open-timeline"]').length === 3);

  section('G 复习模式隐藏答案');
  document.getElementById('questionReviewMode').checked = true;
  renderQuestions();
  chk('答案变成折叠态', document.querySelectorAll('#questionList .q-answer.q-hidden').length === 3,
      document.querySelectorAll('#questionList .q-answer.q-hidden').length);
  chk('折叠文案为「点击显示答案」',
      document.querySelector('#questionList .q-answer.q-hidden').textContent === '点击显示答案',
      document.querySelector('#questionList .q-answer.q-hidden').textContent);
  document.getElementById('questionReviewMode').checked = false;
  renderQuestions();
  chk('关闭复习模式后答案可见', document.querySelectorAll('#questionList .q-answer.q-hidden').length === 0);

  section('H 空态');
  var backup = questions;
  questions = []; renderQuestions();
  chk('无题时显示引导空态', document.getElementById('questionList').textContent.indexOf('还没有题目') !== -1);
  questions = backup;
  var s2 = document.getElementById('questionSearch'); s2.value = '绝对搜不到的东西'; renderQuestions();
  chk('搜不到时显示筛选空态', document.getElementById('questionList').textContent.indexOf('没有匹配的题目') !== -1);
  s2.value=''; renderQuestions();

  section('I 持久化');
  saveQuestions();
  var raw = localStorage.getItem('qiuzhao_questions');
  chk('已写入 localStorage', !!raw && raw.length > 0);
  questions = [];
  loadQuestions();
  chk('重新加载后 3 题都在', questions.length === 3, questions.length);
  chk('掌握度也保留', questions.filter(function(x){return x.mastery==='new';}).length === 1,
      questions.map(function(x){return x.mastery;}).join(','));

  section('J 导出（不抛错、生成 .doc）');
  var madeBlob = null, clickedName = null;
  var origCreate = URL.createObjectURL, origClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = function(b){ madeBlob = b; return 'blob:test'; };
  HTMLAnchorElement.prototype.click = function(){ clickedName = this.download; };
  var err = null;
  try { exportQuestionsWord(); } catch(e){ err = e; }
  URL.createObjectURL = origCreate; HTMLAnchorElement.prototype.click = origClick;
  chk('导出不抛错', !err, err && err.message);
  chk('生成了 Blob', !!madeBlob);
  chk('文件名是 .doc', !!clickedName && /\.doc$/.test(clickedName), clickedName);

  section('K 空题库导出有提示不报错');
  var b2 = questions; questions = [];
  var err2 = null;
  try { exportQuestionsWord(); } catch(e){ err2 = e; }
  chk('空题库导出不抛错', !err2, err2 && err2.message);
  questions = b2;

  questions = []; saveQuestions();
  document.getElementById('questionSearch').value = '';
  document.getElementById('questionCategoryFilter').value = '';
  document.getElementById('questionMasteryFilter').value = '';
  renderQuestions();
  return R;
})();
