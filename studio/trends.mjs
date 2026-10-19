// trends.mjs — what is launching and running on Solana right now, from public feeds, for the Idea Maker.
//   DexScreener  newest token profiles + top boosted tokens (free, no key)
//   GeckoTerminal Solana trending pools (free, no key)
//   pump.fun     newest coins (unofficial API; often blocks servers — then simply left out)
//   DEXTools     hot pools, only with DEXTOOLS_API_KEY
// Every source is optional: one that fails is listed in `failed`, the rest still count. Cached 10 minutes.
const TTL = 10 * 60 * 1000;
let cache = null;

const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const clip = (s, n = 160) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);

async function getJson(url, fetchImpl, headers = {}) {
  const r = await fetchImpl(url, { headers: { accept: "application/json", "user-agent": "Mozilla/5.0 launchpad-studio", ...headers },
                                   signal: AbortSignal.timeout(9000) });
  if (!r.ok) throw new Error(`${r.status}`);
  const t = await r.text();
  if (/^\s*</.test(t)) throw new Error("blocked");
  return JSON.parse(t);
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
    return rows.slice(0, 40).map(x => ({
      source: x.boosted ? "DexScreener boosted" : "DexScreener new", name: null,
      symbol: null, description: clip(x.description, 200), url: x.url || null, address: x.tokenAddress || null,
    }));
  },
  async geckoterminal(f) {
    const j = await getJson("https://api.geckoterminal.com/api/v2/networks/solana/trending_pools?page=1", f);
    return (j.data || []).slice(0, 25).map(p => {
      const a = p.attributes || {};
      return { source: "GeckoTerminal trending", name: clip(String(a.name || "").split(" / ")[0], 40), symbol: clip(String(a.name || "").split(" / ")[0], 12),
               description: null, mcUsd: num(a.market_cap_usd) ?? num(a.fdv_usd), volUsd: num(a.volume_usd?.h24),
               change24h: num(a.price_change_percentage?.h24), url: `https://www.geckoterminal.com/solana/pools/${a.address || ""}` };
    });
  },
  async pumpfun(f) {
    const base = (process.env.COINCHECK_PUMP_API || "https://frontend-api-v3.pump.fun").replace(/\/$/, "");
    const j = await getJson(`${base}/coins?offset=0&limit=50&sort=market_cap&order=DESC&includeNsfw=false`, f,
                            { origin: "https://pump.fun", referer: "https://pump.fun/" });
    const rows = Array.isArray(j) ? j : (j.coins || []);
    return rows.slice(0, 40).map(c => ({ source: "pump.fun", name: clip(c.name, 40), symbol: clip(c.symbol, 12), description: clip(c.description, 200),
      mcUsd: num(c.usd_market_cap), url: c.mint ? `https://pump.fun/coin/${c.mint}` : null }));
  },
  async dextools(f) {
    const key = process.env.DEXTOOLS_API_KEY;
    if (!key) throw new Error("no DEXTOOLS_API_KEY");
    const plan = process.env.DEXTOOLS_PLAN || "trial";
    const j = await getJson(`https://public-api.dextools.io/${plan}/v2/ranking/solana/hotpools`, f, { "x-api-key": key });
    return (j.data || []).slice(0, 25).map(p => ({ source: "DEXTools hot", name: clip(p.mainToken?.name, 40), symbol: clip(p.mainToken?.symbol, 12),
      description: null, url: p.address ? `https://www.dextools.io/app/en/solana/pair-explorer/${p.address}` : null }));
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
  const seen = new Set();
  const uniq = items.filter(x => { const k = (x.symbol || x.name || x.description || "").toLowerCase(); if (!k || seen.has(k)) return false; seen.add(k); return true; });
  const data = { at: now, items: uniq.slice(0, 120), ok, failed };
  cache = { at: now, data };
  return data;
}
export function resetTrends() { cache = null; }

// how a launched site's coin is doing (DexScreener), for the Studio's memory
export async function coinStats(ca, fetchImpl = fetch) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(ca || ""))) return null;
  try {
    const j = await getJson(`https://api.dexscreener.com/latest/dex/tokens/${ca}`, fetchImpl);
    const p = (j.pairs || []).sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
    if (!p) return { listed: false };
    return { listed: true, mcUsd: num(p.marketCap) ?? num(p.fdv), volUsd: num(p.volume?.h24), change24h: num(p.priceChange?.h24),
             ageH: p.pairCreatedAt ? Math.round((Date.now() - p.pairCreatedAt) / 36e5) : null, url: p.url || null };
  } catch { return null; }
}
