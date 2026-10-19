# Launchpad Studio

Type any idea (a narrative, a launchpad, a game, a tool, a ticker). Get a branded, working pump.fun launchpad site,
live on Vercel. Out of ideas? The Idea Maker invents them from what is launching right now.

It is the home page of the Railway server: **`/`** (also `/studio`). See `route/README.md` to deploy that.

## Launch Intel

Press **Read the market**. The Studio keeps every coin the feeds show, for good, on the Railway volume:
- **DexScreener:** newest profiles and most boosted tokens, with each one's market cap, volume, liquidity, age and links;
- **GeckoTerminal:** trending pools and brand-new pools;
- **pump.fun:** the biggest coins, the king of the hill and the latest trades (when pump.fun answers);
- **DEXTools:** hot pools and gainers, with `DEXTOOLS_API_KEY`;
- **X:** the posts about pump.fun and Solana memecoin launches with the most traction (likes, reposts, replies and
  views), plus a search for your own focus, with `TWITTERAPI_IO_KEY` (or `X_BEARER_TOKEN`).

It refreshes itself every 30 minutes. From the history it builds a playbook: themes right now and among the $1M+ coins,
kinds (meme, game, utility, launchpad), how many winners have a website / X / Telegram, name and ticker length, the
busiest launch hours, which coins are still around a day later, the biggest seen, what X is talking about, and the fixed
facts of how pump.fun launches work. Every idea and every site is written from that playbook.

## Idea Maker

Press **Find ideas** (optionally steer it: "cats", "AI agents", "sports"). It reads:
- **DexScreener:** the newest token profiles and the most boosted tokens;
- **GeckoTerminal:** trending Solana pools;
- **pump.fun:** the coins currently on its front page (when pump.fun answers);
- **DEXTools:** hot pools, with `DEXTOOLS_API_KEY`;
- **your own history:** sites you rated 👍 or 👎 (with your notes), and how your launched coins did on DexScreener.

From that, Claude invents 6 original launchpads, games and utilities, each with a ticker, a mechanic, a holder perk
and "why now". It doesn't copy what is trending. **Build this** fills the idea form. Without `ANTHROPIC_API_KEY`, a
plain idea maker still gives you ideas built from the trend list.

## Launching from the Studio

Each site has a **launch checklist** (ticker free on DexScreener, site online, X, Telegram, the game or tool built,
launched) and a **Launch this coin** button. It opens the launchpad with the name, ticker, intro and links filled in;
when the coin is live, its contract address comes back to the draft by itself and the site's Buy / Chart / Copy
buttons switch on after the next deploy. Tickers (yours and the backups) are checked on DexScreener: free, taken (with
the coin's market cap and liquidity) or used before and dead.

**Route** is in "Your sites" too. It runs on this server at `/route`, so there is no Vercel deploy for it; save its
contract address, dev buy % and links in the Studio and `/route` updates on its own.

## Games and utilities

When an idea is a game or tool, the site gets a product section. After generating, press **Make the game / tool**:
Claude writes it as one self-contained page (`play.html`), shown on the site and deployed with it. It runs sandboxed:
- no network (its Content-Security-Policy blocks every request);
- no wallet access;
- no cookies.

Any app that tries to use the network or a wallet is rejected. Holder perks are badges, cosmetics, leaderboard spots or
early access, labeled "planned". They are never payouts, airdrops or staking.

## Getting better over time

- Rate every site 👍 or 👎 and leave a note.
- After launching, add the contract address. **Refresh results** pulls each coin's volume, liquidity and price change
  from DexScreener, at most hourly.
- New ideas and new sites lean toward what you liked and what traded, and away from what you didn't.

## What you get for each idea

- **A brand:** name, emoji, colors, font, headline, intro, and a ticker with backups.
- **Domain ideas,** checked against the domain registries (RDAP): available ones get a Buy link.
- **The site:**
  - hero with the contract address and a copy button;
  - Buy on pump.fun, Chart, X and Telegram buttons;
  - lore, how it works, how to buy, tokenomics, roadmap, FAQ and socials.
- **The working launchpad on that site:** anyone launches a pump.fun coin from their own wallet (`launchpad/`).
- **A live preview** while you edit, and **one-click deploy** to Vercel.

## Settings (on the Route server)

| variable | needed for | where to get it |
|---|---|---|
| `STUDIO_PASSWORD` | turning the Studio on | pick a long password; `/studio` asks for it |
| `ANTHROPIC_API_KEY` | AI ideas, brands and copy, and the games/utilities | console.anthropic.com; without it a plain rule-based writer is used and there are no games |
| `DEXTOOLS_API_KEY` | optional: DEXTools hot pools and gainers in Launch Intel | developer.dextools.io |
| `TWITTERAPI_IO_KEY` | what X is saying, in Launch Intel and every idea | twitterapi.io → dashboard → **API key**. Pay as you go (roughly $0.15 per 1,000 posts read; the Studio reads about 3-4 searches every 30 minutes) |
| `X_BEARER_TOKEN` | the same, through X's own API instead | developer.x.com → your project → Keys and tokens → Bearer Token (search needs a paid plan). Only used when `TWITTERAPI_IO_KEY` is not set |
| `VERCEL_TOKEN` | the Deploy button | vercel.com/account/tokens |
| `VERCEL_TEAM_ID` | deploying into a Vercel team | your team's settings page |

## What stays true on every site

- **Tokenomics are facts, not copy:** 1B supply, pump.fun bonding curve, no team allocation beyond the public dev buy,
  0% tax.
- **The "Live now" roadmap** lists only what the launchpad really does.
- **No false claims.** Any sentence promising donations, charity, partners, profits, "100x" or guarantees is removed,
  whether the AI or you wrote it. The Studio says how many it removed. Real donations need a real, public wallet:
  add that yourself, honestly, if you ever do one.

## After you launch the site's coin

Open the draft in "Your sites", fill in the contract address and the dev buy %, then save and deploy again. The
Buy, Chart and Copy buttons switch on.

## Tests

`npm test` at the repo root runs the Route and Studio tests:
- the writer and the honesty filter;
- the exact Vercel payload, checked against a mock Vercel;
- domain checks;
- the trend feeds, Launch Intel, X, ticker checks, Idea Maker and mini-app sandbox rules, with mocks;
- Route as a draft, the launchpad's contract-address hand-off;
- the Studio's login → generate → edit → preview → deploy flow.
