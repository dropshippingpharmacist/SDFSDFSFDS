// playbook.mjs — what actually works as a product on a memecoin site, so the Idea Maker and the app builder aim high.
// Games, utilities and launchpads that people on Solana genuinely use and share, each with WHY it works, and the ways to
// fuse all three into one page (the "combo" kind). Launch Intel brings the live data; this brings the craft.
export const GAMES = [
  ["Tap / clicker with upgrades", "Idle games are the most-played genre on phones; a themed clicker with upgrades, prestige and an offline-earnings screen keeps people opening the tab for weeks."],
  ["Endless runner / flappy", "One-touch, 20-second rounds, instant retry. Perfect for a shared high score and a 'beat my score' post on X."],
  ["Daily puzzle (Wordle-style)", "One puzzle a day, same for everyone, a share grid of emoji. Built-in reason to come back every day and to post."],
  ["Candle / chart games", "Guess the next candle, dodge the red wicks, climb the chart: the native joke of the audience; make it skill, never money."],
  ["Tower defense / survivors", "Waves, upgrades, a build that gets silly strong; 5-10 minute sessions with a clear 'one more run'."],
  ["Reaction & rhythm", "Whack-a-mole, timing bars, rhythm taps: tiny, juicy, leaderboard-ready; great for mascots."],
  ["Battle / arena with simple AI", "Pick a fighter (the mascot's variants), fight a ladder; unlocks and skins are the perk layer."],
  ["Collect & evolve (tamagotchi)", "A pet that grows with care and mini-games; evolution stages give something to show off."],
  ["Trivia / quiz with streaks", "Crypto-culture trivia, timed, streak multipliers; cheap to make big and share."],
  ["Physics toys (stack, slingshot, golf)", "Satisfying physics on touch; stacking the mascot, launching it, hole-in-one style scoring."],
];
// the games the whole world already knows how to play: borrow the LOOP, with an original mascot and name, never the
// title, characters or art (those are someone's trademark; the mechanic is not)
export const CLASSICS = [
  ["Angry Birds", "Slingshot physics, destructible stacks, 3-star scoring per level; 'one more try' comes from seeing exactly how close you got."],
  ["Temple Run / Subway Surfers", "Auto-run with swipe to turn/jump/slide, speed ramps, coins and power-ups; sessions of 1-2 minutes, a distance high score to beat."],
  ["Candy Crush", "Match-3 with limited moves, cascades, boosters and a level map; the satisfying chain reactions do the selling."],
  ["Flappy Bird", "One tap, brutal difficulty, instant restart; scores of 7 are funny, scores of 40 are bragging rights."],
  ["2048", "Slide tiles to merge; simple rule, deep decisions, nothing to learn; themed tiles (mascot evolutions) make it yours."],
  ["Crossy Road", "Hop across lanes of traffic, endless, collectible characters as the unlock loop; perfect for a mascot family."],
  ["Wordle", "One short puzzle a day, same for everyone, a spoiler-free emoji share grid; the share IS the marketing."],
  ["Fruit Ninja", "Swipe to slice what flies up, combos, bombs; fast, tactile, arcade mode with a 60-second timer."],
  ["Doodle Jump", "Tilt/slide to bounce ever higher on platforms, hazards and springs; endless vertical climb = chart joke built in."],
  ["Cookie Clicker", "Tap, buy producers, numbers go up, prestige resets; the idle loop that keeps a tab open for weeks."],
  ["Snake / Slither", "Grow by eating, die by touching; a tiny rule set with a strong 'just one more'."],
  ["Tetris", "Falling blocks, lines clear, speed rises; the universally known skill game, great with a daily seed."],
  ["Plants vs. Zombies", "Lane defense: place units on a grid, waves come, resources trickle in; mascots as units."],
  ["Agar.io", "Grow by absorbing smaller things, avoid bigger ones; 'bigger eats smaller' is the market joke, make it offline vs AI blobs."],
  ["Geometry Dash", "One-tap rhythm platformer, memorize the level, music-synced; shareable level clears."],
  ["Among Us (social deduction)", "Rounds of tasks and accusations; offline version against bots with a 'who is the rug' theme (keep it a game)."],
  ["Pou / Tamagotchi", "Feed, wash, play mini-games, watch it grow; a pet that holders check on daily."],
  ["Brick Breaker / Breakout", "Bounce a ball to clear bricks, power-ups, levels; works with one finger."],
];
export const UTILITIES = [
  ["Ticker & name generator with preview card", "Everyone launching needs one; the preview card (name, ticker, emoji, colors) is instantly screenshot-able."],
  ["Launch checklist & timer", "Picture, ticker, socials, dev buy, hour: a checklist with a countdown to the chosen launch window."],
  ["Dev-buy calculator", "SOL in -> % of supply and the starting market cap on a pump.fun curve; the question every launcher asks."],
  ["Bonding-curve explainer / simulator", "Slide the SOL raised, see price and market cap; teaches the curve without a wallet."],
  ["PnL / flex card maker", "Entry, exit, multiplier -> a branded card to post. Pure sharing engine (no live prices needed)."],
  ["Meme / banner maker", "Mascot stickers, captions, templates for X headers and Telegram banners in the coin's style."],
  ["CA formatter & safety reminders", "Pastes an address, shows it chunked, shows the pump.fun / DexScreener / Solscan links, reminds what to check."],
  ["Narrative tracker (manual)", "A board where the holder community votes on which narrative is hot today; purely social, no data feeds needed."],
  ["Launch-hour planner", "Pick your time zone, see the busiest Solana hours in your local time, set the launch moment."],
  ["Holder badge card", "Type a name, get a badge/ID card in the coin's style; the cosmetic holder perk, made visual."],
];
export const LAUNCHPADS = [
  ["Themed launchpad", "One theme (cats, AI agents, a city, a sport) with a matching look; launchers want to be where their crowd is."],
  ["Launch-of-the-day competition", "Launches entered into a daily bracket; holders vote; the winner is pinned. Social proof + a reason to return daily."],
  ["Template launchpad", "Prebuilt name/ticker/picture kits for a theme; a launch in 60 seconds for people who have an idea but no assets."],
  ["Seasonal / event launchpad", "Tied to a moment (a game season, a tournament, a holiday); urgency with an end date."],
  ["Mascot-family launchpad", "Every coin launched here is a member of the same mascot family; the family tree is the content."],
];
export const COMBOS = [
  ["Play to earn a slot", "Beat a score in the game to unlock a featured slot on the launchpad for your coin (a slot, never money)."],
  ["Tool feeds the launch", "The utility builds the launch kit (name, ticker, card); one button hands the fields to the launch form on the same page."],
  ["Game as the launch ritual", "Launching = running a mini-game whose result sets the coin's badge or color; every launch has a story."],
  ["Three tabs, one mascot", "Play / Tools / Launch tabs on one page, one shared character and progression; the holder perk unlocks across all three."],
  ["Season pass", "A season with weekly game challenges, tool unlocks and launch weeks; the roadmap IS the season calendar."],
];
export const QUALITY = [
  "Phone first: thumb-size controls, no horizontal scroll, works in a 390px-wide iframe; mouse and keyboard on desktop.",
  "Juice: screen shake, particles, squash-and-stretch, sound toggles (WebAudio, default off), score pops. It should FEEL good in the first 3 seconds.",
  "Progression: a high score, unlocks or levels saved in localStorage (try/catch), a visible 'next goal'.",
  "Shareability: a 'copy my result' text and a drawn share card (canvas) in the coin's colors with the ticker on it.",
  "A 'how to play' in one line on the first screen; no tutorial walls.",
  "Nothing fake: no live prices, no wallet, no holder checks; the holder perk is labeled '(planned)'.",
  "Clean, bug-free code: requestAnimationFrame loops, resize handling, pause when the tab is hidden, no memory leaks.",
];

const list = (title, rows) => `${title}:\n` + rows.map(([n, why]) => `- ${n}: ${why}`).join("\n");
export function productPlaybookText() {
  return [list("Games that work on memecoin sites", GAMES), list("Mainstream games everyone already knows (borrow the loop, not the brand)", CLASSICS),
          list("Utilities people actually use", UTILITIES),
          list("Launchpad formats", LAUNCHPADS), list("Three-in-one (game + utility + launchpad) ways to fuse them", COMBOS)].join("\n\n");
}
export function qualityText() { return "Quality bar:\n- " + QUALITY.join("\n- "); }
