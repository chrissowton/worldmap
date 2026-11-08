"""Data for v66: World Heritage Sites and submarine cables.
  python3 make_v66.py <unesco data.json> <submarine-cables data folder>
- heritage.json: every World Heritage Site (UNESCO list, snapshot 23 August 2026, from the
  @worldwideview/wwv-plugin-unesco-sites package): [name, ISO3 codes, category, year, in danger, lon, lat, UNESCO id]
- cables.json: submarine cable routes and landing points (TeleGeography's Submarine Cable Map 2026, cleaned by
  T. Hotham, github.com/Tristan-Hotham/submarine-cables)
- extra.csv rows: world_heritage_sites (yearly, cumulative), cables_intl (international cables in service)"""
import csv, json, os, sys, unicodedata
ROOT = os.path.dirname(os.path.abspath(__file__))
whs_src, cab_dir = sys.argv[1], sys.argv[2]

C = json.load(open(os.path.join(ROOT, "countries.json")))
def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return "".join(ch for ch in s if ch.isalnum())
NAMES = {}
for r in C:
    for n in [r["name"]] + list(r.get("aliases") or []):
        NAMES.setdefault(norm(n), r["iso3"])
EXTRA = {"United Kingdom of Great Britain and Northern Ireland": "GBR", "Iran (Islamic Republic of)": "IRN", "Bolivia (Plurinational State of)": "BOL",
    "Venezuela (Bolivarian Republic of)": "VEN", "Republic of Moldova": "MDA", "Russian Federation": "RUS", "Syrian Arab Republic": "SYR",
    "United Republic of Tanzania": "TZA", "Lao People's Democratic Republic": "LAO", "Democratic People's Republic of Korea": "PRK",
    "Republic of Korea": "KOR", "Micronesia (Federated States of)": "FSM", "Türkiye": "TUR", "Turkey": "TUR", "Turkiye": "TUR", "Holy See": "VAT",
    "Democratic Republic of the Congo": "COD", "Congo": "COG", "Côte d'Ivoire": "CIV", "Cabo Verde": "CPV", "Czechia": "CZE",
    "State of Palestine": "PSE", "Palestine": "PSE", "Netherlands (Kingdom of the)": "NLD", "Viet Nam": "VNM", "Brunei": "BRN",
    "Congo, Dem. Rep.": "COD", "Congo, Rep.": "COG", "Saint Helena, Ascension and Tristan da Cunha": "SHN", "Curacao": "CUW",
    "Virgin Islands (U.S.)": "VIR", "Virgin Islands (U.K.)": "VGB", "Faroe Islands": "FRO", "Cocos (Keeling) Islands": "CCK",
    "Christmas Island": "CXR", "British Indian Ocean Territory": "IOT", "Wallis and Futuna": "WLF", "Saint Pierre and Miquelon": "SPM",
    "Micronesia": "FSM", "Timor-Leste": "TLS", "Eswatini": "SWZ", "North Macedonia": "MKD", "The Gambia": "GMB", "Gambia": "GMB",
    "Bahamas": "BHS", "Sint Maarten": "SXM", "Saint Martin": "MAF", "Reunion": "REU", "Réunion": "REU", "Mayotte": "MYT",
    "Martinique": "MTQ", "Guadeloupe": "GLP", "French Guiana": "GUF", "French Polynesia": "PYF", "New Caledonia": "NCL",
    "Northern Mariana Islands": "MNP", "Guam": "GUM", "American Samoa": "ASM", "Puerto Rico": "PRI", "Greenland": "GRL",
    "Svalbard and Jan Mayen": "SJM", "Tokelau": "TKL", "Niue": "NIU", "Cook Islands": "COK", "Norfolk Island": "NFK",
    "Pitcairn Islands": "PCN", "Falkland Islands": "FLK", "Anguilla": "AIA", "Montserrat": "MSR", "Turks and Caicos Islands": "TCA",
    "Cayman Islands": "CYM", "Bermuda": "BMU", "Aruba": "ABW", "Bonaire, Sint Eustatius and Saba": "BES", "Guernsey": "GGY",
    "Jersey": "JEY", "Isle of Man": "IMN", "Gibraltar": "GIB", "Hong Kong": "HKG", "Macau": "MAC", "Macao": "MAC", "Taiwan": "TWN"}
for k, v in EXTRA.items():
    NAMES[norm(k)] = v
miss = set()
def iso(name):
    n = norm(name)
    if n in NAMES: return NAMES[n]
    miss.add(name); return None

# ---------- World Heritage ----------
feats = json.load(open(whs_src))["features"]
sites = []
for f in feats:
    p = f["properties"]
    codes = [c for c in (iso(x.strip()) for x in p["country"].split(",")) if c]
    lon, lat = f["geometry"]["coordinates"]
    sites.append([p["name"], codes, p["category"][0], p["year"], 0,  # the source's "danger" flag is unreliable, so not used
                  round(lon, 3), round(lat, 3), int(p["id"])])
sites.sort(key=lambda s: s[5])
json.dump({"source": "UNESCO World Heritage List (1,273 sites, snapshot 23 August 2026)", "fields": ["name", "countries", "c/n/m", "year", "danger", "lon", "lat", "id"],
           "sites": sites}, open(os.path.join(ROOT, "heritage.json"), "w"), separators=(",", ":"), ensure_ascii=False)
print("heritage:", len(sites), "sites; unmatched:", sorted(miss)); miss.clear()

# ---------- Cables ----------
meta = {r["id"]: r for r in csv.DictReader(open(os.path.join(cab_dir, "cables.csv"), encoding="utf-8"))}
geo = json.load(open(os.path.join(cab_dir, "cables.geojson")))["features"]
cables = []
for f in geo:
    m = meta.get(f["properties"]["id"])
    if not m: continue
    lines = [[v for pt in line for v in (round(pt[0], 2), round(pt[1], 2))] for line in f["geometry"]["coordinates"]]
    owners = m["owners"]
    big = m["hyperscaler_owners"]
    cables.append([m["name"], int(m["rfs_year"]) if m["rfs_year"] else 0, 1 if m["status"] == "planned" else 0,
                   round(float(m["length_km"])) if m["length_km"] else 0, owners, big, m["countries"], lines])
lps = []
for r in csv.DictReader(open(os.path.join(cab_dir, "landing_points.csv"), encoding="utf-8")):
    lps.append([r["name"], round(float(r["lon"]), 3), round(float(r["lat"]), 3), int(r["cables_in_service"]), int(r["cables_planned"])])
chokes = json.load(open(os.path.join(cab_dir, "chokepoints.geojson")))["features"]
ch = [dict(f["properties"]) for f in chokes]
json.dump({"source": "TeleGeography Submarine Cable Map (2026), via T. Hotham (2026)", "fields": ["name", "year", "planned", "length_km", "owners", "cloud owners", "countries", "lines"],
           "cables": cables, "landings": lps, "chokepoints": ch}, open(os.path.join(ROOT, "cables.json"), "w"), separators=(",", ":"), ensure_ascii=False)
print("cables:", len(cables), "landing points:", len(lps))

# ---------- Country measures for extra.csv ----------
rows = []
by = {}
for s in sites:
    for c in s[1]:
        by.setdefault(c, []).append(s)
allc = [r["iso3"] for r in C]
for c in allc:
    ss = by.get(c, [])
    for y in range(1978, 2027):
        rows.append(("world_heritage_sites", c, y, sum(1 for s in ss if s[3] <= y), 0))
for r in csv.DictReader(open(os.path.join(cab_dir, "countries.csv"), encoding="utf-8")):
    c = iso(r["country"])
    if c: rows.append(("cables_intl", c, 2026, int(r["international_cables_in_service"]), 2))
print("cable countries unmatched:", sorted(miss))
fields = {"whs_sites", "whs_danger", "world_heritage_sites", "cables_intl"}  # (whs_danger is no longer made: the source's danger flags were unreliable)
path = os.path.join(ROOT, "extra.csv")
keep = [l for l in open(path, encoding="utf-8") if l.split(",", 1)[0] not in fields]
with open(path, "w", encoding="utf-8") as f:
    f.writelines(keep)
    for r in rows: f.write(",".join(str(x) for x in r) + "\n")
print("extra.csv:", len(rows), "rows")
