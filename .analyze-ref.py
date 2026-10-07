"""分析参考图：提取主色、区域结构、星云/星球的色彩特征。
模型看不了图，所以用色彩聚类 + 空间分区把图像"翻译"成可用的数值描述。
"""
import sys
from collections import Counter
from PIL import Image

for name in sys.argv[1:]:
    im = Image.open(name).convert("RGB")
    W, H = im.size
    print(f"\n{'='*70}\n{name}   {W}x{H}\n{'='*70}")
    small = im.resize((min(W, 320), int(min(W, 320) * H / W)))
    px = list(small.getdata())

    # 整体色彩统计
    def q(c, s=32): return tuple((v // s) * s for v in c)
    cnt = Counter(q(p) for p in px)
    tot = len(px)
    print("\n-- 主色（量化到 32 级，前 14）--")
    for c, n in cnt.most_common(14):
        print(f"   rgb{c}  {n/tot*100:5.1f}%   #{c[0]:02x}{c[1]:02x}{c[2]:02x}")

    # 亮度分布
    lums = [0.2126*p[0]+0.7152*p[1]+0.0722*p[2] for p in px]
    lums.sort()
    print(f"\n-- 亮度 --  min {lums[0]:.0f}  p25 {lums[len(lums)//4]:.0f}  "
          f"median {lums[len(lums)//2]:.0f}  p75 {lums[3*len(lums)//4]:.0f}  max {lums[-1]:.0f}")
    dark = sum(1 for l in lums if l < 40) / tot * 100
    print(f"   暗部(<40)占比 {dark:.1f}%")

    # 饱和度：区分"彩色星云"与"灰白星球"
    def sat(p):
        mx, mn = max(p), min(p)
        return 0 if mx == 0 else (mx - mn) / mx
    sats = [sat(p) for p in px]
    hi = sum(1 for s in sats if s > 0.5) / tot * 100
    mid = sum(1 for s in sats if 0.25 < s <= 0.5) / tot * 100
    print(f"\n-- 饱和度 -- 高饱和(>0.5) {hi:.1f}%   中饱和(0.25~0.5) {mid:.1f}%")

    # 高饱和色的聚类（星云颜色）
    hicol = Counter(q(p, 24) for p in px if sat(p) > 0.45 and max(p) > 60)
    if hicol:
        print("\n-- 高饱和色（疑似星云/发光体）前 12 --")
        for c, n in hicol.most_common(12):
            r, g, b = c
            hue = ""
            if b > r and b > g: hue = "蓝紫"
            elif r > g and r > b: hue = "红/洋红"
            elif g > r and g > b: hue = "青绿"
            print(f"   #{r:02x}{g:02x}{b:02x}  rgb{c}  {n/len(px)*100:5.2f}%   {hue}")

    # 九宫格区域平均色（看构图）
    print("\n-- 3x3 区域平均色 --")
    for gy in range(3):
        row = []
        for gx in range(3):
            box = im.crop((gx*W//3, gy*H//3, (gx+1)*W//3, (gy+1)*H//3)).resize((8, 8))
            d = list(box.getdata())
            avg = tuple(sum(c[i] for c in d)//len(d) for i in range(3))
            row.append(f"#{avg[0]:02x}{avg[1]:02x}{avg[2]:02x}")
        print("   " + "  ".join(row))
