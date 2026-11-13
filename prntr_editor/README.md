# PRNTR Editor

Turns a raw upload into a finished YouTube video and thumbnail.

**How to use it:** upload a video to Claude and say "edit this". Claude follows `.claude/skills/edit-video/SKILL.md`:
1. transcribe it;
2. cut dead air, filler words and retakes;
3. plan the hook, text, pointers, zooms and chart inserts;
4. preview it and check the frames;
5. render the final video;
6. make two thumbnails, plus the title, description, chapters and pinned comment.

**What the engine does by itself (`python3 -m editor ...`):**
- local Whisper transcript with word timings, no API key;
- silence, filler and retake cuts, with click-free audio joins;
- word-by-word captions with the active word highlighted;
- hook card, stickers, big numbers and lower thirds that pop in;
- animated arrows, circles and boxes with labels;
- punch-in and smooth zooms;
- full-screen chart inserts with a slow push and an optional picture-in-picture of the speaker;
- whoosh and pop sound effects, optional music ducked under the voice;
- fade in and out, loudness levelled for YouTube;
- chapters mapped to the edited timeline;
- best-face frame finder and a background cutout for the thumbnail.

See `python3 -m editor -h`. Dependencies are in `requirements.txt`, plus ffmpeg with libass.

## The website (Render)

`app.py` is a password-protected site. You upload a raw video, plus any chart images and notes, and get back:
- the edited video;
- two thumbnails;
- the YouTube pack: titles, description with chapters, pinned comment and tags.

**How each video is edited:**
1. Local Whisper transcribes it.
2. The face frames are found.
3. Silence, filler words and retakes are cut.
4. Claude watches the frames and reads the transcript, then writes the edit: cuts, cold open, hook, text, pointers, zooms, chart inserts, chapters, thumbnail and copy.
5. Claude checks every pointer and zoom against its exact frame.
6. A preview is rendered, and Claude reviews it and fixes problems.
7. The final 1080p video and the thumbnails are rendered.

Under the finished video there's a "Re-edit" box: describe what to change and it edits the video again.

**Environment variables:**

| Variable | Required | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | |
| `APP_PASSWORD` | yes | |
| `EDITOR_MODEL` | no | `claude-opus-5-5` |
| `WHISPER_MODEL` | no | `small.en`, or `base.en` for speed |
| `DATA_DIR` | no | `/data` if a disk is mounted, else `/tmp/prntr` |

Deploy with Docker: `prntr_editor/Dockerfile`, with `prntr_editor` as the build context.

**Storage:** add a Render disk mounted at `/data` so finished videos survive restarts and redeploys. Without one, download each video when it's done.
