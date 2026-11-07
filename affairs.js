/* World affairs on the map (v62): disputed borders and territories, current conflicts, and national elections
   (recent and coming up). The facts are in affairs.json, which says when they were last checked; the shapes of the
   disputed areas are in disputes_geo.json (Natural Earth). Each is a layer in "More on the map", with a card listing
   them and a short explainer for each. */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let W, A = null, DG = null, loading = null;
  const L = { disp: { on: false, pick: null }, conf: { on: false, pick: null }, elec: { on: false, pick: null, tab: "next" } };
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const STATUS = { Worsening: "#d23b3b", Unchanging: "#e08b00", Developing: "#7b55c7", Improving: "#2e9d55" };
  function load() {
    if (A) return Promise.resolve();
    loading ||= Promise.all([
      window.__AFFAIRS__ || fetch("affairs.json?v=62").then((r) => r.json()),
      window.__DISPUTESGEO__ || fetch("disputes_geo.json?v=62").then((r) => r.json()),
    ]).then(([a, g]) => { A = a; DG = topojson.feature(g, g.objects.disputes).features; }).catch(() => { A = null; });
    return loading;
  }
  const today = () => new Date().toISOString().slice(0, 10);
  const name = (iso) => W.byIso.get(iso)?.name || iso;
  const flag = (iso) => W.byIso.get(iso)?.flag || "";
  function dateText(d) {
    const [y, m, day] = d.split("-");
    if (!m) return y;
    return `${day ? +day + " " : ""}${MONTHS[+m - 1]} ${y}`;
  }
  // an election is "recent" up to a year before today, "coming up" up to 15 months ahead
  function elections() {
    const t = today(), back = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10), ahead = new Date(Date.now() + 460 * 864e5).toISOString().slice(0, 10);
    const all = A.elections.map(([iso, date, type]) => ({ iso, date, type, end: date.length === 4 ? date + "-12-31" : date.length === 7 ? date + "-28" : date }));
    return {
      next: all.filter((e) => e.end >= t && e.date <= ahead).sort((a, b) => a.end.localeCompare(b.end)),
      past: all.filter((e) => e.end < t && e.date >= back).sort((a, b) => b.end.localeCompare(a.end)),
    };
  }
  const wiki = (q) => `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(q)}`;

  // ---------- Drawing ----------
  function defs() {
    const svg = d3.select(W.mapSVG());
    let d = svg.select("defs");
    if (d.empty()) d = svg.append("defs");
    if (d.select("#dispHatch").empty()) {
      const p = d.append("pattern").attr("id", "dispHatch").attr("patternUnits", "userSpaceOnUse").attr("width", 6).attr("height", 6).attr("patternTransform", "rotate(45)");
      p.append("rect").attr("width", 6).attr("height", 6).attr("fill", "rgba(123,85,199,.18)");
      p.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 6).attr("stroke", "#7b55c7").attr("stroke-width", 2.2);
    }
  }
  function draw() {
    if (!W) return;
    const map = W.state.view === "map";
    const k = W.k || 1;
    // elections: countries shaded
    {
      const g = W.layer("elections");
      const show = L.elec.on && A && map;
      g.style("display", show ? null : "none");
      if (show) {
        const E = elections(), col = new Map();
        E.past.forEach((e) => { if (!col.has(e.iso)) col.set(e.iso, ["past", e]); });
        E.next.forEach((e) => col.set(e.iso, ["next", e]));
        const feats = W.geo.filter((f) => f.rec && col.has(f.rec.iso3));
        g.selectAll("path").data(feats, (f) => f.rec.iso3).join("path").attr("class", (f) => "el-" + col.get(f.rec.iso3)[0]).attr("d", W.geoPath())
          .style("fill", (f) => (col.get(f.rec.iso3)[0] === "next" ? "#2f7fd1" : "#2e9d55")).style("fill-opacity", (f) => (col.get(f.rec.iso3)[0] === "next" ? 0.72 : 0.55))
          .attr("vector-effect", "non-scaling-stroke")
          .attr("data-base", (f) => { const [w, e] = col.get(f.rec.iso3); return `${f.rec.name}: ${e.type}, ${dateText(e.date)}${w === "next" ? " (coming up)" : ""}`; })
          .on("click", (ev, f) => { ev.stopPropagation(); L.elec.pick = f.rec.iso3; card("elec"); });
      }
    }
    // disputed areas: hatched shapes, and a marker for each dispute
    {
      const g = W.layer("disputes");
      const show = L.disp.on && A && map;
      g.style("display", show ? null : "none");
      if (show) {
        defs();
        const of = new Map(); A.disputes.forEach((d) => d.codes.forEach((c) => of.set(c, d)));
        g.selectAll("path").data(DG.filter((f) => of.has(f.properties.BRK_A3)), (f) => f.properties.BRK_A3).join("path").attr("class", "dsp-a").attr("d", W.geoPath()).style("fill", "url(#dispHatch)")
          .attr("vector-effect", "non-scaling-stroke")
          .attr("data-base", (f) => `${of.get(f.properties.BRK_A3).name} · disputed (click to find out why)`)
          .on("click", (ev, f) => { ev.stopPropagation(); L.disp.pick = of.get(f.properties.BRK_A3).id; card("disp"); });
        const pts = A.disputes.map((d) => ({ d, xy: W.project(d.at[0], d.at[1]) })).filter((p) => p.xy);
        g.selectAll("g.dsp-m").data(pts, (p) => p.d.id).join((en) => { const gg = en.append("g").attr("class", "dsp-m"); gg.append("circle"); gg.append("text").text("?"); return gg; })
          .attr("transform", (p) => `translate(${p.xy[0]},${p.xy[1]}) scale(${1 / k})`)
          .classed("on", (p) => L.disp.pick === p.d.id)
          .attr("data-base", (p) => `${p.d.name} · ${p.d.who}`)
          .on("click", (ev, p) => { ev.stopPropagation(); L.disp.pick = p.d.id; card("disp"); });
        g.selectAll("g.dsp-m circle").attr("r", 8).attr("data-base", function () { return this.parentNode.getAttribute("data-base"); });
        g.selectAll("g.dsp-m text").attr("data-base", function () { return this.parentNode.getAttribute("data-base"); });
        g.raise();
      }
    }
    // conflicts: a pulsing dot, coloured by whether it is getting worse
    {
      const g = W.layer("conflicts");
      const show = L.conf.on && A && map;
      g.style("display", show ? null : "none");
      if (show) {
        const pts = A.conflicts.map((c, i) => ({ c, i, xy: W.project(c.at[0], c.at[1]) })).filter((p) => p.xy);
        g.selectAll("g.cf").data(pts, (p) => p.i).join((en) => { const gg = en.append("g").attr("class", "cf"); gg.append("circle").attr("class", "cf-p"); gg.append("circle").attr("class", "cf-d"); return gg; })
          .attr("transform", (p) => `translate(${p.xy[0]},${p.xy[1]}) scale(${1 / k})`)
          .style("--cf", (p) => STATUS[p.c.status] || "#d23b3b")
          .classed("on", (p) => L.conf.pick === p.i)
          .on("click", (ev, p) => { ev.stopPropagation(); L.conf.pick = p.i; card("conf"); });
        g.selectAll("g.cf circle").attr("r", 7).attr("data-base", function () { const p = d3.select(this.parentNode).datum(); return `${p.c.name} · ${p.c.status.toLowerCase()}`; });
        g.raise();
      }
    }
  }

  // ---------- The cards ----------
  const CARD = { disp: ["dispCard", "⚖️ Disputed borders and territories"], conf: ["confCard", "🔥 Current conflicts"], elec: ["elecCard", "🗳️ Elections"] };
  function card(kind) {
    const [id, title] = CARD[kind], S = L[kind];
    let el = $("#" + id);
    if (!el) { el = document.createElement("div"); el.id = id; el.className = "card livecard affcard"; $("#mapstage").appendChild(el); }
    el.hidden = !S.on || W.state.view !== "map" || !A;
    $(`#${kind}Btn`)?.setAttribute("aria-pressed", String(S.on));
    if (el.hidden) { draw(); return; }
    let body = "";
    if (kind === "disp") {
      const d = A.disputes.find((x) => x.id === S.pick);
      body = d ? `<div class="aff-one"><h4>${esc(d.name)}</h4><p class="aff-who">${esc(d.who)}</p><p>${esc(d.text)}</p>
          <p class="aff-links"><a href="${wiki(d.name)}" target="_blank" rel="noopener">Read more on Wikipedia ↗</a> · <button type="button" class="linkbtn" data-back>All disputes</button></p></div>`
        : `<p class="hint">Places where countries disagree about who should rule, or where the border runs. Striped: the disputed land; <b>?</b> click for an explainer.</p>
          <ul class="aff-list">${A.disputes.map((x) => `<li><button type="button" class="linkbtn" data-d="${x.id}">${esc(x.name)}</button> <small>${esc(x.who)}</small></li>`).join("")}</ul>`;
    } else if (kind === "conf") {
      const c = A.conflicts[S.pick];
      const order = ["Worsening", "Developing", "Unchanging", "Improving"];
      body = c ? `<div class="aff-one"><h4>${esc(c.name)}</h4><p class="aff-who"><span class="cf-st" style="--cf:${STATUS[c.status]}">${esc(c.status)}</span> ${esc(c.type)}</p><p>${esc(c.text)}</p>
          <p class="aff-links"><a href="https://www.cfr.org/global-conflict-tracker" target="_blank" rel="noopener">Global Conflict Tracker ↗</a> · <a href="${wiki(c.name)}" target="_blank" rel="noopener">Wikipedia ↗</a> · <button type="button" class="linkbtn" data-back>All conflicts</button></p></div>`
        : `<p class="hint">The ${A.conflicts.length} conflicts followed by the Council on Foreign Relations' Global Conflict Tracker. Colour: is it getting worse?</p>
          <p class="aff-key">${order.map((s) => `<span class="cf-st" style="--cf:${STATUS[s]}">${s}</span>`).join(" ")}</p>
          <ul class="aff-list">${A.conflicts.map((x, i) => [x, i]).sort((a, b) => order.indexOf(a[0].status) - order.indexOf(b[0].status)).map(([x, i]) => `<li><span class="cf-dot" style="--cf:${STATUS[x.status]}"></span><button type="button" class="linkbtn" data-c="${i}">${esc(x.name)}</button></li>`).join("")}</ul>`;
    } else {
      const E = elections();
      const pick = S.pick && A.elections.filter(([iso]) => iso === S.pick);
      const row = (e) => `<li><span class="el-date">${esc(dateText(e.date))}</span> <button type="button" class="linkbtn" data-e="${e.iso}">${flag(e.iso)} ${esc(name(e.iso))}</button> <small>${esc(e.type)}</small></li>`;
      body = pick ? `<div class="aff-one"><h4>${flag(S.pick)} ${esc(name(S.pick))}</h4><ul class="aff-list">${pick.map(([iso, date, type]) => `<li><span class="el-date">${esc(dateText(date))}</span> ${esc(type)} <a href="${wiki(`${date.slice(0, 4)} ${name(iso)} election`)}" target="_blank" rel="noopener">↗</a></li>`).join("")}</ul>
          <p class="aff-links"><button type="button" class="linkbtn" data-back>All elections</button></p></div>`
        : `<div class="seg cg-tabs"><button type="button" role="radio" data-t="next" aria-checked="${S.tab === "next"}">Coming up (${E.next.length})</button><button type="button" role="radio" data-t="past" aria-checked="${S.tab === "past"}">Last 12 months (${E.past.length})</button></div>
          <p class="aff-key"><span class="el-sw next"></span>Coming up <span class="el-sw past"></span>In the last year</p>
          <ul class="aff-list">${(S.tab === "next" ? E.next : E.past).map(row).join("") || "<li>None listed.</li>"}</ul>
          <p class="hint">National elections only. Dates can change: check the country's electoral commission. Links go to Wikipedia for candidates and results.</p>`;
    }
    el.innerHTML = `<div class="dsc-head"><h3>${title}</h3><button type="button" class="iconbtn" data-x aria-label="Close">×</button></div>${body}
      <p class="hint aff-src">Last checked ${esc(dateText(A.checked))}.${kind === "disp" ? " Shapes: Natural Earth." : kind === "conf" ? " Source: Council on Foreign Relations, Global Conflict Tracker." : " Source: national electoral calendars (Wikipedia)."} Explanations are short summaries: read more before relying on them.</p>`;
    el.querySelector("[data-x]").onclick = () => toggle(kind, false);
    el.querySelectorAll("[data-back]").forEach((b) => (b.onclick = () => { S.pick = null; card(kind); }));
    el.querySelectorAll("[data-d]").forEach((b) => (b.onclick = () => { S.pick = b.dataset.d; const d = A.disputes.find((x) => x.id === S.pick); zoomTo(d.at, 4); card(kind); }));
    el.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => { S.pick = +b.dataset.c; const c = A.conflicts[S.pick]; zoomTo(c.at, 3); card(kind); }));
    el.querySelectorAll("[data-e]").forEach((b) => (b.onclick = () => { S.pick = b.dataset.e; W.zoomToCountry?.(S.pick); card(kind); }));
    el.querySelectorAll(".cg-tabs button").forEach((b) => (b.onclick = () => { S.tab = b.dataset.t; card(kind); }));
    draw();
  }
  // zoom so the place sits to the right of the card on the left of the map
  function zoomTo(at, k) {
    const card = document.querySelector("#mapcards"), stage = document.querySelector("#mapstage");
    const shift = card && stage ? Math.min(card.getBoundingClientRect().width / 2, stage.clientWidth / 4) : 0;
    W.zoomToPoint(at[0], at[1], k);
    if (shift) setTimeout(() => W.panBy?.(shift, 0), 650);
  }
  async function toggle(kind, on) {
    const S = L[kind];
    S.on = on ?? !S.on;
    if (S.on) await load();
    if (!A) S.on = false;
    card(kind);
  }
  function init() {
    W = window.WC;
    let box = $("#mapbtns");
    if (!box) { box = document.createElement("div"); box.id = "mapbtns"; box.className = "mapbtns"; $("#mapstage").appendChild(box); }
    [["disp", "⚖️ Disputed borders"], ["conf", "🔥 Conflicts"], ["elec", "🗳️ Elections"]].forEach(([k, t]) => {
      const b = document.createElement("button");
      b.type = "button"; b.id = k + "Btn"; b.className = "mmbtn"; b.setAttribute("aria-pressed", "false"); b.textContent = t;
      b.onclick = () => toggle(k);
      box.appendChild(b);
    });
  }
  window.WAF = {
    init, draw: () => draw(),
    refresh: () => { if (!A) return; Object.keys(L).forEach((k) => { if (L[k].on) card(k); }); draw(); },
    _L: L,
  };
})();
