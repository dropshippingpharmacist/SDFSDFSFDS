// node dev.mjs — runs the launchpad locally: serves the page and routes /api/* to the same handlers Vercel runs.
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
                ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };
const API = { metadata: "./api/metadata.js", create: "./api/create.js", send: "./api/send.js" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const api = /^\/api\/(\w+)$/.exec(url.pathname);
  if (api && API[api[1]]) {
    let raw = "";
    for await (const c of req) { raw += c; if (raw.length > 6e6) break; }
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
    const shim = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(o) { res.writeHead(this.statusCode, { "content-type": "application/json" }); res.end(JSON.stringify(o)); return this; },
    };
    const mod = await import(API[api[1]]);
    return mod.default(req, shim);
  }
  const rel = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\/+/, "");
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || rel.startsWith("api/")) { res.writeHead(404); return res.end("not found"); }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("not found"); }
}).listen(PORT, () => console.log(`launchpad on http://localhost:${PORT}`));
