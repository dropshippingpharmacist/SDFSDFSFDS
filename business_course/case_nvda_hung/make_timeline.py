"""PRNTR Crossover: the news timeline against NVIDIA, with when each related coin appeared and what it did."""
import json, sys, datetime as dt
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
D = sys.argv[1]
BG, INK, MUTE = "#0B0B1A", "#FFFFFF", "#B9C3D6"
CYAN, GREEN, RED, GOLD, PURPLE = "#2AABE3", "#26C6A6", "#FF6B6B", "#E0B84A", "#7B61FF"
plt.rcParams.update({"font.family": "DejaVu Sans", "text.color": INK, "xtick.color": MUTE, "ytick.color": MUTE, "axes.edgecolor": "#2A3360"})
n = json.load(open(f"{D}/nvda.json"))["chart"]["result"][0]; q = n["indicators"]["quote"][0]
nd = [(dt.datetime.utcfromtimestamp(t) + dt.timedelta(hours=6, minutes=30), c) for t, c in zip(n["timestamp"], q["close"]) if c and dt.datetime.utcfromtimestamp(t) >= dt.datetime(2026, 10, 20)]
fig, ax = plt.subplots(figsize=(16, 9), dpi=120); fig.patch.set_facecolor(BG); ax.set_facecolor(BG); ax.grid(color="#1A2350", lw=0.6)
ax.plot([a for a, b in nd], [b for a, b in nd], color=CYAN, lw=3, marker="o", ms=5)
ax.axhline(212, color=CYAN, ls="--", lw=1); ax.axhline(190, color=GOLD, ls=":", lw=1.2); ax.axhline(168, color=CYAN, ls="--", lw=1)
ax.text(dt.datetime(2026, 10, 20, 6), 213.5, "Box ceiling ~$212", color=CYAN, fontsize=10)
ax.text(dt.datetime(2026, 10, 20, 6), 191.5, "Box middle ~$190", color=GOLD, fontsize=10)
ax.text(dt.datetime(2026, 10, 20, 6), 169.5, "Box floor ~$168", color=CYAN, fontsize=10)
ev = [
    (dt.datetime(2026, 10, 29, 12), "Oct 29 · NYT reports a 'close relationship'\nwith a Megaspeed executive.\nAn \"Alice Huang\" coin is made the same day\non Pump.fun: it never takes off.", PURPLE, 256),
    (dt.datetime(2026, 10, 30, 21), "Oct 30 · NVDA closes\nback inside the Box\n(the Return)", CYAN, 232),
    (dt.datetime(2026, 11, 5, 21), "Nov 5 · the Turn:\ncloses below the middle", RED, 247),
    (dt.datetime(2026, 11, 7, 9, 46), "Nov 7 · FT: intelligence memo.\n\"The NVIDIA Files\" coin\nmade at ~\\$3.7K (peak ~\\$17K)", GOLD, 228),
    (dt.datetime(2026, 11, 8, 12), "Nov 8 · Huang's email\nto staff (reported)", PURPLE, 210),
    (dt.datetime(2026, 11, 9, 4), "Nov 9 · HUNG on PumpSwap\n~\\$44K, then quiet ~\\$9.7K", GREEN, 196),
    (dt.datetime(2026, 11, 11, 21), "Nov 11–12 · resignation:\nHUNG ~\\$9.7K → ~\\$1.29M", GREEN, 182),
]
for t, lab, col, y in ev:
    ax.axvline(t, color=col, ls="--", lw=1.2, alpha=0.8)
    ax.text(t, y, " " + lab, color=col, fontsize=10, fontweight="bold", va="top")
ax.set_ylim(150, 262)
ax.set_xlim(dt.datetime(2026, 10, 20), dt.datetime(2026, 11, 16))
ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %d"))
ax.set_ylabel("NVDA close ($)", color=MUTE, fontsize=12)
ax.set_title("The PRNTR Crossover: the chart, the news, and the coins", fontsize=20, fontweight="bold", loc="left", pad=14)
fig.text(0.125, 0.02, "NVDA: Yahoo Finance daily closes · coins: creation times and prices from DEX Screener and GeckoTerminal · news as reported by NYT, FT and others · education only",
         color=MUTE, fontsize=9.5)
fig.savefig(f"{D}/3_timeline_news_vs_coins.png", facecolor=BG, bbox_inches="tight"); print("ok")
