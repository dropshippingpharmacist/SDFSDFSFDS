"""PRNTR Editor web app: upload a raw video (plus any charts), get back a fully edited long-form video, two thumbnails
and a YouTube pack. Password-protected. One job renders at a time; the rest queue.

Env: ANTHROPIC_API_KEY (required), APP_PASSWORD (required), DATA_DIR (default /data, else /tmp/prntr),
     EDITOR_MODEL (default claude-opus-5-5), WHISPER_MODEL (default small.en)."""
import hashlib, hmac, json, os, queue, re, secrets, shutil, threading, time, traceback, uuid
from fastapi import FastAPI, File, Form, Request, UploadFile, HTTPException
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.environ.get("DATA_DIR") or ("/data" if os.path.isdir("/data") and os.access("/data", os.W_OK) else "/tmp/prntr")
JOBS = os.path.join(DATA, "jobs")
os.makedirs(JOBS, exist_ok=True)
PASSWORD = os.environ.get("APP_PASSWORD", "")
SECRET = (os.environ.get("SESSION_SECRET") or hashlib.sha256((PASSWORD + "prntr-editor").encode()).hexdigest()).encode()
VIDEO_EXT = {".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi"}
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp"}

app = FastAPI(title="PRNTR Editor")
app.mount("/static", StaticFiles(directory=os.path.join(HERE, "web")), name="static")
work_q: "queue.Queue[str]" = queue.Queue()


# ---------------- auth ----------------
def _token():
    return hmac.new(SECRET, b"ok", hashlib.sha256).hexdigest()


def _authed(req: Request):
    return PASSWORD and hmac.compare_digest(req.cookies.get("prntr", ""), _token())


def _need(req: Request):
    if not _authed(req):
        raise HTTPException(401, "log in first")


# ---------------- jobs ----------------
def _jpath(jid, *p):
    if not re.fullmatch(r"[a-f0-9]{12}", jid):
        raise HTTPException(404)
    return os.path.join(JOBS, jid, *p)


def _read(jid):
    try:
        with open(_jpath(jid, "job.json")) as f:
            return json.load(f)
    except FileNotFoundError:
        raise HTTPException(404)


def _write(jid, job):
    tmp = _jpath(jid, "job.json.tmp")
    with open(tmp, "w") as f:
        json.dump(job, f)
    os.replace(tmp, _jpath(jid, "job.json"))


_lock = threading.Lock()


def _status(jid):
    def s(stage, frac, msg):
        with _lock:
            job = _read(jid)
            if stage:
                job["stage"] = stage
            if frac is not None:
                job["progress"] = round(frac, 3)
            if msg:
                job.setdefault("log", []).append(time.strftime("%H:%M:%S ") + msg)
            _write(jid, job)
    return s


def _worker():
    from editor import pipeline
    while True:
        jid = work_q.get()
        st = _status(jid)
        try:
            job = _read(jid)
            job["state"] = "running"; job["started"] = time.time(); _write(jid, job)
            pipeline.run({**job, "dir": _jpath(jid)}, st)
            job = _read(jid); job["state"] = "done"; job["revise"] = ""; job["finished"] = time.time(); _write(jid, job)
        except Exception as e:  # keep the worker alive; show the error on the job page
            traceback.print_exc()
            job = _read(jid); job["state"] = "error"; job["error"] = f"{type(e).__name__}: {e}"[:600]; _write(jid, job)
        finally:
            work_q.task_done()


@app.on_event("startup")
def _start():
    for jid in sorted(os.listdir(JOBS)):   # re-queue anything a restart interrupted
        try:
            j = _read(jid)
            if j.get("state") in ("queued", "running"):
                j["state"] = "queued"; _write(jid, j); work_q.put(jid)
        except Exception:
            pass
    threading.Thread(target=_worker, daemon=True).start()


# ---------------- pages ----------------
def _page(name, **kw):
    html = open(os.path.join(HERE, "web", name)).read()
    for k, v in kw.items():
        html = html.replace("{{" + k + "}}", v)
    return HTMLResponse(html)


@app.get("/", response_class=HTMLResponse)
def home(req: Request):
    if not _authed(req):
        return _page("login.html", error="")
    return _page("index.html")


@app.post("/login")
def login(password: str = Form(...)):
    if not PASSWORD or not hmac.compare_digest(password, PASSWORD):
        return _page("login.html", error="Wrong password.")
    r = RedirectResponse("/", status_code=303)
    r.set_cookie("prntr", _token(), httponly=True, secure=True, samesite="lax", max_age=60 * 60 * 24 * 30)
    return r


@app.get("/job/{jid}", response_class=HTMLResponse)
def job_page(jid: str, req: Request):
    if not _authed(req):
        return RedirectResponse("/")
    _read(jid)
    return _page("job.html", jid=jid)


# ---------------- API ----------------
@app.post("/api/jobs")
async def create(req: Request, video: UploadFile = File(...), images: list[UploadFile] = File(default=[]),
                 title: str = Form(""), notes: str = Form(""), style: str = Form("talking"), vertical: str = Form("")):
    _need(req)
    ext = os.path.splitext(video.filename or "")[1].lower()
    if ext not in VIDEO_EXT:
        raise HTTPException(400, f"Upload a video file ({', '.join(sorted(VIDEO_EXT))}).")
    jid = uuid.uuid4().hex[:12]
    d = _jpath(jid); os.makedirs(os.path.join(d, "inputs"))
    vpath = os.path.join(d, "inputs", "source" + ext)
    with open(vpath, "wb") as f:
        while chunk := await video.read(8 << 20):
            f.write(chunk)
    ipaths = []
    for im in images or []:
        if not im.filename:
            continue
        e = os.path.splitext(im.filename)[1].lower()
        if e not in IMAGE_EXT:
            continue
        safe = re.sub(r"[^A-Za-z0-9._-]+", "_", os.path.basename(im.filename))[:80]
        p = os.path.join(d, "inputs", safe)
        with open(p, "wb") as f:
            f.write(await im.read())
        ipaths.append(p)
    job = {"id": jid, "name": video.filename, "title": title[:120], "notes": notes[:4000], "video": vpath, "images": ipaths,
           "zoom": "off" if style == "screen" else "auto", "vertical": bool(vertical), "review": True,
           "whisper": os.environ.get("WHISPER_MODEL", "small.en"),
           "state": "queued", "stage": "Waiting in line", "progress": 0.0, "log": [], "created": time.time()}
    _write(jid, job)
    work_q.put(jid)
    return {"id": jid}


@app.get("/api/jobs")
def list_jobs(req: Request):
    _need(req)
    out = []
    for jid in os.listdir(JOBS):
        try:
            j = _read(jid)
            out.append({k: j.get(k) for k in ("id", "name", "title", "state", "stage", "progress", "created")})
        except Exception:
            pass
    return sorted(out, key=lambda j: j["created"] or 0, reverse=True)


@app.get("/api/jobs/{jid}")
def get_job(jid: str, req: Request):
    _need(req)
    j = _read(jid)
    out = _jpath(jid, "out")
    j["files"] = sorted(os.listdir(out)) if os.path.isdir(out) else []
    j["pack"] = open(os.path.join(out, "youtube_pack.md")).read() if "youtube_pack.md" in j["files"] else ""
    j["queue_position"] = list(work_q.queue).index(jid) + 1 if jid in work_q.queue else 0
    for k in ("video", "images"):
        j.pop(k, None)
    return j


@app.post("/api/jobs/{jid}/revise")
def revise(jid: str, req: Request, notes: str = Form(...)):
    _need(req)
    j = _read(jid)
    if j["state"] not in ("done", "error") or not os.path.exists(_jpath(jid, "work", "brain_plan.json")):
        raise HTTPException(409, "This video isn't finished yet.")
    j.update(state="queued", stage="Waiting in line", progress=0.0, revise=notes[:4000], error="")
    j.setdefault("log", []).append(time.strftime("%H:%M:%S ") + "Re-edit requested: " + notes[:200])
    _write(jid, j); work_q.put(jid)
    return {"ok": True}


@app.delete("/api/jobs/{jid}")
def delete(jid: str, req: Request):
    _need(req)
    j = _read(jid)
    if j["state"] == "running":
        raise HTTPException(409, "It's rendering right now.")
    shutil.rmtree(_jpath(jid), ignore_errors=True)
    return {"ok": True}


@app.get("/files/{jid}/{name}")
def files(jid: str, name: str, req: Request, dl: int = 0):
    _need(req)
    if name not in ("final.mp4", "thumbnail_A.png", "thumbnail_B.png", "youtube_pack.md", "chapters.txt"):
        raise HTTPException(404)
    p = _jpath(jid, "out", name)
    if not os.path.exists(p):
        raise HTTPException(404)
    return FileResponse(p, filename=f"{jid}_{name}" if dl else None)


@app.get("/healthz")
def health():
    return {"ok": True, "queue": work_q.qsize(), "password_set": bool(PASSWORD),
            "api_key_set": bool(os.environ.get("ANTHROPIC_API_KEY"))}
