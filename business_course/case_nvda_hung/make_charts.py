"""PRNTR case study charts: NVIDIA's Box and Turn, and the HUNG memecoin against NVIDIA around the news.
Data: Yahoo Finance daily NVDA (nvda.json) and GeckoTerminal hourly OHLCV for the HUNG PumpSwap pool (hung_h.json).
Usage: python3 make_charts.py <dir with nvda.json and hung_h.json> <out dir>"""
import json, sys, datetime as dt
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.patches import Rectangle

SRC, OUT = sys.argv[1], sys.argv[2]
BG, PANEL, INK, MUTE = "#0B0B1A", "#12183A", "#FFFFFF", "#B9C3D6"
CYAN, GREEN, RED, GOLD, PURPLE = "#2AABE3", "#26C6A6", "#FF6B6B", "#E0B84A", "#7B61FF"
plt.rcParams.update({"font.family": "DejaVu Sans", "text.color": INK, "axes.labelcolor": MUTE,
                     "xtick.color": MUTE, "ytick.color": MUTE, "axes.edgecolor": "#2A3360"})

n = json.load(open(f"{SRC}/nvda.json"))["chart"]["result"][0]
q = n["indicators"]["quote"][0]
rows = [(dt.datetime.utcfromtimestamp(t), o, h, l, c) for t, o, h, l, c in
        zip(n["timestamp"], q["open"], q["high"], q["low"], q["close"]) if c and o]

# ---------------- Chart 1: NVIDIA with the PRNTR Box ----------------
start = dt.datetime(2025, 7, 1)
d = [r for r in rows if r[0] >= start]
fig, ax = plt.subplots(figsize=(16, 9), dpi=120)
fig.patch.set_facecolor(BG); ax.set_facecolor(BG)
w = 0.6
for t, o, h, l, c in d:
    col = GREEN if c >= o else RED
    x = mdates.date2num(t)
    ax.plot([x, x], [l, h], color=col, lw=0.8)
    ax.add_patch(Rectangle((x - w / 2, min(o, c)), w, max(abs(c - o), 0.15), color=col))

CEIL, FLOOR, MID = 212, 168, 190
bx0, bx1 = mdates.date2num(dt.datetime(2025, 10, 1)), mdates.date2num(dt.datetime(2026, 11, 20))
ax.add_patch(Rectangle((bx0, FLOOR), bx1 - bx0, CEIL - FLOOR, facecolor=CYAN, alpha=0.08, edgecolor=CYAN, lw=1.5, ls="--"))
ax.text(bx0 + 4, CEIL + 2, "THE BOX", color=CYAN, fontsize=16, fontweight="bold")
for y, lab, col, ls in ((CEIL, "Ceiling  ~$212", CYAN, "--"), (FLOOR, "Floor  ~$168", CYAN, "--"), (MID, "Middle  ~$190", GOLD, ":")):
    ax.axhline(y, xmin=0, xmax=1, color=col, lw=1.2, ls=ls, alpha=0.9)
    ax.text(mdates.date2num(dt.datetime(2025, 7, 3)), y + 1.5, lab, color=col, fontsize=11, fontweight="bold")

def note(date, y, text, col, tx, ty):
    ax.annotate(text, xy=(mdates.date2num(date), y), xytext=(mdates.date2num(tx), ty), color=col, fontsize=12, fontweight="bold",
                arrowprops=dict(arrowstyle="-|>", color=col, lw=1.5), ha="center")

note(dt.datetime(2026, 5, 27), 236.5, "Fake-out 1\n(above the ceiling)", GOLD, dt.datetime(2026, 3, 1), 250)
note(dt.datetime(2026, 10, 6), 243.4, "Fake-out 2\nOct 6 high $243", GOLD, dt.datetime(2026, 8, 10), 262)
note(dt.datetime(2026, 10, 30), 204.6, "The Return\nback inside", CYAN, dt.datetime(2026, 12, 20), 228)
note(dt.datetime(2026, 11, 5), 181.6, "The Turn\nNov 5: closes below\nthe middle", RED, dt.datetime(2027, 1, 5), 195)
note(dt.datetime(2026, 11, 13), 161.0, "Trip across:\nfloor reached", GREEN, dt.datetime(2027, 1, 5), 150)
note(dt.datetime(2026, 11, 8), 186.6, "Nov 8: the\nscandal goes public", PURPLE, dt.datetime(2026, 9, 10), 160)

ax.set_xlim(mdates.date2num(start), mdates.date2num(dt.datetime(2027, 2, 15)))
ax.set_ylim(130, 275)
ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %Y"))
ax.grid(color="#1A2350", lw=0.6)
ax.set_title("NVIDIA (daily): the Box, two Fake-Outs, the Return and the Turn", color=INK, fontsize=20, fontweight="bold", loc="left", pad=16)
fig.text(0.125, 0.02, "PRNTR · NVDA daily, Jul 2025 – Nov 13 2026 · data: Yahoo Finance · for education, not financial advice",
         color=MUTE, fontsize=10)
fig.savefig(f"{OUT}/1_NVDA_PRNTR_box.png", facecolor=BG, bbox_inches="tight")
plt.close(fig)

# ---------------- Chart 2: NVIDIA vs the HUNG memecoin ----------------
h = sorted(json.load(open(f"{SRC}/hung_h.json"))["data"]["attributes"]["ohlcv_list"])
ht = [dt.datetime.utcfromtimestamp(r[0]) for r in h]
hc = [r[4] * 1e9 for r in h]
hh = [r[2] * 1e9 for r in h]
nd = [r for r in rows if dt.datetime(2026, 10, 27) <= r[0] <= dt.datetime(2026, 11, 14)]

fig, (a1, a2) = plt.subplots(2, 1, figsize=(16, 10), dpi=120, sharex=True, gridspec_kw={"height_ratios": [1, 1.4], "hspace": 0.08})
fig.patch.set_facecolor(BG)
for a in (a1, a2):
    a.set_facecolor(BG); a.grid(color="#1A2350", lw=0.6)
a1.plot([r[0] + dt.timedelta(hours=6, minutes=30) for r in nd], [r[4] for r in nd], color=CYAN, lw=2.5, marker="o", ms=5)
a1.axhline(MID, color=GOLD, ls=":", lw=1.2); a1.text(dt.datetime(2026, 10, 27, 6), MID + 2, "Box middle ~$190", color=GOLD, fontsize=10)
a1.axhline(FLOOR, color=CYAN, ls="--", lw=1.2); a1.text(dt.datetime(2026, 10, 27, 6), FLOOR + 2, "Box floor ~$168", color=CYAN, fontsize=10)
a1.set_ylabel("NVDA close ($)", fontsize=12)
a1.set_title("NVIDIA vs the HUNG memecoin, Oct 27 – Nov 13 2026", color=INK, fontsize=20, fontweight="bold", loc="left", pad=14)

a2.plot(ht, hc, color=GREEN, lw=1.8)
a2.fill_between(ht, hc, 1, color=GREEN, alpha=0.08)
a2.set_yscale("log"); a2.set_ylim(3000, 3_000_000)
a2.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, p: f"${v/1e6:.1f}M" if v >= 1e6 else f"${v/1e3:.0f}K"))
a2.set_ylabel("HUNG market cap (hourly, log)", fontsize=12)

events = [(dt.datetime(2026, 11, 5, 21), "Nov 5: NVDA closes\nbelow the Box middle", RED, 2_000_000, "left"),
          (dt.datetime(2026, 11, 8, 12), "Nov 8: Huang's email to staff\nadmitting he was unfaithful\n(widely reported) ", PURPLE, 450_000, "right"),
          (dt.datetime(2026, 11, 9, 4), " Nov 9: HUNG trades on\n PumpSwap at ~\\$44K", GOLD, 220_000, "left"),
          (dt.datetime(2026, 11, 11, 21), "Nov 11 evening (UTC): resignation\nnews · ~\\$9.7K to ~\\$1M in 2 hours ", GREEN, 1_150_000, "right")]
for t, lab, col, yv, ha in events:
    for a in (a1, a2):
        a.axvline(t, color=col, lw=1.4, ls="--", alpha=0.9)
    a2.text(t, yv, (" " + lab) if ha == "left" else lab, color=col, fontsize=10.5, fontweight="bold", va="top", ha=ha)
pk = max(range(len(hh)), key=lambda i: hh[i])
a2.annotate(f"Peak ~\\${hh[pk]/1e6:.2f}M\n(Nov 12, 15:00 UTC)", xy=(ht[pk], hh[pk]), xytext=(ht[pk] + dt.timedelta(hours=6), 2_300_000), ha="center",
            color=INK, fontsize=11, fontweight="bold", arrowprops=dict(arrowstyle="-|>", color=INK))
a2.annotate("Quiet at ~\\$9.7K\nfor two days", xy=(dt.datetime(2026, 11, 11, 12), 9716), xytext=(dt.datetime(2026, 11, 10, 0), 4200),
            color=MUTE, fontsize=10.5, arrowprops=dict(arrowstyle="-|>", color=MUTE))
a2.xaxis.set_major_formatter(mdates.DateFormatter("%b %d"))
a2.set_xlim(dt.datetime(2026, 10, 27), dt.datetime(2026, 11, 14))
fig.text(0.125, 0.03, "PRNTR · NVDA: Yahoo Finance daily closes · HUNG (4xgqefa5…pump): GeckoTerminal hourly, PumpSwap pool, market cap = price × 1B supply · "
         "allegations are as reported by the press · education only", color=MUTE, fontsize=9.5)
fig.savefig(f"{OUT}/2_NVDA_vs_HUNG.png", facecolor=BG, bbox_inches="tight")
print("ok")
