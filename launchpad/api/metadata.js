// POST /api/metadata — uploads the coin's picture and details to pump.fun's IPFS and returns the metadata URI.
// Runs on the server because pump.fun's upload endpoint does not accept browser (CORS) requests.
// Body (JSON): { name, symbol, description, twitter, telegram, website, image: "data:image/png;base64,…" }
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;   // Vercel caps a request at 4.5 MB; base64 adds a third
const IPFS_URL = process.env.PUMP_IPFS_URL || "https://pump.fun/api/ipfs";

export function checkFields(b) {
  const name = String(b?.name || "").trim();
  const symbol = String(b?.symbol || "").trim().replace(/^\$/, "");
  if (!name || name.length > 32) return { error: "Name is required, up to 32 characters." };
  if (!/^[A-Za-z0-9]{1,10}$/.test(symbol)) return { error: "Ticker is required: 1–10 letters or numbers." };
  const m = /^data:(image\/(png|jpeg|gif|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(b?.image || ""));
  if (!m) return { error: "Add a PNG, JPG, GIF or WebP picture." };
  const bytes = Buffer.from(m[3], "base64");
  if (bytes.length > MAX_IMAGE_BYTES) return { error: "The picture must be under 3 MB." };
  const link = v => {
    const s = String(v || "").trim();
    return /^https:\/\/[^\s]{3,200}$/.test(s) ? s : "";
  };
  return {
    name, symbol: symbol.toUpperCase(), type: m[1], ext: m[2] === "jpeg" ? "jpg" : m[2], bytes,
    description: String(b?.description || "").trim().slice(0, 500),
    twitter: link(b?.twitter), telegram: link(b?.telegram), website: link(b?.website),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  const f = checkFields(req.body || {});
  if (f.error) return res.status(400).json({ error: f.error });
  const form = new FormData();
  form.append("file", new Blob([f.bytes], { type: f.type }), `coin.${f.ext}`);
  form.append("name", f.name);
  form.append("symbol", f.symbol);
  form.append("description", f.description);
  if (f.twitter) form.append("twitter", f.twitter);
  if (f.telegram) form.append("telegram", f.telegram);
  if (f.website) form.append("website", f.website);
  form.append("showName", "true");
  try {
    const r = await fetch(IPFS_URL, { method: "POST", body: form, signal: AbortSignal.timeout(25000) });
    const text = await r.text();
    let j = null;
    try { j = JSON.parse(text); } catch { /* an HTML page = blocked */ }
    if (!r.ok || !j?.metadataUri) {
      const why = !r.ok ? `pump.fun answered ${r.status}` : "pump.fun did not return a metadata link";
      return res.status(502).json({ error: `Could not upload the picture to pump.fun (${why}). Try again in a minute.` });
    }
    return res.status(200).json({ metadataUri: j.metadataUri, name: f.name, symbol: f.symbol });
  } catch (e) {
    return res.status(502).json({ error: `Could not reach pump.fun (${e.name === "TimeoutError" ? "timed out" : "network error"}). Try again.` });
  }
}
