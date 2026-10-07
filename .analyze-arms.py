"""直接分析 galaxy-only.png：证明旋臂是否真的存在。

做法：极坐标重采样（按 RING_RATIO 反压扁），
把每个像素的亮度摊到 (半径, 方位角) 网格上。
若存在 2 条旋臂，则在固定半径上，亮度随角度应出现 **2 个峰**；
且峰值位置应随半径**连续旋转**（这就是螺旋）。
"""
import sys, math
from PIL import Image

path = sys.argv[1] if len(sys.argv) > 1 else "galaxy-only.png"
im = Image.open(path).convert("RGB")
W, H = im.size
px = im.load()
print(f"image {W}x{H}")

TOP = 237
RR = 0.62
cw = W - 360
ch = H - TOP
cx = cw / 2.0
cy = TOP + (ch - 46) / 2.0
maxr = min(cw, ch) / 2.0

def lum(p):
    return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]

# ---- 极坐标网格：半径 24 档 x 角度 96 档 ----
NR, NA = 24, 96
acc = [[0.0] * NA for _ in range(NR)]
cnt = [[0] * NA for _ in range(NR)]
blackish = 0
tot = 0

for y in range(TOP, H):
    dy = (y - cy) / RR
    for x in range(0, W - 360):
        dx = x - cx
        d = math.hypot(dx, dy)
        if d >= maxr:
            continue
        tot += 1
        l = lum(px[x, y])
        if l < 8:
            blackish += 1
        ri = int(d / maxr * NR)
        if ri >= NR:
            continue
        a = (math.atan2(dy, dx) + math.pi * 2) % (math.pi * 2)
        ai = int(a / (math.pi * 2) * NA) % NA
        acc[ri][ai] += l
        cnt[ri][ai] += 1

print(f"disc pixels {tot}   black(<8) {blackish/tot*100:.1f}%")

prof = [[acc[r][a] / cnt[r][a] if cnt[r][a] else 0.0 for a in range(NA)] for r in range(NR)]

# ---- 环向对比度：每个半径上 (p90-p10)/p50 ----
print("\n[r]  radius%%   mean   p10    p50    p90   contrast   peaks")
peak_positions = []
for r in range(2, NR):
    row = sorted(prof[r])
    if not row or max(row) == 0:
        continue
    def q(p):
        return row[min(len(row) - 1, int(len(row) * p))]
    p10, p50, p90 = q(0.10), q(0.50), q(0.90)
    mean = sum(row) / len(row)
    contrast = (p90 - p10) / p50 if p50 > 0.5 else 0
    # 找环向峰（平滑后）
    sm = [sum(prof[r][(a + k) % NA] for k in range(-2, 3)) / 5 for a in range(NA)]
    peaks = []
    for a in range(NA):
        if sm[a] == max(sm) or (sm[a] > sm[(a - 1) % NA] and sm[a] > sm[(a + 1) % NA] and sm[a] > mean * 1.15):
            peaks.append(round(a / NA * 360))
    peaks = sorted(set(peaks))
    peak_positions.append((round(r / NR * 100), peaks))
    rp = " ".join(f"{v:6.1f}" for v in (mean, p10, p50, p90))
    print(f"[{r:2d}] {r/NR*100:5.0f}% {rp}   {contrast:6.2f}   {peaks[:6]}")

# ---- 螺旋证据：峰位是否随半径单调旋转 ----
print("\nspiral check: peak angle drift vs radius")
drift = []
prev = None
for rp, peaks in peak_positions:
    if not peaks:
        continue
    a0 = peaks[0]
    if prev is not None:
        d = (a0 - prev + 540) % 360 - 180
        drift.append(d)
    prev = a0
if drift:
    tot_drift = sum(drift)
    print(f"  total drift {tot_drift:.0f} deg over {len(drift)} steps")
    print(f"  monotonic-ish: {'YES' if abs(tot_drift) > 60 else 'NO'} (expect a few hundred deg for a spiral)")
else:
    print("  no peaks found")

print(f"\n[verdict] inter-arm black fraction: {blackish/tot*100:.1f}%")
