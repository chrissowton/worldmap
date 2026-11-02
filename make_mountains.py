"""Income mountains (Gapminder, CC BY 4.0): how many people live at each income level, for four regions, 1800–2040.
Download: "Data: Income Mountains (v2) by Gapminder" (gapm.io/dincm) as Excel.
Usage: python3 make_mountains.py <the .xlsx>   Writes mountains.json.
Incomes are $ per person per day (2011 international dollars, adjusted for prices); 2019–2040 are Gapminder projections."""
import json, os, sys
import openpyxl

ROOT = os.path.dirname(os.path.abspath(__file__))
wb = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)
rows = list(wb["Data regions by year"].iter_rows(values_only=True))
hdr = rows[1]
cols = [i for i, v in enumerate(hdr) if isinstance(v, (int, float))]
xs = [hdr[i] for i in cols]
# two neighbouring brackets at a time: half the size, still smooth
X = [xs[i] for i in range(0, len(xs), 2)]
NAMES = {"afr": "Africa", "asi": "Asia", "ame": "Americas", "eur": "Europe"}
out = {"x": X, "years": [], "r": {k: {} for k in NAMES}, "names": NAMES}
for r in rows[2:]:
    if not r or r[0] not in NAMES or r[2] is None:
        continue
    y = int(r[2])
    if y % 5:
        continue
    vals = [r[i] or 0 for i in cols]
    pairs = [round((vals[i] + (vals[i + 1] if i + 1 < len(vals) else 0)) / 1000) for i in range(0, len(vals), 2)]
    out["r"][r[0]][y] = pairs
    if y not in out["years"]:
        out["years"].append(y)
out["years"].sort()
with open(os.path.join(ROOT, "mountains.json"), "w") as f:
    json.dump(out, f, separators=(",", ":"))
print("mountains.json:", len(out["years"]), "years,", len(X), "income levels,", out["years"][0], "-", out["years"][-1])
