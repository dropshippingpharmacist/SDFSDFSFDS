"""The editor's judgement: Claude reads the transcript and looks at the footage, then decides the cuts, hook, on-screen
text, pointers, zooms, chart inserts, chapters, thumbnail and YouTube copy. Three passes, like a human editor:
  1. plan     - watch (frames + transcript) and write the edit
  2. place    - look at the exact frame under every pointer and zoom and fix the coordinates
  3. review   - watch a preview render and fix what looks wrong
Needs ANTHROPIC_API_KEY."""
import base64, io, json, os
from PIL import Image, ImageDraw
import anthropic
from .common import load, probe, fmt_ts
from .frames import grab
from .graphics import font

MODEL = os.environ.get("EDITOR_MODEL", "claude-opus-5-5")
COLORS = ["red", "green", "gold", "blue", "purple", "white"]
POS = ["top-left", "top-center", "top-right", "middle", "bottom-center", "lower-left", "lower-right"]


class BrainError(RuntimeError):
    pass


SYSTEM = """You are the lead editor for PRNTR, a trading education brand (stock and crypto charts, plus memecoins). The owner records
long-form YouTube videos: talking to camera, screen recordings of charts, DEX Screener, Pump.fun, wallets. You turn the raw
recording into a video that keeps viewers watching, while staying honest and on-brand.

How you edit:
- The first 3 seconds decide everything. Write a hook card (max 8 words) that states the most surprising, specific payoff of the
  video. If the recording starts slow, cold-open with the strongest 3-8 second line from later in the video.
- Long-form pacing: on average something changes on screen every 5-8 seconds (a cut, a zoom, a text, a pointer, an insert).
  Do not stack two big graphics at the same moment. Leave breathing room after a big graphic.
- On-screen text is 1-4 words in capitals and repeats or sharpens what is said at that moment. Never a sentence. Numbers that
  matter (prices, market caps, multiples, percentages) get the 'big' style. Step names and new sections get 'lower' style with a
  short 'sub'. Everything else is a 'sticker'.
- Colour meaning: red = sell, danger, loss, a warning. green = buy, profit, the payoff. gold = look here, attention. blue = info,
  a step, a name. purple = news, a headline, an event. white = neutral.
- When the speaker says "this", "here", "look at", "right there", or names a level, candle, wallet, coin, number on screen,
  draw a pointer exactly on it (arrow for a point, circle for a small area, box for a zone) with a 1-3 word label.
- When the speaker talks about a chart or image the owner uploaded, show it as an insert at that moment, for as long as they talk
  about it (usually 4-12 s), with pip=true when their face matters. Point at the parts of the chart they mention.
- Zooms: on talking-head parts, punch in (scale 1.12-1.2, ease 0) on every other sentence; on screen recordings, zoom (1.3-1.8,
  ease 0.35) into the part of the screen being discussed so small text becomes readable. Never zoom on a frame where the
  important content would be cut off.
- Cuts: remove false starts, repeated takes (keep the last, best one), long tangents that do not serve the video's promise,
  dead air, "wait let me", technical fumbling, and anything the owner would not want public (personal info, keys, addresses,
  emails, seed phrases, balances they didn't mean to show). Keep the story intact: never cut the middle of a thought.
- Captions are on. If graphics will often sit at the bottom, put captions at 'top' or 'middle'.
- Chapters for long-form every 1.5-3 minutes at real topic changes; the first chapter starts at the first kept second.
- Coordinates: x and y are fractions of the frame (0,0 top-left, 1,1 bottom-right). The frames you are shown carry a yellow grid
  at every 0.1. Times are SOURCE seconds from the transcript (the timestamps you are given), never edited-video time.
- Never put text or a pointer over the speaker's face, or over the exact chart area being explained (put it beside).

Brand and honesty rules (strict):
- Trading language on screen uses PRNTR names only: the Box, the ceiling, the floor, the middle, the Fake-Out, the Return,
  the Turn, the trip across, the Launch Pad, the PRNTR Crossover. Never put another trading system's name or jargon on screen
  (no TCT, no "tap", no "deviation", no "range high/low", no "BOS", no "PO3", no Wyckoff terms). If the speaker uses such a term,
  cut it when it is clean to cut, otherwise leave the audio but never repeat it in on-screen text.
- Never add a claim the speaker did not make: no invented profits, no "I traded this" on a chart study, no guarantees.
- Allegations about real people are "reported", never stated as fact.
- Titles: specific and curious, max 60 characters, no lies. Description: 2-3 short paragraphs, then the literal token {CHAPTERS},
  then a one-line risk disclaimer ("Education only, not financial advice."). Pinned comment: one line that invites a reply.
- Thumbnail: line1 and line2 are 2-4 word stickers that tell the story as a contrast or a tension; big is the payoff number or
  2-3 word punchline. Pick the most expressive face frame (open mouth, raised eyebrows, strong emotion) by index, or -1 if none
  is usable. background_image is the filename of an uploaded chart that sells the video, or "".
"""


def _num():
    return {"type": "number"}


def _obj(props):
    return {"type": "object", "properties": props, "required": list(props), "additionalProperties": False}


TEXT = _obj({"t": _num(), "dur": _num(), "text": {"type": "string"}, "style": {"type": "string", "enum": ["sticker", "big", "lower"]},
             "sub": {"type": "string"}, "color": {"type": "string", "enum": COLORS}, "pos": {"type": "string", "enum": POS}})
POINTER = _obj({"t": _num(), "dur": _num(), "shape": {"type": "string", "enum": ["arrow", "circle", "box"]}, "x": _num(), "y": _num(),
                "w": _num(), "h": _num(), "from_x": _num(), "from_y": _num(), "color": {"type": "string", "enum": COLORS},
                "label": {"type": "string"}})
ZOOM = _obj({"t": _num(), "dur": _num(), "scale": _num(), "x": _num(), "y": _num(), "ease": _num()})
INSERT = _obj({"t": _num(), "dur": _num(), "image": {"type": "string"}, "pip": {"type": "boolean"}})
GRAPHICS = {"texts": {"type": "array", "items": TEXT}, "pointers": {"type": "array", "items": POINTER},
            "zooms": {"type": "array", "items": ZOOM}, "inserts": {"type": "array", "items": INSERT},
            "caption_position": {"type": "string", "enum": ["bottom", "middle", "top"]}}
PLAN_SCHEMA = _obj({
    "summary": {"type": "string"},
    "remove": {"type": "array", "items": _obj({"start": _num(), "end": _num(), "reason": {"type": "string"}})},
    "cold_open": _obj({"use": {"type": "boolean"}, "start": _num(), "end": _num()}),
    "hook": _obj({"text": {"type": "string"}, "sub": {"type": "string"}, "dur": _num()}),
    **GRAPHICS,
    "chapters": {"type": "array", "items": _obj({"t": _num(), "title": {"type": "string"}})},
    "youtube": _obj({"titles": {"type": "array", "items": {"type": "string"}}, "description": {"type": "string"},
                     "pinned_comment": {"type": "string"}, "tags": {"type": "array", "items": {"type": "string"}}}),
    "thumbnail": _obj({"line1": {"type": "string"}, "line2": {"type": "string"}, "big": {"type": "string"},
                       "face_index": {"type": "integer"}, "background_image": {"type": "string"}}),
})
PLACE_SCHEMA = _obj({"pointers": {"type": "array", "items": POINTER}, "zooms": {"type": "array", "items": ZOOM}})
REVIEW_SCHEMA = _obj({"issues": {"type": "array", "items": {"type": "string"}}, **GRAPHICS})


# ---------------- helpers ----------------
def _img_block(img, max_side=1024, quality=80):
    if isinstance(img, str):
        img = Image.open(img)
    img = img.convert("RGB")
    s = min(1.0, max_side / max(img.size))
    if s < 1:
        img = img.resize((int(img.width * s), int(img.height * s)), Image.LANCZOS)
    b = io.BytesIO(); img.save(b, "JPEG", quality=quality)
    return {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": base64.standard_b64encode(b.getvalue()).decode()}}


def _grid(img):
    img = img.convert("RGB"); d = ImageDraw.Draw(img)
    f = font(max(12, img.height // 40), black=False)
    for k in range(1, 10):
        x, y = img.width * k / 10, img.height * k / 10
        d.line([(x, 0), (x, img.height)], fill=(255, 255, 0), width=1)
        d.line([(0, y), (img.width, y)], fill=(255, 255, 0), width=1)
        d.text((x + 2, 2), f".{k}", fill=(255, 255, 0), font=f)
        d.text((2, y + 2), f".{k}", fill=(255, 255, 0), font=f)
    return img


def _frame(video, t, work, width=768):
    p = os.path.join(work, "_brain_frame.jpg")
    grab(video, t, p, width)
    return Image.open(p).copy()


def _call(content, schema, effort="high", log=None):
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise BrainError("No Anthropic API key yet. Add ANTHROPIC_API_KEY in the Render dashboard (Environment), then click Re-edit or upload again.")
    client = anthropic.Anthropic()
    with client.beta.messages.stream(
        model=MODEL, max_tokens=64000, system=SYSTEM,
        betas=["server-side-fallback-2026-07-01"], fallbacks="default",
        output_config={"effort": effort, "format": {"type": "json_schema", "schema": schema}},
        messages=[{"role": "user", "content": content}],
    ) as stream:
        msg = stream.get_final_message()
    if msg.stop_reason == "refusal":
        raise BrainError("the model declined this request")
    if msg.stop_reason == "max_tokens":
        raise BrainError("the edit plan was too long; try a shorter video")
    if log:
        u = msg.usage
        log(f"AI step used {u.input_tokens} input + {u.output_tokens} output tokens")
    text = next((b.text for b in msg.content if b.type == "text"), None)
    if not text:
        raise BrainError("no plan came back")
    return json.loads(text)


def _transcript_text(tr):
    return "\n".join(f"[{s['start']:.2f}-{s['end']:.2f}] {s['text']}" for s in tr["segments"])


def _sample_times(dur, n):
    n = max(1, min(n, int(dur // 4) or 1))
    return [dur * (i + 0.5) / n for i in range(n)]


# ---------------- pass 1: plan ----------------
def plan_edit(video, work, images, notes="", title="", faces=(), revise_from=None, log=None):
    info = probe(video)
    tr = load(os.path.join(work, "transcript.json"))
    c = [{"type": "text", "text": f"VIDEO: {info['duration']:.1f} s long, {info['width']}x{info['height']}.\n"
                                  f"OWNER'S WORKING TITLE: {title or '(none)'}\nOWNER'S NOTES: {notes or '(none)'}\n\n"
                                  f"TRANSCRIPT (source seconds):\n{_transcript_text(tr)}"}]
    c.append({"type": "text", "text": "FRAMES FROM THE VIDEO (with the 0.1 grid):"})
    for t in _sample_times(info["duration"], 28):
        c.append({"type": "text", "text": f"frame at {t:.1f} s"})
        c.append(_img_block(_grid(_frame(video, t, work)), 768, 70))
    if images:
        c.append({"type": "text", "text": "IMAGES THE OWNER UPLOADED FOR INSERTS (use the exact filename):"})
        for p in images:
            c.append({"type": "text", "text": f"image file: {os.path.basename(p)}"})
            c.append(_img_block(p, 1024))
    if faces:
        c.append({"type": "text", "text": "FACE FRAMES FOR THE THUMBNAIL (pick by index):"})
        for i, p in enumerate(faces):
            c.append({"type": "text", "text": f"face_index {i}"})
            c.append(_img_block(p, 384))
    if revise_from:
        c.append({"type": "text", "text": "THE CURRENT EDIT (revise it; keep what works, change what the owner asked for):\n"
                                          + json.dumps(revise_from)})
    c.append({"type": "text", "text": "Write the full edit plan now."})
    return _call(c, PLAN_SCHEMA, "high", log)


# ---------------- pass 2: exact placement ----------------
def place(video, work, plan, images_by_name, log=None):
    """Show the exact frame (or chart insert) under each pointer and zoom, and let the model fix the coordinates."""
    from .render import _fit_image
    items = [("pointer", i, p) for i, p in enumerate(plan.get("pointers", []))] + \
            [("zoom", i, z) for i, z in enumerate(plan.get("zooms", [])) if z.get("scale", 1) >= 1.25]
    if not items:
        return plan
    c = [{"type": "text", "text": "Check every pointer and zoom against the exact frame it will appear on. Fix x, y, w, h, from_x, "
                                  "from_y so arrows touch the exact spot, circles and boxes wrap it, labels do not cover it, and zooms are "
                                  "centred on the content being discussed and do not cut it off. Return ALL pointers and ALL zooms "
                                  "(same order and count as given), changed or not.\n\nCURRENT POINTERS AND ZOOMS:\n"
                                  + json.dumps({"pointers": plan.get("pointers", []), "zooms": plan.get("zooms", [])})}]
    for kind, i, it in items[:40]:
        t = it["t"] + min(1.0, it.get("dur", 2) / 2)
        ins = next((x for x in plan.get("inserts", []) if x["t"] <= t < x["t"] + x["dur"]), None)
        if ins and ins["image"] in images_by_name:
            img = Image.fromarray(_fit_image(images_by_name[ins["image"]], 1280, 720))
            what = f"(chart insert '{ins['image']}' is on screen)"
        else:
            img = _frame(video, t, work, 1024)
            what = ""
        c.append({"type": "text", "text": f"{kind} #{i} at {it['t']:.1f} s {what}"})
        c.append(_img_block(_grid(img), 1024, 75))
    out = _call(c, PLACE_SCHEMA, "medium", log)
    if len(out["pointers"]) == len(plan.get("pointers", [])):
        plan["pointers"] = out["pointers"]
    if len(out["zooms"]) == len(plan.get("zooms", [])):
        plan["zooms"] = out["zooms"]
    return plan


# ---------------- pass 3: review a preview ----------------
def review(preview, work, plan, tm, log=None):
    """Look at the preview at every graphic and fix overlaps, collisions, bad placement and pacing."""
    moments = []
    for key in ("texts", "pointers", "inserts"):
        for it in plan.get(key, []):
            o = tm.out(it["t"])
            moments.append((o + min(0.8, it["dur"] / 2), f"{key[:-1]} '{it.get('text') or it.get('label') or it.get('image', '')}'"))
    moments.append((0.6, "hook"))
    moments.sort()
    c = [{"type": "text", "text": "This is a preview render of your edit. Look at each frame for: text covering faces or the chart area being "
                                  "explained, graphics overlapping each other or the captions, pointers missing their target, unreadable "
                                  "text, too many things at once, or anything off-brand. List the issues, then return the corrected "
                                  "texts, pointers, zooms, inserts and caption_position (all of them, changed or not; times stay in "
                                  "SOURCE seconds).\n\nCURRENT GRAPHICS:\n" + json.dumps({k: plan.get(k, []) for k in ("texts", "pointers", "zooms", "inserts")})
                                  + f"\ncaption position: {plan.get('captions', {}).get('position', 'bottom')}"}]
    for t, what in moments[:36]:
        c.append({"type": "text", "text": f"preview at {t:.1f} s (edited time): {what}"})
        c.append(_img_block(_frame(preview, t, work, 960), 960, 70))
    return _call(c, REVIEW_SCHEMA, "medium", log)
