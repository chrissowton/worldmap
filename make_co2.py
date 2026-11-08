"""Consumption-based and historical CO2 (Global Carbon Project, via Our World in Data's co2-data, CC BY 4.0).
Usage: python3 make_co2.py path/to/owid-co2-data.csv   -> yearly rows (wave 0) in extra.csv, then run build_data.py"""
import csv, os, sys
ROOT = os.path.dirname(os.path.abspath(__file__))
F = {"consumption_co2_per_capita": ("co2_consumption_per_capita", 2), "trade_co2_share": ("co2_trade_share", 1),
     "cumulative_co2": ("co2_cumulative_gt", 1), "share_global_cumulative_co2": ("co2_cumulative_share", 2)}
rows = []
for r in csv.DictReader(open(sys.argv[1], encoding="utf-8")):
    iso, y = r["iso_code"], int(r["year"])
    if len(iso) != 3 or iso.startswith("OWID") or y < 1960: continue
    for src, (field, dp) in F.items():
        v = r.get(src, "")
        if v == "": continue
        v = float(v)
        if src == "cumulative_co2": v = v / 1000  # million tonnes -> billion tonnes
        rows.append((field, iso, y, round(v, dp), 0))
fields = {f for f, _ in F.values()} | {"co2_consumption_pc"}
path = os.path.join(ROOT, "extra.csv")
keep = [l for l in open(path, encoding="utf-8") if l.split(",", 1)[0] not in fields]
with open(path, "w", encoding="utf-8") as f:
    f.writelines(keep)
    for r in rows: f.write(",".join(str(x) for x in r) + "\n")
print("extra.csv:", len(rows), "rows of CO2")
