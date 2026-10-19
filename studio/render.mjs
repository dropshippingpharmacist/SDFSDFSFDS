// render.mjs — turn an HTML page into a PNG, or a canvas animation into an MP4, with a headless browser and ffmpeg.
//   image: open the page at its size, wait for fonts, screenshot.
//   video: the page defines window.render(tSeconds) that draws frame t on its <canvas id="c">, and window.DURATION.
//          Every frame is drawn on demand (deterministic, no real-time capture), pulled out as PNG and piped into ffmpeg
//          with a synthesized backing track -> H.264 MP4, the format X takes.
// Needs a Chromium (CHROMIUM_PATH, or one found on the machine) and ffmpeg (FFMPEG_PATH or on PATH). Without them the
// Studio still writes the HTML files and says what is missing.
import { spawn, execSync } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// the fonts the repo ships (render/fonts): embedded into every page the renderer opens, so text is drawn even on a
// machine with no system fonts at all; the page's Google Fonts still win when they arrive
const FONT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "render", "fonts");
let fontCss = null;
async function embeddedFonts() {
  if (fontCss !== null) return fontCss;
  try {
    const face = async (file, weight) => `@font-face{font-family:"DejaVu Sans";font-weight:${weight};src:url(data:font/ttf;base64,${(await readFile(path.join(FONT_DIR, file))).toString("base64")}) format("truetype")}`;
    fontCss = `<style>${await face("DejaVuSans.ttf", 400)}${await face("DejaVuSans-Bold.ttf", 700)}</style>`;
  } catch { fontCss = ""; }
  return fontCss;
}
export async function withFonts(html) {
  const css = await embeddedFonts();
  if (!css) return html;
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + css) : css + html;
}

let pw = null;
async function playwright() { if (!pw) pw = await import("playwright-core"); return pw; }

function which(names) {
  for (const n of names) { try { const p = execSync(`command -v ${n}`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); if (p) return p; } catch { /* next */ } }
  return null;
}
const exists = p => { try { execSync(`test -x "${p}"`); return true; } catch { return false; } };
export function chromiumPath() {
  // an env value may be a bare name ("chromium"): resolve it on PATH; a path that does not exist is ignored
  for (const v of [process.env.CHROMIUM_PATH, process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH].filter(Boolean)) {
    if (v.includes("/") && exists(v)) return v;
    if (!v.includes("/")) { const w = which([v]); if (w) return w; }
  }
  return
    which(["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) ||
    (process.env.PLAYWRIGHT_BROWSERS_PATH && [path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, "chromium")].find(p => { try { execSync(`test -x ${p}`); return true; } catch { return false; } })) || null;
}
export function ffmpegPath() { return process.env.FFMPEG_PATH || which(["ffmpeg"]); }
export function renderStatus() {
  const c = chromiumPath(), f = ffmpegPath();
  return { images: !!c, videos: !!c && !!f, chromium: !!c, ffmpeg: !!f };
}

// web fonts (Google Fonts in the page) get up to 8 seconds to arrive; the system fonts are the fallback either way
async function fontsReady(page) {
  await Promise.race([page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {}), new Promise(r => setTimeout(r, 8000))]);
  await page.waitForTimeout(250);
}
export async function fontCheck() {
  // does this machine draw text at all? (a container without fonts renders words as nothing)
  try {
    return await withPage(200, 60, async page => {
      await page.setContent("<body style='margin:0'><div style='font:40px sans-serif'>Wg</div></body>");
      return page.evaluate(() => { const c = document.createElement("canvas"); c.width = 100; c.height = 50; const x = c.getContext("2d"); x.font = "40px sans-serif"; x.fillText("Wg", 2, 40);
        return x.getImageData(0, 0, 100, 50).data.some((v, i) => i % 4 === 3 && v > 0); });
    });
  } catch { return false; }
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
    await page.setContent(await withFonts(html), { waitUntil: "load" });
    await fontsReady(page);
    return page.screenshot({ type: "png", clip: { x: 0, y: 0, width, height } });
  });
}

// the soundtrack: a 120 BPM track synthesized by ffmpeg, timed to the video (the video's beats land on the same grid):
// a 2-second noise riser, then the drop: a pitched kick on every beat, a snare on 2 and 4, off-beat hats, a plucked
// bassline and a chord pad through A-F-C-G (two seconds each), an arpeggio on top; it cuts clean 0.4 s before the end.
// A compressor and a limiter glue it and keep it loud without clipping.
export const BPM = 120, DROP = 2;
const TRACK = "gte(t,2)*lt(t,D-0.4)*(1.0*sin(2*PI*(42+150*exp(-40*mod(t,0.5)))*mod(t,0.5))*exp(-7*mod(t,0.5))+0.32*(random(0)*2-1)*exp(-18*mod(t-0.5,1))*gte(mod(t,1),0.5)*lt(mod(t,1),0.75)+0.17*sin(2*PI*(55*if(lt(mod(floor(t/2),4),1),1,if(lt(mod(floor(t/2),4),2),0.7937,if(lt(mod(floor(t/2),4),3),1.1892,0.8909))))*t)*(1-exp(-25*mod(t,0.25)))*exp(-3*mod(t,0.25)))+0.07*(random(1)*2-1)*exp(-90*mod(t+0.25,0.5))*lt(t,D-0.4)+lt(t,2)*0.06*(random(3)*2-1)*t*t+0.035*(sin(2*PI*220*if(lt(mod(floor(t/2),4),1),1,if(lt(mod(floor(t/2),4),2),0.7937,if(lt(mod(floor(t/2),4),3),1.1892,0.8909)))*t)+sin(2*PI*277.18*if(lt(mod(floor(t/2),4),1),1,if(lt(mod(floor(t/2),4),2),0.7937,if(lt(mod(floor(t/2),4),3),1.1892,0.8909)))*t)+sin(2*PI*329.63*if(lt(mod(floor(t/2),4),1),1,if(lt(mod(floor(t/2),4),2),0.7937,if(lt(mod(floor(t/2),4),3),1.1892,0.8909)))*t))*(0.6+0.4*sin(2*PI*2*t))*lt(t,D-0.4)+0.05*sin(2*PI*880*if(lt(mod(floor(t/0.25),8),1),1,if(lt(mod(floor(t/0.25),8),3),1.2599,if(lt(mod(floor(t/0.25),8),5),1.4983,1.1892)))*t)*exp(-14*mod(t,0.25))*gte(t,2)*lt(t,D-0.4)";
export const soundtrack = dur => `aevalsrc='${TRACK.replace(/D/g, String(dur))}':s=44100`;
export const MASTER = "acompressor=threshold=-18dB:ratio=2:attack=10:release=120,alimiter=limit=0.95,volume=1.2";

export async function renderVideo(html, { width = 1080, height = 1080, fps = 30, seconds = 20, out }) {
  const ff = ffmpegPath();
  if (!ff) throw Object.assign(new Error("No ffmpeg on the server (set FFMPEG_PATH, or add ffmpeg to the build)."), { status: 503 });
  await mkdir(path.dirname(out), { recursive: true });
  return withPage(width, height, async page => {
    await page.setContent(await withFonts(html), { waitUntil: "load" });
    await fontsReady(page);
    const ok = await page.evaluate(() => typeof window.render === "function" && !!document.getElementById("c"));
    if (!ok) throw Object.assign(new Error("The video page has no render(t) or no <canvas id=\"c\">."), { status: 400 });
    const dur = Math.min(60, Math.max(3, Number(await page.evaluate(() => window.DURATION)) || seconds));
    const frames = Math.round(dur * fps);
    const args = ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-i", "pipe:0",
                  "-f", "lavfi", "-t", String(dur), "-i", soundtrack(dur),
                  "-map", "0:v", "-map", "1:a", "-af", MASTER, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "18", "-movflags", "+faststart",
                  "-c:a", "aac", "-b:a", "192k", "-shortest", out];
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
