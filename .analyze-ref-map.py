"""把参考图降采样成"文本缩略图"，用色相字母 + 亮度字符还原构图。
这样即使读不了图，也能判断：星云是环状？团块状？星球在哪、多大、什么颜色。

每个格子输出一个字符：
  亮度用深浅字符；色相用字母（B蓝 C青 G绿 M洋红 R红 Y黄 W白灰）
"""
import sys, colorsys
from PIL import Image

def classify(p):
    r, g, b = [v / 255.0 for v in p]
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    lum = 0.2126*p[0] + 0.7152*p[1] + 0.0722*p[2]
    if s < 0.18:
        return " .:-=+*#%@"[min(9, int(lum / 25.6))]
    deg = h * 360
    if deg < 20 or deg >= 330: L = "R"
    elif deg < 45:  L = "O"
    elif deg < 70:  L = "Y"
    elif deg < 160: L = "G"
    elif deg < 200: L = "C"
    elif deg < 260: L = "B"
    elif deg < 300: L = "P"
    else:           L = "M"
    return L.lower() if lum < 60 else L

COLS = int(sys.argv[2]) if len(sys.argv) > 2 else 78
for name in sys.argv[1:2] + (sys.argv[3:] if len(sys.argv) > 3 else []):
    im = Image.open(name).convert("RGB")
    W, H = im.size
    rows = max(1, int(COLS * H / W * 0.5))   # 字符高宽比约 2:1
    sm = im.resize((COLS, rows))
    print(f"\n{'='*80}\n{name}  {W}x{H}   字符图 {COLS}x{rows}")
    print("图例: 亮=@%#*+=-:. 暗,  R红 O橙 Y黄 G绿 C青 B蓝 P紫 M洋红")
    print(f"{'='*80}")
    d = list(sm.getdata())
    for y in range(rows):
        print("".join(classify(d[y*COLS + x]) for x in range(COLS)))
