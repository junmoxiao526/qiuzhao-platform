/* 秋招管理平台 —— Service Worker
 *
 * 为什么要它：
 *   站点托管在 GitHub Pages，实测国内下载 323KB 需要 8~60 秒（5~38 KB/s，还会超时）。
 *   代码优化救不了带宽，但可以让**第一次之后的每次打开都几乎瞬间**：
 *   把应用外壳缓存到本地，访问时先返回缓存、同时后台静默拉新版。
 *
 * 策略：stale-while-revalidate（先给旧的，再悄悄更新）
 *   - 有缓存 → 立刻返回（秒开），后台请求网络并把新版本写回缓存
 *   - 无缓存 → 走网络，成功后写入缓存
 *   - 只处理同源 GET；第三方接口（招聘方舟 API）一律不碰，避免缓存到岗位数据
 */
const CACHE = 'qiuzhao-shell-v1';

self.addEventListener('install', function () {
  // 新版 SW 立即进入等待结束状态，不等旧页面全关
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      // 清掉旧版本缓存，避免无限堆积
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () {
      return self.clients.claim();   // 立刻接管已有页面
    })
  );
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }

  // 只管本站资源；招聘方舟的接口是跨域，必须走网络（不能缓存岗位数据）
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      // ignoreSearch：应用会给 URL 加 ?cb=xxx 做缓存穿透，这里按"同路径"命中
      return cache.match(req, { ignoreSearch: true }).then(function (cached) {
        // 后台更新：无论有没有缓存都去拉一次新版
        const network = fetch(req).then(function (res) {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(function () { return null; });

        if (cached) return cached;                       // ★ 秒开的来源
        return network.then(function (res) {
          return res || new Response('离线且无缓存', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        });
      });
    })
  );
});
