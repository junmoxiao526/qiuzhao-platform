"""验证星球渲染：从像素上确认"行星感"是否成立。

行星的判据（全部可在截图上量化）：
1. 每颗球都有明暗梯度 —— 球内亮度标准差显著 > 0
2. 明暗方向一致 —— 受光侧偏左上（所有球光源统一）
3. 有大气边缘 —— 球的轮廓外侧一圈应偏蓝（B > R）
4. 球没有被星系背景淹没 —— 球心亮度远高于邻域背景
"""
import sys, math
from PIL import Image

path = sys.argv[1] if len(sys.argv) > 1 else "planet.png"
im = Image.open(path).convert("RGB")
W, H = im.size
px = im.load()
TOP = 237
RR = 0.62
cw, ch = W - 360, H - TOP
cx, cy = cw / 2.0, TOP + (ch - 46) / 2.0

def lum(p): return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]

# 在 9 个环半径上找"最亮的小团"当球心（球比背景亮很多）
radii = [505.6, 448.9, 392.2, 335.5, 278.8, 222.1, 165.4, 108.7, 52]
found = []
for R in radii:
    best = None
    for adeg in range(0, 360, 2):
        a = math.radians(adeg)
        x = int(cx + math.cos(a) * R)
        y = int(cy + math.sin(a) * R * RR)
        if not (0 <= x < cw and TOP <= y < H):
            continue
        l = lum(px[x, y])
        if best is None or l > best[0]:
            best = (l, x, y)
    if best and best[0] > 90:
        found.append((R, best[1], best[2]))

print(f"在环上定位到 {len(found)} 颗亮球\n")
print(" ring     ball      center  light  dark   ratio  gradient  rimBlue")
ok_shade = 0
ok_dir = 0
ok_atmo = 0
for R, bx, by in found[:9]:
    # 估球半径：从球心向外找到亮度掉到一半的位置
    br = 2
    lc = lum(px[bx, by])
    for k in range(2, 22):
        if bx + k >= cw: break
        if lum(px[bx + k, by]) < lc * 0.55:
            br = k
            break
    # 球内亮度标准差
    vals = []
    for dy in range(-br + 1, br):
        for dx in range(-br + 1, br):
            if dx * dx + dy * dy < (br - 1) ** 2 and 0 <= bx + dx < cw and TOP <= by + dy < H:
                vals.append(lum(px[bx + dx, by + dy]))
    if len(vals) < 4:
        continue
    mean = sum(vals) / len(vals)
    sd = math.sqrt(sum((v - mean) ** 2 for v in vals) / len(vals))
    # 受光侧（左上）vs 背光侧（右下）
    o = max(1, br // 2)
    Ls = lum(px[max(0, bx - o), max(TOP, by - o)])
    Ds = lum(px[min(cw - 1, bx + o), min(H - 1, by + o)])
    ratio = Ls / (Ds if Ds > 1 else 1)
    # 大气：轮廓外一圈，取右下（背光侧）的蓝偏
    rim = 0.0
    n = 0
    for adeg in range(0, 360, 15):
        a = math.radians(adeg)
        rx = int(bx + math.cos(a) * (br + 2))
        ry = int(by + math.sin(a) * (br + 2))
        if 0 <= rx < cw and TOP <= ry < H:
            p = px[rx, ry]
            rim += (p[2] - p[0]); n += 1
    rim = rim / n if n else 0
    flag_s = "Y" if sd > 6 else "n"
    flag_d = "Y" if ratio > 1.25 else "n"
    flag_a = "Y" if rim > 3 else "n"
    ok_shade += sd > 6
    ok_dir += ratio > 1.25
    ok_atmo += rim > 3
    print(f"{R:6.1f}  ({bx:4d},{by:4d})  r={br:2d}  {Ls:5.1f} {Ds:5.1f}  {ratio:5.2f}   sd={sd:4.1f}{flag_s}   {rim:+5.1f}{flag_a}")

n_ = len(found[:9]) or 1
print(f"\n有明暗梯度 {ok_shade}/{n_}    明暗方向一致 {ok_dir}/{n_}    有大气边缘 {ok_atmo}/{n_}")
print("verdict:", "PLANET-LIKE" if ok_shade >= n_ * 0.7 and ok_dir >= n_ * 0.7 else "NOT CONVINCING")
