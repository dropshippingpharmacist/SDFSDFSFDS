# PRNTR Signals on Whop — setup hand-off

For a Claude session with a Whop company API key stored as a network secret for `api.whop.com`
(`Authorization: Bearer …`). Current API: `https://api.whop.com/api/v1` (OpenAPI: `/api/v1/openapi.json`).
Docs: https://docs.whop.com/api-reference/products/create-product · https://docs.whop.com/api-reference/plans/create-plan

## 1. Product
- Name: **PRNTR Signals**
- Headline: Grade A trade signals, the moment they confirm.
- Description:
  Every Grade A signal from the PRNTR system, sent to a private Telegram channel the moment it confirms: the market,
  long or short, the entry, the stop, the target, the reward to risk and a clean chart. Crypto, stocks, forex, metals
  and oil. Every signal, win or loss, is posted on the public track record at https://prntr-ai.onrender.com.
  Education only, not financial advice. Trading with leverage can lose more than you expect.
- Use an `external_identifier` (e.g. `prntr-signals`) so re-running updates instead of duplicating.
- Language rule: PRNTR words only. Never TCT / taps / BOS / deviation / Wyckoff / order blocks / liquidity / Moneytaur.

## 2. Plans (owner-set prices, 2026-11-13)
| Plan | Price | Billing |
|---|---|---|
| Day pass | $9.99 | 1 day (renewal every 1 day, or one-time 1-day access) |
| Weekly | $35 | renews every 7 days |
| Monthly (most popular) | $125 | renews every 30 days |
| 3 months | $300 | renews every 90 days |
| Lifetime | $500 | one-time, lifetime access |

## 3. After creating
1. Put each plan's checkout link into `prntr_site/config.js` → `PRNTR.signals.{day,week,month,quarter,lifetime}`
   (branch `claude/peaceful-cerf-vohjyb`); the site's plan buttons switch from "checkout opens soon" to live.
2. Owner, in the Whop dashboard: add the **Telegram** app to the product and connect the private channel
   (Whop adds/removes members). Add the signal bot as an **admin** of that channel.
3. Owner or Claude: set `PRNTR_SIGNALS_CHAT_ID` (the channel id, e.g. `-100…`) on the Render service
   `excellentnqtct-va` (srv-dbchiafb9u1s73bgavog). The bot (`prntr_signals.py`) then posts every Grade A signal there.
4. Mentorship students get the signals free: add them to the channel by hand or give them a free Whop plan.

## Done 2026-11-13 (via the API)
Product **PRNTR Signals** `prod_aYHeN67sVN6Yl` (route `prntr-signals`, visible) on business PRNTR.ai `biz_HITwUZyiBn2jOo`.
The old archived "PRNTR AI Trading Signals Group" (`prod_CmxVMi4efkkzf`, 3 members) was left untouched.

| Plan | Id | Checkout |
|---|---|---|
| 1 Day Pass $9.99 (one-time, 1 day access) | plan_M1i7PpdNlNRhe | https://whop.com/checkout/plan_M1i7PpdNlNRhe |
| Weekly $35 | plan_LLii730Boa2we | https://whop.com/checkout/plan_LLii730Boa2we |
| Monthly $125 | plan_5P6kMVbpLNckw | https://whop.com/checkout/plan_5P6kMVbpLNckw |
| 3 Months $300 | plan_8LlB6MUwp5JD1 | https://whop.com/checkout/plan_8LlB6MUwp5JD1 |
| Lifetime $500 (one-time) | plan_soJuhgMrHfa3e | https://whop.com/checkout/plan_soJuhgMrHfa3e |

The links are live in `prntr_site/config.js`. Still to do in the Whop dashboard: Telegram app + channel, bot as admin.

## 1-on-1 Mentorship (created 2026-11-13, HIDDEN — sold only on the call)
Product **PRNTR 1-on-1 Mentorship (90 days)** `prod_hj7tEFYpRMh59` (route `prntr-mentorship`, hidden: not on the store
page, reachable only by link). Per the blueprint (section 6): apply → qualify → book → call → send ONE of these links on
the call and stay on while they pay.

| Option | Id | Checkout (send on the call) |
|---|---|---|
| Pay in full $3,000 (90 days of access) | plan_eG9fhO1rRc5aa | https://whop.com/checkout/plan_eG9fhO1rRc5aa |
| 2 × $1,700 (monthly, stops after 2) | plan_s0iYqzF5Mn44Q | https://whop.com/checkout/plan_s0iYqzF5Mn44Q |
| 3 × $1,200 (monthly, stops after 3) | plan_jhLxs4R4ydWIY | https://whop.com/checkout/plan_jhLxs4R4ydWIY |

Owner, in the Whop dashboard: add the **Discord** app to this product too (same "Signals Member" role, plus a
"Mentorship" role if wanted) so students get the signals channels free; set the 14-day refund policy.
