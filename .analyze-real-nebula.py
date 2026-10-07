"""深挖参考图：真实星云到底长什么样。

上一轮我只看了主色和构图，太粗。这次从"物理特征"角度量：
 1. 亮度分布 —— 星云不是均匀的雾，是**幂律/重尾**的（少量很亮的丝 + 大量暗底）
 2. 空间自相关 —— 真实气体有**尺度不变的分形结构**，不是白噪声也不是平滑渐变
 3. 边缘锐度 —— 星云有**锐利的电离锋面**（亮边），这是最显著的特征之一
 4. 颜色-亮度相关性 —— 不同气体（Hα红 / OIII青 / 反射蓝）分布在哪
 5. 暗尘 —— 是否有**遮挡**（暗带切进亮区）
"""
import sys, math
from PIL import Image

def lum(p): return 0.2126*p[0] + 0.7152*p[1] + 0.0722*p[2]

for name in sys.argv[1:]:
    im = Image.open(name).convert("RGB")
    W, H = im.size
    # 缩到固定宽度便于比较，但保留足够细节
    tw = 512
    sm = im.resize((tw, max(1, int(tw*H/W))))
    px = sm.load()
    w, h = sm.size
    print(f"\n{'='*72}\n{name}  原图 {W}x{H}  →  分析 {w}x{h}\n{'='*72}")

    vals = [lum(px[x, y]) for y in range(h) for x in range(w)]
    vals_sorted = sorted(vals)
    n = len(vals_sorted)
    def pct(p): return vals_sorted[min(n-1, int(n*p))]
    print("\n[1] 亮度分布（判断是否幂律重尾）")
    print(f"    p50={pct(0.5):6.1f}  p90={pct(0.9):6.1f}  p99={pct(0.99):6.1f}  max={vals_sorted[-1]:6.1f}")
    print(f"    均值={sum(vals)/n:6.1f}")
    # 重尾指标：前 5% 的像素贡献了多少总亮度
    top5 = sum(vals_sorted[int(n*0.95):])
    tot = sum(vals_sorted) or 1
    print(f"    最亮 5% 像素占总亮度 {top5/tot*100:5.1f}%   （均匀雾≈5%，重尾会明显更高）")
    darkfrac = sum(1 for v in vals if v < 25)/n*100
    print(f"    暗部(<25)占比 {darkfrac:5.1f}%")

    # [2] 空间自相关：相邻像素亮度相关 vs 间隔 k 的相关
    print("\n[2] 空间自相关（分形结构的证据）")
    mean = sum(vals)/n
    var = sum((v-mean)**2 for v in vals)/n or 1
    for k in (1, 2, 4, 8, 16):
        s = 0; c = 0
        for y in range(h):
            for x in range(0, w-k, 3):
                s += (lum(px[x, y])-mean)*(lum(px[x+k, y])-mean); c += 1
        print(f"    间隔 {k:2d}px: 相关 {s/c/var:+.3f}")

    # [3] 边缘锐度：梯度幅值分布。星云的电离锋面会造成少量极强梯度
    print("\n[3] 边缘锐度（电离锋面 = 少量强梯度）")
    grads = []
    for y in range(1, h-1):
        for x in range(1, w-1):
            gx = lum(px[x+1, y]) - lum(px[x-1, y])
            gy = lum(px[x, y+1]) - lum(px[x, y-1])
            grads.append(math.hypot(gx, gy))
    grads.sort()
    m = len(grads)
    print(f"    梯度 p50={grads[m//2]:5.1f}  p90={grads[int(m*.9)]:5.1f}  p99={grads[int(m*.99)]:5.1f}  max={grads[-1]:6.1f}")
    print(f"    强梯度(>60)占比 {sum(1 for g in grads if g>60)/m*100:5.2f}%")

    # [4] 颜色-亮度：不同亮度区间的平均色
    print("\n[4] 不同亮度的平均色（看气体分层）")
    buckets = {i: [0,0,0,0] for i in range(5)}
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            l = lum(p)
            bi = min(4, int(l/51))
            b = buckets[bi]
            b[0]+=p[0]; b[1]+=p[1]; b[2]+=p[2]; b[3]+=1
    for bi in range(5):
        b = buckets[bi]
        if b[3]:
            r,g,bl = b[0]//b[3], b[1]//b[3], b[2]//b[3]
            tag = "蓝" if bl>r+12 else ("红/暖" if r>bl+12 else "中性")
            print(f"    亮度 {bi*51:3d}-{bi*51+50:3d}: rgb({r:3d},{g:3d},{bl:3d})  {b[3]/n*100:5.1f}%  {tag}")

    # [5] 暗尘遮挡：亮区里嵌进去的暗像素
    print("\n[5] 暗尘遮挡（亮区中的暗缝）")
    bright_dark = 0; bright_tot = 0
    R = 6
    for y in range(R, h-R):
        for x in range(R, w-R):
            if lum(px[x, y]) > 60:
                nb = [lum(px[x+dx, y+dy]) for dx in range(-R, R+1) for dy in range(-R, R+1)]
                if sum(1 for v in nb if v > 60) > len(nb)*0.55:
                    bright_tot += 1
    # 更直接：亮区内部的暗像素比例
    for y in range(h):
        for x in range(w):
            l = lum(px[x, y])
            if l < 25:
                # 邻域是否亮
                cnt = 0; tt = 0
                for dx in (-3, 0, 3):
                    for dy in (-3, 0, 3):
                        xx, yy = x+dx, y+dy
                        if 0 <= xx < w and 0 <= yy < h:
                            tt += 1
                            if lum(px[xx, yy]) > 70: cnt += 1
                if tt and cnt >= tt*0.5:
                    bright_dark += 1
    print(f"    被亮区包围的暗像素 {bright_dark} 个（{bright_dark/n*100:.3f}%）")
    print("    " + ("存在遮挡式暗尘（亮区被暗带切入）" if bright_dark > n*0.001 else "遮挡不明显"))
