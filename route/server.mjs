// server.mjs — Route: the coin site (/), the app (/app), the launchpad (/launch) and the app's API (/api/*).
// One Node 22 process, built-in SQLite on DATA_DIR (a Railway volume). No dependencies.
//   PORT (8080)  DATA_DIR (./data, or the Railway volume)  NOMINATIM_URL (OpenStreetMap place search)
//   RPC_URL / PUMPPORTAL_TRADE_LOCAL / PUMP_IPFS_URL  the launchpad's settings (see launchpad/README.md)
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { openDb, makeApi, err } from "./db.mjs";
import { generate, honest, rename, tokenomics } from "../studio/generate.mjs";
import { deploy, checkDomain, configJs, slugify } from "../studio/deploy.mjs";
import { trends, coinStats, tickerTaken, registerLiveSource } from "../studio/trends.mjs";
import { makeIdeas, ideaPrompt } from "../studio/ideas.mjs";
import { makeMiniApp, polishMiniApp } from "../studio/miniapp.mjs";
import { createPumpLive } from "../studio/pumplive.mjs";
import { makeTheme, rulesLayout } from "../studio/theme.mjs";
import { planContent, makeVisual, templateImage, templateVideo, SIZES, VIDEOS, HOW_TO_POST } from "../studio/content.mjs";
import { renderImage, renderVideo, renderStatus, saveHtml } from "../studio/render.mjs";
import { docsMarkdown } from "../studio/docs.mjs";
import { makeBook, rulesBook, bookHtml, bookFiles, zip, publishGitBook } from "../studio/gitbook.mjs";
import { mkdir, writeFile, readFile as readFileP } from "node:fs/promises";
import { ensureIntel, record, xPosts, xProvider, recordX, playbook, intelText } from "../studio/intel.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, "public");
const LAUNCH = path.join(HERE, "..", "launchpad");
const DATA = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(HERE, "data");
const NOMINATIM = (process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org").replace(/\/$/, "");
const COOKIE = "route_s";
const STUDIO = path.join(HERE, "..", "studio");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript",
                ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
                ".json": "application/json", ".ico": "image/x-icon", ".webp": "image/webp", ".mp4": "video/mp4" };

export function createServer({ dbFile = path.join(DATA, "route.sqlite"), now, background = !process.env.NODE_TEST_CONTEXT } = {}) {
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
  db.exec(`CREATE TABLE IF NOT EXISTS studio_drafts (id INTEGER PRIMARY KEY, idea TEXT NOT NULL, config TEXT NOT NULL,
            meta TEXT NOT NULL, url TEXT, created INTEGER NOT NULL, updated INTEGER NOT NULL)`);
  // the Studio's memory: your rating and note on each site, its game / utility, and how its coin did once launched
  for (const col of ["rating INTEGER NOT NULL DEFAULT 0", "note TEXT", "app TEXT", "stats TEXT", "stats_at INTEGER", "content TEXT", "book TEXT", "pub_token TEXT", "theme TEXT", "app_error TEXT"]) {
    try { db.exec(`ALTER TABLE studio_drafts ADD COLUMN ${col}`); } catch { /* already there */ }
  }
  // the Studio is the owner's tool: one password (STUDIO_PASSWORD), a cookie derived from it
  const studioToken = () => process.env.STUDIO_PASSWORD
    ? crypto.createHmac("sha256", process.env.STUDIO_PASSWORD).update("launchpad-studio").digest("base64url") : null;
  const studioOk = req => { const t = studioToken(); return !!t && cookies(req).studio_s === t; };
  const clean24 = s => String(s || "").replace(/\s+/g, " ").trim().slice(0, 24).replace(/[^\p{L}\p{N} .'-]/gu, "");
  const tick = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
  const draft = id => {
    const r = db.prepare("SELECT * FROM studio_drafts WHERE id = ?").get(Number(id));
    if (!r) throw err(404, "No such draft.");
    return { ...r, config: JSON.parse(r.config), meta: JSON.parse(r.meta), stats: r.stats ? JSON.parse(r.stats) : null, content: r.content ? JSON.parse(r.content) : null,
             book: r.book ? JSON.parse(r.book) : null, theme: r.theme ? JSON.parse(r.theme) : null };
  };
  // the book's pages: Claude's when written, else built from the config on the spot
  const bookOf = d => (d.book?.pages?.length ? d.book.pages : rulesBook({ ...d.config, siteUrl: d.url }));
  const _unused = () => {
  };
  const summary = r => {
    const c = JSON.parse(r.config), m = JSON.parse(r.meta);
    return { id: r.id, brand: c.brand, ticker: c.coin?.ticker, kind: c.product?.kind || "launchpad", idea: r.idea,
             note: r.note || "", rating: r.rating || 0, url: r.url, ca: c.coin?.ca || "", stats: r.stats ? JSON.parse(r.stats) : null,
             app: !!r.app, updated: r.updated, builtin: m.builtin || null, preview: m.builtin === "route" ? "/route" : `/studio/p/${r.id}/` };
  };
  // Route, the site this server already runs at /route, is a draft too: edit its CA and links here, they show up on /route
  const routeDraft = () => db.prepare("SELECT * FROM studio_drafts WHERE json_extract(meta, '$.builtin') = 'route' LIMIT 1").get();
  if (!routeDraft()) {
    const t = Date.now();
    const cfg = {
      brand: "Route", tagline: "See where your friends are headed. Cross paths on purpose.", emoji: "🧭",
      about: "Route is a free app where friends see where each other are heading, pull up, and score points for actually linking up. $ROUTE is its coin, launched on pump.fun from the dev's own wallet.",
      colors: { accent: "#ff5a1f", accentInk: "#ffffff", light: "#fff8f1", dark: "#140f22" }, display: "Unbounded", maxDevBuySol: 5, defaultDevBuySol: 0.1,
      coin: { ticker: "ROUTE", ca: "", x: "", telegram: "", devBuyPercent: null },
      lore: ["Same county. Never see each other. Everyone is always 'heading somewhere' and nobody says where. Route fixes the one thing group chats never did: it shows your friends where you are headed, before you get there.",
             "Share a route, see who is crossing your path, pull up. Every real link-up scores points, streaks and badges. The map is friends-only, rounded to a neighborhood, and everything expires."],
      how: [{ title: "Add your friends", text: "Both sides add each other; nobody else ever sees you." },
            { title: "Share where you're heading", text: "A place and a time window, rounded to about a kilometer." },
            { title: "Cross paths, pull up", text: "Route tells you when a friend is heading near you. One tap to pull up." },
            { title: "Link up, score", text: "Both tap 'We linked up': points, streaks and badges." }],
      roadmap: [{ status: "live", title: "Route, the app", items: ["Friends-only routes and 'I'm around here' pins", "Crossing paths, pull-ups and the link-up game", "The pump.fun launchpad at /launch/"] },
                { status: "next", title: "Building next", items: ["Group routes", "Share cards for X"] }, { status: "idea", title: "Further out", items: ["City leaderboards"] }],
      product: { kind: "game", name: "Route", mechanic: "Share where you're heading, see which friends cross your path, pull up, and both tap 'We linked up' for points, streaks and badges.", holderPerk: "", app: false },
      faq: [{ q: "What is Route?", a: "A free app for friends to see where each other are heading and actually meet. $ROUTE is its memecoin." },
            { q: "Does the app need the coin?", a: "No. Route is free and holding $ROUTE earns nothing in the app." },
            { q: "Is this financial advice?", a: "No. Memecoins can go to zero in minutes. Only spend what you can afford to lose." }],
    };
    db.prepare("INSERT INTO studio_drafts (idea, config, meta, url, created, updated) VALUES (?, ?, ?, ?, ?, ?)")
      .run("Route: an app where friends see where each other are heading, pull up, and score points for linking up. $ROUTE is its coin.",
           JSON.stringify(cfg), JSON.stringify({ builtin: "route", domains: [], tickerBackups: ["ROUTED", "PULLUP", "LINKUP"], source: "you", note: null, removed: [] }), "/route", t, t);
  }
  ensureIntel(db);
  // Launch Intel: keep learning from the feeds and X in the background (every 30 minutes), so the history builds up
  const refreshIntel = async (focus = "", force = true) => {
    const tr = await trends({ force }); record(db, tr.items);
    const xp = await xPosts({ focus, force }); if (xp.posts.length) recordX(db, xp.posts);
    return { trends: tr, x: xp };
  };
  // pump.fun, live: every new coin and graduation from PumpPortal's public stream (pump.fun's own API blocks servers)
  let pumpLive = null;
  if (background) {
    pumpLive = createPumpLive({ log: m => console.error("[pump]", m) });
    pumpLive.connect();
    registerLiveSource("pumpfun live", () => pumpLive.snapshot());
    const tick = () => refreshIntel().catch(e => console.error("[intel]", e.message));
    setTimeout(tick, 5000).unref(); setInterval(tick, 30 * 60 * 1000).unref();
  }
  // the game / tool / three-in-one is built right after the site, in the background; the Studio polls until it is there
  const building = new Map();                         // draft id -> started at
  async function buildApp(id) {
    if (building.has(id)) return;
    building.set(id, Date.now());
    try {
      const d = draft(id), pr = d.config.product || {};
      const out = await makeMiniApp({ name: pr.name, kind: pr.kind === "launchpad" ? "launchpad" : pr.kind, pitch: d.config.tagline,
                                      mechanic: pr.mechanic || d.idea, holderPerk: pr.holderPerk }, d.config);
      if (out.error) { db.prepare("UPDATE studio_drafts SET app_error = ? WHERE id = ?").run(out.error, id); building.delete(id); return; }
      d.config.product = { ...pr, kind: pr.kind === "launchpad" ? "utility" : (pr.kind || "game"), app: true };
      db.prepare("UPDATE studio_drafts SET app = ?, app_error = NULL, config = ?, updated = ? WHERE id = ?").run(out.html, JSON.stringify(d.config), Date.now(), id);
      building.delete(id);
    } catch (e) { db.prepare("UPDATE studio_drafts SET app_error = ? WHERE id = ?").run(e.message, id); building.delete(id); }
  }
  // the look: a layout, the site's own stylesheet and its mascot, designed in the background right after the site
  const styling = new Set();
  async function buildTheme(id) {
    if (styling.has(id)) return;
    styling.add(id);
    try {
      const d = draft(id);
      const th = await makeTheme(d.config);
      d.config.layout = th.layout; d.config.mascot = !!th.svg;
      db.prepare("UPDATE studio_drafts SET theme = ?, config = ?, updated = ? WHERE id = ?").run(JSON.stringify(th), JSON.stringify(d.config), Date.now(), id);
    } catch (e) { console.error("[theme]", e.message); }
    finally { styling.delete(id); }
  }
  const buildState = (id, d) => building.has(id) ? { building: true, since: building.get(id) } : d?.app_error ? { building: false, error: d.app_error } : null;
  const themeState = (id, d) => ({ building: styling.has(id), layout: d?.config?.layout || "classic", mascot: !!d?.config?.mascot, source: d?.theme?.source || null, notes: d?.theme?.notes || "" });
  // what the generators learn from: liked, disliked, and launched (with DexScreener results)
  const memory = () => {
    const rows = db.prepare("SELECT * FROM studio_drafts ORDER BY updated DESC LIMIT 200").all().map(summary);
    return { liked: rows.filter(r => r.rating > 0).slice(0, 15), disliked: rows.filter(r => r.rating < 0).slice(0, 10),
             launched: rows.filter(r => r.ca).slice(0, 15) };
  };
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

  async function handleStudio(req, res, p) {
    if (req.method !== "POST" || req.headers["x-route"] !== "1") throw err(403, "Missing the app header.");
    const b = await body(req);
    if (p === "/api/studio/login") {
      if (limited(ip(req) + ":studio", 10, 15 * 6e4)) throw err(429, "Too many tries. Wait 15 minutes.");
      const t = studioToken();
      if (!t) throw err(503, "Set STUDIO_PASSWORD on the server to turn the Studio on.");
      const a = Buffer.from(String(b.password || "")), w = Buffer.from(process.env.STUDIO_PASSWORD);
      if (a.length !== w.length || !crypto.timingSafeEqual(a, w)) throw err(401, "Wrong password.");
      res.setHeader("Set-Cookie", `studio_s=${t}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 86400}${secure(req) ? "; Secure" : ""}`);
      return send(res, 200, { ok: true });
    }
    if (!studioOk(req)) throw err(401, "Sign in to the Studio first.");
    const t = Date.now();
    switch (p) {
      case "/api/studio/status":
        return send(res, 200, { ai: !!process.env.ANTHROPIC_API_KEY, vercel: !!process.env.VERCEL_TOKEN, dextools: !!process.env.DEXTOOLS_API_KEY, x: xProvider()?.label || null, pump: pumpLive ? pumpLive.status() : null, render: renderStatus(), gitbook: !!process.env.GITBOOK_TOKEN });
      case "/api/studio/book": {
        // Claude writes the launch's docs (8-11 pages); kept with the draft, shipped as docs.html, importable into GitBook
        const d = draft(b.id);
        if (limited("studio:book", 20, 36e5)) throw err(429, "20 books an hour is the limit. Try again later.");
        const out = await makeBook({ ...d.config, siteUrl: d.url });
        const book = { at: t, source: out.source, note: out.note, pages: out.pages };
        db.prepare("UPDATE studio_drafts SET book = ?, updated = ? WHERE id = ?").run(JSON.stringify(book), t, d.id);
        return send(res, 200, { ok: true, source: out.source, note: out.note, pages: out.pages.map(p => ({ title: p.title, slug: p.slug, words: p.markdown.split(/\s+/).length })) });
      }
      case "/api/studio/gitbook": {
        const d = draft(b.id);
        if (!process.env.GITBOOK_TOKEN) throw err(400, "Set GITBOOK_TOKEN on the server (gitbook.com → account → Developer settings → personal access token).");
        if (limited("studio:gitbook", 10, 36e5)) throw err(429, "10 GitBook publishes an hour is the limit.");
        // no book yet: Claude writes it first, so what goes to GitBook is the deep version
        let book = d.book;
        if (!book?.pages?.length) { const w = await makeBook({ ...d.config, siteUrl: d.url }); book = { at: t, source: w.source, note: w.note, pages: w.pages }; }
        const out = await publishGitBook({ ...d.config, siteUrl: d.url }, book.pages, { existing: book.gitbook || null });
        book = { ...book, gitbook: { at: t, ...out } };
        if (out.publishedUrl) d.config.docsUrl = out.publishedUrl;     // the site's GitBook button points at the coin's own book
        db.prepare("UPDATE studio_drafts SET book = ?, config = ?, updated = ? WHERE id = ?").run(JSON.stringify(book), JSON.stringify(d.config), t, d.id);
        return send(res, 200, { ...out, config: d.config });
      }
      case "/api/studio/book/get": {
        const d = draft(b.id);
        return send(res, 200, { book: d.book ? { at: d.book.at, source: d.book.source, note: d.book.note, gitbook: d.book.gitbook || null, pages: d.book.pages.map(p => ({ title: p.title, slug: p.slug, words: p.markdown.split(/\s+/).length })) } : null });
      }
      case "/api/studio/intel": {
        // everything the Studio knows: refresh the feeds and X (cached 10 minutes), then the playbook
        const got = await refreshIntel(String(b.focus || ""), !!b.refresh);
        return send(res, 200, { playbook: playbook(db), sources: got.trends.ok, failed: got.trends.failed,
                                x: { ok: got.x.ok, reason: got.x.reason, posts: got.x.posts.slice(0, 15) } });
      }
      case "/api/studio/ticker": {
        const names = [...new Set((Array.isArray(b.tickers) ? b.tickers : [b.ticker]).map(t => String(t || "").toUpperCase()).filter(Boolean))].slice(0, 6);
        return send(res, 200, { tickers: await Promise.all(names.map(t => tickerTaken(t))) });
      }
      case "/api/studio/launched": {
        // the launchpad page reports the new coin's address back to its draft
        const d = draft(b.id);
        const ca = String(b.ca || "").trim();
        if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ca)) throw err(400, "That is not a Solana address.");
        d.config.coin.ca = ca;
        db.prepare("UPDATE studio_drafts SET config = ?, updated = ? WHERE id = ?").run(JSON.stringify(d.config), t, d.id);
        return send(res, 200, { ok: true, ca });
      }
      case "/api/studio/trends": {
        const tr = await trends({ force: !!b.refresh });
        return send(res, 200, { at: tr.at, ok: tr.ok, failed: tr.failed, items: tr.items.slice(0, 60) });
      }
      case "/api/studio/ideas": {
        if (limited("studio:ideas", 40, 36e5)) throw err(429, "40 idea rounds an hour is the limit. Try again later.");
        const got = await refreshIntel(String(b.focus || ""), !!b.refresh);
        const out = await makeIdeas(got.trends, { mem: memory(), focus: b.focus, mix: b.mix, intel: intelText(playbook(db)), n: Math.min(8, Math.max(3, Number(b.n) || 6)) });
        return send(res, 200, { ...out, prompts: out.ideas.map(ideaPrompt) });
      }
      case "/api/studio/generate": {
        if (limited("studio:gen", 30, 36e5)) throw err(429, "30 sites an hour is the limit. Try again later.");
        const g = await generate(b.idea, { ticker: b.ticker, x: b.x, telegram: b.telegram, accent: b.accent, mem: memory(), intel: intelText(playbook(db)) });
        const meta = { domains: g.domains, tickerBackups: g.tickerBackups, source: g.source, note: g.note, removed: g.removed };
        const r = db.prepare("INSERT INTO studio_drafts (idea, config, meta, created, updated) VALUES (?, ?, ?, ?, ?)")
          .run(g.idea, JSON.stringify(g.config), JSON.stringify(meta), t, t);
        const id = Number(r.lastInsertRowid);
        // the look first (a layout right away, Claude's own stylesheet and mascot in the background), then the product
        g.config.layout = rulesLayout(g.config);
        db.prepare("UPDATE studio_drafts SET config = ? WHERE id = ?").run(JSON.stringify(g.config), id);
        if (process.env.ANTHROPIC_API_KEY && b.auto !== false) buildTheme(id);
        // a game, a tool or a three-in-one: build it now, in the background, so the site is playable without another click
        const auto = !!process.env.ANTHROPIC_API_KEY && g.config.product?.kind !== "launchpad" && b.auto !== false && !limited("studio:app", 20, 36e5);
        if (auto) buildApp(id);
        return send(res, 200, { id, config: g.config, ...meta, preview: `/studio/p/${id}/`, build: auto ? { building: true } : null, theme: themeState(id, draft(id)) });
      }
      case "/api/studio/save": {
        const d = draft(b.id);
        // the owner's edits pass the same honesty filter; tokenomics and the live roadmap stay facts
        // a new brand or ticker flows through every piece of copy first
        const c = rename(b.config || {}, { brand: d.config.brand, ticker: d.config.coin?.ticker }, { brand: clean24(b.config?.brand), ticker: tick(b.config?.coin?.ticker) });
        const re = honest({ brand: c.brand, tagline: c.tagline, about: c.about, emoji: c.emoji, accent: c.colors?.accent,
          display: c.display, ticker: c.coin?.ticker, lore: c.lore, how: c.how,
          next: (c.roadmap || []).find(x => x.status === "next")?.items, ideas: (c.roadmap || []).find(x => x.status === "idea")?.items,
          faq: (c.faq || []).filter(f => !/^Do I need \$|^Is this financial advice/.test(f.q || "")),
          kind: c.product?.kind, product_name: c.product?.name, mechanic: c.product?.mechanic, holder_perk: c.product?.holderPerk }, d.idea,
          { x: c.coin?.x, telegram: c.coin?.telegram, launchDesk: c.launchDesk, buyUrl: c.coin?.buyUrl, launchedOn: c.coin?.launchedOn, docsUrl: c.docsUrl });
        // the owner's own split, when it adds up; otherwise the writer's / the kind's default stays
        const tnIn = c.tokenomics || {};
        re.config.tokenomics = tokenomics({ kind: re.config.product.kind, allocation: tnIn.allocation, fee_source: tnIn.source, dev_buy_policy: tnIn.devBuyPolicy });
        re.config.product.app = !!d.app;
        re.config.layout = d.config.layout; re.config.mascot = !!d.config.mascot;   // the look stays with the draft
        re.config.coin.ca = String(c.coin?.ca || "").trim().replace(/[^1-9A-HJ-NP-Za-km-z]/g, "").slice(0, 44);
        const pct = Number(c.coin?.devBuyPercent);
        re.config.coin.devBuyPercent = c.coin?.devBuyPercent === "" || c.coin?.devBuyPercent == null || !Number.isFinite(pct) ? null : Math.max(0, Math.min(100, pct));
        db.prepare("UPDATE studio_drafts SET config = ?, updated = ? WHERE id = ?").run(JSON.stringify(re.config), t, d.id);
        return send(res, 200, { config: re.config, removed: re.removed });
      }
      case "/api/studio/domains": {
        const names = (Array.isArray(b.domains) ? b.domains : []).slice(0, 8);
        return send(res, 200, { domains: await Promise.all(names.map(n => checkDomain(n))) });
      }
      case "/api/studio/deploy": {
        const d = draft(b.id);
        if (d.meta.builtin === "route") throw err(400, "Route already runs on this server at /route; it deploys with the repo.");
        // the GitBook: written and published on its own the first time the site goes out, so the site ships with the link
        let gitbookNote = null;
        if (process.env.GITBOOK_TOKEN && !d.book?.gitbook?.publishedUrl && !limited("studio:gitbook", 10, 36e5)) {
          try {
            let book = d.book;
            if (!book?.pages?.length) { const w = await makeBook({ ...d.config, siteUrl: d.url }); book = { at: t, source: w.source, note: w.note, pages: w.pages }; }
            const out = await publishGitBook({ ...d.config, siteUrl: d.url }, book.pages, { existing: book.gitbook || null });
            book = { ...book, gitbook: { at: t, ...out } };
            if (out.publishedUrl) d.config.docsUrl = out.publishedUrl;
            db.prepare("UPDATE studio_drafts SET book = ?, config = ? WHERE id = ?").run(JSON.stringify(book), JSON.stringify(d.config), d.id);
            gitbookNote = out.publishedUrl ? `GitBook published: ${out.publishedUrl}` : "GitBook: " + out.steps.join(" · ");
          } catch (e) { gitbookNote = `GitBook skipped: ${e.message}`; }
        }
        const extra = d.app ? { "play.html": d.app } : {};
        extra["docs.html"] = bookHtml({ ...d.config, siteUrl: d.url }, bookOf(d));
        extra["theme.css"] = d.theme?.css || "/* the default look */\n";
        if (d.theme?.svg) extra["mascot.svg"] = d.theme.svg;
        if (d.content?.files?.banner?.png) { try { extra["og.png"] = await readFileP(path.join(DATA, "content", String(d.id), "banner.png")); } catch { /* no preview image */ } }
        const out = await deploy(d.config, b.slug || d.config.brand, { extra });
        db.prepare("UPDATE studio_drafts SET url = ?, updated = ? WHERE id = ?").run(out.url, t, d.id);
        return send(res, 200, { ...out, gitbook: gitbookNote, config: d.config });
      }
      case "/api/studio/list":
        return send(res, 200, { drafts: db.prepare("SELECT * FROM studio_drafts ORDER BY updated DESC LIMIT 50").all().map(summary) });
      case "/api/studio/get": {
        const d = draft(b.id);
        return send(res, 200, { id: d.id, idea: d.idea, config: d.config, url: d.url, rating: d.rating || 0, note: d.note || "",
                                hasApp: !!d.app, stats: d.stats, ...d.meta, preview: d.meta.builtin === "route" ? "/route" : `/studio/p/${d.id}/`, build: buildState(d.id, d), theme: themeState(d.id, d) });
      }
      case "/api/studio/app": {
        // Claude writes the site's game or utility (play.html); it can take a minute or two
        const d = draft(b.id);
        if (building.get(d.id) && typeof building.get(d.id) === "number") throw err(409, "It is already being built. Give it a minute.");
        if (limited("studio:app", 20, 36e5)) throw err(429, "20 apps an hour is the limit. Try again later.");
        const pr = d.config.product || {};
        const out = await makeMiniApp({ name: pr.name, kind: pr.kind === "launchpad" ? "launchpad" : pr.kind, pitch: d.config.tagline,
                                        mechanic: pr.mechanic || d.idea, holderPerk: pr.holderPerk }, d.config);
        if (out.error) throw err(502, out.error);
        d.config.product = { ...pr, kind: pr.kind === "launchpad" ? "utility" : (pr.kind || "game"), app: true };
        db.prepare("UPDATE studio_drafts SET app = ?, config = ?, updated = ? WHERE id = ?").run(out.html, JSON.stringify(d.config), t, d.id);
        return send(res, 200, { ok: true, bytes: Buffer.byteLength(out.html), config: d.config });
      }
      case "/api/studio/restyle": {
        // a new look for the site: another layout, stylesheet and mascot from Claude
        const d = draft(b.id);
        if (styling.has(d.id)) throw err(409, "The look is being designed right now. Give it a minute.");
        if (limited("studio:theme", 30, 36e5)) throw err(429, "30 restyles an hour is the limit.");
        await buildTheme(d.id);
        const d2 = draft(d.id);
        return send(res, 200, { ok: true, config: d2.config, theme: themeState(d2.id, d2) });
      }
      case "/api/studio/polish": {
        // a second pass by Claude over the built game or tool: bugs fixed, juice added
        const d = draft(b.id);
        if (!d.app) throw err(400, "Build the game or tool first.");
        if (limited("studio:app", 20, 36e5)) throw err(429, "20 apps an hour is the limit. Try again later.");
        const pr = d.config.product || {};
        const out = await polishMiniApp(d.app, { name: pr.name, kind: pr.kind }, d.config);
        if (out.error) throw err(502, out.error);
        db.prepare("UPDATE studio_drafts SET app = ?, updated = ? WHERE id = ?").run(out.html, t, d.id);
        return send(res, 200, { ok: true, bytes: Buffer.byteLength(out.html) });
      }
      case "/api/studio/content": {
        // the content kit: plan, then the three pictures, then the three videos; files land on the volume
        const d = draft(b.id);
        if (limited("studio:content", 6, 36e5)) throw err(429, "6 content kits an hour is the limit. Try again later.");
        const dir = path.join(DATA, "content", String(d.id));
        await mkdir(dir, { recursive: true });
        const { plan, source, note } = await planContent(d.config);
        const kit = { at: t, source, note, plan, files: {}, notes: [], howToPost: HOW_TO_POST, render: renderStatus() };
        const put = (k, v) => { kit.files[k] = v; db.prepare("UPDATE studio_drafts SET content = ?, updated = ? WHERE id = ?").run(JSON.stringify(kit), Date.now(), d.id); };
        for (const kind of ["pfp", "banner", "launch"]) {
          const v = await makeVisual(kind, plan.briefs[kind], d.config);
          if (v.note) kit.notes.push(`${kind}: ${v.note}`);
          await saveHtml(path.join(dir, `${kind}.html`), v.html);
          const file = { html: `${kind}.html`, source: v.source, w: SIZES[kind][0], h: SIZES[kind][1] };
          if (kit.render.images) {
            try { await writeFile(path.join(dir, `${kind}.png`), await renderImage(v.html, { width: SIZES[kind][0], height: SIZES[kind][1] })); file.png = `${kind}.png`; }
            catch (e) { kit.notes.push(`${kind}: could not render (${e.message})`); }
          }
          put(kind, file);
        }
        for (const v of plan.videos) {
          const made = await makeVisual("video", "", d.config, { video: v });
          if (made.note) kit.notes.push(`${v.key} video: ${made.note}`);
          await saveHtml(path.join(dir, `${v.key}.html`), made.html);
          const file = { html: `${v.key}.html`, source: made.source, title: v.title, w: SIZES.video[0], h: SIZES.video[1] };
          if (kit.render.videos) {
            try { const r = await renderVideo(made.html, { out: path.join(dir, `${v.key}.mp4`), fps: Number(process.env.VIDEO_FPS) || 30 }); file.mp4 = `${v.key}.mp4`; file.seconds = r.seconds; }
            catch (e) { kit.notes.push(`${v.key} video: could not render (${e.message})`); }
          }
          put(v.key, file);
        }
        if (!kit.render.images) kit.notes.push("No browser on the server: the pictures and videos are HTML pages. Open each one and screenshot or screen-record it, or add chromium and ffmpeg to the build (see the README).");
        return send(res, 200, { ok: true, content: kit });
      }
      case "/api/studio/content/get": {
        const d = draft(b.id);
        return send(res, 200, { content: d.content });
      }
      case "/api/studio/rate": {
        const d = draft(b.id);
        const rating = Math.max(-1, Math.min(1, Math.round(Number(b.rating) || 0)));
        db.prepare("UPDATE studio_drafts SET rating = ?, note = ? WHERE id = ?").run(rating, String(b.note || "").trim().slice(0, 300), d.id);
        return send(res, 200, { ok: true, rating });
      }
      case "/api/studio/results": {
        // refresh how launched sites' coins are doing (at most once an hour each)
        const rows = db.prepare("SELECT * FROM studio_drafts ORDER BY updated DESC LIMIT 50").all();
        for (const r of rows) {
          const ca = JSON.parse(r.config).coin?.ca;
          if (!ca || (r.stats_at && t - r.stats_at < 36e5)) continue;
          const st = await coinStats(ca);
          if (st) db.prepare("UPDATE studio_drafts SET stats = ?, stats_at = ? WHERE id = ?").run(JSON.stringify(st), t, r.id);
        }
        return send(res, 200, { drafts: db.prepare("SELECT * FROM studio_drafts ORDER BY updated DESC LIMIT 50").all().map(summary) });
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
      if (p.startsWith("/api/studio/")) return await handleStudio(req, res, p);
      if (p.startsWith("/api/")) return await handleApi(req, res, p);
      // the front door is the Launchpad Maker; Route's own coin site lives at /route
      if (p === "/" || p === "/studio") return await serveFile(res, path.join(STUDIO, "studio.html"), STUDIO);
      if (p === "/route") return await serveFile(res, path.join(PUBLIC, "index.html"), PUBLIC);
      if (p === "/route-config.js") {
        // the Route draft in the Studio is the source of truth for the coin's address and links
        const r = routeDraft(), c = r ? JSON.parse(r.config).coin : {};
        const cfg = { ticker: c.ticker || "ROUTE", ca: c.ca || "", devBuyPercent: c.devBuyPercent ?? null, x: c.x || "", telegram: c.telegram || "", appUrl: "/app", launchUrl: "/launch/" };
        res.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" });
        return res.end("window.ROUTE = " + JSON.stringify(cfg) + ";\n");
      }
      const sc = /^\/studio\/c\/(\d+)\/([a-z]+\.(?:png|mp4|html))$/.exec(p);
      if (sc) {
        if (!studioOk(req)) { res.writeHead(401, { "content-type": "text/plain" }); return res.end("Sign in to the Studio first."); }
        res.setHeader("content-disposition", `inline; filename="${slugify(draft(sc[1]).config.brand)}-${sc[2]}"`);
        return await serveFile(res, path.join(DATA, "content", sc[1], sc[2]), path.join(DATA, "content"));
      }
      const sp = /^\/studio\/p\/(\d+)\/(.*)$/.exec(p);
      if (sp) {
        if (!studioOk(req)) { res.writeHead(401, { "content-type": "text/plain" }); return res.end("Sign in to the Studio first."); }
        const d = draft(sp[1]), rel = sp[2] || "index.html";
        const sa = /^api\/(metadata|create|send)$/.exec(rel);
        if (sa) return await launchApi(req, res, sa[1]);
        if (rel === "config.js") { res.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" }); return res.end(configJs(d.config)); }
        if (rel === "docs.html" || rel === "docs.md" || rel === "docs.zip") {
          const cfgDocs = { ...d.config, siteUrl: d.url }, pages = bookOf(d);
          if (rel === "docs.html") { res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }); return res.end(bookHtml(cfgDocs, pages)); }
          const body = rel === "docs.zip" ? zip(bookFiles(cfgDocs, pages)) : docsMarkdown(cfgDocs);
          res.writeHead(200, { "content-type": rel === "docs.zip" ? "application/zip" : "text/markdown; charset=utf-8", "cache-control": "no-store",
                               "content-disposition": `attachment; filename="${slugify(d.config.brand)}-${rel}"` });
          return res.end(body);
        }
        if (rel === "theme.css") { res.writeHead(200, { "content-type": "text/css; charset=utf-8", "cache-control": "no-store" }); return res.end(d.theme?.css || "/* the default look */\n"); }
        if (rel === "mascot.svg") { if (!d.theme?.svg) { res.writeHead(404); return res.end(); } res.writeHead(200, { "content-type": "image/svg+xml", "cache-control": "no-store", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'" }); return res.end(d.theme.svg); }
        if (rel === "play.html") {
          if (!d.app) { res.writeHead(404); return res.end(); }
          res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store",
            "content-security-policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data: blob:; media-src data: blob:; connect-src 'none'; sandbox allow-scripts" });
          return res.end(d.app);
        }
        if (rel.startsWith("api/") || rel === "dev.mjs" || rel === "package.json") { res.writeHead(404); return res.end(); }
        return await serveFile(res, path.join(LAUNCH, rel), LAUNCH);
      }
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
  server.on("close", () => pumpLive?.stop());
  return { server, api, db, pumpLive };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8080);
  createServer().server.listen(port, () => console.log(`[route] on :${port} · data ${DATA}`));
}
