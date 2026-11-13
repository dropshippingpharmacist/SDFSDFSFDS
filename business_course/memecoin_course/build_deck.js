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
  pres.title = "PRNTR Memecoin Course (draft)";
  pres.author = "PRNTR.AI";
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;

  const FOOT = { text: "PRNTR Memecoin Course · DRAFT for proofreading", options: { x: 0.5, y: 5.25, w: 6, h: 0.25, fontSize: 9, color: C.background2 } };
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
    les += 1; num = les;
    sec = title;
    pres.addSection({ title });
    const s = pres.addSlide({ masterName: "PRNTR Section", sectionTitle: sec });
    s.addText(String(num).padStart(2, "0"), { isTextBox: true, x: 0.5, y: 1.0, w: 3, h: 1.4, fontSize: 80, bold: true, color: C.accent1, margin: 0 });
    s.addText(title, { isTextBox: true, x: 0.5, y: 2.45, w: 9, h: 0.8, fontSize: 36, bold: true, fontFace: THEME.headFontFace, color: C.background1, margin: 0 });
    s.addText(sub, { isTextBox: true, x: 0.5, y: 3.3, w: 8.2, h: 0.9, fontSize: 16, color: C.background2, margin: 0, valign: "top" });
    return s;
  }
  function bigStat(s, x, y, w, num, label, col) {
    s.addText(num, { isTextBox: true, x, y, w, h: 0.9, fontSize: 44, bold: true, color: col || C.accent1, margin: 0 });
    s.addText(label, { isTextBox: true, x, y: y + 0.88, w, h: 0.6, fontSize: 12, color: C.background2, margin: 0, valign: "top" });
  }

  // ---------- COVER ----------
  pres.addSection({ title: "Start" });
  let s = pres.addSlide({ masterName: "PRNTR Cover", sectionTitle: "Start" });
  s.addText("PRNTR", { isTextBox: true, x: 0.5, y: 0.6, w: 6, h: 1.0, fontSize: 60, bold: true, charSpacing: 6, color: C.background1, margin: 0 });
  s.addText("THE MEMECOIN COURSE", { isTextBox: true, x: 0.5, y: 1.6, w: 8, h: 0.5, fontSize: 18, bold: true, charSpacing: 4, color: C.accent1, margin: 0 });
  s.addText("Front-run narratives, find the wallets that keep winning, copy them with a bot, and move the profits into a system that pays you.",
    { isTextBox: true, x: 0.5, y: 2.3, w: 7.2, h: 1.1, fontSize: 18, color: C.background2, margin: 0, valign: "top" });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: 4.15, w: 4.4, h: 0.75, rectRadius: 0.12, fill: { color: C.accent4 }, line: { color: C.accent4 } });
  s.addText("DRAFT for proofreading. Yellow \"OWNER CHECK\" tags mark anything I need you to confirm or correct.",
    { isTextBox: true, x: 0.65, y: 4.2, w: 4.1, h: 0.65, fontSize: 12, bold: true, color: C.text1, margin: 0, valign: "middle" });
  s.addImage({ data: await ic("FaRocket", HEX.accent1), x: 7.4, y: 1.0, w: 1.8, h: 1.8, transparency: 15 });
  s.addNotes("Cover. Course name, promise, and the draft notice for proofreading.");

  s = content("How this course works", "Start here");
  await iconRows(s, [
    ["FaShieldHalved", "Lessons 1–2: safety and the game", "Wallets that can't take your savings with them, and how memecoin money is really made and lost."],
    ["FaFire", "Lessons 3–5: narratives, events and attention", "Spot the theme the market is about to care about, front-run dated events, and get in before the crowd."],
    ["FaMagnifyingGlass", "Lessons 6–7: find and vet the wallet", "DEX Screener's top traders, FOMO transaction patterns, and what they hold right now."],
    ["FaRobot", "Lessons 8–12: copy, size, profit, the loop, a case study", "Copy with a bot, size small, take profit, move it into leverage, then see it all in a real trade."],
  ], 0.5, 1.45, 5.6, 0.92);
  card(s, 6.4, 1.45, 3.1, 3.55, "The promise", "Not that you'll win every coin. Most lose. You'll lose small on the losers, take real money off the winners, and move it somewhere safer every time.", { tcol: C.accent4 });
  s.addNotes("Overview of the 12 lessons. Lesson 4 is front-running events, Lesson 11 the money loop into leverage, Lesson 12 the NVIDIA × HUNG case study.");

  s = content("Read this before you start", "The honest warning");
  bigStat(s, 0.5, 1.5, 2.9, "Most", "memecoins go to zero. Some are built to steal from buyers.", C.accent5);
  bigStat(s, 3.55, 1.5, 2.9, "Never", "use money you need for rent, bills or your family.", C.accent5);
  bigStat(s, 6.6, 1.5, 2.9, "Small", "size on every single trade. That's what keeps you in the game.", C.accent2);
  s.addText("This course is education, not financial advice. Past results, including mine, don't guarantee future results.",
    { isTextBox: true, x: 0.5, y: 3.6, w: 9, h: 0.6, fontSize: 13, italic: true, color: C.background2, margin: 0 });
  s.addNotes("Risk framing before anything else. Keeps students and your name safe.");

  // ---------- 1 SECURITY ----------
  section(1, "Wallets and security", "Set up three wallets so a scam, a bad bot or a mistake can never reach the money you keep.");
  s = content("The three-wallet setup", "Lesson " + les);
  card(s, 0.5, 1.45, 2.85, 3.4, "Vault", "Your savings and profits. Hardware wallet if you can. Never connects to a site, never goes near a bot. You only send money in.", { tcol: C.accent2 });
  card(s, 3.575, 1.45, 2.85, 3.4, "Trading wallet", "For hand trades on DEXs. Holds only this week's trading money. Connects to sites, so treat it as exposed.");
  card(s, 6.65, 1.45, 2.85, 3.4, "Bot wallet", "Created inside the copy-trading bot. The bot holds its key, so only fund what you're willing to lose. Withdraw profits often.", { tcol: C.accent4 });
  s.addNotes("Why three wallets: each layer limits the damage of a drain or a bad bot.");

  s = content("Scams to spot before you buy", "Lesson " + les);
  await iconRows(s, [
    ["FaBan", "Honeypots", "You can buy but can't sell. Check that other wallets have sold successfully."],
    ["FaUnlock", "Unlocked liquidity / dev holding a lot", "The creator can pull the money or dump a big bag on you."],
    ["FaUsers", "Bundled and sniped launches", "A few wallets bought most of the supply in the first block. They're the exit."],
    ["FaLink", "Drainer links and fake airdrops", "Never sign a transaction you don't understand. Never connect your vault."],
  ], 0.5, 1.45, 9, 0.9);
  check(s, "Which scam checker do you use (e.g. a token scanner, RugCheck for Solana, a honeypot checker for EVM)? I'll add screenshots of your exact check.");

  // ---------- 2 THE GAME ----------
  section(2, "How memecoin money is made", "The life cycle of a coin, and where in it the money changes hands.");
  s = content("The life of a memecoin", "Lesson " + les);
  steps(s, [
    ["Launch", "Creator, snipers and insiders get the first supply."],
    ["Early attention", "Smart wallets and early callers buy. Volume starts rising."],
    ["The narrative spreads", "X, Telegram, trending lists. New buyers pile in. Price runs."],
    ["Peak", "Everyone is talking about it. Early buyers are selling into them."],
    ["Bleed", "Volume dries up. Late buyers hold the bag."],
  ], 1.45, 3.1);
  s.addNotes("Our money is made by buying in stage 2 and selling into stages 3 and 4.");

  s = content("Where you want to be", "Lesson " + les);
  card(s, 0.5, 1.45, 4.4, 3.4, "Buy here: stage 2", "After launch chaos settles and before the crowd arrives. Real wallets are buying, volume is rising, the narrative is just starting to spread.", { tcol: C.accent2 });
  card(s, 5.1, 1.45, 4.4, 3.4, "Sell here: stages 3–4", "Into the crowd. When your timeline is full of it and strangers are asking about it, you're selling to them, not buying from them.", { tcol: C.accent4 });
  s.addNotes("The core rule: get in before the crowd, get out into the crowd.");

  // ---------- 3 NARRATIVES ----------
  section(3, "Finding and front-running narratives", "A narrative is the story the market is about to care about. Find it early and the coins come to you.");
  s = content("What a narrative is", "Lesson " + les);
  s.addText("A theme that pulls attention, and money, to a group of coins at the same time.", { isTextBox: true, x: 0.5, y: 1.35, w: 9, h: 0.45, fontSize: 16, color: C.background2, margin: 0 });
  const nar = [["FaMicrochip", "Tech", "AI agents, new apps"], ["FaLandmark", "Politics and news", "Elections, viral headlines"], ["FaStar", "Celebrity and culture", "A post, a meme, a moment"],
               ["FaCalendarDays", "Scheduled events", "Launches, listings, big days"], ["FaPaw", "Animal and meme metas", "The next dog, cat, frog"], ["FaArrowsRotate", "New platforms", "A new launchpad or chain trend"]];
  for (let i = 0; i < nar.length; i++) {
    const col = i % 3, row = Math.floor(i / 3), x = 0.5 + col * 3.05, y = 2.0 + row * 1.5;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 2.9, h: 1.3, rectRadius: 0.12, fill: { color: C.text2 }, line: { color: C.text2 } });
    s.addImage({ data: await ic(nar[i][0], HEX.accent1), x: x + 0.2, y: y + 0.25, w: 0.4, h: 0.4 });
    s.addText([{ text: nar[i][1], options: { bold: true, color: C.background1, breakLine: true } }, { text: nar[i][2], options: { color: C.background2 } }],
      { isTextBox: true, x: x + 0.8, y: y + 0.18, w: 1.95, h: 1.0, fontSize: 13, margin: 0, valign: "top" });
  }
  check(s, "Which narratives have made you the most money? Add 2–3 real examples with dates so this slide uses your own stories.");

  s = content("Where narratives start", "Lesson " + les);
  await iconRows(s, [
    ["FaXTwitter", "X (Twitter)", "Lists of the accounts that are early to new metas. Watch what they start talking about together."],
    ["FaTelegram", "Telegram groups and callers", "Where coins get shared first. Track which callers are early, not loud."],
    ["FaChartLine", "Trending on DEX Screener and launchpads", "New themes show up as several coins with the same idea trending at once."],
    ["FaNewspaper", "The news and the calendar", "A big event coming up is a narrative you can see before it happens."],
  ], 0.5, 1.45, 9, 0.9);
  check(s, "Which X accounts, Telegram groups and tools do you watch? I'll name them, or keep them for the mentorship only if you'd rather.");

  s = content("How to front-run a narrative", "Lesson " + les);
  steps(s, [
    ["Spot the theme", "Two or three coins on the same idea start moving on the same day."],
    ["Find the leader", "The first coin with real volume and real holders is usually the one the crowd buys."],
    ["Check it fast", "Scam checks, liquidity, holders. Under two minutes."],
    ["Enter small", "Before the big accounts post about it. Size it so a zero doesn't hurt."],
    ["Sell into the crowd", "When the timeline catches on, you take profit."],
  ], 1.45, 3.1);
  s.addNotes("The playbook: be early to the theme, pick the leader, size small, sell into attention.");

  // ---------- EVENT NARRATIVES ----------
  section(0, "Front-running the calendar", "The biggest narratives are on the calendar months ahead: elections, the Super Bowl, the World Cup. Find the first coin named after the event while it's worth almost nothing.");

  s = content("Why events are easy to front-run", "Lesson " + les);
  await iconRows(s, [
    ["FaCalendarDays", "The date is public", "Everyone knows when the Super Bowl, an election or a World Cup final happens. You don't have to guess when attention arrives."],
    ["FaMagnifyingGlass", "The crowd searches the name", "On the day, new buyers type the event's name into Pump.fun or FOMO and buy what they find. Very often that's the first coin made with that name."],
    ["FaCrown", "The OG gets the attention", "In memecoins, \"the original\" is part of the story. The first coin with the name is the one people screenshot, share and pile into."],
    ["FaSeedling", "You get in before anyone cares", "Months early, the OG can sit at a few thousand dollars in market cap. A few dollars buys a real share of the supply."],
  ], 0.5, 1.45, 9, 0.9);
  s.addNotes("Events are narratives with a known date. That's the edge: you can be early on purpose.");

  s = content("How an event coin moves", "Lesson " + les);
  const tl = [["Months before", "Quiet. The OG sits at a few $K market cap. You buy small.", C.accent1],
              ["Weeks before", "Talk starts on X and Telegram. Early wallets add.", C.accent3],
              ["The day itself", "Search volume spikes. The crowd buys the name. This is where you sell.", C.accent2],
              ["After", "Attention moves on. Most event coins fade fast.", C.accent5]];
  s.addShape(pres.shapes.LINE, { x: 0.7, y: 2.2, w: 8.6, h: 0, line: { color: C.background2, width: 2 } });
  tl.forEach(([h, b, col], i) => {
    const x = 0.5 + i * 2.3;
    s.addShape(pres.shapes.OVAL, { x: x + 0.15, y: 2.0, w: 0.4, h: 0.4, fill: { color: col }, line: { color: col } });
    s.addText(h, { isTextBox: true, x, y: 2.6, w: 2.1, h: 0.4, fontSize: 15, bold: true, color: C.background1, margin: 0 });
    s.addText(b, { isTextBox: true, x, y: 3.05, w: 2.1, h: 1.5, fontSize: 13, color: C.background2, margin: 0, valign: "top" });
  });
  s.addText("You buy in the first column and sell in the third. You never need to be right about who wins the game or the election, only that people will care on the day.",
    { isTextBox: true, x: 0.5, y: 4.45, w: 9, h: 0.6, fontSize: 13, italic: true, color: C.accent4, margin: 0 });
  s.addNotes("The trade is on attention, not on the outcome of the event.");

  s = content("Events that already played out", "Lesson " + les);
  const past = [
    ["2024 US presidential election", "\"PolitiFi\" became its own narrative: coins named after candidates, nicknames and slogans ran for months before election day."],
    ["The Super Bowl (every February)", "Team names, the halftime show, the ads and viral moments all get coins, before and during the game."],
    ["FIFA World Cup 2022 and 2026", "Country names, star players, mascots and the final. Each match day brings a new wave of searches."],
    ["Paris Olympics 2024", "Athletes and viral moments became coins within minutes, and early holders sold into the attention."],
    ["Bitcoin halving, April 2024", "A dated crypto event. Halving-themed coins moved in the weeks before it."],
    ["Holidays: Halloween, Thanksgiving, Christmas, New Year", "The same idea every year. The calendar never changes."],
  ];
  past.forEach(([h, b], i) => {
    const col = i % 2, row = Math.floor(i / 2), x = 0.5 + col * 4.6, y = 1.4 + row * 1.2;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 4.4, h: 1.05, rectRadius: 0.1, fill: { color: C.text2 }, line: { color: C.text2 } });
    s.addText([{ text: h, options: { bold: true, color: C.accent1, breakLine: true } }, { text: b, options: { color: C.background1 } }],
      { isTextBox: true, x: x + 0.15, y: y + 0.08, w: 4.1, h: 0.92, fontSize: 12, margin: 0, valign: "top" });
  });
  check(s, "Add the real coins you or the traders you follow caught for each event: the name, the market cap when bought and at the peak, with screenshots. I've kept this slide free of numbers I can't verify.");

  s = content("The calendar ahead", "Lesson " + les);
  const ahead = [
    ["Nov 2026", "GTA VI release (check date)"], ["Dec 2026", "Christmas, New Year"],
    ["Feb 2027", "Super Bowl LXI, Grammys"], ["Mar 2027", "The Oscars"],
    ["Jun–Jul 2027", "FIFA Women's World Cup, Brazil"], ["Oct–Nov 2027", "Cricket and Rugby World Cups"],
    ["2028", "Bitcoin halving (around April)"], ["Jul 2028", "Los Angeles Olympics"],
    ["Nov 2028", "US presidential election"], ["Every year", "Halloween, Thanksgiving, big product launches"],
  ];
  ahead.forEach(([d, e], i) => {
    const col = i % 2, row = Math.floor(i / 2), x = 0.5 + col * 4.6, y = 1.35 + row * 0.72;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 1.35, h: 0.52, rectRadius: 0.1, fill: { color: C.accent1 }, line: { color: C.accent1 } });
    s.addText(d, { isTextBox: true, x, y, w: 1.35, h: 0.52, fontSize: 12, bold: true, align: "center", valign: "middle", color: C.text1, margin: 0 });
    s.addText(e, { isTextBox: true, x: x + 1.5, y, w: 2.9, h: 0.52, fontSize: 13, color: C.background1, margin: 0, valign: "middle" });
  });
  check(s, "Dates are from today (November 2026); confirm each before teaching it. Add any events you're already watching.");

  s = content("Build your search list for each event", "Lesson " + les);
  card(s, 0.5, 1.4, 4.4, 3.5, "Write down every name people will type", "The event: SUPERBOWL, WORLDCUP\nThe short form: SB61, WC2027\nThe teams, countries, players, candidates\nThe mascot, the slogan, the meme of the moment\nThe nickname the internet uses, not the official one");
  card(s, 5.1, 1.4, 4.4, 3.5, "Keep it in one sheet", "One row per event: date, search names, the OG coin you found, its contract address, market cap when you bought, your supply %, and the week you plan to sell.\n\nReview it every Sunday. New names appear as the event gets closer.", { tcol: C.accent2 });
  s.addNotes("The list is the work. The more names you check, the more OGs you find before the crowd.");

  s = content("Searching an event on Pump.fun and FOMO", "Lesson " + les);
  steps(s, [
    ["Search the name", "Type each name from your list into Pump.fun's search, then into FOMO."],
    ["Sort by oldest", "Look for the earliest-created coin with that exact name or ticker."],
    ["Open the first one", "Check when it was created, who created it and who holds it."],
    ["Confirm on-chain", "Paste the contract into a Solana explorer and check the creation time matches."],
    ["Buy small", "A few dollars. Note the market cap and your % of supply in your sheet."],
  ], 1.45, 3.1);
  check(s, "Confirm the exact search and sort steps in Pump.fun and FOMO as they work today, and record this lesson on screen so students see each click.");

  s = content("Is it really the OG?", "Lesson " + les);
  card(s, 0.5, 1.4, 4.4, 3.5, "Signs it's the original", "Created before every other coin with that name\nThe name and ticker match the event exactly\nThe creator doesn't hold a big share of supply\nIt wasn't bought up by a few wallets in the first seconds\nOther holders are spread out, not one whale", { tcol: C.accent2 });
  card(s, 5.1, 1.4, 4.4, 3.5, "Signs to walk away", "A later copy with more holders is clearly the one people chose\nThe creator sold early or holds most of the supply\nBundled launch: a few wallets took most of it at once\nThe name is close but not the one people will search\nIt can't be sold (check others have sold)", { tcol: C.accent5 });
  s.addNotes("Copycats will appear with the same name. That's normal. You want the first one that's clean.");

  s = content("The math: your share of the supply", "Lesson " + les);
  bigStat(s, 0.5, 1.4, 4.2, "$15 at $3K", "market cap buys 0.5% of the supply. Your share = what you put in ÷ the market cap.", C.accent1);
  const rowsM = [["If the coin reaches", "0.5% is worth"], ["$100K", "$500"], ["$500K", "$2,500"], ["$1M", "$5,000"], ["$2M", "$10,000"], ["$3M", "$15,000"]];
  s.addTable(rowsM.map((r, i) => r.map((t) => ({ text: t, options: { bold: i === 0, color: i === 0 ? C.text1 : C.background1, fill: { color: i === 0 ? C.accent1 : C.text2 }, fontSize: 14, align: "center", valign: "middle" } }))),
    { x: 5.2, y: 1.4, w: 4.3, colW: [2.15, 2.15], rowH: 0.48, border: { type: "solid", pt: 1, color: HEX.dk1 } });
  s.addText("To turn $10–15 into $10,000–15,000, the coin has to reach about $2M–$3M. At $500K, 0.5% is worth $2,500. Fees and slippage reduce these a little.",
    { isTextBox: true, x: 0.5, y: 3.0, w: 4.3, h: 1.6, fontSize: 13, color: C.background2, margin: 0, valign: "top" });
  s.addNotes("Use this slide so students understand supply %. The example numbers are for teaching; most event coins never reach these levels.");

  s = content("Rinse and repeat: the event portfolio", "Lesson " + les);
  bigStat(s, 0.5, 1.4, 2.9, "20 events", "a few dollars on the OG of each", C.accent1);
  bigStat(s, 3.55, 1.4, 2.9, "19 zeros", "That's normal. Each one only cost a few dollars.", C.accent5);
  bigStat(s, 6.6, 1.4, 2.9, "1 hit", "can pay for all of them many times over", C.accent2);
  bullets(s, [
    "Same small amount on every event coin, never more because you \"feel sure\"",
    "Set a reminder for the week of the event: sell into the attention, before the day ends",
    "Take your starting money out as soon as it multiplies, let a small part ride",
    "Profits go into the money loop (Lesson 11), never back into one big bet",
  ], 0.5, 3.15, 9, 1.9, 14);
  s.addNotes("This is a numbers game. It works because the losers are tiny and the winners are big.");

  s = content("Find traders who already do this", "Lesson " + les);
  await iconRows(s, [
    ["FaUserSecret", "Look at who holds the OGs", "Open the event coins you found. Wallets that bought months early and hold a real share are often event front-runners."],
    ["FaClockRotateLeft", "Check their past events", "Did they hold last year's Super Bowl or election coins early, and sell into the day? That's the pattern you want."],
    ["FaEye", "Watch what they hold now", "Their current low-market-cap holdings show you the next events they're positioned for (Lesson 7)."],
    ["FaRobot", "Copy them", "Add the best ones to your copy bot (Lesson 8), sized small, so you're in when they buy the next OG."],
  ], 0.5, 1.45, 9, 0.9);
  s.addNotes("You don't have to find every event yourself. Find the people who already do it well.");

  s = content("What goes wrong with event coins", "Lesson " + les);
  card(s, 0.5, 1.4, 2.85, 3.5, "Crowd picks another", "A later copy, a celebrity's coin or an \"official\" one can take all the attention. The OG isn't guaranteed to win.", { tcol: C.accent5 });
  card(s, 3.575, 1.4, 2.85, 3.5, "It dies before the day", "Months is a long time. Many event coins lose their community long before the event.", { tcol: C.accent5 });
  card(s, 6.65, 1.4, 2.85, 3.5, "You can't get out", "Tiny coins have little liquidity. Selling a big share can crash the price. Sell in pieces, early.", { tcol: C.accent5 });
  s.addNotes("Set expectations honestly so students size small.");

  // ---------- 4 ATTENTION ----------
  section(4, "Reading attention", "Hype leaves fingerprints in the numbers. Learn to tell real momentum from a fake pump.");
  s = content("Real momentum vs a fake pump", "Lesson " + les);
  card(s, 0.5, 1.45, 4.4, 3.4, "Real momentum", "Holders growing steadily\nVolume rising with price\nMany different wallets buying\nMentions growing from different accounts\nBuys and sells both healthy", { tcol: C.accent2 });
  card(s, 5.1, 1.45, 4.4, 3.4, "Fake pump", "A few wallets doing most of the volume\nHolders flat while price jumps\nSame-block buys at launch (bundles)\nThe same accounts posting it over and over\nDev or top wallets holding a big share", { tcol: C.accent5 });
  check(s, "Your exact numbers: what volume, holder count or market cap range do you look for before entering?");

  s = content("When to skip: \"I'm too late\"", "Lesson " + les);
  bullets(s, [
    "The big accounts have already posted it and the price has already run several times",
    "Volume is falling while price is still near the top",
    "The early wallets you'd copy are already selling",
    "You can't explain why the next buyer would pay more than you",
    "You feel you have to get in now. That feeling is the signal to wait.",
  ], 0.5, 1.5, 6.0, 3.5, 15);
  s.addImage({ data: await ic("FaHourglassEnd", HEX.accent5), x: 7.3, y: 2.0, w: 1.6, h: 1.6 });
  s.addNotes("Most of the losses in memecoins come from buying late. Skipping is a skill.");

  // ---------- 5 FINDING WALLETS ----------
  section(5, "Finding the trader's wallet", "Use a coin they already won on to find their wallet on DEX Screener.");
  s = content("Find the wallet behind a winning trade", "Lesson " + les);
  steps(s, [
    ["Pick a coin that ran", "One that already went up a lot, or the coin a trader you follow is in."],
    ["Open it on DEX Screener", "Search the coin, open its pair page."],
    ["Open \"Top Traders\"", "It lists wallets ranked by profit on that coin: what they bought, sold and made."],
    ["Pick the early winners", "Wallets that bought early and sold well, not the ones that only bought."],
    ["Copy the address", "Click the wallet and copy it. Now check it (Lesson 7)."],
  ], 1.45, 3.1);
  check(s, "Confirm the exact steps and tab names as you do them today, and record this lesson as a screen recording so students see each click.");

  s = content("Finding a specific trader you want to copy", "Lesson " + les);
  card(s, 0.5, 1.45, 4.4, 3.4, "When you know their coin", "They post or call a coin, or you know what they're in. Open that coin's Top Traders and look for a wallet whose buy matches their timing and size. Confirm it on a second coin they're in.");
  card(s, 5.1, 1.45, 4.4, 3.4, "When you only know the winner", "Look across two or three coins from the same narrative. A wallet that shows up early and in profit on all of them is a trader, not luck.", { tcol: C.accent2 });
  check(s, "Is this how you match a trader to their wallet? Add any trick you use (timing, buy size, the same wallet across coins).");

  // ---------- 6 VETTING ----------
  section(6, "Checking a wallet before you copy it", "One lucky trade proves nothing. Here's how to tell skill from luck, insiders and bots.");
  s = content("The wallet checklist", "Lesson " + les);
  await iconRows(s, [
    ["FaListCheck", "A real track record", "Dozens of trades, not one or two. Profitable across many coins over weeks."],
    ["FaClock", "Buys early, but not insider-early", "Buying in the very first block or seconds of launch often means sniper, insider or dev."],
    ["FaHandHoldingDollar", "Sells well, not only buys well", "Takes profit on the way up instead of riding coins back to zero."],
    ["FaScaleBalanced", "Sizes it can copy", "Trade sizes you can follow without moving the price yourself."],
  ], 0.5, 1.45, 5.6, 0.92);
  card(s, 6.4, 1.45, 3.1, 3.55, "Use a wallet tracker", "Paste the address into a wallet-tracking site to see its full history: win rate, profit, hold time and recent trades.", { tcol: C.accent4 });
  check(s, "Which wallet tracker do you use to check history? Your minimum numbers (win rate, number of trades, profit) go on this slide.");

  s = content("Read their transaction pattern on FOMO", "Lesson " + les);
  function pattern(x, y, seq, good) {
    seq.forEach((t, i) => {
      const xx = x + i * 0.42, isB = t === "B";
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: xx, y, w: 0.36, h: 0.36, rectRadius: 0.06, fill: { color: isB ? C.accent2 : C.accent5 }, line: { color: isB ? C.accent2 : C.accent5 } });
      s.addText(t, { isTextBox: true, x: xx, y, w: 0.36, h: 0.36, fontSize: 12, bold: true, align: "center", valign: "middle", color: C.text1, margin: 0 });
    });
  }
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: 1.4, w: 9, h: 1.65, rectRadius: 0.12, fill: { color: C.text2 }, line: { color: C.accent2, width: 1.5 } });
  s.addText("Consistent: copy this", { isTextBox: true, x: 0.7, y: 1.5, w: 5, h: 0.35, fontSize: 15, bold: true, color: C.accent2, margin: 0 });
  pattern(0.7, 1.95, ["B", "S", "S", "S", "S", "S", "B", "S", "S", "S", "S", "B", "S", "S", "S", "S", "S", "S"], true);
  s.addText("One buy, then several sells, again and again. They enter once and take profit in pieces: a plan they repeat.",
    { isTextBox: true, x: 0.7, y: 2.4, w: 8.6, h: 0.55, fontSize: 13, color: C.background1, margin: 0 });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: 3.25, w: 9, h: 1.65, rectRadius: 0.12, fill: { color: C.text2 }, line: { color: C.accent5, width: 1.5 } });
  s.addText("Scattered: skip this", { isTextBox: true, x: 0.7, y: 3.35, w: 5, h: 0.35, fontSize: 15, bold: true, color: C.accent5, margin: 0 });
  pattern(0.7, 3.8, ["B", "S", "B", "B", "B", "B", "B", "S", "S", "B", "S", "B", "B", "S", "B", "B", "S", "B"], false);
  s.addText("Random buys and sells: one in, one out, five in, two out. No repeatable plan, even if the profit looks good right now.",
    { isTextBox: true, x: 0.7, y: 4.25, w: 8.6, h: 0.55, fontSize: 13, color: C.background1, margin: 0 });
  check(s, "Confirm how FOMO shows a trader's transactions today (where the buy/sell list is), and add a screenshot of a real consistent trader and a scattered one.");

  s = content("Check what they're holding right now", "Lesson " + les);
  steps(s, [
    ["Open their holdings", "On FOMO or a wallet tracker, see every coin they hold now."],
    ["Low market cap?", "Coins still small, so there's room to grow."],
    ["Big share of supply?", "They hold a real % of it, so they're committed."],
    ["Does the narrative fit?", "An upcoming event or the current meta. It should make sense in one sentence."],
    ["All four: buy small", "Same small size as always, and add it to your sheet."],
  ], 1.45, 3.1);
  s.addNotes("A consistent trader's current low-cap holdings are a shortlist made for you. Every box still has to be ticked.");

  s = content("Red flags: drop the wallet", "Lesson " + les);
  bullets(s, [
    "Most of its profit came from one coin",
    "Buys in the same block as the launch, every time (sniper or insider)",
    "Trades in a group: the same coins at the same second as other wallets (a bundle or cabal)",
    "Huge win rate on tiny trades, losses on big ones",
    "Dormant for weeks, then suddenly active",
    "Holds coins to zero instead of selling",
  ], 0.5, 1.5, 6.2, 3.5, 15);
  s.addImage({ data: await ic("FaTriangleExclamation", HEX.accent5), x: 7.3, y: 2.0, w: 1.6, h: 1.6 });
  s.addNotes("If a wallet fails any of these, don't copy it.");

  s = content("When to stop following a wallet", "Lesson " + les);
  steps(s, [
    ["Track it", "Keep a sheet: every wallet you copy, the trades and the result."],
    ["Review weekly", "Is it still profitable over its last 20 trades?"],
    ["Cut losers", "Three bad weeks in a row, or a big change in style: remove it."],
    ["Replace it", "Find a new wallet from this week's best narrative."],
  ], 1.45, 3.1);
  s.addNotes("Wallets go cold. Traders change. Your list needs maintenance.");

  // ---------- 7 COPY TRADING ----------
  section(7, "Copy trading with a bot", "Put the wallet into a copy-trading bot so you buy when they buy, within seconds.");
  s = content("Setting up the copy bot", "Lesson " + les);
  steps(s, [
    ["Open the bot", "A Telegram trading bot such as Maestro or Odin."],
    ["Make a bot wallet", "Create a new wallet in the bot. Never import your vault."],
    ["Fund it small", "Only what you're willing to lose."],
    ["Add the target", "Paste the wallet address you vetted into copy trading."],
    ["Set your rules", "Amount per trade, slippage, priority fee, sells (next slide)."],
  ], 1.45, 3.1);
  check(s, "Please confirm: which bot do you use (Maestro, Odin, or another), the exact menu names, and record this lesson on screen. I could not verify Odin's menus myself.");

  s = content("The settings that matter", "Lesson " + les);
  await iconRows(s, [
    ["FaCoins", "Fixed amount per copy", "The same small amount on every trade, whatever the wallet buys. You're copying the idea, not their size."],
    ["FaGaugeHigh", "Slippage and priority fee", "High enough to get filled fast, low enough that you don't overpay on every trade."],
    ["FaArrowRightFromBracket", "Copy sells, or your own exits", "Either sell when they sell, or use your own take-profit ladder (Lesson 10)."],
    ["FaShield", "Protection settings", "Anti-rug or MEV protection, a max buy price, a blacklist of coins you won't touch."],
  ], 0.5, 1.45, 9, 0.9);
  check(s, "Your exact numbers: amount per trade, slippage %, priority fee, and whether you copy sells or use your own ladder.");

  s = content("Copy trading: what goes wrong", "Lesson " + les);
  card(s, 0.5, 1.45, 2.85, 3.4, "You're last in", "Even fast bots buy after the wallet does. On tiny coins that gap can be the whole move.", { tcol: C.accent5 });
  card(s, 3.575, 1.45, 2.85, 3.4, "They exit, you don't", "If you don't copy sells or use a ladder, you can hold after they've left.", { tcol: C.accent5 });
  card(s, 6.65, 1.45, 2.85, 3.4, "The bot holds your key", "A bot is a hot wallet. Keep its balance small and withdraw profits to your vault often.", { tcol: C.accent5 });
  s.addNotes("Set expectations: copy trading has real costs and risks, so the rules matter.");

  // ---------- 8 SIZING ----------
  section(8, "Sizing", "Small, fixed bets are what let you survive the coins that go to zero.");
  s = content("The sizing rules", "Lesson " + les);
  bigStat(s, 0.5, 1.5, 2.9, "1–2%", "of your memecoin money per copy trade", C.accent1);
  bigStat(s, 3.55, 1.5, 2.9, "Max 10", "open positions at once", C.accent1);
  bigStat(s, 6.6, 1.5, 2.9, "Stop", "for the day after a set loss", C.accent5);
  s.addText("Your memecoin money is itself only a slice of what you have. The vault never funds it.", { isTextBox: true, x: 0.5, y: 3.7, w: 9, h: 0.6, fontSize: 14, italic: true, color: C.background2, margin: 0 });
  check(s, "These numbers are my suggestion. Replace with your real rules: % per trade, max positions, daily stop.");

  // ---------- 9 PROFIT ----------
  section(9, "Taking profit on the way up", "The money is made when you sell, not when the chart goes up.");
  s = content("A take-profit ladder", "Lesson " + les);
  const lad = [["2x", "Take your starting money out. The rest is free."], ["3x", "Sell another part."], ["5x", "Sell another part."], ["10x+", "Leave a small part running."]];
  for (let i = 0; i < lad.length; i++) {
    const x = 0.5 + i * 2.3, h = 1.2 + i * 0.6, y = 4.75 - h;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 2.1, h, rectRadius: 0.1, fill: { color: i === 0 ? C.accent2 : C.text2 }, line: { color: i === 0 ? C.accent2 : C.text2 } });
    s.addText(lad[i][0], { isTextBox: true, x: x + 0.15, y: y + 0.12, w: 1.8, h: 0.55, fontSize: 24, bold: true, color: i === 0 ? C.text1 : C.accent1, margin: 0 });
    s.addText(lad[i][1], { isTextBox: true, x: x + 0.15, y: y + 0.68, w: 1.8, h: h - 0.75, fontSize: 12, color: i === 0 ? C.text1 : C.background1, margin: 0, valign: "top" });
  }
  check(s, "Your real ladder: at which multiples you sell and how much each time.");

  s = content("The profit rules", "Lesson " + les);
  await iconRows(s, [
    ["FaSackDollar", "Initials out at 2x", "Once your starting money is back, nothing on that trade can hurt you."],
    ["FaCalendarCheck", "A time limit", "If a coin does nothing for a set time, sell and move on."],
    ["FaBrain", "No \"it's going to 100x\"", "The plan is made before you buy. You follow it."],
    ["FaVault", "Profits leave the bot", "Move profits to the vault or the next step of the loop, every week."],
  ], 0.5, 1.45, 9, 0.9);
  s.addNotes("Most memecoin traders give their gains back. These rules stop that.");

  // ---------- 10 LOOP ----------
  section(10, "The money loop", "How memecoin profits turn into leverage trading, a safe stack, and a monthly income.");
  s = content("Where the profit goes", "Lesson " + les);
  const boxes = [["Memecoins", "Copy trading, small size", 0.7, 1.55, C.accent1], ["Leverage", "The PRNTR system, fixed risk", 6.3, 1.55, C.accent3], ["Safe stack", "Profits you keep and pay yourself from", 3.5, 3.55, C.accent2]];
  for (const [t, b, x, y, col] of boxes) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 3.0, h: 1.2, rectRadius: 0.14, fill: { color: C.text2 }, line: { color: col, width: 2 } });
    s.addText([{ text: t, options: { bold: true, fontSize: 18, color: C.background1, breakLine: true } }, { text: b, options: { fontSize: 12, color: C.background2 } }],
      { isTextBox: true, x: x + 0.2, y: y + 0.15, w: 2.6, h: 0.95, margin: 0, align: "center", valign: "middle" });
  }
  s.addShape(pres.shapes.LINE, { x: 3.75, y: 2.15, w: 2.5, h: 0, line: { color: C.accent1, width: 2, endArrowType: "triangle" } });
  s.addText("take profit, fund the account", { isTextBox: true, x: 3.75, y: 1.75, w: 2.5, h: 0.35, fontSize: 11, color: C.background2, align: "center", margin: 0 });
  s.addShape(pres.shapes.LINE, { x: 6.8, y: 2.8, w: 0.8, h: 0.75, flipH: true, line: { color: C.accent1, width: 2, endArrowType: "triangle" } });
  s.addText("pay yourself", { isTextBox: true, x: 7.5, y: 3.0, w: 1.6, h: 0.35, fontSize: 11, color: C.background2, margin: 0 });
  s.addShape(pres.shapes.LINE, { x: 2.2, y: 2.8, w: 1.3, h: 0.75, flipH: true, flipV: true, line: { color: C.accent1, width: 2, endArrowType: "triangle" } });
  s.addText("a small slice back in", { isTextBox: true, x: 0.6, y: 3.0, w: 1.7, h: 0.35, fontSize: 11, color: C.background2, margin: 0 });
  s.addNotes("The loop: money moves from the riskiest place to safer ones every time. Nothing goes back in to win back a loss.");

  s = content("A split you can start with", "Lesson " + les);
  bigStat(s, 0.5, 1.5, 2.9, "50%", "of memecoin profit to the safe stack", C.accent2);
  bigStat(s, 3.55, 1.5, 2.9, "30%", "to the leverage account", C.accent3);
  bigStat(s, 6.6, 1.5, 2.9, "20%", "stays for memecoins", C.accent1);
  bullets(s, ["Move funds to an exchange, never from the vault to a bot", "Pay yourself a fixed amount each month from the safe stack", "Never move money back in to win back a loss"], 0.5, 3.55, 9, 1.4, 14);
  check(s, "Is this close to your real split? Also how you bridge between chains and exchanges, step by step, for the screen recording.");

  // ---------- CASE STUDY: THE PRNTR CROSSOVER ----------
  const CS = "/home/user/SDFSDFSFDS/business_course/case_nvda_hung/";
  section(11, "Case study: NVIDIA × HUNG", "The PRNTR Crossover: read a big stock's chart, then trade the memecoin wave its news creates.");

  function side(s, x, w, items, size) {
    s.addText(items.map(([h, b], i) => [
      { text: h, options: { bold: true, color: C.background1, breakLine: true } },
      { text: b, options: { color: C.background2, breakLine: i < items.length - 1, paraSpaceAfter: 8 } },
    ]).flat(), { isTextBox: true, x, y: 1.35, w, h: 3.8, fontSize: size || 12, margin: 0, valign: "top" });
  }

  s = content("The chart turned before the news", "Lesson " + les);
  s.addImage({ path: CS + "1_NVDA_PRNTR_box.png", x: 0.5, y: 1.35, w: 5.8, h: 3.74 });
  side(s, 6.55, 2.95, [
    ["The Box", "NVIDIA ranged between ~$168 and ~$212 for a year. Middle ~$190."],
    ["Two Fake-Outs", "Above the ceiling in May and on Oct 6 ($243). Breakout buyers got trapped."],
    ["The Return and the Turn", "Back inside by Oct 30. Nov 5 closed at $181.60, below the middle."],
    ["Then the news", "The email to staff went public on Nov 8, three days after the Turn."],
  ]);
  s.addNotes("The point: the chart showed the buyers had stopped defending NVIDIA before anyone knew why. Never say we 'knew' about the scandal.");

  s = content("Zoom in: the 1-hour Turn", "Lesson " + les);
  s.addImage({ path: CS + "4_NVDA_1h_turn_and_coins.png", x: 0.5, y: 1.35, w: 6.45, h: 3.62 });
  side(s, 7.15, 2.35, [
    ["Small Box", "Floor $201.32, ceiling $210.28, two Fake-Outs above it on Nov 3 and Nov 4."],
    ["Sell $200.63", "Nov 4, 20:00 UTC: the first hour closes below the small floor."],
    ["Stop $207.30", "Just above the last failed bounce. Highest price after entry: $202.25."],
    ["Target $168, +4.9R", "The big Box floor. Hit Nov 10, 16:00 UTC."],
  ], 11);
  s.addNotes("Hand-marked with the PRNTR rules on the 24/7 NVIDIA perpetual. It's a chart study, not a signal the bot sent. Example only: $1,000 at 5x would have been about +$813 at the target, or about -$166 at the stop. Notice the coin panel: when you'd have sold NVIDIA, no scandal coin existed yet.");

  s = content("The coin, on the same clock", "Lesson " + les);
  s.addImage({ path: CS + "2_NVDA_vs_HUNG.png", x: 0.5, y: 1.35, w: 5.8, h: 3.72 });
  side(s, 6.55, 2.95, [
    ["Nov 9", "HUNG starts trading around $44K, then fades."],
    ["Nov 10–11", "Quiet at ~$9.7K for two days. Most people gave up."],
    ["Nov 11, evening UTC", "Resignation news: ~$9.7K to ~$1M in about two hours."],
    ["Nov 12", "Peak ~$1.29M. Now ~$193K."],
  ]);
  s.addNotes("$10 at ~$9.7K is about 0.1% of supply, about $1,330 at the peak. Selling at $600K–$800K turns it into about $600–$800. Nobody sells the top.");

  s = content("Could we have seen the news coming?", "Lesson " + les);
  s.addImage({ path: CS + "3_timeline_news_vs_coins.png", x: 0.5, y: 1.35, w: 5.9, h: 3.72 });
  side(s, 6.6, 2.9, [
    ["Oct 29", "The NYT reports a 'close relationship' with a Megaspeed executive. An 'Alice Huang' coin appears the same day."],
    ["Nov 7", "The FT reports an intelligence memo. 'The NVIDIA Files' coin is made at ~$3.7K."],
    ["Nov 8 → Nov 12", "The email, more reports, the resignation."],
    ["The lesson", "The story leaked in pieces for two weeks. Each piece was a chance to be early."],
  ], 11);
  s.addNotes("Use 'reported' for everything beyond his own email. The spy part is an allegation.");

  s = content("Catching the coins earlier", "Lesson " + les);
  steps(s, [
    ["Watch the Turns", "Keep a list of big names. When one makes its Turn, watch its news daily."],
    ["Alert on the names", "Google Alerts and an X list: the CEO, nicknames, people and companies in the story."],
    ["Search the same hour", "Every new name goes straight into Pump.fun and FOMO. Sort by oldest, check it's the OG."],
    ["Buy in the quiet", "The cheapest entry is between headlines, when the coin has gone quiet."],
    ["Sell the 2nd headline", "HUNG moved on the resignation, not the first story. Sell into that attention."],
  ], 1.45, 3.5);
  s.addNotes("This is the PRNTR Crossover playbook in five steps.");

  s = content("The honest scorecard", "Lesson " + les);
  card(s, 0.5, 1.4, 2.85, 3.5, "Worked", "The 1-hour Turn sold at $200.63, well before the news. HUNG went ~100x off its quiet price on the second headline.", { tcol: C.accent2 });
  card(s, 3.575, 1.4, 2.85, 3.5, "Didn't", "The Oct 29 'Alice Huang' coin died. 'The NVIDIA Files' only went from ~$3.7K to ~$17K. The first 'HUNG' from June went nowhere.", { tcol: C.accent5 });
  card(s, 6.65, 1.4, 2.85, 3.5, "So", "First isn't always the winner. Spread a few dollars across the story's coins, and size up only on the one getting real volume and holders.", { tcol: C.accent4 });
  s.addNotes("Keep it honest: one big winner, several small losers. That's the game.");

  // ---------- CLOSE ----------
  pres.addSection({ title: "Close" });
  sec = "Close";
  s = content("The 10 rules", "Summary");
  const rules = ["Three wallets. The vault never touches a bot.", "Scam-check every coin before you buy.", "Get in before the crowd, sell into it.", "Pick the narrative's leader, not the copies.",
                 "Copy wallets with a long record, not one big win.", "Drop insider, sniper and bundled wallets.", "Fixed small size on every copy.", "Initials out at 2x, then a ladder.",
                 "Profits leave the bot every week.", "Nothing goes back in to win back a loss."];
  rules.forEach((r, i) => {
    const col = i < 5 ? 0 : 1, row = i % 5, x = 0.5 + col * 4.6, y = 1.45 + row * 0.7;
    s.addShape(pres.shapes.OVAL, { x, y, w: 0.42, h: 0.42, fill: { color: C.accent1 }, line: { color: C.accent1 } });
    s.addText(String(i + 1), { isTextBox: true, x, y, w: 0.42, h: 0.42, fontSize: 13, bold: true, align: "center", valign: "middle", color: C.text1, margin: 0 });
    s.addText(r, { isTextBox: true, x: x + 0.6, y: y - 0.02, w: 3.85, h: 0.48, fontSize: 13, color: C.background1, margin: 0, valign: "middle" });
  });
  s.addNotes("One-slide summary for students to screenshot.");

  s = pres.addSlide({ masterName: "PRNTR Cover", sectionTitle: "Close" });
  s.addText("Want help doing this live?", { isTextBox: true, x: 0.5, y: 1.3, w: 9, h: 0.8, fontSize: 34, bold: true, color: C.background1, margin: 0 });
  s.addText("In the 1-on-1 mentorship we find narratives, vet wallets and set up your copy bot together, then connect it to the leverage system and the money loop.",
    { isTextBox: true, x: 0.5, y: 2.25, w: 7.5, h: 1.0, fontSize: 16, color: C.background2, margin: 0, valign: "top" });
  s.addText("prntr-ai.onrender.com/apply.html", { isTextBox: true, x: 0.5, y: 3.6, w: 6, h: 0.5, fontSize: 18, bold: true, color: C.accent1, margin: 0 });
  s.addNotes("Close with the mentorship call to action. Update the link when the domain is connected.");

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})();
