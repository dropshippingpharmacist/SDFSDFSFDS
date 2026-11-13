"""YouTube thumbnail (1280x720) in the PRNTR style: two stickers, one huge line, your cut-out face with a white outline
and glow, and a chart (or a frame from the video) behind it. Picks the best face frame from the video automatically."""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
from .common import probe, run
from .graphics import font, col

W, H = 1280, 720


# ---------------- face: find it, cut it out, grade it ----------------
def face_candidates(video, work, n=6, step=None):
    import cv2
    info = probe(video)
    step = step or max(1.0, info["duration"] / 90)
    det = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    scored = []
    t = 0.5
    tmp = os.path.join(work, "_f.jpg")
    while t < info["duration"]:
        run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", video, "-frames:v", "1", tmp])
        img = cv2.imread(tmp)
        if img is not None:
            g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            faces = det.detectMultiScale(g, 1.15, 6, minSize=(int(g.shape[0] * 0.12),) * 2)
            for (x, y, w, h) in faces[:1]:
                sharp = cv2.Laplacian(g[y:y + h, x:x + w], cv2.CV_64F).var()
                area = w * h / (g.shape[0] * g.shape[1])
                scored.append((area * min(sharp, 400) / 400, t))
        t += step
    if os.path.exists(tmp):
        os.remove(tmp)
    scored.sort(reverse=True)
    picks = []
    for s, t in scored:
        if all(abs(t - p) > step * 2 for p in picks):
            picks.append(t)
        if len(picks) >= n:
            break
    paths = []
    for i, t in enumerate(picks):
        p = os.path.join(work, f"face_{i}_{t:.1f}s.jpg")
        run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", video, "-frames:v", "1", p])
        paths.append(p)
    return paths


def cutout(path, work):
    out = os.path.join(work, os.path.splitext(os.path.basename(path))[0] + "_cut.png")
    if os.path.exists(out):
        return out
    from rembg import remove, new_session
    im = remove(Image.open(path).convert("RGB"), session=new_session("u2net_human_seg"), alpha_matting=True)
    bb = im.getbbox()
    if bb:
        im = im.crop(bb)
    im.save(out)
    return out


def styled_face(cut_png, size_h, crop_bottom=0.78):
    p = Image.open(cut_png).convert("RGBA")
    p = p.crop((0, 0, p.width, int(p.height * crop_bottom)))         # head to chest
    rgb = p.convert("RGB")
    a = p.getchannel("A").filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.GaussianBlur(1.1))
    rgb = ImageEnhance.Brightness(rgb).enhance(1.08)
    rgb = ImageEnhance.Contrast(rgb).enhance(1.18)
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


# ---------------- layout ----------------
def _base(left_color=(90, 10, 16), right_color=(6, 80, 46)):
    im = Image.new("RGB", (W, H), (8, 8, 16))
    glow = Image.new("RGB", (W, H), (8, 8, 16)); d = ImageDraw.Draw(glow)
    d.ellipse((-260, 120, 560, 940), fill=left_color); d.ellipse((700, -120, 1540, 720), fill=right_color)
    im = Image.blend(im, glow.filter(ImageFilter.GaussianBlur(160)), 0.9)
    g = ImageDraw.Draw(im)
    for x in range(0, W, 64): g.line([(x, 0), (x, H)], fill=(20, 22, 40), width=1)
    for y in range(0, H, 64): g.line([(0, y), (W, y)], fill=(20, 22, 40), width=1)
    return im.convert("RGBA")


def _sticker(text, size, color, angle):
    fg = (0, 0, 0, 255) if color in ("green", "gold", "white") else (255, 255, 255, 255)
    f = font(size); x0, y0, x1, y1 = f.getbbox(text)
    s = Image.new("RGBA", (x1 - x0 + 44, y1 - y0 + 26), (0, 0, 0, 0))
    d = ImageDraw.Draw(s); d.rounded_rectangle((0, 0, s.width - 1, s.height - 1), radius=10, fill=col(color))
    d.text((22 - x0, 13 - y0), text, font=f, fill=fg)
    return s.rotate(angle, expand=True, resample=Image.BICUBIC)


def make(out, line1, line2, big, face_png=None, background=None, big_color="green", c1="red", c2="green"):
    im = _base()
    if background:
        bg = Image.open(background).convert("RGBA")
        s = min(700 / bg.width, 520 / bg.height)
        bg = bg.resize((int(bg.width * s), int(bg.height * s)), Image.LANCZOS)
        bg.putalpha(bg.getchannel("A").point(lambda v: int(v * 0.8)))
        im.alpha_composite(bg, (10, 190))
    if face_png:
        f = styled_face(face_png, 700)
        im.alpha_composite(f, (W - f.width + 70, H - f.height + 40))
    size = 62
    for text, c, ang, y in ((line1, c1, 3, 22), (line2, c2, -3, 112)):
        if not text:
            continue
        st = _sticker(text, size, c, ang)
        while st.width > (720 if face_png else 1200):
            size -= 3; st = _sticker(text, size, c, ang)
        im.alpha_composite(st, (24 if y == 22 else 40, y))
    d = ImageDraw.Draw(im)
    bs = 112
    while font(bs).getlength(big) > (640 if face_png else 1180):
        bs -= 4
    d.text((30, H - bs - 33), big, font=font(bs), fill=col(big_color), stroke_width=9, stroke_fill=(0, 0, 0))
    im.convert("RGB").save(out, quality=95)
    return out
