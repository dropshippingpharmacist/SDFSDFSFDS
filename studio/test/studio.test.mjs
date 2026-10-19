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
