const pptxgen = require("pptxgenjs");
const React = require("react");
const RDS = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa6");
const { applyTheme } = require("/root/.claude/skills/synced/b2efe266-2f7e-4630-a608-fb448ae44660_126bc6f5-4efc-4203-acec-76588d919676/pptx/scripts/apply_theme.js");

const OUT = process.argv[2] || "deck.pptx";
const THEME = {
  name: "PRNTR",
  headFontFace: "Arial",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "0B0B1A", lt1: "FFFFFF", dk2: "1A2350", lt2: "B9C3D6",
    accent1: "2AABE3", accent2: "26C6A6", accent3: "7B61FF", accent4: "E0B84A", accent5: "FF6B6B", accent6: "13182E",
    hlink: "2AABE3", folHlink: "7B61FF",
  },
};
const HEX = THEME.colors;

async function icon(name, color) {
  const svg = RDS.renderToStaticMarkup(React.createElement(fa[name], { color: "#" + color, size: 256 }));
  const buf = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9"; // 10 x 5.625
  pres.title = "PRNTR Crossover and Crypto Income";
  pres.author = "PRNTR.AI";
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;

  const FOOT = { text: "PRNTR Crossover · Education only, not financial advice", options: { x: 0.5, y: 5.25, w: 6, h: 0.25, fontSize: 9, color: C.background2 } };
  pres.defineSlideMaster({
    title: "PRNTR Cover", background: { color: C.text1 },
    objects: [],
    placeholders: [],
  });
  pres.defineSlideMaster({
    title: "PRNTR Section", background: { color: C.text2 },
    objects: [{ text: FOOT }],
    slideNumber: { x: 9.1, y: 5.22, w: 0.5, h: 0.28, fontSize: 9, color: C.background2, align: "right" },
    placeholders: [],
  });
  pres.defineSlideMaster({
    title: "PRNTR Content", background: { color: C.text1 },
    objects: [{ text: FOOT }],
    slideNumber: { x: 9.1, y: 5.22, w: 0.5, h: 0.28, fontSize: 9, color: C.background2, align: "right" },
    placeholders: [],
  });

  // ---------- helpers ----------
  let sec = "Start";
  let les = 0;
  const icons = {};
  async function ic(name, col) { const k = name + col; if (!icons[k]) icons[k] = await icon(name, col); return icons[k]; }

  function content(title, kicker) {
    const s = pres.addSlide({ masterName: "PRNTR Content", sectionTitle: sec });
    if (kicker) s.addText(kicker.toUpperCase(), { isTextBox: true, x: 0.5, y: 0.28, w: 8, h: 0.3, fontSize: 10, bold: true, charSpacing: 3, color: C.accent1, margin: 0 });
    s.addText(title, { isTextBox: true, x: 0.5, y: 0.55, w: 9, h: 0.65, fontSize: 28, bold: true, fontFace: THEME.headFontFace, color: C.background1, margin: 0, objectName: "Title" });
    return s;
  }
  function check(s, text) {   // a visible "owner check" tag for anything I'm unsure of
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.35, y: 0.28, w: 2.15, h: 0.32, rectRadius: 0.16, fill: { color: C.accent4 }, line: { color: C.accent4 }, objectName: "Owner check" });
    s.addText("OWNER CHECK", { isTextBox: true, x: 7.35, y: 0.28, w: 2.15, h: 0.32, fontSize: 10, bold: true, align: "center", valign: "middle", color: C.text1, margin: 0 });
    s.addNotes("OWNER CHECK: " + text);
  }
  function card(s, x, y, w, h, title, body, opts = {}) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: opts.fill || C.text2 }, line: { color: opts.line || C.text2 }, objectName: "Card " + title });
    s.addText(title, { isTextBox: true, x: x + 0.18, y: y + 0.14, w: w - 0.36, h: 0.36, fontSize: 15, bold: true, color: opts.tcol || C.accent1, margin: 0, valign: "top" });
    s.addText(body, { isTextBox: true, x: x + 0.18, y: y + 0.52, w: w - 0.36, h: h - 0.64, fontSize: 13, color: C.background1, margin: 0, valign: "top", paraSpaceAfter: 4 });
  }
  async function iconRows(s, rows, x, y, w, rowH, col) {
    for (let i = 0; i < rows.length; i++) {
      const [ico, head, body] = rows[i];
      const yy = y + i * rowH;
      s.addShape(pres.shapes.OVAL, { x, y: yy, w: 0.5, h: 0.5, fill: { color: C.text2 }, line: { color: col || C.accent1, width: 1.25 } });
      s.addImage({ data: await ic(ico, col ? HEX[col] || col : HEX.accent1), x: x + 0.13, y: yy + 0.13, w: 0.24, h: 0.24 });
      s.addText([{ text: head, options: { bold: true, color: C.background1, breakLine: true } }, { text: body, options: { color: C.background2 } }],
        { isTextBox: true, x: x + 0.7, y: yy - 0.04, w: w - 0.7, h: rowH, fontSize: 13, margin: 0, valign: "top" });
    }
  }
  function steps(s, items, y, h) {
    const n = items.length, gap = 0.15, w = (9 - gap * (n - 1)) / n;
    items.forEach(([head, body], i) => {
      const x = 0.5 + i * (w + gap);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: C.text2 }, line: { color: C.text2 } });
      s.addShape(pres.shapes.OVAL, { x: x + 0.18, y: y + 0.18, w: 0.46, h: 0.46, fill: { color: C.accent1 }, line: { color: C.accent1 } });
      s.addText(String(i + 1), { isTextBox: true, x: x + 0.18, y: y + 0.18, w: 0.46, h: 0.46, fontSize: 16, bold: true, align: "center", valign: "middle", color: C.text1, margin: 0 });
      s.addText(head, { isTextBox: true, x: x + 0.18, y: y + 0.78, w: w - 0.36, h: 0.5, fontSize: 14, bold: true, color: C.background1, margin: 0, valign: "top" });
      s.addText(body, { isTextBox: true, x: x + 0.18, y: y + 1.3, w: w - 0.36, h: h - 1.42, fontSize: 12, color: C.background2, margin: 0, valign: "top" });
    });
  }
  function bullets(s, items, x, y, w, h, size) {
    s.addText(items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < items.length - 1 } })),
      { isTextBox: true, x, y, w, h, fontSize: size || 14, color: C.background1, margin: 0, valign: "top", paraSpaceAfter: 6 });
  }
  function section(num, title, sub) {
    les += 1;
    sec = title;
    pres.addSection({ title });
    const s = pres.addSlide({ masterName: "PRNTR Section", sectionTitle: sec });
    s.addText(String(les).padStart(2, "0"), { isTextBox: true, x: 0.5, y: 1.0, w: 3, h: 1.4, fontSize: 80, bold: true, color: C.accent1, margin: 0 });
    s.addText(title, { isTextBox: true, x: 0.5, y: 2.45, w: 9, h: 0.8, fontSize: title.length > 31 ? 27 : 34, bold: true, fontFace: THEME.headFontFace, color: C.background1, margin: 0 });
    s.addText(sub, { isTextBox: true, x: 0.5, y: 3.3, w: 8.4, h: 1.2, fontSize: 16, color: C.background2, margin: 0, valign: "top" });
    return s;
  }
  function bigStat(s, x, y, w, num, label, col) {
    s.addText(num, { isTextBox: true, x, y, w, h: 0.9, fontSize: 40, bold: true, color: col || C.accent1, margin: 0 });
    s.addText(label, { isTextBox: true, x, y: y + 0.88, w, h: 0.7, fontSize: 12, color: C.background2, margin: 0, valign: "top" });
  }
  const K = () => "Chapter " + les;
  function side(s, x, w, items, size, y) {
    s.addText(items.map(([h, b], i) => [
      { text: h, options: { bold: true, color: C.background1, breakLine: true } },
      { text: b, options: { color: C.background2, breakLine: i < items.length - 1, paraSpaceAfter: 8 } },
    ]).flat(), { isTextBox: true, x, y: y || 1.35, w, h: 3.8, fontSize: size || 12, margin: 0, valign: "top" });
  }
  // image (12:6.2) on the left, notes on the right
  function imgSlide(title, kicker, path, items, size) {
    const s = content(title, kicker);
    const r = path.includes("/p0") ? 1.818 : 1.935;
    s.addImage({ path, x: 0.4, y: 1.35, w: 6.1, h: 6.1 / r });
    side(s, 6.7, 2.85, items, size || 11.5);
    return s;
  }
  function wideImg(title, kicker, path, caption, ratio) {
    const s = content(title, kicker);
    let w = 7.2, h = w / (ratio || 12 / 6.2);
    if (h > 3.45) { h = 3.45; w = h * (ratio || 12 / 6.2); }
    s.addImage({ path, x: (10 - w) / 2, y: 1.3, w, h });
    if (caption) s.addText(caption, { isTextBox: true, x: 0.5, y: 1.3 + h + 0.06, w: 9, h: 0.4, fontSize: 11, italic: true, color: C.accent4, margin: 0, align: "center" });
    return s;
  }
  function grid(s, items, cols, y, h, opts = {}) {
    const gap = 0.15, w = (9 - gap * (cols - 1)) / cols;
    items.forEach(([head, body, col], i) => {
      const c = i % cols, r = Math.floor(i / cols), x = 0.5 + c * (w + gap), yy = y + r * (h + gap);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: yy, w, h, rectRadius: 0.1, fill: { color: C.text2 }, line: { color: C.text2 } });
      s.addText([{ text: head, options: { bold: true, color: col || C.accent1, breakLine: true } }, { text: body, options: { color: C.background1 } }],
        { isTextBox: true, x: x + 0.14, y: yy + 0.08, w: w - 0.28, h: h - 0.14, fontSize: opts.size || 11.5, margin: 0, valign: "top", paraSpaceBefore: 0 });
    });
  }
  function table(s, rows, x, y, w, colW, opts = {}) {
    s.addTable(rows.map((r, i) => r.map((t) => ({ text: String(t), options: {
      bold: i === 0, color: i === 0 ? C.text1 : C.background1, fill: { color: i === 0 ? C.accent1 : (i % 2 ? C.text2 : C.accent6) },
      fontSize: opts.size || 11, align: opts.align || "left", valign: "middle", margin: [2, 5, 2, 5] } }))),
      { x, y, w, colW, rowH: opts.rowH || 0.32, border: { type: "solid", pt: 0.75, color: HEX.dk1 } });
  }
  function quote(s, text, y) {
    s.addText(text, { isTextBox: true, x: 0.5, y: y || 4.55, w: 9, h: 0.55, fontSize: 12.5, italic: true, color: C.accent4, margin: 0, valign: "top" });
  }
  const CH = "/home/user/SDFSDFSFDS/business_course/crossover/charts/";
  const HU = "/home/user/SDFSDFSFDS/business_course/case_nvda_hung/";
  let s;

  // ================= COVER =================
  pres.addSection({ title: "Start" });
  s = pres.addSlide({ masterName: "PRNTR Cover", sectionTitle: "Start" });
  s.addText("PRNTR", { isTextBox: true, x: 0.5, y: 0.55, w: 6, h: 1.0, fontSize: 60, bold: true, charSpacing: 6, color: C.background1, margin: 0 });
  s.addText("THE CROSSOVER AND CRYPTO INCOME BOOK", { isTextBox: true, x: 0.5, y: 1.55, w: 9, h: 0.5, fontSize: 18, bold: true, charSpacing: 4, color: C.accent1, margin: 0 });
  s.addText("Read a big stock's chart, trade the memecoin wave its news creates, front-run every narrative on the calendar, and build income in crypto that doesn't need a single trade.",
    { isTextBox: true, x: 0.5, y: 2.2, w: 6.7, h: 1.3, fontSize: 17, color: C.background2, margin: 0, valign: "top" });
  s.addText("Part of the PRNTR 1-on-1 Mentorship. 13 real case studies with real prices. Education only, not financial advice.",
    { isTextBox: true, x: 0.5, y: 4.25, w: 7, h: 0.5, fontSize: 12, color: C.background2, margin: 0, valign: "middle" });
  s.addImage({ data: await ic("FaArrowsTurnToDots", HEX.accent1), x: 7.5, y: 1.0, w: 1.7, h: 1.7, transparency: 15 });
  s.addNotes("Cover.");

  s = content("What's in this book", "Start here");
  grid(s, [
    ["Part A · The PRNTR Crossover", "How stock news creates memecoins, the PRNTR Box on the daily and weekly chart, the two models, and the four kinds of stock-and-coin pairs."],
    ["Part B · 13 real case studies", "NVIDIA, GameStop, AMC, Tesla, Trump Media, Netflix, Pop Mart, Oracle. Real candles, real coin numbers, sources, and honest $10 math."],
    ["Part C · Front-running everything", "Narratives, the calendar, the OG coin, supply math, traders who front-run, news and celebrity watch lists, animal and culture metas."],
    ["Part D · Income without trading", "Become a caller, build a Telegram network, launch coins as a developer, grow on X and get paid by X, earn token supply, sell Telegram usernames."],
    ["Part E · Rules, law and your plan", "What gets people sued or charged, taxes, the 90-day plan, checklists, glossary and every source."],
    ["How to use it", "Read Part A once. Study one case a day. Use Part C every week. Pick one or two income paths from Part D and run the 90-day plan."],
  ], 2, 1.35, 1.12);
  s.addNotes("Map of the book.");

  s = content("Read this before you start", "The honest warning");
  bigStat(s, 0.5, 1.4, 2.9, "Most", "memecoins go to zero. Solidus Labs found 98.6% of Pump.fun tokens showed scam or pump-and-dump traits.", C.accent5);
  bigStat(s, 3.55, 1.4, 2.9, "Top ≠ you", "The case numbers show what was possible at the top. Nobody sells the exact top, so we show a realistic exit too.", C.accent4);
  bigStat(s, 6.6, 1.4, 2.9, "1–2%", "The most you risk on any one trade. Small bets are what let you survive the zeros.", C.accent2);
  bullets(s, [
    "Every price and market cap in this book comes from a named source. Where a figure is our own estimate, it says so.",
    "Copies of every famous coin exist. Never buy from a contract address you didn't check yourself.",
    "Paid promotion, front-running your own followers and rug pulls are illegal in many places. Part E covers what's allowed.",
  ], 0.5, 3.2, 9, 1.8, 13);
  s.addNotes("Set expectations: this is about attention and timing, with small size.");

  // ================= PART A =================
  section(1, "The PRNTR Crossover", "Big stocks and memecoins run on the same thing: attention. When a stock's story hits the news, the crowd goes looking for a coin with that story's name. The stock chart often tells you first.");

  s = content("The idea in one slide", K());
  steps(s, [
    ["The stock coils", "A big name trades sideways in a Box on the daily or weekly chart for weeks or months."],
    ["The news lands", "Earnings, a launch, an election, a celebrity post, a shock. Everyone talks about one name."],
    ["The crowd searches", "People type that name, the person or the cause into Pump.fun, FOMO and DEX Screener."],
    ["The coin runs", "The coin with the name the crowd types can go 10x, 100x or more in hours or days."],
    ["You sell into it", "You take profit while attention peaks, and move it into the money loop."],
  ], 1.45, 3.1);
  quote(s, "The stock chart is the clock. The memecoin is the lottery ticket on the same story. PRNTR trades both, small and in order.", 4.7);
  s.addNotes("The core loop of the Crossover.");

  s = content("Why stocks and memecoins move together", K());
  await iconRows(s, [
    ["FaNewspaper", "Same headline, two markets", "When NVIDIA, Tesla or GameStop is the story of the day, the same headline is on X, Telegram and every news app at once."],
    ["FaMagnifyingGlass", "The crowd searches the name", "New buyers search the company, the product, the person or the cause on Pump.fun. A coin with that name gets bought."],
    ["FaBolt", "Coins move faster", "A stock might move 10–20% on big news. A small coin on the same story can move 1,000% in an afternoon, both ways."],
    ["FaClock", "Stocks keep hours, coins never close", "Stock news often lands after the close or on weekends. The coin trades it first. Monday's open on the stock can be the second wave."],
  ], 0.5, 1.4, 9, 0.88);
  s.addNotes("Attention is the shared fuel.");

  s = content("What the Crossover is, and isn't", K());
  card(s, 0.5, 1.4, 4.4, 3.5, "It is", "A way to see a story coming on a big chart\nA list of names to search before the crowd does\nA reason to take a small coin trade with a plan\nA way to let a stock trade pay for the coin trade", { tcol: C.accent2 });
  card(s, 5.1, 1.4, 4.4, 3.5, "It isn't", "A promise that every stock move has a coin\nA reason to buy any coin with a famous name\nA way to get rich on one trade\nAn excuse to skip the safety check or the size rules", { tcol: C.accent5 });
  s.addNotes("Guard rails.");

  // ---- method refresher ----
  section(2, "The PRNTR chart, on the higher timeframe", "The Box, the Fake-Out, the Return, the Turn, the trip across and the Launch Pad. Read them on the weekly and daily chart to see the big story; use the 1-hour for timing.");

  s = content("The Box", K());
  s.addShape(pres.shapes.RECTANGLE, { x: 0.8, y: 1.6, w: 4.6, h: 2.6, fill: { color: HEX.accent3, transparency: 82 }, line: { color: HEX.accent3, width: 1.5 } });
  s.addShape(pres.shapes.LINE, { x: 0.8, y: 2.9, w: 4.6, h: 0, line: { color: HEX.accent3, width: 1, dashType: "dash" } });
  s.addText("ceiling", { isTextBox: true, x: 5.45, y: 1.45, w: 1.2, h: 0.3, fontSize: 12, color: C.accent3, margin: 0 });
  s.addText("middle", { isTextBox: true, x: 5.45, y: 2.75, w: 1.2, h: 0.3, fontSize: 12, color: C.accent3, margin: 0 });
  s.addText("floor", { isTextBox: true, x: 5.45, y: 4.05, w: 1.2, h: 0.3, fontSize: 12, color: C.accent3, margin: 0 });
  side(s, 6.6, 2.9, [
    ["Ceiling", "The highest close of the sideways stretch."],
    ["Floor", "The lowest close."],
    ["Middle", "Halfway. Price around the middle is noise: no trade."],
    ["Why closes", "Wicks poke out all the time. A close tells you where the market agreed on price. Every Box in this book is drawn from real closes."],
  ], 12, 1.4);
  s.addNotes("Every chart in Part B draws the Box from closes automatically, so nothing is hand-fitted.");

  s = content("The Fake-Out, the Return and the trip across", K());
  steps(s, [
    ["Fake-Out", "Price pokes beyond the ceiling or floor and grabs the stop-losses there."],
    ["The Return", "Price closes back inside the Box. The breakout buyers are trapped."],
    ["The Turn", "On a lower timeframe, the chart turns back the other way. That's your entry."],
    ["The trip across", "Price travels to the other side of the Box. The far side is the first target."],
  ], 1.45, 3.0);
  quote(s, "No Return, no trade. If price pokes out and keeps going, that wasn't a Fake-Out, it was a real move.", 4.6);
  s.addNotes("Same definitions as The PRNTR Method Part 1.");

  s = content("The Launch Pad", K());
  card(s, 0.5, 1.4, 4.4, 2.6, "What it is", "A Box that has already done its Fake-Out and Return on one side, then closes out of the other side. The Box becomes the pad the big move launches from.", { tcol: C.accent1 });
  card(s, 5.1, 1.4, 4.4, 2.6, "Why it matters for coins", "On a big stock, the launch usually comes with news. The day the stock closes out of a months-long Box is the day its story is everywhere, and the coins with its name get searched.", { tcol: C.accent2 });
  quote(s, "A launch that closes back inside the Box within a few days failed. Treat it like a Fake-Out on that side, and expect the trip across.", 4.2);
  s.addNotes("Launch Pad defined for this book.");

  s = content("The two models", K());
  card(s, 0.5, 1.4, 4.4, 3.3, "The up model", "1. Fake-Out below the floor\n2. The Return: back inside\n3. The Turn up on the 1-hour\n4. The trip across to the ceiling\n5. Close above the ceiling: launch up\n\nStock examples: Tesla Nov 2024, NVIDIA Feb 2024, Pop Mart 2025", { tcol: C.accent2 });
  card(s, 5.1, 1.4, 4.4, 3.3, "The down model", "1. Fake-Out above the ceiling\n2. The Return: back inside\n3. The Turn down on the 1-hour\n4. The trip across to the floor\n5. Close below the floor: launch down\n\nStock examples: NVIDIA Jan 2025 (DeepSeek), NVIDIA Nov 2026", { tcol: C.accent5 });
  quote(s, "The Fake-Out tells you which side the market is fishing on. The launch usually goes the other way.", 4.8);
  s.addNotes("Up model and down model, PRNTR language only.");

  s = content("Why the higher timeframe", K());
  table(s, [["Timeframe", "What it tells you", "Use it for"],
    ["Weekly", "The big story: months in a Box, the year's ceiling and floor", "Which side the big move is likely to go"],
    ["Daily", "The Fake-Outs, the Return, the launch close", "The level that matters and the date it breaks"],
    ["4-hour", "How price reacts around the news", "Planning the stop and the target"],
    ["1-hour", "The Turn", "Your entry, with a tight stop"]], 0.5, 1.4, 9, [1.4, 4.2, 3.4], { rowH: 0.5, size: 12 });
  quote(s, "Weekly and daily tell you what. The 1-hour tells you when. The coin trade happens on the news clock, minutes and hours.", 4.2);
  s.addNotes("Higher timeframe first, always.");

  wideImg("A higher-timeframe Box: Tesla, weekly", K(), CH + "05w_TSLA_weekly.png", "Real weekly candles. A Box from January to October 2024, then the election week closed above the ceiling ($269.19).");

  // ---- pair types ----
  section(3, "How a stock story becomes a coin", "Four ways a stock and a memecoin pair up. Learn to name the type before you trade it, because each one has a different exit.");

  s = content("From headline to coin, in minutes", K());
  const chain = [["Headline", "News accounts, earnings, a post"], ["X and Telegram", "The name trends"], ["Pump.fun", "Coins with the name appear within minutes"], ["Search", "The crowd types the name on FOMO, Pump.fun, DEX Screener"], ["Trending", "One coin gets the volume and the holders"]];
  chain.forEach(([h, b], i) => {
    const x = 0.5 + i * 1.84;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.6, w: 1.66, h: 1.9, rectRadius: 0.1, fill: { color: C.text2 }, line: { color: i === 4 ? C.accent2 : C.text2, width: 1.5 } });
    s.addText([{ text: h, options: { bold: true, color: C.accent1, breakLine: true } }, { text: b, options: { color: C.background1 } }], { isTextBox: true, x: x + 0.1, y: 1.7, w: 1.46, h: 1.7, fontSize: 12, margin: 0, valign: "top" });
    if (i < 4) s.addText("›", { isTextBox: true, x: x + 1.62, y: 2.3, w: 0.26, h: 0.4, fontSize: 22, bold: true, color: C.accent1, margin: 0, align: "center" });
  });
  quote(s, "Speed decides who gets paid. Official TRUMP went from launch to about $1.2B in roughly 30 minutes. The 'NVDA AI' coin was created minutes after NVIDIA's earnings.", 3.8);
  s.addNotes("Sources: CoinGecko, Bitcoin.com (TRUMP); Benzinga (NVDA AI).");

  s = content("The four kinds of pair", K());
  grid(s, [
    ["1 · Same way", "Stock launches up, the coin with its name runs too. GameStop and GME/KITTY, Tesla and D.O.G.E., Pop Mart and LABUBU, NVIDIA earnings and 'NVDA AI'.", HEX.accent2],
    ["2 · Opposite way", "The stock falls, and the coin named after the CAUSE of the fall runs. NVIDIA and the DeepSeek coin, Tesla and America Party, NVIDIA and HUNG.", HEX.accent3],
    ["3 · Sell the news", "Stock and coin both rise into a dated event and both dump on it. Trump Media and MAGA on election day, GameStop's June livestream, the inauguration.", HEX.accent4],
    ["4 · The trap", "A coin rides a famous story but buyers can't sell, or it's a copy. SQUID during Squid Game, the 2024 Squid Game copies, fake 'official' tokens.", HEX.accent5],
  ], 2, 1.35, 1.65, { size: 12.5 });
  s.addNotes("Name the type first. Type 3 means sell before the event; type 4 means don't buy.");

  s = content("The exit depends on the type", K());
  table(s, [["Type", "When the coin usually peaks", "PRNTR exit"],
    ["Same way", "During the stock's launch day or the day after", "50% at 3x, rest into the second headline"],
    ["Opposite way", "The day the shock hits, often in hours", "Sell into the first spike; the cause-coin rarely holds"],
    ["Sell the news", "The days BEFORE the event", "Be out before the event itself"],
    ["The trap", "Never, for you", "Don't buy. Run the safety check first"]], 0.5, 1.4, 9, [1.6, 3.6, 3.8], { rowH: 0.55, size: 12 });
  quote(s, "Most losses in event coins come from holding a type-3 coin through the event, hoping for more.", 4.35);
  s.addNotes("Exit table.");

  s = content("Before you trade a pair: the checklist", K());
  bullets(s, [
    "Is the stock in a Box on the daily or weekly chart? Where are the ceiling, floor and middle?",
    "Was there a Fake-Out on one side? Which way does that point the launch?",
    "Is there a dated catalyst? Earnings, a launch event, an election, a court date, a premiere, a vote.",
    "Which pair type is it? Same way, opposite way, sell the news, or a trap?",
    "Which names will people type? The ticker, the company, the product, the person, the cause, the nickname.",
    "Does an OG coin with that name already exist? When was it created, at what market cap, who holds it?",
    "Safety check passed? Can holders sell, is the creator holding a big share, is the supply bundled?",
    "Size: 1–2% of your trading money at most. Exit plan written before you buy.",
  ], 0.5, 1.35, 9, 3.8, 13);
  s.addNotes("Print this.");

  // ================= PART B: CASES =================
  section(4, "Case studies: same way", "The stock launches out of its Box and the coin with its name runs with it.");

  imgSlide("GameStop, May 2024: the Box", "Case 1 · GME × GME / KITTY", CH + "02_GME_may24.png", [
    ["The Box", "Mar 20 to May 10, 2024. Ceiling $18.01, floor $10.01 (closes)."],
    ["Fake-Out", "May 10: a wick to $20.20, closed back inside."],
    ["Launch up", "Mon May 13: Roaring Kitty posts for the first time in 3 years. Closed $30.45 (+74%)."],
    ["The top", "May 14: high $64.83, then a close of $48.75. Trading was halted several times."],
  ]);
  imgSlide("GameStop, May 2024: the coins", "Case 1 · GME × GME / KITTY", CH + "p02_GME_pair.png", [
    ["GME (Solana)", "Fair launch Jan 28, 2024. $2.5M on Apr 30, under $4M on May 11, about $89M on May 14 (Decrypt). Down 69% within days."],
    ["KITTY (Solana)", "Launched in March and left for dead. Up 13,000%+ within hours of the post, to about $40M. $19.3M by May 14."],
    ["Lesson", "The ticker coin and the person coin both ran. The smaller one ran harder."],
  ], 11);
  s = content("GameStop, May 2024: the $10 math", "Case 1 · GME × GME / KITTY");
  table(s, [["Coin", "Bought at", "Top", "$10 at the top", "PRNTR exit*"],
    ["GME (Solana)", "<$4M (May 11)", "~$89M", "~$220", "~$70"],
    ["KITTY", "near zero", "+13,000%", "~$1,310", "~$342"]], 0.5, 1.4, 9, [1.8, 1.8, 1.4, 2.0, 2.0], { rowH: 0.48, size: 13 });
  bullets(s, [
    "Both coins existed for weeks or months before the post. The names were obvious to search: the ticker, and the man's nickname.",
    "Could you have known the date? No. This one was a surprise. That's why the PRNTR way is to hold a few dollars in the OG of every big name, waiting.",
    "The stock: a $1,000 long at the May 13 open was a coin flip on halts and gaps. The coin was the cleaner small bet.",
  ], 0.5, 2.95, 9, 1.6, 12.5);
  quote(s, "* PRNTR exit = half sold at 3x, the other half sold at half the top multiple. Nobody sells the top.", 4.7);
  s.addNotes("Sources: Benzinga, StockInvest, CoinGecko, Decrypt, The Block, CoinDesk.");

  imgSlide("Tesla, election 2024: the Box", "Case 2 · TSLA × D.O.G.E.", CH + "05_TSLA_election.png", [
    ["The Box", "Aug 1 to Nov 5, 2024. Ceiling $269.19, floor $191.76."],
    ["Fake-Out", "Aug 5: wick to $182.00 below the floor, closed back inside. The up model."],
    ["Launch up", "Nov 6, the day after the election: closed $288.53 (+14.75%)."],
    ["The run", "High $488.54 on Dec 18: 81% above the ceiling."],
  ]);
  imgSlide("Tesla vs the D.O.G.E. coin", "Case 2 · TSLA × D.O.G.E.", CH + "p05_TSLA_pair.png", [
    ["The coin", "'Department Of Government Efficiency' (Ethereum), made in Aug 2024 after Musk's posts about the idea."],
    ["The run", "About $46M on election day (our estimate), $161M on Nov 8, about $505M at the Nov 13 top (estimate; crypto.news reported $342M that day)."],
    ["Dogecoin", "More than doubled to $0.43 by Nov 12, when Musk was named to the role."],
  ], 11);
  s = content("Tesla × D.O.G.E.: what to learn", "Case 2 · TSLA × D.O.G.E.");
  grid(s, [
    ["The weekly Box warned you", "Ten months sideways, a Fake-Out below the floor in August, an election on the calendar. Coiled.", HEX.accent2],
    ["The name was public", "Musk had talked about D.O.G.E. since August. The coin existed for 2.5 months before the election.", HEX.accent1],
    ["$10 math", "~11x election day to top: $10 → about $110 at the top, about $42 with the PRNTR exit. Bought in August near launch, far more.", HEX.accent4],
    ["Second headline", "The coin peaked on Nov 13, the day after Musk was named. The second headline was the sell.", HEX.accent3],
  ], 2, 1.35, 1.65, { size: 12.5 });
  s.addNotes("Sources: Nairametrics, AP, Decrypt, crypto.news, CoinMarketCap, CoinGecko.");

  imgSlide("Pop Mart, 2025: the Box", "Case 3 · Pop Mart × LABUBU", CH + "09_POPMART_labubu.png", [
    ["The Box", "Nov 15, 2024 to Jan 24, 2025. Ceiling HK$95.25, floor HK$74.75."],
    ["Launch up", "Feb 4, 2025: closed HK$103.20."],
    ["The run", "HK$339.80 by Aug 26: 257% above the ceiling. Reuters: up more than 230% for the year."],
    ["Lesson", "A culture trend shows up in the stock months before it shows up in the coin."],
  ]);
  imgSlide("Pop Mart vs the LABUBU coin", "Case 3 · Pop Mart × LABUBU", CH + "p09_POPMART_pair.png", [
    ["The coin", "LABUBU (Solana), launched on Pump.fun in Oct 2024. Under $1M for months: about $0.81M before the run."],
    ["The run", "$49M on May 27, 2025 (+5,934% in two weeks) as Pop Mart halted UK sales. $56M May 30, $67M+ by Jun 2. About $32M by Jun 10."],
    ["$10 math", "~60x to the first top: $10 → about $600, about $165 with the PRNTR exit."],
  ], 11);

  imgSlide("NVIDIA, Feb 2024: earnings", "Case 4 · NVDA × 'NVDA AI'", CH + "11_NVDA_earnings24.png", [
    ["The Box", "Feb 8 to 21, 2024. Ceiling $73.90, floor $67.47 (split-adjusted)."],
    ["Fake-Out", "Earnings day, Feb 21: a wick to $66.25 below the floor, closed back inside."],
    ["Launch up", "Feb 22: closed $78.54, +16%, a record $277B added in one day."],
    ["The coin", "'NVDA AI' was created minutes after earnings. One wallet turned $51 into $10,800 (~210x) in about 2 hours. Many think it was the creator's own wallet."],
  ], 11);
  s = content("NVIDIA earnings: what to learn", "Case 4 · NVDA × 'NVDA AI'");
  grid(s, [
    ["The date was public", "Earnings dates are announced weeks ahead. The Box and the Fake-Out on earnings day were the up model in two days.", HEX.accent2],
    ["The coin was a speed game", "Made after the news, not before. The only way in was the first minutes, and the best trade may have been the creator's.", HEX.accent4],
    ["The PRNTR read", "Stock: the Turn after the Fake-Out was the trade. Coin: a few dollars at most, or skip. New coins made after news are where creators sell to the crowd.", HEX.accent5],
  ], 3, 1.35, 3.2, { size: 12.5 });
  s.addNotes("Sources: Bloomberg; Benzinga and Investing.com for the 210x trade (single trade, low confidence on the coin's market caps).");

  section(5, "Case studies: opposite way", "The stock falls, and the coin named after the reason it fell runs. You can be on both sides of the same headline.");

  imgSlide("NVIDIA and DeepSeek, Jan 2025", "Case 5 · NVDA × the DeepSeek coin", CH + "01_NVDA_deepseek.png", [
    ["The Box", "Oct 15, 2024 to Jan 24, 2025. Ceiling $149.43, floor $128.91."],
    ["Fake-Out", "Jan 7: a wick to $153.13 above the ceiling, closed back inside. The down model."],
    ["Launch down", "Mon Jan 27: DeepSeek's cheap AI model. Closed $118.42 (−17%), about $589B wiped out: the biggest one-day loss for any company on record."],
    ["Follow-through", "Low of $107.56 by Mar 7."],
  ], 11);
  s = content("The coin named after the cause", "Case 5 · NVDA × the DeepSeek coin");
  grid(s, [
    ["The coin", "An unofficial Solana token named after DeepSeek, created Jan 4, 2025: three weeks before the shock.", HEX.accent1],
    ["The run", "Passed $48M market cap on Jan 27 on about $150M of volume, 22,000+ holders. Back to about $30M within hours. A second copy hit ~$13M.", HEX.accent2],
    ["The catch", "DeepSeek said it had no token. Dozens of copies existed. We don't have a reliable starting market cap, so we don't show $10 math.", HEX.accent5],
    ["The lesson", "NVIDIA fell; the coin about the reason it fell ran. Ask: 'what is the CAUSE called?', and search that name too.", HEX.accent4],
  ], 2, 1.35, 1.65, { size: 12.5 });
  s.addNotes("Sources: StockInvest, Briefing.com, Bloomberg (stock); Cointelegraph, Bitget, Birdeye via Cointelegraph (coin).");

  imgSlide("Tesla and the America Party, Jul 2025", "Case 6 · TSLA × AP", CH + "10_TSLA_americaparty.png", [
    ["The Box", "May 8 to Jul 3, 2025. Ceiling $362.89, floor $284.70."],
    ["The news", "Jul 5: Musk announces the 'America Party'. Jul 7: Tesla falls about 7%."],
    ["No launch", "Tesla closed inside the Box. The higher timeframe didn't care, so there was no stock trade."],
    ["The coin", "'America Party' (AP) on Pump.fun: about $6.5M to $41M within hours (our estimate from price × supply), then −90%. Five or more copies."],
  ], 11);
  s = content("America Party: what to learn", "Case 6 · TSLA × AP");
  card(s, 0.5, 1.4, 4.4, 3.2, "Don't force the stock trade", "A news day isn't a launch. If the daily close stays inside the Box, the big chart is telling you the story is noise for the stock. Trade the coin, or nothing.", { tcol: C.accent4 });
  card(s, 5.1, 1.4, 4.4, 3.2, "The coin trade was hours", "Up 537% in hours, down 90% after. ~6.4x: $10 → about $64 at the top. A cause-coin on a weekend headline is a same-day trade, never a hold.", { tcol: C.accent2 });
  s.addNotes("Sources: BNN Bloomberg, Axios, Seeking Alpha; Coinspeaker, BingX, Solflare (contract not verified).");

  imgSlide("NVIDIA, 2026: the PRNTR trade", "Case 7 · NVDA × HUNG", CH + "13_NVDA_2026.png", [
    ["The Box", "May 1 to Oct 29, 2026: 126 trading days. Ceiling $239.24, floor $190.01."],
    ["Fake-Out", "Oct 6: a wick to $243.37 above the ceiling, closed back inside. The down model."],
    ["Launch down", "Nov 5: closed $181.60, below the floor."],
    ["Follow-through", "Low $148.80 on Nov 12: 21.7% under the floor."],
  ], 11);
  wideImg("The 1-hour Turn and the coins", "Case 7 · NVDA × HUNG", HU + "4_NVDA_1h_turn_and_coins.png", "The 1-hour Turn sold at $200.63, before the headlines.", 1.78);
  wideImg("HUNG on the same clock", "Case 7 · NVDA × HUNG", HU + "2_NVDA_vs_HUNG.png", "HUNG went from about $9.7K to about $995K in two hours on the second headline.", 1.56);
  s = content("The short paid for the coin", "Case 7 · NVDA × HUNG");
  bigStat(s, 0.5, 1.4, 2.9, "+$813", "$1,000 at 5x on the short, closed at the $168 target (+4.9R).", C.accent2);
  bigStat(s, 3.55, 1.4, 2.9, "$50", "of that profit into HUNG at about $9K market cap: about 0.55% of the supply.", C.accent1);
  bigStat(s, 6.6, 1.4, 2.9, "~$3,900", "selling in pieces around $700K. $10 at $9.7K was worth about $1,000 at the top.", C.accent4);
  bullets(s, [
    "This is the full PRNTR Crossover: the stock chart gave the direction, the Turn gave the entry, and the profit paid for the lottery ticket.",
    "HUNG only traded $50–$160 an hour while it was quiet. Buy small or you move the price yourself.",
  ], 0.5, 3.4, 9, 1.4, 13);
  s.addNotes("Numbers from the NVDA × HUNG case in PRNTR Memecoins (lesson 11).");

  section(6, "Case studies: sell the news", "Stock and coin both rise into a date everyone knows, and both fall on it. The money is made before the event, not on it.");

  imgSlide("Trump Media into the 2024 election", "Case 8 · DJT × MAGA", CH + "06_DJT_election.png", [
    ["The Box", "Sep 3 to Oct 4, 2024. Ceiling $18.63, floor $12.15. An all-time low of $12.15 on Sep 23."],
    ["Fake-Out", "Sep 13: wick to $20.86, closed back inside."],
    ["Launch up", "Oct 8: closed $21.80. Top $54.68 on Oct 29: 193% above the ceiling."],
    ["Then", "−41% in three days before the vote. $29.87 by Nov 19."],
  ]);
  imgSlide("Trump Media vs the MAGA coin", "Case 8 · DJT × MAGA", CH + "p06_DJT_pair.png", [
    ["MAGA (ticker TRUMP, Ethereum)", "About $210M in late October, $154M on election day, $212M on Nov 6, $79M on Nov 7: −50.7% the day after the result."],
    ["Lesson", "Both the stock and the coin priced the event in before it happened. The result, even the 'good' result, was the sell signal."],
  ], 11);

  imgSlide("GameStop, June 2024: the livestream", "Case 9 · GME × GME", CH + "03_GME_jun24.png", [
    ["The Box", "May 17 to 31, 2024. Ceiling $23.78, floor $18.32."],
    ["Launch up", "Jun 3: closed $28.00. Pre-market Jun 7: about $61 high reported; daily data shows $48."],
    ["The event", "Jun 7: early results, a 75M-share sale, then Roaring Kitty's livestream. GME fell about 39–40%."],
    ["Coin", "GME (Solana): about $24M to about $220M (estimates) overnight into Jun 7, record $471M volume, then −70% by Jun 18."],
  ], 11);
  s = content("The livestream was announced the day before", "Case 9 · GME × GME");
  grid(s, [
    ["A dated event = a sell date", "When everyone knows the time, everyone who bought early sells into it. The coin topped overnight, before the stream.", HEX.accent4],
    ["$10 math", "~9x from Jun 6 to the top: $10 → about $90 at the top, about $37 with the PRNTR exit. Holding through the stream gave most of it back.", HEX.accent1],
    ["The stock said it too", "A launch that fell back toward the Box on the event day: the up move failed. A failed launch is a Fake-Out on that side.", HEX.accent5],
  ], 3, 1.35, 3.2, { size: 12.5 });
  s.addNotes("Sources: Decrypt (Jun 7 and 18), The Block, Reuters via Investing.com, Bloomberg via Yahoo, CoinGecko.");

  imgSlide("Trump Media and the official TRUMP coin", "Case 10 · DJT × TRUMP", CH + "07_DJT_inauguration.png", [
    ["The Box", "Nov 19, 2024 to Jan 10, 2025. Ceiling $38.50, floor $29.87."],
    ["Launch that failed", "Jan 13: closed $42.91 above the ceiling. After the inauguration it fell back inside: −11% to $35.59 on Jan 21."],
    ["Then", "The failed launch acted as a Fake-Out above the ceiling. The trip across followed, and DJT closed below the floor in February."],
  ], 11);
  imgSlide("Trump Media vs the official TRUMP coin", "Case 10 · DJT × TRUMP", CH + "p07_DJT_trump_pair.png", [
    ["The coin", "Launched from Trump's own accounts on the evening of Jan 17, 2025. About $1.2B within 30 minutes."],
    ["The top", "$73.43 on Jan 19: about $14.5B market cap. Down 29% in a day by Jan 21. About $2.3B by March."],
    ["$10 math", "Reported launch price around $0.18. To the top: ~408x, so $10 → about $4,080. PRNTR exit: about $1,035."],
  ], 11);
  s = content("TRUMP: the biggest $10 story, honestly", "Case 10 · DJT × TRUMP");
  card(s, 0.5, 1.4, 2.85, 3.3, "What made it", "It came from the person's own account, it was the first official coin of a sitting president-elect, and it was live on a weekend before the stock market could react.", { tcol: C.accent2 });
  card(s, 3.575, 1.4, 2.85, 3.3, "Who got it", "Only people in the first minutes. Reported launch prices vary. Most buyers bought far higher, and many held through the −29% day and beyond.", { tcol: C.accent4 });
  card(s, 6.65, 1.4, 2.85, 3.3, "The PRNTR rule", "Turn on post alerts for the biggest accounts (Part C). Speed coins: buy a few dollars only from the official account's own link, sell half at 3x, never chase a vertical candle.", { tcol: C.accent1 });
  s.addNotes("Sources: CoinGecko, Cointelegraph, Decrypt, Bitcoin.com, Benzinga, Finance Magnates; Fortune for DJT.");

  section(7, "Case studies: traps and failed launches", "The cases where the famous name didn't pay. These are the ones that teach you to size small and run the safety check every single time.");

  imgSlide("Netflix and Squid Game, 2021", "Case 11 · NFLX × SQUID", CH + "08_NFLX_squid.png", [
    ["The Box", "Jul 15 to Aug 26, 2021 (prices adjusted for the later 10-for-1 split)."],
    ["Launch up", "Aug 27, three weeks before Squid Game came out on Sep 17."],
    ["The run", "Earnings on Oct 19 credited the show. Record close $691.69 on Nov 17 (pre-split price)."],
  ]);
  imgSlide("The SQUID token: the trap", "Case 11 · NFLX × SQUID", CH + "p08_NFLX_pair.png", [
    ["The coin", "SQUID on BNB Chain, launched around Oct 26, 2021 at about $0.01."],
    ["Paper top", "$2,861 on Nov 1. On paper, $10 became millions."],
    ["Reality", "Buyers could NOT sell: the contract blocked it. The creators pulled the pool and took about $3.38M. Price went to about zero in minutes."],
    ["Again in 2024", "Season 2 copies on Base and Solana mostly fell 99%. PeckShield flagged them as scams."],
  ], 11);
  s = content("Rule: can people sell?", "Case 11 · NFLX × SQUID");
  steps(s, [
    ["Check sells", "On DEX Screener's Transactions tab, look for sells from wallets other than the creator."],
    ["Run the scanners", "RugCheck for Solana, Honeypot.is and Token Sniffer for Ethereum and BNB chains."],
    ["Check the creator", "Does the creator hold a big share? Did a few wallets take most of the supply at launch?"],
    ["Sell a test", "After buying, sell a tiny slice straight away. If it fails, you learned it for a few dollars."],
  ], 1.45, 3.1);
  s.addNotes("Sources: CoinDesk, Forkast, Motley Fool; Cointelegraph and Benzinga for the 2024 copies.");

  imgSlide("Oracle and Stargate, Jan 2025", "Case 12 · ORCL × STARGATE", CH + "12_ORCL_stargate.png", [
    ["The Box", "Dec 11, 2024 to Jan 17, 2025. Ceiling $178.58, floor $153.92."],
    ["Launch up", "Jan 22: closed $184.22 after the Stargate AI venture (high $191.99)."],
    ["Erased", "Five days later DeepSeek hit every AI stock. Oracle fell back into the Box."],
    ["The coin", "One newsletter reported a 'STARGATE' coin at $19–29M. Chain and contract unverified: low confidence."],
  ], 11);
  imgSlide("AMC, the same week as GameStop", "Case 13 · AMC × AMC", CH + "04_AMC_may24.png", [
    ["The Box", "Apr 1 to May 10, 2024. Ceiling $3.42, floor $2.47."],
    ["Launch up", "May 13: closed $5.19 (+78%). May 14: high $11.88, then a 42% drop from the open."],
    ["The company sold", "AMC sold 72.5M shares into the rally."],
    ["The coin", "A Solana 'AMC' coin was reported up about 5,400%. We couldn't confirm which contract: treat as unverified."],
  ], 11);

  s = content("Big names with no clean pair", "What didn't happen");
  table(s, [["Stock", "What we found"],
    ["MicroStrategy (MSTR)", "Rallied hard in Nov 2024. No documented Saylor coin run at the same time."],
    ["Robinhood, Coinbase", "No coin named after them ran. Their LISTINGS moved coins: PEPE jumped ~30% within an hour of Robinhood listing it (Nov 13, 2024)."],
    ["Apple, Intel, Microsoft, Meta, Palantir", "No verified pair. The OpenAI drama (Nov 2023) moved AI tokens, not a memecoin with data."],
    ["Reddit (RDDT)", "Only a passing mention of a 'Reddit' coin up 56%. Unverified."],
    ["xAI / Grok vs Tesla", "The GROK coin went +1,050% in a week (Nov 2023, ~$120–160M) while Tesla didn't move: a coin-only story."],
    ["Netflix, Squid Game S2", "The 2024 coins were scams that fell 99%. No real Netflix move."]], 0.5, 1.35, 9, [2.6, 6.4], { rowH: 0.5, size: 11 });
  s.addNotes("Sources: Bitcoin.com, The Block, Decrypt, CoinGecko research, CoinMarketCap Academy.");

  // ================= $10 MATH =================
  section(8, "The $10 math", "How $10 turns into thousands, and why it almost never does from a coin you found on the news. Market cap at entry decides everything.");

  wideImg("$10 in each coin, at the reported top", K(), CH + "m_money.png", "Gold bars: $10 became $1,000+. Every one of them needed an entry in the first minutes or months before the crowd.", 1.935);

  s = content("Realistic vs the top", K());
  table(s, [["Case", "Multiple to top", "$10 at the top", "PRNTR exit*", "How you'd have needed to buy"],
    ["Official TRUMP", "~408x", "$4,080", "$1,035", "First minutes after the post"],
    ["'NVDA AI'", "~210x", "$2,100", "$540", "Minutes after earnings (insider risk)"],
    ["KITTY", "~131x", "$1,310", "$342", "Holding the dead coin before the post"],
    ["LABUBU", "~60x", "$600", "$165", "Months before the run, under $1M"],
    ["GME (May)", "~22x", "$220", "$70", "The weekend before the post"],
    ["D.O.G.E.", "~11x", "$110", "$42", "Election day"],
    ["GME (June)", "~9x", "$90", "$37", "The day before the stream"],
    ["America Party", "~6.4x", "$64", "$31", "The first hour"]], 0.5, 1.35, 9, [1.6, 1.4, 1.4, 1.3, 3.3], { rowH: 0.38, size: 11 });
  quote(s, "* Half sold at 3x, the other half sold at half the top multiple.", 4.85);
  s.addNotes("Our arithmetic from the sourced multiples.");

  s = content("Why entry market cap is everything", K());
  table(s, [["$10 bought at…", "owns", "at $100K", "at $500K", "at $2M", "at $10M"],
    ["$3K market cap", "0.33%", "$333", "$1,667", "$6,667", "$33,333"],
    ["$10K", "0.10%", "$100", "$500", "$2,000", "$10,000"],
    ["$50K", "0.02%", "$20", "$100", "$400", "$2,000"],
    ["$1M", "0.001%", "n/a", "n/a", "$20", "$100"],
    ["$4M (GME, May 11)", "0.00025%", "n/a", "n/a", "n/a", "$25"]], 0.5, 1.35, 9, [2.2, 1.2, 1.4, 1.4, 1.4, 1.4], { rowH: 0.42, size: 12, align: "center" });
  bullets(s, [
    "Your share of the supply = what you put in ÷ the market cap when you bought. That's the whole game.",
    "$10 into thousands needs an entry in the low thousands of market cap: the OG coin, months early (Part C).",
    "A tiny coin can't absorb big sells. At $3K–$10K, even $50 moves the price. Buy small, sell in pieces.",
  ], 0.5, 3.95, 9, 1.2, 12);
  s.addNotes("Our arithmetic. Pump.fun coins have a 1B supply, so price × 1B = market cap.");

  s = content("The portfolio math that actually works", K());
  bigStat(s, 0.5, 1.4, 2.9, "20 × $10", "OG coins on 20 different events and names: $200 in total.", C.accent1);
  bigStat(s, 3.55, 1.4, 2.9, "18 zeros", "That's normal. You lose $180.", C.accent5);
  bigStat(s, 6.6, 1.4, 2.9, "1 hit", "One OG bought at $3K that reaches $2M: $10 → about $6,667.", C.accent2);
  bullets(s, [
    "Pump.fun's own numbers say how rare this is: 1.8% of launches graduated in Aug 2026 (MadeOnSol), and the median graduate peaked at $31K.",
    "So the money is in many tiny, early, cheap tickets with dated catalysts, not one big bet on the news.",
    "Profits go into the money loop: the safe stack first, then leverage with the PRNTR system, never back into one coin.",
  ], 0.5, 3.15, 9, 1.9, 13);
  s.addNotes("Graduation stats: MadeOnSol deployer data (unverified single source) and The Block.");

  // ================= PLAYBOOK =================
  section(9, "The Crossover playbook", "Step by step: before the news, on the day, and after. Both trades, one plan.");

  s = content("Before the news: the watch list", K());
  grid(s, [
    ["Big names in a Box", "Each Sunday, check the weekly and daily charts of the big story stocks: NVIDIA, Tesla, Apple, Meta, Microsoft, Palantir, GameStop, AMC, Trump Media, Coinbase, MicroStrategy, Robinhood, Netflix."],
    ["The catalyst calendar", "Earnings dates, product events, launches, votes, court dates, premieres. Write them next to each stock."],
    ["The names list", "For each stock: the ticker, company, products, CEO, the CEO's nickname, the rival, the cause of a possible shock."],
    ["Search the names now", "Search each name on FOMO and Pump.fun today. Note the OG coins, their creation date, market cap and holders."],
    ["Pre-position small", "A few dollars in the clean OGs of the names most likely to trend. Log them in your sheet."],
    ["Alerts on", "Post alerts for the news accounts and the people behind the stocks (Part C)."],
  ], 3, 1.35, 1.75, { size: 11 });
  s.addNotes("The prep.");

  s = content("On the day", K());
  steps(s, [
    ["Read the close", "Did the stock close out of the Box? Up or down? Inside = no stock trade."],
    ["Name the type", "Same way, opposite way, sell the news, or trap."],
    ["Stock trade", "On a launch, wait for the 1-hour Turn. Stop beyond the Fake-Out, target the next level."],
    ["Coin trade", "Sell into the spike if you pre-positioned. New coin? A few dollars max, after the safety check."],
    ["Pay yourself", "Half off at 3x. The rest has a plan: the second headline, or a time limit."],
  ], 1.45, 3.1);
  s.addNotes("Day-of routine.");

  s = content("After: the second headline", K());
  bullets(s, [
    "Big stories come in waves. HUNG moved on the resignation, not the first story. D.O.G.E. topped the day after Musk was named.",
    "Keep the moon bag only while new headlines keep coming. When the timeline moves on, sell the rest.",
    "On the stock, the trip across has a target: the other side of the Box. Take profit there.",
    "Write it up: the Box, the Fake-Out, the coin names, entry market cap, exit, and what you'd change. Your case file is your edge.",
  ], 0.5, 1.4, 9, 3.6, 14);
  s.addNotes("Review loop.");

  s = content("Let the stock trade pay for the coin", K());
  table(s, [["Step", "Stock", "Coin"],
    ["1. Before", "Mark the Box, the Fake-Out, the catalyst", "Search the names, buy OGs with a few dollars"],
    ["2. The Turn", "Enter with a tight stop, 1–2% risk", "Nothing yet, or hold the OGs"],
    ["3. Target hit", "Close or scale out", "Put a small slice of the profit into the leading coin"],
    ["4. The spike", "Done", "Sell in pieces: half at 3x, the rest on the second headline"],
    ["5. The loop", "Profit to the safe stack", "Profit to the safe stack"]], 0.5, 1.4, 9, [1.5, 3.75, 3.75], { rowH: 0.5, size: 12 });
  quote(s, "You only ever risk what the plan allows on the stock. The coin is bought with winnings, so a zero costs you nothing you started with.", 4.55);
  s.addNotes("This is the NVDA × HUNG pattern.");

  s = content("Stock catalysts to put on your calendar", K());
  grid(s, [
    ["Earnings seasons", "Late January, April, July and October. NVIDIA reports about a month later (late Feb, May, Aug, Nov)."],
    ["Big tech events", "CES (January), NVIDIA GTC (March), Apple WWDC (June) and its iPhone event (September), Tesla events."],
    ["Launches and premieres", "A game, a show, a toy, a film. GTA VI (Take-Two) is due in late 2026: confirm the date."],
    ["Politics", "Votes, inaugurations, new government roles, campaign launches. Nov 2028: the US presidential election."],
    ["Crypto listings", "Robinhood and Coinbase listings move coins. Watch their announcements."],
    ["Shocks you can't date", "Rival launches (DeepSeek), resignations (HUNG), posts (Roaring Kitty). Hold OGs in advance; react fast."],
  ], 3, 1.35, 1.75, { size: 11 });
  s.addNotes("Confirm every date the week before.");

  // ================= PART C: FRONT-RUNNING =================
  section(10, "Front-running narratives: the full playbook", "Everything PRNTR teaches about getting in before the crowd, in one place: narratives, the calendar, the OG coin, the supply math, the traders who already do it, and the watch lists.");

  s = content("What front-running means here", K());
  card(s, 0.5, 1.4, 4.4, 3.3, "Front-running a narrative", "Buying the coin a story will send people to, BEFORE the story peaks: days, weeks or months early, while it's cheap and nobody's looking. This is research and patience.", { tcol: C.accent2 });
  card(s, 5.1, 1.4, 4.4, 3.3, "Not front-running people", "Buying a coin and then telling your followers to buy so you can sell to them is a different thing. Regulators call it scalping or manipulation. PRNTR never does it (Part E).", { tcol: C.accent5 });
  s.addNotes("Draw the line clearly.");

  s = content("The three narratives that move the most", K());
  card(s, 0.5, 1.45, 2.85, 3.0, "Presidential and politics", "Elections, candidates, nicknames, new roles, viral moments. MAGA, D.O.G.E., official TRUMP, America Party.", { tcol: C.accent1 });
  card(s, 3.575, 1.45, 2.85, 3.0, "Elon Musk", "One post can create a coin and move it in minutes. D.O.G.E., America Party, GROK. Watch what he posts, names and jokes about.", { tcol: C.accent3 });
  card(s, 6.65, 1.45, 2.85, 3.0, "Anything AI", "New models, agents, launches, shocks. DeepSeek, 'NVDA AI', Stargate, the AI-agent coins of late 2024.", { tcol: C.accent2 });
  quote(s, "Check all three every day. They produced most of the case studies in this book.", 4.65);
  s.addNotes("From the owner: presidential, Elon, anything AI.");

  s = content("Where narratives start", K());
  await iconRows(s, [
    ["FaXTwitter", "News accounts on X", "Breaking-news accounts such as Watcher Guru. A headline can become a coin in minutes. Turn on their post alerts."],
    ["FaFire", "FOMO first", "Search every new name on FOMO before anywhere else: you see the coins, who's buying, and the traders' records in one place."],
    ["FaTelegram", "Telegram callers and groups", "Where coins get shared first. Track which callers are early, not loud."],
    ["FaChartLine", "DEX Screener and Pump.fun trending", "A new theme shows up as several coins with the same idea moving on the same day."],
    ["FaCalendarDays", "The calendar", "A big event coming up is a narrative you can see months before it happens."],
  ], 0.5, 1.35, 9, 0.75);
  s.addNotes("News first.");

  s = content("How to front-run a narrative", K());
  steps(s, [
    ["Spot the theme", "Two or three coins on the same idea move on the same day, or a dated event is coming."],
    ["Find the OG", "The first clean coin with the exact name people will type."],
    ["Check it fast", "Safety check, holders, creator, sells. Under two minutes."],
    ["Enter small", "Before the big accounts post. Under $20K market cap is where PRNTR likes to enter."],
    ["Sell into the crowd", "Half at 3x to take your money out. The rest is the moon bag."],
  ], 1.45, 3.1);
  s.addNotes("The PRNTR entry rules.");

  s = content("Why events are easy to front-run", K());
  await iconRows(s, [
    ["FaCalendarDays", "The date is public", "Everyone knows when the Super Bowl, an election, a World Cup final or an earnings call happens."],
    ["FaMagnifyingGlass", "The crowd searches the name", "On the day, new buyers type the event's name into Pump.fun or FOMO and buy what they find. Often that's the first coin with that name."],
    ["FaCrown", "The OG gets the attention", "In memecoins, 'the original' is part of the story. The first coin with the name is the one people screenshot and share."],
    ["FaSeedling", "You get in before anyone cares", "Months early, the OG can sit at a few thousand dollars of market cap. A few dollars buys a real share of the supply."],
  ], 0.5, 1.4, 9, 0.9);
  s.addNotes("Events are narratives with a date.");

  s = content("How an event coin moves", K());
  const tl = [["Months before", "Quiet. The OG sits at a few $K. You buy small.", C.accent1], ["Weeks before", "Talk starts on X and Telegram. Early wallets add.", C.accent3],
              ["The days before", "Search volume spikes. The crowd buys the name. You sell here.", C.accent2], ["The day and after", "Sell the news. Most event coins fade fast.", C.accent5]];
  s.addShape(pres.shapes.LINE, { x: 0.7, y: 2.2, w: 8.6, h: 0, line: { color: C.background2, width: 2 } });
  tl.forEach(([h, b, col], i) => {
    const x = 0.5 + i * 2.3;
    s.addShape(pres.shapes.OVAL, { x: x + 0.15, y: 2.0, w: 0.4, h: 0.4, fill: { color: col }, line: { color: col } });
    s.addText(h, { isTextBox: true, x, y: 2.6, w: 2.1, h: 0.4, fontSize: 15, bold: true, color: C.background1, margin: 0 });
    s.addText(b, { isTextBox: true, x, y: 3.05, w: 2.1, h: 1.3, fontSize: 13, color: C.background2, margin: 0, valign: "top" });
  });
  quote(s, "Case 8 proves the third column: MAGA was at $212M the day after the vote and $79M the day after that.", 4.5);
  s.addNotes("Trade attention, not the outcome.");

  s = content("Events that already played out", K());
  grid(s, [
    ["2024 US presidential election", "Coins named after candidates, nicknames and slogans ran for months. MAGA, D.O.G.E. (Cases 2 and 8)."],
    ["The inauguration, Jan 2025", "The official TRUMP coin launched 3 days before it and topped the day before (Case 10)."],
    ["The Super Bowl, every February", "Team names, the halftime show, the ads, viral moments."],
    ["FIFA World Cup 2022 and 2026", "Countries, players, mascots, the final. Each match day brings searches."],
    ["Olympics, Paris 2024", "Athletes and viral moments became coins within minutes."],
    ["Bitcoin halving, April 2024", "A dated crypto event. Halving coins moved in the weeks before it."],
  ], 2, 1.35, 1.1);
  s.addNotes("The pattern repeats.");

  s = content("The calendar ahead (from Nov 2026)", K());
  table(s, [["When", "Event", "Names to search"],
    ["Late Nov 2026", "Thanksgiving, Black Friday, GTA VI (confirm date)", "TURKEY, BLACKFRIDAY, GTA6, VICE, LUCIA"],
    ["Dec 2026 – Jan 2027", "Christmas, New Year", "XMAS, SANTA, 2027, the year's memes"],
    ["Feb 2027", "Chinese New Year (Year of the Goat), Super Bowl LXI, Valentine's", "GOAT (and the old GOAT coin!), the teams, the halftime act"],
    ["Mar 2027", "The Oscars, NVIDIA GTC", "Nominees, NVIDIA product names"],
    ["Jun–Jul 2027", "FIFA Women's World Cup (Brazil)", "Countries, star players"],
    ["Oct–Nov 2027", "Halloween, Rugby World Cup", "Costumes of the year, teams"],
    ["~Apr 2028", "Bitcoin halving", "HALVING, the block number"],
    ["Jul 2028", "Los Angeles Olympics", "LA28, athletes, mascot"],
    ["Nov 2028", "US presidential election", "Every candidate, nickname, running mate, slogan"]], 0.5, 1.3, 9, [1.6, 3.9, 3.5], { rowH: 0.36, size: 10.5 });
  quote(s, "Dates move. Confirm each one the week before. Earnings dates go on the same calendar.", 4.95);
  s.addNotes("Update monthly.");

  s = content("Build your search list for each event", K());
  card(s, 0.5, 1.4, 4.4, 3.5, "Every name people will type", "The event: SUPERBOWL, WORLDCUP\nThe short form: SB61, WC2027\nTeams, countries, players, candidates\nThe mascot, the slogan, the meme of the moment\nThe nickname the internet uses, not the official one\nFor stocks: the ticker, product, CEO, rival, the cause");
  card(s, 5.1, 1.4, 4.4, 3.5, "One sheet", "One row per name: event, date, the OG you found, contract address, created date, market cap when you bought, your supply %, the week you'll sell.\n\nReview every Sunday. New names appear as the date gets closer.", { tcol: C.accent2 });
  s.addNotes("The list is the work.");

  s = content("Searching on FOMO and Pump.fun", K());
  steps(s, [
    ["FOMO first", "Type each name. See which coins exist and which traders already hold them."],
    ["Then Pump.fun", "Search the same names. Sort by oldest."],
    ["Open the first one", "Created when, by whom, who holds it."],
    ["Confirm on-chain", "Paste the contract into a Solana explorer and check the creation time."],
    ["Buy small", "A few dollars. Log market cap and supply % in the sheet."],
  ], 1.45, 3.1);
  s.addNotes("FOMO first, then Pump.fun.");

  s = content("Is it really the OG?", K());
  card(s, 0.5, 1.4, 4.4, 3.5, "Signs it's the original", "Created before every other coin with that name\nName and ticker match exactly\nThe creator doesn't hold a big share\nNot bought up by a few wallets in the first seconds\nHolders spread out, not one whale", { tcol: C.accent2 });
  card(s, 5.1, 1.4, 4.4, 3.5, "Signs to walk away", "A later copy clearly won the crowd\nThe creator sold early or holds most of it\nBundled launch: a few linked wallets took most of it\nClose to the name, but not what people will type\nNobody but the creator has ever sold", { tcol: C.accent5 });
  s.addNotes("First clean coin wins.");

  s = content("The supply math", K());
  bigStat(s, 0.5, 1.4, 4.2, "$15 at $3K", "market cap buys 0.5% of the supply. Your share = what you put in ÷ market cap.", C.accent1);
  table(s, [["If it reaches", "0.5% is worth"], ["$100K", "$500"], ["$500K", "$2,500"], ["$1M", "$5,000"], ["$2M", "$10,000"], ["$3M", "$15,000"]],
    5.2, 1.4, 4.3, [2.15, 2.15], { rowH: 0.45, size: 13, align: "center" });
  s.addText("$10–15 into $10,000–15,000 needs the coin to reach about $2M–$3M. At $500K, 0.5% is $2,500. Fees and slippage take a little off.",
    { isTextBox: true, x: 0.5, y: 3.05, w: 4.3, h: 1.6, fontSize: 13, color: C.background2, margin: 0, valign: "top" });
  s.addNotes("Most event coins never reach these levels. That's why it's a portfolio.");

  s = content("Anniversaries and number memes", K());
  card(s, 0.5, 1.4, 4.4, 3.3, "The pattern", "Some coins run on a date, then go quiet. A year later the same date, meme or season comes back, and so do the buyers. Note every coin that ran on a date and check it again the next year.", { tcol: C.accent1 });
  card(s, 5.1, 1.4, 4.4, 3.3, "Example from the PRNTR desk", "A coin called '2026-7' hit about $542K market cap around Nov 7, 2025: the name only made sense because '6-7' was a viral meme. The thesis: same meme, the right year, the same season. A dated idea you can hold early.", { tcol: C.accent4 });
  quote(s, "This is a thesis, not a promise. Size it like every other OG: a few dollars.", 4.85);
  s.addNotes("Owner's 2026-7 thesis. Figures are the owner's own note, not independently verified.");

  s = content("Animal metas: the fastest narratives", K());
  steps(s, [
    ["Catch the story first", "Escapes, zoo births, naming contests, viral rescues, celebrity pets, live cams. Local news and X, minutes old."],
    ["Get the real name", "Only the confirmed name: two independent sources or the keeper. Never guess."],
    ["Check for a coin", "Search Pump.fun, DEX Screener and GeckoTerminal. Is there a coin yet?"],
    ["No coin yet?", "As a buyer: watch for the first clean one. As a developer: that's a launch idea (Part D)."],
    ["Same rules", "OG, safety check, small size, sell into attention."],
  ], 1.45, 3.1);
  quote(s, "Moo Deng the hippo and Peanut the squirrel became some of the biggest memecoin stories of 2024. Animal stories move fast and fade fast.", 4.75);
  s.addNotes("From the PRNTR animal-news workflow.");

  s = content("Celebrity and influencer watch list", K());
  await iconRows(s, [
    ["FaListCheck", "Build a big list", "Celebrities, athletes, rappers, founders, politicians and big crypto accounts. Add anyone who has ever posted a coin, a contract address or a FOMO or Pump.fun link."],
    ["FaBell", "Post alerts on", "Some post a contract address straight from FOMO. The first minutes decide everything."],
    ["FaUserShield", "Check it's really them", "Hacked accounts post fake coins all the time. Check the handle, the history, and whether the coin is linked from their own profile."],
    ["FaTriangleExclamation", "Assume it's paid", "Many celebrity posts are paid promotions, and many promoted coins dump. The CoinWire study: 86% of promoted coins fell 90%+ within 3 months."],
  ], 0.5, 1.4, 9, 0.9);
  s.addNotes("CoinWire late-2024 study of 377 accounts and 1,567 promoted coins.");

  section(11, "Follow the traders who already front-run", "You don't have to find every narrative yourself. Find the wallets that keep getting in early, check their pattern, and copy them small.");

  s = content("Find the traders who do this", K());
  await iconRows(s, [
    ["FaUserSecret", "Look at who holds the OGs", "Open the event and narrative coins you found. Wallets that bought months early and hold a real share are often front-runners."],
    ["FaClockRotateLeft", "Check their past events", "Did they hold last year's election, Super Bowl or anniversary coins early, and sell into the day?"],
    ["FaEye", "Watch what they hold now", "Their current low-market-cap holdings show the next events they're positioned for."],
    ["FaRobot", "Copy them, small", "Put the best ones in a copy bot so you buy when they buy."],
  ], 0.5, 1.4, 9, 0.9);
  s.addNotes("Front-runners leave footprints.");

  s = content("Read their pattern on FOMO", K());
  card(s, 0.5, 1.4, 4.4, 3.3, "Copy this: the ladder", "One or two buys, then six or seven sells, again and again. They buy once and scale out on the way up. That's a plan, and it means consistent income.", { tcol: C.accent2 });
  card(s, 5.1, 1.4, 4.4, 3.3, "Avoid this: scattered", "One buy, one sell. Five buys, two sells. Random sizes, random timing. That's gambling, even if the last trade won.", { tcol: C.accent5 });
  quote(s, "FOMO shows each trader's buys and sells in the Transactions tab. Scroll back weeks, not days.", 4.85);
  s.addNotes("Owner: 1–2 buys per 6–7 sells = good trader.");

  s = content("Check what they hold right now", K());
  bullets(s, [
    "Open their holdings. Are they in low-market-cap coins with a big share of supply?",
    "Does the narrative fit something coming up? An event, a name, a meta that's starting to move?",
    "How long have they held? Months-early holders of a dated event are the ones to study.",
    "If several good wallets hold the same small coin, that's a signal worth a few dollars.",
  ], 0.5, 1.4, 9, 3.5, 15);
  s.addNotes("Holdings are their next trades.");

  s = content("Find the wallet behind a winning trade", K());
  steps(s, [
    ["Open the chart", "The coin the trader you want to copy bought, on DEX Screener."],
    ["Transactions tab", "Scroll to around the time and price they got in."],
    ["Match two things", "The number of tokens they hold, and the market cap they bought at."],
    ["Found it", "Click the wallet. Check its history on FOMO."],
    ["Track it", "Add it to a wallet tracker: the Ray wallet tracker on Telegram (yellow icon)."],
  ], 1.45, 3.1);
  s.addNotes("Manual matching on the Transactions tab.");

  s = content("Copy it with a bot", K());
  table(s, [["Chain", "Bot", "What to set"],
    ["Solana", "Odin", "Wallet to copy, a fixed buy size, slippage, a max market cap, and auto-sell rules"],
    ["Ethereum, Base, BNB and others", "Maestro", "The same settings. Gas costs more, so size and frequency matter"]], 0.5, 1.4, 9, [2.6, 1.4, 5.0], { rowH: 0.6, size: 12 });
  bullets(s, [
    "Buy size: fixed and small. 1–2% of your trading money per copied trade.",
    "Auto-sell: half at 3x (2x on very fast coins), the rest on a trailing rule or when the copied wallet sells.",
    "Skip coins above your max market cap: the copied wallet may be exiting, not entering.",
    "Use a separate trading wallet for the bot. Never connect your savings wallet.",
  ], 0.5, 3.5, 9, 1.65, 12.5);
  s.addNotes("Odin for Solana, Maestro for everything else.");

  s = content("The PRNTR front-running routine", K());
  table(s, [["When", "Do this"],
    ["Every morning (20 min)", "News accounts, Elon, AI headlines, the three narratives. Search new names on FOMO. Check the copied wallets' new buys."],
    ["Every evening (10 min)", "Check open coins against your exit plan. Take the 3x halves. Log everything."],
    ["Every Sunday (1 hour)", "Big stocks: weekly and daily Boxes. Update the event calendar and search lists. Find new OGs. Review the wallets you copy."],
    ["Every month", "Update the calendar ahead. Drop wallets that stopped working. Move profit into the money loop."]], 0.5, 1.4, 9, [2.2, 6.8], { rowH: 0.7, size: 12 });
  s.addNotes("Routine beats talent.");

  // ================= PART D: INCOME WITHOUT TRADING =================
  section(12, "Income without trading: the map", "Some of the best money in crypto never touches a chart. Callers, developers, X creators, network builders and username sellers get paid on attention, fees and assets.");

  s = content("Six ways to earn without trading", K());
  grid(s, [
    ["Caller / KOL", "Build an audience that follows your calls. Paid posts, bot referral fees, a paid group, token allocations."],
    ["Telegram network", "Know the developers, callers and group owners. Channel ad revenue, Stars, introductions, deals."],
    ["Developer", "Launch coins on Pump.fun and earn creator fees on every trade, for as long as people trade it."],
    ["X creator", "Grow a following and get paid by X: Original Content Rewards and Subscriptions."],
    ["Token supply", "Developers give KOLs supply for promotion. Legal only with clear disclosure."],
    ["Telegram usernames", "Short, valuable names sold as collectibles on Fragment, paid in Gram (the renamed Toncoin)."],
  ], 3, 1.35, 1.55, { size: 11.5 });
  quote(s, "All six run on the same thing as memecoins: attention. The difference is you get paid for creating it, not for guessing it.", 4.95);
  s.addNotes("Overview.");

  s = content("Six changes in 2025–2026 you must know", K());
  table(s, [["What changed", "Now"],
    ["X Creator Revenue Sharing", "Ended Sep 7, 2026. Replaced by Original Content Rewards (applications from Sep 8, 2026)."],
    ["Toncoin", "Renamed Gram (GRAM) around Jun 15, 2026. Fragment prices in Gram. No swap needed."],
    ["Pump.fun fees", "1.25% on the bonding curve, 0.30% of it to the creator."],
    ["Pump.fun graduation", "Goes to PumpSwap (since Mar 20, 2025), not Raydium."],
    ["Fragment ID checks", "Reported changed around Nov 2, 2026 (not officially announced). Check before you rely on it."],
    ["US SEC on memecoins", "Feb 2025 staff statement: memecoins are generally not securities. Fraud law still applies."]], 0.5, 1.35, 9, [2.6, 6.4], { rowH: 0.52, size: 11.5 });
  s.addNotes("Research as of Nov 14, 2026.");

  // ---- CALLER ----
  section(13, "Become a caller (KOL)", "A KOL, a 'key opinion leader', is a caller with an audience: a Telegram channel and an X account that post coins with a short reason. Here's how callers actually make money, and the lines they can't cross.");

  s = content("How a caller starts", K());
  steps(s, [
    ["Pick your lane", "One niche: event OGs, AI coins, animal metas, the Crossover. Narrow wins."],
    ["Public channel + X", "A Telegram channel for calls, an X account for the reasoning and receipts."],
    ["Call with a reason", "Contract address, the narrative, the entry market cap, the plan, the risk."],
    ["Post receipts", "Wins AND losses. Followers now check caller wallets on-chain."],
    ["Be consistent", "Same time, same format, every day. Trust is built by repetition."],
  ], 1.45, 3.1);
  s.addNotes("Track record first, money second.");

  s = content("Your wallet is public now", K());
  await iconRows(s, [
    ["FaMagnifyingGlassChart", "Kolscan", "Tracks the Solana wallets of KOLs. Pump.fun bought it in July 2025 (DL News)."],
    ["FaTags", "Arkham's KOL label", "Tags influencers with 100K+ X followers so anyone can see if they sell right after posting."],
    ["FaChartColumn", "What the data shows", "Across 457 scored KOL wallets, the average 30-day win rate was 42%; about 1 in 4 won more than half their trades (MadeOnSol, unverified)."],
    ["FaScaleBalanced", "So", "An honest record is the asset. Call it, hold it, post it, win or lose."],
  ], 0.5, 1.4, 9, 0.9);
  s.addNotes("Transparency is the new normal.");

  s = content("How callers get paid", K());
  table(s, [["Income", "Typical numbers", "Confidence"],
    ["Paid posts", "$2,000–$20,000 per post for mid-size accounts, sometimes paid in tokens", "Unverified (MadeOnSol)"],
    ["Paid posts, average", "About $399 per promotional tweet across 377 accounts", "Study (CoinWire, late 2024)"],
    ["Rate card, small", "$200–$1,000 per post at 50K–200K followers; $5K–$50K at 1M+", "Unverified blog"],
    ["Bot referral fees", "A share of the fees your referred users pay, for months or life (next slide)", "Official docs for Axiom, Trojan"],
    ["Paid group", "$50–$300 a month for premium calls", "Unverified"],
    ["Token allocations", "Supply from developers for promotion (Chapter 16)", "Varies"]], 0.5, 1.35, 9, [2.0, 4.8, 2.2], { rowH: 0.5, size: 11.5 });
  s.addNotes("Mix several streams.");

  s = content("Trading-bot referral fees", K());
  table(s, [["Bot / terminal", "Referral terms", "Source"],
    ["Axiom", "Tier 1 (direct) 30%, tier 2 3%, tier 3 2%", "Official docs"],
    ["Trojan", "5 levels; total share 27.5% / 32.5% / 42.5% / 47.5% by tier", "Official docs"],
    ["Photon", "30% of referred users' fees, for life", "Unverified"],
    ["GMGN", "Up to 30%, tiered", "Unverified"],
    ["BonkBot", "About 10–30%", "Unverified"],
    ["Maestro", "25%", "Unverified"]], 0.5, 1.35, 9, [2.0, 5.0, 2.0], { rowH: 0.42, size: 12 });
  quote(s, "The math: bot fees are about 1% of volume. A follower who trades $10K pays about $100 in fees. At 30%, you earn about $30 from that one person. 300 active followers like that: about $9,000.", 4.45);
  s.addNotes("Our arithmetic. Check each bot's current terms.");

  s = content("Pricing a paid post honestly", K());
  card(s, 0.5, 1.4, 4.4, 3.4, "Before you take the deal", "Run the safety check on the coin like you would for yourself\nCheck the developer's past launches\nGet paid in cash or stablecoins, not only their token\nPut it in writing: what you post, when, and that it's labelled", { tcol: C.accent1 });
  card(s, 5.1, 1.4, 4.4, 3.4, "When you post it", "Label it #ad or use X's Paid Partnership label\nSay if you were paid in tokens and whether you'll sell\nNever buy before the post to sell into your followers\nTurn down coins you wouldn't hold yourself", { tcol: C.accent2 });
  s.addNotes("FTC: clear disclosure of any material connection.");

  s = content("What gets callers exposed", K());
  grid(s, [
    ["Bubblemaps, Nov 5, 2026", "Investigated four KOLs. One: about $6M in estimated related profits.", HEX.accent5],
    ["Buying before the call", "Another KOL's linked wallets bought about 20 seconds before roughly 61% of ~534 October calls.", HEX.accent5],
    ["Selling minutes after", "A third often sold about 3 minutes after calling.", HEX.accent5],
    ["The Pump.fun lawsuit", "A US class action (RICO) names 25 unidentified 'KOL' defendants alongside the platform (filed Jul 2025).", HEX.accent4],
  ], 2, 1.35, 1.65, { size: 12.5 });
  quote(s, "Wallets are public. Anything you do with yours will be found.", 4.85);
  s.addNotes("Sources: ChainCatcher summary of Bubblemaps; The Block, Cointelegraph for the lawsuit.");

  s = content("The caller's first 90 days", K());
  table(s, [["Weeks", "Goal", "Do"],
    ["1–2", "Set up", "Channel, X account, bio, pinned post with your rules: 'I disclose paid posts. I don't sell into my calls.'"],
    ["3–6", "Track record", "1–3 calls a day with the reason and entry market cap. Weekly recap of every call, wins and losses."],
    ["7–10", "Grow", "Reply to bigger accounts with real value. Post one breakdown a day on X. Cross-post receipts."],
    ["11–13", "Monetize", "Add bot referral links, open a paid tier for deeper calls, take only paid posts you'd hold yourself."]], 0.5, 1.4, 9, [1.0, 1.6, 6.4], { rowH: 0.7, size: 12 });
  s.addNotes("A plan, not a promise.");

  // ---- TELEGRAM NETWORK ----
  section(14, "Build your Telegram network", "Telegram is where coins get shared first, deals get made and launches get coordinated. Your network is an asset you can earn from in clean ways.");

  s = content("Who you want to know", K());
  grid(s, [
    ["Developers", "They need honest callers, artists, moderators, web builders and early holders who don't dump."],
    ["Callers", "Share research, trade notes, cross-promote channels. A group of good callers is a moat."],
    ["Group owners", "Run the communities where coins live. They hire moderators and buy promotion."],
    ["Builders", "Bot makers, designers, video editors, website builders: the launch team."],
  ], 2, 1.35, 1.65, { size: 12.5 });
  s.addNotes("Be useful to each group.");

  s = content("How relationships form", K());
  steps(s, [
    ["Give first", "Free research, a fixed website, a clean logo, a moderation hour. Do one useful thing."],
    ["Be reliable", "Show up, keep your word, don't dump on people. Reputation spreads fast in small chats."],
    ["Join the right chats", "Developer and caller group chats are invite-only. Invitations come from people who trust you."],
    ["Bring deals both ways", "Introduce a developer to an artist, a caller to a developer. Introductions get remembered."],
  ], 1.45, 3.1);
  s.addNotes("Network = trust x usefulness.");

  s = content("Telegram's own money", K());
  card(s, 0.5, 1.4, 4.4, 3.3, "Channel ad revenue", "Public channels with 1,000+ subscribers get 50% of the ad revenue Telegram earns in that channel. Withdrawals go through Fragment (Telegram blog, March 2024).", { tcol: C.accent1 });
  card(s, 5.1, 1.4, 4.4, 3.3, "Telegram Stars", "Paid posts, subscriptions and gifts in Stars. Stars can be withdrawn 21 days after they're earned (Telegram creator terms). Minimum withdrawal and the dollar rate change: check the current numbers.", { tcol: C.accent2 });
  s.addNotes("Native monetization.");

  s = content("The red lines in group chats", K());
  bullets(s, [
    "Getting a contract address early in a private chat, then calling it publicly while you sell, is front-running your followers: fraud and manipulation exposure in the US, the EU (MiCA Article 91) and the UK.",
    "Chats that coordinate buys and sells are where pump-and-dumps are organised. An academic study names Telegram and Discord as the main hubs.",
    "Members of a coordinating chat can be named as co-conspirators. See the Pump.fun RICO case and US v. Constantinescu (reinstated by the Fifth Circuit, Oct 2025).",
    "If a chat asks you to buy together and sell into a call: leave it.",
  ], 0.5, 1.4, 9, 3.7, 13.5);
  s.addNotes("Protect yourself.");

  // ---- DEVELOPER ----
  section(15, "Become a developer: launch coins", "A developer creates the coin. On Pump.fun, launching is free except network fees, and the creator earns a fee on every trade. Here's the full flow, the real fee numbers, and the honest launch.");

  s = content("Launching on Pump.fun, step by step", K());
  steps(s, [
    ["Separate wallet", "Connect a fresh Solana wallet (Phantom or Solflare) used only for launches."],
    ["Start a new coin", "Name, ticker, description, image (512×512). Add X, Telegram and website links."],
    ["Dev buy (optional)", "Buy some of your own supply at launch. Disclose it publicly."],
    ["The bonding curve", "The coin trades on Pump.fun's curve. Buyers push the price up the curve."],
    ["Graduation", "At about 85 SOL deposited, it moves to PumpSwap automatically, and the pool tokens are burned."],
  ], 1.45, 3.1);
  s.addNotes("Sources: MadeOnSol guides (Sep 2026), Coinpaprika.");

  s = content("What it costs", K());
  bigStat(s, 0.5, 1.4, 2.9, "$0", "platform fee to create a coin. You pay only Solana network fees.", C.accent2);
  bigStat(s, 3.55, 1.4, 2.9, "0.015 SOL", "graduation fee, taken from the coin's reserves, not your wallet.", C.accent1);
  bigStat(s, 6.6, 1.4, 2.9, "Your time", "art, website, X account, community. That's the real cost.", C.accent4);
  bullets(s, [
    "Older guides mention a ~0.02 SOL creation fee and 1.5 or 6 SOL graduation fees. Those are out of date.",
    "Since July 2026, BOOST is the default: part of the migration pool is used for automatic buys in the first 5 minutes after graduation, and those tokens are burned.",
    "USDC-paired launches were added in May 2026 (unverified).",
  ], 0.5, 3.2, 9, 1.8, 12.5);
  s.addNotes("Coinpaprika citing pump.fun/docs/fees, checked Sep 2026; The Block for BOOST.");

  s = content("Creator fees: how developers get paid", K());
  table(s, [["Phase", "To creator", "To protocol", "To pool", "Total"],
    ["Bonding curve", "0.30%", "0.95%", "0%", "1.25%"],
    ["PumpSwap, 0–420 SOL market cap", "0.30%", "0.93%", "0.02%", "1.25%"],
    ["PumpSwap, 420–1,470 SOL", "0.95%", "0.05%", "0.20%", "1.20%"],
    ["PumpSwap, 98,240+ SOL", "0.05%", "0.05%", "0.20%", "0.30%"]], 0.5, 1.35, 9, [3.4, 1.4, 1.4, 1.4, 1.4], { rowH: 0.45, size: 12, align: "center" });
  bullets(s, [
    "The creator share steps down through 25 tiers between 420 and 98,240 SOL market cap. Non-official PumpSwap pools pay the creator 0%.",
    "Claim: Profile → More → Creator rewards → Claim all. No minimum. Fees can be split across up to 10 wallets, or sent to holders ('Holder Rewards').",
    "Example: $1M of volume on the curve pays the creator about $3,000. A coin that keeps trading keeps paying.",
  ], 0.5, 3.75, 9, 1.4, 12);
  s.addNotes("Coinpaprika, Smithii. pump.fun's own fee page could not be opened from our research tools.");

  s = content("The honest odds", K());
  table(s, [["When", "What happened", "Source"],
    ["Aug 1–28, 2026", "1,032,440 launches from 223,339 wallets. 1.8% graduated. Median graduate topped at $31K.", "MadeOnSol (unverified)"],
    ["Week to Jun 16, 2026", "Graduation rate fell to 0.26%. Pump.fun revenue ~$800K a day, down from $4.8M six months earlier.", "The Block"],
    ["Late Jul 2026, after BOOST", "Graduation rate peaked at 6.7%.", "The Block"],
    ["Jan 2024 – May 2025", "~7M tokens; 98.6% showed scam or pump-and-dump traits; ~1.4% kept $1,000+ in their pool. Pump.fun disputed it.", "Solidus Labs"]], 0.5, 1.35, 9, [2.0, 5.2, 1.8], { rowH: 0.62, size: 11.5 });
  quote(s, "Most launches go nowhere. Developers who earn do it with many cheap launches on real narratives, or one coin with a real community.", 4.6);
  s.addNotes("Set expectations.");

  s = content("What makes a launch work", K());
  grid(s, [
    ["A narrative people search", "The same rules as buying: a name the crowd will type, at the moment they'll type it. First is a story."],
    ["Art and a meme", "A clean logo, a reason to share it, a joke people get in one second."],
    ["The basics done", "Website, X account, Telegram, a pinned post that explains it."],
    ["A community, not a dump", "Holders who stay. Moderators. Daily posts. A plan beyond day one."],
    ["Something to do", "A game, a tool, a launchpad, holder rewards, a charity split. Utility gives people a reason to stay."],
    ["Fair start", "No secret bundled supply, dev buy disclosed, no secret paid callers."],
  ], 3, 1.35, 1.75, { size: 11.5 });
  s.addNotes("Launch ideas: games, utility, launchpads, or combinations of the three.");

  s = content("Honest launch vs rug pull", K());
  card(s, 0.5, 1.4, 4.4, 3.3, "Honest launch", "No secret bundled or sniper wallets\nDev buy and team wallets disclosed\nNo undisclosed paid KOLs\nNo selling into a coordinated hype push\nYou earn from fees and the community, not from dumping on buyers", { tcol: C.accent2 });
  card(s, 5.1, 1.4, 4.4, 3.3, "Rug pull (crime)", "Bundled wallets buy at launch and trace back to you\nThe developer sells once buyers arrive and walks away\nFake promises of a team, a roadmap or a listing\nPulling the pool (like SQUID)", { tcol: C.accent5 });
  quote(s, "Rug pulls are prosecuted as wire fraud: the Frosties NFT creators (US, 2022), and in South Korea five people over a Pump.fun coin, 'CatFi', about $600K.", 4.85);
  s.addNotes("DOJ via Decrypt; Decrypt for CatFi.");

  s = content("Other launchpads", K());
  table(s, [["Launchpad", "What it is", "Notes"],
    ["Pump.fun", "The main Solana launchpad. Free to launch, creator fees, PumpSwap.", "The default for this book"],
    ["LetsBonk / Bonk.fun", "Built on Raydium LaunchLab. 1% swap fee used for operations, validators and BONK buybacks.", "Briefly passed Pump.fun in mid-2025"],
    ["Moonshot (DEX Screener)", "Launched Jun 2024 with no presales or insider allocations; now mostly a mobile trading app.", "2M+ users reported (unverified)"]], 0.5, 1.4, 9, [2.2, 4.8, 2.0], { rowH: 0.7, size: 12 });
  s.addNotes("Market share swings. Check volumes before choosing.");

  // ---- X ----
  section(16, "Grow on X, and get paid by X", "X shares revenue with creators. The old Creator Revenue Sharing program ended in September 2026; Original Content Rewards replaced it. Here's how to grow and qualify.");

  s = content("What the X algorithm rewards", K());
  await iconRows(s, [
    ["FaComments", "Replies, reposts, likes, profile clicks, time spent", "X open-sourced its Grok-based ranking in January 2026. These are the signals it predicts."],
    ["FaBan", "Blocks, mutes and reports", "Count against your posts. Rage-bait that gets you muted costs you reach."],
    ["FaCircleXmark", "Engagement bait", "Asking for likes, reposts or follows 3+ times can disqualify you from the rewards program (unverified)."],
    ["FaPenNib", "Original posts", "The rewards program pays on original posts only. Reposts and aggregation don't count."],
  ], 0.5, 1.4, 9, 0.9);
  s.addNotes("Business Today on the Jan 2026 open-source release. Weight multipliers you see online are unverified or from 2023 code.");

  s = content("A content plan for a crypto X account", K());
  table(s, [["Post type", "Example", "How often"],
    ["The breakdown", "A Crossover chart: the Box, the coin, the timeline", "Daily"],
    ["The receipt", "Your call, the entry market cap, the result, win or lose", "Every call"],
    ["The thread", "'How I found the OG for X event' with screenshots", "2–3 a week"],
    ["The calendar", "Events coming up and what you're watching", "Weekly"],
    ["The reply", "Real value under bigger accounts' posts, early", "10–20 a day"]], 0.5, 1.4, 9, [2.0, 5.2, 1.8], { rowH: 0.5, size: 12 });
  quote(s, "Original, useful, consistent. That's both what grows the account and what the rewards program pays for.", 4.6);
  s.addNotes("Plan.");

  s = content("Original Content Rewards: who qualifies", K());
  bullets(s, [
    "An active Premium, Premium+ or Premium Business subscription",
    "18 or older, in one of 100+ eligible countries",
    "500 verified followers",
    "500,000 Home Timeline impressions from verified users in the last 90 days (replies don't count)",
    "An account in good standing, posting original content",
    "Not eligible: reposts and aggregation, posts about monetization or coaching, political and government accounts",
    "Decision in up to 3 business days, one appeal, reapply after 90 days if rejected (unverified)",
  ], 0.5, 1.35, 9, 3.7, 13);
  s.addNotes("TechCrunch Aug 8 2026; NetInfluencer. X's own help page could not be opened by our research tools.");

  s = content("How X pays", K());
  grid(s, [
    ["What counts", "'Qualified impressions': unique Home Timeline views of your original posts by Premium users, with at least half the post on screen. Paid and repeat views don't count.", HEX.accent1],
    ["When", "Every two weeks, $30 minimum. US creators get a 1099-NEC.", HEX.accent2],
    ["How much", "X publishes no rate. Under the old program creators reported about $8–9 per 1M verified impressions. No OCR payouts reported yet.", HEX.accent4],
    ["Subscriptions", "Followers pay you monthly ($2.99–$9.99 is typical). You keep up to 97% until $50K lifetime, then up to 90% (English help page).", HEX.accent3],
  ], 2, 1.35, 1.65, { size: 12 });
  quote(s, "Treat X payouts as a bonus. The real value of the audience is your caller, referral and group income.", 4.85);
  s.addNotes("TechCrunch, Epidemic Sound, Tubefilter, X help pages.");

  // ---- TOKEN SUPPLY ----
  section(17, "Token supply as a KOL", "Developers give callers part of the supply, before launch or at a discount, in exchange for promotion. It's common. It's only legal and ethical when your followers know.");

  s = content("How it works", K());
  grid(s, [
    ["KOL round", "A discounted, pre-launch allocation in exchange for agreed promotion. Common in bigger launches."],
    ["Memecoin deals", "Informal. The developer sends supply directly, or puts you on a list for an early buy."],
    ["Paid in tokens", "A paid post settled in the coin instead of cash."],
    ["Vesting", "Tokens unlock over time so you can't dump on day one. Memecoin deals often have none."],
  ], 2, 1.35, 1.65, { size: 12.5 });
  s.addNotes("Mechanics.");

  s = content("Typical terms (examples, not a standard)", K());
  table(s, [["Project", "Unlocked at launch", "Cliff", "Then"],
    ["Yom", "20%", "3 months", "Linear over 6 months"],
    ["XYRO", "10%", "1 month", "Linear over 9 months"],
    ["Grindery", "15%", "1 month", "Over 8 months"]], 0.5, 1.4, 9, [2.4, 2.2, 2.0, 2.4], { rowH: 0.48, size: 13, align: "center" });
  bullets(s, [
    "One guide describes KOL rounds as 5–15% of the raise, spread across 10–30 creators, vesting over 12–24 months (unverified).",
    "The known risk: the 'KOL dump' when tokens unlock. Vesting terms are rarely public, so buyers can't see it coming.",
  ], 0.5, 3.6, 9, 1.4, 13);
  s.addNotes("Project docs; unitypad guide.");

  s = content("Taking supply the right way", K());
  steps(s, [
    ["Vet the coin", "Same safety check as a buy. Would you hold it with your own money?"],
    ["Get it in writing", "Amount, vesting, what you'll post, when."],
    ["Disclose clearly", "'I was given X% of supply for promoting this. I may sell.' #ad or X's Paid Partnership label."],
    ["Don't dump on calls", "Never sell into your own post. Sell on a schedule you disclosed."],
    ["Pay the tax", "Tokens received for work are income at their value when received (US)."],
  ], 1.45, 3.1);
  s.addNotes("FTC material connection; SEC 17(b) when a token is a security; MiCA Art. 91; UK s.21 FSMA.");

  s = content("What happened to people who didn't disclose", K());
  table(s, [["Who", "What", "Result"],
    ["Kim Kardashian (2022)", "Paid $250K for an EthereumMax post, not disclosed", "$1.26M paid to the SEC; 3-year promotion ban"],
    ["8 celebrities, Justin Sun case (2023)", "Lohan, Jake Paul, Soulja Boy, Ne-Yo, Akon and others promoted TRX/BTT", "Six settled, $400K+ in total"],
    ["Mayweather, DJ Khaled (2018)", "Paid ICO promotions, not disclosed", "SEC charges and settlements"],
    ["Paul Pierce (2023)", "EthereumMax promotion", "SEC settlement"]], 0.5, 1.4, 9, [2.6, 3.8, 2.6], { rowH: 0.62, size: 12 });
  quote(s, "Memecoins are generally not securities (SEC staff, Feb 2025), so some of these rules may not apply to pure memecoins. Fraud, FTC and foreign rules still do.", 4.6);
  s.addNotes("SEC press releases 2022-183 and 2023-59; CoinGecko research.");

  // ---- FRAGMENT ----
  section(18, "Sell Telegram usernames on Fragment", "Telegram usernames and anonymous numbers can be turned into collectibles and sold at auction on Fragment, on the TON blockchain, paid in Gram.");

  s = content("How a username becomes a collectible", K());
  steps(s, [
    ["Connect", "A self-custody TON wallet (Tonkeeper or MyTonWallet) and your Telegram account on Fragment."],
    ["Convert", "Pick a username linked to your account, group or channel and set a minimum bid."],
    ["Wait for a bid", "You can cancel only before the first bid. After it, the change is permanent."],
    ["7-day auction", "The first bid starts a 7-day auction. You can set a buy-now price."],
    ["Settle", "The winner gets it as an NFT in their wallet. You get Gram, minus fees."],
  ], 1.45, 3.1);
  s.addNotes("fragment.com/about.");

  s = content("Fees, payments and anonymous numbers", K());
  grid(s, [
    ["Fees", "5% on every collectible sale. A one-time 5 Gram conversion fee from the first auction. About 1 Gram per blockchain transaction.", HEX.accent1],
    ["Gram", "Toncoin was renamed Gram (GRAM) around Jun 15, 2026. No swap needed. Any page asking you to 'claim' or 'migrate' Gram is a scam.", HEX.accent4],
    ["Anonymous numbers", "+888 numbers that only work to sign up for Telegram. Login codes appear on Fragment. About 136,500 exist; resale only since 2022.", HEX.accent3],
    ["ID checks", "Fragment added ID checks in Nov 2024. A Nov 2026 report says they were dropped for some purchases but still apply to withdrawing earnings. Check before you rely on it.", HEX.accent5],
  ], 2, 1.35, 1.65, { size: 12 });
  s.addNotes("Fragment, Cointelegraph, DexTools, The Block, GNcrypto, Kod.ru (unofficial).");

  s = content("What sold, and what makes a name valuable", K());
  table(s, [["Item", "Price", "When"],
    ["@auto (first username sold)", "900,000 TON (~$1.4M)", "Nov 2022"],
    ["@news", "~$1.7M at the time", "Nov 2022"],
    ["+888 8 888 (number)", "300,000 TON (>$730K)", "Dec 2022"],
    ["@danbao (reported record)", "~$2M", "Feb 2026 (single source)"]], 0.5, 1.4, 4.8, [2.2, 1.6, 1.0], { rowH: 0.5, size: 11 });
  card(s, 5.5, 1.4, 4.0, 3.2, "What buyers pay for", "Short: 4–5 letters\nReal words: news, auto, bank, game\nBrand-safe words, not company names\nWords valuable in big markets (English, Chinese, Russian)\nA name people would type to find a channel", { tcol: C.accent2 });
  quote(s, "Never register or sell a name that copies a trademark or pretends to be a brand. That's how names get taken and sellers get sued.", 4.75);
  s.addNotes("Total Fragment username sales: over $350M (The Block, undated).");

  // ---- MORE ----
  section(19, "More income in crypto, no trading", "Smaller streams that stack: referral fees, airdrops, bug bounties, jobs, launch services, ambassador programs and a paid community.");

  s = content("More ways to earn", K());
  table(s, [["Stream", "How it pays", "Watch out for"],
    ["Airdrops", "Free tokens for using a project early. Income when you control them (US: Rev. Rul. 2019-24).", "Running many wallets breaks the rules and gets filtered: Starknet cut ~27K wallets"],
    ["Bug bounties (Immunefi)", "~$7.3M paid in Q1 2026 across 1,268 reports. Records: $10M (Wormhole), $6M (Aurora).", "Stay in scope. Exploiting first and negotiating after can be charged as theft"],
    ["Community manager", "Web3.career average ~$80K ($40K–$180K); CryptoJobsList mean ~$69K.", "Thin job postings in 2026"],
    ["Launch services", "Websites, art, video, bots, moderation for developers.", "Get a contract. Tokens as pay are income"],
    ["Ambassador programs", "Tokens or points for promotion and community work.", "Same disclosure rules as paid posts"],
    ["Paid group", "Telegram Stars subscriptions, or Whop for a paid Discord.", "Paid signals can be regulated advice in the UK and EU"]], 0.5, 1.3, 9, [1.9, 4.2, 2.9], { rowH: 0.56, size: 10.5 });
  s.addNotes("Immunefi via Solana Compass and KuCoin; Web3.career; CryptoJobsList; airdropalert.");

  s = content("Stack them: one person, five streams", K());
  steps(s, [
    ["Content", "Daily X breakdowns build the audience. X pays a little."],
    ["Calls", "The Telegram channel turns the audience into followers who act."],
    ["Referrals", "Bot links earn a share of your followers' trading fees."],
    ["Paid tier", "Your best research in a paid group or Stars subscription."],
    ["Launches and deals", "Your network brings launch work, disclosed paid posts and allocations."],
  ], 1.45, 3.1);
  quote(s, "Each stream feeds the next. And none of them need you to win a trade.", 4.7);
  s.addNotes("The income stack.");

  // ================= PART E =================
  section(20, "The rules: law, tax and safety", "What gets people sued, fined or charged, in one place. Not legal advice: rules differ by country and change often. Talk to a lawyer and an accountant where you live.");

  s = content("The law, in one table", K());
  table(s, [["Where", "Rule", "In plain words"],
    ["US · FTC", "Endorsement Guides (2023)", "Disclose any payment, free product or free tokens clearly. '#ad' or '#sponsored', not '#sp'."],
    ["US · SEC", "Securities Act §17(b)", "If a token is a security, being paid to promote it without saying so is illegal."],
    ["US · courts", "Wire fraud; US v. Constantinescu", "Buy, hype, then sell while misleading followers can be charged as fraud (reinstated Oct 2025)."],
    ["EU · MiCA", "Articles 7 and 91", "Marketing must be clearly marked. Promoting a coin you hold, without saying so, is manipulation."],
    ["UK · FCA", "s.21 FSMA, FG24/1", "Unlawful crypto promotions are a crime: up to 2 years in prison and/or an unlimited fine."],
    ["Everywhere", "Fraud law", "Rug pulls and fake promises are fraud, whatever the token is called."]], 0.5, 1.3, 9, [1.5, 2.4, 5.1], { rowH: 0.56, size: 11 });
  s.addNotes("FTC, SEC, Fifth Circuit, ESMA, Taylor Wessing, DL News.");

  s = content("The PRNTR code", K());
  grid(s, [
    ["Disclose everything", "Paid posts, free tokens, your holdings, your plan to sell.", HEX.accent2],
    ["Never sell into your own call", "Buy before your followers only if you say so, and never dump on them.", HEX.accent2],
    ["Never rug", "No secret bundles, no pulled pools, no fake roadmaps.", HEX.accent2],
    ["No coordinated pumps", "Leave any chat that organises buying and selling together.", HEX.accent2],
    ["Protect your followers", "Safety-check what you share. Say when something is a long shot.", HEX.accent2],
    ["Keep records", "Every call, payment and trade. You'll need them for tax and trust.", HEX.accent2],
  ], 3, 1.35, 1.75, { size: 12 });
  s.addNotes("The rules every PRNTR student follows.");

  s = content("Tax basics (US example)", K());
  bullets(s, [
    "Selling a coin for more than you paid is a capital gain. Under a year held = taxed like income.",
    "Airdrops, creator fees, referral fees, X payouts and tokens received for promotion are ordinary income at their value when you receive them.",
    "X issues a 1099-NEC to US creators. Platforms and exchanges may report too.",
    "Fragment sales are taxable. So are Stars and channel ad revenue when withdrawn.",
    "Keep a sheet: date, coin, amount, dollar value, why you received it. A crypto tax app helps.",
    "Other countries differ. Ask an accountant where you live.",
  ], 0.5, 1.4, 9, 3.7, 14);
  s.addNotes("IRS Rev. Rul. 2019-24 for airdrops.");

  s = content("Safety: keep what you make", K());
  grid(s, [
    ["Three wallets", "Vault (savings, never connected), trading (bots and buys), burner (new sites, mints, launches).", HEX.accent1],
    ["Bots get access", "Copy bots and trading bots hold keys. Only keep what you'd be OK losing in them.", HEX.accent4],
    ["Phishing", "Fake Fragment, fake 'claim your Gram', fake airdrops, fake support DMs. Type addresses yourself.", HEX.accent5],
    ["Hacked accounts", "Celebrity and caller accounts get hacked to post fake coins. Check before you buy.", HEX.accent5],
  ], 2, 1.35, 1.65, { size: 12.5 });
  s.addNotes("From PRNTR Memecoins lesson 1.");

  section(21, "Your 90-day plan", "Pick one trading path and one income path. Run them side by side for 90 days, review weekly, and keep what works.");

  s = content("Days 1–30: set up and study", K());
  table(s, [["Week", "Trading (the Crossover)", "Income (pick one path)"],
    ["1", "Three wallets. FOMO, DEX Screener, Odin/Maestro set up. Read Part A.", "Choose: caller, developer, X creator, network, usernames"],
    ["2", "One case study a day. Draw the Box on 5 big stocks, weekly and daily.", "Set up the channel / X account / launch wallet / Fragment wallet"],
    ["3", "Build the event calendar and search lists. Find 10 OGs.", "First 7 posts or 1 test launch or 3 names listed"],
    ["4", "Buy small in 5 clean OGs. Find 3 ladder traders on FOMO.", "Post receipts. Ask for nothing yet."]], 0.5, 1.35, 9, [0.8, 4.3, 3.9], { rowH: 0.7, size: 11.5 });
  s.addNotes("Month one.");

  s = content("Days 31–90: run it and review", K());
  table(s, [["Month", "Trading", "Income"],
    ["2", "Copy 2–3 wallets at 1–2% each. Trade one Crossover with the full plan. Log every trade.", "Daily content. Add referral links. One collaboration with another caller or developer."],
    ["3", "Drop wallets that stopped working. Move profit into the money loop. Write up each case.", "Open a paid tier or take your first disclosed deal. Apply for X rewards once eligible."]], 0.5, 1.35, 9, [0.9, 4.05, 4.05], { rowH: [0.4, 1.0, 1.0], size: 12 });
  quote(s, "Every Sunday: what made money, what lost money, what you'll stop. Bring the sheet to your 1-on-1 call.", 4.0);
  s.addNotes("Months two and three.");

  s = content("The 12 rules", "Summary");
  const rules = [
    "Read the stock's weekly and daily Box first", "Name the pair type before you trade",
    "Sell type-3 coins before the event", "Run the safety check every time",
    "Buy the OG, months early, a few dollars", "Your share = money in ÷ market cap",
    "Half off at 3x, always", "1–2% risk per trade, no exceptions",
    "Let the stock trade pay for the coin", "Copy ladder traders, never scattered ones",
    "Disclose every paid post and free token", "Never sell into your own call",
  ];
  rules.forEach((r, i) => {
    const col = i % 2, row = Math.floor(i / 2), x = 0.5 + col * 4.6, y = 1.3 + row * 0.6;
    s.addShape(pres.shapes.OVAL, { x, y, w: 0.42, h: 0.42, fill: { color: C.accent1 }, line: { color: C.accent1 } });
    s.addText(String(i + 1), { isTextBox: true, x, y, w: 0.42, h: 0.42, fontSize: 13, bold: true, align: "center", valign: "middle", color: C.text1, margin: 0 });
    s.addText(r, { isTextBox: true, x: x + 0.6, y: y - 0.02, w: 3.85, h: 0.46, fontSize: 13, color: C.background1, margin: 0, valign: "middle" });
  });
  s.addNotes("Screenshot this.");

  s = content("Glossary", "Words used in this book");
  table(s, [["Word", "Meaning"],
    ["The Box", "A sideways stretch on the chart. Ceiling = highest close, floor = lowest close, middle = halfway"],
    ["Fake-Out", "A poke beyond the ceiling or floor that closes back inside"],
    ["The Return", "The close back inside the Box after a Fake-Out"],
    ["The Turn", "The lower-timeframe change of direction that gives the entry"],
    ["The trip across", "The move from one side of the Box to the other"],
    ["Launch Pad", "A Box that closes out of the side opposite its Fake-Out: the base of the big move"],
    ["OG coin", "The first coin made with a name"],
    ["Market cap", "Price × supply. Pump.fun coins have 1 billion tokens"],
    ["Graduation", "A Pump.fun coin filling its curve and moving to PumpSwap"],
    ["KOL / caller", "Someone with an audience who posts coins"],
    ["Moon bag", "The part you keep after taking your money out"]], 0.5, 1.3, 9, [1.8, 7.2], { rowH: 0.33, size: 10.5 });
  s.addNotes("Glossary.");

  s = content("Sources: stocks and coins", "Sources");
  s.addText([
    "Stock prices: Yahoo Finance daily data (charts in this book are drawn from it).",
    "NVIDIA/DeepSeek: StockInvest, Briefing.com, Bloomberg; coin: Cointelegraph, Bitget, Birdeye data via Cointelegraph.",
    "GameStop/AMC: Benzinga, StockInvest, StatMuse, Decrypt (May 13, May 14, Jun 7, Jun 18 2024), The Block, CoinDesk, CoinGecko, Reuters via Investing.com, Bloomberg via Yahoo, Hollywood Reporter, IG, Solana Tracker.",
    "Tesla/D.O.G.E.: Nairametrics, AP via ABC, Morningstar/Dow Jones, The Block, The National, Decrypt, crypto.news, CoinMarketCap, CoinGecko.",
    "Trump Media/MAGA/TRUMP: Fortune, CBS, Mediaite, Benzinga, The Block, crypto.news, CoinGecko, Cointelegraph, Decrypt, Bitcoin.com, Finance Magnates.",
    "Netflix/SQUID: CNBC, Fortune, Bloomberg, CoinDesk, Forkast, Motley Fool; 2024 copies: Cointelegraph, Benzinga.",
    "Pop Mart/LABUBU: Reuters via TradingView, Invezz, TechNode, Decrypt, BlockBeats via iTiger.",
    "America Party: BNN Bloomberg, Axios, Seeking Alpha, Coinspeaker, BingX, Solflare. NVDA AI: Bloomberg, Benzinga, Investing.com. Stargate: Reuters via iTiger, Hype Train.",
    "No-pair notes: Bitcoin.com, The Block, Decrypt, CoinGecko research, Cointelegraph, CoinDesk, CoinMarketCap Academy.",
  ].map((t, i, a) => ({ text: t, options: { bullet: true, breakLine: i < a.length - 1 } })), { isTextBox: true, x: 0.5, y: 1.3, w: 9, h: 3.85, fontSize: 10, color: C.background2, margin: 0, valign: "top", paraSpaceAfter: 3 });
  s.addNotes("Full links are in the course source notes (business_course/crossover/SOURCES.md).");

  s = content("Sources: income, platforms and law", "Sources");
  s.addText([
    "KOLs: DL News (Kolscan), iTiger (Arkham labels), MadeOnSol, CoinWire study, ChainCatcher (Bubblemaps), The Block and Cointelegraph (Pump.fun lawsuit).",
    "Bots: Axiom docs, Trojan docs; MadeOnSol and CoinCodeCap for others (unverified).",
    "Telegram: telegram.org blog (channel monetization), Telegram creator reward terms, arXiv study on pump coordination, Bloomberg Law (cabals).",
    "Pump.fun: MadeOnSol guides, Coinpaprika, Smithii, The Block (BOOST, activity), Solidus Labs, Datawallet, Solana Compass.",
    "X: TechCrunch (Aug 8 2026), NetInfluencer, Business Today, OpenTweet, Epidemic Sound, Tubefilter, X help center, Engadget.",
    "Token rounds: Yom, XYRO, Grindery docs, UnityPad.",
    "Fragment: fragment.com/about, Cointelegraph and DexTools (Gram), The Block, Forklog, Statista, GNcrypto, Kod.ru, tech.az.",
    "Law: FTC Endorsement Guides, SEC press releases 2022-183 and 2023-59, Fifth Circuit opinion 24-20143, ESMA MiCA Articles 7 and 91, Taylor Wessing, DL News, Decrypt (Frosties, CatFi), Winston & Strawn (SEC memecoin statement).",
    "Other: airdropalert, Journal of Accountancy (Rev. Rul. 2019-24), Immunefi via Solana Compass and KuCoin, Web3.career, CryptoJobsList, Ruzuku (Whop fees).",
  ].map((t, i, a) => ({ text: t, options: { bullet: true, breakLine: i < a.length - 1 } })), { isTextBox: true, x: 0.5, y: 1.3, w: 9, h: 3.85, fontSize: 10, color: C.background2, margin: 0, valign: "top", paraSpaceAfter: 3 });
  s.addNotes("Research current to Nov 14, 2026.");

  pres.addSection({ title: "Close" });
  s = pres.addSlide({ masterName: "PRNTR Cover", sectionTitle: "Close" });
  s.addText("Do it with us, live", { isTextBox: true, x: 0.5, y: 1.3, w: 9, h: 0.8, fontSize: 34, bold: true, color: C.background1, margin: 0 });
  s.addText("In the 1-on-1 mentorship we mark the Boxes, build your event calendar, find the OGs, vet the wallets, set up your copy bot, and pick and launch your income path together.",
    { isTextBox: true, x: 0.5, y: 2.25, w: 7.8, h: 1.1, fontSize: 16, color: C.background2, margin: 0, valign: "top" });
  s.addText("Bring your sheet to every call.", { isTextBox: true, x: 0.5, y: 3.6, w: 6, h: 0.5, fontSize: 18, bold: true, color: C.accent1, margin: 0 });

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})();
