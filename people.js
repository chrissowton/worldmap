/* People on the move and connected cities (v71), in the map layers:
   - Migration routes: the main routes migrants take, and the people who died or went missing on them, 2014–2024
     (IOM Missing Migrants Project; migrants.json)
   - World cities: the GaWC 2024 ranking of how connected cities are to the world economy (gawc.json)
   - Trade partners: each country's biggest export market and import source (IMF, via Our World in Data; trade.json) */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const wiki = (q) => `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(q)}`;
  let W, MG = null, GW = null, TR = null; const loading = {};
  const P = { mig: { on: false, pick: null }, wc: { on: false, pick: null, min: "Gamma-" }, trade: { on: false, pick: null, dir: "imp", year: null } };
  const fmtN = (n) => d3.format(",")(Math.round(n));

  // ---------- Migration routes: [name, Missing Migrants route names, points along the route, text] ----------
  const ROUTES = [
    ["Central Mediterranean", ["Central Mediterranean"], [[13.2, 32.9], [12.6, 35.5], [13.4, 38.1]], "From Libya and Tunisia across the sea to Italy (often first to the island of Lampedusa): the deadliest migration route in the world. Smugglers crowd people into unsafe boats; many are fleeing war or poverty in Africa and Asia. European countries argue over rescue at sea and who should take people in."],
    ["Western Mediterranean", ["Western Mediterranean"], [[-2.9, 35.2], [-2.5, 36.8]], "From Morocco and Algeria to southern Spain, across the sea or by climbing the fences around Spain's cities of Ceuta and Melilla in North Africa."],
    ["Atlantic route to the Canary Islands", ["Western Africa / Atlantic route to the Canary Islands"], [[-17.4, 14.7], [-17.2, 18], [-16.9, 21], [-15.9, 23.7], [-15.4, 27.9]], "From Senegal, Gambia, Mauritania and Morocco to Spain's Canary Islands, in wooden fishing boats (pirogues) on the open Atlantic: a journey of up to 1,500 km. Arrivals reached record levels in 2023–24, and many boats are lost without trace."],
    ["Eastern Mediterranean", ["Eastern Mediterranean"], [[27.0, 38.9], [26.4, 39.1], [24.5, 38.5], [23.7, 37.9]], "From Türkiye to the Greek islands, a short but dangerous crossing used by about 850,000 people in 2015, many fleeing the war in Syria. A deal between the EU and Türkiye in 2016 cut the numbers. In 2023 a boat from Libya sank off Pylos, Greece, with about 600 people on board."],
    ["Western Balkans", ["Western Balkans", "Türkiye-Europe land route"], [[26.3, 41.6], [22.9, 40.6], [21.4, 42.0], [20.5, 44.8], [19.7, 46.2], [16.4, 48.2]], "Overland from Greece and Türkiye through the Balkans to Hungary, Austria and Germany: the route of more than a million people in 2015. Countries then built border fences, pushing people onto more dangerous paths."],
    ["English Channel", ["English Channel to the UK"], [[1.85, 50.95], [1.3, 51.13]], "From northern France to England in small inflatable boats, through the world's busiest shipping lane. Crossings grew from almost none in 2018 to tens of thousands a year."],
    ["Belarus–EU border", ["Belarus-EU border"], [[27.6, 53.9], [23.8, 53.1]], "Since 2021 people have been flown to Belarus and pushed towards Poland, Lithuania and Latvia, which call it a deliberate attempt to destabilise them, and have built fences through the forests."],
    ["Sahara crossing", ["Sahara Desert crossing"], [[8.0, 17.0], [11.0, 21.0], [13.9, 25.0], [14.4, 27.0], [13.2, 32.9]], "Across the Sahara from Niger and Mali towards Libya and Algeria, by truck. Breakdowns, heat, thirst and abandonment by smugglers kill many; far fewer deaths are recorded here than at sea, but there may be as many."],
    ["Eastern route: Horn of Africa to the Gulf", ["Eastern Route to/from EHOA", "Horn of Africa Route", "Northern Route from EHOA"], [[38.7, 9.0], [42.6, 11.3], [43.4, 12.6], [44.2, 14.5], [44.0, 17.5], [46.7, 24.7]], "From Ethiopia and Somalia through Djibouti, across the narrow Bab-el-Mandeb strait to war-torn Yemen, then towards jobs in Saudi Arabia. One of the busiest and most dangerous routes in the world, little reported."],
    ["Route to Southern Africa", ["Route to Southern Africa"], [[38.7, 9.0], [36.8, -1.3], [39.3, -6.8], [35.0, -15.8], [28.0, -26.2]], "From the Horn of Africa south through Kenya, Tanzania, Malawi and Mozambique to South Africa, in search of work. Some people have died hidden in trucks and containers."],
    ["Afghanistan to Iran and Türkiye", ["Afghanistan to Iran", "Iran to Türkiye", "Syria to Türkiye"], [[69.2, 34.5], [62.2, 34.3], [59.6, 36.3], [51.4, 35.7], [44.4, 38.5], [41.3, 39.9]], "Afghans have crossed into Iran for decades, especially since the Taliban returned in 2021; some carry on over the mountains into Türkiye. Many deaths are from shooting at the border, road accidents and the cold."],
    ["Darién Gap and the Americas", ["Darien"], [[-76.8, 8.4], [-77.6, 8.6], [-79.5, 9.0], [-84.1, 9.9], [-86.3, 12.1], [-87.2, 14.1], [-90.5, 14.6], [-92.1, 14.9], [-99.1, 19.4], [-106.5, 31.7]], "North through South and Central America, including the roadless jungle of the Darién Gap between Colombia and Panama, crossed by more than half a million people in 2023. Numbers fell sharply in 2025 when US policy changed."],
    ["US–Mexico border", ["US-Mexico border crossing"], [[-117.1, 32.5], [-114.7, 32.7], [-111.0, 31.3], [-108.2, 31.3], [-106.5, 31.8], [-104.5, 29.6], [-101.4, 29.8], [-99.5, 27.5], [-97.4, 25.9]], "Most deaths at the US–Mexico border happen in the desert of Arizona and Texas, from heat and thirst, or by drowning in the Rio Grande. Walls and patrols in towns pushed crossings into more remote places."],
    ["Caribbean sea crossings", ["Caribbean to US", "Dominican Republic to Puerto Rico", "Haiti to Dominican Republic", "Venezuela to Caribbean", "Caribbean to Central America"], [[-72.3, 18.6], [-75.8, 20.0], [-80.2, 25.8]], "Small boats from Haiti, Cuba and the Dominican Republic towards Florida and Puerto Rico, and from Venezuela to nearby islands."],
    ["Comoros to Mayotte", ["Sea crossings to Mayotte"], [[44.4, -12.2], [45.1, -12.8]], "From the Comoros to Mayotte, an island that is part of France and so of the EU, in small boats called kwassa-kwassa."],
  ];

  const get = (url, pre) => (window[pre] ? Promise.resolve(window[pre]) : fetch(url + "?v=71").then((r) => r.json()));
  function load(kind) {
    if (kind === "mig") return (loading.mig ||= get("migrants.json", "__MIGRANTS__").then((j) => (MG = j)).catch(() => null));
    if (kind === "wc") return (loading.wc ||= get("gawc.json", "__GAWC__").then((j) => (GW = j)).catch(() => null));
    return (loading.trade ||= get("trade.json", "__TRADE__").then((j) => (TR = j)).catch(() => null));
  }
  const routeTotal = (r) => (MG ? d3.sum(r[1], (k) => d3.sum(Object.values(MG.routes[k] || {}))) : 0);
  const routeYears = (r) => { const o = {}; r[1].forEach((k) => Object.entries(MG.routes[k] || {}).forEach(([y, v]) => (o[y] = (o[y] || 0) + v))); return o; };
  const WCOL = { Alpha: "#b3261e", Beta: "#e08b00", Gamma: "#2f7fd1" };
  const tier = (c) => c.replace(/[+\-]+$/, "");
  const CLS = ["Alpha++", "Alpha+", "Alpha", "Alpha-", "Beta+", "Beta", "Beta-", "Gamma+", "Gamma", "Gamma-"];
  const rank = (c) => CLS.indexOf(c);

  // ---------- Drawing ----------
  let migFor = "", wcFor = "", trFor = "";
  const smooth = d3.line().curve(d3.curveCatmullRom.alpha(0.5));
  function draw() {
    if (!W) return;
    const map = W.state.view === "map", k = W.k || 1;
    {
      const g = W.layer("migration");
      const show = P.mig.on && MG && map;
      g.style("display", show ? null : "none");
      if (show) {
        const sig = `${W.state.mode}|${$("#map")?.getAttribute("viewBox")}|${P.mig.pick}`;
        if (migFor !== sig) {
          migFor = sig;
          const cells = MG.cells.map((c) => ({ c, xy: W.project(c[0], c[1]) })).filter((d) => d.xy).sort((a, b) => b.c[2] - a.c[2]);
          g.selectAll("circle.mm").data(cells).join("circle").attr("class", "mm").attr("r", (d) => Math.min(18, 1.6 + Math.sqrt(d.c[2]) * 0.55))
            .attr("transform", (d) => `translate(${d.xy[0]},${d.xy[1]}) scale(${1 / k})`)
            .attr("data-base", (d) => `${fmtN(d.c[2])} ${d.c[2] === 1 ? "person" : "people"} died or went missing near here, 2014–2024${d.c[3] !== "Other or unknown" ? ` (${d.c[3]})` : ""}`);
          const rs = ROUTES.map((r, i) => ({ r, i, pts: r[2].map((p) => W.project(p[0], p[1])).filter(Boolean) })).filter((d) => d.pts.length > 1);
          const gg = g.selectAll("g.mr").data(rs, (d) => d.i).join((en) => { const x = en.append("g").attr("class", "mr"); x.append("path").attr("class", "mr-hit"); x.append("path").attr("class", "mr-l"); x.append("path").attr("class", "mr-h").attr("d", "M-7,-5 L2,0 L-7,5Z"); return x; })
            .classed("on", (d) => P.mig.pick === d.i).classed("dim", (d) => P.mig.pick != null && P.mig.pick !== d.i)
            .on("click", (ev, d) => { ev.stopPropagation(); P.mig.pick = d.i; card("mig"); });
          gg.select(".mr-hit").attr("d", (d) => smooth(d.pts)).attr("vector-effect", "non-scaling-stroke").attr("data-base", (d) => `➜ ${d.r[0]}${routeTotal(d.r) ? `: ${fmtN(routeTotal(d.r))} people dead or missing, 2014–2024` : ""} (click for more)`);
          gg.select(".mr-l").attr("d", (d) => smooth(d.pts)).attr("vector-effect", "non-scaling-stroke");
          gg.select(".mr-h").datum((d) => { const a = d.pts[d.pts.length - 2], b = d.pts[d.pts.length - 1]; return { ...d, xy: b, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI }; })
            .attr("transform", (d) => `translate(${d.xy[0]},${d.xy[1]}) rotate(${d.ang}) scale(${1 / k})`);
        }
        g.raise();
      }
    }
    {
      const g = W.layer("worldcities");
      const show = P.wc.on && GW && map;
      g.style("display", show ? null : "none");
      if (show) {
        const sig = `${W.state.mode}|${$("#map")?.getAttribute("viewBox")}|${P.wc.min}|${P.wc.pick}`;
        if (wcFor !== sig) {
          wcFor = sig;
          const pts = GW.cities.map((c, i) => ({ c, i, xy: W.project(c[3], c[2]) })).filter((d) => d.xy && rank(d.c[4]) <= rank(P.wc.min)).sort((a, b) => rank(b.c[4]) - rank(a.c[4]));
          const gg = g.selectAll("g.wc").data(pts, (d) => d.i).join((en) => { const x = en.append("g").attr("class", "wc"); x.append("circle"); x.append("text"); return x; })
            .attr("transform", (d) => `translate(${d.xy[0]},${d.xy[1]}) scale(${1 / k})`).classed("on", (d) => P.wc.pick === d.i)
            .on("click", (ev, d) => { ev.stopPropagation(); P.wc.pick = d.i; card("wc"); });
          gg.select("circle").attr("r", (d) => 10 - rank(d.c[4]) * 0.7).style("fill", (d) => WCOL[tier(d.c[4])]).attr("data-base", (d) => `🏙️ ${d.c[0]}: ${d.c[4]} world city (GaWC 2024)`);
          gg.select("text").text((d) => (rank(d.c[4]) <= 1 ? d.c[0] : "")).attr("x", 11).attr("y", 4);
        }
        g.raise();
      }
    }
    {
      const g = W.layer("trade");
      const show = P.trade.on && TR && map;
      g.style("display", show ? null : "none");
      if (show) {
        const S = P.trade, y = S.year || TR.last;
        const sig = `${W.state.mode}|${$("#map")?.getAttribute("viewBox")}|${S.dir}|${y}|${S.pick}`;
        if (trFor !== sig) {
          trFor = sig;
          const data = TR[S.dir][y] || {};
          // colour each country by its top partner (the most common partners get their own colour)
          const counts = d3.rollups(Object.values(data), (v) => v.length, (p) => p).sort((a, b) => b[1] - a[1]);
          const PAL = ["#d23b3b", "#2f6fd1", "#e08b00", "#2e9d55", "#7b55c7", "#0d8a8a", "#c2185b", "#8a6d3b"];
          const col = new Map(counts.slice(0, PAL.length).map(([p], i) => [p, PAL[i]]));
          TR._col = col; TR._counts = counts;
          const feats = W.geo.filter((f) => f.rec && data[f.rec.iso3]);
          g.selectAll("path.tp").data(feats, (f) => f.rec.iso3).join("path").attr("class", "tp").attr("d", W.geoPath()).attr("vector-effect", "non-scaling-stroke")
            .style("fill", (f) => col.get(data[f.rec.iso3]) || "#9aa7ad").classed("on", (f) => S.pick === f.rec.iso3)
            .attr("data-base", (f) => `${f.rec.name}: ${S.dir === "imp" ? "imports most from" : "exports most to"} ${W.byIso.get(data[f.rec.iso3])?.name || data[f.rec.iso3]} (${y})`)
            .on("click", (ev, f) => { ev.stopPropagation(); S.pick = f.rec.iso3; card("trade"); });
          // a line from the chosen country to its partner
          const p = S.pick && data[S.pick], a = p && W.byIso.get(S.pick)?.latlng, b = p && W.byIso.get(p)?.latlng;
          const line = a && b ? [{ type: "LineString", coordinates: [[a[1], a[0]], [b[1], b[0]]] }] : [];
          g.selectAll("path.tl").data(line).join("path").attr("class", "tl").attr("d", W.geoPath()).attr("vector-effect", "non-scaling-stroke");
        }
      }
    }
  }
  function zoomed() {
    if (!W) return;
    const k = W.k || 1;
    W.layer("migration").selectAll("circle.mm").attr("transform", (d) => (d?.xy ? `translate(${d.xy[0]},${d.xy[1]}) scale(${1 / k})` : null));
    W.layer("migration").selectAll("path.mr-h").attr("transform", (d) => (d?.xy ? `translate(${d.xy[0]},${d.xy[1]}) rotate(${d.ang}) scale(${1 / k})` : null));
    W.layer("worldcities").selectAll("g.wc").attr("transform", (d) => (d?.xy ? `translate(${d.xy[0]},${d.xy[1]}) scale(${1 / k})` : null));
  }
  function zoomTo(at, k) {
    const card = $("#mapcards"), stage = $("#mapstage");
    const shift = card && stage ? Math.min(card.getBoundingClientRect().width / 2, stage.clientWidth / 4) : 0;
    W.zoomToPoint(at[0], at[1], k);
    if (shift) setTimeout(() => W.panBy?.(shift, 0), 650);
  }
  const nav = (i, n, a, b) => `<div class="aff-nav"><button type="button" class="ghost" data-step="-1" ${i <= 0 ? "disabled" : ""}>◀ ${a}</button><span>${i + 1} of ${n}</span><button type="button" class="ghost" data-step="1" ${i >= n - 1 ? "disabled" : ""}>${b} ▶</button></div>`;
  const chips = (opts, cur, attr) => `<div class="cs-topics">${opts.map(([v, l, c]) => `<button type="button" class="cs-t ${String(cur) === String(v) ? "on" : ""}" data-${attr}="${v}" ${c ? `style="--cs:${c}"` : ""}>${l}</button>`).join("")}</div>`;
  const bars = (obj, hi) => { const ys = Object.keys(obj).sort(), max = d3.max(ys, (y) => obj[y]) || 1; return `<div class="cyc-bars mm-bars">${ys.map((y) => `<span title="${y}: ${fmtN(obj[y])}"><i style="height:${Math.round(obj[y] / max * 100)}%${String(y) === String(hi) ? ";background:#14212b" : ""}"></i><small>${String(y).slice(2)}</small></span>`).join("")}</div>`; };
  const cname = (c) => W.byIso.get(c)?.name || c, cflag = (c) => W.byIso.get(c)?.flag || "";

  // ---------- Cards ----------
  const IDS = { mig: ["migCard", "migBtn"], wc: ["wcCard", "wcBtn"], trade: ["tradeCard", "tradeBtn"] };
  function order(which) {
    if (which === "mig") return ROUTES.map((r, i) => [routeTotal(r), i]).sort((a, b) => b[0] - a[0]).map(([, i]) => i);
    if (which === "wc") return GW.cities.map((c, i) => [c, i]).filter(([c]) => rank(c[4]) <= rank(P.wc.min)).sort((a, b) => rank(a[0][4]) - rank(b[0][4])).map(([, i]) => i);
    return [];
  }
  function go(which, i) {
    const S = P[which]; S.pick = i;
    if (which === "mig") { const p = ROUTES[i][2]; zoomTo(p[Math.floor(p.length / 2)], p.length > 4 ? 2.6 : 4); }
    else if (which === "wc") { const c = GW.cities[i]; zoomTo([c[3], c[2]], 4); }
    else W.zoomToCountry?.(i);
    card(which);
  }
  function card(which) {
    const S = P[which], [id, btn] = IDS[which];
    let el = $("#" + id);
    if (!el) { el = document.createElement("div"); el.id = id; el.className = "card livecard affcard"; $("#mapstage").appendChild(el); }
    el.hidden = !S.on || W.state.view !== "map" || (which === "mig" && !MG) || (which === "wc" && !GW) || (which === "trade" && !TR);
    $("#" + btn)?.setAttribute("aria-pressed", String(S.on));
    if (el.hidden) { draw(); return; }
    let head, body, src;
    const back = (t) => `<button type="button" class="linkbtn" data-back>${t}</button>`;
    if (which === "mig") {
      head = "🧭 Migration routes";
      const ord = order("mig"), r = S.pick != null ? ROUTES[S.pick] : null;
      if (r) {
        const tot = routeTotal(r), ys = routeYears(r), worst = Object.entries(ys).sort((a, b) => b[1] - a[1])[0];
        body = `${nav(ord.indexOf(S.pick), ord.length, "More", "Fewer")}<div class="aff-one"><h4>${esc(r[0])}</h4><p>${esc(r[3])}</p>
          ${tot ? `<ul class="cs-facts"><li><b>${fmtN(tot)}</b> people recorded dead or missing, 2014–2024</li>${worst ? `<li>Most in ${worst[0]}: ${fmtN(worst[1])}</li>` : ""}</ul>${bars(ys)}` : ""}
          <p class="aff-links"><a href="${wiki(r[0] + " migration route")}" target="_blank" rel="noopener">Read more ↗</a> · ${back("All routes")}</p></div>`;
      } else {
        body = `<p class="hint">Arrows show the main routes people take to reach Europe, North America, the Gulf and southern Africa, often fleeing war, persecution or poverty. Red circles: where people died or went missing on the way, 2014–2024 (bigger = more people). Each number is a person; the real total is certainly higher.</p>
          <p class="cyc-n"><b>${fmtN(MG.total)}</b> people recorded dead or missing during migration, 2014–2024.</p>${bars(MG.years)}
          <p class="cur-cs">Routes, deadliest first</p><ul class="aff-list">${ord.map((i) => { const t = routeTotal(ROUTES[i]); return `<li><button type="button" class="linkbtn" data-c="${i}">${esc(ROUTES[i][0])}</button> <small>${t ? fmtN(t) : ""}</small></li>`; }).join("")}</ul>
          <p class="aff-links"><button type="button" class="ghost cs-go" data-q="${(() => { const f = W.F.refugees_from; return f ? `f=refugees_from:${f.dmin}~${f.dmax}&c=refugees_from` : ""; })()}">Colour countries by refugees from them</button> <button type="button" class="ghost cs-go" data-q="${(() => { const f = W.F.migrants_pct; return f ? `f=migrants_pct:${f.dmin}~${f.dmax}&c=migrants_pct` : ""; })()}">… by people born abroad</button></p>`;
      }
      src = "IOM Missing Migrants Project (missingmigrants.iom.int), incidents 2014–2024. Routes drawn for this site; checked November 2026.";
    } else if (which === "wc") {
      head = "🏙️ World cities";
      const c = S.pick != null ? GW.cities[S.pick] : null, ord = order("wc");
      if (c) {
        const same = GW.cities.filter((x) => x[4] === c[4]).map((x) => x[0]);
        body = `${ord.includes(S.pick) ? nav(ord.indexOf(S.pick), ord.length, "More connected", "Less") : ""}<div class="aff-one"><h4>${esc(c[0])}</h4>
          <p class="aff-who"><span class="cs-tag" style="--cs:${WCOL[tier(c[4])]}">${esc(c[4])} world city</span> ${cflag(c[1])} ${esc(cname(c[1]))}</p>
          <p class="hint">Also ${esc(c[4])}: ${esc(same.filter((x) => x !== c[0]).slice(0, 12).join(", "))}${same.length > 13 ? "…" : ""}</p>
          <p class="aff-links"><a href="${wiki(c[0])}" target="_blank" rel="noopener">Read more ↗</a> · ${back("All world cities")}</p></div>`;
      } else {
        const by = d3.rollups(GW.cities, (v) => v.map((x) => x[0]), (x) => x[4]);
        body = `<p class="hint">World cities are the control centres of the global economy. GaWC ranks cities by how many offices the world's biggest banks, law firms, accountants, advertising and consultancy companies have there: Alpha cities link major economic regions into the world economy, Beta cities link their country or region, Gamma cities are smaller links.</p>
          ${chips([["Alpha-", "Alpha only", WCOL.Alpha], ["Beta-", "Alpha and Beta", WCOL.Beta], ["Gamma-", "All", WCOL.Gamma]], S.min, "min")}
          <ul class="wc-list">${by.filter(([cls]) => rank(cls) <= rank(S.min)).map(([cls, names]) => `<li><span class="cs-tag" style="--cs:${WCOL[tier(cls)]}">${esc(cls)}</span> ${names.map((n) => `<button type="button" class="linkbtn" data-c="${GW.cities.findIndex((x) => x[0] === n)}">${esc(n)}</button>`).join(", ")}</li>`).join("")}</ul>
          <p class="aff-links"><button type="button" class="ghost cs-go" data-q="${(() => { const f = W.F.gawc_cities; return f ? `f=gawc_cities:1~${f.dmax}&c=gawc_cities` : ""; })()}">Colour countries by number of world cities</button></p>`;
      }
      src = "GaWC (Globalization and World Cities Research Network), The World According to GaWC 2024, Loughborough University and KU Leuven.";
    } else {
      head = "🚢 Trade partners";
      const y = S.year || TR.last, data = TR[S.dir][y] || {};
      if (!TR._col) draw();
      const counts = TR._counts || [], col = TR._col || new Map();
      const years = TR.years;
      body = `<p class="hint">Which country each country ${S.dir === "imp" ? "buys the most goods from" : "sells the most goods to"}. Click a country to draw a line to its partner. Press play to see China overtake the USA and Europe as the top partner for much of the world.</p>
        ${chips([["imp", "Top source of imports"], ["exp", "Top market for exports"]], S.dir, "dir")}
        <div class="col-yr"><button type="button" class="ghost tr-play" aria-label="Play">▶</button><input type="range" min="${years[0]}" max="${years[years.length - 1]}" step="1" value="${y}" aria-label="Year"><b>${y}</b></div>
        <ul class="tr-list">${counts.slice(0, 8).map(([p, n]) => `<li><i style="background:${col.get(p) || "#9aa7ad"}"></i>${cflag(p)} ${esc(cname(p))} <small>top partner for ${n} countries</small></li>`).join("")}</ul>
        ${S.pick && data[S.pick] ? `<div class="aff-one"><h4>${cflag(S.pick)} ${esc(cname(S.pick))}</h4><p>In ${y}, ${esc(cname(S.pick))} ${S.dir === "imp" ? "imported most from" : "exported most to"} <b>${cflag(data[S.pick])} ${esc(cname(data[S.pick]))}</b>.</p><p class="aff-links">${back("Close")}</p></div>` : ""}`;
      src = "International Monetary Fund, International Trade in Goods by partner (IMTS), via Our World in Data. Goods only, not services.";
    }
    el.innerHTML = `<div class="dsc-head"><h3>${head}</h3><button type="button" class="iconbtn" data-x aria-label="Close">×</button></div>${body}<p class="hint aff-src">${src}</p>`;
    el.querySelector("[data-x]").onclick = () => toggle(which, false);
    el.querySelectorAll("[data-back]").forEach((b) => (b.onclick = () => { S.pick = null; card(which); }));
    el.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => go(which, +b.dataset.c)));
    el.querySelectorAll("[data-min]").forEach((b) => (b.onclick = () => { S.min = b.dataset.min; S.pick = null; card(which); }));
    el.querySelectorAll("[data-dir]").forEach((b) => (b.onclick = () => { S.dir = b.dataset.dir; card(which); }));
    el.querySelectorAll(".cs-go").forEach((b) => (b.onclick = () => W.applyQS(b.dataset.q)));
    el.querySelectorAll("[data-step]").forEach((b) => (b.onclick = () => { const o = order(which), j = o.indexOf(S.pick) + +b.dataset.step; if (o[j] != null) go(which, o[j]); }));
    const yr = el.querySelector(".col-yr input");
    if (yr && which === "trade") {
      yr.oninput = () => { stopTr(); S.year = +yr.value; el.querySelector(".col-yr b").textContent = S.year; draw(); };
      yr.onchange = () => card(which);
      el.querySelector(".tr-play").textContent = trTimer ? "⏸" : "▶";
      el.querySelector(".tr-play").onclick = () => (trTimer ? (stopTr(), card(which)) : playTr());
    }
    draw();
  }
  let trTimer = null;
  function stopTr() { if (trTimer) { clearInterval(trTimer); trTimer = null; } }
  function playTr() {
    const ys = TR.years; let i = ys.indexOf(P.trade.year || TR.last); if (i < 0 || i >= ys.length - 1) i = 0;
    P.trade.year = ys[i];
    trTimer = setInterval(() => { i++; if (i >= ys.length) { stopTr(); return card("trade"); } P.trade.year = ys[i]; card("trade"); }, 450);
    card("trade");
  }
  async function toggle(which, on) {
    const S = P[which];
    S.on = on ?? !S.on;
    if (S.on) await load(which);
    if (S.on && ((which === "mig" && !MG) || (which === "wc" && !GW) || (which === "trade" && !TR))) S.on = false;
    if (!S.on && which === "trade") stopTr();
    card(which);
  }
  function init() {
    W = window.WC;
    let box = $("#mapbtns");
    if (!box) { box = document.createElement("div"); box.id = "mapbtns"; box.className = "mapbtns"; $("#mapstage").appendChild(box); }
    [["mig", "migBtn", "🧭 Migration routes"], ["wc", "wcBtn", "🏙️ World cities"]].concat(window.WMG_TRADE ? [["trade", "tradeBtn", "🚢 Trade partners"]] : []).forEach(([k, id, t]) => {
      const b = document.createElement("button");
      b.type = "button"; b.id = id; b.className = "mmbtn"; b.setAttribute("aria-pressed", "false"); b.textContent = t;
      b.onclick = () => toggle(k);
      box.appendChild(b);
    });
  }
  window.WMG = { init, draw: () => draw(), zoomed, refresh: () => { Object.keys(P).forEach((k) => { if (P[k].on) card(k); }); }, toggle, _P: P };
})();
