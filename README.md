# 秋招管理平台

岗位清单 + 投递管理 + 简历管理 + 复盘记录 + AI 岗位推荐的纯前端应用。

线上地址：https://junmoxiao526.github.io/qiuzhao-platform/

单文件应用，全部代码在 `index.html`（内联 CSS/JS，无构建步骤）。

## 使用说明

- 数据默认保存在浏览器 `localStorage`，不上传任何服务器。
- AI 岗位推荐需要自备 DeepSeek API Key（在「AI 推荐 → 分析设置」中填写）。
  Key 仅保存在本机浏览器，请求直连 `api.deepseek.com`，不经过本站服务器。
- **云同步默认关闭，且后端已关闭匿名访问。** 详见下方「云同步」。

## 云同步（重要）

### 当前状态（2026-09）

`sync_data` 表已开启 RLS，且**没有任何策略**——即除服务端 `service_role` 外，
任何人都读不到、写不了、改不动、删不掉。这是刻意的：

```
relrowsecurity = true
策略数         = 0
```

**代价：云同步不可用**，投递记录 / 复盘 / 简历 / 总结只存在本机浏览器。
这不影响岗位清单更新——招聘方舟接口允许跨域，任何设备点一下
「🔄 同步招聘方舟」即可自行抓取最新岗位，不依赖云同步。

### 为什么必须这样做

前端用的是 `anon` key，而它**必然随源码公开**（GitHub Pages 是静态托管，
没有后端可以藏密钥）。所以 anon key 不构成任何访问控制。

此前表上存在三条策略 `sync_data_anon_read` / `_insert` / `_update`，
把匿名读写改全部放行——等于 RLS 形同虚设，任何人都能读取手机号、邮箱、
简历原文，并覆盖或删光全部数据。这三条已删除。

### 如果以后要恢复跨设备同步

必须先有可信身份，也就是加 Supabase Auth（纯静态站点无法自建鉴权）。
然后按用户隔离：

```sql
alter table sync_data add column if not exists owner uuid references auth.users(id);
alter table sync_data enable row level security;

create policy "own rows" on sync_data
  for all to authenticated
  using  (owner = auth.uid())
  with check (owner = auth.uid());
```

前端还需：加登录界面、写入时带上 `owner`、把 `key` 改为按用户前缀隔离。
**注意仍不要给 `anon` 建任何策略。**

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
