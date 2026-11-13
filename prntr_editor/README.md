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
