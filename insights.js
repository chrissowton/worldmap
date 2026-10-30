/* Which Countries? — Insights: patterns the data finds for you.
 *   Strongest links    the measures that rise and fall together most (or most opposite), as rank correlations
 *   Biggest changes    which countries rose or fell most on a measure over the last 5–30 years
 *   Changing stage     countries that moved between demographic transition stages, HDI groups or types of government
 *   Next to cross      who is next to pass a line (100 million people, 80 years life expectancy…) if recent trends go on
 *   Surprising         countries far above or below what one measure would predict from another
 * Everything respects your filters: with filters on, only matching countries are used.
 * Loaded after views.js and charts.js; uses window.WV_H for shared chart state. */
(function () {
  "use strict";
  let W, F, TS, TS_YEARS, esc, fmtShort, H, V;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const TABS = [
    ["links", "Strongest links"], ["changes", "Biggest changes"], ["stages", "Changing stage"], ["cross", "Next to cross a line"], ["odd", "Surprising countries"],
  ];
  const SUM = new Set(["population", "co2_mt", "gdp_usd", "exports_usd", "goods_exports_usd", "services_exports_usd", "elec_twh", "tourists", "refugees_hosted", "refugees_from", "armed_forces", "military_spend_usd", "tourism_receipts_usd"]);
  // measures of a country's size: big countries are big on all of them, so links between two of them say little
  const SIZE = new Set([...SUM, "area_km2", "co2_world_share", "co2_cumulative_share", "oil_twh", "gas_twh", "coal_twh", "patents", "science_articles",
    "cities_1m", "capital_pop", "largest_city_pop", "coastline_km", "tourist_departures", "idps", "asylum_seekers_hosted", "volcanoes", "volcanoes_active", "quakes", "borders"]);
  // indices built from other measures: a link with one of their own parts is no surprise
  const PARTS = {
    hdi: ["life_expectancy", "mean_schooling", "expected_schooling", "gni_ppp", "ihdi", "gdi"], ihdi: ["life_expectancy", "mean_schooling", "expected_schooling", "gni_ppp", "hdi", "gini"],
    gii: ["maternal_mortality", "adolescent_births", "women_parliament", "female_labour"], gdi: ["hdi"], libdem: ["democracy"], sdg_on_track: [], sdg_achieved: ["sdg_on_track"],
    natural_increase: ["birth_rate", "death_rate", "pop_growth"], dependency: ["pct_under15", "pct_over65"], fertility: ["birth_rate"], under5_mortality: ["infant_mortality", "neonatal_mortality"],
    infant_mortality: ["neonatal_mortality"], co2_per_capita: ["co2_consumption_per_capita", "ghg_per_capita"], gdp_per_capita: ["gni_ppp"],
  };
  const isPart = (a, b) => (PARTS[a] || []).includes(b) || (PARTS[b] || []).includes(a);
  const lowerL = (s) => (/^[A-Z][^A-Z]*$/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
  const PRESETS = [
    ["population", 1e8, "The next 100 million country"], ["population", 5e7, "The next to pass 50 million people"],
    ["life_expectancy", 80, "Next to reach a life expectancy of 80"], ["fertility", 2.1, "Next to fall below 2.1 children per woman"],
    ["internet", 50, "Next to have half its people online"], ["urban_pct", 50, "Next to become mostly urban"],
    ["hdi", 0.8, "Next to reach very high human development"], ["electricity", 95, "Next to give 95% of people electricity"],
    ["median_age", 40, "Next to have a median age of 40"], ["renewables_elec_pct", 50, "Next to make half its electricity from renewables"],
  ];

  const ord = (n) => n + (["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");
  function countries() {
    const ms = H.matchSet();
    return W.pool().filter((r) => !ms || ms.has(r.iso3));
  }
  const latest = (r, k) => { const v = W.latest(r, k); return typeof v === "number" && Number.isFinite(v) ? v : null; };
  const yearly = (k) => !!TS[k] && !W.CAT_TS[k];
  const tsAt = (k, iso, y) => W.tsValue(k, iso, y);
  const lastYear = (k) => W.span(k)?.[1];
  function measureList(onlyYearly) {
    return W.numericFilters.filter((f) => !f.target && !f.hidden && f.format !== "rank" && (!onlyYearly || yearly(f.key)));
  }
  const famOf = (k) => (window.FAMILIES || []).find((fam) => fam.variants.some(([x]) => x === k))?.id || k;

  function shell() {
    return `<div class="vhead"><div class="ctabs itabs" role="tablist" aria-label="Insight">${TABS.map(([id, l]) => `<button type="button" role="tab" data-it="${id}">${l}</button>`).join("")}</div></div>
      <div class="vbody scroll ibody" id="vbody"></div>
      <div class="vfoot"><p class="vnote" id="iNote"></p></div>`;
  }
  function bind() {
    W = window.WC; F = W.F; TS = W.TS; TS_YEARS = W.TS_YEARS; esc = W.esc; fmtShort = W.fmtShort; H = window.WV_H; V = H.V;
    V.ins ||= { tab: "links", a: "", per: 10, ck: "birth_rate", cy: 10, mode: "abs", xk: "population", thr: 1e8, ox: "gdp_per_capita", oy: "life_expectancy", stages: 20, diff: true };
    $$(".itabs button").forEach((b) => (b.onclick = () => { V.ins.tab = b.dataset.it; W.render(); }));
  }
  function draw() {
    if (!W) bind();
    const s = V.ins;
    $$(".itabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.it === s.tab)));
    const ms = H.matchSet();
    const scope = ms ? `Using the <b>${ms.size}</b> countries that match your filters.` : `Using all ${W.pool().length} countries.`;
    const body = $("#vbody");
    V.list = null;
    s.srcKeys = [];
    ({ links: drawLinks, changes: drawChanges, stages: drawStages, cross: drawCross, odd: drawOdd })[s.tab](body);
    $("#iNote").innerHTML = scope + " " + ($("#iNote").dataset.extra || "");
    V.title = TABS.find((t) => t[0] === s.tab)[1];
  }
  const pick = (id, label, sel, list, extra = "") => `<label class="fld"><span>${label}</span><select id="${id}" data-pick>${extra}${optgroups(list, sel)}</select></label>`;
  function optgroups(list, sel) {
    return window.FILTER_GROUPS.map((g) => {
      const fs = list.filter((f) => f.group === g).sort((a, b) => a.label.localeCompare(b.label));
      return fs.length ? `<optgroup label="${esc(g)}">${fs.map((f) => `<option value="${f.key}" ${f.key === sel ? "selected" : ""}>${esc(f.label)}</option>`).join("")}</optgroup>` : "";
    }).join("");
  }
  const note = (t) => { $("#iNote").dataset.extra = t; };
  function goCompare(x, y, pins) { V.cmp.x = x; V.cmp.y = y; V.cmp.logx = null; V.cmp.logy = null; V.cmp.year = null; if (pins) V.cmp.pins = pins.slice(0, 8); W.setView("compare"); }
  function goLine(key, pins) { Object.assign(V.trend, { key, type: "line", agg: null, year: null, from: null, log: null, pins: pins.slice(0, 6), conts: false, world: true }); W.setView("trends"); }

  // ======================= Strongest links =======================
  function spearmanTable(keys, rs) {
    // ranks of each measure across the countries (ties share the average rank)
    const R = keys.map((k) => {
      const vals = rs.map((r) => latest(r, k));
      const idx = vals.map((v, i) => [v, i]).filter((x) => x[0] != null).sort((a, b) => a[0] - b[0]);
      const rk = new Array(rs.length).fill(null);
      for (let i = 0; i < idx.length;) {
        let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
        for (let q = i; q <= j; q++) rk[idx[q][1]] = (i + j) / 2;
        i = j + 1;
      }
      return rk;
    });
    return R;
  }
  function corr(a, b, minN) {
    let n = 0, sa = 0, sb = 0;
    for (let i = 0; i < a.length; i++) if (a[i] != null && b[i] != null) { n++; sa += a[i]; sb += b[i]; }
    if (n < minN) return null;
    const ma = sa / n, mb = sb / n;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < a.length; i++) if (a[i] != null && b[i] != null) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y; }
    return da && db ? { r: num / Math.sqrt(da * db), n } : null;
  }
  function drawLinks(body) {
    const s = V.ins;
    const rs = countries();
    const fs = measureList(false);
    const keys = fs.map((f) => f.key);
    const minN = Math.max(12, Math.min(40, Math.floor(rs.length * 0.5)));
    const R = spearmanTable(keys, rs);
    const pairs = [];
    const ai = s.a ? keys.indexOf(s.a) : -1;
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
      if (ai >= 0 && i !== ai && j !== ai) continue;
      const fi = F[keys[i]], fj = F[keys[j]];
      if (famOf(keys[i]) === famOf(keys[j])) continue;
      if (s.diff && fi.group === fj.group) continue;
      if (s.diff && (SIZE.has(keys[i]) && SIZE.has(keys[j]) || isPart(keys[i], keys[j]))) continue;
      const c = corr(R[i], R[j], minN);
      // near-perfect links are usually the same thing measured twice (forest cover and forest land)
      if (c && Math.abs(c.r) < 0.97) pairs.push({ a: keys[i], b: keys[j], ...c });
    }
    // keep the list varied: each measure appears at most twice (unless you picked one)
    const varied = (list) => { const n = new Map(), out = []; for (const p of list) { if (ai < 0 && ((n.get(p.a) || 0) >= 2 || (n.get(p.b) || 0) >= 2)) continue; out.push(p); n.set(p.a, (n.get(p.a) || 0) + 1); n.set(p.b, (n.get(p.b) || 0) + 1); if (out.length >= 12) break; } return out; };
    const pos = varied(pairs.filter((p) => p.r > 0).sort((x, y) => y.r - x.r));
    const neg = varied(pairs.filter((p) => p.r < 0).sort((x, y) => x.r - y.r));
    const word = (r) => { const a = Math.abs(r); return a >= 0.8 ? "very strong" : a >= 0.6 ? "strong" : a >= 0.4 ? "moderate" : "weak"; };
    const row = (p) => `<button type="button" class="irow" data-a="${p.a}" data-b="${p.b}">
        <span class="ipair"><b>${esc(F[p.a].label)}</b> <span class="iand">${p.r > 0 ? "rises with" : "falls as"}</span> <b>${esc(F[p.b].label)}</b> <small>rises · ${word(p.r)} · ${p.n} countries</small></span>
        <span class="ibar"><span style="width:${Math.abs(p.r) * 100}%;background:${p.r > 0 ? "var(--s1)" : "var(--c-asia)"}"></span></span><span class="num ir">${p.r > 0 ? "+" : "−"}${Math.abs(p.r).toFixed(2)}</span></button>`;
    body.innerHTML = `<div class="ictrls">${pick("iA", "Links with", s.a, measureList(false), `<option value="">Any measure</option>`)}
        <label class="tog" title="Leaves out pairs from the same topic, pairs of size measures (big countries are big on everything) and indices paired with their own parts"><input type="checkbox" id="iDiff" ${s.diff ? "checked" : ""}> Hide the obvious ones</label></div>
      <div class="icols"><section><h3>Rise together</h3>${pos.map(row).join("") || "<p class='sub'>None found.</p>"}</section>
      <section><h3>One rises as the other falls</h3>${neg.map(row).join("") || "<p class='sub'>None found.</p>"}</section></div>`;
    $("#iA").onchange = (e) => { s.a = e.target.value; W.render(); };
    $("#iDiff").onchange = (e) => { s.diff = e.target.checked; W.render(); };
    $$(".irow", body).forEach((b) => (b.onclick = () => goCompare(b.dataset.b, b.dataset.a)));
    s.srcKeys = s.a ? [s.a] : [];
    note(`The number is a rank correlation (Spearman's ρ) from −1 to +1, using each country's latest figures: +1 means the countries line up in exactly the same order on both measures. <b>A link doesn't prove that one causes the other</b>: both may depend on something else, such as wealth. Click a pair to see it in Compare.`);
  }

  // ======================= Biggest changes =======================
  function drawChanges(body) {
    const s = V.ins;
    if (!yearly(s.ck)) s.ck = "birth_rate";
    const f = F[s.ck], y1 = lastYear(s.ck), y0 = y1 - s.cy;
    const rows = countries().map((r) => {
      const a = tsAt(s.ck, r.iso3, y0), b = tsAt(s.ck, r.iso3, y1);
      if (a == null || b == null) return null;
      const d = b - a, p = a ? (100 * d) / Math.abs(a) : null;
      return { r, a, b, d, p, k: s.mode === "pct" ? p : d };
    }).filter((x) => x && x.k != null);
    const up = rows.slice().sort((x, y) => y.k - x.k).slice(0, 10).filter((x) => x.k > 0);
    const down = rows.slice().sort((x, y) => x.k - y.k).slice(0, 10).filter((x) => x.k < 0);
    const fmtD = (x) => (s.mode === "pct" ? `${x.p > 0 ? "+" : "−"}${Math.abs(x.p).toFixed(Math.abs(x.p) < 10 ? 1 : 0)}%` : `${x.d > 0 ? "+" : "−"}${fmtShort(f, Math.abs(x.d))}`);
    const row = (x, i) => `<button type="button" class="irow" data-iso="${x.r.iso3}"><span class="rk num">${i + 1}</span><span class="ipair"><span class="fl">${x.r.flag || ""}</span> <b>${esc(x.r.name)}</b> <small>${esc(fmtShort(f, x.a))} → ${esc(fmtShort(f, x.b))}</small></span><span class="num idelta ${x.d > 0 ? "up" : "down"}">${fmtD(x)}</span></button>`;
    body.innerHTML = `<div class="ictrls">${pick("iC", "Measure", s.ck, measureList(true))}
        <label class="fld"><span>Over the last</span><select id="iCy">${[5, 10, 20, 30].map((n) => `<option value="${n}" ${n === s.cy ? "selected" : ""}>${n} years</option>`).join("")}</select></label>
        <div class="seg" role="radiogroup" aria-label="Change as"><button type="button" role="radio" data-m="abs" aria-checked="${s.mode === "abs"}">Change</button><button type="button" role="radio" data-m="pct" aria-checked="${s.mode === "pct"}">% change</button></div></div>
      <p class="ihead">${esc(f.label)}, ${y0} to ${y1}</p>
      <div class="icols"><section><h3>Biggest rises</h3>${up.map(row).join("") || "<p class='sub'>No rises.</p>"}</section>
      <section><h3>Biggest falls</h3>${down.map(row).join("") || "<p class='sub'>No falls.</p>"}</section></div>`;
    $("#iC").onchange = (e) => { s.ck = e.target.value; W.render(); };
    $("#iCy").onchange = (e) => { s.cy = +e.target.value; W.render(); };
    $$(".seg button[data-m]", body).forEach((b) => (b.onclick = () => { s.mode = b.dataset.m; W.render(); }));
    $$(".irow", body).forEach((b) => (b.onclick = () => goLine(s.ck, [b.dataset.iso, ...(b.closest("section").querySelectorAll(".irow").length ? [...b.closest("section").querySelectorAll(".irow")].map((x) => x.dataset.iso).filter((x) => x !== b.dataset.iso).slice(0, 2) : [])])));
    s.srcKeys = [s.ck];
    V.csv = () => [["Country", `${f.label} ${y0}`, `${f.label} ${y1}`, "Change", "% change"], ...rows.sort((x, y) => y.k - x.k).map((x) => [x.r.name, x.a, x.b, x.d, x.p])];
    note(`Compares each country's figure in ${y0} with ${y1} (or the closest year in the 4 before, if a year is missing). Click a country to see its line in Charts.`);
  }

  // ======================= Changing stage =======================
  const HDI_GROUPS = [[0, "Low"], [0.55, "Medium"], [0.7, "High"], [0.8, "Very high"]];
  const hdiGroup = (v) => (v == null ? null : HDI_GROUPS.filter(([t]) => v >= t).length - 1);
  function drawStages(body) {
    const s = V.ins;
    const rs = countries();
    const span = s.stages;
    const sections = [];
    // demographic transition stage
    const DT = W.CAT_TS.dtm_stage || [];
    const y1 = lastYear("birth_rate") || TS_YEARS[TS_YEARS.length - 1], y0 = y1 - span;
    const moved = (key, labels, fromV, toV) => rs.map((r) => {
      const a = fromV(r), b = toV(r);
      return a == null || b == null || a === b ? null : { r, a, b, up: b > a };
    }).filter(Boolean);
    if (DT.length) {
      const m = moved("dtm_stage", DT, (r) => tsAt("dtm_stage", r.iso3, y0), (r) => tsAt("dtm_stage", r.iso3, y1));
      sections.push({ title: "Demographic transition stage", sub: `${y0} → ${y1}`, labels: DT.map((x) => x.split(" · ")[0]), m, key: "birth_rate" });
    }
    const hy1 = lastYear("hdi"), hy0 = hy1 - span;
    if (hy1) {
      const m = moved("hdi", null, (r) => hdiGroup(tsAt("hdi", r.iso3, hy0)), (r) => hdiGroup(tsAt("hdi", r.iso3, hy1)));
      sections.push({ title: "Human development group", sub: `${hy0} → ${hy1}`, labels: HDI_GROUPS.map((x) => x[1]), m, key: "hdi" });
    }
    const REG = W.CAT_TS.regime || [];
    const ry1 = lastYear("regime") || 2025, ry0 = ry1 - span;
    if (REG.length) {
      const m = moved("regime", REG, (r) => tsAt("regime", r.iso3, ry0), (r) => tsAt("regime", r.iso3, ry1));
      sections.push({ title: "Type of government", sub: `${ry0} → ${ry1}`, labels: REG, m, key: "libdem", upWord: "More democratic", downWord: "Less democratic" });
    }
    // close to the next HDI group and rising
    const near = rs.map((r) => {
      const v = tsAt("hdi", r.iso3, hy1), v5 = tsAt("hdi", r.iso3, hy1 - 5);
      if (v == null || v5 == null || v5 >= v) return null;
      const g = hdiGroup(v), next = HDI_GROUPS[g + 1];
      if (!next || next[0] - v > 0.02) return null;
      return { r, v, next };
    }).filter(Boolean).sort((a, b) => (a.next[0] - a.v) - (b.next[0] - b.v));
    const chip = (lab) => `<span class="istage">${esc(lab)}</span>`;
    const list = (sec, up) => sec.m.filter((x) => x.up === up).sort((a, b) => Math.abs(b.b - b.a) - Math.abs(a.b - a.a) || a.r.name.localeCompare(b.r.name))
      .map((x) => `<button type="button" class="irow" data-iso="${x.r.iso3}" data-k="${sec.key}"><span class="ipair"><span class="fl">${x.r.flag || ""}</span> <b>${esc(x.r.name)}</b></span><span class="isteps">${chip(sec.labels[x.a])} → ${chip(sec.labels[x.b])}</span></button>`).join("");
    body.innerHTML = `<div class="ictrls"><label class="fld"><span>Over the last</span><select id="iSy">${[10, 20, 30].map((n) => `<option value="${n}" ${n === span ? "selected" : ""}>${n} years</option>`).join("")}</select></label></div>
      ${sections.map((sec) => `<h2 class="isec">${esc(sec.title)} <small>${sec.sub}</small></h2><div class="icols">
        <section><h3>${sec.upWord || "Moved up"} (${sec.m.filter((x) => x.up).length})</h3>${list(sec, true) || "<p class='sub'>None.</p>"}</section>
        <section><h3>${sec.downWord || "Moved down"} (${sec.m.filter((x) => !x.up).length})</h3>${list(sec, false) || "<p class='sub'>None.</p>"}</section></div>`).join("")}
      <h2 class="isec">About to move up a human development group <small>within 0.02 of the next group and rising</small></h2>
      <div class="ilist">${near.map((x) => `<button type="button" class="irow" data-iso="${x.r.iso3}" data-k="hdi"><span class="ipair"><span class="fl">${x.r.flag || ""}</span> <b>${esc(x.r.name)}</b> <small>HDI ${x.v.toFixed(3)}</small></span><span class="isteps">→ ${chip(x.next[1])} at ${x.next[0].toFixed(3)}</span></button>`).join("") || "<p class='sub'>None right now.</p>"}</div>`;
    $("#iSy").onchange = (e) => { s.stages = +e.target.value; W.render(); };
    $$(".irow", body).forEach((b) => (b.onclick = () => goLine(b.dataset.k, [b.dataset.iso])));
    s.srcKeys = ["dtm_stage", "hdi", "regime"];
    note(`Demographic transition stages are worked out from birth and death rates; human development groups use the UNDP's cut-offs (0.550, 0.700, 0.800); types of government come from V-Dem. Click a country to see the trend behind it.`);
  }

  // ======================= Next to cross a line =======================
  function project(key, iso, thr) {
    const y1 = lastYear(key);
    if (!y1) return null;
    const v1 = tsAt(key, iso, y1), v0 = tsAt(key, iso, y1 - 10);
    if (v1 == null || v0 == null) return null;
    const up = thr > v1;
    if ((up && v1 >= thr) || (!up && v1 <= thr)) return null;
    let years;
    if (SUM.has(key) && v0 > 0 && v1 > 0) {
      const g = Math.log(v1 / v0) / 10;  // growth per year, compounding
      if ((up && g <= 0) || (!up && g >= 0)) return { v1, v0, never: true };
      years = Math.log(thr / v1) / g;
    } else {
      const slope = (v1 - v0) / 10;
      if ((up && slope <= 0) || (!up && slope >= 0)) return { v1, v0, never: true };
      years = (thr - v1) / slope;
    }
    return { v1, v0, year: Math.round(y1 + years), y1 };
  }
  function drawCross(body) {
    const s = V.ins;
    if (!yearly(s.xk)) s.xk = "population";
    const f = F[s.xk];
    const rows = countries().map((r) => ({ r, p: project(s.xk, r.iso3, s.thr) })).filter((x) => x.p && !x.p.never && x.p.year <= 2100)
      .sort((a, b) => a.p.year - b.p.year || a.r.name.localeCompare(b.r.name));
    const already = countries().filter((r) => { const v = tsAt(s.xk, r.iso3, lastYear(s.xk)); return v != null && (rows.length && rows[0].p.v1 < s.thr ? v >= s.thr : v <= s.thr); }).length;
    const up = rows.length ? rows[0].p.v1 < s.thr : true;
    body.innerHTML = `<div class="ictrls">${pick("iX", "Measure", s.xk, measureList(true))}
        <label class="fld"><span>Line to cross</span><input id="iThr" value="${esc(fmtShort(f, s.thr))}" inputmode="decimal" class="ithr"></label>
        <div class="ipresets">${PRESETS.filter(([k]) => F[k]).map(([k, t, l], i) => `<button type="button" data-i="${i}" class="${k === s.xk && t === s.thr ? "on" : ""}">${esc(l)}</button>`).join("")}</div></div>
      <p class="ihead">Next to ${up ? "reach" : "fall to"} ${esc(fmtShort(f, s.thr))}: ${esc(lowerL(f.label))}${already ? ` <small>(${already} countries are already there)</small>` : ""}</p>
      <div class="ilist">${rows.slice(0, 15).map((x, i) => `<button type="button" class="irow" data-iso="${x.r.iso3}"><span class="rk num">${i + 1}</span><span class="ipair"><span class="fl">${x.r.flag || ""}</span> <b>${esc(x.r.name)}</b> <small>now ${esc(fmtShort(f, x.p.v1))} (${x.p.y1}), was ${esc(fmtShort(f, x.p.v0))} ten years before</small></span><span class="idir ${x.p.v1 > x.p.v0 ? "up" : "down"}" title="${x.p.v1 > x.p.v0 ? "Rising: coming up to the line from below" : "Falling: coming down to the line from above"}">${x.p.v1 > x.p.v0 ? "▲" : "▼"}</span><span class="num iyear">${x.p.year <= x.p.y1 + 1 ? "about now" : `around ${x.p.year}`}</span></button>`).join("") || "<p class='sub'>No country is heading for this line at its current speed.</p>"}</div>`;
    $("#iX").onchange = (e) => { s.xk = e.target.value; const v = d3.median(countries().map((r) => latest(r, s.xk)).filter((x) => x != null)); s.thr = +(+v.toPrecision(2)); W.render(); };
    $("#iThr").onchange = (e) => { const v = parseFloat(String(e.target.value).replace(/[, %$]/g, "").replace(/(\d)(k)$/i, "$1e3").replace(/(\d)(m)$/i, "$1e6").replace(/(\d)(bn|b)$/i, "$1e9")); if (Number.isFinite(v)) { s.thr = v; W.render(); } };
    $$(".ipresets button", body).forEach((b) => (b.onclick = () => { const [k, t] = PRESETS[+b.dataset.i]; s.xk = k; s.thr = t; W.render(); }));
    $$(".irow", body).forEach((b) => (b.onclick = () => goLine(s.xk, [b.dataset.iso, ...rows.slice(0, 3).map((x) => x.r.iso3).filter((x) => x !== b.dataset.iso)].slice(0, 4))));
    s.srcKeys = [s.xk];
    V.csv = () => [["Country", `${f.label} now`, "Ten years before", "Projected year"], ...rows.map((x) => [x.r.name, x.p.v1, x.p.v0, x.p.year])];
    note(`A simple projection: if each country keeps changing at the same speed as over the last ten years (${SUM.has(s.xk) ? "the same percentage growth each year" : "the same amount each year"}). Real trends speed up and slow down, so treat the years as a rough guide, not a forecast.`);
  }

  // ======================= Surprising countries =======================
  function drawOdd(body) {
    const s = V.ins;
    const fx = F[s.ox], fy = F[s.oy];
    const logx = fx.scale === "log";
    const pts = countries().map((r) => ({ r, x: latest(r, s.ox), y: latest(r, s.oy) })).filter((p) => p.x != null && p.y != null && (!logx || p.x > 0));
    let rows = [], fitR = null;
    if (pts.length >= 10) {
      const X = pts.map((p) => (logx ? Math.log10(p.x) : p.x)), Y = pts.map((p) => p.y);
      const mx = d3.mean(X), my = d3.mean(Y);
      let sxy = 0, sxx = 0, syy = 0;
      X.forEach((x, i) => { sxy += (x - mx) * (Y[i] - my); sxx += (x - mx) ** 2; syy += (Y[i] - my) ** 2; });
      const b = sxy / sxx, a = my - b * mx;
      fitR = sxy / Math.sqrt(sxx * syy);
      rows = pts.map((p, i) => ({ ...p, exp: a + b * X[i], res: Y[i] - (a + b * X[i]) }));
    }
    const above = rows.slice().sort((p, q) => q.res - p.res).slice(0, 10);
    const below = rows.slice().sort((p, q) => p.res - q.res).slice(0, 10);
    const row = (p) => `<button type="button" class="irow" data-iso="${p.r.iso3}"><span class="ipair"><span class="fl">${p.r.flag || ""}</span> <b>${esc(p.r.name)}</b> <small>${esc(fy.short || fy.label)} ${esc(fmtShort(fy, p.y))}, expected about ${esc(fmtShort(fy, p.exp))} from its ${esc(lowerL(fx.short || fx.label))} (${esc(fmtShort(fx, p.x))})</small></span><span class="num idelta ${p.res > 0 ? "up" : "down"}">${p.res > 0 ? "+" : "−"}${esc(fmtShort(fy, Math.abs(p.res)))}</span></button>`;
    body.innerHTML = `<div class="ictrls">${pick("iOx", "Expected from", s.ox, measureList(false))}${pick("iOy", "Measure", s.oy, measureList(false))}</div>
      <p class="ihead">${esc(fy.label)} compared with what ${esc(lowerL(fx.label))} would predict${fitR != null ? ` <small>(the link is ${Math.abs(fitR) >= 0.6 ? "strong" : Math.abs(fitR) >= 0.4 ? "moderate" : "weak"}: r = ${fitR.toFixed(2)})</small>` : ""}</p>
      <div class="icols"><section><h3>Much higher than expected</h3>${above.map(row).join("") || "<p class='sub'>Not enough data.</p>"}</section>
      <section><h3>Much lower than expected</h3>${below.map(row).join("") || "<p class='sub'>Not enough data.</p>"}</section></div>`;
    $("#iOx").onchange = (e) => { s.ox = e.target.value; W.render(); };
    $("#iOy").onchange = (e) => { s.oy = e.target.value; W.render(); };
    $$(".irow", body).forEach((b) => (b.onclick = () => goCompare(s.ox, s.oy, [b.dataset.iso])));
    s.srcKeys = [s.oy, s.ox];
    V.csv = () => [["Country", fx.label, fy.label, "Expected", "Difference"], ...rows.map((p) => [p.r.name, p.x, p.y, +p.exp.toFixed(3), +p.res.toFixed(3)])];
    note(`“Expected” comes from a straight line of best fit through all the countries${logx ? ` (using a log scale for ${esc(lowerL(fx.label))})` : ""}. Countries far from the line are the interesting ones to explain: history, resources, conflict or policy often play a part. Click a country to see it in Compare.`);
  }

  function encode(p) {
    const s = window.WV_H.V.ins;
    if (!s) return;
    p.set("it", s.tab);
  }
  function decode(p) {
    const V0 = window.WV_H.V;
    if (TABS.some(([id]) => id === p.get("it"))) { V0.ins ||= { tab: "links", a: "", per: 10, ck: "birth_rate", cy: 10, mode: "abs", xk: "population", thr: 1e8, ox: "gdp_per_capita", oy: "life_expectancy", stages: 20, diff: true }; V0.ins.tab = p.get("it"); }
  }
  window.WIN = { shell, bind, draw, encode, decode };
})();
