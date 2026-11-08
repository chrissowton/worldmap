"""Migrants who died or went missing, 2014-2024, from IOM's Missing Migrants Project (missingmigrants.iom.int),
via the prepared file data-migration-incidents.json in github.com/yotkadata/missing-migrants.
Usage: python3 make_migrants.py data-migration-incidents.json   -> migrants.json
Incidents are added up in 1-degree squares (for the map), and by route and year (for the box)."""
import json, sys, collections
d = json.load(open(sys.argv[1]))
cells = collections.defaultdict(lambda: [0, collections.Counter()])
route_year = collections.defaultdict(collections.Counter)
year = collections.Counter()
for x in d:
    v = x.get("value") or 0
    if not v: continue
    y = int(x["date"][:4]); r = x.get("route") or "Other or unknown"
    year[y] += v; route_year[r][y] += v
    try:
        lat, lon = [float(t) for t in (x.get("coords") or "").split(",")]
    except ValueError:
        continue
    k = (int(lon // 1), int(lat // 1)); cells[k][0] += v; cells[k][1][r] += v
cl = [[k[0] + 0.5, k[1] + 0.5, v[0], v[1].most_common(1)[0][0]] for k, v in cells.items()]
routes = {r: dict(sorted(c.items())) for r, c in route_year.items()}
json.dump({"source": "IOM Missing Migrants Project, 2014-2024 (via yotkadata/missing-migrants)", "total": sum(year.values()),
           "years": dict(sorted(year.items())), "routes": routes, "cells": cl}, open("migrants.json", "w"), separators=(",", ":"))
print(sum(year.values()), "people;", len(cl), "squares;", len(routes), "routes")
