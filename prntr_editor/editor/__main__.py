"""PRNTR Editor command line.

  python3 -m editor transcribe VIDEO --work WORK            word-level transcript (local Whisper)
  python3 -m editor plan --work WORK [--title T] [--zoom auto|off]   first-pass edit plan (plan.json)
  python3 -m editor frames VIDEO --times 12,40.5 --out sheet.jpg     frames with a 0-1 grid for placing graphics
  python3 -m editor render --work WORK [--preview]                   render plan.json -> preview.mp4 / final.mp4
  python3 -m editor faces VIDEO --work WORK                          best face frames for the thumbnail
  python3 -m editor thumb --out T.png --line1 .. --line2 .. --big .. [--face IMG] [--bg CHART.png]
  python3 -m editor all VIDEO --work WORK [--title T]                transcribe + plan + render + thumbnail in one go
"""
import argparse, os, sys, json
from .common import load, save


def main(argv=None):
    ap = argparse.ArgumentParser(prog="editor", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("transcribe"); a.add_argument("video"); a.add_argument("--work", required=True); a.add_argument("--model", default="small.en")
    a = sub.add_parser("plan"); a.add_argument("--work", required=True); a.add_argument("--video"); a.add_argument("--title")
    a.add_argument("--zoom", default="auto"); a.add_argument("--max-pause", type=float, default=0.55); a.add_argument("--vertical", action="store_true")
    a = sub.add_parser("frames"); a.add_argument("video"); a.add_argument("--times", required=True); a.add_argument("--out", required=True)
    a.add_argument("--no-grid", action="store_true")
    a = sub.add_parser("render"); a.add_argument("--work", required=True); a.add_argument("--preview", action="store_true"); a.add_argument("--out")
    a = sub.add_parser("faces"); a.add_argument("video"); a.add_argument("--work", required=True)
    a = sub.add_parser("thumb"); a.add_argument("--out", required=True); a.add_argument("--line1", default=""); a.add_argument("--line2", default="")
    a.add_argument("--big", default=""); a.add_argument("--face"); a.add_argument("--bg"); a.add_argument("--work")
    a = sub.add_parser("all"); a.add_argument("video"); a.add_argument("--work", required=True); a.add_argument("--title")
    a.add_argument("--zoom", default="auto"); a.add_argument("--model", default="small.en")
    ns = ap.parse_args(argv)

    if ns.cmd in ("transcribe", "all"):
        from .transcribe import transcribe
        segs = transcribe(os.path.abspath(ns.video), ns.work, ns.model)
        print(f"transcript: {len(segs)} sentences -> {ns.work}/transcript.txt")
    if ns.cmd in ("plan", "all"):
        from .autoplan import autoplan
        video = os.path.abspath(ns.video) if getattr(ns, "video", None) else load(os.path.join(ns.work, "plan.json"), {}).get("source")
        w, h = (1080, 1920) if getattr(ns, "vertical", False) else (1920, 1080)
        p = autoplan(load(os.path.join(ns.work, "transcript.json")), video, ns.title, zoom=ns.zoom, width=w, height=h,
                     **({"max_pause": ns.max_pause} if hasattr(ns, "max_pause") else {}))
        save(os.path.join(ns.work, "plan.json"), p)
        print("plan:", json.dumps(p["stats"]))
    if ns.cmd == "frames":
        from .frames import sheet
        print(sheet(ns.video, [float(t) for t in ns.times.split(",")], ns.out, grid=not ns.no_grid))
    if ns.cmd in ("render", "all"):
        from .render import render
        out = render(load(os.path.join(ns.work, "plan.json")), ns.work, getattr(ns, "out", None), getattr(ns, "preview", False))
        print("rendered:", out)
    if ns.cmd in ("faces", "all"):
        from .thumbnail import face_candidates
        video = os.path.abspath(ns.video)
        paths = face_candidates(video, ns.work)
        print("face frames:", *paths, sep="\n  ") if paths else print("no clear face found in the video")
    if ns.cmd == "thumb":
        from .thumbnail import make, cutout
        face = cutout(ns.face, ns.work or os.path.dirname(os.path.abspath(ns.out))) if ns.face and not ns.face.endswith("_cut.png") else ns.face
        print(make(ns.out, ns.line1, ns.line2, ns.big, face, ns.bg))
    if ns.cmd == "all":
        from .thumbnail import make, cutout, face_candidates
        faces = sorted(f for f in os.listdir(ns.work) if f.startswith("face_") and f.endswith(".jpg"))
        face = cutout(os.path.join(ns.work, faces[0]), ns.work) if faces else None
        title = (ns.title or "WATCH THIS").upper()
        print(make(os.path.join(ns.work, "thumbnail.png"), title[:22], "", "", face))


if __name__ == "__main__":
    main()
