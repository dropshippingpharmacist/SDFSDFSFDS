"""PRNTR story maker: one Instagram story frame (1080x1920) from YOUR lifestyle photo with a trade (social proof)
set inside it, a short write-up on the image, and the CTA "DM me PRINTER for the free playbook".

    python story_maker.py --photo car.jpg --proof trade.png --hook "Took this one from the driver's seat" \
        --line "NQ short · +6.7R · +$1,011" --out story.png [--caption]

--caption also prints a ready-to-paste caption (hook -> proof -> lesson -> CTA), the HanckFX hook/retention/reward
order. Nothing is posted: posting is a separate step (Instagram Graph API, see README)."""
import argparse
import random
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

W, H = 1080, 1920
F_BOLD = "/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf"
F_MED = "/usr/share/fonts/opentype/inter/InterDisplay-Medium.otf"
ACCENT = (63, 209, 180)          # PRNTR teal (#3fd1b4)
INK = (2, 18, 28)                # PRNTR near-black (#02121c)


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def cover(img, w, h):
    """Scale + center-crop to fill w x h (the photo is never stretched)."""
    return ImageOps.fit(img.convert("RGB"), (w, h), Image.LANCZOS, centering=(0.5, 0.45))


def wrap(draw, text, f, maxw):
    words, lines, cur = text.split(), [], ""
    for w_ in words:
        t = (cur + " " + w_).strip()
        if draw.textlength(t, font=f) <= maxw or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = w_
    if cur:
        lines.append(cur)
    return lines


def shade(base):
    """Dark gradients top and bottom so white text reads on any photo."""
    g = Image.new("L", (1, H))
    for y in range(H):
        top = max(0.0, 1 - y / 620) * 190
        bot = max(0.0, (y - (H - 760)) / 760) * 220
        g.putpixel((0, y), int(max(top, bot)))
    mask = g.resize((W, H))
    dark = Image.new("RGB", (W, H), (0, 0, 0))
    return Image.composite(dark, base, mask)


def proof_card(proof, maxw=860, maxh=760, radius=34, tilt=-3.0):
    """The trade screenshot as a floating card: rounded, white rim, soft shadow, slight tilt (like a phone shot)."""
    p = proof.convert("RGB")
    p.thumbnail((maxw, maxh), Image.LANCZOS)
    rim = 10
    card = Image.new("RGBA", (p.width + 2 * rim, p.height + 2 * rim), (255, 255, 255, 255))
    card.paste(p, (rim, rim))
    m = Image.new("L", card.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, card.width - 1, card.height - 1], radius, fill=255)
    card.putalpha(m)
    pad = 60
    sh = Image.new("RGBA", (card.width + 2 * pad, card.height + 2 * pad), (0, 0, 0, 0))
    sm = Image.new("L", sh.size, 0)
    ImageDraw.Draw(sm).rounded_rectangle([pad, pad + 18, pad + card.width, pad + card.height + 18], radius, fill=150)
    sh.putalpha(sm.filter(ImageFilter.GaussianBlur(26)))
    sh.alpha_composite(card, (pad, pad))
    return sh.rotate(tilt, resample=Image.BICUBIC, expand=True)


def pill(draw, xy_center, text, f, fill, ink, padx=38, pady=20):
    tw = draw.textlength(text, font=f)
    asc, desc = f.getmetrics()
    w_, h_ = tw + 2 * padx, asc + desc + 2 * pady
    x0, y0 = xy_center[0] - w_ / 2, xy_center[1] - h_ / 2
    draw.rounded_rectangle([x0, y0, x0 + w_, y0 + h_], h_ / 2, fill=fill)
    draw.text((x0 + padx, y0 + pady), text, font=f, fill=ink)
    return y0 + h_


def make(photo, proof, hook, line, cta="DM me “PRINTER” for the free playbook", card_y=0.50, tilt=-3.0):
    base = shade(cover(Image.open(photo), W, H)).convert("RGBA")
    d = ImageDraw.Draw(base)
    # hook (top)
    fh = font(F_BOLD, 76)
    y = 150
    for ln in wrap(d, hook, fh, W - 140):
        tw = d.textlength(ln, font=fh)
        d.text(((W - tw) / 2, y), ln, font=fh, fill="white", stroke_width=3, stroke_fill=(0, 0, 0))
        y += 92
    # the trade inside the photo
    card = proof_card(Image.open(proof), tilt=tilt)
    cx, cy = (W - card.width) // 2, int(H * card_y - card.height / 2)
    cy = max(cy, y + 10)
    base.alpha_composite(card, (cx, cy))
    d = ImageDraw.Draw(base)
    # result line under the card
    yb = cy + card.height - 30
    if line:
        yb = pill(d, (W / 2, yb + 40), line, font(F_BOLD, 46), ACCENT, INK) + 20
    # CTA (bottom)
    fc = font(F_BOLD, 50)
    yc = H - 260
    for ln in wrap(d, cta, fc, W - 160):
        tw = d.textlength(ln, font=fc)
        d.text(((W - tw) / 2, yc), ln, font=fc, fill="white", stroke_width=2, stroke_fill=(0, 0, 0))
        yc += 64
    return base.convert("RGB")


HOOKS = ["10 minutes in. Done for the day.", "Same setup. Again.", "Risked 1. Made 6.7.",
         "Didn't even watch it play out.", "Tuesday.", "Bot took it. I just checked my phone."]


def caption(sym, side, r=None, usd=None, lesson=None, seed=None):
    """Hook -> proof -> lesson -> CTA (HanckFX: hook / retention / reward)."""
    rnd = random.Random(seed)
    res = " · ".join(x for x in (f"+{r:.1f}R" if r is not None else "", f"+${usd:,.0f}" if usd else "") if x)
    lesson = lesson or rnd.choice([
        "Wait for the range, let them run the stops, enter on the reclaim. Same playbook every time.",
        "No guessing, no screen-staring: the setup, the stop and the target are decided before I'm in.",
        "Small risk, defined stop, big target. One trade like this pays for a week of small losses."])
    return (f"{rnd.choice(HOOKS)}\n\n{sym} {side.lower()} · {res}\n\n{lesson}\n\n"
            f"Want the exact setup? DM me \"PRINTER\" and I'll send you the free playbook.")


if __name__ == "__main__":
    a = argparse.ArgumentParser()
    a.add_argument("--photo", required=True)
    a.add_argument("--proof", required=True)
    a.add_argument("--hook", default="10 minutes in. Done for the day.")
    a.add_argument("--line", default="")
    a.add_argument("--cta", default="DM me “PRINTER” for the free playbook")
    a.add_argument("--tilt", type=float, default=-3.0)
    a.add_argument("--out", default="story.png")
    a.add_argument("--caption", nargs="*", help="SYM SIDE R USD")
    o = a.parse_args()
    make(o.photo, o.proof, o.hook, o.line, o.cta, tilt=o.tilt).save(o.out, quality=95)
    print(o.out)
    if o.caption:
        s, sd, r, u = (o.caption + [None] * 4)[:4]
        print(caption(s, sd, float(r) if r else None, float(u) if u else None))
