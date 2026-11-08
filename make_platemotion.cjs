// Plate motion for the map (v66): node make_platemotion.cjs <PB2002_plates.json> <PB2002_poles.dat.txt> <PB2002_steps.dat.txt> <d3.min.js>
// Writes platemotion.json: arrows showing how each plate moves (in a "no-net-rotation" frame, worked out here from
// Bird's (2003) Euler poles, which are given relative to the Pacific plate), and arrows across plate boundaries
// showing whether the plates move apart, together or past each other, with the speed (PB2002 steps).
const fs = require("fs");
const [platesF, polesF, stepsF, d3F] = process.argv.slice(2);
const d3 = require(require("path").resolve(d3F));
const R = 6371e3, rad = Math.PI / 180;
const plates = JSON.parse(fs.readFileSync(platesF)).features;
plates.forEach((f) => { if (d3.geoArea(f) > 2 * Math.PI) f.geometry.coordinates = f.geometry.coordinates.map((r) => r.slice().reverse()); });
const poles = {};
for (const l of fs.readFileSync(polesF, "utf8").split("\n")) {
  const m = l.match(/^([A-Z]{2})\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)/);
  if (m) { const la = +m[2] * rad, lo = +m[3] * rad, w = +m[4] * rad / 1e6; poles[m[1]] = [w * Math.cos(la) * Math.cos(lo), w * Math.cos(la) * Math.sin(lo), w * Math.sin(la)]; }
}
const unit = (lon, lat) => [Math.cos(lat * rad) * Math.cos(lon * rad), Math.cos(lat * rad) * Math.sin(lon * rad), Math.sin(lat * rad)];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const plateAt = (lon, lat) => { for (const f of plates) if (d3.geoContains(f, [lon, lat])) return f.properties.Code; return null; };
// no-net-rotation: solve (sum Q) Omega = sum Q_p w_p, with Q_p = integral over plate p of (I - r r^T) dA
const Qs = [[0,0,0],[0,0,0],[0,0,0]], b = [0, 0, 0];
const step = 1;
for (let lat = -89.5; lat < 90; lat += step) for (let lon = -179.5; lon < 180; lon += step) {
  const c = plateAt(lon, lat); if (!c || !poles[c]) continue;
  const dA = Math.cos(lat * rad), r = unit(lon, lat), w = poles[c];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const q = ((i === j ? 1 : 0) - r[i] * r[j]) * dA; Qs[i][j] += q; b[i] += q * w[j]; }
}
// 3x3 solve
const det = (m) => m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1]) - m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0]) + m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
const D = det(Qs), Om = [0, 1, 2].map((k) => det(Qs.map((row, i) => row.map((v, j) => (j === k ? b[i] : v)))) / D);
const wN = {}; for (const c in poles) wN[c] = poles[c].map((v, i) => v - Om[i]);
function vel(c, lon, lat) {  // mm a year: east, north
  const r = unit(lon, lat), v = cross(wN[c], r).map((x) => x * R * 1000);
  const e = [-Math.sin(lon * rad), Math.cos(lon * rad), 0], n = [-Math.sin(lat * rad) * Math.cos(lon * rad), -Math.sin(lat * rad) * Math.sin(lon * rad), Math.cos(lat * rad)];
  return [v[0] * e[0] + v[1] * e[1] + v[2] * e[2], v[0] * n[0] + v[1] * n[1] + v[2] * n[2]];
}
const arrows = [];
for (let lat = -75; lat <= 80; lat += 12) {
  const dl = 14 / Math.max(0.35, Math.cos(lat * rad));
  for (let lon = -180 + (((lat + 75) / 12) % 2) * dl / 2; lon < 180; lon += dl) {
    const c = plateAt(lon, lat); if (!c || !wN[c]) continue;
    const [ve, vn] = vel(c, lon, lat);
    arrows.push([+lon.toFixed(1), lat, c, +ve.toFixed(1), +vn.toFixed(1)]);
  }
}
// per plate: area and average speed
const names = {}; plates.forEach((f) => (names[f.properties.Code] = f.properties.PlateName));
const stats = {};
for (let lat = -89; lat < 90; lat += 2) for (let lon = -179; lon < 180; lon += 2) {
  const c = plateAt(lon, lat); if (!c || !wN[c]) continue;
  const [ve, vn] = vel(c, lon, lat), dA = Math.cos(lat * rad);
  const s = (stats[c] ||= { a: 0, v: 0, e: 0, n: 0 }); s.a += dA; s.v += Math.hypot(ve, vn) * dA; s.e += ve * dA; s.n += vn * dA;
}
const plateList = Object.entries(stats).map(([c, s]) => {
  const az = (Math.atan2(s.e, s.n) / rad + 360) % 360;
  return [c, names[c], Math.round(s.a * (2 * Math.PI / 180) * (2 * Math.PI / 180) * R * R / 1e6 / 1e3) * 1e3, +(s.v / s.a).toFixed(0), Math.round(az)];
}).sort((a, b) => b[2] - a[2]);
// boundary arrows: one every ~400 km along each boundary, from the PB2002 steps
const steps = fs.readFileSync(stepsF, "utf8").split("\n").filter((l) => l.trim()).map((l) => ({
  id: l.slice(6, 11).trim(), lon1: +l.slice(12, 20), lat1: +l.slice(21, 28), lon2: +l.slice(29, 37), lat2: +l.slice(38, 45),
  len: +l.slice(46, 51), az: +l.slice(52, 55), v: +l.slice(56, 61), vaz: +l.slice(62, 65), div: +l.slice(66, 72), rl: +l.slice(73, 79), cls: l.slice(92, 95).trim() }));
const bnd = []; let acc = 0, last = "";
for (const s of steps) {
  if (s.id !== last) { acc = 200; last = s.id; }
  acc += s.len;
  if (acc < 650) continue;
  acc = 0;
  let lon = (s.lon1 + s.lon2) / 2; if (Math.abs(s.lon1 - s.lon2) > 180) lon += 180; if (lon > 180) lon -= 360;
  bnd.push([+lon.toFixed(2), +((s.lat1 + s.lat2) / 2).toFixed(2), s.id, s.cls, +s.v.toFixed(0), +s.div.toFixed(0), +s.rl.toFixed(0), s.az]);
}
fs.writeFileSync("platemotion.json", JSON.stringify({ source: "PB2002 (Bird, 2003): Euler poles, plate outlines and boundary steps; no-net-rotation frame worked out for this site",
  plates: plateList, arrows, boundaries: bnd }));
console.log("Omega (deg/Ma)", Om.map((x) => (x / rad * 1e6).toFixed(3)), "arrows", arrows.length, "boundary marks", bnd.length);
console.log(plateList.slice(0, 16).map((p) => `${p[1]} ${p[2]}km2 ${p[3]}mm/a az${p[4]}`).join("\n"));
