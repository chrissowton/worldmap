"""Protected land and sea (World Bank indicators ER.LND.PTLD.ZS and ER.MRN.PTMR.ZS, from the UN's World Database on
Protected Areas). Usage: python3 make_protected.py <land CSV> <sea CSV>   (the API_*.csv files inside the World Bank zips)
Adds the rows to extra.csv (replacing any earlier ones), as yearly data. Then run build_data.py."""
import csv, os, sys
ROOT = os.path.dirname(os.path.abspath(__file__))
FIELDS = {"ER.LND.PTLD.ZS": "protected_land_pct", "ER.MRN.PTMR.ZS": "protected_sea_pct"}
rows = []
for path in sys.argv[1:]:
    with open(path, encoding="utf-8-sig") as f:
        r = list(csv.reader(f))
    hdr = next(i for i, x in enumerate(r) if x and x[0] == "Country Name")
    head = r[hdr]
    for row in r[hdr + 1:]:
        if len(row) < 5:
            continue
        field = FIELDS.get(row[3])
        if not field:
            continue
        for j, y in enumerate(head):
            if y.isdigit() and j < len(row) and row[j].strip():
                rows.append([field, row[1], y, round(float(row[j]), 2), 0])
path = os.path.join(ROOT, "extra.csv")
with open(path, encoding="utf-8") as f:
    old = f.read().splitlines()
keep = [l for l in old if not any(l.startswith(fl + ",") for fl in FIELDS.values())]
with open(path, "w", encoding="utf-8", newline="") as f:
    f.write("\n".join(keep) + "\n")
    w = csv.writer(f, lineterminator="\n")
    w.writerows(rows)
print("extra.csv:", len(rows), "rows of protected land and sea")
