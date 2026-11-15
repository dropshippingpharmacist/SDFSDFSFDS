# Comment PRINTER → free playbook → DM conversation → call

The workflow (owner 2026-11-15): a Reel caption says **"Comment PRINTER and I'll send you my free playbook"**, ManyChat
DMs the playbook to everyone who comments, and the DM becomes the conversation that leads to the 1-on-1 call.

- The studio already ends every Reel caption with that line (Ideas page → Settings → "Reel comment keyword").
- The playbook: `prntr-ai.onrender.com/guide.html?src=ig` (they enter their email there and get the web page + PDF;
  the email lands in your list at the bot's `/api/leads.csv`).
- Never promise income in a DM ("you'll make $X"). Instagram and TikTok flag it, and it attracts the wrong people.

---

## 1. Set up ManyChat (one time, about 20 minutes)

1. **Instagram account:** a Professional account (Creator or Business) connected to a Facebook Page.
   Instagram app → Settings → Messages and story replies → Message controls → Connected tools →
   **"Allow access to messages" ON**.
2. **ManyChat:** sign up at manychat.com with Facebook, connect the Instagram account.
3. **Automation → New automation → Start from scratch → Trigger: "User comments on your Post or Reel".**
   - Which posts: **Any post or reel** (so every Reel works, including future ones).
   - Keywords: **PRINTER, PRNTR, PRINTR, PRINTERS** (ManyChat keyword match ignores capitals).
   - **Public reply to the comment:** turn on, with 3–4 variations so it doesn't look like a bot:
     - "Sent! Check your DMs 📩"
     - "Just DM'd it to you 🔥"
     - "Check your inbox, it's there 👀"
     - "Sent it over, enjoy 🙏"
4. Build the DM flow below in that automation. Publish it, then test: comment PRINTER on one of your Reels from a
   second account.
5. **TikTok:** ManyChat has a TikTok channel, but availability depends on the account and region. If your account
   has it, copy the same automation there. If not, TikTok captions say "Link in bio for my free playbook" and your
   bio link is `prntr-ai.onrender.com/guide.html?src=tiktok`.
6. **Instagram bio link:** `prntr-ai.onrender.com/guide.html?src=bio`.

> Instagram's rule: automated messages can only be sent within **24 hours** of the person's last message or
> comment. Every automated step below happens inside that window. After 24 hours, only you (or a setter) can
> reply, by hand. That's why the flow asks a question early: every reply opens a new 24 hours.

---

## 2. The DM flow (automated)

**Message 1, right away (from the comment):**
> Hey {first_name}! 🙌 Here's the playbook you asked for: how I trade memecoins without getting rugged, use leverage
> without getting liquidated, and turn the wins into income. Start with Part 0, it takes an hour 👇
>
> [Button: **Get the free playbook**] → `https://prntr-ai.onrender.com/guide.html?src=ig`

**Message 2, 3 minutes later:**
> Quick question so I can point you to the part that'll help you most: how long have you been trading?
>
> [Quick replies: **Just starting** · **Under a year** · **1–3 years** · **3+ years**]

**Message 3, after their answer:**
> Got it. And what are you mostly trading right now?
>
> [Quick replies: **Memecoins** · **Leverage / futures** · **Both** · **Nothing yet**]

**Message 4, after their answer:**
> Last one: what's the #1 thing you want trading to do for you in the next 90 days? Just type it out 👇

(Free-text reply. Save it to a custom field "goal". Add tag **answered**, then **notify you / your setter**: ManyChat
→ Action → "Notify admin". This is where a human takes over.)

**If they don't answer Message 2 within 20 hours (still inside the 24-hour window):**
> Did the playbook come through okay? If you only do one thing today, do Part 2 (lock down your wallets). Most
> people lose more to hacks than to bad trades.

Tags to add along the way: `playbook_sent`, `answered`, `memecoins` / `leverage` / `both`, `experience_<answer>`,
later `hot_lead`, `call_booked`, `not_a_fit`.

---

## 3. The conversation (you or your setter, by hand)

The goal of the DM is **not** to sell. It's to understand them, add value, and invite the right people to a call. The
call is where the mentorship and price are discussed (HanckFX: never pitch the price in DMs).

### Step 1: reply to their goal, personally (same day)
> That's a great goal, {first_name}. I was in a similar spot before my $7K trade. Can I ask: what's been the biggest
> thing stopping you from getting there so far?

### Step 2: discovery (one question per message, wait for each answer)
1. "What have you tried so far? Courses, signals, YouTube?"
2. "How has it gone? Up, down, about even?"
3. "What happened the last time you lost money on a trade?" *(the pain)*
4. "If you got this figured out, what would it change for you?" *(the dream)*
5. "Is this something you want to fix now, or more of a 'someday' thing?" *(the timing)*

Send something useful in between, matched to their answers:
- Lost on leverage → "Have you tried the position-size calculator in the playbook? Put your last trade into it,
  I bet liquidation was closer than your stop."
- Got rugged → "Part 4 (the 12-point rug check) would have caught most of those."
- Gave back gains → "Part 12 is the one for you: the profit ladder and paying yourself."

### Step 3: the invite (only when they've told you their pain and that it's a "now" thing)
> Honestly, from what you've told me, you've got the drive, you're just missing the system. I take on a few people
> a month 1-on-1 for 90 days: my wallets, my bot's signals, and calls with me on your actual trades. Want to hop on
> a quick call to see if it's a fit? No pressure either way.

Yes → "Perfect, fill this out first so I can prepare for your call: prntr-ai.onrender.com/apply.html?src=dm"
(the application screens budget and books the call).

### Common replies
| They say | You say |
|---|---|
| "How much is it?" | "It depends on what you need, which is exactly what the call is for. Fill this out and we'll go through it: [apply link]" |
| "I don't have money right now" | "Totally fair. Get the basics from the playbook and join the free Discord, and when you're ready, reach out." (tag `not_a_fit`, no pressure) |
| "Is this a scam?" | "Fair question, there are a lot of them. Everything I do is public: the free playbook, my results, my students. Check them out and decide for yourself." |
| "Can you just give me signals?" | "The signals come with the mentorship, because signals without the system are how most people lose. Want to see if it's a fit?" |
| "I need to think about it" | "Of course. What's the main thing you'd want to think through? Maybe I can help answer it now." |
| Not replying for 2+ days | One message, by hand: "Hey {first_name}, did you get a chance to go through Part 0?" Then let it go. |

### Rules for the conversation
- One question per message. Short messages. Use their first name.
- Never quote a price, never promise income, never pressure.
- Disqualify kindly: under 18, money they can't afford to lose, "I want you to trade for me".
- Log every conversation that reaches Step 3 (name, goal, pain, booked or not). It's the "book a call rate" HanckFX
  tracks.

---

## 4. What to track every week

| Number | Where it comes from |
|---|---|
| Comments with the keyword | ManyChat → automation stats |
| Playbook signups | `/api/leads.csv` (src=ig, tiktok, bio, discord ...) |
| Answered the questions | ManyChat tag `answered` |
| Invited to a call | your log |
| Applications / calls booked | the application page + Calendly |
| Show rate, close rate | your sales log |

The weakest number is the one to fix first (HanckFX: "every single link will multiply").
