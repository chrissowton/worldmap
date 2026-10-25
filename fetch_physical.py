#!/usr/bin/env python3
"""
Downloads and tidies the source data for the physical geography side of the site.

    pip install pyreadr pandas shapely
    python3 fetch_physical.py                       # Factbook facts, volcanoes
    python3 fetch_physical.py --quakes query.csv    # earthquakes, from a USGS download (see below)

Writes (all in this folder):
  factbook_physical.csv  per country: highest / lowest / mean elevation, coastline, land use,
                         terrain, natural hazards, climate (CIA World Factbook, public domain)
  rivers.csv, lakes.csv  major rivers and lakes with length / area and the countries they cross
                         (from the Factbook's per-country lists, merged)
  watersheds.csv         major drainage basins and the ocean they drain to (Factbook)
  volcanoes.csv          Holocene volcanoes (Smithsonian Global Volcanism Program, via the
                         "volcanoes" R package, MIT licence), with eruption counts since 1900
  earthquakes.csv        magnitude 6+ earthquakes since 1900 (USGS, public domain)

The earthquake list comes from this USGS link (download it in a browser and pass the file):
  https://earthquake.usgs.gov/fdsnws/event/1/query?format=csv&starttime=1900-01-01&minmagnitude=6&orderby=time-asc
"""
import csv, glob, html, json, math, os, re, shutil, subprocess, sys, tempfile, unicodedata, urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
FACTBOOK_GIT = "https://github.com/factbook/factbook.json.git"
VOLCANO_RDA = "https://raw.githubusercontent.com/cran/volcanoes/master/data/{}.rda"


def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\(.*?\)", " ", s)
    return re.sub(r"[^a-z0-9]+", " ", s).replace(" the ", " ").strip()


def clean(t):
    t = html.unescape(re.sub(r"<[^>]+>", " ", t or "")).replace("\xa0", " ")
    return re.sub(r"\s+", " ", t).strip()


def num(t):
    m = re.search(r"-?[\d,]+(\.\d+)?", t or "")
    return float(m.group(0).replace(",", "")) if m else None


# ---------- country names -> ISO codes ----------
countries = json.load(open(os.path.join(ROOT, "countries.json"), encoding="utf-8"))
NAME = {}
for c in countries:
    for n in [c["name"]] + (c.get("aliases") or []):
        NAME.setdefault(norm(n), c["iso3"])
for c in json.load(open(os.path.join(ROOT, "world_countries.json"), encoding="utf-8")):
    for n in [c["name"]["common"], c["name"]["official"]] + list(c.get("altSpellings") or []):
        NAME.setdefault(norm(n), c["cca3"])
NAME.update({norm(k): v for k, v in {
    "Burma": "MMR", "Congo, Democratic Republic of the": "COD", "Democratic Republic of the Congo": "COD", "DRC": "COD",
    "Congo, Republic of the": "COG", "Republic of the Congo": "COG", "Korea, South": "KOR", "South Korea": "KOR",
    "Korea, North": "PRK", "North Korea": "PRK", "Gambia, The": "GMB", "The Gambia": "GMB", "Bahamas, The": "BHS",
    "Micronesia, Federated States of": "FSM", "Cabo Verde": "CPV", "Cape Verde": "CPV", "Turkey": "TUR", "Turkey (Turkiye)": "TUR",
    "Turkiye": "TUR", "Holy See": "VAT", "Vatican City": "VAT", "Timor-Leste": "TLS", "East Timor": "TLS", "Eswatini": "SWZ",
    "Cote d'Ivoire": "CIV", "Ivory Coast": "CIV", "Czechia": "CZE", "Czech Republic": "CZE", "Russia": "RUS", "Iran": "IRN",
    "Syria": "SYR", "Laos": "LAO", "Vietnam": "VNM", "Bolivia": "BOL", "Venezuela": "VEN", "Tanzania": "TZA", "Moldova": "MDA",
    "Brunei": "BRN", "UK": "GBR", "United Kingdom": "GBR", "US": "USA", "United States": "USA", "West Bank": "PSE",
    "Gaza Strip": "PSE", "Palestine": "PSE", "Kosovo": "UNK", "Macau": "MAC", "Hong Kong": "HKG", "Taiwan": "TWN",
    "North Macedonia": "MKD", "Saint Kitts and Nevis": "KNA", "Saint Lucia": "LCA", "Saint Vincent and the Grenadines": "VCT",
    "Sao Tome and Principe": "STP", "Western Sahara": "ESH", "Curacao": "CUW", "Sint Maarten": "SXM",
}.items()})


def iso_of(name):
    return NAME.get(norm(name))


def factbook():
    tmp = tempfile.mkdtemp()
    try:
        subprocess.run(["git", "clone", "-q", "--depth", "1", FACTBOOK_GIT, tmp + "/fb"], check=True)
        rows, rivers, lakes, sheds = [], {}, {}, []
        for path in sorted(glob.glob(tmp + "/fb/*/*.json")):
            d = json.load(open(path, encoding="utf-8"))
            g, gov = d.get("Geography", {}), d.get("Government", {})
            cn = gov.get("Country name", {})
            name = clean((cn.get("conventional short form") or {}).get("text"))
            if not name or name.lower() == "none":
                name = clean((cn.get("conventional long form") or {}).get("text"))
            iso = iso_of(name) or iso_of(os.path.basename(path)[:-5])
            if not iso:
                continue
            el = g.get("Elevation", {})
            hp, lp = clean((el.get("highest point") or {}).get("text")), clean((el.get("lowest point") or {}).get("text"))
            split = lambda t: (re.sub(r"\s*-?[\d,]+(\.\d+)?\s*m\b.*$", "", t).strip(), num(re.search(r"-?[\d,]+(\.\d+)?\s*m\b", t).group(0)) if re.search(r"-?[\d,]+(\.\d+)?\s*m\b", t) else None)
            hname, hm = split(hp) if hp else ("", None)
            lname, lm = split(lp) if lp else ("", None)
            coast = clean((g.get("Coastline") or {}).get("text"))
            lu = g.get("Land use", {})
            pct = lambda k: num(clean((lu.get(k) or {}).get("text")))
            area = g.get("Area", {})
            rows.append({
                "iso3": iso, "highest_point": hname, "highest_m": hm, "lowest_point": lname, "lowest_m": lm,
                "mean_elevation_m": num(clean((el.get("mean elevation") or {}).get("text"))),
                "coastline_km": 0 if "landlocked" in coast.lower() else num(coast),
                "agri_land_pct": pct("agricultural land"), "arable_pct": pct("agricultural land: arable land"),
                "forest_land_pct": pct("forest"), "irrigated_km2": num(clean((g.get("Irrigated land") or {}).get("text"))),
                "water_area_km2": num(clean((area.get("water") or {}).get("text"))),
                "terrain": clean((g.get("Terrain") or {}).get("text")), "hazards": clean((g.get("Natural hazards") or {}).get("text")),
                "climate_text": clean((g.get("Climate") or {}).get("text")),
            })
            # major rivers: "Yangtze - 6,300 km; Amur river source (shared with Mongolia and Russia [m]) - 4,444 km"
            rt = clean((g.get("Major rivers (by length in km)") or {}).get("text"))
            rt = re.split(r"\bnote:", rt)[0]
            for part in re.split(r";\s*", rt):
                m = re.match(r"(.+?)\s*-\s*([\d,]+)\s*km", part.strip())
                if not m:
                    continue
                label, km = m.group(1), num(m.group(2))
                shared = re.search(r"\(shared with (.+?)\)\s*$", label)
                label_core = label[: shared.start()].strip() if shared else label
                role = "mouth" if "river mouth" in label_core else "source" if "river source" in label_core else ""
                label_core = re.sub(r"\briver (mouth|source)\b", "", label_core).strip()
                en = re.search(r"\(([^)]+)\)", label_core)
                rname = (en.group(1) if en else label_core).strip()
                local = re.sub(r"\(.*?\)", "", label_core).strip()
                key = norm(rname)
                r = rivers.setdefault(key, {"name": rname, "local": set(), "km": km, "countries": set(), "source": set(), "mouth": set()})
                r["km"] = max(r["km"], km)
                if local and norm(local) != key:
                    r["local"].add(local)
                r["countries"].add(iso)
                if role:
                    r[role].add(iso)
                if shared:
                    for cpart in re.split(r",\s*|\s+and\s+", shared.group(1)):
                        mark = "source" if "[s]" in cpart else "mouth" if "[m]" in cpart else ""
                        ci = iso_of(re.sub(r"\[.\]", "", cpart).strip())
                        if ci:
                            r["countries"].add(ci)
                            if mark:
                                r[mark].add(ci)
            # major lakes
            for kind, v in (g.get("Major lakes (area sq km)") or {}).items():
                salt = "salt" in kind
                if not isinstance(v, dict) or "note" in kind:
                    continue
                for part in re.split(r";\s*", clean(v.get("text"))):
                    m = re.match(r"(.+?)\s*-?\s*([\d,]+)\s*(sq km)?\s*$", part.strip())
                    if not m or not re.search(r"[A-Za-z]", m.group(1)):
                        continue
                    label = m.group(1).strip(" -")
                    shared = re.search(r"\(shared with (.+?)\)", label)
                    lname = re.sub(r"\(shared with .+?\)", "", label).strip(" -")
                    key = norm(lname)
                    l = lakes.setdefault(key, {"name": lname, "km2": num(m.group(2)), "salt": salt, "countries": set()})
                    l["km2"] = max(l["km2"], num(m.group(2)))
                    l["countries"].add(iso)
                    if shared:
                        for cpart in re.split(r",\s*|\s+and\s+", shared.group(1)):
                            ci = iso_of(cpart.strip())
                            if ci:
                                l["countries"].add(ci)
            # watersheds: "Indian Ocean drainage": "Brahmaputra (651,335 sq km), Ganges (...)"
            for kind, v in (g.get("Major watersheds (area sq km)") or {}).items():
                if not isinstance(v, dict) or "note" in kind:
                    continue
                ocean = "Internal (no outlet to the sea)" if "nternal" in kind else kind.replace(" drainage", "").strip()
                for part in re.split(r",\s*(?![\d])", clean(v.get("text"))):
                    m = re.match(r"(?:\((.+?)\)\s*)?(.+?)\s*\(([\d,]+)\s*sq km\)", part.strip())
                    if m:
                        sheds.append([iso, ocean, (m.group(1) or "").strip(), m.group(2).strip(), int(num(m.group(3)))])
        with open(os.path.join(ROOT, "factbook_physical.csv"), "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), lineterminator="\n")
            w.writeheader()
            seen = set()
            for r in rows:
                if r["iso3"] not in seen:
                    seen.add(r["iso3"]); w.writerow(r)
        with open(os.path.join(ROOT, "rivers.csv"), "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f, lineterminator="\n")
            w.writerow(["name", "local_names", "length_km", "countries", "source_countries", "mouth_countries"])
            for r in sorted(rivers.values(), key=lambda r: -r["km"]):
                w.writerow([r["name"], "|".join(sorted(r["local"])), int(r["km"]), "|".join(sorted(r["countries"])), "|".join(sorted(r["source"])), "|".join(sorted(r["mouth"]))])
        with open(os.path.join(ROOT, "lakes.csv"), "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f, lineterminator="\n")
            w.writerow(["name", "area_km2", "salt", "countries"])
            for l in sorted(lakes.values(), key=lambda l: -l["km2"]):
                w.writerow([l["name"], int(l["km2"]), int(l["salt"]), "|".join(sorted(l["countries"]))])
        with open(os.path.join(ROOT, "watersheds.csv"), "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f, lineterminator="\n")
            w.writerow(["iso3", "drains_to", "via", "basin", "area_km2"])
            w.writerows(sheds)
        print(f"Factbook: {len(rows)} countries, {len(rivers)} rivers, {len(lakes)} lakes, {len(sheds)} watershed entries")
    finally:
        shutil.rmtree(tmp)


def volcanoes():
    import pyreadr
    tmp = tempfile.mkdtemp()
    try:
        tables = {}
        for n in ("volcanoes", "eruptions"):
            p = os.path.join(tmp, n + ".rda")
            open(p, "wb").write(urllib.request.urlopen(VOLCANO_RDA.format(n)).read())
            tables[n] = list(pyreadr.read_r(p).values())[0]
    finally:
        shutil.rmtree(tmp)
    v, e = tables["volcanoes"], tables["eruptions"]
    e = e[e.eruption_category == "Confirmed Eruption"]
    since = e[e.start_year >= 1900].groupby("volcano_number").size()
    maxvei = e.groupby("volcano_number").vei.max()
    last = e.groupby("volcano_number").start_year.max()
    with open(os.path.join(ROOT, "volcanoes.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["number", "name", "type", "landform", "last_eruption", "country", "lat", "lon", "elevation_m", "setting", "rock",
                    "eruptions_since_1900", "largest_vei", "summary"])
        for r in v.itertuples():
            le = r.last_eruption_year if r.last_eruption_year == r.last_eruption_year else last.get(r.volcano_number)
            summ = (r.geological_summary or "").split(". ")[0]
            summ = summ if len(summ) < 260 else summ[:257].rsplit(" ", 1)[0] + "…"
            mv = maxvei.get(r.volcano_number)
            w.writerow([int(r.volcano_number), r.volcano_name, r.primary_volcano_type, r.volcanic_landform,
                        "" if le is None or le != le else int(le), r.country, round(r.latitude, 3), round(r.longitude, 3),
                        "" if r.elevation != r.elevation else int(r.elevation), r.tectonic_settings or "", r.dominant_rock_type or "",
                        int(since.get(r.volcano_number, 0)), "" if mv is None or mv != mv else int(mv), summ.rstrip(".") + "." if summ else ""])
    print(f"Volcanoes: {len(v)}")


def quakes(path):
    out = []
    for r in csv.DictReader(open(path, encoding="utf-8")):
        if r.get("type") not in ("earthquake", None) or not r["mag"]:
            continue
        out.append([r["time"][:10], round(float(r["latitude"]), 2), round(float(r["longitude"]), 2),
                    "" if not r["depth"] else round(float(r["depth"])), round(float(r["mag"]), 1), r["place"]])
    with open(os.path.join(ROOT, "earthquakes.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["date", "lat", "lon", "depth_km", "magnitude", "place"])
        w.writerows(out)
    print(f"Earthquakes: {len(out)}")


if __name__ == "__main__":
    if "--quakes" in sys.argv:
        quakes(sys.argv[sys.argv.index("--quakes") + 1])
    else:
        factbook()
        volcanoes()
