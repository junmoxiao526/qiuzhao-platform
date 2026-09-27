// 复盘页：右侧工作区已移除，编辑改走弹窗
return (async function () {
  var R = []; function chk(n, c, e) { R.push((c ? "PASS" : "FAIL") + " :: " + n + (e !== undefined && !c ? " :: " + e : "")); }
  function section(t) { R.push('-- ' + t + ' --'); }

  section('A 右侧工作区已彻底移除');
  chk('无 #reviewRight 容器', !document.getElementById('reviewRight'));
  chk('无「导入文件」按钮', !document.getElementById('reviewRightFileInput'));
  // 注意：不要用宽的 input[accept*=...] 判断 —— 编辑弹窗里的上传框是要保留的。
  // 只断言"被移除的那个"具体的 id 不存在。
  chk('无右栏文件输入框 #reviewRightFileInput', !document.getElementById('reviewRightFileInput'));
  chk('无右栏文件条 #reviewRightFileStrip', !document.getElementById('reviewRightFileStrip'));
  chk('弹窗内的上传框仍在（要保留）', !!document.getElementById('reviewFileInput'));
  chk('弹窗内的待选/已有附件列表仍在', !!document.getElementById('reviewPendingList') && !!document.getElementById('reviewExistingList'));
  chk('无预览区', !document.getElementById('reviewRightPreviewArea'));
  chk('无「导出 Word」按钮', !document.getElementById('reviewRightExportWord'));
  chk('无提示文字节点', !document.getElementById('reviewRightHint'));

  section('B 相关全局函数已删除');
  ['loadReviewToRight', 'renderRightFiles', 'handleRightFiles', 'previewRightFile',
   'removeRightFile', 'closeRightPreview', 'exportRightWord', 'setReviewRightHint']
    .forEach(function (fn) {
      chk('已无 ' + fn, typeof window[fn] === 'undefined');
    });

  section('C 数据与其它函数未受影响');
  ['openReviewModal', 'saveReview', 'editReview', 'deleteReview', 'renderReviews',
   'previewExistingFile', 'previewPendingFile', 'handleReviewFiles', 'findReview']
    .forEach(function (fn) {
      chk('仍有 ' + fn, typeof window[fn] === 'function');
    });
  chk('附件预览弹窗仍在（弹窗内预览用）', !!document.getElementById('reviewPreviewModal'));
  chk('弹窗预览容器仍在', !!document.getElementById('reviewPreviewBody'));

  section('D 复盘卡片：点击打开编辑弹窗');
  reviews = [
    sanitizeReview({ id: 'rv1', company: '测试公司A', job: '测试岗', stage: 'interview1',
      title: '一面还行', content: '内容内容内容', next: '继续准备', date: '2026-09-20', files: [] }),
    sanitizeReview({ id: 'rv2', company: '测试公司B', stage: 'interview2',
      title: '二面', content: '另一条内容', date: '2026-09-21',
      files: [{ name: 'att.png', type: 'image/png', size: 1234, base64: 'data:image/png;base64,iVBORw0KGgo=' }] })
  ];
  renderReviews();
  var cards = document.querySelectorAll('.review-card');
  chk('渲染出 2 张复盘卡片', cards.length === 2, cards.length);

  // 列表按日期倒序，第一张卡是 rv2；这里显式指定 rv1 以验证"点哪张开哪张"
  var card = document.querySelector('.review-card[data-act="review-edit"][data-id="rv1"]');
  chk('卡片使用 review-edit 动作', !!card);
  chk('点击 rv2 会打开 rv2（倒序第一张）', (function () {
    var c2 = document.querySelector('.review-card[data-act="review-edit"][data-id="rv2"]');
    return !!c2;
  })());
  chk('卡片无 review-load 动作', !document.querySelector('[data-act="review-load"]'));

  var modal = document.getElementById('reviewModal');
  if (modal) modal.style.display = 'none';
  card.click();
  chk('点击卡片打开编辑弹窗', modal && modal.style.display === 'flex', modal && modal.style.display);
  var companyInput = document.getElementById('reviewFormCompany');
  chk('弹窗已载入该条数据', companyInput && companyInput.value === '测试公司A', companyInput && companyInput.value);
  var editIdInput = document.getElementById('reviewFormEditId');
  chk('弹窗处于编辑模式（带 id）', editIdInput && editIdInput.value === 'rv1', editIdInput && editIdInput.value);
  closeReviewModal();

  section('E 附件芯片改为纯展示，仍显示文件信息');
  renderReviews();
  var chip = document.querySelector('.review-files .review-file-chip');
  chk('带附件的复盘渲染出芯片', !!chip, chip ? chip.textContent.trim() : '无');
  chk('芯片无点击动作（数据属性已移除）', !!chip && !chip.dataset.act, chip && JSON.stringify(chip.dataset));
  chk('芯片仍显示文件名', !!chip && chip.textContent.indexOf('att.png') !== -1, chip && chip.textContent.trim());

  section('F 「+ 添加复盘」仍可新建（非编辑模式）');
  renderReviews();
  openReviewModal();
  chk('新建时编辑 id 为空', (document.getElementById('reviewFormEditId') || {}).value === '',
      (document.getElementById('reviewFormEditId') || {}).value);
  chk('新建时公司输入框为空', (document.getElementById('reviewFormCompany') || {}).value === '',
      (document.getElementById('reviewFormCompany') || {}).value);
  closeReviewModal();

  section('G 左栏占满宽度（原为左右分栏）');
  switchTab('review');   // 面板未激活时尺寸恒为 0，必须先切过去
  var left = document.querySelector('.review-left');
  var layout = document.querySelector('.review-layout');
  chk('左栏存在', !!left);
  if (left && layout) {
    var lw = Math.round(left.getBoundingClientRect().width);
    var pw = Math.round(layout.getBoundingClientRect().width);
    R.push('INFO :: 左栏宽 ' + lw + 'px / 布局宽 ' + pw + 'px');
    chk('左栏确实有宽度（面板已激活）', lw > 200, lw);
    chk('左栏占据布局的绝大部分宽度', lw >= pw * 0.9, lw + ' / ' + pw);
  }
  reviews = [];
  renderReviews();
  return R;
})();
