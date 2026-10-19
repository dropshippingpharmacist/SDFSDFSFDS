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
import { withRetry, why, tier, economy } from "./llm.mjs";

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
- Posts: exactly 3 tweets, written out word for word, ready to paste: 1 the launch tweet with the intro video
  (launch day, the moment the token goes live: what it is, the ticker, "site in bio"), 2 the product tweet with a
  screenshot of the game / tool a few hours later (what you do in it, that it is free, the holder perk), 3 the
  community tweet the next day (a challenge: post your score / card, the best get pinned). Each under 260 characters,
  punchy, in a real person's voice; "when" says the exact moment to post it, "media" what to attach.
  Each post text under 260 characters, no hashtags spam (at most 2), no "$" tickers except the coin's own, written like a
  person, not a brand. "media" names which video or image goes with it.
- pinned: the pinned post text (under 260 chars) with [CA] where the contract address will be pasted and [SITE] for the
  site link. reply_with_ca: the first reply under the intro post, with [CA].
- bio: under 160 characters, with [SITE]. name_on_x: the display name (brand + emoji, no ticker).
- pfp_brief: a LOGO MARK like the best coin avatars: ONE bold, simple symbol in a single light color on a flat
  ground of one palette color, filling about 60% of the square. The symbol is abstract and only loosely about the
  coin (a thick rising zigzag for a chart, a single curved stroke for a broom sweep, a slot, a coil, a bolt, a
  check, a crescent, a wave), drawn with thick rounded strokes. No emoji, no scene, no gradient, no text (a single
  custom letterform is allowed if it IS the symbol). Describe the exact shape in one sentence.
- banner_brief: the same mark small on the left, the name in the display font, the tagline, a field of the brand's
  shapes or pattern on the right; the left 60% stays clear of the avatar overlap at the bottom-left.`;

export async function planContent(cfg, { client = null } = {}) {
  let raw = null, source = "rules", note = null;
  if (client || process.env.ANTHROPIC_API_KEY) {
    try {
      const c = client || new Anthropic();
      const r = await withRetry(() => c.messages.parse({ ...tier("kit", "high", { format: zodOutputFormat(Plan) }), max_tokens: 16000, system: SYSTEM,
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
    pfp_brief: `One bold white symbol on a flat ${cfg.colors?.accent} square: ${MARKS[markIndex(cfg)][0]}.`,
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
      { when: "Day 2", media: "none", text: `Post your ${kind === "game" ? "best score" : "card"} from the ${b} site below. Top ones get pinned.` },
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
    posts: (raw.posts || []).slice(0, 3).map(p => ({ when: clean(p.when, 120), media: clean(p.media, 40), text: dropClaims(clean(p.text, 270)) })).filter(p => p.text),
    pinned: dropClaims(clean(raw.pinned, 300)), replyWithCa: dropClaims(clean(raw.reply_with_ca, 200)),
  };
}

// ---- the logo marks the template can draw itself: thick rounded strokes, one per launch (picked from the brand)
export const MARKS = [
  ["a thick rising zigzag arrow", "M40 130 L85 85 L110 110 L160 60", "M130 60 L160 60 L160 90"],
  ["a thick upward chevron", "M45 125 L100 65 L155 125", ""],
  ["a single sweeping curve", "M45 140 C70 60 130 60 155 140", ""],
  ["a lightning bolt", "M115 40 L70 110 L105 110 L85 160 L135 90 L100 90 Z", ""],
  ["a bold check mark", "M45 105 L85 145 L160 60", ""],
  ["a ring with a gap", "M150 70 A55 55 0 1 1 150 130", ""],
  ["a play triangle", "M70 50 L150 100 L70 150 Z", ""],
  ["three rising bars", "M55 140 L55 110 M100 140 L100 85 M145 140 L145 60", ""],
  ["a wave", "M35 100 C60 60 85 60 100 100 S140 140 165 100", ""],
  ["a slash through a dot", "M60 140 L140 60 M100 100 m-12 0 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0", ""],
];
export const markIndex = cfg => { let h = 0; for (const ch of String(cfg.brand || "") + String(cfg.coin?.ticker || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % MARKS.length; };
export function markSvg(cfg, { size = 200, color = "#ffffff", ground = null } = {}) {
  const [, d1, d2] = MARKS[markIndex(cfg)];
  const filled = /Z$/.test(d1);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}">` + (ground ? `<rect width="200" height="200" fill="${ground}"/>` : "") +
    `<path d="${d1}" fill="${filled ? color : "none"}" stroke="${color}" stroke-width="${filled ? 8 : 26}" stroke-linecap="round" stroke-linejoin="round"/>` +
    (d2 ? `<path d="${d2}" fill="none" stroke="${color}" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>` : "") + `</svg>`;
}

// ---- the visuals: HTML pages. Templates first (always work), then Claude's own version if it passes the checks.
const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const font = cfg => `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(cfg.display || "Bagel Fat One").replace(/%20/g, "+")}&family=Figtree:wght@600;800&display=swap">`;
const base = (cfg, w, h, body, css = "") => `<!doctype html><html><head><meta charset="utf-8">${font(cfg)}<style>
html{margin:0;background:#15121c;min-height:100%}body{margin:0;width:${w}px;height:${h}px;overflow:hidden;position:relative;background:${cfg.colors?.accent || "#ff6a2b"};color:${cfg.colors?.dark || "#140f22"};font-family:Figtree,"DejaVu Sans",system-ui,sans-serif;box-shadow:0 0 0 1px #000}
.d{font-family:"${esc(cfg.display || "Bagel Fat One")}","Arial Black","DejaVu Sans",sans-serif}${css}</style></head><body>${body}</body></html>`;

export function templateImage(kind, cfg) {
  const [w, h] = SIZES[kind], ink = cfg.colors?.dark || "#140f22", acc = cfg.colors?.accent || "#ff6a2b", light = cfg.colors?.light || "#fff8f1";
  const em = esc(cfg.emoji || "🚀"), tk = "$" + esc(cfg.coin?.ticker || "COIN");
  const a2 = cfg.colors?.accent2 || acc, letter = esc(String(cfg.brand || "X").trim()[0] || "X").toUpperCase();
  if (kind === "pfp") return base(cfg, w, h, `<div style="position:absolute;inset:0;background:${acc};display:grid;place-items:center">${markSvg(cfg, { size: 300, color: light })}</div>`);
  if (kind === "launch") return base(cfg, w, h, `<div style="position:absolute;inset:40px;border-radius:80px;background:${light};border:22px solid ${ink};display:grid;place-items:center;align-content:center;gap:10px">
    <div style="font-size:430px;line-height:1">${em}</div><div class="d" style="font-size:120px;letter-spacing:.02em">${tk}</div></div>`);
  const dots = Array.from({ length: 60 }, (_, i) => `<span style="position:absolute;left:${55 + ((i * 37) % 45)}%;top:${((i * 53) % 100)}%;font-size:${26 + (i % 5) * 10}px;opacity:${.15 + (i % 4) * .15};transform:rotate(${(i * 29) % 60 - 30}deg)">${em}</span>`).join("");
  return base(cfg, w, h, `<div style="position:absolute;inset:0;background:linear-gradient(100deg,${acc} 48%,transparent 90%)"></div>${dots}
    <div style="position:absolute;left:70px;top:0;height:100%;display:grid;align-content:center;gap:14px;max-width:60%">
      <div class="d" style="font-size:112px;line-height:1;display:flex;gap:24px;align-items:center"><span style="display:grid;place-items:center;width:120px;height:120px;border-radius:28px;background:${ink}">${markSvg(cfg, { size: 92, color: light })}</span>${esc(cfg.brand)}</div><div style="font-size:40px;font-weight:800;color:${ink}">${esc(cfg.tagline)}</div>
      <div style="font-size:28px;font-weight:800;opacity:.75">${tk}</div></div>`);
}

// the template video: scenes from the plan, drawn on a canvas by render(t)
export function templateVideo(video, cfg) {
  const [w, h] = SIZES.video;
  const [, m1, m2] = MARKS[markIndex(cfg)];
  const data = JSON.stringify({ scenes: video.scenes, end: video.endCard, brand: cfg.brand, ticker: "$" + (cfg.coin?.ticker || ""), emoji: cfg.emoji || "🚀",
                                acc: cfg.colors?.accent || "#ff6a2b", acc2: cfg.colors?.accent2 || cfg.colors?.accent || "#ffd23f", acc3: cfg.colors?.accent3 || cfg.colors?.accent || "#36d399",
                                ink: cfg.colors?.dark || "#140f22", light: cfg.colors?.light || "#fff8f1", display: cfg.display || "Bagel Fat One", m1, m2: m2 || "" });
  // 2 s build-up, the scenes, a 3 s end card: the same grid as the soundtrack (120 BPM, the drop at 2 s)
  const total = 2 + video.scenes.reduce((n, s) => n + s.seconds, 0) + 3;
  return `<!doctype html><html><head><meta charset="utf-8">${font(cfg)}<style>html,body{margin:0;background:#000}canvas{display:block}</style></head>
<body><canvas id="c" width="${w}" height="${h}"></canvas><script>
const D = ${data}; const W = ${w}, H = ${h}; const c = document.getElementById("c"), x = c.getContext("2d");
window.DURATION = ${total};
const BEAT = 0.5, DROP = 2, END = ${total} - 3;
const clamp = v => v < 0 ? 0 : v > 1 ? 1 : v;
const ease = t => 1 - Math.pow(1 - clamp(t), 3), easeIn = t => Math.pow(clamp(t), 3);
const back = t => { t = clamp(t); const k = 1.70158; return 1 + (k + 1) * Math.pow(t - 1, 3) + k * Math.pow(t - 1, 2); };
const elastic = t => { t = clamp(t); return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1; };
const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const PAL = [D.acc, D.acc2, D.acc3];
const DISP = 'px "' + D.display + '", "Arial Black", "DejaVu Sans", sans-serif', BODY = "px Figtree, 'DejaVu Sans', system-ui";
const mark1 = new Path2D(D.m1), mark2 = D.m2 ? new Path2D(D.m2) : null, filled = /Z$/.test(D.m1);
// the scenes on the timeline
const SC = []; { let t = DROP; for (const s of D.scenes) { SC.push({ ...s, at: t }); t += s.seconds; } }
const parts = Array.from({ length: 90 }, (_, i) => ({ x: hash(i), y: hash(i + 100), z: 0.3 + hash(i + 200) * 0.7, s: 0.4 + hash(i + 300), k: i % 3, shape: i % 4 }));
const conf = Array.from({ length: 120 }, (_, i) => ({ a: hash(i + 500) * Math.PI * 2, v: 500 + hash(i + 600) * 900, r: hash(i + 700) * 6.28, k: i % 3, w: 10 + hash(i + 800) * 14 }));
function lines(text, maxW, font) { x.font = font; const out = []; let l = ""; for (const w of String(text).split(" ").filter(Boolean)) { const t = l ? l + " " + w : w; if (x.measureText(t).width > maxW && l) { out.push(l); l = w; } else l = t; } if (l) out.push(l); return out; }
function fitSize(text, maxW, maxLines, start, min, fam) { for (let s = start; s >= min; s -= 4) { const ls = lines(text, maxW, "400 " + s + fam); if (ls.length <= maxLines) return [s, ls]; } return [min, lines(text, maxW, "400 " + min + fam)]; }
function drawMark(cx, cy, size, prog, color) {
  x.save(); x.translate(cx - size / 2, cy - size / 2); x.scale(size / 200, size / 200);
  x.lineCap = "round"; x.lineJoin = "round"; x.strokeStyle = color; x.fillStyle = color; x.lineWidth = filled ? 8 : 26;
  x.setLineDash([700, 700]); x.lineDashOffset = 700 * (1 - prog);
  x.stroke(mark1); if (mark2) x.stroke(mark2); if (filled && prog >= 1) x.fill(mark1);
  x.restore();
}
function bg(t, pulse) {
  // a slow-turning three-color field, a beat pulse from the center, rotating rays
  const a = t * 0.35, g = x.createLinearGradient(W / 2 + Math.cos(a) * W, H / 2 + Math.sin(a) * H, W / 2 - Math.cos(a) * W, H / 2 - Math.sin(a) * H);
  g.addColorStop(0, D.acc); g.addColorStop(0.55, D.acc2); g.addColorStop(1, D.acc3);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = "rgba(0,0,0,.28)"; x.fillRect(0, 0, W, H);
  x.save(); x.translate(W / 2, H / 2); x.rotate(t * 0.25); x.globalAlpha = 0.08 + 0.1 * pulse; x.fillStyle = D.light;
  for (let i = 0; i < 16; i++) { x.rotate(Math.PI / 8); x.beginPath(); x.moveTo(0, 0); x.lineTo(1100, -60); x.lineTo(1100, 60); x.fill(); }
  x.restore();
  const r = x.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 700); r.addColorStop(0, "rgba(255,255,255," + (0.25 * pulse) + ")"); r.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = r; x.fillRect(0, 0, W, H);
  for (const p of parts) {
    const py = ((p.y - t * 0.05 * p.s * p.z) % 1 + 1) % 1, px = p.x + Math.sin(t * 0.8 + p.x * 9) * 0.015 * p.z, sc = p.z * (1 + 0.35 * pulse);
    x.save(); x.translate(px * W, py * H); x.rotate(t * p.s + p.x * 6); x.globalAlpha = 0.25 + p.z * 0.5; x.fillStyle = PAL[p.k]; x.strokeStyle = D.light;
    if (p.shape === 0) { x.beginPath(); x.arc(0, 0, 7 * sc, 0, 6.3); x.fill(); }
    else if (p.shape === 1) x.fillRect(-7 * sc, -7 * sc, 14 * sc, 14 * sc);
    else if (p.shape === 2) { x.beginPath(); x.moveTo(0, -10 * sc); x.lineTo(9 * sc, 8 * sc); x.lineTo(-9 * sc, 8 * sc); x.fill(); }
    else { x.globalAlpha *= 0.6; drawMark(0, 0, 46 * sc, 1, D.light); }
    x.restore();
  }
}
function chip(t, a, pulse) {
  const s = 1 + 0.08 * pulse;
  x.save(); x.globalAlpha = a; x.translate(W / 2, H - 100); x.scale(s, s);
  x.fillStyle = D.ink; x.beginPath(); x.roundRect(-200, -44, 400, 88, 44); x.fill();
  x.strokeStyle = D.acc2; x.lineWidth = 5; x.stroke();
  x.fillStyle = D.light; x.font = "800 42" + BODY; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(D.ticker, 0, 3); x.restore();
}
window.render = function (t) {
  const beatPhase = ((t - DROP) % BEAT + BEAT) % BEAT, pulse = t >= DROP && t < END + 3 - 0.4 ? Math.exp(-beatPhase * 9) : 0;
  const shake = t >= DROP ? pulse * 7 : 0, sx = (hash(Math.floor(t * 30)) - 0.5) * shake, sy = (hash(Math.floor(t * 30) + 9) - 0.5) * shake;
  x.save(); x.translate(sx, sy);
  bg(t, pulse);
  x.textAlign = "center"; x.textBaseline = "middle";
  if (t < DROP) {
    // the build-up: the mark draws itself, a countdown ticks, the screen tightens toward the drop
    const k = t / DROP; drawMark(W / 2, H / 2 - 40, 360 + 120 * easeIn(k), ease(k * 1.2), D.light);
    x.fillStyle = D.light; x.font = "800 54" + BODY; x.globalAlpha = 0.9; x.fillText(String(Math.max(1, 3 - Math.floor(t / (DROP / 3)))), W / 2, H - 200);
    x.globalAlpha = easeIn(k) * 0.9; x.fillStyle = "#fff"; x.fillRect(0, 0, W, H);
  } else if (t < END) {
    const sc = SC.findLast ? SC.findLast(s => t >= s.at) : SC.filter(s => t >= s.at).pop(), local = t - sc.at, left = sc.seconds - local, first = sc === SC[0];
    // the scene: the mark slams in on the first beat, the headline pops word by word on the eighth notes, the line underneath types out
    const inK = back(local / 0.45), outK = left < 0.3 ? ease(left / 0.3) : 1;
    if (first) drawMark(W / 2, 250, 200 * inK, 1, D.light);
    const [size, hl] = fitSize(String(sc.headline).toUpperCase(), 940, 2, 128, 56, DISP);
    let wi = 0;
    const lineH = size * 1.02, top = (first ? 520 : 420) - (hl.length - 1) * lineH / 2;
    hl.forEach((line, li) => {
      x.font = "400 " + size + DISP; const ws = line.split(" "), total = x.measureText(line).width; let cx = W / 2 - total / 2;
      ws.forEach(word => {
        const ww = x.measureText(word + " ").width, appear = local - wi * 0.25, k = elastic(appear / 0.5);
        if (appear > 0) {
          x.save(); x.translate(cx + x.measureText(word).width / 2, top + li * lineH); x.scale(k * outK, k * outK); x.rotate((1 - k) * 0.3 * (wi % 2 ? 1 : -1));
          x.fillStyle = D.ink; x.fillText(word, 6, 8);
          x.fillStyle = wi % 3 === 1 ? D.acc2 : D.light; x.fillText(word, 0, 0);
          x.restore();
        }
        cx += ww; wi++;
      });
    });
    const subLines = lines(sc.sub, 900, "800 44" + BODY), chars = Math.max(0, Math.floor((local - 0.6) * 45));
    let shown = 0; x.font = "800 44" + BODY; x.globalAlpha = outK;
    subLines.slice(0, 3).forEach((l, i) => { const part = l.slice(0, Math.max(0, chars - shown)); shown += l.length;
      if (part) { x.fillStyle = "rgba(0,0,0,.35)"; x.fillText(part, W / 2 + 3, top + hl.length * lineH + 60 + i * 58 + 3); x.fillStyle = D.light; x.fillText(part, W / 2, top + hl.length * lineH + 60 + i * 58); } });
    x.globalAlpha = 1;
    chip(t, ease((t - DROP) / 0.4), pulse);
    // a white flash on every cut
    const cut = Math.min(local, 0.18); x.globalAlpha = (0.18 - cut) / 0.18 * 0.85; x.fillStyle = "#fff"; x.fillRect(0, 0, W, H); x.globalAlpha = 1;
  } else {
    // the end card: confetti bursts, the mark and the name, the call to action
    const local = t - END, k = back(local / 0.5);
    for (const p of conf) { const d = p.v * local, gy = 500 * local * local;
      x.save(); x.translate(W / 2 + Math.cos(p.a) * d, H / 2 + Math.sin(p.a) * d + gy); x.rotate(p.r + local * 8); x.globalAlpha = clamp(1.6 - local * 0.5); x.fillStyle = PAL[p.k]; x.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2); x.restore(); }
    x.save(); x.translate(W / 2, H / 2 - 30); x.scale(k, k);
    x.fillStyle = D.ink; x.beginPath(); x.roundRect(-430, -330, 860, 600, 56); x.fill(); x.strokeStyle = D.acc2; x.lineWidth = 8; x.stroke();
    x.restore();
    drawMark(W / 2, H / 2 - 190, 200 * k, 1, D.acc);
    const [bs] = fitSize(D.brand, 760, 1, 120, 48, DISP);
    x.save(); x.translate(W / 2, H / 2 + 20); x.scale(k, k); x.font = "400 " + bs + DISP; x.fillStyle = D.light; x.fillText(D.brand, 0, 0);
    x.font = "800 46" + BODY; x.fillStyle = D.acc2; x.fillText(D.end, 0, 120); x.restore();
    chip(t, 1, pulse);
  }
  x.restore();
};
</script></body></html>`;
}

const VISUAL_SYSTEM = `You design launch graphics and motion for memecoins as single self-contained HTML pages. Hard rules:
- Exactly the size given; nothing outside it; no scrollbars; html and body sized to it with overflow hidden.
- Inline CSS and inline JavaScript only. Google Fonts stylesheets are the only external resource; no images from the web:
  draw with CSS, SVG, canvas and emoji. No network requests, no eval.
- Bold and legible at a glance: big type, the brand's palette, high contrast. A logo mark is geometric and minimal
  (think of the best coin avatars: one shape, one letter, two colors), never an emoji. No fake UI of real
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
  if (!client && economy()) return { html: fallback, source: "template" };      // economy: the free templates (logo mark, beat video)
  const [w, h] = SIZES[video ? "video" : kind];
  const ask = (video
    ? `A ${w}x${h} VIDEO page, ${video.scenes.reduce((n, s) => n + s.seconds, 0) + 3} seconds: "${video.title}" for ${cfg.brand} ($${cfg.coin?.ticker}). Hook: ${video.hook}.\nScenes:\n` +
      video.scenes.map((s, i) => `${i + 1}. ${s.seconds}s — headline "${s.headline}" — sub "${s.sub}" — visual: ${s.visual}`).join("\n") + `\nEnd card (3s): "${video.endCard}" with the brand and emoji.`
    : `A ${w}x${h} ${kind === "pfp" ? "X profile picture (shown as a circle): a LOGO MARK, one bold simple symbol in one light color on one flat palette color, thick rounded strokes, filling ~60% of the square; no emoji, no scene, no gradient, no text" : kind === "banner" ? "X banner (the left 60% stays clear of the profile picture overlap at the bottom-left)" : "coin launch picture (square, shown small in lists: one big mascot, the ticker)"} for ${cfg.brand}.\nBrief: ${brief}`) +
    `\nBrand: ${cfg.brand}, ticker $${cfg.coin?.ticker}, emoji ${cfg.emoji}, accent ${cfg.colors?.accent}, light ${cfg.colors?.light}, dark ${cfg.colors?.dark}, display font "${cfg.display}", vibe ${cfg.vibe || "candy"}.` +
    `\nHere is a plain template that already works; make yours clearly better:\n\`\`\`html\n${fallback.slice(0, 9000)}\n\`\`\``;
  try {
    const c = client || new Anthropic();
    const req = { ...tier("visual", "high"), max_tokens: 32000, system: VISUAL_SYSTEM, messages: [{ role: "user", content: ask }] };
    let msg;
    try { msg = await withRetry(() => c.messages.stream(req).finalMessage()); }
    catch (e) {
      if (e?.status !== 400) throw e;
      // a 400 is a request the API will not take as written: try once more in the plainest form (no effort setting, a smaller budget)
      const { output_config: _o, ...plain } = req;
      msg = await withRetry(() => c.messages.stream({ ...plain, max_tokens: 16000 }).finalMessage());
    }
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
  "Post 2, a few hours later: the product tweet with a screenshot of the game or tool. Quote tweet 1 instead of a fresh post if tweet 1 is doing well.",
  "Post 3, the next day: the community tweet, text only; reply to everyone who answers with the site link.",
  "Every video: upload the MP4 itself, never a link to it; add your own music in the X composer or a free editor if you want more than the built-in backing track.",
  "Keep replying with the site link, not the chart. Screenshots of people's scores or cards from the site are the best follow-up content.",
];
