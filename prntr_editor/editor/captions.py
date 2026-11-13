"""Word-by-word captions (the 'active word lights up' style) as an ASS file that ffmpeg burns in."""
import re
from .common import CAPTION_FONT, COLORS


def _ass_col(rgb):
    r, g, b = rgb
    return f"&H00{b:02X}{g:02X}{r:02X}"


def _ts(t):
    cs = int(round(max(0, t) * 100))
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def build_ass(words, W, H, cfg, path):
    """words: [{'w','s','e'}] already in OUTPUT time, sorted."""
    n = int(cfg.get("words", 3))
    hl = _ass_col(COLORS.get(cfg.get("highlight", "green"), COLORS["green"]))
    size = int(H * cfg.get("size", 0.068))
    pos = cfg.get("position", "bottom")
    align, margin_v = (2, int(H * 0.12)) if pos == "bottom" else ((5, 0) if pos == "middle" else (8, int(H * 0.1)))
    upper = cfg.get("uppercase", True)
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,{CAPTION_FONT},{size},&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,-1,0,0,0,100,100,1,0,1,{max(3, size // 11)},{max(2, size // 22)},{align},{int(W * 0.08)},{int(W * 0.08)},{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    chunks, cur = [], []
    for i, w in enumerate(words):
        if cur and (len(cur) >= n or w["s"] - cur[-1]["e"] > 0.45 or re.search(r"[.?!,]$", cur[-1]["w"])):
            chunks.append(cur); cur = []
        cur.append(w)
    if cur:
        chunks.append(cur)
    lines = []
    for ci, ch in enumerate(chunks):
        nxt = chunks[ci + 1][0]["s"] if ci + 1 < len(chunks) else ch[-1]["e"] + 0.5
        end_chunk = min(nxt, ch[-1]["e"] + 0.6)
        clean = [re.sub(r"[,.;:]+$", "", w["w"]) for w in ch]
        clean = [c.upper() if upper else c for c in clean]
        for k, w in enumerate(ch):
            s = w["s"]
            e = ch[k + 1]["s"] if k + 1 < len(ch) else end_chunk
            if e - s < 0.04:
                continue
            parts = []
            for j, c in enumerate(clean):
                c = c.replace("{", "(").replace("}", ")")
                parts.append("{\\c" + hl + "&\\fscx112\\fscy112}" + c + "{\\r}" if j == k else c)
            pop = "{\\fad(0,0)}"
            lines.append(f"Dialogue: 0,{_ts(s)},{_ts(e)},Cap,,0,0,0,,{pop}{' '.join(parts)}")
    with open(path, "w") as f:
        f.write(head + "\n".join(lines) + "\n")
    return len(lines)
