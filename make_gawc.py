"""World cities: the GaWC (Globalization and World Cities Research Network) 2024 classification of cities by how well
connected they are through advanced producer services (banks, law, accounting, advertising, management consultancy).
Usage: python3 make_gawc.py gawc2024.txt   (lines "Alpha++: London, New York", copied from gawc.lboro.ac.uk) -> gawc.json"""
import json, os, sys, unicodedata
ROOT = os.path.dirname(os.path.abspath(__file__))
n = lambda s: unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower().replace("’", "'")
C = json.load(open(os.path.join(ROOT, "cities.json")))
idx = {}
for r in C: idx.setdefault(n(r[0]), []).append(r)
ALIAS = {"New York": "New York City", "Frankfurt": "Frankfurt am Main", "Washington DC": "Washington", "Bangalore": "Bengaluru", "Kiev": "Kyiv", "St Louis": "St. Louis", "Penang": ("George Town", "MYS")}
HINT = {"San Jose (CA)": "USA", "San José (Costa Rica)": "CRI", "Valencia (Spain)": "ESP", "Birmingham (UK)": "GBR", "Atlanta (GA)": "USA"}
MANUAL = {"Labuan": ["Labuan", "MYS", 5.28, 115.24]}
out = []
for line in open(sys.argv[1], encoding="utf-8"):
    if ":" not in line: continue
    cls, rest = line.split(":", 1)
    for city in [c.strip() for c in rest.split(",") if c.strip()]:
        if city in MANUAL: name, iso, lat, lon = MANUAL[city]; out.append([city, iso, lat, lon, cls.strip()]); continue
        a = ALIAS.get(city, city.split(" (")[0]); want = HINT.get(city)
        if isinstance(a, tuple): a, want = a
        cands = idx.get(n(a), [])
        if want: cands = [r for r in cands if r[1] == want] or cands
        if not cands: print("missing", city); continue
        r = max(cands, key=lambda r: r[4])
        out.append([city.replace(" (GA)", "").replace(" (UK)", "").replace(" (CA)", "").replace(" (Spain)", "").replace(" (Costa Rica)", ""), r[1], r[2], r[3], cls.strip()])
json.dump({"source": "GaWC, The World According to GaWC 2024 (Loughborough University and KU Leuven)", "classes": ["Alpha++", "Alpha+", "Alpha", "Alpha-", "Beta+", "Beta", "Beta-", "Gamma+", "Gamma", "Gamma-"],
           "cities": out}, open(os.path.join(ROOT, "gawc.json"), "w"), separators=(",", ":"), ensure_ascii=False)
print(len(out), "world cities")
# a measure: how many of a country's cities are GaWC world cities (Alpha, Beta or Gamma)
from collections import Counter
cnt = Counter(c[1] for c in out)
rows = [("gawc_cities", r["iso3"], 2024, cnt.get(r["iso3"], 0), 2) for r in json.load(open(os.path.join(ROOT, "countries.json"))) if r.get("un_member")]
path = os.path.join(ROOT, "extra.csv")
keep = [l for l in open(path, encoding="utf-8") if not l.startswith("gawc_cities,")]
with open(path, "w", encoding="utf-8") as f:
    f.writelines(keep)
    for r in rows: f.write(",".join(str(x) for x in r) + "\n")
print("extra.csv:", len(rows), "rows")
