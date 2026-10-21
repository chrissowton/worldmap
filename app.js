/* Which Countries? — application code. No build step; plain JavaScript + D3. */
(async function () {
  "use strict";

  // ---------- Load data ----------
  const loadJSON = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.json(); });
  const [rows, topo, cityRows, flows, timeseries] = await Promise.all([
    window.__COUNTRIES__ || loadJSON("countries.json"),
    window.__WORLD__ || loadJSON("world-50m.json"),
    window.__CITIES__ || loadJSON("cities.json").catch(() => []),
    window.__FLOWS__ || loadJSON("refugee_flows.json").catch(() => []),
    window.__TIMESERIES__ || loadJSON("timeseries.json").catch(() => null),
  ]);
  // cities.json rows: [name, iso3, lat, lon, population, capital]
  const cities = cityRows.map(([name, iso3, lat, lon, pop, cap], id) => ({ id, name, iso3, lat, lon, city_population: pop, city_capital: !!cap }));

  const FILTERS = window.FILTERS;
  // ---------- Year slider: which measures have yearly data ----------
  const TS = timeseries ? timeseries.series : {};
  const TS_YEARS = timeseries ? timeseries.years : [];
  const REGIMES = ["Closed autocracy", "Electoral autocracy", "Electoral democracy", "Liberal democracy"];
  const TIME_KEYS = new Set(Object.keys(TS).concat(TS.regime ? ["democracy"] : []));
  FILTERS.forEach((f) => { if (TIME_KEYS.has(f.key)) f.time = true; });
  const timeFrom = (key) => {
    const s = TS[key === "democracy" ? "regime" : key];
    if (!s) return null;
    let first = Infinity;
    for (const arr of Object.values(s)) { const i = arr.findIndex((v) => v != null); if (i >= 0 && i < first) first = i; }
    return first === Infinity ? null : TS_YEARS[first];
  };
  const SITE = window.SITE || {};
  const F = Object.fromEntries(FILTERS.map((f) => [f.key, f]));
  const byIso = new Map(rows.map((r) => [r.iso3, r]));
  const byNum = new Map(rows.filter((r) => r.num).map((r) => [String(+r.num), r]));
  const NAME_FIX = { Kosovo: "UNK", Somaliland: "SOM", "N. Cyprus": "CYP" };

  const $ = (s) => document.querySelector(s);
  // category slug used for colour-coding, e.g. "UN & treaties" -> "un-treaties"
  const gslug = (g) => g.toLowerCase().replace(/&/g, "").replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---------- Number formatting ----------
  function sig(v, n = 2) {
    if (v === 0) return 0;
    const p = Math.pow(10, Math.floor(Math.log10(Math.abs(v))) - n + 1);
    return Math.round(v / p) * p;
  }
  function compact(v) {
    const a = Math.abs(v);
    if (a >= 1e9) return +(v / 1e9).toPrecision(3) + "bn";
    if (a >= 1e6) return +(v / 1e6).toPrecision(3) + "M";
    if (a >= 1e3) return +(v / 1e3).toPrecision(3) + "k";
    return String(+v.toPrecision(3));
  }
  const UNITS = {
    per1000: " per 1,000 people", per1000birth: " per 1,000 births", per1000women: " per 1,000 teenage girls",
    per100k: " per 100,000 births", density: " people per km²", years: " years",
  };
  // Full form, used in sentences and profiles: "20 per 1,000 people"
  function fmt(f, v) {
    if (v == null || Number.isNaN(v)) return "no data";
    return fmtShort(f, v) + (UNITS[f.format] || "");
  }
  // Short form, used in chips, sliders and lists: "20"
  function fmtShort(f, v) {
    if (v == null || Number.isNaN(v)) return "no data";
    const a = Math.abs(v);
    switch (f.format) {
      case "pct": return (a < 10 && !Number.isInteger(v) ? v.toFixed(1) : Math.round(v)) + "%";
      case "people": return compact(v);
      case "usd": return "$" + compact(v);
      case "index": return v.toFixed(2);
      case "dec1": return String(+v.toFixed(1));
      case "dec3": return v.toFixed(3);
      case "dec2": return v.toFixed(2);
      case "rank": return "#" + Math.round(v);
      case "km2": return compact(v) + " km²";
      case "tonnes": return (a < 10 ? +v.toFixed(1) : Math.round(v)) + " t";
      case "per1000": case "per1000birth": case "per1000women": return String(a < 10 ? +v.toFixed(1) : Math.round(v));
      case "density": return compact(v);
      case "per100k": case "years": return String(Math.round(v));
      default: return String(Math.round(v));
    }
  }
  function fmtFull(f, v) {
    if (v == null) return "no data";
    if (f.format === "people") return d3.format(",")(v);
    if (f.format === "usd") return "$" + d3.format(",")(v);
    if (f.format === "km2") return d3.format(",")(Math.round(v)) + " km²";
    if (f.format === "tonnes") return v.toFixed(2) + " t";
    return fmt(f, v);
  }
  function yearLabel(f) {
    if (f.yearText) return f.yearText;
    if (typeof f.year === "number") return String(f.year);
    if (!f.year) return "";
    const ys = rows.map((r) => r[f.year]).filter((y) => typeof y === "number");
    if (!ys.length) return "";
    const counts = d3.rollup(ys, (v) => v.length, (y) => y);
    const [mode, n] = [...counts].sort((a, b) => b[1] - a[1])[0];
    return n / ys.length >= 0.8 ? String(mode) : `latest available, mostly ${mode}`;
  }
  function parseNum(f, s) {
    s = String(s).trim().toLowerCase().replace(/[$,%#\s]|km²|km2|t$/g, "");
    const m = s.match(/^(-?[\d.]+)(k|m|bn|b)?$/);
    if (!m) return null;
    const mult = { k: 1e3, m: 1e6, b: 1e9, bn: 1e9 }[m[2]] || 1;
    return parseFloat(m[1]) * mult;
  }

  // ---------- Filter domains and options ----------
  for (const f of FILTERS) {
    const vals = (f.target === "city" ? cities : rows).map((r) => r[f.key]);
    if (f.type === "range") {
      const nums = vals.filter((v) => typeof v === "number" && (f.scale !== "log" || v > 0)).sort((a, b) => a - b);
      if (f.bounds) [f.dmin, f.dmax] = f.bounds;
      else if (f.clip) { f.dmin = d3.quantileSorted(nums, 0.02); f.dmax = d3.quantileSorted(nums, 0.98); }
      else { f.dmin = nums[0]; f.dmax = nums[nums.length - 1]; }
      if (f.clip && f.step) { f.dmin = Math.floor(f.dmin / f.step) * f.step; f.dmax = Math.ceil(f.dmax / f.step) * f.step; }
      f.toT = f.scale === "log" ? (v) => Math.log10(Math.max(v, f.dmin)) : (v) => v;
      f.fromT = f.scale === "log" ? (t) => Math.pow(10, t) : (t) => t;
      f.round = f.scale === "log" ? (v) => sig(v, 2) : (v) => Math.round(v / f.step) * f.step;
    } else if (f.type === "multi" || f.type === "cat") {
      const set = new Set();
      vals.forEach((v) => (Array.isArray(v) ? v : [v]).forEach((x) => x != null && x !== "" && set.add(x)));
      const all = [...set];
      f.options = f.order ? f.order.filter((o) => set.has(o)).concat(all.filter((o) => !f.order.includes(o)).sort()) : all.sort((a, b) => a.localeCompare(b));
    }
  }

  // ---------- State ----------
  const state = {
    filters: [],          // [{ key, min, max } | { key, values: [] } | { key, value: bool }]
    territories: false,   // include non-sovereign territories
    colourBy: "",
    sort: "",
    open: null,           // key of filter whose editor is open
    selected: null,       // iso3 of country in detail view
    starterHidden: false,
    tab: "countries",     // results list: "countries" or "cities"
    flow: null,           // refugee flow view: { iso, dir: "from" | "to" }
    year: null,           // year slider: null means the latest data
  };

  // Swap each country's time-enabled values for the chosen year (or back to the latest).
  function applyYear(year) {
    const keys = Object.keys(TS);
    for (const r of rows) {
      if (!r._latest) {
        r._latest = {};
        for (const k of keys.concat(["democracy"])) { r._latest[k] = r[k]; r._latest[k + "_year"] = r[k + "_year"]; }
      }
      for (const k of keys.concat(["democracy"])) {
        delete r[k]; delete r[k + "_year"];
        if (year == null) {
          if (r._latest[k] !== undefined) r[k] = r._latest[k];
          if (r._latest[k + "_year"] !== undefined) r[k + "_year"] = r._latest[k + "_year"];
        }
      }
      if (year == null) continue;
      const i = year - TS_YEARS[0];
      for (const k of keys) {
        const v = TS[k][r.iso3]?.[i];
        if (v == null) continue;
        if (k === "regime") { r.regime = REGIMES[v]; r.democracy = v >= 2; r.democracy_year = year; }
        else r[k] = v;
        r[k + "_year"] = year;
      }
    }
  }

  function makeFilter(key, preset = {}) {
    const f = F[key];
    if (f.type === "range") {
      const init = f.initial || {};
      return { key, min: preset.min ?? init.min ?? f.dmin, max: preset.max ?? init.max ?? f.dmax };
    }
    if (f.type === "bool") return { key, value: preset.value ?? true };
    return { key, values: preset.values ? [...preset.values] : [] };
  }

  // Does a filter currently restrict anything?
  function isActive(fl) {
    const f = F[fl.key];
    if (f.type === "range") return fl.min > f.dmin || fl.max < f.dmax;
    if (f.type === "bool") return true;
    return fl.values.length > 0;
  }
  function passes(r, fl) {
    const f = F[fl.key];
    const v = r[fl.key];
    if (f.type === "range") {
      if (!isActive(fl)) return true;
      if (typeof v !== "number") return false;
      // the ends of the slider mean "no limit"
      const lo = fl.min <= f.dmin ? -Infinity : fl.min, hi = fl.max >= f.dmax ? Infinity : fl.max;
      return v >= lo - 1e-9 && v <= hi + 1e-9;
    }
    if (f.type === "bool") return v === fl.value;
    if (!fl.values.length) return true;
    if (f.type === "multi") return Array.isArray(v) && v.some((x) => fl.values.includes(x));
    return fl.values.includes(v);
  }

  const NEAR_MAP = 25;
  const expandedNear = new Set();
  const pool = () => rows.filter((r) => r.sovereign || state.territories);
  const isCity = (fl) => F[fl.key].target === "city";
  const active = () => state.filters.filter((fl) => !isCity(fl) && isActive(fl));
  const cityActive = () => state.filters.filter((fl) => isCity(fl) && isActive(fl));
  const showCities = () => state.filters.some(isCity);

  function evaluate() {
    const act = active();
    const res = new Map();
    for (const r of pool()) {
      const fails = act.filter((fl) => !passes(r, fl));
      res.set(r.iso3, { match: fails.length === 0, near: act.length >= 2 && fails.length === 1, fails });
    }
    // Group near misses by the one filter they fail. Small groups are the interesting ones,
    // so only groups of up to NEAR_MAP countries are shaded on the map.
    const groups = new Map();
    for (const [iso, e] of res) if (e.near) {
      const key = e.fails[0].key;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(byIso.get(iso));
    }
    for (const [key, list] of groups) {
      const shade = list.length <= NEAR_MAP;
      list.forEach((r) => (res.get(r.iso3).shade = shade));
    }
    // Cities: those in matching countries that pass every city filter
    let cityList = [];
    if (showCities()) {
      const ca = cityActive();
      cityList = cities.filter((c) => { const e = res.get(c.iso3); return e && e.match && ca.every((fl) => passes(c, fl)); });
    }
    return { act, res, groups, cityList };
  }

  // ---------- Text: chips and sentence ----------
  function joinOr(list) {
    if (list.length <= 1) return list.join("");
    if (list.length === 2) return list.join(" or ");
    if (list.length > 4) return `${list.slice(0, 3).join(", ")} or ${list.length - 3} others`;
    return list.slice(0, -1).join(", ") + " or " + list[list.length - 1];
  }
  function bound(fl) {
    const f = F[fl.key];
    const lo = fl.min > f.dmin, hi = fl.max < f.dmax;
    if (f.format === "rank") {
      if (lo && hi) return `between #${Math.round(fl.min)} and #${Math.round(fl.max)}`;
      return lo ? `#${Math.round(fl.min)} or lower` : `in the top ${Math.round(fl.max)}`;
    }
    if (lo && hi) return `between ${fmt(f, fl.min)} and ${fmt(f, fl.max)}`;
    if (lo) return `at least ${fmt(f, fl.min)}`;
    return `at most ${fmt(f, fl.max)}`;
  }
  function phrase(fl) {
    const f = F[fl.key];
    if (!isActive(fl)) return null;
    if (f.type === "range") return f.say(bound(fl));
    if (f.type === "bool") return f.say(fl.value);
    // optional per-value wording, e.g. "the Commonwealth", "a liberal democracy"
    return f.say(joinOr(fl.values.map((v) => (f.article && f.article[v]) || v)));
  }
  function chipLabel(fl) {
    const f = F[fl.key];
    const name = f.short || f.label;
    if (f.type === "bool") return fl.value ? f.yes : f.no;
    if (f.type === "range") {
      if (!isActive(fl)) return `${name}: any`;
      const lo = fl.min > f.dmin, hi = fl.max < f.dmax;
      if (f.format === "rank" && hi && !lo) return `${name}: top ${Math.round(fl.max)}`;
      if (lo && hi) return `${name} ${fmtShort(f, fl.min)}–${fmtShort(f, fl.max)}`;
      return lo ? `${name} ≥ ${fmtShort(f, fl.min)}` : `${name} ≤ ${fmtShort(f, fl.max)}`;
    }
    if (!fl.values.length) return `${name}: choose…`;
    const v = fl.values.length > 2 ? `${fl.values.slice(0, 2).join(", ")} +${fl.values.length - 2}` : fl.values.join(", ");
    return `${name}: ${v}`;
  }
  function andList(ps) {
    return ps.length === 1 ? ps[0] : ps.slice(0, -1).join(", ") + " and " + ps[ps.length - 1];
  }
  function sentence(n, act) {
    const noun = (k) => (state.territories ? (k === 1 ? "place" : "places") : (k === 1 ? "country" : "countries"));
    const clear = `<button class="clear" id="clearAll" type="button">Clear all</button>`;
    let cityPart = "";
    if (showCities()) {
      const m = lastEval.cityList.length;
      const cp = cityActive().map(phrase);
      cityPart = `<b>${m.toLocaleString()} ${m === 1 ? "city" : "cities"}</b>${cp.length ? ` where ${esc(andList(cp))}` : ""}`;
    }
    if (!act.length) {
      if (cityPart) return `Showing ${cityPart}.${clear}`;
      return `Showing all <b>${n} ${noun(n)}</b>. Add a filter to start asking questions.`;
    }
    const timed = act.some((fl) => F[fl.key].time), untimed = act.some((fl) => !F[fl.key].time);
    const when = state.year && timed ? `In <b>${state.year}</b>: ` : "";
    const note = state.year && untimed ? ` <span class="tnote">${timed ? "Filters without yearly data use the latest figures." : `The year slider doesn't change these filters; they use the latest figures.`}</span>` : "";
    return `${when}Showing <b>${n} ${noun(n)}</b> where ${esc(andList(act.map(phrase)))}${cityPart ? `, with ${cityPart}` : ""}.${note}${clear}`;
  }

  // ---------- Map ----------
  const svg = d3.select("#map");
  const gRoot = svg.append("g");
  const gLand = gRoot.append("g");
  const gDots = gRoot.append("g");
  const gCities = gRoot.append("g");
  let geo = topojson.feature(topo, topo.objects.countries).features.filter((d) => d.id !== "010");
  geo.forEach((d) => {
    d.rec = (d.id && byNum.get(String(+d.id))) || byIso.get(NAME_FIX[d.properties.name]) || null;
  });
  const projection = d3.geoEqualEarth();
  const path = d3.geoPath(projection);
  const paths = gLand.selectAll("path").data(geo).join("path").attr("data-iso", (d) => d.rec?.iso3 || "");
  const onMap = new Set(geo.map((d) => d.rec?.iso3).filter(Boolean));
  let k = 1;

  function layout() {
    const box = $("#mapwrap").getBoundingClientRect();
    const w = Math.max(320, box.width), h = Math.max(240, box.height);
    svg.attr("viewBox", `0 0 ${w} ${h}`);
    citySize = Math.max(0.45, Math.min(1, w / 1100));
    projection.fitExtent([[10, 10], [w - 10, h - 10]], { type: "FeatureCollection", features: geo });
    paths.attr("d", path);
    invalidatePoints();
    cities.forEach((c) => delete c._pt);
    zoom.extent([[0, 0], [w, h]]).translateExtent([[-w * 0.2, -h * 0.2], [w * 1.2, h * 1.2]]);
    drawDots();
    drawCities();
  }
  const zoom = d3.zoom().scaleExtent([1, 12]).on("zoom", (e) => {
    k = e.transform.k;
    gRoot.attr("transform", e.transform);
    gDots.selectAll("circle").attr("r", 4.2 / k);
    gCities.selectAll("circle").attr("r", (d) => cityR(d) / k);
  });
  svg.call(zoom).on("dblclick.zoom", null);
  $("#zin").onclick = () => svg.transition().duration(250).call(zoom.scaleBy, 1.6);
  $("#zout").onclick = () => svg.transition().duration(250).call(zoom.scaleBy, 1 / 1.6);
  $("#zreset").onclick = () => svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);

  let lastEval = evaluate();

  // Dots make tiny countries visible when they match.
  function drawDots() {
    const { res, act } = lastEval;
    const dots = !act.length ? [] : rows.filter((r) => {
      const e = res.get(r.iso3);
      return e && (e.match || (e.near && e.shade)) && ((r.area_km2 ?? 0) < 4000 || !onMap.has(r.iso3)) && (r._pt || (r._pt = centroidFor(r)));
    });
    gDots.selectAll("circle").data(dots, (d) => d.iso3).join("circle")
      .attr("class", (d) => "dot" + (res.get(d.iso3).match ? "" : " near"))
      .attr("data-iso", (d) => d.iso3)
      .attr("r", 4.2 / k)
      .attr("transform", (d) => {
        const p = d._pt || (d._pt = centroidFor(d));
        return p ? `translate(${p[0]},${p[1]})` : "translate(-99,-99)";
      });
  }
  function centroidFor(r) {
    const feat = geo.find((g) => g.rec === r);
    if (feat) { const c = path.centroid(feat); if (!Number.isNaN(c[0])) return c; }
    const ll = r.latlng;
    return ll && ll.length === 2 ? projection([ll[1], ll[0]]) : null;
  }
  function invalidatePoints() { rows.forEach((r) => delete r._pt); }

  // City dots, sized by population
  const MAX_CITY_DOTS = 2500;
  const cityRadius = d3.scaleSqrt().domain([0, d3.max(cities, (c) => c.city_population) || 1]).range([0, 15]);
  let citySize = 1; // shrinks dots on narrow screens
  const cityR = (c) => Math.max(1.6, cityRadius(c.city_population) * citySize);
  function drawCities() {
    const list = (lastEval.cityList || []).slice(0, MAX_CITY_DOTS);
    gCities.selectAll("circle").data(list, (d) => d.id).join("circle")
      .attr("class", (d) => "city" + (d.city_capital ? " cap" : ""))
      .attr("data-city", (d) => d.id)
      .attr("r", (d) => cityR(d) / k)
      .attr("transform", (d) => {
        const p = d._pt || (d._pt = projection([d.lon, d.lat]));
        return p ? `translate(${p[0]},${p[1]})` : "translate(-99,-99)";
      });
  }

  // ---------- Colour by ----------
  const numericFilters = FILTERS.filter((f) => f.type === "range" && !f.target);
  function colourScale(matches) {
    if (!state.colourBy) return null;
    const f = F[state.colourBy];
    const vals = matches.map((r) => r[f.key]).filter((v) => typeof v === "number");
    if (vals.length < 2) return null;
    const ext = d3.extent(vals.map(f.toT));
    if (ext[0] === ext[1]) return null;
    const css = getComputedStyle(document.documentElement);
    const lo = css.getPropertyValue("--ramp-lo").trim(), hi = css.getPropertyValue("--ramp-hi").trim();
    const interp = d3.interpolateRgb(lo, hi);
    const s = (v) => (typeof v === "number" ? interp((f.toT(v) - ext[0]) / (ext[1] - ext[0])) : null);
    s.f = f; s.ext = ext.map(f.fromT); s.lo = lo; s.hi = hi;
    return s;
  }

  // ---------- Render ----------
  function render(opts = {}) {
    lastEval = evaluate();
    const { act, res } = lastEval;
    const matches = pool().filter((r) => res.get(r.iso3).match).sort((a, b) => a.name.localeCompare(b.name));
    const cs = colourScale(matches);

    paths
      .attr("class", (d) => {
        const e = d.rec && res.get(d.rec.iso3);
        // with no country filters, leave countries plain so cities stand out
        let c = e && act.length ? (e.match ? "match" : e.near && e.shade ? "near" : "") : "";
        if (d.rec && d.rec.iso3 === state.selected) c += " sel";
        return c;
      })
      .style("fill", (d) => {
        if (!cs || !d.rec) return null;
        const e = res.get(d.rec.iso3);
        return e && e.match ? cs(d.rec[cs.f.key]) : null;
      });
    drawDots();
    drawCities();
    gDots.selectAll("circle").style("fill", (d) => (cs && res.get(d.iso3).match ? cs(d[cs.f.key]) : null));

    gDots.attr("display", state.flow ? "none" : null);
    gCities.attr("display", state.flow ? "none" : null);
    if (state.flow) applyFlow(); else $("#flowbar").hidden = true;

    renderTimebar();
    renderChips(act);
    $("#sentence").innerHTML = sentence(matches.length, act);
    const ca = $("#clearAll"); if (ca) ca.onclick = clearAll;
    renderLegend(cs, act);
    renderStarter(act);
    renderZero(act, matches);
    if (!opts.keepEditor) { if (state.open) renderEditor(); else $("#editor").hidden = true; }
    if (state.selected) renderDetail(); else renderResults(matches, act, res);
    saveURL();
  }

  function renderChips(act) {
    const box = $("#chips");
    box.innerHTML = "";
    for (const fl of state.filters) {
      const el = document.createElement("span");
      el.className = "chip" + (state.open === fl.key ? " open" : "") + (isActive(fl) ? "" : " idle");
      el.dataset.g = gslug(F[fl.key].group);
      const clock = state.year && F[fl.key].time ? `<span class="yr">${state.year}</span>` : "";
      el.innerHTML = `<button type="button" class="lab">${esc(chipLabel(fl))}${clock}</button><button type="button" class="x" aria-label="Remove ${esc(F[fl.key].label)}">×</button>`;
      el.querySelector(".lab").onclick = () => { state.open = state.open === fl.key ? null : fl.key; render(); };
      el.querySelector(".x").onclick = () => removeFilter(fl.key);
      box.appendChild(el);
    }
  }

  // ---------- Year slider ----------
  let playing = null;
  function renderTimebar() {
    const el = $("#timebar");
    if (!TS_YEARS.length) { el.hidden = true; return; }
    el.hidden = !!state.flow;
    const y0 = TS_YEARS[0], y1 = TS_YEARS[TS_YEARS.length - 1];
    const cur = state.year ?? y1;
    if (!el.dataset.built) {
      el.dataset.built = "1";
      el.innerHTML = `<button type="button" class="play" id="tPlay" aria-label="Play through the years">▶</button>
        <div class="tmain"><div class="trow"><span class="tyear num" id="tYear"></span><span class="tnote" id="tNote"></span>
        <button type="button" class="linkbtn" id="tLatest">Back to latest</button></div>
        <input type="range" id="tRange" min="${y0}" max="${y1}" step="1" aria-label="Year"></div>`;
      const range = $("#tRange");
      range.oninput = () => { stopPlay(); setYear(+range.value); };
      $("#tLatest").onclick = () => { stopPlay(); setYear(null); };
      $("#tPlay").onclick = () => (playing ? stopPlay() : startPlay());
    }
    $("#tRange").value = cur;
    $("#tYear").textContent = state.year ? state.year : "Latest";
    const timeAct = state.filters.filter((fl) => F[fl.key].time).length;
    $("#tNote").textContent = state.year
      ? (timeAct ? "Filters with yearly data now show " + state.year + "." : "Add a filter with yearly data, like population, HDI or democracy.")
      : "Drag to go back to " + y0 + ".";
    $("#tLatest").hidden = !state.year;
    $("#tPlay").textContent = playing ? "❚❚" : "▶";
    $("#tPlay").setAttribute("aria-label", playing ? "Pause" : "Play through the years");
  }
  function setYear(y) {
    state.year = y;
    applyYear(y);
    render({ keepEditor: !!state.open && document.activeElement?.id === "tRange" });
    if (state.open && document.activeElement?.id !== "tRange") renderEditor();
  }
  function startPlay() {
    const y0 = TS_YEARS[0], y1 = TS_YEARS[TS_YEARS.length - 1];
    if (!state.year || state.year >= y1) setYear(y0);
    playing = setInterval(() => {
      if (state.year >= y1) return stopPlay();
      setYear(state.year + 1);
    }, 550);
    renderTimebar();
  }
  function stopPlay() { if (playing) { clearInterval(playing); playing = null; renderTimebar(); } }

  // ---------- Refugee flow view ----------
  let flowScale = null;
  function flowValues() {
    const { iso, dir } = state.flow;
    const vals = new Map();
    for (const [o, h, n] of flows) {
      if (dir === "from" && o === iso) vals.set(h, n);
      if (dir === "to" && h === iso) vals.set(o, n);
    }
    return vals;
  }
  function applyFlow() {
    const { iso, dir } = state.flow;
    const src = byIso.get(iso);
    const vals = flowValues();
    const ext = d3.extent([...vals.values()]);
    const css = getComputedStyle(document.documentElement);
    const lo = css.getPropertyValue("--ramp-lo").trim(), hi = css.getPropertyValue("--ramp-hi").trim();
    const interp = d3.interpolateRgb(lo, hi);
    const t = (v) => (ext[0] === ext[1] ? 1 : (Math.log10(v) - Math.log10(ext[0])) / (Math.log10(ext[1]) - Math.log10(ext[0])));
    flowScale = { vals, ext, lo, hi };
    paths.attr("class", (d) => (d.rec && d.rec.iso3 === iso ? "flow-src" : ""))
      .style("fill", (d) => { const v = d.rec && vals.get(d.rec.iso3); return v ? interp(t(v)) : null; });
    const total = d3.sum([...vals.values()]);
    const bar = $("#flowbar");
    bar.hidden = false;
    bar.innerHTML = `<p>${dir === "from"
      ? `Where refugees from <b>${esc(src.name)}</b> live: <b>${d3.format(",")(total)}</b> people in ${vals.size} ${vals.size === 1 ? "country" : "countries"}`
      : `Where refugees in <b>${esc(src.name)}</b> come from: <b>${d3.format(",")(total)}</b> people from ${vals.size} ${vals.size === 1 ? "country" : "countries"}`}</p>
      <button type="button" class="ghost" id="flowClose">Close</button>`;
    $("#flowClose").onclick = () => { state.flow = null; render(); };
  }

  function renderLegend(cs, act) {
    const el = $("#legend");
    if (state.flow && flowScale) {
      el.hidden = false;
      el.innerHTML = `<div class="lrow"><span>Refugees (groups of 100 or more)</span></div><div class="lrow"><span class="num">${compact(flowScale.ext[0] || 0)}</span><span class="ramp" style="background:linear-gradient(90deg, ${flowScale.lo}, ${flowScale.hi})"></span><span class="num">${compact(flowScale.ext[1] || 0)}</span></div>`;
      return;
    }
    if (!act.length && !showCities()) { el.hidden = true; return; }
    el.hidden = false;
    let h = "";
    if (cs) {
      h += `<div class="lrow"><span>${esc(cs.f.label)}</span></div><div class="lrow"><span class="num">${fmtShort(cs.f, cs.ext[0])}</span><span class="ramp" style="background:linear-gradient(90deg, ${cs.lo}, ${cs.hi})"></span><span class="num">${fmtShort(cs.f, cs.ext[1])}</span></div>`;
    } else if (act.length) {
      h += `<div class="lrow"><span class="sw" style="background:var(--match)"></span>Matches every filter</div>`;
    }
    const anyShade = [...lastEval.groups.values()].some((g) => g.length <= NEAR_MAP);
    if (anyShade) h += `<div class="lrow"><span class="sw" style="background:var(--near)"></span>Near miss: fails just one filter</div>`;
    if (showCities()) h += `<div class="lrow"><span class="sw city"></span>City, sized by population<span class="sw city cap"></span>Capital</div>`;
    el.innerHTML = h;
  }

  // ---------- Starter card and question of the day ----------
  const puzzles = window.PUZZLES.map((p) => ({ ...p, n: countFor(p.filters) })).filter((p) => p.n >= 1 && p.n <= 8);
  function countFor(presets) {
    const fls = presets.map((p) => makeFilter(p.key, p));
    const cf = fls.filter(isCity), nf = fls.filter((fl) => !isCity(fl));
    return rows.filter((r) => r.sovereign && nf.every((fl) => passes(r, fl)) &&
      (!cf.length || cities.some((c) => c.iso3 === r.iso3 && cf.every((fl) => passes(c, fl))))).length;
  }
  function todaysPuzzle() {
    if (!puzzles.length) return null;
    const day = Math.floor(Date.now() / 864e5);
    return puzzles[day % puzzles.length];
  }
  function applyPreset(presets) {
    state.filters = presets.map((p) => makeFilter(p.key, p));
    state.open = null; state.selected = null;
    state.tab = state.filters.some(isCity) && !state.filters.some((fl) => !isCity(fl)) ? "cities" : "countries";
    render();
  }
  function renderStarter(act) {
    const el = $("#starter");
    el.hidden = !!state.filters.length || state.starterHidden || !!state.flow;
    if (el.hidden) return;
    const pz = todaysPuzzle();
    el.innerHTML = `
      <button class="iconbtn hide" type="button" aria-label="Hide">×</button>
      <h2>Ask the map a question</h2>
      <p>Search for a characteristic above, or start from one of these.</p>
      <div class="presets">${window.STARTERS.map((s, i) => `<button type="button" data-i="${i}">${esc(s.title)}</button>`).join("")}</div>
      ${pz ? `<div class="qotd"><div class="eyebrow">Question of the day</div><p>${esc(pz.q)}</p>
        <button class="linkbtn" type="button" id="reveal">Show the filters that answer it</button></div>` : ""}`;
    el.querySelector(".hide").onclick = () => { state.starterHidden = true; render(); };
    el.querySelectorAll(".presets button").forEach((b) => (b.onclick = () => applyPreset(window.STARTERS[+b.dataset.i].filters)));
    const rv = el.querySelector("#reveal"); if (rv) rv.onclick = () => applyPreset(pz.filters);
  }

  // ---------- Zero results ----------
  function renderZero(act, matches) {
    const el = $("#zero");
    if (!act.length || matches.length || state.flow) { el.hidden = true; return; }
    const tries = act.map((fl) => {
      const rest = act.filter((x) => x !== fl);
      return { fl, n: pool().filter((r) => rest.every((x) => passes(r, x))).length };
    }).filter((t) => t.n > 0).sort((a, b) => b.n - a.n).slice(0, 3);
    el.hidden = false;
    el.innerHTML = `<h3>No countries match all ${act.length} filters</h3>
      <p>${tries.length ? "Dropping one of them would bring some back:" : "Try removing a filter."}</p>
      <ul>${tries.map((t, i) => `<li><button type="button" data-i="${i}">Remove <b>${esc(chipLabel(t.fl))}</b> → ${t.n} ${t.n === 1 ? "match" : "matches"}</button></li>`).join("")}</ul>`;
    el.querySelectorAll("button").forEach((b) => (b.onclick = () => removeFilter(tries[+b.dataset.i].fl.key)));
  }

  // ---------- Filter editor ----------
  function othersPass(r, key) {
    return active().every((fl) => fl.key === key || passes(r, fl));
  }
  function renderEditor() {
    const fl = state.filters.find((x) => x.key === state.open);
    const el = $("#editor");
    if (!fl) { el.hidden = true; return; }
    const f = F[fl.key];
    const src = window.SOURCES[f.source];
    const year = state.year && f.time ? String(state.year) : yearLabel(f);
    const timeNote = !f.time ? (state.year ? `<br><b>Not yearly:</b> this filter uses the latest data, whatever year you pick.` : "")
      : `<br>Has yearly data from ${timeFrom(f.key)}: use the year slider under the map to go back in time.`;
    const keepSearch = el.querySelector(".optsearch")?.value || "";
    const scroll = el.querySelector(".opts")?.scrollTop || 0;
    el.hidden = false;
    el.dataset.g = gslug(f.group);
    el.innerHTML = `<div class="eyebrow">${esc(f.group)}</div><header><h3>${esc(f.label)}</h3><button type="button" class="iconbtn" id="edClose" aria-label="Close">×</button></header>
      <p class="info">${esc(f.info)} <br>Source: <a href="${src.url}" target="_blank" rel="noopener">${esc(src.name)}</a>${year ? `, ${year}` : ""}.${timeNote}</p>
      <div id="edBody"></div>
      <button type="button" class="remove" id="edRemove">Remove this filter</button>`;
    $("#edClose").onclick = () => { state.open = null; render(); };
    $("#edRemove").onclick = () => removeFilter(fl.key);
    const body = $("#edBody");
    if (f.type === "range") rangeEditor(body, f, fl);
    else if (f.type === "bool") boolEditor(body, f, fl);
    else optionEditor(body, f, fl, keepSearch, scroll);
  }

  function rangeEditor(body, f, fl) {
    const T0 = f.toT(f.dmin), T1 = f.toT(f.dmax);
    const vals = (f.target === "city" ? cities : pool()).map((r) => r[f.key]).filter((v) => typeof v === "number" && (f.scale !== "log" || v > 0));
    const bins = d3.bin().domain([T0, T1]).thresholds(28)(vals.map((v) => Math.min(Math.max(f.toT(v), T0), T1)));
    const maxN = d3.max(bins, (b) => b.length) || 1;
    const W = 330, H = 56;
    const x = (t) => ((t - T0) / (T1 - T0)) * W;
    body.innerHTML = `
      <svg class="hist" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
        ${bins.map((b) => `<rect data-a="${b.x0}" data-b="${b.x1}" x="${x(b.x0) + 0.5}" width="${Math.max(0, x(b.x1) - x(b.x0) - 1)}" y="${H - (b.length / maxN) * (H - 2)}" height="${(b.length / maxN) * (H - 2)}"></rect>`).join("")}
      </svg>
      <div class="dual"><div class="track"></div><div class="fill"></div>
        <input type="range" id="rLo" min="0" max="1000" step="1" aria-label="Minimum">
        <input type="range" id="rHi" min="0" max="1000" step="1" aria-label="Maximum">
      </div>
      <div class="bounds">
        <label for="nLo">At least<input id="nLo" inputmode="decimal"></label>
        <label for="nHi">At most<input id="nHi" inputmode="decimal"></label>
      </div>
      ${UNITS[f.format] ? `<p class="info unit">Values are${esc(UNITS[f.format])}.</p>` : ""}`;
    const lo = $("#rLo"), hi = $("#rHi"), nLo = $("#nLo"), nHi = $("#nHi");
    const toPos = (v) => Math.round(((f.toT(v) - T0) / (T1 - T0)) * 1000);
    const fromPos = (p) => {
      if (p <= 0) return f.dmin;
      if (p >= 1000) return f.dmax;
      return f.round(f.fromT(T0 + (p / 1000) * (T1 - T0)));
    };
    function sync() {
      lo.value = toPos(fl.min); hi.value = toPos(fl.max);
      nLo.value = fl.min <= f.dmin ? "no limit" : fmtShort(f, fl.min);
      nHi.value = fl.max >= f.dmax ? "no limit" : fmtShort(f, fl.max);
      const a = +lo.value / 10, b = +hi.value / 10;
      body.querySelector(".fill").style.left = a + "%";
      body.querySelector(".fill").style.width = Math.max(0, b - a) + "%";
      const tA = f.toT(fl.min), tB = f.toT(fl.max);
      body.querySelectorAll(".hist rect").forEach((r) => r.classList.toggle("in", +r.dataset.b > tA && +r.dataset.a < tB));
    }
    function commit() { updateLive(); }
    lo.oninput = () => { let p = Math.min(+lo.value, +hi.value); fl.min = fromPos(p); if (fl.min > fl.max) fl.min = fl.max; sync(); commit(); };
    hi.oninput = () => { let p = Math.max(+hi.value, +lo.value); fl.max = fromPos(p); if (fl.max < fl.min) fl.max = fl.min; sync(); commit(); };
    // keep the upper thumb reachable when both sit at the top
    lo.style.zIndex = fl.min >= f.dmax ? 3 : 2; hi.style.zIndex = 2;
    nLo.onchange = () => { const v = parseNum(f, nLo.value); if (v != null) fl.min = Math.min(Math.max(v, f.dmin), fl.max); sync(); commit(); };
    nHi.onchange = () => { const v = parseNum(f, nHi.value); if (v != null) fl.max = Math.max(Math.min(v, f.dmax), fl.min); sync(); commit(); };
    sync();
  }

  function boolEditor(body, f, fl) {
    const cnt = f.target === "city"
      ? (v) => cities.filter((c) => { const e = lastEval.res.get(c.iso3); return e && e.match && c[f.key] === v && cityActive().every((x) => x.key === f.key || passes(c, x)); }).length
      : (v) => pool().filter((r) => r[f.key] === v && othersPass(r, f.key)).length;
    body.innerHTML = `<div class="seg" role="group">
      <button type="button" data-v="1" class="${fl.value ? "on" : ""}">${esc(f.yes)}<small>${cnt(true)}</small></button>
      <button type="button" data-v="0" class="${fl.value ? "" : "on"}">${esc(f.no)}<small>${cnt(false)}</small></button></div>`;
    body.querySelectorAll("button").forEach((b) => (b.onclick = () => { fl.value = b.dataset.v === "1"; render(); }));
  }

  function optionEditor(body, f, fl, keepSearch, scroll) {
    const counts = new Map(f.options.map((o) => [o, 0]));
    for (const r of pool()) {
      if (!othersPass(r, f.key)) continue;
      const v = r[f.key];
      (Array.isArray(v) ? v : [v]).forEach((x) => counts.has(x) && counts.set(x, counts.get(x) + 1));
    }
    let opts = [...f.options];
    if (f.type === "multi") opts.sort((a, b) => (fl.values.includes(b) - fl.values.includes(a)) || (counts.get(b) - counts.get(a)) || a.localeCompare(b));
    const searchable = opts.length > 12;
    body.innerHTML = `${searchable ? `<input class="optsearch" id="optSearch" type="search" placeholder="Search ${opts.length} options" value="${esc(keepSearch)}">` : ""}
      <div class="opts" role="group" aria-label="${esc(f.label)}"></div>
      ${f.type === "multi" ? `<p class="info">Countries match if they have <b>any</b> of the ticked options.</p>` : ""}`;
    const list = body.querySelector(".opts");
    function draw(q) {
      q = (q || "").toLowerCase();
      list.innerHTML = opts.filter((o) => !q || o.toLowerCase().includes(q)).slice(0, 300).map((o) => {
        const n = counts.get(o), on = fl.values.includes(o);
        return `<label class="${!n && !on ? "zero" : ""}"><input type="checkbox" value="${esc(o)}" ${on ? "checked" : ""} ${!n && !on ? "disabled" : ""}><span>${esc(o)}</span><small>${n}</small></label>`;
      }).join("") || `<p class="info">Nothing matches “${esc(q)}”.</p>`;
      list.querySelectorAll("input").forEach((c) => (c.onchange = () => {
        if (c.checked) fl.values.push(c.value); else fl.values = fl.values.filter((v) => v !== c.value);
        render();
      }));
    }
    draw(keepSearch);
    list.scrollTop = scroll;
    const s = body.querySelector("#optSearch");
    if (s) { s.oninput = () => draw(s.value); if (keepSearch) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }
  }

  // Live update while dragging a slider: redraw everything except the editor itself.
  let raf = 0;
  function updateLive() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => render({ keepEditor: true }));
  }

  // ---------- Results list ----------
  function tabsHTML(n) {
    if (!showCities()) return "";
    const t = state.tab;
    return `<div class="tabs" role="tablist">
      <button type="button" role="tab" data-tab="countries" aria-selected="${t !== "cities"}" class="${t !== "cities" ? "on" : ""}">Countries <span class="num">${n}</span></button>
      <button type="button" role="tab" data-tab="cities" aria-selected="${t === "cities"}" class="${t === "cities" ? "on" : ""}">Cities <span class="num">${lastEval.cityList.length.toLocaleString()}</span></button></div>`;
  }
  function footHTML() {
    return `<div class="rfoot">
        <button type="button" id="srcLink">Sources &amp; methods</button>
        ${SITE.donate ? `<a href="${SITE.donate}" target="_blank" rel="noopener">Support this project</a>` : ""}
        ${SITE.github ? `<a href="${SITE.github}" target="_blank" rel="noopener">Contribute on GitHub</a>` : ""}
        ${window.self === window.top ? `<button type="button" id="copyLink">Copy link to this view</button>` : ""}
      </div>`;
  }
  function bindCommon(el) {
    $("#srcLink").onclick = openAbout;
    const cl = $("#copyLink");
    if (cl) cl.onclick = () => navigator.clipboard?.writeText(location.href).then(() => (cl.textContent = "Link copied"), () => {});
    el.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => { state.tab = b.dataset.tab; render(); }));
  }
  function renderCityResults(matches) {
    const el = $("#results");
    const list = lastEval.cityList;
    const scrollTop = el.querySelector(".rlist")?.scrollTop || 0;
    el.innerHTML = `
      <div class="rhead">${tabsHTML(matches.length)}
        <div class="count"><span class="n num">${list.length.toLocaleString()}</span><span class="of">${list.length === 1 ? "city matches" : "cities match"}</span></div>
        <p class="note">Population of the city itself, not its suburbs. Ringed dots are capitals.</p>
      </div>
      <div class="rlist">
        ${list.slice(0, 300).map((c) => {
          const r = byIso.get(c.iso3);
          return `<button type="button" class="row" data-iso="${c.iso3}" data-city="${c.id}"><span class="fl">${r?.flag || ""}</span><span class="nm">${esc(c.name)}${c.city_capital ? ` <span class="tag">capital</span>` : ""}<small>${esc(r?.name || "")}</small></span><span class="val num">${compact(c.city_population)}</span></button>`;
        }).join("") || `<p class="empty">No cities match. Try a lower population, or loosen the country filters.</p>`}
        ${list.length > 300 ? `<p class="empty">Showing the largest 300 of ${list.length.toLocaleString()}.</p>` : ""}
      </div>${footHTML()}`;
    el.querySelector(".rlist").scrollTop = scrollTop;
    bindCommon(el);
    el.querySelectorAll(".row").forEach((b) => {
      b.onclick = () => { state.selected = b.dataset.iso; state.open = null; render(); };
      b.onmouseenter = () => gCities.selectAll("circle").filter((d) => d.id === +b.dataset.city).classed("hover", true).raise();
      b.onmouseleave = () => gCities.selectAll("circle").classed("hover", false);
    });
  }

  function renderResults(matches, act, res) {
    if (showCities() && state.tab === "cities") return renderCityResults(matches);
    const el = $("#results");
    const rangeAct = act.map((fl) => F[fl.key]).filter((f) => f.type === "range");
    const sortKey = state.sort || state.colourBy || rangeAct[0]?.key || "__name";
    const sf = F[sortKey] || null;
    const list = [...matches];
    if (sf) list.sort((a, b) => (b[sortKey] ?? -Infinity) - (a[sortKey] ?? -Infinity));
    const valF = sf || (state.colourBy ? F[state.colourBy] : rangeAct[0]) || null;
    const groups = [...lastEval.groups.entries()].sort((a, b) => a[1].length - b[1].length);
    const total = pool().length;
    const noun = state.territories ? "places" : "countries";
    const scrollTop = el.querySelector(".rlist")?.scrollTop || 0;

    el.innerHTML = `
      <div class="rhead">${tabsHTML(matches.length)}
        <div class="count"><span class="n num">${matches.length}</span><span class="of">of ${total} ${noun} match</span></div>
        <div class="controls">
          <label><input type="checkbox" id="terr" ${state.territories ? "checked" : ""}> Include territories</label>
          <label>Sort <select id="sortSel"><option value="__name">Name</option>
            ${numericFilters.map((f) => `<option value="${f.key}" ${sortKey === f.key ? "selected" : ""}>${esc(f.label)}</option>`).join("")}</select></label>
          <label>Colour <select id="colSel"><option value="">Single colour</option>
            ${numericFilters.map((f) => `<option value="${f.key}" ${state.colourBy === f.key ? "selected" : ""}>${esc(f.label)}</option>`).join("")}</select></label>
        </div>
      </div>
      <div class="rlist">
        ${list.length ? list.map((r) => rowHTML(r, valF)).join("") : `<p class="empty">${act.length ? "No matches yet." : ""}</p>`}
        ${groups.map(([key, list]) => {
          const fl = act.find((x) => x.key === key);
          list.sort((a, b) => a.name.localeCompare(b.name));
          const open = expandedNear.has(key);
          const shown = open ? list : list.slice(0, 6);
          return `<h4>Near misses · only fail “${esc(chipLabel(fl))}” (${list.length})</h4>${shown.map((r) => rowHTML(r, null, fl)).join("")}
            ${list.length > 6 ? `<button type="button" class="linkbtn more" data-k="${key}" style="margin:2px 8px">${open ? "Show fewer" : `Show all ${list.length}`}</button>` : ""}`;
        }).join("")}
      </div>${footHTML()}`;
    el.querySelector(".rlist").scrollTop = scrollTop;
    $("#terr").onchange = (e) => { state.territories = e.target.checked; render(); };
    $("#sortSel").onchange = (e) => { state.sort = e.target.value; render(); };
    $("#colSel").onchange = (e) => { state.colourBy = e.target.value; render(); };
    bindCommon(el);
    el.querySelectorAll(".more").forEach((b) => (b.onclick = () => {
      const k = b.dataset.k; expandedNear.has(k) ? expandedNear.delete(k) : expandedNear.add(k); render();
    }));
    el.querySelectorAll(".row").forEach((b) => {
      b.onclick = () => { state.selected = b.dataset.iso; state.open = null; render(); };
      b.onmouseenter = () => highlight(b.dataset.iso, true);
      b.onmouseleave = () => highlight(b.dataset.iso, false);
    });
  }
  function rowHTML(r, sf, fail) {
    const val = sf ? `<span class="val num">${fmtShort(sf, r[sf.key])}</span>` : "";
    const why = fail ? `<span class="why">✕ ${esc(F[fail.key].short || F[fail.key].label)}</span>` : "";
    return `<button type="button" class="row" data-iso="${r.iso3}"><span class="fl">${r.flag || ""}</span><span class="nm">${esc(r.name)}</span>${val}${why}</button>`;
  }
  function highlight(iso, on) {
    paths.filter((d) => d.rec?.iso3 === iso).classed("hover", on).raise();
  }

  // ---------- Country detail ----------
  function renderDetail() {
    const r = byIso.get(state.selected);
    const el = $("#results");
    if (!r) { state.selected = null; return render(); }
    const e = lastEval.res.get(r.iso3);
    const badge = !lastEval.act.length ? "" : e?.match ? `<span class="badge m">Matches every filter</span>` : e?.near ? `<span class="badge n">Near miss: fails ${esc(F[e.fails[0].key].label)}</span>` : e ? `<span class="badge">Fails ${e.fails.length} filters</span>` : `<span class="badge">Territory (hidden)</span>`;
    const val = (f) => {
      const v = r[f.key];
      if (f.type === "range") return fmtFull(f, v);
      if (f.type === "bool") return v == null ? "no data" : v ? "Yes" : "No";
      if (Array.isArray(v)) return v.length ? v.join(", ") : "none listed";
      return v ?? "no data";
    };
    const groups = window.FILTER_GROUPS.map((g) => {
      const fs = FILTERS.filter((f) => f.group === g && !f.target);
      if (!fs.length) return "";
      return `<h4 data-g="${gslug(g)}">${g}</h4><dl>${fs.map((f) => `<dt>${esc(f.label)}</dt><dd>${esc(val(f))}${f.year && typeof f.year === "string" && r[f.year] ? ` <small>(${r[f.year]})</small>` : ""}</dd>`).join("")}</dl>`;
    }).join("");
    el.innerHTML = `<div class="detail">
      <button type="button" class="linkbtn back" id="back">← Back to results</button>
      <h2><span>${r.flag || ""}</span>${esc(r.name)}</h2>
      <p class="sub">${esc([r.capital && "Capital: " + r.capital, r.subregion].filter(Boolean).join(" · "))}${r.sovereign ? "" : " · Territory or partially recognised"}</p>
      ${badge}
      ${state.year ? `<p class="sub">Measures with yearly data show <b>${state.year}</b>; refugee routes and everything else show the latest figures.</p>` : ""}
      ${(() => {
        const out = flows.filter((f) => f[0] === r.iso3).sort((a, b) => b[2] - a[2]);
        const inn = flows.filter((f) => f[1] === r.iso3).sort((a, b) => b[2] - a[2]);
        if (!out.length && !inn.length) return "";
        const nm = (i) => esc(byIso.get(i)?.name || i);
        const flowYear = r._latest?.refugees_hosted_year ?? r.refugees_hosted_year ?? 2025;
        const list = (fs, col) => `<dl>${fs.slice(0, 5).map((f) => `<dt>${nm(f[col])}</dt><dd>${d3.format(",")(f[2])}</dd>`).join("")}</dl>`;
        return `<h4 data-g="refugees">Refugees</h4>
          ${inn.length ? `<p class="sub">In ${flowYear} it hosted <b>${d3.format(",")(r._latest?.refugees_hosted ?? r.refugees_hosted ?? 0)}</b> refugees. Largest groups come from:</p>${list(inn, 0)}` : ""}
          ${out.length ? `<p class="sub">${d3.format(",")(r._latest?.refugees_from ?? r.refugees_from ?? 0)} refugees had fled ${esc(r.name)} by ${flowYear}. Largest numbers live in:</p>${list(out, 1)}` : ""}
          <div class="flowbtns">
            ${inn.length ? `<button type="button" data-dir="to">Map where its refugees come from</button>` : ""}
            ${out.length ? `<button type="button" data-dir="from">Map where its refugees have gone</button>` : ""}
          </div>`;
      })()}
      ${(() => {
        const cs = cities.filter((c) => c.iso3 === r.iso3).slice(0, 6);
        return cs.length ? `<h4>Largest cities</h4><dl>${cs.map((c) => `<dt>${esc(c.name)}${c.city_capital ? " (capital)" : ""}</dt><dd>${d3.format(",")(c.city_population)}</dd>`).join("")}</dl>` : "";
      })()}
      ${groups}
    </div>`;
    $("#back").onclick = () => { state.selected = null; render(); };
    el.querySelectorAll(".flowbtns button").forEach((b) => (b.onclick = () => { state.flow = { iso: r.iso3, dir: b.dataset.dir }; render(); }));
  }

  // ---------- Tooltip ----------
  const tip = $("#tooltip");
  function showTip(evt, r) {
    if (!r) { tip.hidden = true; return; }
    if (state.flow && flowScale) {
      const src = byIso.get(state.flow.iso);
      const v = flowScale.vals.get(r.iso3);
      const txt = r.iso3 === src.iso3 ? (state.flow.dir === "from" ? "Country of origin" : "Host country")
        : v ? (state.flow.dir === "from" ? `${d3.format(",")(v)} refugees from ${src.name}` : `${d3.format(",")(v)} of the refugees in ${src.name}`)
        : "Fewer than 100, or none";
      tip.innerHTML = `<strong>${r.flag || ""} ${esc(r.name)}</strong><span class="st">${esc(txt)}</span>`;
      return placeTip(evt);
    }
    const e = lastEval.res.get(r.iso3);
    const act = lastEval.act;
    let st = "";
    if (!e) st = `<span class="st">Territory: tick “Include territories” to count it</span>`;
    else if (act.length) st = e.match ? `<span class="st m">Matches every filter</span>` : e.near ? `<span class="st">Near miss</span>` : `<span class="st">Fails ${e.fails.length} of ${act.length} filters</span>`;
    const dl = act.map((fl) => {
      const f = F[fl.key];
      let v = r[fl.key];
      v = f.type === "range" ? fmtShort(f, v) : f.type === "bool" ? (v ? f.yes : f.no) : Array.isArray(v) ? (v.length ? v.join(", ") : "none") : v ?? "no data";
      const failed = e && e.fails.includes(fl);
      return `<dt>${esc(f.short || f.label)}</dt><dd class="${failed ? "fail" : ""}">${esc(v)}</dd>`;
    }).join("");
    tip.innerHTML = `<strong>${r.flag || ""} ${esc(r.name)}</strong>${st}${dl ? `<dl>${dl}</dl>` : ""}`;
    placeTip(evt);
  }
  function showCityTip(evt, c) {
    const r = byIso.get(c.iso3);
    tip.innerHTML = `<strong>${esc(c.name)}</strong><span class="st">${r?.flag || ""} ${esc(r?.name || "")}${c.city_capital ? " · capital" : ""}</span><dl><dt>Population</dt><dd>${d3.format(",")(c.city_population)}</dd></dl>`;
    placeTip(evt);
  }
  function placeTip(evt) {
    tip.hidden = false;
    const box = $("#mapwrap").getBoundingClientRect();
    let x = evt.clientX - box.left + 14, y = evt.clientY - box.top + 14;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    if (x + tw > box.width - 8) x = evt.clientX - box.left - tw - 14;
    if (y + th > box.height - 8) y = evt.clientY - box.top - th - 14;
    tip.style.left = Math.max(4, x) + "px"; tip.style.top = Math.max(4, y) + "px";
  }
  svg.on("pointermove", (evt) => {
    if (evt.pointerType === "touch") return;
    const t = evt.target;
    const cid = t.getAttribute && t.getAttribute("data-city");
    if (cid) { paths.classed("hover", false); return showCityTip(evt, cities[+cid]); }
    const iso = t.getAttribute && t.getAttribute("data-iso");
    paths.classed("hover", false);
    if (iso) d3.select(t).filter("path").classed("hover", true).raise();
    showTip(evt, iso ? byIso.get(iso) : null);
  }).on("pointerleave", () => { tip.hidden = true; paths.classed("hover", false); });
  svg.on("click", (evt) => {
    const t = evt.target;
    const cid = t.getAttribute && t.getAttribute("data-city");
    const iso = cid ? cities[+cid].iso3 : t.getAttribute && t.getAttribute("data-iso");
    if (iso && byIso.get(iso)) { state.selected = iso; state.open = null; render(); }
  });

  // ---------- Add-a-filter search ----------
  const input = $("#addInput"), menu = $("#addMenu");
  let items = [], cursor = 0;
  function score(f, q) {
    const hay = (f.label + " " + (f.keywords || "") + " " + f.group).toLowerCase();
    if (f.label.toLowerCase().startsWith(q)) return 3;
    if (f.label.toLowerCase().includes(q)) return 2;
    return q.split(/\s+/).every((w) => hay.includes(w)) ? 1 : 0;
  }
  let menuCat = null; // category picked in the menu, or null for all
  function openMenu() {
    const q = input.value.trim().toLowerCase();
    const used = new Set(state.filters.map((x) => x.key));
    const inCat = (f) => !menuCat || f.group === menuCat;
    items = [];
    // one menu row: coloured by category; filters already added are marked
    const item = (f, label, valueOf) => {
      items.push({ key: f.key, value: valueOf ? label : undefined });
      const added = used.has(f.key) && !valueOf;
      let right = "";
      if (added) right = `<span class="added-tag">✓ Added</span>`;
      else if (valueOf) right = `<span class="gtag">${esc(f.label)}</span>`;
      else if (q) right = `<span class="gtag">${esc(f.group)}</span>`;
      if (f.time && !added && !valueOf) right = `<span class="ytag" title="Has yearly data for the year slider">yearly</span>` + right;
      return `<button type="button" role="option" class="item${added ? " added" : ""}" data-g="${gslug(f.group)}" data-i="${items.length - 1}"><span>${esc(label)}</span>${right}</button>`;
    };
    let html = `<div class="cats" role="group" aria-label="Categories">
      <button type="button" class="${menuCat ? "" : "on"}" data-cat="">All</button>
      ${window.FILTER_GROUPS.map((g) => `<button type="button" data-cat="${esc(g)}" data-g="${gslug(g)}" class="${menuCat === g ? "on" : ""}">${esc(g)}</button>`).join("")}</div>`;
    if (!q) {
      const groups = menuCat ? [menuCat] : window.FILTER_GROUPS;
      html += `<div class="${menuCat ? "" : "browse"}">${groups.map((g) => {
        const fs = FILTERS.filter((f) => f.group === g);
        return `<section>${menuCat ? "" : `<h4 data-g="${gslug(g)}">${esc(g)}</h4>`}${fs.map((f) => item(f, f.label)).join("")}</section>`;
      }).join("")}</div>`;
    } else {
      const fs = FILTERS.filter(inCat).map((f) => ({ f, s: score(f, q) })).filter((x) => x.s).sort((a, b) => b.s - a.s);
      const vals = [];
      if (q.length >= 2) {
        for (const f of FILTERS.filter(inCat)) {
          if (!f.options) continue;
          for (const o of f.options) if (o.toLowerCase().includes(q)) vals.push({ f, o, s: o.toLowerCase().startsWith(q) ? 2 : 1 });
        }
        vals.sort((a, b) => b.s - a.s || a.o.length - b.o.length);
      }
      if (fs.length) html += `<h4>Filters</h4>` + fs.slice(0, 12).map(({ f }) => item(f, f.label)).join("");
      if (vals.length) html += `<h4>Values</h4>` + vals.slice(0, 6).map((v) => item(v.f, v.o, true)).join("");
      if (!fs.length && !vals.length) html += `<p class="info" style="padding:8px 10px;margin:0">Nothing found for “${esc(q)}”${menuCat ? ` in ${esc(menuCat)}` : ""}. Try a broader word, like “religion” or “money”.</p>`;
    }
    cursor = 0;
    menu.innerHTML = html;
    menu.hidden = false;
    input.setAttribute("aria-expanded", "true");
    markCursor();
    menu.querySelectorAll("button").forEach((b) => (b.onmousedown = (e) => e.preventDefault()));
    const onCat = menu.querySelector(".cats button.on"), cats = menu.querySelector(".cats");
    if (onCat && cats) cats.scrollLeft = Math.max(0, onCat.offsetLeft - cats.offsetLeft - 40);
    menu.querySelectorAll(".cats button").forEach((b) => (b.onclick = () => { menuCat = b.dataset.cat || null; openMenu(); input.focus(); }));
    menu.querySelectorAll("button.item").forEach((b) => (b.onclick = () => choose(items[+b.dataset.i])));
  }
  function markCursor() {
    menu.querySelectorAll("button.item").forEach((b) => b.classList.toggle("on", +b.dataset.i === cursor));
    menu.querySelector("button.item.on")?.scrollIntoView({ block: "nearest" });
  }
  function closeMenu() { menu.hidden = true; input.setAttribute("aria-expanded", "false"); }
  function choose(it) {
    if (!it) return;
    let fl = state.filters.find((x) => x.key === it.key);
    if (!fl) { fl = makeFilter(it.key); state.filters.push(fl); }
    if (it.value && fl.values && !fl.values.includes(it.value)) fl.values.push(it.value);
    state.open = it.key; state.selected = null;
    if (F[it.key].target === "city") state.tab = "cities";
    input.value = ""; closeMenu(); input.blur();
    render();
  }
  input.addEventListener("focus", openMenu);
  input.addEventListener("input", openMenu);
  input.addEventListener("blur", () => setTimeout(closeMenu, 120));
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { cursor = Math.min(items.length - 1, cursor + 1); markCursor(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { cursor = Math.max(0, cursor - 1); markCursor(); e.preventDefault(); }
    else if (e.key === "Enter") { choose(items[cursor]); e.preventDefault(); }
    else if (e.key === "Escape") { closeMenu(); input.blur(); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.open) { state.open = null; render(); }
    else if (e.key === "Escape" && state.flow) { state.flow = null; render(); }
    if (e.key === "Escape" && !$("#about").hidden) $("#about").hidden = true;
  });

  function removeFilter(key) {
    state.filters = state.filters.filter((x) => x.key !== key);
    if (state.open === key) state.open = null;
    if (state.colourBy === key) state.colourBy = "";
    if (!showCities()) state.tab = "countries";
    render();
  }
  function clearAll() { state.filters = []; state.open = null; state.colourBy = ""; state.sort = ""; state.tab = "countries"; stopPlay(); if (state.year) { state.year = null; applyYear(null); } render(); }

  // ---------- About ----------
  function openAbout() {
    const el = $("#about");
    const used = [...new Set(FILTERS.map((f) => f.source))].concat("boundaries");
    el.innerHTML = `<div class="panel" role="dialog" aria-modal="true" aria-labelledby="aboutH">
      <button type="button" class="iconbtn close" id="aboutClose" aria-label="Close">×</button>
      <h2 id="aboutH">About Which Countries?</h2>
      <p>An open-source map for asking questions about the world. Every filter shows where its data comes from and what year it describes. Measures like “democracy” depend on who defines them, so each filter names its definition.</p>
      <p>Countries match when they pass <b>every</b> filter. City filters show cities on the map, inside the countries that match. Each end of a slider means “no limit”. Within a list filter, such as languages, ticking several options matches countries that have <b>any</b> of them. Countries with no data for a filter don’t match it.</p>
      <div class="tablewrap"><table><thead><tr><th>Source</th><th>Used for</th><th>Licence</th></tr></thead><tbody>
      ${used.map((k) => { const s = window.SOURCES[k]; const fs = FILTERS.filter((f) => f.source === k).map((f) => f.label); return `<tr><td><a href="${s.url}" target="_blank" rel="noopener">${esc(s.name)}</a></td><td>${esc(fs.join(", ") || "Country shapes")}</td><td>${esc(s.licence)}</td></tr>`; }).join("")}
      </tbody></table></div>
      <p>Borders follow Natural Earth’s default view. Disputed areas such as Somaliland and Northern Cyprus take the data of the internationally recognised state; Kosovo, Taiwan and Palestine have their own entries.</p>
    </div>`;
    el.hidden = false;
    $("#aboutClose").onclick = () => (el.hidden = true);
    el.onclick = (e) => { if (e.target === el) el.hidden = true; };
  }
  $("#aboutBtn").onclick = openAbout;

  // ---------- Shareable URL ----------
  function encodeState() {
    const parts = state.filters.map((fl) => {
      const f = F[fl.key];
      if (f.type === "range") return `${fl.key}:${fl.min}~${fl.max}`;
      if (f.type === "bool") return `${fl.key}:${fl.value ? 1 : 0}`;
      return `${fl.key}:${fl.values.map(encodeURIComponent).join("|")}`;
    });
    const p = new URLSearchParams();
    if (parts.length) p.set("f", parts.join(","));
    if (state.territories) p.set("t", "1");
    if (state.colourBy) p.set("c", state.colourBy);
    if (state.year) p.set("y", state.year);
    return p.toString();
  }
  function decodeState(qs) {
    const p = new URLSearchParams(qs);
    const out = [];
    (p.get("f") || "").split(",").filter(Boolean).forEach((part) => {
      const i = part.indexOf(":"); const key = part.slice(0, i), v = part.slice(i + 1);
      const f = F[key]; if (!f) return;
      if (f.type === "range") { const [a, b] = v.split("~").map(Number); out.push(makeFilter(key, { min: a, max: b })); }
      else if (f.type === "bool") out.push(makeFilter(key, { value: v === "1" }));
      else out.push(makeFilter(key, { values: v.split("|").filter(Boolean).map(decodeURIComponent).filter((x) => f.options.includes(x)) }));
    });
    state.filters = out;
    if (out.some(isCity) && !out.some((fl) => !isCity(fl))) state.tab = "cities";
    state.territories = p.get("t") === "1";
    state.colourBy = F[p.get("c")] ? p.get("c") : "";
    const y = +p.get("y");
    if (y && TS_YEARS.includes(y)) { state.year = y; applyYear(y); }
  }
  function saveURL() {
    try {
      const q = encodeState();
      history.replaceState(null, "", location.pathname + (q ? "?" + q : ""));
    } catch (e) { /* sandboxed frames may refuse */ }
  }
  try { decodeState(location.search); } catch (e) { /* ignore */ }

  // ---------- Go ----------
  new ResizeObserver(() => layout()).observe($("#mapwrap"));
  layout();
  render();
})();
