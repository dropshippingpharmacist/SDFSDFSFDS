"""PRNTR voicedeck: a faceless YouTube video from slides + YOUR voiceover.

You read the script (one paragraph per slide) into your phone in one take. This tool transcribes it locally
(faster-whisper, word timings, no API key), matches what you said to each slide's paragraph, and switches to the next
slide the moment you start that slide's paragraph. Retakes, pauses and small ad-libs are fine: the match is fuzzy.

    python voicedeck.py deck.json --slides-only            # render the slides + teleprompter script
    python voicedeck.py deck.json --audio take.m4a -o video.mp4

deck.json: {"title": ..., "slides": [{"kind": "title|big_number|points|steps|compare|image", "title": ...,
            "caption": ..., "points": [...], "number": ..., "image": "chart.png", "say": "what you read"}]}"""
import argparse, difflib, json, os, re, subprocess, tempfile
from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 1080
BG, PANEL, INK, MUTE = (11, 11, 26), (20, 25, 52), (244, 246, 251), (154, 164, 192)
TEAL, RED = (63, 209, 180), (239, 83, 80)
FB = "/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf"
FM = "/usr/share/fonts/opentype/inter/InterDisplay-Medium.otf"


def font(size, bold=True):
    try:
        return ImageFont.truetype(FB if bold else FM, size)
    except OSError:
        return ImageFont.load_default()


def wrap(d, text, f, width):
    out, cur = [], ""
    for w in (text or "").split():
        nxt = (cur + " " + w).strip()
        if d.textlength(nxt, font=f) > width and cur:
            out.append(cur); cur = w
        else:
            cur = nxt
    return out + ([cur] if cur else [])


def text(d, xy, s, size, width, fill=INK, bold=True, gap=1.2, center=False):
    f = font(size, bold); x, y = xy
    for ln in wrap(d, s, f, width):
        lx = (W - d.textlength(ln, font=f)) / 2 if center else x
        d.text((lx, y), ln, font=f, fill=fill); y += int(size * gap)
    return y


def render(s, n, deck_dir):
    im = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 16, H), fill=TEAL)
    d.text((96, H - 70), "PRNTR", font=font(30), fill=TEAL)
    d.text((W - 130, H - 70), f"{n:02d}", font=font(30, False), fill=MUTE)
    k, title, cap = s.get("kind", "points"), s.get("title", ""), s.get("caption", "")
    pts = [p for p in s.get("points", []) if p.strip()]
    if k == "title":
        y = text(d, (130, 340), title, 110, 1600)
        text(d, (130, y + 36), cap, 48, 1550, MUTE, False)
    elif k == "big_number":
        text(d, (130, 170), title.upper(), 38, 1600, TEAL)
        f = font(300); num = s.get("number", "")
        d.text(((W - d.textlength(num, font=f)) / 2, 290), num, font=f, fill=TEAL)
        text(d, (0, 700), cap, 52, 1500, INK, False, center=True)
    elif k == "steps":
        text(d, (130, 120), title, 76, 1650)
        n_ = max(1, len(pts)); gap = 36; bw = (W - 260 - gap * (n_ - 1)) / n_
        for i, p in enumerate(pts):
            x = 130 + i * (bw + gap)
            d.rounded_rectangle((x, 340, x + bw, 880), radius=26, fill=PANEL)
            d.ellipse((x + 36, 376, x + 120, 460), fill=TEAL)
            d.text((x + 62, 386), str(i + 1), font=font(48), fill=BG)
            text(d, (x + 36, 500), p, 40, bw - 72, INK, True, 1.22)
    elif k == "compare":
        text(d, (130, 120), title, 76, 1650)
        L = [p.split("|")[0].strip() for p in pts]; R = [p.split("|")[1].strip() if "|" in p else "" for p in pts]
        for ci, (items, col) in enumerate(((L, RED), (R, TEAL))):
            x = 130 + ci * 840
            d.rounded_rectangle((x, 300, x + 800, 900), radius=26, fill=PANEL)
            d.rectangle((x, 300, x + 800, 312), fill=col)
            y = 360
            for it in items:
                y = text(d, (x + 48, y), it, 44, 700, INK, False) + 26
    elif k == "image":
        y = text(d, (130, 54), title, 56, 1650) if title else 60
        p = s["image"] if os.path.isabs(s["image"]) else os.path.join(deck_dir, s["image"])
        ch = Image.open(p).convert("RGB"); ch.thumbnail((W - 200, H - y - 150), Image.LANCZOS)
        im.paste(ch, ((W - ch.width) // 2, y + 14))
        if cap:
            text(d, (0, H - 150), cap, 40, 1600, MUTE, False, center=True)
    else:
        y = text(d, (130, 130), title, 76, 1650) + 50
        for p in pts:
            d.ellipse((136, y + 18, 164, y + 46), fill=TEAL)
            y = text(d, (200, y), p, 50, 1550, INK, False) + 30
    return im


# ------------------------------------------------------------------ alignment
def norm(w):
    return re.sub(r"[^a-z0-9]", "", w.lower().replace("’", "'"))


def align(slides_say, words):
    """slides_say: [str] per slide; words: [(word, start, end)] from the take. -> start time of each slide.
    Fuzzy: every script word is matched to the transcript with difflib; a slide starts at the earliest matched
    word among its first few words; a slide whose words were not found starts halfway between its neighbours."""
    sw, owner = [], []
    for i, s in enumerate(slides_say):
        for w in s.split():
            if norm(w):
                sw.append(norm(w)); owner.append(i)
    tw = [norm(w) for w, _, _ in words]
    m = {}
    for a, b, size in difflib.SequenceMatcher(None, sw, tw, autojunk=False).get_matching_blocks():
        for k in range(size):
            m[a + k] = b + k
    n = len(slides_say); starts = [None] * n
    for i in range(n):
        idx = [j for j, o in enumerate(owner) if o == i]
        hit = [m[j] for j in idx[:max(3, len(idx) // 3)] if j in m] or [m[j] for j in idx if j in m]
        if hit:
            starts[i] = words[min(hit)][1]
    starts[0] = 0.0
    for i in range(1, n):                       # fill gaps and keep the order monotone
        if starts[i] is None or starts[i] <= starts[i - 1]:
            j = next((k for k in range(i + 1, n) if starts[k] is not None and starts[k] > starts[i - 1]), None)
            end = starts[j] if j is not None else (words[-1][2] if words else starts[i - 1] + 4)
            gaps = (j if j is not None else n) - i + 1
            starts[i] = starts[i - 1] + max(0.5, (end - starts[i - 1]) / gaps)
    for i in range(1, n):
        starts[i] = max(0.0, starts[i] - 0.15)  # switch a hair before the first word
    return starts


def transcribe(audio):
    from faster_whisper import WhisperModel
    m = WhisperModel(os.environ.get("WHISPER_MODEL", "small.en"), device="cpu", compute_type="int8")
    segs, info = m.transcribe(audio, word_timestamps=True, vad_filter=True)
    words = [(w.word.strip(), w.start, w.end) for s in segs for w in (s.words or []) if w.word.strip()]
    return words, info.duration


def build(deck_path, audio=None, out="video.mp4", slides_only=False, face=None, face_pos="br", face_size=300):
    deck = json.load(open(deck_path)); dd = os.path.dirname(os.path.abspath(deck_path))
    sl = deck["slides"]; od = os.path.join(dd, "out"); os.makedirs(od, exist_ok=True)
    pngs = []
    for i, s in enumerate(sl, 1):
        p = os.path.join(od, f"slide_{i:02d}.png"); render(s, i, dd).save(p); pngs.append(p)
    with open(os.path.join(od, "READ_THIS.md"), "w") as f:
        f.write(f"# {deck.get('title', 'Script')}\n\nRead it top to bottom in one take. Pause a beat between slides.\n\n")
        for i, s in enumerate(sl, 1):
            f.write(f"**[{i:02d}] {s.get('title') or s.get('kind')}**\n\n{s.get('say', '')}\n\n")
    audio = audio or face                  # recorded on camera: the voice comes from the camera file
    if slides_only or not audio:
        return pngs
    words, dur = transcribe(audio)
    starts = align([s.get("say", "") for s in sl], words)
    ends = starts[1:] + [dur + 0.6]
    json.dump({"starts": starts, "duration": dur}, open(os.path.join(od, "timing.json"), "w"), indent=1)
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as f:
        for p, a, b in zip(pngs, starts, ends):
            f.write(f"file '{p}'\nduration {max(0.3, b - a):.3f}\n")
        f.write(f"file '{pngs[-1]}'\n")
        lst = f.name
    subprocess.run(ffmpeg_cmd(lst, audio, out, face, face_pos, face_size), check=True)
    return out


def ffmpeg_cmd(lst, audio, out, face=None, face_pos="br", face_size=300):
    """Slides full screen; with `face`, the camera video sits in a small circle in a corner (picture in picture),
    sharpened a little because laptop cameras are soft. The voice is always taken from `audio`."""
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst]
    if face and os.path.abspath(face) != os.path.abspath(audio):
        cmd += ["-i", face, "-i", audio]; ai = 2
    elif face:
        cmd += ["-i", face]; ai = 1
    else:
        cmd += ["-i", audio]; ai = 1
    if face:
        d, m, b = face_size, 40, 6                     # circle diameter, margin from the edges, teal ring width
        x = {"br": f"W-{d}-{m}", "bl": f"{m}", "tr": f"W-{d}-{m}", "tl": f"{m}"}[face_pos]
        y = {"br": f"H-{d}-{m}", "bl": f"H-{d}-{m}", "tr": f"{m}", "tl": f"{m}"}[face_pos]
        r = d // 2; ri = r - b
        fg = (f"[0:v]fps=30,scale=1920:1080,format=yuv420p[bg];"
              f"[1:v]fps=30,crop='min(iw,ih)':'min(iw,ih)',scale={d}:{d},unsharp=5:5:0.8,format=yuva420p,"
              f"geq=lum='p(X,Y)':cb='p(X,Y)':cr='p(X,Y)':"
              f"a='if(lt(hypot(X-{r},Y-{r}),{ri}),255,0)'[cam];"
              f"color=c=0x3FD1B4:s={d}x{d},format=yuva420p,"
              f"geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='if(lt(hypot(X-{r},Y-{r}),{r}),255,0)'[ring];"
              f"[bg][ring]overlay={x}:{y}:shortest=1[b2];[b2][cam]overlay={x}:{y}:shortest=1,format=yuv420p[v]")
        cmd += ["-filter_complex", fg, "-map", "[v]", "-map", f"{ai}:a"]
    else:
        cmd += ["-vf", "fps=30,format=yuv420p"]
    cmd += ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-c:a", "aac", "-b:a", "192k",
            "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-shortest", out]
    return cmd


if __name__ == "__main__":
    a = argparse.ArgumentParser()
    a.add_argument("deck"); a.add_argument("--audio"); a.add_argument("-o", "--out", default="video.mp4")
    a.add_argument("--slides-only", action="store_true")
    a.add_argument("--face", help="your camera recording: shown small in a corner, its sound used as the voice")
    a.add_argument("--face-pos", default="br", choices=["br", "bl", "tr", "tl"])
    a.add_argument("--face-size", type=int, default=300)
    o = a.parse_args()
    print(build(o.deck, o.audio, o.out, o.slides_only, o.face, o.face_pos, o.face_size))
