// docs.mjs — the coin's documentation: a GitBook-style page shipped with the site (docs.html) and the same content as
// Markdown (docs.md) for pasting into GitBook, Notion or a README. Everything comes from the site config: nothing is
// written here that the site does not already say.
const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const kindName = k => ({ game: "the game", utility: "the tool", combo: "the three-in-one (game, tool and launchpad)", launchpad: "the launchpad" }[k] || "the product");

export function docSections(cfg) {
  const tk = "$" + (cfg.coin?.ticker || "COIN"), pr = cfg.product || {}, tn = cfg.tokenomics || {}, coin = cfg.coin || {};
  const live = /^https?:/.test(cfg.siteUrl || "") ? cfg.siteUrl : "";
  const S = [];
  S.push({ id: "overview", title: "Overview", body: [cfg.tagline, cfg.about].filter(Boolean), list: [
    `Coin: ${cfg.brand} (${tk})`, coin.ca ? `Contract address: ${coin.ca}` : "Contract address: announced at launch, on the site and the pinned post on X",
    live ? `Site: ${live}` : "", coin.x ? `X: ${coin.x}` : "", coin.telegram ? `Telegram: ${coin.telegram}` : ""].filter(Boolean) });
  if (cfg.lore?.length) S.push({ id: "lore", title: "The lore", body: cfg.lore });
  if (pr.kind && pr.kind !== "launchpad" || pr.mechanic) S.push({ id: "product", title: pr.name || kindName(pr.kind), body: [pr.mechanic].filter(Boolean),
    list: [pr.holderPerk ? `Holder perk: ${pr.holderPerk} (unlocked on the site by connecting a wallet that holds ${tk})` : "", pr.app ? "Runs in the browser on the site; nothing to install." : ""].filter(Boolean) });
  if (cfg.how?.length) S.push({ id: "how", title: `How ${cfg.brand} works`, steps: cfg.how.map(h => `${h.title}: ${h.text}`) });
  S.push({ id: "tokenomics", title: "Tokenomics", list: [
    "Total supply: 1,000,000,000", `Launched on: ${coin.launchedOn || (cfg.launchDesk === false ? "Solana, bonding-curve launch" : "pump.fun, bonding curve")}`,
    "Tax: 0% buy, 0% sell", coin.devBuyPercent != null ? `Dev launch buy: ${coin.devBuyPercent}% of supply, public on-chain` : "Dev launch buy: public on-chain",
    tn.devBuyPolicy ? `Dev buy policy: ${tn.devBuyPolicy}` : ""].filter(Boolean),
    body: tn.allocation?.length ? [`Where the money goes. ${tn.source || "Creator fees"} are split like this:`] : [],
    table: (tn.allocation || []).map(a => [`${a.pct}%`, a.name, a.what]) });
  if (cfg.roadmap?.length) S.push({ id: "roadmap", title: "Roadmap", groups: cfg.roadmap.map(ph => ({ title: ph.title || ph.status, items: ph.items })) });
  if (cfg.faq?.length) S.push({ id: "faq", title: "FAQ", qa: cfg.faq });
  return S;
}

export function docsMarkdown(cfg) {
  const out = [`# ${cfg.brand} ($${cfg.coin?.ticker}) docs`, ""];
  for (const s of docSections(cfg)) {
    out.push(`## ${s.title}`, "");
    for (const p of s.body || []) out.push(p, "");
    for (const l of s.list || []) out.push(`- ${l}`);
    if (s.list?.length) out.push("");
    (s.steps || []).forEach((t, i) => out.push(`${i + 1}. ${t}`)); if (s.steps?.length) out.push("");
    if (s.table?.length) { out.push("| Share | Bucket | What it pays for |", "|---|---|---|"); for (const r of s.table) out.push(`| ${r[0]} | ${r[1]} | ${r[2]} |`); out.push(""); }
    for (const g of s.groups || []) { out.push(`### ${g.title}`, ""); for (const i of g.items) out.push(`- ${i}`); out.push(""); }
    for (const f of s.qa || []) out.push(`**${f.q}**`, "", f.a, "");
  }
  return out.join("\n");
}

export function docsHtml(cfg) {
  const acc = cfg.colors?.accent || "#ff6a2b", ink = cfg.colors?.dark || "#140f22", light = cfg.colors?.light || "#fff8f1";
  const secs = docSections(cfg);
  const nav = secs.map(s => `<a href="#${s.id}">${esc(s.title)}</a>`).join("");
  const body = secs.map(s => `<section id="${s.id}"><h2>${esc(s.title)}</h2>` +
    (s.body || []).map(p => `<p>${esc(p)}</p>`).join("") +
    (s.list?.length ? `<ul>${s.list.map(l => `<li>${esc(l)}</li>`).join("")}</ul>` : "") +
    (s.steps?.length ? `<ol>${s.steps.map(l => `<li>${esc(l)}</li>`).join("")}</ol>` : "") +
    (s.table?.length ? `<div class="bars">${s.table.map(r => `<div class="bar"><span style="width:${Number(r[0].replace("%", "")) || 0}%"></span><b>${esc(r[0])} ${esc(r[1])}</b><small>${esc(r[2])}</small></div>`).join("")}</div>` : "") +
    (s.groups || []).map(g => `<h3>${esc(g.title)}</h3><ul>${g.items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>`).join("") +
    (s.qa || []).map(f => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("") + `</section>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(cfg.brand)} docs</title><meta name="description" content="${esc(cfg.tagline)}">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(cfg.display || "Bagel Fat One").replace(/%20/g, "+")}&family=Figtree:wght@400;600;800&display=swap">
<style>
:root{--acc:${acc};--ink:${ink};--bg:${light};--muted:#6b5f7d;--card:#fff;--line:#e4dbd0}
@media (prefers-color-scheme: dark){:root:not([data-theme=light]){--ink:#fbefe4;--bg:${cfg.colors?.dark || "#150f24"};--card:#211936;--line:#3a2f55;--muted:#b3a6c6}}
:root[data-theme=dark]{--ink:#fbefe4;--bg:${cfg.colors?.dark || "#150f24"};--card:#211936;--line:#3a2f55;--muted:#b3a6c6}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:400 16px/1.6 Figtree,system-ui,sans-serif}
.top{display:flex;gap:12px;align-items:center;padding:14px 20px;border-bottom:1px solid var(--line);background:var(--card);position:sticky;top:0;z-index:2}
.top b{font:400 24px/1 "${esc(cfg.display || "Bagel Fat One")}",sans-serif}.top a{margin-left:auto;color:var(--acc);font-weight:800;text-decoration:none}
.wrap{display:grid;grid-template-columns:240px minmax(0,1fr);max-width:1100px;margin:0 auto}
nav{position:sticky;top:60px;align-self:start;padding:20px 16px;display:grid;gap:6px;border-right:1px solid var(--line);height:calc(100vh - 60px);overflow:auto}
nav a{color:var(--muted);text-decoration:none;font-weight:600;padding:6px 10px;border-radius:8px}nav a:hover{background:var(--card);color:var(--ink)}
main{padding:24px 28px 60px;display:grid;gap:36px}section h2{font:400 32px/1.1 "${esc(cfg.display || "Bagel Fat One")}",sans-serif;margin:0 0 10px}
p{max-width:68ch}ul,ol{padding-left:20px}li{margin:4px 0}details{border:1px solid var(--line);border-radius:10px;padding:8px 12px;margin:6px 0;background:var(--card)}summary{font-weight:700;cursor:pointer}
.bars{display:grid;gap:10px;max-width:640px}.bar{position:relative;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px;overflow:hidden}
.bar span{position:absolute;left:0;top:0;bottom:0;background:color-mix(in srgb,var(--acc) 22%,transparent)}.bar b,.bar small{position:relative;display:block}.bar small{color:var(--muted)}
@media (max-width:760px){.wrap{grid-template-columns:1fr}nav{position:static;height:auto;border-right:0;border-bottom:1px solid var(--line);grid-template-columns:repeat(auto-fill,minmax(130px,1fr))}}
</style></head><body>
<div class="top"><span style="font-size:26px">${esc(cfg.emoji)}</span><b>${esc(cfg.brand)} docs</b><a href="./">← the site</a></div>
<div class="wrap"><nav>${nav}</nav><main>${body}</main></div></body></html>`;
}
