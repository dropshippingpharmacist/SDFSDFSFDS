# Route

See where your friends are headed. Cross paths on purpose.

One server runs all four parts:

| path | what |
|---|---|
| `/` (and `/studio`) | **Launchpad Studio**, yours only behind `STUDIO_PASSWORD`: the Idea Maker, then an idea in and a branded launchpad site (with an optional game or utility) out, deployed to Vercel. See `studio/README.md` |
| `/route` | the $ROUTE coin site: hero, contract address + copy, Buy / Chart / X, lore, how it works, the game, how to buy, tokenomics, roadmap, safety, FAQ, socials |
| `/app` | the Route app: accounts, mutual friends, "I'm heading to…", "I'm around here", crossing paths, pull-ups, ghost mode, blocking, and the link-up game |
| `/launch/` | the launchpad: anyone launches a real pump.fun coin from their own wallet |

## The app's rules

- **Friends only.** Two people see each other only after *both* add each other. A block hides both ways, and to the blocked person you look like "no such user".
- **An area, never a doorstep.** Every place is rounded to about 1 km *before* it is stored.
- **Everything expires.** A route lasts at most 12 hours, an "I'm around here" pin at most 6.
- **Ghost mode** hides all your shares in one tap.
- **Crossing paths:** a friend heading within 3 km of where you're going (or where you are), at an overlapping time.
- **Pull-ups:** at most 3 to the same friend an hour.

## The game: link-ups

A pull-up the friend says "I'm down" to, then *both* tap "We linked up":

- **10 points each.** Only one link-up per friend counts each day.
- **+25 "Reconnected"** for the first link-up ever with that friend.
- **Weekly streaks**, and badges: First Route, Pulled Up, Linked, Social Butterfly (5 friends), Regular (4-week streak).
- **A leaderboard** of you and your friends.

Points are in-app only. They are not tokens and pay nothing; holding $ROUTE earns nothing in the app.

## Deploy on Railway

1. New project → **Deploy from GitHub repo** → this repo. The `railway.json` at the repo root sets everything (Node 22, `npm start`).
2. **Attach a volume** mounted at `/data`. Accounts and friendships live there, so without it every redeploy wipes them.
3. **Settings → Networking → Generate Domain**, or add your own domain.
4. Optional variables:
   - `RPC_URL` (a free Helius RPC URL) makes the launchpad's sends more reliable than Solana's public node;
   - `NOMINATIM_URL` points place search somewhere other than OpenStreetMap's public server;
   - the Studio's own settings (`STUDIO_PASSWORD`, `ANTHROPIC_API_KEY`, `VERCEL_TOKEN`, `DEXTOOLS_API_KEY`…) are listed
     in `studio/README.md`.

After you launch the coin, put its contract address in `route/public/route-config.js` (`ca`, `devBuyPercent`, `x`,
`telegram`) and push. The Buy, Chart and Copy buttons switch on.

## Domain ideas

Check availability on Vercel, Namecheap or Porkbun:

- `routewith.me`
- `getroute.app`
- `route.lol`
- `pullup.lol`
- `crosspaths.app`
- `routeup.xyz`

## Tickers

Search pump.fun **before** launching: `ROUTE` is likely taken. Good backups: `ROUTED`, `PULLUP`, `LINKUP`, `REROUTE`.

## Tests

```
npm test                      # the app's rules over HTTP: friends, rounding, expiry, ghost, blocks, crossings, the game
```

The browser runs, two users through the whole flow and a launch with a test wallet, were done during development.
Re-run them with Playwright if you change the pages.

## Notes before real users

- OpenStreetMap's public map tiles and place search are fine for a launch and small numbers of users. Past a few
  hundred daily users, switch to a paid tile and geocoding provider: their usage policy asks heavy users to.
- The launchpad's PumpPortal API charges its own small fee on the first buy; the launch page says so before anyone signs.
- Route is for people who know each other. Keep it that way: no public profiles, no "people near you".
