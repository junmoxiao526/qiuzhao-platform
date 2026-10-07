"""识别参考图的真实结构：M31（仙女座星系）式的倾斜盘星系。

之前我把它当"弥散星云"分析（只量了重尾/自相关/明暗关系），
所以漏掉了它真正的结构特征。这次量结构：
  1. 核球：位置、大小、颜色（M31 的核球是耀眼的暖白）
  2. 盘面朝向：倾角 / 位置角（M31 是倾斜盘，长轴明显）
  3. 尘埃带：M31 最标志性的特征 —— 橙棕色的暗带切过盘面
  4. HII 区：洋红/粉色恒星形成区，沿尘埃带分布
  5. 外盘：蓝色年轻星族
  6. 背景星场：满屏密集星点，这是照片感的重要来源
"""
import numpy as np
from PIL import Image
import sys

def load(name, tw=700):
    im = Image.open(name).convert("RGB")
    W, H = im.size
    a = np.asarray(im.resize((tw, max(1, int(tw*H/W)))), dtype=np.float32)
    return a, W, H

def lum(a):
    return 0.2126*a[:,:,0] + 0.7152*a[:,:,1] + 0.0722*a[:,:,2]

for name in sys.argv[1:]:
    a, W0, H0 = load(name)
    h, w, _ = a.shape
    L = lum(a)
    print("="*78)
    print(f"{name}  original {W0}x{H0}  ->  {w}x{h}")
    print("="*78)

    # ---- 1. 找核球：先大范围平滑，避免被单颗星带偏 ----
    from numpy.lib.stride_tricks import sliding_window_view
    k = 41
    pad = k//2
    Lp = np.pad(L, pad, mode='edge')
    sm = sliding_window_view(Lp, (k, k)).mean(axis=(2,3))
    cy, cx = np.unravel_index(np.argmax(sm), sm.shape)
    print(f"\n[1] 核球")
    print(f"    brightest-smoothed at ({cx}, {cy})  of {w}x{h}")
    # 核球颜色（中心 15px）
    patch = a[max(0,cy-7):cy+8, max(0,cx-7):cx+8].reshape(-1,3)
    pc = patch.mean(axis=0)
    print(f"    core color rgb({pc[0]:.0f},{pc[1]:.0f},{pc[2]:.0f})  lum={lum(np.array([[[pc[0],pc[1],pc[2]]]]))[0,0]:.0f}")

    # ---- 2. 盘面朝向：用亮度的二阶矩 ----
    thresh = np.percentile(L, 75)
    ys, xs = np.where(L > thresh)
    wts = L[ys, xs]
    mx = np.average(xs, weights=wts); my = np.average(ys, weights=wts)
    xx = np.average((xs-mx)**2, weights=wts)
    yy = np.average((ys-my)**2, weights=wts)
    xy = np.average((xs-mx)*(ys-my), weights=wts)
    cov = np.array([[xx, xy],[xy, yy]])
    evals, evecs = np.linalg.eigh(cov)
    pa = np.degrees(np.arctan2(evecs[1,1], evecs[0,1]))
    axis_ratio = np.sqrt(evals[0]/evals[1])
    print(f"\n[2] 盘面朝向（二阶矩）")
    print(f"    中心 ({mx:.0f},{my:.0f})  位置角 {pa:.1f} deg  长宽比 {1/axis_ratio:.2f}:1")
    print(f"    -> {'明显的倾斜盘（长条形）' if axis_ratio < 0.55 else '接近正视' }")

    # ---- 3. 沿长轴/短轴的剖面颜色 ----
    print(f"\n[3] 沿长轴的颜色剖面（从核球向外）")
    ca, sa = np.cos(np.radians(pa)), np.sin(np.radians(pa))
    for arm in (1, -1):
        print(f"    --- 方向 {'+' if arm>0 else '-'} ---")
        for d in range(0, int(min(w,h)*0.5), max(8, min(w,h)//30)):
            px = int(cx + arm*ca*d); py = int(cy + arm*sa*d)
            if not (0 <= px < w and 0 <= py < h): break
            # 取 5x5 中位数，避免被单颗星污染
            p = np.median(a[max(0,py-2):py+3, max(0,px-2):px+3].reshape(-1,3), axis=0)
            l = 0.2126*p[0]+0.7152*p[1]+0.0722*p[2]
            mxv, mnv = p.max(), p.min()
            s = 0 if mxv == 0 else (mxv-mnv)/mxv
            # 分类
            r, g, b = p
            if l > 170 and s < 0.30: nm = "亮白核球"
            elif r > g > b and r-b > 25: nm = "橙棕(尘埃)"
            elif r > b and r > g: nm = "暖红"
            elif b > r and b > g: nm = "蓝(外盘)"
            elif g > r and b > r: nm = "青"
            else: nm = "-"
            print(f"      d={d:4d}  rgb({r:3.0f},{g:3.0f},{b:3.0f})  L={l:5.1f}  sat={s:.2f}  {nm}")

    # ---- 4. 尘埃带：显著暗于邻域、且偏暖 ----
    print(f"\n[4] 尘埃带（M31 标志特征）")
    # 局部中值作为"背景盘光"
    kk = 25
    Lp2 = np.pad(L, kk//2, mode='edge')
    med = np.median(sliding_window_view(Lp2, (kk,kk)), axis=(2,3))
    # 星系内区域：离核不太远
    yy2, xx2 = np.mgrid[0:h, 0:w]
    dist = np.sqrt((xx2-mx)**2 + (yy2-my)**2)
    ingal = dist < min(w,h)*0.45
    dark = ingal & (L < med*0.62) & (L > 18)
    n_dark = dark.sum()
    print(f"    明显暗于邻域的像素 {n_dark} ({n_dark/max(1,ingal.sum())*100:.1f}% of galaxy area)")
    if n_dark > 50:
        dc = a[dark].mean(axis=0)
        print(f"    尘埃平均色 rgb({dc[0]:.0f},{dc[1]:.0f},{dc[2]:.0f})   <- 若 R>B 即偏暖（橙棕）")
        print(f"    R-B = {dc[0]-dc[2]:+.1f}")

    # ---- 5. HII 区：高饱和洋红/粉 ----
    print(f"\n[5] HII 区（洋红/粉恒星形成区）")
    r_, g_, b_ = a[:,:,0], a[:,:,1], a[:,:,2]
    mxc = np.maximum(np.maximum(r_, g_), b_)
    mnc = np.minimum(np.minimum(r_, g_), b_)
    sat = np.where(mxc > 0, (mxc-mnc)/np.maximum(mxc,1), 0)
    hii = (r_ > 90) & (b_ > 75) & (r_ > g_+18) & (sat > 0.28) & (dist < min(w,h)*0.5)
    n_hii = hii.sum()
    print(f"    洋红像素 {n_hii} ({n_hii/max(1,(dist<min(w,h)*0.5).sum())*100:.2f}%)")
    if n_hii > 30:
        hc = a[hii].mean(axis=0)
        print(f"    HII 平均色 rgb({hc[0]:.0f},{hc[1]:.0f},{hc[2]:.0f})")

    # ---- 6. 背景星场密度 ----
    print(f"\n[6] 背景星场（照片感的关键）")
    outgal = dist > min(w,h)*0.52
    # 星点 = 明显亮于局部中值的孤立点
    starish = (L > med + 26) & outgal
    n_star = starish.sum()
    area_kpx = outgal.sum()/1000.0
    print(f"    星系外亮星点 {n_star}，密度 {n_star/max(1,area_kpx):.1f} /1000px")
    if n_star > 50:
        sc = a[starish].mean(axis=0)
        print(f"    星点平均色 rgb({sc[0]:.0f},{sc[1]:.0f},{sc[2]:.0f})")
    print(f"    星系外平均亮度 {L[outgal].mean():.1f}（越小越黑）")
