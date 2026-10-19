# Launchpad

A real pump.fun launchpad. Anyone opens the page, connects Phantom, Solflare or Backpack, fills in a name, ticker,
picture and links, and launches a coin on pump.fun **from their own wallet**. The server never holds a key or any SOL.

## How a launch works

1. `api/metadata`: the picture and details go to pump.fun's IPFS upload, which returns the metadata link.
2. The browser makes a brand-new key for the coin (the mint).
3. `api/create`: PumpPortal's public "local transaction" API builds the create transaction, with the optional first
   buy, for the user's wallet.
4. The wallet signs first (wallets may add their own safety instructions), then the browser adds the mint's signature.
5. `api/send`: the signed transaction goes to Solana. The page waits for confirmation and shows the pump.fun link.

Tested end to end with a test wallet against stand-ins for pump.fun, PumpPortal and Solana. The stand-in Solana node
verifies every signature, the same check the real network makes.

## Run it

- **Inside Route:** it is already served at `/launch/` (see `route/README.md`).
- **On its own (Vercel):** import this folder as a project. `api/*.js` become functions automatically.
- **Locally:** `node dev.mjs` → http://localhost:3000.

The brand lives in `config.js`: name, tagline, colors, first-buy limits.

## Settings (server environment)

| variable | default | what |
|---|---|---|
| `RPC_URL` | Solana's public mainnet node | use a Helius or QuickNode URL for reliable sends |
| `MAX_DEV_BUY_SOL` | `5` | the largest first buy the server will build |
| `PUMPPORTAL_TRADE_LOCAL` | `https://pumpportal.fun/api/trade-local` | where launch transactions are built |
| `PUMP_IPFS_URL` | `https://pump.fun/api/ipfs` | where pictures and metadata are uploaded |

## Before you announce it

- Launch one coin yourself with a tiny first buy (0.01 SOL) and check it on pump.fun. Real pump.fun and PumpPortal
  were not reachable from where this was built.
- pump.fun sometimes blocks server uploads. If step 1 fails with "pump.fun answered 403", try again later or host the
  launchpad somewhere else.
- PumpPortal charges a small fee on the first buy; the page tells users before they sign.
