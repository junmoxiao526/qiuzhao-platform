// 校验 index.html：
//  1) 每个内联 <script> 的正文必须是合法 JS（语法层面）
//  2) 正文里不得出现 HTML 解析器会当作结束标签的序列
//     —— 这是纯语法检查发现不了的坑：HTML 解析器不解析 JS，
//        脚本正文中的样式的结束标签字面量会提前闭合 <script>，导致整段脚本失效。
const fs = require('fs');
const path = process.argv[2] || 'index.html';
const html = fs.readFileSync(path, 'utf8');

const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let m, idx = 0, fail = 0, ok = 0;

// 用正则拼出危险序列，避免本文件自身也踩坑
const DANGEROUS = new RegExp('<\\/\\s*(script|style)', 'gi');

while ((m = re.exec(html)) !== null) {
  idx++;
  const attrs = m[1] || '';
  const code = m[2];
  const lineOfStart = html.slice(0, m.index).split('\n').length;

  if (/\bsrc\s*=/i.test(attrs)) { console.log(`[${idx}] skipped (external src)`); continue; }
  if (!code.trim()) { console.log(`[${idx}] skipped (empty)`); continue; }

  const problems = [];

  // 1) JS 语法
  try {
    // eslint-disable-next-line no-new-func
    new Function(code);
  } catch (e) {
    problems.push('JS 语法错误: ' + e.message);
  }

  // 2) 危险的结束标签字面量（允许 <\/style> 这种转义写法）
  const hits = [];
  let d;
  DANGEROUS.lastIndex = 0;
  while ((d = DANGEROUS.exec(code)) !== null) {
    // 判断是否为转义写法 <\/style
    const before = code.slice(Math.max(0, d.index - 1), d.index + 1);
    const isEscaped = before === '<\\';
    if (!isEscaped) {
      const localLine = code.slice(0, d.index).split('\n').length;
      hits.push(`第 ${localLine} 行附近出现字面量 ${d[0]}`);
    }
  }
  if (hits.length) problems.push('HTML 结束标签字面量: ' + hits.join('; '));

  if (problems.length) {
    fail++;
    console.error(`[${idx}] FAIL  bodyStartsAt=${lineOfStart}  (${code.split('\n').length} 行)`);
    problems.forEach(p => console.error('      - ' + p));
  } else {
    ok++;
    console.log(`[${idx}] OK    bodyStartsAt=${lineOfStart}  (${code.split('\n').length} 行)`);
  }
}

console.log(`\n内联脚本：${ok} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
