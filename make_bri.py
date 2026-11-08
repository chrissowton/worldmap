"""China's overseas development finance, 2000-2021 (AidData's Geospatial Global Chinese Development Finance Dataset v3.0,
Goodman and others 2024, github.com/aiddata/gcdf-geospatial-data). Usage:
  python3 make_bri.py final_input.csv gcdf_v3_adm1.csv   -> bri.json
Each project is placed at the centre of the province (ADM1) where most of it is; titles are kept for projects of $100 million or more."""
import csv, json, re, sys
SECT = [("Transport", ("TRANSPORT",)), ("Energy", ("ENERGY",)), ("Mining and industry", ("INDUSTRY", "BUSINESS", "TRADE")),
        ("Communications", ("COMMUNICATIONS",)), ("Water", ("WATER",)), ("Health", ("HEALTH", "POPULATION")), ("Education", ("EDUCATION",)),
        ("Farming", ("AGRICULTURE", "FOOD")), ("Emergency aid", ("EMERGENCY", "RECONSTRUCTION", "DISASTER")), ("Government and other", ("",))]
def sector(s):
    for i, (_, keys) in enumerate(SECT):
        if any(k in s for k in keys): return i
    return len(SECT) - 1
cen = {}
for r in csv.DictReader(open(sys.argv[2], encoding="utf-8")):
    try: ratio = float(r["intersection_ratio"] or 0)
    except ValueError: ratio = 0
    if r["id"] not in cen or ratio > cen[r["id"]][0]:
        cen[r["id"]] = (ratio, round(float(r["centroid_longitude"]), 2), round(float(r["centroid_latitude"]), 2), r["shapeName"])
out, places = [], {}
ST = {"Completion": 0, "Implementation": 1, "Pipeline: Commitment": 2}
for r in csv.DictReader(open(sys.argv[1], encoding="utf-8")):
    c = cen.get(r["AidData.Record.ID"])
    if not c: continue
    amt = float(r["Amount.(Constant.USD.2021)"] or 0) / 1e6
    pi = places.setdefault(c[3], len(places))
    title = re.sub(r"\s*\((?:[Ll]inked|[Ss]ee) [^)]*\)", "", r["Title"]).strip() if amt >= 100 else ""
    out.append([c[1], c[2], r["Recipient.ISO-3"], sector(r["Sector.Name"]), round(amt, 1) if amt < 100 else round(amt), int(r["Commitment.Year"]), ST.get(r["Status"], 0), pi, title, int(r["AidData.Record.ID"])])
json.dump({"source": "AidData Geospatial Global Chinese Development Finance Dataset v3.0 (2000-2021)", "sectors": [s for s, _ in SECT],
           "places": list(places), "fields": ["lon", "lat", "iso3", "sector", "usd_m_2021", "year", "status", "place", "title (>= $100m)", "id"],
           "projects": out}, open("bri.json", "w"), separators=(",", ":"), ensure_ascii=False)
print(len(out), "projects;", sum(1 for p in out if p[8]), "with titles")
