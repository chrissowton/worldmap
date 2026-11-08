"""Cyclone tracks from IBTrACS (since 1980 list, v04r01) -> cyclones.json.
Keeps storms that reached category 3 or more on the Saffir-Simpson scale (USA_WIND >= 96 kt),
one point every 6 hours, rounded to 0.1 degree. Usage: python3 make_cyclones.py path/to/ibtracs.csv"""
import csv, json, sys
from collections import OrderedDict
src = sys.argv[1] if len(sys.argv) > 1 else "ibtracs_since1980_list_v04r01.csv"
def cat(w):
    if w is None: return -1
    return 5 if w >= 137 else 4 if w >= 113 else 3 if w >= 96 else 2 if w >= 83 else 1 if w >= 64 else 0 if w >= 34 else -1
storms = OrderedDict()
with open(src, newline="") as f:
    r = csv.DictReader(f); next(r)  # second row is units
    for row in r:
        if row["TRACK_TYPE"] != "main": continue
        t = row["ISO_TIME"]
        if t[11:13] not in ("00", "06", "12", "18") or t[14:16] != "00": continue
        s = storms.setdefault(row["SID"], {"sid": row["SID"], "season": int(row["SEASON"]), "basin": row["BASIN"], "name": row["NAME"],
                                            "pts": [], "maxw": 0, "minp": None, "start": t[:10], "land": False})
        def num(k):
            v = row.get(k, "").strip()
            try: return float(v)
            except ValueError: return None
        w = num("USA_WIND") or num("WMO_WIND")
        p = num("USA_PRES") or num("WMO_PRES")
        lat, lon = num("LAT"), num("LON")
        if lat is None or lon is None: continue
        if lon > 180: lon -= 360
        if w and w > s["maxw"]: s["maxw"] = w
        if p and (s["minp"] is None or p < s["minp"]): s["minp"] = p
        if num("LANDFALL") == 0: s["land"] = True
        s["end"] = t[:10]
        s["pts"].append([round(lon, 1), round(lat, 1), cat(w)])
out = []
for s in storms.values():
    if s["maxw"] < 96: continue
    pts = s["pts"]
    # simplify: keep every point where the category changes, and otherwise every second point
    keep = [p for i, p in enumerate(pts) if i == 0 or i == len(pts) - 1 or i % 2 == 0 or p[2] != pts[i - 1][2]]
    flat = [v for p in keep for v in p]
    nm = s["name"].title() if s["name"] not in ("NOT_NAMED", "UNNAMED", "") else ""
    out.append([nm, s["season"], s["basin"], int(s["maxw"]), int(s["minp"]) if s["minp"] else 0, s["start"], s["end"], 1 if s["land"] else 0, flat])
json.dump({"source": "IBTrACS v04r01 (NOAA NCEI), storms of category 3 or more since 1980",
           "fields": ["name", "season", "basin", "max_wind_kt", "min_pressure_hpa", "start", "end", "landfall", "track lon,lat,cat..."],
           "storms": out}, open("cyclones.json", "w"), separators=(",", ":"))
print(len(out), "storms")
