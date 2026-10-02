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
| `.probe-quickdeadline2.js` | 真实数据下快截止数量一致、已截止已被清理、分档缓存性能 |
| `.probe-prune.js` | 已截止自动清理：边界（今天截止必留、无/非法日期不删）、幂等、落盘、与去重协作 |
| `.probe-prune2.js` | 真实数据下清理生效、今天截止保留、面板与按钮同步、落盘一致 |
| `.probe-internship.js` | 实习岗清理：只按批次判定（不碰职位名）、提前批不误删、开关、落盘 |
| `.probe-internship2.js` | 真实数据下实习岗清零、提前批与秋招保留、落盘一致、二次同步不重复清理 |
| `.probe-starring.js` | 星图等距：弧长查表器、**任意相位下都等弧长**、渲染与公转后仍等距、拆子环 |
| `.probe-backup.js` | 备份/恢复全链路：导出含全部 7 类数据、走真实 importData 的往返、合并语义、旧版与损坏文件 |
| `.probe-starzoom.js` | 星图固定居中 + 缩放：100% 拖不动、放大后可拖动、上下限、视口自适应高度 |
| `.probe-starcrowd.js` | 星图拥挤度：星球零重叠、标签零重叠零越界、平移夹取、**渲染循环必须活着**、200 岗位压力 |
| `.layoutverify.js` | 真实视口（1600x950/1440x900/1280x800）下星图布局与居中校验，非探针，需 CDP 起浏览器 |
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
- 星图的**半径预算**是"环间距 gap"与"子环间距 spread"共用的一份（`spanTotal`），
  按比例同时缩放；**不要只压 gap 而让 spread 保持不变**，那会产出畸形布局。
- **绝不能算出非正的环半径**：`ctx.ellipse` 收到负半径会抛 `IndexSizeError`，
  而 `frame()` 一旦抛错就再也不会自我调度 —— 整个星图变空白且永不恢复。
  布局处有兜底（`if (!(info.r > 1)) info.r = minInner`），绘制处也有（`if (!(r > 0.5)) return`）。
- 星球大小要同时服从三个约束：同环间距（`step`）、跨环间距（`gapActual * RING_RATIO`）、
  子环间距（`spreadActual * RING_RATIO`）。只考虑同环间距会让相邻环的球叠在一起。
- 标签避让：星球本身也是障碍物，但**必须排除标签自己那颗球**
  （否则每个标签都被自己的星球挡掉，结果是 0 个标签能显示）；
  上下两个候选位置都要试；长公司名按宽度截断。
- **星图默认（100%）钉在画布正中、不可拖动**，只有放大到装不下时才允许拖动看边缘
  （`clampStarPan` 推导出的平移上限在 100% 时恰好为 0）。
- 缩放锚点就是画布中心（不要改成"绕光标"，那会把星图推离中心）。范围 0.4x ~ 4x，
  滚轮或左上角 `.star-zoom` 按钮均可。控件由 `renderStarMap` 在 JS 里创建
  （`starCanvasWrap` 每次渲染都被 `innerHTML` 清空，写在 HTML 里会被抹掉）。
  控件放**左上角**：星图区域在矮窗口下会比视口高（页面可滚动），贴底会落到折线以下。
- 星图区域高度用 `fitStarViewHeight()` 按 `max(600, 视口高 − 星图顶部偏移)` 实算，
  **不要再用写死的 `calc(100vh - 140px)`** —— 顶部实际约 237px，写死会让底部被切掉约 100px。
  下限 600 是刻意的：窗口矮时不硬压扁画布，而是让页面可以上下滚动，
  用滚动的空间换星图的绘制空间。
- 星图缩放比例/平移量存在模块级的 `starViewXform` 里，跨次重渲染保留
  （否则窗口一改大小缩放就跳回 100%）。
- `lsGet` 解压后**不能直接 JSON.parse 就当失败**：`lsSet` 对字符串是原样压缩的
  （投递总结就是纯文本），解析失败时要返回解压出来的原文。
  写回 JSON.parse 会让"纯文本值永远读不回来"——数据在存储里、读出来却是 null。
- **增量数据要同步加进 `buildBackup()` / `importData()`**。目前打包 7 类：
  jobs / jobList / reviews / resume / summary / triage / reminder。
  新加一类持久化数据（新的 localStorage key）时必须一并加进去，否则
  "导出 → 换环境 → 导入"会静默丢数据（`.probe-backup.js` 会守住这条）。
- 星图星球的位置与公转**必须沿弧长推进，不能按角度推进**（`makeEllipseArcMap` 提供弧长↔角度换算）。
  椭圆不是旋转对称的：在角度上加减会破坏"等弧长"，星球间距立刻变得疏密不均
  （实测 a=68.4,b=42.4,n=7 时 phase=0 → max/min=1.000，phase=1.0 → 1.868）。
  同理，让星球"转起来"也要累加弧长再用查表器反算角度，而不是 `angle += speed*dt`。
- **岗位清单会自动清理两类岗位**（`pruneJobList`，启动时与每次同步后各一次）：
  - `pruneExpiredJobs` —— 已截止。判定复用 `deadlineBucketOf` 的「已截止」档，
    边界是：只删**严格早于今天**的；**今天截止的必须保留**；没有截止日期或日期不合法的也不删。
  - `pruneInternshipJobs` —— 批次含「实习」。**只按批次字段匹配，不碰职位名**
    （按职位名会误伤正文提到实习的正式岗；实测"批次为空但职位名含实习"为 0 条）。
    「提前批」不含"实习"二字，不会被误删。
  - 两条规则依次执行，各自只统计自己删掉的数量，不会重复计数；总数即清单实际减少数。
  - 破坏性操作，所以在「⚙️ 设置」里有开关（`autoCleanExpired` / `autoCleanInternship`，默认开）。
    关掉再打开会立即执行一次。清理结果会在控制台、启动提示、同步结果里各报一次。

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
