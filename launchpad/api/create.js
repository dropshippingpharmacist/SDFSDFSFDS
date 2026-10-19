// POST /api/create — asks PumpPortal's public "local transaction" API for an unsigned pump.fun create transaction.
// The server never sees a private key: the browser signs with the new coin's mint key and the user's wallet.
// Body (JSON): { publicKey, mint, name, symbol, uri, devBuySol }
// -> { tx: "<base64 serialized VersionedTransaction>" }
const TRADE_LOCAL = process.env.PUMPPORTAL_TRADE_LOCAL || "https://pumpportal.fun/api/trade-local";
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export const MAX_DEV_BUY_SOL = Number(process.env.MAX_DEV_BUY_SOL || 5);

export function checkCreate(b) {
  if (!B58.test(String(b?.publicKey || ""))) return { error: "Connect your wallet first." };
  if (!B58.test(String(b?.mint || ""))) return { error: "Missing the new coin's address." };
  const name = String(b?.name || "").trim(), symbol = String(b?.symbol || "").trim();
  if (!name || name.length > 32 || !/^[A-Za-z0-9]{1,10}$/.test(symbol)) return { error: "Name or ticker is invalid." };
  if (!/^https:\/\/\S+$/.test(String(b?.uri || ""))) return { error: "Missing the metadata link (upload the picture first)." };
  const buy = Number(b?.devBuySol ?? 0);
  if (!Number.isFinite(buy) || buy < 0 || buy > MAX_DEV_BUY_SOL) {
    return { error: `Your first buy must be between 0 and ${MAX_DEV_BUY_SOL} SOL.` };
  }
  return {
    publicKey: b.publicKey, action: "create", mint: b.mint,
    tokenMetadata: { name, symbol, uri: b.uri },
    denominatedInSol: "true", amount: buy, slippage: 10, priorityFee: 0.0005, pool: "pump",
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  const body = checkCreate(req.body || {});
  if (body.error) return res.status(400).json({ error: body.error });
  try {
    const r = await fetch(TRADE_LOCAL, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    if (r.status !== 200) {
      const t = (await r.text()).slice(0, 200);
      return res.status(502).json({ error: `PumpPortal could not build the launch (HTTP ${r.status}${t ? ": " + t : ""}).` });
    }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 100) return res.status(502).json({ error: "PumpPortal returned an empty transaction. Try again." });
    return res.status(200).json({ tx: buf.toString("base64") });
  } catch (e) {
    return res.status(502).json({ error: `Could not reach PumpPortal (${e.name === "TimeoutError" ? "timed out" : "network error"}).` });
  }
}
