# Coin launch page

One file, `index.html`. Fill in six fields at the top, drop your picture next to it, deploy it free on Vercel.
From a 🟢 NO COIN YET card in the viral feed to a live page in about five minutes.

## 1. The idea (from a viral-feed card)

Paste the card into ChatGPT (or Claude) with this prompt:

```
Here is a viral X post and its numbers. Write the launch page fields for a memecoin about it:
- name: short and funny, built from what people are actually calling it
- ticker: 3-10 capital letters, easy to type, not an everyday word
- tagline: one line, under 70 characters
- story: two short paragraphs. Say what happened and why people love it. Do not claim the poster,
  the owner, or any brand is involved. Do not promise utility, donations, or profits.
Give it to me as a JavaScript object with the keys name, ticker, tagline, story (an array of paragraphs).

<paste the card here>
```

Before you use the ticker, search pump.fun for it **and** for the post's main words. The card's check
only covers the name it suggested.

## 2. Fill in the page

Open `index.html` and edit the block at the top:

| field | what to put |
|---|---|
| `example` | `false` (removes the "Example coin" badge) |
| `name`, `ticker`, `tagline`, `story` | from step 1 |
| `image` | `coin.png` (put the file next to `index.html`), or an `https://` image link |
| `ca` | leave empty until you launch, then paste the contract address |
| `x` | your coin's X account, e.g. `https://x.com/yourcoin` |
| `post`, `postBy` | the viral post's link and its author, so the page credits them |

With `ca` empty the page says "Appears here at launch" and the buy and chart buttons wait. Paste the address
after you launch on pump.fun and redeploy (30 seconds): the copy button, the pump.fun link and the DexScreener
chart all switch on.

## 3. Put it online (free)

1. Make a free account at vercel.com.
2. **Add New → Project → Deploy without Git** (or drag the folder onto vercel.com/new), and upload this folder.
3. You get a link like `yourcoin.vercel.app` in under a minute. A custom domain is optional (about $10–20 a year).

To change anything later, edit the file and upload it again.

## Rules this page keeps

- It says what the coin is: a memecoin about a moment, with no team, roadmap or utility.
- It credits the original post and says the poster is not involved.
- No fake charity, no fake "working app", no made-up numbers.

That keeps buyers' trust, and it keeps the page from being reported as a scam.
