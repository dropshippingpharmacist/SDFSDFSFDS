"""Word-level transcript with local Whisper (faster-whisper). No API key needed."""
import os, tempfile
from .common import run, save, fmt_ts


def transcribe(video, work, model="small.en", language=None, progress=None):
    os.makedirs(work, exist_ok=True)
    wav = os.path.join(work, "audio16k.wav")
    run(["ffmpeg", "-v", "error", "-y", "-i", video, "-vn", "-ac", "1", "-ar", "16000", wav])
    from faster_whisper import WhisperModel
    m = WhisperModel(model, device="cpu", compute_type="int8")
    segs, info = m.transcribe(wav, word_timestamps=True, vad_filter=True, language=language,
                              vad_parameters={"min_silence_duration_ms": 300})
    out = []
    for s in segs:
        if progress and info.duration:
            progress(min(1.0, s.end / info.duration))
        words = [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3), "p": round(w.probability, 3)}
                 for w in (s.words or []) if w.word.strip()]
        out.append({"start": round(s.start, 3), "end": round(s.end, 3), "text": s.text.strip(), "words": words})
    save(os.path.join(work, "transcript.json"), {"language": info.language, "segments": out})
    with open(os.path.join(work, "transcript.txt"), "w") as f:
        for s in out:
            f.write(f"[{fmt_ts(s['start'])} | {s['start']:.2f}-{s['end']:.2f}] {s['text']}\n")
    with open(os.path.join(work, "transcript.srt"), "w") as f:
        for i, s in enumerate(out, 1):
            f.write(f"{i}\n{_srt(s['start'])} --> {_srt(s['end'])}\n{s['text']}\n\n")
    os.remove(wav)
    return out


def _srt(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"
