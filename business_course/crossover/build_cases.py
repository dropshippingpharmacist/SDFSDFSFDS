"""Render every PRNTR Crossover case chart and save the measured Box numbers to charts/cases.json."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_crossover_chart import chart, pair_chart, money_chart

O = os.path.join(os.path.dirname(os.path.abspath(__file__)), "charts")
os.makedirs(O, exist_ok=True)
C = {}

def run(key, *a, **k):
    m = chart(*a, out_png=os.path.join(O, key + ".png"), **k)
    C[key] = m
    L = m["launch"]
    print(key, "ceil %.2f floor %.2f" % (m["ceiling"], m["floor"]), "fakeUp", m["fake_up"] and m["fake_up"][0],
          "fakeDn", m["fake_down"] and m["fake_down"][0], "launch", L and (L["date"], L["side"], round(L["close"], 2), round(L["move_pct"], 1), L["extreme_date"]))

run("01_NVDA_deepseek", "NVDA", "2024-10-01", "2025-03-07", "2024-10-15", "2025-01-24", "NVIDIA · three months in a Box, then DeepSeek",
    events=[("2025-01-27", "DeepSeek shock")])
run("02_GME_may24", "GME", "2024-03-01", "2024-06-03", "2024-03-20", "2024-05-10", "GameStop · the Box before Roaring Kitty came back",
    events=[("2024-05-13", "Roaring Kitty posts")])
run("03_GME_jun24", "GME", "2024-05-15", "2024-07-15", "2024-05-17", "2024-05-31", "GameStop · June 2024: the second wave and the dump",
    events=[("2024-06-07", "Livestream + share sale")])
run("04_AMC_may24", "AMC", "2024-03-01", "2024-06-28", "2024-04-01", "2024-05-10", "AMC · same week, same story",
    events=[("2024-05-13", "Roaring Kitty posts")])
run("05_TSLA_election", "TSLA", "2024-07-15", "2024-12-31", "2024-08-01", "2024-11-05", "Tesla · the election launch",
    events=[("2024-11-05", "Election day"), ("2024-11-12", "Musk named to D.O.G.E.")])
run("05w_TSLA_weekly", "TSLA", "2023-12-25", "2025-03-31", "2024-01-01", "2024-11-01", "Tesla · weekly: a 10-month Box, then the launch",
    events=[("2024-11-05", "Election")], wk=True)
run("06_DJT_election", "DJT", "2024-08-15", "2024-12-15", "2024-09-03", "2024-10-04", "Trump Media · into the vote, then sell the news",
    events=[("2024-11-05", "Election day")])
run("07_DJT_inauguration", "DJT", "2024-11-15", "2025-03-14", "2024-11-19", "2025-01-10", "Trump Media · the TRUMP coin launch and the inauguration",
    events=[("2025-01-17", "Official TRUMP coin"), ("2025-01-20", "Inauguration")])
run("08_NFLX_squid", "NFLX_2021", "2021-07-01", "2021-12-31", "2021-07-15", "2021-08-26", "Netflix · Squid Game season 1 (2021)",
    events=[("2021-09-17", "Squid Game out"), ("2021-11-01", "SQUID token rug")], note="Prices adjusted for Netflix's later 10-for-1 split.")
run("09_POPMART_labubu", "POPMART", "2024-09-01", "2025-08-29", "2024-11-15", "2025-01-24", "Pop Mart (Hong Kong) · the Labubu craze",
    events=[("2025-05-27", "LABUBU coin ~$49M")], note="Prices in Hong Kong dollars.")
run("10_TSLA_americaparty", "TSLA_2025", "2025-04-15", "2025-08-29", "2025-05-08", "2025-07-03", "Tesla · the America Party: no launch on the stock",
    events=[("2025-07-05", "America Party announced")])
run("11_NVDA_earnings24", "NVDA", "2024-01-02", "2024-03-28", "2024-02-08", "2024-02-21", "NVIDIA · Feb 2024 earnings",
    events=[("2024-02-21", "Earnings")])
run("12_ORCL_stargate", "ORCL", "2024-11-15", "2025-03-14", "2024-12-11", "2025-01-17", "Oracle · Stargate, then DeepSeek a week later",
    events=[("2025-01-21", "Stargate"), ("2025-01-27", "DeepSeek")])
run("13_NVDA_2026", "NVDA_2026", "2026-04-01", "2026-11-13", "2026-05-01", "2026-10-29", "NVIDIA · 2026: Fake-Outs at the top, then the trip across",
    events=[("2026-11-09", "First 'HUNG' headline")], min_poke=0.05)

pair_chart("GME", "2024-04-20", "2024-06-25", "GME (Solana)", [
    ("2024-04-30", 2.5e6, None), ("2024-05-11", 4e6, "<$4M"), ("2024-05-14", 89e6, "~$89M"), ("2024-05-20", 28e6, "−69%"),
    ("2024-06-06", 24e6, "~$24M*"), ("2024-06-07", 220e6, "~$220M*"), ("2024-06-18", 55e6, "~$55M*")],
    "GameStop stock vs the GME memecoin, same clock", os.path.join(O, "p02_GME_pair.png"),
    events=[("2024-05-13", "Kitty returns"), ("2024-06-07", "Livestream")],
    note="Coin points: CoinGecko and Decrypt reports. * = price × circulating supply (estimate).")
pair_chart("TSLA", "2024-10-25", "2024-12-31", "D.O.G.E. (Ethereum)", [
    ("2024-11-05", 46e6, "~$46M*"), ("2024-11-08", 161e6, "$161M"), ("2024-11-13", 505e6, "~$505M*")],
    "Tesla vs the 'Department of Government Efficiency' coin", os.path.join(O, "p05_TSLA_pair.png"),
    events=[("2024-11-05", "Election"), ("2024-11-12", "Musk named")],
    note="Coin points: Decrypt, crypto.news, CoinMarketCap. * = price × circulating supply (estimate).")
pair_chart("DJT", "2024-10-01", "2024-11-20", "MAGA (TRUMP, Ethereum)", [
    ("2024-10-28", 210e6, "~$210M"), ("2024-11-05", 154e6, "$154M"), ("2024-11-06", 212e6, "$212M"), ("2024-11-07", 79e6, "$79M")],
    "Trump Media vs the MAGA coin: both sold the news", os.path.join(O, "p06_DJT_pair.png"),
    events=[("2024-11-05", "Election")], note="Coin points: Benzinga, The Block, crypto.news.")
pair_chart("DJT", "2025-01-06", "2025-03-21", "Official TRUMP (Solana)", [
    ("2025-01-18", 1.2e9, "~$1.2B (30 min in)"), ("2025-01-19", 14.5e9, "~$14.5B"), ("2025-03-14", 2.3e9, "~$2.3B")],
    "Trump Media vs the official TRUMP coin", os.path.join(O, "p07_DJT_trump_pair.png"),
    events=[("2025-01-17", "Coin launched"), ("2025-01-20", "Inauguration")],
    note="Coin points: CoinGecko, Bitcoin.com, Benzinga (March figure approximate date).")
pair_chart("POPMART", "2025-04-15", "2025-06-20", "LABUBU (Solana)", [
    ("2025-05-13", 0.81e6, "~$0.8M"), ("2025-05-27", 49e6, "$49M"), ("2025-05-30", 56e6, "$56M"), ("2025-06-02", 67e6, "$67M+"), ("2025-06-10", 32e6, "~$32M")],
    "Pop Mart vs the LABUBU memecoin", os.path.join(O, "p09_POPMART_pair.png"),
    events=[("2025-05-27", "UK sales halted")], note="Coin points: Decrypt, BlockBeats / GMGN. Stock in HK$.")
pair_chart("NFLX_2021", "2021-10-01", "2021-11-20", "SQUID (BNB Chain)", [
    ("2021-10-26", 0.01, "$0.01"), ("2021-11-01", 2861, "$2,861"), ("2021-11-02", 0.001, "≈ $0: rug")],
    "Netflix vs the SQUID token: the trap", os.path.join(O, "p08_NFLX_pair.png"), coin_unit="price",
    events=[("2021-10-19", "Earnings")], note="SQUID points: CoinDesk, Forkast. Buyers could not sell at any point.")

money_chart([("Official TRUMP: launch → top", 408), ("'NVDA AI' trade (one wallet)", 210), ("KITTY on Roaring Kitty's return", 131),
             ("LABUBU: quiet → first top", 60), ("GME coin: May 11 → May 14", 22), ("D.O.G.E.: election day → top", 11),
             ("GME coin: June 6 → June 7", 9), ("America Party: first hours", 6.4)],
            "$10 in each coin, sold at the reported top", os.path.join(O, "m_money.png"))

def ser(v):
    if isinstance(v, dict): return {k: ser(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)): return [ser(x) for x in v]
    if hasattr(v, "isoformat"): return v.isoformat()
    return v
json.dump(ser(C), open(os.path.join(O, "cases.json"), "w"), indent=1)
