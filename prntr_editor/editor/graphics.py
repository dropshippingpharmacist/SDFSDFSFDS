"""On-screen graphics, drawn once as RGBA images and animated cheaply per frame."""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from .common import FONT_BLACK, FONT_BOLD, COLORS


def font(size, black=True):
    return ImageFont.truetype(FONT_BLACK if black else FONT_BOLD, int(size))


def col(name, alpha=255):
    c = COLORS.get(name, None) if isinstance(name, str) else tuple(name)
    if c is None and isinstance(name, str) and name.startswith("#"):
        c = tuple(int(name[i:i + 2], 16) for i in (1, 3, 5))
    return tuple(c or COLORS["white"])[:3] + (alpha,)


def text_fg(bg):
    return (0, 0, 0, 255) if bg in ("green", "gold", "white") else (255, 255, 255, 255)


def sticker(text, H, color="red", angle=0.0, scale=1.0):
    """Rounded colour block with heavy text (the thumbnail look)."""
    size = H * 0.058 * scale
    f = font(size)
    x0, y0, x1, y1 = f.getbbox(text)
    px, py = int(size * 0.38), int(size * 0.2)
    im = Image.new("RGBA", (x1 - x0 + 2 * px, y1 - y0 + 2 * py + int(size * 0.1)), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, im.width - 1, im.height - 1), radius=int(size * 0.18), fill=col(color))
    d.text((px - x0, py - y0 + int(size * 0.05)), text, font=f, fill=text_fg(color))
    if angle:
        im = im.rotate(angle, expand=True, resample=Image.BICUBIC)
    return _shadow(im, H)


def big_text(text, H, color="white", scale=1.0, max_w=None):
    """Huge outlined words (e.g. '$9K→$1M'). Wraps on ' / '."""
    size = H * 0.1 * scale
    lines = [l.strip() for l in text.split(" / ")]
    f = font(size)
    if max_w:
        while max(f.getlength(l) for l in lines) > max_w and size > 20:
            size *= 0.92; f = font(size)
    stroke = max(3, int(size * 0.08))
    lh = int(size * 1.08)
    w = int(max(f.getlength(l) for l in lines)) + 2 * stroke + 4
    im = Image.new("RGBA", (w, lh * len(lines) + 2 * stroke), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for i, l in enumerate(lines):
        lw = f.getlength(l)
        d.text(((w - lw) / 2, stroke + i * lh), l, font=f, fill=col(color), stroke_width=stroke, stroke_fill=(0, 0, 0, 255))
    return _shadow(im, H)


def lower_third(title, sub, H, color="blue"):
    t, s = font(H * 0.045), font(H * 0.03, black=False)
    w = int(max(t.getlength(title), s.getlength(sub or "")) + H * 0.08)
    h = int(H * (0.11 if sub else 0.07))
    im = Image.new("RGBA", (w + int(H * 0.012), h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, int(H * 0.012), h), fill=col(color))
    d.rectangle((int(H * 0.012), 0, im.width, h), fill=(11, 11, 26, 225))
    d.text((int(H * 0.04), int(H * 0.012)), title, font=t, fill=(255, 255, 255, 255))
    if sub:
        d.text((int(H * 0.04), int(H * 0.064)), sub, font=s, fill=(185, 195, 214, 255))
    return _shadow(im, H)


def hook_card(text, sub, W, H):
    """Top-of-video hook: dark band + big headline + optional sub line."""
    f = font(H * 0.072)
    words, lines, cur = text.split(), [], ""
    for w in words:
        nxt = (cur + " " + w).strip()
        if f.getlength(nxt) > W * 0.86 and cur:
            lines.append(cur); cur = w
        else:
            cur = nxt
    lines.append(cur)
    lh = int(H * 0.085)
    band_h = lh * len(lines) + int(H * (0.09 if sub else 0.05))
    im = Image.new("RGBA", (W, band_h + int(H * 0.06)), (0, 0, 0, 0))
    grad = np.zeros((im.height, W, 4), np.uint8)
    grad[..., 3] = (np.linspace(210, 0, im.height)[:, None]).astype(np.uint8)
    im = Image.fromarray(grad, "RGBA")
    d = ImageDraw.Draw(im)
    y = int(H * 0.025)
    for l in lines:
        lw = f.getlength(l)
        d.text(((W - lw) / 2, y), l, font=f, fill=(255, 255, 255, 255), stroke_width=int(H * 0.006), stroke_fill=(0, 0, 0, 255))
        y += lh
    if sub:
        s = font(H * 0.04)
        sw = s.getlength(sub)
        d.rounded_rectangle(((W - sw) / 2 - H * 0.02, y + H * 0.005, (W + sw) / 2 + H * 0.02, y + H * 0.06), radius=int(H * 0.012), fill=col("green"))
        d.text(((W - sw) / 2, y + H * 0.008), sub, font=s, fill=(0, 0, 0, 255))
    return im


def pointer_frames(p, W, H, n=10):
    """Animated arrow / circle / box with an optional label. Returns n full-frame RGBA images (draw-in animation)."""
    shape = p.get("shape", "arrow")
    c = col(p.get("color", "gold"))
    x, y = p["x"] * W, p["y"] * H
    lw = max(4, int(H * 0.007))
    frames = []
    for k in range(1, n + 1):
        prog = 1 - (1 - k / n) ** 3
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        if shape == "arrow":
            # arrow comes from (fx, fy) toward the point
            fx, fy = p.get("from_x", p["x"] - 0.12) * W, p.get("from_y", p["y"] - 0.14) * H
            ex, ey = fx + (x - fx) * prog, fy + (y - fy) * prog
            for wdt, cc in ((lw + 6, (0, 0, 0, 200)), (lw, c)):
                d.line([(fx, fy), (ex, ey)], fill=cc, width=wdt)
            ang = math.atan2(ey - fy, ex - fx)
            hl = H * 0.035
            pts = [(ex, ey), (ex - hl * math.cos(ang - 0.45), ey - hl * math.sin(ang - 0.45)),
                   (ex - hl * math.cos(ang + 0.45), ey - hl * math.sin(ang + 0.45))]
            d.polygon(pts, fill=c, outline=(0, 0, 0, 200))
            lx, ly = fx, fy
        elif shape == "circle":
            rw, rh = p.get("w", 0.08) * W / 2, p.get("h", 0.1) * H / 2
            box = (x - rw, y - rh, x + rw, y + rh)
            d.arc(box, -90, -90 + 360 * prog, fill=(0, 0, 0, 180), width=lw + 6)
            d.arc(box, -90, -90 + 360 * prog, fill=c, width=lw)
            lx, ly = x, y - rh
        else:  # box / highlight zone
            bw, bh = p.get("w", 0.15) * W, p.get("h", 0.1) * H
            box = (x - bw / 2, y - bh / 2, x + bw / 2, y + bh / 2)
            fill = c[:3] + (int(45 * prog),)
            d.rectangle(box, fill=fill, outline=c, width=lw)
            lx, ly = x - bw / 2, y - bh / 2
        frames.append(im)
    label = p.get("label")
    if label:
        st = sticker(label, H, p.get("color", "gold"), angle=p.get("angle", 0), scale=p.get("label_scale", 0.75))
        lx_, ly_ = p.get("label_x"), p.get("label_y")
        if lx_ is None:
            lx_ = (lx / W) - st.width / W / 2
            ly_ = (ly / H) - st.height / H - 0.01
        px = int(min(max(0, lx_ * W), W - st.width)); py = int(min(max(0, ly_ * H), H - st.height))
        frames[-1].alpha_composite(st, (px, py))
        for k in range(len(frames) - 1):
            if k >= len(frames) // 2:
                frames[k].alpha_composite(st, (px, py))
    return frames


def _shadow(im, H):
    pad = max(6, int(H * 0.012))
    out = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    a = im.getchannel("A")
    sh = Image.new("RGBA", im.size, (0, 0, 0, 150)); sh.putalpha(a.point(lambda v: v * 150 // 255))
    out.alpha_composite(sh, (pad + 3, pad + 5))
    out = out.filter(ImageFilter.GaussianBlur(pad / 2))
    out.alpha_composite(im, (pad, pad))
    return out


def place(img, pos, W, H, margin=0.04):
    """pos: named spot or [x, y] (top-left, 0..1)."""
    if isinstance(pos, (list, tuple)):
        return int(pos[0] * W), int(pos[1] * H)
    m = int(margin * H)
    xs = {"left": m, "center": (W - img.width) // 2, "right": W - img.width - m}
    ys = {"top": m, "middle": (H - img.height) // 2, "bottom": H - img.height - int(H * 0.2), "lower": H - img.height - m}
    v, h = (pos.split("-") + ["center"])[:2] if "-" in pos else (pos, "center")
    if pos in ("center", "middle"):
        v, h = "middle", "center"
    return xs.get(h, xs["center"]), ys.get(v, ys["top"])
