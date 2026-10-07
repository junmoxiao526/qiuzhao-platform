"""对比 galaxy-only 与 galaxy+planets：确认星系结构仍在、且没把星球淹没。"""
import sys, math
from PIL import Image

def analyze(path, label):
    im = Image.open(path).convert("RGB")
    W, H = im.size
    px = im.load()
    TOP = 237
    RR = 0.62
    cw, ch = W - 360, H - TOP
    cx, cy = cw / 2.0, TOP + (ch - 46) / 2.0
    maxr = min(cw, ch) / 2.0
    def lum(p): return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]

    lit = tot = 0
    sat_hi = 0
    for y in range(TOP, H):
        dy = (y - cy) / RR
        for x in range(0, cw):
            dx = x - cx
            if math.hypot(dx, dy) >= maxr: continue
            tot += 1
            p = px[x, y]
            l = lum(p)
            if l > 12: lit += 1
            mx, mn = max(p), min(p)
            if mx > 60 and (mx - mn) / mx > 0.5: sat_hi += 1
    print(f"{label:22s} lit={lit/tot*100:5.1f}%  高饱和(星球)={sat_hi/tot*100:4.1f}%")

for p, l in [("galaxy-only.png", "星系（无星球）"), ("galaxy.png", "星系 + 50 星球")]:
    try:
        analyze(p, l)
    except Exception as e:
        print(f"{l}: {e}")
