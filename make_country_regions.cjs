// Which IPCC AR6 reference regions each country covers, by area: node make_country_regions.cjs <regions.geojson> <d3.min.js> <topojson.min.js> > country_regions.json
const fs = require("fs"), path = require("path");
const [regF, d3F, topoF] = process.argv.slice(2);
const d3 = require(path.resolve(d3F)), topojson = require(path.resolve(topoF));
const regs = JSON.parse(fs.readFileSync(regF)).features.filter((f) => /Land/.test(f.properties.Type));
regs.forEach((f) => { if (d3.geoArea(f) > 2 * Math.PI) f.geometry = d3.geoProject ? f.geometry : rewind(f.geometry); });
function rewind(g) { const r = (ring) => ring.slice().reverse(); return g.type === "Polygon" ? { type: g.type, coordinates: g.coordinates.map(r) } : { type: g.type, coordinates: g.coordinates.map((p) => p.map(r)) }; }
const topo = JSON.parse(fs.readFileSync(path.join(__dirname, "world-50m.json")));
const C = JSON.parse(fs.readFileSync(path.join(__dirname, "countries.json")));
const byNum = new Map(C.map((r) => [String(+r.num), r.iso3]));
const geo = topojson.feature(topo, topo.objects.countries).features;
const out = {};
for (const f of geo) {
  const iso = byNum.get(String(+f.id)); if (!iso) continue;
  const [[x0, y0], [x1, y1]] = d3.geoBounds(f);
  const area = d3.geoArea(f) * 6371 * 6371;
  const step = Math.max(0.1, Math.min(1, Math.sqrt(area / 400) / 111));  // about 400 samples per country
  const w = {};
  const xs = x1 < x0 ? [[x0, 180], [-180, x1]] : [[x0, x1]];
  for (const [a, b] of xs) for (let x = a + step / 2; x < b; x += step) for (let y = y0 + step / 2; y < y1; y += step) {
    if (!d3.geoContains(f, [x, y])) continue;
    const r = regs.find((g) => d3.geoContains(g, [x, y]));
    if (r) w[r.properties.Acronym] = (w[r.properties.Acronym] || 0) + Math.cos(y * Math.PI / 180);
  }
  if (!Object.keys(w).length) { const c = d3.geoCentroid(f); const r = regs.find((g) => d3.geoContains(g, c)); if (r) w[r.properties.Acronym] = 1; }
  if (Object.keys(w).length) out[iso] = w;
}
process.stdout.write(JSON.stringify(out));
console.error(Object.keys(out).length, "countries");
