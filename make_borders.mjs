// Works out each country's land neighbours and the length of each shared border,
// from Natural Earth's 1:10m country shapes. Writes borders.csv.
//   npm install          (installs world-atlas, topojson-client and d3-geo from package.json)
//   node make_borders.mjs
// Lengths are measured along the map's border lines, so treat them as approximate.
import fs from "fs";
import { neighbors, mesh } from "topojson-client";
import { geoLength } from "d3-geo";

const topo = JSON.parse(fs.readFileSync(new URL("./node_modules/world-atlas/countries-10m.json", import.meta.url)));
const countries = JSON.parse(fs.readFileSync(new URL("./countries.json", import.meta.url)));
const byNum = new Map(countries.filter((c) => c.num).map((c) => [String(+c.num), c.iso3]));
// shapes without a country code: count them as part of the recognised state
const NAME_FIX = { Kosovo: "UNK", Somaliland: "SOM", "N. Cyprus": "CYP" };
const geoms = topo.objects.countries.geometries;
const isoOf = geoms.map((g) => (g.id && byNum.get(String(+g.id))) || NAME_FIX[g.properties.name] || null);

const nb = neighbors(geoms);
const pairs = new Set();
nb.forEach((list, i) => list.forEach((j) => {
  const a = isoOf[i], b = isoOf[j];
  if (a && b && a !== b) pairs.add([a, b].sort().join("|"));
}));
const R = 6371.0088; // mean Earth radius, km
const rows = [];
for (const p of pairs) {
  const [a, b] = p.split("|");
  const m = mesh(topo, topo.objects.countries, (x, y) => {
    const ia = isoOf[geoms.indexOf(x)], ib = isoOf[geoms.indexOf(y)];
    return (ia === a && ib === b) || (ia === b && ib === a);
  });
  const km = Math.round(geoLength(m) * R);
  if (km > 0) rows.push([a, b, km]);
}
rows.sort((x, y) => x[0].localeCompare(y[0]) || x[1].localeCompare(y[1]));
fs.writeFileSync(new URL("./borders.csv", import.meta.url),
  "# Land borders between countries, measured on Natural Earth 1:10m shapes (km, approximate)\ncountry_a,country_b,km\n" +
  rows.map((r) => r.join(",")).join("\n") + "\n");
console.log(`Wrote ${rows.length} borders`);
