# 秋招管理平台

岗位清单 + 投递管理 + 简历管理 + 复盘记录 + AI 岗位推荐的纯前端应用。

线上地址：https://junmoxiao526.github.io/qiuzhao-platform/

单文件应用，全部代码在 `index.html`（内联 CSS/JS，无构建步骤）。

## 架构：纯本地，无任何后端存储

本站**没有后端**，也不保存任何用户数据到服务器。

| 数据 | 存放位置 | 说明 |
|---|---|---|
| 岗位清单 | 本机 `localStorage` | 由使用者点「🔄 同步招聘方舟」自行从公开招聘接口抓取 |
| 投递记录 / 复盘 / 简历 / 总结 | 本机 `localStorage` | 个人数据，**永不上传** |

因此：

- 每个人打开站点看到的是**自己抓取的岗位清单**，彼此独立、互不干扰
- 你的投递记录、面经、简历**其他使用者看不到**
- 换设备需要重新点一次「同步招聘方舟」抓岗位（个人数据不会跨设备同步）

运行时只有两个外部接口：

| 接口 | 用途 |
|---|---|
| `api.qiuzhifangzhou.com` | 抓取公开招聘岗位（无鉴权、允许跨域） |
| `api.deepseek.com` | AI 岗位推荐（需使用者自备 Key） |

## 使用说明

- AI 岗位推荐需要自备 DeepSeek API Key（在「AI 推荐 → 分析设置」中填写）。
  Key 仅保存在本机浏览器，请求直连 `api.deepseek.com`，不经过任何第三方服务器。
- 岗位清单数据来自公开招聘接口，字段内容不完全可信，因此客户端对所有渲染做了
  转义与协议白名单（见 `safeHref` / `escapeHtml` / `sanitizeJobList`）。

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

# 2) 在另一终端跑断言（对真实页面执行，会在导航前清空 localStorage）
node .cdp-run.js .probe-body.js http://127.0.0.1:8099/index.html
```

### 探针清单

| 文件 | 覆盖内容 |
|---|---|
| `.probe-body.js` | 主套件：消毒函数、记录规范化、XSS 回归、事件委托、拖拽、键盘可达、导出 Word、**本地同步只写本机**、源码无上传路径 |
| `.probe-positions.js` | 岗位字段按顿号/逗号/斜杠拆分（真实数据格式） |
| `.probe-listview.js` | 列表视图排版（徽章单行、日期不断行、按钮并排、窄屏不溢出） |
| `.probe-stats2.js` | 统计卡计数语义（已加入投递 === 投递管理总数） |
| `.probe-isolation.js` | 两个浏览器 profile 交叉验证数据隔离 |
| `.probe-explore-link.js` | 岗位清单→投递管理的跳转与加入链路 |
| `.probe-realdata.js` | 用真实 API 样本校验字段转换 |

用两个独立 profile 做隔离验证：

```bash
set CDP_PORT=9222 && set PROBE_TAG=你 && set PROBE_SEED_PERSONAL=1 && node .cdp-run.js .probe-isolation.js http://127.0.0.1:8099/index.html
set CDP_PORT=9223 && set PROBE_TAG=别人 && set PROBE_SEED_PERSONAL=0 && node .cdp-run.js .probe-isolation.js http://127.0.0.1:8099/index.html
```

## 注意事项

- 在脚本正文里不要出现脚本结束标签的字面量（含被拼接拆开的形式），
  HTML 解析器会提前结束脚本块。`.check-syntax.js` 会检查这一点。
- 所有来自 `localStorage`、导入文件的数据都必须经 `sanitizeJob` /
  `sanitizeReview` / `sanitizeJobList` 规范化后再使用。
- 链接一律走 `safeHref()`（协议白名单），不要直接把外部字段拼进 `href`。
