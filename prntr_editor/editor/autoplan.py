"""First-pass edit plan from the transcript: cut dead air, filler words and retakes, turn on captions,
add a hook card and punch-in zooms. Claude (or you) then adds the creative layer: texts, pointers, inserts, chapters.

Every time in the plan is in SOURCE seconds (the times in transcript.txt), so you can write it straight from the transcript."""
import re
from .common import probe

FILLERS = {"um", "uh", "uhm", "umm", "erm", "er", "ah", "hmm", "mm", "mhm"}


def _norm(w):
    return re.sub(r"[^a-z0-9']", "", w.lower())


def _retakes(segments):
    """A segment is a retake when one of the next two segments starts with the same 3+ words."""
    drop = set()
    for i, s in enumerate(segments):
        a = [_norm(w["w"]) for w in s["words"]][:4]
        if len(a) < 3:
            continue
        for j in (i + 1, i + 2):
            if j < len(segments):
                b = [_norm(w["w"]) for w in segments[j]["words"]][:4]
                if a[:3] == b[:3] and segments[j]["start"] - s["start"] < 25:
                    drop.add(i)
    return drop


def autoplan(transcript, video, title=None, max_pause=0.55, pad=0.14, zoom="auto", width=1920, height=1080, fps=30):
    info = probe(video)
    segs = transcript["segments"]
    drop = _retakes(segs)
    words = [w for i, s in enumerate(segs) if i not in drop for w in s["words"] if _norm(w["w"]) not in FILLERS]
    keep = []
    for w in words:
        s, e = max(0.0, w["s"] - pad), min(info["duration"], w["e"] + pad)
        if keep and s - keep[-1][1] <= max_pause - 2 * pad:
            keep[-1][1] = max(keep[-1][1], e)
        elif keep and s <= keep[-1][1]:
            keep[-1][1] = max(keep[-1][1], e)
        else:
            keep.append([round(s, 3), round(e, 3)])
    keep = [k for k in keep if k[1] - k[0] >= 0.25]

    zooms = []
    if zoom == "auto":
        kept_segs = [s for i, s in enumerate(segs) if i not in drop and s["end"] - s["start"] >= 2.5]
        for n, s in enumerate(kept_segs):
            if n % 2 == 1:   # every other sentence: classic jump-cut punch-in
                zooms.append({"t": s["start"], "dur": round(s["end"] - s["start"], 2), "scale": 1.14, "x": 0.5, "y": 0.42, "ease": 0})

    first = next((s["text"] for i, s in enumerate(segs) if i not in drop), "")
    src_len = info["duration"]
    out_len = sum(e - s for s, e in keep)
    return {
        "source": video, "width": width, "height": height, "fps": fps,
        "stats": {"source_seconds": round(src_len, 1), "kept_seconds": round(out_len, 1),
                  "cuts": len(keep), "retakes_removed": len(drop)},
        "keep": keep,
        "captions": {"on": True, "words": 3, "position": "bottom", "highlight": "green", "uppercase": True},
        "hook": {"text": (title or first[:60]).upper(), "sub": "", "t": keep[0][0] if keep else 0, "dur": 3.0},
        "texts": [],
        "pointers": [],
        "zooms": zooms,
        "inserts": [],
        "chapters": [],
        "fade_in": 0.3, "fade_out": 0.8,
        "sfx": True,
        "music": None,
        "progress_bar": False,
        "loudnorm": True,
    }
