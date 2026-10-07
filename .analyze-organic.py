"""验证用户的三个诉求：
  A. 星云里不要有黑色斑块
     → 统计"被亮星云包围的暗像素"（黑洞特征）。擦除式尘埃会产生大量这种像素。
  B. 每种星云的边界别太分明
     → 沿径向取亮度剖面，量波峰/波谷对比。边界清晰 → 在环半径处出现尖锐峰值。
  C. 不是标准椭圆
     → 沿同一条环扫一圈，量半径的起伏（标准椭圆应接近 0）。
"""
import sys
import numpy as np
from PIL import Image

def lum(a): return 0.2126*a[:,:,0] + 0.7152*a[:,:,1] + 0.0722*a[:,:,2]

def analyze(path):
    a = np.asarray(Image.open(path).convert("RGB"), dtype=np.float32)
    H, W, _ = a.shape
    L = lum(a)
    print("="*74)
    print(f"{path}   {W}x{H}")
    print("="*74)

    # 中心（星图在画布中央，图例在底部 46px）
    cx, cy = W/2, (H-46)/2
    RR = 0.62

    # ---- A. 黑色斑块 ----
    dark = L < 18
    bright = L > 62
    n_dark = int(dark.sum())
    hole = 0
    R = 5
    ys, xs = np.where(dark)
    step = max(1, len(ys)//12000)
    for y, x in zip(ys[::step], xs[::step]):
        y0, y1 = max(0,y-R), min(H,y+R+1)
        x0, x1 = max(0,x-R), min(W,x+R+1)
        nb = bright[y0:y1, x0:x1]
        if nb.size and nb.mean() > 0.55:      # 邻域大部分是亮的
            hole += 1
    print(f"\n[A] 黑色斑块（被亮区包围的暗像素）")
    print(f"    按 {step} 抽样估计共 {hole*step} 个，占画面 {hole*step/(W*H)*100:.3f}%")
    print(f"    -> {'[FAIL] 仍有明显黑洞' if hole*step/(W*H) > 0.002 else '[OK] 基本没有黑洞'}")

    # ---- B. 径向亮度剖面（环边界是否分明）----
    maxr = int(min(W/2, (H-46)/2) / 1.0)
    bins = 140
    prof = np.zeros(bins); cnt = np.zeros(bins)
    for y in range(0, H, 2):
        for x in range(0, W, 2):
            dx = (x-cx); dy = (y-cy)/RR
            rr = np.hypot(dx, dy)
            bi = int(rr/maxr*bins)
            if 0 <= bi < bins:
                prof[bi] += L[y, x]; cnt[bi] += 1
    ok = cnt > 5
    prof = prof[ok]/cnt[ok]
    # 只看盘内（前 80%）
    p = prof[:int(len(prof)*0.85)]
    if len(p) > 8:
        sm = np.convolve(p, np.ones(5)/5, mode='same')
        # 波峰波谷对比
        contrast = (sm.max()-sm.min())/(sm.mean()+1e-6)
        # 局部起伏（二阶差分能量）：尖锐的环边界会让它变高
        rough = np.abs(np.diff(sm, 2)).mean()
        print(f"\n[B] 径向亮度剖面（环边界是否分明）")
        print(f"    剖面峰谷对比 {contrast:.3f}   局部起伏(二阶差分) {rough:.3f}")
        print(f"    （数值越大 = 环与环之间越有清晰的明暗分界）")

    # ---- C. 环的半径起伏（是否标准椭圆）----
    # 取一条环半径附近的最亮半径，扫一圈看它的变化
    r_probe = 0.62
    angs = np.linspace(0, 2*np.pi, 180, endpoint=False)
    peaks = []
    for ang in angs:
        best_r, best_v = None, -1
        for rr in np.linspace(maxr*r_probe*0.75, maxr*r_probe*1.25, 60):
            x = int(cx + np.cos(ang)*rr)
            y = int(cy + np.sin(ang)*rr*RR)
            if 0 <= x < W and 0 <= y < H and L[y, x] > best_v:
                best_v = L[y, x]; best_r = rr
        if best_r: peaks.append(best_r)
    peaks = np.array(peaks)
    if len(peaks) > 10:
        rel = peaks.std()/peaks.mean()
        print(f"\n[C] 环半径沿方位角的起伏")
        print(f"    平均半径 {peaks.mean():.1f}  标准差 {peaks.std():.1f}  相对起伏 {rel*100:.1f}%")
        print(f"    -> {'[OK] 明显不是标准椭圆' if rel > 0.05 else '[FAIL] 仍接近标准椭圆'}")

for p in sys.argv[1:]:
    analyze(p)
