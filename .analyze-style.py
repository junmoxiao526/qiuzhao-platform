"""对照"照片样式"的指纹：把我的渲染和参考照片放在同一口径下量。

只量能区分"像不像照片"的几项：
  1. 星场密度：孤立亮星点数 / 1000px²   ← 照片感和"黑底亮斑"的分界
  2. 暖棕暗部：暗且偏暖的像素占比       ← M31 尘埃带的标志（R>B）
  3. 洋红 HII 占比
  4. 饱和像素的色相分布
  5. 明暗动态范围
"""
import sys
import numpy as np
from PIL import Image

def load(path):
    im = Image.open(path).convert("RGB")
    return np.asarray(im, dtype=np.float32), im.size

def local_mean(L, k):
    h, w = L.shape
    hs, ws = max(1, h//k), max(1, w//k)
    small = L[:hs*k, :ws*k].reshape(hs, k, ws, k).mean(axis=(1,3))
    big = np.repeat(np.repeat(small, k, axis=0), k, axis=1)
    out = np.empty_like(L)
    oh, ow = big.shape
    oh = min(oh, h); ow = min(ow, w)
    out[:oh, :ow] = big[:oh, :ow]
    # 边缘用最后一行/列补齐
    if oh < h: out[oh:, :ow] = big[oh-1:oh, :ow]
    if ow < w: out[:oh, ow:] = out[:oh, ow-1:ow-1+1]
    if oh < h and ow < w: out[oh:, ow:] = big[oh-1, ow-1]
    return out

def local_max(L):
    m = np.ones(L.shape, dtype=bool)
    for dy in (-1,0,1):
        for dx in (-1,0,1):
            if dy == 0 and dx == 0: continue
            m &= (L > np.roll(np.roll(L, dy, axis=0), dx, axis=1))
    return m

def hue_name(r,g,b):
    mx, mn = max(r,g,b), min(r,g,b)
    if mx - mn < 12: return "无彩"
    if mx == r: h = ((g-b)/(mx-mn)) % 6
    elif mx == g: h = (b-r)/(mx-mn) + 2
    else: h = (r-g)/(mx-mn) + 4
    h *= 60
    if h < 20 or h >= 335: return "红"
    if h < 45: return "橙"
    if h < 70: return "黄"
    if h < 165: return "绿"
    if h < 200: return "青"
    if h < 265: return "蓝"
    if h < 305: return "紫"
    return "洋红"

for path in sys.argv[1:]:
    a, (W, H) = load(path)
    L = 0.2126*a[:,:,0] + 0.7152*a[:,:,1] + 0.0722*a[:,:,2]
    r_, g_, b_ = a[:,:,0], a[:,:,1], a[:,:,2]
    npx = W*H
    print("="*76)
    print(f"{path}   {W}x{H}")
    print("="*76)

    # 1. 星场密度
    lm = local_mean(L, 13)
    stars = local_max(L) & (L > lm + 26) & (L > 72)
    nstar = int(stars.sum())
    print(f"\n[1] 星场密度")
    print(f"    孤立星点 {nstar}   密度 {nstar/(npx/1000):.1f} /1000px2")
    if nstar > 0:
        sc = a[stars].mean(axis=0)
        print(f"    星点平均色 rgb({sc[0]:.0f},{sc[1]:.0f},{sc[2]:.0f})")

    # 2. 暖棕暗部（尘埃带）
    darkish = (L > 12) & (L < 78)
    warm_dark = darkish & ((r_ - b_) > 8)
    cool_dark = darkish & ((b_ - r_) > 8)
    nd = max(1, int(darkish.sum()))
    print(f"\n[2] 暗部构成（尘埃带）")
    print(f"    暗部像素 {nd} ({nd/npx*100:.1f}%)")
    print(f"      暖棕(R>B+8) {int(warm_dark.sum())/nd*100:5.1f}%")
    print(f"      冷蓝(B>R+8) {int(cool_dark.sum())/nd*100:5.1f}%")
    if warm_dark.sum() > 50:
        wc = a[warm_dark].mean(axis=0)
        print(f"    暖暗部平均色 rgb({wc[0]:.0f},{wc[1]:.0f},{wc[2]:.0f})  R-B={wc[0]-wc[2]:+.1f}")

    # 3. 洋红 HII
    mxc = np.maximum(np.maximum(r_,g_),b_); mnc = np.minimum(np.minimum(r_,g_),b_)
    sat = np.where(mxc > 0, (mxc-mnc)/np.maximum(mxc,1), 0)
    hii = (r_ > 85) & (b_ > 65) & (r_ > g_+15) & (sat > 0.22)
    print(f"\n[3] 洋红 HII 占比 {int(hii.sum())/npx*100:.2f}%")

    # 4. 饱和像素色相分布
    sel = (sat > 0.25) & (L > 45)
    ns = max(1, int(sel.sum()))
    cnt = {}
    idx = np.argwhere(sel)
    step = max(1, len(idx)//6000)
    for y, x in idx[::step]:
        k = hue_name(r_[y,x], g_[y,x], b_[y,x])
        cnt[k] = cnt.get(k, 0) + 1
    tot = sum(cnt.values()) or 1
    print(f"\n[4] 饱和像素色相（{ns} 个）")
    for k, v in sorted(cnt.items(), key=lambda kv: -kv[1]):
        print(f"    {k:>3} {v/tot*100:5.1f}%  {'#'*int(v/tot*46)}")

    # 5. 动态范围
    print(f"\n[5] 动态范围")
    print(f"    L: p50={np.percentile(L,50):5.1f}  p99={np.percentile(L,99):5.1f}  max={L.max():5.1f}")
    print(f"    极暗(<12)占比 {(L<12).sum()/npx*100:.1f}%")
