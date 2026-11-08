"""European colonial rule, from COLDAT (Becker, 2019, Colonial Dates Dataset; CC0 1.0).
Usage: python3 make_colonies.py COLDAT_dyads.csv   -> colonies.json, and rows in extra.csv:
  col_years (years under European colonial rule, overlaps counted once) and col_end (year European rule ended).
Dates are COLDAT's "mean" dates (the average of its sources). Only eight colonising countries are covered:
Belgium, Britain, France, Germany, Italy, the Netherlands, Portugal and Spain."""
import csv, json, os, sys, unicodedata
ROOT = os.path.dirname(os.path.abspath(__file__))
C = json.load(open(os.path.join(ROOT, "countries.json")))
norm = lambda s: "".join(ch for ch in unicodedata.normalize("NFKD", s.replace("&", "and").replace("St.", "Saint")).encode("ascii", "ignore").decode().lower() if ch.isalnum())
NAMES = {}
for r in C:
    for n in [r["name"]] + list(r.get("aliases") or []): NAMES.setdefault(norm(n), r["iso3"])
for k, v in {"Congo - Brazzaville": "COG", "Congo - Kinshasa": "COD", "Côte d’Ivoire": "CIV", "Myanmar (Burma)": "MMR", "Cape Verde": "CPV",
             "Micronesia (Federated States of)": "FSM", "Saint Vincent and Grenadines": "VCT", "Sao Tome and Principe": "STP", "Eswatini": "SWZ",
             "Timor-Leste": "TLS", "Turkey": "TUR", "Czechia": "CZE", "Bosnia and Herzegovina": "BIH", "North Macedonia": "MKD"}.items():
    NAMES[norm(k)] = v
WHO = {"belgium": "Belgium", "britain": "Britain", "france": "France", "germany": "Germany", "italy": "Italy", "netherlands": "the Netherlands", "portugal": "Portugal", "spain": "Spain"}
col, miss = {}, set()
for r in csv.DictReader(open(sys.argv[1], encoding="utf-8")):
    iso = NAMES.get(norm(r["country"]))
    if not iso: miss.add(r["country"]); continue
    col.setdefault(iso, [])
    if r["col"] == "1" and r["colstart_mean"] != "NA":
        s, e = round(float(r["colstart_mean"])), round(float(r["colend_mean"]))
        col[iso].append([r["colonizer"], s, e])
for v in col.values(): v.sort(key=lambda x: x[1])
json.dump({"source": "COLDAT, Colonial Dates Dataset (Becker 2019), mean dates", "who": WHO, "rule": {k: v for k, v in col.items() if v}},
          open(os.path.join(ROOT, "colonies.json"), "w"), separators=(",", ":"))
rows = []
for iso, v in col.items():
    years = set()
    for _, s, e in v: years.update(range(s, e))
    rows.append(("col_years", iso, 2026, len(years), 2))
    if v: rows.append(("col_end", iso, 2026, max(e for _, _, e in v), 2))
fields = {"col_years", "col_end"}
path = os.path.join(ROOT, "extra.csv")
keep = [l for l in open(path, encoding="utf-8") if l.split(",", 1)[0] not in fields]
with open(path, "w", encoding="utf-8") as f:
    f.writelines(keep)
    for r in rows: f.write(",".join(str(x) for x in r) + "\n")
print("colonies:", sum(1 for v in col.values() if v), "colonised of", len(col), "; unmatched:", sorted(miss))
