// theme.mjs — a look of its own for every site. The template has five structurally different layouts; on top of that
// Claude designs the coin's own stylesheet (theme.css: backgrounds, shapes, motion, section treatments) and an original
// SVG mascot (mascot.svg) used in the hero, the floating scene and the favicon. Both are checked before they are used:
// no scripts, no outside resources, no imports. Without a key, a layout is still picked from the brand so sites differ.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { parseBig } from "./llm.mjs";

const MODEL = "claude-opus-5-5";
export const LAYOUTS = ["classic", "poster", "split", "terminal", "magazine"];
export const LAYOUT_NOTES = {
  classic: "left-aligned hero, card grid, the launch desk as a two-column panel",
  poster: "giant centered hero on a full-bleed accent block, a marquee ticker strip, sections as alternating full-width bands",
  split: "two-column hero (copy left, a big tilted mascot card right), rows instead of cards, a sticky side rail on desktop",
  terminal: "dark monospace console: bordered boxes, a blinking cursor headline, scanlines, green/amber accents on black",
  magazine: "editorial: huge numbered section headings, thin rules, a serif-feeling display, generous whitespace, drop caps",
};

const Theme = z.object({ layout: z.enum(LAYOUTS), css: z.string(), mascot_svg: z.string(), notes: z.string() });
const SYSTEM = `You are the art director for a coin's website. You get the brand (name, ticker, emoji, accent, vibe, product) and
the site's HTML skeleton with its class names. You return:
1. layout: which of the five structural layouts fits this brand best (classic, poster, split, terminal, magazine).
2. css: the site's own stylesheet (up to ~250 lines), applied after the template's. Make this site unmistakably ITS OWN:
   a background treatment (gradients, patterns, shapes drawn with CSS, grain, stripes, dots, rays), the hero's
   character, section backgrounds, card shapes and borders, button personality, hover and keyframe motion that fits
   the theme (a bounce for cute, glitch for cyber, float for space, wobble for food…), decorative pseudo-elements.
   Use the CSS variables the template exposes (--accent, --accent-ink, --bg, --ink, --muted, --card, --line, --display,
   --body, --mono) and the class names given. Keep text readable (contrast!), keep the layout working on a 390px phone
   (no fixed widths, no horizontal overflow), respect prefers-reduced-motion for big motion. No @import, no url() to
   the web (data: URLs and Google Fonts are fine), no position:fixed overlays that block content.
3. mascot_svg: an original character for the brand as ONE self-contained SVG (viewBox 0 0 200 200, under 12KB):
   flat, bold shapes, 3-6 colors including the accent, a face with personality, no text, no external references, no
   scripts, no filters that need external files. It must look good at 48px and at 300px. It is the brand's mascot:
   make it specific (a cat with a broom, a vending machine with eyes, a frog in a helmet), not a generic circle.
4. notes: one sentence on the look.
Reply with the structured output only.`;

const CSS_FORBIDDEN = /@import|expression\s*\(|url\s*\(\s*["']?(?!data:|https:\/\/fonts\.g)[a-z]+:|behavior\s*:|-moz-binding|<\/?script/i;
const SVG_FORBIDDEN = /<script|<foreignObject|\bon[a-z]+\s*=|javascript:|href\s*=\s*["']?(?!#)[^"'\s>]*:|<use\b[^>]*href\s*=\s*["']?https?:/i;

export function cleanCss(raw) {
  let s = String(raw || "").replace(/<\/?style[^>]*>/gi, "").trim();
  if (!s || CSS_FORBIDDEN.test(s)) return "";
  s = s.replace(/position\s*:\s*fixed/gi, "position: absolute");          // nothing may sit over the whole page
  return s.slice(0, 60 * 1024);
}
export function cleanSvg(raw) {
  let s = String(raw || "").trim();
  const a = s.indexOf("<svg"), b = s.lastIndexOf("</svg>");
  if (a < 0 || b < 0) return "";
  s = s.slice(a, b + 6).replace(/<\?xml[^>]*>/g, "");
  if (SVG_FORBIDDEN.test(s) || Buffer.byteLength(s) > 24 * 1024) return "";
  if (!/xmlns=/.test(s)) s = s.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  if (!/viewBox=/.test(s)) s = s.replace("<svg", '<svg viewBox="0 0 200 200"');
  return s;
}
// no key: still a different layout per brand, chosen from its name, so two sites never look alike by default
export function rulesLayout(cfg) {
  const pr = cfg.product?.kind;
  if (cfg.vibe === "neon" || /\b(ai|agent|bot|cyber|terminal|scanner)\b/i.test(cfg.brand + " " + cfg.about)) return "terminal";
  if (pr === "game" || pr === "combo") return "poster";
  if (pr === "utility") return "split";
  let h = 0; for (const ch of String(cfg.brand || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return LAYOUTS[h % LAYOUTS.length];
}

const SKELETON = `body > .wrap > header.bar (.brand > #brandEmoji #brandName, #connectBtn) · nav.links-top#siteNav · section.hero (.tickchip#heroTick, h1#tagline,
p#about, .cabar#caBar > .carow > code#siteCa + button#siteCopy, .ctas > a.btn#siteBuy a.btn.ghost#siteChart #siteX #siteTg #siteDocs #sitePlay) ·
.desk#launch (the optional launch form: .panel, form#launchForm, .preview card) · .site#site > section#product/#lore/#how/#buy/#tokenomics/#roadmap/#faq/#socials
(h2, p, .cards > div (b, span), .kv (div pairs), .alloc > .abar (span bar, b, small), .phase.live/.next/.idea (.st, h3, ul), details > summary, .socials > a.btn.ghost,
.perkbar, iframe.playframe) · section.mine · footer · canvas#scene (fixed, behind everything) · img.mascot (the hero mascot, when there is one) · .marquee (poster layout's ticker strip).
The <html> element carries data-vibe (arcade|neon|candy|retro|clean) and data-layout (classic|poster|split|terminal|magazine).`;

export async function makeTheme(cfg, { client = null } = {}) {
  const fallback = { layout: rulesLayout(cfg), css: "", svg: "", notes: "", source: "rules" };
  if (!client && !process.env.ANTHROPIC_API_KEY) return fallback;
  try {
    const c = client || new Anthropic();
    const r = await parseBig(c, { model: MODEL, max_tokens: 30000, output_config: { effort: "high" }, system: SYSTEM,
      messages: [{ role: "user", content: `Brand: ${cfg.brand} ($${cfg.coin?.ticker}), emoji ${cfg.emoji}, accent ${cfg.colors?.accent}, light ${cfg.colors?.light}, dark ${cfg.colors?.dark}, display font "${cfg.display}", vibe ${cfg.vibe}.\n` +
        `Tagline: ${cfg.tagline}\nAbout: ${cfg.about}\nProduct: ${cfg.product?.kind} — ${cfg.product?.name}: ${cfg.product?.mechanic || ""}\nLore: ${(cfg.lore || []).join(" ")}\n\n` +
        `Layouts: ${LAYOUTS.map(l => `${l} (${LAYOUT_NOTES[l]})`).join("; ")}.\n\nThe skeleton:\n${SKELETON}` }] }, Theme);
    if (r.stop_reason !== "end_turn" || !r.parsed) return { ...fallback, notes: "The designer's answer could not be read." };
    const o = r.parsed;
    return { layout: LAYOUTS.includes(o.layout) ? o.layout : fallback.layout, css: cleanCss(o.css), svg: cleanSvg(o.mascot_svg), notes: String(o.notes || "").slice(0, 200), source: "claude" };
  } catch (e) {
    return { ...fallback, notes: e instanceof Anthropic.APIError ? `Claude answered ${e.status}; the default look is used.` : "Claude could not be reached; the default look is used." };
  }
}
