# How to record: read the script, film yourself and the screen at the same time

## The setup (Mac)

**What you need**
- Your Mac (you're on one already).
- A webcam or your iPhone as the camera. macOS "Continuity Camera" lets the iPhone act as a webcam: put it on a stand above the screen, next to the top edge.
- A USB microphone (e.g. Rode NT-USB Mini, Shure MV7, or a clip-on lav like DJI Mic). Sound matters more than video.
- A light in front of you (a cheap LED panel or a window you face, never behind you).

**Software, free**
- **OBS Studio** (obsproject.com) records the screen and your camera together in one video.
  1. Add a "Display Capture" source (your screen with TradingView / the results page).
  2. Add a "Video Capture Device" source (your camera) and drag it to a corner, or make a second scene that is only your face.
  3. Add your microphone under "Audio Input Capture".
  4. Settings → Output → recording format **mp4**, Settings → Video → 1920×1080, 30 fps.
  5. Use two scenes: **"Face"** (camera full screen) and **"Chart"** (screen + small face in a corner). Switch with a hotkey while you talk.

**The teleprompter, so you can read while looking at the camera**
- Easiest: a teleprompter web page right **under the camera**, at the top of your screen. Search "free online teleprompter" (e.g. *teleprompter.com* or *cueprompter.com*), paste the script, set the window to a narrow strip at the very top, font large, scroll speed slow.
- Better: the app **"Teleprompter Premium"** or **"BIGVU"** on an iPad placed directly under the camera lens. Many have a remote / voice-follow mode that scrolls as you speak.
- Best (later): a beam-splitter teleprompter glass (about $100–200) that sits in front of the camera, so your eyes look straight into the lens.
- Hide the teleprompter window from the recording: in OBS, capture a *window* (TradingView) instead of the whole display, or put the prompter on a second monitor.

## How to actually record

1. **Don't read it all in one take.** Record one section at a time. If you stumble, pause 2 seconds and say the sentence again; cut the mistake out later.
2. **Read the line, look at the lens, say it.** Glance down at the prompter between sentences, not in the middle of one.
3. **Speak 10 % slower and louder than feels natural.** It sounds normal on video.
4. **Sections marked `[CHART]`** = switch OBS to the Chart scene and point with your mouse / draw. **`[FACE]`** = back to the camera.
5. **Change what's on screen at least every 20 seconds** (zoom in on the chart, switch scene, show the results page).
6. Record the **hook last**, once you're warmed up. It's the most important 10 seconds.

## Editing (simplest route)

- **Descript** (paid, very easy): import the recording, it transcribes it, you delete words in the text and the video is cut. It also removes "um"s and silences automatically.
- Or **CapCut desktop** (free): cut the mistakes, add captions automatically, add zooms.
- Add on-screen text for key numbers, and captions for reels.

## Before you publish, checklist (from the video you watched)

- Thumbnail: your face + one bold number + a chart. Would *you* click it?
- Title matches what the video delivers.
- Hook in the first 10 seconds.
- Screen changes at least every 20 seconds.
- The CTA at the end, plus the link in the description and a pinned comment.
- The disclaimer is in the description (text below).

## Description disclaimer (paste under every video)

> This video is for education and entertainment only. It is not financial advice. Trading, and especially leverage trading, carries a high risk of loss; you can lose more than you put in. Past results, mine or the bot's, do not guarantee future results, and the results shown are not typical. Never trade money you cannot afford to lose.

## Placeholders in the scripts

Anything in **[square brackets]** is something only you know (dates, your specialty, real numbers). Replace it with the true fact before recording, and never round a number up. The bot's numbers must come from the results page.
