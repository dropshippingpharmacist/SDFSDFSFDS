// server.mjs — Route: the coin site (/), the app (/app), the launchpad (/launch) and the app's API (/api/*).
// One Node 22 process, built-in SQLite on DATA_DIR (a Railway volume). No dependencies.
//   PORT (8080)  DATA_DIR (./data, or the Railway volume)  NOMINATIM_URL (OpenStreetMap place search)
//   RPC_URL / PUMPPORTAL_TRADE_LOCAL / PUMP_IPFS_URL  the launchpad's settings (see launchpad/README.md)
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDb, makeApi, err } from "./db.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, "public");
const LAUNCH = path.join(HERE, "..", "launchpad");
const DATA = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(HERE, "data");
const NOMINATIM = (process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org").replace(/\/$/, "");
const COOKIE = "route_s";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript",
                ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
                ".json": "application/json", ".ico": "image/x-icon", ".webp": "image/webp" };

export function createServer({ dbFile = path.join(DATA, "route.sqlite"), now } = {}) {
  const db = openDb(dbFile);
  const api = makeApi(db, now);
  const hits = new Map();                         // ip:bucket -> [times]
  const limited = (key, n, ms) => {
    const t = Date.now(), arr = (hits.get(key) || []).filter(x => t - x < ms);
    arr.push(t); hits.set(key, arr);
    if (hits.size > 5000) hits.clear();
    return arr.length > n;
  };
  const geoCache = new Map();
  let lastGeo = 0;

  async function body(req) {
    let raw = "";
    for await (const c of req) { raw += c; if (raw.length > 6e6) throw err(413, "Too much data."); }
    if (!raw) return {};
    try { return JSON.parse(raw); } catch { throw err(400, "Send JSON."); }
  }
  const cookies = req => Object.fromEntries(String(req.headers.cookie || "").split(/;\s*/).filter(Boolean)
    .map(c => { const i = c.indexOf("="); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));
  const secure = req => req.headers["x-forwarded-proto"] === "https";
  const setSession = (req, res, token, maxAge) => res.setHeader("Set-Cookie",
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure(req) ? "; Secure" : ""}`);
  const send = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" }); res.end(JSON.stringify(obj)); };
  const ip = req => String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  const id = v => { const n = Number(v); if (!Number.isInteger(n) || n <= 0) throw err(400, "Bad id."); return n; };

  async function handleApi(req, res, p) {
    // every change must come from our own pages: JSON + a custom header a cross-site form cannot send
    if (req.method === "POST" && req.headers["x-route"] !== "1") throw err(403, "Missing the app header.");
    const READS = new Set(["/api/me", "/api/friends", "/api/feed", "/api/score", "/api/geocode"]);
    if (req.method !== "POST" && !READS.has(p)) throw err(405, "Use POST.");   // nothing changes on a GET
    const token = cookies(req)[COOKIE];
    const user = api.userBySession(token);
    const b = req.method === "POST" ? await body(req) : {};

    if (p === "/api/signup" || p === "/api/login") {
      if (limited(ip(req) + ":auth", 10, 15 * 6e4)) throw err(429, "Too many tries. Wait 15 minutes.");
      const uid = p === "/api/signup" ? api.signup(b.username, b.password, b.display) : api.login(b.username, b.password);
      setSession(req, res, api.newSession(uid), 30 * 86400);
      return send(res, 200, { ok: true });
    }
    if (p === "/api/logout") { api.endSession(token); setSession(req, res, "", 0); return send(res, 200, { ok: true }); }
    if (!user) throw err(401, "Sign in first.");
    const me = user.id;
    switch (p) {
      case "/api/me": return send(res, 200, { id: me, username: user.username, display: user.display, ghost: !!user.ghost });
      case "/api/ghost": api.setGhost(me, !!b.on); return send(res, 200, { ghost: !!b.on });
      case "/api/friends": return send(res, 200, api.friends(me));
      case "/api/friends/request":
        if (limited(me + ":req", 30, 36e5)) throw err(429, "That's a lot of requests. Try again later.");
        return send(res, 200, { result: api.request(me, String(b.username || "").trim()) });
      case "/api/friends/respond": api.respond(me, id(b.userId), !!b.accept); return send(res, 200, { ok: true });
      case "/api/friends/remove": api.unfriend(me, id(b.userId)); return send(res, 200, { ok: true });
      case "/api/block": api.block(me, id(b.userId)); return send(res, 200, { ok: true });
      case "/api/routes": return send(res, 200, { id: api.shareRoute(me, b) });
      case "/api/routes/end": api.endRoute(me, id(b.id)); return send(res, 200, { ok: true });
      case "/api/here": api.shareHere(me, b); return send(res, 200, { ok: true });
      case "/api/here/clear": api.clearHere(me); return send(res, 200, { ok: true });
      case "/api/feed": return send(res, 200, api.feed(me));
      case "/api/pullup": return send(res, 200, { id: api.pullUp(me, id(b.toId), b.routeId ? id(b.routeId) : null, b.message) });
      case "/api/pullup/respond": api.answerPullUp(me, id(b.id), b.answer); return send(res, 200, { ok: true });
      case "/api/linkup": return send(res, 200, { result: api.linkUp(me, id(b.pullupId)) });
      case "/api/score": return send(res, 200, { me: api.score(me), board: api.leaderboard(me) });
      case "/api/geocode": {
        const query = String(new URL(req.url, "http://x").searchParams.get("q") || "").trim().slice(0, 120);
        if (query.length < 3) return send(res, 200, { places: [] });
        if (geoCache.has(query)) return send(res, 200, { places: geoCache.get(query) });
        if (limited(me + ":geo", 20, 6e4)) throw err(429, "Searching too fast. Wait a moment.");
        // OpenStreetMap's usage policy: at most one request a second from the whole app, with an identifying agent
        const wait = 1000 - (Date.now() - lastGeo);
        if (wait > 0) await new Promise(r => setTimeout(r, wait));
        lastGeo = Date.now();
        const u = `${NOMINATIM}/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`;
        const r = await fetch(u, { headers: { "user-agent": "Route/1.0 (friends' meetup app)", "accept-language": "en" },
                                   signal: AbortSignal.timeout(8000) });
        if (!r.ok) throw err(502, "Place search is busy. Try again in a moment.");
        const places = (await r.json()).map(x => ({ name: x.display_name, lat: Number(x.lat), lon: Number(x.lon) }))
          .filter(x => Number.isFinite(x.lat) && Number.isFinite(x.lon));
        geoCache.set(query, places);
        if (geoCache.size > 2000) geoCache.clear();
        return send(res, 200, { places });
      }
    }
    throw err(404, "No such endpoint.");
  }

  async function launchApi(req, res, name) {
    const mod = await import(path.join(LAUNCH, "api", name + ".js"));
    req.body = await body(req);
    const shim = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(o) { send(res, this.statusCode, o); return this; } };
    return mod.default(req, shim);
  }

  async function serveFile(res, file, root) {
    if (!path.resolve(file).startsWith(path.resolve(root))) { res.writeHead(404); return res.end("not found"); }
    try {
      const data = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    } catch { res.writeHead(404, { "content-type": "text/plain" }); res.end("not found"); }
  }

  const server = http.createServer(async (req, res) => {
    const p = new URL(req.url, "http://x").pathname;
    try {
      res.setHeader("x-content-type-options", "nosniff");
      res.setHeader("referrer-policy", "same-origin");
      if (p.startsWith("/api/")) return await handleApi(req, res, p);
      const la = /^\/launch\/api\/(metadata|create|send)$/.exec(p);
      if (la) return await launchApi(req, res, la[1]);
      if (p === "/launch") { res.writeHead(301, { location: "/launch/" }); return res.end(); }
      if (p.startsWith("/launch/")) {
        const rel = p.slice("/launch/".length) || "index.html";
        if (rel.startsWith("api/") || rel === "dev.mjs" || rel === "package.json") { res.writeHead(404); return res.end(); }
        return await serveFile(res, path.join(LAUNCH, rel), LAUNCH);
      }
      if (p === "/app") return await serveFile(res, path.join(PUBLIC, "app.html"), PUBLIC);
      if (p === "/health") return send(res, 200, { ok: true });
      return await serveFile(res, path.join(PUBLIC, p === "/" ? "index.html" : p.slice(1)), PUBLIC);
    } catch (e) {
      if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : "Something broke on our side." });
      if (!e.status) console.error("[route]", e);
    }
  });
  return { server, api, db };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8080);
  createServer().server.listen(port, () => console.log(`[route] on :${port} · data ${DATA}`));
}
