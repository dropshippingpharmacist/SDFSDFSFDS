I'm Marcus (YouTube channel https://www.youtube.com/@DrMarcusBright). Work only inside this folder (~/PRNTR VIDEOS). Goal: get every one of my own videos onto this Mac, transcribe them, and prepare clean audio of my voice for an ElevenLabs Professional Voice Clone. These are my own videos.

1. Tools: check for `yt-dlp`, `ffmpeg` and Python 3. If any is missing, tell me the exact install command (Homebrew: `brew install yt-dlp ffmpeg`) and wait for my OK before installing anything. For transcription use `pip install faster-whisper` in a virtual env inside this folder (`python3 -m venv .venv`).

2. Download, a few seconds apart, from https://www.youtube.com/@DrMarcusBright/videos and /shorts:
   - the audio of each video as m4a into `audio/`, named `<upload date>_<video id>_<short title>.m4a`;
   - YouTube's English captions (.vtt) into `captions/` where they exist.
   If YouTube asks you to sign in, stop and tell me (I can use `--cookies-from-browser chrome` with my own logged-in browser if I say so).

3. Transcribe every audio file with faster-whisper (model `small.en`, int8, word timestamps off) into `transcripts/<same name>.txt`, one line per sentence with [start-end] seconds. Use the .vtt only as a fallback.

4. Sort the videos into `inventory.csv`: id, title, date, length, and one of: **solo** (only me talking), **music** (me talking with background music), **other** (testimonials, other people talking, no voice). Check by reading each transcript and listening to 20 seconds from the start, middle and end of each with ffmpeg volume stats. When unsure, mark it `music`.

5. Voice clone pack in `voice_clone/`: from the **solo** videos only, cut clips of just me talking into 1-5 minute WAV files (mono, 44.1 kHz, no normalization or "enhance" filters). Remove the intro and outro if they have music, and any long silences. Aim for 60-180 minutes in total. Write `voice_clone/README.txt` with the total minutes and the exact upload steps: ElevenLabs → Voices → Add voice → Professional Voice Clone → upload these files → read the verification sentence.

6. Speaking style: from all the solo + music transcripts, write `MARCUS_STYLE_FULL.md` with:
   - how I open videos and sentences;
   - my filler words and how often I use each;
   - phrases I repeat;
   - how I say numbers and money;
   - how I explain a trade;
   - how I call to action;
   - my average words per second;
   - 30 real example sentences quoted word for word.

7. Hand-off: the cloud session that builds my trade Shorts needs `MARCUS_STYLE_FULL.md`, `inventory.csv` and the `transcripts/` folder (text only, not audio).
   - If this Mac can push to GitHub (`git ls-remote https://github.com/dropshippingpharmacist/YOUTUBEVIDEOMAKER` works), clone that repo into `repo/`, copy them to `content/voice/` (transcripts in `content/voice/transcripts/`), commit with the message "Marcus voice: full transcripts + style profile", and push to `main`.
   - If not, zip them as `marcus_voice_text.zip` here, and tell me to upload it in the cloud chat.

When done, tell me in a few lines:
- how many videos per type;
- total minutes in the voice clone pack;
- whether the push worked.
