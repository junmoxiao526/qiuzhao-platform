const fs = require('fs');
const t = fs.readFileSync('index.html', 'utf8');
const bytes = fs.statSync('index.html').size;

console.log('=== 文件构成（按字节）===');
console.log('  总计 ' + (bytes / 1024).toFixed(1) + ' KB / ' + t.split('\n').length + ' 行\n');

// 分段：<style>、各 <script>、其余 HTML
const segs = [];
let re = /<style[^>]*>([\s\S]*?)<\/style>/gi, m;
while ((m = re.exec(t))) segs.push({ kind: 'style', start: m.index, end: m.index + m[0].length, body: m[1] });

re = /<script[^>]*>([\s\S]*?)<\/script>/gi;
while ((m = re.exec(t))) {
  const head = m[1].slice(0, 80).replace(/\s+/g, ' ');
  segs.push({ kind: 'script', start: m.index, end: m.index + m[0].length, body: m[1], head });
}
segs.sort((a, b) => a.start - b.start);

let covered = 0;
segs.forEach((s, i) => {
  covered += (s.end - s.start);
  const kb = ((s.end - s.start) / 1024).toFixed(1);
  const pct = ((s.end - s.start) / bytes * 100).toFixed(1);
  const line = t.slice(0, s.start).split('\n').length;
  console.log('  ' + String(i + 1).padStart(2) + '. ' + s.kind.padEnd(7) + ' ' +
    kb.padStart(7) + ' KB  ' + pct.padStart(5) + '%  行' + String(line).padStart(5) +
    (s.head ? '  « ' + s.head.slice(0, 50) : ''));
});
console.log('  HTML 结构部分     ' + ((bytes - covered) / 1024).toFixed(1) + ' KB  ' +
  (((bytes - covered) / bytes * 100).toFixed(1)) + '%\n');

// 库占比
console.log('=== 内联第三方库 ===');
const libs = [
  ['mammoth.js (Word .docx 解析)', 'mammoth.js v1.6.0 内联'],
  ['LZString (压缩)', 'var LZString=function()'],
  ['bluebird (Promise 垫片)', 'bluebird'],
  ['jsPDF / html2canvas', 'jsPDF'],
];
libs.forEach(([name, needle]) => {
  const i = t.indexOf(needle);
  console.log('  ' + (i >= 0 ? '有' : '无') + '  ' + name);
});

// 找 script1 的真实长度
const s1 = t.match(/<script>\s*\/\* mammoth\.js[\s\S]*?<\/script>/);
if (s1) console.log('\n  mammoth 内联脚本占: ' + (s1[0].length / 1024).toFixed(1) + ' KB  (' +
  (s1[0].length / bytes * 100).toFixed(1) + '% 的整份文件)');

// 死代码 / 可疑模式
console.log('\n=== 代码异味扫描 ===');
const smells = [
  ['console.log 调试残留', /console\.log\(/g],
  ['TODO / FIXME', /TODO|FIXME|XXX/g],
  ['innerHTML 拼接（XSS/性能）', /\.innerHTML\s*=/g],
  ['JSON.parse 未包 try', /(?<!try\s*\{[^}]*?)JSON\.parse\(/g],
  ['localStorage.setItem', /localStorage\.setItem\(/g],
  ['localStorage.getItem', /localStorage\.getItem\(/g],
  ['setInterval 轮询', /setInterval\(/g],
  ['requestAnimationFrame', /requestAnimationFrame\(/g],
];
smells.forEach(([name, re2]) => {
  const c = (t.match(re2) || []).length;
  console.log('  ' + String(c).padStart(5) + '  ' + name);
});

// 定位 setInterval（可能是性能问题源头）
console.log('\n=== setInterval 调用点 ===');
re = /setInterval\(/g;
while ((m = re.exec(t))) {
  const line = t.slice(0, m.index).split('\n').length;
  console.log('  行 ' + line + ': ' + JSON.stringify(t.slice(m.index, m.index + 120).replace(/\s+/g, ' ')));
}

// 定位 requestAnimationFrame（星图动画常驻？）
console.log('\n=== requestAnimationFrame 调用点 ===');
re = /requestAnimationFrame\(/g;
while ((m = re.exec(t))) {
  const line = t.slice(0, m.index).split('\n').length;
  console.log('  行 ' + line + ': ' + JSON.stringify(t.slice(Math.max(0, m.index - 60), m.index + 80).replace(/\s+/g, ' ')));
}
