// gitbook.mjs — the launch's book: an in-depth, multi-page documentation like the best GitBook docs sites.
//   makeBook   Claude writes the pages (structured output) from the site config; without a key, the pages are built
//              from the config itself, so every launch has a book.
//   bookHtml   the same book as the site's docs page (docs.html): sidebar, pages, no scripts.
//   bookZip    the pages as GitBook-ready Markdown (README.md + SUMMARY.md + one file per page), zipped.
//   publish    GitBook's API (api.gitbook.com, a personal access token = GITBOOK_TOKEN): create a space, import the
//              pages, then try to publish it as a docs site. What GitBook refuses is reported, with the manual step.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { docSections } from "./docs.mjs";

const MODEL = "claude-opus-5-5";
const clean = (t, n = 400) => String(t || "").replace(/[ \t]+/g, " ").trim().slice(0, n);
const BANNED = /\b(donat\w*|charit\w*|partner(ed|ship|s)?|guarantee\w*|risk[- ]free|100x|1000x|to the moon|passive income|profit\w*|dividend\w*|revenue share|airdrop\w*|staking|yield|apy|pump\.fun)\b/i;
const dropClaims = md => md.split("\n").map(line => /^\s*([-*]|\d+\.|#|\|)/.test(line) ? (BANNED.test(line) && !/^\s*#/.test(line) ? "" : line)
  : line.split(/(?<=[.!?])\s+/).filter(s => !BANNED.test(s)).join(" ")).join("\n").replace(/\n{3,}/g, "\n\n");

const Book = z.object({ pages: z.array(z.object({ title: z.string(), slug: z.string(), markdown: z.string() })) });
const SYSTEM = `You write the documentation site ("the docs", GitBook style) for a coin and its product, from its site config.
Think of the best memecoin docs: a warm introduction, a getting-started page, a deep page on the product (the game, the
tool, the launchpad, or all three), how to play / use it step by step, holder perks, tokenomics with "where the money
goes", the roadmap, the brand kit, a FAQ, and an "official links" page. 8-11 pages, each 150-450 words of Markdown
(headings ##, lists, bold, short tables where they help). Slugs: lowercase-with-dashes.

Rules you never break:
- Everything comes from the config. Never invent features, numbers, partners, listings, dates or team members. Where
  the config has no detail, write the general, true version (how holder perks unlock on the site, what the roadmap
  phases mean) instead of making things up.
- Confident and clear; no disclaimers, no "just a memecoin", no risk talk, no price talk, no promises of returns,
  airdrops, staking, revenue share or charity. Never name the launch platform: "launched on Solana", "the launch".
- The contract address appears only where the config has one; otherwise "announced at launch, on the site and the
  pinned post only" with a note to trust only those.
- Tokenomics page: supply 1,000,000,000, 0% tax, the dev's launch buy is public on-chain, then the "where the money
  goes" split from the config as a table (share, bucket, what it pays for) and the dev buy policy.`;

export function rulesBook(cfg) {
  const secs = docSections(cfg);
  const md = s => [(s.body || []).join("\n\n"), (s.list || []).map(l => `- ${l}`).join("\n"), (s.steps || []).map((t, i) => `${i + 1}. ${t}`).join("\n"),
    s.table?.length ? ["| Share | Bucket | What it pays for |", "|---|---|---|", ...s.table.map(r => `| ${r[0]} | ${r[1]} | ${r[2]} |`)].join("\n") : "",
    (s.groups || []).map(g => `### ${g.title}\n` + g.items.map(i => `- ${i}`).join("\n")).join("\n\n"),
    (s.qa || []).map(f => `**${f.q}**\n\n${f.a}`).join("\n\n")].filter(Boolean).join("\n\n");
  const pages = secs.map(s => ({ title: s.title, slug: s.id, markdown: md(s) }));
  pages.push({ title: "Official links", slug: "official-links", markdown: [
    `Only trust links on this page, on the site and in the pinned post.`, "",
    `- Site: ${/^https?:/.test(cfg.siteUrl || "") ? cfg.siteUrl : "see the pinned post"}`, cfg.coin?.x ? `- X: ${cfg.coin.x}` : "", cfg.coin?.telegram ? `- Telegram: ${cfg.coin.telegram}` : "",
    `- Contract address: ${cfg.coin?.ca || "announced at launch, on the site and the pinned post only"}`].filter(Boolean).join("\n") });
  return pages;
}

export async function makeBook(cfg, { client = null } = {}) {
  let pages = null, source = "rules", note = null;
  if (client || process.env.ANTHROPIC_API_KEY) {
    try {
      const c = client || new Anthropic();
      const r = await c.messages.parse({ model: MODEL, max_tokens: 32000, output_config: { effort: "high", format: zodOutputFormat(Book) }, system: SYSTEM,
        messages: [{ role: "user", content: "The site config:\n" + JSON.stringify({ brand: cfg.brand, ticker: cfg.coin?.ticker, emoji: cfg.emoji, tagline: cfg.tagline, about: cfg.about,
          lore: cfg.lore, how: cfg.how, product: cfg.product, roadmap: cfg.roadmap, faq: cfg.faq, tokenomics: cfg.tokenomics, coin: { ca: cfg.coin?.ca, x: cfg.coin?.x, telegram: cfg.coin?.telegram, launchedOn: cfg.coin?.launchedOn },
          site: cfg.siteUrl, colors: cfg.colors, display: cfg.display, vibe: cfg.vibe }, null, 1).slice(0, 12000) + "\n\nWrite the docs." }] });
      if (r.stop_reason === "refusal") note = "The model declined; the plain book was used.";
      else if (r.parsed_output) { pages = r.parsed_output.pages; source = "claude"; }
    } catch (e) { note = e instanceof Anthropic.APIError ? `Claude answered ${e.status}; the plain book was used.` : "Claude could not be reached; the plain book was used."; }
  }
  const out = (pages || rulesBook(cfg)).map(p => ({ title: clean(p.title, 60), slug: String(p.slug || p.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "page",
                                                   markdown: dropClaims(String(p.markdown || "")).trim().slice(0, 6000) })).filter(p => p.title && p.markdown).slice(0, 14);
  const seen = new Set(); for (const p of out) { while (seen.has(p.slug)) p.slug += "-2"; seen.add(p.slug); }
  return { pages: out.length ? out : rulesBook(cfg), source, note };
}

// ---- Markdown -> HTML (the subset the book uses), with everything escaped first
const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`(.+?)`/g, "<code>$1</code>").replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
export function mdToHtml(md) {
  const out = []; const lines = String(md || "").split("\n"); let i = 0;
  const flush = (buf, tag) => { if (buf.length) out.push(`<${tag}>${buf.map(x => `<li>${inline(x)}</li>`).join("")}</${tag}>`); };
  while (i < lines.length) {
    const l = lines[i];
    if (/^#{1,6}\s/.test(l)) { const n = Math.min(4, l.match(/^#+/)[0].length + 1); out.push(`<h${n}>${inline(l.replace(/^#+\s*/, ""))}</h${n}>`); i++; continue; }
    if (/^\s*[-*]\s/.test(l)) { const b = []; while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) b.push(lines[i++].replace(/^\s*[-*]\s/, "")); flush(b, "ul"); continue; }
    if (/^\s*\d+\.\s/.test(l)) { const b = []; while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) b.push(lines[i++].replace(/^\s*\d+\.\s/, "")); flush(b, "ol"); continue; }
    if (/^\s*\|/.test(l)) { const rows = []; while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = r => r.replace(/^\s*\||\|\s*$/g, "").split("|").map(c => c.trim());
      const body = rows.filter(r => !/^\s*\|?\s*:?-{2,}/.test(r));
      if (body.length) out.push(`<table><tr>${cells(body[0]).map(c => `<th>${inline(c)}</th>`).join("")}</tr>${body.slice(1).map(r => `<tr>${cells(r).map(c => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</table>`);
      continue; }
    if (/^\s*>\s?/.test(l)) { out.push(`<blockquote>${inline(l.replace(/^\s*>\s?/, ""))}</blockquote>`); i++; continue; }
    if (!l.trim()) { i++; continue; }
    const p = []; while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*[-*]\s|\s*\d+\.\s|\s*\||\s*>)/.test(lines[i])) p.push(lines[i++]);
    out.push(`<p>${inline(p.join(" "))}</p>`);
  }
  return out.join("\n");
}

export function bookHtml(cfg, pages) {
  const acc = cfg.colors?.accent || "#ff6a2b", ink = cfg.colors?.dark || "#140f22", light = cfg.colors?.light || "#fff8f1", disp = esc(cfg.display || "Bagel Fat One");
  const nav = pages.map((p, i) => `<a href="#${esc(p.slug)}" data-i="${i}">${esc(p.title)}</a>`).join("");
  const body = pages.map(p => `<article id="${esc(p.slug)}"><h1>${esc(p.title)}</h1>${mdToHtml(p.markdown)}</article>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(cfg.brand)} docs</title><meta name="description" content="${esc(cfg.tagline)}">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(cfg.display || "Bagel Fat One").replace(/%20/g, "+")}&family=Figtree:wght@400;600;800&display=swap">
<style>
:root{--acc:${acc};--ink:${ink};--bg:${light};--muted:#6b5f7d;--card:#fff;--line:#e4dbd0}
@media (prefers-color-scheme: dark){:root:not([data-theme=light]){--ink:#fbefe4;--bg:${cfg.colors?.dark || "#150f24"};--card:#211936;--line:#3a2f55;--muted:#b3a6c6}}
:root[data-theme=dark]{--ink:#fbefe4;--bg:${cfg.colors?.dark || "#150f24"};--card:#211936;--line:#3a2f55;--muted:#b3a6c6}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:400 16px/1.65 Figtree,system-ui,sans-serif}
.top{display:flex;gap:12px;align-items:center;padding:14px 20px;border-bottom:1px solid var(--line);background:var(--card);position:sticky;top:0;z-index:2}
.top b{font:400 24px/1 "${disp}",sans-serif}.top a{margin-left:auto;color:var(--acc);font-weight:800;text-decoration:none}
.wrap{display:grid;grid-template-columns:260px minmax(0,1fr);max-width:1180px;margin:0 auto}
nav{position:sticky;top:60px;align-self:start;padding:20px 16px;display:grid;gap:4px;border-right:1px solid var(--line);height:calc(100vh - 60px);overflow:auto;align-content:start}
nav a{color:var(--muted);text-decoration:none;font-weight:600;padding:7px 10px;border-radius:8px}nav a:hover{background:var(--card);color:var(--ink)}
nav a:target,nav a.on{background:color-mix(in srgb,var(--acc) 18%,transparent);color:var(--ink)}
main{padding:28px 32px 80px;display:grid;gap:56px}article{scroll-margin-top:72px;max-width:72ch}
h1{font:400 38px/1.1 "${disp}",sans-serif;margin:0 0 14px}h2{font:800 22px/1.2 Figtree,sans-serif;margin:26px 0 8px}h3{font:800 18px/1.2 Figtree,sans-serif;margin:18px 0 6px}
ul,ol{padding-left:22px}li{margin:4px 0}code{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:1px 6px;font-size:14px}
table{border-collapse:collapse;width:100%;margin:10px 0;font-size:15px}th,td{border:1px solid var(--line);padding:8px 10px;text-align:left}th{background:var(--card)}
blockquote{border-left:4px solid var(--acc);margin:10px 0;padding:4px 14px;color:var(--muted)}a{color:var(--acc)}
@media (max-width:760px){.wrap{grid-template-columns:1fr}nav{position:static;height:auto;border-right:0;border-bottom:1px solid var(--line);grid-template-columns:repeat(auto-fill,minmax(140px,1fr))}main{padding:20px 16px 60px}}
</style></head><body>
<div class="top"><span style="font-size:26px">${esc(cfg.emoji)}</span><b>${esc(cfg.brand)} docs</b><a href="./">← the site</a></div>
<div class="wrap"><nav>${nav}</nav><main>${body}</main></div></body></html>`;
}

// ---- GitBook-ready files: README.md (the first page), SUMMARY.md (the table of contents), one file per page
export function bookFiles(cfg, pages) {
  const files = {};
  files["README.md"] = `# ${cfg.brand} ($${cfg.coin?.ticker})\n\n${cfg.tagline}\n\n${pages[0]?.markdown || ""}`;
  const rest = pages.slice(1);
  files["SUMMARY.md"] = "# Table of contents\n\n* [" + (pages[0]?.title || "Introduction") + "](README.md)\n" + rest.map(p => `* [${p.title}](${p.slug}.md)`).join("\n") + "\n";
  for (const p of rest) files[`${p.slug}.md`] = `# ${p.title}\n\n${p.markdown}\n`;
  files[".gitbook.yaml"] = "root: ./\n\nstructure:\n  readme: README.md\n  summary: SUMMARY.md\n";
  return files;
}

// a plain ZIP (stored, no compression: Markdown is tiny), so no dependency is needed
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = buf => { let c = 0xFFFFFFFF; for (const b of buf) c = CRC[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
export function zip(files) {
  const parts = [], central = []; let offset = 0;
  const u16 = n => Buffer.from([n & 255, (n >> 8) & 255]), u32 = n => Buffer.from([n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]);
  for (const [name, text] of Object.entries(files)) {
    const nm = Buffer.from(name), data = Buffer.from(text), crc = crc32(data);
    const head = Buffer.concat([u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(nm.length), u16(0), nm]);
    parts.push(head, data);
    central.push(Buffer.concat([u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(nm.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nm]));
    offset += head.length + data.length;
  }
  const cd = Buffer.concat(central);
  return Buffer.concat([...parts, cd, u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length), u32(cd.length), u32(offset), u16(0)]);
}

// ---- GitBook's API
const API = "https://api.gitbook.com/v1";
async function gb(fetchImpl, token, method, path, body) {
  const r = await fetchImpl(API + path, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json" },
                                           body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j?.error?.message || j?.message || `GitBook answered ${r.status}`), { status: r.status });
  return j;
}
// publicZipUrl: a public, unguessable URL where GitBook can fetch the pages (the Studio serves it)
export async function publishGitBook(cfg, pages, { token = process.env.GITBOOK_TOKEN, org = process.env.GITBOOK_ORG_ID, fetchImpl = fetch, publicZipUrl, publicMdUrl } = {}) {
  if (!token) throw Object.assign(new Error("Set GITBOOK_TOKEN on the server (GitBook → your account → Developer settings → personal access token)."), { status: 400 });
  const steps = [];
  let orgId = org;
  if (!orgId) {
    const orgs = await gb(fetchImpl, token, "GET", "/orgs");
    orgId = (orgs.items || [])[0]?.id;
    if (!orgId) throw Object.assign(new Error("Your GitBook token has no organization. Create one on gitbook.com first."), { status: 400 });
  }
  const title = `${cfg.brand} docs`;
  const space = await gb(fetchImpl, token, "POST", `/orgs/${orgId}/spaces`, { title, emoji: [...String(cfg.emoji || "")][0] || undefined });
  steps.push(`Space "${title}" created`);
  let imported = false;
  for (const [url, source] of [[publicZipUrl, "zip"], [publicMdUrl, "markdown"]]) {
    if (!url || imported) continue;
    try { await gb(fetchImpl, token, "POST", `/spaces/${space.id}/content/import`, { url, source }); imported = true; steps.push(`Pages imported (${source})`); }
    catch (e) { steps.push(`Import as ${source} refused: ${e.message}`); }
  }
  let site = null;
  try {
    site = await gb(fetchImpl, token, "POST", `/orgs/${orgId}/sites`, { title, spaceId: space.id });
    steps.push("Docs site created");
    try { await gb(fetchImpl, token, "POST", `/orgs/${orgId}/sites/${site.id}/publish`, {}); steps.push("Published"); }
    catch (e) { steps.push(`Publishing refused: ${e.message}. In GitBook, open the site and press Publish.`); }
  } catch (e) { steps.push(`Site not created: ${e.message}. In GitBook, open the space → Publish → Create docs site (one minute).`); }
  return { spaceId: space.id, editUrl: space.urls?.app || `https://app.gitbook.com/s/${space.id}`, publishedUrl: site?.urls?.published || space.urls?.published || null,
           imported, steps };
}
