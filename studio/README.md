# Launchpad Studio

Type any idea (a narrative, a launchpad, a game, a tool, a ticker). Get a branded, working pump.fun launchpad site,
live on Vercel. Out of ideas? The Idea Maker invents them from what is launching right now.

It is the home page of the Railway server: **`/`** (also `/studio`). See `route/README.md` to deploy that.

## Launch Intel

Press **Read the market**. The Studio keeps every coin the feeds show, for good, on the Railway volume:
- **DexScreener:** newest profiles and most boosted tokens, with each one's market cap, volume, liquidity, age and links;
- **GeckoTerminal:** trending pools and brand-new pools;
- **pump.fun, live:** every new coin and every graduation the moment it happens, from PumpPortal's public stream (no
  key), with each coin's own description and links read from its metadata; the header pill shows the count. pump.fun's
  web API is also tried with browser headers, and GeckoTerminal's index of pump.fun and PumpSwap pools is the fallback,
  so pump.fun is never missing;
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

## The site is the product; the token is launched wherever you launch

Every site is the coin's home: contract address with a copy button, Buy / Chart / X / Telegram, the game or tool or
three-in-one, lore, how it works, how to buy, tokenomics, roadmap, FAQ, socials. The pump.fun launch desk (launching a
coin from the page itself) is **off by default**; the "Show the pump.fun launch desk" box in the editor turns it on for
a site that really is a public launchpad. Launch the token wherever you launch it, paste the contract address into the
draft, save, deploy.

**Holder perks are real.** When a site has a contract address and a holder perk, the product section gets a "Connect
wallet" button: the page reads the wallet's balance of the coin on-chain and tells the game or tool, which unlocks the
perk (a skin, a badge, a mode). The app itself never touches a wallet. Set `PUBLIC_RPC_URL` on the server to give
deployed sites a better RPC than Solana's public one for that check (a key meant for the browser, or none).

**Every site looks like its own.** Five structurally different layouts (classic, poster, split, terminal, magazine)
are chosen per brand, and right after a site is written Claude designs its own stylesheet (backgrounds, shapes,
motion, section treatments) and an original SVG mascot used in the hero, the floating scene and the launch pictures.
**Restyle** asks for a new look. Everything is checked: no scripts, no outside resources, nothing covering the page.

**The look.** Every site gets a living scene behind the hero (the brand's emoji and sparks drifting in depth, steered by
the pointer or the phone's tilt), sections that rise in as you scroll, cards that tilt, a sheen on the contract
address, and a **vibe** chosen per site: arcade, neon, candy, retro or clean. Everything respects "reduce motion".

## Three-in-one, games people already know, a polish pass

- The Idea Maker has a kind selector: any mix, games, utilities, launchpads, or **three-in-one** (a game, a utility and
  a launchpad fused on one page: the game unlocks a featured slot, the tool builds the launch kit, Play / Tools / Launch
  tabs with one mascot and shared progress).
- Ideas and builds lean on the loops the whole world knows (slingshot physics, endless runners, match-3, one-tap,
  2048, daily puzzles, idle clickers, lane defense…) with your own mascot and name, never a real game's title or art.
- **Every game is built in three passes:** a game design document first (modes, levels, upgrades, achievements, a daily
  challenge, meta-unlocks, the holder perk), then the build from that document, then an automatic polish pass.
- **The game builds itself.** A site that is a game, a tool or a three-in-one starts building it the moment the site is
  written (two or three minutes, in the background); the preview on the right shows it when it lands, and "Open it
  full screen" plays it in its own tab. Anyone can play on the deployed site, free, no wallet. **Make the game / tool**
  rebuilds it; **Polish it** is a second pass where Claude play-tests it in its head, fixes bugs and adds what is missing.

## The content kit: pictures, three videos, the posts, how to post

**Make the content kit** on any site gives you, in one go:
- the X **profile picture** (400×400), the X **banner** (1500×500) and the coin's **launch picture** (1000×1000);
- three **videos** for X (1080×1080 MP4, H.264 with a soft built-in backing track): an intro (~20 s), "the product"
  (~15 s) and "why now" (~15 s);
- the X **display name, bio, pinned post** and the first reply with the contract address, **four posts** in order with
  the day and the media for each, and a step-by-step **how to post**.

Claude writes the plan (scripts as scene lists, the posts) and designs every picture and video as a page in the
brand's colors and font; a built-in template stands in for anything that fails a check. The posts pass the same
honesty filter as the sites. The server renders the pages with a headless Chromium and ffmpeg: `nixpacks.toml` adds
both to the Railway build. Without them the kit still has every page as HTML (open, screenshot or screen-record).
Files live on the volume under `content/<site id>/` and are served to you only.

## The docs: a GitBook for every launch

**Write the docs** has Claude write an in-depth book from the site (13-15 pages: welcome, the story, getting started,
the product in depth, how to play / use it, holder perks, community and events, the coin, tokenomics with "where the
money goes", launch plan, roadmap, safety, FAQ, glossary, official links). No contract address until you add one; X is
always called X. It ships with the site at `/docs.html` (sidebar, pages, the site's colors). **Download for GitBook (.zip)** gives
the GitBook-ready pages (README.md, SUMMARY.md, one file per page) to import by hand.

**It publishes itself.** With `GITBOOK_TOKEN` set, the first **Deploy to Vercel** writes the book (if you have not
yet), creates the GitBook space and docs site, publishes it in the coin's colors with its emoji, and puts the link on
the site: a **GitBook** button in the hero, the nav and the socials, specific to the coin (`…gitbook.io/<brand>-docs`).
**Publish to GitBook** does the same by hand, and again after edits (the same space and site are reused).

**Publish to GitBook** uses `GITBOOK_TOKEN` (gitbook.com → account → Developer settings → personal
access token; `GITBOOK_ORG_ID` optional when you have several organizations): it creates the space, imports the pages
and creates the docs site, then tells you the `*.gitbook.io` link, or exactly which step to finish in GitBook when the
plan does not allow it from the API. The pages are fetched by GitBook from an unguessable link on this server.

Tokenomics on every site now include **where the money goes**: the creator-fee split (product / marketing / community
& holder perks / team, tuned to the kind) and the dev-buy policy. Claude proposes it; edit the percentages in the
Studio (they must add up to 100).

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
