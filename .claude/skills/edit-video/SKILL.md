---
name: edit-video
description: Edit a raw video the owner uploads into a finished YouTube video, then make its thumbnail, title, description, chapters and pinned comment. Use when the owner uploads a video and asks to edit it, cut it, add captions, hooks, text, pointers or zooms, or make a thumbnail.
---

# PRNTR video editor

You are the editor. The engine in `prntr_editor/` does the mechanical work (transcribe, cut, captions, zooms, chart inserts, pointers, text, sound effects, fades, loudness, thumbnail). You make the creative calls by writing `plan.json`, then you check your own work by looking at frames before handing anything over.

Run every command from `/home/user/SDFSDFSFDS/prntr_editor`. If an import fails, `python3 -m pip install -r requirements.txt` (and `"opencv-python-headless<5"`).
Work folder: `/home/user/SDFSDFSFDS/videos_out/<short-name>/` (git-ignored; never commit videos).

## 1. Transcribe and first pass

```bash
python3 -m editor transcribe "<video>" --work W          # ~1 min per 5 min of video, local Whisper, no key
python3 -m editor plan --work W --video "<video>" --title "<working title>" [--zoom off]
```

- `--zoom off` for screen recordings; keep `auto` for talking head (punch-in on every other sentence).
- `--vertical` makes a 1080x1920 Short.
- Read `W/transcript.txt` all the way through before you plan anything. Times in it are SOURCE seconds; the plan uses source seconds everywhere.

## 2. Look at the footage

```bash
python3 -m editor frames "<video>" --times 5,30,62.5,90 --out W/sheet.jpg
```

Read the sheet. The yellow grid is 0.0–1.0 in both directions; use it to place pointers and zoom centres. Look at every moment where the speaker says "this", "here", "look at", or names a chart, a number, a coin or a tool.

## 3. Write the creative layer into `W/plan.json`

Keep what autoplan made (`keep`, captions, zooms), then add the rest. Schema:

| key | what it does | fields |
|---|---|---|
| `keep` | source ranges kept, in play order. Put a strong line first to make a cold open. | `[[start, end], ...]` |
| `hook` | big headline over the first seconds | `text`, `sub` (green tag), `t`, `dur` |
| `texts` | on-screen words | `t`, `dur`, `text`, `style`: `sticker`/`big`/`lower` (`sub` for lower), `color`: red/green/blue/gold/purple/white, `pos`: `top-left`, `top-center`, `middle`, `bottom-center`, `lower-left`, or `[x, y]`, `angle`, `scale` |
| `pointers` | arrow / circle / box drawn on, with a label | `t`, `dur`, `shape`: `arrow` (`x,y` = tip, `from_x,from_y`), `circle`/`box` (`x,y` centre, `w,h`), `color`, `label`, `label_x`, `label_y` |
| `zooms` | punch-in or slow push | `t`, `dur`, `scale`, `x`, `y`, `ease` (0 = hard cut, 0.4 = smooth) |
| `inserts` | full-screen image (chart, screenshot) over the talking | `t`, `dur`, `image`, `kenburns`, `pip` (speaker in a corner), `kb_x`, `kb_y` |
| `chapters` | YouTube chapters | `t`, `title` (first one is forced to 0:00) |
| `captions` | word-by-word captions | `on`, `words` (per screen), `position` bottom/middle/top, `highlight`, `uppercase`, `size` |
| `music` | optional bed, auto-ducked under the voice | `file`, `volume` |
| also | `fade_in`, `fade_out`, `sfx` (whoosh/pop on graphics), `progress_bar`, `loudnorm` | |

Editing rules:
- The first 3 seconds decide everything: hook card + the strongest line. Cold-open with a later line if the start is slow.
- Something changes on screen every 5–8 seconds: a cut, zoom, text, pointer or insert. Never two big graphics at once.
- Text is 1–4 words, in capitals. It repeats or sharpens what is being said, never a sentence.
- When the speaker refers to a chart, show it (insert) and point at the exact spot (pointer with a label).
- Numbers that matter get a `big` text: prices, market caps, multiples.
- Cut every retake, false start, "um", long pause and off-topic tangent. If a section drags, cut it from `keep`.
- Brand language: PRNTR names only (the Box, ceiling, floor, middle, Fake-Out, the Return, the Turn, the trip across). Never use any other trading system's terms in captions or on-screen text; if the speaker says one, cut it or replace the caption word.
- Honesty: never add on-screen claims the speaker didn't make (no invented profits, no "I traded this" on a chart study). Allegations about real people stay "reported".

## 4. Preview, check, fix, render

```bash
python3 -m editor render --work W --preview     # 960px, fast
python3 -m editor frames W/preview.mp4 --times <every graphic's output time> --out W/check.jpg --no-grid
```

Look at the check sheet. Fix overlaps, text covering faces or the chart's key area, pointers that miss, captions colliding with graphics (move captions to `top` or the graphic up). Repeat until clean. Then:

```bash
python3 -m editor render --work W              # 1080p final, about 0.7x real time
```

## 5. Thumbnail

```bash
python3 -m editor faces "<video>" --work W       # best face frames from the video
python3 -m editor thumb --out W/thumbnail.png --line1 "SELL THE STOCK" --line2 "BUY THE SCANDAL" --big '$9K→$1M' --face W/face_0_*.jpg [--bg chart.png] --work W
```

Read the face frames and pick the most expressive one (open mouth, raised eyebrows), not just the first. If none is good, use `business_course/case_nvda_hung/youtube/founder_cutout.png` and ask the owner for a fresh reaction photo. Make two versions with different wording for an A/B test. Stickers 2–4 words each; the big line is the payoff number.

## 6. Hand over

Send with SendUserFile: `final.mp4`, `thumbnail.png` (+ the B version), and write `W/youtube_pack.md` with: 3 title options (recommended first), description with the chapters from `W/chapters.txt`, pinned comment, tags. Tell the owner what you cut and why in two or three lines.
