"""Render an edit plan: cut, zoom, chart inserts, pointers, texts, hook, captions, sound effects, music, fades, loudness."""
import os, subprocess, math, bisect
import numpy as np
import cv2
from PIL import Image
from .common import probe, run, save, load, fmt_ts, FONT_DIR, ASSETS
from . import graphics as G
from .captions import build_ass


# ---------------- time map: source seconds -> output seconds ----------------
class TimeMap:
    """Kept ranges may be out of order (a cold open plays a later line first, and it plays again in its place)."""
    def __init__(self, keep):
        self.segs, o = [], 0.0
        for s, e in keep:
            self.segs.append((s, e, o)); o += e - s
        self.total = o

    def out_all(self, t):
        return [o + (t - s) for s, e, o in self.segs if s <= t < e]

    def out(self, t, snap=True):
        hit = self.out_all(t)
        if hit:
            return hit[-1]          # the main occurrence, not the cold-open teaser
        if not snap:
            return None
        nxt = [(s, o) for s, e, o in self.segs if s > t]
        return min(nxt)[1] if nxt else self.total


def _sfx_files():
    os.makedirs(ASSETS, exist_ok=True)
    files = {"whoosh": os.path.join(ASSETS, "whoosh.wav"), "pop": os.path.join(ASSETS, "pop.wav")}
    if not os.path.exists(files["whoosh"]):
        run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "anoisesrc=d=0.55:c=pink:a=0.5", "-af",
             "highpass=f=350,lowpass=f=5000,afade=t=in:d=0.25,afade=t=out:st=0.25:d=0.3,volume=0.7", files["whoosh"]])
    if not os.path.exists(files["pop"]):
        run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "sine=f=880:d=0.14", "-f", "lavfi", "-i", "sine=f=1760:d=0.14",
             "-filter_complex", "[0][1]amix=inputs=2,afade=t=out:st=0.01:d=0.13,volume=0.5", files["pop"]])
    return files


# ---------------- step 1: cut and join ----------------
def cut(plan, work, W, H, fps, preset):
    src = plan["source"]
    info = probe(src)
    lines = []
    keep = plan["keep"]
    for i, (s, e) in enumerate(keep):
        lines.append(f"[0:v]trim=start={s}:end={e},setpts=PTS-STARTPTS,fps={fps},scale={W}:{H}:force_original_aspect_ratio=decrease,"
                     f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1[v{i}];")
        if info["has_audio"]:
            d = e - s
            lines.append(f"[0:a]atrim=start={s}:end={e},asetpts=PTS-STARTPTS,aresample=48000,afade=t=in:d=0.012,"
                         f"afade=t=out:st={max(0, d - 0.012):.3f}:d=0.012[a{i}];")
        else:
            lines.append(f"anullsrc=r=48000:cl=stereo,atrim=0:{e - s}[a{i}];")
    lines.append("".join(f"[v{i}][a{i}]" for i in range(len(keep))) + f"concat=n={len(keep)}:v=1:a=1[v][a]")
    script = os.path.join(work, "cut_filter.txt")
    with open(script, "w") as f:
        f.write("\n".join(lines))
    out = os.path.join(work, "cut.mov")
    run(["ffmpeg", "-v", "error", "-y", "-i", src, "-filter_complex_script", script, "-map", "[v]", "-map", "[a]",
         "-c:v", "libx264", "-preset", preset, "-crf", "17", "-c:a", "pcm_s16le", "-f", "mov", out])
    return out


# ---------------- step 2: overlays ----------------
def _rgba(img):
    return np.array(img.convert("RGBA"))


def _blend(frame, ov, x, y, a=1.0):
    h, w = ov.shape[:2]
    H, W = frame.shape[:2]
    x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
    if x0 >= x1 or y0 >= y1 or a <= 0:
        return
    o = ov[y0 - y:y1 - y, x0 - x:x1 - x]
    alpha = (o[..., 3:4].astype(np.float32) / 255.0) * a
    roi = frame[y0:y1, x0:x1].astype(np.float32)
    frame[y0:y1, x0:x1] = (roi * (1 - alpha) + o[..., :3].astype(np.float32) * alpha).astype(np.uint8)


def _env(t, t0, t1, fin=0.18, fout=0.2):
    if t < t0 or t >= t1:
        return 0.0
    return min(1.0, (t - t0) / fin if fin else 1.0, (t1 - t) / fout if fout else 1.0)


def _pop_scale(t, t0, d=0.22):
    k = (t - t0) / d
    if k >= 1:
        return 1.0
    return 0.55 + 0.45 * (1 - (1 - k) ** 3) + 0.08 * math.sin(k * math.pi)


def _fit_image(path, W, H, blur_bg=True):
    im = Image.open(path).convert("RGB")
    s = min(W / im.width, H / im.height)
    fg = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
    bg = im.resize((W, H)).filter(__import__("PIL.ImageFilter", fromlist=["x"]).GaussianBlur(30)) if blur_bg else Image.new("RGB", (W, H))
    bg = Image.blend(bg, Image.new("RGB", (W, H)), 0.55)
    bg.paste(fg, ((W - fg.width) // 2, (H - fg.height) // 2))
    return np.array(bg)


def build_overlays(plan, tm, W, H, scale):
    ov = {"texts": [], "pointers": [], "zooms": [], "inserts": [], "hook": None, "sfx": []}
    for t in plan.get("texts", []):
        t0 = tm.out(t["t"]); t1 = t0 + t.get("dur", 3)
        style = t.get("style", "sticker")
        if style == "big":
            img = G.big_text(t["text"], H, t.get("color", "white"), t.get("scale", 1.0), max_w=W * 0.9)
        elif style == "lower":
            img = G.lower_third(t["text"], t.get("sub", ""), H, t.get("color", "blue"))
        else:
            img = G.sticker(t["text"], H, t.get("color", "red"), t.get("angle", 0), t.get("scale", 1.0))
        x, y = G.place(img, t.get("pos", "top-center"), W, H)
        ov["texts"].append((t0, t1, _rgba(img), x, y)); ov["sfx"].append((t0, "pop"))
    for p in plan.get("pointers", []):
        t0 = tm.out(p["t"]); t1 = t0 + p.get("dur", 3)
        pf = G.pointer_frames(p, W, H)
        bb = pf[-1].getbbox() or (0, 0, 2, 2)          # keep only the box the graphic covers (saves memory)
        frames = [_rgba(f.crop(bb)) for f in pf]
        ov["pointers"].append((t0, t1, frames, bb[0], bb[1])); ov["sfx"].append((t0, "pop"))
    for z in plan.get("zooms", []):
        t0 = tm.out(z["t"]); t1 = t0 + z.get("dur", 2)
        ov["zooms"].append((t0, t1, z.get("scale", 1.15), z.get("x", 0.5) * W, z.get("y", 0.45) * H, z.get("ease", 0.35)))
    for c in plan.get("inserts", []):
        t0 = tm.out(c["t"]); t1 = t0 + c.get("dur", 4)
        ov["inserts"].append((t0, t1, _fit_image(c["image"], W, H), c.get("kenburns", True), c.get("pip", False),
                              c.get("kb_x", 0.5), c.get("kb_y", 0.5)))
        ov["sfx"].append((t0, "whoosh"))
    hk = plan.get("hook")
    if hk and hk.get("text"):
        t0 = hk["ot"] if "ot" in hk else tm.out(hk.get("t", 0)); ov["hook"] = (t0, t0 + hk.get("dur", 3), _rgba(G.hook_card(hk["text"], hk.get("sub", ""), W, H)))
        ov["sfx"].append((t0, "whoosh"))
    return ov


def _zoom(frame, s, cx, cy):
    H, W = frame.shape[:2]
    M = np.float32([[s, 0, (1 - s) * cx], [0, s, (1 - s) * cy]])
    return cv2.warpAffine(frame, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


def compose(frame, t, ov, W, H, total, plan):
    for (t0, t1, s, cx, cy, ease) in ov["zooms"]:
        if t0 <= t < t1:
            k = 1.0 if not ease else min(1.0, (t - t0) / ease, (t1 - t) / ease)
            k = k * k * (3 - 2 * k)
            frame = _zoom(frame, 1 + (s - 1) * k, cx, cy)
            break
    for (t0, t1, img, kb, pip, kx, ky) in ov["inserts"]:
        a = _env(t, t0, t1, 0.2, 0.2)
        if a > 0:
            base = img
            if kb:
                p = (t - t0) / max(0.1, t1 - t0)
                base = _zoom(img, 1.0 + 0.07 * p, kx * W, ky * H)
            speaker = frame
            frame = (base.astype(np.float32) * a + frame.astype(np.float32) * (1 - a)).astype(np.uint8)
            if pip:
                pw, ph = int(W * 0.26), int(H * 0.26)
                small = cv2.resize(speaker, (pw, ph), interpolation=cv2.INTER_AREA)
                bx, by = W - pw - int(H * 0.04), H - ph - int(H * 0.04)
                cv2.rectangle(frame, (bx - 4, by - 4), (bx + pw + 3, by + ph + 3), (255, 255, 255), -1)
                frame[by:by + ph, bx:bx + pw] = small
            break
    for (t0, t1, frames, px, py) in ov["pointers"]:
        a = _env(t, t0, t1, 0.001, 0.25)
        if a > 0:
            k = min(len(frames) - 1, int((t - t0) / 0.035))
            _blend(frame, frames[k], px, py, a)
    for (t0, t1, img, x, y) in ov["texts"]:
        a = _env(t, t0, t1, 0.08, 0.18)
        if a > 0:
            s = _pop_scale(t, t0)
            if s != 1.0:
                h, w = img.shape[:2]
                im2 = cv2.resize(img, (max(2, int(w * s)), max(2, int(h * s))), interpolation=cv2.INTER_LINEAR)
                _blend(frame, im2, x + (w - im2.shape[1]) // 2, y + (h - im2.shape[0]) // 2, a)
            else:
                _blend(frame, img, x, y, a)
    if ov["hook"]:
        t0, t1, img = ov["hook"]
        a = _env(t, t0, t1, 0.2, 0.3)
        if a > 0:
            _blend(frame, img, 0, int(-img.shape[0] * 0.25 * (1 - min(1, (t - t0) / 0.25))), a)
    if plan.get("progress_bar"):
        cv2.rectangle(frame, (0, 0), (int(W * t / max(total, 0.1)), max(4, H // 180)), (38, 230, 140), -1)
    return frame


# ---------------- step 3: the whole render ----------------
def render(plan, work, out=None, preview=False, progress=None):
    W, H, fps = plan.get("width", 1920), plan.get("height", 1080), plan.get("fps", 30)
    if preview:
        W, H = 960, int(960 * H / W) // 2 * 2
    out = out or os.path.join(work, "preview.mp4" if preview else "final.mp4")
    tm = TimeMap(plan["keep"])
    cut_path = cut(plan, work, W, H, fps, "ultrafast" if preview else "veryfast")
    total = probe(cut_path)["duration"]

    # captions in output time
    ass = os.path.join(work, "captions.ass")
    tr = load(os.path.join(work, "transcript.json"), {"segments": []})
    words = []
    for s in tr["segments"]:
        for w in s["words"]:
            for o in tm.out_all(w["s"]):
                words.append({"w": w["w"], "s": o, "e": o + (w["e"] - w["s"])})
    words.sort(key=lambda w: w["s"])
    cap = plan.get("captions", {})
    if cap.get("on", True) and words:
        build_ass(words, W, H, cap, ass)
    else:
        build_ass([], W, H, cap, ass)

    ov = build_overlays(plan, tm, W, H, 1.0)

    # audio graph: voice (+ music ducked under it) + sound effects, then loudness
    inputs = ["-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(fps), "-i", "-", "-i", cut_path]
    af, mix = [], []
    fi, fo = plan.get("fade_in", 0.3), plan.get("fade_out", 0.8)
    af.append(f"[1:a]afade=t=in:d={fi},afade=t=out:st={max(0, total - fo):.2f}:d={fo}[voice]")
    n_in = 2
    music = plan.get("music")
    if music and music.get("file"):
        inputs += ["-stream_loop", "-1", "-i", music["file"]]
        af.append(f"[voice]asplit=2[vo][sc]")
        af.append(f"[{n_in}:a]atrim=0:{total:.2f},volume={music.get('volume', 0.14)},afade=t=out:st={max(0, total - 2):.2f}:d=2[mu]")
        af.append("[mu][sc]sidechaincompress=threshold=0.02:ratio=10:attack=15:release=350[md]")
        mix += ["[vo]", "[md]"]; n_in += 1
    else:
        mix.append("[voice]")
    if plan.get("sfx", True) and ov["sfx"]:
        files = _sfx_files()
        for k, (t0, kind) in enumerate(sorted(ov["sfx"])[:80]):
            inputs += ["-i", files[kind]]
            ms = int(t0 * 1000)
            af.append(f"[{n_in}:a]adelay={ms}|{ms},volume={0.35 if kind == 'pop' else 0.5}[s{k}]")
            mix.append(f"[s{k}]"); n_in += 1
    af.append("".join(mix) + f"amix=inputs={len(mix)}:normalize=0:duration=first[mx]")
    af.append("[mx]" + ("loudnorm=I=-14:TP=-1.5:LRA=11," if plan.get("loudnorm", True) else "") + "aresample=48000[aout]")
    vf = (f"[0:v]ass=captions.ass:fontsdir={FONT_DIR},fade=t=in:st=0:d={fi},"
          f"fade=t=out:st={max(0, total - fo):.2f}:d={fo},format=yuv420p[vout]")
    script = os.path.join(work, "final_filter.txt")
    open(script, "w").write(";\n".join([vf] + af))
    enc = ["ffmpeg", "-v", "error", "-y"] + inputs + ["-filter_complex_script", script, "-map", "[vout]", "-map", "[aout]",
           "-c:v", "libx264", "-preset", "ultrafast" if preview else os.environ.get("RENDER_PRESET", "medium"), "-crf", "26" if preview else "18",
           "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", os.path.abspath(out)]
    reader = subprocess.Popen(["ffmpeg", "-v", "error", "-i", cut_path, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                              stdout=subprocess.PIPE)
    writer = subprocess.Popen(enc, stdin=subprocess.PIPE, cwd=work, stderr=subprocess.PIPE)
    size, n = W * H * 3, 0
    try:
        while True:
            buf = reader.stdout.read(size)
            if len(buf) < size:
                break
            frame = np.frombuffer(buf, np.uint8).reshape(H, W, 3).copy()
            frame = compose(frame, n / fps, ov, W, H, total, plan)
            writer.stdin.write(frame.tobytes())
            n += 1
            if progress and n % 30 == 0:
                progress(min(1.0, n / fps / max(total, 0.1)))
    finally:
        writer.stdin.close()
        err = writer.stderr.read().decode()
        writer.wait(); reader.wait()
    if writer.returncode != 0:
        raise RuntimeError("encode failed:\n" + err[-3000:])

    # chapters in output time
    ch = sorted(plan.get("chapters", []), key=lambda c: c["t"])
    lines = []
    for i, c in enumerate(ch):
        lines.append(f"{fmt_ts(0 if i == 0 else tm.out(c['t']))} {c['title']}")
    open(os.path.join(work, "chapters.txt"), "w").write("\n".join(lines) + ("\n" if lines else ""))
    save(os.path.join(work, "render_report.json"), {"output": out, "frames": n, "seconds": round(total, 2),
                                                    "source_seconds": plan.get("stats", {}).get("source_seconds")})
    return out
