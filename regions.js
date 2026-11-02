/* Regions within countries (v56): about 1,800 regions in 188 countries from the Global Data Lab's Subnational
   Human Development Database. The HDI for every year from 1990, and life expectancy, schooling, income and gender
   measures (for women and men) for the latest year. Coloured on the map; the highest and lowest regions, the countries
   with the biggest gaps between their regions, every region of a country, and one region in detail.
   Data: regions_data.json and regions_geo.json (built by make_regions.py). */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let W, D = null, GEO = null, loading = null;
  const R = { on: false, key: "shdi", yi: null, pick: null, tab: "top", only: true, timer: null, country: null };
  // name, format, what it means, group, higher is better (null: neither)
  const M = {
    shdi: ["Human Development Index (HDI)", "dec3", "A score from 0 to 1 combining life expectancy, years in school and income.", "Human development", true],
    lifexp: ["Life expectancy", "yrs", "How long a baby born today can expect to live.", "Health", true],
    lifexpf: ["Life expectancy: women", "yrs", "", "Health", true],
    lifexpm: ["Life expectancy: men", "yrs", "", "Health", true],
    gap_lifexp: ["How much longer women live than men", "gapy", "Women's life expectancy minus men's, in years.", "Health", null],
    esch: ["Expected years in school (children)", "yrs", "How many years of school a child starting now can expect.", "Education", true],
    eschf: ["Expected years in school: girls", "yrs", "", "Education", true],
    eschm: ["Expected years in school: boys", "yrs", "", "Education", true],
    msch: ["Years in school (adults)", "yrs", "The average number of years adults aged 25 and over spent in school.", "Education", true],
    mschf: ["Years in school: women", "yrs", "", "Education", true],
    mschm: ["Years in school: men", "yrs", "", "Education", true],
    gap_msch: ["How many more years in school men had than women", "gapy", "Men's years in school minus women's. Above 0: men had more.", "Education", null],
    inc: ["Income per person", "usd", "Gross national income per person, in 2017 international dollars (adjusted for prices).", "Income", true],
    incf: ["Income per person: women", "usd", "", "Income", true],
    incm: ["Income per person: men", "usd", "", "Income", true],
    sgdi: ["Gender Development Index (GDI)", "dec3", "Women's HDI divided by men's. 1 means equal; below 1, women are behind.", "Gender", true],
    shdif: ["HDI: women", "dec3", "", "Gender", true],
    shdim: ["HDI: men", "dec3", "", "Gender", true],
    healthindex: ["Health index", "dec3", "The life expectancy part of the HDI, from 0 to 1.", "Parts of the HDI", true],
    edindex: ["Education index", "dec3", "The schooling part of the HDI, from 0 to 1.", "Parts of the HDI", true],
    incindex: ["Income index", "dec3", "The income part of the HDI, from 0 to 1.", "Parts of the HDI", true],
    pop: ["Population", "people", "", "People", null],
  };
  const compact = (v) => { const a = Math.abs(v); return a >= 1e9 ? +(v / 1e9).toPrecision(3) + "bn" : a >= 1e6 ? +(v / 1e6).toPrecision(3) + "M" : a >= 1e3 ? +(v / 1e3).toPrecision(3) + "k" : String(Math.round(v)); };
  function fmt(k, v) {
    if (v == null) return "no data";
    switch (M[k][1]) {
      case "dec3": return v.toFixed(3);
      case "yrs": return `${v.toFixed(1)} years`;
      case "gapy": return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)} years`;
      case "usd": return "$" + compact(v);
      case "people": return compact(v);
      default: return String(v);
    }
  }
  const idx = (k) => D.fields.indexOf(k);
  const regName = (code) => { const r = D.regions[code]; return r[1] === "Total" ? W.byIso.get(r[0])?.name || r[0] : r[1]; };
  const ctyName = (iso) => W.byIso.get(iso)?.name || iso;
  // a region's value: the HDI in the chosen year, or the latest figure
  function value(code, k = R.key) {
    if (k === "shdi" && R.yi != null) { const s = D.hdi.r[code]; return s ? s[R.yi] ?? null : null; }
    const r = D.regions[code]; return r ? r[2 + idx(k)] : null;
  }
  const yearOf = () => (R.key === "shdi" && R.yi != null ? D.hdi.years[R.yi] : D.year);

  function load() {
    if (D) return Promise.resolve();
    loading ||= Promise.all([
      window.__REGIONSDATA__ || fetch("regions_data.json?v=56").then((r) => r.json()),
      window.__REGIONSGEO__ || fetch("regions_geo.json?v=56").then((r) => r.json()),
    ]).then(([d, g]) => {
      D = d;
      GEO = topojson.feature(g, g.objects.regions).features.filter((f) => D.regions[f.properties.gdlcode]);
      R.yi = D.hdi.years.length - 1;
    }).catch(() => { D = null; });
    return loading;
  }
  // the regions to colour: all, or just those in countries that match the filters
  function shown() {
    const ms = W.lastEval?.act?.length ? new Set(W.matches.map((r) => r.iso3)) : null;
    return (code) => !ms || !R.only || ms.has(D.regions[code][0]);
  }
  function colourScale() {
    const k = R.key;
    // the HDI keeps the same colours in every year, so years can be compared
    const vals = k === "shdi" ? Object.values(D.hdi.r).flat().filter((v) => v != null) : Object.keys(D.regions).map((c) => value(c)).filter((v) => v != null);
    vals.sort((a, b) => a - b);
    const lo = d3.quantileSorted(vals, 0.02), hi = d3.quantileSorted(vals, 0.98);
    if (M[k][4] === null && /^gap/.test(k)) {
      const m = Math.max(Math.abs(lo), Math.abs(hi));
      return { s: d3.scaleDiverging(d3.interpolateRdBu).domain([m, 0, -m]), lo: -m, hi: m };
    }
    const log = M[k][1] === "usd" || M[k][1] === "people";
    const t = log ? (v) => Math.log10(Math.max(v, 1)) : (v) => v;
    const s0 = d3.scaleSequential((x) => d3.interpolateYlGnBu(0.12 + 0.85 * x)).domain([t(lo), t(hi)]);
    return { s: (v) => s0(t(v)), lo, hi, log };
  }

  // ---------- Map ----------
  let layer = null, paths = null, mesh = null;
  function ensureLayer() {
    if (layer) return;
    layer = W.layer("regions");
    const land = W.landNode?.();
    if (land && land.nextSibling !== layer.node()) land.parentNode.insertBefore(layer.node(), land.nextSibling);
  }
  function layout() {
    if (!R.on || !D) return;
    ensureLayer();
    const path = W.geoPath();
    paths = layer.selectAll("path.rg").data(GEO, (f) => f.properties.gdlcode).join("path").attr("class", "rg").attr("d", path)
      .attr("vector-effect", "non-scaling-stroke")
      .on("click", (e, f) => { e.stopPropagation(); R.pick = f.properties.gdlcode; R.country = D.regions[R.pick][0]; R.tab = "region"; card(); paint(); });
    const borders = topojson.mesh(W.topo, W.topo.objects.countries, (a, b) => a !== b);
    mesh = layer.selectAll("path.rgb").data([borders]).join("path").attr("class", "rgb").attr("d", path).attr("vector-effect", "non-scaling-stroke");
    paint();
  }
  function paint() {
    if (!layer) return;
    const vis = R.on && D && W.state.view === "map";
    layer.style("display", vis ? null : "none");
    document.body.classList.toggle("regions-on", !!vis);
    if (!vis || !paths) return;
    const { s } = colourScale(), ok = shown(), yr = yearOf();
    paths.style("fill", (f) => { const c = f.properties.gdlcode, v = value(c); return ok(c) && v != null ? s(v) : "var(--land)"; })
      .style("fill-opacity", (f) => (ok(f.properties.gdlcode) ? 1 : 0.35))
      .classed("picked", (f) => f.properties.gdlcode === R.pick)
      .attr("data-base", (f) => { const c = f.properties.gdlcode; return `${regName(c)}${D.regions[c][1] === "Total" ? "" : `, ${ctyName(D.regions[c][0])}`} · ${M[R.key][0]}: ${fmt(R.key, value(c))} (${yr})`; });
    paths.filter(".picked").raise();
    mesh?.raise();
  }

  // ---------- The card ----------
  function legendHTML() {
    const { s, lo, hi } = colourScale();
    const stops = d3.range(0, 1.0001, 0.1).map((x) => s(lo + (hi - lo) * x));
    return `<div class="rg-leg"><span>${esc(fmt(R.key, lo))}</span><span class="rg-ramp" style="background:linear-gradient(to right, ${stops.join(",")})"></span><span>${esc(fmt(R.key, hi))}</span></div>`;
  }
  function rows(filter = () => true) {
    const ok = shown();
    return Object.keys(D.regions).filter((c) => ok(c) && filter(c) && value(c) != null && D.regions[c][1] !== "Total").map((c) => ({ c, v: value(c) }));
  }
  const li = (x, extra = "") => `<li><button type="button" class="linkbtn" data-r="${x.c}">${esc(regName(x.c))}</button> <small>${esc(ctyName(D.regions[x.c][0]))}</small> <b>${esc(fmt(R.key, x.v))}</b>${extra}</li>`;
  function gaps() {
    const by = d3.groups(rows(), (x) => D.regions[x.c][0]).filter(([, a]) => a.length >= 3);
    return by.map(([iso, a]) => { a.sort((p, q) => q.v - p.v); return { iso, hi: a[0], lo: a[a.length - 1], d: a[0].v - a[a.length - 1].v, n: a.length }; }).sort((a, b) => b.d - a.d);
  }
  function bars(list) {
    const max = d3.max(list, (x) => Math.abs(x.v)) || 1;
    const nat = D.national[D.regions[list[0]?.c]?.[0]]?.[idx(R.key)];
    return `<ol class="rg-bars">${list.map((x) => `<li class="${x.c === R.pick ? "on" : ""}"><button type="button" class="linkbtn" data-r="${x.c}">${esc(regName(x.c))}</button><span class="rg-bar"><i style="width:${Math.max(1, (100 * Math.abs(x.v)) / max)}%;background:${colourScale().s(x.v)}"></i></span><b>${esc(fmt(R.key, x.v))}</b></li>`).join("")}</ol>
      ${nat != null && R.key !== "shdi" ? `<p class="hint">The whole country: ${esc(fmt(R.key, nat))}.</p>` : ""}`;
  }
  function card() {
    let el = $("#rgCard");
    if (!el) { el = document.createElement("div"); el.id = "rgCard"; el.className = "card livecard rgcard"; $("#mapstage").appendChild(el); }
    el.hidden = !R.on || W.state.view !== "map";
    $("#rgBtn")?.setAttribute("aria-pressed", String(R.on));
    if (el.hidden || !D) return;
    const k = R.key, yr = yearOf(), anyFilter = W.lastEval?.act?.length;
    const groups = d3.groups(Object.keys(M), (x) => M[x][3]);
    const all = rows().sort((a, b) => b.v - a.v);
    const country = R.country || W.state.selected;
    const cRows = country ? rows((c) => D.regions[c][0] === country).sort((a, b) => b.v - a.v) : [];
    const p = R.pick && D.regions[R.pick];
    const tabs = [["top", "Highest"], ["low", "Lowest"], ["gaps", "Biggest gaps"], ["country", "Country"], ["region", "Region"]];
    let body = "";
    if (R.tab === "top") body = `<ol class="cg-list">${all.slice(0, 10).map((x) => li(x)).join("")}</ol>`;
    else if (R.tab === "low") body = `<ol class="cg-list">${all.slice(-10).reverse().map((x) => li(x)).join("")}</ol>`;
    else if (R.tab === "gaps") {
      const g = gaps().slice(0, 10);
      body = `<p class="hint">Countries with the biggest difference between their highest and lowest region:</p><ol class="cg-list">${g.map((x) => `<li><button type="button" class="linkbtn" data-c="${x.iso}">${esc(ctyName(x.iso))}</button> <b>${esc(M[k][1] === "usd" || M[k][1] === "people" ? `${(x.hi.v / Math.max(1, x.lo.v)).toFixed(1)}×` : fmt(k, x.d).replace(/^\+/, ""))}</b> <small>${esc(regName(x.hi.c))} ${esc(fmt(k, x.hi.v))} · ${esc(regName(x.lo.c))} ${esc(fmt(k, x.lo.v))}</small></li>`).join("")}</ol>`;
    } else if (R.tab === "country") {
      body = cRows.length ? `${cRows.length >= 2 ? `<p class="hint">From ${esc(fmt(k, cRows[cRows.length - 1].v))} in ${esc(regName(cRows[cRows.length - 1].c))} to ${esc(fmt(k, cRows[0].v))} in ${esc(regName(cRows[0].c))}.</p>` : ""}${bars(cRows)}`
        : `<p class="hint">${country ? `There are no regional figures for ${esc(ctyName(country))}.` : "Click a region on the map, or a country in the list."}</p>`;
    } else if (p) {
      const iso = p[0], same = Object.keys(D.regions).filter((c) => D.regions[c][0] === iso && D.regions[c][1] !== "Total");
      const rank = (f) => { const v = D.regions[R.pick][2 + idx(f)]; if (v == null) return ""; const n = same.filter((c) => D.regions[c][2 + idx(f)] != null).length; const r = 1 + same.filter((c) => (D.regions[c][2 + idx(f)] ?? -Infinity) > v).length; return n > 1 ? `${r} of ${n}` : ""; };
      const ts = D.hdi.r[R.pick];
      body = `<p class="cg-name"><b>${esc(regName(R.pick))}</b>${p[1] === "Total" ? "" : `, ${esc(ctyName(iso))}`}</p>
        ${ts ? hdiLine(ts, D.hdi.r[iso + "t"]) : ""}
        <table class="rg-t"><tr><th></th><th>This region</th><th>${esc(ctyName(iso))}</th><th>Rank in country</th></tr>
        ${["shdi", "lifexp", "lifexpf", "lifexpm", "esch", "msch", "mschf", "mschm", "inc", "sgdi", "pop"].map((f) => `<tr><td>${esc(M[f][0])}</td><td><b>${esc(fmt(f, D.regions[R.pick][2 + idx(f)]))}</b></td><td>${esc(fmt(f, D.national[iso]?.[idx(f)]))}</td><td>${rank(f)}</td></tr>`).join("")}</table>`;
    } else body = `<p class="hint">Click a region on the map.</p>`;
    el.innerHTML = `<div class="dsc-head"><h3>🗺️ Regions within countries</h3><button type="button" class="iconbtn" id="rgX" aria-label="Close">×</button></div>
      <label class="fld rg-k"><span>Colour the regions by</span><select id="rgK">${groups.map(([g, ks]) => `<optgroup label="${esc(g)}">${ks.map((x) => `<option value="${x}" ${x === k ? "selected" : ""}>${esc(M[x][0])}</option>`).join("")}</optgroup>`).join("")}</select></label>
      ${k === "shdi" ? `<div class="cg-year"><button type="button" class="play" id="rgPlay" aria-label="${R.timer ? "Pause" : "Play"}">${R.timer ? "❚❚" : "▶"}</button><input type="range" id="rgRange" min="0" max="${D.hdi.years.length - 1}" step="1" value="${R.yi}" aria-label="Year"><b class="cg-y">${yr}</b></div>` : `<p class="hint rg-yr">${yr}. ${esc(M[k][2])}</p>`}
      ${legendHTML()}
      ${anyFilter ? `<label class="tog"><input type="checkbox" id="rgOnly" ${R.only ? "checked" : ""}> Only regions in countries that match your filters</label>` : ""}
      <div class="seg cg-tabs rg-tabs">${tabs.map(([t, l]) => `<button type="button" data-t="${t}" aria-checked="${R.tab === t}" role="radio">${esc(l)}</button>`).join("")}</div>
      ${body}
      <label class="fld cg-find"><input id="rgFind" list="rgList" placeholder="Find a region or country…" autocomplete="off"></label><datalist id="rgList"></datalist>
      <p class="hint">${Object.keys(D.regions).length.toLocaleString()} regions in ${new Set(Object.values(D.regions).map((r) => r[0])).size} countries. Source: Global Data Lab, Subnational Human Development Database (Smits &amp; Permanyer 2019).</p>`;
    $("#rgX").onclick = () => toggle(false);
    $("#rgK").onchange = (e) => { R.key = e.target.value; stop(); paint(); card(); };
    if ($("#rgRange")) $("#rgRange").oninput = (e) => { stop(); R.yi = +e.target.value; paint(); card(); };
    if ($("#rgPlay")) $("#rgPlay").onclick = () => (R.timer ? stop() : play());
    if ($("#rgOnly")) $("#rgOnly").onchange = (e) => { R.only = e.target.checked; paint(); card(); };
    el.querySelectorAll(".rg-tabs button").forEach((b) => (b.onclick = () => { R.tab = b.dataset.t; card(); }));
    el.querySelectorAll("[data-r]").forEach((b) => (b.onclick = () => { R.pick = b.dataset.r; R.country = D.regions[R.pick][0]; R.tab = "region"; zoomTo(R.pick); card(); paint(); }));
    el.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => { R.country = b.dataset.c; R.tab = "country"; W.zoomToCountry?.(R.country); card(); }));
    const inp = $("#rgFind");
    inp.oninput = () => {
      const q = inp.value.trim().toLowerCase();
      if (q.length < 2) return;
      const opts = [];
      W.rows.filter((r) => r.name.toLowerCase().includes(q) && Object.values(D.regions).some((x) => x[0] === r.iso3)).slice(0, 8).forEach((r) => opts.push(`${r.name} (country)`));
      Object.keys(D.regions).filter((c) => regName(c).toLowerCase().includes(q)).slice(0, 30).forEach((c) => opts.push(`${regName(c)} (${ctyName(D.regions[c][0])})`));
      $("#rgList").innerHTML = opts.map((o) => `<option value="${esc(o)}"></option>`).join("");
      const m = inp.value.match(/^(.*) \((.*)\)$/);
      if (!m) return;
      if (m[2] === "country") { const r = W.rows.find((x) => x.name === m[1]); if (r) { R.country = r.iso3; R.tab = "country"; W.zoomToCountry?.(r.iso3); card(); } return; }
      const hit = Object.keys(D.regions).find((c) => regName(c) === m[1] && ctyName(D.regions[c][0]) === m[2]);
      if (hit) { R.pick = hit; R.country = D.regions[hit][0]; R.tab = "region"; zoomTo(hit); card(); paint(); }
    };
  }
  function hdiLine(ts, nat) {
    const Wd = 320, H = 120, ml = 36, mr = 8, mt = 10, mb = 20, ys = D.hdi.years;
    const x = d3.scaleLinear().domain([ys[0], ys[ys.length - 1]]).range([ml, Wd - mr]);
    const all = ts.concat(nat || []).filter((v) => v != null);
    const y = d3.scaleLinear().domain([Math.max(0, d3.min(all) - 0.05), Math.min(1, d3.max(all) + 0.03)]).nice().range([H - mb, mt]);
    const line = (a) => d3.line().defined((v) => v != null).x((v, i) => x(ys[i])).y((v) => y(v))(a);
    return `<svg class="cg-svg" viewBox="0 0 ${Wd} ${H}" role="img" aria-label="HDI over time">
      ${y.ticks(3).map((v) => `<line x1="${ml}" x2="${Wd - mr}" y1="${y(v)}" y2="${y(v)}" stroke="#d8dde1" stroke-width=".6"/><text x="${ml - 4}" y="${y(v) + 3.5}" font-size="10" text-anchor="end" fill="#56646e">${v.toFixed(2)}</text>`).join("")}
      ${[ys[0], 2000, 2010, ys[ys.length - 1]].map((v) => `<text x="${x(v)}" y="${H - 5}" font-size="10" text-anchor="middle" fill="#56646e">${v}</text>`).join("")}
      ${nat ? `<path d="${line(nat)}" fill="none" stroke="#8a96a3" stroke-width="1.6" stroke-dasharray="4 3"/>` : ""}
      <path d="${line(ts)}" fill="none" stroke="#1d6fd1" stroke-width="2.4"/>
    </svg><p class="hint">HDI, ${ys[0]}–${ys[ys.length - 1]}. Blue: this region. Dashed: the whole country.</p>`;
  }
  function zoomTo(code) {
    const f = GEO.find((g) => g.properties.gdlcode === code);
    if (f) { const c = d3.geoCentroid(f); W.zoomToPoint(c[0], c[1], 4); }
  }
  function play() {
    if (R.yi >= D.hdi.years.length - 1) R.yi = 0;
    R.timer = setInterval(() => { R.yi++; if (R.yi >= D.hdi.years.length - 1) stop(); paint(); card(); }, 500);
    card();
  }
  function stop() { if (R.timer) { clearInterval(R.timer); R.timer = null; card(); } }
  async function toggle(on) {
    R.on = on ?? !R.on;
    const b = $("#rgBtn");
    if (R.on) { if (b) b.textContent = "🗺️ Loading…"; await load(); if (b) b.textContent = "🗺️ Regions"; if (!D) { R.on = false; } else layout(); }
    else stop();
    paint(); card();
  }
  function init() {
    W = window.WC;
    let box = $("#mapbtns");
    if (!box) { box = document.createElement("div"); box.id = "mapbtns"; box.className = "mapbtns"; $("#mapstage").appendChild(box); }
    const b = document.createElement("button");
    b.type = "button"; b.id = "rgBtn"; b.className = "mmbtn"; b.setAttribute("aria-pressed", "false");
    b.textContent = "🗺️ Regions"; b.title = "Regions within countries: human development, health, schooling and income for 1,800 regions";
    b.onclick = () => toggle();
    box.appendChild(b);
  }
  window.WRG = {
    init, toggle, layout: () => { if (R.on && D) layout(); },
    refresh: () => { if (R.on && D) { paint(); const el = $("#rgCard"); if (el) { if (W.state.view !== "map") el.hidden = true; else card(); } } },
    _R: R, get data() { return D; }, fmt, M,
  };
})();
