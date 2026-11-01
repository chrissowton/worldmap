#!/usr/bin/env python3
"""
International migrant stock by country of destination and origin -> migration.json

Source: UN DESA, Population Division (2024). International Migrant Stock 2024.
  Download "undesa_pd_2024_ims_stock_by_sex_destination_and_origin.xlsx" from
  https://www.un.org/development/desa/pd/content/international-migrant-stock
  then:  python3 make_migration.py path/to/undesa_pd_2024_ims_stock_by_sex_destination_and_origin.xlsx

migration.json: {"years": [1990, …, 2024], "pairs": [[destination iso3, origin iso3, n1990, …, n2024], …]}
Only pairs with at least 500 people in some year are kept, to keep the file small.
"""
import json
import os
import sys

import openpyxl

ROOT = os.path.dirname(os.path.abspath(__file__))


def main(path):
    rows = json.load(open(os.path.join(ROOT, "countries.json"), encoding="utf-8"))
    by_num = {int(r["num"]): r["iso3"] for r in rows if str(r.get("num") or "").strip().isdigit()}
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb["Table 1"]
    years, pairs, header_seen = [], [], False
    for row in ws.iter_rows(values_only=True):
        if not header_seen:
            if row[0] == "Index":
                years = [int(y) for y in row[7:15]]
                header_seen = True
            continue
        try:
            d, o = int(row[4]), int(row[6])
        except (TypeError, ValueError):
            continue
        if d not in by_num or o not in by_num or d == o:
            continue
        vals = [int(v) if isinstance(v, (int, float)) else 0 for v in row[7:15]]
        if max(vals) >= 500:
            pairs.append([by_num[d], by_num[o]] + vals)
    out = os.path.join(ROOT, "migration.json")
    json.dump({"years": years, "pairs": pairs}, open(out, "w"), separators=(",", ":"))
    print(f"Wrote {len(pairs)} pairs for {len({p[0] for p in pairs})} destinations, years {years[0]}-{years[-1]}, to {out}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
