# 秋招管理平台

岗位清单 + 投递管理 + 简历管理 + 复盘记录的纯前端应用。

线上地址：https://junmoxiao526.github.io/qiuzhao-platform/

单文件应用，全部代码在 `index.html`（内联 CSS/JS，无构建步骤）。

> AI 岗位推荐功能已于 2026-09 整体移除（连同 DeepSeek 调用与 API Key 设置）。
> 现在运行时**只有一个外部接口**：`api.qiuzhifangzhou.com`，用于抓取公开招聘岗位。

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

运行时只有一个外部接口：

| 接口 | 用途 |
|---|---|
| `api.qiuzhifangzhou.com` | 抓取公开招聘岗位（无鉴权、允许跨域） |

源码中不存在任何其它外部请求，也没有任何 API Key 或凭据。

## 使用说明

- 岗位清单数据来自公开招聘接口，字段内容不完全可信，因此客户端对所有渲染做了
  转义与协议白名单（见 `safeHref` / `escapeHtml` / `sanitizeJobList`）。
- 岗位清单采用**分批渲染**（每批 200 行，「加载更多」追加），避免数千行拖慢首屏；
  搜索与筛选始终作用于全量数据。
- 岗位清单的落盘写入做了**防抖**（800ms 合并一次），并在页面隐藏/关闭前立即补写。

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
| `.probe-smoke.js` | **冒烟**：关键函数是否都存在、各面板是否渲染、省份索引是否正确 |
| `.probe-dedupe.js` | 岗位去重：同公司+岗位+批次合并、跨批次保留、手动岗位保留、幂等、不误删 |
| `.startup-data-test.js` | **启动数据链路**：写入→重载→读回（投递/清单/复盘四处渲染） |
| `.startup-dedupe-test.js` | **老数据自动清理**：遗留重复在启动时被合并并落盘 |
| `.probe-review.js` | 复盘页：右侧工作区已移除、卡片点击开弹窗、附件芯片纯展示、左栏占满 |
| `.probe-deadlinefilter.js` | 截止日期筛选：7 个互不重叠分档、多选并集、面板标签带数量、计数与清空 |
| `.probe-quickdeadline.js` | 「⚡ 快截止」一键视图：含已截止、自动切排序、与面板联动、再点取消 |
| `.probe-quickdeadline2.js` | 真实数据下快截止数量一致、已截止必在结果内、分档缓存性能 |
| `.probe-deadline.js` | 岗位清单「截止日期」列：紧急度分级、无截止占位、列位置、转义 |
| `.probe-deadlinesort.js` | 「临近截止」排序：由近到远、无截止排最后、切换排序 |
| `.probe-deadline2.js` | 截止列逐行核对（真实数据 60 行）+ 紧急度机制生效 |
| `.probe-deadline3.js` | 真实数据下临近截止排序把紧急岗位浮到首屏、单调性 |
| `.probe-todo.js` | 今日待办：各类日期生成待办、提醒窗口、面试只在 1 天内提醒、已结束状态不催办、稍后提醒 |
| `.probe-triage.js` | 关注/忽略：互斥、再点取消、按 qiuzhiId 存活于重新同步、三种筛选、批量只作用于当前筛选 |
| `.probe-followup.js` | 跟进提醒：只针对「已投递」、按上次联系算天数、阈值可配、排序位置 |
| `.probe-timeline.js` | 公司时间线：汇总四块数据、时间倒序、公司别名匹配、空数据容错 |
| `.probe-stats2.js` | 转化统计：漏斗单调递减、已挂记录用复盘阶段兜底、分维度、按简历版本 |
| `.probe-realdata2.js` | 用真实 API 数据验证六个新功能（含真实公司名） |
| `.probe-body.js` | 主套件：消毒函数、记录规范化、XSS 回归、事件委托、拖拽、键盘可达、导出 Word、**本地同步只写本机**、源码无上传路径 |
| `.probe-positions.js` | 岗位字段按顿号/逗号/斜杠拆分（真实数据格式） |
| `.probe-listview.js` | 列表视图排版（徽章单行、日期不断行、按钮并排、窄屏不溢出） |
| `.probe-stats.js` / `.probe-statcard.js` | 统计卡计数语义（公司数口径、已加入投递 === 投递管理总数） |
| `.probe-isolation.js` | 两个浏览器 profile 交叉验证数据隔离 |
| `.probe-explore-link.js` | 岗位清单→投递管理的跳转；操作列状态下拉链路 |
| `.probe-track-select.js` | 「操作」列下拉：仅加入 / 已投递、占位项不动作、重复加入拦截 |
| `.probe-paging.js` | 分批渲染（每批 200 行）、加载更多、筛选重置、保存防抖 |
| `.probe-realdata.js` | 用真实 API 样本校验字段转换 |
| `.probe-interact.js` | 交互性能：各操作耗时、星图动画是否停止排帧 |
| `.probe-p01.js` | 省份索引 O(1)、加入投递局部更新、不可见面板不重建 |

> 改动搬移代码后**务必先跑 `.probe-smoke.js`**：语法检查抓不到"函数被删/改名"这类问题
> （脚本仍然合法，只在运行时才 ReferenceError）。

## 代码结构约定

- **改数据只调用统一入口**，不要在各处手写 `saveXxx(); renderXxx();` 组合：
  - `refreshAfterJobChange({ jobIds })` —— 投递记录变化（会局部更新岗位清单对应行）
  - `refreshAfterJobListChange()` —— 岗位清单本身变化
  两个入口都只渲染**当前可见**的面板，避免在岗位清单页重建看板/星图。
- 岗位清单每行的 HTML 由 `exploreRowHtml(job)` 统一生成，全量渲染与局部更新共用。
- 省份查询走 `CITY_TO_PROVINCE` 预建索引，不要再去遍历 `PROVINCE_MAP`。

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
