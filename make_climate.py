#!/usr/bin/env python3
"""
Climate graphs: WMO climate normals 1991-2020 -> climate.json

Source: World Meteorological Organization (WMO) 1991-2020 climatological standard normals, composite files
(normals from at least 24 years of data), published by NOAA NCEI:
  https://www.ncei.noaa.gov/products/wmo-climate-normals  ("data-composite-primary-parameters-min24")
Download wmo_normals_9120_TAVG_min24.csv, _PRCP_, _TMAX_, _TMIN_ and _DP01_, then:
  python3 make_climate.py folder/with/the/csv/files

climate.json: {"s": [[name, iso3, lat, lon, elevation, T[12], P[12], Tmax[12]|0, Tmin[12]|0, rain days[12]|0], ...]}
A station needs 12 months of temperature (mean, or max and min) and rainfall.
"""
import csv
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
# WMO country names that differ from the site's
FIX = {
    "Russian Federation": "Russia", "Iran, Islamic Republic of": "Iran", "Iran (Islamic Republic of)": "Iran", "Viet Nam": "Vietnam",
    "United Kingdom of Great Britain and Northern Ireland": "United Kingdom", "United States of America": "United States",
    "Republic of Korea": "South Korea", "Democratic People's Republic of Korea": "North Korea", "Syrian Arab Republic": "Syria",
    "Lao People's Democratic Republic": "Laos", "United Republic of Tanzania": "Tanzania", "Republic of Moldova": "Moldova",
    "Bolivia (Plurinational State of)": "Bolivia", "Venezuela (Bolivarian Republic of)": "Venezuela", "Türkiye": "Turkey", "Turkiye": "Turkey",
    "Czechia": "Czech Republic", "Côte d'Ivoire": "Ivory Coast", "Cote d'Ivoire": "Ivory Coast", "Democratic Republic of the Congo": "DR Congo",
    "Congo": "Republic of the Congo", "Brunei Darussalam": "Brunei", "Cabo Verde": "Cape Verde", "Eswatini": "Eswatini",
    "Cabo Verde Republic": "Cape Verde", "Dem. Rep. Congo": "DR Congo", "Denmark Faroe Islands": "Faroe Islands", "Denmark Greenland": "Greenland",
    "Fr. Polynesia": "French Polynesia", "Guinea Bissau": "Guinea-Bissau", "Rep. Korea": "South Korea", "Russian Federation (In Asia)": "Russia",
    "Russian Federation (In Europe)": "Russia", "St. Kitts and Nevis": "Saint Kitts and Nevis", "Bosnia and Herzegovina Srpska": "Bosnia and Herzegovina",
    "Curacao a. S. Maarten": "Curaçao", "Saint Lucia": "Saint Lucia", "Czech Republic": "Czechia",
    "Hong Kong, China": "Hong Kong", "Macao, China": "Macau", "Micronesia, Federated States of": "Micronesia", "North Macedonia": "North Macedonia",
}


def read(path):
    out = {}
    with open(path, encoding="utf-8", errors="replace") as f:
        rd = csv.reader(f)
        next(rd)
        for r in rd:
            if len(r) < 22:
                continue
            vals = []
            for x in r[9:21]:
                try:
                    v = float(x)
                except ValueError:
                    v = None
                vals.append(None if v is None or v <= -90 else v)
            out[r[2].strip()] = {"lat": float(r[4]), "lon": float(r[5]), "elev": float(r[6]) if r[6].strip() not in ("", "-999.0", "-999.9") else None,
                                 "country": r[7].strip(), "name": r[8].strip(), "v": vals}
    return out


def main(folder):
    f = lambda k: (glob.glob(os.path.join(folder, f"*{k}*.csv")) or [None])[0]
    T, P, X, N, D = (read(f(k)) if f(k) else {} for k in ("TAVG", "PRCP", "TMAX", "TMIN", "DP01"))
    rows = json.load(open(os.path.join(ROOT, "countries.json"), encoding="utf-8"))
    names = {r["name"].lower(): r["iso3"] for r in rows}
    for r in rows:
        for a in (r.get("aliases") or []):
            names.setdefault(str(a).lower(), r["iso3"])
    full = lambda v: v and all(x is not None for x in v)
    stations, unknown = [], set()
    for sid, p in P.items():
        t = T.get(sid, {}).get("v")
        x, n = X.get(sid, {}).get("v"), N.get(sid, {}).get("v")
        if not full(t) and full(x) and full(n):
            t = [round((a + b) / 2, 1) for a, b in zip(x, n)]
        if not full(t) or not full(p["v"]):
            continue
        raw = p["country"].replace("_", " ").strip()
        cn = FIX.get(raw, raw)
        iso = names.get(cn.lower()) or names.get(raw.lower()) or names.get(cn.replace("Czechia", "Czech Republic").lower())
        if not iso:
            unknown.add(p["country"])
            continue
        # names come squashed together ("AlgerDarElBeida"): put the spaces back
        nm = re.sub(r"(?<=[a-z])(?=[A-Z])|(?<=[a-zA-Z])(?=No\d)|(?<=[A-Za-z])(?=\d)", " ", p["name"].replace("_", " ")).strip()
        if nm.isupper() or nm.islower():
            nm = nm.title()
        d = D.get(sid, {}).get("v")
        stations.append([nm, iso, round(p["lat"], 3), round(p["lon"], 3), None if p["elev"] is None else round(p["elev"]),
                         [round(v, 1) for v in t], [round(v, 1) for v in p["v"]],
                         [round(v, 1) for v in x] if full(x) else 0, [round(v, 1) for v in n] if full(n) else 0,
                         [round(v, 1) for v in d] if full(d) else 0])
    out = os.path.join(ROOT, "climate.json")
    json.dump({"s": stations}, open(out, "w", encoding="utf-8"), separators=(",", ":"), ensure_ascii=False)
    print(f"Wrote {len(stations)} stations in {len({s[1] for s in stations})} countries to {out}")
    if unknown:
        print("Countries not matched:", ", ".join(sorted(unknown)))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
