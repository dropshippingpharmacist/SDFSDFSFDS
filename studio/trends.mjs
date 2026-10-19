// trends.mjs — what is launching and running on Solana right now, from public feeds, for the Idea Maker and Launch Intel.
//   DexScreener  newest token profiles + top boosted tokens, then each one's pair stats (free, no key)
//   GeckoTerminal Solana trending pools + brand-new pools (free, no key)
//   pump.fun     biggest coins, king of the hill, latest trades (unofficial API; often blocks servers — then left out)
//   DEXTools     hot pools + gainers, only with DEXTOOLS_API_KEY
// Every source is optional: one that fails is listed in `failed`, the rest still count. Cached 10 minutes.
const TTL = 10 * 60 * 1000;
let cache = null;

const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const clip = (s, n = 160) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
const CA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

async function getJson(url, fetchImpl, headers = {}) {
  const r = await fetchImpl(url, { headers: { accept: "application/json", "user-agent": "Mozilla/5.0 launchpad-studio", ...headers },
                                   signal: AbortSignal.timeout(9000) });
  if (!r.ok) throw new Error(`${r.status}`);
  const t = await r.text();
  if (/^\s*</.test(t)) throw new Error("blocked");
  return JSON.parse(t);
}

// one DexScreener pair -> the fields every source shares
function fromPair(p, source) {
  const site = (p.info?.websites || []).map(w => w.url).find(Boolean) || null;
  const soc = t => (p.info?.socials || []).find(s => s.type === t)?.url || null;
  return { source, address: p.baseToken?.address || null, name: clip(p.baseToken?.name, 40), symbol: clip(p.baseToken?.symbol, 12),
           description: null, mcUsd: num(p.marketCap) ?? num(p.fdv), volUsd: num(p.volume?.h24), liqUsd: num(p.liquidity?.usd),
           change24h: num(p.priceChange?.h24), createdAt: num(p.pairCreatedAt), dex: p.dexId || null,
           website: site, x: soc("twitter"), telegram: soc("telegram"), url: p.url || null };
}

export const SOURCES = {
  async dexscreener(f) {
    const [profiles, boosts] = await Promise.all([
      getJson("https://api.dexscreener.com/token-profiles/latest/v1", f).catch(() => []),
      getJson("https://api.dexscreener.com/token-boosts/top/v1", f).catch(() => []),
    ]);
    const rows = [...(Array.isArray(boosts) ? boosts.map(x => ({ ...x, boosted: true })) : []), ...(Array.isArray(profiles) ? profiles : [])]
      .filter(x => x && x.chainId === "solana");
    if (!rows.length) throw new Error("no answer");
    const items = rows.slice(0, 60).map(x => ({
      source: x.boosted ? "DexScreener boosted" : "DexScreener new", name: null, symbol: null,
      description: clip(x.description, 200), url: x.url || null, address: x.tokenAddress || null,
      website: (x.links || []).find(l => l.type === "website" || l.label === "Website")?.url || null,
      x: (x.links || []).find(l => l.type === "twitter")?.url || null, telegram: (x.links || []).find(l => l.type === "telegram")?.url || null,
    }));
    // the pair stats behind each profile: name, ticker, market cap, volume, liquidity, age (30 addresses per call)
    const addrs = [...new Set(items.map(i => i.address).filter(a => a && CA.test(a)))];
    for (let i = 0; i < addrs.length; i += 30) {
      const pairs = await getJson(`https://api.dexscreener.com/tokens/v1/solana/${addrs.slice(i, i + 30).join(",")}`, f).catch(() => []);
      const best = new Map();
      for (const p of Array.isArray(pairs) ? pairs : []) {
        const a = p.baseToken?.address; if (!a) continue;
        if (!best.has(a) || (p.liquidity?.usd || 0) > (best.get(a).liquidity?.usd || 0)) best.set(a, p);
      }
      for (const it of items) {
        const p = best.get(it.address); if (!p) continue;
        const s = fromPair(p, it.source);
        Object.assign(it, { name: s.name, symbol: s.symbol, mcUsd: s.mcUsd, volUsd: s.volUsd, liqUsd: s.liqUsd, change24h: s.change24h,
                            createdAt: s.createdAt, dex: s.dex, website: it.website || s.website, x: it.x || s.x, telegram: it.telegram || s.telegram });
      }
    }
    return items;
  },
  async geckoterminal(f) {
    const pool = (p, source) => {
      const a = p.attributes || {}, nm = clip(String(a.name || "").split(" / ")[0], 40);
      return { source, name: nm, symbol: clip(nm, 12), description: null, address: (p.relationships?.base_token?.data?.id || "").replace(/^solana_/, "") || null,
               mcUsd: num(a.market_cap_usd) ?? num(a.fdv_usd), volUsd: num(a.volume_usd?.h24), liqUsd: num(a.reserve_in_usd),
               change24h: num(a.price_change_percentage?.h24), createdAt: a.pool_created_at ? Date.parse(a.pool_created_at) : null,
               url: `https://www.geckoterminal.com/solana/pools/${a.address || ""}` };
    };
    const [tr, nw] = await Promise.all([
      getJson("https://api.geckoterminal.com/api/v2/networks/solana/trending_pools?page=1", f),
      getJson("https://api.geckoterminal.com/api/v2/networks/solana/new_pools?page=1", f).catch(() => ({ data: [] })),
    ]);
    return [...(tr.data || []).slice(0, 25).map(p => pool(p, "GeckoTerminal trending")), ...(nw.data || []).slice(0, 20).map(p => pool(p, "GeckoTerminal new"))];
  },
  async pumpfun(f) {
    const base = (process.env.COINCHECK_PUMP_API || "https://frontend-api-v3.pump.fun").replace(/\/$/, "");
    const h = { origin: "https://pump.fun", referer: "https://pump.fun/" };
    const coin = (c, source) => ({ source, name: clip(c.name, 40), symbol: clip(c.symbol, 12), description: clip(c.description, 200), address: c.mint || null,
      mcUsd: num(c.usd_market_cap), createdAt: num(c.created_timestamp), graduated: !!c.complete, dex: "pumpfun",
      website: c.website || null, x: c.twitter || null, telegram: c.telegram || null, url: c.mint ? `https://pump.fun/coin/${c.mint}` : null });
    const big = await getJson(`${base}/coins?offset=0&limit=50&sort=market_cap&order=DESC&includeNsfw=false`, f, h);
    const [koth, latest] = await Promise.all([
      getJson(`${base}/coins/king-of-the-hill?includeNsfw=false`, f, h).catch(() => null),
      getJson(`${base}/coins?offset=0&limit=30&sort=last_trade_timestamp&order=DESC&includeNsfw=false`, f, h).catch(() => []),
    ]);
    const list = j => (Array.isArray(j) ? j : (j?.coins || []));
    return [...(koth && koth.mint ? [coin(koth, "pump.fun king of the hill")] : []),
            ...list(big).slice(0, 40).map(c => coin(c, "pump.fun top")), ...list(latest).slice(0, 30).map(c => coin(c, "pump.fun latest"))];
  },
  async dextools(f) {
    const key = process.env.DEXTOOLS_API_KEY;
    if (!key) throw new Error("no DEXTOOLS_API_KEY");
    const plan = process.env.DEXTOOLS_PLAN || "trial";
    const row = (p, source) => ({ source, name: clip(p.mainToken?.name, 40), symbol: clip(p.mainToken?.symbol, 12), address: p.mainToken?.address || null,
      description: null, change24h: num(p.variation24h), url: p.address ? `https://www.dextools.io/app/en/solana/pair-explorer/${p.address}` : null });
    const [hot, gain] = await Promise.all([
      getJson(`https://public-api.dextools.io/${plan}/v2/ranking/solana/hotpools`, f, { "x-api-key": key }),
      getJson(`https://public-api.dextools.io/${plan}/v2/ranking/solana/gainers`, f, { "x-api-key": key }).catch(() => ({ data: [] })),
    ]);
    return [...(hot.data || []).slice(0, 25).map(p => row(p, "DEXTools hot")), ...(gain.data || []).slice(0, 15).map(p => row(p, "DEXTools gainer"))];
  },
};

export async function trends({ fetchImpl = fetch, force = false, now = Date.now() } = {}) {
  if (!force && cache && now - cache.at < TTL) return cache.data;
  const names = Object.keys(SOURCES);
  const got = await Promise.allSettled(names.map(n => SOURCES[n](fetchImpl)));
  const items = [], ok = [], failed = [];
  got.forEach((g, i) => {
    if (g.status === "fulfilled" && g.value.length) { ok.push(names[i]); items.push(...g.value); }
    else failed.push(`${names[i]} (${g.status === "rejected" ? (g.reason?.message || "error") : "empty"})`);
  });
  // the same coin from several feeds becomes one row that remembers every feed it was on
  const byKey = new Map();
  for (const x of items) {
    const k = (x.address || x.symbol || x.name || x.description || "").toLowerCase();
    if (!k) continue;
    const prev = byKey.get(k);
    if (!prev) { byKey.set(k, { ...x, sources: [x.source] }); continue; }
    prev.sources.push(x.source);
    for (const [f, v] of Object.entries(x)) if ((prev[f] == null || prev[f] === "") && v != null && v !== "" && f !== "source") prev[f] = v;
  }
  const data = { at: now, items: [...byKey.values()].slice(0, 200), ok, failed };
  cache = { at: now, data };
  return data;
}
export function resetTrends() { cache = null; }

// how a launched site's coin is doing (DexScreener), for the Studio's memory
export async function coinStats(ca, fetchImpl = fetch) {
  if (!CA.test(String(ca || ""))) return null;
  try {
    const j = await getJson(`https://api.dexscreener.com/latest/dex/tokens/${ca}`, fetchImpl);
    const p = (j.pairs || []).sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
    if (!p) return { listed: false };
    return { listed: true, mcUsd: num(p.marketCap) ?? num(p.fdv), volUsd: num(p.volume?.h24), change24h: num(p.priceChange?.h24),
             ageH: p.pairCreatedAt ? Math.round((Date.now() - p.pairCreatedAt) / 36e5) : null, url: p.url || null };
  } catch { return null; }
}

// is a ticker already trading on Solana? (DexScreener search; the biggest coins using it, by liquidity)
export async function tickerTaken(ticker, fetchImpl = fetch) {
  const t = String(ticker || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
  if (!t) return { ticker: t, status: "invalid", coins: [] };
  try {
    const j = await getJson(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent("$" + t)}`, fetchImpl);
    const seen = new Set();
    const coins = (j.pairs || []).filter(p => p.chainId === "solana" && String(p.baseToken?.symbol || "").toUpperCase() === t)
      .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))
      .filter(p => { const a = p.baseToken?.address; if (!a || seen.has(a)) return false; seen.add(a); return true; })
      .slice(0, 5).map(p => fromPair(p, "DexScreener"));
    const live = coins.filter(c => (c.liqUsd || 0) >= 1000);
    return { ticker: t, status: live.length ? "taken" : coins.length ? "dead" : "free", coins };
  } catch { return { ticker: t, status: "unknown", coins: [] }; }
}
