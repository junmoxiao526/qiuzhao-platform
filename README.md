# 秋招管理平台

岗位清单 + 投递管理 + 简历管理 + 复盘记录 + AI 岗位推荐的纯前端应用。

线上地址：https://junmoxiao526.github.io/qiuzhao-platform/

单文件应用，全部代码在 `index.html`（内联 CSS/JS，无构建步骤）。

## 使用说明

- 数据默认保存在浏览器 `localStorage`，不上传任何服务器。
- AI 岗位推荐需要自备 DeepSeek API Key（在「AI 推荐 → 分析设置」中填写）。
  Key 仅保存在本机浏览器，请求直连 `api.deepseek.com`，不经过本站服务器。
- **云同步默认关闭。** 开启前请先在 Supabase 完成 Auth + RLS 配置，
  否则数据会进入公网可读的存储。详见下方「云同步」。

## 云同步（重要）

`sync_data` 表的 anon key 必然随前端源码公开，**它不构成访问控制**。
必须在 Supabase 侧开启行级权限，否则任何拿到本页源码的人都能读取和篡改数据。

建议的最小配置：

```sql
alter table sync_data enable row level security;
alter table sync_data add column if not exists owner uuid references auth.users(id);

create policy "own rows" on sync_data
  for all to authenticated
  using  (owner = auth.uid())
  with check (owner = auth.uid());
```

配置完成后，前端还需把 `owner` 写入记录，并把 `key` 改为按用户前缀隔离。

## 本地开发与验证

```bash
# 起一个静态服务器预览
python -m http.server 8099

# 静态检查：内联脚本语法 + 危险结束标签字面量
node .check-syntax.js index.html
```

浏览器端断言（需要先启动带调试端口的 Edge/Chrome）：

```bash
# 1) 启动浏览器
msedge --headless --disable-gpu --no-sync --remote-debugging-port=9222 --user-data-dir=%TEMP%\edge-profile

# 2) 在另一终端跑断言（对真实页面执行，会新开 target 并在导航前清空 localStorage）
node .cdp-run.js .probe-body.js http://127.0.0.1:8099/index.html
```

`.probe-body.js` 覆盖 100+ 项断言：消毒函数、记录规范化、XSS 回归、
事件委托、拖拽改状态、键盘可达、导出 Word、完整备份结构、云同步开关等。

## 注意事项

- 在脚本正文里不要出现脚本结束标签的字面量（含被拼接拆开的形式），
  HTML 解析器会提前结束脚本块。`.check-syntax.js` 会检查这一点。
- 所有来自 `localStorage`、导入文件、云端的数据都必须经 `sanitizeJob` /
  `sanitizeReview` / `sanitizeJobList` 规范化后再使用。
