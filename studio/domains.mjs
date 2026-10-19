// domains.mjs — buy a domain through Vercel and put it on the coin's site, in one go (VERCEL_TOKEN, VERCEL_TEAM_ID).
//   quote   availability + the first-year price (Vercel registrar API)
//   buy     the order, with the owner's contact details (required by every registrar), then waits for it to complete
//   attach  the domain and its www. redirect on the coin's Vercel project; DNS is Vercel's, so nothing to configure
// Money is only spent by buy(), and only with the exact price the owner confirmed (expectedPrice); Vercel refuses the
// order if the price changed.
const API = "https://api.vercel.com";
const q = team => (team ? `?teamId=${encodeURIComponent(team)}` : "");
async function v(fetchImpl, token, method, path, body) {
  const r = await fetchImpl(API + path, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
                                           body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j?.error?.message || j?.message || `Vercel answered ${r.status}`), { status: r.status >= 500 ? 502 : 400, code: j?.error?.code || j?.code });
  return j;
}
const env = o => ({ fetchImpl: o.fetchImpl || fetch, token: o.token ?? process.env.VERCEL_TOKEN, team: o.team ?? process.env.VERCEL_TEAM_ID });
const need = token => { if (!token) throw Object.assign(new Error("Set VERCEL_TOKEN on the server to buy and attach domains."), { status: 400 }); };
export const cleanDomain = d => String(d || "").toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
const valid = d => /^[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})*\.[a-z]{2,24}$/.test(d);

export async function quote(domain, o = {}) {
  const { fetchImpl, token, team } = env(o); need(token);
  const d = cleanDomain(domain);
  if (!valid(d)) throw Object.assign(new Error("That is not a domain name."), { status: 400 });
  const av = await v(fetchImpl, token, "GET", `/v1/registrar/domains/${encodeURIComponent(d)}/availability${q(team)}`);
  if (!av.available) return { domain: d, available: false };
  const pr = await v(fetchImpl, token, "GET", `/v1/registrar/domains/${encodeURIComponent(d)}/price${q(team)}`);
  return { domain: d, available: true, years: pr.years, price: Number(pr.purchasePrice), renewal: Number(pr.renewalPrice) };
}

// many domains at once (Vercel takes up to 50 per call): available or not, then prices for the available ones
export async function availability(domains, o = {}) {
  const { fetchImpl, token, team } = env(o); need(token);
  const list = [...new Set(domains.map(cleanDomain).filter(valid))].slice(0, 50);
  if (!list.length) return [];
  try {
    const r = await v(fetchImpl, token, "POST", `/v1/registrar/domains/availability${q(team)}`, { domains: list });
    return list.map(d => ({ domain: d, available: !!(r.results || []).find(x => x.domain === d)?.available }));
  } catch {
    // one unsupported name can fail the whole batch: ask one by one
    return Promise.all(list.map(d => v(fetchImpl, token, "GET", `/v1/registrar/domains/${encodeURIComponent(d)}/availability${q(team)}`)
      .then(x => ({ domain: d, available: !!x.available })).catch(e => ({ domain: d, available: null, error: e.message }))));
  }
}
async function prices(domains, o) {
  const { fetchImpl, token, team } = env(o);
  return Promise.all(domains.map(d => v(fetchImpl, token, "GET", `/v1/registrar/domains/${encodeURIComponent(d)}/price${q(team)}`)
    .then(p => ({ domain: d, price: Number(p.purchasePrice), renewal: Number(p.renewalPrice), years: p.years })).catch(() => ({ domain: d, price: null }))));
}
// names a coin could live at, cheapest first: the brand and the ticker across the TLDs people use for coins
export const TLDS = ["fun", "xyz", "lol", "app", "gg", "io", "com", "club", "site", "online", "tech", "wtf", "meme", "world"];
export function candidates(brand, ticker) {
  const b = String(brand || "").toLowerCase().replace(/[^a-z0-9]/g, ""), t = String(ticker || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const names = [...new Set([b, t, b && "get" + b, b && "play" + b, b && b + "hq", b && b + "coin", t && t + "coin", b && b + "app"].filter(n => n && n.length >= 3))];
  const out = [];
  for (const n of names.slice(0, 3)) for (const tld of TLDS) out.push(`${n}.${tld}`);
  for (const n of names.slice(3)) for (const tld of TLDS.slice(0, 4)) out.push(`${n}.${tld}`);
  return out.slice(0, 50);
}
export async function suggest(brand, ticker, o = {}) {
  const av = await availability(candidates(brand, ticker), o);
  const free = av.filter(x => x.available).map(x => x.domain).slice(0, 20);
  const priced = (await prices(free, o)).filter(x => Number.isFinite(x.price) && x.price > 0);
  return priced.sort((a, b) => a.price - b.price).slice(0, 12);
}

export const CONTACT_FIELDS = ["firstName", "lastName", "email", "phone", "city", "state", "zip", "country"];
export function checkContact(c = {}) {
  const missing = CONTACT_FIELDS.filter(k => !String(c[k] || "").trim());
  if (missing.length) throw Object.assign(new Error("Fill in the domain owner details first: " + missing.join(", ") + "."), { status: 400 });
  return Object.fromEntries([...CONTACT_FIELDS, "companyName"].filter(k => c[k]).map(k => [k, String(c[k]).trim().slice(0, 120)]));
}

export async function buy(domain, expectedPrice, contact, o = {}) {
  const { fetchImpl, token, team } = env(o); need(token);
  const d = cleanDomain(domain);
  const order = await v(fetchImpl, token, "POST", `/v1/registrar/domains/${encodeURIComponent(d)}/buy${q(team)}`,
    { autoRenew: true, years: Number(o.years) || 1, expectedPrice: Number(expectedPrice), contactInformation: checkContact(contact) });
  // the order completes in seconds; wait up to ~2 minutes
  const wait = o.wait ?? 3000;
  for (let i = 0; i < 40; i++) {
    const st = await v(fetchImpl, token, "GET", `/v1/registrar/orders/${encodeURIComponent(order.orderId)}${q(team)}`);
    if (st.status === "completed") return { domain: d, orderId: order.orderId };
    if (st.status === "failed") throw Object.assign(new Error("Vercel could not register " + d + (st.error?.code ? ` (${st.error.code})` : "") + ". Nothing was charged for a failed order."), { status: 502 });
    await new Promise(r => setTimeout(r, wait));
  }
  throw Object.assign(new Error("The order for " + d + " is still processing at Vercel. Check vercel.com → Domains in a few minutes, then press Attach."), { status: 502 });
}

export async function attach(project, domain, o = {}) {
  const { fetchImpl, token, team } = env(o); need(token);
  const d = cleanDomain(domain), p = encodeURIComponent(project);
  const add = async body => { try { return await v(fetchImpl, token, "POST", `/v10/projects/${p}/domains${q(team)}`, body); }
    catch (e) { if (/already|in use by this project|exists/i.test(e.message)) return { name: body.name, already: true }; throw e; } };
  const main = await add({ name: d });
  await add({ name: "www." + d, redirect: d, redirectStatusCode: 308 }).catch(() => null);
  return { domain: d, verified: main.verified !== false, already: !!main.already };
}
