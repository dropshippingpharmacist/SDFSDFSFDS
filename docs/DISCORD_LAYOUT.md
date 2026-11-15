# PRNTR free Discord: layout and setup

Built from the HanckFX transcript (2026-11-15): the free Discord is a **nurture tool, not a product**. People arrive
from YouTube, Instagram and the free guide, get warmed up with recaps and proof, and the only thing offered inside is
the application for the mentorship. No paid tiers, no live entry levels, no DMs to you.

Invite: the link in `prntr_site/config.js` (`discord`).

---

## 1. Roles

| Role | Who | Sees |
|---|---|---|
| `@everyone` | anyone who joins | START HERE and COMMUNITY (read the rules first) |
| `@Member` | clicked "I agree" in #rules (Discord onboarding) | everything in the free server |
| `@Student` | mentorship clients (added by hand or by Whop) | the STUDENTS category: live signals, calls, course |
| `@Team` | you, setters, closers, a community manager later | TEAM category, the tickets |
| `@Bot` | the bots (tickets, PRNTR assistant, webhooks) | what each one needs |

Server setting: **Privacy → turn off "Allow direct messages from server members"** for you and the Team, so nobody DMs you. Support goes through tickets (HanckFX: "make a support ticket inside the free Discord instead ... then you can outsource that").

---

## 2. Channels

### START HERE (read-only for members)
| Channel | What goes in it |
|---|---|
| `#welcome` | One pinned message (below). Who you are, what the server is for, three links: free guide, YouTube, apply. |
| `#rules` | Short rules + the "I agree" button that gives `@Member`. |
| `#free-guide` | Pinned: "Want the free PRNTR Playbook? DM me PRINTER on Instagram and it's in your inbox in seconds." (The playbook link itself is private: only sent in DMs, never posted.) |
| `#apply-for-mentorship` | Pinned: what the mentorship is, who it's for, the application link `prntru.com/apply.html?src=discord`. Nothing else is ever sold in the server. |

### UPDATES (read-only for members, you and the bot post)
| Channel | What goes in it |
|---|---|
| `#announcements` | YouTube drops, new case studies, launch posts (templates below). Every one ends with the application link. |
| `#youtube` | Every new video, auto-posted (a YouTube-to-Discord webhook or a bot such as MEE6 / Pingcord). |
| `#trade-recaps` | **Closed** trades only, win or loss: the chart, entry, stop, result. Never live entries or levels: those are for students. |
| `#student-wins` | Screenshots and short stories from students (with permission). This is your proof channel. |

### COMMUNITY (members can post)
| Channel | What goes in it |
|---|---|
| `#general` | Chat. Slow mode 30 s. |
| `#chart-questions` | Members post a chart and a question. You or a student answer a few a week in plain terms (what you'd watch for, not the rules): it shows how you think without giving the method away. |
| `#introduce-yourself` | Where they're at, what they trade, their goal. Your setters read this (it qualifies people for free). |

### SUPPORT
| Channel | What goes in it |
|---|---|
| `#open-a-ticket` | One button: "Open a ticket" (Ticket Tool or Tickets v2 bot). A private ticket channel opens for that member and `@Team`. |

### STUDENTS (`@Student` only)
| Channel | What goes in it |
|---|---|
| `#signals` | The bot's live TCT / L86 signals (same as your Telegram) |
| `#student-chat`, `#call-schedule`, `#course` | Mentorship delivery |

### TEAM (`@Team` only)
| Channel | What goes in it |
|---|---|
| `#new-signups` | Every free-guide signup, posted automatically (below). Setters reach out from here. |
| `#applications` | New applications from the site (when the form endpoint is connected). |
| `#team-chat` | Internal |

---

## 3. Automations

1. **Free-guide signups → `#new-signups`.** In Discord: `#new-signups` → Edit Channel → Integrations → Webhooks →
   New Webhook → Copy URL. Put it on Render (the bot service) as `DISCORD_LEADS_WEBHOOK`. Every new signup on
   `guide.html` posts "📥 New signup: name (source)". The full list (name, email, where they came from) downloads
   from the bot at `/api/leads.csv`.
2. **Emails.** Pick an email tool (ConvertKit, Mailchimp, Beehiiv ...), make an incoming webhook or Zapier zap that
   adds a subscriber, and put its URL on Render as `LEADS_FORWARD_URL`. Every signup is then added to the list and the
   nurture sequence starts. Until then, the emails are kept in `/api/leads.csv` to import later.
3. **YouTube → `#youtube`.** A YouTube notification bot posts each new upload.
4. **Tickets.** Ticket Tool: one panel in `#open-a-ticket`, tickets visible to `@Team` only, closed tickets saved as transcripts.
5. **Later: the PRNTR assistant bot** (see `docs/PINNED_discord_bot.md`): welcomes new members, answers questions,
   asks a few qualifying questions, and points the right people to the application. It needs a bot token
   (`DISCORD_BOT_TOKEN`).

---

## 4. Messages to paste

### `#welcome` (pinned)
> **Welcome to PRNTR.** I'm a doctor who walked away from medicine after one trade turned $7K into over $1M. This server is where I share how I trade and how my bot picks its setups.
>
> **Start here**
> 1. Get the free playbook: DM me PRINTER on Instagram and it lands in your inbox
> 2. Watch the latest breakdowns in #youtube
> 3. Read the closed trades in #trade-recaps (wins and losses)
>
> Want to work with me directly? The mentorship is 90 days on your own trades, with the bot's signals included → prntru.com/apply.html?src=discord
>
> Questions? Open a ticket in #open-a-ticket. Trading carries risk; this is education, not financial advice.

### `#rules` (pinned, with the "I agree" button)
> 1. Be respectful. No spam, no promoting other groups or coins.
> 2. Nothing here is financial advice. You're responsible for your own trades.
> 3. No DMs to members selling anything. Report it in a ticket.
> 4. Questions about the mentorship or your account go in a ticket.
> Click **I agree** to unlock the server.

### `#announcements`: new video
> 🎥 **New video:** [title]
> [one line: the problem it solves / the result in it]
> Watch: [link]
> If you want me to walk you through this on your own charts → prntru.com/apply.html?src=discord

### `#trade-recaps`: closed trade
> **[Market] [Long/Short] · [timeframe] · closed [win +X R / loss -1 R]**
> [chart]
> Entry [x] · Stop [y] · Target [z]
> Why it was taken: [one plain line, e.g. "the market confirmed and the math was worth it". Never the rules, timeframes or levels the bot uses]
> Students got this live. → prntru.com/apply.html?src=discord

### Launch / enrollment push (HanckFX runs 2–3 weeks: Discord announcements + 8–12 Instagram story sequences + emails)
Week 1: a student result + "doors open on [date]".
Week 2: the method (a recap or a video), "5 spots this month".
Week 3: "applications close [date]", the application link in every post.

---

## 5. What not to do (from the transcript, and keeping the method private)

- **Never post the method in the free server** (owner 2026-11-15: "I don't want you giving out too much sauce"). No rule lists, timeframes, tap counts, fib levels, block definitions or how the bot confirms an entry, in posts, recaps, answers or the free guide. Talk about results, principles and mindset; the exact rules are taught 1-on-1.

- No paid Discord tiers ($49–200/month): "just delete it".
- Don't sell inside the server. The only offer is the application, sold on a call.
- Don't post live entry levels in the free server. Recaps after the trade closes only.
- Don't answer DMs. Tickets, so the support can be handed to a community manager later.
