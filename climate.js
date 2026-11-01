/* Climate graphs from the WMO 1991–2020 climate normals (about 4,800 weather stations).
   "🌡️ Climate graphs" on the map shows the stations, coloured by average temperature. Click one (or search) for its
   climate graph: rainfall bars, temperature line (with the daily max–min range), the key figures and its Köppen climate type.
   Add a second station to compare them on the same scales. */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const MON = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  let W, data = null, loading = null;
  const C = { on: false, picked: [], };

  function load() {
    if (data) return Promise.resolve(data);
    loading ||= (window.__CLIMATE__ ? Promise.resolve(window.__CLIMATE__) : fetch("climate.json?v=45").then((r) => r.json()))
      .then((j) => (data = j.s.map(([name, iso, lat, lon, elev, t, p, tx, tn, d], i) => ({ i, name, iso, lat, lon, elev, t, p, tx: tx || null, tn: tn || null, d: d || null,
        mat: d3.mean(t), map: d3.sum(p) }))))
      .catch(() => (data = []));
    return loading;
  }

  // ---------- Köppen–Geiger climate type (Peel, Finlayson & McMahon 2007 rules) ----------
  const KNAMES = {
    Af: "Tropical rainforest", Am: "Tropical monsoon", Aw: "Tropical savanna", As: "Tropical savanna (dry summer)",
    BWh: "Hot desert", BWk: "Cold desert", BSh: "Hot semi-arid (steppe)", BSk: "Cold semi-arid (steppe)",
    Csa: "Mediterranean, hot summer", Csb: "Mediterranean, warm summer", Csc: "Mediterranean, cool summer",
    Cwa: "Humid subtropical, dry winter", Cwb: "Subtropical highland", Cwc: "Cold subtropical highland",
    Cfa: "Humid subtropical", Cfb: "Temperate oceanic", Cfc: "Subpolar oceanic",
    Dsa: "Continental, hot dry summer", Dsb: "Continental, warm dry summer", Dsc: "Subarctic, dry summer", Dsd: "Subarctic, very cold winter",
    Dwa: "Continental, hot summer, dry winter", Dwb: "Continental, warm summer, dry winter", Dwc: "Subarctic, dry winter", Dwd: "Subarctic, very cold dry winter",
    Dfa: "Humid continental, hot summer", Dfb: "Humid continental, warm summer", Dfc: "Subarctic", Dfd: "Subarctic, very cold winter",
    ET: "Tundra", EF: "Ice cap",
  };
  function koppen(s) {
    const T = s.t, P = s.p, mat = d3.mean(T), map = d3.sum(P), tw = d3.max(T), tc = d3.min(T);
    const sumIdx = s.lat >= 0 ? [3, 4, 5, 6, 7, 8] : [9, 10, 11, 0, 1, 2];
    const winIdx = [...Array(12).keys()].filter((i) => !sumIdx.includes(i));
    const Ps = sumIdx.map((i) => P[i]), Pw = winIdx.map((i) => P[i]);
    const psum = d3.sum(Ps), pwin = d3.sum(Pw);
    const pth = pwin >= 0.7 * map ? 2 * mat : psum >= 0.7 * map ? 2 * mat + 28 : 2 * mat + 14;
    if (tw <= 10) return tw > 0 ? "ET" : "EF";
    if (map < 10 * pth) return (map < 5 * pth ? "BW" : "BS") + (mat >= 18 ? "h" : "k");
    if (tc >= 18) { const pd = d3.min(P); return pd >= 60 ? "Af" : pd >= 100 - map / 25 ? "Am" : "Aw"; }
    const first = tc > 0 ? "C" : "D";
    const psdry = d3.min(Ps), pwdry = d3.min(Pw), pswet = d3.max(Ps), pwwet = d3.max(Pw);
    const second = psdry < 40 && psdry < pwwet / 3 ? "s" : pwdry < pswet / 10 ? "w" : "f";
    const warm = T.filter((t) => t >= 10).length;
    const third = tw >= 22 ? "a" : warm >= 4 ? "b" : first === "D" && tc < -38 ? "d" : "c";
    return first + second + third;
  }

  // ---------- The graph ----------
  function scales(list) {
    const tAll = list.flatMap((s) => s.t.concat(s.tx || [], s.tn || []));
    const tLo = Math.min(0, d3.min(tAll)), tHi = Math.max(10, d3.max(tAll));
    const pHi = Math.max(50, d3.max(list.flatMap((s) => s.p)));
    return { t: [Math.floor(tLo / 5) * 5, Math.ceil(tHi / 5) * 5], p: [0, Math.ceil(pHi / 50) * 50] };
  }
  function graphSVG(s, sc) {
    const Wd = 440, H = 250, ml = 40, mr = 44, mt = 26, mb = 26;
    const x = d3.scaleBand().domain(d3.range(12)).range([ml, Wd - mr]).padding(0.18);
    const yt = d3.scaleLinear().domain(sc.t).range([H - mb, mt]);
    const yp = d3.scaleLinear().domain(sc.p).range([H - mb, mt]);
    const cx = (i) => x(i) + x.bandwidth() / 2;
    const line = (arr) => arr.map((v, i) => `${i ? "L" : "M"}${cx(i).toFixed(1)},${yt(v).toFixed(1)}`).join("");
    const band = s.tx && s.tn ? `M${s.tx.map((v, i) => `${cx(i).toFixed(1)},${yt(v).toFixed(1)}`).join("L")}L${s.tn.map((v, i) => `${cx(i).toFixed(1)},${yt(v).toFixed(1)}`).reverse().join("L")}Z` : "";
    const tt = yt.ticks(6), pt = yp.ticks(5);
    return `<svg class="cl-svg" viewBox="0 0 ${Wd} ${H}" role="img" aria-label="Climate graph for ${esc(s.name)}: average temperature and rainfall each month" font-family="IBM Plex Sans, Arial, sans-serif">
      <rect x="0" y="0" width="${Wd}" height="${H}" fill="var(--surface, #fff)"/>
      ${tt.map((v) => `<line x1="${ml}" x2="${Wd - mr}" y1="${yt(v)}" y2="${yt(v)}" stroke="#d8dde1" stroke-width="${v === 0 ? 1.2 : 0.6}"/>`).join("")}
      ${s.p.map((v, i) => `<rect x="${x(i)}" y="${yp(v)}" width="${x.bandwidth()}" height="${Math.max(0, H - mb - yp(v))}" fill="#4a90d9"><title>${MONTH[i]}: ${v} mm</title></rect>`).join("")}
      ${band ? `<path d="${band}" fill="#e05a47" fill-opacity=".16"/>` : ""}
      <path d="${line(s.t)}" fill="none" stroke="#d6453d" stroke-width="2.4"/>
      ${s.t.map((v, i) => `<circle cx="${cx(i)}" cy="${yt(v)}" r="3" fill="#d6453d"><title>${MONTH[i]}: ${v} °C${s.tx ? ` (${s.tn[i]} to ${s.tx[i]})` : ""}</title></circle>`).join("")}
      ${tt.map((v) => `<text x="${ml - 6}" y="${yt(v) + 3.5}" font-size="10.5" text-anchor="end" fill="#b3261e">${v}</text>`).join("")}
      ${pt.map((v) => `<text x="${Wd - mr + 6}" y="${yp(v) + 3.5}" font-size="10.5" fill="#1f5fa8">${v}</text>`).join("")}
      ${MON.map((m, i) => `<text x="${cx(i)}" y="${H - mb + 15}" font-size="11" text-anchor="middle" fill="#56646e">${m}</text>`).join("")}
      <text x="${ml - 6}" y="14" font-size="10.5" text-anchor="end" fill="#b3261e">°C</text>
      <text x="${Wd - mr + 6}" y="14" font-size="10.5" fill="#1f5fa8">mm</text>
      <text x="${(ml + Wd - mr) / 2}" y="14" font-size="12" font-weight="600" text-anchor="middle" fill="#14212b">${esc(s.name)}, ${esc(W.byIso.get(s.iso)?.name || s.iso)}</text>
    </svg>`;
  }
  function facts(s) {
    const T = s.t, P = s.p, k = koppen(s);
    const wet = d3.maxIndex(P), dry = d3.minIndex(P), hot = d3.maxIndex(T), cold = d3.minIndex(T);
    const lat = `${Math.abs(s.lat).toFixed(1)}°${s.lat >= 0 ? "N" : "S"}, ${Math.abs(s.lon).toFixed(1)}°${s.lon >= 0 ? "E" : "W"}`;
    return [
      ["Where", `${lat}${s.elev != null ? `, ${s.elev.toLocaleString()} m above sea level` : ""}`],
      ["Climate type (Köppen)", `${k}: ${KNAMES[k] || ""}`],
      ["Average temperature", `${d3.mean(T).toFixed(1)} °C`],
      ["Temperature range", `${(T[hot] - T[cold]).toFixed(1)} °C (${MONTH[cold]} ${T[cold]} °C to ${MONTH[hot]} ${T[hot]} °C)`],
      ["Total rainfall", `${Math.round(d3.sum(P)).toLocaleString()} mm a year`],
      ["Wettest month", `${MONTH[wet]} (${P[wet]} mm)`],
      ["Driest month", `${MONTH[dry]} (${P[dry]} mm)`],
      ...(s.d ? [["Days with rain (1 mm or more)", `${Math.round(d3.sum(s.d))} a year`]] : []),
    ];
  }

  // ---------- The card ----------
  function card() {
    let el = $("#climCard");
    if (!el) { el = document.createElement("div"); el.id = "climCard"; el.className = "card dsc stx clim"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Climate graph"); document.body.appendChild(el); }
    const list = C.picked.map((i) => data[i]).filter(Boolean);
    el.hidden = !list.length;
    if (!list.length) return;
    const sc = scales(list);
    el.innerHTML = `<div class="dsc-head"><h2>🌡️ Climate graph${list.length > 1 ? "s" : ""}</h2><button type="button" class="iconbtn" id="clX" aria-label="Close">×</button></div>
      <div class="cl-grid ${list.length > 1 ? "two" : ""}">${list.map((s, j) => `<section class="cl-one">${graphSVG(s, sc)}
        <table class="stx-t cl-facts">${facts(s).map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join("")}</table>
        <div class="dsc-row"><button type="button" class="ghost" data-a="ws" data-j="${j}">＋ Worksheet</button><button type="button" class="ghost" data-a="png" data-j="${j}">Download image</button>${list.length > 1 ? `<button type="button" class="linkbtn" data-a="rm" data-j="${j}">Remove</button>` : ""}</div></section>`).join("")}</div>
      <label class="fld cl-find">${list.length > 1 ? "Change the second place" : "Compare with another place"} <input id="clFind" list="clList" placeholder="Type a place or country, e.g. Manaus or Kenya" autocomplete="off"></label>
      <datalist id="clList"></datalist>
      <p class="hint">WMO climate normals, 1991–2020 averages. Blue bars: rainfall (right-hand scale). Red line: average temperature${list.some((s) => s.tx) ? "; the pink band shows the average daily highs and lows" : ""}. ${list.length > 1 ? "Both graphs use the same scales, so you can compare them directly." : "Tip: hold Shift and click another station to compare."}</p>`;
    $("#clX").onclick = () => { C.picked = []; card(); draw(); };
    el.querySelectorAll("[data-a]").forEach((b) => (b.onclick = async () => {
      const s = list[+b.dataset.j], svg = el.querySelectorAll(".cl-svg")[+b.dataset.j];
      if (b.dataset.a === "rm") { C.picked.splice(+b.dataset.j, 1); card(); draw(); return; }
      if (b.dataset.a === "ws") return window.WK?.addSVG(svg, `Climate graph: ${s.name}, ${W.byIso.get(s.iso)?.name || ""} (${koppen(s)})`, "#ffffff");
      const cv = await window.WV.svgToCanvas(svg, 3, "#ffffff");
      cv.toBlob((bl) => { const a = document.createElement("a"); a.href = URL.createObjectURL(bl); a.download = `climate-graph-${s.name.replace(/\W+/g, "-").toLowerCase()}.png`; a.click(); }, "image/png");
    }));
    const inp = $("#clFind");
    inp.oninput = () => {
      const q = inp.value.trim().toLowerCase();
      if (q.length < 2) return;
      const cIso = W.rows.find((r) => r.name.toLowerCase() === q)?.iso3;
      const hits = data.filter((s) => (cIso ? s.iso === cIso : s.name.toLowerCase().includes(q))).slice(0, 40);
      $("#clList").innerHTML = hits.map((s) => `<option value="${esc(s.name)} (${esc(W.byIso.get(s.iso)?.name || s.iso)})"></option>`).join("");
      const exact = data.find((s) => `${s.name} (${W.byIso.get(s.iso)?.name || s.iso})`.toLowerCase() === q);
      if (exact) pick(exact.i, true);
    };
  }
  function pick(i, add) {
    if (add && C.picked.length) C.picked = [C.picked[0], i];
    else C.picked = [i];
    card(); draw();
  }

  // ---------- Stations on the map ----------
  const tCol = d3.scaleSequential(d3.interpolateRdYlBu).domain([30, -10]);
  function draw() {
    const g = W.layer("clim");
    g.style("display", C.on && W.state.view === "map" ? null : "none");
    if (!C.on || !data) return;
    const k = W.k || 1;
    const pts = data.map((s) => ({ s, p: W.project(s.lon, s.lat) })).filter((d) => d.p);
    g.selectAll("circle").data(pts, (d) => d.s.i).join("circle")
      .attr("cx", (d) => d.p[0]).attr("cy", (d) => d.p[1])
      .attr("r", (d) => (C.picked.includes(d.s.i) ? 6 : 2.6) / k)
      .attr("fill", (d) => tCol(d.s.mat)).attr("stroke", (d) => (C.picked.includes(d.s.i) ? "#14212b" : "#fff")).attr("stroke-width", (d) => (C.picked.includes(d.s.i) ? 2 : 0.5) / k)
      .attr("data-base", (d) => `${d.s.name}, ${W.byIso.get(d.s.iso)?.name || ""} · ${d.s.mat.toFixed(1)} °C · ${Math.round(d.s.map).toLocaleString()} mm a year · ${koppen(d.s)}`)
      .style("cursor", "pointer")
      .on("click", (e, d) => { e.stopPropagation(); pick(d.s.i, e.shiftKey); });
    g.selectAll("circle").filter((d) => C.picked.includes(d.s.i)).raise();
    g.raise();
  }
  async function toggle(on) {
    C.on = on ?? !C.on;
    $("#climBtn")?.setAttribute("aria-pressed", String(C.on));
    if (C.on) {
      const b = $("#climBtn"); if (b) b.textContent = "🌡️ Loading…";
      await load();
      if (b) b.textContent = "🌡️ Climate graphs";
      if (!C.picked.length && data.length) {
        // start with the station nearest the selected country's capital, or London
        const r = W.byIso.get(W.state.selected || "GBR");
        const cap = W.cities.find((c) => c.iso3 === r?.iso3 && c.city_capital);
        const ll = cap ? [cap.lat, cap.lon] : r?.latlng || [51.5, -0.1];
        const near = d3.least(data.filter((s) => !r || s.iso === r.iso3).concat(data.length ? [] : []), (s) => (s.lat - ll[0]) ** 2 + (s.lon - ll[1]) ** 2);
        if (near) C.picked = [near.i];
      }
      card();
    } else { const el = $("#climCard"); if (el) el.hidden = true; }
    draw();
  }

  function init() {
    W = window.WC;
    let box = $("#mapbtns");
    if (!box) { box = document.createElement("div"); box.id = "mapbtns"; box.className = "mapbtns"; $("#mapstage").appendChild(box); }
    const live = $("#liveBtn"); if (live) box.appendChild(live);
    const b = document.createElement("button");
    b.type = "button"; b.id = "climBtn"; b.className = "mmbtn"; b.setAttribute("aria-pressed", "false");
    b.textContent = "🌡️ Climate graphs"; b.title = "Weather stations with climate graphs (1991–2020 averages)";
    b.onclick = () => toggle();
    box.appendChild(b);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && C.picked.length) { C.picked = []; card(); draw(); } });
  }
  window.WCL = { init, toggle, draw, koppen, load, _C: C, get data() { return data; } };
})();
