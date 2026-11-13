"""YouTube thumbnail (1280x720) for the NVIDIA x HUNG video. Real data: NVDA 1h perp bars and HUNG hourly market cap.
Usage: python3 make_thumbnail.py <case_nvda_hung dir> <out dir>"""
import json, sys, io, datetime as dt
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SRC, OUT = sys.argv[1], sys.argv[2]
W, H = 1280, 720
BLACK = "Inter Display"
F = lambda s: ImageFont.truetype("/usr/share/fonts/opentype/inter/InterDisplay-Black.otf", s)
RED, GREEN, WHITE, BG = (255, 59, 59), (38, 230, 140), (255, 255, 255), (8, 8, 16)

def fig_png(fig):
    b = io.BytesIO(); fig.savefig(b, format="png", transparent=True, dpi=100); plt.close(fig); b.seek(0)
    return Image.open(b).convert("RGBA")

# NVIDIA: 3-hour candles, Nov 2 -> Nov 13
bars = [(dt.datetime.utcfromtimestamp(int(b["time"]) / 1000), *(float(b[k]) for k in ("open", "high", "low", "close")))
        for b in json.load(open(f"{SRC}/nvda_perp_1h.json"))]
bars = [b for b in bars if dt.datetime(2026, 11, 2, 12) <= b[0] <= dt.datetime(2026, 11, 13, 16)]
agg = []
for i in range(0, len(bars), 4):
    g = bars[i:i + 4]
    agg.append((g[0][1], max(x[2] for x in g), min(x[3] for x in g), g[-1][4]))
fig = plt.figure(figsize=(6.6, 5.6)); ax = fig.add_axes([0, 0, 1, 1]); ax.axis("off")
for i, (o, h, l, c) in enumerate(agg):
    col = "#26E68C" if c >= o else "#FF3B3B"
    ax.plot([i, i], [l, h], color=col, lw=1.6)
    ax.add_patch(Rectangle((i - 0.38, min(o, c)), 0.76, max(abs(c - o), 0.25), color=col))
ax.set_xlim(-1, len(agg)); ax.set_ylim(146, 214)
nv = fig_png(fig)

# HUNG: hourly market cap, linear (the hockey stick)
h = sorted(json.load(open(f"{SRC}/hung_h.json"))["data"]["attributes"]["ohlcv_list"])
h = [r for r in h if dt.datetime(2026, 11, 10, 6).timestamp() <= r[0] <= dt.datetime(2026, 11, 12, 18).timestamp()]
fig = plt.figure(figsize=(6.2, 5.2)); ax = fig.add_axes([0, 0, 1, 1]); ax.axis("off")
xs = list(range(len(h))); ys = [r[2] * 1e9 for r in h]
for lw, a in ((18, 0.06), (10, 0.12), (5, 0.35)):
    ax.plot(xs, ys, color="#26E68C", lw=lw, alpha=a, solid_capstyle="round")
ax.plot(xs, ys, color="#B6FFD9", lw=2.6)

ax.set_ylim(-60_000, 1_380_000); ax.set_xlim(-1, len(xs) + 1)
hu = fig_png(fig)

def base():
    im = Image.new("RGB", (W, H), BG)
    glow = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(glow)
    d.ellipse((-260, 120, 560, 940), fill=(90, 10, 16)); d.ellipse((700, -120, 1540, 720), fill=(6, 80, 46))
    im = Image.blend(im, glow.filter(ImageFilter.GaussianBlur(160)), 0.9)
    g = ImageDraw.Draw(im)
    for x in range(0, W, 64): g.line([(x, 0), (x, H)], fill=(20, 22, 40), width=1)
    for y in range(0, H, 64): g.line([(0, y), (W, y)], fill=(20, 22, 40), width=1)
    return im

def sticker(text, size, fg, bg, angle, pad=(22, 10)):
    f = F(size); x0, y0, x1, y1 = f.getbbox(text)
    s = Image.new("RGBA", (x1 - x0 + pad[0] * 2, y1 - y0 + pad[1] * 2 + 6), (0, 0, 0, 0))
    d = ImageDraw.Draw(s); d.rounded_rectangle((0, 0, s.width - 1, s.height - 1), radius=10, fill=bg)
    d.text((pad[0] - x0, pad[1] - y0 + 3), text, font=f, fill=fg)
    return s.rotate(angle, expand=True, resample=Image.BICUBIC)

def outlined(d, xy, text, size, fill, stroke=8):
    d.text(xy, text, font=F(size), fill=fill, stroke_width=stroke, stroke_fill=(0, 0, 0))

def make(name, top_left, top_right, big):
    im = base().convert("RGBA")
    im.alpha_composite(nv.resize((600, 509)), (10, 170))
    im.alpha_composite(hu.resize((540, 400)), (720, 140))
    d = ImageDraw.Draw(im)
    # divider bolt
    d.polygon([(640, 150), (604, 420), (650, 410), (618, 690), (700, 360), (652, 372), (690, 150)], fill=(255, 214, 10), outline=(0, 0, 0))
    # down arrow on NVIDIA
    d.line([(150, 245), (470, 610)], fill=WHITE, width=16); d.polygon([(500, 645), (420, 615), (478, 560)], fill=WHITE)
    im.alpha_composite(sticker(top_left, 64, WHITE, RED + (255,), 3), (26, 26))
    st = sticker(top_right, 58, (0, 0, 0), GREEN + (255,), -3)
    im.alpha_composite(st, (W - st.width - 22, 30))
    d = ImageDraw.Draw(im)
    outlined(d, (36, 590), "NVIDIA", 70, WHITE, 7)
    tw = F(118).getlength(big)
    outlined(d, (W - tw - 30, 560), big, 118, GREEN + (255,), 9)
    im.convert("RGB").save(f"{OUT}/{name}", quality=95)

make("thumbnail_A.png", "SELL THE STOCK", "BUY THE SCANDAL", "$9K→$1M")
make("thumbnail_B.png", "THE CHART KNEW", "THE COIN 100X'D", "$9K→$1M")
print("ok")

# ---------------- versions with the founder's photo ----------------
from PIL import ImageEnhance, ImageOps
def founder(size_h):
    p = Image.open(f"{OUT}/founder_cutout.png").convert("RGBA").crop((50, 15, 810, 775))   # head to chest
    rgb, a = p.convert("RGB"), p.getchannel("A").filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.GaussianBlur(1.1))
    rgb = ImageEnhance.Brightness(rgb).enhance(1.08)        # lift the face a little
    rgb = ImageEnhance.Contrast(rgb).enhance(1.18)          # punchier, thumbnail-style
    rgb = ImageEnhance.Color(rgb).enhance(1.12)
    rgb = rgb.filter(ImageFilter.UnsharpMask(radius=2, percent=90, threshold=2))
    p = rgb.convert("RGBA"); p.putalpha(a)
    p = p.resize((int(p.width * size_h / p.height), size_h), Image.LANCZOS)
    a = p.getchannel("A")
    pad = 40
    canvas = Image.new("RGBA", (p.width + pad * 2, p.height + pad), (0, 0, 0, 0))
    big = Image.new("L", canvas.size, 0); big.paste(a, (pad, pad))
    glow = big.filter(ImageFilter.GaussianBlur(14)).point(lambda v: 255 if v > 8 else 0).filter(ImageFilter.GaussianBlur(18))
    canvas.paste(Image.new("RGBA", canvas.size, (38, 230, 140, 255)), (0, 0), glow.point(lambda v: int(v * 0.85)))
    stroke = big.filter(ImageFilter.GaussianBlur(5)).point(lambda v: 255 if v > 14 else 0).filter(ImageFilter.GaussianBlur(1.2))
    canvas.paste(Image.new("RGBA", canvas.size, (255, 255, 255, 255)), (0, 0), stroke)
    canvas.alpha_composite(p, (pad, pad))
    return canvas

def make_face(name, line1, line2, big):
    im = base().convert("RGBA")
    n2 = nv.resize((640, 470)); n2.putalpha(n2.getchannel("A").point(lambda v: int(v * 0.6)))
    im.alpha_composite(n2, (0, 200))
    im.alpha_composite(hu.resize((560, 340)), (70, 225))
    f = founder(700)
    im.alpha_composite(f, (W - f.width + 70, H - f.height + 40))
    im.alpha_composite(sticker(line1, 62, WHITE, RED + (255,), 3), (24, 22))
    im.alpha_composite(sticker(line2, 62, (0, 0, 0), GREEN + (255,), -3), (40, 112))
    d = ImageDraw.Draw(im)
    outlined(d, (30, 575), big, 112, GREEN + (255,), 9)
    for xy, t, c in (((24, 225), "NVIDIA ↓", RED + (255,)), ((300, 470), "HUNG ↑", GREEN + (255,))):
        outlined(d, xy, t, 34, c, 5)
    im.convert("RGB").save(f"{OUT}/{name}", quality=95)

make_face("thumbnail_C_face.png", "SELL THE STOCK", "BUY THE SCANDAL", "$9K→$1M")
make_face("thumbnail_D_face.png", "THE CHART KNEW", "THE COIN 100X'D", "$9K→$1M")
print("ok face")
