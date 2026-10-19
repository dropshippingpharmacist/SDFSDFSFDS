// miniapp.mjs — the product on a generated site: Claude writes the concept's game or utility as ONE self-contained HTML
// file (play.html). It runs on the launchpad site inside a sandboxed frame (scripts only, no same-origin), under a
// Content-Security-Policy that blocks every network request, so it can never reach a wallet, a key or a server.
import Anthropic from "@anthropic-ai/sdk";
import { qualityText, CLASSICS, COMBOS } from "./playbook.mjs";
import { withRetry, why } from "./llm.mjs";

const MODEL = "claude-opus-5-5";
export const MAX_BYTES = 250 * 1024;
const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; ` +
  `style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data: blob:; ` +
  `media-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'">`;
const FORBIDDEN = /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|\bimport\s*\(|window\.(?:solana|phantom|solflare|backpack|ethereum)\b|document\.cookie|\beval\s*\(|new\s+Function\s*\(/;

const SYSTEM = `You write small, polished, self-contained web apps: one complete HTML file with inline CSS and inline
JavaScript. Hard rules:
- No external scripts, no network requests of any kind (no fetch, XMLHttpRequest, WebSocket, imports), no eval.
  Google Fonts stylesheets are the only allowed external resource. Draw graphics with canvas, SVG or CSS.
- No wallet, crypto payments, prices or trading. The app is the fun or useful product itself.
- It must work on a phone (touch) and a desktop (mouse/keyboard), fit any width, and have no horizontal scroll.
- Save high scores or settings in localStorage, wrapped in try/catch.
- The holder perk: the parent page checks the wallet's coin balance and posts a message into this frame:
  window.addEventListener("message", e => { if (e.data && e.data.type === "holder") ... }) with e.data = { type: "holder",
  holder: true|false, balance: number, ticker: "$X", wallet: "abcd…wxyz" }. Until that message says holder: true, show the
  perk locked with a "Holders unlock this: connect your wallet above" note; when it does, unlock it (skin, badge, mode,
  extra content) and show the wallet. Never check a wallet yourself and never fake the unlock.
- Start the file with <!doctype html>. Reply with the HTML file only.
- Make it genuinely good, not a demo: a real game loop (requestAnimationFrame, delta time, pause when hidden, resize),
  difficulty that ramps, juice (particles, screen shake, squash-and-stretch, score pops, optional WebAudio sounds off by
  default), a first screen with a one-line "how to play" and a big Play button, a game-over screen with the score, the
  best score, and a "copy my result" button that writes a share text (and draws a share card on a canvas).
- Borrow the loops the world already knows (${CLASSICS.map(c => c[0]).join(", ")}) with the brand's own mascot and
  names; never a real game's title, characters or art.
- A three-in-one ("combo") app is ONE page with three tabs: Play (the game), Tools (the utility) and Launch (a launch
  kit: name, ticker, one-line pitch, a drawn preview card, and a "copy the fields" button; the real launch form lives on
  the parent page, so the Launch tab prepares, it never submits). Progress and the holder perk carry across the tabs.
${qualityText()}`;

export function cleanHtml(raw) {
  let s = String(raw || "");
  const fence = /```(?:html)?\s*([\s\S]*?)```/i.exec(s);
  if (fence) s = fence[1];
  const start = s.search(/<!doctype html|<html/i), end = s.toLowerCase().lastIndexOf("</html>");
  if (start < 0 || end < 0) return { error: "no HTML document in the answer" };
  s = s.slice(start, end + 7);
  if (FORBIDDEN.test(s)) return { error: "the app tried to use the network or a wallet" };
  s = s.replace(/<script\b[^>]*\bsrc\s*=[^>]*>\s*<\/script>/gi, "")                       // inline scripts only
       .replace(/<link\b(?![^>]*fonts\.googleapis\.com)[^>]*>/gi, "")                      // only Google Fonts
       .replace(/<(iframe|object|embed|base)\b[^>]*>(?:[\s\S]*?<\/\1>)?/gi, "")
       .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?content-security-policy[^>]*>/gi, "");
  s = /<head[^>]*>/i.test(s) ? s.replace(/<head[^>]*>/i, m => m + "\n" + CSP) : s.replace(/<html[^>]*>/i, m => m + "\n<head>" + CSP + "</head>");
  if (Buffer.byteLength(s) > MAX_BYTES) return { error: "the app came out too large" };
  return { html: s };
}

// a second pass over a built app: play-test it in the head, fix bugs, add the missing juice and polish, keep the rules
export async function polishMiniApp(html, concept, cfg, { client = null } = {}) {
  if (!client && !process.env.ANTHROPIC_API_KEY) return { error: "Add ANTHROPIC_API_KEY on the server: the polish pass is done by Claude." };
  const c = client || new Anthropic();
  const ask = `Here is the current ${concept.kind || "game"} "${concept.name || cfg.brand}" for ${cfg.brand} ($${cfg.coin?.ticker}).
Review it like a strict QA lead and a game designer: find every bug (touch and mouse input, resize, the loop, score saving, the
game-over flow), everything that feels flat, and anything missing from the quality bar. Then return the COMPLETE improved HTML
file, same rules as before. Keep what works; make it tighter, juicier and more addictive. Reply with the HTML file only.

\`\`\`html
${String(html).slice(0, MAX_BYTES)}
\`\`\``;
  try {
    const msg = await withRetry(() => c.messages.stream({ model: MODEL, max_tokens: 100000, output_config: { effort: "high" }, system: SYSTEM, messages: [{ role: "user", content: ask }] }).finalMessage());
    if (msg.stop_reason !== "end_turn") return { error: msg.stop_reason === "refusal" ? "The model declined." : "The polished app came out too long. Try again." };
    const out = cleanHtml(msg.content.filter(b => b.type === "text").map(b => b.text).join(""));
    return out.error ? { error: `Not used: ${out.error}. Try again.` } : out;
  } catch (e) {
    if (e instanceof Anthropic.APIError) return { error: `Claude answered ${e.status}. Try again in a minute.` };
    return { error: `${why(e)}. Try again.` };
  }
}

// stage one: the design document. Depth comes from design, not from asking for "more": modes, progression, economy,
// content lists, achievements, a daily challenge, meta-unlocks and the holder-perk hooks are decided here first.
const DESIGN_SYSTEM = `You are a senior game designer. Write a tight game design document (Markdown, 700-1200 words) for a browser
game that must feel deep and replayable, not a demo. Cover, with concrete numbers: the core loop and controls (phone and
desktop); 3 modes (e.g. classic, endless, daily challenge with a date seed); difficulty curve and waves/levels with named
content (at least 8 levels / wave types / enemy or item types with distinct behavior); scoring, combos and multipliers;
a progression system (XP, ranks, currency earned in play) and an upgrade / unlock tree of 8+ items with costs and
effects; 10+ achievements with conditions; a meta layer (collection, skins, a map or a shop); the holder perk (cosmetic or
access, unlocked by the parent page's holder message); juice (what shakes, pops, flashes); the share card; what is
saved. For a utility: the equivalent depth (every function, inputs/outputs, presets, history, export). For a three-in-one:
all three parts and how they feed each other. Only what can be built as ONE self-contained HTML file with canvas/SVG.`;
export async function designMiniApp(concept, cfg, { client = null } = {}) {
  const c = client || new Anthropic();
  const brief = `Product: ${concept.name || cfg.brand} — a ${concept.kind || "game"} for ${cfg.brand} ($${cfg.coin?.ticker}).\nPitch: ${concept.pitch || ""}\nMechanic: ${concept.mechanic || ""}\nHolder perk: ${concept.holderPerk || "none"}\nBrand: emoji ${cfg.emoji}, vibe ${cfg.vibe}, accents ${cfg.colors?.accent}/${cfg.colors?.accent2}/${cfg.colors?.accent3}.`;
  try {
    const msg = await c.messages.stream({ model: MODEL, max_tokens: 6000, output_config: { effort: "high" }, system: DESIGN_SYSTEM, messages: [{ role: "user", content: brief }] }).finalMessage();
    return msg.content.filter(b => b.type === "text").map(b => b.text).join("").slice(0, 12000);
  } catch { return ""; }
}

export async function makeMiniApp(concept, cfg, { client = null, design = null } = {}) {
  if (!client && !process.env.ANTHROPIC_API_KEY) {
    return { error: "Add ANTHROPIC_API_KEY on the server: the game or utility is written by Claude." };
  }
  const c = client || new Anthropic();
  const brief = [
    `Product: ${concept.name || cfg.brand} — a ${concept.kind || "game"}.`,
    concept.pitch ? `Pitch: ${concept.pitch}` : "",
    concept.mechanic ? `How it works: ${concept.mechanic}` : "",
    concept.holderPerk ? `Holder perk: ${concept.holderPerk}` : "",
    `Brand: ${cfg.brand} ($${cfg.coin?.ticker}). Palette: accent ${cfg.colors?.accent}, accent2 ${cfg.colors?.accent2}, accent3 ${cfg.colors?.accent3} (use all three), light background ${cfg.colors?.light}, dark ${cfg.colors?.dark}. Display font: ${cfg.display}. Vibe: ${cfg.vibe || "candy"}.`,
    concept.kind === "launchpad" ? "This is a launchpad: build a fun companion tool for it instead (for example a coin name and ticker generator with a preview card), since the real launch form already exists on the page." : "",
    concept.kind === "combo" ? "This is a three-in-one: Play / Tools / Launch tabs on one page. Ways to fuse them: " + COMBOS.map(c => c[0] + " (" + c[1] + ")").join("; ") : "",
    design ? "\nBUILD EXACTLY THIS DESIGN, all of it (every mode, level, upgrade, achievement and screen it lists):\n" + design : "",
    "Depth is the point: a first screen with mode select, a real run, an upgrade/shop screen, an achievements screen, a daily challenge, settings (sound, reduced motion), and persistent progress. Big file is fine.",
  ].filter(Boolean).join("\n");
  try {
    let msg = await withRetry(() => c.messages.stream({ model: MODEL, max_tokens: 100000, output_config: { effort: "high" }, system: SYSTEM,
                                        messages: [{ role: "user", content: brief }] }).finalMessage());
    if (msg.stop_reason === "max_tokens") {                                  // once more, tighter
      msg = await c.messages.stream({ model: MODEL, max_tokens: 100000, output_config: { effort: "high" }, system: SYSTEM,
        messages: [{ role: "user", content: brief + "\n\nKeep the whole file under 1,500 lines: fewer modes, same polish." }] }).finalMessage();
    }
    if (msg.stop_reason === "refusal") return { error: "The model declined to build this one." };
    if (msg.stop_reason === "max_tokens") return { error: "The app came out too long twice. Simplify the mechanic and try again." };
    const text = msg.content.filter(b => b.type === "text").map(b => b.text).join("");
    const out = cleanHtml(text);
    return out.error ? { error: `Not used: ${out.error}. Try again.` } : out;
  } catch (e) {
    if (e instanceof Anthropic.APIError) return { error: `Claude answered ${e.status}. Try again in a minute.` };
    return { error: `${why(e)}. Try again.` };
  }
}
