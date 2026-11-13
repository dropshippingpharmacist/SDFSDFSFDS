"""PRNTR case study, chart 4: the 1-hour Turn on NVIDIA, with the memecoins underneath on the same clock.
Data: Bitunix NVDAUSDT 1h perpetual bars (nvda_perp_1h.json, trades 24/7), GeckoTerminal hourly OHLCV for
HUNG (hung_h.json) and THE NVIDIA FILES (files_h.json). Usage: python3 make_ltf_chart.py <data dir> <out dir>"""
import json, sys, datetime as dt
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.patches import Rectangle

SRC, OUT = sys.argv[1], sys.argv[2]
BG, INK, MUTE = "#0B0B1A", "#FFFFFF", "#B9C3D6"
CYAN, GREEN, RED, GOLD, PURPLE = "#2AABE3", "#26C6A6", "#FF6B6B", "#E0B84A", "#7B61FF"
plt.rcParams.update({"font.family": "DejaVu Sans", "text.color": INK, "axes.labelcolor": MUTE,
                     "xtick.color": MUTE, "ytick.color": MUTE, "axes.edgecolor": "#2A3360"})
T = lambda *a: dt.datetime(*a)

bars = [(dt.datetime.utcfromtimestamp(int(b["time"]) / 1000), *(float(b[k]) for k in ("open", "high", "low", "close")))
        for b in json.load(open(f"{SRC}/nvda_perp_1h.json"))]
X0, X1 = T(2026, 10, 30, 12), T(2026, 11, 13, 17)
bars = [b for b in bars if X0 <= b[0] <= X1]

# The plan, from the rules (all numbers are from the bars above)
CEIL, FLOOR = 210.28, 201.32          # small Box: Nov 2 high, Oct 30 low
MIDL = round((CEIL + FLOOR) / 2, 2)
ENTRY_T, ENTRY = T(2026, 11, 4, 20), 200.63   # first 1h close below the small floor
STOP = 207.30                                   # just above the last failed bounce (207.17, Nov 4 14:00)
TARGET, TARGET_T = 168.0, T(2026, 11, 10, 16)  # the big Box floor; first traded Nov 10 16:00 UTC
R = round((ENTRY - TARGET) / (STOP - ENTRY), 1)

fig, (a1, a2) = plt.subplots(2, 1, figsize=(16, 11), dpi=120, sharex=True,
                             gridspec_kw={"height_ratios": [2.1, 1], "hspace": 0.06})
fig.patch.set_facecolor(BG)
for a in (a1, a2):
    a.set_facecolor(BG); a.grid(color="#1A2350", lw=0.6)

w = 0.03
for t, o, h, l, c in bars:
    col = GREEN if c >= o else RED
    x = mdates.date2num(t + dt.timedelta(minutes=30))
    a1.plot([x, x], [l, h], color=col, lw=0.7)
    a1.add_patch(Rectangle((x - w / 2, min(o, c)), w, max(abs(c - o), 0.08), color=col))

bx0, bx1 = mdates.date2num(X0), mdates.date2num(ENTRY_T + dt.timedelta(hours=1))
a1.add_patch(Rectangle((bx0, FLOOR), bx1 - bx0, CEIL - FLOOR, facecolor=CYAN, alpha=0.10, edgecolor=CYAN, lw=1.4, ls="--"))
a1.text(bx0 + 0.1, CEIL + 1.2, "SMALL BOX (1 hour)", color=CYAN, fontsize=13, fontweight="bold")
a1.plot([bx0, bx1], [MIDL, MIDL], color=GOLD, ls=":", lw=1.1)

def note(t, y, text, col, tx, ty, ha="center"):
    a1.annotate(text, xy=(mdates.date2num(t), y), xytext=(mdates.date2num(tx), ty), color=col, fontsize=11.5,
                fontweight="bold", ha=ha, arrowprops=dict(arrowstyle="-|>", color=col, lw=1.3))

note(T(2026, 11, 3, 21, 30), 211.26, "Fake-out 1\nNov 3: \\$211.26", GOLD, T(2026, 11, 1, 6), 217)
note(T(2026, 11, 4, 10, 30), 211.35, "Fake-out 2\nNov 4: \\$211.35", GOLD, T(2026, 11, 5, 18), 217)
note(T(2026, 11, 4, 20, 30), 200.63, "The Turn: Nov 4, 20:00 UTC, an hour closes\nbelow the small floor. SELL \\$200.63", RED,
     T(2026, 10, 30, 14), 194, "left")

# entry, stop, target zones from the entry to the target
e0, e1 = mdates.date2num(ENTRY_T + dt.timedelta(hours=1)), mdates.date2num(TARGET_T + dt.timedelta(hours=1))
a1.add_patch(Rectangle((e0, ENTRY), e1 - e0, STOP - ENTRY, facecolor=RED, alpha=0.18, lw=0))
a1.add_patch(Rectangle((e0, TARGET), e1 - e0, ENTRY - TARGET, facecolor=GREEN, alpha=0.10, lw=0))
for y, lab, col in ((STOP, f"Stop \\${STOP:.2f}  (above the last failed bounce)", RED),
                    (ENTRY, f"Entry \\${ENTRY:.2f}", INK),
                    (TARGET, "", GREEN)):
    a1.plot([e0, e1], [y, y], color=col, lw=1.6)
    if lab:
        a1.text(e1 + 0.08, y, lab, color=col, fontsize=11, fontweight="bold", va="center")
a1.text(e0 + 0.1, TARGET + 1.0, f"Target \\${TARGET:.0f}: the big Box floor  ·  +{R}R", color=GREEN, fontsize=11.5, fontweight="bold")
a1.axhline(190, color=GOLD, ls=":", lw=1, alpha=0.7)
a1.text(mdates.date2num(T(2026, 11, 13, 22)), 190.8, "Big Box middle ~\\$190", color=GOLD, fontsize=10)
a1.axhline(168, color=CYAN, ls="--", lw=1, alpha=0.7)
a1.text(mdates.date2num(T(2026, 11, 13, 22)), 168.8, "Big Box floor ~\\$168", color=CYAN, fontsize=10)
note(TARGET_T + dt.timedelta(minutes=30), 167.5, "Target hit\nNov 10, 16:00 UTC", GREEN, T(2026, 11, 9, 0), 158)
note(T(2026, 11, 12, 14, 30), 149.25, "Resignation day:\nwick to \\$149.25", PURPLE, T(2026, 11, 11, 4), 150, "right")

a1.set_ylim(144, 222)
a1.set_ylabel("NVIDIA perpetual, 1-hour ($)", fontsize=12)
a1.set_title("NVIDIA on the 1-hour chart: the small Box, the Turn, and a target at the big Box floor",
             color=INK, fontsize=19, fontweight="bold", loc="left", pad=14)

# ---- bottom: the coins on the same clock ----
def mcap(name):
    h = sorted(json.load(open(f"{SRC}/{name}"))["data"]["attributes"]["ohlcv_list"])
    return [dt.datetime.utcfromtimestamp(r[0]) for r in h], [r[4] * 1e9 for r in h]
ht, hc = mcap("hung_h.json")
ft, fc = mcap("files_h.json")
a2.plot(ht, hc, color=GREEN, lw=1.8, label="HUNG (Jensen Hung)")
a2.plot(ft, fc, color=GOLD, lw=1.4, label="THE NVIDIA FILES")
a2.set_yscale("log"); a2.set_ylim(1500, 12_000_000)
a2.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, p: f"${v/1e6:.1f}M" if v >= 1e6 else f"${v/1e3:.0f}K"))
a2.set_ylabel("Memecoin market cap (log)", fontsize=12)
a2.axvspan(X0, ft[0], color="#1A2350", alpha=0.55)
a2.text(T(2026, 11, 1, 0), 9000, "No NVIDIA scandal coin is trading yet.\nYou're already short from the chart.", color=MUTE, fontsize=11.5, fontweight="bold")
a2.axvspan(T(2026, 11, 10, 15), T(2026, 11, 11, 21), color=GREEN, alpha=0.13)
a2.legend(loc="upper left", facecolor=BG, edgecolor="#2A3360", labelcolor=INK, fontsize=10.5)

def at(ts, vals, t):
    v = [c for x, c in zip(ts, vals) if x <= t]
    return v[-1] if v else None
for t, lab, col, ty in ((T(2026, 11, 9, 4), "HUNG starts trading\n~\\$44K", GREEN, 300_000),
                        (TARGET_T, "Close the NVDA short at \\$168,\nbuy HUNG under \\$10K\n(~30 hours of chances)", CYAN, 1_500_000),
                        (T(2026, 11, 12, 14), "NVDA wick to \\$149:\nHUNG ~\\$942K", PURPLE, 2_600_000)):
    y = at(ht, hc, t) if t != T(2026, 11, 9, 4) else 43_800
    dx = {TARGET_T: dt.timedelta(hours=20), T(2026, 11, 12, 14): dt.timedelta(hours=-22)}.get(t, dt.timedelta(hours=30))
    a2.annotate(lab, xy=(t, y), xytext=(t - dx, ty), color=col, fontsize=10.5, fontweight="bold",
                ha="center", arrowprops=dict(arrowstyle="-|>", color=col, lw=1.2))
a2.annotate("NVIDIA Files coin made Nov 7\n~\\$3.7K", xy=(ft[0], 3650), xytext=(T(2026, 11, 5, 6), 40_000), color=GOLD,
            fontsize=10.5, fontweight="bold", ha="center", arrowprops=dict(arrowstyle="-|>", color=GOLD, lw=1.2))
for a in (a1, a2):
    for t, col in ((T(2026, 11, 7, 9), GOLD), (T(2026, 11, 8, 20), PURPLE), (T(2026, 11, 11, 21), GREEN)):
        a.axvline(t, color=col, ls="--", lw=1, alpha=0.6)
a2.xaxis.set_major_formatter(mdates.DateFormatter("%b %d"))
a2.set_xlim(X0, X1 + dt.timedelta(hours=60))
fig.text(0.125, 0.04, "PRNTR · NVIDIA: Bitunix NVDAUSDT 1-hour perpetual (trades 24/7) · coins: GeckoTerminal hourly, market cap = price × 1B supply · "
         "dashed lines: Nov 7 FT report, Nov 8 email, Nov 11 resignation news · times in UTC · a chart study, not a live signal · education only",
         color=MUTE, fontsize=9)
fig.savefig(f"{OUT}/4_NVDA_1h_turn_and_coins.png", facecolor=BG, bbox_inches="tight")
print("ok", R)
