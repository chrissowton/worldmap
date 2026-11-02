/* City growth: about 2,600 cities (UN World Urbanization Prospects 2025, degree-of-urbanisation cities) as circles
   sized by population, every 5 years from 1975 to 2050 (after 2025 = UN projections). Play it, see the top ten,
   the fastest growing, and a growth line for any city. */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let W, D = null, loading = null;
  const G = { on: false, yi: null, pick: null, timer: null, tab: "top" };
  const fmt = (k) => (k >= 1000 ? `${(k / 1000).toFixed(k >= 10000 ? 0 : 1)} million` : `${Math.round(k).toLocaleString()} thousand`);
  function load() {
    if (D) return Promise.resolve(D);
    loading ||= (window.__CITIESGROWTH__ ? Promise.resolve(window.__CITIESGROWTH__) : fetch("cities_growth.json?v=47").then((r) => r.json()))
      .then((j) => (D = { years: j.years, c: j.c.map(([n, iso, lat, lon, cap, p], i) => ({ i, n, iso, lat, lon, cap, p })) }))
      .catch(() => (D = { years: [], c: [] }));
    return loading;
  }
  const r = d3.scaleSqrt().domain([0, 40000]).range([0, 26]);
  // colour: how fast the city grew over the previous 25 years
  const growth = (c, yi) => { const j = Math.max(0, yi - 5); return c.p[j] > 0 ? (c.p[yi] / c.p[j] - 1) * 100 : null; };
  const gCol = (g) => (g == null ? "#999" : g < 0 ? "#3b7dd8" : g < 25 ? "#9cc5a1" : g < 75 ? "#f2a541" : g < 150 ? "#d6453d" : "#7a1f1f");
  function draw() {
    const g = W.layer("cgrow");
    g.style("display", G.on && W.state.view === "map" ? null : "none");
    if (!G.on || !D) return;
    const k = W.k || 1, yi = G.yi;
    const pts = D.c.filter((c) => c.p[yi] >= 300).map((c) => ({ c, xy: W.project(c.lon, c.lat) })).filter((d) => d.xy).sort((a, b) => b.c.p[yi] - a.c.p[yi]);
    g.selectAll("circle").data(pts, (d) => d.c.i).join("circle")
      .attr("cx", (d) => d.xy[0]).attr("cy", (d) => d.xy[1])
      .attr("r", (d) => Math.max(1.4, r(d.c.p[yi])) / Math.sqrt(k))
      .attr("fill", (d) => gCol(growth(d.c, yi))).attr("fill-opacity", 0.72)
      .attr("stroke", (d) => (G.pick === d.c.i ? "#14212b" : "#fff")).attr("stroke-width", (d) => (G.pick === d.c.i ? 2 : 0.5) / k)
      .attr("data-base", (d) => { const gr = growth(d.c, yi); return `${d.c.n}, ${W.byIso.get(d.c.iso)?.name || d.c.iso} · ${fmt(d.c.p[yi])} in ${D.years[yi]}${gr != null && yi >= 5 ? ` · ${gr >= 0 ? "+" : ""}${Math.round(gr)}% in 25 years` : ""}`; })
      .style("cursor", "pointer")
      .on("click", (e, d) => { e.stopPropagation(); G.pick = d.c.i; G.tab = "city"; card(); draw(); });
    g.raise();
  }
  function lineSVG(c) {
    const Wd = 320, H = 150, ml = 44, mr = 10, mt = 12, mb = 22;
    const x = d3.scaleLinear().domain([1975, 2050]).range([ml, Wd - mr]);
    const y = d3.scaleLinear().domain([0, d3.max(c.p) * 1.08]).nice().range([H - mb, mt]);
    const pts = D.years.map((yr, i) => [x(yr), y(c.p[i])]);
    const past = pts.filter((_, i) => D.years[i] <= 2025), fut = pts.filter((_, i) => D.years[i] >= 2025);
    const path = (a) => a.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
    return `<svg class="cg-svg" viewBox="0 0 ${Wd} ${H}" role="img" aria-label="Population of ${esc(c.n)} 1975 to 2050">
      ${y.ticks(4).map((v) => `<line x1="${ml}" x2="${Wd - mr}" y1="${y(v)}" y2="${y(v)}" stroke="#d8dde1" stroke-width=".6"/><text x="${ml - 5}" y="${y(v) + 3.5}" font-size="10" text-anchor="end" fill="#56646e">${v >= 1000 ? v / 1000 + "m" : v + "k"}</text>`).join("")}
      ${[1975, 2000, 2025, 2050].map((v) => `<text x="${x(v)}" y="${H - 6}" font-size="10" text-anchor="middle" fill="#56646e">${v}</text>`).join("")}
      <line x1="${x(2025)}" x2="${x(2025)}" y1="${mt}" y2="${H - mb}" stroke="#aab4bb" stroke-dasharray="3 3"/>
      <path d="${path(past)}" fill="none" stroke="#d6453d" stroke-width="2.4"/><path d="${path(fut)}" fill="none" stroke="#d6453d" stroke-width="2.2" stroke-dasharray="5 4"/>
      <circle cx="${x(D.years[G.yi])}" cy="${y(c.p[G.yi])}" r="4" fill="#14212b"/>
    </svg>`;
  }
  function card() {
    let el = $("#cgCard");
    if (!el) { el = document.createElement("div"); el.id = "cgCard"; el.className = "card livecard cgcard"; $("#mapstage").appendChild(el); }
    el.hidden = !G.on || W.state.view !== "map";
    $("#cgBtn")?.setAttribute("aria-pressed", String(G.on));
    if (el.hidden || !D) return;
    const yi = G.yi, yr = D.years[yi];
    const live = D.c.filter((c) => c.p[yi] > 0);
    const top = live.slice().sort((a, b) => b.p[yi] - a.p[yi]).slice(0, 10);
    const fast = yi >= 5 ? live.filter((c) => c.p[yi - 5] >= 1000).sort((a, b) => growth(b, yi) - growth(a, yi)).slice(0, 10) : [];
    const n10 = live.filter((c) => c.p[yi] >= 10000).length, n1 = live.filter((c) => c.p[yi] >= 1000).length;
    const c = G.pick != null ? D.c[G.pick] : null;
    const row = (x, val) => `<li><button type="button" class="linkbtn" data-c="${x.i}">${esc(x.n)}</button> <small>${esc(W.byIso.get(x.iso)?.name || x.iso)}</small> <b>${val}</b></li>`;
    el.innerHTML = `<div class="dsc-head"><h3>🏙️ City growth</h3><button type="button" class="iconbtn" id="cgX" aria-label="Close">×</button></div>
      <div class="cg-year"><button type="button" class="play" id="cgPlay" aria-label="${G.timer ? "Pause" : "Play"}">${G.timer ? "❚❚" : "▶"}</button>
        <input type="range" id="cgRange" min="0" max="${D.years.length - 1}" step="1" value="${yi}" aria-label="Year"><b class="cg-y">${yr}</b></div>
      <p class="lv-sum">${yr > 2025 ? "<i>UN projection.</i> " : ""}<b>${n10}</b> megacities of 10 million+, <b>${n1}</b> cities of a million or more.</p>
      <div class="seg cg-tabs">${[["top", "Largest"], ["fast", "Fastest growing"], ["city", "One city"]].map(([k, l]) => `<button type="button" data-t="${k}" aria-checked="${G.tab === k}" role="radio">${l}</button>`).join("")}</div>
      ${G.tab === "top" ? `<ol class="cg-list">${top.map((x) => row(x, fmt(x.p[yi]))).join("")}</ol>`
        : G.tab === "fast" ? (fast.length ? `<p class="hint">Cities that already had a million people in ${yr - 25} and grew most by ${yr}:</p><ol class="cg-list">${fast.map((x) => row(x, `+${Math.round(growth(x, yi))}%`)).join("")}</ol>` : `<p class="hint">Pick 2000 or later to see growth over 25 years.</p>`)
        : c ? `<p class="cg-name"><b>${esc(c.n)}</b>, ${esc(W.byIso.get(c.iso)?.name || c.iso)}${c.cap ? " (capital)" : ""}</p>${lineSVG(c)}
            <p class="hint">${fmt(c.p[0])} in 1975 → ${fmt(c.p[D.years.indexOf(2025)])} in 2025 → ${fmt(c.p[D.years.length - 1])} projected for 2050. Dashed: UN projection.</p>`
        : `<p class="hint">Click a circle on the map, or a city in the lists.</p>`}
      <label class="fld cg-find"><input id="cgFind" list="cgList" placeholder="Find a city…" autocomplete="off"></label><datalist id="cgList"></datalist>
      <p class="lv-key"><span style="background:#3b7dd8"></span>shrinking <span style="background:#9cc5a1"></span>under +25% <span style="background:#f2a541"></span>+25–75% <span style="background:#d6453d"></span>+75–150% <span style="background:#7a1f1f"></span>more than doubled (25 years). Size: population.</p>
      <p class="hint">UN World Urbanization Prospects 2025. Cities are measured as continuous built-up areas (“degree of urbanisation”), so they can be bigger than official city limits.</p>`;
    $("#cgX").onclick = () => toggle(false);
    $("#cgRange").oninput = (e) => { stop(); G.yi = +e.target.value; draw(); card(); };
    $("#cgPlay").onclick = () => (G.timer ? stop() : play());
    el.querySelectorAll(".cg-tabs button").forEach((b) => (b.onclick = () => { G.tab = b.dataset.t; card(); }));
    el.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => { const x = D.c[+b.dataset.c]; G.pick = x.i; G.tab = "city"; W.zoomToPoint(x.lon, x.lat, 5); card(); draw(); }));
    const inp = $("#cgFind");
    inp.oninput = () => {
      const q = inp.value.trim().toLowerCase();
      if (q.length < 2) return;
      $("#cgList").innerHTML = D.c.filter((x) => x.n.toLowerCase().includes(q)).slice(0, 30).map((x) => `<option value="${esc(x.n)} (${esc(W.byIso.get(x.iso)?.name || x.iso)})"></option>`).join("");
      const hit = D.c.find((x) => `${x.n} (${W.byIso.get(x.iso)?.name || x.iso})`.toLowerCase() === q);
      if (hit) { G.pick = hit.i; G.tab = "city"; W.zoomToPoint(hit.lon, hit.lat, 5); card(); draw(); }
    };
  }
  function play() {
    if (G.yi >= D.years.length - 1) G.yi = 0;
    G.timer = setInterval(() => { G.yi++; if (G.yi >= D.years.length - 1) stop(); draw(); card(); }, 900);
    card();
  }
  function stop() { if (G.timer) { clearInterval(G.timer); G.timer = null; card(); } }
  async function toggle(on) {
    G.on = on ?? !G.on;
    if (!G.on) { stop(); }
    else { if (window.WX?._L?.on) window.WX.toggleLive(false); const b = $("#cgBtn"); if (b) b.textContent = "🏙️ Loading…"; await load(); if (b) b.textContent = "🏙️ City growth"; if (G.yi == null) G.yi = D.years.indexOf(2025); }
    draw(); card();
  }
  function init() {
    W = window.WC;
    let box = $("#mapbtns");
    if (!box) { box = document.createElement("div"); box.id = "mapbtns"; box.className = "mapbtns"; $("#mapstage").appendChild(box); }
    const b = document.createElement("button");
    b.type = "button"; b.id = "cgBtn"; b.className = "mmbtn"; b.setAttribute("aria-pressed", "false");
    b.textContent = "🏙️ City growth"; b.title = "How the world's cities have grown since 1975, and UN projections to 2050";
    b.onclick = () => toggle();
    box.appendChild(b);
  }
  window.WCG = { init, draw: () => { draw(); }, refresh: () => { if (G.on) { draw(); const el = $("#cgCard"); if (el) el.hidden = W.state.view !== "map"; } }, toggle, _G: G };
})();
