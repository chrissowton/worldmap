/* More layers (v67–68), in More on the map:
   - Arctic sea ice: the September minimum, 1979 onwards (NSIDC; seaice.json)
   - Colonial history: which European power ruled each of today's countries, 1500–2000 (COLDAT; colonies.json)
   - China's overseas lending (the Belt and Road): AidData's geocoded Chinese development finance, 2000–2021 (bri.json)
   - Water: shared rivers where countries argue (or cooperate) over water, and water stress
   - Fires now: satellite fire detections in the last 24 hours (NASA FIRMS, loaded live; NASA EONET if that fails) */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const wiki = (q) => `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(q)}`;
  let W, BR = null, brLoad = null, FI = null, fiLoad = null;
  const P = { bri: { on: false, pick: null, sect: -1, from: 2000, iso: "" }, water: { on: false, pick: null }, fires: { on: false, pick: null, state: "" }, ice: { on: false, year: 2026, cmp: 1980 }, col: { on: false, pick: null, year: 1914 } };
  let ICE = null, iceLoad = null, COL = null, colLoad = null, colTimer = null;
  const CCOL = { britain: "#c0392b", france: "#2f6fd1", spain: "#e0a000", portugal: "#2e9d55", netherlands: "#e67e22", belgium: "#6d4c41", germany: "#4a4a4a", italy: "#8e44ad" };
  const getJ = (url, pre) => (window[pre] ? Promise.resolve(window[pre]) : fetch(url + "?v=68").then((r) => r.json()));
  function loadIce() { return (iceLoad ||= getJ("seaice.json", "__SEAICE__").then((j) => {
    ICE = j; ICE.geo = {};
    for (const [y, polys] of Object.entries(j.shapes)) {
      const f = { type: "Feature", geometry: { type: "MultiPolygon", coordinates: polys } };
      // outlines must wind the right way round for the map: a patch, not everything except the patch
      f.geometry.coordinates = polys.map((p) => { const one = { type: "Polygon", coordinates: p }; return d3.geoArea(one) > 2 * Math.PI ? p.map((r) => r.slice().reverse()) : p; });
      ICE.geo[y] = f;
    }
  }).catch(() => (ICE = null))); }
  // the Arctic seen from above the North Pole, for the card (the main map squashes it)
  function polarSVG(S) {
    const pr = d3.geoAzimuthalEqualArea().rotate([0, -90]).clipAngle(38).fitExtent([[6, 6], [294, 294]], { type: "Sphere" }).scale(1).translate([150, 150]);
    pr.fitExtent([[6, 6], [294, 294]], d3.geoCircle().center([0, 90]).radius(38)());
    const p = d3.geoPath(pr), A = ICE.geo[S.year], B = S.cmp && S.cmp !== S.year ? ICE.geo[S.cmp] : null;
    const land = W.geo.filter((f) => { const b = d3.geoBounds(f); return b[1][1] > 50; }).map((f) => `<path d="${p(f) || ""}"/>`).join("");
    const grat = p(d3.geoGraticule().step([30, 10]).extent([[-180, 50], [180, 90]])());
    return `<svg class="ice-polar" viewBox="0 0 300 300" role="img" aria-label="Arctic sea ice in September ${S.year}${B ? ` compared with ${S.cmp}` : ""}, seen from above the North Pole">
      <circle cx="150" cy="150" r="144" class="sea"/><path d="${grat}" class="gr"/>${A ? `<path d="${p(A)}" class="ia"/>` : ""}${B ? `<path d="${p(B)}" class="ib"/>` : ""}<g class="land">${land}</g>
      <text x="150" y="152" text-anchor="middle" class="np">✕ North Pole</text></svg>`;
  }
  function loadCol() { return (colLoad ||= getJ("colonies.json", "__COLONIES__").then((j) => (COL = j)).catch(() => (COL = null))); }
  // who ruled a country in a year (the most recent arrival, if two overlapped)
  const rulerIn = (iso, y) => { const r = COL?.rule[iso]; if (!r) return null; const a = r.filter(([, s, e]) => y >= s && y < e); return a.length ? a[a.length - 1] : null; };
  const SCOL = ["#d23b3b", "#e08b00", "#7a5230", "#7b55c7", "#1f7fbf", "#2e9d55", "#0d8a8a", "#8aa62b", "#c2185b", "#7a8a94"];
  const usd = (m) => (m >= 1000 ? `$${+(m / 1000).toFixed(m >= 10000 ? 0 : 1)} billion` : m >= 1 ? `$${Math.round(m)} million` : m > 0 ? `$${+(m * 1000).toFixed(0)} thousand` : "amount not known");

  // ---------- Shared rivers: [name, lon, lat, ISO3 codes, text, cooperation (1) or conflict (0)] ----------
  const RIV = [
    ["Nile: the Grand Ethiopian Renaissance Dam", 35.09, 11.21, "ETH SDN EGY", "Africa's biggest hydroelectric dam, on the Blue Nile, finished in 2025. Ethiopia says it needs the electricity to develop; Egypt, which gets almost all its water from the Nile and has 110 million people, fears for its supply, especially in droughts. There is still no agreement on how fast to fill and release the reservoir.", 0],
    ["Mekong", 101.5, 20.3, "CHN MMR LAO THA KHM VNM", "China has built 11 big dams on the upper Mekong, and Laos many more to sell electricity to Thailand. Downstream, fishing in Cambodia's Tonlé Sap lake and rice farming in Vietnam's delta depend on the river's floods and sediment, which the dams hold back.", 0],
    ["Indus", 74.0, 33.5, "IND PAK", "The Indus Waters Treaty (1960) shared the rivers between India and Pakistan and survived three wars. In April 2025, after a terrorist attack in Kashmir, India suspended it; Pakistan, which depends on the Indus for most of its farming, said stopping the water would be an act of war.", 0],
    ["Tigris and Euphrates", 38.32, 37.48, "TUR SYR IRQ", "Turkey's huge dam and irrigation scheme (the GAP, including the Atatürk Dam) has cut the flow reaching Syria and Iraq. Drought, war and dams have left Iraq's marshes and farms short of water.", 0],
    ["Colorado River", -114.74, 36.02, "USA MEX", "Seven US states and Mexico share a river that has been over-allocated since a 1922 agreement made in an unusually wet period. It rarely reaches the sea now. Lake Mead fell to record lows in 2022. When the states could not agree new rules, the US government imposed cuts for 2027–28 in August 2026, and Nevada went to court to challenge them.", 0],
    ["Amu Darya and the Aral Sea", 59.5, 44.5, "AFG TJK TKM UZB KAZ", "Soviet irrigation for cotton took so much water from the Amu Darya and Syr Darya that the Aral Sea, once the world's fourth-largest lake, has mostly dried up. Afghanistan is now digging the large Qosh Tepa canal to take more of the Amu Darya.", 0],
    ["Brahmaputra (Yarlung Tsangpo)", 95.0, 29.6, "CHN IND BGD", "In 2025 China began building what could be the world's biggest hydropower scheme on the Yarlung Tsangpo in Tibet, just before the river flows into India. India and Bangladesh worry about the flow of water and sediment, and about floods.", 0],
    ["Jordan River and the Dead Sea", 35.55, 32.3, "ISR JOR SYR PSE", "One of the most contested rivers, in one of the driest regions. So much water is taken from the Jordan that the Dead Sea is falling by about a metre a year. Access to water is part of the Israeli–Palestinian conflict.", 0],
    ["Ganges and the Farakka Barrage", 87.93, 24.8, "IND BGD", "India's Farakka Barrage diverts Ganges water towards Kolkata, reducing the flow into Bangladesh in the dry season. A 30-year treaty sharing the water, signed in 1996, runs out in 2026.", 0],
    ["Zambezi and Lake Kariba", 28.76, -16.52, "ZMB ZWE", "Zambia and Zimbabwe share the Kariba Dam, which provides much of both countries' electricity. In the 2024 drought the lake fell so low that both had power cuts of up to 20 hours a day.", 1],
    ["Danube", 19.0, 45.0, "DEU AUT SVK HUN HRV SRB ROU BGR MDA UKR", "The river flowing through the most countries (10). They share it through a commission (the ICPDR) that works on pollution, flooding and shipping together: an example of cooperation.", 1],
    ["Senegal River", -14.8, 16.2, "SEN MRT MLI GIN", "Mali, Mauritania, Senegal and Guinea jointly own the dams on the Senegal River and share the water and electricity through one organisation (the OMVS), seen as a model for shared rivers.", 1],
  ];

  function loadBR() { return (brLoad ||= (window.__BRI__ ? Promise.resolve(window.__BRI__) : fetch("bri.json?v=68").then((r) => r.json())).then((j) => (BR = j)).catch(() => null)); }
  const briShown = () => BR.projects.filter((p) => (P.bri.sect < 0 || p[3] === P.bri.sect) && p[5] >= P.bri.from && (!P.bri.iso || p[2] === P.bri.iso));

  // live fires: NASA FIRMS (MODIS, last 24 hours), counted in 1° squares; NASA EONET wildfire events if FIRMS can't be reached
  function loadFires() {
    return (fiLoad ||= fetch("https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv").then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); }).then((t) => {
      const lines = t.trim().split("\n"), h = lines[0].split(","), la = h.indexOf("latitude"), lo = h.indexOf("longitude"), cells = new Map();
      for (let i = 1; i < lines.length; i++) {
        const c = lines[i].split(","), lat = +c[la], lon = +c[lo];
        if (!isFinite(lat) || !isFinite(lon)) continue;
        const k = `${Math.floor(lon)},${Math.floor(lat)}`;
        cells.set(k, (cells.get(k) || 0) + 1);
      }
      FI = { kind: "firms", n: lines.length - 1, cells: [...cells].map(([k, n]) => { const [x, y] = k.split(",").map(Number); return [x + 0.5, y + 0.5, n]; }), at: Date.now() };
    }).catch(() => fetch("https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&status=open&days=30").then((r) => r.json()).then((j) => {
      FI = { kind: "eonet", n: j.events.length, events: j.events.map((e) => { const g = e.geometry[e.geometry.length - 1]; return [g.coordinates[0], g.coordinates[1], e.title, g.date]; }).filter((e) => typeof e[0] === "number"), at: Date.now() };
    })).catch(() => { FI = null; fiLoad = null; throw new Error("no fires"); }));
  }

  // ---------- Drawing ----------
  let brFor = "", fiFor = "";
  function draw() {
    if (!W) return;
    const map = W.state.view === "map", k = W.k || 1;
    {
      const g = W.layer("bri");
      const show = P.bri.on && BR && map;
      g.style("display", show ? null : "none");
      if (show) {
        const sig = `${W.state.mode}|${$("#map")?.getAttribute("viewBox")}|${P.bri.sect}|${P.bri.from}|${P.bri.iso}|${P.bri.pick}`;
        if (brFor !== sig) {
          brFor = sig;
          const pts = briShown().map((p) => ({ p, xy: W.project(p[0], p[1]) })).filter((d) => d.xy).sort((a, b) => b.p[4] - a.p[4]);
          g.selectAll("circle.br").data(pts, (d) => d.p[9]).join("circle").attr("class", "br")
            .attr("r", (d) => Math.max(1.8, Math.min(16, Math.sqrt(d.p[4] || 0.5) * 0.55)))
            .attr("transform", (d) => `translate(${d.xy[0]},${d.xy[1]}) scale(${1 / k})`).style("fill", (d) => SCOL[d.p[3]])
            .classed("on", (d) => P.bri.pick === d.p[9])
            .attr("data-base", (d) => `🇨🇳 ${d.p[8] ? d.p[8].slice(0, 110) + (d.p[8].length > 110 ? "…" : "") : `${BR.sectors[d.p[3]]} project`} · ${usd(d.p[4])}, ${d.p[5]} · ${W.byIso.get(d.p[2])?.name || d.p[2]}`)
            .on("click", (ev, d) => { ev.stopPropagation(); P.bri.pick = d.p[9]; card("bri"); });
          g.selectAll("circle.br.on").raise();
        }
        g.raise();
      }
    }
    {
      const g = W.layer("water");
      const show = P.water.on && map;
      g.style("display", show ? null : "none");
      if (show) {
        const pts = RIV.map((r, i) => ({ r, i, xy: W.project(r[1], r[2]) })).filter((p) => p.xy);
        g.selectAll("g.rv").data(pts, (p) => p.i).join((en) => { const gg = en.append("g").attr("class", "rv"); gg.append("path").attr("d", "M0,-11 C5,-4 8,0 8,4 A8,8 0 0 1 -8,4 C-8,0 -5,-4 0,-11Z"); return gg; })
          .attr("transform", (p) => `translate(${p.xy[0]},${p.xy[1]}) scale(${1 / k})`).classed("coop", (p) => p.r[5] === 1).classed("on", (p) => P.water.pick === p.i)
          .on("click", (ev, p) => { ev.stopPropagation(); P.water.pick = p.i; card("water"); });
        g.selectAll("g.rv path").attr("data-base", function () { const p = d3.select(this.parentNode).datum(); return `💧 ${p.r[0]} · ${p.r[5] ? "shared peacefully" : "disputed"} (click for more)`; });
        g.raise();
      }
    }
    {
      const g = W.layer("colonial");
      const show = P.col.on && COL && map;
      g.style("display", show ? null : "none");
      if (show) {
        const y = P.col.year, feats = W.geo.filter((f) => f.rec && rulerIn(f.rec.iso3, y));
        g.selectAll("path").data(feats, (f) => f.rec.iso3).join((en) => en.append("path").attr("d", W.geoPath()).attr("vector-effect", "non-scaling-stroke"))
          .attr("d", W.geoPath()).style("fill", (f) => CCOL[rulerIn(f.rec.iso3, y)[0]]).classed("on", (f) => P.col.pick === f.rec.iso3)
          .attr("data-base", (f) => { const r = rulerIn(f.rec.iso3, y); return `${f.rec.name}: ruled by ${COL.who[r[0]]} in ${y} (${r[1]}–${r[2]})`; })
          .on("click", (ev, f) => { ev.stopPropagation(); P.col.pick = f.rec.iso3; card("col"); });
      }
    }
    {
      const g = W.layer("seaice");
      const show = P.ice.on && ICE && map;
      g.style("display", show ? null : "none");
      if (show) {
        const path = W.geoPath(), A = ICE.geo[P.ice.year], B = P.ice.cmp && P.ice.cmp !== P.ice.year ? ICE.geo[P.ice.cmp] : null;
        g.selectAll("path.ice-b").data(B ? [B] : []).join("path").attr("class", "ice-b").attr("d", path).attr("vector-effect", "non-scaling-stroke").attr("data-base", `Sea ice in September ${P.ice.cmp}`);
        g.selectAll("path.ice-a").data(A ? [A] : []).join("path").attr("class", "ice-a").attr("d", path).attr("vector-effect", "non-scaling-stroke").attr("data-base", `Sea ice in September ${P.ice.year}: ${ICE.extent[P.ice.year]} million km²`);
        g.selectAll("path.ice-b").raise();
      }
    }
    {
      const g = W.layer("fires");
      const show = P.fires.on && FI && map;
      g.style("display", show ? null : "none");
      if (show) {
        const sig = `${W.state.mode}|${$("#map")?.getAttribute("viewBox")}|${FI.at}`;
        if (fiFor !== sig) {
          fiFor = sig;
          const pts = (FI.kind === "firms" ? FI.cells : FI.events).map((c) => ({ c, xy: W.project(c[0], c[1]) })).filter((d) => d.xy);
          g.selectAll("circle.fi").data(pts).join("circle").attr("class", "fi")
            .attr("r", (d) => (FI.kind === "firms" ? Math.min(7, 1.4 + Math.sqrt(d.c[2]) * 0.7) : 4))
            .attr("transform", (d) => `translate(${d.xy[0]},${d.xy[1]}) scale(${1 / k})`)
            .attr("data-base", (d) => (FI.kind === "firms" ? `🔥 ${d.c[2]} fire${d.c[2] > 1 ? "s" : ""} detected here in the last 24 hours` : `🔥 ${d.c[2]}`));
        }
        g.raise();
      }
    }
  }
  function zoomed() {
    if (!W) return;
    const k = W.k || 1;
    W.layer("bri").selectAll("circle.br").attr("transform", (d) => (d?.xy ? `translate(${d.xy[0]},${d.xy[1]}) scale(${1 / k})` : null));
    W.layer("water").selectAll("g.rv").attr("transform", (p) => (p?.xy ? `translate(${p.xy[0]},${p.xy[1]}) scale(${1 / k})` : null));
    W.layer("fires").selectAll("circle.fi").attr("transform", (d) => (d?.xy ? `translate(${d.xy[0]},${d.xy[1]}) scale(${1 / k})` : null));
  }
  function zoomTo(at, k) {
    const card = $("#mapcards"), stage = $("#mapstage");
    const shift = card && stage ? Math.min(card.getBoundingClientRect().width / 2, stage.clientWidth / 4) : 0;
    W.zoomToPoint(at[0], at[1], k);
    if (shift) setTimeout(() => W.panBy?.(shift, 0), 650);
  }
  const nav = (i, n, a, b) => `<div class="aff-nav"><button type="button" class="ghost" data-step="-1" ${i <= 0 ? "disabled" : ""}>◀ ${a}</button><span>${i + 1} of ${n}</span><button type="button" class="ghost" data-step="1" ${i >= n - 1 ? "disabled" : ""}>${b} ▶</button></div>`;
  const chips = (opts, cur, attr) => `<div class="cs-topics">${opts.map(([v, l, c]) => `<button type="button" class="cs-t ${String(cur) === String(v) ? "on" : ""}" data-${attr}="${v}" ${c ? `style="--cs:${c}"` : ""}>${l}</button>`).join("")}</div>`;
  const measureQS = (key) => { const f = W.F[key]; return f ? `f=${key}:${f.dmin}~${f.dmax}&c=${key}` : ""; };
  const cname = (c) => W.byIso.get(c)?.name || c, cflag = (c) => W.byIso.get(c)?.flag || "";

  // ---------- Cards ----------
  const IDS = { bri: ["briCard", "briBtn"], water: ["waterCard", "waterBtn"], fires: ["firesCard", "firesBtn"], ice: ["iceCard", "iceBtn"], col: ["colCard", "colBtn"] };
  function order(which) {
    if (which === "bri") return briShown().filter((p) => p[8]).sort((a, b) => b[4] - a[4]).map((p) => p[9]);
    return RIV.map((r, i) => [r, i]).sort((a, b) => a[0][1] - b[0][1]).map(([, i]) => i);
  }
  const byId = (id) => BR.projects.find((p) => p[9] === id);
  function go(which, i) {
    const S = P[which]; S.pick = i;
    if (which === "bri") { const p = byId(i); if (p) zoomTo([p[0], p[1]], 4.5); }
    else zoomTo([RIV[i][1], RIV[i][2]], 3.6);
    card(which);
  }
  function card(which) {
    const S = P[which], [id, btn] = IDS[which];
    let el = $("#" + id);
    if (!el) { el = document.createElement("div"); el.id = id; el.className = "card livecard affcard"; $("#mapstage").appendChild(el); }
    el.hidden = !S.on || W.state.view !== "map" || (which === "bri" && !BR) || (which === "ice" && !ICE) || (which === "col" && !COL);
    $("#" + btn)?.setAttribute("aria-pressed", String(S.on));
    if (el.hidden) { draw(); return; }
    let head, body, src;
    const back = (t) => `<button type="button" class="linkbtn" data-back>${t}</button>`;
    if (which === "bri") {
      head = "🇨🇳 China's overseas lending";
      const p = S.pick != null ? byId(S.pick) : null, ord = order("bri");
      const key = `<p class="cyc-key">${BR.sectors.map((s, i) => `<span><i style="background:${SCOL[i]};height:8px;width:8px;border-radius:50%"></i>${s}</span>`).join("")}</p>`;
      if (p) {
        const i = ord.indexOf(p[9]);
        body = `${i >= 0 ? nav(i, ord.length, "Bigger", "Smaller") : ""}<div class="aff-one"><h4>${esc(p[8] || `${BR.sectors[p[3]]} project`)}</h4>
          <p class="aff-who"><span class="cs-tag" style="--cs:${SCOL[p[3]]}">${esc(BR.sectors[p[3]])}</span> ${cflag(p[2])} ${esc(cname(p[2]))}, ${esc(BR.places[p[7]])}</p>
          <ul class="cs-facts"><li><b>${usd(p[4])}</b> <small>(in 2021 dollars)</small></li><li>Agreed in ${p[5]} · ${["Finished", "Being built", "Agreed, not yet started"][p[6]]}</li></ul>
          <p class="aff-links"><a href="https://china.aiddata.org/projects/${p[9]}" target="_blank" rel="noopener">AidData project page ↗</a> · ${back("All projects")}</p></div>`;
      } else {
        const list = briShown(), tot = d3.sum(list, (x) => x[4]);
        const top = d3.rollups(list, (v) => d3.sum(v, (x) => x[4]), (x) => x[2]).sort((a, b) => b[1] - a[1]).slice(0, 8);
        const big = ord.slice(0, 8).map(byId);
        body = `<p class="hint">Between 2000 and 2021 China lent and gave more money for development abroad than any other country: roads, railways, ports, power stations, mines, hospitals and schools, much of it under the Belt and Road Initiative (from 2013). Each dot is a project (bigger = more money), at the centre of the region it is in. Supporters say it builds what poorer countries need; critics point to debt, and to influence for China.</p>
          ${chips([[-1, "All"]].concat(BR.sectors.map((s, i) => [i, s, SCOL[i]])), S.sect, "sect")}
          ${chips([[2000, "Since 2000"], [2013, "Since 2013 (Belt and Road)"], [2018, "Since 2018"]], S.from, "from")}
          ${S.iso ? `<p class="hint">Only ${cflag(S.iso)} ${esc(cname(S.iso))} · <button type="button" class="linkbtn" data-iso="">show every country</button></p>` : ""}
          <p class="cyc-n"><b>${d3.format(",")(list.length)}</b> projects shown, worth about <b>${usd(tot)}</b>.</p>
          <p class="cur-cs">Countries receiving the most</p><ol class="fl-top">${top.map(([c, v]) => `<li><button type="button" class="linkbtn" data-iso="${c}">${cflag(c)} ${esc(cname(c))}</button> <small>${usd(v)}</small></li>`).join("")}</ol>
          <p class="cur-cs">The biggest projects shown</p><ul class="aff-list">${big.map((x) => `<li><span class="cf-dot" style="--cf:${SCOL[x[3]]}"></span><button type="button" class="linkbtn" data-c="${x[9]}">${esc(x[8].slice(0, 90))}${x[8].length > 90 ? "…" : ""}</button> <small>${usd(x[4])}</small></li>`).join("")}</ul>`;
      }
      src = "AidData's Geospatial Global Chinese Development Finance Dataset, v3.0 (Goodman and others, 2024), ODC-By; locations from OpenStreetMap, ODbL. About 9,300 of the dataset's 20,000 projects have a known location; amounts are in 2021 US dollars.";
    } else if (which === "ice") {
      head = "🧊 Arctic sea ice";
      const yrs = Object.keys(ICE.shapes).map(Number).sort((a, b) => a - b), ex = ICE.extent;
      const all = Object.keys(ex).map(Number).sort((a, b) => a - b), first = all[0], last = all[all.length - 1];
      const lo = all.reduce((m, y) => (ex[y] < ex[m] ? y : m), first);
      const a = ex[S.year], b = ex[S.cmp], lost = b && a ? b - a : 0;
      const w = 300, h = 90, x = d3.scaleLinear([first, last], [24, w - 6]), yS = d3.scaleLinear([0, 8], [h - 14, 4]);
      const line = d3.line().x((y) => x(y)).y((y) => yS(ex[y]))(all);
      const chart = `<svg class="ice-ch" viewBox="0 0 ${w} ${h}" role="img" aria-label="September sea ice extent, ${first} to ${last}">
        ${[0, 4, 8].map((v) => `<line x1="24" x2="${w - 6}" y1="${yS(v)}" y2="${yS(v)}" class="g"/><text x="20" y="${yS(v) + 3}" text-anchor="end">${v}</text>`).join("")}
        <path d="${line}" class="l"/>${[S.year, S.cmp].filter((y) => ex[y]).map((y, i) => `<circle cx="${x(y)}" cy="${yS(ex[y])}" r="4" class="${i ? "c2" : "c1"}"><title>${y}: ${ex[y]} million km²</title></circle>`).join("")}
        <text x="24" y="${h - 2}">${first}</text><text x="${w - 6}" y="${h - 2}" text-anchor="end">${last}</text></svg>`;
      body = `<p class="hint">Every September, at the end of the summer melt, the Arctic Ocean's ice is at its smallest. Since satellites began measuring in 1979 it has shrunk by about 40%, as the Arctic warms about four times faster than the world as a whole. Less ice means darker water, which absorbs more sunlight and warms further (a positive feedback).</p>
        ${polarSVG(S)}
        <p class="cur-cs">Show September</p>${chips(yrs.map((y) => [y, String(y)]), S.year, "iy")}
        <p class="cur-cs">Compare with (outline)</p>${chips([[0, "None"]].concat(yrs.map((y) => [y, String(y)])), S.cmp, "ic")}
        <p class="cyc-key"><span><i style="background:#e8f4fb;border:1px solid #6aaed6;height:10px"></i>${S.year}</span>${S.cmp && S.cmp !== S.year ? `<span><i class="dash" style="background:repeating-linear-gradient(90deg,#e08b00 0 4px,transparent 4px 7px)"></i>${S.cmp}</span>` : ""}</p>
        <ul class="cs-facts"><li>September ${S.year}: <b>${a} million km²</b></li>${b && S.cmp !== S.year ? `<li>September ${S.cmp}: ${b} million km² · ${lost > 0 ? `<b>${(lost * 1e6 / 243610).toFixed(0)} times the area of the UK less</b> in ${S.year}` : `${S.year} had more ice`}</li>` : ""}<li>Smallest on record: ${ex[lo]} million km² in ${lo}</li></ul>
        <p class="cur-cs">September sea ice, million km²</p>${chart}
        <p class="hint">The picture above looks down on the North Pole; the main map squashes the Arctic into a thin strip. Some scientists expect the first nearly ice-free September before 2050.</p>`;
      src = "NSIDC Sea Ice Index, Version 4 (Fetterer and others): September monthly extent (ocean at least 15% covered by ice) and outlines, simplified for this site.";
    } else if (which === "col") {
      head = "🏳️ Colonial history";
      const y = S.year, r = S.pick ? COL.rule[S.pick] : null;
      const now = W.geo.filter((f) => f.rec && rulerIn(f.rec.iso3, y)).map((f) => rulerIn(f.rec.iso3, y)[0]);
      const counts = d3.rollups(now, (v) => v.length, (c) => c).sort((a, b) => b[1] - a[1]);
      body = `<p class="hint">Which European power ruled the land of today's countries in any year from 1500 to 2000. Press play to watch empires spread across the Americas, then Asia and Africa (the “Scramble for Africa” after 1880), then break up as colonies won independence, mostly between 1945 and 1975.</p>
        <div class="col-yr"><button type="button" class="ghost col-play" aria-label="${colTimer ? "Pause" : "Play"}">${colTimer ? "⏸" : "▶"}</button><input type="range" min="1500" max="2000" step="1" value="${y}" aria-label="Year"><b>${y}</b></div>
        <p class="cyc-key">${Object.entries(CCOL).map(([k, c]) => `<span><i style="background:${c};height:10px;width:10px;border-radius:2px"></i>${COL.who[k].replace("the ", "")}${counts.find((x) => x[0] === k) ? ` <small>${counts.find((x) => x[0] === k)[1]}</small>` : ""}</span>`).join("")}</p>
        <p class="cyc-n"><b>${now.length}</b> of today's countries were European colonies in ${y}.</p>
        ${r ? `<div class="aff-one"><h4>${cflag(S.pick)} ${esc(cname(S.pick))}</h4><ul class="cs-facts">${r.map(([c, s0, e0]) => `<li><span class="cf-dot" style="--cf:${CCOL[c]}"></span> ${COL.who[c]}: ${s0}–${e0}</li>`).join("")}</ul><p class="aff-links">${back("Close")}</p></div>` : `<p class="hint">Click a coloured country for its colonial history.</p>`}
        <p class="aff-links"><button type="button" class="ghost cs-go" data-q="${measureQS("col_years")}">Colour by years of colonial rule</button> <button type="button" class="ghost cs-go" data-q="${measureQS("col_end")}">… by year it ended</button></p>
        <p class="hint">Only the eight European powers in COLDAT are shown, so rule by the Ottoman, Russian, Austro-Hungarian or Japanese empires, Denmark or the USA is not. Colonies are drawn with today's borders, which were often drawn by the colonisers themselves.</p>`;
      src = "COLDAT: Colonial Dates Dataset (Becker, 2019), average of its sources' dates, CC0 1.0.";
    } else if (which === "water") {
      head = "💧 Water: shared rivers";
      const r = S.pick != null ? RIV[S.pick] : null, ord = order("water");
      if (r) {
        body = `${nav(ord.indexOf(S.pick), ord.length, "West", "East")}<div class="aff-one"><h4>${esc(r[0])}</h4>
          <p class="aff-who"><span class="cs-tag" style="--cs:${r[5] ? "#2e9d55" : "#d23b3b"}">${r[5] ? "Shared peacefully" : "Disputed"}</span> ${r[3].split(" ").map((c) => `${cflag(c)} ${esc(cname(c))}`).join(", ")}</p>
          <p>${esc(r[4])}</p><p class="aff-links"><a href="${wiki(r[0].split(":")[0])}" target="_blank" rel="noopener">Read more ↗</a> · ${back("All rivers")}</p></div>`;
      } else {
        body = `<p class="hint">About 300 rivers and lakes cross borders, and 40% of people live in their basins. Upstream countries can build dams and take water; downstream countries depend on what is left. Red drops: disputes. Green: examples of sharing that works.</p>
          <ul class="aff-list">${ord.map((i) => `<li><span class="cf-dot" style="--cf:${RIV[i][5] ? "#2e9d55" : "#d23b3b"}"></span><button type="button" class="linkbtn" data-c="${i}">${esc(RIV[i][0])}</button></li>`).join("")}</ul>
          <p class="aff-links"><button type="button" class="ghost cs-go" data-q="${measureQS("water_stress")}">Colour countries by water stress</button> <button type="button" class="ghost cs-go" data-q="${measureQS("water_pc")}">… by water per person</button></p>`;
      }
      src = "Written for this site, checked November 2026. Water stress: UN FAO (AQUASTAT), via the World Bank.";
    } else {
      head = "🔥 Fires now";
      const status = S.state === "loading" ? `<p class="hint">Loading the latest fires from NASA…</p>` : S.state === "error" ? `<p class="hint warn">The live fire data couldn't be loaded from NASA just now (it needs an internet connection). Try again later, or open <a href="https://firms.modaps.eosdis.nasa.gov/map/" target="_blank" rel="noopener">NASA's fire map ↗</a>.</p>` : "";
      let detail = "";
      if (FI?.kind === "firms") {
        // the busiest squares, put together by country
        const byC = new Map();
        FI.cells.slice().sort((a, b) => b[2] - a[2]).slice(0, 60).forEach((c) => {
          const f = W.geo.find((g) => d3.geoContains(g, [c[0], c[1]])), key = f?.rec?.iso3 || `${c[0]},${c[1]}`;
          const o = byC.get(key) || byC.set(key, [[c[0], c[1], 0], f?.rec]).get(key); o[0][2] += c[2];
        });
        const top = [...byC.values()].sort((a, b) => b[0][2] - a[0][2]).slice(0, 6);
        detail = `<p class="cyc-n"><b>${d3.format(",")(FI.n)}</b> fires detected by satellite in the last 24 hours.</p>
          <p class="cur-cs">Where there are most</p><ul class="aff-list">${top.map(([c, r], i) => `<li><button type="button" class="linkbtn" data-c="${i}">${r ? `${r.flag || ""} ${esc(r.name)}` : `${Math.abs(c[1]).toFixed(0)}°${c[1] >= 0 ? "N" : "S"} ${Math.abs(c[0]).toFixed(0)}°${c[0] >= 0 ? "E" : "W"}`}</button> <small>${c[2]} fires</small></li>`).join("")}</ul>`;
        S._top = top.map(([c]) => c);
      } else if (FI?.kind === "eonet") {
        detail = `<p class="cyc-n"><b>${FI.n}</b> large wildfires being tracked by NASA.</p><ul class="aff-list">${FI.events.slice(0, 8).map((e, i) => `<li><button type="button" class="linkbtn" data-c="${i}">${esc(e[2])}</button></li>`).join("")}</ul>`;
        S._top = FI.events.slice(0, 8);
      }
      body = `${status}<p class="hint">Satellites spot the heat of fires several times a day. Most are lit on purpose: farmers clearing fields or burning savanna grass, especially in Africa, which has about 70% of the world's burned area. Others are wildfires, which a hotter, drier climate makes more common in places like Canada, Siberia, Australia and the Mediterranean. Look again in a few months: the fires move with the dry seasons.</p>${detail}
        <p class="aff-links"><button type="button" class="ghost cs-go" data-q="${measureQS("tree_loss_pct")}">Colour countries by tree cover lost</button></p>`;
      src = FI?.kind === "eonet" ? "NASA Earth Observatory Natural Event Tracker (EONET), live." : `NASA FIRMS, MODIS active fires, last 24 hours, live${FI?.at ? `, loaded ${new Date(FI.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}. Each dot is a 1° square; bigger = more fires.`;
    }
    el.innerHTML = `<div class="dsc-head"><h3>${head}</h3><button type="button" class="iconbtn" data-x aria-label="Close">×</button></div>${body}<p class="hint aff-src">${src}</p>`;
    el.querySelector("[data-x]").onclick = () => toggle(which, false);
    el.querySelectorAll("[data-back]").forEach((b) => (b.onclick = () => { S.pick = null; card(which); }));
    el.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => {
      if (which === "fires") { const c = S._top[+b.dataset.c]; if (c) zoomTo([c[0], c[1]], 4); return; }
      go(which, +b.dataset.c);
    }));
    el.querySelectorAll("[data-sect]").forEach((b) => (b.onclick = () => { S.sect = +b.dataset.sect; S.pick = null; card(which); }));
    el.querySelectorAll("[data-from]").forEach((b) => (b.onclick = () => { S.from = +b.dataset.from; S.pick = null; card(which); }));
    el.querySelectorAll("[data-iso]").forEach((b) => (b.onclick = () => { S.iso = b.dataset.iso; S.pick = null; if (S.iso) W.zoomToCountry?.(S.iso); card(which); }));
    el.querySelectorAll(".cs-go").forEach((b) => (b.onclick = () => W.applyQS(b.dataset.q)));
    el.querySelectorAll("[data-iy]").forEach((b) => (b.onclick = () => { S.year = +b.dataset.iy; card(which); }));
    el.querySelectorAll("[data-ic]").forEach((b) => (b.onclick = () => { S.cmp = +b.dataset.ic; card(which); }));
    const yr = el.querySelector(".col-yr input");
    if (yr) {
      yr.oninput = () => { stopCol(); S.year = +yr.value; el.querySelector(".col-yr b").textContent = S.year; draw(); };
      yr.onchange = () => card(which);
      el.querySelector(".col-play").onclick = () => { if (colTimer) { stopCol(); card(which); } else playCol(); };
    }
    el.querySelectorAll("[data-step]").forEach((b) => (b.onclick = () => { const o = order(which), j = o.indexOf(S.pick) + +b.dataset.step; if (o[j] != null) go(which, o[j]); }));
    draw();
  }
  function stopCol() { if (colTimer) { clearInterval(colTimer); colTimer = null; } }
  function playCol() {
    if (P.col.year >= 2000) P.col.year = 1500;
    colTimer = setInterval(() => {
      P.col.year = Math.min(2000, P.col.year + 5);
      if (P.col.year >= 2000) stopCol();
      card("col");
    }, 260);
    card("col");
  }
  async function toggle(which, on) {
    const S = P[which];
    S.on = on ?? !S.on;
    if (S.on && which === "bri") { await loadBR(); if (!BR) S.on = false; }
    if (S.on && which === "ice") { await loadIce(); if (!ICE) S.on = false; }
    if (S.on && which === "col") { await loadCol(); if (!COL) S.on = false; }
    if (!S.on && which === "col") stopCol();
    if (S.on && which === "fires" && !FI) {
      S.state = "loading"; card(which);
      try { await loadFires(); S.state = ""; } catch (e) { S.state = "error"; }
    }
    card(which);
  }
  function init() {
    W = window.WC;
    let box = $("#mapbtns");
    if (!box) { box = document.createElement("div"); box.id = "mapbtns"; box.className = "mapbtns"; $("#mapstage").appendChild(box); }
    [["bri", "briBtn", "🇨🇳 China's overseas lending"], ["water", "waterBtn", "💧 Water: shared rivers"], ["fires", "firesBtn", "🔥 Fires now"], ["ice", "iceBtn", "🧊 Arctic sea ice"], ["col", "colBtn", "🏳️ Colonial history"]].forEach(([k, id, t]) => {
      const b = document.createElement("button");
      b.type = "button"; b.id = id; b.className = "mmbtn"; b.setAttribute("aria-pressed", "false"); b.textContent = t;
      b.onclick = () => toggle(k);
      box.appendChild(b);
    });
  }
  window.WGB = { init, draw: () => draw(), zoomed, refresh: () => { Object.keys(P).forEach((k) => { if (P[k].on) card(k); }); }, toggle, _P: P };
})();
