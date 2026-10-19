// generate.mjs — an idea in, a launchpad site config out (the shape launchpad/config.js takes).
//   ANTHROPIC_API_KEY set -> Claude writes the brand, copy, roadmap plans, FAQ and domain ideas (structured output)
//   no key / any failure   -> a rule-based writer, so the Studio always works
// Either way the result goes through honest(): no charity, donation, partnership, profit or "guaranteed" claims, and
// the parts that are FACTS (what the launchpad does today, tokenomics) are filled by code, never by the model.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { memoryText } from "./ideas.mjs";

export const FONTS = ["Bagel Fat One", "Unbounded", "Fredoka", "Bungee", "Rubik", "Lilita One", "Chakra Petch"];
const MODEL = "claude-opus-5-5";
export const VIBES = ["arcade", "neon", "candy", "retro", "clean"];   // the mood of the page: borders, glows, motion

// what every generated launchpad really does today (the "Live now" roadmap phase and the how-it-works facts)
const LIVE = ["Launch a coin on pump.fun from your own wallet", "Picture and links uploaded with the coin",
              "Optional first buy, signed in your wallet", "Your launches listed on the page"];
// a site without the launch desk: what is live is the product itself
const LIVE_PRODUCT = p => [p.kind === "game" ? `${p.name}, playable on this site` : p.kind === "combo" ? `${p.name}: the game, the tools and the launch kit on this site` : `${p.name}, usable on this site`,
                           "Contract address, chart and buy links on the site", "Lore, tokenomics, roadmap and FAQ"];

const Site = z.object({
  brand: z.string(), tagline: z.string(), about: z.string(), emoji: z.string(),
  accent: z.string(), display: z.enum(FONTS),
  ticker: z.string(), ticker_backups: z.array(z.string()),
  domains: z.array(z.string()),
  lore: z.array(z.string()),
  how: z.array(z.object({ title: z.string(), text: z.string() })),
  next: z.array(z.string()), ideas: z.array(z.string()),
  allocation: z.array(z.object({ name: z.string(), pct: z.number(), what: z.string() })), fee_source: z.string(), dev_buy_policy: z.string(),
  faq: z.array(z.object({ q: z.string(), a: z.string() })),
  kind: z.enum(["launchpad", "game", "utility", "combo"]), product_name: z.string(), mechanic: z.string(), holder_perk: z.string(),
  vibe: z.enum(VIBES),
});

const SYSTEM = `You write the brand and website copy for a coin's own website, themed around the user's idea: the site has the
coin's contract address, buy and chart links, lore, how it works, tokenomics, roadmap and FAQ, plus its product (a game,
a utility, a launchpad where people launch their own coins, or a three-in-one). The site already works; you only write
words. The owner launches the coin themselves on the launch platform of their choice.

Rules you never break:
- Write with full confidence: this is THEIR launchpad / game / tool. Never call it "just a memecoin", never add
  disclaimers, caveats or "no value" lines, never mention risk or scams. Never name pump.fun or any other platform: say
  "launch site", "launchpad", "launch a coin", "the coin".
- Only describe what the site really does (the product, the coin page). Never invent features, partners, listings,
  integrations, audits, teams or numbers; no charity or donation claims, no "a share of fees goes to…", no price, "100x",
  "moon" or "guaranteed" talk. The theme is flavor, not a promise.
- Every sentence complete and natural; plain, punchy copy. The lore is a short story about the vibe of the idea, two
  paragraphs. about: 2-4 sentences, under 380 characters.
- "next" are things the owner could build next, written as plans; "ideas" are further-out ideas. 2-4 each.
- brand: 1-2 words, catchy, easy to say. ticker: 3-10 capital letters, not an everyday word, related to the brand.
- domains: 6 short domain names for the brand (.fun .lol .xyz .app .io .com), no hyphens.
- accent: one hex color that fits the theme, readable with dark text on it. display: the font that fits best.
- how: 3 or 4 steps of using the launchpad, each with a short title and one sentence.
- faq: 4 to 6 questions a first-time visitor would ask, answered truthfully from the rules above.
- allocation: where the money goes, 3-5 buckets that add up to 100 (e.g. product / the game, marketing, community &
  holder perks, team), each with "what" it pays for in one sentence, tuned to the kind (a game spends on the game, a
  launchpad on launch incentives and featured slots, a utility on the tool). fee_source: what is being split, e.g.
  "Creator fees from trading" (the share of trading fees the launch platform pays the coin's creator). dev_buy_policy:
  one sentence on the dev's launch buy and how it is held (e.g. "a small public launch buy, held through the roadmap").
  Never claim a team allocation of supply; the supply is public from the first second.
- emoji: one emoji for the brand. vibe: the page's mood: "arcade" (chunky, playful), "neon" (glowing, dark), "candy"
  (round, bright), "retro" (pixel-era), "clean" (minimal).
- kind: "game" or "utility" when the idea is a game or tool, "combo" when it is a game + tool + launchpad in one (a
  three-in-one), else "launchpad". product_name: the game's or tool's name. mechanic: two or three sentences on what a
  visitor does in it (for a combo: what each of the three parts does and how they connect). holder_perk: one perk for HOLDING the coin
  (badge, cosmetic, leaderboard spot, early access) — never payouts, airdrops, staking or price talk; may be "".
  The site keeps its working pump.fun launch form either way; the product is the extra reason to visit.`;

const BANNED = /\b(donat\w*|charit\w*|non-?profit|proceeds|partner(ed|ship|s)?|guarantee\w*|risk[- ]free|100x|1000x|to the moon|moon(ing)?|passive income|returns?|profit\w*|audited|airdrop\w*|staking|yield|apy)\b/i;
const clean = (t, max = 400) => String(t || "").replace(/\s+/g, " ").trim().slice(0, max);
// cut at a sentence, never mid-word: whole sentences that fit; else the longest run of whole words
const fitText = (t, max) => {
  t = clean(t, 5000); if (t.length <= max) return t;
  let out = "";
  for (const p of t.split(/(?<=[.!?])\s+/)) { const next = (out + " " + p).trim(); if (next.length > max) break; out = next; }
  if (out) return out;
  const cut = t.slice(0, max), sp = cut.lastIndexOf(" ");
  return cut.slice(0, sp > max * 0.5 ? sp : max).replace(/[,;:\s-]+$/, "") + "…";
};
// a sentence with a banned claim is dropped, not reworded: the copy stays true
const dropClaims = t => clean(t, 2000).split(/(?<=[.!?])\s+/).filter(x => x && !BANNED.test(x)).join(" ").slice(0, 600);

export function honest(raw, idea, opts = {}) {
  const brand = clean(raw.brand, 24).replace(/[^\p{L}\p{N} .'-]/gu, "") || "Launchpad";
  const ticker = (opts.ticker || raw.ticker || brand).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "PAD";
  const accent = /^#[0-9a-f]{6}$/i.test(opts.accent || raw.accent || "") ? (opts.accent || raw.accent) : "#ff6a2b";
  const removed = [];
  const keep = (t, max) => { const out = dropClaims(t); if (clean(t, 2000).length > out.length + 5) removed.push(clean(t, 120)); return fitText(out, max); };
  const cfg = {
    brand,
    tagline: keep(raw.tagline, 90) || `Launch a coin with ${brand}.`,
    about: keep(raw.about, 380) || `${brand} is a launch site with its own coin. Launch from your own wallet; your keys never leave it.`,
    emoji: [...String(raw.emoji || "🚀")][0] || "🚀",
    colors: { accent, accentInk: inkFor(accent), light: "#fff8f1", dark: "#140f22" },
    display: FONTS.includes(raw.display) ? raw.display : "Bagel Fat One",
    maxDevBuySol: 5, defaultDevBuySol: 0.1,
    coin: { ticker, ca: "", x: clean(opts.x, 200) || "", telegram: clean(opts.telegram, 200) || "", devBuyPercent: null,
            buyUrl: /^https:\/\//.test(opts.buyUrl || "") ? clean(opts.buyUrl, 300) : "", launchedOn: clean(opts.launchedOn, 60) || "" },
    lore: (raw.lore || []).map(t => keep(t, 700)).filter(Boolean).slice(0, 3),
    how: (raw.how || []).map(h => ({ title: keep(h.title, 40), text: keep(h.text, 160) })).filter(h => h.title && h.text).slice(0, 4),
    vibe: VIBES.includes(raw.vibe) ? raw.vibe : ({ game: "arcade", combo: "arcade", utility: "clean" }[raw.kind] || "candy"),
    // the launch desk (launching on pump.fun from this very page) is off unless the owner turns it on: the site is the
    // coin's home and its product; the owner launches the token wherever they launch
    launchDesk: opts.launchDesk != null ? !!opts.launchDesk : false,
    tokenomics: tokenomics(raw, keep),
    roadmap: [
      { status: "live", title: `${brand}, the launchpad`, items: LIVE },
      { status: "next", title: "Building next", items: (raw.next || []).map(t => keep(t, 90)).filter(Boolean).slice(0, 4) },
      { status: "idea", title: "Further out", items: (raw.ideas || []).map(t => keep(t, 90)).filter(Boolean).slice(0, 4) },
    ].filter(p => p.items.length),
    product: {
      kind: ["launchpad", "game", "utility", "combo"].includes(raw.kind) ? raw.kind : "launchpad",
      name: keep(raw.product_name, 40) || brand,
      mechanic: keep(raw.mechanic, 500),
      holderPerk: keep(raw.holder_perk, 200),
      app: false,
    },
    faq: [
      ...(raw.faq || []).map(f => ({ q: keep(f.q, 120), a: keep(f.a, 400) })).filter(f => f.q && f.a).slice(0, 5),
      { q: `Do I need $${ticker} to use ${brand}?`, a: `No. ${brand} is free to use; holding $${ticker} unlocks the holder perks.` },
    ],
  };
  if (!cfg.launchDesk) {
    cfg.roadmap[0] = { status: "live", title: `${brand}, live now`, items: LIVE_PRODUCT({ ...cfg.product, name: cfg.product.name || brand }) };
    cfg.how = cfg.how.filter(h => !/launch(pad)? on pump\.fun|builds the launch/i.test(h.title + " " + h.text));
  }
  if (!cfg.how.length) cfg.how = cfg.launchDesk ? HOW(brand) : HOW_PRODUCT(brand, cfg.product);
  const extra = {
    idea: clean(idea, 500),
    tickerBackups: (raw.ticker_backups || []).map(t => String(t).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)).filter(Boolean).slice(0, 4),
    domains: (raw.domains || []).map(d => String(d).toLowerCase().replace(/^https?:\/\//, "").replace(/[^a-z0-9.-]/g, ""))
      .filter(d => /^[a-z0-9]{2,40}\.[a-z]{2,10}$/.test(d)).slice(0, 6),
    removed,
  };
  return { config: cfg, ...extra };
}

// where the money goes: the creator-fee split, by kind, unless the writer (or the owner) set one that adds up
export const ALLOC = {
  game: [["The game", 40, "New levels, modes, skins and the servers behind the leaderboard."], ["Marketing", 30, "Creators, clips, contests and placements that bring players in."], ["Community & holder perks", 20, "Prizes for score contests, holder skins and events."], ["Team", 10, "The people building it."]],
  utility: [["The tool", 45, "Features, data, uptime and polish."], ["Marketing", 25, "Getting the tool in front of the people who need it."], ["Community & holder perks", 15, "Holder-only features and community rewards."], ["Team", 15, "The people building it."]],
  launchpad: [["The launchpad", 30, "The site, new launch features and templates."], ["Marketing", 35, "Bringing launchers and traders to the pad."], ["Launch incentives", 25, "Featured slots, contests and prizes for the best launches."], ["Team", 10, "The people building it."]],
  combo: [["The product", 40, "The game, the tools and the launch kit on the site."], ["Marketing", 30, "Creators, clips, contests and placements."], ["Community & holder perks", 20, "Score prizes, featured slots and holder skins."], ["Team", 10, "The people building it."]],
};
export function tokenomics(raw, keep = (t, n) => clean(t, n)) {
  const kind = ["launchpad", "game", "utility", "combo"].includes(raw.kind) ? raw.kind : "launchpad";
  let alloc = (raw.allocation || []).map(a => ({ name: clean(a.name, 40), pct: Math.round(Number(a.pct) || 0), what: keep(a.what, 160) })).filter(a => a.name && a.pct > 0).slice(0, 6);
  if (alloc.length < 2 || alloc.reduce((n, a) => n + a.pct, 0) !== 100) alloc = ALLOC[kind].map(([name, pct, what]) => ({ name, pct, what }));
  return { source: keep(raw.fee_source, 80) || "Creator fees from trading", allocation: alloc,
           devBuyPolicy: keep(raw.dev_buy_policy, 160) || "A small, public launch buy, held through the roadmap." };
}
function inkFor(hex) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 140 ? "#1d1530" : "#ffffff";
}
const HOW_PRODUCT = (brand, p) => [
  { title: p.kind === "game" ? "Play" : "Open it", text: p.mechanic ? clean(p.mechanic, 160) : `${p.name || brand} runs right here on the site, no wallet needed.` },
  { title: "Hold the coin, or don't", text: `$${brand.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)} is the community coin; the site works without it.` },
  { title: "Share your result", text: "Copy your score or card and post it." },
];
const HOW = brand => [
  { title: "Connect your wallet", text: "Phantom, Solflare or Backpack. Your keys never leave it." },
  { title: "Make your coin", text: "A name, a ticker, a picture and your links." },
  { title: "Launch it", text: `${brand} builds the launch; you approve it in your wallet.` },
];

// ---- without a model: a plain, honest writer from the idea's own words
const STOP = new Set("a an the for of to and with that this my our your launchpad launch pad coin coins token tokens memecoin app site website on in about".split(" "));
export function rules(idea) {
  const words = String(idea || "").toLowerCase().match(/[a-z]{3,}/g) || [];
  const key = words.find(w => !STOP.has(w)) || "moon";
  const brand = key[0].toUpperCase() + key.slice(1, 8) + (key.length > 5 ? "Pad" : "pad");
  const theme = words.filter(w => !STOP.has(w)).slice(0, 4).join(" ") || key;
  const t = brand.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8);
  return {
    brand, tagline: `Launch a coin for the ${theme} crowd.`, emoji: "🚀", accent: "#ff6a2b", display: "Bagel Fat One",
    about: `${brand} is the launch site for ${theme}. Launch a coin from your own wallet in a minute, then let the ${theme} crowd find it.`,
    ticker: t, ticker_backups: [t.slice(0, 5) + "PAD", "GO" + t.slice(0, 6)],
    domains: [brand.toLowerCase() + ".fun", brand.toLowerCase() + ".lol", "get" + brand.toLowerCase() + ".xyz",
              brand.toLowerCase() + ".app", "launch" + key + ".fun", brand.toLowerCase() + ".io"],
    lore: [`Every corner of the internet has its ${theme} people. They kept asking for one place to launch their coins.`,
           `${brand} is that place: pick a name, drop a picture, launch from your own wallet, and let the ${theme} crowd find it.`],
    how: HOW(brand), next: ["A page of the newest launches", "Share cards for X"], ideas: ["Themed launch weeks"],
    kind: /three-in-one|\bcombo\b|game \+ utility|game, utility,? and launchpad/i.test(idea) ? "combo" : /\b(game|play|runner|arcade|quiz|puzzle)\b/i.test(idea) ? "game" : /\b(tool|utility|tracker|generator|calculator|bot)\b/i.test(idea) ? "utility" : "launchpad",
    product_name: brand, mechanic: "", holder_perk: "",
    faq: [{ q: `What is ${brand}?`, a: `The launch site for ${theme}: launch coins from your own wallet, themed around ${theme}.` },
          { q: "Does it hold my SOL or keys?", a: "No. Every launch is signed in your own wallet." }],
  };
}

// the brand or the ticker changed: every piece of copy follows (FAQ, about, lore, how, product, roadmap)
export function rename(cfg, from, to) {
  const out = JSON.parse(JSON.stringify(cfg));
  const subs = [];
  if (from.brand && to.brand && from.brand !== to.brand) subs.push([new RegExp(from.brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), to.brand]);
  if (from.ticker && to.ticker && from.ticker !== to.ticker) subs.push([new RegExp("\\$?\\b" + from.ticker + "\\b", "g"), m => (m.startsWith("$") ? "$" : "") + to.ticker]);
  if (!subs.length) return out;
  const fix = v => typeof v === "string" ? subs.reduce((s, [re, r]) => s.replace(re, r), v) : Array.isArray(v) ? v.map(fix) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fix(x)])) : v;
  for (const k of ["tagline", "about", "lore", "how", "roadmap", "faq", "product"]) out[k] = fix(out[k]);
  out.brand = to.brand || out.brand; out.coin.ticker = to.ticker || out.coin.ticker;
  return out;
}

export async function generate(idea, opts = {}, client = null) {
  const text = clean(idea, 500);
  if (text.length < 3) throw Object.assign(new Error("Describe the idea in a few words."), { status: 400 });
  let raw = null, source = "rules", note = null;
  const key = process.env.ANTHROPIC_API_KEY;
  if (client || key) {
    try {
      const c = client || new Anthropic();
      const response = await c.messages.parse({
        model: MODEL,
        max_tokens: 16000,
        output_config: { effort: "medium", format: zodOutputFormat(Site) },
        system: SYSTEM,
        messages: [{ role: "user", content: `The idea:\n${text}` +
          (opts.ticker ? `\nThe owner wants the ticker $${opts.ticker}.` : "") +
          (opts.intel ? `\n\nWhat the Studio knows about launches right now (use it for the angle, the copy and the FAQ; never copy a live coin):\n${opts.intel}` : "") +
          (memoryText(opts.mem) ? `\n\nWhat this builder liked, disliked and launched before (lean toward what worked):\n${memoryText(opts.mem)}` : "") }],
      });
      if (response.stop_reason === "refusal") note = "The model declined this idea; the plain writer was used.";
      else if (response.parsed_output) { raw = response.parsed_output; source = "claude"; }
      else note = "The model's answer could not be read; the plain writer was used.";
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) note = "ANTHROPIC_API_KEY was rejected; the plain writer was used.";
      else if (e instanceof Anthropic.RateLimitError) note = "Claude is rate-limited right now; the plain writer was used.";
      else if (e instanceof Anthropic.APIError) note = `Claude answered ${e.status}; the plain writer was used.`;
      else note = "Claude could not be reached; the plain writer was used.";
    }
  }
  const out = honest(raw || rules(text), text, opts);
  return { ...out, source, note };
}
