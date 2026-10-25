/* Which Countries? — the quiz in the "Ask the map a question" card.
 * Questions are generated from the site's own data, so there are thousands of them and they stay
 * up to date when the data is rebuilt. Each one can be answered by typing a guess, or by asking for
 * options (one right, two plausible, one clearly wrong). Questions already seen in this browser are
 * remembered so they don't come up again.
 * Loaded before app.js; it waits for window.WC (set up by app.js). */
(function () {
  "use strict";
  let W, F, esc, built = false, bank = null;
  const $ = (s, el = document) => el.querySelector(s);

  // ---------- Remembered in this browser only ----------
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const seen = new Set(store.get("wcq-seen", []));
  const score = Object.assign({ right: 0, asked: 0, streak: 0, best: 0 }, store.get("wcq-score", {}));
  const Q = { topics: Object.assign({ human: "any", physical: "p-any" }, store.get("wcq-topics", {})), cur: null, mc: false, picked: null, done: false, mode: "open", prevFilters: false };

  // ---------- Topics (colours match the filter categories) ----------
  const TOPICS = [
    { id: "any", label: "Surprise me", g: "" },
    { id: "lang", label: "Languages", g: "culture" },
    { id: "religion", label: "Religion", g: "culture" },
    { id: "pop", label: "Population", g: "population" },
    { id: "cities", label: "Capitals & cities", g: "cities" },
    { id: "geo", label: "Borders & geography", g: "geography" },
    { id: "wealth", label: "Wealth & inequality", g: "development" },
    { id: "health", label: "Health", g: "health" },
    { id: "gender", label: "Gender", g: "gender" },
    { id: "politics", label: "Politics & the UN", g: "politics" },
    { id: "climate", label: "Climate & energy", g: "climate" },
    { id: "trade", label: "Money, trade & tourism", g: "trade" },
    { id: "tech", label: "Technology", g: "technology" },
    { id: "sport", label: "Sport", g: "sport" },
    { id: "refugees", label: "Refugees & migration", g: "refugees" },
  ];
  const TOPICS_P = [
    { id: "p-any", label: "Surprise me", g: "" },
    { id: "p-mtn", label: "Mountains", g: "mountains-relief" },
    { id: "p-water", label: "Rivers & lakes", g: "rivers-lakes" },
    { id: "p-volc", label: "Volcanoes", g: "volcanoes" },
    { id: "p-quake", label: "Earthquakes", g: "earthquakes" },
    { id: "p-plate", label: "Plates", g: "plates" },
    { id: "p-land", label: "Deserts & landforms", g: "landforms" },
    { id: "p-coast", label: "Coasts, oceans & ice", g: "coasts-oceans" },
    { id: "p-bio", label: "Climate & biomes", g: "biomes" },
    { id: "p-haz", label: "Hazards", g: "hazards" },
  ];
  const isPhys = () => W?.state.mode === "physical";
  const topicsNow = () => (isPhys() ? TOPICS_P : TOPICS);
  const curTopic = () => Q.topics[isPhys() ? "physical" : "human"];
  const topicOf = (id) => TOPICS.concat(TOPICS_P).find((t) => t.id === id) || topicsNow()[0];
  // is a question in the current mode and topic?
  const inTopic = (q, topic) => (isPhys() ? q.topic.startsWith("p-") && (topic === "p-any" || q.topic === topic) : !q.topic.startsWith("p-") && (topic === "any" || q.topic === topic));

  // ---------- Text helpers ----------
  const NUMWORDS = { zero: 0, none: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20 };
  const norm = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/&/g, " and ").replace(/\bst\b\.?/g, "saint").replace(/[^a-z0-9 ]+/g, " ").replace(/\bthe\b/g, " ").replace(/\s+/g, " ").trim();
  function lev(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m || !n) return m || n;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  const slack = (s) => (s.length >= 9 ? 2 : s.length >= 5 ? 1 : 0);
  const close = (guess, target) => { const g = norm(guess), t = norm(target); return !!g && (g === t || lev(g, t) <= slack(t)); };
  function parseNumber(s) {
    s = String(s).toLowerCase().replace(/,/g, "").trim();
    if (s in NUMWORDS) return NUMWORDS[s];
    const m = s.match(/-?\d+(\.\d+)?/);
    if (!m) return null;
    let v = parseFloat(m[0]);
    const rest = s.slice(m.index + m[0].length).trim();
    if (/^(bn|billion|b\b)/.test(rest)) v *= 1e9;
    else if (/^(m\b|mn|million|mil)/.test(rest)) v *= 1e6;
    else if (/^(k\b|thousand)/.test(rest)) v *= 1e3;
    return v;
  }
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const lowerFirst = (s) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
  const listText = (a, max = 8) => (a.length <= max ? a.join(", ") : a.slice(0, max).join(", ") + ` and ${a.length - max} more`);
  const n2 = (v) => d3.format(",")(v);

  // ---------- Country names people might type ----------
  const EXTRA_NAMES = {
    USA: ["America", "US", "United States"], GBR: ["Britain", "Great Britain", "UK"], CIV: ["Ivory Coast"], COD: ["DR Congo", "Congo Kinshasa", "DRC"],
    COG: ["Congo Brazzaville", "Republic of the Congo"], MMR: ["Burma"], SWZ: ["Swaziland"], CZE: ["Czech Republic"], TUR: ["Turkey"], CPV: ["Cape Verde"],
    TLS: ["East Timor"], MKD: ["Macedonia"], PRK: ["North Korea"], KOR: ["South Korea", "Korea"], ARE: ["UAE", "Emirates"], NLD: ["Holland"],
    VAT: ["Vatican", "Holy See"], PSE: ["Palestine"], RUS: ["Russia"], IRN: ["Iran"], SYR: ["Syria"], LAO: ["Laos"], VNM: ["Vietnam"], BOL: ["Bolivia"],
    TZA: ["Tanzania"], VEN: ["Venezuela"], FSM: ["Micronesia"], MDA: ["Moldova"], BRN: ["Brunei"], CAF: ["CAR"], BIH: ["Bosnia"], TTO: ["Trinidad"],
  };
  let nameIndex = null;
  function countryIndex() {
    if (nameIndex) return nameIndex;
    nameIndex = new Map();
    for (const r of W.rows) {
      const names = [r.name].concat(r.aliases || [], EXTRA_NAMES[r.iso3] || []);
      for (const n of names) { const k = norm(n); if (k && !nameIndex.has(k)) nameIndex.set(k, r.iso3); }
    }
    return nameIndex;
  }
  function resolveCountry(text) {
    const k = norm(text);
    if (!k) return null;
    const idx = countryIndex();
    if (idx.has(k)) return idx.get(k);
    let best = null, bd = 99;
    for (const [name, iso] of idx) {
      if (name.length < 4) continue;
      const d = lev(k, name);
      if (d < bd && d <= slack(name)) { bd = d; best = iso; }
    }
    return best;
  }

  // ---------- Data helpers ----------
  let sov, big;
  const val = (r, key) => { const v = W.latest(r, key); return v; };
  const num = (r, key) => { const v = val(r, key); return typeof v === "number" && Number.isFinite(v) ? v : null; };
  const name = (iso) => W.byIso.get(iso)?.name || "";
  // names that read better with "the" in a sentence
  const THE = new Set(["USA", "GBR", "NLD", "PHL", "BHS", "GMB", "CAF", "DOM", "ARE", "SLB", "MHL", "MDV", "COM", "SYC", "COD", "COG", "VAT"]);
  const cn = (r) => (THE.has(r.iso3) ? "the " : "") + r.name;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const yearOf = (r, f) => { const y = W.latestYear(r, f); return y ? ` (${y})` : ""; };
  const withData = (key, list = sov) => list.filter((r) => num(r, key) != null);
  function ranked(key, dir = "hi", list = sov) {
    return withData(key, list).sort((a, b) => (dir === "hi" ? num(b, key) - num(a, key) : num(a, key) - num(b, key)));
  }
  function rankOf(key, r) {
    const list = ranked(key);
    const i = list.findIndex((x) => x.iso3 === r.iso3);
    return i < 0 ? null : { rank: i + 1, n: list.length, median: d3.median(list, (x) => num(x, key)) };
  }
  const ordinal = (n) => n + (["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");
  const near = (r, list = sov) => {
    const sub = shuffle(list.filter((x) => x !== r && x.subregion === r.subregion));
    const reg = shuffle(list.filter((x) => x !== r && x.region === r.region && x.subregion !== r.subregion));
    return sub.concat(reg);
  };
  const far = (r, list = big) => shuffle(list.filter((x) => x.region !== r.region));

  // ---------- Option builders ----------
  // numbers: one right, two plausible (about 25–60% off), one clearly wrong (from the other end of the range)
  function numberOptions(q) {
    const { v, f, int, key } = q.ans;
    if (q.ans.year) {
      const up = Math.min(2026, v + 3 + Math.floor(Math.random() * 4));
      const ys = [v, up > v ? up : v - 2, v - 5 - Math.floor(Math.random() * 6), v - 60 - Math.floor(Math.random() * 40)];
      return shuffle(ys.map((y, i) => ({ label: String(y), ok: i === 0 })));
    }
    const show = (x) => (q.ans.show ? q.ans.show(x) : f ? W.fmt(f, x) : n2(x));
    const rnd = (x) => {
      if (int) return Math.max(0, Math.round(x));
      if (f && ["pct", "years", "per1000", "per1000birth", "per1000women", "int", "count"].includes(f.format)) return Math.round(x * (Math.abs(x) < 10 ? 10 : 1)) / (Math.abs(x) < 10 ? 10 : 1);
      const p = Math.pow(10, Math.floor(Math.log10(Math.abs(x) || 1)) - 1);
      return Math.round(x / p) * p;
    };
    const capPct = (x) => (f && f.format === "pct" && !key?.includes("growth") ? Math.min(100, Math.max(0, x)) : x);
    const labels = new Map([[show(v), true]]);
    const add = (x) => { const s = show(capPct(rnd(x))); if (!labels.has(s)) { labels.set(s, false); return true; } return false; };
    // clearly wrong
    let wrong;
    if (int) wrong = v <= 20 ? v * 4 + 12 : Math.round(v / 4);
    else if (key) {
      const vs = withData(key).map((r) => num(r, key)).sort(d3.ascending);
      const lo = d3.quantileSorted(vs, 0.04), hi = d3.quantileSorted(vs, 0.96), med = d3.median(vs);
      wrong = v >= med ? lo : hi;
      if (Math.abs(wrong - v) < Math.abs(v) * 0.6 + 1e-9) wrong = v >= med ? vs[0] : vs[vs.length - 1];
    } else wrong = v * 4;
    add(wrong);
    const steps = shuffle([0.62, 0.75, 1.3, 1.5, 0.55, 1.7]);
    const sign = int ? shuffle([-1, 1, -1, 1]) : null;
    for (let i = 0; labels.size < 4 && i < 30; i++) {
      if (int) { const d = Math.max(1, Math.round(v * (0.15 + 0.1 * (i % 3)))) * (sign[i % 4]) * (1 + Math.floor(i / 4)); add(v + d); }
      else add(v * steps[i % steps.length] * (1 + Math.floor(i / 6) * 0.15));
    }
    return shuffle([...labels].map(([label, ok]) => ({ label, ok })));
  }
  // text answers (languages, religions, capitals…): right one, two from nearby countries, one from far away
  function textOptions(correct, plausible, wrong) {
    const out = [{ label: correct, ok: true }];
    const used = new Set([norm(correct)]);
    for (const p of plausible) { if (out.length >= 3) break; if (p && !used.has(norm(p))) { used.add(norm(p)); out.push({ label: p, ok: false }); } }
    for (const p of wrong) { if (out.length >= 4) break; if (p && !used.has(norm(p))) { used.add(norm(p)); out.push({ label: p, ok: false }); } }
    for (const p of plausible) { if (out.length >= 4) break; if (p && !used.has(norm(p))) { used.add(norm(p)); out.push({ label: p, ok: false }); } }
    return shuffle(out);
  }
  function countryOptions(correctIso, plausible, wrong) {
    return textOptions(name(correctIso), plausible.map((r) => r.name), wrong.map((r) => r.name)).map((o) => ({ ...o, iso: o.ok ? correctIso : null }));
  }

  // ---------- Question bank ----------
  // Each entry: { id, topic, make() } — make() builds the full question only when it is asked.
  function addQ(list, id, topic, make) { list.push({ id, topic, make }); }
  const preset = (filters) => ({ label: "Show them on the map", run: () => { minimise(); W.applyPreset(filters); } });
  const showCountry = (iso, extra) => ({ label: `Show ${name(iso)} on the map`, run: () => { minimise(); W.setView("map"); W.select(iso); } , extra });
  const showRank = (key, iso) => ({ label: "See the full ranking", run: () => { minimise(); window.WV?.showRank(key, iso); } });
  const fmtv = (key, v) => W.fmt(F[key], v);

  // How each measure is talked about in questions
  const M = {
    population: { hi: "the most people", lo: "the fewest people", of: (c) => `Roughly how many people live in ${c}?`, tol: { rel: 0.15 }, minPop: 5e6 },
    density: { hi: "the most people per square kilometre", lo: "the fewest people per square kilometre" },
    fertility: { hi: "the highest fertility rate (children per woman)", lo: "the lowest fertility rate (children per woman)", of: (c) => `On average, how many children does a woman in ${c} have?`, tol: { abs: 0.3 } },
    median_age: { hi: "the oldest population (highest median age)", lo: "the youngest population (lowest median age)", of: (c) => `What is the median age in ${c}?`, tol: { abs: 3 } },
    urban_pct: { hi: "the highest share of people living in towns and cities", lo: "the lowest share of people living in towns and cities", of: (c) => `What percentage of people in ${c} live in towns and cities?`, tol: { abs: 7 } },
    pop_growth: { hi: "the fastest-growing population", lo: "the fastest-shrinking population" },
    life_expectancy: { hi: "the highest life expectancy", lo: "the lowest life expectancy", of: (c) => `What is life expectancy in ${c}?`, tol: { abs: 3 } },
    infant_mortality: { hi: "the most babies dying before their first birthday (per 1,000 born)", lo: "the fewest babies dying before their first birthday (per 1,000 born)", of: (c) => `Out of every 1,000 babies born in ${c}, how many die before their first birthday?`, tol: { rel: 0.25, abs: 2 } },
    health_spend: { hi: "the highest health spending (as a share of its economy)" },
    gdp_per_capita: { hi: "the highest GDP per person", lo: "the lowest GDP per person", of: (c) => `What is the GDP per person in ${c} (in US$)?`, tol: { rel: 0.2 } },
    gni_ppp: { hi: "the highest income per person (adjusted for prices)", lo: "the lowest income per person (adjusted for prices)" },
    gini: { hi: "the most unequal incomes (highest Gini coefficient)", lo: "the most equal incomes (lowest Gini coefficient)", of: (c) => `What is the Gini coefficient (income inequality, 0–100) of ${c}?`, tol: { abs: 3 } },
    hdi: { hi: "the highest Human Development Index", lo: "the lowest Human Development Index", of: (c) => `What is the Human Development Index (0 to 1) of ${c}?`, tol: { abs: 0.03 } },
    extreme_poverty: { hi: "the largest share of people in extreme poverty", of: (c) => `What percentage of people in ${c} live in extreme poverty (under $3 a day)?`, tol: { abs: 5 } },
    literacy: { lo: "the lowest adult literacy rate" },
    mean_schooling: { hi: "the most years of schooling for adults", lo: "the fewest years of schooling for adults" },
    women_parliament: { hi: "the highest share of women in parliament", lo: "the lowest share of women in parliament", of: (c) => `What percentage of members of parliament in ${c} are women?`, tol: { abs: 5 } },
    female_labour: { hi: "the highest share of women in work", lo: "the lowest share of women in work" },
    gii: { hi: "the most gender inequality (Gender Inequality Index)", lo: "the least gender inequality (Gender Inequality Index)" },
    adolescent_births: { hi: "the highest teenage birth rate" },
    maternal_mortality: { hi: "the highest rate of mothers dying in childbirth" },
    libdem: { hi: "the highest democracy score (V-Dem)", lo: "the lowest democracy score (V-Dem)" },
    military_spend_usd: { hi: "the highest military spending in dollars" },
    military_spend_pct: { hi: "the highest military spending as a share of its economy" },
    armed_forces: { hi: "the largest armed forces" },
    area_km2: { hi: "the largest area", lo: "the smallest area", of: (c) => `Roughly how big is ${c} (in km²)?`, tol: { rel: 0.2 }, minArea: 2e5 },
    neighbours: { hi: "the most land neighbours" },
    border_km: { hi: "the longest land borders" },
    avg_temp: { hi: "the hottest average temperature", lo: "the coldest average temperature", of: (c) => `What is the average yearly temperature in ${c}?`, tol: { abs: 2 } },
    rainfall_mm: { hi: "the most rainfall", lo: "the least rainfall" },
    co2_per_capita: { hi: "the highest CO₂ emissions per person", lo: "the lowest CO₂ emissions per person", of: (c) => `How many tonnes of CO₂ does the average person in ${c} emit each year?`, tol: { rel: 0.25, abs: 0.5 } },
    co2_mt: { hi: "the largest total CO₂ emissions" },
    co2_cumulative_share: { hi: "the largest share of all CO₂ emitted since 1750" },
    renewables_elec_pct: { hi: "the highest share of electricity from renewables", lo: "the lowest share of electricity from renewables", of: (c) => `What percentage of ${c}'s electricity comes from renewables?`, tol: { abs: 8 } },
    coal_elec_pct: { hi: "the highest share of electricity from coal" },
    nuclear_elec_pct: { hi: "the highest share of electricity from nuclear power" },
    forest_pct: { hi: "the highest forest cover", lo: "the lowest forest cover", of: (c) => `What percentage of ${c} is covered by forest?`, tol: { abs: 7 } },
    oil_twh: { hi: "the most oil production" },
    gas_twh: { hi: "the most natural gas production" },
    tourists: { hi: "the most tourist arrivals" },
    tourism_receipts_pct: { hi: "the biggest share of exports from tourism" },
    exports_usd: { hi: "the biggest exports in dollars" },
    trade_pct: { hi: "the most trade compared with the size of its economy" },
    exp_fuel_pct: { hi: "the highest share of exports from fuel" },
    remittances_pct: { hi: "the most money sent home by migrants (as a share of its economy)" },
    internet: { hi: "the highest share of people online", lo: "the lowest share of people online", of: (c) => `What percentage of people in ${c} use the internet?`, tol: { abs: 7 } },
    ai_users_pct: { hi: "the highest share of people using AI" },
    rnd_pct: { hi: "the highest spending on research and development (share of its economy)" },
    mobile_per100: { hi: "the most mobile phone subscriptions per person" },
    olympic_medals: { hi: "the most medals at the Paris 2024 Olympics", of: (c) => `How many medals did ${c} win at the Paris 2024 Olympics?`, tol: { rel: 0.15, abs: 3 }, minVal: 15 },
    olympic_golds: { hi: "the most gold medals at the Paris 2024 Olympics" },
    medals_per_million: { hi: "the most Paris 2024 Olympic medals per million people" },
    refugees_hosted: { hi: "the most refugees" },
    refugees_from: { hi: "the most refugees who have fled abroad" },
    refugees_hosted_per1000: { hi: "the most refugees for the size of its population" },
    idps: { hi: "the most people forced from their homes inside the country" },
    migrants_pct: { hi: "the highest share of people born abroad", of: (c) => `What percentage of people in ${c} were born in another country?`, tol: { abs: 5, rel: 0.25 } },
    pct_over65: { hi: "the highest share of people aged 65 and over" },
    pct_under15: { hi: "the highest share of children (under 15)" },
    emp_agriculture: { hi: "the highest share of jobs in farming", of: (c) => `What percentage of workers in ${c} work in farming?`, tol: { abs: 7 } },
  };
  Object.assign(M, {
    highest_m: { hi: "the highest mountain (the highest point)", lo: "the lowest highest point (the flattest country)", of: (c) => `How high is the highest point in ${c}?`, tol: { rel: 0.08, abs: 60 }, minPop: 1e6 },
    mean_elevation_m: { hi: "the highest average height above sea level", lo: "the lowest average height above sea level", of: (c) => `What is the average height of the land in ${c} above sea level?`, tol: { rel: 0.2, abs: 50 }, minPop: 3e6 },
    lowest_m: { lo: "the lowest point on land" },
    coastline_km: { hi: "the longest coastline", of: (c) => `Roughly how long is the coastline of ${c}?`, tol: { rel: 0.25 }, minPop: 5e6, minVal: 500 },
    coast_ratio: { hi: "the most coastline for its size" },
    volcanoes: { hi: "the most volcanoes", of: (c) => `Roughly how many volcanoes (active in the last 12,000 years) are in or near ${c}?`, tol: { rel: 0.2, abs: 2 }, minPop: 1e5, minVal: 10 },
    volcanoes_active: { hi: "the most volcanoes that have erupted since 1900" },
    quakes: { hi: "had the most big earthquakes (magnitude 6+) since 1900", of: (c) => `Roughly how many earthquakes of magnitude 6 or more have hit ${c} (or just off its coast) since 1900?`, tol: { rel: 0.25, abs: 3 }, minPop: 1e5, minVal: 15 },
    glacier_pct: { hi: "the largest share of its land covered by ice" },
    forest_land_pct: { hi: "the largest share of forest", lo: "the smallest share of forest" },
    arable_pct: { hi: "the largest share of land used for crops" },
    mountain_pct: { hi: "the largest share of land in mountain ranges" },
  });
  // "Which country has had the most…" reads better than "has" for earthquakes
  const TOPIC_OF = {
    highest_m: "p-mtn", mean_elevation_m: "p-mtn", lowest_m: "p-mtn", mountain_pct: "p-mtn", coastline_km: "p-coast", coast_ratio: "p-coast", glacier_pct: "p-coast",
    volcanoes: "p-volc", volcanoes_active: "p-volc", quakes: "p-quake", forest_land_pct: "p-bio", arable_pct: "p-bio",
    population: "pop", density: "pop", fertility: "pop", median_age: "pop", urban_pct: "pop", pop_growth: "pop", pct_over65: "pop", pct_under15: "pop",
    life_expectancy: "health", infant_mortality: "health", health_spend: "health", maternal_mortality: "health",
    gdp_per_capita: "wealth", gni_ppp: "wealth", gini: "wealth", hdi: "wealth", extreme_poverty: "wealth", literacy: "wealth", mean_schooling: "wealth", emp_agriculture: "wealth",
    women_parliament: "gender", female_labour: "gender", gii: "gender", adolescent_births: "gender",
    libdem: "politics", military_spend_usd: "politics", military_spend_pct: "politics", armed_forces: "politics",
    area_km2: "geo", neighbours: "geo", border_km: "geo",
    avg_temp: "climate", rainfall_mm: "climate", co2_per_capita: "climate", co2_mt: "climate", co2_cumulative_share: "climate", renewables_elec_pct: "climate",
    coal_elec_pct: "climate", nuclear_elec_pct: "climate", forest_pct: "climate", oil_twh: "climate", gas_twh: "climate",
    tourists: "trade", tourism_receipts_pct: "trade", exports_usd: "trade", trade_pct: "trade", exp_fuel_pct: "trade", remittances_pct: "refugees",
    internet: "tech", ai_users_pct: "tech", rnd_pct: "tech", mobile_per100: "tech",
    olympic_medals: "sport", olympic_golds: "sport", medals_per_million: "sport",
    refugees_hosted: "refugees", refugees_from: "refugees", refugees_hosted_per1000: "refugees", idps: "refugees", migrants_pct: "refugees",
  };
  const REGIONS = ["Africa", "Americas", "Asia", "Europe", "Oceania"];
  const inRegion = (reg) => (reg === "Americas" ? "in the Americas" : `in ${reg}`);

  function buildBank() {
    sov = W.rows.filter((r) => r.sovereign);
    big = sov.filter((r) => (r.population || 0) >= 1e6);
    const B = [];

    // ===== Measures: a country's value, and which country is highest / lowest =====
    for (const [key, m] of Object.entries(M)) {
      const f = F[key];
      if (!f) continue;
      const topic = TOPIC_OF[key] || "any";
      const label = lowerFirst(f.label);
      // value for one country
      if (m.of) {
        for (const r of sov) {
          const v = num(r, key);
          if (v == null) continue;
          if ((r.population || 0) < (m.minPop || 2e6) || (m.minArea && (r.area_km2 || 0) < m.minArea) || (m.minVal && v < m.minVal)) continue;
          addQ(B, `v:${key}:${r.iso3}`, topic, () => {
            const rk = rankOf(key, r);
            return {
              text: m.of(cn(r)), kind: "number", ans: { v, f, key, tol: m.tol || { rel: 0.15 } },
              explain: () => `${cap(cn(r))}: <b>${esc(fmtv(key, v))}</b>${esc(yearOf(r, f))}. ${rk ? `That's ${ordinal(rk.rank)} highest of ${rk.n} countries; the world median is ${esc(fmtv(key, rk.median))}.` : ""}`,
              action: showRank(key, r.iso3),
            };
          });
        }
      }
      // highest / lowest, in the world and in each continent
      for (const dir of ["hi", "lo"]) {
        if (!m[dir]) continue;
        for (const reg of [null].concat(REGIONS)) {
          const list = reg ? sov.filter((r) => r.region === reg) : sov;
          if (withData(key, list).length < (reg ? 8 : 40)) continue;
          addQ(B, `x:${key}:${dir}:${reg || "W"}`, topic, () => {
            const rk = ranked(key, dir, list);
            const top = num(rk[0], key);
            const winners = rk.filter((r) => num(r, key) === top);
            const others = rk.filter((r) => num(r, key) !== top);
            if (others.length < 3 || (dir === "hi" && !(top > 0))) return null;
            return {
              text: (m[dir].startsWith("had ") ? (reg ? `${inRegion(reg).replace(/^in/, "In")}, which country has ${m[dir]}?` : `Which country has ${m[dir]}?`) : reg ? `${inRegion(reg).replace(/^in/, "In")}, which country has ${m[dir]}?` : `Which country has ${m[dir]}?`),
              kind: "country", ans: { isos: winners.map((r) => r.iso3) },
              options: () => countryOptions(winners[0].iso3, others.slice(0, 2), others.slice(-Math.max(3, Math.floor(others.length / 4)))),
              explain: () => `${winners.map((r) => `<b>${esc(r.name)}</b>`).join(" and ")} (${esc(fmtv(key, top))}${esc(yearOf(winners[0], f))}). Next: ${others.slice(0, 3).map((r) => `${esc(r.name)} (${esc(fmtv(key, num(r, key)))})`).join(", ")}.`,
              action: showRank(key, winners[0].iso3),
            };
          });
        }
      }
    }

    // ===== Counting questions (each one can show its answer on the map) =====
    const COUNT = [
      ["pop", "How many countries have more than 100 million people?", [{ key: "population", min: 1e8 }]],
      ["pop", "How many countries have more than 50 million people?", [{ key: "population", min: 5e7 }]],
      ["pop", "How many countries have fewer than 1 million people?", [{ key: "population", max: 1e6 }]],
      ["pop", "In how many countries is the fertility rate below 2.1, the level that keeps a population stable?", [{ key: "fertility", max: 2.1 }]],
      ["pop", "In how many countries do women have more than 5 children on average?", [{ key: "fertility", min: 5 }]],
      ["pop", "How many countries have a shrinking population?", [{ key: "pop_growth", max: 0 }]],
      ["pop", "In how many countries is the median age over 40?", [{ key: "median_age", min: 40 }]],
      ["pop", "In how many countries do more than 80% of people live in towns and cities?", [{ key: "urban_pct", min: 80 }]],
      ["pop", "In how many countries do fewer than a third of people live in towns and cities?", [{ key: "urban_pct", max: 33 }]],
      ["pop", "In how many countries do more people die each year than are born?", [{ key: "natural_increase", max: 0 }]],
      ["health", "In how many countries is life expectancy over 80?", [{ key: "life_expectancy", min: 80 }]],
      ["health", "In how many countries is life expectancy under 60?", [{ key: "life_expectancy", max: 60 }]],
      ["wealth", "How many countries does the World Bank rate as high income?", [{ key: "income_group", values: ["High income"] }]],
      ["wealth", "How many countries does the World Bank rate as low income?", [{ key: "income_group", values: ["Low income"] }]],
      ["wealth", "How many countries have very high human development (HDI 0.8 or more)?", [{ key: "hdi", min: 0.8 }]],
      ["wealth", "How many countries have a Gini coefficient of 50 or more (very unequal)?", [{ key: "gini", min: 50 }]],
      ["wealth", "In how many countries do more than 30% of people live in extreme poverty?", [{ key: "extreme_poverty", min: 30 }]],
      ["wealth", "In how many countries do more than half of workers work in farming?", [{ key: "emp_agriculture", min: 50 }]],
      ["gender", "In how many countries are at least half of members of parliament women?", [{ key: "women_parliament", min: 50 }]],
      ["gender", "In how many countries are fewer than 10% of members of parliament women?", [{ key: "women_parliament", max: 10 }]],
      ["politics", "How many countries does V-Dem class as democracies?", [{ key: "democracy", value: true }]],
      ["politics", "How many countries does V-Dem class as closed autocracies (no real multi-party elections)?", [{ key: "regime", values: ["Closed autocracy"] }]],
      ["politics", "How many countries have nuclear weapons?", [{ key: "nuclear_armed", value: true }]],
      ["politics", "How many countries are members of the United Nations?", [{ key: "un_member", value: true }]],
      ["geo", "How many countries are landlocked?", [{ key: "landlocked", value: true }]],
      ["geo", "How many countries have no land borders at all?", [{ key: "no_land_borders", value: true }]],
      ["geo", "In how many countries do people drive on the left?", [{ key: "driving_side", values: ["Left"] }]],
      ["geo", "How many countries are bigger than 1 million km²?", [{ key: "area_km2", min: 1e6 }]],
      ["cities", "How many countries have a capital that isn't their largest city?", [{ key: "capital_is_largest", value: false }]],
      ["cities", "How many countries have at least one city of over 10 million people?", [{ key: "city_population", min: 1e7 }]],
      ["climate", "How many countries get over 90% of their electricity from renewables?", [{ key: "renewables_elec_pct", min: 90 }]],
      ["climate", "How many countries are more than 60% forest?", [{ key: "forest_pct", min: 60 }]],
      ["climate", "How many countries emit more than 10 tonnes of CO₂ per person each year?", [{ key: "co2_per_capita", min: 10 }]],
      ["climate", "How many countries make some of their electricity from nuclear power?", [{ key: "nuclear_elec_pct", min: 0.1 }]],
      ["tech", "In how many countries do more than 90% of people use the internet?", [{ key: "internet", min: 90 }]],
      ["tech", "In how many countries do fewer than 20% of people use the internet?", [{ key: "internet", max: 20 }]],
      ["refugees", "How many countries host more than 1 million refugees?", [{ key: "refugees_hosted", min: 1e6 }]],
      ["refugees", "In how many countries were more than 30% of people born abroad?", [{ key: "migrants_pct", min: 30 }]],
      ["sport", "How many different countries have won the men's football World Cup?", [{ key: "wc_men_titles", min: 1 }]],
      ["sport", "How many different countries have won the women's football World Cup?", [{ key: "wc_women_titles", min: 1 }]],
      ["sport", "How many countries won at least one gold medal at the Paris 2024 Olympics?", [{ key: "olympic_golds", min: 1 }]],
    ];
    const countQ = (id, topic, text, filters, extra) => addQ(B, id, topic, () => {
      const list = W.matchList(filters);
      const n = list.length;
      return {
        text, kind: "number", ans: { v: n, int: true, exact: true },
        explain: () => `<b>${n}</b> ${n === 1 ? "country" : "countries"}${n ? ": " + esc(listText(list.map((r) => r.name).sort())) : ""}.${extra ? " " + extra : ""}`,
        action: n ? preset(filters) : null,
      };
    });
    COUNT.forEach(([topic, text, filters], i) => countQ(`c:${i}:${text.length}`, topic, text, filters));
    // per-value counts for list measures
    const optCount = (key) => { const c = new Map(); for (const r of sov) { const v = val(r, key); (Array.isArray(v) ? v : v != null ? [v] : []).forEach((x) => c.set(x, (c.get(x) || 0) + 1)); } return c; };
    for (const [L, n] of optCount("official_languages")) if (n >= 2) countQ(`cl:${L}`, "lang", `In how many countries is ${L} an official language?`, [{ key: "official_languages", values: [L] }]);
    for (const [L, n] of optCount("spoken_languages")) if (n >= 3) countQ(`cs:${L}`, "lang", `In how many countries do at least 10% of people speak ${L}?`, [{ key: "spoken_languages", values: [L] }]);
    for (const [R, n] of optCount("largest_religion")) if (n >= 2) countQ(`cr:${R}`, "religion", `In how many countries is ${R === "No religion" || /unaffiliated/i.test(R) ? "having no religion" : R} the largest religious group?`, [{ key: "largest_religion", values: [R] }]);
    for (const [Cu, n] of optCount("currencies")) if (n >= 3) countQ(`cc:${Cu}`, "trade", `How many countries use the ${Cu} as their currency?`, [{ key: "currencies", values: [Cu] }]);
    const GROUPS = { "European Union": "the European Union", NATO: "NATO", G7: "the G7", G20: "the G20 (counting countries only)", OPEC: "OPEC", ASEAN: "ASEAN", BRICS: "BRICS", Commonwealth: "the Commonwealth", "Arab League": "the Arab League", Mercosur: "Mercosur", OECD: "the OECD", "African Union": "the African Union" };
    for (const [g, t] of Object.entries(GROUPS)) countQ(`cg:${g}`, "politics", `How many countries are members of ${t}?`, [{ key: "groups", values: [g] }]);
    for (const tr of F.treaties_joined?.options || []) countQ(`ct:${tr}`, "politics", `How many countries have joined the ${TREATY[tr] || tr}?`, [{ key: "treaties_joined", values: [tr] }]);
    for (const reg of REGIONS) {
      countQ(`crl:${reg}`, "geo", `How many countries ${inRegion(reg)} are landlocked?`, [{ key: "region", values: [reg] }, { key: "landlocked", value: true }]);
      countQ(`crd:${reg}`, "politics", `How many countries ${inRegion(reg)} are democracies?`, [{ key: "region", values: [reg] }, { key: "democracy", value: true }]);
      countQ(`crh:${reg}`, "wealth", `How many countries ${inRegion(reg)} are rated high income?`, [{ key: "region", values: [reg] }, { key: "income_group", values: ["High income"] }]);
      countQ(`crn:${reg}`, "geo", `How many countries are there ${inRegion(reg)}?`, [{ key: "region", values: [reg] }]);
    }
    // language counts that aren't filters
    const langN = (r) => (val(r, "official_languages") || []).length;
    const langCount = (id, text, test) => addQ(B, id, "lang", () => {
      const list = sov.filter((r) => test(langN(r)));
      return { text, kind: "number", ans: { v: list.length, int: true, exact: true },
        explain: () => `<b>${list.length}</b> countries, such as ${esc(listText(shuffle(list).slice(0, 6).map((r) => r.name)))}. (Official languages as listed by the mledoze/countries data set.)` };
    });
    langCount("lc:many", "How many countries have more than one official language?", (n) => n > 1);
    langCount("lc:3", "How many countries have three or more official languages?", (n) => n >= 3);
    langCount("lc:one", "How many countries have exactly one official language?", (n) => n === 1);

    // ===== "Name a country…" (any right answer counts) =====
    const nameQ = (id, topic, text, filters, extra) => addQ(B, id, topic, () => {
      const list = W.matchList(filters);
      if (!list.length) return null;
      const isoSet = new Set(list.map((r) => r.iso3));
      const right = pick(list);
      const nearWrong = near(right, big).filter((r) => !isoSet.has(r.iso3));
      const farWrong = far(right).filter((r) => !isoSet.has(r.iso3));
      return {
        text, kind: "country", ans: { isos: [...isoSet] },
        options: () => countryOptions(right.iso3, nearWrong.slice(0, 2), farWrong.slice(0, 1)),
        explain: () => `${list.length === 1 ? "The only one is" : `There are ${list.length}:`} ${esc(listText(list.map((r) => r.name).sort(), 12))}.${extra ? " " + extra : ""}`,
        action: preset(filters),
      };
    });
    for (const [L, n] of optCount("official_languages")) if (n >= 2 && n <= 40) nameQ(`nl:${L}`, "lang", `Name a country where ${L} is an official language.`, [{ key: "official_languages", values: [L] }]);
    for (const [Cu, n] of optCount("currencies")) if (n >= 2) nameQ(`nc:${Cu}`, "trade", `Name a country that uses the ${Cu}.`, [{ key: "currencies", values: [Cu] }]);
    for (const g of Object.keys(GROUPS)) nameQ(`ng:${g}`, "politics", `Name a member of ${GROUPS[g].replace(" (counting countries only)", "")}.`, [{ key: "groups", values: [g] }]);
    for (const tr of F.treaties_joined?.options || []) {
      const missing = sov.filter((r) => r.un_member && !(val(r, "treaties_joined") || []).includes(tr));
      if (missing.length >= 1 && missing.length <= 45) nameQ(`nt:${tr}`, "politics", `Name a UN member that has not joined the ${TREATY[tr] || tr}.`, [{ key: "un_member", value: true }, { key: "treaties_joined", values: [tr], mode: "none" }]);
    }
    for (const mineral of F.major_producer?.options || []) nameQ(`nm:${mineral}`, "climate", `Name a country that mines at least 5% of the world's ${mineral.toLowerCase()}.`, [{ key: "major_producer", values: [mineral] }]);
    for (const ev of F.events_hosted?.options || []) nameQ(`ne:${ev}`, "sport", `Name a country that has hosted the ${ev}.`, [{ key: "events_hosted", values: [ev] }]);
    nameQ("ns:wcm", "sport", "Name a country that has won the men's football World Cup.", [{ key: "wc_men_titles", min: 1 }]);
    nameQ("ns:wcw", "sport", "Name a country that has won the women's football World Cup.", [{ key: "wc_women_titles", min: 1 }]);
    nameQ("np:unsc", "politics", "Name a permanent member of the UN Security Council.", [{ key: "security_council", values: ["Permanent member"] }]);
    nameQ("np:nuke", "politics", "Name a country that has nuclear weapons.", [{ key: "nuclear_armed", value: true }]);
    nameQ("np:shrink", "pop", "Name a country whose population is shrinking.", [{ key: "pop_growth", max: 0 }]);
    nameQ("np:capbig", "cities", "Name a country whose capital is not its largest city.", [{ key: "capital_is_largest", value: false }]);
    nameQ("np:10m", "cities", "Name a country with a city of more than 10 million people.", [{ key: "city_population", min: 1e7 }]);
    nameQ("np:dtm5", "pop", "Name a country where more people die each year than are born.", [{ key: "natural_increase", max: 0 }]);
    nameQ("np:ren", "climate", "Name a country that gets more than 90% of its electricity from renewables.", [{ key: "renewables_elec_pct", min: 90 }]);
    nameQ("np:hindu", "religion", "Name a country where most people are Hindu.", [{ key: "pct_hindu", min: 50 }]);
    nameQ("np:buddhist", "religion", "Name a country where most people are Buddhist.", [{ key: "pct_buddhist", min: 50 }]);
    nameQ("np:nonrel", "religion", "Name a country where more than 40% of people have no religion.", [{ key: "pct_unaffiliated", min: 40 }]);
    nameQ("np:women", "gender", "Name a country where at least half of members of parliament are women.", [{ key: "women_parliament", min: 50 }]);
    for (const reg of REGIONS) {
      nameQ(`nr:land:${reg}`, "geo", `Name a landlocked country ${inRegion(reg)}.`, [{ key: "region", values: [reg] }, { key: "landlocked", value: true }]);
      nameQ(`nr:island:${reg}`, "geo", `Name an island country (no land borders) ${inRegion(reg)}.`, [{ key: "region", values: [reg] }, { key: "no_land_borders", value: true }]);
      nameQ(`nr:left:${reg}`, "geo", `Name a country ${inRegion(reg)} where people drive on the left.`, [{ key: "region", values: [reg] }, { key: "driving_side", values: ["Left"] }]);
      nameQ(`nr:muslim:${reg}`, "religion", `Name a Muslim-majority country ${inRegion(reg)}.`, [{ key: "region", values: [reg] }, { key: "pct_muslim", min: 50 }]);
      nameQ(`nr:christian:${reg}`, "religion", `Name a Christian-majority country ${inRegion(reg)}.`, [{ key: "region", values: [reg] }, { key: "pct_christian", min: 50 }]);
      nameQ(`nr:low:${reg}`, "wealth", `Name a low-income country ${inRegion(reg)}.`, [{ key: "region", values: [reg] }, { key: "income_group", values: ["Low income"] }]);
      nameQ(`nr:high:${reg}`, "wealth", `Name a high-income country ${inRegion(reg)}.`, [{ key: "region", values: [reg] }, { key: "income_group", values: ["High income"] }]);
      nameQ(`nr:dem:${reg}`, "politics", `Name a country ${inRegion(reg)} that V-Dem rates a liberal democracy.`, [{ key: "region", values: [reg] }, { key: "regime", values: ["Liberal democracy"] }]);
      nameQ(`nr:aut:${reg}`, "politics", `Name a country ${inRegion(reg)} that V-Dem rates a closed autocracy.`, [{ key: "region", values: [reg] }, { key: "regime", values: ["Closed autocracy"] }]);
      nameQ(`nr:shrink:${reg}`, "pop", `Name a country ${inRegion(reg)} whose population is shrinking.`, [{ key: "region", values: [reg] }, { key: "pop_growth", max: 0 }]);
      nameQ(`nr:dtm2:${reg}`, "pop", `Name a country ${inRegion(reg)} at stage 2 of the demographic transition model.`, [{ key: "region", values: [reg] }, { key: "dtm_stage", values: [F.dtm_stage?.order?.[1]] }]);
    }
    // puzzles from filters.js
    (window.PUZZLES || []).forEach((p, i) => nameQ(`pz:${i}`, "any", /^Find /.test(p.q) ? p.q : p.q.replace(/\?$/, "? Name one."), p.filters));

    // ===== Facts about one country =====
    for (const r of sov) {
      const iso = r.iso3;
      // capital
      if (r.capital) {
        const caps = r.capital.split(/, (?=[A-Z])/).filter((c) => !/^D\.?C\.?$/.test(c));
        addQ(B, `cap:${iso}`, "cities", () => {
          const capList = caps.concat(iso === "BOL" ? ["La Paz"] : []);
          const own = W.cities.filter((c) => c.iso3 === iso && !capList.some((k) => close(c.name, k))).slice(0, 3).map((c) => c.name);
          const nb = (r.borders_list || []).map(([x]) => W.byIso.get(x)?.capital?.split(", ")[0]).filter(Boolean);
          const fr = far(r).slice(0, 3).map((x) => x.capital?.split(", ")[0]).filter(Boolean);
          return {
            text: `What is the capital of ${cn(r)}?`, kind: "text", ans: { accept: capList, show: r.capital },
            options: () => textOptions(caps[0], shuffle(own).concat(shuffle(nb)), fr),
            explain: () => `The capital of ${esc(cn(r))} is <b>${esc(r.capital)}</b>.${r.largest_city && !capList.some((c) => close(r.largest_city, c)) ? ` Its largest city is ${esc(r.largest_city)}.` : ""}`,
            action: showCountry(iso),
          };
        });
        if (caps.length === 1 && (r.population || 0) >= 3e5 && !norm(caps[0]).includes(norm(r.name).split(" ")[0]) && !norm(r.name).includes(norm(caps[0]))) addQ(B, `capr:${iso}`, "cities", () => ({
          text: `${caps[0]} is the capital of which country?`, kind: "country", ans: { isos: [iso] },
          options: () => countryOptions(iso, near(r, big).slice(0, 2), far(r).slice(0, 1)),
          explain: () => `${esc(caps[0])} is the capital of <b>${esc(cn(r))}</b>${r.subregion ? ` (${esc(r.subregion)})` : ""}.`,
          action: showCountry(iso),
        }));
      }
      // largest city, when it isn't the capital
      if (r.largest_city && r.capital_is_largest === false && (r.population || 0) >= 2e6) addQ(B, `big:${iso}`, "cities", () => {
        const own = W.cities.filter((c) => c.iso3 === iso && c.name !== r.largest_city).map((c) => c.name);
        return {
          text: `The capital of ${cn(r)} isn't its largest city. Which city is?`, kind: "text", ans: { accept: [r.largest_city], show: r.largest_city },
          options: () => textOptions(r.largest_city, [r.capital.split(", ")[0]].concat(own.slice(0, 3)), far(r).map((x) => x.largest_city)),
          explain: () => `<b>${esc(r.largest_city)}</b> is the largest city in ${esc(cn(r))}; the capital is ${esc(r.capital)}.`,
          action: showCountry(iso),
        };
      });
      // official languages
      const langs = val(r, "official_languages") || [];
      if (langs.length && (r.population || 0) >= 2e5) addQ(B, `lang:${iso}`, "lang", () => {
        const nearL = near(r).flatMap((x) => val(x, "official_languages") || []).filter((l) => !langs.includes(l));
        const regionL = new Set(sov.filter((x) => x.region === r.region).flatMap((x) => val(x, "official_languages") || []));
        const farL = shuffle([...new Set(sov.flatMap((x) => val(x, "official_languages") || []))].filter((l) => !regionL.has(l)));
        const others = sov.filter((x) => x !== r && langs.some((l) => (val(x, "official_languages") || []).includes(l)));
        return {
          text: langs.length === 1 ? `What is the official language of ${cn(r)}?` : `${cap(cn(r))} has ${langs.length} official languages. Name one of them.`,
          kind: "text", ans: { accept: langs, show: langs.join(", ") },
          options: () => textOptions(pick(langs), [...new Set(nearL)], farL),
          explain: () => `${esc(cap(cn(r)))}'s official ${langs.length === 1 ? "language is" : "languages are"} <b>${esc(listText(langs, 12))}</b>.${langs.length === 1 && others.length ? ` ${esc(langs[0])} is also official in ${others.length} other ${others.length === 1 ? "country" : "countries"}.` : ""}`,
          action: langs.length === 1 && others.length ? preset([{ key: "official_languages", values: [langs[0]] }]) : showCountry(iso),
        };
      });
      if (langs.length >= 2 && (r.population || 0) >= 2e5) addQ(B, `langn:${iso}`, "lang", () => ({
        text: `How many official languages does ${cn(r)} have?`, kind: "number", ans: { v: langs.length, int: true, exact: true },
        explain: () => `<b>${langs.length}</b>: ${esc(listText(langs, 12))}.`, action: showCountry(iso),
      }));
      // largest religion
      const rel = val(r, "largest_religion");
      if (rel && (r.population || 0) >= 1e6) addQ(B, `rel:${iso}`, "religion", () => {
        const shares = [["Christians", "pct_christian"], ["Muslims", "pct_muslim"], ["no religion", "pct_unaffiliated"], ["Hindus", "pct_hindu"], ["Buddhists", "pct_buddhist"], ["folk religions", "pct_folk"], ["Jews", "pct_jewish"]]
          .map(([n, k]) => [n, num(r, k)]).filter(([, v]) => v != null && v >= 1).sort((a, b) => b[1] - a[1]);
        const opts = F.largest_religion.options.filter((o) => o !== rel);
        return {
          text: `What is the largest religious group in ${cn(r)}?`, kind: "text", ans: { accept: [rel].concat(RELIGION_WORDS[rel] || []), show: rel },
          options: () => textOptions(rel, shuffle(opts).slice(0, 2), shuffle(opts)),
          explain: () => `<b>${esc(rel)}</b>. ${shares.length ? esc(shares.map(([n, v]) => `${Math.round(v)}% ${n}`).join(", ")) + " (Pew estimates, 2010)." : ""}`,
          action: showCountry(iso),
        };
      });
      for (const [k, word] of [["pct_muslim", "Muslim"], ["pct_christian", "Christian"], ["pct_hindu", "Hindu"], ["pct_buddhist", "Buddhist"], ["pct_unaffiliated", "not religious"]]) {
        const v = num(r, k);
        if (v != null && v >= 15 && v <= 97 && (r.population || 0) >= 3e6) addQ(B, `relp:${k}:${iso}`, "religion", () => ({
          text: `Roughly what percentage of people in ${cn(r)} are ${word}?`, kind: "number", ans: { v, f: F[k], key: k, tol: { abs: 8 } },
          explain: () => `About <b>${Math.round(v)}%</b> (Pew estimate, 2010).`, action: showCountry(iso),
        }));
      }
      // simple categories
      const CAT = [
        ["income_group", "wealth", `How does the World Bank rate ${cn(r)}'s income?`, F.income_group?.options],
        ["regime", "politics", `How does V-Dem rate ${cn(r)}'s system of government?`, F.regime?.options],
        ["main_climate", "climate", `What is ${cn(r)}'s main type of climate (Köppen)?`, F.main_climate?.options],
        ["driving_side", "geo", `Which side of the road do people drive on in ${cn(r)}?`, ["Left", "Right"]],
        ["region", "geo", `Which continent is ${cn(r)} in?`, REGIONS],
        ["dtm_stage", "pop", `Which stage of the demographic transition model is ${cn(r)} at?`, F.dtm_stage?.options],
      ];
      for (const [key, topic, text, options] of CAT) {
        const v = val(r, key);
        if (!v || !options || (r.population || 0) < 5e5) continue;
        if (key === "region" && (r.population || 0) < 2e6) continue;
        addQ(B, `cat:${key}:${iso}`, topic, () => {
          const others = options.filter((o) => o !== v);
          const idx = options.indexOf(v);
          const adjacent = others.filter((o) => Math.abs(options.indexOf(o) - idx) === 1);
          const accept = [v].concat(key === "dtm_stage" ? [`stage ${idx + 1}`, String(idx + 1)] : key === "income_group" ? [v.replace(" income", "")] : key === "driving_side" ? [`the ${v.toLowerCase()}`] : key === "regime" ? [] : []);
          return {
            text, kind: "text", ans: { accept, show: v },
            options: () => (options.length <= 4 ? shuffle(options.map((o) => ({ label: o, ok: o === v }))) : textOptions(v, shuffle(adjacent).concat(shuffle(others)), shuffle(others.filter((o) => !adjacent.includes(o))))),
            explain: () => `<b>${esc(v)}</b>${esc(yearOf(r, F[key]))}. ${esc(F[key].info || "")}`,
            action: preset([{ key, values: [v] }]),
          };
        });
      }
      // currency
      const cur = val(r, "currencies") || [];
      if (cur.length && (r.population || 0) >= 1e6) addQ(B, `cur:${iso}`, "trade", () => {
        const short = cur.flatMap((c) => [c, c.split(" ").slice(-1)[0]]);
        const nearC = near(r).flatMap((x) => val(x, "currencies") || []).filter((c) => !cur.includes(c));
        const regionC = new Set(sov.filter((x) => x.region === r.region).flatMap((x) => val(x, "currencies") || []));
        const farC = shuffle(sov.flatMap((x) => val(x, "currencies") || []).filter((c) => !regionC.has(c)));
        return {
          text: `What currency do people use in ${cn(r)}?`, kind: "text", ans: { accept: short, show: cur.join(", "), loose: true },
          options: () => textOptions(cur[0], [...new Set(nearC)], farC),
          explain: () => `<b>${esc(cur.join(", "))}</b>.`, action: cur.length === 1 ? preset([{ key: "currencies", values: [cur[0]] }]) : showCountry(iso),
        };
      });
      // neighbours
      const nb = r.borders_list || [];
      if (nb.length && (r.population || 0) >= 1e6) {
        addQ(B, `nbn:${iso}`, "geo", () => ({
          text: `How many countries share a land border with ${cn(r)}?`, kind: "number", ans: { v: nb.length, int: true, exact: true },
          explain: () => `<b>${nb.length}</b>: ${esc(listText(nb.map(([x]) => name(x)), 14))}.`, action: showCountry(iso),
        }));
        addQ(B, `nb:${iso}`, "geo", () => {
          const set = nb.map(([x]) => x);
          const notNb = near(r, big).filter((x) => !set.includes(x.iso3));
          return {
            text: `Name a country that shares a land border with ${cn(r)}.`, kind: "country", ans: { isos: set },
            options: () => countryOptions(pick(set), notNb.slice(0, 2), far(r).slice(0, 1)),
            explain: () => `${esc(cap(cn(r)))} borders <b>${esc(listText(nb.map(([x, km]) => `${name(x)} (${n2(km)} km)`), 14))}</b>.`,
            action: showCountry(iso),
          };
        });
        if (nb.length >= 2) addQ(B, `nbl:${iso}`, "geo", () => {
          const [x, km] = nb[0];
          return {
            text: `Which of ${cn(r)}'s neighbours does it share its longest land border with?`, kind: "country", ans: { isos: [x] },
            options: () => countryOptions(x, nb.slice(1, 3).map(([y]) => W.byIso.get(y)), near(r, big).filter((y) => !nb.some(([z]) => z === y.iso3)).slice(0, 1)),
            explain: () => `<b>${esc(name(x))}</b>, about ${n2(km)} km. ${nb.length > 1 ? `Next: ${esc(nb.slice(1, 3).map(([y, k]) => `${name(y)} (${n2(k)} km)`).join(", "))}.` : ""}`,
            action: showCountry(iso),
          };
        });
      }
    }
    buildPhysical(B, nameQ, countQ);
    return B;
  }

  // ======================= Physical geography questions =======================
  function buildPhysical(B, nameQ, countQ) {
    const WP = window.WP;
    if (!WP || !WP.loaded) return;
    const it = (t) => WP.items(t);
    const feat = (t, x) => ({ label: `Show it on the map`, run: () => { minimise(); W.showFeature(t, x._i); } });
    const regionOf = (isos) => { const r = W.byIso.get((isos || [])[0]); return r ? r.region : null; };
    const strip = (s) => String(s || "").replace(/\s*\(.*?\)/g, "").trim();
    const accName = (s) => { const n = strip(s); return [n, n.replace(/^(Mount|Mont|Monte|Mt\.?|Pico|Nevado|Cerro|Lake|Lago|Lac|Jabal|Jebel|Gunung)\s+/i, "")]; };
    // ---- highest points of countries ----
    for (const r of sov) {
      if (!r.highest_point || /unnamed|^point/i.test(r.highest_point) || (r.population || 0) < 1e6) continue;
      addQ(B, `hp:${r.iso3}`, "p-mtn", () => {
        const others = near(r, big).map((x) => x.highest_point).filter((x) => x && !/unnamed/i.test(x));
        const farP = far(r).map((x) => x.highest_point).filter((x) => x && !/unnamed/i.test(x));
        return {
          text: `What is the highest point in ${cn(r)}?`, kind: "text", ans: { accept: accName(r.highest_point), show: strip(r.highest_point) },
          options: () => textOptions(strip(r.highest_point), others.map(strip), farP.map(strip)),
          explain: () => `<b>${esc(strip(r.highest_point))}</b>, ${esc(n2(r.highest_m))} m above sea level.${r.lowest_point ? ` The lowest point is ${esc(strip(r.lowest_point))} (${esc(n2(r.lowest_m))} m).` : ""}`,
          action: showCountry(r.iso3),
        };
      });
    }
    // ---- peaks ----
    const peaks = it("peak").slice(0, 150);
    for (const p of peaks) {
      const c = W.byIso.get(p.iso[0]);
      if (c) addQ(B, `pkc:${p._i}`, "p-mtn", () => ({
        text: `Which country is ${p.name} in?`, kind: "country", ans: { isos: p.iso },
        options: () => countryOptions(c.iso3, near(c, big).slice(0, 2), far(c).slice(0, 1)),
        explain: () => `${esc(p.name)} (${esc(n2(p.peak_elev))} m) is in <b>${esc(c.name)}</b>${p.range ? `, in the ${esc(p.range)}` : ""}.`, action: feat("peak", p),
      }));
      if (p._i < 70) addQ(B, `pkh:${p._i}`, "p-mtn", () => ({
        text: `How high is ${p.name}${p.range ? ` (${p.range})` : ""}?`, kind: "number", ans: { v: p.peak_elev, f: F.highest_m, key: null, tol: { rel: 0.05, abs: 100 }, show: (x) => `${n2(Math.round(x / 10) * 10)} m` },
        explain: () => `<b>${esc(n2(p.peak_elev))} m</b> above sea level (Natural Earth).`, action: feat("peak", p),
      }));
      if (p.range) {
        const ranges = [...new Set(peaks.filter((x) => x.range && x.range !== p.range).map((x) => x.range))];
        const nearR = [...new Set(peaks.filter((x) => x.range && x.range !== p.range && regionOf(x.iso) === regionOf(p.iso)).map((x) => x.range))];
        addQ(B, `pkr:${p._i}`, "p-mtn", () => ({
          text: `Which mountain range is ${p.name} in?`, kind: "text", ans: { accept: [p.range, p.range.replace(/ (Mountains|Range)$/, "")], show: p.range },
          options: () => textOptions(p.range, shuffle(nearR), shuffle(ranges)),
          explain: () => `The <b>${esc(p.range)}</b>.`, action: feat("peak", p),
        }));
      }
    }
    // ---- mountain ranges and other landforms ----
    const lfs = it("landform");
    for (const l of lfs.filter((x) => x.kind === "Mountain range" && x.top && x.area >= 20000)) {
      addQ(B, `rtop:${l._i}`, "p-mtn", () => {
        const inR = it("peak").filter((p) => p.range === l.name && p.name !== l.top).map((p) => p.name);
        const other = it("peak").filter((p) => p.range && p.range !== l.name).slice(0, 60).map((p) => p.name);
        return {
          text: `What is the highest peak in the ${l.name}?`, kind: "text", ans: { accept: accName(l.top), show: l.top },
          options: () => textOptions(l.top, inR.length ? inR : shuffle(other), shuffle(other)),
          explain: () => `<b>${esc(l.top)}</b>, ${esc(n2(l.top_m))} m (Natural Earth).`, action: feat("landform", l),
        };
      });
      if (l.iso.length >= 2) addQ(B, `rc:${l._i}`, "p-mtn", () => {
        const c = W.byIso.get(l.iso[0]);
        return c ? {
          text: `Name a country that the ${l.name} run through.`, kind: "country", ans: { isos: l.iso },
          options: () => countryOptions(pick(l.iso), near(c, big).filter((x) => !l.iso.includes(x.iso3)).slice(0, 2), far(c).filter((x) => !l.iso.includes(x.iso3)).slice(0, 1)),
          explain: () => `The ${esc(l.name)} cross <b>${esc(listText(l.iso.map(name).filter(Boolean)))}</b>.`, action: feat("landform", l),
        } : null;
      });
    }
    for (const l of lfs.filter((x) => x.kind === "Desert" && x.area >= 30000)) {
      const c = W.byIso.get(l.iso[0]);
      if (!c) continue;
      addQ(B, `dsc:${l._i}`, "p-land", () => ({
        text: l.iso.length > 1 ? `Name a country that the ${l.name} covers part of.` : `Which country is the ${l.name} in?`, kind: "country", ans: { isos: l.iso },
        options: () => countryOptions(pick(l.iso), near(c, big).filter((x) => !l.iso.includes(x.iso3)).slice(0, 2), far(c).filter((x) => !l.iso.includes(x.iso3)).slice(0, 1)),
        explain: () => `The ${esc(l.name)} (about ${esc(n2(l.area))} km²) covers parts of <b>${esc(listText(l.iso.map(name).filter(Boolean)))}</b>.`, action: feat("landform", l),
      }));
    }
    const KIND_Q = ["Mountain range", "Plateau", "Desert", "Plain", "Basin"];
    for (const l of lfs.filter((x) => KIND_Q.includes(x.kind) && x.area >= 60000 && !/mountain|range|desert|plateau|plain|basin/i.test(x.name))) {
      addQ(B, `lk:${l._i}`, "p-land", () => ({
        text: `What kind of landform is the ${l.name}?`, kind: "text", ans: { accept: [l.kind, l.kind.replace("Mountain range", "mountains")], show: l.kind },
        options: () => shuffle(KIND_Q.filter((k) => k !== l.kind)).slice(0, 3).concat([l.kind]).map((k) => ({ label: k, ok: k === l.kind })).sort(() => Math.random() - 0.5),
        explain: () => `The ${esc(l.name)} is a <b>${esc(l.kind.toLowerCase())}</b>${l.iso.length ? ` in ${esc(listText(l.iso.map(name).filter(Boolean)))}` : ""}.`, action: feat("landform", l),
      }));
    }
    for (const reg of REGIONS) {
      const ds = lfs.filter((x) => x.kind === "Desert" && regionOf(x.iso) === reg).sort((a, b) => b.area - a.area);
      if (ds.length >= 3) addQ(B, `dbig:${reg}`, "p-land", () => ({
        text: `Which is the largest desert ${inRegion(reg)}?`, kind: "text", ans: { accept: accName(ds[0].name).concat([ds[0].name.replace(/ Desert$/, "")]), show: ds[0].name },
        options: () => textOptions(ds[0].name, ds.slice(1, 3).map((x) => x.name), lfs.filter((x) => x.kind === "Desert" && regionOf(x.iso) !== reg).map((x) => x.name)),
        explain: () => `The <b>${esc(ds[0].name)}</b> (about ${esc(n2(ds[0].area))} km² as Natural Earth maps it). Next: ${esc(ds.slice(1, 3).map((x) => x.name).join(", "))}. Polar deserts like Antarctica aren't counted here.`, action: feat("landform", ds[0]),
      }));
    }
    for (const r of sov.filter((x) => (x.ranges || []).length && (x.population || 0) >= 2e6)) addQ(B, `rn:${r.iso3}`, "p-mtn", () => ({
      text: `Name a mountain range in ${cn(r)}.`, kind: "text", ans: { accept: r.ranges.flatMap((x) => [x, x.replace(/ (Mountains|Range|Mts\.?)$/, "")]), show: r.ranges.join(", ") },
      options: () => textOptions(r.ranges[0], near(r, big).flatMap((x) => x.ranges || []).filter((x) => !r.ranges.includes(x)), far(r).flatMap((x) => x.ranges || [])),
      explain: () => `Ranges in ${esc(cn(r))}: <b>${esc(listText(r.ranges))}</b> (Natural Earth's named ranges).`, action: showCountry(r.iso3),
    }));
    // ---- rivers ----
    const rivers = it("river").filter((x) => x.river_km);
    const OCEANS = ["Atlantic Ocean", "Pacific Ocean", "Indian Ocean", "Arctic Ocean", "Internal (no outlet to the sea)"];
    for (const rv of rivers) {
      const c = W.byIso.get(rv.iso[0]);
      if (rv.river_km >= 1500) addQ(B, `rvl:${rv._i}`, "p-water", () => ({
        text: `Roughly how long is the ${rv.name}?`, kind: "number", ans: { v: rv.river_km, f: F.river_km, key: null, tol: { rel: 0.1 }, show: (x) => `${n2(Math.round(x / 50) * 50)} km` },
        explain: () => `About <b>${esc(n2(rv.river_km))} km</b> (CIA World Factbook). River lengths vary between sources, depending on where the source is taken to be.`, action: feat("river", rv),
      }));
      if (rv.to) addQ(B, `rvo:${rv._i}`, "p-water", () => ({
        text: `Where does the ${rv.name} drain to?`, kind: "text", ans: { accept: [rv.to, rv.to.replace(" Ocean", ""), ...(rv.to.startsWith("Internal") ? ["inland", "nowhere", "endorheic", "internal"] : [])], show: rv.to },
        options: () => textOptions(rv.to, shuffle(OCEANS.filter((o) => o !== rv.to)), []),
        explain: () => `The ${esc(rv.name)}'s basin drains to the <b>${esc(rv.to)}</b>${rv.basin ? ` (basin about ${esc(n2(rv.basin))} km²)` : ""}.`, action: feat("river", rv),
      }));
      if (c && rv.iso.length >= 2) addQ(B, `rvc:${rv._i}`, "p-water", () => ({
        text: `Name a country that the ${rv.name} flows through.`, kind: "country", ans: { isos: rv.iso },
        options: () => countryOptions(pick(rv.iso), near(c, big).filter((x) => !rv.iso.includes(x.iso3)).slice(0, 2), far(c).filter((x) => !rv.iso.includes(x.iso3)).slice(0, 1)),
        explain: () => `The ${esc(rv.name)} flows through <b>${esc(listText(rv.iso.map(name).filter(Boolean), 12))}</b>.`, action: feat("river", rv),
      }));
      if (rv.mouth.length === 1 && rv.iso.length >= 2) {
        const m = W.byIso.get(rv.mouth[0]);
        if (m) addQ(B, `rvm:${rv._i}`, "p-water", () => ({
          text: `In which country does the ${rv.name} reach the sea${rv.to.startsWith("Internal") ? " (or its end)" : ""}?`, kind: "country", ans: { isos: rv.mouth },
          options: () => countryOptions(m.iso3, rv.iso.filter((x) => x !== m.iso3).map((x) => W.byIso.get(x)).filter(Boolean).slice(0, 2), far(m).slice(0, 1)),
          explain: () => `Its mouth is in <b>${esc(m.name)}</b>${rv.src.length ? `; it rises in ${esc(listText(rv.src.map(name)))}` : ""}.`, action: feat("river", rv),
        }));
      }
    }
    for (const reg of [null].concat(REGIONS)) {
      const list = rivers.filter((x) => !reg || regionOf(x.mouth.length ? x.mouth : x.iso) === reg).sort((a, b) => b.river_km - a.river_km);
      if (list.length < 3) continue;
      addQ(B, `rvx:${reg || "W"}`, "p-water", () => ({
        text: reg ? `Which is the longest river ${inRegion(reg)}?` : "Which is the longest river in the world?", kind: "text", ans: { accept: [list[0].name], show: list[0].name },
        options: () => textOptions(list[0].name, list.slice(1, 3).map((x) => x.name), rivers.filter((x) => !list.slice(0, 6).includes(x)).map((x) => x.name)),
        explain: () => `The <b>${esc(list[0].name)}</b>, ${esc(n2(list[0].river_km))} km. Next: ${esc(list.slice(1, 3).map((x) => `${x.name} (${n2(x.river_km)} km)`).join(", "))}. (CIA World Factbook lengths; some sources make the Amazon the longest.)`,
        action: feat("river", list[0]),
      }));
    }
    for (const r of sov.filter((x) => x.longest_river && (x.population || 0) >= 2e6)) addQ(B, `rvlong:${r.iso3}`, "p-water", () => ({
      text: `Which is the longest river that flows through ${cn(r)}?`, kind: "text", ans: { accept: [r.longest_river], show: r.longest_river },
      options: () => textOptions(r.longest_river, (r.rivers || []).filter((x) => x !== r.longest_river).concat(near(r, big).map((x) => x.longest_river)), far(r).map((x) => x.longest_river)),
      explain: () => `The <b>${esc(r.longest_river)}</b> (${esc(n2(r.longest_river_km))} km in total).`, action: showCountry(r.iso3),
    }));
    // ---- lakes ----
    const lakes = it("lake").filter((x) => x.lake_kind !== "Reservoir");
    for (const reg of REGIONS) {
      const list = lakes.filter((x) => regionOf(x.iso) === reg).sort((a, b) => b.lake_km2 - a.lake_km2);
      if (list.length >= 3) addQ(B, `lkx:${reg}`, "p-water", () => ({
        text: `Which is the largest lake ${inRegion(reg)}${reg === "Asia" || reg === "Europe" ? " (counting the Caspian Sea as a lake)" : ""}?`, kind: "text", ans: { accept: accName(list[0].name), show: list[0].name },
        options: () => textOptions(list[0].name, list.slice(1, 3).map((x) => x.name), lakes.filter((x) => regionOf(x.iso) !== reg).slice(0, 20).map((x) => x.name)),
        explain: () => `<b>${esc(list[0].name)}</b>, about ${esc(n2(list[0].lake_km2))} km². Next: ${esc(list.slice(1, 3).map((x) => x.name).join(", "))}.`, action: feat("lake", list[0]),
      }));
    }
    for (const l of lakes.slice(0, 60)) {
      addQ(B, `lks:${l._i}`, "p-water", () => ({
        text: `Is ${/Sea$/.test(l.name) ? "the " : ""}${l.name} a freshwater lake or a salt lake?`, kind: "text", ans: { accept: l.lake_kind === "Salt lake" ? ["salt", "salt lake", "saline", "salty"] : ["fresh", "freshwater", "freshwater lake", "fresh water"], show: l.lake_kind },
        options: () => shuffle([{ label: "Freshwater lake", ok: l.lake_kind === "Freshwater lake" }, { label: "Salt lake", ok: l.lake_kind === "Salt lake" }]),
        explain: () => `It's a <b>${esc(l.lake_kind.toLowerCase())}</b>.${l.lake_kind === "Salt lake" ? " Salt lakes usually have no outlet, so salts build up as water evaporates." : ""}`, action: feat("lake", l),
      }));
      const c = W.byIso.get(l.iso[0]);
      if (c && l.iso.length >= 2) addQ(B, `lkc:${l._i}`, "p-water", () => ({
        text: `Name a country with a shore on ${/Sea$/.test(l.name) ? "the " : ""}${l.name}.`, kind: "country", ans: { isos: l.iso },
        options: () => countryOptions(pick(l.iso), near(c, big).filter((x) => !l.iso.includes(x.iso3)).slice(0, 2), far(c).slice(0, 1)),
        explain: () => `${esc(l.name)} is shared by <b>${esc(listText(l.iso.map(name).filter(Boolean)))}</b>.`, action: feat("lake", l),
      }));
    }
    // ---- waterfalls, deltas ----
    const falls = it("waterfall");
    if (falls.length) addQ(B, "wfx:W", "p-water", () => {
      const s = [...falls].sort((a, b) => b.waterfall_m - a.waterfall_m);
      return { text: "Which is the world's tallest waterfall?", kind: "text", ans: { accept: accName(s[0].name).concat(["Angel"]), show: s[0].name },
        options: () => textOptions(s[0].name, [s[1].name, s[2].name], ["Niagara Falls", "Victoria Falls"]),
        explain: () => `<b>${esc(s[0].name)}</b> in Venezuela, ${esc(n2(s[0].waterfall_m))} m. Next: ${esc(s[1].name)} (${n2(s[1].waterfall_m)} m).`, action: feat("waterfall", s[0]) };
    });
    for (const w of falls) {
      const c = W.byIso.get(w.iso[0]);
      if (c) addQ(B, `wfc:${w._i}`, "p-water", () => ({
        text: `${w.iso.length > 1 ? "Name a country that" : "Which country is"} ${w.name} ${w.iso.length > 1 ? "is on the border of" : "in"}?`.replace("Name a country that " + w.name + " is on the border of?", `${w.name} is on a border. Name one of the two countries.`),
        kind: "country", ans: { isos: w.iso },
        options: () => countryOptions(w.iso[0], near(c, big).filter((x) => !w.iso.includes(x.iso3)).slice(0, 2), far(c).slice(0, 1)),
        explain: () => `${esc(w.name)} (${esc(n2(w.waterfall_m))} m) is in <b>${esc(listText(w.iso.map(name)))}</b>.${w.note ? " " + esc(w.note) + "." : ""}`, action: feat("waterfall", w),
      }));
    }
    const SHAPES = ["Arcuate", "Bird's-foot", "Cuspate", "Inland"];
    for (const d of it("delta")) {
      if (d.shape) addQ(B, `dls:${d._i}`, "p-water", () => ({
        text: `What shape is the ${d.name}?`, kind: "text", ans: { accept: [d.shape, d.shape.replace("'s", "s"), d.shape.replace("-", " ")], show: d.shape },
        options: () => shuffle(SHAPES.map((s) => ({ label: s, ok: s === d.shape }))),
        explain: () => `<b>${esc(d.shape)}</b>. Arcuate deltas are fan-shaped; bird's-foot deltas push out in long fingers; cuspate deltas are shaped into a point by waves; inland deltas spread out on land.`, action: feat("delta", d),
      }));
      const dc = W.byIso.get(d.iso[0]);
      if (dc) addQ(B, `dlc:${d._i}`, "p-water", () => ({
        text: `${d.iso.length > 1 ? "Name a country that the" : "Which country is the"} ${d.name} ${d.iso.length > 1 ? "is in" : "in"}?`, kind: "country", ans: { isos: d.iso },
        options: () => countryOptions(d.iso[0], near(dc, big).filter((x) => !d.iso.includes(x.iso3)).slice(0, 2), far(dc).slice(0, 1)),
        explain: () => `The ${esc(d.name)} is in <b>${esc(listText(d.iso.map(name)))}</b>.${d.note ? " " + esc(d.note) + "." : ""}`, action: feat("delta", d),
      }));
    }
    // ---- volcanoes ----
    const volcs = it("volcano").filter((v) => v.iso.length && (v.n1900 >= 3 || (v.vei ?? 0) >= 5 || (v.elev ?? 0) >= 4500));
    const VT = ["Stratovolcano", "Shield volcano", "Caldera", "Lava dome", "Volcanic field", "Cinder cone", "Complex volcano"];
    for (const v of volcs) {
      const c = W.byIso.get(v.iso[0]);
      if (!c) continue;
      addQ(B, `vc:${v._i}`, "p-volc", () => ({
        text: `Which country is the volcano ${v.name} in?`, kind: "country", ans: { isos: v.iso },
        options: () => countryOptions(c.iso3, near(c, big).slice(0, 2), far(c).slice(0, 1)),
        explain: () => `${esc(v.name)} is in <b>${esc(listText(v.iso.map(name)))}</b>. ${esc(v.about || "")}`, action: feat("volcano", v),
      }));
      if (VT.includes(v.type)) addQ(B, `vt:${v._i}`, "p-volc", () => ({
        text: `What type of volcano is ${v.name}?`, kind: "text", ans: { accept: [v.type, v.type.replace(" volcano", ""), ...(v.type === "Stratovolcano" ? ["composite", "composite volcano", "composite cone"] : [])], show: v.type },
        options: () => textOptions(v.type, shuffle(VT.filter((x) => x !== v.type)), []),
        explain: () => `A <b>${esc(v.type.toLowerCase())}</b>${v.setting ? `, at ${v.setting === "Intraplate" ? "a hotspot away from plate boundaries" : `a ${v.setting.toLowerCase()}`}` : ""}. ${esc(v.about || "")}`, action: feat("volcano", v),
      }));
      if (["Subduction zone", "Rift zone", "Intraplate"].includes(v.setting)) addQ(B, `vs:${v._i}`, "p-volc", () => {
        const L = { "Subduction zone": "At a subduction zone (destructive boundary)", "Rift zone": "At a rift (constructive boundary)", Intraplate: "Away from plate boundaries (hotspot)" };
        return { text: `Where is ${v.name}, in plate tectonic terms?`, kind: "text", ans: { accept: { "Subduction zone": ["subduction", "destructive", "subduction zone", "convergent"], "Rift zone": ["rift", "constructive", "divergent", "ridge"], Intraplate: ["hotspot", "intraplate", "hot spot"] }[v.setting], show: L[v.setting] },
          options: () => shuffle(Object.entries(L).map(([k, l]) => ({ label: l, ok: k === v.setting }))),
          explain: () => `<b>${esc(L[v.setting])}</b>.`, action: feat("volcano", v) };
      });
      if (v.last >= 1900) addQ(B, `vl:${v._i}`, "p-volc", () => ({
        text: `In what year did ${v.name} (${c.name}) last erupt?`, kind: "number", ans: { v: v.last, key: null, tol: { abs: 1 }, year: true },
        explain: () => `<b>${v.last}</b> (Smithsonian Global Volcanism Program, to 2026).${v.n1900 ? ` It has erupted ${v.n1900} times since 1900.` : ""}`, action: feat("volcano", v),
      }));
    }
    nameQ("pvq:count", "p-volc", "Name a country with a volcano that has erupted since 1900.", [{ key: "volcanoes_active", min: 1 }]);
    for (const reg of REGIONS) nameQ(`pvr:${reg}`, "p-volc", `Name a country ${inRegion(reg)} with a volcano that has erupted since 1900.`, [{ key: "region", values: [reg] }, { key: "volcanoes_active", min: 1 }]);
    addQ(B, "pvs:since2000", "p-volc", () => {
      const n = it("volcano").filter((v) => v.volcano_last === "Since 2000").length;
      return { text: "Roughly how many volcanoes have erupted since the year 2000?", kind: "number", ans: { v: n, key: null, tol: { rel: 0.15 }, int: true },
        explain: () => `<b>${n}</b> volcanoes in the Smithsonian's list have erupted since 2000.`, action: { label: "Show them on the map", run: () => { minimise(); W.applyPreset([{ key: "volcano_last", values: ["Since 2000"] }]); } } };
    });
    // ---- earthquakes ----
    const quakes = it("quake");
    for (const qk of quakes.filter((x) => x.quake_mag >= 8.4 && x.iso.length)) {
      const c = W.byIso.get(qk.iso[0]);
      if (!c) continue;
      addQ(B, `qc:${qk._i}`, "p-quake", () => ({
        text: `Which country was hit by the magnitude ${qk.quake_mag.toFixed(1)} earthquake of ${qk.quake_year}?`, kind: "country", ans: { isos: qk.iso },
        options: () => countryOptions(c.iso3, near(c, big).slice(0, 2), far(c).slice(0, 1)),
        explain: () => `<b>${esc(c.name)}</b>${qk.offshore ? " (just offshore)" : ""}: ${esc(qk.name)}, ${esc(qk.date)}.`, action: feat("quake", qk),
      }));
      addQ(B, `qy:${qk._i}`, "p-quake", () => ({
        text: `In what year did a magnitude ${qk.quake_mag.toFixed(1)} earthquake strike ${qk.name.replace(/^near /, "near ")}?`, kind: "number", ans: { v: qk.quake_year, key: null, tol: { abs: 0.5 }, year: true },
        explain: () => `<b>${qk.quake_year}</b> (${esc(qk.date)}).`, action: feat("quake", qk),
      }));
    }
    addQ(B, "qbig:W", "p-quake", () => {
      const q0 = quakes[0], c = W.byIso.get(q0.iso[0]);
      return { text: "Where was the largest earthquake recorded since 1900?", kind: "country", ans: { isos: q0.iso },
        options: () => countryOptions(q0.iso[0], quakes.slice(1, 6).map((x) => W.byIso.get(x.iso[0])).filter((x) => x && x.iso3 !== q0.iso[0]).slice(0, 2), far(c).slice(0, 1)),
        explain: () => `<b>${esc(c.name)}</b>: magnitude ${q0.quake_mag.toFixed(1)}, ${esc(q0.date)} (${esc(q0.name)}). It is the largest earthquake ever recorded.`, action: feat("quake", q0) };
    });
    for (const [lo, label] of [[8, "8 or more"], [9, "9 or more"], [7, "7 or more"]]) addQ(B, `qn:${lo}`, "p-quake", () => {
      const n = quakes.filter((x) => x.quake_mag >= lo).length;
      return { text: `Roughly how many earthquakes of magnitude ${label} have there been since 1900?`, kind: "number", ans: { v: n, key: null, tol: { rel: lo === 9 ? 0 : 0.15, abs: lo === 9 ? 0 : 3 }, int: true, exact: lo === 9 },
        explain: () => `<b>${n}</b> (USGS catalogue, 1900 to October 2026).`, action: { label: "Show them on the map", run: () => { minimise(); W.applyPreset([{ key: "quake_mag", min: lo }]); } } };
    });
    addQ(B, "qmargin", "p-quake", () => {
      const c = d3.rollup(quakes.filter((x) => x.quake_mag >= 7), (v) => v.length, (x) => x.quake_margin[0]);
      const top = [...c].sort((a, b) => b[1] - a[1])[0][0];
      const opts = ["Destructive", "Constructive", "Conservative", "Collision"];
      return { text: "Near which type of plate boundary do most big earthquakes (magnitude 7+) happen?", kind: "text", ans: { accept: [top, ...(top === "Destructive" ? ["subduction", "convergent"] : [])], show: top },
        options: () => shuffle(opts.map((o) => ({ label: o, ok: o === top }))),
        explain: () => `<b>${esc(top)}</b> boundaries, where one plate sinks under another: ${esc([...c].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", "))}.`,
        action: { label: "Show them on the map", run: () => { minimise(); W.applyPreset([{ key: "quake_mag", min: 7 }]); } } };
    });
    nameQ("qdeep", "p-quake", "Name a country that has had an earthquake of magnitude 8 or more since 1900.", [{ key: "quake_max", min: 8 }]);
    // ---- plates ----
    const plateNames = new Set(it("plate").map((p) => p.name));
    for (const r of sov.filter((x) => (x.plates || []).length && (x.population || 0) >= 1e6)) {
      const ps = r.plates;
      addQ(B, `pl:${r.iso3}`, "p-plate", () => ({
        text: ps.length === 1 ? `Which tectonic plate is ${cn(r)} on?` : `${cap(cn(r))} sits on more than one tectonic plate. Name one of them.`, kind: "text",
        ans: { accept: ps.flatMap((x) => [x, `${x} Plate`, x.replace("North ", "N "), ...(x === "Eurasia" ? ["Eurasian"] : x === "Africa" ? ["African"] : x === "India" ? ["Indian"] : x === "Australia" ? ["Australian"] : x === "Arabia" ? ["Arabian"] : x === "North America" ? ["North American"] : x === "South America" ? ["South American"] : [])]), show: ps.join(", ") },
        options: () => textOptions(ps[0], near(r).flatMap((x) => x.plates || []).filter((x) => !ps.includes(x)), [...plateNames].filter((x) => !ps.includes(x))),
        explain: () => `${esc(cap(cn(r)))} is on the <b>${esc(listText(ps))}</b> ${ps.length > 1 ? "plates" : "Plate"} (PB2002 model, which includes small plates).`, action: showCountry(r.iso3),
      }));
    }
    for (const p of it("plate")) {
      const on = sov.filter((r) => (r.plates || []).includes(p.name));
      if (on.length >= 1 && on.length <= 40) nameQ(`pln:${p.name}`, "p-plate", `Name a country on the ${p.name} Plate.`, [{ key: "plates", values: [p.name] }]);
    }
    const named = d3.group(it("boundary").filter((b) => b.name), (b) => b.name);
    for (const [nm, segs] of named) {
      const margin = d3.greatest(d3.rollups(segs, (v) => d3.sum(v, (x) => x.km), (x) => x.margin), (x) => x[1])[0];
      const plates = [...new Set(segs.flatMap((x) => x.plates))];
      const s0 = segs[0];
      addQ(B, `bm:${nm}`, "p-plate", () => ({
        text: `What type of plate boundary is the ${nm}?`, kind: "text", ans: { accept: [margin, ...({ Constructive: ["divergent"], Destructive: ["convergent", "subduction"], Collision: ["convergent collision"], Conservative: ["transform", "conservative"] }[margin] || [])], show: margin },
        options: () => shuffle(["Constructive", "Destructive", "Collision", "Conservative"].map((o) => ({ label: o, ok: o === margin }))),
        explain: () => `<b>${esc(margin)}</b>: ${esc({ Constructive: "the plates move apart and new crust forms", Destructive: "one plate sinks (subducts) under another", Collision: "two continental plates push together and crumple into mountains", Conservative: "the plates slide past each other" }[margin])}. It's where the ${esc(listText(plates))} plates meet.`,
        action: feat("boundary", s0),
      }));
      if (plates.length >= 2) addQ(B, `bp:${nm}`, "p-plate", () => ({
        text: `Name one of the plates that meet at the ${nm}.`, kind: "text", ans: { accept: plates.flatMap((x) => [x, `${x} Plate`]), show: plates.join(", ") },
        options: () => textOptions(plates[0], shuffle([...plateNames].filter((x) => !plates.includes(x))).slice(0, 5), []),
        explain: () => `The <b>${esc(listText(plates))}</b> plates.`, action: feat("boundary", s0),
      }));
    }
    for (const mg of ["Constructive", "Destructive", "Collision", "Conservative"]) nameQ(`bmn:${mg}`, "p-plate", `Name a country with a ${mg.toLowerCase()} plate boundary in it or just off its coast.`, [{ key: "margins", values: [mg] }]);
    // ---- coasts, oceans, ice ----
    const tr = [...it("trench")].sort((a, b) => b.trench_depth - a.trench_depth);
    if (tr.length) {
      addQ(B, "tx:W", "p-coast", () => ({ text: "Which is the deepest ocean trench?", kind: "text", ans: { accept: ["Mariana Trench", "Mariana", "Marianas"], show: tr[0].name },
        options: () => textOptions(tr[0].name, [tr[1].name, tr[2].name], ["Puerto Rico Trench"]), explain: () => `The <b>${esc(tr[0].name)}</b>. Its deepest point, ${esc(tr[0].deep)}, is about ${esc(n2(tr[0].trench_depth))} m deep.`, action: feat("trench", tr[0]) }));
      addQ(B, "tx:pt", "p-coast", () => ({ text: "What is the deepest known point in the oceans called?", kind: "text", ans: { accept: ["Challenger Deep", "Challenger"], show: "Challenger Deep" },
        options: () => textOptions("Challenger Deep", ["Horizon Deep", "Milwaukee Deep"], ["Mount Everest"]), explain: () => `The <b>Challenger Deep</b>, in the Mariana Trench, about ${esc(n2(tr[0].trench_depth))} m down.`, action: feat("trench", tr[0]) }));
      for (const t of tr) {
        addQ(B, `to:${t._i}`, "p-coast", () => ({ text: `Which ocean is the ${t.name} in?`, kind: "text", ans: { accept: [t.ocean, `${t.ocean} Ocean`], show: `${t.ocean} Ocean` },
          options: () => shuffle(["Pacific", "Atlantic", "Indian", "Arctic"].map((o) => ({ label: `${o} Ocean`, ok: o === t.ocean }))), explain: () => `The <b>${esc(t.ocean)} Ocean</b>. ${esc(t.plates)}.`, action: feat("trench", t) }));
        addQ(B, `td:${t._i}`, "p-coast", () => ({ text: `Roughly how deep is the deepest point of the ${t.name}?`, kind: "number", ans: { v: t.trench_depth, key: null, tol: { rel: 0.06 }, show: (x) => `${n2(Math.round(x / 10) * 10)} m` },
          explain: () => `About <b>${esc(n2(t.trench_depth))} m</b>${t.deep ? ` at the ${esc(t.deep)}` : ""}.`, action: feat("trench", t) }));
      }
    }
    const seaCount = new Map();
    sov.forEach((r) => (r.seas || []).forEach((s) => seaCount.set(s, (seaCount.get(s) || 0) + 1)));
    for (const [s, n] of seaCount) if (n >= 2 && n <= 40 && !/Ocean$/.test(s)) nameQ(`sea:${s}`, "p-coast", `Name a country with a coast on the ${s}.`, [{ key: "seas", values: [s] }]);
    for (const r of sov.filter((x) => (x.seas || []).length && (x.population || 0) >= 3e6)) addQ(B, `seac:${r.iso3}`, "p-coast", () => ({
      text: `Name a sea or ocean that ${cn(r)} has a coast on.`, kind: "text", ans: { accept: r.seas.flatMap((x) => [x, x.replace(/^(Gulf|Bay|Sea) of /, "")]), show: r.seas.join(", ") },
      options: () => textOptions(r.seas[0], far(r).flatMap((x) => x.seas || []).filter((x) => !r.seas.includes(x)), []),
      explain: () => `${esc(cap(cn(r)))} has coasts on the <b>${esc(listText(r.seas))}</b>.`, action: showCountry(r.iso3),
    }));
    for (const reg of REGIONS) nameQ(`ice:${reg}`, "p-coast", `Name a country ${inRegion(reg)} with glaciers or ice caps.`, [{ key: "region", values: [reg] }, { key: "glacier_pct", min: 0.01 }]);
    nameQ("isl", "p-coast", "Name an island country with more than 50 million people.", [{ key: "island", value: true }, { key: "population", min: 5e7 }]);
    // ---- climate & biomes ----
    const BIOMES = F.main_biome?.options || [];
    for (const r of sov.filter((x) => x.main_biome && (x.population || 0) >= 2e6)) addQ(B, `bio:${r.iso3}`, "p-bio", () => {
      const others = (r.biome_list || []).map(([b]) => b).filter((b) => b !== r.main_biome);
      return { text: `What is the main biome of ${cn(r)}?`, kind: "text", ans: { accept: [r.main_biome, r.main_biome.replace(/ \(.*\)/, ""), ...(r.main_biome.startsWith("Boreal") ? ["taiga"] : [])], show: r.main_biome },
        options: () => textOptions(r.main_biome, others.concat(shuffle(BIOMES)), shuffle(BIOMES)),
        explain: () => `<b>${esc(r.main_biome)}</b>. ${esc((r.biome_list || []).map(([b, p]) => `${b} ${p}%`).join(", "))} (worked out from climate zones).`, action: showCountry(r.iso3) };
    });
    for (const b of BIOMES) for (const reg of REGIONS) nameQ(`biom:${b}:${reg}`, "p-bio", `Name a country ${inRegion(reg)} where at least 10% of the land is ${b.toLowerCase()}.`, [{ key: "region", values: [reg] }, { key: "biomes", values: [b] }]);
    // ---- hazards ----
    const HZ = F.hazards?.options || [];
    for (const h of HZ) for (const reg of REGIONS) nameQ(`hz:${h}:${reg}`, "p-haz", `Name a country ${inRegion(reg)} that faces ${h.toLowerCase()} as a natural hazard.`, [{ key: "region", values: [reg] }, { key: "hazards", values: [h] }]);
    for (const h of HZ) countQ(`hzc:${h}`, "p-haz", `How many countries list ${h.toLowerCase()} among their natural hazards (CIA World Factbook)?`, [{ key: "hazards", values: [h] }]);
    for (const r of sov.filter((x) => (x.hazards || []).length >= 2 && (x.population || 0) >= 5e6)) addQ(B, `hzn:${r.iso3}`, "p-haz", () => ({
      text: `Name a natural hazard that affects ${cn(r)}.`, kind: "text", ans: { accept: r.hazards.flatMap((h) => [h, h.replace(/s$/, ""), ...(h === "Tropical storms" ? ["cyclone", "hurricane", "typhoon", "cyclones", "hurricanes", "typhoons"] : [])]), show: r.hazards.join(", ") },
      options: () => textOptions(r.hazards[0], HZ.filter((h) => !r.hazards.includes(h)), []),
      explain: () => `<b>${esc(listText(r.hazards))}</b>. ${esc((r.hazards_text || "").slice(0, 200))}`, action: showCountry(r.iso3),
    }));
  }
  const TREATY = {
    "Children's rights (UNCRC)": "UN Convention on the Rights of the Child (UNCRC)", "International Criminal Court": "Rome Statute of the International Criminal Court",
    "Paris Agreement": "Paris Agreement on climate change", "Refugee Convention": "UN Refugee Convention", "Women's rights (CEDAW)": "UN convention on women's rights (CEDAW)",
    "Disability rights (CRPD)": "UN convention on the rights of disabled people (CRPD)", "Non-Proliferation Treaty (NPT)": "Nuclear Non-Proliferation Treaty (NPT)",
    "Nuclear weapons ban": "Treaty on the Prohibition of Nuclear Weapons", "Landmine ban": "Ottawa Treaty banning landmines",
  };
  const RELIGION_WORDS = { "No religion": ["none", "not religious", "atheist", "atheism", "unaffiliated", "nonreligious"], "Folk religions": ["folk", "folk religion", "traditional religion"], Christianity: ["Christian", "Christians"], Islam: ["Muslim", "Muslims"], Hinduism: ["Hindu", "Hindus"], Buddhism: ["Buddhist", "Buddhists"], Judaism: ["Jewish", "Jews"] };

  // ---------- Checking a typed answer ----------
  function check(q, text) {
    const a = q.ans;
    if (q.kind === "number") {
      const g = parseNumber(text);
      if (g == null) return { status: "invalid" };
      if (a.exact) return { status: g === a.v ? "right" : Math.abs(g - a.v) <= Math.max(1, Math.round(a.v * 0.1)) ? "close" : "wrong" };
      const t = Math.max(a.tol?.abs || 0, (a.tol?.rel || 0) * Math.abs(a.v));
      const d = Math.abs(g - a.v);
      return { status: d <= t ? "right" : d <= 2.5 * t ? "close" : "wrong" };
    }
    if (q.kind === "country") {
      const iso = resolveCountry(text);
      if (!iso) return { status: "unknown" };
      return { status: a.isos.includes(iso) ? "right" : "wrong", iso };
    }
    const g = norm(text);
    if (!g) return { status: "invalid" };
    const ok = a.accept.some((x) => close(text, x) || (a.loose && norm(x).split(" ").pop() === g && g.length >= 3));
    return { status: ok ? "right" : "wrong" };
  }

  // ---------- Picking the next question ----------
  function nextQuestion() {
    bank ||= buildBank();
    const pool = bank.filter((q) => inTopic(q, curTopic()) && !seen.has(q.id));
    if (!pool.length) return null;
    // choose a kind of question first, so one kind doesn't crowd out the rest
    const kinds = d3.group(pool, (q) => q.id.split(":")[0]);
    // and not the same kind as last time, when there's a choice
    const kindList = [...kinds.entries()].filter(([k]) => k !== Q.lastKind || kinds.size === 1).map(([, v]) => v);
    for (let tries = 0; tries < 20; tries++) {
      const list = pick(kindList.length ? kindList : [...kinds.values()]);
      const spec = pick(list);
      const q = spec.make();
      if (q) { Q.lastKind = spec.id.split(":")[0]; return { ...q, id: spec.id, topic: spec.topic }; }
      seen.add(spec.id);
    }
    return null;
  }
  function bankSize(topic) { bank ||= buildBank(); return bank.filter((q) => inTopic(q, topic)).length; }

  // ---------- Card ----------
  function minimise() { Q.mode = "min"; renderCard(); }
  function renderCard(el = $("#starter")) {
    if (!W) return;
    const st = W.state;
    const filtersOn = st.filters.length > 0;
    // adding filters tucks the quiz away; clearing them brings it back
    if (filtersOn && !Q.prevFilters && Q.mode === "open" && !Q.keepOpen) Q.mode = "min";
    if (!filtersOn && Q.prevFilters && Q.mode === "min") Q.mode = "open";
    Q.prevFilters = filtersOn; Q.keepOpen = false;
    const hide = !!st.flow || st.view !== "map";
    el.hidden = hide || Q.mode !== "open";
    let pill = $("#quizPill");
    if (!pill) {
      pill = document.createElement("button");
      pill.id = "quizPill"; pill.type = "button"; pill.className = "quizpill";
      pill.onclick = () => { Q.mode = "open"; Q.keepOpen = true; renderCard(); if (!Q.cur) ask(); };
      $("#mapwrap").appendChild(pill);
    }
    pill.hidden = hide || Q.mode !== "min";
    pill.innerHTML = Q.cur && !Q.done ? "🎯 Back to your question" : "🎯 Quiz";
    const qb = $("#quizBtn");
    if (qb) qb.setAttribute("aria-pressed", String(Q.mode === "open"));
    if (el.hidden) return;
    if (!built || builtMode !== st.mode) build(el);
  }
  let builtMode = null;
  function build(el) {
    built = true; builtMode = W.state.mode;
    el.classList.add("quiz");
    el.innerHTML = `
      <button class="iconbtn hide" type="button" aria-label="Close the quiz">×</button>
      <div class="qz-head"><h2>Ask the map a question</h2><span class="qz-score" id="qzScore"></span></div>
      <p class="qz-intro">Pick a topic, then type your guess or ask for options.</p>
      <div class="qz-topics" role="radiogroup" aria-label="Topic">${topicsNow().map((t) => `<button type="button" role="radio" class="qz-topic" data-t="${t.id}" ${t.g ? `data-g="${t.g}"` : ""} aria-checked="${curTopic() === t.id}">${esc(t.label)}</button>`).join("")}</div>
      <div class="qz-q" id="qzQ"></div>
      ${isPhys() ? "" : `<details class="qz-more"><summary>Or start from a ready-made map</summary>`}
        ${isPhys() ? "" : `<div class="presets">${(window.STARTERS || []).map((s, i) => `<button type="button" data-i="${i}">${esc(s.title)}</button>`).join("")}</div></details>`}`;
    el.querySelector(".hide").onclick = () => { Q.mode = "closed"; renderCard(); };
    el.querySelectorAll(".qz-topic").forEach((b) => (b.onclick = () => {
      Q.topics[isPhys() ? "physical" : "human"] = b.dataset.t; store.set("wcq-topics", Q.topics);
      el.querySelectorAll(".qz-topic").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
      ask();
    }));
    el.querySelectorAll(".presets button").forEach((b) => (b.onclick = () => { minimise(); W.applyPreset(window.STARTERS[+b.dataset.i].filters); }));
    showScore();
    ask();
  }
  function showScore() {
    const s = $("#qzScore");
    if (s) s.innerHTML = score.asked ? `<b>${score.right}</b> / ${score.asked} right${score.streak >= 2 ? ` · 🔥 ${score.streak} in a row` : ""}` : "";
  }
  function ask() {
    const q = nextQuestion();
    Q.cur = q; Q.mc = false; Q.picked = null; Q.done = false;
    drawQuestion();
  }
  function drawQuestion() {
    const box = $("#qzQ");
    if (!box) return;
    const q = Q.cur;
    if (!q) {
      box.innerHTML = `<p class="qz-text">You've answered every question ${/any$/.test(curTopic()) ? "" : `on ${esc(topicOf(curTopic()).label.toLowerCase())} `}in the bank. Impressive!</p>
        <button type="button" class="primary" id="qzReset">Start this topic again</button>`;
      $("#qzReset").onclick = () => { bank.filter((x) => inTopic(x, curTopic())).forEach((x) => seen.delete(x.id)); store.set("wcq-seen", [...seen]); ask(); };
      return;
    }
    const t = topicOf(q.topic);
    q._opts ||= q.options ? q.options() : numberOptions(q);
    const nOpts = q._opts.length;
    box.innerHTML = `
      <div class="qz-tag" ${t.g ? `data-g="${t.g}"` : ""}>${esc(/any$/.test(q.topic) ? "Puzzle" : t.label)}</div>
      <p class="qz-text">${esc(q.text)}</p>
      <form id="qzForm" autocomplete="off">
        <div class="qz-free" id="qzFree"><input id="qzIn" ${q.kind === "number" ? 'inputmode="decimal"' : ""} ${q.kind === "country" ? 'list="qzCountries"' : ""} placeholder="${q.kind === "number" ? "Type a number" : q.kind === "country" ? "Type a country" : "Type your answer"}" aria-label="Your answer">
          ${q.kind === "country" ? `<datalist id="qzCountries">${W.rows.filter((r) => r.sovereign).map((r) => `<option value="${esc(r.name)}"></option>`).join("")}</datalist>` : ""}</div>
        <div class="qz-opts" id="qzOpts" hidden></div>
        <div class="qz-row"><button type="submit" class="primary" id="qzSubmit">Submit guess</button>
          <button type="button" class="linkbtn" id="qzMC">${nOpts === 2 ? "Show the two options" : `Show ${nOpts} options`}</button>
          <button type="button" class="linkbtn qz-skip" id="qzSkip">Skip</button></div>
        <p class="qz-msg" id="qzMsg" aria-live="polite"></p>
      </form>
      <div class="qz-res" id="qzRes" hidden></div>`;
    $("#qzForm").onsubmit = (e) => { e.preventDefault(); submit(); };
    $("#qzMC").onclick = showOptions;
    $("#qzSkip").onclick = () => { seen.add(q.id); store.set("wcq-seen", [...seen].slice(-6000)); ask(); };
    if (window.matchMedia("(hover: hover)").matches) setTimeout(() => $("#qzIn")?.focus({ preventScroll: true }), 30);
  }
  function showOptions() {
    const q = Q.cur;
    if (!q || Q.done) return;
    q._opts ||= q.options ? q.options() : numberOptions(q);
    Q.mc = true;
    $("#qzFree").hidden = true;
    $("#qzMC").hidden = true;
    const box = $("#qzOpts");
    box.hidden = false;
    box.innerHTML = q._opts.map((o, i) => `<button type="button" class="qz-opt" data-i="${i}" aria-pressed="false">${esc(o.label)}</button>`).join("");
    box.querySelectorAll(".qz-opt").forEach((b) => (b.onclick = () => {
      Q.picked = +b.dataset.i;
      box.querySelectorAll(".qz-opt").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      $("#qzMsg").textContent = "";
    }));
  }
  function submit() {
    const q = Q.cur;
    if (!q || Q.done) return;
    let status, guessText;
    if (Q.mc) {
      if (Q.picked == null) { $("#qzMsg").textContent = "Choose one of the options first."; return; }
      const o = q._opts[Q.picked];
      status = o.ok ? "right" : "wrong";
      guessText = o.label;
    } else {
      guessText = $("#qzIn").value.trim();
      if (!guessText) { $("#qzMsg").textContent = "Type a guess, or ask for the options."; return; }
      const res = check(q, guessText);
      if (res.status === "invalid") { $("#qzMsg").textContent = q.kind === "number" ? "Please type a number, like 12 or 3.5 million." : "Type a guess first."; return; }
      if (res.status === "unknown") { $("#qzMsg").textContent = "I don't recognise that country. Check the spelling, or pick from the list as you type."; return; }
      status = res.status;
    }
    Q.done = true;
    seen.add(q.id);
    store.set("wcq-seen", [...seen].slice(-6000));
    score.asked++;
    if (status === "right") { score.right++; score.streak++; score.best = Math.max(score.best, score.streak); } else score.streak = 0;
    store.set("wcq-score", score);
    showScore();
    // lock the answer area
    $("#qzIn") && ($("#qzIn").disabled = true);
    $("#qzSubmit").hidden = true; $("#qzMC").hidden = true; $("#qzSkip").hidden = true; $("#qzMsg").textContent = "";
    if (Q.mc) $("#qzOpts").querySelectorAll(".qz-opt").forEach((b, i) => { b.disabled = true; b.classList.toggle("ok", q._opts[i].ok); b.classList.toggle("no", i === Q.picked && !q._opts[i].ok); });
    const head = { right: ["✓", pick(["Correct!", "Spot on!", "Yes!", "Well done!", "Right!"])], close: ["≈", "Close!"], wrong: ["✗", pick(["Not quite.", "Not this time.", "Good guess, but no."])] }[status];
    const yours = !Q.mc && status !== "right" ? `<p class="qz-yours">You said: ${esc(guessText)}${status === "close" ? " (close, but not counted)" : ""}</p>` : "";
    const res = $("#qzRes");
    res.hidden = false;
    res.className = `qz-res ${status}`;
    res.innerHTML = `<p class="qz-verdict"><span aria-hidden="true">${head[0]}</span> ${head[1]}</p>${yours}
      <p class="qz-explain">${q.explain()}</p>
      <div class="qz-row">${q.action ? `<button type="button" class="ghost" id="qzAct">${esc(q.action.label)}</button>` : ""}<button type="button" class="primary" id="qzNext">Next question →</button></div>`;
    $("#qzNext").onclick = ask;
    if (q.action) $("#qzAct").onclick = () => q.action.run();
    $("#qzNext").focus({ preventScroll: true });
  }

  function init() {
    W = window.WC; F = W.F; esc = W.esc;
    // a Quiz button next to the other tools, to bring the card back
    const b = document.createElement("button");
    b.type = "button"; b.id = "quizBtn"; b.className = "ghost sm"; b.textContent = "🎯 Quiz";
    b.title = "Test yourself with questions from the map's data";
    const tools = $(".viewtools");
    if (tools) tools.insertBefore(b, $("#sbsBtn"));
    b.onclick = () => {
      Q.mode = Q.mode === "open" ? "min" : "open"; Q.keepOpen = Q.mode === "open";
      if (W.state.view !== "map") W.setView("map");
      renderCard();
      if (Q.mode === "open" && !Q.cur) ask();
    };
  }
  window.WQ = { init, renderCard, get size() { return bankSize("any"); }, _test: { check, buildBank: () => (bank ||= buildBank()), resolveCountry, parseNumber, numberOptions, nextQuestion, Q, seen } };
})();
