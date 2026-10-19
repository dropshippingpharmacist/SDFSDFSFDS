// pumplive.mjs — every new pump.fun coin, live, without pump.fun's (blocked) web API.
//   PumpPortal's public data stream (wss://pumpportal.fun/api/data, no key) sends each token creation and each
//   migration to PumpSwap the moment it lands on-chain. We keep a rolling window in memory, convert SOL market caps
//   to USD, and read each coin's own metadata JSON (name, description, website, X, Telegram) from IPFS, in small
//   batches so nobody gets hammered. snapshot() hands the result to the trend feeds in their usual shape.
const WINDOW = 24 * 36e5;
const MAX = 4000;
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const clip = (s, n = 200) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);

export function createPumpLive({ url = process.env.PUMPPORTAL_WS || "wss://pumpportal.fun/api/data", WS = globalThis.WebSocket, fetchImpl = fetch,
                                 now = Date.now, log = () => {} } = {}) {
  const coins = new Map();          // mint -> coin
  let ws = null, stopped = false, backoff = 2000, connected = false, solUsd = null, solAt = 0;
  const stats = { created: 0, migrated: 0, since: null, lastEvent: null };

  function onMessage(raw) {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || !m.mint) return;
    const t = now();
    stats.lastEvent = t;
    if (m.txType === "create") {
      coins.set(m.mint, { mint: m.mint, name: clip(m.name, 40), symbol: clip(m.symbol, 12), uri: m.uri || null, creator: m.traderPublicKey || null,
                          createdAt: t, mcSol: num(m.marketCapSol), devBuySol: num(m.solAmount), pool: m.pool || "pump", graduated: false, meta: null });
      stats.created++;
    } else if (m.txType === "migrate") {
      const c = coins.get(m.mint) || { mint: m.mint, name: null, symbol: null, uri: null, createdAt: t, mcSol: null, pool: "pump-amm", meta: null };
      c.graduated = true; c.migratedAt = t; coins.set(m.mint, c);
      stats.migrated++;
    }
    if (coins.size > MAX) for (const k of [...coins.keys()].slice(0, coins.size - MAX)) coins.delete(k);
  }

  function connect() {
    if (stopped || !WS) return;
    try { ws = new WS(url); } catch (e) { log("pump live: " + e.message); return retry(); }
    ws.onopen = () => { connected = true; backoff = 2000; stats.since = stats.since || now();
      ws.send(JSON.stringify({ method: "subscribeNewToken" })); ws.send(JSON.stringify({ method: "subscribeMigration" })); };
    ws.onmessage = ev => onMessage(typeof ev.data === "string" ? ev.data : String(ev.data));
    ws.onerror = () => {};
    ws.onclose = () => { connected = false; retry(); };
  }
  function retry() { if (stopped) return; setTimeout(connect, backoff).unref?.(); backoff = Math.min(backoff * 2, 5 * 60e3); }

  async function solPrice() {
    if (solUsd && now() - solAt < 10 * 60e3) return solUsd;
    try {
      const r = await fetchImpl("https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112", { signal: AbortSignal.timeout(8000) });
      const j = await r.json();
      const p = (j.pairs || []).filter(x => x.chainId === "solana").sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
      if (p && num(p.priceUsd)) { solUsd = Number(p.priceUsd); solAt = now(); }
    } catch { /* keep the old price */ }
    return solUsd;
  }
  // the coin's own metadata (what the launcher uploaded): description and links
  async function enrich(list, limit = 40) {
    const todo = list.filter(c => c.uri && c.meta === null).slice(0, limit);
    await Promise.all(todo.map(async c => {
      c.meta = {};
      try {
        const u = c.uri.replace(/^ipfs:\/\//, "https://ipfs.io/ipfs/");
        if (!/^https:\/\//.test(u)) return;
        const r = await fetchImpl(u, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
        if (!r.ok) return;
        const j = await r.json();
        c.meta = { description: clip(j.description, 200), website: j.website || null, x: j.twitter || null, telegram: j.telegram || null, image: j.image || null };
        if (!c.name && j.name) c.name = clip(j.name, 40);
        if (!c.symbol && j.symbol) c.symbol = clip(j.symbol, 12);
      } catch { /* no metadata, still a launch */ }
    }));
  }

  // what the feeds get: the newest launches, the biggest of the last hours, and every graduation of the day
  async function snapshot({ newest = 60, biggest = 60 } = {}) {
    const t = now(), all = [...coins.values()].filter(c => t - c.createdAt < WINDOW);
    const byNew = [...all].sort((a, b) => b.createdAt - a.createdAt).slice(0, newest);
    const byBig = [...all].filter(c => c.mcSol).sort((a, b) => b.mcSol - a.mcSol).slice(0, biggest);
    const grads = all.filter(c => c.graduated);
    const pick = new Map(); for (const c of [...grads, ...byBig, ...byNew]) pick.set(c.mint, c);
    const list = [...pick.values()];
    const price = await solPrice();
    await enrich([...grads, ...byBig, ...byNew]);
    return list.map(c => ({
      source: c.graduated ? "pump.fun graduated (live)" : byBig.includes(c) && !byNew.includes(c) ? "pump.fun biggest (live)" : "pump.fun new (live)",
      address: c.mint, name: c.name, symbol: c.symbol, description: c.meta?.description || null, website: c.meta?.website || null,
      x: c.meta?.x || null, telegram: c.meta?.telegram || null, mcUsd: c.mcSol && price ? Math.round(c.mcSol * price) : null,
      createdAt: c.createdAt, graduated: c.graduated, dex: c.graduated ? "pumpswap" : "pumpfun", devBuySol: c.devBuySol,
      url: `https://pump.fun/coin/${c.mint}`,
    }));
  }
  function status() {
    const t = now(), all = [...coins.values()];
    return { connected, created: stats.created, migrated: stats.migrated, lastHour: all.filter(c => t - c.createdAt < 36e5 && !c.migratedAt || (c.migratedAt && t - c.createdAt < 36e5)).length,
             since: stats.since, lastEvent: stats.lastEvent, solUsd };
  }
  function stop() { stopped = true; try { ws?.close(); } catch { /* closing */ } }
  return { connect, stop, snapshot, status, _onMessage: onMessage };
}
