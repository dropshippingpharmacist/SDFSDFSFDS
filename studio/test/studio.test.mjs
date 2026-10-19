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
  assert.ok(/^#[0-9a-f]{6}$/.test(c.colors.accent2) && /^#[0-9a-f]{6}$/.test(c.colors.accent3) && c.colors.accent2 !== c.colors.accent && c.colors.light !== "#ffffff", "a real palette, not one color");
  assert.deepEqual([honest({ ...rules("x"), accent2: "#123456", light: "nope" }, "x").config.colors.accent2, /^#[0-9a-f]{6}$/.test(honest({ ...rules("x"), light: "nope" }, "x").config.colors.light)], ["#123456", true]);
  assert.equal(c.coin.ca, "");
  assert.equal(c.launchDesk, false, "the launch desk is off unless the owner turns it on: the token is launched elsewhere");
  assert.match(c.roadmap[0].items[0], /usable on this site$/, "live = facts about the product, not a launch form");
  assert.ok(!c.how.some(h => /on pump\.fun/.test(h.title)), "no 'launch on pump.fun' step on a site without the desk");
  const desk = honest(rules("a launchpad for cat memes"), "cats", { launchDesk: true }).config;
  assert.equal(desk.launchDesk, true); assert.deepEqual(desk.roadmap[0].items.slice(0, 1), ["Launch a coin on pump.fun from your own wallet"]);
  assert.equal(c.vibe, "candy"); assert.equal(honest({ ...rules("x"), kind: "game", vibe: "neon" }, "x").config.vibe, "neon");
  assert.equal(honest({ ...rules("x"), kind: "combo", vibe: "nope" }, "x").config.vibe, "arcade", "a combo defaults to the arcade vibe");
  assert.ok(g.domains.length >= 3 && g.domains.every(d => /^[a-z0-9]+\.[a-z]+$/.test(d)));
  assert.ok(c.faq.some(f => /^Do I need \$/.test(f.q)) && !JSON.stringify(c).includes("pump.fun"), "confident copy: no platform names, no disclaimers");
  const long = honest({ ...rules("x"), about: "First sentence here. Second sentence is also here. " + "Third sentence goes on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on." }, "x").config;
  assert.equal(long.about, "First sentence here. Second sentence is also here.", "long copy ends at a full sentence, never mid-word");
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

test("trends: every source on its own; a blocked pump.fun falls back to GeckoTerminal's pump.fun index, a missing DEXTools key never stops the rest", async () => {
  resetTrends(); delete process.env.DEXTOOLS_API_KEY;
  const t = await trends({ fetchImpl: feeds(), force: true });
  assert.deepEqual(t.ok.sort(), ["dexscreener", "geckoterminal", "pumpfun"]);
  assert.ok(t.items.some(x => x.sources.includes("pump.fun busiest (via GeckoTerminal)")), "pump.fun through the open door (merged with the same coin from GeckoTerminal)");
  assert.ok(t.failed.some(f => f.startsWith("dextools (no DEXTOOLS_API_KEY")));
  resetTrends();
  const dark = await trends({ fetchImpl: feeds({ "advanced-api-v2": () => new Response("", { status: 403 }), "dexes/": () => new Response("", { status: 500 }) }), force: true });
  assert.ok(dark.failed.some(f => f.startsWith("pumpfun (blocked on every door")), "only when every door is shut");
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
  assert.ok(out.ideas.length >= 4 && new Set(out.ideas.map(i => i.kind)).size === 4, "launchpad, game, utility and three-in-one");
  assert.ok(rulesIdeas({ items: [] }, 4, "combo").every(i => i.kind === "combo"), "the kind can be fixed");
  assert.match(ideaPrompt(rulesIdeas({ items: [] }, 1, "combo")[0]), /three-in-one \(game \+ utility \+ launchpad\)/);
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

// ---- Launch Intel, X, ticker checks, Route as a draft, the launch hand-off (2026-10-19) ---------------------------
import { DatabaseSync } from "node:sqlite";
import { tickerTaken } from "../trends.mjs";
import { record, playbook, intelText, xPosts, xProvider, recordX, resetX, themeOf, kindOf, LESSONS } from "../intel.mjs";

const PAIR = (addr, name, sym, mc, liq, extra = {}) => ({ chainId: "solana", dexId: "pumpswap", url: "https://dexscreener.com/solana/" + addr, pairCreatedAt: Date.UTC(2026, 9, 18, 21),
  baseToken: { address: addr, name, symbol: sym }, marketCap: mc, volume: { h24: mc / 2 }, liquidity: { usd: liq }, priceChange: { h24: 12 },
  info: { websites: [{ url: "https://" + sym.toLowerCase() + ".fun" }], socials: [{ type: "twitter", url: "https://x.com/" + sym }] }, ...extra });
const richFeeds = () => feeds({
  "tokens/v1/solana": [PAIR("Ca1Ca1Ca1Ca1Ca1Ca1Ca1Ca1Ca1Ca1Ca1Ca1", "Bank Cat", "BANKCAT", 2_400_000, 90_000)],
  "token-profiles": [{ chainId: "solana", tokenAddress: "Ca1Ca1Ca1Ca1Ca1Ca1Ca1Ca1Ca1Ca1Ca1Ca1", description: "a cat that runs a bank", links: [{ type: "telegram", url: "https://t.me/bankcat" }] }],
  "new_pools": { data: [{ attributes: { name: "FROGPAD / SOL", fdv_usd: "40000", reserve_in_usd: "9000", pool_created_at: "2026-10-19T01:00:00Z" } }] },
});

test("trends: pair stats, links and feeds merge into one row per coin; new pools join trending ones", async () => {
  resetTrends();
  const t = await trends({ fetchImpl: richFeeds(), force: true });
  const cat = t.items.find(x => x.symbol === "BANKCAT");
  assert.ok(cat, "the profile got its name and ticker from the pair stats");
  assert.equal(cat.mcUsd, 2_400_000); assert.equal(cat.liqUsd, 90_000);
  assert.deepEqual([cat.website, cat.x, cat.telegram], ["https://bankcat.fun", "https://x.com/BANKCAT", "https://t.me/bankcat"], "profile links + pair socials");
  assert.ok(t.items.some(x => x.symbol === "FROGPAD" && x.source === "GeckoTerminal new" && x.liqUsd === 9000));
});

test("intel: launches are kept for good with peaks and first/last seen, and the playbook reads them", () => {
  const db = new DatabaseSync(":memory:");
  const t0 = Date.UTC(2026, 9, 17, 12);
  const items = [
    { address: "A1", name: "Bank Cat", symbol: "BANKCAT", description: "a cat that runs a bank", mcUsd: 500_000, website: "https://x.fun", x: "https://x.com/a", sources: ["DexScreener new", "pump.fun top"], createdAt: Date.UTC(2026, 9, 17, 21) },
    { address: "A2", name: "Frogpad", symbol: "FROGPAD", description: "fair launch pad for frogs", mcUsd: 30_000, sources: ["GeckoTerminal new"], graduated: true },
    { name: "Agent Arena", symbol: "ARENA", description: "ai agents battle in a browser game", mcUsd: 3_000_000, sources: ["DEXTools hot"], telegram: "https://t.me/x" },
  ];
  assert.equal(record(db, items, t0), 3);
  record(db, [{ address: "A1", name: "Bank Cat", symbol: "BANKCAT", mcUsd: 1_800_000, sources: ["DexScreener boosted"] }], t0 + 30 * 36e5);
  const pb = playbook(db, { now: t0 + 31 * 36e5 });
  assert.equal(pb.launches, 3); assert.equal(pb.winners, 2, "peak market caps count, not the latest ones"); assert.equal(pb.graduated, 1);
  const cat = pb.survivors[0];
  assert.equal(cat.symbol, "BANKCAT"); assert.equal(cat.peakMc, 1_800_000); assert.equal(cat.hours, 30); assert.equal(cat.sources, 3, "every feed it was on is remembered");
  assert.equal(pb.themes[0].name, "cats"); assert.ok(pb.kinds.some(k => k.name === "launchpad") && pb.kinds.some(k => k.name === "game"));
  assert.deepEqual(pb.links.all, { website: 33, x: 33, telegram: 33 });
  assert.equal(pb.bestHoursUtc[0].h, 21);
  const text = intelText(pb);
  assert.match(text, /3 coins tracked/); assert.match(text, /cats 33%/); assert.match(text, /Still around after 24h\+: Bank Cat/); assert.match(text, /bonding curve/);
  assert.equal(themeOf("Moo Deng the hippo"), "other animals"); assert.equal(kindOf("a sniper terminal"), "utility"); assert.ok(LESSONS.length >= 8);
});

test("X via twitterapi.io: the API key header, Top search, every traction field read; nothing without a key", async () => {
  resetX();
  assert.equal(xProvider({}), null);
  assert.equal(xProvider({ TWITTERAPI_IO_KEY: "k", X_BEARER_TOKEN: "b" }).label, "twitterapi.io", "twitterapi.io wins when both are set");
  assert.deepEqual((await xPosts({ fetchImpl: async () => { throw new Error("must not call"); }, provider: null })).posts, []);
  const calls = [];
  const ft = async (u, init) => {
    calls.push([String(u), init.headers["X-API-Key"]]);
    return new Response(JSON.stringify({ tweets: [
      { id: "77", url: "https://x.com/frogdev/status/77", text: "FROGPAD just launched on pump.fun, a fair launch pad for frogs", createdAt: "Sun Oct 19 10:00:00 +0000 2026",
        likeCount: 120, retweetCount: 30, replyCount: 10, viewCount: 50000, author: { userName: "frogdev", name: "Frog Dev" } }], has_next_page: false }), { status: 200 });
  };
  const r = await xPosts({ fetchImpl: ft, provider: xProvider({ TWITTERAPI_IO_KEY: "k1" }), force: true });
  assert.equal(calls.length, 3); assert.ok(calls.every(c => c[1] === "k1" && /api\.twitterapi\.io\/twitter\/tweet\/advanced_search\?queryType=Top/.test(c[0])));
  assert.ok(calls.every(c => /min_faves/.test(decodeURIComponent(c[0]))), "traction floor in the query");
  assert.equal(r.provider, "twitterapi.io"); assert.equal(r.posts.length, 1, "the same post from three searches counts once");
  assert.deepEqual([r.posts[0].author, r.posts[0].likes, r.posts[0].views, r.posts[0].theme, r.posts[0].score], ["frogdev", 120, 50000, "launchpads", 120 + 60 + 10 + 500]);
  assert.equal(r.posts[0].postedAt, Date.UTC(2026, 9, 19, 10));
  const broke = await xPosts({ fetchImpl: async () => new Response("{}", { status: 402 }), provider: xProvider({ TWITTERAPI_IO_KEY: "k" }), force: true });
  assert.equal(broke.ok, false); assert.match(broke.reason, /twitterapi.io 402/);
});

test("X via X's own API: posts ranked by traction with X_BEARER_TOKEN, remembered, and in the playbook", async () => {
  resetX();
  const calls = [];
  const fx = async (u, init) => {
    calls.push([String(u), init.headers.authorization]);
    return new Response(JSON.stringify({ data: [
      { id: "1001", text: "just launched $CATBANK on pump.fun, a cat that runs a bank", author_id: "u1", created_at: "2026-10-19T10:00:00Z", public_metrics: { like_count: 400, retweet_count: 50, reply_count: 30, impression_count: 90000 } },
      { id: "1002", text: "memecoin szn is dead", author_id: "u2", public_metrics: { like_count: 3, retweet_count: 0, reply_count: 1 } },
    ], includes: { users: [{ id: "u1", username: "catdev" }] } }), { status: 200 });
  };
  const r = await xPosts({ fetchImpl: fx, provider: xProvider({ X_BEARER_TOKEN: "tok" }), focus: "cats", force: true });
  assert.ok(calls.length === 4 && calls.every(c => c[1] === "Bearer tok") && calls.some(c => /cats/.test(decodeURIComponent(c[0]))), "3 standing searches + the focus");
  assert.ok(calls.every(c => /-is:retweet/.test(decodeURIComponent(c[0])) && !/min_faves/.test(c[0])), "the queries are translated to X's v2 syntax");
  assert.equal(r.posts[0].id, "1001"); assert.equal(r.posts[0].url, "https://x.com/catdev/status/1001"); assert.equal(r.posts[0].score, 400 + 100 + 30 + 900);
  const db = new DatabaseSync(":memory:");
  recordX(db, r.posts);
  const pb = playbook(db);
  assert.equal(pb.x.total, 2); assert.equal(pb.x.posts[0].author, "catdev"); assert.equal(pb.x.themes[0].name, "cats");
  assert.match(intelText(pb), /X right now.*CATBANK/);
  const denied = await xPosts({ fetchImpl: async () => new Response("{}", { status: 401 }), provider: xProvider({ X_BEARER_TOKEN: "bad" }), force: true });
  assert.equal(denied.ok, false); assert.match(denied.reason, /401/);
});

test("ticker check: taken when a Solana coin with that symbol has liquidity, dead when only rug dust, free otherwise", async () => {
  const f = pairs => async () => new Response(JSON.stringify({ pairs }), { status: 200 });
  const live = await tickerTaken("meow", f([PAIR("M1M1M1M1M1M1M1M1M1M1M1M1M1M1M1M1M1", "Meow", "MEOW", 900_000, 50_000), PAIR("M2", "Meow2", "MEOW", 10, 5), { ...PAIR("E1", "Eth", "MEOW", 1, 1), chainId: "ethereum" }]));
  assert.equal(live.status, "taken"); assert.equal(live.coins.length, 2); assert.equal(live.coins[0].mcUsd, 900_000);
  assert.equal((await tickerTaken("meow", f([PAIR("M2", "Meow2", "MEOW", 10, 5)]))).status, "dead");
  assert.equal((await tickerTaken("meow", f([PAIR("X", "Other", "MEOWW", 1e6, 1e5)]))).status, "free");
  assert.equal((await tickerTaken("meow", async () => { throw new Error("down"); })).status, "unknown");
});

test("Route is a draft under Your sites, its CA edits reach /route, the launchpad reports the CA back, intel over HTTP", async () => {
  const { createServer } = await import("../../route/server.mjs");
  process.env.STUDIO_PASSWORD = "correct horse";
  const { server } = createServer({ dbFile: ":memory:", background: false });
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = "";
  const post = async (p, b, c = cookie) => {
    const r = await fetch(base + p, { method: "POST", headers: { "content-type": "application/json", "x-route": "1", cookie: c }, body: JSON.stringify(b || {}) });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    return { status: r.status, ...(await r.json()) };
  };
  try {
    await post("/api/studio/login", { password: "correct horse" });
    const list = await post("/api/studio/list");
    const route = list.drafts.find(d => d.builtin === "route");
    assert.ok(route && route.ticker === "ROUTE" && route.preview === "/route" && route.url === "/route", "Route shows up as live on this server");
    const g = await post("/api/studio/get", { id: route.id });
    assert.equal(g.preview, "/route"); assert.deepEqual(g.tickerBackups, ["ROUTED", "PULLUP", "LINKUP"]);
    assert.match(await (await fetch(base + "/route-config.js")).text(), /"ca":""/);
    const edited = { ...g.config, coin: { ...g.config.coin, ca: "So1anaMintAddr3ss1111111111111111111pump", x: "https://x.com/route", devBuyPercent: "1.2" } };
    assert.equal((await post("/api/studio/save", { id: route.id, config: edited })).status, 200);
    const rc = await (await fetch(base + "/route-config.js")).text();
    assert.match(rc, /"ca":"So1anaMintAddr3ss1111111111111111111pump"/); assert.match(rc, /"x":"https:\/\/x.com\/route"/); assert.match(rc, /"devBuyPercent":1.2/);
    assert.equal((await fetch(base + "/route")).status, 200);
    const dep = await post("/api/studio/deploy", { id: route.id });
    assert.equal(dep.status, 400); assert.match(dep.error, /already runs on this server/);
    // a new draft, then the launchpad hands its contract address back
    const n = await post("/api/studio/generate", { idea: "a frog arcade", ticker: "frogs" });
    assert.equal((await post("/api/studio/launched", { id: n.id, ca: "nope" })).status, 400);
    assert.equal((await post("/api/studio/launched", { id: n.id, ca: "So1anaMintAddr3ss2222222222222222222pump" }, "")).status, 401, "the owner's cookie is required");
    assert.equal((await post("/api/studio/launched", { id: n.id, ca: "So1anaMintAddr3ss2222222222222222222pump" })).status, 200);
    assert.equal((await post("/api/studio/get", { id: n.id })).config.coin.ca, "So1anaMintAddr3ss2222222222222222222pump");
    const st = await post("/api/studio/status"); assert.equal(st.x, null);
    const intel = await post("/api/studio/intel", {});
    assert.equal(intel.status, 200); assert.ok(Array.isArray(intel.playbook.lessons) && /^no /.test(intel.x.reason));
    const tk = await post("/api/studio/ticker", { tickers: ["frogs"] });
    assert.equal(tk.status, 200); assert.equal(tk.tickers[0].ticker, "FROGS");
    const launch = await (await fetch(base + "/launch/?draft=" + n.id + "&name=Frogs")).text();
    assert.match(launch, /api\/studio\/launched/);
  } finally { server.close(); delete process.env.STUDIO_PASSWORD; }
});


// ---- pump.fun live, the launch desk switch, the polish pass (2026-10-19) --------------------------------------------
import { createPumpLive } from "../pumplive.mjs";

test("pump.fun live: creations and graduations from the stream, USD caps, metadata from IPFS, a rolling window", async () => {
  let t = Date.UTC(2026, 9, 19, 20);
  let sent = [];
  class FakeWS { constructor(u) { FakeWS.last = this; this.url = u; setTimeout(() => this.onopen && this.onopen(), 0); } send(m) { sent.push(JSON.parse(m).method); } close() {} }
  const f = async u => {
    if (/So1111/.test(String(u))) return new Response(JSON.stringify({ pairs: [{ chainId: "solana", priceUsd: "200", liquidity: { usd: 1e8 } }] }), { status: 200 });
    if (/ipfs/.test(String(u))) return new Response(JSON.stringify({ name: "Bank Cat", symbol: "BANKCAT", description: "a cat that runs a bank", twitter: "https://x.com/bankcat", website: "https://bankcat.fun" }), { status: 200 });
    return new Response("", { status: 404 });
  };
  const live = createPumpLive({ WS: FakeWS, fetchImpl: f, now: () => t });
  live.connect();
  await new Promise(r => setTimeout(r, 5));
  assert.deepEqual(sent, ["subscribeNewToken", "subscribeMigration"]);
  const ws = FakeWS.last;
  ws.onmessage({ data: JSON.stringify({ txType: "create", mint: "M1", name: "Bank Cat", symbol: "BANKCAT", uri: "https://ipfs.io/ipfs/Qm1", traderPublicKey: "Dev1", marketCapSol: 30, solAmount: 1.5, pool: "pump" }) });
  ws.onmessage({ data: JSON.stringify({ txType: "create", mint: "M2", name: "Old", symbol: "OLD", uri: null, marketCapSol: 28 }) });
  ws.onmessage({ data: "not json" });
  t += 2 * 36e5;
  ws.onmessage({ data: JSON.stringify({ txType: "migrate", mint: "M1", pool: "pump-amm" }) });
  const snap = await live.snapshot();
  const cat = snap.find(x => x.address === "M1");
  assert.equal(cat.source, "pump.fun graduated (live)"); assert.equal(cat.graduated, true); assert.equal(cat.dex, "pumpswap");
  assert.equal(cat.mcUsd, 6000, "30 SOL at $200"); assert.equal(cat.devBuySol, 1.5);
  assert.deepEqual([cat.description, cat.x, cat.website], ["a cat that runs a bank", "https://x.com/bankcat", "https://bankcat.fun"], "the coin's own metadata");
  assert.equal(snap.find(x => x.address === "M2").source, "pump.fun new (live)");
  const st = live.status(); assert.equal(st.connected, true); assert.equal(st.created, 2); assert.equal(st.migrated, 1); assert.equal(st.solUsd, 200);
  t += 25 * 36e5;
  assert.equal((await live.snapshot()).length, 0, "a day later the window has moved on");
  live.stop();
});

test("the trend feeds take live sources, and the server exposes the switch, the polish pass and the three-in-one", async () => {
  resetTrends();
  const { registerLiveSource } = await import("../trends.mjs");
  registerLiveSource("pumpfun live", async () => [{ source: "pump.fun new (live)", address: "L1", name: "Live Cat", symbol: "LIVECAT", mcUsd: 9000 }]);
  const t = await trends({ fetchImpl: feeds(), force: true });
  assert.ok(t.ok.includes("pumpfun live") && t.items.some(x => x.symbol === "LIVECAT"));
  registerLiveSource("pumpfun live", null);

  const { createServer } = await import("../../route/server.mjs");
  process.env.STUDIO_PASSWORD = "correct horse";
  const { server } = createServer({ dbFile: ":memory:", background: false });
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = "";
  const post = async (p, b) => {
    const r = await fetch(base + p, { method: "POST", headers: { "content-type": "application/json", "x-route": "1", cookie }, body: JSON.stringify(b || {}) });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    return { status: r.status, ...(await r.json()) };
  };
  try {
    await post("/api/studio/login", { password: "correct horse" });
    const g = await post("/api/studio/generate", { idea: "Frog Arcade, a three-in-one (game + utility + launchpad): a slingshot game, a card maker and a launch kit", ticker: "FROGARC" });
    assert.equal(g.config.product.kind, "combo"); assert.equal(g.config.launchDesk, false); assert.equal(g.config.vibe, "arcade");
    assert.equal(g.build, null, "no key, no background build"); assert.equal((await post("/api/studio/get", { id: g.id })).build, null);
    const on = await post("/api/studio/save", { id: g.id, config: { ...g.config, launchDesk: true } });
    assert.equal(on.config.launchDesk, true, "the owner can turn the desk on");
    const cfg = await (await fetch(base + `/studio/p/${g.id}/config.js`, { headers: { cookie } })).text();
    assert.match(cfg, /"launchDesk": true/); assert.match(cfg, /"vibe": "arcade"/);
    assert.equal((await post("/api/studio/polish", { id: g.id })).status, 400, "nothing to polish before the app exists");
    assert.equal((await post("/api/studio/app", { id: g.id })).status, 400, "no key: the build needs Claude");
    assert.equal((await post("/api/studio/restyle", { id: g.id })).status, 400);
    const js = await post("/api/studio/jobs", { id: g.id });
    assert.deepEqual(Object.keys(js.jobs).sort(), ["app", "book", "content", "gitbook", "polish", "theme"]); assert.equal(js.hasApp, false);
    const ideas = await post("/api/studio/ideas", { mix: "combo" });
    assert.ok(ideas.ideas.length && ideas.ideas.every(i => i.kind === "combo"), "the Idea Maker can be told: three-in-one only");
    const st = await post("/api/studio/status"); assert.equal(st.pump, null, "no live feed in tests");
    const page = await (await fetch(base + "/launch/")).text();
    assert.match(page, /getParsedTokenAccountsByOwner/); assert.match(page, /id="scene"/);
  } finally { server.close(); delete process.env.STUDIO_PASSWORD; }
});


// long work runs as background jobs; the tests wait for them the way the Studio does
async function waitJob(post, id, kind, ms = 120000) {
  const t0 = Date.now();
  for (;;) {
    const j = (await post("/api/studio/jobs", { id })).jobs[kind];
    if (j && j.state !== "running") return j;
    if (Date.now() - t0 > ms) throw new Error(kind + " job did not finish");
    await new Promise(r => setTimeout(r, 150));
  }
}

// ---- the content kit (2026-10-19) ---------------------------------------------------------------------------------
import { planContent, rulesPlan, templateImage, templateVideo, makeVisual, HOW_TO_POST, SIZES } from "../content.mjs";
import { renderStatus } from "../render.mjs";

test("content kit: the plan passes the honesty filter, the templates are complete pages, Claude's visuals are checked", async () => {
  const cfg = honest({ ...rules("Frog Arcade game"), kind: "game", holder_perk: "a gold frog skin" }, "frogs").config;
  const { plan, source } = await planContent(cfg, { client: fakeClaude({
    bio: "Hop in. Guaranteed 100x! A frog game you can play now. [SITE]", name_on_x: "Frog Arcade 🐸", pfp_brief: "frog", banner_brief: "frogs", launch_image_brief: "frog",
    videos: [{ key: "intro", hook: "Frogs are back", scenes: [{ seconds: 4, headline: "Frog Arcade", sub: "Hop in.", visual: "frog pops" }, { seconds: 30, headline: "Profits for all", sub: "we partner with banks", visual: "x" }], end_card: "Link in bio" }],
    posts: [{ when: "launch day", media: "intro video", text: "Frog Arcade is live. Airdrops soon! Site in bio." }],
    pinned: "Frog Arcade [SITE] [CA]", reply_with_ca: "CA: [CA]" }) });
  assert.equal(source, "claude");
  assert.equal(plan.bio, "Hop in. A frog game you can play now. [SITE]", "the promise is dropped");
  assert.equal(plan.posts[0].text, "Frog Arcade is live. Site in bio.");
  const intro = plan.videos.find(v => v.key === "intro");
  assert.equal(intro.scenes.length, 1, "a scene whose headline is a promise is dropped; seconds are capped");
  assert.equal(plan.videos.length, 1, "one video: the intro");
  assert.ok(rulesPlan(cfg).posts.length === 3 && HOW_TO_POST.length >= 5, "three tweets, written out");
  for (const k of ["pfp", "banner"]) assert.match(templateImage(k, cfg), /<!doctype html>/);
  assert.match(templateImage("pfp", cfg), /<svg[^>]*><path d="M/, "the profile picture is a drawn mark, not the emoji");
  assert.ok(!templateImage("pfp", cfg).includes("🐸"));
  const { markIndex, MARKS } = await import("../content.mjs");
  assert.ok(new Set(["Vendo", "Dustpaw", "Founderbot", "Route", "Catpad", "Frog Arcade", "Moonpad"].map(b => markIndex({ brand: b, coin: { ticker: b.toUpperCase() } }))).size >= 4, "different launches, different marks");
  assert.ok(MARKS.length >= 8);
  const v = templateVideo(intro, cfg);
  assert.match(v, /window\.render = function/); assert.match(v, /id="c" width="1080" height="1080"/); assert.match(v, /window\.DURATION = 7/);
  const bad = { messages: { stream: () => ({ finalMessage: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: "<!doctype html><html><body><img src=\"https://evil/x.png\"></body></html>" }] }) }) } };
  assert.equal((await makeVisual("pfp", "x", cfg, { client: bad })).source, "template", "a page pulling images from the web is refused; the template is used");
  const good = { messages: { stream: () => ({ finalMessage: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: "```html\n<!doctype html><html><body><canvas id=\"c\"></canvas><script>window.DURATION=5;window.render=t=>{}</script></body></html>\n```" }] }) }) } };
  assert.equal((await makeVisual("video", "", cfg, { client: good, video: intro })).source, "claude");
  let calls = 0;
  const fussy = { messages: { stream: r => ({ finalMessage: async () => { calls++; if (r.output_config) throw Object.assign(new Error("bad"), { status: 400 });
    return { stop_reason: "end_turn", content: [{ type: "text", text: "<!doctype html><html><body><div>ok</div></body></html>" }] }; } }) } };
  const second = await makeVisual("pfp", "x", cfg, { client: fussy });
  assert.equal(second.source, "claude"); assert.equal(calls, 2, "a 400 gets one plainer retry");
  assert.equal(typeof renderStatus().videos, "boolean"); assert.deepEqual(SIZES.banner, [1500, 500]);
  const { withFonts } = await import("../render.mjs");
  const page = await withFonts("<!doctype html><html><head><title>x</title></head><body>hi</body></html>");
  assert.match(page, /<head><style>@font-face\{font-family:"DejaVu Sans";font-weight:400;src:url\(data:font\/ttf;base64,/, "the shipped font rides in every rendered page");
  assert.ok(page.length > 500000, "the font bytes are really there");
});

test("content kit over HTTP: files land on the volume, are served to the owner only, and the kit is remembered", async () => {
  const { createServer } = await import("../../route/server.mjs");
  const { renderStatus } = await import("../render.mjs");
  process.env.STUDIO_PASSWORD = "correct horse"; process.env.VIDEO_FPS = "6";
  const prevData = process.env.DATA_DIR;
  const { server } = createServer({ dbFile: ":memory:", background: false });
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = "";
  const post = async (p, b) => {
    const r = await fetch(base + p, { method: "POST", headers: { "content-type": "application/json", "x-route": "1", cookie }, body: JSON.stringify(b || {}) });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    return { status: r.status, ...(await r.json()) };
  };
  try {
    await post("/api/studio/login", { password: "correct horse" });
    const g = await post("/api/studio/generate", { idea: "a cat clicker game", ticker: "CLICK" });
    const started = await post("/api/studio/content", { id: g.id });
    assert.equal(started.status, 200); assert.equal(started.started, true);
    assert.equal((await post("/api/studio/content", { id: g.id })).status, 409, "one kit at a time");
    const job = await waitJob(post, g.id, "content", 300000);
    assert.equal(job.state, "done", job.error);
    const k = { content: (await post("/api/studio/content/get", { id: g.id })).content };
    assert.equal(k.content.source, "rules");
    assert.ok(k.content.files.pfp.html === "pfp.html" && k.content.files.intro.html === "intro.html" && k.content.plan.posts.length === 3);
    const page = await fetch(base + `/studio/c/${g.id}/pfp.html`, { headers: { cookie } });
    assert.equal(page.status, 200); assert.match(await page.text(), /<!doctype html>/);
    assert.equal((await fetch(base + `/studio/c/${g.id}/pfp.html`)).status, 401, "the owner's files");
    assert.equal((await fetch(base + `/studio/c/${g.id}/../x.html`, { headers: { cookie } })).status, 404);
    if (renderStatus().videos) {
      assert.ok(k.content.files.pfp.png && k.content.files.intro.mp4, "rendered where a browser and ffmpeg exist: " + JSON.stringify(k.content.notes));
      const mp4 = await fetch(base + `/studio/c/${g.id}/intro.mp4`, { headers: { cookie } });
      assert.equal(mp4.headers.get("content-type"), "video/mp4"); assert.ok((await mp4.arrayBuffer()).byteLength > 10000);
    }
    assert.deepEqual(Object.keys((await post("/api/studio/content/get", { id: g.id })).content.files).sort(), ["banner", "intro", "pfp"], "the X picture, the banner and one intro video");
  } finally { server.close(); delete process.env.STUDIO_PASSWORD; delete process.env.VIDEO_FPS; if (prevData) process.env.DATA_DIR = prevData; }
});

// ---- rename propagation, link previews, buy link, launch fields (2026-10-19) ----------------------------------------
import { rename } from "../generate.mjs";
import { headTags } from "../deploy.mjs";

test("a new brand or ticker flows through every piece of copy; the site's buy link and launch platform are the owner's", async () => {
  const cfg = honest(rules("a launchpad for cat memes"), "cats", { ticker: "MEOW" }).config;
  const cat = cfg.brand;
  assert.ok(cfg.faq.some(f => f.q.includes(cat) || f.a.includes(cat)) && cfg.faq.some(f => f.q.includes("$MEOW")));
  const re = rename(cfg, { brand: cat, ticker: "MEOW" }, { brand: "Purr Arcade", ticker: "PURR" });
  assert.equal(re.brand, "Purr Arcade"); assert.equal(re.coin.ticker, "PURR");
  const all = JSON.stringify([re.tagline, re.about, re.lore, re.how, re.roadmap, re.faq, re.product]);
  assert.ok(!all.includes(cat) && !all.includes("MEOW"), "nothing left of the old name or ticker: " + all.slice(0, 200));
  assert.ok(all.includes("Purr Arcade") && all.includes("$PURR"), "the new ones took their place, $ kept where it was");
  assert.deepEqual(rename(cfg, { brand: cat, ticker: "MEOW" }, { brand: cat, ticker: "MEOW" }).faq, cfg.faq, "no change, no damage");
  const own = honest(rules("x"), "x", { buyUrl: "https://jup.ag/swap/SOL-abc", launchedOn: "a Solana launchpad" }).config;
  assert.equal(own.coin.buyUrl, "https://jup.ag/swap/SOL-abc"); assert.equal(own.coin.launchedOn, "a Solana launchpad");
  assert.equal(honest(rules("x"), "x", { buyUrl: "javascript:alert(1)" }).config.coin.buyUrl, "", "only https buy links");
  const tags = headTags(own, { ogImage: true });
  assert.match(tags, new RegExp(`<title>${own.brand} · \\$${own.coin.ticker}</title>`)); assert.match(tags, /og:image" content="og.png"/); assert.match(tags, /summary_large_image/); assert.match(tags, /rel="icon" href="data:image\/svg\+xml/);
  assert.ok(!/og:image/.test(headTags(own)), "no image tag without the picture");

  let body = null;
  const ff = async (u, init) => { body = JSON.parse(init.body); return new Response(JSON.stringify({ id: "d", alias: ["x.vercel.app"] }), { status: 200 }); };
  await deploy(own, "x", { fetchImpl: ff, token: "t", extra: { "og.png": Buffer.from("png"), "play.html": "<!doctype html><html></html>", "evil.exe": Buffer.from("x"), "theme.css": ".a{}", "mascot.svg": "<svg/>" } });
  const names = body.files.map(f => f.file);
  assert.ok(names.includes("og.png") && names.includes("play.html") && names.includes("theme.css") && names.includes("mascot.svg") && !names.includes("evil.exe"));
  const index = Buffer.from(body.files.find(f => f.file === "index.html").data, "base64").toString();
  assert.match(index, new RegExp(`<meta property="og:title" content="${own.brand} · \\$${own.coin.ticker}">`), "the link preview is baked into the deployed page");
});

test("over HTTP: saving a new name rewrites the copy on the server too, and the generate answer carries its preview", async () => {
  const { createServer } = await import("../../route/server.mjs");
  process.env.STUDIO_PASSWORD = "correct horse";
  const { server } = createServer({ dbFile: ":memory:", background: false });
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = "";
  const post = async (p, b) => {
    const r = await fetch(base + p, { method: "POST", headers: { "content-type": "application/json", "x-route": "1", cookie }, body: JSON.stringify(b || {}) });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    return { status: r.status, ...(await r.json()) };
  };
  try {
    await post("/api/studio/login", { password: "correct horse" });
    const g = await post("/api/studio/generate", { idea: "a launchpad for cat memes", ticker: "MEOW" });
    assert.equal(g.preview, `/studio/p/${g.id}/`);
    const s = await post("/api/studio/save", { id: g.id, config: { ...g.config, brand: "Purr Arcade", coin: { ...g.config.coin, ticker: "purr", buyUrl: "https://jup.ag/swap/SOL-abc", launchedOn: "a Solana launchpad" } } });
    assert.equal(s.status, 200); assert.equal(s.config.brand, "Purr Arcade"); assert.equal(s.config.coin.ticker, "PURR");
    const all = JSON.stringify(s.config);
    assert.ok(!all.includes(g.config.brand) && !all.includes("MEOW") && all.includes("$PURR"), "the FAQ, about and lore follow the new name");
    assert.equal(s.config.coin.buyUrl, "https://jup.ag/swap/SOL-abc"); assert.equal(s.config.coin.launchedOn, "a Solana launchpad");
  } finally { server.close(); delete process.env.STUDIO_PASSWORD; }
});


// ---- tokenomics split and the docs (2026-10-19) --------------------------------------------------------------------
import { tokenomics, ALLOC } from "../generate.mjs";
import { docsHtml, docsMarkdown } from "../docs.mjs";

test("where the money goes: a split per kind that always adds up, the owner's own when it does, and the docs carry it", async () => {
  const game = honest({ ...rules("cat runner game"), kind: "game" }, "x").config;
  assert.equal(game.tokenomics.allocation.reduce((n, a) => n + a.pct, 0), 100);
  assert.equal(game.tokenomics.allocation[0].name, "The game"); assert.equal(game.tokenomics.source, "Creator fees from trading");
  assert.equal(honest({ ...rules("x"), kind: "launchpad" }, "x").config.tokenomics.allocation[2].name, "Launch incentives");
  for (const k of Object.keys(ALLOC)) assert.equal(ALLOC[k].reduce((n, a) => n + a[1], 0), 100, k + " adds up");
  const own = tokenomics({ kind: "game", allocation: [{ name: "Game", pct: 60, what: "levels" }, { name: "Marketing", pct: 40, what: "clips" }], fee_source: "Creator fees", dev_buy_policy: "held 6 months" });
  assert.deepEqual(own.allocation.map(a => a.pct), [60, 40]); assert.equal(own.devBuyPolicy, "held 6 months");
  assert.equal(tokenomics({ kind: "utility", allocation: [{ name: "A", pct: 70, what: "" }, { name: "B", pct: 20, what: "" }] }).allocation[0].name, "The tool", "a split that does not add up falls back");
  const writer = honest({ ...rules("x"), kind: "utility", allocation: [{ name: "Tool", pct: 50, what: "Guaranteed 100x returns" }, { name: "Team", pct: 50, what: "people" }], fee_source: "Creator fees", dev_buy_policy: "small" }, "x").config;
  assert.equal(writer.tokenomics.allocation[0].what, "", "promises are dropped from the split too");
  const md = docsMarkdown({ ...game, siteUrl: "https://catrun.vercel.app" });
  assert.match(md, /^# .* docs/); assert.match(md, /## Tokenomics/); assert.match(md, /\| 40% \| The game \|/); assert.ok(!/Tax:|Launched on:|Dev buy/.test(md), "no tax / platform / dev-buy lines"); assert.match(md, /Site: https:\/\/catrun.vercel.app/); assert.match(md, /## FAQ/);
  const html = docsHtml(game);
  assert.match(html, /<nav>.*href="#tokenomics".*<\/nav>/s); assert.match(html, /class="bar"><span style="width:40%"/); assert.match(html, /<title>.* docs<\/title>/);
  assert.ok(!html.includes("<script"), "the docs page is plain HTML");
});

test("over HTTP: the docs preview, the Markdown download and the owner's split on save", async () => {
  const { createServer } = await import("../../route/server.mjs");
  process.env.STUDIO_PASSWORD = "correct horse";
  const { server } = createServer({ dbFile: ":memory:", background: false });
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = "";
  const post = async (p, b) => {
    const r = await fetch(base + p, { method: "POST", headers: { "content-type": "application/json", "x-route": "1", cookie }, body: JSON.stringify(b || {}) });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    return { status: r.status, ...(await r.json()) };
  };
  try {
    await post("/api/studio/login", { password: "correct horse" });
    const g = await post("/api/studio/generate", { idea: "a cat runner game", ticker: "RUN" });
    const docs = await fetch(base + `/studio/p/${g.id}/docs.html`, { headers: { cookie } });
    assert.equal(docs.status, 200); assert.match(await docs.text(), /Where the money goes/);
    const md = await fetch(base + `/studio/p/${g.id}/docs.md`, { headers: { cookie } });
    assert.match(md.headers.get("content-disposition"), /docs\.md/); assert.match(await md.text(), /## Tokenomics/);
    assert.equal((await fetch(base + `/studio/p/${g.id}/docs.md`)).status, 401);
    const s = await post("/api/studio/save", { id: g.id, config: { ...g.config, tokenomics: { source: "Creator fees", devBuyPolicy: "1% at launch, held", allocation: [{ name: "Game", pct: 55, what: "levels" }, { name: "Marketing", pct: 30, what: "clips" }, { name: "Team", pct: 15, what: "us" }] } } });
    assert.deepEqual(s.config.tokenomics.allocation.map(a => a.pct), [55, 30, 15]);
    const cfg = await (await fetch(base + `/studio/p/${g.id}/config.js`, { headers: { cookie } })).text();
    assert.match(cfg, /"devBuyPolicy": "1% at launch, held"/);
  } finally { server.close(); delete process.env.STUDIO_PASSWORD; }
});


// ---- the book and GitBook (2026-10-19) ----------------------------------------------------------------------------
import { makeBook, rulesBook, bookHtml, bookFiles, zip, mdToHtml, publishGitBook } from "../gitbook.mjs";

test("the book: Claude's pages cleaned, the plain book from the config, HTML with a sidebar, GitBook files and a real zip", async () => {
  const cfg = { ...honest({ ...rules("cat runner game"), kind: "game", holder_perk: "gold skin" }, "x").config, siteUrl: "https://catrun.vercel.app" };
  const plain = rulesBook(cfg);
  assert.ok(plain.length >= 6 && plain.some(p => p.slug === "tokenomics") && !plain.some(p => p.slug === "brand") && plain.at(-1).slug === "official-links");
  const bk = await makeBook(cfg, { client: fakeClaude({ pages: [
    { title: "Introduction", slug: "Intro!", description: "Start here.", markdown: "# Hi\n\nCat Run is a runner. Guaranteed 100x for holders. Play it on the site.\n\n- fast\n- fun\n- airdrops every week" },
    { title: "Tokenomics", slug: "tokenomics", description: "", markdown: "| Share | Bucket | What |\n|---|---|---|\n| 40% | The game | levels |" },
    { title: "Dupe", slug: "tokenomics", description: "", markdown: "x {% hint %}<b>html</b>{% endhint %}" }] }) });
  assert.equal(bk.source, "claude"); assert.deepEqual(bk.pages.map(p => p.slug), ["intro", "tokenomics", "tokenomics-2"]);
  assert.equal(bk.pages[0].markdown, "# Hi\n\nCat Run is a runner. Play it on the site.\n\n- fast\n- fun", "promises are dropped line by line");
  assert.equal(bk.pages[0].description, "Start here."); assert.equal(bk.pages[2].markdown, "x html", "no HTML or template tags reach GitBook");
  assert.match(mdToHtml(bk.pages[1].markdown), /<table><tr><th>Share<\/th>.*<td>40%<\/td>/s);
  assert.match(mdToHtml("## T\n\nsome **bold** and `code` <script>x</script>\n\n1. one\n2. two\n\n> quote"), /<h3>T<\/h3>.*<b>bold<\/b>.*&lt;script&gt;.*<ol><li>one<\/li><li>two<\/li><\/ol>.*<blockquote>quote/s);
  const html = bookHtml(cfg, bk.pages);
  assert.match(html, /<nav><a href="#intro" data-i="0">Introduction<\/a>/); assert.match(html, /<article id="tokenomics-2">/); assert.ok(!html.includes("<script"));
  const files = bookFiles(cfg, bk.pages);
  assert.ok(files["README.md"].includes("# " + cfg.brand) && files["SUMMARY.md"].includes("* [Tokenomics](tokenomics.md)") && files["tokenomics.md"] && files[".gitbook.yaml"]);
  const z = zip(files);
  assert.equal(z.readUInt32LE(0), 0x04034b50, "a zip local header"); assert.ok(z.includes(Buffer.from("SUMMARY.md")) && z.includes(Buffer.from("| 40% | The game |")));
  const eocd = z.length - 22; assert.equal(z.readUInt32LE(eocd), 0x06054b50); assert.equal(z.readUInt16LE(eocd + 10), Object.keys(files).length, "every file in the directory");
});

test("GitBook: space, change request with every page, merge, docs site, publish, brand; a second publish reuses and replaces", async () => {
  const cfg = honest(rules("cat runner game"), "x").config, pages = rulesBook(cfg);
  await assert.rejects(() => publishGitBook(cfg, pages, { token: "" }), /GITBOOK_TOKEN/);
  const calls = [];
  const api = async (u, init) => {
    const path = String(u).replace("https://api.gitbook.com/v1", "");
    calls.push([init.method, path, init.body ? JSON.parse(init.body) : null, init.headers.authorization]);
    const j = o => new Response(JSON.stringify(o), { status: 200 });
    if (path === "/orgs") return j({ items: [{ id: "org1" }] });
    if (path === "/orgs/org1/spaces") return j({ id: "sp1", revision: "rev0", urls: { app: "https://app.gitbook.com/s/sp1" } });
    if (path === "/spaces/sp1") return j({ id: "sp1", revision: "rev9", urls: { app: "https://app.gitbook.com/s/sp1" } });
    if (path === "/spaces/sp1/revisions/rev0") return j({ pages: [{ id: "pDefault" }] });
    if (path === "/spaces/sp1/revisions/rev9") return j({ pages: pages.map((p, i) => ({ id: "old" + i })) });
    if (path === "/spaces/sp1/change-requests") return j({ id: "cr1" });
    if (path.startsWith("/spaces/sp1/change-requests/cr1/content")) return j({});
    if (path === "/spaces/sp1/change-requests/cr1/merge") return j({});
    if (path === "/orgs/org1/sites") return j({ id: "site1", urls: {} });
    if (path === "/orgs/org1/sites/site1") return j({ id: "site1", urls: { published: "https://crypto.gitbook.io/catpad-docs/" } });
    if (path === "/orgs/org1/sites/site1/publish") return j({ urls: { published: "https://crypto.gitbook.io/catpad-docs/" } });
    if (path === "/orgs/org1/sites/site1/customization") return init.method === "GET" ? j({ updatedAt: "x", title: "t", styling: { theme: "clean", primaryColor: { light: "#346DDB", dark: "#346DDB" } }, favicon: {}, themes: { default: "system", toggeable: false } }) : j({});
    return new Response("{}", { status: 404 });
  };
  const out = await publishGitBook(cfg, pages, { token: "gb_tok", fetchImpl: api });
  assert.equal(out.publishedUrl, "https://crypto.gitbook.io/catpad-docs/"); assert.equal(out.spaceId, "sp1"); assert.equal(out.siteId, "site1");
  assert.ok(calls.every(c => c[3] === "Bearer gb_tok"));
  assert.deepEqual(calls.map(c => c[0] + " " + c[1]), ["GET /orgs", "POST /orgs/org1/spaces", "GET /spaces/sp1/revisions/rev0", "POST /spaces/sp1/change-requests",
    "POST /spaces/sp1/change-requests/cr1/content?compat=false", "POST /spaces/sp1/change-requests/cr1/merge", "POST /orgs/org1/sites", "POST /orgs/org1/sites/site1/publish",
    "GET /orgs/org1/sites/site1/customization", "PUT /orgs/org1/sites/site1/customization"], "the exact flow GitBook's own tools use");
  const content = calls[4][2].changes;
  assert.deepEqual(content[0], { operation: "delete_page", page: "pDefault" }, "the empty default page goes");
  assert.equal(content.length, 1 + pages.length); assert.equal(content[1].operation, "insert_page"); assert.equal(content[1].at, 0);
  assert.match(content[1].document.markdown, /^---\ndescription: .+\n---\n\n# /, "frontmatter description, then the page");
  assert.deepEqual(calls[6][2], { title: cfg.brand + " Docs", type: "basic", visibility: "public", spaces: ["sp1"] });
  const brand = calls[9][2];
  assert.equal(brand.styling.primaryColor.light, cfg.colors.accent); assert.equal(brand.favicon.emoji, "1f680"); assert.equal(brand.themes.toggeable, true); assert.ok(!("updatedAt" in brand));
  calls.length = 0;
  const again = await publishGitBook(cfg, pages, { token: "gb_tok", fetchImpl: api, existing: { spaceId: "sp1", siteId: "site1" } });
  assert.ok(again.steps.includes("Space reused") && again.steps.includes("Site reused"));
  assert.ok(calls.some(c => c[1] === "/spaces/sp1") && calls.some(c => c[1] === "/spaces/sp1/revisions/rev9") && !calls.some(c => c[1] === "/orgs/org1/spaces"), "the launch's own space again, none created");
  const ch = calls.find(c => c[1].includes("/content"))[2].changes;
  assert.equal(ch.filter(c => c.operation === "delete_page").length, pages.length, "last time's pages replaced");
});

test("over HTTP: the book is written, served as docs.html / docs.zip to the owner, and at the public link for GitBook only", async () => {
  const { createServer } = await import("../../route/server.mjs");
  process.env.STUDIO_PASSWORD = "correct horse";
  const { server } = createServer({ dbFile: ":memory:", background: false });
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = "";
  const post = async (p, b) => {
    const r = await fetch(base + p, { method: "POST", headers: { "content-type": "application/json", "x-route": "1", cookie }, body: JSON.stringify(b || {}) });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    return { status: r.status, ...(await r.json()) };
  };
  try {
    await post("/api/studio/login", { password: "correct horse" });
    const g = await post("/api/studio/generate", { idea: "a cat runner game", ticker: "RUN" });
    assert.equal((await post("/api/studio/book/get", { id: g.id })).book, null);
    const w0 = await post("/api/studio/book", { id: g.id });
    assert.equal(w0.status, 200); assert.equal(w0.started, true);
    assert.equal((await waitJob(post, g.id, "book")).state, "done");
    const w = (await post("/api/studio/book/get", { id: g.id })).book;
    assert.equal(w.source, "rules"); assert.ok(w.pages.length >= 6);
    const docs = await (await fetch(base + `/studio/p/${g.id}/docs.html`, { headers: { cookie } })).text();
    assert.match(docs, /<article id="tokenomics">/); assert.match(docs, /Where the money goes/);
    const z = await fetch(base + `/studio/p/${g.id}/docs.zip`, { headers: { cookie } });
    assert.equal(z.headers.get("content-type"), "application/zip"); assert.equal(Buffer.from(await z.arrayBuffer()).readUInt32LE(0), 0x04034b50);
    assert.equal((await fetch(base + `/studio/p/${g.id}/docs.zip`)).status, 401);
    const gb2 = await post("/api/studio/gitbook", { id: g.id });
    assert.equal(gb2.status, 400); assert.match(gb2.error, /GITBOOK_TOKEN/);
    assert.equal((await fetch(base + "/public/book/nope-nope-nope-nope-nope.zip")).status, 404, "nothing is public");
    const s2 = await post("/api/studio/status"); assert.equal(s2.gitbook, false);
  } finally { server.close(); delete process.env.STUDIO_PASSWORD; }
});


// ---- the look: layouts, the site's own stylesheet, the mascot (2026-10-19) -------------------------------------------
import { cleanCss, cleanSvg, rulesLayout, makeTheme, LAYOUTS } from "../theme.mjs";

test("the look: a layout per brand by default, Claude's stylesheet and mascot checked, nothing from the web", async () => {
  const game = honest({ ...rules("cat runner game"), kind: "game" }, "x").config;
  assert.equal(rulesLayout(game), "poster"); assert.equal(rulesLayout(honest({ ...rules("x"), kind: "utility" }, "x").config), "split");
  assert.equal(rulesLayout({ brand: "AgentBot", about: "an ai agent", product: {} }), "terminal");
  assert.ok(LAYOUTS.includes(rulesLayout({ brand: "Anything", about: "", product: { kind: "launchpad" } })));
  assert.equal(cleanCss(".hero{background:url(https://evil/x.png)}"), "", "no web resources");
  assert.equal(cleanCss("@import url(x.css); .a{}"), "");
  assert.equal(cleanCss(".a{position:fixed;top:0}"), ".a{position: absolute;top:0}", "nothing may cover the page");
  assert.ok(cleanCss(".hero{background:url(data:image/svg+xml,abc)} @keyframes x{to{rotate:1turn}}").includes("@keyframes"));
  assert.equal(cleanSvg("<svg><script>x</script></svg>"), ""); assert.equal(cleanSvg("<svg><a href=\"https://x\">x</a></svg>"), "");
  assert.match(cleanSvg("<?xml version=\"1.0\"?><svg viewBox=\"0 0 200 200\"><circle r=\"9\" fill=\"#f00\"/></svg>"), /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox/);
  const th = await makeTheme(game, { client: fakeClaude({ layout: "magazine", css: ".hero{background:#111}", mascot_svg: "<svg viewBox=\"0 0 200 200\"><rect width=\"9\" height=\"9\"/></svg>", notes: "bold" }) });
  assert.deepEqual([th.layout, th.css, th.source, th.notes], ["magazine", ".hero{background:#111}", "claude", "bold"]); assert.ok(th.svg.includes("<rect"));
  const bad = await makeTheme(game, { client: fakeClaude({ layout: "nope", css: "@import url(x)", mascot_svg: "<svg onload=\"x()\"></svg>", notes: "" }) });
  assert.equal(bad.layout, "poster"); assert.equal(bad.css, ""); assert.equal(bad.svg, "", "a bad answer falls back to the default look");
  assert.equal((await makeTheme(game, {})).source, "rules", "no key: the default look");
});

test("over HTTP: the site carries its layout, the preview serves theme.css and mascot.svg, the deploy ships them", async () => {
  const { createServer } = await import("../../route/server.mjs");
  process.env.STUDIO_PASSWORD = "correct horse";
  const { server, db } = createServer({ dbFile: ":memory:", background: false });
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = "";
  const post = async (p, b) => {
    const r = await fetch(base + p, { method: "POST", headers: { "content-type": "application/json", "x-route": "1", cookie }, body: JSON.stringify(b || {}) });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    return { status: r.status, ...(await r.json()) };
  };
  try {
    await post("/api/studio/login", { password: "correct horse" });
    const g = await post("/api/studio/generate", { idea: "a cat runner game", ticker: "RUN" });
    assert.equal(g.config.layout, "poster"); assert.equal(g.theme.layout, "poster"); assert.equal(g.theme.building, false);
    assert.match(await (await fetch(base + `/studio/p/${g.id}/theme.css`, { headers: { cookie } })).text(), /default look/);
    assert.equal((await fetch(base + `/studio/p/${g.id}/mascot.svg`, { headers: { cookie } })).status, 404);
    db.prepare("UPDATE studio_drafts SET theme = ? WHERE id = ?").run(JSON.stringify({ css: ".hero{background:#123}", svg: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 200 200\"><circle r=\"9\"/></svg>", layout: "magazine", source: "claude", notes: "" }), g.id);
    const edited = { ...g.config, mascot: true, layout: "magazine" }; db.prepare("UPDATE studio_drafts SET config = ? WHERE id = ?").run(JSON.stringify(edited), g.id);
    assert.equal(await (await fetch(base + `/studio/p/${g.id}/theme.css`, { headers: { cookie } })).text(), ".hero{background:#123}");
    const svg = await fetch(base + `/studio/p/${g.id}/mascot.svg`, { headers: { cookie } });
    assert.equal(svg.headers.get("content-type"), "image/svg+xml"); assert.match(await svg.text(), /<circle/);
    const cfg = await (await fetch(base + `/studio/p/${g.id}/config.js`, { headers: { cookie } })).text();
    assert.match(cfg, /"layout": "magazine"/); assert.match(cfg, /"mascot": true/);
    const saved = await post("/api/studio/save", { id: g.id, config: { ...edited, tagline: "New line." } });
    assert.equal(saved.config.layout, "magazine"); assert.equal(saved.config.mascot, true, "edits keep the look");
    const page = await (await fetch(base + `/studio/p/${g.id}/`, { headers: { cookie } })).text();
    assert.match(page, /href="theme\.css"/); assert.match(page, /id="mascot"/); assert.match(page, /data-layout="poster"\]/);
  } finally { server.close(); delete process.env.STUDIO_PASSWORD; }
});


// ---- big structured calls stream (2026-10-19) ---------------------------------------------------------------------
import { parseBig } from "../llm.mjs";
import { z as zz } from "zod";

test("parseBig: small requests use parse; big ones stream with the schema in the prompt and the JSON checked here", async () => {
  const S = zz.object({ a: zz.number(), b: zz.string() });
  const small = await parseBig({ messages: { parse: async r => ({ stop_reason: "end_turn", parsed_output: { a: 1, b: "x" } }) } }, { max_tokens: 1000, system: "s" }, S);
  assert.deepEqual(small.parsed, { a: 1, b: "x" });
  let seen = null;
  const big = { messages: { parse: async () => { throw new Error("must stream"); }, stream: r => { seen = r; return { finalMessage: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: "Sure:\n```json\n{\"a\": 2, \"b\": \"y\"}\n```" }] }) }; } } };
  const r = await parseBig(big, { max_tokens: 40000, system: "base", output_config: { effort: "high" } }, S);
  assert.deepEqual(r.parsed, { a: 2, b: "y" }); assert.ok(!("format" in seen.output_config) && /JSON Schema/.test(seen.system) && seen.system.startsWith("base"));
  const bad = { messages: { stream: () => ({ finalMessage: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: "{\"a\": \"no\"}" }] }) }) } };
  assert.equal((await parseBig(bad, { max_tokens: 40000 }, S)).parsed, null, "a wrong answer is null, never a crash");
});
