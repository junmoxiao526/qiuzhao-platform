// 星图拥挤度与"钉住中心 + 放大后可拖动"
return (async function () {
  var R = []; function chk(n, c, e) { R.push((c ? "PASS" : "FAIL") + " :: " + n + (e !== undefined && !c ? " :: " + e : "")); }
  function section(t) { R.push('-- ' + t + ' --'); }
  var errors = []; window.addEventListener('error', function (e) { errors.push(e.message); });
  function frames(n) {
    return new Promise(function (res) {
      var i = 0;
      (function step() { if (++i >= (n || 2)) return setTimeout(res, 60); requestAnimationFrame(step); })();
    });
  }
  var LONG = '招商局船舶工业技术（上海）有限公司';
  function seed(count) {
    var stages = ['pending','applied','assessment','exam','ai','interview1','interview2','hr','offer'];
    var names = ['国家电投集团','国家开发银行','中石油','农夫山泉','杭州锦江集团','当纳利亚洲','龙湖集团','寒武纪','X-MOTORS','中国能建安徽院','福特中国','阿迪达斯','零跑汽车','龙旗科技',LONG,'华勤','中远海运重工','中国外运','镭目科技','卫龙'];
    jobs = [];
    for (var i = 0; i < count; i++) {
      jobs.push(sanitizeJob({ id: 'C' + i, company: names[i % names.length] + (i >= names.length ? ('#' + (i + 1)) : ''),
        position: '岗位' + i, status: stages[i % stages.length], city: '上海', applyDate: '2026-09-01', notes: '' }));
    }
  }
  function overlaps(list) {
    var n = 0;
    for (var i = 0; i < list.length; i++) for (var j = i + 1; j < list.length; j++) {
      var a = list[i], b = list[j];
      if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) n++;
    }
    return n;
  }

  section('A 50 个岗位：星图会铺开，星球不重叠');
  seed(50);
  switchTab('track'); setTrackView('star'); starZoomApi.reset();
  await frames(3);
  var wrap = document.getElementById('starCanvasWrap');
  var W = wrap.clientWidth, H = wrap.clientHeight;
  chk('50 个星球都渲染出来', starStars.length === 50, starStars.length);
  var radii = Array.from(new Set(starStars.map(function (s) { return +s.rx.toFixed(1); }))).sort(function (a, b) { return b - a; });
  R.push('INFO :: 环半径 ' + radii.join(', '));
  chk('环半径递进（无重复半径挤在一起）', radii.length >= 5, radii.length);
  chk('★ 最外环占画布宽度 ≥ 35%（原来约 22%）', radii[0] * 2 / W * 100 >= 35, (radii[0] * 2 / W * 100).toFixed(1) + '%');
  var circleOver = 0, worst = 1;
  for (var i = 0; i < starStars.length; i++) for (var j = i + 1; j < starStars.length; j++) {
    var A = starStars[i], B = starStars[j];
    var d = Math.hypot(A.screenX - B.screenX, A.screenY - B.screenY);
    if (d < A.size + B.size) { circleOver++; worst = Math.min(worst, d / (A.size + B.size)); }
  }
  R.push('INFO :: 星球重叠 ' + circleOver + ' 对 / 共 ' + (50 * 49 / 2) + ' 对，最严重 ' + worst.toFixed(2));
  chk('★ 星球基本不重叠（≤2 对）', circleOver <= 2, circleOver + ' 对');
  chk('同环相邻星球不重叠', (function () {
    var byRing = {};
    starStars.forEach(function (s) { (byRing[s.rx.toFixed(2)] = byRing[s.rx.toFixed(2)] || []).push(s); });
    var bad = 0;
    Object.keys(byRing).forEach(function (k) {
      var g = byRing[k];
      for (var a = 0; a < g.length; a++) for (var b = a + 1; b < g.length; b++) {
        var d = Math.hypot(g[a].screenX - g[b].screenX, g[a].screenY - g[b].screenY);
        if (d < g[a].size + g[b].size) bad++;
      }
    });
    return bad === 0;
  })());

  section('B ★ 标签不再糊成一片');
  var st = starLabelStats;
  R.push('INFO :: 标签 画了' + st.drawn + ' 跳过' + st.skipped + ' 截断' + st.truncated + ' 星球' + st.planets);
  chk('确实画出了标签（不是全被跳过）', st.drawn >= 15, st.drawn);
  chk('不是每个都画（该跳的跳了）', st.skipped > 0, st.skipped);
  chk('画的 + 跳的 = 星球数', st.drawn + st.skipped === st.planets, st.drawn + '+' + st.skipped + ' vs ' + st.planets);
  chk('★ 已画的标签之间零重叠', overlaps(st.rects) === 0, overlaps(st.rects) + ' 对重叠');
  chk('长公司名被截断处理过（有截断或跳过）', st.truncated > 0 || st.skipped > 0, '截断' + st.truncated);
  var out = st.rects.filter(function (r) {
    return r.x < -2 || r.y < -2 || r.x + r.w > W + 2 || r.y + r.h > H + 2;
  });
  chk('★ 没有标签越出画布（会被切掉）', out.length === 0, out.length + ' 个越界');

  section('C ★ 100% 时钉在画布正中，拖也拖不动');
  starZoomApi.reset();
  await frames(2);
  chk('缩放 = 100%', starZoomApi.get() === 1, starZoomApi.get());
  chk('★ 平移量为 0', starZoomApi.pan().x === 0 && starZoomApi.pan().y === 0, JSON.stringify(starZoomApi.pan()));
  chk('★ 报告不可拖动', starZoomApi.canPan() === false, starZoomApi.canPan());
  var centersBefore = starStars.map(function (s) { return s.cx + ',' + s.cy; }).join('|');
  var canvas = wrap.querySelector('canvas');
  var anyMoved = false;
  canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 200, clientY: 300, button: 0 }));
  window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 700, clientY: 500 }));
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  await frames(2);
  chk('★ 用力拖拽后平移量仍为 0', starZoomApi.pan().x === 0 && starZoomApi.pan().y === 0, JSON.stringify(starZoomApi.pan()));
  chk('★ 圆心仍在画布正中', (function () {
    var xs = Array.from(new Set(starStars.map(function (s) { return s.cx; })));
    var ys = Array.from(new Set(starStars.map(function (s) { return s.cy; })));
    return xs.length === 1 && ys.length === 1 && Math.abs(xs[0] - W / 2) < 1 && Math.abs(ys[0] - H / 2) < 1;
  })());
  chk('拖拽没有报错', errors.length === 0, errors.join(' | '));

  section('D ★ 放大后可以拖动查看边缘');
  for (var z = 0; z < 6; z++) starZoomApi.in();
  await frames(2);
  var scale = starZoomApi.get();
  R.push('INFO :: 放大到 ' + Math.round(scale * 100) + '%，可拖动 = ' + starZoomApi.canPan());
  chk('★ 放大后报告可拖动', starZoomApi.canPan() === true, starZoomApi.canPan());
  var lim = starZoomApi.panLimits();
  chk('★ 放大后平移上限为正', lim.x > 0.5 || lim.y > 0.5, JSON.stringify(lim));
  canvas = wrap.querySelector('canvas');
  var beforePan = starZoomApi.pan();
  canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 400, clientY: 400, button: 0 }));
  window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 500, clientY: 470 }));
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  await frames(2);
  var afterPan = starZoomApi.pan();
  R.push('INFO :: 拖动后 pan = ' + JSON.stringify(afterPan));
  chk('★ 拖动确实移动了星图', afterPan.x !== beforePan.x || afterPan.y !== beforePan.y, JSON.stringify(afterPan));
  chk('★ 移动量被限制在范围内', Math.abs(afterPan.x) <= lim.x + 0.5 && Math.abs(afterPan.y) <= lim.y + 0.5,
      JSON.stringify(afterPan) + ' vs ' + JSON.stringify(lim));
  chk('星球屏幕坐标跟着平移', (function () {
    var s = starStars[0];
    return Math.abs(s.screenX - (s.cx + afterPan.x + s.rx * scale * Math.cos(s.angle))) < 1;
  })());

  section('E ★ 拖远后不会被拉出画布（夹住上限）');
  for (var k = 0; k < 8; k++) {
    canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100, button: 0 }));
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 4000, clientY: 4000 }));
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }
  await frames(2);
  var far = starZoomApi.pan();
  lim = starZoomApi.panLimits();
  R.push('INFO :: 疯狂拖动后 pan = ' + JSON.stringify(far) + '，上限 ' + JSON.stringify(lim));
  chk('★ 平移被夹在上限内', Math.abs(far.x) <= lim.x + 0.5 && Math.abs(far.y) <= lim.y + 0.5,
      JSON.stringify(far) + ' vs ' + JSON.stringify(lim));
  chk('★ 星图至少还有一部分在画布内', (function () {
    var anyVisible = starStars.some(function (s) {
      return s.screenX > 0 && s.screenX < W && s.screenY > 0 && s.screenY < H;
    });
    return anyVisible;
  })());

  section('F ★ 缩回 100% 自动回到正中');
  starZoomApi.reset();
  await frames(2);
  chk('★ 缩放回到 100%', starZoomApi.get() === 1, starZoomApi.get());
  chk('★ 平移自动归零（回到正中）', starZoomApi.pan().x === 0 && starZoomApi.pan().y === 0, JSON.stringify(starZoomApi.pan()));
  chk('★ 又变成不可拖动', starZoomApi.canPan() === false, starZoomApi.canPan());
  // 先放大再缩小（不点复位）也应该自动回来
  starZoomApi.in(); starZoomApi.in(); await frames(1);
  starZoomApi.out(); starZoomApi.out(); starZoomApi.out(); await frames(2);
  chk('★ 用 − 缩回后也自动归零', starZoomApi.pan().x === 0 && starZoomApi.pan().y === 0, JSON.stringify(starZoomApi.pan()));

  section('G 换数据量后仍然成立');
  seed(6);
  starZoomApi.reset(); setTrackView('star');
  await frames(3);
  chk('6 个岗位正常渲染', starStars.length === 6, starStars.length);
  chk('6 个岗位时星球零重叠', (function () {
    var n = 0;
    for (var i = 0; i < starStars.length; i++) for (var j = i + 1; j < starStars.length; j++) {
      var A = starStars[i], B = starStars[j];
      if (Math.hypot(A.screenX - B.screenX, A.screenY - B.screenY) < A.size + B.size) n++;
    }
    return n === 0;
  })());
  chk('6 个岗位时 100% 仍不可拖动', starZoomApi.canPan() === false, starZoomApi.canPan());
  chk('没有 JS 报错', errors.length === 0, errors.join(' | '));

  section('H ★ 回归：渲染循环必须活着（负半径曾把整个循环打死）');
  // ctx.ellipse 收到非正半径会抛 IndexSizeError，而 frame() 一抛错就再也不会自我调度，
  // 表现为画布一片空白、星球完全不动。这里把这个坑钉住。
  var alive = [];
  for (var round = 0; round < 3; round++) {
    var before = starStars.map(function (s) { return s.screenX; });
    await new Promise(function (r) { requestAnimationFrame(r); });
    await new Promise(function (r) { requestAnimationFrame(r); });
    var changed = starStars.some(function (s, i) { return Math.abs(s.screenX - before[i]) > 1e-6; });
    alive.push(changed);
  }
  chk('★ 动画循环在持续更新星球位置', alive.every(Boolean), JSON.stringify(alive));
  chk('★ 所有环半径都是正数', starStars.every(function (s) { return s.rx > 0 && s.ry > 0; }),
      starStars.filter(function (s) { return !(s.rx > 0 && s.ry > 0); }).length + ' 个非正');
  chk('★ 所有星球屏幕坐标都是有限数',
      starStars.every(function (s) { return isFinite(s.screenX) && isFinite(s.screenY); }));
  chk('★ 屏幕坐标在画布附近（没被算飞）', starStars.every(function (s) {
    return Math.abs(s.screenX - W / 2) < W * 2 && Math.abs(s.screenY - H / 2) < H * 2;
  }));
  chk('环半径介于 minInner(70) 与可用上限之间', (function () {
    var rs = Array.from(new Set(starStars.map(function (s) { return s.rx; })));
    return rs.every(function (r) { return r >= 69.9 && r <= Math.max(W, H); });
  })(), JSON.stringify(Array.from(new Set(starStars.map(function (s) { return +s.rx.toFixed(1); })))));
  chk('渲染循环没有抛错', errors.length === 0, errors.join(' | '));

  // 数据量再大也要活着
  seed(200);
  starZoomApi.reset(); setTrackView('star');
  await frames(3);
  chk('200 个岗位也能渲染', starStars.length === 200, starStars.length);
  chk('★ 200 个岗位时循环仍活着', isFinite(starStars[0].screenX) && starStars[0].screenX !== 0,
      starStars[0].screenX);
  chk('★ 200 个岗位时半径全为正', starStars.every(function (s) { return s.rx > 0; }));
  // 200 个岗位在窄画布上已到几何极限（球半径触到 3.5 下限），
  // 完全零重叠不可能。这里只要求"极少"（实测 14/19900 = 0.1%）。
  var over200 = 0, pairs200 = 0;
  for (var i2 = 0; i2 < starStars.length; i2++) for (var j2 = i2 + 1; j2 < starStars.length; j2++) {
    pairs200++;
    var A2 = starStars[i2], B2 = starStars[j2];
    if (Math.hypot(A2.screenX - B2.screenX, A2.screenY - B2.screenY) < A2.size + B2.size) over200++;
  }
  R.push('INFO :: 200 个岗位重叠 ' + over200 + '/' + pairs200 + ' = ' + (over200 / pairs200 * 100).toFixed(2) + '%');
  chk('★ 200 个岗位时重叠 < 1%（几何极限，允许极少量）', over200 / pairs200 < 0.01,
      (over200 / pairs200 * 100).toFixed(2) + '%');
  chk('200 个岗位时没有 JS 报错', errors.length === 0, errors.join(' | '));

  starZoomApi.reset(); setTrackView('board'); stopStarMap(); jobs = [];
  return R;
})();
