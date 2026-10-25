#!/usr/bin/env python3
"""
Builds the physical geography data for the site:

  physical.json            map layers (each item has its facts and, for lines and areas, its shape):
                           peaks, mountain ranges and other landforms, rivers, lakes, glaciers,
                           deltas, waterfalls, trenches, volcanoes, earthquakes, plate boundaries,
                           plates, and approximate biome and climate-zone maps
  physical_countries.json  physical facts for each country, merged into countries.json by build_data.py

Sources: Natural Earth (public domain), PB2002 plate model (Bird 2003, via fraxen/tectonicplates, ODC-By),
Köppen–Geiger grid (kgc R package, BSD), and the files written by fetch_physical.py
(CIA World Factbook, Smithsonian GVP, USGS) plus the hand-edited trenches.csv, deltas.csv, waterfalls.csv.

    pip install pyreadr pandas shapely
    python3 fetch_physical.py
    python3 make_physical.py
    python3 build_data.py
"""
import csv, json, math, os, re, tempfile, urllib.request, unicodedata
from collections import Counter, defaultdict
import pyreadr
from shapely.geometry import shape, mapping, Point, LineString, MultiLineString, box
from shapely.geometry.polygon import orient
from shapely.ops import unary_union, linemerge, transform
from shapely.strtree import STRtree

ROOT = os.path.dirname(os.path.abspath(__file__))
NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/{}.geojson"
PLATES = "https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/{}.json"
KGC = "https://raw.githubusercontent.com/cran/kgc/master/data/climatezones.rda"


def get_json(url):
    print("  downloading", url)
    with urllib.request.urlopen(url) as r:
        return json.load(r)


def rows_of(name):
    return list(csv.DictReader(l for l in open(os.path.join(ROOT, name), encoding="utf-8") if not l.startswith("#")))


def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


# ---------- geometry helpers ----------
def km2(geom):
    """Approximate area in km² (sinusoidal projection)."""
    import shapely
    return shapely.transform(geom, _sinu).area


def _sinu(c):
    import numpy as np
    out = c.copy()
    out[:, 0] = c[:, 0] * 111.32 * np.cos(np.radians(c[:, 1]))
    out[:, 1] = c[:, 1] * 110.57
    return out


def math_cos(y):
    import numpy as np
    return np.cos(np.radians(y))


def round_coords(obj):
    if isinstance(obj, (list, tuple)):
        if obj and isinstance(obj[0], (int, float)):
            return [round(obj[0], 2), round(obj[1], 2)]
        out = [round_coords(o) for o in obj]
        if out and isinstance(out[0], list) and out[0] and isinstance(out[0][0], (int, float)):
            out = [p for i, p in enumerate(out) if i == 0 or p != out[i - 1]]
        return out
    return obj


def to_gj(geom, tol=0.0):
    if geom is None or geom.is_empty:
        return None
    if tol:
        geom = geom.simplify(tol, preserve_topology=True)
    if geom.geom_type == "Polygon":
        geom = orient(geom, sign=-1.0)
    elif geom.geom_type == "MultiPolygon":
        from shapely.geometry import MultiPolygon
        geom = MultiPolygon([orient(p, sign=-1.0) for p in geom.geoms if p.area > tol * tol])
    if geom.is_empty:
        return None
    m = mapping(geom)
    return {"type": m["type"], "coordinates": round_coords(m["coordinates"])}


# ---------- countries ----------
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
REC = {c["iso3"]: c for c in countries}
by_num = {str(int(c["num"])): c["iso3"] for c in countries if c.get("num")}
NAME_FIX = {"Kosovo": "UNK", "Somaliland": "SOM", "N. Cyprus": "CYP"}
CSHAPE = defaultdict(list)
for gid, name, geom in topo_to_shapes(json.load(open(os.path.join(ROOT, "world-50m.json")))):
    iso = (gid and by_num.get(str(int(gid)))) or NAME_FIX.get(name)
    if iso:
        CSHAPE[iso].append(geom)
CSHAPE = {k: unary_union(v) for k, v in CSHAPE.items()}
ISOS = list(CSHAPE)
GEOMS = [CSHAPE[i] for i in ISOS]
CTREE = STRtree(GEOMS)
CAREA = {i: km2(g) for i, g in CSHAPE.items()}


def country_at(lon, lat, near=0.0):
    p = Point(lon, lat)
    for i in CTREE.query(p):
        if GEOMS[i].contains(p):
            return ISOS[i], False
    if near:
        i = CTREE.query_nearest(p, max_distance=near)
        if len(i):
            return ISOS[i[0]], True
    return None, False


def countries_touching(geom, min_share=0.0, min_km2=0.0):
    out = []
    a = km2(geom) if geom.geom_type.endswith("Polygon") else 0
    for i in CTREE.query(geom):
        g = GEOMS[i]
        if not g.intersects(geom):
            continue
        if a:
            inter = km2(g.intersection(geom))
            if inter >= min_km2 and (inter / a >= min_share or inter / max(CAREA[ISOS[i]], 1) >= 0.05):
                out.append((ISOS[i], inter))
        else:
            out.append((ISOS[i], 0))
    return [i for i, _ in sorted(out, key=lambda x: -x[1])]


NAME2ISO = {}
for c in countries:
    for n in [c["name"]] + (c.get("aliases") or []):
        NAME2ISO.setdefault(norm(n), c["iso3"])
NAME2ISO.update({"usa": "USA", "united states": "USA", "uk": "GBR", "dr congo": "COD", "democratic republic of the congo": "COD",
                 "russia": "RUS", "turkey": "TUR", "turkiye": "TUR", "iran": "IRN", "burma": "MMR", "myanmar": "MMR",
                 "north korea": "PRK", "south korea": "KOR", "vanuatu": "VUT", "tonga": "TON", "taiwan": "TWN"})

layers = {}
cfacts = defaultdict(dict)

# ======================= Natural Earth =======================
regions = get_json(NE.format("ne_10m_geography_regions_polys"))
elev = get_json(NE.format("ne_10m_geography_regions_elevation_points"))
rivers_ne = get_json(NE.format("ne_10m_rivers_lake_centerlines"))
lakes_ne = get_json(NE.format("ne_10m_lakes"))
glac = get_json(NE.format("ne_50m_glaciated_areas"))
shelves = get_json(NE.format("ne_50m_antarctic_ice_shelves_polys"))
marine = get_json(NE.format("ne_10m_geography_marine_polys"))
P = lambda f: {k.lower(): v for k, v in f["properties"].items()}

# ---------- landforms ----------
KIND = {"Range/mtn": "Mountain range", "Plateau": "Plateau", "Desert": "Desert", "Plain": "Plain", "Basin": "Basin",
        "Delta": "Delta", "Tundra": "Tundra", "Valley": "Valley", "Lowland": "Lowland", "Wetlands": "Wetland",
        "Depression": "Depression", "Gorge": "Gorge", "Foothills": "Foothills", "Peninsula": "Peninsula", "Pen/cape": "Peninsula",
        "Isthmus": "Isthmus"}
landforms = []
for f in regions["features"]:
    p = P(f)
    kind = KIND.get(p.get("featurecla"))
    name = p.get("name_en") or p.get("name")
    if not kind or not name:
        continue
    g = shape(f["geometry"]).buffer(0)
    if g.is_empty:
        continue
    area = km2(g)
    landforms.append({"name": name, "kind": kind, "geom": g, "area": area})
# merge pieces with the same name and kind
merged = {}
for l in landforms:
    k = (l["name"], l["kind"])
    if k in merged:
        merged[k]["geom"] = merged[k]["geom"].union(l["geom"]); merged[k]["area"] += l["area"]
    else:
        merged[k] = dict(l)
landforms = list(merged.values())
RANGES = [l for l in landforms if l["kind"] == "Mountain range"]
RTREE = STRtree([l["geom"] for l in RANGES])

# ---------- peaks ----------
peaks = []
for f in elev["features"]:
    p = P(f)
    if p.get("featurecla") != "mountain" or not p.get("elevation"):
        continue
    lon, lat = f["geometry"]["coordinates"][:2]
    iso, _ = country_at(lon, lat, near=0.4)
    rng = ""
    pt = Point(lon, lat)
    hits = [RANGES[i] for i in RTREE.query(pt) if RANGES[i]["geom"].contains(pt)]
    if not hits:
        i = RTREE.query_nearest(pt, max_distance=0.6)
        hits = [RANGES[i[0]]] if len(i) else []
    if hits:
        rng = min(hits, key=lambda r: r["area"])["name"]
    peaks.append({"name": p.get("name_en") or p.get("name"), "elev": int(p["elevation"]), "lat": round(lat, 3), "lon": round(lon, 3),
                  "iso": [iso] if iso else [], "range": rng})
# Natural Earth sometimes lists a peak twice; keep the higher
seen = {}
for pk in sorted(peaks, key=lambda x: -x["elev"]):
    seen.setdefault(norm(pk["name"]), pk)
peaks = sorted(seen.values(), key=lambda x: -x["elev"])
layers["peak"] = [{"name": p["name"], "elev": p["elev"], "range": p["range"], "iso": p["iso"], "lat": p["lat"], "lon": p["lon"]} for p in peaks]
print("peaks", len(peaks))

out = []
for l in sorted(landforms, key=lambda l: -l["area"]):
    pk = [p for p in peaks if l["geom"].buffer(0.05).contains(Point(p["lon"], p["lat"]))]
    top = max(pk, key=lambda p: p["elev"]) if pk else None
    isos = countries_touching(l["geom"], min_share=0.02, min_km2=200)
    c = l["geom"].representative_point()
    out.append({"name": l["name"], "kind": l["kind"], "area": int(round(l["area"], -2)), "iso": isos,
                "top": top["name"] if top else "", "top_m": top["elev"] if top else None,
                "lat": round(c.y, 2), "lon": round(c.x, 2), "g": to_gj(l["geom"], 0.05 if l["area"] > 50000 else 0.02)})
layers["landform"] = out
print("landforms", len(out), Counter(l["kind"] for l in out))

# ======================= Factbook rivers and lakes, joined to Natural Earth shapes =======================
shed_rows = rows_of("watersheds.csv")
SHED = {}
for r in shed_rows:
    SHED.setdefault(norm(r["basin"]), (r["drains_to"], int(r["area_km2"]), r["via"]))
RIVER_ALIAS = {"amazon": ["amazonas"], "huang he": ["huang", "yellow"], "yangtze": ["yangtze", "chang jiang"], "congo": ["congo"],
               "mekong": ["mekong"], "brahmaputra": ["brahmaputra", "jamuna"], "indus": ["indus"], "ganges": ["ganges", "ganga"],
               "yenisey angara": ["yenisey", "yenisei", "angara"], "ob irtysh": ["ob", "irtysh"], "parana": ["parana"],
               "amur": ["amur"], "lena": ["lena"], "mackenzie": ["mackenzie"], "niger": ["niger"], "missouri": ["missouri"],
               "mississippi": ["mississippi"], "volga": ["volga"], "nile": ["nile"], "zambezi": ["zambezi"], "murray darling": ["murray", "darling"],
               "rio grande": ["rio grande"], "danube": ["danube"], "euphrates": ["euphrates"], "tigris": ["tigris"], "salween": ["salween", "nu"],
               "irrawaddy": ["irrawaddy", "ayeyarwady"], "orinoco": ["orinoco"], "st lawrence": ["st lawrence", "saint lawrence"]}
ne_by_name = defaultdict(list)
for f in rivers_ne["features"]:
    p = P(f)
    if p.get("featurecla") not in ("River", "Lake Centerline"):
        continue
    nm = p.get("name_en") or p.get("name")
    if nm:
        ne_by_name[norm(nm)].append((shape(f["geometry"]), p.get("scalerank") or 10))
rivers = []
used_ne = set()
for r in rows_of("rivers.csv"):
    key = norm(r["name"])
    keys = RIVER_ALIAS.get(key, [key] + [norm(x) for x in r["local_names"].split("|") if x])
    geoms = []
    for k in keys:
        if k in ne_by_name:
            geoms += [g for g, _ in ne_by_name[k]]; used_ne.add(k)
    shed = SHED.get(key) or next((SHED[k] for k in keys if k in SHED), None)
    geom = unary_union(geoms) if geoms else None
    rivers.append({"name": r["name"], "km": int(r["length_km"]), "iso": [x for x in r["countries"].split("|") if x],
                   "src": [x for x in r["source_countries"].split("|") if x], "mouth": [x for x in r["mouth_countries"].split("|") if x],
                   "to": shed[0] if shed else "", "basin": shed[1] if shed else None,
                   "g": to_gj(geom, 0.03) if geom is not None else None})
# other named rivers on the map (no length in the Factbook)
for k, lst in ne_by_name.items():
    if k in used_ne:
        continue
    rank = min(s for _, s in lst)
    if rank > 5:
        continue
    geom = unary_union([g for g, _ in lst])
    name = next(P(f).get("name_en") or P(f).get("name") for f in rivers_ne["features"] if norm(P(f).get("name_en") or P(f).get("name") or "") == k)
    isos = countries_touching(geom)
    shed = SHED.get(k)
    rivers.append({"name": name, "km": None, "iso": isos, "src": [], "mouth": [], "to": shed[0] if shed else "", "basin": shed[1] if shed else None,
                   "g": to_gj(geom, 0.03)})
layers["river"] = rivers
print("rivers", len(rivers), "with shapes", sum(1 for r in rivers if r["g"]))

def lk(name):
    """Key for matching lake names: drops 'Lake', 'Lago', 'Lac' and so on."""
    k = norm(name)
    k = re.sub(r"^(lake|lago|lac|lagoa|laguna|lagos|ozero)\s+(de\s+|do\s+|of\s+)?", "", k)
    return re.sub(r"\s+(lake|hu|nur)$", "", k).strip()


FB_LAKE_NAME = {"michigan": "Lake Michigan", "superior": "Lake Superior", "huron": "Lake Huron", "erie": "Lake Erie", "ontario": "Lake Ontario"}
lakes_fb = {}
for r in rows_of("lakes.csv"):
    nm = re.sub(r"\s*-\s*[\d,]+.*$", "", r["name"])
    nm = re.sub(r"[*–\-]+\s*$", "", nm).strip(" *–-")
    nm = FB_LAKE_NAME.get(norm(nm), nm)
    lakes_fb.setdefault(lk(nm), {"name": nm, "km2": int(r["area_km2"]), "salt": r["salt"] == "1", "iso": r["countries"].split("|")})
ne_lakes = defaultdict(list)
for f in lakes_ne["features"]:
    p = P(f)
    nm = p.get("name") or p.get("name_en")
    if nm:
        ne_lakes[lk(nm)].append((shape(f["geometry"]).buffer(0), p.get("featurecla")))
lakes = []
done = set()
for k, lst in ne_lakes.items():
    geom = unary_union([g for g, _ in lst])
    area = km2(geom)
    fb = lakes_fb.get(k)
    if area < 1000 and not fb:
        continue
    name = next(P(f).get("name") or P(f).get("name_en") for f in lakes_ne["features"] if lk(P(f).get("name") or P(f).get("name_en") or "") == k)
    kind = "Reservoir" if any(c == "Reservoir" for _, c in lst) else "Salt lake" if (fb and fb["salt"]) or any(c == "Alkaline Lake" for _, c in lst) else "Freshwater lake"
    if fb:
        done.add(k)
    lakes.append({"name": name, "km2": fb["km2"] if fb else int(round(area, -1)), "kind": kind, "iso": fb["iso"] if fb else countries_touching(geom),
                  "lat": round(geom.representative_point().y, 2), "lon": round(geom.representative_point().x, 2), "g": to_gj(geom, 0.03 if area > 3000 else 0.015)})
for k, fb in lakes_fb.items():
    if k not in done and fb["km2"] >= 300:
        lakes.append({"name": fb["name"], "km2": fb["km2"], "kind": "Salt lake" if fb["salt"] else "Freshwater lake", "iso": fb["iso"], "g": None})
lakes.sort(key=lambda l: -l["km2"])
layers["lake"] = lakes
print("lakes", len(lakes))

# ---------- glaciers and ice ----------
ice = [shape(f["geometry"]).buffer(0) for f in glac["features"]] + [shape(f["geometry"]).buffer(0) for f in shelves["features"]]
ICE = unary_union(ice)
layers["ice"] = to_gj(ICE, 0.05)
for iso, g in CSHAPE.items():
    try:
        a = km2(g.intersection(ICE))
    except Exception:
        a = 0
    if a > 0:
        cfacts[iso]["glacier_km2"] = int(round(a, -1))
        cfacts[iso]["glacier_pct"] = round(100 * a / CAREA[iso], 1)

# ======================= Tectonics =======================
plates = get_json(PLATES.format("PB2002_plates"))
steps = get_json(PLATES.format("PB2002_steps"))
PNAME = {P(f)["code"].upper(): P(f)["platename"] for f in plates["features"]}
MAJOR = {"Africa", "Antarctica", "Australia", "Eurasia", "North America", "South America", "Pacific", "India"}
plate_items = []
plate_geoms = []
for f in plates["features"]:
    p = P(f)
    g = shape(f["geometry"]).buffer(0)
    plate_geoms.append((p["platename"], g))
merged_pl = defaultdict(list)
for n, g in plate_geoms:
    merged_pl[n].append(g)
for n, gs in merged_pl.items():
    g = unary_union(gs)
    plate_items.append({"name": n, "major": n in MAJOR, "area": int(round(km2(g), -3)),
                        "lat": round(g.representative_point().y, 2), "lon": round(g.representative_point().x, 2)})
layers["plate"] = plate_items
# keep the plate outlines as they come (they're drawn on a sphere), just rounded
layers["plate_shapes"] = {"type": "FeatureCollection", "features": [
    {"type": "Feature", "properties": {"name": P(f)["platename"]}, "geometry": {"type": f["geometry"]["type"], "coordinates": round_coords(f["geometry"]["coordinates"])}}
    for f in plates["features"]]}
# which plates each country sits on
for iso, g in CSHAPE.items():
    on = []
    for n, pg in plate_geoms:
        try:
            if pg.intersects(g):
                a = km2(pg.intersection(g))
                if a >= 0.03 * CAREA[iso] or a > 20000:
                    on.append((n, a))
        except Exception:
            pass
    if on:
        agg = defaultdict(float)
        for n, a in on:
            agg[n] += a
        cfacts[iso]["plates"] = [n for n, _ in sorted(agg.items(), key=lambda x: -x[1])]

MARGIN = {"OSR": ("Constructive", "Mid-ocean ridge"), "CRB": ("Constructive", "Continental rift"),
          "SUB": ("Destructive", "Subduction zone"), "OCB": ("Destructive", "Oceanic convergent boundary"),
          "CCB": ("Collision", "Continental collision"), "OTF": ("Conservative", "Oceanic transform fault"),
          "CTF": ("Conservative", "Continental transform fault")}
segs = []
cur = None
for f in sorted(steps["features"], key=lambda f: (P(f)["platebound"], P(f)["seqnum"])):
    p = P(f)
    a, b = (p["startlong"], p["startlat"]), (p["finallong"], p["finallat"])
    cls = p["stepclass"]
    if cur and cur["pb"] == p["platebound"] and cur["cls"] == cls and abs(cur["pts"][-1][0] - a[0]) < 0.01 and abs(cur["pts"][-1][1] - a[1]) < 0.01 and abs(b[0] - a[0]) < 180:
        cur["pts"].append(b); cur["len"] += p["steplength"]; cur["v"].append(p["velocityle"] if "velocityle" in p else p.get("velocityle", 0))
    else:
        cur = {"pb": p["platebound"], "cls": cls, "pts": [a, b], "len": p["steplength"], "v": [p.get("velocityle", 0)]}
        segs.append(cur)
def boundary_name(pb, cls, pts):
    a, b = pb.replace("\\", "-").replace("/", "-").split("-")[:2] if "-" in pb or "\\" in pb or "/" in pb else (pb, "")
    pair = {a, b}
    lon = sum(x for x, _ in pts) / len(pts); lat = sum(y for _, y in pts) / len(pts)
    if cls == "OSR" and pair & {"NA", "SA"} and pair & {"AF", "EU", "NB"} and -45 < lon < 15: return "Mid-Atlantic Ridge"
    if cls in ("CTF", "OTF") and pair == {"NA", "PA"} and 32 < lat < 41 and -126 < lon < -114: return "San Andreas Fault"
    if pair == {"AF", "SO"} and cls in ("CRB", "OSR") and lat < 15 and lon > 25: return "East African Rift"
    if cls == "CCB" and pair & {"IN"} and pair & {"EU"}: return "Himalayan collision zone"
    if cls == "SUB" and pair == {"NZ", "SA"}: return "Peru–Chile Trench"
    if cls in ("CTF", "OTF") and pair == {"AU", "PA"} and -47 < lat < -40 and 166 < lon < 176: return "Alpine Fault"
    if cls == "SUB" and pair == {"PA", "NA"} and lat > 45: return "Aleutian Trench"
    if cls == "SUB" and pair == {"PA", "MA"}: return "Mariana Trench"
    if cls == "SUB" and pair & {"PA"} and pair & {"TO"}: return "Tonga Trench"
    if cls == "SUB" and pair & {"PA"} and pair & {"OK"}: return "Japan / Kuril Trench"
    if cls == "OSR" and pair & {"PA"} and pair & {"NZ", "CO", "AN"} and lon < -95: return "East Pacific Rise" if pair != {"PA", "AN"} else "Pacific–Antarctic Ridge"
    if cls == "OSR" and pair == {"AU", "AN"}: return "Southeast Indian Ridge"
    if cls == "OSR" and pair & {"AN"} and pair & {"AF", "SO"}: return "Southwest Indian Ridge"
    if cls == "SUB" and pair & {"AU"} and pair & {"SU"}: return "Sunda Trench"
    if cls == "SUB" and pair & {"CO"}: return "Middle America Trench"
    if cls in ("CCB", "OCB", "SUB") and pair & {"AF", "AS", "AT"} and pair & {"EU", "AS", "AT"} and 0 < lon < 40 and 33 < lat < 47: return "Mediterranean (Africa–Europe)"
    if cls == "SUB" and pair & {"JF"}: return "Cascadia subduction zone"
    if cls == "OSR" and pair & {"EU"} and pair & {"NA"}: return "Mid-Atlantic Ridge"
    if cls == "OSR" and pair & {"AR"} and pair & {"IN", "SO"}: return "Carlsberg Ridge"
    return ""
bounds = []
for s in segs:
    pts = [(round(x, 2), round(y, 2)) for x, y in s["pts"]]
    codes = re.split(r"[-\\/]", s["pb"])
    margin, detail = MARGIN.get(s["cls"], ("", ""))
    vs = [v for v in s["v"] if isinstance(v, (int, float))]
    bounds.append({"plates": [PNAME.get(c, c) for c in codes[:2]], "margin": margin, "type": detail, "name": boundary_name(s["pb"], s["cls"], s["pts"]),
                   "speed": round(sum(vs) / len(vs), 1) if vs else None, "km": int(s["len"]),
                   "g": {"type": "LineString", "coordinates": [list(p) for p in pts]}})
layers["boundary"] = bounds
print("boundaries", len(bounds), Counter(b["margin"] for b in bounds))
# boundary points, for "nearest boundary" and the margins near each country
bpts, bcls = [], []
for b in bounds:
    for x, y in b["g"]["coordinates"]:
        bpts.append(Point(x, y)); bcls.append(b["margin"])
BTREE = STRtree(bpts)
for iso, g in CSHAPE.items():
    near = set(bcls[i] for i in BTREE.query(g.buffer(0.4)) if g.buffer(0.4).contains(bpts[i]))
    if near:
        cfacts[iso]["margins"] = sorted(near)

# ---------- volcanoes ----------
VTYPE = [("Strato", "Stratovolcano"), ("Shield", "Shield volcano"), ("Caldera", "Caldera"), ("Volcanic field", "Volcanic field"),
         ("Lava dome", "Lava dome"), ("Pyroclastic cone", "Cinder cone"), ("Submarine", "Submarine volcano"), ("Complex", "Complex volcano"),
         ("Fissure", "Fissure vent"), ("Lava cone", "Lava cone"), ("Maar", "Maar"), ("Tuff cone", "Tuff cone"), ("Subglacial", "Subglacial volcano")]
volcs = []
for r in rows_of("volcanoes.csv"):
    lat, lon = float(r["lat"]), float(r["lon"])
    t = next((v for k, v in VTYPE if k.lower() in r["type"].lower()), "Other")
    # the country it is in (or within about 100 km of), worked out from its position:
    # the GVP's own country names group overseas territories with their governing country
    iso, off = country_at(lon, lat, near=1.0)
    isos = [iso] if iso else []
    for part in re.split(r"\s*-\s*|\s*/\s*", r["country"]):
        i = NAME2ISO.get(norm(part))
        if i and iso and i != iso and i not in isos and CSHAPE.get(i) is not None and CSHAPE[i].distance(Point(lon, lat)) < 1.0:
            isos.append(i)
    setting = r["setting"].split("/")[0].strip()
    crust = r["setting"].split("/")[1].strip() if "/" in r["setting"] else ""
    vname = r["name"]
    if ", " in vname:
        a, b = vname.split(", ", 1)
        vname = f"{b} {a}"
    volcs.append({"name": vname, "type": t, "last": int(r["last_eruption"]) if r["last_eruption"] else None, "iso": isos,
                  "lat": lat, "lon": lon, "elev": int(r["elevation_m"]) if r["elevation_m"] else None,
                  "setting": setting or "Unknown", "crust": re.sub(r"\s*\(.*\)", "", crust), "rock": r["rock"],
                  "n1900": int(r["eruptions_since_1900"]), "vei": int(r["largest_vei"]) if r["largest_vei"] else None,
                  "about": r["summary"] if len(r["summary"]) <= 170 else r["summary"][:167].rsplit(" ", 1)[0] + "…"})
layers["volcano"] = volcs
for v in volcs:
    for iso in v["iso"][:1]:
        c = cfacts[iso]
        c["volcanoes"] = c.get("volcanoes", 0) + 1
        if v["last"] and v["last"] >= 1900:
            c["volcanoes_active"] = c.get("volcanoes_active", 0) + 1
        c["eruptions_1900"] = c.get("eruptions_1900", 0) + v["n1900"]
        if v["elev"] and v["elev"] > c.get("highest_volcano_m", -99999):
            c["highest_volcano_m"] = v["elev"]; c["highest_volcano"] = v["name"]
print("volcanoes", len(volcs))

# ---------- earthquakes ----------
quakes = []
for r in rows_of("earthquakes.csv"):
    lat, lon = float(r["lat"]), float(r["lon"])
    iso, off = country_at(lon, lat, near=1.5)
    p = Point(lon, lat)
    i = BTREE.query_nearest(p, max_distance=3)
    near = bcls[i[0]] if len(i) else ""
    y, m, d = r["date"].split("-")
    place = re.sub(r"^\d+\s*km\s+[NSEW]{0,3}\s+of\s+", "near ", r["place"])
    quakes.append([int(y), int(m), int(d), round(lat, 1), round(lon, 1), int(r["depth_km"]) if r["depth_km"] else None, float(r["magnitude"]), iso or "", int(off), near, place])
layers["quake"] = {"fields": ["y", "m", "d", "lat", "lon", "depth", "mag", "iso", "offshore", "margin", "place"], "rows": quakes}
for q in quakes:
    if not q[7]:
        continue
    c = cfacts[q[7]]
    c["quakes"] = c.get("quakes", 0) + 1
    if q[6] >= 7:
        c["quakes7"] = c.get("quakes7", 0) + 1
    if q[6] > c.get("quake_max", 0):
        c["quake_max"] = q[6]; c["quake_max_year"] = q[0]; c["quake_max_place"] = q[10]
print("earthquakes", len(quakes))

# ---------- trenches, deltas, waterfalls (hand-edited) ----------
layers["trench"] = [{"name": r["name"], "deep": r["deepest_point"], "ocean": r["ocean"], "depth": int(r["depth_m"]), "lat": float(r["lat"]), "lon": float(r["lon"]),
                     "plates": r["plates"]} for r in rows_of("trenches.csv")]
layers["delta"] = [{"name": r["name"], "river": r["river"], "iso": r["countries"].split("|"), "lat": float(r["lat"]), "lon": float(r["lon"]),
                    "shape": r["shape"] if r["shape"] != "-" else "", "note": r["note"]} for r in rows_of("deltas.csv")]
layers["waterfall"] = [{"name": r["name"], "iso": r["countries"].split("|"), "height": int(r["height_m"]), "lat": float(r["lat"]), "lon": float(r["lon"]),
                        "note": r["note"]} for r in rows_of("waterfalls.csv")]

# ======================= Biomes and climate zones (approximate, from the Köppen grid) =======================
tmp = tempfile.mkdtemp()
path = os.path.join(tmp, "kgc.rda")
open(path, "wb").write(urllib.request.urlopen(KGC).read())
grid = list(pyreadr.read_r(path).values())[0]
BIOME = {"Af": "Tropical rainforest", "Am": "Tropical rainforest", "Aw": "Tropical savanna", "As": "Tropical savanna",
         "BWh": "Hot desert", "BWk": "Cold desert", "BSh": "Steppe and dry grassland", "BSk": "Steppe and dry grassland",
         "Csa": "Mediterranean", "Csb": "Mediterranean", "Csc": "Mediterranean", "ET": "Tundra", "EF": "Ice sheet"}
def biome_of(c):
    if c in BIOME: return BIOME[c]
    if c[0] == "C" or c in ("Dfa", "Dfb", "Dwa", "Dwb", "Dsa", "Dsb"): return "Temperate forest"
    if c[0] == "D": return "Boreal forest (taiga)"
    return None
CLIM = {"A": "Tropical", "B": "Dry", "C": "Temperate", "D": "Continental", "E": "Polar"}
cells_b, cells_c = defaultdict(list), defaultdict(list)
cshare = defaultdict(Counter)
for lat, lon, cls in zip(grid.Lat, grid.Lon, grid.Cls):
    cls = str(cls)
    if cls in ("Ocean", "nan"):
        continue
    b = biome_of(cls)
    cell = box(lon - 0.25, lat - 0.25, lon + 0.25, lat + 0.25)
    if b:
        cells_b[b].append(cell)
    cells_c[CLIM[cls[0]]].append(cell)
    p = Point(lon, lat)
    for i in CTREE.query(p):
        if GEOMS[i].contains(p):
            if b:
                cshare[ISOS[i]][b] += math.cos(math.radians(lat))
            break
def dissolve(cells):
    return {k: to_gj(unary_union(v), 0.12) for k, v in cells.items()}
layers["biome_shapes"] = dissolve(cells_b)
layers["climate_shapes"] = dissolve(cells_c)
for iso, cnt in cshare.items():
    tot = sum(cnt.values())
    shares = sorted(((b, 100 * a / tot) for b, a in cnt.items()), key=lambda x: -x[1])
    cfacts[iso]["main_biome"] = shares[0][0]
    cfacts[iso]["biomes"] = [b for b, s in shares if s >= 10] or [shares[0][0]]
    cfacts[iso]["biome_list"] = [[b, round(s)] for b, s in shares if s >= 1]
# small countries with no grid cell: nearest cell
for c in countries:
    if c["iso3"] in cshare or not c.get("latlng"):
        continue
    lat0, lon0 = c["latlng"]
    best = None
    for lat, lon, cls in zip(grid.Lat, grid.Lon, grid.Cls):
        cls = str(cls)
        if cls in ("Ocean", "nan") or abs(lat - lat0) > 3 or abs(lon - lon0) > 3:
            continue
        d = (lat - lat0) ** 2 + (lon - lon0) ** 2
        if best is None or d < best[0]:
            best = (d, cls)
    if best and biome_of(best[1]):
        b = biome_of(best[1])
        cfacts[c["iso3"]].update({"main_biome": b, "biomes": [b], "biome_list": [[b, 100]]})

# ======================= Seas and landforms per country =======================
SEA_KINDS = {"sea", "ocean", "gulf", "bay"}
seas = [(P(f).get("name_en") or P(f).get("name"), P(f).get("featurecla"), shape(f["geometry"]).buffer(0)) for f in marine["features"]]
seas = [(n, k, g) for n, k, g in seas if n and k in SEA_KINDS and (k != "bay" and k != "gulf" or km2(g) > 150000)]
STREE = STRtree([g for _, _, g in seas])
for iso, g in CSHAPE.items():
    gb = g.buffer(0.25)
    hits = []
    for i in STREE.query(gb):
        n, k, sg = seas[i]
        if sg.intersects(gb):
            hits.append((n, km2(sg.intersection(gb))))
    if hits:
        agg = defaultdict(float)
        for n, a in hits:
            agg[n] += a
        cfacts[iso]["seas"] = [n for n, a in sorted(agg.items(), key=lambda x: -x[1]) if a > 50][:8]
LTREE = STRtree([l["geom"] for l in landforms])
for iso, g in CSHAPE.items():
    kinds, names = defaultdict(float), defaultdict(list)
    for i in LTREE.query(g):
        l = landforms[i]
        try:
            a = km2(l["geom"].intersection(g))
        except Exception:
            continue
        if a > 0 and (a / CAREA[iso] >= 0.03 or a >= 20000):
            kinds[l["kind"]] += a
            names[l["kind"]].append((l["name"], a))
    if kinds:
        cfacts[iso]["landforms"] = [k for k in sorted(kinds, key=lambda k: -kinds[k]) if k not in ("Peninsula", "Isthmus")]
        for k, key in (("Mountain range", "ranges"), ("Desert", "deserts"), ("Plateau", "plateaus")):
            if names.get(k):
                cfacts[iso][key] = [n for n, _ in sorted(names[k], key=lambda x: -x[1])][:6]
        cfacts[iso]["mountain_pct"] = round(min(100, 100 * kinds.get("Mountain range", 0) / CAREA[iso]))

# ======================= Factbook facts =======================
HAZ = [("Earthquakes", r"earthquake|seismic"), ("Volcanoes", r"volcan"), ("Tsunamis", r"tsunami"),
       ("Tropical storms", r"cyclone|hurricane|typhoon|tropical storm"), ("Floods", r"flood"), ("Droughts", r"drought"),
       ("Landslides", r"landslide|mudslide"), ("Avalanches", r"avalanche"), ("Dust and sand storms", r"dust|sandstorm|sand storm|haboob|harmattan"),
       ("Wildfires", r"fire"), ("Extreme cold", r"blizzard|severe cold|extreme cold|frost|ice storm|winter storm"),
       ("Extreme heat", r"heat wave|extreme heat"), ("Tornadoes", r"tornado"), ("Storm surges", r"storm surge")]
for r in rows_of("factbook_physical.csv"):
    c = cfacts[r["iso3"]]
    for k in ("highest_m", "lowest_m", "mean_elevation_m", "coastline_km", "agri_land_pct", "arable_pct", "forest_land_pct", "irrigated_km2"):
        if r[k] not in ("", None):
            c[k] = float(r[k])
            if k.endswith("_m") or k in ("coastline_km", "irrigated_km2"):
                c[k] = int(round(c[k]))
    for k in ("highest_point", "lowest_point", "terrain", "climate_text"):
        if r[k]:
            c[k] = re.sub(r"\s+[\d,]+$", "", re.sub(r"\s*\(.*?\)", "", r[k])).strip() if k.endswith("point") else r[k]
    if r["hazards"]:
        c["hazards_text"] = re.sub(r"\s*volcanism:\s*", ". Volcanoes: ", r["hazards"]).strip()
        c["hazards"] = [n for n, rx in HAZ if re.search(rx, r["hazards"], re.I)]
    else:
        c["hazards"] = []
for r in rows_of("rivers.csv"):
    for iso in r["countries"].split("|"):
        if iso:
            c = cfacts[iso]
            c.setdefault("rivers", []).append(r["name"])
            if int(r["length_km"]) > c.get("longest_river_km", 0):
                c["longest_river_km"] = int(r["length_km"]); c["longest_river"] = r["name"]
for l in layers["lake"]:
    for iso in l["iso"]:
        cfacts[iso].setdefault("lakes", []).append(l["name"])
for r in shed_rows:
    d = cfacts[r["iso3"]].setdefault("drains_to", [])
    if r["drains_to"] not in d:
        d.append(r["drains_to"])

# ======================= Write =======================
def dump(obj, name):
    with open(os.path.join(ROOT, name), "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    print("Wrote", name, os.path.getsize(os.path.join(ROOT, name)) // 1024, "KB")
dump({"layers": layers}, "physical.json")
dump(cfacts, "physical_countries.json")
