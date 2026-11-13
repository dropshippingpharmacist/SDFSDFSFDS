"""One upload in, a finished video out: transcribe -> faces -> first-pass plan -> AI edit -> exact placement ->
preview -> AI review -> final render -> thumbnails -> YouTube pack. Every stage reports progress."""
import json, os, shutil, time, traceback
from .common import load, save, probe, fmt_ts


def _subtract(keep, a, b):
    out = []
    for s, e in keep:
        if e <= a or s >= b:
            out.append([s, e]); continue
        if s < a:
            out.append([s, a])
        if e > b:
            out.append([b, e])
    return [k for k in out if k[1] - k[0] >= 0.25]


def apply_brain(base, bp, images_by_name, duration):
    p = json.loads(json.dumps(base))
    keep = p["keep"]
    for r in bp.get("remove", []):
        if 0 <= r["start"] < r["end"] <= duration + 1:
            keep = _subtract(keep, r["start"], r["end"])
    co = bp.get("cold_open") or {}
    if co.get("use") and 1.5 <= co["end"] - co["start"] <= 12 and co["end"] <= duration:
        keep = [[co["start"], co["end"]]] + keep
    p["keep"] = keep
    hk = bp.get("hook") or {}
    p["hook"] = {"text": (hk.get("text") or "").upper(), "sub": (hk.get("sub") or "").upper(), "ot": 0.0,
                 "dur": max(2.0, min(4.5, hk.get("dur") or 3.0))}
    apply_graphics(p, bp, images_by_name, duration)
    p["chapters"] = [c for c in bp.get("chapters", []) if 0 <= c["t"] <= duration]
    if p["chapters"]:
        p["chapters"][0]["t"] = keep[0][0] if keep else 0
    return p


def apply_graphics(p, g, images_by_name, duration):
    ok = lambda it: 0 <= it["t"] < duration and it["dur"] > 0.3
    p["texts"] = [{**t, "text": t["text"].upper()} for t in g.get("texts", []) if ok(t) and t["text"].strip()]
    pts = []
    for q in g.get("pointers", []):
        if ok(q):
            q = dict(q)
            if not q.get("label"):
                q.pop("label", None)
            pts.append(q)
    p["pointers"] = pts
    if g.get("zooms"):
        mine = [z for z in g["zooms"] if ok(z) and 1.0 < z["scale"] <= 2.5]
        auto = [z for z in p.get("zooms", []) if not any(z["t"] < m["t"] + m["dur"] and m["t"] < z["t"] + z["dur"] for m in mine)]
        p["zooms"] = sorted(mine + auto, key=lambda z: z["t"])
    p["inserts"] = [{**i, "image": images_by_name[i["image"]], "name": i["image"], "kenburns": True}
                    for i in g.get("inserts", []) if ok(i) and i["image"] in images_by_name]
    if g.get("caption_position"):
        p.setdefault("captions", {})["position"] = g["caption_position"]
    return p


def _graphics_for_brain(p):
    """Plan graphics with insert paths turned back into the filenames the model knows."""
    g = {k: p.get(k, []) for k in ("texts", "pointers", "zooms")}
    g["inserts"] = [{"t": i["t"], "dur": i["dur"], "image": i.get("name", os.path.basename(i["image"])), "pip": i.get("pip", False)}
                    for i in p.get("inserts", [])]
    return g


def youtube_pack(bp, work, path):
    yt = bp.get("youtube", {})
    chapters = open(os.path.join(work, "chapters.txt")).read().strip() if os.path.exists(os.path.join(work, "chapters.txt")) else ""
    desc = (yt.get("description") or "").replace("{CHAPTERS}", "CHAPTERS\n" + chapters if chapters else "")
    lines = ["# YouTube pack", "", "## Titles (first one recommended)", ""]
    lines += [f"{i + 1}. {t}" for i, t in enumerate(yt.get("titles", []))]
    lines += ["", "## Description", "", desc, "", "## Pinned comment", "", yt.get("pinned_comment", ""), "",
              "## Tags", "", ", ".join(yt.get("tags", [])), ""]
    open(path, "w").write("\n".join(lines))


def run(job, status):
    """job: dict with dir, video, images, notes, title, zoom, review. status(stage, fraction, message)."""
    from .transcribe import transcribe
    from .autoplan import autoplan
    from .render import render, TimeMap
    from .thumbnail import face_candidates, cutout, make
    from . import brain

    d, video = job["dir"], job["video"]
    work = os.path.join(d, "work"); os.makedirs(work, exist_ok=True)
    out = os.path.join(d, "out"); os.makedirs(out, exist_ok=True)
    images = job.get("images", [])
    by_name = {os.path.basename(p): p for p in images}
    log = lambda m: status(None, None, m)
    info = probe(video)

    if job.get("revise"):
        bp = load(os.path.join(work, "brain_plan.json"))
        base = load(os.path.join(work, "base_plan.json"))
        faces = sorted(os.path.join(work, f) for f in os.listdir(work) if f.startswith("face_") and f.endswith(".jpg"))
        status("Re-editing with your notes", 0.05, "")
        bp = brain.plan_edit(video, work, images, job["revise"], job.get("title", ""), faces, revise_from=bp, log=log)
    else:
        status("Transcribing", 0.0, "")
        transcribe(video, work, job.get("whisper", "small.en"), progress=lambda f: status("Transcribing", 0.18 * f, None))
        status("Finding your best face frames", 0.18, "")
        faces = face_candidates(video, work) if info["width"] else []
        log(f"{len(faces)} face frame(s) found")
        base = autoplan(load(os.path.join(work, "transcript.json")), video, job.get("title"), zoom=job.get("zoom", "auto"),
                        **({"width": 1080, "height": 1920} if job.get("vertical") else {}))
        save(os.path.join(work, "base_plan.json"), base)
        log(f"Silence and filler cuts: {base['stats']['source_seconds']} s -> {base['stats']['kept_seconds']} s")
        status("Watching the video and planning the edit", 0.22, "")
        bp = brain.plan_edit(video, work, images, job.get("notes", ""), job.get("title", ""), faces, log=log)
    save(os.path.join(work, "brain_plan.json"), bp)
    log("Edit plan: " + bp.get("summary", ""))
    plan = apply_brain(base, bp, by_name, info["duration"])

    status("Placing every pointer and zoom exactly", 0.3, "")
    plan = brain.place(video, work, plan | {"inserts": _graphics_for_brain(plan)["inserts"]}, by_name, log=log) \
        if plan.get("pointers") or plan.get("zooms") else plan
    plan = apply_graphics(plan, _graphics_for_brain(plan), by_name, info["duration"])
    save(os.path.join(work, "plan.json"), plan)

    if job.get("review", True):
        status("Rendering a preview", 0.34, "")
        prev = render(plan, work, os.path.join(work, "preview.mp4"), preview=True,
                      progress=lambda f: status("Rendering a preview", 0.34 + 0.16 * f, None))
        status("Reviewing the preview", 0.5, "")
        rv = brain.review(prev, work, plan | _graphics_for_brain(plan), TimeMap(plan["keep"]), log=log)
        for issue in rv.get("issues", [])[:12]:
            log("Fixed: " + issue)
        plan = apply_graphics(plan, rv, by_name, info["duration"])
        save(os.path.join(work, "plan.json"), plan)

    status("Rendering the final video", 0.55, "")
    final = render(plan, work, os.path.join(out, "final.mp4"), progress=lambda f: status("Rendering the final video", 0.55 + 0.38 * f, None))
    shutil.copy(os.path.join(work, "chapters.txt"), os.path.join(out, "chapters.txt"))

    status("Making thumbnails", 0.94, "")
    th = bp.get("thumbnail", {})
    fi = th.get("face_index", 0)
    face = cutout(faces[fi], work) if faces and 0 <= fi < len(faces) else None
    bg = by_name.get(th.get("background_image", ""))
    make(os.path.join(out, "thumbnail_A.png"), th.get("line1", "").upper(), th.get("line2", "").upper(), th.get("big", ""), face, bg)
    make(os.path.join(out, "thumbnail_B.png"), th.get("line2", "").upper(), th.get("line1", "").upper(), th.get("big", ""), face, None,
         c1="green", c2="red")
    youtube_pack(bp, work, os.path.join(out, "youtube_pack.md"))
    status("Done", 1.0, f"Final video: {fmt_ts(probe(final)['duration'])} long")
    return out
