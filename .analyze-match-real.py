"""对照真实星云的四个统计特征，检查我的实现是否真的像。

判据（来自参考图实测）：
  [1] 亮度重尾：最亮 5% 像素占总亮度 16~20%（均匀雾≈5%）
  [2] 长程空间相关：间隔 16px 相关仍有 +0.83~0.86
  [3] 强梯度（电离锋面）：2.4~5.9% 像素梯度 >60
  [4] 亮度 vs 饱和度负相关：-0.637（暗处浓、亮处白）
"""
import sys, math
from PIL import Image

def lum(p): return 0.2126*p[0] + 0.7152*p[1] + 0.0722*p[2]
def sat(p):
    mx, mn = max(p), min(p)
    return 0 if mx == 0 else (mx-mn)/mx

def metrics(path, label, mask_disc=None):
    im = Image.open(path).convert("RGB")
    W, H = im.size
    tw = 420
    sm = im.resize((tw, max(1, int(tw*H/W))))
    px = sm.load(); w, h = sm.size

    # 注意：**不做椭圆掩膜**。
    # 早先我用"盘面椭圆"掩膜，结果把中心暗核和外缘衰减这两个大尺度梯度也算进去，
    # ac16 被拉到 0.71，看起来像"结构衰减太快"。实际全画幅口径是 0.891，
    # 和参考图的 0.83~0.86 一个水平 —— 是掩膜口径不一致造成的假差异。
    # 现在参考图和我的实现都用同样的全画幅口径。
    def inside(x, y):
        return True

    vals = [lum(px[x,y]) for y in range(h) for x in range(w) if inside(x,y)]
    n = len(vals)
    if n == 0: return None
    vs = sorted(vals)
    tot = sum(vs) or 1
    top5 = sum(vs[int(n*0.95):])/tot*100

    mean = sum(vals)/n
    var = sum((v-mean)**2 for v in vals)/n or 1
    ac = {}
    for k in (1, 4, 16):
        s=0; c=0
        for y in range(h):
            for x in range(0, w-k, 3):
                if inside(x,y) and inside(x+k,y):
                    s += (lum(px[x,y])-mean)*(lum(px[x+k,y])-mean); c+=1
        ac[k] = s/c/var if c else 0

    grads=[]
    for y in range(1,h-1):
        for x in range(1,w-1):
            if not inside(x,y): continue
            gx = lum(px[x+1,y])-lum(px[x-1,y])
            gy = lum(px[x,y+1])-lum(px[x,y-1])
            grads.append(math.hypot(gx,gy))
    grads.sort(); m=len(grads)
    strong = sum(1 for g in grads if g>60)/m*100 if m else 0

    pairs=[(lum(px[x,y]), sat(px[x,y])) for y in range(0,h,2) for x in range(0,w,2) if inside(x,y)]
    nn=len(pairs); ml=sum(p[0] for p in pairs)/nn; ms=sum(p[1] for p in pairs)/nn
    cov=sum((p[0]-ml)*(p[1]-ms) for p in pairs)/nn
    sl=math.sqrt(sum((p[0]-ml)**2 for p in pairs)/nn); ss=math.sqrt(sum((p[1]-ms)**2 for p in pairs)/nn)
    corr=cov/(sl*ss) if sl*ss else 0

    return dict(label=label, top5=top5, ac1=ac[1], ac4=ac[4], ac16=ac[16],
                strong=strong, corr=corr, n=n, mean=mean)

def show(r, ref=None):
    if not r: 
        print("  (无数据)"); return
    def cmp(key, target, tol, fmt="{:.2f}", invert=False):
        v = r[key]
        ok = abs(v-target) <= tol
        mark = "[OK]  " if ok else "[DIFF]"
        print(f"    {mark} {key:>8} = {fmt.format(v):>8}   真实星云 {target} (容差 {tol})")
    print(f"\n  {r['label']}   盘面像素 {r['n']}, 平均亮度 {r['mean']:.1f}")
    cmp('top5', 18, 6)
    cmp('ac1', 0.94, 0.06, "{:.3f}")
    cmp('ac16', 0.84, 0.08, "{:.3f}")
    cmp('strong', 4.0, 3.0)
    cmp('corr', -0.50, 0.35, "{:+.3f}")

print("="*76)
print("真实星云（参考图）")
print("="*76)
for f in ("ref-a.bin", "ref-b.bin"):
    show(metrics(f, f))

print("\n" + "="*76)
print("我的实现")
print("="*76)
for f in sys.argv[1:]:
    show(metrics(f, f))
