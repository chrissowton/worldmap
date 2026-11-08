"""Climate projections by country from the IPCC AR6 WGI Atlas (Iturbide and others 2020/2022, github.com/IPCC-WG1/Atlas, CC BY 4.0).
Usage: python3 make_projections_climate.py <folder with tas/ and pr/ CSVs from datasets-aggregated-regionally/data/CMIP6/CMIP6_{tas,pr}_land> <regions.geojson> <country_regions.json from make_country_regions.cjs>
For each IPCC land region: the change in yearly average temperature (°C) and precipitation (%) between 1995-2014 and
2041-2060 / 2081-2100, for SSP1-2.6, SSP2-4.5 and SSP5-8.5, as the median of the CMIP6 models that ran all three.
Each country then gets the average of the regions it covers, weighted by area (1/4 degree sampling).
Writes rows (wave 2) to extra.csv and climproj.json (the regional figures, for the record)."""
import csv, glob, json, os, re, sys, statistics, math
ROOT = os.path.dirname(os.path.abspath(__file__))
src, regf = sys.argv[1], sys.argv[2]
def read(path):
    rows = [l for l in open(path) if not l.startswith("#")]
    r = csv.reader(rows); head = next(r)
    regs = head[1:]; out = {}
    for row in r:
        y = int(row[0][1:5] if row[0].startswith('"') else row[0][:4])
        vals = row[1:]
        for k, v in zip(regs, vals):
            try: x = float(v)
            except ValueError: continue
            out.setdefault(k, {}).setdefault(y, []).append(x)
    return {k: {y: sum(v) / len(v) for y, v in d.items()} for k, d in out.items()}
def mean(d, a, b): return sum(d[y] for y in range(a, b + 1)) / (b - a + 1)
SC = ["ssp126", "ssp245", "ssp585"]
res = {}
for var in ["tas", "pr"]:
    models = {}
    for f in glob.glob(os.path.join(src, var, "*.csv")):
        m = re.match(r"CMIP6_(.+)_(historical|ssp\d+)_(r\d+i\d+p\d+f\d+)\.csv", os.path.basename(f))
        if m: models.setdefault(m.group(1), {})[m.group(2)] = f
    use = [m for m, d in models.items() if all(k in d for k in ["historical"] + SC)]
    print(var, len(use), "models")
    per = {}  # (scenario, period, region) -> list of model changes
    for m in use:
        h = read(models[m]["historical"])
        for s in SC:
            fut = read(models[m][s])
            for reg in h:
                if reg not in fut: continue
                both = {**h[reg], **fut[reg]}
                try: base = mean(both, 1995, 2014)
                except KeyError: continue
                for p, (a, b) in {"2050": (2041, 2060), "2100": (2081, 2100)}.items():
                    try: v = mean(both, a, b)
                    except KeyError: continue
                    ch = v - base if var == "tas" else (100 * (v - base) / base if base > 0.01 else None)
                    if ch is not None: per.setdefault((s, p, reg), []).append(ch)
    res[var] = {f"{s}_{p}_{reg}": round(statistics.median(v), 2) for (s, p, reg), v in per.items()}
json.dump({"source": "IPCC AR6 WGI Atlas, CMIP6 regional means (land), median of models; change from 1995-2014", **res}, open(os.path.join(ROOT, "climproj.json"), "w"), separators=(",", ":"))
# which regions each country covers, by area (from make_country_regions.cjs)
W = json.load(open(sys.argv[3])) if len(sys.argv) > 3 else {}
rows = []
for iso, w in W.items():
    tot = sum(w.values())
    for var, key in [("tas", "clim_t"), ("pr", "clim_p")]:
        for s in SC:
            for p in ["2050", "2100"]:
                num = sum(res[var].get(f"{s}_{p}_{r}", math.nan) * x for r, x in w.items() if f"{s}_{p}_{r}" in res[var])
                den = sum(x for r, x in w.items() if f"{s}_{p}_{r}" in res[var])
                if den > 0.5 * tot: rows.append((f"{key}_{s}_{p}", iso, 2026, round(num / den, 1 if var == "tas" else 0), 2))
fields = {r[0] for r in rows}
path = os.path.join(ROOT, "extra.csv")
keep = [l for l in open(path, encoding="utf-8") if l.split(",", 1)[0] not in fields]
with open(path, "w", encoding="utf-8") as f:
    f.writelines(keep)
    for r in rows: f.write(",".join(str(x) for x in r) + "\n")
print("extra.csv:", len(rows), "rows of climate projections for", len(W), "countries")
