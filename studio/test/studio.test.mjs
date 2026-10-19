// node --test studio/test — Launchpad Studio: the writer, the honesty filter, the Vercel payload, domain checks, and
// the Studio's HTTP flow inside the Route server (login, generate, edit, preview, deploy).
import test from "node:test";
import assert from "node:assert/strict";
import { generate, honest, rules } from "../generate.mjs";
import { deploy, checkDomain, configJs, templateFiles } from "../deploy.mjs";

delete process.env.ANTHROPIC_API_KEY;
delete process.env.VERCEL_TOKEN;

const fakeClaude = parsed => ({ messages: { parse: async req => { fakeClaude.last = req; return { stop_reason: "end_turn", parsed_output: parsed }; } } });

test("without a key the plain writer makes a complete, honest site", async () => {
  const g = await generate("a launchpad for cat memes");
  assert.equal(g.source, "rules");
  const c = g.config;
  assert.ok(c.brand && c.tagline && c.about && c.coin.ticker && c.lore.length && c.how.length && c.faq.length);
  assert.equal(c.coin.ca, "");
  assert.deepEqual(c.roadmap[0].items.slice(0, 1), ["Launch a coin on pump.fun from your own wallet"], "live = facts");
  assert.ok(g.domains.length >= 3 && g.domains.every(d => /^[a-z0-9]+\.[a-z]+$/.test(d)));
  assert.ok(c.faq.some(f => /financial advice/.test(f.q)));
});

test("Claude's copy is used, with the model, effort and schema set", async () => {
  const g = await generate("launchpad for skaters", {}, fakeClaude({
    brand: "Kickflip", tagline: "Launch it like a kickflip.", about: "Coins for skaters, launched from your wallet.", emoji: "🛹",
    accent: "#ffcc00", display: "Bungee", ticker: "kickflip", ticker_backups: ["FLIP"], domains: ["kickflip.fun", "bad domain"],
    lore: ["Skaters had nowhere to launch."], how: [{ title: "Connect", text: "Use Phantom." }],
    next: ["Board of the week"], ideas: ["Skatepark meetups"], faq: [{ q: "Is it free?", a: "Launching costs network fees." }] }));
  assert.equal(g.source, "claude");
  assert.equal(fakeClaude.last.model, "claude-opus-5-5");
  assert.equal(fakeClaude.last.output_config.effort, "medium");
  assert.ok(fakeClaude.last.output_config.format, "structured output schema");
  assert.equal(g.config.brand, "Kickflip");
  assert.equal(g.config.coin.ticker, "KICKFLIP");
  assert.equal(g.config.display, "Bungee");
  assert.equal(g.config.colors.accentInk, "#1d1530", "dark text on a bright accent");
  assert.deepEqual(g.domains, ["kickflip.fun"], "junk domains dropped");
});

test("donation, partner and profit claims are cut, whatever wrote them", () => {
  const r = honest({ brand: "PawLaunch", tagline: "Every launch feeds a shelter.", about: "Launch coins. 10% of fees are donated to animal shelters. Built for pet people.",
    ticker: "PAW", lore: ["We partnered with Harbor Paws Rescue. Pet people deserve a launchpad.", "Guaranteed 100x on every launch."],
    how: [], next: ["Donate to charity weekly", "A shelter of the week page"], ideas: [], faq: [{ q: "Where do fees go?", a: "To charity partners." }] }, "paw");
  const all = JSON.stringify(r.config);
  assert.doesNotMatch(all, /donat|charit|partner|guarantee|100x/i);
  assert.match(r.config.about, /Built for pet people/);
  assert.equal(r.config.lore.length, 1, "a paragraph made only of claims disappears");
  assert.ok(r.removed.length >= 4);
});

test("the Vercel deploy sends the launchpad + this site's config, nothing private", async () => {
  let sent;
  const fakeFetch = async (url, init) => { sent = { url, init, body: JSON.parse(init.body) }; return new Response(JSON.stringify({ id: "dpl_1", url: "kickflip-abc.vercel.app", alias: ["kickflip.vercel.app"] }), { status: 200 }); };
  await assert.rejects(() => deploy({ brand: "x" }, "x", { fetchImpl: fakeFetch, token: "" }), /VERCEL_TOKEN/);
  const cfg = rules("skaters"); const site = honest(cfg, "skaters").config;
  const out = await deploy(site, "Kick Flip!", { fetchImpl: fakeFetch, token: "tok", team: "team_9" });
  assert.equal(out.url, "https://kickflip.vercel.app");
  assert.match(sent.url, /\/v13\/deployments\?teamId=team_9$/);
  assert.equal(sent.init.headers.authorization, "Bearer tok");
  assert.equal(sent.body.name, "kick-flip");
  const names = sent.body.files.map(f => f.file).sort();
  for (const f of ["index.html", "config.js", "package.json", "api/create.js", "api/metadata.js", "api/send.js", "vendor/solana-web3-1.95.3.min.js"]) assert.ok(names.includes(f), f);
  assert.ok(!names.includes("dev.mjs") && !names.includes("README.md"));
  const conf = Buffer.from(sent.body.files.find(f => f.file === "config.js").data, "base64").toString();
  assert.equal(conf, configJs(site));
  assert.ok((await templateFiles()).includes("index.html"));
});

test("domain checks: not found = available, found = taken, errors = unknown", async () => {
  const f = status => async () => new Response("{}", { status });
  assert.equal((await checkDomain("kickflip.fun", f(404))).status, "available");
  assert.equal((await checkDomain("google.com", f(200))).status, "taken");
  assert.equal((await checkDomain("x.fun", async () => { throw new Error("down"); })).status, "unknown");
  assert.equal((await checkDomain("not a domain", f(404))).status, "invalid");
});

test("the Studio over HTTP: locked without a password, then login, generate, edit, preview, deploy", async () => {
  const { createServer } = await import("../../route/server.mjs");
  delete process.env.STUDIO_PASSWORD;
  const { server } = createServer({ dbFile: ":memory:" });
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = "";
  const post = async (p, b) => {
    const r = await fetch(base + p, { method: "POST", headers: { "content-type": "application/json", "x-route": "1", cookie }, body: JSON.stringify(b || {}) });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    return { status: r.status, ...(await r.json()) };
  };
  try {
    assert.equal((await post("/api/studio/login", { password: "x" })).status, 503, "no STUDIO_PASSWORD = Studio off");
    process.env.STUDIO_PASSWORD = "correct horse";
    assert.equal((await post("/api/studio/login", { password: "nope" })).status, 401);
    assert.equal((await post("/api/studio/generate", { idea: "cats" })).status, 401, "nothing without signing in");
    assert.equal((await post("/api/studio/login", { password: "correct horse" })).status, 200);
    const st = await post("/api/studio/status");
    assert.deepEqual([st.ai, st.vercel], [false, false]);
    const g = await post("/api/studio/generate", { idea: "a launchpad for cat memes", ticker: "meow" });
    assert.equal(g.status, 200);
    assert.equal(g.config.coin.ticker, "MEOW", "the owner's ticker wins");
    const edited = { ...g.config, tagline: "Launch it, meow. All fees go to charity!", coin: { ...g.config.coin, ca: "So1anaMintAddr3ss1111111111111111111pump", devBuyPercent: "1.5" } };
    const s = await post("/api/studio/save", { id: g.id, config: edited });
    assert.equal(s.config.tagline, "Launch it, meow.");
    assert.equal(s.config.coin.devBuyPercent, 1.5);
    assert.equal(s.config.coin.ca, "So1anaMintAddr3ss1111111111111111111pump");
    const page = await fetch(base + `/studio/p/${g.id}/`, { headers: { cookie } });
    assert.equal(page.status, 200);
    const cfg = await (await fetch(base + `/studio/p/${g.id}/config.js`, { headers: { cookie } })).text();
    assert.match(cfg, /"tagline": "Launch it, meow\."/);
    assert.equal((await fetch(base + `/studio/p/${g.id}/`)).status, 401, "the preview is the owner's");
    assert.equal((await fetch(base + "/studio")).status, 200);
    const d = await post("/api/studio/deploy", { id: g.id });
    assert.equal(d.status, 400); assert.match(d.error, /VERCEL_TOKEN/);
    const list = await post("/api/studio/list");
    assert.equal(list.drafts[0].ticker, "MEOW");
  } finally { server.close(); delete process.env.STUDIO_PASSWORD; }
});

// ---- the Idea Maker, the mini-app writer and the Studio's memory (2026-10-19) -------------------------------------
import { trends, resetTrends, coinStats } from "../trends.mjs";
import { makeIdeas, rulesIdeas, memoryText, ideaPrompt } from "../ideas.mjs";
import { cleanHtml, makeMiniApp } from "../miniapp.mjs";

const feeds = (over = {}) => async url => {
  const u = String(url);
  const j = o => new Response(JSON.stringify(o), { status: 200 });
  for (const [k, v] of Object.entries(over)) if (u.includes(k)) return typeof v === "function" ? v() : j(v);
  if (u.includes("token-profiles")) return j([{ chainId: "solana", tokenAddress: "Ca1", description: "a cat that runs a bank", url: "https://dexscreener.com/solana/ca1" },
                                             { chainId: "base", tokenAddress: "0x1", description: "not solana" }]);
  if (u.includes("token-boosts")) return j([{ chainId: "solana", tokenAddress: "Ca2", description: "frog arcade on-chain", url: "u" }]);
  if (u.includes("geckoterminal")) return j({ data: [{ attributes: { name: "PIXELCAT / SOL", market_cap_usd: "820000", volume_usd: { h24: "150000" }, price_change_percentage: { h24: "42" }, address: "P1" } }] });
  if (u.includes("pump.fun")) return new Response("<!DOCTYPE html>Just a moment...", { status: 200 });
  return new Response("{}", { status: 404 });
};

test("trends: every source on its own; a blocked pump.fun or a missing DEXTools key never stops the rest", async () => {
  resetTrends(); delete process.env.DEXTOOLS_API_KEY;
  const t = await trends({ fetchImpl: feeds(), force: true });
  assert.deepEqual(t.ok.sort(), ["dexscreener", "geckoterminal"]);
  assert.ok(t.failed.some(f => f.startsWith("pumpfun (blocked")) && t.failed.some(f => f.startsWith("dextools (no DEXTOOLS_API_KEY")));
  assert.ok(t.items.some(x => /bank/.test(x.description)) && t.items.some(x => x.symbol === "PIXELCAT" && x.mcUsd === 820000));
  assert.ok(!t.items.some(x => /not solana/.test(x.description || "")), "Solana only");
});

test("ideas: Claude's concepts, payout promises dropped, history and trends in the request", async () => {
  const tr = await trends({ fetchImpl: feeds(), force: true });
  let req;
  const client = { messages: { parse: async r => { req = r; return { stop_reason: "end_turn", parsed_output: { ideas: [
    { name: "Bank Cat", ticker: "bankcat", kind: "game", pitch: "Run a cat's bank vault.", mechanic: "Stack coins before the alarm; three lives.",
      holder_perk: "A gold vault skin for holders.", inspired_by: "cat finance memes", why_now: "Cat coins are running today." },
    { name: "Yield Farm", ticker: "YLD", kind: "utility", pitch: "Earn passive income daily.", mechanic: "Stake to earn.", holder_perk: "",
      inspired_by: "x", why_now: "y" } ] } }; } } };
  const mem = { liked: [{ brand: "Catpad", ticker: "MEOW", kind: "launchpad", idea: "cat launchpad", note: "love the cats" }],
                disliked: [], launched: [{ brand: "Frogpad", ticker: "FROG", idea: "frogs", stats: { listed: true, mcUsd: 54000, volUsd: 12000 } }] };
  const out = await makeIdeas(tr, { mem, client, focus: "cats" });
  assert.equal(out.source, "claude");
  assert.deepEqual(out.ideas.map(i => i.ticker), ["BANKCAT"], "the passive-income idea is gone");
  const sent = req.messages[0].content;
  assert.match(sent, /PIXELCAT/); assert.match(sent, /love the cats/); assert.match(sent, /MC \$54,000/); assert.match(sent, /cats/);
  assert.equal(req.model, "claude-opus-5-5");
  assert.match(ideaPrompt(out.ideas[0]), /Bank Cat \(\$BANKCAT\), a game\. .*Holder perk/);
});

test("ideas without a key: the plain remixer still gives a mix of kinds from the trend words", async () => {
  const tr = await trends({ fetchImpl: feeds(), force: true });
  const out = await makeIdeas(tr, {});
  assert.equal(out.source, "rules");
  assert.ok(out.ideas.length >= 3 && new Set(out.ideas.map(i => i.kind)).size === 3);
  assert.ok(rulesIdeas({ items: [] }, 3).length === 3, "even with no feed at all");
  assert.equal(memoryText(null), "");
});

test("the mini-app: network and wallet code refused, outside scripts stripped, a no-network policy injected", async () => {
  assert.match(cleanHtml("<!doctype html><html><body><script>fetch('https://x')</script></body></html>").error, /network/);
  assert.match(cleanHtml("<!doctype html><html><body><script>window.solana.connect()</script></body></html>").error, /wallet/);
  assert.match(cleanHtml("no html here").error, /no HTML/);
  const ok = cleanHtml("```html\n<!doctype html><html><head><title>x</title><link rel=stylesheet href=https://evil.example/a.css>" +
    "<link rel=stylesheet href=\"https://fonts.googleapis.com/css2?family=Bungee\"></head><body><canvas></canvas>" +
    "<script src=\"https://evil.example/x.js\"></script><iframe src=https://evil.example></iframe><script>let best=0</script></body></html>\n```");
  assert.ok(ok.html.startsWith("<!doctype html>"));
  assert.match(ok.html, /Content-Security-Policy[^>]*connect-src 'none'/);
  assert.doesNotMatch(ok.html, /evil\.example/);
  assert.match(ok.html, /fonts\.googleapis\.com/); assert.match(ok.html, /let best=0/);
  const fake = { messages: { stream: req => { fake.req = req; return { finalMessage: async () => ({ stop_reason: "end_turn",
    content: [{ type: "text", text: "<!doctype html><html><head></head><body><canvas id=c></canvas><script>let s=0</script></body></html>" }] }) }; } } };
  const app = await makeMiniApp({ name: "Bank Cat", kind: "game", mechanic: "stack coins", holderPerk: "gold skin" },
                                { brand: "Bank Cat", coin: { ticker: "BANKCAT" }, colors: { accent: "#ffcc00" } }, { client: fake });
  assert.ok(app.html && /Content-Security-Policy/.test(app.html));
  assert.equal(fake.req.model, "claude-opus-5-5"); assert.match(fake.req.messages[0].content, /Holder perk: gold skin/);
  delete process.env.ANTHROPIC_API_KEY;
  assert.match((await makeMiniApp({}, { coin: {} })).error, /ANTHROPIC_API_KEY/);
});

test("coin results come from DexScreener's busiest pair; junk addresses are ignored", async () => {
  const f = async () => new Response(JSON.stringify({ pairs: [{ marketCap: 12000, volume: { h24: 900 }, liquidity: { usd: 10 } },
    { marketCap: 54000, volume: { h24: 12000 }, liquidity: { usd: 9000 }, priceChange: { h24: 31 }, url: "u" }] }), { status: 200 });
  const s = await coinStats("CaTmEmEs1111111111111111111111111111pump", f);
  assert.equal(s.mcUsd, 54000); assert.equal(s.volUsd, 12000);
  assert.equal(await coinStats("nope", f), null);
});

test("the deploy ships play.html when the site has a game or tool", async () => {
  let body;
  const ff = async (u, init) => { body = JSON.parse(init.body); return new Response(JSON.stringify({ id: "d", alias: ["x.vercel.app"] }), { status: 200 }); };
  await deploy(honest(rules("cat game"), "cat game").config, "x", { fetchImpl: ff, token: "t", extra: { "play.html": "<!doctype html><html></html>", "../evil": "x" } });
  const names = body.files.map(f => f.file);
  assert.ok(names.includes("play.html") && !names.includes("../evil"));
});
