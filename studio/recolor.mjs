// recolor.mjs — a built game or tool follows the site's palette without being rebuilt (no AI, no cost).
// The palette the app was built with is remembered; when the site's colors change, every color in the app close to an
// old accent is moved to the matching new accent, keeping its own lightness offset, so shades and highlights stay
// shades and highlights. Apps built before this was remembered: their most-used saturated color is taken as accent 1.
const HEX = /#([0-9a-f]{6}|[0-9a-f]{3})\b/gi;
const full = h => h.length === 4 ? "#" + [...h.slice(1)].map(c => c + c).join("") : h;
function hsl(hex) {
  const n = parseInt(full(hex).slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hex(h, s, l) {
  const f = n => { const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, "0"); };
  return "#" + f(0) + f(8) + f(4);
}
const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

// the app's dominant saturated color (for apps without a remembered palette)
export function dominant(html) {
  const count = new Map();
  for (const m of String(html).matchAll(HEX)) { const c = full(m[0]).toLowerCase(), [, s, l] = hsl(c); if (s > 0.45 && l > 0.25 && l < 0.8) count.set(c, (count.get(c) || 0) + 1); }
  return [...count].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

// from / to: arrays of hex accents in the same order (accent, accent2, accent3)
export function recolor(html, from, to) {
  const pairs = from.map((f, i) => [f && hsl(f), to[i] && hsl(to[i])]).filter(([a, b]) => a && b && a[1] > 0.2);
  if (!pairs.length) return html;
  return String(html).replace(HEX, m => {
    const [h, s, l] = hsl(m);
    if (s < 0.25) return m;                                   // greys, blacks, whites stay
    let best = null;
    for (const [a, b] of pairs) { const d = hueDist(h, a[0]); if (d <= 28 && (!best || d < best.d)) best = { d, a, b }; }
    if (!best) return m;
    const nl = Math.max(0.04, Math.min(0.96, best.b[2] + (l - best.a[2])));
    const ns = Math.max(0, Math.min(1, best.b[1] * (s / Math.max(0.01, best.a[1]))));
    return hex(best.b[0], ns, nl);
  });
}

export function appFor(d) {
  if (!d.app) return d.app;
  const now = [d.config.colors?.accent, d.config.colors?.accent2, d.config.colors?.accent3];
  const built = d.config.appPalette || [dominant(d.app)];
  if (built.every((c, i) => !c || c === now[i])) return d.app;
  return recolor(d.app, built, now);
}
