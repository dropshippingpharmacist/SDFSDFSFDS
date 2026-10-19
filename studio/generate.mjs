// generate.mjs — an idea in, a launchpad site config out (the shape launchpad/config.js takes).
//   ANTHROPIC_API_KEY set -> Claude writes the brand, copy, roadmap plans, FAQ and domain ideas (structured output)
//   no key / any failure   -> a rule-based writer, so the Studio always works
// Either way the result goes through honest(): no charity, donation, partnership, profit or "guaranteed" claims, and
// the parts that are FACTS (what the launchpad does today, tokenomics) are filled by code, never by the model.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

export const FONTS = ["Bagel Fat One", "Unbounded", "Fredoka", "Bungee", "Rubik", "Lilita One", "Chakra Petch"];
const MODEL = "claude-opus-5-5";

// what every generated launchpad really does today (the "Live now" roadmap phase and the how-it-works facts)
const LIVE = ["Launch a coin on pump.fun from your own wallet", "Picture and links uploaded with the coin",
              "Optional first buy, signed in your wallet", "Your launches listed on the page"];

const Site = z.object({
  brand: z.string(), tagline: z.string(), about: z.string(), emoji: z.string(),
  accent: z.string(), display: z.enum(FONTS),
  ticker: z.string(), ticker_backups: z.array(z.string()),
  domains: z.array(z.string()),
  lore: z.array(z.string()),
  how: z.array(z.object({ title: z.string(), text: z.string() })),
  next: z.array(z.string()), ideas: z.array(z.string()),
  faq: z.array(z.object({ q: z.string(), a: z.string() })),
});

const SYSTEM = `You write the brand and website copy for a memecoin launchpad: a website where anyone launches a coin on
pump.fun from their own wallet, themed around the user's idea. The launchpad already works; you only write words.

Rules you never break:
- Only describe what the site really does: launching pump.fun coins from your own wallet, with a picture, links and an
  optional first buy. Never invent features, partners, integrations, audits, teams, or numbers.
- No charity or donation claims, no "a share of fees goes to…", no profit, price, "100x", "moon" or "guaranteed" talk.
  The theme is flavor, not a promise.
- Plain, punchy copy. The lore is a short story about the vibe of the idea, two paragraphs.
- "next" are things the owner could build next, written as plans; "ideas" are further-out ideas. 2-4 each.
- brand: 1-2 words, catchy, easy to say. ticker: 3-10 capital letters, not an everyday word, related to the brand.
- domains: 6 short domain names for the brand (.fun .lol .xyz .app .io .com), no hyphens.
- accent: one hex color that fits the theme, readable with dark text on it. display: the font that fits best.
- how: 3 or 4 steps of using the launchpad, each with a short title and one sentence.
- faq: 4 to 6 questions a first-time visitor would ask, answered truthfully from the rules above.
- emoji: one emoji for the brand.`;

const BANNED = /\b(donat\w*|charit\w*|non-?profit|proceeds|partner(ed|ship|s)?|guarantee\w*|risk[- ]free|100x|1000x|to the moon|moon(ing)?|passive income|returns?|profit\w*|audited|airdrop\w*|staking|yield|apy)\b/i;
const clean = (t, max = 400) => String(t || "").replace(/\s+/g, " ").trim().slice(0, max);
// a sentence with a banned claim is dropped, not reworded: the copy stays true
const dropClaims = t => clean(t, 2000).split(/(?<=[.!?])\s+/).filter(x => x && !BANNED.test(x)).join(" ").slice(0, 600);

export function honest(raw, idea, opts = {}) {
  const brand = clean(raw.brand, 24).replace(/[^\p{L}\p{N} .'-]/gu, "") || "Launchpad";
  const ticker = (opts.ticker || raw.ticker || brand).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "PAD";
  const accent = /^#[0-9a-f]{6}$/i.test(opts.accent || raw.accent || "") ? (opts.accent || raw.accent) : "#ff6a2b";
  const removed = [];
  const keep = (t, max) => { const out = dropClaims(t); if (clean(t, 2000).length > out.length + 5) removed.push(clean(t, 120)); return clean(out, max); };
  const cfg = {
    brand,
    tagline: keep(raw.tagline, 90) || `Launch a coin with ${brand}.`,
    about: keep(raw.about, 260) || `${brand} launches real coins on pump.fun from your own wallet. Your keys and your SOL never touch our servers.`,
    emoji: [...String(raw.emoji || "🚀")][0] || "🚀",
    colors: { accent, accentInk: inkFor(accent), light: "#fff8f1", dark: "#140f22" },
    display: FONTS.includes(raw.display) ? raw.display : "Bagel Fat One",
    maxDevBuySol: 5, defaultDevBuySol: 0.1,
    coin: { ticker, ca: "", x: clean(opts.x, 200) || "", telegram: clean(opts.telegram, 200) || "", devBuyPercent: null },
    lore: (raw.lore || []).map(t => keep(t, 600)).filter(Boolean).slice(0, 3),
    how: (raw.how || []).map(h => ({ title: keep(h.title, 40), text: keep(h.text, 160) })).filter(h => h.title && h.text).slice(0, 4),
    roadmap: [
      { status: "live", title: `${brand}, the launchpad`, items: LIVE },
      { status: "next", title: "Building next", items: (raw.next || []).map(t => keep(t, 90)).filter(Boolean).slice(0, 4) },
      { status: "idea", title: "Further out", items: (raw.ideas || []).map(t => keep(t, 90)).filter(Boolean).slice(0, 4) },
    ].filter(p => p.items.length),
    faq: [
      ...(raw.faq || []).map(f => ({ q: keep(f.q, 120), a: keep(f.a, 400) })).filter(f => f.q && f.a).slice(0, 5),
      { q: `Do I need $${ticker} to use ${brand}?`, a: `No. The launchpad works for anyone with a Solana wallet.` },
      { q: "Is this financial advice?", a: "No. Memecoins can go to zero in minutes. Only spend what you can afford to lose." },
    ],
  };
  if (!cfg.how.length) cfg.how = HOW(brand);
  const extra = {
    idea: clean(idea, 500),
    tickerBackups: (raw.ticker_backups || []).map(t => String(t).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)).filter(Boolean).slice(0, 4),
    domains: (raw.domains || []).map(d => String(d).toLowerCase().replace(/^https?:\/\//, "").replace(/[^a-z0-9.-]/g, ""))
      .filter(d => /^[a-z0-9]{2,40}\.[a-z]{2,10}$/.test(d)).slice(0, 6),
    removed,
  };
  return { config: cfg, ...extra };
}

function inkFor(hex) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 140 ? "#1d1530" : "#ffffff";
}
const HOW = brand => [
  { title: "Connect your wallet", text: "Phantom, Solflare or Backpack. Your keys never leave it." },
  { title: "Make your coin", text: "A name, a ticker, a picture and your links." },
  { title: "Launch on pump.fun", text: `${brand} builds the launch; you approve it in your wallet.` },
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
    about: `${brand} is a pump.fun launchpad for ${theme}. Launch a coin from your own wallet in a minute.`,
    ticker: t, ticker_backups: [t.slice(0, 5) + "PAD", "GO" + t.slice(0, 6)],
    domains: [brand.toLowerCase() + ".fun", brand.toLowerCase() + ".lol", "get" + brand.toLowerCase() + ".xyz",
              brand.toLowerCase() + ".app", "launch" + key + ".fun", brand.toLowerCase() + ".io"],
    lore: [`Every corner of the internet has its ${theme} people. They kept asking for one place to launch their coins.`,
           `${brand} is that place: pick a name, drop a picture, launch on pump.fun from your own wallet, and let the ${theme} crowd find it.`],
    how: HOW(brand), next: ["A page of the newest launches", "Share cards for X"], ideas: ["Themed launch weeks"],
    faq: [{ q: `What is ${brand}?`, a: `A website for launching coins on pump.fun from your own wallet, themed around ${theme}.` },
          { q: "Does it hold my SOL or keys?", a: "No. Every launch is signed in your own wallet." }],
  };
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
        messages: [{ role: "user", content: `The launchpad idea:\n${text}` +
          (opts.ticker ? `\nThe owner wants the ticker $${opts.ticker}.` : "") }],
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
