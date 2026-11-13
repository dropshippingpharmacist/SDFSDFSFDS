import json, os, subprocess, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "assets")
FONT_DIR = "/usr/share/fonts/opentype/inter"
FONT_BLACK = os.path.join(FONT_DIR, "InterDisplay-Black.otf")
FONT_BOLD = os.path.join(FONT_DIR, "InterDisplay-Bold.otf")
if not os.path.exists(FONT_BLACK):
    FONT_BLACK = FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
CAPTION_FONT = "Inter Display Black" if "InterDisplay" in FONT_BLACK else "DejaVu Sans"

# PRNTR palette (RGB)
COLORS = {"red": (255, 59, 59), "green": (38, 230, 140), "blue": (42, 171, 227), "gold": (255, 204, 0),
          "purple": (123, 97, 255), "white": (255, 255, 255), "black": (0, 0, 0), "navy": (11, 11, 26)}


def load(path, default=None):
    if not os.path.exists(path):
        return default
    with open(path) as f:
        return json.load(f)


def save(path, obj):
    with open(path, "w") as f:
        json.dump(obj, f, indent=2)


def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode != 0:
        raise RuntimeError(f"command failed: {' '.join(cmd[:6])} ...\n{r.stderr[-3000:]}")
    return r.stdout


def probe(path):
    out = json.loads(run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height,r_frame_rate:format=duration",
                          "-of", "json", path]))
    v = next((s for s in out["streams"] if s["codec_type"] == "video"), None)
    a = any(s["codec_type"] == "audio" for s in out["streams"])
    num, den = (v["r_frame_rate"].split("/") if v else ("30", "1"))
    return {"duration": float(out["format"]["duration"]), "width": v["width"] if v else 0, "height": v["height"] if v else 0,
            "fps": round(float(num) / float(den or 1), 3), "has_audio": a}


def fmt_ts(t):
    t = max(0, int(round(t)))
    h, m, s = t // 3600, t % 3600 // 60, t % 60
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def need(binary):
    if not shutil.which(binary):
        raise SystemExit(f"{binary} is not installed")
