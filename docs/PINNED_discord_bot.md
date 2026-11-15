# PINNED (2026-11-15): Discord AI assistant for the free PRNTR server

Owner: "when people join the free discord can i make a bot that controls my discord to talk to users ... completely
hands off" -> "ok put a pin in this convo and remember for later".

## What it will do
1. New member joins -> welcome DM (free guide + one question: "biggest problem in your trading right now?").
   DMs closed -> a private thread in #welcome instead.
2. AI conversation (Claude), knows the PRNTR material: answers questions, learns experience + budget, then routes:
   $2,000+ -> 1-on-1 application (prntru.com/apply.html); under -> signals (1 day $9.99 / 1 week $35 first);
   not ready -> free guide + YouTube.
3. Follow-ups: at most 2 nudges, then stop. "stop" = never message again.
4. Hot lead (applied / asks for a human / ready to buy) -> summary posted in a private #leads channel, owner pinged.
5. #ask channel: answers questions in public.
6. Every conversation saved as a lead list.

## Rules
- A real bot account (Discord Developer Portal), never a self-bot on the owner's account.
- Named "PRNTR Assistant", says it is the owner's AI assistant; never pretends to be the owner.
- No mass DMs to existing members: new joins and people who write to it only.
- No income / result promises; "education only, not financial advice".

## Waiting on the owner
discord.com/developers -> New Application "PRNTR Assistant" -> Bot -> enable Server Members Intent + Message Content
Intent -> invite with Send Messages, Create Private Threads, Read Message History -> put the token on Render as
DISCORD_BOT_TOKEN (never in chat or the repo). Host: a small always-on Render service (~$7/month) + AI usage.
