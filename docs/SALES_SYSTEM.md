# PRNTR University sales system (built 2026-11-15)

The goal: an Instagram comment becomes a call, the call becomes a student, and everyone who says no on the way gets
the next offer down. This is the GoHighLevel-style setup, run by your own bot and website instead of a $97–$497/month
CRM.

```
Reel: "Comment PRINTER"                       Instagram bio: prntru.com (homepage)
        │                                              │
ManyChat DM ──► private playbook link                  ▼
        │      (email captured → 8 emails, 21 days)   results, testimonials, "See if you're a fit"
        │                 │                            │
        └────► AI setter / you in the DMs ─────────────┤
                                                       ▼
                                          Application (apply.html, 2 minutes)
                                                       │  the bot routes it by budget
                  ┌───────────────┬───────────────┬────┴──────────┬────────────────────┐
                $5K+            $3–5K           $1–3K          under $1K or new
             1-on-1 fit       group fit       course fit       next.html:
                  └───────── book a call (Calendly) ──┘        signals $199/mo + free Discord
                              │  reminders by email + text until booked
                              ▼
                     call with you or a closer
                 won ─── lost ─── no-show
                  │       │          └─► "pick a new time" email + text
                  │       └─► day 1: signals offer, day 21: "the door's open"
                  └─► all follow-ups stop
```

On the call the closer goes down the ladder in order: **1-on-1 → group → course → signals**. Every step down happens
on the call or in the follow-ups, never on the public website.

---

## What's built and where

| Piece | Where | Status |
|---|---|---|
| Private playbook link (only sent in DMs) | `prntr_site/pb-p0g7iee5f4agg4.html` (+ `-read.html`, `.pdf`) | built, `noindex`, not linked anywhere public |
| Public "get the playbook" page | `prntr_site/guide.html`: "Comment PRINTER / DM me PRINTER" | built (old `playbook.html` and `checklist.html` forward here) |
| Homepage for the bio | `prntr_site/index.html`: video, results, testimonials, "Start your application" | live, needs the domain |
| Application + routing | `apply.html` → the bot's `POST /api/apply` | built: every application is now saved (before, none were) |
| Downsell page | `prntr_site/next.html` (signals $199/mo, free Discord, re-apply) | built; the checkout link is a decision below |
| "Call booked" tracking | `book.html` tells the bot when Calendly confirms | built; needs your Calendly link |
| Pipeline / CRM | bot: `excellentnqtct-va.onrender.com/pipeline` (web password) | built: six numbers, every applicant, stage picker, amount sold |
| Lists | `/api/leads.csv` (playbook signups), `/api/apps.csv` (applications) | built |
| Email + text follow-ups | bot: `nurture.py`, words in `nurture_copy.py` | built, in **dry run** until the senders are set up |
| New-application ping | Discord `#applications` webhook (`DISCORD_APPS_WEBHOOK`) | built, needs the webhook |
| DM flow + AI setter | ManyChat (see `docs/MANYCHAT_FLOW.md`, `docs/AI_VOICE_PRNTR.md`) | you're building it now |

### The follow-ups (all in `nurture_copy.py`, edit the words any time)

| Sequence | Who | What |
|---|---|---|
| playbook | free playbook signup | 8 emails over 21 days: security, R math, what changed for students, how the bot thinks, objections, the invite to apply |
| apply_call | applied, fits a call, not booked | email right away, text after 2 h, email day 1, text day 2, last email day 4 |
| booked | booked the call | "watch this before our call" email + text |
| apply_downsell | applied, not a fit | the signals offer (day 0 and day 2), "when you're ready" (day 7) |
| no_show | you mark no-show on /pipeline | re-book email + text |
| lost | you mark lost | signals offer the next day, "the door's open" at day 21 |
| won | you mark won | stops everything |

The rules are built in. Texts only go to people who ticked the opt-in box, between 11 am and 8 pm Eastern, and always
say "Reply STOP". Every email has a one-click unsubscribe and your postal address. Nothing is sent twice. If the bot was
down, a message more than 3 days late is skipped instead of sent.

---

## Cost compared with GHL

| | GoHighLevel | This setup |
|---|---|---|
| CRM, pipeline, forms, sequences | $97–$497 / month | $0 (your bot + site, already paid for) |
| Email | included (plus their LC Email fees) | Resend: free up to 3,000 emails/month (100 a day), then $20/month for 50,000 |
| Texts | about $0.0083 per text plus fees | Twilio: about $0.0083 per text, $1.15/month for the number, about $4 + $15 one-time A2P registration and $2–10/month for the campaign (prices change, check Twilio's page) |
| Booking | GHL calendars | Calendly free (one event type) or Standard $10/month |
| DMs + AI setter | GHL Conversation AI ($97/month add-on) | ManyChat Pro (you have it) + its AI step |

---

## Gaps found, and what fixes each

| Gap | Fix | Who |
|---|---|---|
| Applications were never saved (`formEndpoint` was empty) | now saved by the bot, shown on /pipeline | done |
| The playbook was public | private link, `noindex`, public page sends people to Instagram | done |
| The Calendly link is still the placeholder `[YOUR_CALENDLY]` | put your event link in `prntr_site/config.js` (`calendly`) | **you**: send me the link |
| No prices for the tiers | decide the 1-on-1, group and course prices (they're only said on the call) | **you** |
| No checkout for the $199/mo signals | make a Whop plan, send me the link → `signalsDownsell` (site) + `SIGNALS_URL` (bot) | **you** |
| Emails can't send yet | Resend account + verify prntru.com there (3 DNS records at Namecheap) + your postal address | **you**, I'll walk you through it |
| Texts can't send yet | Twilio account + A2P 10DLC brand + campaign (takes 1–3 weeks to approve) | **you** |
| The domain isn't live | Render → prntr-ai → Settings → Custom Domains: add `prntru.com` and `www.prntru.com`, Verify | **you**, then I switch every link |
| No call-time reminders (24 h / 1 h before) | Calendly sends its own; Standard plan adds text reminders. A Calendly webhook (Standard) would also mark "booked" even when someone books outside the site | optional |
| No payment-plan / renewal tracking | add "amount" per payment on /pipeline; Whop handles the plans | later |
| No closer yet | the call is you for now; when you add a closer, give them /pipeline access | later |
| Results disclaimers | every page with results already says "not typical, not a guarantee"; keep that on any new testimonial | keep doing |
| The private link can be forwarded | true for any link. If it starts being shared, I can make it one-time per person (the DM gives a personal link) | later, if needed |

---

## Keys go on Render, never in chat or in a repo

On Render → excellentnqtct (the bot) → Environment, add:

- **Email:** `RESEND_API_KEY`, `NURTURE_FROM` (e.g. `PRNTR <hello@prntru.com>`), `NURTURE_REPLY_TO` (your inbox), `NURTURE_ADDRESS` (a business address or PO box)
- **Texts:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` (your Twilio number)
- **Links:** `GUIDE_URL` (the private playbook link), `SIGNALS_URL` (the Whop link), later `SITE_URL=https://prntru.com`
- **Discord:** `DISCORD_APPS_WEBHOOK` (#applications), `DISCORD_LEADS_WEBHOOK` (#new-signups)
- **Go live:** `NURTURE=1`. Until then the bot only logs what it would send.

Check /pipeline after: the top line says whether the email and text senders are ready.
