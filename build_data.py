#!/usr/bin/env python3
"""
Build countries.json from the raw source files in this folder.

Run from the repository root:
    python3 fetch_raw.py      # downloads fresh raw files
    python3 build_data.py     # rebuilds countries.json

Every characteristic shown on the site comes from one of the sources listed
in SOURCES below. To add a new characteristic: add its raw file, add a few
lines here that put a value on each country record, and add a filter entry
in filters.js.
"""
import csv
import json
import os
import re
import sys
import unicodedata

ROOT = os.path.dirname(os.path.abspath(__file__))
RAW = ROOT
OUT = os.path.join(ROOT, "countries.json")


def raw(name):
    return os.path.join(RAW, name)


def norm(s):
    """Normalise a country name for matching across sources."""
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = s.lower().replace("&", "and")
    s = re.sub(r"\(.*?\)", "", s)
    s = re.sub(r"\bst\.? ", "saint ", s)
    s = re.sub(r"[^a-z ]", " ", s)
    s = re.sub(r"\b(the|of|republic|rep|islands?|is|and)\b", " ", s)
    return re.sub(r"\s+", " ", s).strip()


# --- 1. Base list of countries and territories (mledoze/countries, ODbL) ---
base = json.load(open(raw("world_countries.json"), encoding="utf-8"))
countries = {}
by_name = {}
for c in base:
    iso3 = c["cca3"]
    rec = {
        "iso3": iso3,
        "iso2": c["cca2"],
        "num": c.get("ccn3") or "",
        "name": c["name"]["common"],
        "flag": c.get("flag", ""),
        "capital": ", ".join(c.get("capital") or []),
        "region": c.get("region") or "",
        "subregion": c.get("subregion") or "",
        "sovereign": bool(c.get("independent")),
        "un_member": bool(c.get("unMember")),
        "official_languages": sorted(set((c.get("languages") or {}).values())),
        "currencies": sorted({v["name"] for v in (c.get("currencies") or {}).values()}),
        "landlocked": bool(c.get("landlocked")),
        "neighbours": len(c.get("borders") or []),
        "no_land_borders": len(c.get("borders") or []) == 0 and not c.get("landlocked"),
        "area_km2": c.get("area"),
        "latlng": [round(x, 2) for x in (c.get("latlng") or [])],
    }
    countries[iso3] = rec
    names = [c["name"]["common"], c["name"]["official"]] + list(c.get("altSpellings") or [])
    for n in names:
        by_name.setdefault(norm(n), iso3)

# Manual aliases for names other sources spell differently
ALIASES = {
    "burma": "MMR", "myanmar": "MMR", "ivory coast": "CIV", "cote d ivoire": "CIV",
    "east timor": "TLS", "timor leste": "TLS", "swaziland": "SWZ", "eswatini": "SWZ",
    "macedonia": "MKD", "north macedonia": "MKD", "czech": "CZE", "czechia": "CZE",
    "congo": "COG", "congo brazzaville": "COG", "congo kinshasa": "COD",
    "democratic congo": "COD", "dr congo": "COD", "korea north": "PRK", "north korea": "PRK",
    "korea south": "KOR", "south korea": "KOR", "laos": "LAO", "vatican city": "VAT",
    "holy see": "VAT", "palestinian territories": "PSE", "palestine": "PSE",
    "fiji": "FJI", "micronesia": "FSM", "federated states micronesia": "FSM",
    "virgin british": "VGB", "british virgin": "VGB", "virgin us": "VIR",
    "us virgin": "VIR", "u s virgin": "VIR", "united states virgin": "VIR", "russia": "RUS",
    "cape verde": "CPV", "gambia": "GMB", "bahamas": "BHS", "kosovo": "UNK",
    "macau": "MAC", "macao": "MAC", "reunion": "REU", "curacao": "CUW",
    "saint barthelemy": "BLM", "sint maarten": "SXM", "st martin": "MAF",
    "falkland malvinas": "FLK", "falkland": "FLK", "turkey": "TUR", "turkiye": "TUR",
}
for k, v in ALIASES.items():
    by_name[norm(k)] = v


def find(name):
    return by_name.get(norm(name))


unmatched = {}

# --- 2. Population & GDP (World Bank via datasets/population & datasets/gdp, CC BY 4.0) ---
WB_FIX = {"XKX": "UNK"}


def latest_by_iso(path):
    out = {}
    for row in csv.DictReader(open(path, encoding="utf-8")):
        iso = WB_FIX.get(row["Country Code"], row["Country Code"])
        if not row["Value"]:
            continue
        y = int(row["Year"])
        if iso not in out or y > out[iso][0]:
            out[iso] = (y, float(row["Value"]))
    return out


pop = latest_by_iso(raw("pop.csv"))
gdp = latest_by_iso(raw("gdp.csv"))
for iso, rec in countries.items():
    if iso in pop:
        rec["population"] = round(pop[iso][1])
        rec["population_year"] = pop[iso][0]
    if iso in gdp:
        rec["_gdp"] = gdp[iso]

# per-capita GDP needs same-year population
pop_year = {}
for row in csv.DictReader(open(raw("pop.csv"), encoding="utf-8")):
    if row["Value"]:
        pop_year[(WB_FIX.get(row["Country Code"], row["Country Code"]), int(row["Year"]))] = float(row["Value"])
for iso, rec in countries.items():
    g = rec.pop("_gdp", None)
    if g and (iso, g[0]) in pop_year:
        rec["gdp_per_capita"] = round(g[1] / pop_year[(iso, g[0])])
        rec["gdp_year"] = g[0]

# --- 3. CO2 per capita (Our World in Data co2-data, CC BY 4.0) ---
co2 = {}
for row in csv.DictReader(open(raw("co2.csv"), encoding="utf-8")):
    iso, v = row["iso_code"], row["co2_per_capita"]
    if not iso or iso.startswith("OWID") or not v:
        continue
    y = int(row["year"])
    if iso not in co2 or y > co2[iso][0]:
        co2[iso] = (y, float(v))
for iso, (y, v) in co2.items():
    if iso in countries:
        countries[iso]["co2_per_capita"] = round(v, 2)
        countries[iso]["co2_year"] = y

# --- 4. Political regime (V-Dem v16, CC BY-SA 4.0) ---
REGIMES = ["Closed autocracy", "Electoral autocracy", "Electoral democracy", "Liberal democracy"]
VDEM_FIX = {"XKX": "UNK", "PSE": "PSE", "SML": None, "ZZB": None, "PSG": None}
vdem = {}
for row in csv.DictReader(open(raw("vdem_2020_on.csv"), encoding="utf-8")):
    iso = row["country_text_id"]
    iso = VDEM_FIX.get(iso, iso)
    if not iso or not row["v2x_regime"]:
        continue
    y = int(float(row["year"]))
    if iso not in vdem or y > vdem[iso]["y"]:
        vdem[iso] = {"y": y, **row}
for iso, r in vdem.items():
    if iso not in countries:
        unmatched.setdefault("vdem", []).append(iso)
        continue
    rec = countries[iso]
    rec["regime"] = REGIMES[int(float(r["v2x_regime"]))]
    rec["democracy"] = rec["regime"] in ("Electoral democracy", "Liberal democracy")
    rec["libdem"] = round(float(r["v2x_libdem"]), 3) if r["v2x_libdem"] else None
    rec["free_expression"] = round(float(r["v2x_freexp_altinf"]), 3) if r["v2x_freexp_altinf"] else None
    rec["vdem_year"] = r["y"]

# --- 5. Religion (Pew Research Center, Global Religious Landscape, 2010 estimates) ---
REL = {"Christian": "christian", "Muslim": "muslim", "Unaffiliated": "unaffiliated",
       "Hindu": "hindu", "Buddhist": "buddhist", "Folk Religions": "folk",
       "Jewish": "jewish", "Other Religions": "other_religion"}
LABEL = {"christian": "Christianity", "muslim": "Islam", "unaffiliated": "No religion",
         "hindu": "Hinduism", "buddhist": "Buddhism", "folk": "Folk religions",
         "jewish": "Judaism", "other_religion": "Other religions"}


def num(v):
    v = v.replace(",", "").strip()
    if v.startswith("<"):
        return 0.0  # Pew reports fewer than 10,000 adherents
    return float(v or 0)


for row in csv.DictReader(open(raw("pew_religion_2010.csv"), encoding="utf-8")):
    iso = find(row["Country"])
    if not iso or iso not in countries:
        unmatched.setdefault("pew", []).append(row["Country"])
        continue
    vals = {k: num(row[col]) for col, k in REL.items()}
    total = sum(vals.values())
    if total <= 0:
        continue
    rec = countries[iso]
    for k, v in vals.items():
        rec["pct_" + k] = round(100 * v / total, 1)
    top = max(vals, key=vals.get)
    rec["largest_religion"] = LABEL[top]

# --- 6. Languages spoken by >= 10% of the population (Unicode CLDR) ---
names = json.load(open(raw("cldr_languages_en.json"), encoding="utf-8"))
names = names["main"]["en"]["localeDisplayNames"]["languages"]
tinfo = json.load(open(raw("cldr_territoryInfo.json"), encoding="utf-8"))["supplemental"]["territoryInfo"]
iso2_to_3 = {r["iso2"]: k for k, r in countries.items()}
for t, info in tinfo.items():
    iso = iso2_to_3.get(t)
    if not iso:
        continue
    spoken = []
    for code, lp in (info.get("languagePopulation") or {}).items():
        pct = float(lp.get("_populationPercent", 0))
        if pct >= 10:
            base_code = code.split("_")[0]
            nm = names.get(code) or names.get(base_code) or code
            nm = re.sub(r"\s*\(.*\)", "", nm)
            spoken.append(nm)
    countries[iso]["spoken_languages"] = sorted(set(spoken))

# --- 7. Driving side (samayo/country-json, MIT) with known corrections ---
DRIVE_FIX = {"NCL": "right", "WLF": "right", "VIR": "left", "BMU": "left"}
for row in json.load(open(raw("driving_side.json"), encoding="utf-8")):
    iso = find(row["country"])
    if iso and iso in countries and row.get("side"):
        countries[iso]["driving_side"] = row["side"].capitalize()
    else:
        unmatched.setdefault("driving", []).append(row["country"])
for iso, side in DRIVE_FIX.items():
    if iso in countries:
        countries[iso]["driving_side"] = side.capitalize()

# --- Write ---
out = sorted(countries.values(), key=lambda r: r["name"])
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
print(f"Wrote {len(out)} records to {OUT}")
for k, v in unmatched.items():
    print(f"  unmatched in {k} ({len(v)}): {', '.join(map(str, v))}", file=sys.stderr)
