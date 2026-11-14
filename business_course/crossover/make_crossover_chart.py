"""PRNTR Crossover charts: a stock's real daily candles around a news event, with the PRNTR Box drawn on the range
before the move, the Turn marked, and the event date. Data: Yahoo daily JSON in ./data (downloaded for the course).

usage (from the course builder):
    chart(ticker, start, end, box_start, box_end, event_date, title, out_png, direction="up"|"down", note=None)
"""
import json
import datetime as dt
import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.patches import Rectangle

HERE = os.path.dirname(os.path.abspath(__file__))
BG, GRID, TXT, MUTE = "#0b0d14", "#1c2030", "#e8ecf4", "#8b93a7"
UP, DN, CYAN, BOX = "#22c55e", "#ef4444", "#2aabe3", "#7c5cff"


def load(ticker):
    d = json.load(open(os.path.join(HERE, "data", f"{ticker}.json")))["chart"]["result"][0]
    q = d["indicators"]["quote"][0]
    rows = []
    for i, t in enumerate(d["timestamp"]):
        o, h, l, c = q["open"][i], q["high"][i], q["low"][i], q["close"][i]
        if None in (o, h, l, c):
            continue
        rows.append((dt.datetime.utcfromtimestamp(t).date(), o, h, l, c))
    return rows


def _d(s):
    return dt.date.fromisoformat(s)


def chart(ticker, start, end, box_start, box_end, event_date, title, out_png, direction="up", note=None):
    rows = [r for r in load(ticker) if _d(start) <= r[0] <= _d(end)]
    box = [r for r in rows if _d(box_start) <= r[0] <= _d(box_end)]
    if not rows or not box:
        raise ValueError(f"{ticker}: no data in the window")
    top, bot = max(r[2] for r in box), min(r[3] for r in box)
    fig, ax = plt.subplots(figsize=(12, 6.2), dpi=150)
    fig.patch.set_facecolor(BG)
    ax.set_facecolor(BG)
    for d0, o, h, l, c in rows:
        x = mdates.date2num(d0)
        col = UP if c >= o else DN
        ax.vlines(x, l, h, color=col, linewidth=0.9)
        ax.add_patch(Rectangle((x - 0.32, min(o, c)), 0.64, max(abs(c - o), (h - l) * 0.01), color=col, linewidth=0))
    x0, x1 = mdates.date2num(box[0][0]) - 0.5, mdates.date2num(box[-1][0]) + 0.5
    ax.add_patch(Rectangle((x0, bot), x1 - x0, top - bot, facecolor=BOX, alpha=0.12, edgecolor=BOX, linewidth=1.4))
    ax.text(x0 + 0.4, top, " The Box", color=BOX, fontsize=11, fontweight="bold", va="bottom")
    ax.axhline((top + bot) / 2, xmin=0, xmax=1, color=BOX, alpha=0.0)
    ax.hlines((top + bot) / 2, x0, x1, colors=BOX, linestyles="--", linewidth=0.9, alpha=0.8)
    ax.text(x1, (top + bot) / 2, "  middle", color=BOX, fontsize=9, va="center", alpha=0.9)
    ex = mdates.date2num(_d(event_date))
    ax.axvline(ex, color=CYAN, linewidth=1.2, linestyle=":")
    ylo, yhi = min(r[3] for r in rows), max(r[2] for r in rows)
    ax.text(ex, ylo, "  news / event", color=CYAN, fontsize=10, va="bottom")
    after = [r for r in rows if r[0] > box[-1][0]]
    if after:
        if direction == "up":
            hit = next((r for r in after if r[4] > top), None)
            if hit:
                ax.annotate("Turn up: the Launch Pad", (mdates.date2num(hit[0]), hit[4]), xytext=(15, -40),
                            textcoords="offset points", color=UP, fontsize=11, fontweight="bold",
                            arrowprops=dict(arrowstyle="->", color=UP))
        else:
            hit = next((r for r in after if r[4] < bot), None)
            if hit:
                ax.annotate("Turn down: the trip across", (mdates.date2num(hit[0]), hit[4]), xytext=(15, 35),
                            textcoords="offset points", color=DN, fontsize=11, fontweight="bold",
                            arrowprops=dict(arrowstyle="->", color=DN))
    ax.set_ylim(ylo - (yhi - ylo) * 0.06, yhi + (yhi - ylo) * 0.08)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %d\n%Y"))
    ax.tick_params(colors=MUTE, labelsize=9)
    ax.grid(color=GRID, linewidth=0.6)
    for s in ax.spines.values():
        s.set_color(GRID)
    ax.set_title(title, color=TXT, fontsize=15, loc="left", fontweight="bold", pad=12)
    if note:
        fig.text(0.012, 0.012, note, color=MUTE, fontsize=9)
    fig.text(0.99, 0.012, "PRNTR · daily candles · education only", color=MUTE, fontsize=9, ha="right")
    fig.tight_layout()
    fig.subplots_adjust(bottom=0.14)
    fig.savefig(out_png, facecolor=BG)
    plt.close(fig)
    return {"box_top": top, "box_bottom": bot, "first": rows[0], "last": rows[-1]}


if __name__ == "__main__":
    out = os.path.join(HERE, "test_GME.png")
    print(chart("GME", "2024-03-15", "2024-06-20", "2024-03-20", "2024-05-10", "2024-05-13",
                "GME · Roaring Kitty returns", out, "up"))
