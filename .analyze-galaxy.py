"""：""。

（）：
1.       —— 、
2.       —— （）
3.     —— ，（）
4.       —— 
5.     —— （R>B），（B>=R）
"""
import sys
from PIL import Image

path = sys.argv[1] if len(sys.argv) > 1 else "galaxy.png"
im = Image.open(path).convert("RGB")
W, H = im.size
px = im.load()
print(f" {W}x{H}")

# ： 237px ， 360px 
TOP = 237
BOTTOM = H
LEFT = 0
RIGHT = W - 360
cw, ch = RIGHT - LEFT, BOTTOM - TOP
cx, cy = LEFT + cw / 2, TOP + (ch - 46) / 2   # ： 46
print(f" {cw}x{ch}   ({cx:.0f},{cy:.0f})")

def lum(p):
    return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]

# ---------- 1.  ----------
total = 0
lit = 0
mx = 0
sum_l = 0
for y in range(TOP, BOTTOM, 3):
    for x in range(LEFT, RIGHT, 3):
        p = px[x, y]
        l = lum(p)
        total += 1
        sum_l += l
        if l > mx:
            mx = l
        if l > 12:
            lit += 1
print(f"\n[1]  {lit/total*100:.1f}%    {mx:.0f}    {sum_l/total:.1f}")
print("    " + ("[OK] " if lit / total > 0.08 else "[FAIL] ，"))

# ---------- 2. （） ----------
import math
NB = 14
bins = [0.0] * NB
cnts = [0] * NB
maxr = min(cw, ch) / 2 * 1.05
for y in range(TOP, BOTTOM, 2):
    for x in range(LEFT, RIGHT, 2):
        d = math.hypot(x - cx, y - cy) / maxr
        b = int(d * NB)
        if 0 <= b < NB:
            bins[b] += lum(px[x, y]); cnts[b] += 1
prof = [bins[i] / cnts[i] if cnts[i] else 0 for i in range(NB)]
print("\n[2] （ → ）")
print("    " + "  ".join(f"{v:5.1f}" for v in prof))
decreasing = all(prof[i] >= prof[i + 1] - 1.5 for i in range(4))
print("    " + ("[OK] （）" if prof[0] > prof[NB-1] * 1.5 else "[WARN] "))

# ---------- 3. ： ----------
NA = 72
abins = [0.0] * NA
acnts = [0] * NA
for y in range(TOP, BOTTOM, 2):
    for x in range(LEFT, RIGHT, 2):
        dx, dy = x - cx, (y - cy) / 0.62
        d = math.hypot(dx, dy) / maxr
        if d < 0.25 or d > 0.95:
            continue
        a = (math.atan2(dy, dx) + math.pi * 2) % (math.pi * 2)
        b = int(a / (math.pi * 2) * NA)
        abins[b] += lum(px[x, y]); acnts[b] += 1
aprof = [abins[i] / acnts[i] if acnts[i] else 0 for i in range(NA)]
mean_a = sum(aprof) / NA
var_a = sum((v - mean_a) ** 2 for v in aprof) / NA
sd_a = var_a ** 0.5
print(f"\n[3] ： {mean_a:.1f}   {sd_a:.1f}   {sd_a/mean_a*100:.1f}%")
print("    " + ("[OK] （/）" if sd_a / mean_a > 0.12 else "[FAIL] （，）"))

# ---------- 4.  ----------
def warm_ratio(r0, r1):
    wr = 0; n = 0
    for y in range(TOP, BOTTOM, 2):
        for x in range(LEFT, RIGHT, 2):
            d = math.hypot(x - cx, y - cy) / maxr
            if r0 <= d < r1:
                p = px[x, y]
                if lum(p) > 18:
                    n += 1
                    if p[0] > p[2] + 6:
                        wr += 1
    return (wr / n * 100) if n else 0
inner_warm = warm_ratio(0.0, 0.25)
outer_warm = warm_ratio(0.6, 1.0)
print(f"\n[4] ： {inner_warm:.1f}%    {outer_warm:.1f}%")
print("    " + ("[OK] 、（）" if inner_warm > outer_warm else "[WARN] "))

# ---------- 5. ： ----------
dips = 0
for i in range(2, NB - 1):
    if prof[i] < prof[i - 1] - 1.2 and prof[i] < prof[i + 1] - 1.2:
        dips += 1
print(f"\n[5]  {dips}")
print("    " + ("[OK] " if dips >= 1 else "[WARN] （）"))
