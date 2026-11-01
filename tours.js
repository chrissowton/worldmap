/* Teaching tools:
   - Guided tours: a teacher sets up the map step by step, adds a caption to each, and shares one link.
     Students click Next to go through it.
   - Curriculum: exam-board units (GCSE and A level) with ready-made maps for each.
   - A short first-visit tour of the site (the words are in INTRO below, easy to change). */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let W;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  // a tour in the link: ?tour=… (read now, before the page rewrites its address)
  const b64e = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const b64d = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));
  let playing = null; // { t: title, s: [[qs, caption]], i }
  try {
    const raw = new URLSearchParams(location.search).get("tour");
    if (raw) { const o = JSON.parse(b64d(raw)); if (o && Array.isArray(o.s) && o.s.length) playing = { t: String(o.t || "Guided tour").slice(0, 120), s: o.s.slice(0, 30).map(([q, c]) => [String(q), String(c || "").slice(0, 600)]), i: 0, raw }; }
  } catch (e) { playing = null; }

  // ====================== Guided tours ======================
  const draft = Object.assign({ t: "", s: [] }, store.get("wc-tour", {}));
  const saveDraft = () => store.set("wc-tour", draft);
  const tourURL = () => {
    const base = (W.SITE?.url && /^https?:/.test(W.SITE.url) ? W.SITE.url.replace(/\/?$/, "/") : location.origin + location.pathname);
    return `${base}?tour=${b64e(JSON.stringify({ t: draft.t || "Guided tour", s: draft.s.map(([q, c]) => [q, c]) }))}`;
  };
  const sentence = () => ($("#sentence")?.textContent || "").replace(/Clear all$/, "").trim();
  function builder() {
    let el = $("#tourCard");
    if (!el) { el = document.createElement("div"); el.id = "tourCard"; el.className = "card dsc tour"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Build a guided tour"); document.body.appendChild(el); }
    el.hidden = false;
    el.innerHTML = `<div class="dsc-head"><h2>🧭 Guided tour</h2><button type="button" class="iconbtn" id="trX" aria-label="Close">×</button></div>
      <p class="hint">Set up the map (filters, year, map style or chart), write what students should notice, and press <b>Add this view</b>. Repeat, then share one link. Students click Next to go through it.</p>
      <label class="fld">Title <input id="trTitle" type="text" maxlength="120" placeholder="e.g. Why is fertility falling?" value="${esc(draft.t)}"></label>
      <label class="fld">Caption for the view on screen now <textarea id="trCap" rows="2" maxlength="600" placeholder="e.g. Look at sub-Saharan Africa. Which countries still have fertility above 5?"></textarea></label>
      <div class="dsc-row"><button type="button" class="primary" id="trAdd">＋ Add this view</button></div>
      <ol class="tr-steps">${draft.s.map(([q, c], i) => `<li data-i="${i}"><div class="tr-txt"><b>${esc(c || "(no caption)")}</b><small>${esc(draft.s[i][2] || (q ? "Saved view" : "The starting map"))}</small></div>
        <span class="tr-btns"><button type="button" class="iconbtn" data-a="go" title="Show this view">👁</button><button type="button" class="iconbtn" data-a="up" title="Move up" ${i ? "" : "disabled"}>↑</button><button type="button" class="iconbtn" data-a="down" title="Move down" ${i < draft.s.length - 1 ? "" : "disabled"}>↓</button><button type="button" class="iconbtn" data-a="edit" title="Change the caption">✎</button><button type="button" class="iconbtn" data-a="del" title="Remove">×</button></span></li>`).join("")}</ol>
      ${draft.s.length ? `<label class="fld">Link to share <div class="copyrow"><input id="trLink" readonly value="${esc(tourURL())}"><button type="button" class="primary" id="trCopy">Copy</button></div></label>
        <div class="dsc-row"><button type="button" class="ghost" id="trPlay">▶ Try it</button><button type="button" class="ghost" id="trClear">Start a new tour</button></div>
        <p class="hint" id="trMsg">${draft.s.length} step${draft.s.length > 1 ? "s" : ""}. Your tour is kept in this browser until you start a new one.</p>` : `<p class="hint">No steps yet.</p>`}`;
    $("#trX").onclick = () => (el.hidden = true);
    $("#trTitle").oninput = (e) => { draft.t = e.target.value; saveDraft(); const l = $("#trLink"); if (l) l.value = tourURL(); };
    $("#trAdd").onclick = () => { draft.s.push([W.getQS(), $("#trCap").value.trim() || sentence(), sentence()]); saveDraft(); builder(); };
    el.querySelectorAll(".tr-steps li").forEach((li) => li.querySelectorAll("button").forEach((b) => (b.onclick = () => {
      const i = +li.dataset.i, a = b.dataset.a;
      if (a === "go") return W.applyQS(draft.s[i][0]);
      if (a === "up") [draft.s[i - 1], draft.s[i]] = [draft.s[i], draft.s[i - 1]];
      if (a === "down") [draft.s[i + 1], draft.s[i]] = [draft.s[i], draft.s[i + 1]];
      if (a === "del") draft.s.splice(i, 1);
      if (a === "edit") { const c = prompt("Caption for this step", draft.s[i][1]); if (c == null) return; draft.s[i][1] = c.slice(0, 600); }
      saveDraft(); builder();
    })));
    if ($("#trCopy")) $("#trCopy").onclick = async () => { const inp = $("#trLink"); try { await navigator.clipboard.writeText(inp.value); $("#trMsg").textContent = "Copied. Paste it into your class page, an email or a slide."; } catch (e) { inp.select(); } };
    if ($("#trPlay")) $("#trPlay").onclick = () => { el.hidden = true; play({ t: draft.t || "Guided tour", s: draft.s.map(([q, c]) => [q, c]), i: 0 }); };
    if ($("#trClear")) $("#trClear").onclick = () => { if (!confirm("Start a new tour? This one will be cleared.")) return; draft.t = ""; draft.s = []; saveDraft(); builder(); };
  }

  function play(t) { playing = t; go(t.i || 0); }
  function go(i) {
    if (!playing) return;
    playing.i = Math.max(0, Math.min(playing.s.length - 1, i));
    W.applyQS(playing.s[playing.i][0]);
    bar();
  }
  function bar() {
    let el = $("#tourbar");
    if (!el) { el = document.createElement("div"); el.id = "tourbar"; el.className = "tourbar"; el.setAttribute("aria-live", "polite"); const c = $(".content"); c ? c.prepend(el) : document.body.prepend(el); }
    if (!playing) { el.hidden = true; return; }
    const { t, s, i } = playing;
    el.hidden = false;
    el.innerHTML = `<span class="tb-t">🧭 ${esc(t)}</span><span class="tb-n">Step ${i + 1} of ${s.length}</span>
      <p class="tb-c">${esc(s[i][1])}</p>
      <span class="tb-b"><button type="button" class="ghost" id="tbPrev" ${i ? "" : "disabled"}>← Back</button>${i < s.length - 1 ? `<button type="button" class="primary" id="tbNext">Next →</button>` : `<button type="button" class="primary" id="tbEnd">Finish</button>`}<button type="button" class="iconbtn" id="tbX" aria-label="Leave the tour">×</button></span>`;
    $("#tbPrev").onclick = () => go(i - 1);
    if ($("#tbNext")) $("#tbNext").onclick = () => go(i + 1);
    const stop = () => { playing = null; bar(); W.render(); };
    if ($("#tbEnd")) $("#tbEnd").onclick = stop;
    $("#tbX").onclick = stop;
  }

  // ====================== Curriculum ======================
  // Unit names follow the current GCSE (9–1) and A-level specifications. Each unit lists maps to start from:
  //   m: shade the world by a measure · f: [key, min] countries above a value · q: a link query · p: physical geography
  const BOARDS = ["AQA GCSE", "Edexcel GCSE A", "Edexcel GCSE B", "OCR GCSE A", "OCR GCSE B", "AQA A level", "Edexcel A level", "OCR A level"];
  const UNITS = [
    { n: "Tectonic hazards", b: { "AQA GCSE": "The challenge of natural hazards", "Edexcel GCSE B": "Hazardous Earth", "OCR GCSE B": "Global hazards", "AQA A level": "Hazards", "Edexcel A level": "Tectonic processes and hazards", "OCR A level": "Hazardous Earth" },
      l: [{ t: "Earthquakes by country", m: "quakes", p: 1 }, { t: "Volcanoes by country", m: "volcanoes", p: 1 }, { t: "Plate boundaries", q: "m=p&pb=plates" }, { t: "Had a disaster in the last 5 years", m: "wrp_disaster_5y" }, { t: "Is the government prepared?", m: "wrp_gov_prepared" }] },
    { n: "Weather hazards and climate change", b: { "AQA GCSE": "The challenge of natural hazards", "Edexcel GCSE A": "Weather hazards and climate change", "Edexcel GCSE B": "Hazardous Earth", "OCR GCSE A": "Environmental threats to our planet", "OCR GCSE B": "Changing climate", "OCR A level": "Climate change (option)" },
      l: [{ t: "CO₂ per person", m: "co2_per_capita" }, { t: "Share of all CO₂ since 1850", m: "co2_cumulative_share" }, { t: "Share of global warming caused", m: "warming_share" }, { t: "People who say climate change is a serious threat", m: "wrp_climate_serious" }, { t: "Worried about severe weather", m: "wrp_worry_weather" }] },
    { n: "Ecosystems, biomes and forests", b: { "AQA GCSE": "The living world", "Edexcel GCSE A": "Ecosystems, biodiversity and management", "Edexcel GCSE B": "People and the biosphere; Forests under threat", "OCR GCSE A": "Ecosystems of the planet", "OCR GCSE B": "Sustaining ecosystems", "AQA A level": "Ecosystems under stress" },
      l: [{ t: "World biomes", q: "m=p&pb=biomes" }, { t: "Forest cover", m: "forest_pct" }, { t: "Protected land", m: "protected_land_pct" }, { t: "Farmland (arable)", m: "arable_pct", p: 1 }, { t: "Climate zones", q: "m=p&pb=climate" }] },
    { n: "Hot deserts and cold environments", b: { "AQA GCSE": "The living world (hot deserts / cold environments)", "AQA A level": "Hot desert systems and landscapes; Glacial systems and landscapes" },
      l: [{ t: "Share of land with a dry climate", m: "dry_climate_pct" }, { t: "Rainfall", m: "rainfall_mm" }, { t: "Glacier cover", m: "glacier_pct", p: 1 }, { t: "Landforms and deserts", q: "m=p" }] },
    { n: "Landscapes: rivers, coasts and glaciers", b: { "AQA GCSE": "Physical landscapes in the UK", "Edexcel GCSE A": "Changing landscapes of the UK", "OCR GCSE A": "Landscapes of the UK", "OCR GCSE B": "Distinctive landscapes", "AQA A level": "Coastal systems and landscapes; Glacial systems", "Edexcel A level": "Landscape systems, processes and change", "OCR A level": "Landscape systems" },
      l: [{ t: "Longest river", m: "longest_river_km", p: 1 }, { t: "Length of coastline", m: "coastline_km", p: 1 }, { t: "Mountainous land", m: "mountain_pct", p: 1 }, { t: "Glaciers", m: "glacier_km2", p: 1 }] },
    { n: "Global development", b: { "AQA GCSE": "The changing economic world", "Edexcel GCSE A": "Global development", "Edexcel GCSE B": "Development dynamics", "OCR GCSE A": "People of the planet", "OCR GCSE B": "Dynamic development" },
      l: [{ t: "GDP per person", m: "gdp_per_capita" }, { t: "Human Development Index", m: "hdi" }, { t: "Life expectancy", m: "life_expectancy" }, { t: "Extreme poverty", m: "extreme_poverty" }, { t: "Inequality (Gini)", m: "gini" }, { t: "GDP and life expectancy compared", q: "v=compare" }] },
    { n: "Population and the demographic transition", b: { "AQA GCSE": "The changing economic world (DTM)", "Edexcel GCSE B": "Development dynamics", "OCR GCSE B": "Dynamic development", "AQA A level": "Population and the environment" },
      l: [{ t: "Fertility rate", m: "fertility" }, { t: "Birth rate", m: "birth_rate" }, { t: "Death rate", m: "death_rate" }, { t: "Median age", m: "median_age" }, { t: "Over 65s", m: "pct_over65" }, { t: "Changing stage (Insights)", q: "v=insights" }] },
    { n: "Urbanisation and cities", b: { "AQA GCSE": "Urban issues and challenges", "Edexcel GCSE A": "Changing cities", "Edexcel GCSE B": "Challenges of an urbanising world", "OCR GCSE A": "People of the planet", "OCR GCSE B": "Urban futures", "AQA A level": "Contemporary urban environments" },
      l: [{ t: "Living in towns and cities", m: "urban_pct" }, { t: "Cities over 5 million", f: ["city_population", 5e6] }, { t: "Cities of a million or more", m: "cities_1m" }, { t: "Feel safe walking alone at night", m: "safe_walking" }] },
    { n: "Resources: food, water and energy", b: { "AQA GCSE": "The challenge of resource management", "Edexcel GCSE A": "Resource management", "Edexcel GCSE B": "Consuming energy resources", "OCR GCSE B": "Resource reliance", "AQA A level": "Resource security", "Edexcel A level": "Water insecurity; Energy security", "OCR A level": "Future of food (option)" },
      l: [{ t: "Energy use per person", m: "energy_per_capita" }, { t: "Electricity from renewables", m: "renewables_elec_pct" }, { t: "Water stress", m: "water_stress" }, { t: "Safe drinking water", m: "safe_water" }, { t: "Undernourishment", m: "undernourishment" }] },
    { n: "Globalisation and trade", b: { "AQA GCSE": "The changing economic world", "AQA A level": "Global systems and global governance", "Edexcel A level": "Globalisation", "OCR A level": "Trade in the contemporary world" },
      l: [{ t: "Trade (% of GDP)", m: "trade_pct" }, { t: "Foreign investment", m: "fdi_pct" }, { t: "Internet users", m: "internet" }, { t: "Fuel exports", m: "exp_fuel_pct" }, { t: "Tourists per 100 people", m: "tourists_per100" }] },
    { n: "Migration", b: { "AQA A level": "Population and the environment", "Edexcel A level": "Migration, identity and sovereignty", "OCR A level": "Global migration" },
      l: [{ t: "People born abroad", m: "migrants_pct" }, { t: "Net migration", m: "net_migration" }, { t: "Refugees hosted", m: "refugees_hosted" }, { t: "Remittances", m: "remittances_pct" }, { t: "Wouldn't want immigrants as neighbours", m: "att_nb_immigrants" }] },
    { n: "Superpowers and geopolitics", b: { "AQA A level": "Global systems and global governance", "Edexcel A level": "Superpowers", "OCR A level": "Power and borders" },
      l: [{ t: "Size of the economy", m: "gdp_usd" }, { t: "Military spending", m: "military_spend_usd" }, { t: "Nuclear-armed countries", q: "f=nuclear_armed:1" }, { t: "Favourable view of the USA", m: "pew_fav_us" }, { t: "Favourable view of China", m: "pew_fav_china" }] },
    { n: "Health and human rights", b: { "Edexcel A level": "Health, human rights and intervention", "OCR A level": "Human rights; Disease dilemmas (option)" },
      l: [{ t: "Liberal democracy score", m: "libdem" }, { t: "Women in parliament", m: "women_parliament" }, { t: "Gender Inequality Index", m: "gii" }, { t: "Child deaths (under 5)", m: "under5_mortality" }, { t: "Confidence in vaccines", m: "wgm_vaccines_now" }] },
  ];
  function linkQS(l) {
    if (l.q) return l.q;
    const key = l.m || l.f[0], f = W.F[key];
    if (!f) return null;
    const lo = l.f ? l.f[1] : f.dmin, hi = f.dmax;
    return `${l.p || f.group && /Mountains|Landforms|Rivers|Ice|Plates|Volcanoes|Earthquakes|Biomes|Coasts|Hazards/.test(f.group) ? "m=p&" : ""}f=${key}:${lo}~${hi}${l.m ? `&c=${key}` : ""}`;
  }
  function curriculum() {
    let el = $("#curCard");
    if (!el) { el = document.createElement("div"); el.id = "curCard"; el.className = "card dsc cur"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Curriculum"); document.body.appendChild(el); }
    el.hidden = false;
    const board = store.get("wc-board", "AQA GCSE");
    const units = UNITS.filter((u) => u.b[board]);
    el.innerHTML = `<div class="dsc-head"><h2>🎓 By exam topic</h2><button type="button" class="iconbtn" id="curX" aria-label="Close">×</button></div>
      <label class="fld">Exam board and level <select id="curB" class="stx-sel">${BOARDS.map((b) => `<option ${b === board ? "selected" : ""}>${b}</option>`).join("")}</select></label>
      <div class="cur-list">${units.map((u) => `<section class="cur-u"><h3>${esc(u.n)}</h3><p class="hint">${esc(board)}: ${esc(u.b[board])}</p>
        <div class="cur-links">${u.l.map((l) => { const q = linkQS(l); return q ? `<button type="button" class="cur-l" data-q="${esc(q)}">${esc(l.t)}</button>` : ""; }).join("")}</div></section>`).join("")}</div>
      <p class="hint">Unit names follow the current specifications. Each button opens a map to start from: change it, describe it, or add it to a tour.</p>`;
    $("#curX").onclick = () => (el.hidden = true);
    $("#curB").onchange = (e) => { store.set("wc-board", e.target.value); curriculum(); };
    el.querySelectorAll(".cur-l").forEach((b) => (b.onclick = () => { W.applyQS(b.dataset.q); el.querySelectorAll(".cur-l").forEach((x) => x.classList.toggle("on", x === b)); }));
  }

  // ====================== First visit ======================
  // The words for the first-visit tour. Change them freely: [what to point at, title, text]
  const INTRO = [
    ["#addInput", "Ask the map", "Type a question like “democracies with over 40% women MPs”, or the name of any measure."],
    ["#themes", "Or browse by theme", "Pick a theme, then a measure, to add a filter. The map shows the countries that pass every filter."],
    ["#views", "Show the results as…", "A map, a chart comparing two measures, rankings, change over time, or insights the site has found."],
    ["#quizBtn", "Test yourself", "Questions from the map’s data, including “click on…” questions on a blank map."],
    ["#cpLearn", "Learn & share", "Describe the map, statistics, factfiles, coursework maps, worksheets, exam topics and guided tours."],
  ];
  function intro(force) {
    if (!force && (store.get("wc-intro", false) || playing || navigator.webdriver || new URLSearchParams(location.search).toString())) return;
    if (window.matchMedia("(max-width: 760px)").matches && !force) return;
    let i = 0;
    const pop = document.createElement("div"); pop.className = "card intro"; pop.setAttribute("role", "dialog");
    const ring = document.createElement("div"); ring.className = "intro-ring";
    document.body.append(ring, pop);
    const end = () => { pop.remove(); ring.remove(); store.set("wc-intro", true); window.removeEventListener("resize", show); };
    function show() {
      const [sel, h, t] = INTRO[i], tgt = $(sel);
      if (!tgt || !tgt.offsetWidth) { if (i < INTRO.length - 1) { i++; return show(); } return end(); }
      const r = tgt.getBoundingClientRect();
      Object.assign(ring.style, { left: r.left - 6 + "px", top: r.top - 6 + "px", width: r.width + 12 + "px", height: r.height + 12 + "px" });
      pop.innerHTML = `<p class="intro-n">${i + 1} of ${INTRO.length}</p><h3>${esc(h)}</h3><p>${esc(t)}</p>
        <div class="dsc-row"><button type="button" class="linkbtn" id="inSkip">Skip</button><span style="flex:1"></span>${i ? `<button type="button" class="ghost" id="inBack">Back</button>` : ""}<button type="button" class="primary" id="inNext">${i < INTRO.length - 1 ? "Next" : "Done"}</button></div>`;
      const pw = 300, below = r.bottom + 14 + 170 < innerHeight;
      let left = r.left + r.width + 16 + pw < innerWidth && r.width < 320 ? r.left + r.width + 16 : r.left;
      left = Math.max(10, Math.min(innerWidth - pw - 10, left));
      Object.assign(pop.style, { left: left + "px", top: (r.width < 320 && left > r.left + r.width ? Math.max(10, r.top) : below ? r.bottom + 14 : Math.max(10, r.top - 180)) + "px", width: pw + "px" });
      $("#inSkip").onclick = end;
      $("#inNext").onclick = () => { if (i < INTRO.length - 1) { i++; show(); } else end(); };
      if ($("#inBack")) $("#inBack").onclick = () => { i--; show(); };
      $("#inNext").focus({ preventScroll: true });
    }
    window.addEventListener("resize", show);
    setTimeout(show, 600);
  }

  function init() {
    W = window.WC;
    const tools = $("#cpLearn");
    if (tools) {
      const mk = (id, ic, label, title, fn) => { const b = document.createElement("button"); b.type = "button"; b.id = id; b.className = "cp-tool"; b.title = title; b.innerHTML = `<span class="cp-ic" aria-hidden="true">${ic}</span>${label}`; b.onclick = fn; return b; };
      tools.append(mk("curBtn", "🎓", "Exam topics", "Ready-made maps for each GCSE and A-level unit", curriculum), mk("tourBtn", "🧭", "Guided tour", "Build a step-by-step tour of maps to share with a class", builder));
      const help = mk("introBtn", "❔", "Site tour", "A quick tour of the site", () => intro(true));
      tools.append(help);
    }
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") ["#tourCard", "#curCard"].forEach((s) => { const el = $(s); if (el) el.hidden = true; }); });
    if (playing) setTimeout(() => go(0), 50);
    else intro(false);
  }
  window.WTR = { init, builder, curriculum, intro, play, urlExtra: () => (playing?.raw ? `tour=${playing.raw}` : ""), _UNITS: UNITS, _linkQS: (l) => linkQS(l) };
})();
