/* Quiz maker, for teachers.
   Type what the quiz should be about: a country ("Kenya"), a topic ("volcanoes", "population"), or both
   ("volcanoes in Kenya", "rivers in Africa", "capitals of South America"). It picks matching questions from the site's
   question bank, adds questions made specially for that country (its volcanoes, rivers, figures…), and lets you
   remove or swap any. Then: play it here, share a link for students, print it with an answer key (or save as PDF),
   or download a spreadsheet for Kahoot, Quizizz, Google Forms or Quizlet. */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const strip = (h) => String(h ?? "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  let W;
  const S = { q: "", n: 10, mc: true, title: "", list: [], spare: [], made: false };
  const b64e = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const b64d = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));
  let fromLink = null;
  try { const raw = new URLSearchParams(location.search).get("qz"); if (raw) fromLink = JSON.parse(b64d(raw)); } catch (e) { fromLink = null; }

  // ---------- Understanding the request ----------
  const STOP = new Set("a an the in of on and or about for with to from quiz quizzes question questions general everything all some any test year students lesson on its their".split(" "));
  const REGION_SYN = { "north america": ["Northern America", "Central America", "Caribbean"], "latin america": ["South America", "Central America", "Caribbean"],
    "middle east": ["Western Asia"], "sub-saharan africa": ["Eastern Africa", "Middle Africa", "Southern Africa", "Western Africa"], "the americas": ["Americas"] };
  const stem = (w) => w.replace(/ies$/, "y").replace(/(ches|shes|xes|ses)$/, (m) => m.slice(0, -2)).replace(/(?<!s)s$/, "");
  function parse(text) {
    let s = " " + text.toLowerCase().replace(/[^\p{L}\p{N}'’\- ]/gu, " ").replace(/\s+/g, " ") + " ";
    const isos = new Set(), regions = new Set();
    const names = [];
    for (const r of W.rows) { names.push([r.name.toLowerCase(), r.iso3]); (r.aliases || []).forEach((a) => { if (String(a).length > 3) names.push([String(a).toLowerCase(), r.iso3]); }); }
    names.sort((a, b) => b[0].length - a[0].length);
    for (const [k, v] of Object.entries(REGION_SYN)) if (s.includes(" " + k + " ")) { v.forEach((x) => regions.add(x)); s = s.replace(" " + k + " ", " "); }
    const regs = [...new Set(W.rows.flatMap((r) => [r.region, r.subregion]).filter(Boolean))].sort((a, b) => b.length - a.length);
    for (const g of regs) { const k = " " + g.toLowerCase() + " "; if (s.includes(k)) { regions.add(g); s = s.replace(k, " "); } }
    for (const [n, iso] of names) { const k = " " + n + " "; if (s.includes(k)) { isos.add(iso); s = s.split(k).join(" "); } }
    const words = s.split(" ").filter((w) => w.length > 2 && !STOP.has(w)).map(stem);
    return { isos, regions, words };
  }

  // ---------- Questions made for a place (e.g. "volcanoes in Kenya") ----------
  const FT = {
    volcano: { one: "volcano", many: "volcanoes", top: "highest", key: "volcano_elev", unit: " m", kw: "volcano volcanoes volcanic eruption tectonic hazard" },
    peak: { one: "mountain peak", many: "mountain peaks", top: "highest", key: "peak_elev", unit: " m", kw: "mountain mountains peak peaks summit relief highest" },
    range: { one: "mountain range", many: "mountain ranges", top: "largest", key: "range_area", kw: "mountain mountains range ranges relief" },
    river: { one: "river", many: "rivers", top: "longest", key: "river_km", unit: " km", kw: "river rivers drainage water" },
    lake: { one: "lake", many: "lakes", top: "largest", key: "lake_km2", unit: " km²", kw: "lake lakes water" },
    desert: { one: "desert", many: "deserts", top: "largest", key: "desert_area", kw: "desert deserts dry arid" },
    waterfall: { one: "waterfall", many: "waterfalls", top: "tallest", key: "waterfall_m", unit: " m", kw: "waterfall waterfalls river" },
    quake: { one: "earthquake", many: "earthquakes", key: "quake_mag", kw: "earthquake earthquakes quake tectonic hazard seismic" },
  };
  const nm = (it) => String(it.name || "").replace(/\s*\(.*?\)/g, "").trim();
  const cn = (r) => (/^(United|Netherlands|Philippines|Bahamas|Gambia|Maldives|Czech|Dominican|Central African|Comoros|Marshall|Solomon|DR Congo|Republic)/.test(r.name) ? "the " : "") + r.name;
  function featsIn(t, iso) { return (window.WP?.items(t) || []).filter((it) => (it.iso || []).includes(iso) && it.name); }
  function makeDyn(id) {
    const p = id.split(":");
    if (p[1] === "f") {
      const [, , t, iso, what] = p, r = W.byIso.get(iso), T = FT[t];
      if (!r || !T) return null;
      const list = featsIn(t, iso).sort((a, b) => (b[T.key] ?? -1) - (a[T.key] ?? -1));
      if (!list.length) return null;
      const others = (window.WP.items(t) || []).filter((it) => !(it.iso || []).includes(iso) && it.name && W.byIso.get((it.iso || [])[0])?.region === r.region);
      const opts = (right, wrong) => shuffle([{ label: right, ok: true }, ...shuffle(wrong.filter((x) => x && x !== right)).slice(0, 3).map((label) => ({ label, ok: false }))]);
      const show = { label: `Show ${cn(r)} on the map`, run: () => { W.setView("map"); W.select(iso); } };
      if (what === "count") return { topic: "any", kind: "number", text: `How many ${T.many} ${t === "quake" ? "of magnitude 6 or more since 1900 have been" : "does this map show"} in ${cn(r)}?`,
        ans: { v: list.length, int: true, exact: true }, explain: () => `<b>${list.length}</b>${t !== "quake" ? `: ${esc(list.slice(0, 8).map(nm).join(", "))}${list.length > 8 ? "…" : ""}` : ""}.`, action: show };
      if (what === "name" && t !== "quake") return { topic: "any", kind: "text", text: `Name a ${T.one} in ${cn(r)}.`, ans: { accept: list.flatMap((it) => [nm(it), nm(it).replace(/^(Mount|Mt\.?|Lake|River)\s+/i, "")]), show: nm(list[0]) },
        options: () => opts(nm(pickOne(list)), others.map(nm)), explain: () => `For example <b>${esc(list.slice(0, 5).map(nm).join(", "))}</b>.`, action: show };
      if (what === "top" && T.top && list[0][T.key] != null && list.length >= 2) return { topic: "any", kind: "text", text: `Which is the ${T.top} ${T.one} in ${cn(r)}?`,
        ans: { accept: [nm(list[0]), nm(list[0]).replace(/^(Mount|Mt\.?|Lake|River)\s+/i, "")], show: nm(list[0]) },
        options: () => opts(nm(list[0]), list.slice(1).map(nm).concat(others.map(nm))),
        explain: () => `<b>${esc(nm(list[0]))}</b>${list[0][T.key] != null && T.unit ? ` (${Math.round(list[0][T.key]).toLocaleString()}${T.unit})` : ""}. Next: ${esc(list.slice(1, 3).map(nm).join(", "))}.`, action: show };
      if (what === "where" && list.length) {
        const it = list[0], cands = W.rows.filter((x) => x.sovereign && x.region === r.region && x.iso3 !== iso);
        return { topic: "any", kind: "country", text: `Which country is ${nm(it)} in?`, ans: { isos: it.iso || [iso] },
          options: () => shuffle([{ label: r.name, ok: true }, ...shuffle(cands).slice(0, 3).map((x) => ({ label: x.name, ok: false }))]),
          explain: () => `<b>${esc(r.name)}</b>.`, action: show };
      }
      return null;
    }
    if (p[1] === "m") {
      const [, , key, iso] = p, r = W.byIso.get(iso), f = W.F[key];
      if (!r || !f || typeof r[key] !== "number") return null;
      const v = r[key];
      return { topic: "any", kind: "number", text: `${r.name}: what is the figure for “${f.label}”?`,
        ans: { v, f, key, tol: { rel: 0.15 } }, explain: () => `<b>${esc(W.fmt(f, v))}</b>${r[key + "_year"] ? ` (${r[key + "_year"]})` : ""}.`,
        action: { label: `Show ${f.short || f.label} on the map`, run: () => W.applyQS(`f=${key}:${f.dmin}~${f.dmax}&c=${key}&s=${iso}`) } };
    }
    if (p[1] === "loc") {
      const r = W.byIso.get(p[2]);
      return r ? { topic: "any", kind: "locate", text: `Click on ${cn(r)} on the map.`, ans: { isos: [r.iso3] }, explain: () => `${esc(r.name)} is in <b>${esc(r.subregion || r.region)}</b>.` } : null;
    }
    return null;
  }
  const pickOne = (a) => a[Math.floor(Math.random() * a.length)];

  // ---------- Finding questions ----------
  const PREFIX_WORDS = { hp: "mountain highest point relief", pkc: "mountain peak", loc: "location map where locate", nb: "border neighbour neighbor", nbn: "border neighbour", nbl: "border neighbour",
    cap: "capital city cities", lang: "language", cur: "currency money" };
  function haystack(spec, q) {
    const p = spec.id.split(":");
    const f = (p[0] === "v" || p[0] === "x") && W.F[p[1]];
    return [q.text, window.WQ.topicLabel(spec.topic), PREFIX_WORDS[p[0]] || "", f ? f.label + " " + (f.keywords || "") + " " + f.group : ""].join(" ").toLowerCase();
  }
  const matchWord = (hay, w) => { const words = hay.split(/[^\p{L}\p{N}]+/u); return words.some((x) => { const s = stem(x); return s === w || (w.length >= 4 && (s.startsWith(w) || (w.startsWith(s) && s.length >= Math.max(4, w.length - 2)))); }); };
  function placesOf(spec, q) {
    const out = new Set();
    for (const x of spec.id.split(":")) if (/^[A-Z]{3}$/.test(x) && W.byIso.get(x)) out.add(x);
    if (q && q.ans && q.ans.isos && q.ans.isos.length <= 4) q.ans.isos.forEach((i) => out.add(i));
    return out;
  }
  function find(text) {
    const P = parse(text);
    const inPlace = (iso) => P.isos.has(iso) || [...P.regions].some((g) => { const r = W.byIso.get(iso); return r && (r.region === g || r.subregion === g); });
    const hasPlace = P.isos.size || P.regions.size;
    const found = [];
    const bank = window.WQ.bankAll();
    for (const spec of bank) {
      const idP = spec.id.split(":");
      // quick check before building the question
      if (hasPlace) {
        const idIsos = idP.filter((x) => /^[A-Z]{3}$/.test(x));
        const idReg = idP.some((x) => P.regions.has(x));
        if (idIsos.length && !idIsos.some(inPlace) && !idReg) continue;
      }
      let q;
      try { q = spec.make(); } catch (e) { q = null; }
      if (!q) continue;
      // leave out questions that give their own answer away ("Which country is …, Japan in?")
      if (q.kind === "country" && (q.ans.isos || []).some((i) => q.text.includes(W.byIso.get(i)?.name))) continue;
      let sp = 0;
      if (hasPlace) {
        const pl = placesOf(spec, q);
        const regHit = idP.some((x) => P.regions.has(x));
        const textHit = [...P.isos].some((i) => q.text.includes(W.byIso.get(i).name));
        if ([...pl].some((i) => P.isos.has(i)) || textHit) sp = 3;
        else if (regHit || [...pl].some(inPlace)) sp = 2;
        else continue;
      }
      let sw = 0;
      if (P.words.length) {
        const hay = haystack(spec, q);
        sw = P.words.filter((w) => matchWord(hay, w)).length;
        if (!sw) continue;
      }
      found.push({ id: spec.id, text: q.text, score: sp + sw * 2 + Math.random() });
    }
    // questions made for each country named (or the countries of a region, if few)
    const countries = P.isos.size ? [...P.isos] : [];
    for (const iso of countries) {
      for (const [t, T] of Object.entries(FT)) {
        if (P.words.length && !P.words.some((w) => matchWord(T.kw, w))) continue;
        for (const what of ["name", "top", "count", "where"]) {
          if (what === "where" && t === "quake") continue;
          const id = `dyn:f:${t}:${iso}:${what}`, q = makeDyn(id);
          if (q && q.kind === "country" && q.text.includes(W.byIso.get(iso).name)) continue;
          if (q) found.push({ id, text: q.text, score: 3 + (P.words.length ? 4 : 0) + Math.random() });
        }
      }
      // figures for the country that match the words (or a few headline ones)
      const keys = P.words.length
        ? W.FILTERS.filter((f) => f.type === "range" && !f.target && !f.hidden && !f.survey && !/rank/i.test(f.label) && P.words.some((w) => matchWord((f.label + " " + (f.keywords || "") + " " + f.group).toLowerCase(), w))).map((f) => f.key)
        : ["population", "life_expectancy", "gdp_per_capita", "urban_pct", "fertility", "hdi", "area_km2", "internet"];
      for (const key of keys.slice(0, 12)) {
        const id = `dyn:m:${key}:${iso}`, q = makeDyn(id);
        if (q && !found.some((x) => x.id === `v:${key}:${iso}`)) found.push({ id, text: q.text, score: 2.5 + (P.words.length ? 2 : 0) + Math.random() });
      }
      if (!P.words.length || P.words.some((w) => matchWord("location map where locate find", w))) found.push({ id: `dyn:loc:${iso}`, text: `Click on ${W.byIso.get(iso).name} on the map.`, score: 3 + Math.random() });
    }
    // one question per kind first, so a quiz isn't ten of the same thing
    found.sort((a, b) => b.score - a.score);
    const kindOf = (id) => id.split(":").slice(0, id.startsWith("dyn:f") ? 3 : id.startsWith("dyn:m") ? 2 : 1).join(":");
    const seenKinds = new Map(), first = [], rest = [];
    for (const x of found) { const k = kindOf(x.id); const n = seenKinds.get(k) || 0; seenKinds.set(k, n + 1); (n < 2 ? first : rest).push(x); }
    return { P, list: first.concat(rest) };
  }

  // ---------- The card ----------
  function card() {
    let el = $("#qmCard");
    if (!el) { el = document.createElement("div"); el.id = "qmCard"; el.className = "card dsc stx qm"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Quiz maker"); document.body.appendChild(el); }
    el.hidden = false;
    const L = S.list;
    el.innerHTML = `<div class="dsc-head"><h2>🧩 Quiz maker</h2><button type="button" class="iconbtn" id="qmX" aria-label="Close">×</button></div>
      <p class="hint">Say what the quiz should be about: a place, a topic, or both. For example: <i>Kenya</i>, <i>volcanoes in Kenya</i>, <i>rivers in Africa</i>, <i>population of Brazil</i>, <i>capitals of South America</i>, <i>development</i>.</p>
      <div class="qm-row"><input id="qmQ" type="text" placeholder="What should the quiz be about?" value="${esc(S.q)}">
        <select id="qmN" class="stx-sel" aria-label="Number of questions">${[5, 10, 15, 20, 30].map((n) => `<option ${n === S.n ? "selected" : ""}>${n}</option>`).join("")}</select>
        <button type="button" class="primary" id="qmGo">Make quiz</button></div>
      <label class="tog"><input type="checkbox" id="qmMC" ${S.mc ? "checked" : ""}> Multiple choice (otherwise students type their answers)</label>
      ${S.made ? (L.length ? `
        <label class="fld">Title <input id="qmT" type="text" value="${esc(S.title)}"></label>
        <ol class="qm-list">${L.map((x, i) => `<li><span>${esc(x.text)}</span><span class="qm-b"><button type="button" class="iconbtn" data-sw="${i}" title="Swap for another question" ${S.spare.length ? "" : "disabled"}>↻</button><button type="button" class="iconbtn" data-rm="${i}" title="Remove">×</button></span></li>`).join("")}</ol>
        <p class="hint">${L.length} question${L.length > 1 ? "s" : ""}${S.spare.length ? `, and ${S.spare.length} more that match to swap in (↻)` : ""}. Each question is checked against the site's data when it's asked.</p>
        <div class="dsc-row"><button type="button" class="primary" id="qmPlay">▶ Play it here</button><button type="button" class="ghost" id="qmLink">Copy a link for students</button>
          <button type="button" class="ghost" id="qmPrint">Print or save as PDF</button><button type="button" class="ghost" id="qmCsv">Spreadsheet (Kahoot, Forms…)</button><button type="button" class="ghost" id="qmQuizlet">Copy for Quizlet</button></div>
        <p class="hint" id="qmMsg"></p>`
        : `<p class="hint"><b>No questions found.</b> Try fewer or broader words, a country's full name, or a continent.</p>`) : ""}`;
    $("#qmX").onclick = () => (el.hidden = true);
    const go = () => { S.q = $("#qmQ").value.trim(); S.n = +$("#qmN").value; S.mc = $("#qmMC").checked; if (!S.q) return; make(); };
    $("#qmGo").onclick = go;
    $("#qmQ").onkeydown = (e) => { if (e.key === "Enter") go(); };
    $("#qmMC").onchange = (e) => (S.mc = e.target.checked);
    if (!S.made || !L.length) return;
    $("#qmT").oninput = (e) => (S.title = e.target.value);
    el.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => { L.splice(+b.dataset.rm, 1); card(); }));
    el.querySelectorAll("[data-sw]").forEach((b) => (b.onclick = () => { if (S.spare.length) { L[+b.dataset.sw] = S.spare.shift(); card(); } }));
    $("#qmPlay").onclick = () => { el.hidden = true; window.WQ.playSet({ title: S.title, ids: L.map((x) => x.id), mc: S.mc }); };
    $("#qmLink").onclick = async () => {
      const url = `${location.origin}${location.pathname}?qz=${b64e(JSON.stringify({ t: S.title, ids: L.map((x) => x.id), mc: S.mc ? 1 : 0 }))}`;
      try { await navigator.clipboard.writeText(url); $("#qmMsg").textContent = "Link copied. Students who open it go straight into this quiz."; } catch (e) { prompt("Copy this link:", url); }
    };
    $("#qmPrint").onclick = () => printQuiz();
    $("#qmCsv").onclick = () => csvQuiz();
    $("#qmQuizlet").onclick = async () => {
      const t = built().map((b) => `${b.q.text}\t${b.answer}`).join("\n");
      try { await navigator.clipboard.writeText(t); $("#qmMsg").textContent = "Copied. In Quizlet: Create → Import, then paste (tab between term and definition, new line between cards)."; } catch (e) { prompt("Copy:", t); }
    };
    $("#qmQ").focus();
  }
  function make() {
    const { P, list } = find(S.q);
    S.list = list.slice(0, S.n); S.spare = list.slice(S.n); S.made = true;
    const place = [...P.isos].map((i) => W.byIso.get(i).name).concat([...P.regions]).join(", ");
    S.title = S.q.charAt(0).toUpperCase() + S.q.slice(1) + (place && S.q.toLowerCase() === place.toLowerCase() ? "" : "");
    card();
  }
  // the questions with their options and answers fixed, for printing and spreadsheets
  function built() {
    return S.list.map((x) => {
      const q = window.WQ.resolve(x.id);
      if (!q) return null;
      const opts = q.kind === "locate" ? [] : (q.options ? q.options() : window.WQ.numberOptions(q)) || [];
      const ex = q.explain ? strip(q.explain()) : "";
      const m = q.explain ? /<b>(.*?)<\/b>/.exec(q.explain()) : null;
      const answer = m ? strip(m[1]) : ex;
      return { q, opts, answer, explain: ex };
    }).filter(Boolean);
  }
  function printQuiz() {
    const B = built(), L = "ABCDEF";
    const qs = B.map((b, i) => `<li><p>${esc(b.q.text.replace("Click on", "Mark").replace("on the map.", "on the map."))}</p>
      ${S.mc && b.opts.length ? `<ol class="opts" type="A">${b.opts.map((o) => `<li>${esc(o.label)}</li>`).join("")}</ol>` : `<div class="line"></div>`}</li>`).join("");
    const key = B.map((b, i) => `<li>${S.mc && b.opts.length ? `<b>${L[b.opts.findIndex((o) => o.ok)] || "?"}</b> · ` : ""}${esc(b.answer)}<br><small>${esc(b.explain)}</small></li>`).join("");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(S.title)}</title><style>
      body{font-family:Arial,sans-serif;margin:18mm;color:#14212b;font-size:13pt} h1{font-size:20pt;margin:0 0 4px} .sub{color:#56646e;margin:0 0 14px}
      ol.qs>li{margin:0 0 12px;break-inside:avoid} .opts{margin:4px 0 0 18px} .line{border-bottom:1px solid #999;height:26px;width:70%}
      .key{break-before:page} .key li{margin:0 0 8px} small{color:#56646e} @page{size:A4;margin:0}
    </style><h1>${esc(S.title)}</h1><p class="sub">Name: ______________________ &nbsp; Date: ____________ &nbsp; Score: ____ / ${B.length}</p>
    <ol class="qs">${qs}</ol><div class="key"><h1>Answers: ${esc(S.title)}</h1><ol>${key}</ol>
    <p class="sub">Made with Which Countries? · ${esc(location.host)} · data from the sources listed on the site.</p></div>
    <script>setTimeout(()=>print(),300)<\/script>`);
    w.document.close();
  }
  function csvQuiz() {
    const B = built(), L = "ABCD";
    const q = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = [["Question", "Answer A", "Answer B", "Answer C", "Answer D", "Correct (letter)", "Correct (number, for Kahoot)", "Correct answer", "Explanation", "Time limit (sec)"]];
    for (const b of B) {
      const o = b.opts.slice(0, 4), k = o.findIndex((x) => x.ok);
      rows.push([b.q.text, ...[0, 1, 2, 3].map((i) => o[i]?.label || ""), k >= 0 ? L[k] : "", k >= 0 ? k + 1 : "", b.answer, b.explain, 30]);
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + rows.map((r) => r.map(q).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    a.download = `${(S.title || "quiz").replace(/\W+/g, "-").toLowerCase()}.csv`; a.click();
    $("#qmMsg").textContent = "Downloaded. Kahoot: copy the columns into Kahoot's spreadsheet template (Create → Import spreadsheet). Google Forms or Quizizz: import or paste the rows.";
  }

  function init() {
    W = window.WC;
    const tools = $("#cpLearn");
    if (tools) {
      const b = document.createElement("button");
      b.type = "button"; b.id = "qmBtn"; b.className = "cp-tool"; b.title = "Make a quiz on any country or topic: play it, share it, print it or download it";
      b.innerHTML = `<span class="cp-ic" aria-hidden="true">🧩</span>Quiz maker`;
      b.onclick = card;
      tools.prepend(b);
    }
    if (fromLink && Array.isArray(fromLink.ids) && fromLink.ids.length) setTimeout(() => window.WQ?.playSet({ title: fromLink.t || "Quiz", ids: fromLink.ids.slice(0, 60), mc: !!fromLink.mc }), 400);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { const c = $("#qmCard"); if (c) c.hidden = true; } });
  }
  window.WQM = { init, makeDyn, find, open: card, _S: S };
})();
