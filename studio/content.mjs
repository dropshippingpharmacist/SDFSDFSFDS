// content.mjs — the content kit for a site: the X profile picture, the X banner, the coin's launch picture, three
// videos (an intro and two follow-ups), the posts to go with them and exactly how to post.
//   plan:    Claude writes the bio, the visual briefs, the video scripts (scenes) and the posts (structured output);
//            without a key a rule-based plan is used.
//   visuals: every picture and video is an HTML page in the brand's colors and font. Claude writes it from the brief;
//            if it fails any check the built-in template is used, so the kit is always complete. render.mjs turns the
//            pages into PNGs and MP4s.
// Nothing here promises anything: the posts pass the same honesty filter as the sites.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { withRetry, why } from "./llm.mjs";

const MODEL = "claude-opus-5-5";
const clean = (t, n = 300) => String(t || "").replace(/\s+/g, " ").trim().slice(0, n);
const BANNED = /\b(donat\w*|charit\w*|partner(ed|ship|s)?|guarantee\w*|risk[- ]free|100x|1000x|to the moon|passive income|profit\w*|dividend\w*|revenue share|airdrop\w*|staking|yield|apy|financial advice|not a scam)\b/i;
const dropClaims = t => clean(t, 1000).split(/(?<=[.!?])\s+/).filter(x => x && !BANNED.test(x)).join(" ");

export const SIZES = { pfp: [400, 400], banner: [1500, 500], launch: [1000, 1000], video: [1080, 1080] };
export const VIDEOS = [
  { key: "intro", title: "Intro", seconds: 25, purpose: "what this is, in 25 seconds: the mascot, the one-line pitch, the product, the ticker, the call to the site" },
];
export const IMAGES = ["pfp", "banner"];

const Plan = z.object({
  bio: z.string(), name_on_x: z.string(),
  pfp_brief: z.string(), banner_brief: z.string(), launch_image_brief: z.string(),
  videos: z.array(z.object({ key: z.string(), hook: z.string(), scenes: z.array(z.object({ seconds: z.number(), headline: z.string(), sub: z.string(), visual: z.string() })), end_card: z.string() })),
  posts: z.array(z.object({ when: z.string(), media: z.string(), text: z.string() })),
  pinned: z.string(), reply_with_ca: z.string(),
});

const SYSTEM = `You are the content lead for a memecoin's launch on X. You get the coin's site config (brand, ticker, tagline, lore,
product) and write the launch content: the X bio and display name, briefs for the profile picture, the banner and the
coin's launch picture, three short videos as scene lists, and the posts.

Rules you never break:
- Confident, bullish, hype: this is a launch. Everything is about the coin, the mascot, the product and the moment.
  Never add disclaimers, caveats or "no promised value" lines; never mention risk, rugs or scams.
- Still no invented facts: no price targets or "100x", no guarantees, no partnerships, listings, charity, airdrops,
  staking or revenue share that do not exist. Hype the real thing: the product, the community, the launch.
- ONE video, key "intro", for X: square, 20-25 seconds, 5-7 scenes, each a few seconds with a big headline (2-6
  words) and a short sub line (one sentence max). "visual" says what moves on screen (mascot, particles, chart-shaped
  joke, the product's UI). Hook in the first 2 seconds; the product and the ticker in the middle; end card: the site's
  call to action (never a price).
- Posts: exactly 4, in order: 1 the intro video (launch day, before the token goes live), 2 a product post with a
  screenshot of the game / tool (a few hours after, once the contract address exists), 3 a "why now" post (next
  day), 4 a text-only community post (day 2-3).
  Each post text under 260 characters, no hashtags spam (at most 2), no "$" tickers except the coin's own, written like a
  person, not a brand. "media" names which video or image goes with it.
- pinned: the pinned post text (under 260 chars) with [CA] where the contract address will be pasted and [SITE] for the
  site link. reply_with_ca: the first reply under the intro post, with [CA].
- bio: under 160 characters, with [SITE]. name_on_x: the display name (brand + emoji, no ticker).
- Briefs describe a clean, bold graphic in the brand's accent color with its emoji as the mascot, legible at a glance.`;

export async function planContent(cfg, { client = null } = {}) {
  let raw = null, source = "rules", note = null;
  if (client || process.env.ANTHROPIC_API_KEY) {
    try {
      const c = client || new Anthropic();
      const r = await withRetry(() => c.messages.parse({ model: MODEL, max_tokens: 16000, output_config: { effort: "high", format: zodOutputFormat(Plan) }, system: SYSTEM,
        messages: [{ role: "user", content: "The site:\n" + JSON.stringify({ brand: cfg.brand, ticker: cfg.coin?.ticker, emoji: cfg.emoji, tagline: cfg.tagline, about: cfg.about,
          lore: cfg.lore, product: cfg.product, roadmap: cfg.roadmap, vibe: cfg.vibe }, null, 1).slice(0, 6000) + "\n\nWrite the content kit." }] }));
      if (r.stop_reason === "refusal") note = "The model declined; the plain plan was used.";
      else if (r.parsed_output) { raw = r.parsed_output; source = "claude"; }
    } catch (e) { note = `${why(e)}; the plain plan was used.`; }
  }
  return { plan: honestPlan(raw || rulesPlan(cfg), cfg), source, note };
}

export function rulesPlan(cfg) {
  const b = cfg.brand, tk = "$" + cfg.coin?.ticker, p = cfg.product || {}, kind = p.kind || "launchpad";
  const what = kind === "game" ? "a game you can play right now" : kind === "utility" ? "a tool you can use right now" : kind === "combo" ? "a game, a tool and a launchpad on one page" : "a launchpad";
  return {
    bio: `${cfg.tagline} ${what}. [SITE]`, name_on_x: `${b} ${cfg.emoji}`,
    pfp_brief: `${cfg.emoji} big and centered on a ${cfg.colors?.accent} circle with a thick dark ring.`,
    banner_brief: `${b} in the display font on the left, the tagline under it, a field of small ${cfg.emoji} fading to the right.`,
    launch_image_brief: `${cfg.emoji} huge, ${tk} under it in the display font, accent background, dark border.`,
    videos: [
      { key: "intro", hook: `${b} is here`, scenes: [{ seconds: 3, headline: `${b} ${cfg.emoji}`, sub: cfg.tagline, visual: "mascot pops in, particles" },
        { seconds: 5, headline: "What it is", sub: clean(cfg.about, 120), visual: "text over drifting emoji" },
        { seconds: 6, headline: kind === "game" ? "Play it now" : kind === "utility" ? "Use it now" : "Try it now", sub: clean(p.mechanic || cfg.tagline, 120), visual: "a stylized screen of the product" },
        { seconds: 6, headline: tk, sub: `${b} is live. Site in bio.`, visual: "ticker chip pulses" }], end_card: "Link in bio" },
      { key: "product", hook: `${p.name || b}, in 15 seconds`, scenes: [{ seconds: 4, headline: p.name || b, sub: clean(p.mechanic || cfg.tagline, 110), visual: "product title" },
        { seconds: 6, headline: "How it works", sub: clean((cfg.how || [])[0]?.text || cfg.about, 110), visual: "three steps slide in" },
        { seconds: 5, headline: p.holderPerk ? "Holder perk" : "Free to use", sub: clean(p.holderPerk || "No wallet needed to play.", 110), visual: "badge glows" }], end_card: "Play on the site" },
      { key: "why", hook: "Why now", scenes: [{ seconds: 5, headline: "The lore", sub: clean((cfg.lore || [])[0], 120), visual: "story text" },
        { seconds: 5, headline: "Building next", sub: clean(((cfg.roadmap || []).find(r => r.status === "next") || { items: [] }).items.join(" · "), 110), visual: "roadmap line draws" },
        { seconds: 5, headline: `Come ${kind === "game" ? "play" : "see"}`, sub: cfg.tagline, visual: "mascot waves" }], end_card: "Link in bio" },
    ],
    posts: [
      { when: "Launch day, 1 hour before the token goes live", media: "intro video", text: `${b} ${cfg.emoji} is live. ${cfg.tagline} ${what.charAt(0).toUpperCase() + what.slice(1)}. Site in bio.` },
      { when: "Launch day, a few hours after the contract address exists", media: "a screenshot of the product", text: `${p.name || b}: ${clean(p.mechanic || cfg.about, 150)} Free. On the site.` },
      { when: "Day 2", media: "none", text: `Why ${b} exists: ${clean((cfg.lore || [])[0] || cfg.about, 150)}` },
      { when: "Day 2-3", media: "none", text: `Post your ${kind === "game" ? "best score" : "card"} from the ${b} site below. Top ones get pinned.` },
    ],
    pinned: `${b} ${cfg.emoji}\n${cfg.tagline}\nSite: [SITE]\nCA: [CA]`,
    reply_with_ca: `CA: [CA]\nOnly buy from this address. Site: [SITE]`,
  };
}

function honestPlan(raw, cfg) {
  const vids = VIDEOS.map(v => {
    const r = (raw.videos || []).find(x => x.key === v.key) || {};
    const scenes = (r.scenes || []).map(s => ({ seconds: Math.max(2, Math.min(8, Number(s.seconds) || 4)), headline: dropClaims(clean(s.headline, 60)), sub: dropClaims(clean(s.sub, 140)), visual: clean(s.visual, 160) }))
      .filter(s => s.headline).slice(0, 6);
    return { ...v, hook: dropClaims(clean(r.hook, 80)), scenes: scenes.length ? scenes : rulesPlan(cfg).videos.find(x => x.key === v.key).scenes, endCard: dropClaims(clean(r.end_card, 80)) || "Link in bio" };
  });
  return {
    bio: dropClaims(clean(raw.bio, 160)), nameOnX: clean(raw.name_on_x, 50) || cfg.brand,
    briefs: { pfp: clean(raw.pfp_brief, 300), banner: clean(raw.banner_brief, 300), launch: clean(raw.launch_image_brief, 300) },
    videos: vids,
    posts: (raw.posts || []).slice(0, 4).map(p => ({ when: clean(p.when, 120), media: clean(p.media, 40), text: dropClaims(clean(p.text, 270)) })).filter(p => p.text),
    pinned: dropClaims(clean(raw.pinned, 300)), replyWithCa: dropClaims(clean(raw.reply_with_ca, 200)),
  };
}

// ---- the visuals: HTML pages. Templates first (always work), then Claude's own version if it passes the checks.
const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const font = cfg => `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(cfg.display || "Bagel Fat One").replace(/%20/g, "+")}&family=Figtree:wght@600;800&display=swap">`;
const base = (cfg, w, h, body, css = "") => `<!doctype html><html><head><meta charset="utf-8">${font(cfg)}<style>
html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:${cfg.colors?.accent || "#ff6a2b"};color:${cfg.colors?.dark || "#140f22"};font-family:Figtree,system-ui,sans-serif}
.d{font-family:"${esc(cfg.display || "Bagel Fat One")}","Arial Black",sans-serif}${css}</style></head><body>${body}</body></html>`;

export function templateImage(kind, cfg) {
  const [w, h] = SIZES[kind], ink = cfg.colors?.dark || "#140f22", acc = cfg.colors?.accent || "#ff6a2b", light = cfg.colors?.light || "#fff8f1";
  const em = esc(cfg.emoji || "🚀"), tk = "$" + esc(cfg.coin?.ticker || "COIN");
  if (kind === "pfp") return base(cfg, w, h, `<div style="position:absolute;inset:18px;border-radius:50%;background:${light};border:14px solid ${ink};display:grid;place-items:center;font-size:210px;line-height:1">${em}</div>`);
  if (kind === "launch") return base(cfg, w, h, `<div style="position:absolute;inset:40px;border-radius:80px;background:${light};border:22px solid ${ink};display:grid;place-items:center;align-content:center;gap:10px">
    <div style="font-size:430px;line-height:1">${em}</div><div class="d" style="font-size:120px;letter-spacing:.02em">${tk}</div></div>`);
  const dots = Array.from({ length: 60 }, (_, i) => `<span style="position:absolute;left:${55 + ((i * 37) % 45)}%;top:${((i * 53) % 100)}%;font-size:${26 + (i % 5) * 10}px;opacity:${.15 + (i % 4) * .15};transform:rotate(${(i * 29) % 60 - 30}deg)">${em}</span>`).join("");
  return base(cfg, w, h, `<div style="position:absolute;inset:0;background:linear-gradient(100deg,${acc} 48%,transparent 90%)"></div>${dots}
    <div style="position:absolute;left:70px;top:0;height:100%;display:grid;align-content:center;gap:14px;max-width:60%">
      <div class="d" style="font-size:112px;line-height:1">${em} ${esc(cfg.brand)}</div><div style="font-size:40px;font-weight:800;color:${ink}">${esc(cfg.tagline)}</div>
      <div style="font-size:28px;font-weight:800;opacity:.75">${tk}</div></div>`);
}

// the template video: scenes from the plan, drawn on a canvas by render(t)
export function templateVideo(video, cfg) {
  const [w, h] = SIZES.video;
  const data = JSON.stringify({ scenes: video.scenes, end: video.endCard, brand: cfg.brand, ticker: "$" + (cfg.coin?.ticker || ""), emoji: cfg.emoji || "🚀",
                                acc: cfg.colors?.accent || "#ff6a2b", ink: cfg.colors?.dark || "#140f22", light: cfg.colors?.light || "#fff8f1", display: cfg.display || "Bagel Fat One" });
  const total = video.scenes.reduce((n, s) => n + s.seconds, 0) + 3;
  return `<!doctype html><html><head><meta charset="utf-8">${font(cfg)}<style>html,body{margin:0;background:#000}canvas{display:block}</style></head>
<body><canvas id="c" width="${w}" height="${h}"></canvas><script>
const D = ${data}; const W = ${w}, H = ${h}; const c = document.getElementById("c"), x = c.getContext("2d");
window.DURATION = ${total};
const ease = t => t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3);
function elastic(t) { t = Math.max(0, Math.min(1, t)); return 1 - Math.pow(2, -8 * t) * Math.cos(t * 10) * (1 - t); }
const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };   // deterministic scatter
const parts = Array.from({ length: 70 }, (_, i) => ({ x: hash(i), y: hash(i + 100), z: 0.3 + hash(i + 200) * 0.7, s: 0.5 + hash(i + 300), e: i % 5 === 0 }));
function wrap(text, maxW, size) { x.font = "800 " + size + "px Figtree, system-ui"; const words = String(text).split(" "), lines = []; let l = "";
  for (const wd of words) { const t = l ? l + " " + wd : wd; if (x.measureText(t).width > maxW && l) { lines.push(l); l = wd; } else l = t; } if (l) lines.push(l); return lines; }
function scene(t) { let a = 0; for (const s of D.scenes) { if (t < a + s.seconds) return { s, local: t - a }; a += s.seconds; } return { s: null, local: t - a }; }
window.render = function (t) {
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, D.acc); g.addColorStop(1, shade(D.acc, -0.35)); x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (const p of parts) { const py = ((p.y - t * 0.03 * p.s * p.z) % 1 + 1) % 1, px = (p.x + Math.sin(t * 0.5 + p.x * 9) * 0.01 * p.z);
    x.save(); x.globalAlpha = 0.12 + p.z * 0.4; x.translate(px * W, py * H); x.rotate(Math.sin(t * p.s + p.x * 6) * 0.5);
    if (p.e) { x.font = Math.round(60 * p.z) + "px system-ui"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(D.emoji, 0, 0); }
    else { x.fillStyle = D.light; x.beginPath(); x.arc(0, 0, 5 * p.z, 0, 6.3); x.fill(); } x.restore(); }
  const { s, local } = scene(t);
  x.textAlign = "center"; x.textBaseline = "middle";
  if (s) {
    const k = elastic(local / 0.6), out = s.seconds - local < 0.4 ? ease((s.seconds - local) / 0.4) : 1;
    x.save(); x.globalAlpha = out; x.translate(W / 2, H * 0.42); x.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
    x.font = Math.round(210 + Math.sin(t * 2) * 6) + "px system-ui"; x.fillText(D.emoji, 0, -250);
    x.fillStyle = D.light; x.font = '400 ' + fit(s.headline, 920, 112) + 'px "' + D.display + '", "Arial Black", sans-serif'; x.shadowColor = "rgba(0,0,0,.25)"; x.shadowBlur = 24; x.shadowOffsetY = 8;
    x.fillText(s.headline, 0, 0); x.shadowBlur = 0; x.shadowOffsetY = 0;
    x.fillStyle = D.light; x.globalAlpha = out * ease((local - 0.25) / 0.5);
    const lines = wrap(s.sub, 880, 44); lines.forEach((l, i) => x.fillText(l, 0, 110 + i * 56));
    x.restore();
    chip(t, 1);
  } else {
    const k = elastic(local / 0.7);
    x.save(); x.translate(W / 2, H / 2); x.scale(k, k);
    x.fillStyle = D.light; x.beginPath(); x.roundRect(-420, -300, 840, 600, 48); x.fill();
    x.fillStyle = D.ink; x.font = "200px system-ui"; x.fillText(D.emoji, 0, -120);
    x.font = '400 ' + fit(D.brand, 760, 96) + 'px "' + D.display + '", "Arial Black", sans-serif'; x.fillText(D.brand, 0, 60);
    x.font = "800 44px Figtree, system-ui"; x.fillText(D.end, 0, 170); x.restore();
    chip(t, k);
  }
};
function chip(t, a) { x.save(); x.globalAlpha = a; x.translate(W / 2, H - 110); x.fillStyle = D.ink; x.beginPath(); x.roundRect(-190, -42, 380, 84, 42); x.fill();
  x.fillStyle = D.light; x.font = "800 40px Figtree, system-ui"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(D.ticker, 0, 2); x.restore(); }
function fit(text, maxW, size) { for (let s = size; s > 40; s -= 4) { x.font = '400 ' + s + 'px "' + D.display + '", sans-serif'; if (x.measureText(text).width <= maxW) return s; } return 40; }
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); const f = v => Math.max(0, Math.min(255, Math.round(v * (1 + k)))); return "rgb(" + f(n >> 16) + "," + f((n >> 8) & 255) + "," + f(n & 255) + ")"; }
</script></body></html>`;
}

const VISUAL_SYSTEM = `You design launch graphics and motion for memecoins as single self-contained HTML pages. Hard rules:
- Exactly the size given; nothing outside it; no scrollbars; html and body sized to it with overflow hidden.
- Inline CSS and inline JavaScript only. Google Fonts stylesheets are the only external resource; no images from the web:
  draw with CSS, SVG, canvas and emoji. No network requests, no eval.
- Bold and legible at a glance: big type, the brand's accent, its emoji as the mascot, high contrast. No fake UI of real
  companies, no real people, no logos you do not own.
- For a VIDEO page: one <canvas id="c"> at the given size, window.DURATION = total seconds, and window.render(t) that
  draws the complete frame for time t (seconds) from scratch, deterministic, no timers, no requestAnimationFrame, no
  CSS animation; it must look great at every t from 0 to DURATION: scenes with eased pop-ins and exits, particles,
  the mascot, a ticker chip, an end card. Text wraps inside the frame. Hook in the first 2 seconds.
- Reply with the HTML file only.`;
const FORBIDDEN = /\bfetch\s*\(|XMLHttpRequest|WebSocket|\bimport\s*\(|<img\b[^>]*src\s*=\s*["']?https?:|url\(\s*["']?https?:|\beval\s*\(|new\s+Function\s*\(|<script\b[^>]*\bsrc\s*=/i;
function extract(raw) {
  let s = String(raw || ""); const f = /```(?:html)?\s*([\s\S]*?)```/i.exec(s); if (f) s = f[1];
  const a = s.search(/<!doctype html|<html/i), b = s.toLowerCase().lastIndexOf("</html>");
  if (a < 0 || b < 0) return null; s = s.slice(a, b + 7);
  if (FORBIDDEN.test(s)) return null;
  return s.replace(/<link\b(?![^>]*fonts\.googleapis\.com)[^>]*>/gi, "");
}
export async function makeVisual(kind, brief, cfg, { client = null, video = null } = {}) {
  const fallback = video ? templateVideo(video, cfg) : templateImage(kind, cfg);
  if (!client && !process.env.ANTHROPIC_API_KEY) return { html: fallback, source: "template" };
  const [w, h] = SIZES[video ? "video" : kind];
  const ask = (video
    ? `A ${w}x${h} VIDEO page, ${video.scenes.reduce((n, s) => n + s.seconds, 0) + 3} seconds: "${video.title}" for ${cfg.brand} ($${cfg.coin?.ticker}). Hook: ${video.hook}.\nScenes:\n` +
      video.scenes.map((s, i) => `${i + 1}. ${s.seconds}s — headline "${s.headline}" — sub "${s.sub}" — visual: ${s.visual}`).join("\n") + `\nEnd card (3s): "${video.endCard}" with the brand and emoji.`
    : `A ${w}x${h} ${kind === "pfp" ? "X profile picture (shown as a circle)" : kind === "banner" ? "X banner (the left 60% stays clear of the profile picture overlap at the bottom-left)" : "coin launch picture (square, shown small in lists: one big mascot, the ticker)"} for ${cfg.brand}.\nBrief: ${brief}`) +
    `\nBrand: ${cfg.brand}, ticker $${cfg.coin?.ticker}, emoji ${cfg.emoji}, accent ${cfg.colors?.accent}, light ${cfg.colors?.light}, dark ${cfg.colors?.dark}, display font "${cfg.display}", vibe ${cfg.vibe || "candy"}.` +
    `\nHere is a plain template that already works; make yours clearly better:\n\`\`\`html\n${fallback.slice(0, 9000)}\n\`\`\``;
  try {
    const c = client || new Anthropic();
    const msg = await withRetry(() => c.messages.stream({ model: MODEL, max_tokens: 32000, output_config: { effort: "high" }, system: VISUAL_SYSTEM, messages: [{ role: "user", content: ask }] }).finalMessage());
    const html = msg.stop_reason === "end_turn" ? extract(msg.content.filter(b => b.type === "text").map(b => b.text).join("")) : null;
    if (html && (!video || (/window\.render\s*=|function\s+render\s*\(/.test(html) && /id="c"/.test(html)))) return { html, source: "claude" };
    return { html: fallback, source: "template", note: "Claude's version failed the checks; the template was used." };
  } catch (e) { return { html: fallback, source: "template", note: `${why(e)}; the template was used.` }; }
}

// how to post it all, step by step (static: it is the same for every coin)
export const HOW_TO_POST = [
  "Profile: set the display name, the bio (paste the site link where it says [SITE]), the profile picture (400x400) and the banner (1500x500). Do this before anything is posted.",
  "Pin: post the pinned text with the site link; after the token is live, edit nothing: reply to it with the contract address, then pin it.",
  "Post 1, launch day, about an hour before the token goes live: upload the intro MP4 (X takes MP4 up to 140 seconds), paste post 1's text, post. The first reply is the reply_with_ca text as soon as the address exists.",
  "Post 2, a few hours later: the product video with post 2's text. Quote post 1 instead of a fresh post if post 1 is doing well.",
  "Post 3, the next day: the why video with post 3's text. Post 4 a day or two later as text only, and reply to everyone who answers.",
  "Every video: upload the MP4 itself, never a link to it; add your own music in the X composer or a free editor if you want more than the built-in backing track.",
  "Keep replying with the site link, not the chart. Screenshots of people's scores or cards from the site are the best follow-up content.",
];
