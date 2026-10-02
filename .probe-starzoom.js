// 星图：固定在中央不动，只能缩放
return (async function () {
  var R = []; function chk(n, c, e) { R.push((c ? "PASS" : "FAIL") + " :: " + n + (e !== undefined && !c ? " :: " + e : "")); }
  function section(t) { R.push('-- ' + t + ' --'); }
  var errors = [];
  window.addEventListener('error', function (e) { errors.push(e.message); });

  function seed() {
    var stages = ['pending','applied','assessment','exam','ai','interview1','interview2','hr','offer'];
    var counts = [3,5,8,4,6,7,5,4,2];
    jobs = []; var n = 0;
    stages.forEach(function (st, si) {
      for (var i = 0; i < counts[si]; i++) {
        n++;
        jobs.push(sanitizeJob({ id: 'sz' + n, company: '公司' + n, position: '岗位' + n, status: st, city: '上海', applyDate: '2026-09-01', notes: '' }));
      }
    });
  }

  section('A 渲染正常，没有平移代码残留');
  seed();
  switchTab('track');
  setTrackView('star');
  chk('星球渲染出来', starStars.length === 44, starStars.length);
  chk('zoom 接口存在', !!starZoomApi);
  chk('初始化缩放 = 1', starZoomApi.get() === 1, starZoomApi.get());
  chk('没有 JS 报错', errors.length === 0, errors.join(' | '));

  section('B ★ 星图固定在画布正中');
  var wrap = document.getElementById('starCanvasWrap');
  var W = wrap.clientWidth, H = wrap.clientHeight;
  // 所有星球应该围绕 (W/2, H/2)
  var xs = starStars.map(function (s) { return s.cx; });
  var ys = starStars.map(function (s) { return s.cy; });
  var cxSet = Array.from(new Set(xs)), cySet = Array.from(new Set(ys));
  chk('★ 所有星球共用同一个中心 X', cxSet.length === 1, cxSet.join(','));
  chk('★ 所有星球共用同一个中心 Y', cySet.length === 1, cySet.join(','));
  chk('★ 中心 X = 画布正中 W/2', Math.abs(cxSet[0] - W / 2) < 1, cxSet[0] + ' vs ' + (W / 2));
  chk('★ 中心 Y = 画布正中 H/2', Math.abs(cySet[0] - H / 2) < 1, cySet[0] + ' vs ' + (H / 2));

  section('C ★ 拖拽不会移动星图');
  var canvas = wrap.querySelector('canvas');
  var centersBefore = starStars.map(function (s) { return { cx: s.cx, cy: s.cy }; });
  var scaleBefore = starZoomApi.get();
  // 用力拖一把（按下 → 移动很远 → 抬起）
  canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100, button: 0 }));
  window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 600, clientY: 400 }));
  window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 900, clientY: 700 }));
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });
  var centersAfter = starStars.map(function (s) { return { cx: s.cx, cy: s.cy }; });
  var moved = centersAfter.filter(function (c, i) { return Math.abs(c.cx - centersBefore[i].cx) > 1e-9 || Math.abs(c.cy - centersBefore[i].cy) > 1e-9; }).length;
  chk('★ 拖拽后没有任何星球的轨道中心被改动', moved === 0, moved + ' 个被改动');
  chk('★ 拖拽不影响缩放比例', starZoomApi.get() === scaleBefore, starZoomApi.get());
  chk('★ 拖拽后中心仍为 W/2', Math.abs(starStars[0].cx - W / 2) < 1, starStars[0].cx);
  // 关键：屏幕坐标必须严格等于"以 (cx,cy) 为心 + 半径×缩放"的位置。
  // 如果还残留平移，|screenX - cx| 就会超出 rx×scale。
  var overshoot = 0;
  starStars.forEach(function (s) {
    var maxDx = s.rx * starZoomApi.get(), maxDy = s.ry * starZoomApi.get();
    if (Math.abs(s.screenX - s.cx) > maxDx + 0.5 || Math.abs(s.screenY - s.cy) > maxDy + 0.5) overshoot++;
  });
  chk('★ 拖拽后没有平移偏移（屏幕坐标未超出自身轨道范围）', overshoot === 0, overshoot + ' 颗越界');
  chk('拖拽没有抛错', errors.length === 0, errors.join(' | '));

  section('D 滚轮可以放大缩小，且始终居中');
  canvas.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100 }));
  chk('向上滚 → 放大', starZoomApi.get() > 1, starZoomApi.get());
  var z1 = starZoomApi.get();
  canvas.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 100 }));
  chk('向下滚 → 缩小', starZoomApi.get() < z1, starZoomApi.get());
  // 缩放后中心仍是 W/2
  await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });
  chk('★ 缩放后中心仍是 W/2', Math.abs(starStars[0].cx - W / 2) < 1, starStars[0].cx);
  // 缩放确实改变了屏幕半径
  var z2 = starZoomApi.get();
  canvas.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100 }));
  await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });
  var rNow = starStars[0].rx * starZoomApi.get();
  chk('屏幕半径随缩放变化', Math.abs(rNow - starStars[0].rx * z2) > 1, rNow.toFixed(1));

  section('E 缩放按钮');
  starZoomApi.reset();
  chk('复位到 1', starZoomApi.get() === 1, starZoomApi.get());
  var box = wrap.querySelector('.star-zoom');
  chk('缩放控件已渲染（不被 innerHTML 清空影响）', !!box);
  chk('有 ＋ / − / ⟲ 三个按钮', box && box.querySelectorAll('button').length === 3, box && box.querySelectorAll('button').length);
  var valEl = box && box.querySelector('.star-zoom-val');
  chk('显示当前比例', valEl && valEl.textContent === '100%', valEl && valEl.textContent);

  // 点按钮（走事件委托）
  var zoomIn = box.querySelector('[data-act="star-zoom-in"]');
  zoomIn.click();
  chk('★ 点「＋」放大', starZoomApi.get() > 1, starZoomApi.get());
  chk('★ 比例显示同步更新', valEl.textContent !== '100%', valEl.textContent);
  var zoomOut = box.querySelector('[data-act="star-zoom-out"]');
  zoomOut.click(); zoomOut.click();
  chk('点「－」缩小', starZoomApi.get() < 1, starZoomApi.get());
  var resetBtn = box.querySelector('[data-act="star-zoom-reset"]');
  resetBtn.click();
  chk('点「⟲」复位到 100%', starZoomApi.get() === 1 && valEl.textContent === '100%', valEl.textContent);

  section('F 缩放有上下限，不会缩到看不见或无限放大');
  for (var i = 0; i < 40; i++) starZoomApi.in();
  chk('★ 放大有上限（≤ ' + starZoomApi.max + '）', starZoomApi.get() <= starZoomApi.max, starZoomApi.get());
  for (var j = 0; j < 60; j++) starZoomApi.out();
  chk('★ 缩小有下限（≥ ' + starZoomApi.min + '）', starZoomApi.get() >= starZoomApi.min, starZoomApi.get());
  starZoomApi.reset();

  section('G 重新渲染后仍居中有缩放');
  seed();
  setTrackView('star');
  chk('重新渲染后缩放复位', starZoomApi.get() === 1, starZoomApi.get());
  chk('重新渲染后仍居中', Math.abs(starStars[0].cx - wrap.clientWidth / 2) < 1, starStars[0].cx);
  chk('重新渲染后缩放控件仍在', !!wrap.querySelector('.star-zoom'));
  chk('没有 JS 报错', errors.length === 0, errors.join(' | '));

  section('H 点星球仍能打开详情（没有被缩放控件挡住）');
  // 注意：重渲染后 wrap.innerHTML 被清空，旧的 canvas 已脱离文档，
  // 必须重新取当前的 canvas，否则事件派发不到新元素上。
  var canvas2 = wrap.querySelector('canvas');
  await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });
  var target = starStars[0];
  var rect2 = canvas2.getBoundingClientRect();
  canvas2.dispatchEvent(new MouseEvent('mousemove', {
    bubbles: true, clientX: rect2.left + target.screenX, clientY: rect2.top + target.screenY
  }));
  chk('悬停命中星球（tooltip 显示）',
      document.querySelector('.star-tooltip').style.display === 'block',
      JSON.stringify(document.querySelector('.star-tooltip').style.display));
  canvas2.click();
  var panel = document.getElementById('starPanel');
  chk('★ 点击后右侧显示投递详情', panel.textContent.indexOf(target.job.company) !== -1, panel.textContent.slice(0, 40));

  section('I 缩放控件不会挡住画布点击');
  var box2 = wrap.querySelector('.star-zoom');
  var zr = box2.getBoundingClientRect();
  var cr = canvas2.getBoundingClientRect();
  R.push('INFO :: 画布 ' + cr.width.toFixed(0) + 'x' + cr.height.toFixed(0) +
         '，控件 ' + zr.width.toFixed(0) + 'x' + zr.height.toFixed(0));
  // 用绝对尺寸判断（画布可能很窄，占比阈值会误判）：控件本身就该是个小条
  chk('控件尺寸很小（≤ 200×60）', zr.width <= 200 && zr.height <= 60,
      zr.width.toFixed(0) + 'x' + zr.height.toFixed(0));
  // 控件在左上角：星图区域可能比视口高（页面可滚动），贴底会落到折线以下
  chk('控件在左上角', (zr.left - cr.left) < cr.width * 0.3 && (zr.top - cr.top) < cr.height * 0.3,
      'leftGap=' + (zr.left - cr.left).toFixed(0) + ' topGap=' + (zr.top - cr.top).toFixed(0));
  chk('控件完整落在画布内（不溢出）',
      zr.left >= cr.left - 1 && zr.right <= cr.right + 1 && zr.top >= cr.top - 1 && zr.bottom <= cr.bottom + 1,
      JSON.stringify({ l: zr.left - cr.left, r: cr.right - zr.right, t: zr.top - cr.top, b: cr.bottom - zr.bottom }));

  section('J ★ 星图区域按视口高度自适应');
  var sv = document.getElementById('starView');
  var svr = sv.getBoundingClientRect();
  var docTop = Math.round(svr.top + window.scrollY);
  var avail = window.innerHeight - docTop;
  R.push('INFO :: 视口 ' + window.innerWidth + 'x' + window.innerHeight +
         '，星图顶部文档坐标 ' + docTop + '，可用高度 ' + avail +
         '，星图 ' + Math.round(svr.top) + '~' + Math.round(svr.bottom) + '（高 ' + Math.round(svr.height) + '）');
  // 核心：高度 = max(600, 视口高 − 星图顶部偏移)。
  // 下限 600 是刻意的：窗口很矮时不硬压扁画布（岗位一多就挤成一团），
  // 而是让页面可以上下滚动 —— 滚动的空间换来星图的绘制空间。
  var STAR_MIN_H = 600;
  var expectH = Math.max(STAR_MIN_H, avail);
  chk('★ 高度 = max(600, 视口高 − 顶部偏移)', Math.abs(svr.height - expectH) <= 1,
      Math.round(svr.height) + ' vs ' + expectH);
  R.push('INFO :: 原来的写死值是 calc(100vh-140px) = ' + (window.innerHeight - 140) +
         'px，与实际可用 ' + avail + 'px 不符 —— 这正是底部被切掉的原因');

  if (avail >= STAR_MIN_H) {
    chk('★ 空间足够时星图完整落在视口内', svr.bottom <= window.innerHeight + 1,
        Math.round(svr.bottom) + ' vs ' + window.innerHeight);
    chk('★ 星图视图下页面不需要滚动',
        document.documentElement.scrollHeight <= window.innerHeight + 2,
        document.documentElement.scrollHeight + ' vs ' + window.innerHeight);
    var expectedCy = wrap.getBoundingClientRect().top + svr.height / 2;
    R.push('INFO :: 可视区域纵向中心 = ' + Math.round(expectedCy) + '，星图圆心 = ' + Math.round(starStars[0].cy));
    chk('★ 星图圆心落在可视区域纵向中心（±4px）',
        Math.abs(starStars[0].cy - expectedCy) < 4,
        starStars[0].cy.toFixed(1) + ' vs ' + expectedCy.toFixed(1));
  } else {
    R.push('INFO :: 当前视口过小（可用 ' + avail + 'px < 600），星图保底 600px，' +
           '此时页面需要滚动才能看全 —— 这是刻意的取舍（换来更大的绘制空间）');
    chk('★ 空间不足时页面可以上下滚动',
        document.documentElement.scrollHeight > window.innerHeight + 2,
        document.documentElement.scrollHeight + ' vs ' + window.innerHeight);
    chk('★ 极小视口下守住 600px 下限', svr.height >= STAR_MIN_H, Math.round(svr.height));
  }

  section('K ★ 缩放控件可点');
  var zr2 = wrap.querySelector('.star-zoom').getBoundingClientRect();
  chk('控件完整落在星图区域内',
      zr2.top >= svr.top - 1 && zr2.bottom <= svr.bottom + 1 &&
      zr2.left >= svr.left - 1 && zr2.right <= svr.right + 1,
      JSON.stringify({ top: Math.round(zr2.top), bottom: Math.round(zr2.bottom), right: Math.round(zr2.right) }));
  // 命中测试：控件必须是最上层元素（不能被 canvas 盖住）。
  // 视口过小时控件坐标会落在屏幕外，elementFromPoint 必然返回 null，此时不做该断言。
  var zc = { x: zr2.left + zr2.width / 2, y: zr2.top + zr2.height / 2 };
  var onScreen = zc.x >= 0 && zc.x <= window.innerWidth && zc.y >= 0 && zc.y <= window.innerHeight;
  if (onScreen) {
    var hit = document.elementFromPoint(zc.x, zc.y);
    chk('★ 控件未被画布遮挡（命中测试返回按钮）',
        hit && hit.tagName === 'BUTTON', hit ? hit.tagName : 'null');
  } else {
    R.push('INFO :: 控件中心 (' + Math.round(zc.x) + ',' + Math.round(zc.y) + ') 在当前 ' +
           window.innerWidth + 'x' + window.innerHeight + ' 视口之外，跳过命中测试' +
           '（正常窗口下该项由 1600x950 的布局校验覆盖）');
  }
  // 控件不能压在星球上（左下角应是空的）
  var covered = starStars.filter(function (s) {
    return s.screenX > zr2.left - 20 && s.screenX < zr2.right + 20 &&
           s.screenY > zr2.top - 20 && s.screenY < zr2.bottom + 20;
  }).length;
  chk('★ 控件没有压住任何星球', covered === 0, covered + ' 颗被压住');

  setTrackView('board'); stopStarMap(); jobs = [];
  return R;
})();
