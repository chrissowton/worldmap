// Builds features.json: rivers, lakes and named places (seas, mountain ranges, deserts,
// plateaus, peaks and so on) from Natural Earth, for the labels that appear as you zoom in.
//   npm install
//   node make_features.mjs            (downloads the Natural Earth files from GitHub)
import fs from "fs";
import { topology } from "topojson-server";
import { presimplify, simplify, quantile } from "topojson-simplify";
import { quantize } from "topojson-client";
import { geoCentroid, geoArea } from "d3-geo";

const NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/";
const get = async (name) => (await fetch(NE + name + ".geojson")).json();
// D3 expects shapes wound the opposite way to GeoJSON's convention; flip any that come out inside-out.
function rewind(f) {
  const g = f.geometry;
  if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) return f;
  if (geoArea(f) > 2 * Math.PI) {
    const flip = (rings) => rings.map((r) => r.slice().reverse());
    g.coordinates = g.type === "Polygon" ? flip(g.coordinates) : g.coordinates.map(flip);
  }
  return f;
}
const props = (f) => Object.fromEntries(Object.entries(f.properties).map(([k, v]) => [k.toLowerCase(), v]));

const [rivers, lakes, marine, regions, peaks] = await Promise.all([
  get("ne_50m_rivers_lake_centerlines"), get("ne_50m_lakes"), get("ne_50m_geography_marine_polys"),
  get("ne_50m_geography_regions_polys"), get("ne_10m_geography_regions_elevation_points"),
]);
[lakes, marine, regions].forEach((fc) => fc.features.forEach(rewind));
// Ocean shapes wrap around the world, so their centres land in odd places: place these by hand
const OCEANS = { "Arctic Ocean": [[0, 83]], "Atlantic Ocean": [[-40, 30], [-15, -32]], "Pacific Ocean": [[-150, 18], [-125, -30]], "Indian Ocean": [[78, -22]], "Southern Ocean": [[20, -62], [-120, -64]] };

// Natural Earth's min_label is a web-map zoom level; the site converts it to its own zoom.
const labels = [];
const add = (name, type, [lon, lat], minLabel, extra) => {
  if (!name) return;
  labels.push([name, type, +lon.toFixed(2), +lat.toFixed(2), +(+minLabel).toFixed(1), ...(extra ? [extra] : [])]);
};
for (const [name, pts] of Object.entries(OCEANS)) pts.forEach((pt) => add(name, "ocean", pt, 1));
for (const f of marine.features) {
  const p = props(f);
  if (p.featurecla === "ocean") continue;
  add(p.name_en || p.name, p.featurecla, geoCentroid(f), p.min_label ?? p.scalerank + 1);
}
const KEEP = { "Range/mtn": "range", Desert: "desert", Plateau: "plateau", Basin: "basin", Plain: "plain", Delta: "delta", Tundra: "tundra", Valley: "valley", Lowland: "lowland", Peninsula: "peninsula", "Pen/cape": "peninsula" };
for (const f of regions.features) {
  const p = props(f), t = KEEP[p.featurecla];
  if (t) add(p.name_en || p.name, t, geoCentroid(f), p.min_label ?? p.scalerank + 1);
}
for (const f of peaks.features) {
  const p = props(f);
  if (p.featurecla === "mountain" && p.elevation) add(p.name_en || p.name, "peak", f.geometry.coordinates, p.min_zoom ?? 6, Math.round(p.elevation));
}
for (const f of lakes.features) {
  const p = props(f);
  if (p.name && geoArea(f) > 2e-6) add(p.name_en || p.name, "lake", geoCentroid(f), p.min_label ?? p.scalerank + 2);
}

// Lines and shapes, simplified and compressed as TopoJSON
const keepProps = (fc, fn) => ({ type: "FeatureCollection", features: fc.features.map((f) => ({ type: "Feature", geometry: f.geometry, properties: fn(props(f)) })) });
let topo = topology({
  rivers: keepProps(rivers, (p) => ({ r: p.scalerank, n: p.name_en || p.name || "" })),
  lakes: keepProps(lakes, (p) => ({ r: p.scalerank })),
}, 1e5);
topo = presimplify(topo);
topo = simplify(topo, quantile(topo, 0.35));
topo = quantize(topo, 1e5);

fs.writeFileSync(new URL("./features.json", import.meta.url), JSON.stringify({ shapes: topo, labels }));
console.log(`Wrote features.json: ${labels.length} labels`);
