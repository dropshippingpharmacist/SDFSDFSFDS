// POST /api/send — broadcasts a FULLY SIGNED launch transaction, or checks one.
//   { tx: "<base64>" }        -> { signature }
//   { signature: "<base58>" } -> { status: "pending" | "confirmed" | "finalized" | "failed", error? }
// The transaction arrives already signed by the user's wallet and the coin's mint key; nothing is signed here.
const RPC = process.env.RPC_URL || "https://api.mainnet-beta.solana.com";
const SIG = /^[1-9A-HJ-NP-Za-km-z]{64,90}$/;

export async function rpc(method, params, fetchImpl = fetch) {
  const r = await fetchImpl(RPC, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(20000),
  });
  const j = await r.json();
  if (j.error) throw Object.assign(new Error(j.error.message || "RPC error"), { rpc: true });
  return j.result;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  const b = req.body || {};
  try {
    if (b.tx) {
      if (!/^[A-Za-z0-9+/=]{200,}$/.test(String(b.tx))) return res.status(400).json({ error: "That is not a signed transaction." });
      const signature = await rpc("sendTransaction", [b.tx, { encoding: "base64", skipPreflight: false, maxRetries: 5,
                                                              preflightCommitment: "confirmed" }]);
      return res.status(200).json({ signature });
    }
    if (b.signature) {
      if (!SIG.test(String(b.signature))) return res.status(400).json({ error: "That is not a transaction signature." });
      const r = await rpc("getSignatureStatuses", [[b.signature], { searchTransactionHistory: false }]);
      const s = r?.value?.[0];
      if (!s) return res.status(200).json({ status: "pending" });
      if (s.err) return res.status(200).json({ status: "failed", error: JSON.stringify(s.err).slice(0, 200) });
      return res.status(200).json({ status: s.confirmationStatus === "finalized" ? "finalized" : "confirmed" });
    }
    return res.status(400).json({ error: "Send { tx } or { signature }." });
  } catch (e) {
    const msg = e.rpc ? e.message : (e.name === "TimeoutError" ? "the Solana node timed out" : "network error");
    return res.status(502).json({ error: `Solana rejected or did not answer: ${String(msg).slice(0, 240)}` });
  }
}
