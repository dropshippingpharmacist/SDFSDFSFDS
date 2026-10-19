// intel.mjs — Launch Intel: everything the Studio learns about launches, kept for good and turned into a playbook.
//   record()    every coin the trend feeds show (DexScreener, GeckoTerminal, pump.fun, DEXTools) goes into one table on
//               the Railway volume: first seen, last seen, how often, its links, its peak market cap. Over the weeks that
//               becomes the Studio's own history of what launched, what stuck and what vanished.
//   xPosts()    what X is talking about, with X_BEARER_TOKEN (an X API "Bearer token" from developer.x.com): the posts
//               about pump.fun / Solana memecoins with the most engagement right now, plus a search for your own focus.
//   playbook()  the numbers and patterns from all of that: themes, kinds, which links winners have, name and ticker
//               length, launch hours, survivors; and LESSONS, the fixed facts about launching on pump.fun.
//   intelText() the compact version the idea maker and the site writer read.
const TTL = 10 * 60 * 1000;
let xCache = null;

const clip = (s, n = 200) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const median = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const pct = (n, d) => d ? Math.round(100 * n / d) : 0;
const usd = n => "$" + Math.round(n || 0).toLocaleString("en-US");

// what a coin is about, from its name and description (a word list per theme; the first theme that matches wins)
export const THEMES = {
  cats: /\b(cat|kitty|kitten|meow|michi|neko|feline)\b/i,
  dogs: /\b(dog|doge|shib|inu|pup|puppy|corgi|bonk|woof|pug)\b/i,
  frogs: /\b(frog|pepe|toad|ribbit)\b/i,
  "other animals": /\b(hippo|capybara|penguin|duck|goat|monkey|ape|bear|bull|hamster|otter|owl|fox|wolf|seal|rat|mouse|bird|fish|whale|cow|pig|chicken|sloth|llama|moo deng)\b/i,
  "AI & agents": /\b(ai|agent|agents|gpt|llm|bot|neural|robot|android|cyber)\b/i,
  games: /\b(game|play|arcade|quest|rpg|runner|battle|arena|level|pixel|retro|8-?bit)\b/i,
  "tools & utilities": /\b(tool|tracker|terminal|scanner|sniper|dashboard|analytics|wallet|swap|dex|trade|trading|utility|app|platform|protocol)\b/i,
  launchpads: /\b(launchpad|launch pad|pad|launcher|factory|fair ?launch)\b/i,
  "politics & news": /\b(trump|biden|elon|musk|president|election|maga|usa|america|china|fed|tariff)\b/i,
  "celebs & streamers": /\b(kanye|drake|taylor|kardashian|streamer|twitch|kick|youtube|tiktok|influencer)\b/i,
  "sports": /\b(nba|nfl|ufc|fifa|soccer|football|basketball|baseball|f1|olympic|world cup|goal|champion)\b/i,
  "food & drink": /\b(pizza|burger|taco|coffee|beer|wine|sushi|donut|banana|potato|pickle|cheese|cake)\b/i,
  "money & markets": /\b(cash|rich|money|bank|gold|stock|wall ?street|billion|million|trillion|bag|wealth)\b/i,
  "internet culture": /\b(meme|wojak|chad|gigachad|based|sigma|brainrot|skibidi|rizz|npc|goblin|wen|ser|gm|wagmi|degen)\b/i,
  "space & science": /\b(moon|mars|rocket|space|alien|ufo|quantum|atom|nuclear|physics)\b/i,
};
export function themeOf(text) {
  for (const [name, re] of Object.entries(THEMES)) if (re.test(text)) return name;
  return "other";
}
export function kindOf(text) {
  if (/\b(game|play|arcade|quest|rpg|runner|battle|arena|puzzle)\b/i.test(text)) return "game";
  if (/\b(tool|tracker|terminal|scanner|dashboard|analytics|utility|app|platform|agent|bot|protocol)\b/i.test(text)) return "utility";
  if (/\b(launchpad|launch pad|launcher|fair ?launch)\b/i.test(text)) return "launchpad";
  return "meme";
}

export function ensureIntel(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS launch_intel (key TEXT PRIMARY KEY, address TEXT, name TEXT, symbol TEXT, description TEXT,
            website TEXT, x TEXT, telegram TEXT, sources TEXT NOT NULL, theme TEXT, kind TEXT, dex TEXT, graduated INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL, seen INTEGER NOT NULL DEFAULT 1,
            mc REAL, peak_mc REAL, vol REAL, liq REAL, change24h REAL)`);
  db.exec(`CREATE TABLE IF NOT EXISTS x_intel (id TEXT PRIMARY KEY, text TEXT NOT NULL, author TEXT, url TEXT, likes INTEGER, reposts INTEGER,
            replies INTEGER, views INTEGER, score INTEGER NOT NULL, theme TEXT, posted_at INTEGER, seen_at INTEGER NOT NULL)`);
}

// every trend item becomes (or updates) one launch_intel row
export function record(db, items, now = Date.now()) {
  ensureIntel(db);
  const up = db.prepare(`INSERT INTO launch_intel (key, address, name, symbol, description, website, x, telegram, sources, theme, kind, dex, graduated,
      created_at, first_seen, last_seen, seen, mc, peak_mc, vol, liq, change24h) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET last_seen = excluded.last_seen, seen = seen + 1,
      name = COALESCE(excluded.name, name), symbol = COALESCE(excluded.symbol, symbol), description = COALESCE(excluded.description, description),
      website = COALESCE(excluded.website, website), x = COALESCE(excluded.x, x), telegram = COALESCE(excluded.telegram, telegram),
      dex = COALESCE(excluded.dex, dex), graduated = MAX(graduated, excluded.graduated), created_at = COALESCE(created_at, excluded.created_at),
      mc = COALESCE(excluded.mc, mc), peak_mc = MAX(COALESCE(peak_mc, 0), COALESCE(excluded.mc, 0)), vol = COALESCE(excluded.vol, vol),
      liq = COALESCE(excluded.liq, liq), change24h = COALESCE(excluded.change24h, change24h), theme = excluded.theme, kind = excluded.kind,
      sources = excluded.sources`);
  let n = 0;
  for (const x of items || []) {
    const key = x.address || ((x.symbol || x.name) ? "sym:" + String(x.symbol || x.name).toLowerCase() : null);
    if (!key) continue;
    const text = `${x.name || ""} ${x.symbol || ""} ${x.description || ""}`;
    const srcs = x.sources || (x.source ? [x.source] : []);
    const old = db.prepare("SELECT sources FROM launch_intel WHERE key = ?").get(key);
    const merged = [...new Set([...(old ? JSON.parse(old.sources) : []), ...srcs])];
    up.run(key, x.address || null, x.name || null, x.symbol || null, x.description || null, x.website || null, x.x || null, x.telegram || null,
           JSON.stringify(merged), themeOf(text), kindOf(text), x.dex || null, x.graduated ? 1 : 0, x.createdAt || null, now, now,
           x.mcUsd ?? null, x.mcUsd ?? null, x.volUsd ?? null, x.liqUsd ?? null, x.change24h ?? null);
    n++;
  }
  return n;
}

// ---- X: the posts with real traction about Solana memecoin launches (X API v2 recent search, needs X_BEARER_TOKEN)
export const X_QUERIES = [
  '("pump.fun" OR pumpfun OR "pump fun") -is:retweet -is:reply lang:en',
  '(memecoin OR "meme coin") (solana OR sol) -is:retweet -is:reply lang:en',
  '("just launched" OR "launching" OR "launch") (solana OR "pump.fun") (coin OR token) -is:retweet -is:reply lang:en',
];
export async function xPosts({ fetchImpl = fetch, token = process.env.X_BEARER_TOKEN, focus = "", force = false, now = Date.now() } = {}) {
  if (!token) return { ok: false, reason: "no X_BEARER_TOKEN", posts: [] };
  const key = clip(focus, 80).toLowerCase();
  if (!force && xCache && xCache.key === key && now - xCache.at < TTL) return xCache.data;
  const queries = [...X_QUERIES, ...(key ? [`(${key}) (coin OR token OR memecoin OR solana) -is:retweet -is:reply lang:en`] : [])];
  const posts = new Map(); const failed = [];
  for (const q of queries) {
    const u = "https://api.x.com/2/tweets/search/recent?max_results=50&tweet.fields=public_metrics,created_at,author_id&expansions=author_id&user.fields=username" +
      `&query=${encodeURIComponent(q)}`;
    try {
      const r = await fetchImpl(u, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(9000) });
      if (!r.ok) { failed.push(`X ${r.status}`); if (r.status === 401 || r.status === 403 || r.status === 429) break; continue; }
      const j = await r.json();
      const users = new Map((j.includes?.users || []).map(u => [u.id, u.username]));
      for (const t of j.data || []) {
        const m = t.public_metrics || {};
        const score = (m.like_count || 0) + 2 * (m.retweet_count || 0) + (m.reply_count || 0) + Math.round((m.impression_count || 0) / 100);
        const author = users.get(t.author_id) || null;
        posts.set(t.id, { id: t.id, text: clip(t.text, 280), author, url: author ? `https://x.com/${author}/status/${t.id}` : `https://x.com/i/status/${t.id}`,
          likes: m.like_count || 0, reposts: m.retweet_count || 0, replies: m.reply_count || 0, views: m.impression_count || 0, score,
          theme: themeOf(t.text), postedAt: t.created_at ? Date.parse(t.created_at) : null });
      }
    } catch (e) { failed.push("X unreachable"); }
  }
  const list = [...posts.values()].sort((a, b) => b.score - a.score).slice(0, 60);
  const data = { ok: list.length > 0, reason: failed.join(", ") || null, posts: list };
  xCache = { key, at: now, data };
  return data;
}
export function recordX(db, posts, now = Date.now()) {
  ensureIntel(db);
  const up = db.prepare(`INSERT INTO x_intel (id, text, author, url, likes, reposts, replies, views, score, theme, posted_at, seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET likes = excluded.likes, reposts = excluded.reposts,
    replies = excluded.replies, views = excluded.views, score = excluded.score, seen_at = excluded.seen_at`);
  for (const p of posts || []) up.run(p.id, p.text, p.author, p.url, p.likes, p.reposts, p.replies, p.views, p.score, p.theme, p.postedAt, now);
}
export function resetX() { xCache = null; }

// ---- the fixed facts about launching on pump.fun, so every idea and site is built on how it really works
export const LESSONS = [
  "pump.fun: 1B supply, no team allocation, 0% tax; the coin trades on a bonding curve until it fills (around $69k market cap / ~85 SOL), then migrates to PumpSwap with locked liquidity. Everything after that is the open market.",
  "Your first buy is public on-chain. Small (0.5-2% of supply) reads honest; a huge dev buy is the first thing bots and buyers flag.",
  "Have the ticker, picture, website, X and Telegram ready BEFORE you press launch: the first 15 minutes decide whether a coin gets looked at, and you cannot edit the metadata afterwards.",
  "A ticker that is already trading with liquidity splits your search traffic; check it and use a backup.",
  "The coin has to be explainable in one line; the site and the product are what make people stay after the first candle.",
  "Narratives rotate in days: animals, AI agents, politics, streamer moments, tools. Ride a live narrative with an original angle instead of copying the top coin.",
  "Coins with a working product (a game, a tool, a launchpad) have a reason to be shared again a week later; pure memes need constant new content.",
  "Launch when your audience is awake: US afternoon / evening (UTC 17-02) is the busiest window on Solana; a dead launch hour means a dead chart.",
  "Never promise payouts, revenue share, airdrops or charity. Holder perks that are cosmetic or access-based are safe and still give a reason to hold.",
];

export function playbook(db, { now = Date.now(), days = 30 } = {}) {
  ensureIntel(db);
  const since = now - days * 864e5;
  const rows = db.prepare("SELECT * FROM launch_intel WHERE last_seen >= ? ORDER BY last_seen DESC").all(since);
  const count = (field, filter = () => true) => {
    const m = new Map();
    for (const r of rows.filter(filter)) m.set(r[field] || "other", (m.get(r[field] || "other") || 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ name: k, n, share: pct(n, rows.length) }));
  };
  const winners = rows.filter(r => (r.peak_mc || 0) >= 1e6);
  const survivors = rows.filter(r => r.last_seen - r.first_seen >= 24 * 36e5)
    .sort((a, b) => (b.peak_mc || 0) - (a.peak_mc || 0)).slice(0, 12);
  const top = [...rows].sort((a, b) => (b.peak_mc || 0) - (a.peak_mc || 0)).slice(0, 12);
  const hours = new Array(24).fill(0);
  for (const r of rows) if (r.created_at) hours[new Date(r.created_at).getUTCHours()]++;
  const bestHours = hours.map((n, h) => ({ h, n })).sort((a, b) => b.n - a.n).slice(0, 4).filter(x => x.n > 0);
  const links = set => ({ website: pct(set.filter(r => r.website).length, set.length), x: pct(set.filter(r => r.x).length, set.length), telegram: pct(set.filter(r => r.telegram).length, set.length) });
  const xrows = db.prepare("SELECT * FROM x_intel WHERE seen_at >= ? ORDER BY score DESC LIMIT 200").all(now - 7 * 864e5);
  const xThemes = new Map();
  for (const p of xrows) xThemes.set(p.theme, (xThemes.get(p.theme) || 0) + p.score);
  const brief = r => ({ name: r.name, symbol: r.symbol, theme: r.theme, kind: r.kind, peakMc: r.peak_mc, mc: r.mc, vol: r.vol, graduated: !!r.graduated,
                        hours: Math.round((r.last_seen - r.first_seen) / 36e5), sources: JSON.parse(r.sources).length, website: !!r.website, description: clip(r.description, 120) });
  return {
    at: now, days, launches: rows.length, seen24h: rows.filter(r => r.last_seen >= now - 864e5).length, firstSeen: rows.length ? Math.min(...rows.map(r => r.first_seen)) : null,
    themes: count("theme").slice(0, 10), kinds: count("kind"), winnerThemes: count("theme", r => (r.peak_mc || 0) >= 1e6).slice(0, 6),
    winners: winners.length, graduated: rows.filter(r => r.graduated).length,
    links: { all: links(rows), winners: links(winners) },
    nameLen: median(rows.map(r => (r.name || "").length).filter(n => n > 0)), tickerLen: median(rows.map(r => (r.symbol || "").length).filter(n => n > 0)),
    bestHoursUtc: bestHours, survivors: survivors.map(brief), top: top.map(brief),
    x: { posts: xrows.slice(0, 12).map(p => ({ text: p.text, url: p.url, author: p.author, likes: p.likes, reposts: p.reposts, views: p.views, theme: p.theme })),
         themes: [...xThemes].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, score]) => ({ name, score })), total: xrows.length },
    lessons: LESSONS,
  };
}

export function intelText(pb) {
  if (!pb) return "";
  const parts = [];
  if (pb.launches) {
    parts.push(`Launch Intel (${pb.launches} coins tracked over ${pb.days} days from DexScreener, GeckoTerminal, pump.fun and DEXTools; ${pb.winners} passed $1M, ${pb.graduated} graduated):`);
    parts.push("Themes now: " + pb.themes.map(t => `${t.name} ${t.share}%`).join(", "));
    if (pb.winnerThemes.length) parts.push("Themes among the $1M+ coins: " + pb.winnerThemes.map(t => `${t.name} ${t.n}`).join(", "));
    parts.push("Kinds: " + pb.kinds.map(k => `${k.name} ${k.share}%`).join(", "));
    parts.push(`Links: ${pb.links.all.website}% have a website, ${pb.links.all.x}% an X, ${pb.links.all.telegram}% a Telegram` +
      (pb.winners ? ` (the $1M+ ones: ${pb.links.winners.website}% / ${pb.links.winners.x}% / ${pb.links.winners.telegram}%)` : "") +
      `. Median name ${pb.nameLen ?? "?"} letters, ticker ${pb.tickerLen ?? "?"}.`);
    if (pb.bestHoursUtc.length) parts.push("Busiest launch hours (UTC): " + pb.bestHoursUtc.map(h => `${h.h}:00 (${h.n})`).join(", "));
    if (pb.survivors.length) parts.push("Still around after 24h+: " + pb.survivors.slice(0, 8).map(s => `${s.name || s.symbol} (${s.theme}, ${s.kind}, peak ${usd(s.peakMc)}, ${s.hours}h)`).join("; "));
    if (pb.top.length) parts.push("Biggest seen: " + pb.top.slice(0, 8).map(s => `${s.name || s.symbol} ${usd(s.peakMc)}${s.description ? ` "${clip(s.description, 60)}"` : ""}`).join("; "));
  }
  if (pb.x?.total) {
    parts.push("X right now, the posts about Solana launches with the most traction: " + pb.x.posts.slice(0, 8).map(p => `"${clip(p.text, 120)}" (${p.likes} likes, ${p.reposts} reposts)`).join(" | "));
    parts.push("X themes by engagement: " + pb.x.themes.map(t => t.name).join(", "));
  }
  parts.push("How pump.fun launches really work:\n- " + LESSONS.join("\n- "));
  return parts.join("\n");
}
