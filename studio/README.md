# Launchpad Studio

Type any idea (a narrative, a launchpad, a game, a tool, a ticker). Get a branded, working pump.fun launchpad site,
live on Vercel. Out of ideas? The Idea Maker invents them from what is launching right now.

It is the home page of the Railway server: **`/`** (also `/studio`). See `route/README.md` to deploy that.

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
| `DEXTOOLS_API_KEY` | optional: DEXTools hot pools in the Idea Maker | developer.dextools.io |
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
- the trend feeds, Idea Maker and mini-app sandbox rules, with mocks;
- the Studio's login → generate → edit → preview → deploy flow.
