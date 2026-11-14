"""PRNTR Crossover charts from real daily (or weekly) candles. Data: Yahoo JSON in ./data.

The Box is drawn from the CLOSES in the box window (ceiling = highest close, floor = lowest close, middle halfway).
A Fake-Out is a candle whose wick pokes well beyond the ceiling or floor but closes back inside (the Return).
The Launch is the first close outside the Box after the box window ends. Everything is measured, nothing is drawn by hand.

chart(...) returns the measured numbers so the course text can quote them.
pair_chart(...) puts the stock's closes on top and a memecoin's REPORTED market-cap points underneath, on one clock.
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
UP, DN, CYAN, BOX, GOLD = "#22c55e", "#ef4444", "#2aabe3", "#7c5cff", "#e0b84a"


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


def weekly(rows):
    out, cur = [], None
    for d0, o, h, l, c in rows:
        k = d0 - dt.timedelta(days=d0.weekday())
        if cur and cur[0] == k:
            cur = [k, cur[1], max(cur[2], h), min(cur[3], l), c]
        else:
            if cur:
                out.append(tuple(cur))
            cur = [k, o, h, l, c]
    if cur:
        out.append(tuple(cur))
    return out


def _d(s):
    return dt.date.fromisoformat(s) if isinstance(s, str) else s


def _style(ax, fig):
    fig.patch.set_facecolor(BG)
    ax.set_facecolor(BG)
    ax.tick_params(colors=MUTE, labelsize=9)
    ax.grid(color=GRID, linewidth=0.6)
    for s in ax.spines.values():
        s.set_color(GRID)


def measure(rows, box_start, box_end, min_poke=0.12):
    box = [r for r in rows if _d(box_start) <= r[0] <= _d(box_end)]
    if not box:
        raise ValueError("no data in the box window")
    ceil, floor = max(r[4] for r in box), min(r[4] for r in box)
    hgt = ceil - floor
    up = max(box, key=lambda r: r[2])
    dn = min(box, key=lambda r: r[3])
    fo_up = up if up[2] - ceil >= hgt * min_poke else None
    fo_dn = dn if floor - dn[3] >= hgt * min_poke else None
    after = [r for r in rows if r[0] > box[-1][0]]
    launch = next((r for r in after if r[4] > ceil or r[4] < floor), None)
    res = {"ceiling": ceil, "floor": floor, "middle": (ceil + floor) / 2, "box_days": len(box),
           "box_from": box[0][0], "box_to": box[-1][0], "fake_up": fo_up, "fake_down": fo_dn, "launch": None}
    if launch:
        side = "up" if launch[4] > ceil else "down"
        post = [r for r in after if r[0] >= launch[0]]
        if side == "up":
            ext = max(post, key=lambda r: r[2])
            move = (ext[2] / ceil - 1) * 100
        else:
            ext = min(post, key=lambda r: r[3])
            move = (1 - ext[3] / floor) * 100
        res["launch"] = {"date": launch[0], "close": launch[4], "side": side, "extreme": ext[2] if side == "up" else ext[3],
                         "extreme_date": ext[0], "move_pct": move}
    return box, res


def chart(ticker, start, end, box_start, box_end, title, out_png, events=(), note=None, wk=False, min_poke=0.12,
          labels=True):
    rows = load(ticker)
    if wk:
        rows = weekly(rows)
    rows = [r for r in rows if _d(start) <= r[0] <= _d(end)]
    box, m = measure(rows, box_start, box_end, min_poke)
    w = 0.32 * (7 if wk else 1)
    fig, ax = plt.subplots(figsize=(12, 6.2), dpi=150)
    _style(ax, fig)
    for d0, o, h, l, c in rows:
        x = mdates.date2num(d0)
        col = UP if c >= o else DN
        ax.vlines(x, l, h, color=col, linewidth=0.9)
        ax.add_patch(Rectangle((x - w, min(o, c)), 2 * w, max(abs(c - o), (h - l) * 0.01), color=col, linewidth=0))
    pad = 3.5 if wk else 0.5
    x0, x1 = mdates.date2num(box[0][0]) - pad, mdates.date2num(box[-1][0]) + pad
    top, bot = m["ceiling"], m["floor"]
    ax.add_patch(Rectangle((x0, bot), x1 - x0, top - bot, facecolor=BOX, alpha=0.13, edgecolor=BOX, linewidth=1.4))
    ax.text(x0, top, " The Box", color=BOX, fontsize=11, fontweight="bold", va="bottom")
    ax.hlines(m["middle"], x0, x1, colors=BOX, linestyles="--", linewidth=0.9, alpha=0.8)
    if labels:
        ax.text(x1, top, "  ceiling", color=BOX, fontsize=9, va="center")
        ax.text(x1, bot, "  floor", color=BOX, fontsize=9, va="center")
        ax.text(x1, m["middle"], "  middle", color=BOX, fontsize=9, va="center", alpha=0.9)
    ylo, yhi = min(r[3] for r in rows), max(r[2] for r in rows)
    span = yhi - ylo
    if m["fake_up"]:
        r = m["fake_up"]
        ax.annotate("Fake-Out", (mdates.date2num(r[0]), r[2]), xytext=(0, 18), textcoords="offset points", ha="center",
                    color=GOLD, fontsize=10, fontweight="bold", arrowprops=dict(arrowstyle="->", color=GOLD))
    if m["fake_down"]:
        r = m["fake_down"]
        ax.annotate("Fake-Out", (mdates.date2num(r[0]), r[3]), xytext=(0, -24), textcoords="offset points", ha="center",
                    color=GOLD, fontsize=10, fontweight="bold", arrowprops=dict(arrowstyle="->", color=GOLD))
    L = m["launch"]
    if L:
        col = UP if L["side"] == "up" else DN
        txt = "Launch: closes above the ceiling" if L["side"] == "up" else "Launch: closes below the floor"
        dy = -42 if L["side"] == "up" else 36
        ax.annotate(txt, (mdates.date2num(L["date"]), L["close"]), xytext=(18, dy), textcoords="offset points",
                    color=col, fontsize=11, fontweight="bold", arrowprops=dict(arrowstyle="->", color=col))
    for i, ev in enumerate(events):
        d0, lab = ev[0], ev[1]
        ex = mdates.date2num(_d(d0))
        ax.axvline(ex, color=CYAN, linewidth=1.1, linestyle=":")
        ax.text(ex, yhi + span * (0.02 - 0.055 * (i % 2)), " " + lab, color=CYAN, fontsize=9.5, va="top")
    ax.set_ylim(ylo - span * 0.08, yhi + span * 0.1)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %d\n%Y"))
    ax.set_title(title, color=TXT, fontsize=15, loc="left", fontweight="bold", pad=12)
    if note:
        fig.text(0.012, 0.012, note, color=MUTE, fontsize=9)
    fig.text(0.99, 0.012, f"PRNTR · {'weekly' if wk else 'daily'} candles · real prices · education only", color=MUTE,
             fontsize=9, ha="right")
    fig.tight_layout()
    fig.subplots_adjust(bottom=0.14)
    fig.savefig(out_png, facecolor=BG)
    plt.close(fig)
    return m


def _fmt_usd(v):
    if v >= 1e9:
        return f"${v / 1e9:.1f}B"
    if v >= 1e6:
        return f"${v / 1e6:.0f}M" if v >= 1e7 else f"${v / 1e6:.1f}M"
    if v >= 1e3:
        return f"${v / 1e3:.0f}K"
    return f"${v:.2f}" if v < 10 else f"${v:,.0f}"


def pair_chart(ticker, start, end, coin_name, points, title, out_png, events=(), coin_unit="market cap", note=None):
    """points: [(date, value, label_or_None)] reported figures for the coin (market cap or price)."""
    rows = [r for r in load(ticker) if _d(start) <= r[0] <= _d(end)]
    fig, (a1, a2) = plt.subplots(2, 1, figsize=(12, 6.6), dpi=150, sharex=True, gridspec_kw={"height_ratios": [1.15, 1]})
    _style(a1, fig)
    _style(a2, fig)
    xs = [mdates.date2num(r[0]) for r in rows]
    a1.plot(xs, [r[4] for r in rows], color=CYAN, linewidth=1.8)
    a1.set_ylabel(f"{ticker.split('_')[0]} close ($)", color=MUTE, fontsize=10)
    px = [mdates.date2num(_d(p[0])) for p in points]
    py = [p[1] for p in points]
    a2.plot(px, py, color=GOLD, linewidth=1.6, marker="o", markersize=6)
    a2.set_yscale("log")
    a2.set_ylabel(f"{coin_name} {coin_unit}\n(reported, log scale)", color=MUTE, fontsize=10)
    for (d0, v, lab), x in zip(points, px):
        a2.annotate(lab or _fmt_usd(v), (x, v), xytext=(0, 9), textcoords="offset points", ha="center", color=TXT, fontsize=9)
    lo, hi = min(py), max(py)
    a2.set_ylim(lo / 3, hi * 4)
    for ev in events:
        for a in (a1, a2):
            a.axvline(mdates.date2num(_d(ev[0])), color=CYAN, linewidth=1, linestyle=":")
        a1.text(mdates.date2num(_d(ev[0])), a1.get_ylim()[1], " " + ev[1], color=CYAN, fontsize=9.5, va="top")
    a2.xaxis.set_major_formatter(mdates.DateFormatter("%b %d\n%Y"))
    a1.set_title(title, color=TXT, fontsize=15, loc="left", fontweight="bold", pad=12)
    fig.text(0.012, 0.012, note or "Coin points are figures reported at the time (see sources), not candles.", color=MUTE, fontsize=9)
    fig.text(0.99, 0.012, "PRNTR · same clock · education only", color=MUTE, fontsize=9, ha="right")
    fig.tight_layout()
    fig.subplots_adjust(bottom=0.12, hspace=0.08)
    fig.savefig(out_png, facecolor=BG)
    plt.close(fig)


def money_chart(rows, title, out_png):
    """rows: [(label, multiple)] -> what $10 became at the top, as bars (log)."""
    fig, ax = plt.subplots(figsize=(12, 6.2), dpi=150)
    _style(ax, fig)
    ax.set_axisbelow(True)
    labs = [r[0] for r in rows][::-1]
    vals = [10 * r[1] for r in rows][::-1]
    bars = ax.barh(labs, vals, color=[GOLD if v >= 1000 else CYAN for v in vals])
    ax.set_xscale("log")
    for b, v in zip(bars, vals):
        ax.text(v * 1.08, b.get_y() + b.get_height() / 2, f"${v:,.0f}", va="center", color=TXT, fontsize=10)
    ax.tick_params(axis="y", labelsize=10, colors=TXT)
    ax.set_xlim(5, max(vals) * 6)
    ax.set_title(title, color=TXT, fontsize=15, loc="left", fontweight="bold", pad=12)
    fig.text(0.012, 0.012, "What $10 became if sold at the reported top. Nobody sells the exact top: see the realistic column in the course.",
             color=MUTE, fontsize=9)
    fig.tight_layout()
    fig.subplots_adjust(bottom=0.1)
    fig.savefig(out_png, facecolor=BG)
    plt.close(fig)
