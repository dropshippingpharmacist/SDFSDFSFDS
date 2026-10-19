# Launchpad Studio

Type a launchpad idea. Get a branded, working pump.fun launchpad site, live on Vercel.

It runs inside the Route server at **`/studio`** (see `route/README.md` to deploy that).

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
| `ANTHROPIC_API_KEY` | AI-written brands and copy (Claude Opus 5.5) | console.anthropic.com; without it a plain rule-based writer is used |
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
- the Studio's login → generate → edit → preview → deploy flow.
