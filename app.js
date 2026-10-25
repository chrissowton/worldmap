/* Which Countries? — application code. No build step; plain JavaScript + D3. */
(async function () {
  "use strict";

  // ---------- Load data ----------
  const loadJSON = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.json(); });
  const [rows, topo, cityRows, flows, timeseries, features, physical] = await Promise.all([
    window.__COUNTRIES__ || loadJSON("countries.json"),
    window.__WORLD__ || loadJSON("world-50m.json"),
    window.__CITIES__ || loadJSON("cities.json").catch(() => []),
    window.__FLOWS__ || loadJSON("refugee_flows.json").catch(() => []),
    window.__TIMESERIES__ || loadJSON("timeseries.json").catch(() => null),
    window.__FEATURES__ || loadJSON("features.json").catch(() => null),
    window.__PHYSICAL__ || loadJSON("physical.json").catch(() => null),
  ]);
  // cities.json rows: [name, iso3, lat, lon, population, capital]
  const cities = cityRows.map(([name, iso3, lat, lon, pop, cap], id) => ({ id, name, iso3, lat, lon, city_population: pop, city_capital: !!cap }));
  // physical geography features (rivers, volcanoes, earthquakes…), from physical.js
  if (window.WP && physical) window.WP.load(physical);
  const itemsFor = (f) => (f.target === "city" ? cities : f.target ? (window.WP?.items(f.target) || []) : rows);

  const FILTERS = window.FILTERS;
  // ---------- Year slider: which measures have yearly data ----------
  const TS = timeseries ? timeseries.series : {};
  const TS_YEARS = timeseries ? timeseries.years : [];
  const REGIMES = ["Closed autocracy", "Electoral autocracy", "Electoral democracy", "Liberal democracy"];
  // yearly series stored as numbers that stand for categories
  const CAT_TS = { regime: REGIMES, dtm_stage: (window.FILTERS.find((f) => f.key === "dtm_stage") || {}).order || [] };
  const TIME_KEYS = new Set(Object.keys(TS).concat(TS.regime ? ["democracy"] : []));
  FILTERS.forEach((f) => { if (TIME_KEYS.has(f.key)) f.time = true; });
  // First and last years with data for a reasonable number of countries (at least 20)
  const TS_SPAN = {};
  for (const [key, s] of Object.entries(TS)) {
    const counts = TS_YEARS.map((_, i) => Object.values(s).filter((arr) => arr[i] != null).length);
    const first = counts.findIndex((n) => n >= 20), last = counts.length - 1 - [...counts].reverse().findIndex((n) => n >= 20);
    if (first >= 0) TS_SPAN[key] = [TS_YEARS[first], TS_YEARS[last]];
  }
  const TS_EXT = {};
  for (const [key, s] of Object.entries(TS)) {
    if (CAT_TS[key]) continue;
    const all = Object.values(s).flat().filter((v) => typeof v === "number" && (key === "refugees_hosted" || key === "refugees_from" ? v > 0 : true));
    TS_EXT[key] = [d3.quantile(all.sort((a, b) => a - b), 0.01), d3.quantile(all, 0.99)];
  }
  const span = (key) => TS_SPAN[key === "democracy" ? "regime" : key] || null;
  const timeFrom = (key) => span(key)?.[0] ?? null;
  // Years the slider offers: the overlap of the active yearly filters' spans
  function sliderSpan() {
    const spans = state.filters.filter((fl) => F[fl.key].time).map((fl) => span(fl.key)).filter(Boolean);
    if (!spans.length) return null;
    const a = Math.max(...spans.map((x) => x[0])), b = Math.min(...spans.map((x) => x[1]));
    return a <= b ? [a, b] : null;
  }
  const SITE = window.SITE || {};
  const F = Object.fromEntries(FILTERS.map((f) => [f.key, f]));
  // Families: related measures shown as one menu item with a picker inside
  const FAMILIES = window.FAMILIES || [];
  const famOf = {};
  FAMILIES.forEach((fam) => fam.variants.forEach(([k, lab]) => { if (F[k]) { famOf[k] = fam; F[k].variantLabel = lab; } }));
  FAMILIES.forEach((fam) => { fam.group = F[fam.variants[0][0]].group; fam.time = fam.variants.some(([k]) => F[k]?.time); });
  const byIso = new Map(rows.map((r) => [r.iso3, r]));
  const byNum = new Map(rows.filter((r) => r.num).map((r) => [String(+r.num), r]));
  const NAME_FIX = { Kosovo: "UNK", Somaliland: "SOM", "N. Cyprus": "CYP" };

  const $ = (s) => document.querySelector(s);
  // category slug used for colour-coding, e.g. "UN & treaties" -> "un-treaties"
  const CLOCK = `<svg class="clock" viewBox="0 0 16 16" width="13" height="13" aria-label="yearly data" role="img"><circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 4.4V8l2.6 1.7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
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
    permillion: " per million people", per100: " per 100 people", twh: " TWh", kwh: " kWh per person",
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
      case "kmlen": return d3.format(",")(Math.round(v)) + " km";
      case "temp": return (+v.toFixed(1)) + "°C";
      case "mm": return d3.format(",")(Math.round(v)) + " mm";
      case "m": return d3.format(",")(Math.round(v)) + " m";
      case "mag": return v.toFixed(1);
      case "mmyr": return (Math.abs(v) < 10 ? v.toFixed(1) : Math.round(v)) + " mm/yr";
      case "year": return String(Math.round(v));
      case "mt": return (a < 10 ? +v.toFixed(1) : d3.format(",")(Math.round(v))) + " Mt";
      case "degc": return v.toFixed(3) + "°C";
      case "twh": case "kwh": return compact(v);
      case "permillion": case "per100": return String(a < 10 ? +v.toFixed(1) : d3.format(",")(Math.round(v)));
      case "count": return d3.format(",")(Math.round(v));
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
    const vals = itemsFor(f).map((r) => r[f.key]);
    if (f.type === "range") {
      const nums = vals.filter((v) => typeof v === "number" && (f.scale !== "log" || v > 0)).sort((a, b) => a - b);
      if (f.bounds) [f.dmin, f.dmax] = f.bounds;
      else if (f.clip) { f.dmin = d3.quantileSorted(nums, 0.02); f.dmax = d3.quantileSorted(nums, 0.98); }
      else { f.dmin = nums[0]; f.dmax = nums[nums.length - 1]; }
      if (f.clip && f.step && f.scale !== "log") { f.dmin = Math.floor(f.dmin / f.step) * f.step; f.dmax = Math.ceil(f.dmax / f.step) * f.step; }
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
    sortDir: null,        // "asc" or "desc"; null means the natural default (A–Z for names, high first for numbers)
    flow: null,           // refugee flow view: { iso, dir: "from" | "to" }
    year: null,           // year slider: null means the latest data
    view: "map",          // "map", or a chart view from views.js: "compare", "rank", "trends"
    mode: "human",        // "human" or "physical" geography
    feat: null,           // a physical feature open in the results panel: { t, i }
    mapStyle: "std",      // map colours: "std" (filters), "change" (change over time), "bi" (two measures)
    popSized: false,      // draw countries as circles sized by population
    mm: { ck: "", from: null, to: null, pct: false, bx: "", by: "" },
  };

  // Swap each country's time-enabled values for the chosen year (or back to the latest).
  const NO_LOOKBACK = new Set(["refugees_hosted", "refugees_from", "regime", "libdem"]);
  // value of a yearly measure for one country in one year (with the same 5-year look-back as the year slider)
  function tsValue(key, iso, year) {
    const s = TS[key]?.[iso];
    if (!s) return null;
    const i = year - TS_YEARS[0];
    const back = NO_LOOKBACK.has(key) ? 0 : 4;
    for (let j = i; j >= 0 && j >= i - back; j--) if (s[j] != null) return s[j];
    return null;
  }
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
        const s = TS[k][r.iso3];
        if (!s) continue;
        // survey-based measures are not collected every year: use the most recent value up to 5 years earlier
        let j = i;
        const back = NO_LOOKBACK.has(k) ? 0 : 4;
        while (j > 0 && j > i - back && s[j] == null) j--;
        const v = j >= 0 ? s[j] : null;
        if (v == null) continue;
        const y = TS_YEARS[j];
        if (k === "regime") { r.regime = REGIMES[v]; r.democracy = v >= 2; r.democracy_year = y; }
        else if (CAT_TS[k]) r[k] = CAT_TS[k][v];
        else r[k] = v;
        r[k + "_year"] = y;
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
    return { key, values: preset.values ? [...preset.values] : [], mode: preset.mode || "any" };
  }

  // Does a filter currently restrict anything?
  function isActive(fl) {
    const f = F[fl.key];
    if (f.type === "range") return true; // even at "no limit" it keeps countries that have data
    if (f.type === "bool") return true;
    return fl.values.length > 0;
  }
  const isLimited = (fl) => { const f = F[fl.key]; return fl.min > f.dmin || fl.max < f.dmax; };
  function passes(r, fl) {
    const f = F[fl.key];
    const v = r[fl.key];
    if (f.type === "range") {
      if (typeof v !== "number") return false;
      // the ends of the slider mean "no limit"
      const lo = fl.min <= f.dmin ? -Infinity : fl.min, hi = fl.max >= f.dmax ? Infinity : fl.max;
      return v >= lo - 1e-9 && v <= hi + 1e-9;
    }
    if (f.type === "bool") return v === fl.value;
    if (!fl.values.length) return true;
    if (f.type === "multi") {
      if (!Array.isArray(v)) return false;
      if (fl.mode === "all") return fl.values.every((x) => v.includes(x));
      if (fl.mode === "none") return !v.some((x) => fl.values.includes(x));
      return v.some((x) => fl.values.includes(x));
    }
    return fl.values.includes(v);
  }

  const NEAR_MAP = 25;
  const expandedNear = new Set();
  const pool = () => rows.filter((r) => r.sovereign || state.territories);
  const isCity = (fl) => F[fl.key].target === "city";
  const isFeat = (fl) => { const t = F[fl.key].target; return !!t && t !== "city"; };
  const active = () => state.filters.filter((fl) => !F[fl.key].target && isActive(fl));
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
    const feat = window.WP?.loaded ? window.WP.evaluate(res, act, state.filters.filter(isFeat)) : new Map();
    return { act, res, groups, cityList, feat };
  }
  window.WP?.setW({ F, isActive, passes, byIso });

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
    if (f.type === "range") return isLimited(fl) ? f.say(bound(fl)) : `there is data on ${f.label}`;
    if (f.type === "bool") return f.say(fl.value);
    // optional per-value wording, e.g. "the Commonwealth", "a liberal democracy"
    const vals = fl.values.map((v) => (f.article && f.article[v]) || v);
    if (fl.mode === "none") return (f.sayNot || f.say)(joinOr(vals));
    if (fl.mode === "all") return f.say(andList(vals), vals.length > 1);
    return f.say(joinOr(vals));
  }
  function chipLabel(fl) {
    const f = F[fl.key];
    const name = f.short || f.label;
    if (f.type === "bool") return fl.value ? f.yes : f.no;
    if (f.type === "range") {
      if (!isLimited(fl)) return `${name}: all`;
      const lo = fl.min > f.dmin, hi = fl.max < f.dmax;
      if (f.format === "rank" && hi && !lo) return `${name}: top ${Math.round(fl.max)}`;
      if (lo && hi) return `${name} ${fmtShort(f, fl.min)}–${fmtShort(f, fl.max)}`;
      return lo ? `${name} ≥ ${fmtShort(f, fl.min)}` : `${name} ≤ ${fmtShort(f, fl.max)}`;
    }
    if (!fl.values.length) return `${name}: choose…`;
    const sep = fl.mode === "all" ? " + " : ", ";
    const v = fl.values.length > 2 ? `${fl.values.slice(0, 2).join(sep)} +${fl.values.length - 2}` : fl.values.join(sep);
    return `${name}: ${fl.mode === "none" ? "not " : ""}${v}`;
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
    for (const [t, list] of lastEval?.feat || []) {
      const fp = state.filters.filter((fl) => F[fl.key].target === t && isActive(fl)).map(phrase).filter(Boolean);
      const m = list.length, T = window.WP.T[t];
      const part = `<b>${m.toLocaleString()} ${m === 1 ? T.one : T.many}</b>${fp.length ? ` where ${esc(andList(fp))}` : ""}`;
      cityPart = cityPart ? `${cityPart}; ${part}` : part;
    }
    if (!act.length) {
      if (cityPart) return `Showing ${cityPart}.${clear}`;
      return state.mode === "physical" ? `Physical geography: showing all <b>${n} ${noun(n)}</b>. Add a filter, or pick a feature such as rivers or volcanoes.` : `Showing all <b>${n} ${noun(n)}</b>. Add a filter to start asking questions.`;
    }
    const timed = act.some((fl) => F[fl.key].time), untimed = act.some((fl) => !F[fl.key].time);
    const when = state.year && timed ? `In <b>${state.year}</b>: ` : "";
    const note = state.year && untimed ? ` <span class="tnote">${timed ? "Filters without yearly data use the latest figures." : `The year slider doesn't change these filters; they use the latest figures.`}</span>` : "";
    return `${when}Showing <b>${n} ${noun(n)}</b> where ${esc(andList(act.map(phrase)))}${cityPart ? `, with ${cityPart} in them` : ""}.${note}${clear}`;
  }

  // ---------- Map ----------
  const svg = d3.select("#map");
  const gRoot = svg.append("g");
  // striped fill for near misses, so they can't be mistaken for a light shade
  const defs = svg.append("defs");
  const hatch = defs.append("pattern").attr("id", "nearHatch").attr("patternUnits", "userSpaceOnUse").attr("width", 5).attr("height", 5).attr("patternTransform", "rotate(45)");
  hatch.append("rect").attr("width", 5).attr("height", 5).attr("style", "fill: var(--land)");
  hatch.append("rect").attr("width", 2).attr("height", 5).attr("style", "fill: var(--match)");
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
    riverPaths.attr("d", path); lakePaths.attr("d", path);
    invalidatePoints();
    window.WP?.layout(Math.max(0.55, Math.min(1, w / 1100)));
    cities.forEach((c) => { delete c._pt; delete c._lpt; });
    physLabels.forEach((l) => delete l._pt);
    placeCountryLabels();
    scheduleLabels();
    zoom.extent([[0, 0], [w, h]]).translateExtent([[-w * 0.2, -h * 0.2], [w * 1.2, h * 1.2]]);
    drawDots();
    drawCities();
  }
  const zoom = d3.zoom().scaleExtent([1, 40]).on("zoom", (e) => {
    k = e.transform.k;
    gLabels.selectAll("text").attr("font-size", (d) => d.fs / k).attr("stroke-width", 3 / k).attr("x", (d) => (d.isCity ? 5 / k : 0));
    gLabels.selectAll("circle").attr("r", (d) => (d.c.city_capital ? 3 : 2.2) / k);
    scheduleLabels();
    gRoot.attr("transform", e.transform);
    gDots.selectAll("circle").attr("r", 4.2 / k);
    gCities.selectAll("circle").attr("r", (d) => cityR(d) / k);
    window.WP?.zoomed(k);
  });
  svg.call(zoom).on("dblclick.zoom", null);
  $("#zin").onclick = () => svg.transition().duration(250).call(zoom.scaleBy, 1.6);
  $("#zout").onclick = () => svg.transition().duration(250).call(zoom.scaleBy, 1 / 1.6);
  $("#zreset").onclick = () => svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);

  // ---------- Place names and physical features that appear as you zoom in ----------
  state.labels = true;
  const gPhys = gRoot.insert("g", () => gDots.node()).attr("class", "phys");
  // physical mode: background map and overlays under the rivers, chosen features above them
  const gBase = gRoot.insert("g", () => gPhys.node()).attr("class", "pbase");
  const gOver = gRoot.insert("g", () => gPhys.node()).attr("class", "pover");
  const gFeat = gRoot.insert("g", () => gDots.node()).attr("class", "pfeat");
  window.WP?.attach({ base: gBase, over: gOver, feat: gFeat }, projection, path);
  const gLabels = gRoot.append("g").attr("class", "labels");
  let rivers = [], lakes = [];
  if (features) {
    rivers = topojson.feature(features.shapes, features.shapes.objects.rivers).features;
    lakes = topojson.feature(features.shapes, features.shapes.objects.lakes).features;
  }
  const riverPaths = gPhys.selectAll("path.river").data(rivers).join("path").attr("class", "river");
  const lakePaths = gPhys.selectAll("path.lake").data(lakes).join("path").attr("class", "lake");
  // Natural Earth gives each label a web-map zoom level; this map's zoom 1 is about web zoom 1.3
  const webZoom = (kk) => Math.log2(kk) + 1.3;
  const LAKE_WORD = /lake|lac|lago|reservoir|sea|ozero|loch|vodokhranilishche/i;
  const physLabels = (features ? features.labels : []).map(([name, type, lon, lat, min, elev]) => ({
    text: type === "lake" && !LAKE_WORD.test(name) ? `Lake ${name}` : type === "peak" ? `${name} ${d3.format(",")(elev)} m` : name,
    type, lon, lat, min, cls: ["ocean", "sea", "gulf", "bay", "strait", "channel", "sound", "lake", "river", "reef"].includes(type) ? "water" : type === "peak" ? "peak" : "land",
    pri: type === "ocean" ? 0 : ["sea", "gulf"].includes(type) ? 3 : type === "lake" ? 6 : type === "peak" ? 8 : 5,
  }));
  // Cities: capitals first, then by size; minimum zoom grows as cities get smaller
  const cityMinK = (c) => c.city_capital ? (c.city_population >= 5e6 ? 1.6 : c.city_population >= 1e6 ? 2.4 : 3.2)
    : c.city_population >= 1e7 ? 2.4 : c.city_population >= 3e6 ? 3.4 : c.city_population >= 1e6 ? 5 : c.city_population >= 3e5 ? 8 : 12;
  const cityLabels = cities.map((c) => ({ text: c.name, c, minK: cityMinK(c), cls: c.city_capital ? "city cap" : "city", pri: c.city_capital ? 4 : 7, pop: c.city_population }));
  let countryLabels = [];
  function placeCountryLabels() {
    countryLabels = geo.filter((d) => d.rec).map((d) => {
      // label the largest piece of the country, sized by its width on screen
      const polys = d.geometry.type === "MultiPolygon" ? d.geometry.coordinates.map((c) => ({ type: "Polygon", coordinates: c })) : [d.geometry];
      const big = polys.reduce((a, b) => (path.area(b) > path.area(a) ? b : a));
      const [[x0], [x1]] = path.bounds(big);
      const [x, y] = path.centroid(big);
      return { text: d.rec.name, x, y, width: x1 - x0, cls: "country", pri: 2, area: path.area(big) };
    }).filter((l) => !Number.isNaN(l.x));
  }
  function physPoint(l) { return l._pt || (l._pt = projection([l.lon, l.lat])); }
  function cityPoint(c) { return c._lpt || (c._lpt = projection([c.lon, c.lat])); }
  let labelTimer = 0;
  function scheduleLabels() { clearTimeout(labelTimer); labelTimer = setTimeout(updateLabels, 90); }
  function updateLabels() {
    gPhys.attr("display", state.labels && !state.flow ? null : "none");
    if (!state.labels) { gLabels.selectAll("*").remove(); return; }
    const t = d3.zoomTransform(svg.node());
    const kk = t.k, z = webZoom(kk);
    // rivers and smaller lakes appear as you zoom in
    riverPaths.attr("display", (d) => (d.properties.r <= (kk >= 10 ? 12 : kk >= 6 ? 8 : kk >= 3 ? 5 : kk >= 1.8 ? 3 : 0) ? null : "none"));
    lakePaths.attr("display", (d) => (d.properties.r <= (kk >= 4 ? 12 : kk >= 2 ? 5 : 2) ? null : "none"));
    const vb = svg.attr("viewBox").split(" ").map(Number);
    const [W, H] = [vb[2], vb[3]];
    const inView = ([x, y]) => { const sx = x * kk + t.x, sy = y * kk + t.y; return sx > -20 && sx < W + 20 && sy > -10 && sy < H + 10; };
    const cand = [];
    for (const l of physLabels) if (z + 0.25 >= l.min && (!state.popSized || l.cls === "water")) { const p = physPoint(l); if (p && inView(p)) cand.push({ ...l, x: p[0], y: p[1] }); }
    // countries drawn as circles carry their own names
    if (!state.popSized) for (const l of countryLabels) if (l.width * kk > l.text.length * 6.6 + 10 && inView([l.x, l.y])) cand.push(l);
    if (!state.flow && !state.popSized) for (const l of cityLabels) if (kk >= l.minK) { const p = cityPoint(l.c); if (p && inView(p)) cand.push({ ...l, x: p[0], y: p[1] }); }
    cand.sort((a, b) => a.pri - b.pri || (b.area || b.pop || 0) - (a.area || a.pop || 0));
    // keep labels that don't overlap ones already placed (checked in screen space)
    const SIZE = { country: 12.5, water: 12, land: 11.5, city: 11.5, peak: 10.5 };
    const placed = [], boxes = [];
    for (const l of cand) {
      const fs = l.type === "ocean" ? 14 : SIZE[l.cls.split(" ")[0]];
      const w = l.text.length * fs * 0.56 + 6, h = fs + 3;
      const sx = l.x * kk + t.x, sy = l.y * kk + t.y;
      const isCity = l.cls.startsWith("city");
      const b = isCity ? [sx + 4, sy - h / 2, sx + 6 + w, sy + h / 2] : [sx - w / 2, sy - h / 2, sx + w / 2, sy + h / 2];
      if (boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) continue;
      boxes.push(b); placed.push({ ...l, fs, isCity });
      if (placed.length >= 260) break;
    }
    const sel = gLabels.selectAll("g.lbl").data(placed, (d) => d.cls + d.text + d.x).join((en) => {
      const g = en.append("g").attr("class", (d) => "lbl " + d.cls);
      g.filter((d) => d.isCity).append("circle");
      g.append("text");
      return g;
    });
    sel.attr("transform", (d) => `translate(${d.x},${d.y})`);
    sel.select("circle").attr("r", (d) => (d.c.city_capital ? 3 : 2.2) / kk);
    sel.select("text").text((d) => d.text)
      .attr("x", (d) => (d.isCity ? 5 / kk : 0)).attr("dy", "0.35em")
      .attr("text-anchor", (d) => (d.isCity ? "start" : "middle"))
      .attr("font-size", (d) => d.fs / kk).attr("stroke-width", 3 / kk);
  }
  $("#zlabels").onclick = () => {
    state.labels = !state.labels;
    $("#zlabels").setAttribute("aria-pressed", String(state.labels));
    updateLabels();
  };

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
  const numericFilters = FILTERS.filter((f) => f.type === "range" && !f.target && !f.hidden);
  // <option>s grouped by category, for the Sort and Shade by menus
  const groupedOptions = (selected) => window.FILTER_GROUPS.map((g) => {
    const fs = numericFilters.filter((f) => f.group === g);
    return fs.length ? `<optgroup label="${esc(g)}">${fs.map((f) => `<option value="${f.key}" ${selected === f.key ? "selected" : ""}>${esc(f.label)}</option>`).join("")}</optgroup>` : "";
  }).join("");
  // Which number to shade matching countries by: the user's choice, else the last number filter added
  function colourKey() {
    if (state.colourBy === "none") return null;
    if (state.colourBy) return state.colourBy;
    const nums = active().filter((fl) => F[fl.key].type === "range");
    return nums.length ? nums[nums.length - 1].key : null;
  }
  function colourScale(matches) {
    const key = colourKey();
    if (!key) return null;
    const f = F[key];
    const vals = matches.map((r) => r[f.key]).filter((v) => typeof v === "number");
    if (vals.length < 2) return null;
    // Scale over the chosen range of the filter (so colours mean the same thing in every year);
    // an end left at "no limit" uses the actual values
    const fl = state.filters.find((x) => x.key === key);
    // for yearly measures use the range across all years, so a colour means the same value in every year
    const dataExt = f.time && TS_EXT[key] ? TS_EXT[key] : d3.extent(vals);
    let from = fl && fl.min > f.dmin ? fl.min : dataExt[0], to = fl && fl.max < f.dmax ? fl.max : dataExt[1];
    if (!fl) [from, to] = [f.dmin, f.dmax];
    if (f.scale === "log") from = Math.max(from, f.dmin);
    const ext = [f.toT(from), f.toT(to)];
    if (!(ext[1] > ext[0])) return null;
    const css = getComputedStyle(document.documentElement);
    const lo = css.getPropertyValue("--ramp-lo").trim(), hi = css.getPropertyValue("--ramp-hi").trim();
    const interp = d3.interpolateRgb(lo, hi);
    const s = (v) => (typeof v === "number" ? interp(Math.min(1, Math.max(0, (f.toT(v) - ext[0]) / (ext[1] - ext[0])))) : null);
    s.f = f; s.ext = ext.map(f.fromT); s.lo = lo; s.hi = hi;
    return s;
  }

  // ---------- Render ----------
  function render(opts = {}) {
    lastEval = evaluate();
    const { act, res } = lastEval;
    const matches = pool().filter((r) => res.get(r.iso3).match).sort((a, b) => a.name.localeCompare(b.name));
    const cs = colourScale(matches);
    styleInfo = state.mapStyle === "change" ? changeInfo() : state.mapStyle === "bi" ? biInfo() : null;
    const inScope = (rec) => { const e = rec && res.get(rec.iso3); return e && (!act.length || e.match); };
    const clsFor = (rec) => {
      const e = rec && res.get(rec.iso3);
      if (styleInfo) return inScope(rec) && styleInfo.colour(rec.iso3) ? "styled" : "";
      // with no country filters, leave countries plain so cities stand out
      return e && act.length ? (e.match ? "match" : e.near && e.shade ? "near" : "") : "";
    };
    document.body.dataset.mode = state.mode;
    const fillFor = (rec) => {
      if (!rec) return null;
      if (styleInfo) return inScope(rec) ? styleInfo.colour(rec.iso3) : null;
      if (!cs) return null;
      const e = res.get(rec.iso3);
      return e && e.match ? cs(rec[cs.f.key]) : null;
    };
    paths
      .attr("class", (d) => clsFor(d.rec) + (d.rec && d.rec.iso3 === state.selected ? " sel" : ""))
      .style("fill", (d) => fillFor(d.rec));
    drawDots();
    drawCities();
    gDots.selectAll("circle").style("fill", (d) => fillFor(d));
    drawCarto(clsFor, fillFor);
    if (state.mode === "physical") { state.popSized = false; state.mapStyle = "std"; }
    window.WP?.draw(state, lastEval);
    gLand.attr("opacity", state.popSized && !state.flow ? 0.16 : null).style("pointer-events", state.popSized && !state.flow ? "none" : null);

    gDots.attr("display", state.flow || state.popSized ? "none" : null);
    if (typeof updateLabels === "function") scheduleLabels();
    gCities.attr("display", state.flow || state.popSized ? "none" : null);
    if (state.flow) applyFlow(); else $("#flowbar").hidden = true;

    renderTimebar();
    if (openTheme && typeof showTheme === "function") showTheme(openTheme);
    $("#mapClear").hidden = !(state.filters.length || state.flow || state.year || state.selected || state.mapStyle !== "std" || state.popSized);
    renderMapStyle();
    renderViews();
    renderModes();
    renderChips(act);
    $("#sentence").innerHTML = sentence(matches.length, act);
    const ca = $("#clearAll"); if (ca) ca.onclick = clearAll;
    renderLegend(cs, act);
    renderStarter(act);
    renderZero(act, matches);
    if (!opts.keepEditor) { if (state.open) renderEditor(); else $("#editor").hidden = true; }
    if (state.selected) renderDetail(); else renderResults(matches, act, res);
    if (state.view !== "map") window.WV?.render();
    saveURL();
  }

  function renderChips(act) {
    const box = $("#chips");
    box.innerHTML = "";
    for (const fl of state.filters) {
      const el = document.createElement("span");
      el.className = "chip" + (state.open === fl.key ? " open" : "") + (isActive(fl) ? "" : " idle");
      el.dataset.g = gslug(F[fl.key].group);
      const clock = F[fl.key].time ? (state.year ? `<span class="yr">${CLOCK}${state.year}</span>` : `<span class="yclock" title="Has yearly data">${CLOCK}</span>`) : "";
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
    el.hidden = !!state.flow || state.mode === "physical";
    const sp = sliderSpan();
    // keep the chosen year inside the span of the current filters
    if (state.year && (!sp || state.year < sp[0] || state.year > sp[1])) {
      const y = sp ? Math.min(Math.max(state.year, sp[0]), sp[1]) : null;
      state.year = y; applyYear(y);
      setTimeout(() => render(), 0);
    }
    if (!el.dataset.built) {
      el.dataset.built = "1";
      el.innerHTML = `<button type="button" class="play" id="tPlay" aria-label="Play through the years">▶</button>
        <div class="tmain"><div class="trow"><span class="tclock">${CLOCK}</span><span class="tyear num" id="tYear"></span><span class="tnote" id="tNote"></span>
        <button type="button" class="linkbtn" id="tLatest">Back to latest</button></div>
        <div class="tslide"><span class="tend num" id="tMin"></span><input type="range" id="tRange" step="1" aria-label="Year"><span class="tend num" id="tMax"></span></div></div>`;
      const range = $("#tRange");
      range.oninput = () => { stopPlay(); setYear(+range.value); };
      $("#tLatest").onclick = () => { stopPlay(); setYear(null); };
      $("#tPlay").onclick = () => (playing ? stopPlay() : startPlay());
    }
    const range = $("#tRange");
    el.classList.toggle("off", !sp);
    range.disabled = !sp; $("#tPlay").disabled = !sp;
    if (sp) { range.min = sp[0]; range.max = sp[1]; range.value = state.year ?? sp[1]; $("#tMin").textContent = sp[0]; $("#tMax").textContent = sp[1]; }
    else { $("#tMin").textContent = ""; $("#tMax").textContent = ""; }
    $("#tYear").textContent = state.year ? state.year : "Latest";
    $("#tNote").textContent = !sp
      ? (state.filters.some((fl) => F[fl.key].time) ? "These filters have no years in common." : "Add a filter marked “yearly” (like population, HDI or democracy) to go back in time.")
      : state.year ? `Showing ${state.year} for filters with yearly data.` : `Data from ${sp[0]} to ${sp[1]}. Drag or press play.`;
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
    const sp = sliderSpan();
    if (!sp) return;
    const [y0, y1] = sp;
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

  // ---------- Map styles: change over time, two measures at once, countries sized by population ----------
  let styleInfo = null;
  const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const yearlyNumeric = (f) => f && f.type === "range" && TS[f.key] && !CAT_TS[f.key] && !f.hidden && !f.target;
  // <select> options for measures, grouped by category; onlyYearly limits them to measures with yearly data
  function measureOptions(selected, onlyYearly) {
    return window.FILTER_GROUPS.map((g) => {
      const fs = numericFilters.filter((f) => f.group === g && (!onlyYearly || yearlyNumeric(f)));
      return fs.length ? `<optgroup label="${esc(g)}">${fs.map((f) => `<option value="${f.key}" ${selected === f.key ? "selected" : ""}>${esc(f.label)}${f.time && !onlyYearly ? " ◷" : ""}</option>`).join("")}</optgroup>` : "";
    }).join("");
  }
  function defaultChangeKey() {
    const ck = colourKey();
    if (ck && yearlyNumeric(F[ck])) return ck;
    const fl = state.filters.find((x) => yearlyNumeric(F[x.key]));
    return fl ? fl.key : "life_expectancy";
  }
  function changeYears() {
    const key = state.mm.ck || defaultChangeKey();
    const sp = span(key) || [TS_YEARS[0], TS_YEARS[TS_YEARS.length - 1]];
    const to = Math.min(Math.max(state.mm.to || sp[1], sp[0]), sp[1]);
    let from = state.mm.from || Math.max(sp[0], Math.min(1990, to - 10));
    from = Math.min(Math.max(from, sp[0]), to);
    return { key, sp, from, to };
  }
  function fmtChange(f, d, pct) {
    const sign = d > 0 ? "+" : d < 0 ? "−" : "±";
    const a = Math.abs(d);
    if (pct) return `${sign}${a >= 100 ? d3.format(",")(Math.round(a)) : +a.toPrecision(2)}%`;
    if (f.format === "pct") return `${sign}${+a.toFixed(a < 10 ? 1 : 0)} points`;
    return sign + fmtShort(f, a);
  }
  function changeInfo() {
    const { key, from, to } = changeYears();
    const f = F[key];
    if (!f) return null;
    const pct = state.mm.pct;
    const vals = new Map();
    for (const r of pool()) {
      const a = tsValue(key, r.iso3, from), b = tsValue(key, r.iso3, to);
      if (a == null || b == null) continue;
      const d = pct ? (a > 0 ? ((b - a) / a) * 100 : null) : b - a;
      if (d != null && Number.isFinite(d)) vals.set(r.iso3, { a, b, d });
    }
    const abs = [...vals.values()].map((v) => Math.abs(v.d)).sort(d3.ascending);
    const m = d3.quantileSorted(abs, 0.95) || 1;
    const lo = cssVar("--div-lo"), mid = cssVar("--div-mid"), hi = cssVar("--div-hi");
    const interp = d3.scaleLinear().domain([-m, 0, m]).range([lo, mid, hi]).interpolate(d3.interpolateRgb).clamp(true);
    return {
      kind: "change", f, from, to, pct, vals, m, lo, mid, hi,
      colour: (iso) => (vals.has(iso) ? interp(vals.get(iso).d) : null),
      tip: (r) => {
        const v = vals.get(r.iso3);
        return v ? `<dl><dt>${esc(f.short || f.label)} ${from}</dt><dd>${esc(fmtShort(f, v.a))}</dd><dt>${to}</dt><dd>${esc(fmtShort(f, v.b))}</dd><dt>Change</dt><dd><b>${esc(fmtChange(f, v.d, pct))}</b></dd></dl>`
          : `<span class="st">No data on ${esc(f.label.toLowerCase())} for both years</span>`;
      },
      csv: () => [["Country", `${f.label} ${from}`, `${f.label} ${to}`, pct ? "% change" : "Change"],
        ...[...vals].map(([iso, v]) => [byIso.get(iso).name, v.a, v.b, +v.d.toFixed(3)])],
    };
  }
  const BI = ["--bi-00", "--bi-10", "--bi-20", "--bi-01", "--bi-11", "--bi-21", "--bi-02", "--bi-12", "--bi-22"];
  function biInfo() {
    const fx = F[state.mm.bx || "gdp_per_capita"], fy = F[state.mm.by || "co2_per_capita"];
    if (!fx || !fy) return null;
    const pts = pool().filter((r) => typeof r[fx.key] === "number" && typeof r[fy.key] === "number");
    if (pts.length < 6) return null;
    const qs = (f) => { const v = pts.map((r) => r[f.key]).sort(d3.ascending); return [d3.quantileSorted(v, 1 / 3), d3.quantileSorted(v, 2 / 3)]; };
    const qx = qs(fx), qy = qs(fy);
    const third = (v, q) => (v <= q[0] ? 0 : v <= q[1] ? 1 : 2);
    const cols = BI.map(cssVar);
    const cell = new Map(pts.map((r) => [r.iso3, [third(r[fx.key], qx), third(r[fy.key], qy)]]));
    const WORD = ["lowest third", "middle third", "highest third"];
    return {
      kind: "bi", fx, fy, qx, qy, cols, cell,
      colour: (iso) => { const c = cell.get(iso); return c ? cols[c[1] * 3 + c[0]] : null; },
      tip: (r) => {
        const c = cell.get(r.iso3);
        return c ? `<dl><dt>${esc(fx.short || fx.label)}</dt><dd>${esc(fmtShort(fx, r[fx.key]))} <small>(${WORD[c[0]]})</small></dd><dt>${esc(fy.short || fy.label)}</dt><dd>${esc(fmtShort(fy, r[fy.key]))} <small>(${WORD[c[1]]})</small></dd></dl>`
          : `<span class="st">Missing data for one of the two measures</span>`;
      },
      csv: () => [["Country", fx.label, fy.label, `${fx.label} third`, `${fy.label} third`],
        ...pts.map((r) => [r.name, r[fx.key], r[fy.key], cell.get(r.iso3)[0] + 1, cell.get(r.iso3)[1] + 1])],
    };
  }

  // Countries drawn as circles sized by population (a Dorling cartogram), pushed apart so they don't overlap
  const gCarto = gRoot.insert("g", () => gDots.node()).attr("class", "carto");
  let cartoNodes = new Map(), cartoSig = "";
  function cartoLayout() {
    const vb = svg.attr("viewBox").split(" ").map(Number);
    const list = rows.filter((r) => typeof r.population === "number" && r.population > 0 && (r.sovereign || state.territories || r.population > 2e5) && (r._pt || (r._pt = centroidFor(r))));
    const sig = vb.join(",") + "|" + list.length + "|" + (state.year || "") + "|" + state.territories;
    if (sig === cartoSig) return;
    cartoSig = sig;
    const total = d3.sum(list, (r) => r.population);
    const kr = Math.sqrt((0.2 * vb[2] * vb[3]) / (Math.PI * total));
    const nodes = list.map((r) => {
      const old = cartoNodes.get(r.iso3);
      return { rec: r, r: Math.max(1.6, kr * Math.sqrt(r.population)), tx: r._pt[0], ty: r._pt[1], x: old ? old.x : r._pt[0], y: old ? old.y : r._pt[1] };
    });
    const sim = d3.forceSimulation(nodes)
      .force("x", d3.forceX((d) => d.tx).strength(0.12)).force("y", d3.forceY((d) => d.ty).strength(0.12))
      .force("c", d3.forceCollide((d) => d.r + 0.7).iterations(3)).stop();
    for (let i = 0; i < (cartoNodes.size ? 80 : 240); i++) sim.tick();
    cartoNodes = new Map(nodes.map((n) => [n.rec.iso3, n]));
  }
  // everyday short names for long country names (never codes)
  const SHORT_NAMES = { USA: "USA", GBR: "UK", ARE: "UAE", COD: "DR Congo", COG: "Congo", CAF: "C. African Rep.", KOR: "S. Korea", PRK: "N. Korea",
    BIH: "Bosnia", DOM: "Dominican Rep.", PNG: "Papua NG", SAU: "Saudi", ZAF: "S. Africa", SSD: "S. Sudan", TTO: "Trinidad", VCT: "St Vincent", MKD: "N. Macedonia" };
  function drawCarto(clsFor, fillFor) {
    if (!state.popSized || state.flow) { gCarto.selectAll("*").remove(); return; }
    cartoLayout();
    const nodes = [...cartoNodes.values()].filter((n) => n.rec.sovereign || state.territories || n.rec.population > 2e5);
    const g = gCarto.selectAll("g.cn").data(nodes, (d) => d.rec.iso3).join((en) => {
      const gg = en.append("g").attr("class", "cn");
      gg.append("circle"); gg.append("text");
      return gg;
    });
    g.attr("transform", (d) => `translate(${d.x.toFixed(1)},${d.y.toFixed(1)})`);
    g.select("circle").attr("r", (d) => d.r).attr("data-iso", (d) => d.rec.iso3)
      .attr("class", (d) => clsFor(d.rec) + (d.rec.iso3 === state.selected ? " sel" : ""))
      .style("fill", (d) => fillFor(d.rec));
    // white names on dark circles, dark names on light ones
    const darkFill = (d) => { const c = fillFor(d.rec) || (clsFor(d.rec) === "match" ? cssVar("--match") : cssVar("--land")); const l = d3.lab(c).l; return Number.isFinite(l) && l < 55; };
    const fits = (t, d) => t.length * Math.min(12, d.r * 0.55) * 0.56 < d.r * 1.8;
    const label = (d) => {
      if (d.r < 9) return "";
      const n = d.rec.name, sh = SHORT_NAMES[d.rec.iso3];
      if (fits(n, d)) return n;
      if (sh && fits(sh, d)) return sh;
      const w = n.split(" ")[0];
      return w.length >= 4 && fits(w + "…", d) ? w + "…" : "";
    };
    g.select("text").text(label)
      .attr("class", (d) => (darkFill(d) ? "lt" : null))
      .attr("font-size", (d) => Math.min(12, d.r * 0.55)).attr("dy", "0.35em");
  }

  function renderMapStyle() {
    const btn = $("#mmBtn"), card = $("#mmCard");
    if (state.mode === "physical" && window.WP?.loaded) {
      btn.hidden = !!state.flow;
      btn.setAttribute("aria-expanded", String(!card.hidden));
      const names = { landforms: "Landforms", biomes: "Biomes", climate: "Climate zones", plates: "Plates", none: "Plain" };
      btn.innerHTML = `🎨 Map style: <b>${names[window.WP.style.base]}</b>`;
      if (!card.hidden) {
        window.WP.styleCard(card, () => render());
        $("#mmClose").onclick = () => { card.hidden = true; renderMapStyle(); };
      }
      return;
    }
    const name = { std: "", change: "Change", bi: "Two measures" }[state.mapStyle];
    btn.innerHTML = `🎨 Map style${name || state.popSized ? `: <b>${[name, state.popSized ? "by population" : ""].filter(Boolean).join(", ")}</b>` : ""}`;
    btn.hidden = !!state.flow;
    btn.setAttribute("aria-expanded", String(!card.hidden));
    if (card.hidden) return;
    const st = state.mapStyle;
    let body = "";
    if (st === "change") {
      const { key, sp, from, to } = changeYears();
      const yrs = d3.range(sp[0], sp[1] + 1);
      const yo = (sel) => yrs.map((y) => `<option ${y === sel ? "selected" : ""}>${y}</option>`).join("");
      body = `<label class="fld">Measure <select id="mmCk">${measureOptions(key, true)}</select></label>
        <div class="fld2"><label class="fld">From <select id="mmFrom">${yo(from)}</select></label><label class="fld">To <select id="mmTo">${yo(to)}</select></label></div>
        <label class="tog"><input type="checkbox" id="mmPct" ${state.mm.pct ? "checked" : ""}> Show as % change</label>
        <p class="hint">${state.filters.length ? "Only countries that match your filters are coloured. " : ""}Red: went up. Blue: went down.</p>`;
    } else if (st === "bi") {
      body = `<label class="fld">Across (colours get redder) <select id="mmBx">${measureOptions(state.mm.bx || "gdp_per_capita")}</select></label>
        <label class="fld">Up (colours get bluer) <select id="mmBy">${measureOptions(state.mm.by || "co2_per_capita")}</select></label>
        <p class="hint">Each measure is split into thirds: low, middle and high. Dark purple means high on both.</p>`;
    } else {
      body = `<p class="hint">Colour shows the countries that match your filters, shaded by a number if you choose one.</p>`;
    }
    card.innerHTML = `<div class="mmhead"><h3>Map style</h3><button type="button" class="iconbtn" id="mmClose" aria-label="Close">×</button></div>
      <div class="seg" role="radiogroup" aria-label="Colour the map by">
        ${[["std", "Filters"], ["change", "Change over time"], ["bi", "Two measures"]].map(([v, l]) => `<button type="button" role="radio" aria-checked="${st === v}" data-st="${v}">${l}</button>`).join("")}
      </div>${body}
      <label class="tog"><input type="checkbox" id="mmPop" ${state.popSized ? "checked" : ""}> Size countries by population</label>`;
    card.querySelectorAll(".seg button").forEach((b) => (b.onclick = () => { state.mapStyle = b.dataset.st; if (b.dataset.st === "change" && !state.mm.ck) state.mm.ck = defaultChangeKey(); render(); }));
    $("#mmClose").onclick = () => { card.hidden = true; renderMapStyle(); };
    $("#mmPop").onchange = (e) => { state.popSized = e.target.checked; render(); };
    if ($("#mmCk")) $("#mmCk").onchange = (e) => { state.mm.ck = e.target.value; state.mm.from = state.mm.to = null; render(); };
    if ($("#mmFrom")) $("#mmFrom").onchange = (e) => { state.mm.from = +e.target.value; render(); };
    if ($("#mmTo")) $("#mmTo").onchange = (e) => { state.mm.to = +e.target.value; render(); };
    if ($("#mmPct")) $("#mmPct").onchange = (e) => { state.mm.pct = e.target.checked; render(); };
    if ($("#mmBx")) $("#mmBx").onchange = (e) => { state.mm.bx = e.target.value; render(); };
    if ($("#mmBy")) $("#mmBy").onchange = (e) => { state.mm.by = e.target.value; render(); };
  }
  $("#mmBtn").onclick = () => { $("#mmCard").hidden = !$("#mmCard").hidden; renderMapStyle(); };

  // ---------- Views: map, or a chart from views.js ----------
  document.querySelectorAll("#views button").forEach((b) => (b.onclick = () => setView(b.dataset.v)));
  function setView(v) {
    if (state.view === v) return;
    state.view = v;
    stopPlay();
    render();
  }
  function renderViews() {
    document.querySelectorAll("#views button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.v === state.view)));
    const isMap = state.view === "map";
    $("#mapwrap").hidden = !isMap;
    $("#viewwrap").hidden = isMap;
    document.body.dataset.view = state.view;
  }

  function styleLegend(si) {
    if (si.kind === "change") {
      const f = si.f;
      return `<div class="lrow"><span>${esc(f.label)}: ${si.pct ? "% change" : "change"}, ${si.from}–${si.to}</span></div>
        <div class="lrow"><span class="num">${esc(fmtChange(f, -si.m, si.pct))}</span><span class="ramp" style="background:linear-gradient(90deg, ${si.lo}, ${si.mid}, ${si.hi})"></span><span class="num">${esc(fmtChange(f, si.m, si.pct))}</span></div>
        <div class="lrow lsub"><span>went down</span><span>went up</span></div>`;
    }
    const grid = [2, 1, 0].map((y) => [0, 1, 2].map((x) => `<span style="background:${si.cols[y * 3 + x]}"></span>`).join("")).join("");
    return `<div class="bilegend"><div class="bigrid" role="img" aria-label="Key: three by three grid of colours">${grid}</div>
      <div class="bitext"><span>↑ ${esc(si.fy.short || si.fy.label)}</span><span>→ ${esc(si.fx.short || si.fx.label)}</span><small>Split into thirds. Dark = high on both.</small></div></div>`;
  }
  function renderLegend(cs, act) {
    const el = $("#legend");
    if (state.flow && flowScale) {
      el.hidden = false;
      el.innerHTML = `<div class="lrow"><span>Refugees (groups of 100 or more)</span></div><div class="lrow"><span class="num">${compact(flowScale.ext[0] || 0)}</span><span class="ramp" style="background:linear-gradient(90deg, ${flowScale.lo}, ${flowScale.hi})"></span><span class="num">${compact(flowScale.ext[1] || 0)}</span></div>`;
      return;
    }
    if (styleInfo) {
      el.hidden = false;
      el.innerHTML = styleLegend(styleInfo) + (state.popSized ? `<div class="lrow"><span class="sw city"></span>Circles sized by population</div>` : "");
      return;
    }
    const physLeg = window.WP ? window.WP.legendHTML(state, lastEval) : "";
    if (state.mode === "physical") {
      let h = physLeg;
      if (cs) h += `<div class="lrow"><span>${esc(cs.f.label)}</span></div><div class="lrow"><span class="num">${fmtShort(cs.f, cs.ext[0])}</span><span class="ramp" style="background:linear-gradient(90deg, ${cs.lo}, ${cs.hi})"></span><span class="num">${fmtShort(cs.f, cs.ext[1])}</span></div>`;
      else if (act.length) h += `<div class="lrow"><span class="sw" style="background:var(--match)"></span>Matches every country filter</div>`;
      el.hidden = !h; el.innerHTML = h; return;
    }
    if (!act.length && !showCities() && !state.popSized) { el.hidden = true; return; }
    el.hidden = false;
    let h = state.popSized ? `<div class="lrow"><span class="sw city"></span>Circles sized by population</div>` : "";
    if (cs) {
      h += `<div class="lrow"><span>${esc(cs.f.label)}${state.year && cs.f.time ? `, ${state.year}` : ""}</span></div><div class="lrow"><span class="num">${fmtShort(cs.f, cs.ext[0])}</span><span class="ramp" style="background:linear-gradient(90deg, ${cs.lo}, ${cs.hi})"></span><span class="num">${fmtShort(cs.f, cs.ext[1])}</span></div>`;
    } else if (act.length) {
      h += `<div class="lrow"><span class="sw" style="background:var(--match)"></span>Matches every filter</div>`;
    }
    const anyShade = [...lastEval.groups.values()].some((g) => g.length <= NEAR_MAP);
    if (anyShade) h += `<div class="lrow"><span class="sw hatch"></span>Near miss: fails just one filter</div>`;
    if (showCities()) h += `<div class="lrow"><span class="sw city"></span>City, sized by population<span class="sw city cap"></span>Capital</div>`;
    el.innerHTML = h;
  }

  // ---------- Starter card and question of the day ----------
  const puzzles = window.PUZZLES.map((p) => ({ ...p, n: countFor(p.filters) })).filter((p) => p.n >= 1 && p.n <= 8);
  // the countries (not territories) that pass a set of preset filters, including city filters
  function matchList(presets) {
    const fls = presets.map((p) => makeFilter(p.key, p));
    const cf = fls.filter(isCity), nf = fls.filter((fl) => !isCity(fl));
    return rows.filter((r) => r.sovereign && nf.every((fl) => passes(r, fl)) &&
      (!cf.length || cities.some((c) => c.iso3 === r.iso3 && cf.every((fl) => passes(c, fl)))));
  }
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
    if (window.WQ) return window.WQ.renderCard(el);
    el.hidden = !!state.filters.length || state.starterHidden || !!state.flow;
    if (el.hidden) return;
    const pz = todaysPuzzle();
    el.innerHTML = `
      <button class="iconbtn hide" type="button" aria-label="Hide">×</button>
      <h2>Ask the map a question</h2>
      <p>Browse the themes or search above, or start from one of these.</p>
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
      : `</p><p class="info tinfo">${CLOCK} <span><b>Yearly data from ${timeFrom(f.key)}.</b> Use the year slider under the map to see this filter in earlier years.</span>`;
    const keepSearch = el.querySelector(".optsearch")?.value || "";
    const scroll = el.querySelector(".opts")?.scrollTop || 0;
    el.hidden = false;
    el.dataset.g = gslug(f.group);
    const fam = famOf[fl.key];
    el.innerHTML = `<div class="eyebrow">${esc(f.group)}${fam ? ` · ${esc(fam.label)}` : ""}</div><header><h3>${esc(f.label)}</h3><button type="button" class="iconbtn" id="edClose" aria-label="Close">×</button></header>
      <p class="info">${esc(f.info)} <br>Source: <a href="${src.url}" target="_blank" rel="noopener">${esc(src.name)}</a>${year ? `, ${year}` : ""}.${timeNote}</p>
      ${famPicker(fl)}
      ${f.modes ? `<div class="seg modes" role="group" aria-label="Match">
        ${[["any", "Any of these"], ["all", "All of these"], ["none", "None of these"]].map(([m, t]) => `<button type="button" data-mode="${m}" class="${(fl.mode || "any") === m ? "on" : ""}">${t}</button>`).join("")}</div>` : ""}
      <div id="edBody"></div>
      <button type="button" class="remove" id="edRemove">Remove this filter</button>`;
    el.querySelectorAll(".modes button").forEach((b) => (b.onclick = () => { fl.mode = b.dataset.mode; render(); }));
    el.querySelectorAll(".fampick button").forEach((b) => (b.onclick = () => switchVariant(fl, b.dataset.key)));
    $("#edClose").onclick = () => { state.open = null; render(); };
    $("#edRemove").onclick = () => removeFilter(fl.key);
    const body = $("#edBody");
    if (f.type === "range") rangeEditor(body, f, fl);
    else if (f.type === "bool") boolEditor(body, f, fl);
    else optionEditor(body, f, fl, keepSearch, scroll);
  }

  // Picker for switching between the measures in a family
  function famPicker(fl) {
    const fam = famOf[fl.key];
    if (!fam || fam.variants.length < 2) return "";
    const taken = new Set(state.filters.map((x) => x.key));
    return `<div class="fampick" role="group" aria-label="Choose a measure">${fam.variants.map(([k, lab]) =>
      `<button type="button" data-key="${k}" class="${k === fl.key ? "on" : ""}" ${k !== fl.key && taken.has(k) ? "disabled title=\"Already added\"" : ""}>${F[k].time ? CLOCK : ""}${esc(lab)}</button>`).join("")}</div>`;
  }
  function switchVariant(fl, key) {
    if (key === fl.key || state.filters.some((x) => x.key === key)) return;
    const f = F[key], old = F[fl.key];
    const nf = makeFilter(key, f.type === "multi" ? { values: fl.values.filter((v) => f.options.includes(v)), mode: fl.mode } : {});
    state.filters[state.filters.indexOf(fl)] = nf;
    if (state.colourBy === fl.key) state.colourBy = "";
    if (state.sort === fl.key) state.sort = "";
    state.open = key;
    void old;
    render();
  }

  function rangeEditor(body, f, fl) {
    const T0 = f.toT(f.dmin), T1 = f.toT(f.dmax);
    const vals = (f.target ? itemsFor(f) : pool()).map((r) => r[f.key]).filter((v) => typeof v === "number" && (f.scale !== "log" || v > 0));
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
    const cnt = isFeat({ key: f.key }) ? (v) => featCount(f, (x) => x === v)
      : f.target === "city"
      ? (v) => cities.filter((c) => { const e = lastEval.res.get(c.iso3); return e && e.match && c[f.key] === v && cityActive().every((x) => x.key === f.key || passes(c, x)); }).length
      : (v) => pool().filter((r) => r[f.key] === v && othersPass(r, f.key)).length;
    body.innerHTML = `<div class="seg" role="group">
      <button type="button" data-v="1" class="${fl.value ? "on" : ""}">${esc(f.yes)}<small>${cnt(true)}</small></button>
      <button type="button" data-v="0" class="${fl.value ? "" : "on"}">${esc(f.no)}<small>${cnt(false)}</small></button></div>`;
    body.querySelectorAll("button").forEach((b) => (b.onclick = () => { fl.value = b.dataset.v === "1"; render(); }));
  }

  // how many features of this kind would match with this filter set to a value (the other filters kept)
  function featCount(f, test) {
    const others = state.filters.filter((x) => x.key !== f.key && F[x.key].target === f.target && isActive(x));
    const { act, res } = lastEval;
    return itemsFor(f).filter((it) => (!act.length || !it.iso || it.iso.some((i) => res.get(i)?.match)) && others.every((x) => passes(it, x)) && test(it[f.key])).length;
  }
  function optionEditor(body, f, fl, keepSearch, scroll) {
    const counts = new Map(f.options.map((o) => [o, 0]));
    if (isFeat({ key: f.key })) {
      for (const o of f.options) counts.set(o, featCount(f, (v) => (Array.isArray(v) ? v.includes(o) : v === o)));
    } else for (const r of pool()) {
      if (!othersPass(r, f.key)) continue;
      const v = r[f.key];
      (Array.isArray(v) ? v : [v]).forEach((x) => counts.has(x) && counts.set(x, counts.get(x) + 1));
    }
    let opts = [...f.options];
    if (f.type === "multi") opts.sort((a, b) => (fl.values.includes(b) - fl.values.includes(a)) || (counts.get(b) - counts.get(a)) || a.localeCompare(b));
    const searchable = opts.length > 12;
    body.innerHTML = `${searchable ? `<input class="optsearch" id="optSearch" type="search" placeholder="Search ${opts.length} options" value="${esc(keepSearch)}">` : ""}
      <div class="opts" role="group" aria-label="${esc(f.label)}"></div>
      ${f.type === "multi" && !f.target ? `<p class="info">Countries match if they have <b>any</b> of the ticked options.</p>` : ""}`;
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
    const ft = window.WP ? window.WP.tabs(lastEval) : [];
    if (!showCities() && !ft.length) return "";
    const t = state.tab;
    const tab = (id, label, k) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${t === id}" class="${t === id ? "on" : ""}">${label} <span class="num">${k.toLocaleString()}</span></button>`;
    return `<div class="tabs" role="tablist">${tab("countries", "Countries", n)}${showCities() ? tab("cities", "Cities", lastEval.cityList.length) : ""}${ft.map((x) => tab("feat:" + x.t, x.label, x.n)).join("")}</div>`;
  }
  // a list of physical features, or one feature's profile
  function renderFeatResults(matches) {
    const el = $("#results");
    const t = state.tab.slice(5);
    const list = lastEval.feat.get(t) || [];
    if (state.feat && state.feat.t === t) {
      el.innerHTML = window.WP.detailHTML(`${t}:${state.feat.i}`) + footHTML();
      $("#fback").onclick = () => { state.feat = null; render(); };
      $("#fzoom").onclick = () => zoomTo(window.WP.bounds(window.WP.byRef(`${t}:${state.feat.i}`)));
      el.querySelectorAll(".goto").forEach((b) => (b.onclick = () => { state.feat = null; state.tab = "countries"; state.selected = b.dataset.iso; render(); }));
      bindCommon(el);
      return;
    }
    const scrollTop = el.querySelector(".rlist")?.scrollTop || 0;
    el.innerHTML = `<div class="rhead">${tabsHTML(matches.length)}</div>${window.WP.listHTML(t, list, state)}${footHTML()}`;
    el.querySelector(".rlist") && (el.querySelector(".rlist").scrollTop = scrollTop);
    bindCommon(el);
    el.querySelectorAll(".frow").forEach((b) => (b.onclick = () => { const [ft, fi] = b.dataset.ref.split(":"); state.feat = { t: ft, i: +fi }; render(); }));
  }
  function zoomTo(b) {
    if (!b) return;
    const [[x0, y0], [x1, y1]] = b;
    const vb = svg.attr("viewBox").split(" ").map(Number);
    const kk = Math.max(1, Math.min(14, 0.8 / Math.max((x1 - x0) / vb[2], (y1 - y0) / vb[3])));
    const tx = vb[2] / 2 - kk * (x0 + x1) / 2, ty = vb[3] / 2 - kk * (y0 + y1) / 2;
    svg.transition().duration(600).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(kk));
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
  // Sort buttons, like a spreadsheet: A–Z sorts by name, the arrow flips the order
  function sortDirFor(isNumber) { return state.sortDir || (isNumber ? "desc" : "asc"); }
  function sortButtons(isNumber, dir) {
    const az = !isNumber;
    return `<button type="button" class="sbtn${az ? " on" : ""}" id="sortAZ" title="${az && dir === "asc" ? "Sort Z to A" : "Sort by name, A to Z"}" aria-label="Sort by name">${az && dir === "desc" ? "Z–A" : "A–Z"}</button>
      <button type="button" class="sbtn" id="sortDir" title="${dir === "desc" ? (isNumber ? "Highest first: click for lowest first" : "Z to A: click for A to Z") : (isNumber ? "Lowest first: click for highest first" : "A to Z: click for Z to A")}" aria-label="Reverse the order">${dir === "desc" ? "↓" : "↑"}</button>`;
  }
  function bindSortButtons() {
    const az = $("#sortAZ"), dr = $("#sortDir");
    if (az) az.onclick = () => {
      const byName = state.sort === "__name" || (state.tab === "cities" ? state.citySort === "name" : false);
      if (state.tab === "cities" && showCities()) { state.sortDir = state.citySort === "name" && sortDirFor(false) === "asc" ? "desc" : "asc"; state.citySort = "name"; }
      else { state.sortDir = byName && sortDirFor(false) === "asc" ? "desc" : "asc"; state.sort = "__name"; }
      render();
    };
    if (dr) dr.onclick = () => {
      const isNum = state.tab === "cities" && showCities() ? state.citySort !== "name" : !!F[$("#sortSel")?.value];
      state.sortDir = sortDirFor(isNum) === "desc" ? "asc" : "desc";
      render();
    };
  }
  function renderCityResults(matches) {
    const el = $("#results");
    const byName = state.citySort === "name";
    const dir = sortDirFor(!byName);
    const list = [...lastEval.cityList].sort(byName
      ? (a, b) => (dir === "desc" ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name))
      : (a, b) => (dir === "desc" ? b.city_population - a.city_population : a.city_population - b.city_population));
    const scrollTop = el.querySelector(".rlist")?.scrollTop || 0;
    el.innerHTML = `
      <div class="rhead">${tabsHTML(matches.length)}
        <div class="count"><span class="n num">${list.length.toLocaleString()}</span><span class="of">${list.length === 1 ? "city matches" : "cities match"}</span></div>
        <div class="controls"><span class="sortctl"><span>Sort</span>${sortButtons(!byName, dir)}
          <button type="button" class="sbtn${byName ? "" : " on"}" id="sortPop">Population</button></span></div>
        <p class="note">Population of the city itself, not its suburbs. Ringed dots are capitals.</p>
      </div>
      <div class="rlist">
        ${list.slice(0, 300).map((c) => {
          const r = byIso.get(c.iso3);
          return `<button type="button" class="row" data-iso="${c.iso3}" data-city="${c.id}"><span class="fl">${r?.flag || ""}</span><span class="nm">${esc(c.name)}${c.city_capital ? ` <span class="tag">capital</span>` : ""}<small>${esc(r?.name || "")}</small></span><span class="val num">${compact(c.city_population)}</span></button>`;
        }).join("") || `<p class="empty">No cities match. Try a lower population, or loosen the country filters.</p>`}
        ${list.length > 300 ? `<p class="empty">Showing the first 300 of ${list.length.toLocaleString()}.</p>` : ""}
      </div>${footHTML()}`;
    el.querySelector(".rlist").scrollTop = scrollTop;
    bindCommon(el);
    bindSortButtons();
    $("#sortPop").onclick = () => { state.citySort = "pop"; state.sortDir = null; render(); };
    el.querySelectorAll(".row").forEach((b) => {
      b.onclick = () => { state.selected = b.dataset.iso; state.open = null; render(); };
      b.onmouseenter = () => gCities.selectAll("circle").filter((d) => d.id === +b.dataset.city).classed("hover", true).raise();
      b.onmouseleave = () => gCities.selectAll("circle").classed("hover", false);
    });
  }

  function renderResults(matches, act, res) {
    if (showCities() && state.tab === "cities") return renderCityResults(matches);
    if (state.tab.startsWith("feat:") && lastEval.feat.has(state.tab.slice(5))) return renderFeatResults(matches);
    if (state.tab.startsWith("feat:")) state.tab = "countries";
    const el = $("#results");
    const rangeAct = act.map((fl) => F[fl.key]).filter((f) => f.type === "range");
    const sortKey = state.sort || colourKey() || rangeAct[0]?.key || "__name";
    const sf = F[sortKey] || null;
    const dir = sortDirFor(!!sf);
    const list = [...matches];
    if (sf) list.sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey];
      if (va == null || vb == null) return (va == null) - (vb == null); // no data goes last
      return dir === "desc" ? vb - va : va - vb;
    });
    else list.sort((a, b) => (dir === "desc" ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)));
    const valF = sf || (colourKey() ? F[colourKey()] : rangeAct[0]) || null;
    const groups = [...lastEval.groups.entries()].sort((a, b) => a[1].length - b[1].length);
    const total = pool().length;
    const noun = state.territories ? "places" : "countries";
    const scrollTop = el.querySelector(".rlist")?.scrollTop || 0;

    el.innerHTML = `
      <div class="rhead">${tabsHTML(matches.length)}
        <div class="count"><span class="n num">${matches.length}</span><span class="of">of ${total} ${noun} match</span></div>
        <div class="controls">
          <label><input type="checkbox" id="terr" ${state.territories ? "checked" : ""}> Include territories</label>
          <span class="sortctl"><label for="sortSel">Sort</label>
            ${sortButtons(!!sf, dir)}
            <select id="sortSel" aria-label="Sort by"><option value="__name">Name</option>
            ${groupedOptions(sortKey)}</select></span>
          <label>Shade by <select id="colSel"><option value="">Automatic</option><option value="none" ${state.colourBy === "none" ? "selected" : ""}>Single colour</option>
            ${groupedOptions(state.colourBy)}</select></label>
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
    $("#sortSel").onchange = (e) => { state.sort = e.target.value; state.sortDir = null; render(); };
    bindSortButtons();
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
    window.WV?.highlight(iso, on);
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
    const mg = modeGroups();
    const groups = window.FILTER_GROUPS.filter((g) => mg.has(g)).map((g) => {
      const fs = FILTERS.filter((f) => f.group === g && !f.target && !f.hidden);
      if (!fs.length) return "";
      return `<h4 data-g="${gslug(g)}">${g}</h4><dl>${fs.map((f) => `<dt>${esc(f.label)}</dt><dd>${esc(val(f))}${f.year && typeof f.year === "string" && r[f.year] ? ` <small>(${r[f.year]})</small>` : ""}</dd>`).join("")}</dl>`;
    }).join("");
    el.innerHTML = `<div class="detail">
      <button type="button" class="linkbtn back" id="back">← Back to results</button>
      <h2><span>${r.flag || ""}</span>${esc(r.name)}</h2>
      <button type="button" class="ffopen" id="ffOpen">📄 Country factfile <span>print or download</span></button>
      <p class="sub">${esc([r.capital && "Capital: " + r.capital, r.subregion].filter(Boolean).join(" · "))}${r.sovereign ? "" : " · Territory or partially recognised"}</p>
      ${badge}
      ${state.year ? `<p class="sub">Measures with yearly data show <b>${state.year}</b>; refugee routes and everything else show the latest figures.</p>` : ""}
      ${state.mode === "physical" ? (window.WP ? window.WP.profileHTML(r) : "") : window.WV ? window.WV.profileHTML(r) : ""}
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
        const nb = (r.borders_list || []);
        const nbHTML = nb.length ? `<h4 data-g="geography">Neighbours (${nb.length})</h4><p class="sub">Land borders: about ${d3.format(",")(r.border_km)} km in total.</p><dl class="nbrs">${nb.map(([iso, km]) => `<dt><button type="button" class="linkbtn goto" data-iso="${iso}">${byIso.get(iso)?.flag || ""} ${esc(byIso.get(iso)?.name || iso)}</button></dt><dd>${d3.format(",")(km)} km</dd>`).join("")}</dl>`
          : `<h4 data-g="geography">Neighbours</h4><p class="sub">No land borders.</p>`;
        const cl = r.climate_list || [];
        const climHTML = cl.length ? `<h4 data-g="climate">Climate zones</h4><dl>${cl.slice(0, 6).map(([n, p]) => `<dt>${esc(n)}</dt><dd>${p}% of land</dd>`).join("")}</dl>` : "";
        const ml = r.minerals_list || [];
        const minHTML = ml.length ? `<h4 data-g="energy-resources">Mining (share of world production, 2025)</h4><dl>${ml.map(([m, p]) => `<dt>${esc(m.charAt(0).toUpperCase() + m.slice(1))}</dt><dd>${p < 1 ? "under 1" : Math.round(p)}%</dd>`).join("")}</dl>` : "";
        return nbHTML + climHTML + minHTML + (cs.length ? `<h4>Largest cities</h4><dl>${cs.map((c) => `<dt>${esc(c.name)}${c.city_capital ? " (capital)" : ""}</dt><dd>${d3.format(",")(c.city_population)}</dd>`).join("")}</dl>` : "");
      })()}
      ${groups}
    </div>`;
    $("#back").onclick = () => { state.selected = null; render(); };
    if (state.mode !== "physical") window.WV?.bindProfile(el, r);
    $("#ffOpen").onclick = () => window.openFactfile?.(r.iso3);
    el.querySelectorAll(".goto").forEach((b) => (b.onclick = () => { state.selected = b.dataset.iso; render(); }));
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
    const extra = styleInfo && (!act.length || e?.match) ? styleInfo.tip(r) : "";
    const popLine = state.popSized && r.population ? `<span class="st">Population ${esc(compact(r.population))}</span>` : "";
    tip.innerHTML = `<strong>${r.flag || ""} ${esc(r.name)}</strong>${st}${popLine}${extra}${dl && !extra ? `<dl>${dl}</dl>` : ""}`;
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
    const fref = t.getAttribute && t.getAttribute("data-feat");
    if (fref && window.WP) { paths.classed("hover", false); tip.innerHTML = window.WP.tipHTML(fref); return placeTip(evt); }
    const cid = t.getAttribute && t.getAttribute("data-city");
    if (cid) { paths.classed("hover", false); return showCityTip(evt, cities[+cid]); }
    const bref = t.getAttribute && t.getAttribute("data-base");
    if (bref) { paths.classed("hover", false); tip.innerHTML = `<strong>${esc(bref)}</strong>`; return placeTip(evt); }
    const iso = t.getAttribute && t.getAttribute("data-iso");
    paths.classed("hover", false);
    if (iso) d3.select(t).filter("path").classed("hover", true).raise();
    showTip(evt, iso ? byIso.get(iso) : null);
  }).on("pointerleave", () => { tip.hidden = true; paths.classed("hover", false); });
  svg.on("click", (evt) => {
    const t = evt.target;
    const fref = t.getAttribute && t.getAttribute("data-feat");
    if (fref) { const [ft, fi] = fref.split(":"); state.feat = { t: ft, i: +fi }; state.selected = null; state.tab = "feat:" + ft; return render(); }
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
  function openMenu() {
    const q = input.value.trim().toLowerCase();
    if (!q) { closeMenu(); return; }
    if (openTheme) closeThemes();
    const used = new Set(state.filters.map((x) => x.key));
    items = [];
    const row = (f, label, isValue) => {
      items.push({ key: f.key, value: isValue ? label : undefined });
      const added = used.has(f.key) && !isValue;
      const fam = famOf[f.key];
      const where = isValue ? (MENU_LABELS[f.key] || f.label) : fam ? `${fam.short} · ${f.group}` : f.group;
      const right = added ? `<span class="added-tag">✓ Added</span>` : `<span class="gtag">${esc(where)}</span>`;
      return `<button type="button" role="option" class="item${added ? " added" : ""}" data-g="${gslug(f.group)}" data-i="${items.length - 1}"><span>${!isValue && f.time ? CLOCK : ""}${esc(label)}</span>${right}</button>`;
    };
    const mg = modeGroups();
    const visible = FILTERS.filter((f) => !f.hidden && mg.has(f.group));
    const fs = visible.map((f) => {
      const fam = famOf[f.key];
      // a family name also finds its measures, e.g. "HDI" finds HDI rank
      const s2 = fam ? Math.max(score(f, q), score({ label: fam.label + " " + fam.short, keywords: "", group: "" }, q) ? 1 : 0) : score(f, q);
      return { f, s: s2 };
    }).filter((x) => x.s).sort((a, b) => b.s - a.s);
    const vals = [];
    if (q.length >= 2) {
      for (const f of visible) {
        if (!f.options) continue;
        for (const o of f.options) if (o.toLowerCase().includes(q)) vals.push({ f, o, s: o.toLowerCase().startsWith(q) ? 2 : 1 });
      }
      vals.sort((a, b) => b.s - a.s || a.o.length - b.o.length);
    }
    let html = "";
    if (fs.length) html += `<h4 class="rh">Filters</h4>` + fs.slice(0, 12).map(({ f }) => row(f, f.label)).join("");
    if (vals.length) html += `<h4 class="rh">Values</h4>` + vals.slice(0, 6).map((v) => row(v.f, v.o, true)).join("");
    if (!fs.length && !vals.length) html = `<p class="info" style="padding:8px 10px;margin:0">Nothing found for “${esc(q)}”. Try a broader word, like “religion” or “money”, or browse the themes.</p>`;
    cursor = 0;
    menu.innerHTML = html;
    menu.hidden = false;
    input.setAttribute("aria-expanded", "true");
    markCursor();
    menu.querySelectorAll("button").forEach((b) => (b.onmousedown = (e) => e.preventDefault()));
    menu.querySelectorAll("button.item").forEach((b) => (b.onclick = () => choose(items[+b.dataset.i])));
  }
  function markCursor() {
    menu.querySelectorAll("button.item").forEach((b) => b.classList.toggle("on", +b.dataset.i === cursor));
    menu.querySelector("button.item.on")?.scrollIntoView({ block: "nearest" });
  }
  function closeMenu() { menu.hidden = true; input.setAttribute("aria-expanded", "false"); }
  // ---------- Browse filters: theme bar, panels, definition cards ----------
  const HUMAN_THEMES = window.THEMES || [];
  const PHYS_THEMES = window.PHYS_THEMES || [];
  const themes = () => (state.mode === "physical" ? PHYS_THEMES : HUMAN_THEMES);
  const modeGroups = () => new Set(themes().flatMap((t) => t.groups));
  const MENU_LABELS = window.MENU_LABELS || {};
  const SHOW_FIRST = 6; // filters shown per category before "More…"
  const touch = window.matchMedia("(hover: none)");
  const expanded = new Set();
  let openTheme = null;
  // One menu entry per family, or per filter that isn't in a family
  function entriesFor(group) {
    const out = [], seenFam = new Set();
    for (const f of FILTERS) {
      if (f.group !== group || f.hidden) continue;
      const fam = famOf[f.key];
      if (fam) { if (!seenFam.has(fam.id)) { seenFam.add(fam.id); out.push({ fam, id: "fam:" + fam.id }); } }
      else out.push({ f, id: f.key });
    }
    return out;
  }
  const entryById = (id) => (id.startsWith("fam:") ? { fam: FAMILIES.find((x) => "fam:" + x.id === id), id } : { f: F[id], id });
  const entryLabel = (e) => (e.fam ? e.fam.short : MENU_LABELS[e.f.key] || e.f.label);
  const entryTime = (e) => (e.fam ? e.fam.time : e.f.time);
  const entryAdded = (e) => (e.fam ? e.fam.variants.some(([k]) => state.filters.some((x) => x.key === k)) : state.filters.some((x) => x.key === e.f.key));
  function addEntry(e) {
    let key = e.f?.key;
    if (e.fam) {
      const free = e.fam.variants.find(([k]) => !state.filters.some((x) => x.key === k));
      key = (free || e.fam.variants[0])[0];
    }
    closeThemes();
    choose({ key });
  }
  function renderThemeBar() {
    const nav = $("#themes");
    const TH = themes();
    nav.innerHTML = `<button type="button" class="browse-btn" data-theme="${TH[0].id}" aria-haspopup="dialog">Browse filters</button>` +
      TH.map((t) => `<button type="button" class="theme-btn${openTheme === t.id ? " on" : ""}" data-theme="${t.id}" aria-expanded="${openTheme === t.id}">${esc(t.label)}<span class="caret" aria-hidden="true">▾</span></button>`).join("");
    nav.querySelectorAll("button").forEach((b) => (b.onclick = (ev) => {
      ev.stopPropagation();
      if (openTheme === b.dataset.theme && b.classList.contains("theme-btn")) closeThemes(); else showTheme(b.dataset.theme);
    }));
  }
  function showTheme(id) {
    openTheme = id;
    closeMenu();
    hideCard();
    const TH = themes();
    const t = TH.find((x) => x.id === id) || TH[0];
    const panel = $("#tpanel");
    panel.hidden = false;
    panel.innerHTML = `<div class="tp-head"><div class="tp-tabs" role="tablist">${TH.map((x) => `<button type="button" role="tab" data-theme="${x.id}" aria-selected="${x.id === id}" class="${x.id === id ? "on" : ""}">${esc(x.label)}</button>`).join("")}</div>
        <button type="button" class="iconbtn tp-close" aria-label="Close">×</button></div>
      <div class="tp-body">${t.groups.map((g) => {
        const es = entriesFor(g);
        const open = expanded.has(g);
        const shown = open ? es : es.slice(0, SHOW_FIRST);
        return `<section class="gsec" data-g="${gslug(g)}"><h4>${esc(g)}</h4><div class="fchips">${shown.map((e) => {
          const added = entryAdded(e);
          return `<button type="button" class="fchip${added ? " added" : ""}" data-id="${esc(e.id)}" data-g="${gslug(g)}">${entryTime(e) ? CLOCK : ""}<span>${esc(entryLabel(e))}</span>${added ? `<span class="tick" aria-label="added">✓</span>` : ""}</button>`;
        }).join("")}${es.length > SHOW_FIRST ? `<button type="button" class="more-btn" data-g="${esc(g)}">${open ? "Fewer" : `${es.length - SHOW_FIRST} more…`}</button>` : ""}</div></section>`;
      }).join("")}</div>
      <p class="mkey">${state.mode === "physical" ? "" : `${CLOCK}<span>Has data for past years: use the year slider under the map.</span>`} <span class="mtick">✓</span><span>Added</span> <span class="mhint">${touch.matches ? "Tap a filter to see what it means." : "Hover over a filter to see what it means."}</span></p>`;
    renderThemeBar();
    panel.querySelectorAll(".tp-tabs button").forEach((b) => (b.onclick = () => showTheme(b.dataset.theme)));
    panel.querySelector(".tp-tabs button.on")?.scrollIntoView({ block: "nearest", inline: "center" });
    panel.querySelector(".tp-close").onclick = closeThemes;
    panel.querySelectorAll(".more-btn").forEach((b) => (b.onclick = () => { const g = b.dataset.g; expanded.has(g) ? expanded.delete(g) : expanded.add(g); showTheme(id); }));
    panel.querySelectorAll(".fchip").forEach((b) => {
      const e = entryById(b.dataset.id);
      b.onclick = () => {
        if (touch.matches && cardFor !== e.id) return showCard(e, b);  // first tap: explain
        addEntry(e);
      };
      b.onmouseenter = () => { if (!touch.matches) { clearTimeout(cardTimer); cardTimer = setTimeout(() => showCard(e, b), 280); } };
      b.onmouseleave = () => { clearTimeout(cardTimer); if (!touch.matches) cardTimer = setTimeout(hideCard, 120); };
      b.onfocus = () => { if (!touch.matches) showCard(e, b); };
      b.onblur = () => { if (!touch.matches) hideCard(); };
    });
  }
  function closeThemes() {
    openTheme = null;
    $("#tpanel").hidden = true;
    hideCard();
    renderThemeBar();
  }
  // Definition card: hover on desktop; first tap on phones and tablets, with an Add button
  let cardFor = null, cardTimer = 0;
  function showCard(e, anchor) {
    const card = $("#fcard");
    cardFor = e.id;
    const f = e.f, fam = e.fam;
    const g = fam ? fam.group : f.group;
    const title = fam ? fam.label : f.label;
    const info = fam ? fam.info : f.info;
    const timeKeys = fam ? fam.variants.filter(([k]) => F[k].time) : f.time ? [[f.key, f.label]] : [];
    const timeNote = timeKeys.length ? `<p class="fc-time">${CLOCK}<span>Yearly data from ${Math.min(...timeKeys.map(([k]) => timeFrom(k) || 9999))}${fam && timeKeys.length < fam.variants.length ? ` for ${timeKeys.map(([, l]) => l).join(", ")}` : ""}</span></p>` : "";
    card.dataset.g = gslug(g);
    card.innerHTML = `<div class="fc-eyebrow">${esc(g)}</div><h5>${esc(title)}</h5><p>${esc(info)}</p>
      ${fam ? `<p class="fc-vars">Choose from: ${fam.variants.map(([, l]) => esc(l)).join(" · ")}</p>` : ""}
      ${timeNote}
      ${touch.matches ? `<div class="fc-actions"><button type="button" class="fc-add">${entryAdded(e) ? "Add again" : "Add filter"}</button><button type="button" class="linkbtn fc-close">Close</button></div>` : ""}`;
    card.hidden = false;
    if (touch.matches) {
      card.querySelector(".fc-add").onclick = () => addEntry(e);
      card.querySelector(".fc-close").onclick = hideCard;
      card.classList.add("sheet");
    } else {
      card.classList.remove("sheet");
      const r = anchor.getBoundingClientRect(), cw = card.offsetWidth, ch = card.offsetHeight;
      let x = r.left, y = r.bottom + 8;
      if (x + cw > window.innerWidth - 12) x = window.innerWidth - cw - 12;
      if (y + ch > window.innerHeight - 12) y = r.top - ch - 8;
      card.style.left = Math.max(12, x) + "px"; card.style.top = Math.max(12, y) + "px";
    }
  }
  function hideCard() { cardFor = null; $("#fcard").hidden = true; }
  $("#fcard").onmouseenter = () => clearTimeout(cardTimer);
  $("#fcard").onmouseleave = () => { if (!touch.matches) hideCard(); };
  document.addEventListener("click", (ev) => {
    if (!openTheme) return;
    if (!ev.target.isConnected) return; // the panel was just redrawn under the click
    if (ev.target.closest("#tpanel, #themes, #fcard")) return;
    closeThemes();
  });
  renderThemeBar();

  // ---------- Human / physical geography switch ----------
  const filtersByMode = { human: [], physical: [] };
  function setMode(m) {
    if (m === state.mode) return;
    filtersByMode[state.mode] = state.filters;
    state.filters = filtersByMode[m] || [];
    state.mode = m;
    state.open = null; state.feat = null; state.tab = "countries"; state.colourBy = ""; state.sort = ""; state.sortDir = null;
    if (m === "physical") { state.mapStyle = "std"; state.popSized = false; if (state.view === "trends") state.view = "map"; }
    if (openTheme) closeThemes(); else renderThemeBar();
    $("#mmCard").hidden = true;
    render();
  }
  document.querySelectorAll("#modes button").forEach((b) => (b.onclick = () => setMode(b.dataset.m)));
  let modeShown = "human";
  function renderModes() {
    document.querySelectorAll("#modes button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.m === state.mode)));
    if (modeShown !== state.mode) {
      modeShown = state.mode;
      if (!openTheme) renderThemeBar();
      input.placeholder = state.mode === "physical" ? "Search: try “volcano”, “river” or “plates”" : "Search filters: try “religion”, “coast” or “HDI”";
    }
  }
  // show one physical feature: make sure its kind is on the map, open its profile and zoom to it
  function showFeature(t, i) {
    if (state.mode !== "physical") setMode("physical");
    if (!state.filters.some((x) => F[x.key].target === t)) {
      const f = FILTERS.find((x) => x.target === t);
      const fl = makeFilter(f.key);
      if (f.type === "range") { fl.min = f.dmin; fl.max = f.dmax; }
      state.filters.push(fl);
    }
    state.feat = { t, i }; state.tab = "feat:" + t; state.selected = null; state.view = "map";
    render();
    zoomTo(window.WP.bounds(window.WP.byRef(`${t}:${i}`)));
  }

  function choose(it) {
    if (!it) return;
    let fl = state.filters.find((x) => x.key === it.key);
    if (!fl) { fl = makeFilter(it.key); state.filters.push(fl); }
    if (it.value && fl.values && !fl.values.includes(it.value)) fl.values.push(it.value);
    state.open = it.key; state.selected = null;
    if (F[it.key].target === "city") state.tab = "cities";
    else if (F[it.key].target) { state.tab = "feat:" + F[it.key].target; state.feat = null; }
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
    if (e.key === "Escape" && openTheme) { closeThemes(); return; }
    if (e.key === "Escape" && state.open) { state.open = null; render(); }
    else if (e.key === "Escape" && state.flow) { state.flow = null; render(); }
    if (e.key === "Escape" && !$("#about").hidden) $("#about").hidden = true;
  });

  function removeFilter(key) {
    state.filters = state.filters.filter((x) => x.key !== key);
    if (state.open === key) state.open = null;
    if (state.colourBy === key) state.colourBy = "";
    if (!showCities() && state.tab === "cities") state.tab = "countries";
    if (state.tab.startsWith("feat:") && !state.filters.some((x) => F[x.key].target === state.tab.slice(5))) { state.tab = "countries"; state.feat = null; }
    render();
  }
  function clearAll() {
    state.filters = []; state.open = null; state.colourBy = ""; state.sort = ""; state.sortDir = null; state.tab = "countries";
    state.flow = null; state.selected = null; state.mapStyle = "std"; state.popSized = false; state.feat = null;
    stopPlay(); if (state.year) { state.year = null; applyYear(null); }
    svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
    render();
  }

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
  if ($("#aboutBtn")) $("#aboutBtn").onclick = openAbout;
  $("#mapClear").onclick = clearAll;

  // ---------- Shareable URL ----------
  function encodeState() {
    const parts = state.filters.map((fl) => {
      const f = F[fl.key];
      if (f.type === "range") return `${fl.key}:${fl.min}~${fl.max}`;
      if (f.type === "bool") return `${fl.key}:${fl.value ? 1 : 0}`;
      return `${fl.key}:${fl.values.map(encodeURIComponent).join("|")}${fl.mode && fl.mode !== "any" ? "~" + fl.mode : ""}`;
    });
    const p = new URLSearchParams();
    if (parts.length) p.set("f", parts.join(","));
    if (state.territories) p.set("t", "1");
    if (state.colourBy) p.set("c", state.colourBy);
    if (state.year) p.set("y", state.year);
    if (state.view !== "map") p.set("v", state.view);
    if (state.mode === "physical") { p.set("m", "p"); if (window.WP && window.WP.style.base !== "landforms") p.set("pb", window.WP.style.base); }
    if (state.mapStyle === "change") {
      const { key, from, to } = changeYears();
      p.set("ms", "change"); p.set("mc", key); p.set("mf", from); p.set("mt", to);
      if (state.mm.pct) p.set("mp", "1");
    } else if (state.mapStyle === "bi") { p.set("ms", "bi"); p.set("bx", state.mm.bx || "gdp_per_capita"); p.set("by", state.mm.by || "co2_per_capita"); }
    if (state.popSized) p.set("pz", "1");
    if (state.selected) p.set("s", state.selected);
    window.WV?.encode(p);
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
      else {
        const [vs, mode] = v.split("~");
        out.push(makeFilter(key, { values: vs.split("|").filter(Boolean).map(decodeURIComponent).filter((x) => f.options.includes(x)), mode: mode === "all" || mode === "none" ? mode : "any" }));
      }
    });
    const OLD = { un_crc: "Children's rights (UNCRC)", un_icc: "International Criminal Court", un_paris: "Paris Agreement", un_refugee: "Refugee Convention",
      un_cedaw: "Women's rights (CEDAW)", un_crpd: "Disability rights (CRPD)", un_npt: "Non-Proliferation Treaty (NPT)", un_tpnw: "Nuclear weapons ban", un_landmine: "Landmine ban",
      wc_men_host: "Men's World Cup", wc_women_host: "Women's World Cup", olympics_summer_host: "Summer Olympics", olympics_winter_host: "Winter Olympics", commonwealth_games_host: "Commonwealth Games",
      wto_member: "World Trade Organization" };
    state.filters = out.map((fl) => {
      if (!OLD[fl.key]) return fl;
      const key = fl.key === "wto_member" ? "groups" : fl.key.startsWith("un_") ? "treaties_joined" : "events_hosted";
      return makeFilter(key, { values: [OLD[fl.key]], mode: fl.value ? "any" : "none" });
    });
    if (out.some(isCity) && !out.some((fl) => !isCity(fl))) state.tab = "cities";
    state.territories = p.get("t") === "1";
    state.colourBy = F[p.get("c")] ? p.get("c") : "";
    if (["compare", "rank", "trends"].includes(p.get("v"))) state.view = p.get("v");
    if (p.get("m") === "p") { state.mode = "physical"; if (window.WP && ["biomes", "climate", "plates", "none"].includes(p.get("pb"))) window.WP.style.base = p.get("pb"); }
    if (p.get("ms") === "change" && F[p.get("mc")]) {
      state.mapStyle = "change"; state.mm.ck = p.get("mc"); state.mm.from = +p.get("mf") || null; state.mm.to = +p.get("mt") || null; state.mm.pct = p.get("mp") === "1";
    } else if (p.get("ms") === "bi") {
      state.mapStyle = "bi"; state.mm.bx = F[p.get("bx")] ? p.get("bx") : ""; state.mm.by = F[p.get("by")] ? p.get("by") : "";
    }
    state.popSized = p.get("pz") === "1";
    if (byIso.has(p.get("s"))) state.selected = p.get("s");
    window.WV?.decode(p);
    const y = +p.get("y");
    if (y && TS_YEARS.includes(y)) { state.year = y; applyYear(y); }  // clamped to the filters' years on first render
  }
  function saveURL() {
    try {
      const q = encodeState();
      history.replaceState(null, "", location.pathname + (q ? "?" + q : ""));
    } catch (e) { /* sandboxed frames may refuse */ }
  }
  try { decodeState(location.search); } catch (e) { /* ignore */ }

  // ---------- Shared with factfile.js ----------
  window.WC = {
    F, FILTERS, rows, byIso, geo, topo, cities, flows, state, famOf, esc, gslug, fmt, fmtShort, fmtFull, yearLabel, timeFrom, UNITS,
    applyYear, CLOCK, compact, TS, TS_YEARS, tsValue, span, CAT_TS, NO_LOOKBACK, numericFilters, yearlyNumeric, measureOptions, fmtChange, cssVar,
    pool, isActive, passes, chipLabel, matchList, setMode, itemsFor, showFeature, applyPreset: (p) => { if (state.view !== "map") state.view = "map"; applyPreset(p); },
    get lastEval() { return lastEval; }, get styleInfo() { return styleInfo; },
    render: (o) => render(o), setView, select: (iso) => { state.selected = iso; state.open = null; render(); }, highlightMap: (iso, on) => highlight(iso, on),
    mapSVG: () => svg.node(), clearAll: () => clearAll(),
    resultsCSV: () => {
      const { act, res } = lastEval;
      const list = pool().filter((r) => res.get(r.iso3).match).sort((a, b) => a.name.localeCompare(b.name));
      const keys = [...new Set(act.map((fl) => fl.key).concat(colourKey() ? [colourKey()] : []))];
      const cell = (r, k) => { const v = r[k]; return Array.isArray(v) ? v.join("; ") : typeof v === "boolean" ? (v ? "Yes" : "No") : v ?? ""; };
      return [["Country", "Continent", ...keys.map((k) => F[k].label + (state.year && F[k].time ? ` (${state.year})` : ""))],
        ...list.map((r) => [r.name, r.region, ...keys.map((k) => cell(r, k))])];
    },
    latest: (r, key) => (r._latest && key in r._latest ? r._latest[key] : r[key]),
    latestYear: (r, f) => {
      if (typeof f.year === "string") return r._latest && f.year in r._latest ? r._latest[f.year] : r[f.year];
      return f.yearText || f.year || "";
    },
  };
  $("#ffBtn")?.addEventListener("click", () => window.openFactfile?.(state.selected));
  window.WV?.init();
  window.WQ?.init();

  // ---------- Go ----------
  new ResizeObserver(() => layout()).observe($("#mapwrap"));
  layout();
  render();
})();
