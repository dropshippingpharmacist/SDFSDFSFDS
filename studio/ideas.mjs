// ideas.mjs — the Idea Maker: original launchpad / game / utility concepts, inspired by what is launching and running
// right now (trends.mjs) and by what this Studio's owner liked, disliked, and actually launched (memory).
//   ANTHROPIC_API_KEY -> Claude Opus 5.5 (structured output); otherwise a rule-based remixer.
// Concepts never copy a live coin's name, never promise payouts, and pass the same honesty filter as the sites.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const MODEL = "claude-opus-5-5";
export const KINDS = ["launchpad", "game", "utility"];
const BANNED = /\b(donat\w*|charit\w*|partner(ed|ship|s)?|guarantee\w*|risk[- ]free|100x|1000x|moon(ing)?|passive income|profit\w*|dividend\w*|revenue share|airdrop\w*|staking|yield|apy|rewards? (in|paid))\b/i;
const clean = (t, n = 300) => String(t || "").replace(/\s+/g, " ").trim().slice(0, n);
const ok = t => !BANNED.test(t);

const Ideas = z.object({ ideas: z.array(z.object({
  name: z.string(), ticker: z.string(), kind: z.enum(KINDS), pitch: z.string(), mechanic: z.string(),
  holder_perk: z.string(), inspired_by: z.string(), why_now: z.string(),
})) });

const SYSTEM = `You invent memecoin product concepts for a builder who launches on pump.fun (Solana). Each concept is a
coin plus a small real product people can use on its website: a launchpad (themed pump.fun launch site), a browser
game, or a utility (a tool, calculator, generator, tracker). You are given what is launching and trending right now and
what this builder liked, disliked and launched before.

Rules:
- Original. Learn from the patterns in the trends (themes, mascots, jokes, mechanics), never reuse a live coin's name,
  ticker or brand, and never impersonate a real person, company or project.
- The product must be buildable as a small single-page web app in a day: say concretely what the user does on the page.
- pump.fun tokenomics are fixed: 1B supply, bonding curve, 0% tax, no team allocation. holder_perk may use HOLDING the
  coin (a holder badge, a leaderboard slot, a cosmetic, early access) but never payouts, revenue share, airdrops,
  staking, yield or price promises. No charity or donation claims.
- Lean toward what the builder liked and what actually traded; steer away from what they disliked.
- name: 1-2 catchy words. ticker: 3-10 capital letters, not an everyday word. Mix kinds.
- pitch: one sentence. mechanic: two or three sentences on how the product works. why_now: one sentence tying it to
  the trends. inspired_by: which trends or patterns.`;

export function rulesIdeas(tr, n = 6) {
  const words = [];
  for (const x of tr.items || []) {
    for (const w of String(x.name || x.symbol || x.description || "").toLowerCase().match(/[a-z]{4,10}/g) || []) words.push(w);
  }
  const common = new Set("this that with from your have will just coin token solana pump first community".split(" "));
  const top = [...new Set(words.filter(w => !common.has(w)))].slice(0, 12);
  const pick = i => top[i % Math.max(1, top.length)] || ["cat", "frog", "rocket", "pixel", "ghost", "robot"][i % 6];
  const tpl = [
    (w) => ({ kind: "game", name: cap(w) + " Dash", pitch: `An endless runner starring a ${w}.`, mechanic: `Tap to jump over obstacles; the run speeds up every 10 seconds. Your best score is saved on the page.`, holder_perk: "Holders get a gold skin and a holder badge on the leaderboard." }),
    (w) => ({ kind: "launchpad", name: cap(w) + "pad", pitch: `A pump.fun launchpad for ${w} coins.`, mechanic: `Launch a ${w}-themed coin from your own wallet in a minute: name, ticker, picture, first buy.`, holder_perk: "Holders get their launches pinned on the home page for an hour." }),
    (w) => ({ kind: "utility", name: cap(w) + " Namer", pitch: `Generates ${w} coin names and tickers.`, mechanic: `Type a vibe, get ten names and tickers with a matching color palette, copy one in a click.`, holder_perk: "Holders unlock the rare-name list." }),
  ];
  return Array.from({ length: n }, (_, i) => {
    const w = pick(i), t = tpl[i % 3](w);
    return { ...t, ticker: (w.toUpperCase() + (t.kind === "launchpad" ? "PAD" : "")).slice(0, 10),
             inspired_by: top.length ? `trending words: ${top.slice(0, 4).join(", ")}` : "evergreen themes",
             why_now: top.length ? `"${w}" keeps showing up in today's launches.` : "Simple products travel well." };
  });
}
const cap = w => w[0].toUpperCase() + w.slice(1);

export function memoryText(mem) {
  if (!mem) return "";
  const line = d => `${d.brand} ($${d.ticker}, ${d.kind || "launchpad"}): ${clean(d.idea, 100)}${d.note ? ` (note: ${clean(d.note, 100)})` : ""}`;
  const parts = [];
  if (mem.liked?.length) parts.push("Liked:\n" + mem.liked.map(line).join("\n"));
  if (mem.disliked?.length) parts.push("Disliked:\n" + mem.disliked.map(line).join("\n"));
  if (mem.launched?.length) parts.push("Launched and how they did on DexScreener:\n" + mem.launched.map(d =>
    `${line(d)} -> ${d.stats?.listed ? `MC $${Math.round(d.stats.mcUsd || 0).toLocaleString("en-US")}, 24h volume $${Math.round(d.stats.volUsd || 0).toLocaleString("en-US")}` : "not trading"}`).join("\n"));
  return parts.join("\n\n");
}

export function trendText(tr) {
  return (tr.items || []).slice(0, 70).map(x => {
    const bits = [x.source, x.name || x.symbol || "", x.symbol && x.symbol !== x.name ? `$${x.symbol}` : "",
      x.mcUsd ? `MC $${Math.round(x.mcUsd).toLocaleString("en-US")}` : "", x.volUsd ? `vol $${Math.round(x.volUsd).toLocaleString("en-US")}` : "",
      x.description ? `"${clean(x.description, 140)}"` : ""].filter(Boolean);
    return "- " + bits.join(" · ");
  }).join("\n");
}

export async function makeIdeas(tr, { mem = null, n = 6, focus = "", client = null } = {}) {
  let ideas = null, source = "rules", note = null;
  if (client || process.env.ANTHROPIC_API_KEY) {
    try {
      const c = client || new Anthropic();
      const response = await c.messages.parse({
        model: MODEL, max_tokens: 16000,
        output_config: { effort: "medium", format: zodOutputFormat(Ideas) },
        system: SYSTEM,
        messages: [{ role: "user", content:
          `What is launching and trending on Solana right now:\n${trendText(tr) || "(no feed answered; use evergreen memecoin themes)"}\n\n` +
          (memoryText(mem) ? `This builder's history:\n${memoryText(mem)}\n\n` : "") +
          (focus ? `They want ideas around: ${clean(focus, 200)}\n\n` : "") + `Give ${n} concepts.` }],
      });
      if (response.stop_reason === "refusal") note = "The model declined; the plain idea maker was used.";
      else if (response.parsed_output) { ideas = response.parsed_output.ideas; source = "claude"; }
      else note = "The model's answer could not be read; the plain idea maker was used.";
    } catch (e) {
      note = e instanceof Anthropic.APIError ? `Claude answered ${e.status}; the plain idea maker was used.` : "Claude could not be reached; the plain idea maker was used.";
    }
  }
  const raw = ideas || rulesIdeas(tr, n);
  const out = raw.map(i => ({
    name: clean(i.name, 30), ticker: String(i.ticker || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10),
    kind: KINDS.includes(i.kind) ? i.kind : "launchpad", pitch: clean(i.pitch, 200), mechanic: clean(i.mechanic, 500),
    holderPerk: clean(i.holder_perk, 200), inspiredBy: clean(i.inspired_by, 200), whyNow: clean(i.why_now, 200),
  })).filter(i => i.name && i.ticker && i.pitch && ok(i.pitch) && ok(i.mechanic) && ok(i.holderPerk)).slice(0, n);
  return { ideas: out, source, note, sources: tr.ok || [], failed: tr.failed || [] };
}

// the idea text a concept becomes when "Build this" is pressed
export const ideaPrompt = i =>
  `${i.name} ($${i.ticker}), a ${i.kind}. ${i.pitch} How it works: ${i.mechanic}` + (i.holderPerk ? ` Holder perk: ${i.holderPerk}` : "");
