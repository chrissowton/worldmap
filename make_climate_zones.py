#!/usr/bin/env python3
"""
Works out each country's Köppen–Geiger climate zones and writes climate_zones.csv.

Uses the 0.5° world climate-zone grid (Kottek, Rubel et al., 1976–2000 climate)
shipped in the R package "kgc" (BSD licence), and the country shapes in world-50m.json.
Each grid cell is weighted by its area. Small countries with no cell inside them
take the nearest cell to their centre.

    pip install pyreadr pandas shapely
    python3 make_climate_zones.py
"""
import csv, json, math, os, tempfile, urllib.request
import pyreadr
from shapely.geometry import shape, Point
from shapely.strtree import STRtree

ROOT = os.path.dirname(os.path.abspath(__file__))
URL = "https://raw.githubusercontent.com/cran/kgc/master/data/climatezones.rda"

# --- country shapes from the site's TopoJSON ---
def topo_to_shapes(topo):
    arcs = topo["arcs"]; sc, tr = topo["transform"]["scale"], topo["transform"]["translate"]
    dec = []
    for arc in arcs:
        x = y = 0; pts = []
        for dx, dy in arc:
            x += dx; y += dy
            pts.append((x * sc[0] + tr[0], y * sc[1] + tr[1]))
        dec.append(pts)
    def ring(idx):
        out = []
        for i in idx:
            pts = dec[i] if i >= 0 else dec[~i][::-1]
            out.extend(pts if not out else pts[1:])
        return out
    for g in topo["objects"]["countries"]["geometries"]:
        if g["type"] == "Polygon":
            geom = {"type": "Polygon", "coordinates": [ring(r) for r in g["arcs"]]}
        elif g["type"] == "MultiPolygon":
            geom = {"type": "MultiPolygon", "coordinates": [[ring(r) for r in p] for p in g["arcs"]]}
        else:
            continue
        yield g.get("id"), g["properties"]["name"], shape(geom).buffer(0)

countries = json.load(open(os.path.join(ROOT, "countries.json"), encoding="utf-8"))
by_num = {str(int(c["num"])): c["iso3"] for c in countries if c.get("num")}
NAME_FIX = {"Kosovo": "UNK", "Somaliland": "SOM", "N. Cyprus": "CYP"}
shapes, isos = [], []
for gid, name, geom in topo_to_shapes(json.load(open(os.path.join(ROOT, "world-50m.json")))):
    iso = (gid and by_num.get(str(int(gid)))) or NAME_FIX.get(name)
    if iso:
        shapes.append(geom); isos.append(iso)
tree = STRtree(shapes)

# --- climate grid ---
tmp = tempfile.mkdtemp()
path = os.path.join(tmp, "climatezones.rda")
with urllib.request.urlopen(URL) as r:
    open(path, "wb").write(r.read())
grid = list(pyreadr.read_r(path).values())[0]
cells = [(float(a), float(b), str(c)) for a, b, c in zip(grid.Lat, grid.Lon, grid.Cls) if str(c) not in ("Ocean", "nan")]

area = {}
for lat, lon, cls in cells:
    p = Point(lon, lat)
    for i in tree.query(p):
        if shapes[i].contains(p):
            area.setdefault(isos[i], {}).setdefault(cls, 0.0)
            area[isos[i]][cls] += math.cos(math.radians(lat))
            break
# countries too small to contain a cell centre: nearest cell to their centre
for c in countries:
    if c["iso3"] in area or not c.get("latlng"):
        continue
    lat0, lon0 = c["latlng"]
    best = min(cells, key=lambda x: (x[0] - lat0) ** 2 + ((x[1] - lon0) * math.cos(math.radians(lat0))) ** 2)
    area[c["iso3"]] = {best[2]: 1.0}

with open(os.path.join(ROOT, "climate_zones.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f, lineterminator="\n")
    w.writerow(["iso3", "zone", "share_pct"])
    for iso in sorted(area):
        tot = sum(area[iso].values())
        for cls, a in sorted(area[iso].items(), key=lambda x: -x[1]):
            pct = round(100 * a / tot, 1)
            if pct >= 1:
                w.writerow([iso, cls, pct])
print(f"Wrote climate_zones.csv for {len(area)} countries")
