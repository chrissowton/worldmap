"""Regions within countries, from the Global Data Lab's Subnational Human Development Database.

Downloads (see DATA.md), all from https://globaldatalab.org/shdi/ :
  - the Subnational HDI table for every year (one CSV: GDL-Subnational-HDI-data.csv)
  - the latest year of every indicator (exported in batches: GDL-Human-Development-2023-data*.csv,
    GDL-Gender-Development-2023-data*.csv, GDL-Indicators-2023-data*.csv)
  - the GDL shapefile (GDL Shapefiles V6.x), turned into a small map file with mapshaper:
      mapshaper "GDL Shapefiles V6.4 large.shp" -simplify 0.25% weighted keep-shapes -clean -filter-fields gdlcode \\
        -rename-layers regions -o format=topojson quantization=20000 regions_geo.json

Usage:  python3 make_regions.py <folder with the GDL CSVs>
Writes regions_data.json (and leaves regions_geo.json as it is).
Cite: Global Data Lab, Subnational HDI Database, https://globaldatalab.org/shdi/ ; Smits, J. and Permanyer, I. (2019),
The Subnational Human Development Database, Scientific Data 6:190038, https://doi.org/10.1038/sdata.2019.38
"""
import csv, glob, json, math, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "downloads")
ISO_FIX = {"XKO": "UNK"}  # GDL's code for Kosovo -> ours

def num(s):
    try:
        v = float(s)
        return v if math.isfinite(v) else None
    except (TypeError, ValueError):
        return None

def read(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))

regions = {}   # code -> {"iso", "name", "nat": bool, values...}
hdi_ts = {}
years = []
latest_year = None
for path in sorted(glob.glob(os.path.join(SRC, "*.csv"))):
    rows = read(path)
    if not rows or "GDLCODE" not in rows[0]:
        continue
    cols = list(rows[0].keys())
    if "1990" in cols:  # the HDI for every year
        years = [c for c in cols if c.isdigit()]
        for r in rows:
            hdi_ts[r["GDLCODE"]] = [num(r[y]) for y in years]
    for r in rows:
        code = r["GDLCODE"]
        d = regions.setdefault(code, {"iso": ISO_FIX.get(r["ISO_Code"], r["ISO_Code"]), "name": r["Region"], "nat": r["Level"] == "National"})
        if "Year" in cols:
            latest_year = latest_year or r["Year"]
            for c in cols[7:]:
                d[c.lower()] = num(r[c])

# derived measures
for d in regions.values():
    for s in ("", "f", "m"):
        v = d.pop("lgnic" + s, None)
        d["inc" + s] = round(math.exp(v)) if v is not None else None   # GNI per person, 2017 PPP $ (the file has its natural log)
    if d.get("pop") is not None:
        d["pop"] = round(d["pop"] * 1000)                              # thousands -> people
    d["gap_msch"] = round(d["mschm"] - d["mschf"], 2) if d.get("mschm") is not None and d.get("mschf") is not None else None
    d["gap_lifexp"] = round(d["lifexpf"] - d["lifexpm"], 2) if d.get("lifexpf") is not None and d.get("lifexpm") is not None else None

FIELDS = ["shdi", "lifexp", "lifexpf", "lifexpm", "esch", "eschf", "eschm", "msch", "mschf", "mschm", "inc", "incf", "incm",
          "sgdi", "shdif", "shdim", "gap_msch", "gap_lifexp", "healthindex", "edindex", "incindex", "pop"]
# countries the GDL maps as one piece (no regions) have a national row with a shape of its own (code ending "t")
try:
    with open(os.path.join(ROOT, "regions_geo.json"), encoding="utf-8") as f:
        shapes = {g["properties"]["gdlcode"] for g in json.load(f)["objects"]["regions"]["geometries"]}
except (OSError, KeyError, ValueError):
    shapes = set()
out_r = {}
for code, d in regions.items():
    if d["nat"] and code not in shapes:
        continue
    out_r[code] = [d["iso"], d["name"]] + [d.get(k) for k in FIELDS]
nat = {d["iso"]: [d.get(k) for k in FIELDS] for d in regions.values() if d["nat"]}
first = years.index("1990") if "1990" in years else 0
out = {
    "year": int(latest_year or (years[-1] if years else 0)),
    "fields": FIELDS,
    "regions": out_r,
    "national": nat,
    "hdi": {"years": [int(y) for y in years], "r": {c: v for c, v in hdi_ts.items() if c in out_r or c.endswith("t")}},
}
with open(os.path.join(ROOT, "regions_data.json"), "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
print(f"regions_data.json: {len(out_r)} regions in {len(set(v[0] for v in out_r.values()))} countries, "
      f"{len(FIELDS)} measures for {out['year']}, HDI {years[0] if years else '?'}–{years[-1] if years else '?'}")
