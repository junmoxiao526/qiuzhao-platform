"""验证"颜色随亮度变化"这条规律 —— 这是真实星云最本质的特征。

如果成立，那么正确做法是：星云的颜色不能是一个固定色，
而应该由**亮度**驱动：暗处高饱和（深青/深蓝），亮处去饱和趋向白。
"""
import sys, math
from PIL import Image

def lum(p): return 0.2126*p[0] + 0.7152*p[1] + 0.0722*p[2]
def sat(p):
    mx, mn = max(p), min(p)
    return 0 if mx == 0 else (mx-mn)/mx

for name in sys.argv[1:]:
    im = Image.open(name).convert("RGB")
    W, H = im.size
    tw = 420
    sm = im.resize((tw, max(1, int(tw*H/W))))
    px = sm.load(); w, h = sm.size
    print(f"\n{'='*74}\n{name}  ({w}x{h})\n{'='*74}")

    # 按亮度分 12 档，看每档的平均饱和度与色相
    NB = 12
    acc = [[0,0,0,0,0.0] for _ in range(NB)]   # r,g,b,n,sat
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            l = lum(p)
            bi = min(NB-1, int(l/256*NB))
            a = acc[bi]
            a[0]+=p[0]; a[1]+=p[1]; a[2]+=p[2]; a[3]+=1; a[4]+=sat(p)
    print(f"{'亮度档':>12} {'占比':>6}  {'平均色':>16} {'饱和度':>7}  视觉")
    tot = w*h
    for bi in range(NB):
        a = acc[bi]
        if not a[3]: continue
        r,g,b = a[0]/a[3], a[1]/a[3], a[2]/a[3]
        s = a[4]/a[3]
        # 色名
        mx = max(r,g,b)
        if mx < 8: nm = "黑"
        elif s < 0.12: nm = "白/灰"
        elif b > r and b > g: nm = "蓝"
        elif g > r and g >= b: nm = "青绿"
        elif r > b: nm = "红/暖"
        else: nm = "?"
        print(f"  {bi*256//NB:3d}-{(bi+1)*256//NB-1:3d}  {a[3]/tot*100:5.1f}%  "
              f"rgb({r:3.0f},{g:3.0f},{b:3.0f})  {s:6.3f}  {nm}")

    # 相关性：亮度 vs 饱和度
    pairs = []
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            p = px[x, y]
            pairs.append((lum(p), sat(p)))
    n = len(pairs)
    ml = sum(p[0] for p in pairs)/n
    ms = sum(p[1] for p in pairs)/n
    cov = sum((p[0]-ml)*(p[1]-ms) for p in pairs)/n
    sl = math.sqrt(sum((p[0]-ml)**2 for p in pairs)/n)
    ss = math.sqrt(sum((p[1]-ms)**2 for p in pairs)/n)
    corr = cov/(sl*ss) if sl*ss else 0
    print(f"\n  亮度 vs 饱和度 相关系数 = {corr:+.3f}")
    print("  → " + ("越亮越**去饱和**（趋向白）：符合真实星云" if corr < -0.15
                    else "无明显关系" if abs(corr) <= 0.15
                    else "越亮越饱和（不寻常）"))
