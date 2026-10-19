// render.mjs — turn an HTML page into a PNG, or a canvas animation into an MP4, with a headless browser and ffmpeg.
//   image: open the page at its size, wait for fonts, screenshot.
//   video: the page defines window.render(tSeconds) that draws frame t on its <canvas id="c">, and window.DURATION.
//          Every frame is drawn on demand (deterministic, no real-time capture), pulled out as PNG and piped into ffmpeg
//          with a synthesized backing track -> H.264 MP4, the format X takes.
// Needs a Chromium (CHROMIUM_PATH, or one found on the machine) and ffmpeg (FFMPEG_PATH or on PATH). Without them the
// Studio still writes the HTML files and says what is missing.
import { spawn, execSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

let pw = null;
async function playwright() { if (!pw) pw = await import("playwright-core"); return pw; }

function which(names) {
  for (const n of names) { try { const p = execSync(`command -v ${n}`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); if (p) return p; } catch { /* next */ } }
  return null;
}
export function chromiumPath() {
  return process.env.CHROMIUM_PATH || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    which(["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) ||
    (process.env.PLAYWRIGHT_BROWSERS_PATH && [path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, "chromium")].find(p => { try { execSync(`test -x ${p}`); return true; } catch { return false; } })) || null;
}
export function ffmpegPath() { return process.env.FFMPEG_PATH || which(["ffmpeg"]); }
export function renderStatus() {
  const c = chromiumPath(), f = ffmpegPath();
  return { images: !!c, videos: !!c && !!f, chromium: !!c, ffmpeg: !!f };
}

async function withPage(w, h, fn) {
  const exe = chromiumPath();
  if (!exe) throw Object.assign(new Error("No browser on the server to render with (set CHROMIUM_PATH, or add chromium to the build)."), { status: 503 });
  const { chromium } = await playwright();
  const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--font-render-hinting=none"] });
  try {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    return await fn(page);
  } finally { await browser.close(); }
}

export async function renderImage(html, { width, height }) {
  return withPage(width, height, async page => {
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
    await page.waitForTimeout(300);
    return page.screenshot({ type: "png", clip: { x: 0, y: 0, width, height } });
  });
}

// a soft synthesized backing track so the clip is not silent (owners can swap in music when they post)
const AUDIO = "aevalsrc='0.10*sin(2*PI*110*t)*(0.6+0.4*sin(2*PI*0.5*t))+0.07*sin(2*PI*220*t)+0.05*sin(2*PI*330*t)*(0.5+0.5*sin(2*PI*2*t))+0.03*sin(2*PI*440*t)*(0.5+0.5*sin(2*PI*4*t))+0.025*random(0)*lt(mod(t,0.5),0.03)':s=44100";

export async function renderVideo(html, { width = 1080, height = 1080, fps = 30, seconds = 20, out }) {
  const ff = ffmpegPath();
  if (!ff) throw Object.assign(new Error("No ffmpeg on the server (set FFMPEG_PATH, or add ffmpeg to the build)."), { status: 503 });
  await mkdir(path.dirname(out), { recursive: true });
  return withPage(width, height, async page => {
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
    const ok = await page.evaluate(() => typeof window.render === "function" && !!document.getElementById("c"));
    if (!ok) throw Object.assign(new Error("The video page has no render(t) or no <canvas id=\"c\">."), { status: 400 });
    const dur = Math.min(60, Math.max(3, Number(await page.evaluate(() => window.DURATION)) || seconds));
    const frames = Math.round(dur * fps);
    const args = ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-i", "pipe:0",
                  "-f", "lavfi", "-t", String(dur), "-i", AUDIO,
                  "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "20", "-movflags", "+faststart",
                  "-c:a", "aac", "-b:a", "128k", "-shortest", out];
    const proc = spawn(ff, args, { stdio: ["pipe", "ignore", "pipe"] });
    let errText = ""; proc.stderr.on("data", d => { errText += d; });
    const done = new Promise((res, rej) => { proc.on("close", c => c === 0 ? res() : rej(new Error("ffmpeg failed: " + errText.slice(0, 300)))); proc.on("error", rej); });
    for (let i = 0; i < frames; i++) {
      const dataUrl = await page.evaluate(t => { window.render(t); return document.getElementById("c").toDataURL("image/png"); }, i / fps);
      const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
      if (!proc.stdin.write(buf)) await new Promise(r => proc.stdin.once("drain", r));
    }
    proc.stdin.end();
    await done;
    return { out, seconds: dur, frames, fps };
  });
}

export async function saveHtml(file, html) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, html); }
