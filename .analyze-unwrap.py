"""终极验收：把星系盘展开成 (半径 x 方位角) 的位图并打印文本图。
若存在旋臂，文本图里应看到 2 条**斜向条纹**（暗=臂间，亮=臂上）。

这是不依赖图像输入模型的最终证据 —— 直接以字符画形式"看"到螺旋。
"""
import sys, math
from PIL import Image

path = sys.argv[1] if len(sys.argv) > 1 else "galaxy-only.png"
im = Image.open(path).convert("RGB")
W, H = im.size
px = im.load()
TOP, RR = 237, 0.62
cw, ch = W - 360, H - TOP
cx, cy = cw / 2.0, TOP + (ch - 46) / 2.0
maxr = min(cw, ch) / 2.0

def lum(p): return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]

NR, NA = 26, 88
acc = [[0.0] * NA for _ in range(NR)]
cnt = [[0] * NA for _ in range(NR)]
for y in range(TOP, H):
    dy = (y - cy) / RR
    for x in range(0, cw):
        dx = x - cx
        d = math.hypot(dx, dy)
        if d >= maxr: continue
        ri = int(d / maxr * NR)
        if ri >= NR: continue
        a = (math.atan2(dy, dx) + math.pi * 2) % (math.pi * 2)
        ai = int(a / (math.pi * 2) * NA) % NA
        acc[ri][ai] += lum(px[x, y]); cnt[ri][ai] += 1

prof = [[acc[r][a] / cnt[r][a] if cnt[r][a] else 0.0 for a in range(NA)] for r in range(NR)]

# 每行按该行自身做归一化，突出环向起伏（否则径向衰减会盖掉一切）
chars = " .:-=+*#%@"
print("radius x azimuth map  (rows=radius inner->outer, cols=azimuth 0..360)")
print("bright=arm  dark=inter-arm")
print("    " + "".join(str((i // 11) % 10) for i in range(NA)))
for r in range(1, NR):
    row = prof[r]
    lo, hi = min(row), max(row)
    if hi - lo < 1e-6:
        print(f"{r/NR*100:3.0f}% " + " " * NA)
        continue
    line = ""
    for a in range(NA):
        v = (row[a] - lo) / (hi - lo)
        line += chars[min(len(chars) - 1, int(v * (len(chars) - 1) + 0.5))]
    print(f"{r/NR*100:3.0f}% {line}")

# 追踪亮脊的方位角漂移。
# 注意：这是**两条**旋臂，相差 180°。逐行直接取"全局最亮"会在两臂之间来回跳，
# 于是每次换臂都产生一个约 ±180° 的假漂移。
# 正确做法：把漂移按模 180° 归约（双臂对称），再看是否稳定同号。
print("\narm ridge tracking (brightest azimuth per radius, folded mod 180 for 2 arms):")
prev = None
steps = []
for r in range(2, NR):
    row = prof[r]
    lo, hi = min(row), max(row)
    if hi - lo < 0.5: continue
    sm = [sum(row[(a + k) % NA] for k in range(-2, 3)) / 5 for a in range(NA)]
    a0 = sm.index(max(sm))
    deg = a0 / NA * 360
    if prev is not None:
        # 归约到 (-90, 90]：两臂等价，跳臂不应算作漂移
        d = (deg - prev + 90) % 180 - 90
        steps.append(d)
    print(f"  r={r/NR*100:3.0f}%  azimuth={deg:6.1f}  {'folded drift %+.1f' % steps[-1] if steps else ''}")
    prev = deg
if steps:
    pos = sum(1 for s in steps if s > 1)
    neg = sum(1 for s in steps if s < -1)
    total = sum(steps)
    print(f"\nfolded drift: {pos} steps forward, {neg} steps backward, net {total:+.0f} deg")
    ok = (pos >= len(steps) * 0.7 and total > 80) or (neg >= len(steps) * 0.7 and total < -80)
    print(f"consistent winding (real 2-arm spiral) = {'YES' if ok else 'NO'}")
