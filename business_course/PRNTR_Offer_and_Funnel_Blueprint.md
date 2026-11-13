# PRNTR.AI: the offer and the funnel, end to end

Built from the scaling videos you gave me (about 25 videos, 113,000 words). Where a choice is mine rather than his, it says so. His numbers are his own claims.

---

## 1. The offers

There are only two things for sale to the public, plus one thing only students can buy.

| | What | Price | Who gets it |
|---|---|---|---|
| **Main offer** | 1-on-1 Mentorship, 90 days | **$5,000** pay in full, or **2 × $3,000**, or **3 × $2,200** | Pitched on every call |
| **Downsell** | The PRNTR Method course + 60 days of signals | **$997**, or **2 × $600** | Only people who can't afford or don't want 1-on-1 |
| **Student-only** | Signals after the mentorship ends | **$149 / month**, or a **limited lifetime seat at $2,500** (max 25) | Offered in week 10–12 |

### Why these prices (his rules)

- **Start with 1-on-1.** He says it's the easiest to sell at the start and gives the best results and testimonials. Under $10K/month you sell it yourself.
- **$4K–$6K is the normal range** for a first trading mentorship. $5,000 sits in the middle.
- **Payment plans always cost more than paying in full**, and more the more it's split, so paying in full looks best.
- **Pay-in-full clearance:** anyone on a plan can pay off the rest at the pay-in-full price within 30 days. Example: paid $3,000, clears with $2,000 instead of another $3,000. He says this lifts cash and plan completion.
- **Downsell at $500–$1,000**, with no calls, so it costs you no time. $997 fits.
- **Never sell lifetime coaching or lifetime community.** That's why lifetime is only for signals, capped, and worded "for the life of the service".

### His three pricing checks (do these monthly)

1. **Close rate:** over 60–80% of calls = raise the price. Under 20–30% = too high, or the wrong people are booking.
2. **Cash vs contract value:** if over 90% of the contract value is collected up front, you're underpriced.
3. **Your hourly rate:** $5,000 ÷ about 15 hours of your time per student ≈ $333/hour. When your time is worth more than that, raise the price.

### The mentorship: what's inside

- A 1-on-1 call every **two weeks** (6 calls). Not weekly: he says people bring real questions to bi-weekly calls and chat covers the rest.
- Direct chat with you between calls.
- The full PRNTR course, workbook and slides.
- All signals for 90 days.
- The member dashboard (their trades and win rate).
- **Three phases**, so students finish and keep paying their plan:
  - Weeks 1–4, Protect: setup, risk and sizing, signals at small size, journal.
  - Weeks 5–8, Build: why trades are taken, managing a trade, profit-taking, trade reviews.
  - Weeks 9–12, Independence: their own written plan, scaling slowly, results interview, signals offer.
- **14-day refund** if it isn't what was described. Guarantee what you control, never profits.

### The course: what's inside

15 modules (Part 1 is done: mindset, reading the chart, the Box, the Fake-Out and Return), workbook, slides, 60 days of signals. What they paid counts toward the mentorship if they upgrade within 90 days.

---

## 2. The full journey of one person

```
Reel / short / YouTube / story
  → "DM me BOT" (ManyChat)  or  link in bio / description
      → Free guide + 6 emails + free Discord        (not ready yet)
      → prntr site → watch video → APPLY
          → budget $3K+ and not brand new  → BOOK A CALL (next 4 days) → "You're booked" page → reminders → CALL
                → buys mentorship (pay in full / 2-pay / 3-pay)
                → can't afford → course offered on the call
                → not now → follow-up messages, then the email list
          → under $3K or brand new  → COURSE PAGE ($997)
                → you message them anyway: some understated
                → course buyers → upgrade offer later
  → student → onboarding → 90 days → results interview → signals offer
```

---

## 3. The website (built: prntr-ai.onrender.com)

| Page | Job (his rule: each page only sells the next step) |
|---|---|
| `index.html` | Watch the video, then apply. Live tracker, story, proof, testimonials. **No price** on this page. |
| `apply.html` | 7 short questions, one at a time. Sends each person to booking or to the course. |
| `book.html` | The calendar, with their answers already filled in. |
| `booked.html` | "Congratulations, you're booked", the before-the-call video, "reply YES", what to prepare. |
| `course.html` | The $997 downsell. When someone comes from the application, it opens with "From your answers, the mentorship isn't the right fit yet". |

**The one file you edit for links:** `prntr_site/config.js` (Calendly link, course checkout, Instagram handle, videos, monthly spots, minimum budget).

### Who gets a call

- Budget answer $3,000 or more, and not "new to trading" → booking page.
- Everyone else → course page.

His filter was under $1,000. I set it at $3,000 because your cheapest mentorship plan starts at $3,000. Change `minBudget` in `config.js` if you want more calls.

**I left out his country filter on purpose.** The budget question already does that job person by person.

### Setting up Calendly (15 minutes)

1. Make one event: **"Mentorship call"**, 45 minutes, Zoom or Google Meet.
2. **Date range:** 4 days into the future. He says show rate "drops drastically" for calls booked a week out.
3. **Minimum notice:** 4 hours. **Buffer:** 15 minutes after each call. Up to 3 calls a day.
4. **Invitee questions, in exactly this order** (the site fills them in for you):
   1. Phone number
   2. Which describes you best?
   3. Biggest struggle right now
   4. Goal, and why now
   5. Budget / Instagram
5. **Confirmation page → "Redirect to an external site"** → `https://prntr-ai.onrender.com/booked.html`
6. **Workflows** (reminders, section 5 below).
7. Paste the event link into `config.js` → `calendly`.

### Keeping every application, including people who don't book

Without this, people sent to the course page leave no record. Free option: make a **Formspree** form (or a Make/Zapier webhook into a Google Sheet) and paste its URL into `config.js` → `formEndpoint`. Every application then lands in your inbox or sheet, and you can message the "under $3K" ones; he says some understate.

### Videos you need to record

| Video | Length | What it says | Where |
|---|---|---|---|
| Apply video | 5–8 min | Script already written (Day 2 kit). Its only job is the click on "Apply". | `vslLanding` |
| Before-the-call video | 10–15 min | How the 90 days work, what they get, who it's for, student results, what happens on the call. | `vslBooked` |
| Course video | 3–5 min | What's in the course, who it's for, the 60 days of signals, upgrade credit. | `vslCourse` |
| 3 pre-call videos | 5 min each | Overtrading · sizing and liquidation · giving back profits. Sent before the call to match their struggle. | Sent by message |

---

## 4. ManyChat (Instagram)

His method: the call to action on stories and reels is a **DM keyword**, and ManyChat replies with a **voice note** you recorded once. "Voice notes work so good" because they feel personal. Let the bot say it's automated if someone asks, and never promise returns.

### Keyword BOT (free guide, for people not ready yet)

1. Trigger: comment or DM "BOT".
2. Wait 20–40 seconds. Send your voice note:
   > "Hey, it's [name]. Thanks for reaching out. I'm sending you the guide right now. Quick question while it comes through: how long have you been trading, and what's been the hardest part?"
3. Ask for email → send the guide → add them to the 6-email sequence.
4. When they reply:
   - Serious and has traded a while: "Sounds like the mentorship could fit. Here's the 2-minute application: [site]/apply.html"
   - Brand new: "Start with the guide and the free Discord. When you're ready, the course is here: [site]/course.html"

### Keyword MENTOR (people already interested)

1. Voice note:
   > "Hey, it's [name]. I take [5] new 1-on-1 students a month because it's me on every call. Tell me where you're at with trading right now, and if it sounds like a fit I'll send you the application."
2. They answer → send the application link.
3. Not now → free guide and emails.

### Rules

- Only say a number of spots if it's true.
- You answer DMs yourself until you hire a setter (around $25K–$30K a month).
- Put "MENTOR" in your bio: "DM MENTOR for 1-on-1".

---

## 5. Messages around the call

### Reminders (he says 4–6, never 12)

| When | Channel | Message |
|---|---|---|
| Right after booking | Email + you message on IG/WhatsApp within minutes | Confirmation, link to the before-the-call video, "reply YES" |
| 1 day before | Email | A short student story that matches their struggle |
| 6 hours before | Email | "Here's what we'll cover" + the call link |
| 2 hours before | Instagram DM or WhatsApp | "Looking forward to it. Still good for [time]?" |
| 1 hour before | Email | Call link |
| 15 minutes before | Text | Call link |
| 5 minutes after start, if no show | Text + DM | "I'm on the call now, still joining?" |

### Pre-call video

The day before, send the one 5-minute video that matches their answer (overtrading, sizing, or giving back profits): "Made this for people in exactly your spot. Worth 5 minutes before we talk."

### The three rescue sequences (he estimates 10–20% extra revenue)

1. **Started the application, didn't finish** (needs `formEndpoint`): message the same day.
2. **Booked, didn't show:** two messages over 2 days to rebook. Then into the email list.
3. **Had the call, didn't buy:** follow up after 2 days with an answer to their specific objection. Offer a second call, or the course.

---

## 6. The call (30–45 minutes)

His five stages, in order:

1. **Agenda** (2 min): "I'll ask about your trading, then if I think I can help, I'll show you how. If not, I'll tell you. Fair?"
2. **Discovery** (15 min): where they are, what they've lost, their goal, why now, what's stopping them, what it costs to stay where they are. Use their application answers.
3. **Pre-handle objections** (5 min): raise the usual doubts before they do: small account, time, "is it too late", "why not just signals".
4. **Pitch** (8 min): the 90 days as the bridge from where they are to where they want to be. The three phases. What they get.
5. **Close** (5 min): price, pay in full or a plan, the 14-day refund, the pay-in-full clearance. Take payment on the call.

- Can't afford it → offer the course on the call.
- Doesn't fit → say so and point them to the free content.
- Record every call (Fathom). Aim to talk 40–50% of the time, not 90%.

---

## 7. After someone buys

1. Payment (Whop) → contract signs automatically (PandaDoc/DocuSign) → welcome email.
2. Discord role, signals on, dashboard access.
3. **"Why did you buy?" form** (15 questions, 5 minutes): what made you buy, the tipping point, what nearly stopped you. After about 50 answers you'll know exactly what to say in content.
4. First call within 7 days.
5. Week 4: feedback form (what's good, what's missing).
6. **First result → interview them right away** for content.
7. Weeks 10–12: the signals offer ($149/month or a lifetime seat) and an invitation to keep working with you.
8. **Course buyers:** at day 30 and day 75, "what you paid counts toward the mentorship within 90 days" → application link.

---

## 8. Tracking (one Google Sheet, one row per person)

`Date · Name · Source · Applied · Budget · Booked · Showed · Bought · Offer · Plan · Cash collected · Contract value · Notes`

Every week, work out:

| Number | His benchmark | If it's low |
|---|---|---|
| Visits → applications | — | The apply video or the headline |
| Applications → booked | ~40–45% of qualified | Calendar friction, the booking page |
| Show rate | 70–80%+ | Reminders, the before-the-call video, your message right after booking |
| Close rate | 30–50% | Discovery, objections, the pitch |
| Cash per call | $700–$2,000 | Pricing, plans, pay in full |
| Cash ÷ contract value | 60–70% | Over 90% = raise prices |

Wait for **50 or more** of anything before trusting a percentage. Change one thing at a time.

---

## 9. Timeline

| When | What |
|---|---|
| **Days 1–2** | Calendly set up, links in `config.js`, apply video recorded, journey story sequence, 20 warm messages |
| **Days 3–7** | Before-the-call video, reminders, first YouTube video, ManyChat BOT + MENTOR, first calls |
| **Week 2** | Free guide, 6 emails, 3 pre-call videos, editor hired, Formspree connected |
| **Week 3** | Course recorded (Parts 2–5), course on Whop, onboarding automated |
| **Week 4** | Review every number, fix the weakest one, first student interview |
| **Dec → mid-Jan** | 14-day pre-launch and New Year opening (his "gold mine" angle) |

### When to change the model (his phases)

| Monthly cash | Change |
|---|---|
| $0–$10K | You do everything: content, DMs, calls, delivery. 2–4 sales a month. |
| $10K–$30K | Hire an editor and a thumbnail designer. 6 YouTube videos a month. |
| 10–15 students at once | Raise the 1-on-1 price. Build a group mentorship as the new main offer ($4K–$6K), and 1-on-1 becomes the upsell ($10K+). |
| $25K–$30K | First hire: a **setter** (DMs, reminders, no-shows). Then a closer at about 10% commission. |
| $100K+ | Sales manager, assistant. Only now consider ads. |

---

## 10. Things he does that I left out on purpose

- "Guaranteed six-figure trader" headlines and $1,000 refunds tied to results.
- A spots counter coded to drop by itself, and "reply YES or your call is cancelled" when it won't be.
- A setter writing as you, or videos faked to look personally recorded.
- Blocking whole countries by phone number.

None of them are needed for the structure to work, and each one is a risk to your name.
