// 找：把远程/用户数据直接塞进 innerHTML 而没走 escapeHtml 的地方
const fs = require('fs');
const lines = fs.readFileSync('index.html', 'utf8').split(/\r?\n/);
const APP_START = 1444;   // 第三段脚本开始（库之后）

// 远程/用户可控字段
const FIELDS = ['company', 'position', 'notes', 'city', 'title', 'author', 'content',
                'j.company', 'j.position', 'j.notes', 'job.company', 'job.position'];

let hits = [];
lines.forEach((l, i) => {
  const n = i + 1;
  if (n < APP_START) return;
  if (!/innerHTML\s*=|\+=/.test(l)) return;
  // 这行里有没有直接插入未转义的字段
  FIELDS.forEach(f => {
    // 匹配 ${...company...} 且同一段里没有 escapeHtml
    const re = new RegExp('\\$\\{[^}]*' + f.replace('.', '\\.') + '[^}]*\\}', 'g');
    let m;
    while ((m = re.exec(l))) {
      const expr = m[0];
      if (/escapeHtml|escapeAttr|encodeURI|textContent/.test(expr)) return;
      hits.push({ n, f, expr, line: l.trim().slice(0, 170) });
    }
  });
});

console.log('=== innerHTML 中疑似未转义的远程/用户字段 ===');
if (!hits.length) console.log('  （未发现）');
const seen = new Set();
hits.forEach(h => {
  const key = h.n + h.expr;
  if (seen.has(key)) return;
  seen.add(key);
  console.log('  行 ' + h.n + '  [' + h.f + ']  ' + h.expr);
  console.log('      ' + h.line);
});
console.log('\n  合计 ' + seen.size + ' 处');

// 顺便统计 escapeHtml 的使用密度
const escCount = (lines.slice(APP_START - 1).join('\n').match(/escapeHtml\(/g) || []).length;
console.log('\n  escapeHtml( 调用次数（应用代码）: ' + escCount);
