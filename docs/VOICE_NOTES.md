# PRNTR voice notes (JJ's ManyChat trick from the HanckFX videos)

You record each note once on your phone. ManyChat sends it automatically, **1–2 minutes after** the trigger, so it
lands like you just recorded it. Your real voice, sent to everyone who hits that step.

## How to record (10 minutes for all five)

- iPhone **Voice Memos**, a quiet room, phone 15–20 cm from your mouth.
- Talk like you're answering a friend's DM. Glance at the script, then say it your way. Small "uh"s are good: they
  make it sound real. Don't read word for word.
- **15–30 seconds each.** Never mention a day, a date, a market move or anything that goes out of date.
- No names (it goes to everyone), no prices, no "you'll make money".
- Share each memo → Save to Files → upload to ManyChat. Name them `vn1_playbook`, `vn2_spots`, `vn3_apply`,
  `vn4_booked`, `vn5_missed`, `vn6_not_ready`.

## The scripts

**VN1 · after the playbook link (Comment PRINTER flow)**
> "Yo, appreciate you grabbing the playbook. Real quick: start with Part 0, it takes about an hour and it'll save you
> from the stuff that wipes most people out. And let me know: how long have you been trading? I read these myself."

**VN2 · story keyword during a launch ("SPOTS")** — only use a number that's true.
> "Hey, so I'm only taking on a few people this month 1-on-1, because I actually go through every trade with them.
> I need to know if you're serious. Tell me where you're at right now and what's been stopping you, and if it makes
> sense I'll send you the application."

**VN3 · when they say they want help / ask about the mentorship**
> "Love that. So here's how it works: you fill out a quick application, two minutes, and I read every single one
> myself. If it looks like I can help, you'll grab a time and we'll talk about your trading. Link's right below."

**VN4 · after they book (WhatsApp/IG by you or a setter, or the DM flow)**
> "Just saw you booked, I'm looking forward to it. Before we talk, watch the short video on the page you landed on,
> and have your last few trades ready, wins and losses. And reply YES so I know you're coming."

**VN5 · missed call**
> "Hey, looks like we missed each other, no stress, things come up. If you still want to go through your trading
> with me, grab a new time with the link below."

**VN6 · not ready / money is tight (downsell, no pressure)**
> "Totally get it, no pressure at all. Best thing you can do right now is go through the playbook and hop in the
> free Discord. When you're ready, the door's open, just message me."

## Where each one goes in ManyChat

| Note | Trigger | Delay | Then |
|---|---|---|---|
| VN1 | Comment PRINTER (after the playbook link message) | 1.5 min (Smart Delay) | Message 2 "how long have you been trading?" quick replies |
| VN2 | Story reply / DM keyword `SPOTS` (launch weeks) | 1–2 min | wait for their reply → AI step |
| VN3 | AI step tags `hot_lead`, or they tap "I want help" | 1 min | text message with the application link `prntru.com/apply.html?src=dm` |
| VN4 | tag `call_booked` (set by you, or send by hand) | 2 min | — |
| VN5 | tag `no_show` | 5 min | text with the booking link |
| VN6 | tag `not_a_fit` / they say money is tight | 1 min | text with the free Discord link |

In the flow builder: **+ Smart Delay** (1–2 min) → **Send Message** → **+ Audio** → upload the file. Instagram plays it
as a voice message. If your ManyChat plan doesn't show Audio for Instagram, send the same recording as a short
video message instead.

The ManyChat AI step keeps its rule: it never says it's you. The voice notes are you, recorded once.
