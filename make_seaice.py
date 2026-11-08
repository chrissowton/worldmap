"""Arctic sea ice in September (the yearly minimum), from the NSIDC Sea Ice Index v4 (G02135, Fetterer and others).
Usage: python3 make_seaice.py N_09_extent_v4.0.csv extent_N_YYYY09_polygon_v4.0.shp ...   -> seaice.json
The outlines are moved from NSIDC's polar stereographic grid to longitude and latitude, simplified (5 km), and
patches smaller than 1,000 km² are dropped. Needs pyshp, pyproj and shapely."""
import csv, json, re, sys
import shapefile
from pyproj import Transformer
from shapely.geometry import shape, mapping, MultiPolygon, Polygon
from shapely.ops import unary_union
csvp, shps = sys.argv[1], sys.argv[2:]
ext = {}
for r in csv.reader(open(csvp)):
    try: y, v = int(r[0]), float(r[4])
    except (ValueError, IndexError): continue
    if v > 0: ext[y] = v
tr = None
shapes = {}
for p in shps:
    y = int(re.search(r"_(\d{4})09_", p).group(1))
    if tr is None:
        tr = Transformer.from_crs(open(p.replace(".shp", ".prj")).read(), "EPSG:4326", always_xy=True)
    polys = [shape(s.__geo_interface__) for s in shapefile.Reader(p).shapes()]
    g = unary_union([q.buffer(0) for q in polys])
    parts = [q for q in (g.geoms if hasattr(g, "geoms") else [g]) if q.area > 1e9]
    g = MultiPolygon([q.simplify(5000) for q in parts])
    def ring(cs):
        out = []
        for x, yy in cs:
            lon, lat = tr.transform(x, yy)
            out.append([round(lon, 2), round(lat, 2)])
        return out
    shapes[y] = [[ring(q.exterior.coords)] + [ring(h.coords) for h in q.interiors if Polygon(h).area > 1e9] for q in g.geoms]
json.dump({"source": "NSIDC Sea Ice Index v4 (G02135): September extent and outlines", "extent": ext, "shapes": shapes},
          open("seaice.json", "w"), separators=(",", ":"))
print("seaice.json:", len(ext), "years of extent;", {y: sum(len(r) for p in s for r in p) for y, s in shapes.items()}, "points")
