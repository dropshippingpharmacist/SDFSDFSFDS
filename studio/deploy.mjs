// deploy.mjs — put a generated launchpad online, and check domain names.
//   deploy: Vercel's REST API (POST /v13/deployments, files inline). Needs VERCEL_TOKEN (vercel.com/account/tokens);
//           VERCEL_TEAM_ID when the token belongs to a team. The deployment is the launchpad folder + a new config.js.
//   domains: RDAP, the registries' own public lookup: "registered" = taken, "not found" = free to buy.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TEMPLATE = path.join(HERE, "..", "launchpad");
const SKIP = new Set(["dev.mjs", "README.md", "node_modules"]);

export function configJs(cfg) {
  return "// Written by Launchpad Studio. Edit freely: the site reads everything from here.\n" +
    "window.LAUNCHPAD = " + JSON.stringify(cfg, null, 2) + ";\n";
}

export async function templateFiles(dir = TEMPLATE, rel = "") {
  const out = [];
  for (const e of await readdir(path.join(dir, rel), { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...await templateFiles(dir, r));
    else out.push(r);
  }
  return out.sort();
}

export const slugify = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "launchpad";

const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// what X, Telegram and Discord show when the site's link is posted: crawlers do not run config.js, so it is baked in
export function headTags(cfg, { ogImage = false } = {}) {
  const emoji = [...String(cfg.emoji || "🚀")][0];
  return [`<title>${esc(cfg.brand)} · $${esc(cfg.coin?.ticker)}</title>`,
    `<meta name="description" content="${esc(cfg.tagline)}">`,
    `<meta property="og:title" content="${esc(cfg.brand)} · $${esc(cfg.coin?.ticker)}">`, `<meta property="og:description" content="${esc(cfg.tagline)}">`,
    `<meta property="og:type" content="website">`, `<meta name="twitter:card" content="${ogImage ? "summary_large_image" : "summary"}">`,
    ogImage ? `<meta property="og:image" content="og.png">` : "",
    `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${emoji}</text></svg>`)}">`,
  ].filter(Boolean).join("\n");
}

export async function deploy(cfg, slug, { fetchImpl = fetch, token = process.env.VERCEL_TOKEN, team = process.env.VERCEL_TEAM_ID, extra = {} } = {}) {
  if (!token) throw Object.assign(new Error("Set VERCEL_TOKEN on the server to deploy (vercel.com/account/tokens)."), { status: 400 });
  const files = [];
  for (const f of await templateFiles()) {
    if (f === "config.js") continue;
    let data = await readFile(path.join(TEMPLATE, f));
    if (f === "index.html") data = Buffer.from(data.toString().replace(/<title>[^<]*<\/title>/, headTags(cfg, { ogImage: Buffer.isBuffer(extra["og.png"]) })));
    files.push({ file: f, data: data.toString("base64"), encoding: "base64" });
  }
  // PUBLIC_RPC_URL: an RPC the site may use from the browser for holder checks (a key meant for the public, or none)
  const out = process.env.PUBLIC_RPC_URL ? { ...cfg, rpcUrl: process.env.PUBLIC_RPC_URL } : cfg;
  files.push({ file: "config.js", data: Buffer.from(configJs(out)).toString("base64"), encoding: "base64" });
  for (const [name, text] of Object.entries(extra)) {           // e.g. play.html (the site's game or utility), og.png (the link preview)
    if (/^[a-z0-9-]+\.html$/.test(name) && text) files.push({ file: name, data: Buffer.from(text).toString("base64"), encoding: "base64" });
    if (/^[a-z0-9-]+\.png$/.test(name) && Buffer.isBuffer(text)) files.push({ file: name, data: text.toString("base64"), encoding: "base64" });
    if (/^[a-z0-9-]+\.(css|svg)$/.test(name) && typeof text === "string") files.push({ file: name, data: Buffer.from(text).toString("base64"), encoding: "base64" });
  }
  const body = {
    name: slugify(slug), files, target: "production",
    projectSettings: { framework: null, buildCommand: null, installCommand: null, outputDirectory: null },
  };
  const url = "https://api.vercel.com/v13/deployments" + (team ? `?teamId=${encodeURIComponent(team)}` : "");
  const r = await fetchImpl(url, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
                                   body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = j?.error?.message || `Vercel answered ${r.status}`;
    throw Object.assign(new Error(`Vercel refused the deploy: ${msg}`), { status: 502 });
  }
  const live = (j.alias && j.alias[0]) || `${body.name}.vercel.app`;
  return { id: j.id, url: "https://" + live, previewUrl: j.url ? "https://" + j.url : null, files: files.length };
}

// ---- domains
export async function checkDomain(name, fetchImpl = fetch) {
  const d = String(name || "").toLowerCase().trim();
  if (!/^[a-z0-9-]{1,63}\.[a-z]{2,24}$/.test(d)) return { domain: d, status: "invalid" };
  try {
    const r = await fetchImpl(`https://rdap.org/domain/${d}`, { headers: { accept: "application/rdap+json" },
                                                                 redirect: "follow", signal: AbortSignal.timeout(8000) });
    if (r.status === 404) return { domain: d, status: "available" };
    if (r.ok) return { domain: d, status: "taken" };
    return { domain: d, status: "unknown" };
  } catch { return { domain: d, status: "unknown" }; }
}
