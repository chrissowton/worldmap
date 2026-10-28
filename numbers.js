/* Which Countries? — Number hunt: type a number and find facts from across the site that come to that number
 * (life expectancy of 42 years, 42% who trust others, a river 4,200 km long…), then turn them into a one-page poster.
 * Loaded after app.js; uses window.WC (app.js), window.WP (physical.js) and window.WV (views.js). */
(function () {
  "use strict";
  let W = null;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const st = { n: null, count: 12, close: true, places: true, seed: 0 };

  // ---------- Finding the facts ----------
  // how far a value may be from the number and still "be" that number when shown: half a unit of its last digit
  function tolerance(n, text) {
    const dec = (String(text).split(".")[1] || "").length;
    const base = 0.5 * 10 ** -dec;
    return Math.max(base, Math.abs(n) >= 1000 ? Math.abs(n) * 0.005 : 0);
  }
  const sentenceCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  function candidates(n, text) {
    const F = W.F, tol = tolerance(n, text), far = st.close ? Math.max(tol * 4, Math.abs(n) * 0.03) : tol;
    const out = [];
    const consider = (v, make) => {
      if (typeof v !== "number" || !isFinite(v)) return;
      const d = Math.abs(v - n);
      if (d > far) return;
      out.push({ ...make(), v, exact: d <= tol, d: d / (tol || 1) });
    };
    // countries: every number filter, latest figures
    for (const f of W.FILTERS) {
      if (f.type !== "range" || f.target || f.internal) continue;
      for (const r of W.rows) {
        if (!r.sovereign) continue;
        consider(W.latest(r, f.key), () => ({ kind: "country", f, r, key: f.key, who: r.iso3, g: f.group, year: String(r[f.year] || (/\d{4}/.test(f.yearText || "") ? f.yearText : "")) }));
      }
    }
    // places: peaks, rivers, lakes, volcanoes… and cities
    if (st.places) {
      for (const f of W.FILTERS) {
        if (f.type !== "range" || !f.target || f.key === "quake_year" || f.key === "river_countries") continue;
        const its = W.itemsFor(f) || [];
        for (const it of its) consider(it[f.key], () => ({ kind: "place", f, it, key: f.key, who: f.target + ":" + (it.name || it.id), g: f.group, year: f.key === "city_population" ? "" : "" }));
      }
    }
    return out;
  }
  // a varied selection: the closest first, at most one fact per measure and two per country or place
  function pick(n, text) {
    const all = candidates(n, text);
    // a little shuffle so "Shuffle" gives a different but still close set
    let s = st.seed + 1;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    // ranks and values at the end of a scale (100% with electricity…) are less interesting, so they come later
    const dull = (c) => (c.f.format === "rank" || /_rank$/.test(c.key) ? 2 : 0) + (c.f.bounds && (c.v === c.f.bounds[0] || c.v === c.f.bounds[1]) ? 3 : 0);
    all.forEach((c) => (c.o = c.d + dull(c) + (st.seed ? rnd() * 1.5 : 0)));
    all.sort((a, b) => (b.exact - a.exact) || a.o - b.o);
    const byKey = new Map(), byWho = new Map(), byG = new Map(), outp = [];
    const maxG = Math.max(2, Math.ceil(st.count / 6));
    for (const c of all) {
      if (byKey.get(c.key)) continue;
      if ((byWho.get(c.who) || 0) >= 2 || (byG.get(c.g) || 0) >= maxG) continue;
      byKey.set(c.key, 1); byWho.set(c.who, (byWho.get(c.who) || 0) + 1); byG.set(c.g, (byG.get(c.g) || 0) + 1);
      outp.push(c);
      if (outp.length >= st.count) break;
    }
    // too few? fill up without the limit per topic
    for (const c of all) { if (outp.length >= st.count) break; if (!byKey.get(c.key) && (byWho.get(c.who) || 0) < 2) { byKey.set(c.key, 1); byWho.set(c.who, (byWho.get(c.who) || 0) + 1); outp.push(c); } }
    return { list: outp, total: all.length, exact: all.filter((c) => c.exact).length };
  }
  function describe(c) {
    const f = c.f, val = W.fmt(f, c.v);
    if (c.kind === "country") {
      let say = f.say ? f.say(val) : `${f.label.toLowerCase()} is ${val}`;
      say = say.replace(/^it /, "it ");
      return { big: W.fmtShort(f, c.v), name: c.r.name, flag: c.r.flag || "", line: sentenceCase(`${say}`), where: `In ${c.r.name}`, measure: f.label, year: c.year };
    }
    const T = window.WP?.T?.[f.target];
    const name = c.it.name || (T ? T.one : "");
    const kind = f.target === "city" ? "city" : T ? T.one : "";
    const country = (c.it.iso || [c.it.iso3]).filter(Boolean).map((i) => W.byIso.get(i)?.name).filter(Boolean).slice(0, 3).join(", ");
    return { big: W.fmtShort(f, c.v), name, flag: "", line: `${f.label}: ${val}`, where: `${name}${kind ? ` (${kind}${country ? `, ${country}` : ""})` : ""}`, measure: f.label, year: "" };
  }

  // ---------- Overlay ----------
  function open(n) {
    W = window.WC;
    let el = $("#numhunt");
    if (!el) {
      el = document.createElement("div");
      el.id = "numhunt"; el.className = "ff-overlay nh-overlay"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Number hunt");
      document.body.appendChild(el);
      el.innerHTML = `<div class="nh-bar">
          <h2>🔢 Number hunt</h2>
          <label class="nh-num"><span>Your number</span><input id="nhIn" inputmode="decimal" autocomplete="off" placeholder="e.g. 42"></label>
          <label class="nh-fld"><span>How many facts</span><select id="nhCount">${[6, 9, 12, 18, 24].map((k) => `<option ${k === st.count ? "selected" : ""}>${k}</option>`).join("")}</select></label>
          <label class="tog"><input type="checkbox" id="nhClose" ${st.close ? "checked" : ""}> Include close matches (≈)</label>
          <label class="tog"><input type="checkbox" id="nhPlaces" ${st.places ? "checked" : ""}> Include places (peaks, rivers, cities…)</label>
          <button type="button" class="ghost sm" id="nhShuffle" title="Pick a different set of facts">🔀 Shuffle</button>
          <button type="button" class="ghost sm" id="nhPng">⬇ Save poster</button>
          <button type="button" class="ghost sm" id="nhPrint">🖨 Print</button>
          <button type="button" class="iconbtn" id="nhClose2" aria-label="Close">×</button>
        </div>
        <p class="nh-help">Type any number to find facts from across the site that come to it, then save or print them as a one-page poster.</p>
        <div class="nh-body" id="nhBody"></div>`;
      const go = () => { const v = parseNum($("#nhIn").value); st.n = v == null ? null : { v, text: $("#nhIn").value.replace(/[^\d.\-]/g, "") }; st.seed = 0; draw(); };
      $("#nhIn").oninput = () => { clearTimeout(go.t); go.t = setTimeout(go, 250); };
      $("#nhCount").onchange = (e) => { st.count = +e.target.value; draw(); };
      $("#nhClose").onchange = (e) => { st.close = e.target.checked; draw(); };
      $("#nhPlaces").onchange = (e) => { st.places = e.target.checked; draw(); };
      $("#nhShuffle").onclick = () => { st.seed = (st.seed + 7919) % 100000 + 1; draw(); };
      $("#nhClose2").onclick = close;
      $("#nhPrint").onclick = () => { document.body.classList.add("print-nh"); window.print(); setTimeout(() => document.body.classList.remove("print-nh"), 500); };
      $("#nhPng").onclick = savePNG;
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !el.hidden) close(); });
    }
    el.hidden = false;
    if (n != null) { $("#nhIn").value = n; st.n = { v: parseNum(String(n)), text: String(n).replace(/[^\d.\-]/g, "") }; }
    draw();
    setTimeout(() => $("#nhIn").focus(), 30);
  }
  function close() { const el = $("#numhunt"); if (el) el.hidden = true; }
  function parseNum(s) {
    const t = String(s).trim().toLowerCase().replace(/,/g, "");
    const m = t.match(/^-?\d*\.?\d+/);
    if (!m) return null;
    let v = +m[0];
    if (/\d\s*(k|thousand)\b/.test(t)) v *= 1e3;
    if (/\d\s*(m|million)\b/.test(t)) v *= 1e6;
    if (/\d\s*(bn|billion)\b/.test(t)) v *= 1e9;
    return isFinite(v) ? v : null;
  }

  // ---------- The poster (an SVG, so it can be saved as a picture) ----------
  function wrap(text, max) {
    const words = String(text).split(/\s+/), lines = [];
    let cur = "";
    for (const w of words) { if ((cur + " " + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }
    if (cur) lines.push(cur);
    return lines;
  }
  function draw() {
    const body = $("#nhBody");
    if (!body) return;
    if (!st.n || st.n.v == null) { body.innerHTML = `<p class="nh-empty">Try 7, 42, 100, 1,000 or 8,848.</p>`; return; }
    const { list, total, exact } = pick(st.n.v, st.n.text);
    if (!list.length) { body.innerHTML = `<p class="nh-empty">Nothing on the site comes to ${esc(st.n.text)}${st.close ? " or near it" : ""}. Try ticking “Include close matches”, or another number.</p>`; return; }
    const cols = list.length <= 6 ? 2 : 3, cw = 360, ch = 190, gap = 18, padX = 36, top = 190;
    const Wd = padX * 2 + cols * cw + (cols - 1) * gap, rowsN = Math.ceil(list.length / cols), Ht = top + rowsN * (ch + gap) + 70;
    const ink = "#15232a", muted = "#5b6b73";
    const num = Number(st.n.v).toLocaleString("en-GB");
    let s = `<svg id="nhSVG" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wd} ${Ht}" width="${Wd}" height="${Ht}" role="img" aria-label="Poster: ${list.length} facts about the number ${esc(num)}" font-family="IBM Plex Sans, Arial, sans-serif">
      <rect width="${Wd}" height="${Ht}" fill="#fbfaf7"/>
      <text x="${padX}" y="70" font-size="22" font-weight="600" fill="${muted}">Which Countries? · Number hunt</text>
      <text x="${padX}" y="140" font-size="64" font-weight="700" fill="${ink}" font-family="Bricolage Grotesque, IBM Plex Sans, Arial, sans-serif">The number ${esc(num)}</text>
      <text x="${Wd - padX}" y="140" font-size="18" fill="${muted}" text-anchor="end">${list.length} facts from around the world</text>`;
    list.forEach((c, i) => {
      const d = describe(c), x = padX + (i % cols) * (cw + gap), y = top + Math.floor(i / cols) * (ch + gap);
      const gc = css(`--g-${W.gslug(c.g)}`) || "#3a7ca5";
      const lines = wrap(d.line, 34).slice(0, 3);
      s += `<g><rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="14" fill="${gc}" fill-opacity="0.12" stroke="${gc}" stroke-opacity="0.55"/>
        <rect x="${x}" y="${y}" width="8" height="${ch}" rx="4" fill="${gc}"/>
        <text x="${x + 24}" y="${y + 34}" font-size="13" font-weight="700" fill="${gc}" letter-spacing="0.06em">${esc(String(c.g).toUpperCase())}</text>
        <text x="${x + 24}" y="${y + 84}" font-size="44" font-weight="700" fill="${ink}" font-family="Bricolage Grotesque, IBM Plex Sans, Arial, sans-serif">${c.exact ? "" : "≈ "}${esc(d.big)}</text>
        <text x="${x + 24}" y="${y + 112}" font-size="16" font-weight="600" fill="${ink}">${esc(d.where)}</text>
        ${lines.map((l, k) => `<text x="${x + 24}" y="${y + 136 + k * 18}" font-size="14" fill="${muted}">${esc(l)}</text>`).join("")}
        ${d.year ? `<text x="${x + cw - 16}" y="${y + 34}" font-size="12.5" fill="${muted}" text-anchor="end">${esc(d.year)}</text>` : ""}</g>`;
    });
    s += `<text x="${padX}" y="${Ht - 30}" font-size="13" fill="${muted}">Figures are the latest on the site; ≈ means close to the number. Sources: see Sources &amp; methods at which-countries (chrissowton.github.io/worldmap).</text></svg>`;
    body.innerHTML = `<p class="nh-count">${exact} fact${exact === 1 ? "" : "s"} come${exact === 1 ? "s" : ""} to exactly ${esc(num)}${st.close ? `, and ${total - exact} more come close` : ""}. Showing ${list.length}.</p><div class="nh-poster">${s}</div>`;
  }
  async function savePNG() {
    const svgEl = $("#nhSVG");
    if (!svgEl || !window.WV?.svgToCanvas) return;
    const cv = await window.WV.svgToCanvas(svgEl, 2, "#fbfaf7");
    const a = document.createElement("a");
    a.download = `number-${String(st.n?.text || "hunt")}.png`;
    a.href = cv.toDataURL("image/png");
    a.click();
  }

  // ---------- Ways in ----------
  let inited = false;
  function init() {
    if (inited) return;
    inited = true;
    W = window.WC;
    const tools = $("#cpLearn");
    if (tools) {
      const b = document.createElement("button");
      b.type = "button"; b.id = "nhBtn"; b.className = "cp-tool"; b.title = "Type a number and find facts from across the site that come to it";
      b.innerHTML = `<span class="cp-ic" aria-hidden="true">🔢</span>Number hunt`;
      tools.appendChild(b);
      b.onclick = () => open();
    }
    // typing just a number in the search box and pressing Enter opens the number hunt
    const inp = $("#addInput");
    if (inp) inp.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const t = inp.value.trim();
      if (/^-?[\d.,]+\s*(k|m|bn|thousand|million|billion)?$/i.test(t) && parseNum(t) != null) {
        e.preventDefault(); e.stopImmediatePropagation();
        inp.value = ""; inp.blur();
        open(t);
      }
    }, true);
  }
  window.WN = { open, init, _test: { pick: (n) => { W = window.WC; return pick(n, String(n)); } } };
})();
