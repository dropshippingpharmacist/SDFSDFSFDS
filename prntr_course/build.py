"""Builds the PRNTR course (Modules 0-3) as a PDF workbook and a slide deck.

Usage:  python3 -I build.py "Student Name" student@email.com
The name and email are printed in the footer of every page (leak tracing).
"""
import random, sys, os, subprocess, html

STUDENT = sys.argv[1] if len(sys.argv) > 1 else "STUDENT NAME"
EMAIL = sys.argv[2] if len(sys.argv) > 2 else "student@email.com"
OUT = os.path.dirname(os.path.abspath(__file__))

INK, GREEN, RED, GOLD, MUTE, LINE, PAPER, MINT = (
    "#0d2b24", "#1f9d6b", "#d1495b", "#e0a526", "#5e6f69", "#d6e0dc", "#ffffff", "#e3f4ec")


# ---------------------------------------------------------------- charts
def candles_from_path(points, per_leg=6, seed=1, noise=0.25, wick=0.35):
    rnd = random.Random(seed)
    out, prev = [], points[0]
    for a, b in zip(points, points[1:]):
        for i in range(1, per_leg + 1):
            target = a + (b - a) * i / per_leg
            c = target + rnd.uniform(-noise, noise)
            o = prev
            hi = max(o, c) + rnd.uniform(0.05, wick)
            lo = min(o, c) - rnd.uniform(0.05, wick)
            out.append([o, hi, lo, c])
            prev = c
    return out


class Chart:
    def __init__(self, candles, w=640, h=260, lo=None, hi=None, pad=10):
        self.c, self.w, self.h, self.pad = candles, w, h, pad
        self.lo = lo if lo is not None else min(x[2] for x in candles) - 1
        self.hi = hi if hi is not None else max(x[1] for x in candles) + 1
        self.items = []

    def x(self, i):
        step = (self.w - 2 * self.pad) / len(self.c)
        return self.pad + step * (i + 0.5)

    def y(self, p):
        return self.pad + (self.hi - p) / (self.hi - self.lo) * (self.h - 2 * self.pad)

    def step(self):
        return (self.w - 2 * self.pad) / len(self.c)

    def box(self, i0, i1, top, bot, fill=MINT, stroke=GREEN, label=None):
        x0, x1 = self.x(i0) - self.step() / 2, self.x(i1) + self.step() / 2
        self.items.insert(0, f'<rect x="{x0:.1f}" y="{self.y(top):.1f}" width="{x1-x0:.1f}" height="{self.y(bot)-self.y(top):.1f}" fill="{fill}" stroke="{stroke}" stroke-width="1.5" stroke-dasharray="5 4" rx="3"/>')
        if label:
            self.text(i0, top, label, dy=-6, color=stroke, anchor="start", size=12, weight=700)

    def hline(self, p, color=GREEN, label=None, i0=0, i1=None, dash="6 4", side="end"):
        i1 = len(self.c) - 1 if i1 is None else i1
        xa, xb = self.x(i0) - self.step() / 2, self.x(i1) + self.step() / 2
        self.items.append(f'<line x1="{xa:.1f}" x2="{xb:.1f}" y1="{self.y(p):.1f}" y2="{self.y(p):.1f}" stroke="{color}" stroke-width="2" stroke-dasharray="{dash}"/>')
        if label:
            xx = xb - 2 if side == "end" else xa + 2
            self.items.append(f'<text x="{xx:.1f}" y="{self.y(p)-5:.1f}" text-anchor="{"end" if side=="end" else "start"}" font-size="12" font-weight="700" fill="{color}">{label}</text>')

    def text(self, i, p, s, dy=0, color=INK, anchor="middle", size=12, weight=600):
        self.items.append(f'<text x="{self.x(i):.1f}" y="{self.y(p)+dy:.1f}" text-anchor="{anchor}" font-size="{size}" font-weight="{weight}" fill="{color}">{html.escape(s)}</text>')

    def arrow(self, i0, p0, i1, p1, color=INK):
        self.items.append(f'<line x1="{self.x(i0):.1f}" y1="{self.y(p0):.1f}" x2="{self.x(i1):.1f}" y2="{self.y(p1):.1f}" stroke="{color}" stroke-width="2" marker-end="url(#ah)"/>')

    def circle(self, i, p, color=GOLD, r=14):
        self.items.append(f'<circle cx="{self.x(i):.1f}" cy="{self.y(p):.1f}" r="{r}" fill="none" stroke="{color}" stroke-width="2.5"/>')

    def dots(self, i0, i1, p, color=RED, label=None):
        for i in range(i0, i1 + 1, 2):
            self.items.append(f'<circle cx="{self.x(i):.1f}" cy="{self.y(p):.1f}" r="3.5" fill="{color}"/>')
        if label:
            self.text((i0 + i1) // 2, p, label, dy=-9, color=color, size=11)

    def svg(self):
        parts = [f'<svg viewBox="0 0 {self.w} {self.h}" width="100%" xmlns="http://www.w3.org/2000/svg">',
                 '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="context-stroke"/></marker></defs>']
        parts += [it for it in self.items if it.startswith("<rect")]
        cw = max(3, self.step() * 0.6)
        for i, (o, h, l, c) in enumerate(self.c):
            col = GREEN if c >= o else RED
            x = self.x(i)
            parts.append(f'<line x1="{x:.1f}" x2="{x:.1f}" y1="{self.y(h):.1f}" y2="{self.y(l):.1f}" stroke="{col}" stroke-width="1.4"/>')
            top, bot = self.y(max(o, c)), self.y(min(o, c))
            parts.append(f'<rect x="{x-cw/2:.1f}" y="{top:.1f}" width="{cw:.1f}" height="{max(1.5, bot-top):.1f}" fill="{col}"/>')
        parts += [it for it in self.items if not it.startswith("<rect")]
        parts.append("</svg>")
        return "".join(parts)


def fig_candle_anatomy():
    s = [f'<svg viewBox="0 0 640 250" width="100%" xmlns="http://www.w3.org/2000/svg">']
    def one(cx, o, c, h, l, col, name):
        y = lambda p: 20 + (120 - p) * 2
        s.append(f'<line x1="{cx}" x2="{cx}" y1="{y(h)}" y2="{y(l)}" stroke="{col}" stroke-width="3"/>')
        s.append(f'<rect x="{cx-28}" y="{y(max(o,c))}" width="56" height="{abs(y(o)-y(c))}" fill="{col}" rx="3"/>')
        s.append(f'<text x="{cx}" y="245" text-anchor="middle" font-size="14" font-weight="700" fill="{col}">{name}</text>')
        return y
    y = one(160, 40, 95, 112, 25, GREEN, "Green = price went UP")
    lab = [(112, "High: the highest price reached"), (95, "Close: where it ended"),
           (40, "Open: where it started"), (25, "Low: the lowest price reached")]
    for p, t in lab:
        s.append(f'<line x1="196" x2="236" y1="{y(p)}" y2="{y(p)}" stroke="{MUTE}" stroke-width="1"/><text x="240" y="{y(p)+4}" font-size="12" fill="{INK}">{t}</text>')
    one(530, 95, 40, 108, 30, RED, "Red = price went DOWN")
    s.append(f'<text x="470" y="{y(70)}" font-size="11" fill="{MUTE}" text-anchor="end">body</text><text x="470" y="{y(104)}" font-size="11" fill="{MUTE}" text-anchor="end">wick</text>')
    s.append("</svg>")
    return "".join(s)


def fig_trends():
    up = Chart(candles_from_path([100, 106, 103, 110, 107, 115, 112, 119], 5, seed=3), 300, 200)
    up.text(9, 106, "higher high", dy=-12, color=GREEN, size=10)
    up.text(14, 103, "higher low", dy=22, color=GREEN, size=10)
    dn = Chart(candles_from_path([119, 113, 116, 109, 112, 104, 107, 100], 5, seed=4), 300, 200)
    dn.text(9, 113, "lower low", dy=22, color=RED, size=10)
    dn.text(14, 116, "lower high", dy=-14, color=RED, size=10)
    sd = Chart(candles_from_path([105, 110, 101, 109, 102, 110, 101, 108], 5, seed=5), 300, 200)
    return up.svg(), dn.svg(), sd.svg()


def fig_dolls():
    s = [f'<svg viewBox="0 0 640 230" width="100%" xmlns="http://www.w3.org/2000/svg">']
    boxes = [(20, 20, 600, 190, "#eaf3ef", "DAILY chart: the big picture (where are we?)"),
             (150, 60, 330, 130, "#d3ebe0", "4-HOUR chart: the setup (what is forming?)"),
             (300, 100, 140, 70, "#b6dfcb", "15-MIN: the entry")]
    for x, y, w, h, f, t in boxes:
        s.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{f}" stroke="{GREEN}" stroke-width="1.5"/>')
        s.append(f'<text x="{x+10}" y="{y+19}" font-size="12.5" font-weight="700" fill="{INK}">{t}</text>')
    s.append("</svg>")
    return "".join(s)


def range_candles(seed=7):
    pts = [80, 88, 96, 104, 110, 100, 109, 101, 110, 100, 108, 102]
    c = candles_from_path(pts, 5, seed=seed, noise=0.4)
    return c


def fig_box():
    c = range_candles()
    ch = Chart(c, 640, 270, 78, 116)
    ch.box(19, len(c) - 1, 110.5, 99.5, label="THE BOX")
    ch.hline(110.5, GREEN, "Ceiling", 19)
    ch.hline(99.5, GREEN, "Floor", 19)
    ch.text(8, 92, "the trend in", dy=0, color=MUTE, anchor="end", size=12)
    for i, p in [(24, 110.5), (34, 110.5), (44, 110.5), (29, 99.5), (39, 99.5), (49, 99.5)]:
        ch.circle(i, p, GOLD, 9)
    return ch.svg()


def fig_vshape():
    c = candles_from_path([112, 106, 100, 94, 100, 106, 112], 5, seed=9)
    ch = Chart(c, 300, 200, 90, 114)
    ch.text(15, 94, "one touch, straight back", dy=14, color=RED, size=11)
    return ch.svg()


def fig_realbox():
    c = candles_from_path([104, 110, 100, 110, 101, 109, 100, 110], 5, seed=11)
    ch = Chart(c, 300, 200)
    ch.box(5, len(c) - 1, 110.6, 99.6)
    return ch.svg()


def fig_middle():
    c = candles_from_path([100, 110, 100, 110, 101, 109, 100, 105], 5, seed=12)
    ch = Chart(c, 640, 240, 96, 114)
    ch.box(0, len(c) - 1, 110.5, 99.5)
    ch.hline(105, GOLD, None, dash="3 3")
    ch.text(len(c) - 3, 105, "Middle: no-trade zone", dy=-5, color="#9a6e00", anchor="end", size=12, weight=800)
    ch.text(len(c) - 3, 110.5, "Top: expensive, look to SELL", dy=-6, color=RED, anchor="end", size=12)
    ch.text(len(c) - 3, 99.5, "Bottom: cheap, look to BUY", dy=17, color=GREEN, anchor="end", size=12)
    return ch.svg()


def sweep_candles(seed=21, above=True):
    pts = [100, 110, 100, 110, 101, 109, 101, 106, 109.5]
    c = candles_from_path(pts, 5, seed=seed, noise=0.35)
    if above:
        last = c[-1][3]
        c.append([last, 113.2, last - 0.3, 109.2])     # the fake-out wick
        c += candles_from_path([109.2, 104, 101], 4, seed=seed + 1)[:]
    return c


def fig_fakeout():
    c = sweep_candles()
    ch = Chart(c, 640, 270, 96, 116)
    k = 40
    ch.box(0, k - 1, 110.5, 99.5)
    ch.hline(110.5, GREEN, "Ceiling", 0, len(c) - 1, side="start")
    ch.dots(26, 38, 111.6, RED, "stop-losses waiting here")
    ch.circle(k, 113.2, GOLD, 13)
    ch.text(k, 113.2, "THE FAKE-OUT", dy=-18, color=INK, size=13, weight=800)
    ch.arrow(k + 2, 108, k + 6, 103, INK)
    ch.text(k + 5, 99, "back inside", dy=0, color=INK, anchor="end", size=12, weight=800)
    return ch.svg()


def fig_breakout():
    pts = [100, 110, 100, 110, 101, 109, 101, 106, 109.5]
    c = candles_from_path(pts, 5, seed=31, noise=0.35)
    c += candles_from_path([109.5, 113, 116, 115, 119, 122], 4, seed=32)
    ch = Chart(c, 300, 210, 96, 124)
    ch.box(0, 39, 110.5, 99.5)
    ch.text(48, 116, "closes outside", dy=-12, color=RED, size=11)
    ch.text(48, 116, "and keeps going", dy=2, color=RED, size=11)
    return ch.svg()


def fig_goodfake():
    c = sweep_candles(seed=41)
    ch = Chart(c, 300, 210, 96, 116)
    ch.box(0, 39, 110.5, 99.5)
    ch.circle(40, 113.2, GOLD, 10)
    ch.text(30, 114, "pokes out, closes back in", dy=-4, color=GREEN, size=11)
    return ch.svg()


def fig_both_sides():
    pts = [100, 110, 100, 110, 101, 109, 101.5, 104, 100.5]
    c = candles_from_path(pts, 5, seed=51, noise=0.35)
    last = c[-1][3]
    c.append([last, last + 0.4, 96.6, 100.6])     # sweep below the floor
    c += candles_from_path([100.6, 104, 107, 110], 5, seed=52)
    ch = Chart(c, 640, 280, 94, 114)
    ch.box(0, 39, 110.5, 99.5)
    ch.hline(99.5, GREEN, "Floor", 0, len(c) - 1, side="start")
    ch.hline(110.5, GREEN, "Ceiling: the target", 0, len(c) - 1)
    ch.dots(25, 38, 98.4, RED, "stop-losses below the floor")
    ch.circle(40, 96.6, GOLD, 13)
    ch.text(40, 96.6, "1. Fake-out below", dy=30, color=INK, size=12, weight=800)
    ch.text(46, 101.5, "2. The Return", dy=0, color=INK, anchor="start", size=12, weight=800)
    ch.arrow(48, 104.5, len(c) - 3, 109.3, GREEN)
    ch.text(len(c) - 4, 107, "3. The trip across", dy=0, color=GREEN, anchor="end", size=12, weight=800)
    return ch.svg()


def fig_failed_return():
    pts = [100, 110, 100, 110, 101, 109, 101.5, 104, 100.5]
    c = candles_from_path(pts, 5, seed=61, noise=0.35)
    last = c[-1][3]
    c.append([last, last + 0.3, 96.8, 98.6])
    c += candles_from_path([98.6, 97, 95, 93], 4, seed=62)
    ch = Chart(c, 300, 210, 90, 113)
    ch.box(0, 39, 110.5, 99.5)
    ch.text(30, 93, "never gets back in", dy=0, color=RED, size=11)
    return ch.svg()


def fig_funnel_setups():
    s = [f'<svg viewBox="0 0 640 170" width="100%" xmlns="http://www.w3.org/2000/svg">']
    rows = [(100, "100 charts the bot looks at", "#c9d6d1"), (20, "20 have a box", "#9ec9b5"),
            (6, "6 have a fake-out and return", GOLD), (1, "1 passes every check: TRADE", GREEN)]
    for k, (n, t, col) in enumerate(rows):
        w = 30 + 5.7 * n
        y = 10 + k * 38
        s.append(f'<rect x="0" y="{y}" width="{w:.0f}" height="30" rx="6" fill="{col}"/>')
        s.append(f'<text x="{w+10:.0f}" y="{y+20}" font-size="13" font-weight="700" fill="{INK}">{t}</text>')
    s.append("</svg>")
    return "".join(s)


def fig_risk_math():
    s = [f'<svg viewBox="0 0 640 200" width="100%" xmlns="http://www.w3.org/2000/svg">']
    s.append(f'<text x="0" y="16" font-size="13" font-weight="700" fill="{INK}">10 trades. Risk $1 to make $3. Lose 6, win 4.</text>')
    for i in range(10):
        win = i in (1, 4, 6, 9)
        x = 10 + i * 60
        h = 90 if win else 30
        col = GREEN if win else RED
        y = 120 - h if win else 120
        s.append(f'<rect x="{x}" y="{y}" width="44" height="{h}" rx="4" fill="{col}"/>')
        s.append(f'<text x="{x+22}" y="{(y-6) if win else (y+h+15)}" text-anchor="middle" font-size="12" font-weight="700" fill="{col}">{"+$3" if win else "-$1"}</text>')
    s.append(f'<line x1="0" x2="620" y1="120" y2="120" stroke="{INK}" stroke-width="1.5"/>')
    s.append(f'<text x="0" y="190" font-size="14" font-weight="800" fill="{GREEN}">Total: -$6 + $12 = +$6, while losing most of the trades.</text>')
    s.append("</svg>")
    return "".join(s)


# ---------------------------------------------------------------- content
UP, DN, SIDE = fig_trends()
F = dict(anatomy=fig_candle_anatomy(), up=UP, down=DN, side=SIDE, dolls=fig_dolls(), box=fig_box(),
         vshape=fig_vshape(), realbox=fig_realbox(), middle=fig_middle(), fakeout=fig_fakeout(),
         breakout=fig_breakout(), goodfake=fig_goodfake(), both=fig_both_sides(),
         failed=fig_failed_return(), funnel=fig_funnel_setups(), risk=fig_risk_math())

MODULES = [
    dict(n=0, title="The PRNTR Mindset", tag="Think like a doctor, not a gambler",
         kid="Most people trade like they are playing a slot machine. PRNTR traders trade like a doctor follows a checklist. "
             "We wait for one very specific picture on the chart, we decide how much we can lose before we start, "
             "and we skip everything else. Skipping is the skill.",
         lessons=[
             ("0.1 Trading is a business with rules",
              "<p>A doctor doesn't guess. They check the same things, in the same order, every time, because even smart people make mistakes when they are tired or emotional. Trading is the same. PRNTR is a checklist for the chart.</p>"
              "<div class='rule'><b>PRNTR rule:</b> if a trade is not on the checklist, it does not exist.</div>"),
             ("0.2 Most setups get skipped",
              "<p>The PRNTR bot looks at hundreds of charts every day. Almost all of them fail at least one check. That's normal and good. A trader who takes every setup is like a doctor who prescribes medicine to everyone in the waiting room.</p>"
              "{funnel}<p class='cap'>Illustration: out of every 100 charts, very few become a trade.</p>"),
             ("0.3 Risk first, profit second",
              "<p>Before every trade we answer one question: <b>how much do I lose if I'm wrong?</b> Only then do we look at how much we could make. A trade must pay at least a few times what it risks.</p>"
              "{risk}<p class='cap'>Why this works: you can be wrong more often than you're right and still grow the account.</p>"),
             ("0.4 The three PRNTR promises",
              "<ol><li><b>I wait.</b> No setup, no trade, no matter how bored I am.</li>"
              "<li><b>I decide my loss first.</b> In dollars, before I click.</li>"
              "<li><b>I never move my stop further away.</b> If I'm wrong, I'm wrong, and that's fine.</li></ol>"),
         ],
         quiz=[("The bot skips most charts. Is that a problem?", "No. Skipping bad setups is the whole skill."),
               ("What question do you answer before every trade?", "How much do I lose if I'm wrong?"),
               ("You risk $1 to make $3. You win 4 trades and lose 6. Are you up or down?", "Up $6: you lose $6 and win $12.")]),

    dict(n=1, title="Reading the Chart Like a Story", tag="Candles, trends and the Russian dolls",
         kid="A chart is just a story of what price did. Each candle is one chapter: where price started, how high it went, how low it went and where it ended. "
             "Put the chapters together and you see whether the story is going up, going down or going sideways.",
         lessons=[
             ("1.1 One candle, four numbers", "{anatomy}<p>Every candle shows four prices for one period of time: open, high, low and close. The thick part is the <b>body</b>. The thin lines are the <b>wicks</b>. A long wick means price went there and got pushed back.</p>"
              "<div class='rule'><b>PRNTR rule:</b> wicks show where price was rejected. Remember this, it matters in Module 3.</div>"),
             ("1.2 Up, down or sideways",
              "<div class='three'><div>{up}<b>Uptrend</b><br>Each high is higher, each low is higher. Like climbing stairs.</div>"
              "<div>{down}<b>Downtrend</b><br>Each low is lower, each high is lower. Like walking down stairs.</div>"
              "<div>{side}<b>Sideways</b><br>Bouncing between a ceiling and a floor. This is where PRNTR hunts.</div></div>"),
             ("1.3 Timeframes are Russian dolls",
              "{dolls}<p>The same coin can be shown with one candle per day, per 4 hours or per 15 minutes. The bigger chart holds the smaller one, like Russian dolls. PRNTR always reads from big to small:</p>"
              "<ol><li><b>Big chart:</b> where are we in the bigger story?</li><li><b>Middle chart:</b> is a setup forming?</li><li><b>Small chart:</b> where exactly do I get in?</li></ol>"
              "<div class='rule'><b>PRNTR rule:</b> a setup on a small chart never beats what the big chart is saying.</div>"),
         ],
         quiz=[("What does a long wick at the top of a candle tell you?", "Price went up there and got pushed back down."),
               ("Higher highs and higher lows means what?", "An uptrend."),
               ("Which chart do you read first: 15-minute or daily?", "Daily. Always big to small.")]),

    dict(n=2, title="The Box", tag="Where price rests, and where the setup is born",
         kid="After price runs up or down for a while, it gets tired and rests. While it rests, it bounces between a ceiling and a floor. "
             "We draw a box around that. The box is where everybody puts their stop-losses, and that is exactly what makes it useful.",
         lessons=[
             ("2.1 Drawing the box",
              "{box}<p>Find where price stopped trending and started bouncing. Draw the <b>ceiling</b> at the top of the bounces and the <b>floor</b> at the bottom. Use the bodies and the main highs and lows, not one odd spike.</p>"
              "<ul><li>The circles are <b>touches</b>: each time price reaches the ceiling or floor and turns back.</li><li>More touches = a stronger box. Everybody can see it.</li></ul>"),
             ("2.2 A real box versus a V",
              "<div class='two'><div>{realbox}<b class='g'>✔ Real box</b><br>Several touches on both sides, flat, and it takes time to form.</div>"
              "<div>{vshape}<b class='r'>✘ Not a box</b><br>A V-shape: price drops and shoots straight back. No resting, no box.</div></div>"
              "<div class='rule'><b>PRNTR rule:</b> a box needs time. If it formed in a few candles, it isn't a box yet. Flat, not tilted. Touches on both sides.</div>"),
             ("2.3 The three zones of the box",
              "{middle}<p>Split the box in half. The <b>bottom half</b> is cheap: that's where we want to buy. The <b>top half</b> is expensive: that's where we want to sell. The <b>middle</b> is a coin flip, so we don't trade there.</p>"
              "<div class='rule'><b>PRNTR rule:</b> never buy in the top half, never sell in the bottom half, never trade the middle.</div>"),
             ("2.4 Why the box matters",
              "<p>Traders who bought near the floor put their stop-losses just <b>below</b> it. Traders who sold near the ceiling put theirs just <b>above</b> it. So every box has two piles of orders sitting right outside it. Big players know this. Module 3 is what they do with it.</p>"),
         ],
         quiz=[("Price drops fast and shoots straight back up in a few candles. Is that a box?", "No. That's a V-shape. A box needs time and touches on both sides."),
               ("Where in the box do PRNTR traders look to buy?", "The bottom half (cheap). Never the middle."),
               ("Where do traders who bought near the floor put their stop-losses?", "Just below the floor.")]),

    dict(n=3, title="The Fake-Out and the Return", tag="The trap that starts every PRNTR trade",
         kid="Big players need lots of orders to fill their big trades. The biggest piles of orders sit just outside the box. "
             "So price pokes outside the box, grabs those orders, and comes straight back in. That poke is the fake-out. "
             "When price comes back inside, it often runs all the way to the other side of the box.",
         lessons=[
             ("3.1 What a fake-out looks like",
              "{fakeout}<p>Price pushes just past the ceiling. Everyone who sold near the ceiling gets stopped out, and breakout buyers jump in. Then price closes <b>back inside</b> the box. The people who bought the breakout are now trapped.</p>"),
             ("3.2 Fake-out or real breakout?",
              "<div class='two'><div>{goodfake}<b class='g'>✔ Fake-out</b><br>A wick pokes out, but the candle closes back inside the box.</div>"
              "<div>{breakout}<b class='r'>✘ Real breakout</b><br>Candles close outside and keep going. The box is broken. No trade.</div></div>"
              "<div class='rule'><b>PRNTR rule:</b> a fake-out is a small poke, not a journey. If price closes far outside and keeps going, the idea is dead.</div>"),
             ("3.3 The Return, and the trip across",
              "{both}<p>This is the heart of PRNTR, shown here at the floor:</p>"
              "<ol><li><b>Fake-out:</b> price pokes below the floor and grabs the stop-losses.</li><li><b>The Return:</b> price closes back inside the box.</li><li><b>The trip across:</b> price often travels to the other side of the box. The ceiling becomes the target.</li></ol>"
              "<p>At the ceiling it's the same picture upside down: fake-out above, return inside, trip down to the floor.</p>"),
             ("3.4 When it fails",
              "<div class='two'><div>{failed}</div><div><p>Sometimes price pokes out and <b>never comes back</b>. That isn't a fake-out, it's a real move. This is why we never enter just because price poked out. We wait for the Return, and then for the Turn (Module 4).</p>"
              "<div class='rule'><b>PRNTR rule:</b> no Return, no trade.</div></div></div>"),
         ],
         quiz=[("A wick pokes above the ceiling but the candle closes back inside. What is it?", "A fake-out."),
               ("After a fake-out below the floor and a return inside, where is the target?", "The ceiling: the other side of the box."),
               ("Price pokes below the floor and keeps falling. Do you buy?", "No. No Return, no trade."),]),
]


def render_lesson(body):
    return body.format(**F)


# ---------------------------------------------------------------- workbook
CSS = f"""
@page {{ size: A4; margin: 12mm 13mm 15mm 13mm;
  @bottom-left {{ font-family: Inter, sans-serif; content: "PRNTR · Licensed to {STUDENT} ({EMAIL}) · Personal use only, do not share"; font-size: 7.5pt; color: #8a9893; }}
  @bottom-right {{ font-family: Inter, sans-serif; content: counter(page); font-size: 7.5pt; color: #8a9893; }} }}
* {{ box-sizing: border-box }}
body {{ font-family: Inter, 'DejaVu Sans', sans-serif; color: {INK}; font-size: 10.6pt; line-height: 1.5; margin: 0 }}
h1 {{ font-size: 26pt; margin: 0 0 4px; letter-spacing: -.01em }}
h2 {{ font-size: 13pt; margin: 14px 0 6px; padding-bottom: 3px; border-bottom: 2px solid {GREEN} ; break-after: avoid }}
p {{ margin: 0 0 7px }} ol, ul {{ margin: 3px 0 8px; padding-left: 20px }} li {{ margin: 2px 0 }}
.sec {{ break-before: page }}
.eye {{ font-size: 8.5pt; letter-spacing: .16em; text-transform: uppercase; font-weight: 800; color: {GREEN} }}
.tag {{ font-size: 12pt; color: {MUTE}; margin-bottom: 10px }}
.kid {{ background: {INK}; color: #fff; border-radius: 12px; padding: 12px 15px; margin: 8px 0 12px }}
.kid b {{ color: {GOLD}; font-size: 8.5pt; letter-spacing: .14em; text-transform: uppercase; display: block; margin-bottom: 3px }}
.rule {{ background: #fff6df; border-left: 4px solid {GOLD}; border-radius: 8px; padding: 7px 11px; margin: 7px 0; break-inside: avoid }}
.cap {{ font-size: 8.8pt; color: {MUTE} }}
.lesson {{ break-inside: avoid; margin-bottom: 6px }}
svg {{ display: block; margin: 4px 0 6px; background: #fbfdfc; border: 1px solid {LINE}; border-radius: 10px }}
.two, .three {{ display: grid; gap: 10px; font-size: 9.5pt }} .two {{ grid-template-columns: 1fr 1fr }} .three {{ grid-template-columns: 1fr 1fr 1fr }}
.g {{ color: {GREEN} }} .r {{ color: {RED} }}
.quiz {{ border: 1.5px solid {GREEN}; border-radius: 10px; padding: 9px 13px; margin-top: 10px; break-inside: avoid }}
.quiz h3 {{ margin: 0 0 4px; font-size: 11pt; color: {GREEN} }}
.cover {{ height: 268mm; border-radius: 16px; padding: 24mm 18mm; color: #fff; display: flex; flex-direction: column; justify-content: space-between;
  background: radial-gradient(circle at 85% 15%, #2a6e57 0, transparent 45%), linear-gradient(160deg, #0d2b24 0%, #123d32 60%, #1f9d6b 140%) }}
.logo {{ font-size: 64pt; font-weight: 900; letter-spacing: .06em; line-height: 1 }}
.logo span {{ color: {GOLD} }}
.toc div {{ display: flex; gap: 12px; padding: 7px 0; border-bottom: 1px solid {LINE} }}
.toc b {{ color: {GREEN}; min-width: 70px }}
table {{ border-collapse: collapse; width: 100%; font-size: 9.5pt }} td, th {{ border: 1px solid {LINE}; padding: 5px 8px; text-align: left; vertical-align: top }}
th {{ background: {INK}; color: #fff }}
"""


def workbook():
    h = [f"<!doctype html><html><head><meta charset='utf-8'><title>PRNTR Workbook</title><style>{CSS}</style></head><body>"]
    h.append(f"""<div class='cover'><div><div style='letter-spacing:.2em;font-size:10pt;color:#9fd9bf;font-weight:700'>THE PRNTR METHOD · STUDENT WORKBOOK</div>
      <div class='logo' style='margin-top:20px'>PRN<span>T</span>R</div>
      <div style='font-size:17pt;margin-top:14px;max-width:150mm;color:#d9efe5'>Part 1: Foundations. Modules 0–3: the mindset, reading the chart, the Box, and the Fake-Out and Return.</div></div>
      <div style='font-size:9pt;color:#b7d6c9'>Licensed to {html.escape(STUDENT)} ({html.escape(EMAIL)}). For personal use only. Sharing, copying or reselling this material is not permitted under your student agreement.<br><br>
      Education only, not financial advice. Trading with leverage carries a high risk of loss. Charts are illustrations unless marked otherwise.</div></div>""")
    h.append("<div class='sec'><div class='eye'>Your course</div><h1>The PRNTR Method</h1><p class='tag'>15 modules, from first candle to a full trading plan. This workbook is Part 1.</p><div class='toc'>")
    allmods = ["The PRNTR Mindset", "Reading the Chart Like a Story", "The Box", "The Fake-Out and the Return", "The Turn", "The Launch Pad",
               "The PRNTR Setups", "Zooming In for the Entry", "Confirmation and the Scorecard", "Confluence", "Risk and Sizing",
               "Managing the Trade", "Using PRNTR Signals", "The Journal and Review", "Your Trading Plan"]
    for i, t in enumerate(allmods):
        mark = "  ✔ in this workbook" if i <= 3 else ""
        h.append(f"<div><b>Module {i}</b><span>{t}<span style='color:{GREEN};font-weight:700'>{mark}</span></span></div>")
    h.append("</div><h2>How each module works</h2><table><tr><th>Part</th><th>What it is</th></tr>"
             "<tr><td><b>Explain it like I'm 10</b></td><td>The whole idea in one paragraph. If you can say this out loud, you understand the module.</td></tr>"
             "<tr><td><b>Lessons</b></td><td>Short pages with a picture for every idea.</td></tr>"
             "<tr><td><b>PRNTR rules</b></td><td>The yellow boxes. These are the rules you follow without exception.</td></tr>"
             "<tr><td><b>Check yourself</b></td><td>3 questions. Answers are at the back. Don't move on until you get all three.</td></tr></table></div>")
    for m in MODULES:
        h.append(f"<div class='sec'><div class='eye'>Module {m['n']}</div><h1>{m['title']}</h1><div class='tag'>{m['tag']}</div>")
        h.append(f"<div class='kid'><b>Explain it like I'm 10</b>{m['kid']}</div>")
        for t, body in m["lessons"]:
            h.append(f"<div class='lesson'><h2>{t}</h2>{render_lesson(body)}</div>")
        h.append("<div class='quiz'><h3>Check yourself</h3><ol>" + "".join(f"<li>{q}</li>" for q, _ in m["quiz"]) + "</ol></div></div>")
    h.append("<div class='sec'><div class='eye'>Answers</div><h1>Check yourself: answers</h1>")
    for m in MODULES:
        h.append(f"<h2>Module {m['n']} · {m['title']}</h2><ol>" + "".join(f"<li><b>{q}</b><br>{a}</li>" for q, a in m["quiz"]) + "</ol>")
    h.append("<h2>Next: Part 2</h2><p>Module 4 onward: the Turn, the Launch Pad and the PRNTR setups, where the Box and the Fake-Out become an actual entry.</p></div>")
    h.append("</body></html>")
    return "".join(h)


# ---------------------------------------------------------------- slides
SCSS = f"""
@page {{ size: 338.67mm 190.5mm; margin: 0 }}
* {{ box-sizing: border-box }}
body {{ margin: 0; font-family: Inter, 'DejaVu Sans', sans-serif; color: {INK} }}
.s {{ width: 338.67mm; height: 190.5mm; padding: 15mm 18mm 13mm; position: relative; break-after: page; overflow: hidden; background: #fff }}
.s .ft {{ position: absolute; bottom: 6mm; left: 18mm; right: 18mm; font-size: 8pt; color: #8a9893; display: flex; justify-content: space-between }}
.dark {{ background: linear-gradient(160deg, #0d2b24, #123d32 65%, #1f9d6b 160%); color: #fff }}
.dark .ft {{ color: #9fc3b5 }}
.eye {{ font-size: 11pt; letter-spacing: .18em; text-transform: uppercase; font-weight: 800; color: {GREEN} }}
.dark .eye {{ color: {GOLD} }}
h1 {{ font-size: 36pt; margin: 4mm 0 5mm; line-height: 1.08; letter-spacing: -.01em }}
h2 {{ font-size: 25pt; margin: 2mm 0 6mm }}
.big {{ font-size: 19pt; line-height: 1.45; max-width: 270mm }}
.row {{ display: grid; grid-template-columns: 1.35fr 1fr; gap: 12mm; align-items: center }}
.row2 {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10mm }}
.row3 {{ display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 7mm; font-size: 13pt }}
ul, ol {{ font-size: 16pt; line-height: 1.5; padding-left: 7mm; margin: 0 }}
.rule {{ background: #fff6df; border-left: 6px solid {GOLD}; border-radius: 10px; padding: 4mm 6mm; font-size: 15pt; margin-top: 5mm }}
svg {{ display: block; background: #fbfdfc; border: 1px solid {LINE}; border-radius: 12px }}
.logo {{ font-size: 92pt; font-weight: 900; letter-spacing: .06em; line-height: 1 }} .logo span {{ color: {GOLD} }}
.g {{ color: {GREEN} }} .r {{ color: {RED} }}
.q {{ font-size: 18pt; line-height: 1.6 }}
"""

SLIDES = [
    ("cover",),
    ("section", 0),
    ("text", 0, "Trading is a business with rules", "A doctor checks the same things, in the same order, every time.", ["PRNTR is a checklist for the chart.", "If a trade isn't on the checklist, it doesn't exist."]),
    ("fig", 0, "Most setups get skipped", "funnel", ["Hundreds of charts a day.", "Almost all fail a check.", "Skipping is the skill."]),
    ("fig", 0, "Risk first, profit second", "risk", ["Decide the loss in dollars before you click.", "Only take trades that pay a few times the risk."]),
    ("text", 0, "The three PRNTR promises", None, ["<b>I wait.</b> No setup, no trade.", "<b>I decide my loss first.</b>", "<b>I never move my stop further away.</b>"]),
    ("section", 1),
    ("fig", 1, "One candle, four numbers", "anatomy", ["Open, high, low, close.", "Body = the thick part.", "Wick = where price got pushed back."]),
    ("three", 1, "Up, down or sideways", [("up", "Uptrend", "Higher highs, higher lows"), ("down", "Downtrend", "Lower lows, lower highs"), ("side", "Sideways", "Ceiling and floor. PRNTR hunts here.")]),
    ("fig", 1, "Timeframes are Russian dolls", "dolls", ["Big chart: where are we?", "Middle chart: is a setup forming?", "Small chart: where do I get in?"]),
    ("section", 2),
    ("fig", 2, "Drawing the box", "box", ["Ceiling on top, floor below.", "Circles = touches.", "More touches = stronger box."]),
    ("two", 2, "A real box versus a V", [("realbox", "✔ Real box", "Flat, touches on both sides, takes time."), ("vshape", "✘ Not a box", "A V-shape. Straight down, straight back.")]),
    ("fig", 2, "The three zones", "middle", ["Bottom half: look to buy.", "Top half: look to sell.", "Middle: don't trade."]),
    ("text", 2, "Why the box matters", "Every box has two piles of stop-losses sitting just outside it.", ["Buyers' stops: just below the floor.", "Sellers' stops: just above the ceiling.", "Big players know exactly where they are."]),
    ("section", 3),
    ("fig", 3, "What a fake-out looks like", "fakeout", ["Price pokes past the ceiling.", "Stop-losses get triggered.", "It closes back inside. Breakout buyers are trapped."]),
    ("two", 3, "Fake-out or real breakout?", [("goodfake", "✔ Fake-out", "Wick out, close back inside."), ("breakout", "✘ Real breakout", "Closes outside and keeps going.")]),
    ("fig", 3, "The Return and the trip across", "both", ["1. Fake-out grabs the stops.", "2. The Return: back inside.", "3. The trip across to the other side."]),
    ("fig", 3, "When it fails", "failed", ["No Return, no trade.", "We wait for the Return, then the Turn (Module 4)."]),
    ("quiz",),
    ("end",),
]


def slides():
    h = [f"<!doctype html><html><head><meta charset='utf-8'><title>PRNTR Slides</title><style>{SCSS}</style></head><body>"]
    ft = f"<div class='ft'><span>PRNTR · Licensed to {html.escape(STUDENT)} · do not share</span><span>Part 1: Foundations</span></div>"
    for sl in SLIDES:
        kind = sl[0]
        if kind == "cover":
            h.append(f"<div class='s dark'><div class='eye'>The PRNTR Method</div><div class='logo' style='margin-top:14mm'>PRN<span>T</span>R</div>"
                     f"<div class='big' style='margin-top:9mm;color:#d9efe5'>Part 1: Foundations<br>Mindset · Reading the chart · The Box · The Fake-Out and Return</div>{ft}</div>")
        elif kind == "section":
            m = MODULES[sl[1]]
            h.append(f"<div class='s dark'><div class='eye'>Module {m['n']}</div><h1 style='font-size:46pt'>{m['title']}</h1>"
                     f"<div class='big' style='color:#d9efe5'>{m['kid']}</div>{ft}</div>")
        elif kind == "text":
            _, n, t, lead, pts = sl
            body = (f"<div class='big' style='margin-bottom:7mm'>{lead}</div>" if lead else "") + "<ul>" + "".join(f"<li>{p}</li>" for p in pts) + "</ul>"
            h.append(f"<div class='s'><div class='eye'>Module {n}</div><h2>{t}</h2>{body}{ft}</div>")
        elif kind == "fig":
            _, n, t, fig, pts = sl
            h.append(f"<div class='s'><div class='eye'>Module {n}</div><h2>{t}</h2><div class='row'><div>{F[fig]}</div><ul>" + "".join(f"<li>{p}</li>" for p in pts) + f"</ul></div>{ft}</div>")
        elif kind in ("two", "three"):
            _, n, t, cells = sl
            cls = "row2" if kind == "two" else "row3"
            inner = "".join(f"<div>{F[f]}<div style='font-size:16pt;font-weight:800;margin-top:3mm' class='{'g' if a.startswith('✔') or kind=='three' else 'r'}'>{a}</div><div style='font-size:13pt'>{b}</div></div>" for f, a, b in cells)
            h.append(f"<div class='s'><div class='eye'>Module {n}</div><h2>{t}</h2><div class='{cls}'>{inner}</div>{ft}</div>")
        elif kind == "quiz":
            qs = "".join(f"<li>{q}</li>" for m in MODULES[2:] for q, _ in m["quiz"])
            h.append(f"<div class='s'><div class='eye'>Check yourself</div><h2>Can you answer these?</h2><ol class='q' style='font-size:15pt'>{qs}</ol>{ft}</div>")
        elif kind == "end":
            h.append(f"<div class='s dark'><div class='eye'>Next</div><h1>Part 2: the Turn and the Launch Pad</h1>"
                     f"<div class='big' style='color:#d9efe5'>Where the Box and the Fake-Out become an actual entry.</div>{ft}</div>")
    h.append("</body></html>")
    return "".join(h)


def main():
    tag = "".join(ch for ch in STUDENT if ch.isalnum()) or "master"
    tag = "" if STUDENT == "STUDENT NAME" else "_" + tag
    jobs = [("PRNTR_Part1_Workbook", workbook()), ("PRNTR_Part1_Slides", slides())]
    js = os.path.join(OUT, "_render.cjs")
    with open(js, "w") as f:
        f.write("const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage();"
                "await p.goto('file://'+process.argv[2]);await p.pdf({path:process.argv[3],printBackground:true,preferCSSPageSize:true});await b.close();})();")
    for name, doc in jobs:
        src = os.path.join(OUT, name + ".html")
        with open(src, "w") as f:
            f.write(doc)
        subprocess.run(["node", js, src, os.path.join(OUT, name + tag + ".pdf")], check=True)
    os.remove(js)


if __name__ == "__main__":
    main()
