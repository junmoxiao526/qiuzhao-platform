// 星图：每个星环上星球等距（等弧长）
return (async function () {
  var R = []; function chk(n, c, e) { R.push((c ? "PASS" : "FAIL") + " :: " + n + (e !== undefined && !c ? " :: " + e : "")); }
  function section(t) { R.push('-- ' + t + ' --'); }

  function arc(a, b, t0, t1) {
    var M = 4000, dt = (t1 - t0) / M, s = 0;
    for (var i = 0; i < M; i++) {
      var tm = t0 + dt * (i + 0.5);
      s += Math.sqrt(a * a * Math.sin(tm) * Math.sin(tm) + b * b * Math.cos(tm) * Math.cos(tm)) * dt;
    }
    return s;
  }
  function norm(t) { return ((t % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); }
  // 一组角度：相邻两点间沿椭圆的弧长，返回 max/min
  function gapRatio(angles, a, b) {
    var v = angles.map(norm).sort(function (x, y) { return x - y; });
    var gaps = [];
    for (var i = 0; i < v.length; i++) {
      var t0 = v[i], t1 = (i + 1 < v.length) ? v[i + 1] : v[0] + Math.PI * 2;
      gaps.push(arc(a, b, t0, t1));
    }
    var mn = Math.min.apply(null, gaps), mx = Math.max.apply(null, gaps);
    return { ratio: mn > 1e-9 ? mx / mn : Infinity, gaps: gaps };
  }

  section('A 弧长查表器本身');
  var a0 = 100, b0 = 62;
  var map = makeEllipseArcMap(a0, b0);
  chk('周长与数值积分一致（±0.5）', Math.abs(map.S - arc(a0, b0, 0, Math.PI * 2)) < 0.5,
      map.S.toFixed(2) + ' vs ' + arc(a0, b0, 0, Math.PI * 2).toFixed(2));
  chk('angleAt(0) ≈ 0', Math.abs(map.angleAt(0)) < 0.01, map.angleAt(0));
  // angleAt 是**模映射**到 [0, 2π)：走满一圈（arc=S）回到同一个点，所以返回 0 而非 2π
  chk('★ angleAt(S) 回到起点（与 angleAt(0) 等价）', Math.abs(map.angleAt(map.S) - map.angleAt(0)) < 1e-9,
      map.angleAt(map.S));
  chk('★ 逼近一圈时角度趋近 2π', Math.abs(map.angleAt(map.S - 1e-6) - Math.PI * 2) < 0.01,
      map.angleAt(map.S - 1e-6));
  chk('绕圈：angleAt(arc + S) = angleAt(arc)', Math.abs(map.angleAt(37) - map.angleAt(37 + map.S)) < 1e-6);
  chk('负弧长也能绕回', Math.abs(map.angleAt(-5) - map.angleAt(map.S - 5)) < 1e-6, map.angleAt(-5));
  // 单调性只在半开区间 [0, S) 上成立（到 S 会绕回 0）
  var mono = true, prev = map.angleAt(0);
  for (var i = 1; i < 200; i++) { var cur = map.angleAt(map.S * i / 200); if (cur < prev - 1e-9) { mono = false; break; } prev = cur; }
  chk('角度在半开区间 [0,S) 上单调递增', mono);
  // 等弧长细分 → 每段弧长应相等
  var segs = [];
  for (var k = 0; k < 12; k++) segs.push(arc(a0, b0, map.angleAt(map.S * k / 12), map.angleAt(map.S * (k + 1) / 12)));
  var smn = Math.min.apply(null, segs), smx = Math.max.apply(null, segs);
  chk('★ 等分弧长后各段相等（比值 < 1.001）', smx / smn < 1.001, (smx / smn).toFixed(5));

  section('B ★ ellipseAngles 在任意相位下都等弧长（这是原来的 bug）');
  var A = 68.407, B = 42.413;
  var phases = [0, 0.1, 0.2, 0.3, 0.5, 1.0, 1.5, 2.0, 2.8, -0.2, -0.5, -1.0];
  var worst = 0, worstPh = 0;
  phases.forEach(function (ph) {
    var r = gapRatio(ellipseAngles(A, B, 7, ph), A, B);
    if (r.ratio > worst) { worst = r.ratio; worstPh = ph; }
  });
  R.push('INFO :: 12 个相位下最差比值 = ' + worst.toFixed(4) + '（phase=' + worstPh + '）');
  chk('★ 任意相位下都等弧长（比值 < 1.002）', worst < 1.002, worst.toFixed(4));
  // 对照：修复前 phase=1.0 时是 1.868
  chk('★ phase=1.0 时比值 < 1.002（修复前 1.87）', gapRatio(ellipseAngles(A, B, 7, 1.0), A, B).ratio < 1.002,
      gapRatio(ellipseAngles(A, B, 7, 1.0), A, B).ratio.toFixed(4));

  section('C 各种数量都等弧长');
  [1, 2, 3, 5, 7, 8, 12, 20, 33].forEach(function (n) {
    var rr = gapRatio(ellipseAngles(A, B, n, 1.1), A, B);
    chk('n=' + n + ' 等弧长', rr.ratio < 1.005, rr.ratio.toFixed(4));
  });

  section('D 渲染出的星球（真实渲染路径）');
  var stages = ['pending','applied','assessment','exam','ai','interview1','interview2','hr','offer'];
  var counts = [3,5,8,4,6,7,5,4,2];
  jobs = []; var n2 = 0;
  stages.forEach(function (st, si) {
    for (var i = 0; i < counts[si]; i++) {
      n2++;
      jobs.push(sanitizeJob({ id: 'sr' + n2, company: '公司' + n2, position: '岗位' + n2, status: st, city: '上海', applyDate: '2026-09-01', notes: '' }));
    }
  });
  switchTab('track'); setTrackView('star');
  chk('星球渲染出来', starStars.length === 44, starStars.length);

  function ringsWorst(tag) {
    var rings = {};
    starStars.forEach(function (s) { var k = s.rx.toFixed(2); (rings[k] = rings[k] || []).push(s); });
    var w = 0, wk = '';
    Object.keys(rings).forEach(function (k) {
      var g = rings[k];
      if (g.length < 2) return;
      var rr = gapRatio(g.map(function (s) { return s.angle; }), g[0].rx, g[0].ry);
      if (rr.ratio > w) { w = rr.ratio; wk = 'r=' + g[0].rx.toFixed(1) + ' n=' + g.length; }
    });
    return { worst: w, key: wk };
  }
  var w0 = ringsWorst('渲染');
  R.push('INFO :: 渲染完成时各环最差比值 = ' + w0.worst.toFixed(4) + '（' + w0.key + '）');
  chk('★ 渲染完成即等距（比值 < 1.005）', w0.worst < 1.005, w0.worst.toFixed(4));

  section('E 星球确实落在自己的环上');
  var offRing = 0;
  starStars.forEach(function (s) {
    var x = s.rx * Math.cos(s.angle), y = s.ry * Math.sin(s.angle);
    var v = (x * x) / (s.rx * s.rx) + (y * y) / (s.ry * s.ry);
    if (Math.abs(v - 1) > 1e-6) offRing++;
  });
  chk('★ 全部 44 颗都在椭圆上（x²/a²+y²/b²=1）', offRing === 0, offRing + ' 颗偏离');
  var badAngle = starStars.filter(function (s) { return !isFinite(s.angle); }).length;
  chk('角度都是有限数（无 NaN）', badAngle === 0, badAngle);

  section('F 公转一段时间后仍等距（原来按角度推进会拉散）');
  var before = starStars.map(function (s) { return s.angle; });
  await new Promise(function (res) { setTimeout(res, 1500); });
  var moved = starStars.some(function (s, i) { return Math.abs(s.angle - before[i]) > 1e-9; });
  chk('星球确实在动', moved);
  var w1 = ringsWorst('公转后');
  R.push('INFO :: 公转 1.5s 后各环最差比值 = ' + w1.worst.toFixed(4) + '（' + w1.key + '）');
  chk('★ 公转后仍等距（比值 < 1.005）', w1.worst < 1.005, w1.worst.toFixed(4));

  section('G 同环内所有星球共享同一公转速度');
  var speeds = {};
  starStars.forEach(function (s) { speeds[s.rx.toFixed(2)] = speeds[s.rx.toFixed(2)] || {}; speeds[s.rx.toFixed(2)][s.arcSpeed] = 1; });
  var mixed = Object.keys(speeds).filter(function (k) { return Object.keys(speeds[k]).length > 1; });
  chk('★ 没有哪个环混用了不同速度', mixed.length === 0, mixed.join(','));

  section('H 星球多到需要拆子环时也正常');
  jobs = [];
  for (var q = 0; q < 44; q++) jobs.push(sanitizeJob({ id: 'big' + q, company: '大公司' + q, position: '岗' + q, status: 'applied', city: '上海', applyDate: '2026-09-01', notes: '' }));
  setTrackView('star');
  chk('44 条同阶段照样渲染', starStars.length === 44, starStars.length);
  var rings2 = {};
  starStars.forEach(function (s) { var k = s.rx.toFixed(2); (rings2[k] = rings2[k] || []).push(s); });
  R.push('INFO :: 拆成 ' + Object.keys(rings2).length + ' 个子环，各环星数 = ' + Object.keys(rings2).sort(function(x,y){return parseFloat(y)-parseFloat(x);}).map(function(k){ return rings2[k].length; }).join(','));
  chk('★ 拆子环后每个子环仍等距', (function () {
    var ok = true;
    Object.keys(rings2).forEach(function (k) {
      var g = rings2[k];
      if (g.length < 2) return;
      if (gapRatio(g.map(function (s) { return s.angle; }), g[0].rx, g[0].ry).ratio >= 1.005) ok = false;
    });
    return ok;
  })());
  var w2 = ringsWorst('子环');
  chk('子环最差比值 < 1.005', w2.worst < 1.005, w2.worst.toFixed(4));

  setTrackView('board');
  stopStarMap();
  jobs = [];
  return R;
})();
