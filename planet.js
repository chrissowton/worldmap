/* The planet on the map (v65):
   - Tropical cyclone tracks: every hurricane, typhoon and cyclone that reached category 3 or more since 1980 (IBTrACS, cyclones.json)
   - Protected areas: the biggest and best-known national parks and marine reserves, with the "30 by 30" target */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let W, CY = null, loading = null;
  const P = { cyc: { on: false, pick: null, era: "2020", min: 3, basin: "" }, prot: { on: false, pick: null, kind: "" } };
  // Saffir–Simpson colours: tropical storm, then categories 1–5
  const CAT = { "-1": "#9aa7ad", 0: "#5fb8e8", 1: "#f2d94e", 2: "#f5ad3b", 3: "#ef7d22", 4: "#d93a3a", 5: "#9b3fc4" };
  const BASIN = { NA: ["North Atlantic", "Hurricane"], EP: ["Eastern Pacific", "Hurricane"], WP: ["Western Pacific", "Typhoon"], NI: ["North Indian Ocean", "Cyclone"], SI: ["South Indian Ocean", "Cyclone"], SP: ["South Pacific", "Cyclone"], SA: ["South Atlantic", "Cyclone"] };
  const ERAS = [["2020", "2020s"], ["2010", "2010s"], ["2000", "2000s"], ["1990", "1990s"], ["1980", "1980s"], ["", "All since 1980"]];
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const catOf = (kt) => (kt >= 137 ? 5 : kt >= 113 ? 4 : kt >= 96 ? 3 : kt >= 83 ? 2 : kt >= 64 ? 1 : 0);
  const kmh = (kt) => Math.round(kt * 1.852 / 5) * 5, mph = (kt) => Math.round(kt * 1.15078 / 5) * 5;
  const dateText = (d) => { const [y, m, day] = d.split("-"); return `${+day} ${MONTHS[+m - 1]} ${y}`; };
  const wiki = (q) => `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(q)}`;

  // the biggest and best-known protected areas: [name, where (ISO3 codes), lon, lat, area in km², year, "land"/"sea", text]
  const PA = [
    ["Northeast Greenland National Park", "GRL", -30, 76, 972000, "1974", "land", "The world's largest national park, bigger than all but about 30 countries. Most of it is ice sheet; musk oxen, polar bears and walruses live on the ice-free coast. Almost no one lives there."],
    ["Kavango–Zambezi (KAZA)", "AGO BWA NAM ZMB ZWE", 23.5, -17.8, 520000, "2011", "land", "A conservation area across five countries, with about half of Africa's savanna elephants, the Okavango Delta and Victoria Falls. Animals can move freely across the borders, and local communities share the income from tourism."],
    ["Yellowstone National Park", "USA", -110.5, 44.6, 8983, "1872", "land", "The world's first national park. It sits over a volcanic hotspot, which powers its geysers such as Old Faithful. Bringing wolves back in 1995 changed the whole ecosystem: fewer elk, more trees by rivers, more beavers (a trophic cascade)."],
    ["Serengeti National Park", "TZA", 34.83, -2.33, 14763, "1951", "land", "Savanna famous for the great migration: about 1.5 million wildebeest move in a loop between Tanzania and Kenya's Maasai Mara each year, following the rain. Tourism brings in money, but Maasai herders have lost land to parks and reserves."],
    ["Kruger National Park", "ZAF", 31.5, -24.0, 19485, "1926", "land", "One of Africa's largest game reserves, home to the “Big Five”. Rhino poaching for horn is a serious problem, fought with rangers, dogs and drones. Part of a transfrontier park with Mozambique and Zimbabwe."],
    ["Tumucumaque Mountains National Park", "BRA", -53.0, 1.8, 38874, "2002", "land", "The largest national park in a tropical rainforest, in the Amazon in Amapá, Brazil. Across the Amazon, deforestation is lowest inside protected areas and Indigenous lands."],
    ["Salonga National Park", "COD", 21.0, -2.0, 33350, "1970", "land", "Africa's largest tropical rainforest reserve, in the Congo Basin, and home to bonobos. It was on UNESCO's list of World Heritage in Danger until 2021 because of poaching."],
    ["Wood Buffalo National Park", "CAN", -113.0, 59.4, 44807, "1922", "land", "Canada's largest national park: boreal forest, wetlands and one of the world's biggest inland deltas. Home to the largest free-roaming herd of wood bison and the only nesting place of wild whooping cranes."],
    ["Sundarbans", "BGD IND", 89.2, 21.9, 10000, "1987", "land", "The world's largest mangrove forest, in the Ganges–Brahmaputra delta, with Bengal tigers. The mangroves shelter the coast from cyclone storm surges and store large amounts of carbon, but rising seas and shrimp farms threaten them."],
    ["Sagarmatha National Park", "NPL", 86.8, 27.95, 1148, "1976", "land", "Includes Mount Everest. Sherpa communities live inside the park; trekking and climbing bring jobs and money, but also crowds, litter and pressure on firewood."],
    ["Cairngorms National Park", "GBR", -3.67, 57.08, 4528, "2003", "land", "The UK's largest national park, in Scotland: mountains, Caledonian pine forest and about a quarter of the UK's threatened species. Like all UK national parks, people live and farm in it, unlike Yellowstone."],
    ["Lake District National Park", "GBR", -3.1, 54.5, 2362, "1951", "land", "A glaciated upland landscape and, since 2017, a World Heritage Site as a cultural landscape of hill farming. More than 15 million visitors a year: honeypot sites, traffic and second homes are the challenges."],
    ["Antarctica", "ATA", 0, -82, 14000000, "1959", "land", "Not a national park, but under the Antarctic Treaty (1959) the whole continent is set aside for peace and science, and since 1998 (the Madrid Protocol) all mining has been banned."],
    ["Great Barrier Reef Marine Park", "AUS", 147.7, -18.3, 344400, "1975", "sea", "The world's largest coral reef system, and about a third of it is “no-take” (no fishing). Warmer seas caused six mass coral bleaching events between 2016 and 2025; farm run-off and crown-of-thorns starfish add to the damage. Coral cover recovered a little in 2025–26."],
    ["Papahānaumokuākea", "USA", -171.7, 25.7, 1508870, "2006", "sea", "Around the remote north-west Hawaiian Islands; made much larger in 2016. A World Heritage Site for both its nature (coral reefs, monk seals, seabirds) and its importance to Native Hawaiian culture."],
    ["Ross Sea", "ATA", 175, -75, 1550000, "2016", "sea", "One of the largest marine protected areas, agreed in 2016 by 24 countries and the EU. It protects one of the least-damaged ocean ecosystems on Earth: penguins, seals, whales and Antarctic toothfish."],
    ["Marae Moana", "COK", -159.8, -20, 1900000, "2017", "sea", "Covers all of the Cook Islands' sea. Large areas around the islands are closed to big fishing boats; the Cook Islands is also exploring deep-sea mining for metal-rich nodules on the sea floor, a hard choice for a small island state."],
    ["Pitcairn Islands Marine Reserve", "PCN", -130.1, -25.1, 834000, "2016", "sea", "A fully protected (no-take) reserve around a UK overseas territory where about 40 people live. Illegal fishing is watched for by satellite."],
    ["South Georgia and the South Sandwich Islands", "SGS", -36.5, -54.5, 1240000, "2012", "sea", "A UK overseas territory in the Southern Ocean, with huge colonies of penguins, seals and albatrosses. Fishing is allowed only in some areas, under strict limits."],
    ["Chagos Marine Protected Area", "IOT MUS", 72.0, -6.5, 640000, "2010", "sea", "One of the largest no-take reserves. The Chagossians were removed from the islands in the 1960s and 70s to make way for the Diego Garcia military base; in 2025 the UK agreed to hand sovereignty to Mauritius."],
    ["Galápagos Marine Reserve", "ECU", -90.5, -0.6, 198000, "1998", "sea", "Where Darwin's ideas about evolution began. In 2022 it was enlarged to link up with Costa Rica's Cocos Island, protecting a “swimway” used by sharks, turtles and rays."],
    ["Natural Park of the Coral Sea", "NCL", 162, -20, 1300000, "2014", "sea", "Covers all of New Caledonia's sea (France). Its lagoons and reefs, among the largest in the world, are a World Heritage Site."],
    ["Phoenix Islands Protected Area", "KIR", -172, -3.7, 408250, "2008", "sea", "Once one of the largest no-take reserves, but Kiribati opened it to commercial fishing in 2021 to earn money from tuna licences: a dilemma between conservation and development."],
  ];

  function load() {
    return (loading ||= (window.__CYCLONES__ ? Promise.resolve(window.__CYCLONES__) : fetch("cyclones.json?v=66").then((r) => r.json()))
      .then((j) => { CY = j.storms.map(([name, season, basin, w, p, start, end, land, t], i) => {
        const pts = []; for (let k = 0; k < t.length; k += 3) pts.push([t[k], t[k + 1], t[k + 2]]);
        return { i, name, season, basin, w, p, start, end, land, pts, cat: catOf(w), yr: +start.slice(0, 4) };
      }); }).catch(() => { CY = null; }));
  }
  const kind = (s) => (BASIN[s.basin] || ["", "Cyclone"])[1];
  const title = (s) => (s.name ? `${kind(s)} ${s.name}` : `Unnamed ${kind(s).toLowerCase()}`) + `, ${s.season}`;
  // the storms shown: the chosen decade, strength and ocean
  function shown() {
    const S = P.cyc, e = S.era ? +S.era : 0;
    return CY.filter((s) => s.cat >= S.min && (!S.basin || s.basin === S.basin) && (!e || (s.yr >= e && s.yr < e + 10)));
  }
  const byDate = (arr) => arr.slice().sort((a, b) => a.start.localeCompare(b.start));

  // ---------- Drawing ----------
  let cycFor = "";
  function draw() {
    if (!W) return;
    const map = W.state.view === "map", k = W.k || 1;
    {
      const g = W.layer("cyclones");
      const show = P.cyc.on && CY && map;
      g.style("display", show ? null : "none");
      if (show) {
        const S = P.cyc, list = shown();
        const sig = `${W.state.mode}|${$("#map")?.getAttribute("viewBox")}|${S.era}|${S.min}|${S.basin}|${S.pick}`;
        if (cycFor !== sig) {
          cycFor = sig;
          const path = W.geoPath();
          const line = (s) => ({ type: "LineString", coordinates: s.pts.map((p) => [p[0], p[1]]) });
          g.selectAll("path.cyc").data(list, (s) => s.i).join("path").attr("class", "cyc")
            .attr("d", (s) => path(line(s))).attr("vector-effect", "non-scaling-stroke")
            .style("stroke", (s) => CAT[s.cat]).classed("dim", S.pick != null)
            .attr("data-base", (s) => `🌀 ${title(s)} · category ${s.cat} at its peak (${kmh(s.w)} km/h winds) · click for more`)
            .on("click", (ev, s) => { ev.stopPropagation(); S.pick = s.i; card("cyc"); });
          // the chosen storm: coloured by its strength along the track, with a dot every 12 hours
          const s = S.pick != null ? CY[S.pick] : null, segs = [];
          if (s) for (let j = 1; j < s.pts.length; j++) segs.push({ c: s.pts[j - 1][2], f: { type: "LineString", coordinates: [s.pts[j - 1].slice(0, 2), s.pts[j].slice(0, 2)] } });
          g.selectAll("path.cyc-seg").data(segs).join("path").attr("class", "cyc-seg").attr("d", (d) => path(d.f)).attr("vector-effect", "non-scaling-stroke").style("stroke", (d) => CAT[d.c]);
          const dots = s ? s.pts.map((p, j) => ({ p, j, xy: W.project(p[0], p[1]) })).filter((d) => d.xy) : [];
          g.selectAll("circle.cyc-dot").data(dots).join("circle").attr("class", "cyc-dot").attr("r", 3.2)
            .attr("transform", (d) => `translate(${d.xy[0]},${d.xy[1]}) scale(${1 / k})`).style("fill", (d) => CAT[d.p[2]])
            .attr("data-base", (d) => (d.p[2] >= 1 ? `Category ${d.p[2]} here` : d.p[2] === 0 ? "Tropical storm here" : "Weaker here"));
        }
        g.raise();
      }
    }
    {
      const g = W.layer("protected");
      const show = P.prot.on && map;
      g.style("display", show ? null : "none");
      if (show) {
        const pts = PA.map((a, i) => ({ a, i, xy: W.project(a[2], a[3]) })).filter((p) => p.xy && (!P.prot.kind || p.a[6] === P.prot.kind));
        g.selectAll("g.pa").data(pts, (p) => p.i).join((en) => { const gg = en.append("g").attr("class", "pa"); gg.append("circle").attr("r", 8); gg.append("text"); return gg; })
          .attr("transform", (p) => `translate(${p.xy[0]},${p.xy[1]}) scale(${1 / k})`).classed("sea", (p) => p.a[6] === "sea").classed("on", (p) => P.prot.pick === p.i)
          .on("click", (ev, p) => { ev.stopPropagation(); P.prot.pick = p.i; card("prot"); });
        g.selectAll("g.pa text").text(function () { return d3.select(this.parentNode).datum().a[6] === "sea" ? "≈" : "▲"; });
        g.selectAll("g.pa circle").attr("data-base", function () { const p = d3.select(this.parentNode).datum(); return `${p.a[6] === "sea" ? "🐠" : "🌲"} ${p.a[0]} · ${d3.format(",")(p.a[4])} km² · since ${p.a[5]} (click for more)`; });
        g.raise();
      }
    }
  }
  function zoomed() {
    if (!W) return;
    const k = W.k || 1;
    W.layer("cyclones").selectAll("circle.cyc-dot").attr("transform", (d) => (d?.xy ? `translate(${d.xy[0]},${d.xy[1]}) scale(${1 / k})` : null));
    W.layer("protected").selectAll("g.pa").attr("transform", (p) => (p?.xy ? `translate(${p.xy[0]},${p.xy[1]}) scale(${1 / k})` : null));
  }
  function zoomTo(at, k) {
    const card = $("#mapcards"), stage = $("#mapstage");
    const shift = card && stage ? Math.min(card.getBoundingClientRect().width / 2, stage.clientWidth / 4) : 0;
    W.zoomToPoint(at[0], at[1], k);
    if (shift) setTimeout(() => W.panBy?.(shift, 0), 650);
  }
  // the middle of a storm's track (allowing for tracks that cross the 180° line)
  function middle(s) {
    const lats = s.pts.map((p) => p[1]);
    let lons = s.pts.map((p) => p[0]);
    if (d3.max(lons) - d3.min(lons) > 180) lons = lons.map((x) => (x < 0 ? x + 360 : x));
    let lon = (d3.min(lons) + d3.max(lons)) / 2; if (lon > 180) lon -= 360;
    const span = Math.max(d3.max(lons) - d3.min(lons), (d3.max(lats) - d3.min(lats)) * 1.6);
    return { at: [lon, (d3.min(lats) + d3.max(lats)) / 2], k: span > 60 ? 2 : span > 30 ? 2.8 : 3.6 };
  }
  const nav = (i, n, a, b) => `<div class="aff-nav"><button type="button" class="ghost" data-step="-1" ${i <= 0 ? "disabled" : ""}>◀ ${a}</button><span>${i + 1} of ${n}</span><button type="button" class="ghost" data-step="1" ${i >= n - 1 ? "disabled" : ""}>${b} ▶</button></div>`;
  const key = () => `<p class="cyc-key">${[["Tropical storm", 0], ["1", 1], ["2", 2], ["3", 3], ["4", 4], ["5", 5]].map(([l, c]) => `<span><i style="background:${CAT[c]}"></i>${l}</span>`).join("")} <small>Saffir–Simpson category</small></p>`;

  // ---------- Cards ----------
  function card(which) {
    const S = P[which], id = which === "cyc" ? "cycCard" : "protCard";
    let el = $("#" + id);
    if (!el) { el = document.createElement("div"); el.id = id; el.className = "card livecard affcard"; $("#mapstage").appendChild(el); }
    el.hidden = !S.on || W.state.view !== "map" || (which === "cyc" && !CY);
    $(which === "cyc" ? "#cycBtn" : "#protBtn")?.setAttribute("aria-pressed", String(S.on));
    if (el.hidden) { draw(); return; }
    let head, body, src;
    if (which === "cyc") {
      head = "🌀 Tropical cyclones";
      const list = byDate(shown()), s = S.pick != null ? CY[S.pick] : null;
      if (s) {
        const [bn] = BASIN[s.basin] || ["", ""], idx = list.findIndex((x) => x.i === s.i);
        const peakPts = s.pts.filter((p) => p[2] === s.cat).length * 6;
        body = `${idx >= 0 ? nav(idx, list.length, "Earlier", "Later") : ""}<div class="aff-one"><h4>${esc(title(s))}</h4>
          <p class="aff-who"><span class="cs-tag" style="--cs:${CAT[s.cat]}">Category ${s.cat} at its peak</span> ${esc(bn)}</p>
          <ul class="cs-facts"><li>${dateText(s.start)} to ${dateText(s.end)}</li>
            <li>Strongest winds: about <b>${kmh(s.w)} km/h</b> (${mph(s.w)} mph), averaged over a minute</li>
            ${s.p ? `<li>Lowest air pressure: ${s.p} hPa <small>(normal is about 1013)</small></li>` : ""}
            ${s.land ? "<li>It crossed land (made landfall)</li>" : "<li>It stayed out at sea for most of its life</li>"}</ul>
          <p class="hint">Dots show where it was every 12 hours, coloured by its strength then. ${peakPts >= 6 ? `It was category ${s.cat} for about ${peakPts >= 24 ? Math.round(peakPts / 24 * 2) / 2 + (peakPts >= 48 ? " days" : " day") : peakPts + " hours"}.` : ""}</p>
          ${key()}
          <p class="aff-links"><a href="${wiki(s.name ? `${kind(s)} ${s.name} ${s.season}` : `${s.season} ${bn} cyclone season`)}" target="_blank" rel="noopener">Read more ↗</a> · <button type="button" class="linkbtn" data-back>All storms</button></p></div>`;
      } else {
        const strongest = list.slice().sort((a, b) => b.w - a.w || a.p - b.p).slice(0, 8);
        const counts = d3.rollups(CY.filter((x) => x.cat >= 4 && (!S.basin || x.basin === S.basin)), (v) => v.length, (x) => Math.floor(x.yr / 5) * 5).sort((a, b) => a[0] - b[0]);
        const max = d3.max(counts, (c) => c[1]) || 1;
        body = `<p class="hint">Paths of every hurricane, typhoon and cyclone (the same kind of storm in different oceans) that reached category 3 or more. They form over seas of 27 °C or more, then curve away from the equator. Click a path for its story.</p>
          <div class="cs-topics">${ERAS.map(([v, l]) => `<button type="button" class="cs-t ${S.era === v ? "on" : ""}" data-era="${v}">${l}</button>`).join("")}</div>
          <div class="cs-topics">${[[3, "Category 3+"], [4, "4+"], [5, "5 only"]].map(([v, l]) => `<button type="button" class="cs-t ${S.min === v ? "on" : ""}" data-min="${v}" style="--cs:${CAT[v]}">${l}</button>`).join("")}
            <select class="cyc-basin" aria-label="Ocean"><option value="">All oceans</option>${Object.entries(BASIN).filter(([b]) => b !== "SA").map(([b, [n, w]]) => `<option value="${b}" ${S.basin === b ? "selected" : ""}>${n} (${w.toLowerCase()}s)</option>`).join("")}</select></div>
          ${key()}
          <p class="cyc-n"><b>${list.length}</b> storms shown.</p>
          <p class="cur-cs">The strongest shown</p>
          <ul class="aff-list">${strongest.map((x) => `<li><span class="cf-dot" style="--cf:${CAT[x.cat]}"></span><button type="button" class="linkbtn" data-c="${x.i}">${esc(title(x))}</button> <small>${kmh(x.w)} km/h</small></li>`).join("")}</ul>
          <p class="cur-cs">Category 4 and 5 storms in each five years${S.basin ? ` (${esc(BASIN[S.basin][0])})` : ""}</p>
          <div class="cyc-bars">${counts.map(([y, n]) => `<span title="${y}–${y + 4}: ${n}"><i style="height:${Math.round(n / max * 100)}%"></i><small>${String(y).slice(2)}</small></span>`).join("")}</div>
          <p class="hint">Scientists expect a warmer world to have a bigger share of the strongest storms, with more rain, though not necessarily more storms overall. Counts from the early 1980s may be a little low: satellites missed some.</p>`;
      }
      src = "Tracks: IBTrACS v04r01, NOAA National Centers for Environmental Information (Knapp and others, 2010). Winds are the US agencies' 1-minute averages, so the categories can differ slightly from local warnings.";
    } else {
      head = "🌳 Protected areas";
      const order = PA.map((a, i) => [a, i]).filter(([a]) => !P.prot.kind || a[6] === P.prot.kind).sort((x, y) => x[0][2] - y[0][2]).map(([, i]) => i);
      const a = S.pick != null ? PA[S.pick] : null;
      if (a) {
        const where = a[1].split(" ").map((c) => W.byIso.get(c)?.name || ({ ATA: "Antarctica", PCN: "Pitcairn Islands (UK)", SGS: "South Georgia (UK)", IOT: "Chagos Archipelago", COK: "Cook Islands", NCL: "New Caledonia (France)", GRL: "Greenland (Denmark)" }[c] || c)).join(", ");
        body = `${nav(order.indexOf(S.pick), order.length, "West", "East")}<div class="aff-one"><h4>${esc(a[0])}</h4>
          <p class="aff-who"><span class="cs-tag" style="--cs:${a[6] === "sea" ? "#1f7fbf" : "#2e8b47"}">${a[6] === "sea" ? "Marine reserve" : "On land"}</span> ${esc(where)}</p>
          <ul class="cs-facts"><li>About <b>${d3.format(",")(a[4])} km²</b> <small>(${a[4] >= 243600 ? `${(a[4] / 243600).toFixed(a[4] >= 2436000 ? 0 : 1)} times the size of the UK` : `${Math.round(a[4] / 243600 * 1000) / 10}% of the size of the UK`})</small></li><li>Protected since ${esc(a[5])}</li></ul>
          <p>${esc(a[7])}</p>
          <p class="aff-links"><a href="${wiki(a[0])}" target="_blank" rel="noopener">Read more ↗</a> · <button type="button" class="linkbtn" data-back>All protected areas</button></p></div>`;
      } else {
        body = `<p class="hint">National parks, nature reserves and marine reserves limit what can be done there, to protect wildlife and landscapes. About 17.6% of the world's land and 8.4% of its ocean is protected. In 2022 almost every country agreed to protect <b>30% of land and sea by 2030</b> (“30 by 30”).</p>
          <p class="aff-links"><button type="button" class="ghost cs-go" data-q="f=protected_land_pct:30~100">Countries with 30% of their land protected</button> <button type="button" class="ghost cs-go" data-q="f=protected_sea_pct:30~100">… and of their sea</button></p>
          <div class="cs-topics">${[["", "All"], ["land", "▲ On land"], ["sea", "≈ Marine"]].map(([v, l]) => `<button type="button" class="cs-t ${P.prot.kind === v ? "on" : ""}" data-k="${v}">${l}</button>`).join("")}</div>
          <ul class="aff-list">${order.map((i) => `<li><span class="pa-dot ${PA[i][6]}">${PA[i][6] === "sea" ? "≈" : "▲"}</span><button type="button" class="linkbtn" data-c="${i}">${esc(PA[i][0])}</button> <small>${d3.format(",")(PA[i][4])} km²</small></li>`).join("")}</ul>
          <p class="hint">Most of the ocean beyond countries' 200-mile zones (the high seas) has had almost no protection. The High Seas Treaty, in force since January 2026, allows protected areas to be set up there for the first time.</p>`;
      }
      src = "Country figures: World Bank, from the World Database on Protected Areas (UNEP-WCMC and IUCN). Areas, dates and notes: written for this site, checked November 2026; figures are approximate.";
    }
    el.innerHTML = `<div class="dsc-head"><h3>${head}</h3><button type="button" class="iconbtn" data-x aria-label="Close">×</button></div>${body}<p class="hint aff-src">${src}</p>`;
    el.querySelector("[data-x]").onclick = () => toggle(which, false);
    el.querySelectorAll("[data-back]").forEach((b) => (b.onclick = () => { S.pick = null; card(which); }));
    const go = (i) => {
      S.pick = i;
      if (which === "cyc") { const m = middle(CY[i]); zoomTo(m.at, m.k); } else zoomTo(PA[i].slice(2, 4), PA[i][4] > 300000 ? 2.2 : 4);
      card(which);
    };
    el.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => go(+b.dataset.c)));
    el.querySelectorAll("[data-era]").forEach((b) => (b.onclick = () => { S.era = b.dataset.era; card(which); }));
    el.querySelectorAll("[data-min]").forEach((b) => (b.onclick = () => { S.min = +b.dataset.min; card(which); }));
    el.querySelectorAll("[data-k]").forEach((b) => (b.onclick = () => { P.prot.kind = b.dataset.k; card(which); }));
    const sel = el.querySelector(".cyc-basin"); if (sel) sel.onchange = () => { S.basin = sel.value; card(which); };
    el.querySelectorAll(".cs-go").forEach((b) => (b.onclick = () => W.applyQS(b.dataset.q)));
    el.querySelectorAll("[data-step]").forEach((b) => (b.onclick = () => {
      if (which === "cyc") { const list = byDate(shown()), j = list.findIndex((x) => x.i === S.pick) + +b.dataset.step; if (list[j]) go(list[j].i); }
      else { const order = PA.map((a, i) => [a, i]).filter(([a]) => !P.prot.kind || a[6] === P.prot.kind).sort((x, y) => x[0][2] - y[0][2]).map(([, i]) => i); go(order[order.indexOf(S.pick) + +b.dataset.step]); }
    }));
    draw();
  }
  async function toggle(which, on) {
    const S = P[which];
    S.on = on ?? !S.on;
    if (S.on && which === "cyc") await load();
    if (S.on && which === "cyc" && !CY) S.on = false;
    card(which);
  }
  function init() {
    W = window.WC;
    let box = $("#mapbtns");
    if (!box) { box = document.createElement("div"); box.id = "mapbtns"; box.className = "mapbtns"; $("#mapstage").appendChild(box); }
    [["cyc", "cycBtn", "🌀 Cyclone tracks"], ["prot", "protBtn", "🌳 Protected areas"]].forEach(([k, id, t]) => {
      const b = document.createElement("button");
      b.type = "button"; b.id = id; b.className = "mmbtn"; b.setAttribute("aria-pressed", "false"); b.textContent = t;
      b.onclick = () => toggle(k);
      box.appendChild(b);
    });
  }
  window.WPT = { init, draw: () => draw(), zoomed, refresh: () => { ["cyc", "prot"].forEach((k) => { if (P[k].on) card(k); }); }, toggle, _P: P };
})();
