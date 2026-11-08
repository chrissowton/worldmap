/* The connected world on the map (v66), in More on the map:
   - Undersea cables: the internet's submarine cables and landing points (TeleGeography 2026, via T. Hotham; cables.json)
   - World Heritage Sites: all 1,273 (UNESCO, August 2026; heritage.json)
   - Critical minerals: who mines the minerals needed for batteries, magnets and power grids (USGS, approximate shares) */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const wiki = (q) => `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(q)}`;
  let W, CB = null, WH = null, loading = {};
  const P = { cab: { on: false, pick: null, show: "all", hub: null }, whs: { on: false, pick: null, cat: "", q: "" }, min: { on: false, pick: null, m: "lithium" } };
  const WCOL = { c: "#c07a1c", n: "#2e8b47", m: "#7b55c7" }, WNAME = { c: "Cultural", n: "Natural", m: "Mixed (cultural and natural)" };

  // ---------- Critical minerals: share of world mine production, 2025 (USGS Mineral Commodity Summaries 2026; rounded) ----------
  const MIN = {
    lithium: ["Lithium", "🔋", "Rechargeable batteries in electric cars, phones, laptops and grid storage.", [["AUS", 32], ["CHN", 21], ["CHL", 19], ["ZWE", 10], ["ARG", 8], ["BRA", 4], ["MLI", 3], ["CAN", 2]],
      "Australia mines it from hard rock, as do China and Zimbabwe, whose output has grown fast; Chile and Argentina pump salty water from under the salt flats of the Andes and let it evaporate, using lots of water in a desert (the “lithium triangle”, with Bolivia, which has the biggest resources). China refines about two-thirds of the world's lithium."],
    cobalt: ["Cobalt", "⚙️", "Batteries, and alloys for jet engines.", [["COD", 74], ["IDN", 14], ["RUS", 2], ["MDG", 1], ["AUS", 1], ["PHL", 1], ["CAN", 1]],
      "Three-quarters comes from the Democratic Republic of the Congo, some of it dug by hand in small “artisanal” mines where child labour and dangerous conditions have been reported. Most of the big mines are owned by Chinese companies, and China refines about three-quarters of the world's cobalt."],
    rare: ["Rare earths", "🧲", "Strong magnets in wind turbines, electric motors, phones and headphones; also lasers and military equipment.", [["CHN", 69], ["USA", 13], ["AUS", 7], ["MMR", 6], ["THA", 1], ["IND", 1]],
      "Not actually rare, but hard and dirty to separate. China mines most of them and processes about 90%, which gives it great power over supplies: it limited exports of some in 2023–25. Mining in Myanmar has polluted rivers."],
    nickel: ["Nickel", "🔩", "Stainless steel, and batteries for electric cars.", [["IDN", 67], ["PHL", 7], ["RUS", 5], ["CAN", 4], ["NCL", 4], ["CHN", 3], ["BRA", 2], ["AUS", 1]],
      "Indonesia, now mining two-thirds of the world's nickel, banned exports of unprocessed ore in 2020, so companies (mostly Chinese) built smelters there: an example of a country using its resources to industrialise. Mining has cleared rainforest and polluted coasts."],
    copper: ["Copper", "🟠", "Electrical wiring, power grids, motors, solar panels and wind turbines: an electric car uses about four times as much as a petrol car.", [["CHL", 23], ["COD", 14], ["PER", 12], ["CHN", 8], ["RUS", 6], ["USA", 4], ["ZMB", 4], ["AUS", 3], ["IDN", 3], ["KAZ", 3], ["MEX", 3]],
      "Chile and Peru, along the Andes, mine a third of the world's copper. Copper makes up about half of Chile's exports and three-quarters of Zambia's."],
    graphite: ["Graphite", "✏️", "The negative side (anode) of almost every lithium-ion battery; also pencils and steelmaking.", [["CHN", 78], ["MDG", 4], ["TZA", 4], ["BRA", 4], ["MOZ", 3], ["RUS", 1], ["IND", 1]],
      "China mines about four-fifths of natural graphite and makes most synthetic graphite too. Madagascar, Tanzania and Mozambique are growing producers."],
    platinum: ["Platinum", "⚪", "Catalytic converters in cars, hydrogen fuel cells and electrolysers, and jewellery.", [["ZAF", 71], ["RUS", 12], ["ZWE", 11], ["CAN", 3], ["USA", 1]],
      "Most comes from one huge rock formation in South Africa, the Bushveld Complex, mined deep underground."],
  };

  function load(kind) {
    const get = (url, pre) => (window[pre] ? Promise.resolve(window[pre]) : fetch(url + "?v=66").then((r) => r.json()));
    if (kind === "cab") return (loading.cab ||= get("cables.json", "__CABLES__").then((j) => {
      CB = { ...j, cables: j.cables.map(([name, year, planned, len, owners, big, countries, lines], i) => ({ i, name, year, planned, len, owners, big, countries,
        geo: { type: "MultiLineString", coordinates: lines.map((l) => { const o = []; for (let k = 0; k < l.length; k += 2) o.push([l[k], l[k + 1]]); return o; }) } })) };
    }).catch(() => (CB = null)));
    if (kind === "whs") return (loading.whs ||= get("heritage.json", "__HERITAGE__").then((j) => {
      WH = j.sites.map(([name, cs, cat, year, danger, lon, lat, id], i) => ({ i, name, cs, cat, year, danger, lon, lat, id }));
    }).catch(() => (WH = null)));
    return Promise.resolve();
  }
  const cabShown = () => CB.cables.filter((c) => (P.cab.show === "all" ? true : P.cab.show === "new" ? !c.planned && c.year >= 2020 : P.cab.show === "planned" ? c.planned : P.cab.show === "big" ? !!c.big : true));
  const whsShown = () => WH.filter((s) => (!P.whs.cat || s.cat === P.whs.cat) && (!P.whs.q || s.name.toLowerCase().includes(P.whs.q.toLowerCase()) || s.cs.some((c) => (W.byIso.get(c)?.name || "").toLowerCase().includes(P.whs.q.toLowerCase()))));

  // ---------- Drawing ----------
  let cabFor = "", whsFor = "", minFor = "";
  function draw() {
    if (!W) return;
    const map = W.state.view === "map", k = W.k || 1;
    {
      const g = W.layer("minerals");
      const show = P.min.on && map;
      g.style("display", show ? null : "none");
      if (show) {
        const sig = `${W.state.mode}|${$("#map")?.getAttribute("viewBox")}|${P.min.m}`;
        if (minFor !== sig) {
          minFor = sig;
          const M = MIN[P.min.m], share = new Map(M[3]), max = M[3][0][1];
          const col = d3.scaleSequential([0, Math.max(40, max)], d3.interpolateRgb("#fde7c8", "#a3410d"));
          const feats = W.geo.filter((f) => f.rec && share.has(f.rec.iso3));
          g.selectAll("path").data(feats, (f) => f.rec.iso3).join("path").attr("class", "mn-c").attr("d", W.geoPath()).attr("vector-effect", "non-scaling-stroke")
            .style("fill", (f) => col(share.get(f.rec.iso3)))
            .attr("data-base", (f) => `${M[1]} ${f.rec.name}: about ${share.get(f.rec.iso3)}% of the world's ${M[0].toLowerCase()} mined in 2025`);
        }
      }
    }
    {
      const g = W.layer("cables");
      const show = P.cab.on && CB && map;
      g.style("display", show ? null : "none");
      if (show) {
        const sig = `${W.state.mode}|${$("#map")?.getAttribute("viewBox")}|${P.cab.show}|${P.cab.pick}`;
        if (cabFor !== sig) {
          cabFor = sig;
          const path = W.geoPath();
          g.selectAll("path.cab").data(cabShown(), (c) => c.i).join("path").attr("class", (c) => `cab${c.planned ? " planned" : ""}${c.big ? " big" : ""}`)
            .classed("on", (c) => P.cab.pick === c.i).classed("dim", () => P.cab.pick != null)
            .attr("d", (c) => path(c.geo)).attr("vector-effect", "non-scaling-stroke")
            .attr("data-base", (c) => `〰️ ${c.name}${c.planned ? ` (planned${c.year ? `, ${c.year}` : ""})` : c.year ? `, ${c.year}` : ""} · click for more`)
            .on("click", (ev, c) => { ev.stopPropagation(); P.cab.pick = c.i; card("cab"); });
          g.selectAll("path.cab.on").raise();
          const lp = CB.landings.filter((l) => l[3] >= 3).map((l) => ({ l, xy: W.project(l[1], l[2]) })).filter((d) => d.xy);
          g.selectAll("circle.lp").data(lp, (d) => d.l[0]).join("circle").attr("class", "lp").attr("r", (d) => Math.min(6, 1.6 + Math.sqrt(d.l[3]) * 0.7))
            .attr("transform", (d) => `translate(${d.xy[0]},${d.xy[1]}) scale(${1 / k})`)
            .attr("data-base", (d) => `${d.l[0]}: ${d.l[3]} cables land here${d.l[4] ? `, ${d.l[4]} more planned` : ""}`);
        }
        g.raise();
      }
    }
    {
      const g = W.layer("heritage");
      const show = P.whs.on && WH && map;
      g.style("display", show ? null : "none");
      if (show) {
        const sig = `${W.state.mode}|${$("#map")?.getAttribute("viewBox")}|${P.whs.cat}|${P.whs.q}|${P.whs.pick}`;
        if (whsFor !== sig) {
          whsFor = sig;
          const pts = whsShown().map((s) => ({ s, xy: W.project(s.lon, s.lat) })).filter((d) => d.xy);
          g.selectAll("circle.wh").data(pts, (d) => d.s.i).join("circle").attr("class", "wh").attr("r", 3.6)
            .classed("on", (d) => P.whs.pick === d.s.i)
            .attr("transform", (d) => `translate(${d.xy[0]},${d.xy[1]}) scale(${(P.whs.pick === d.s.i ? 2 : 1) / k})`).style("fill", (d) => WCOL[d.s.cat])
            .attr("data-base", (d) => `🏛️ ${d.s.name} (${d.s.year}) · click for more`)
            .on("click", (ev, d) => { ev.stopPropagation(); P.whs.pick = d.s.i; card("whs"); });
          g.selectAll("circle.wh.on").raise();
        }
        g.raise();
      }
    }
  }
  function zoomed() {
    if (!W) return;
    const k = W.k || 1;
    W.layer("cables").selectAll("circle.lp").attr("transform", (d) => (d?.xy ? `translate(${d.xy[0]},${d.xy[1]}) scale(${1 / k})` : null));
    W.layer("heritage").selectAll("circle.wh").attr("transform", (d) => (d?.xy ? `translate(${d.xy[0]},${d.xy[1]}) scale(${(P.whs.pick === d.s.i ? 2 : 1) / k})` : null));
  }
  function zoomTo(at, k) {
    const card = $("#mapcards"), stage = $("#mapstage");
    const shift = card && stage ? Math.min(card.getBoundingClientRect().width / 2, stage.clientWidth / 4) : 0;
    W.zoomToPoint(at[0], at[1], k);
    if (shift) setTimeout(() => W.panBy?.(shift, 0), 650);
  }
  const nav = (i, n, a, b) => `<div class="aff-nav"><button type="button" class="ghost" data-step="-1" ${i <= 0 ? "disabled" : ""}>◀ ${a}</button><span>${i + 1} of ${n}</span><button type="button" class="ghost" data-step="1" ${i >= n - 1 ? "disabled" : ""}>${b} ▶</button></div>`;
  const chips = (opts, cur, attr) => `<div class="cs-topics">${opts.map(([v, l, c]) => `<button type="button" class="cs-t ${String(cur) === String(v) ? "on" : ""}" data-${attr}="${v}" ${c ? `style="--cs:${c}"` : ""}>${l}</button>`).join("")}</div>`;
  const cname = (c) => (W.byIso.get(c)?.name || c);
  const cflag = (c) => (W.byIso.get(c)?.flag || "");
  function cabMid(c) {
    const pts = c.geo.coordinates.flat(); let lons = pts.map((p) => p[0]);
    if (d3.max(lons) - d3.min(lons) > 180) lons = lons.map((x) => (x < 0 ? x + 360 : x));
    let lon = (d3.min(lons) + d3.max(lons)) / 2; if (lon > 180) lon -= 360;
    const span = Math.max(d3.max(lons) - d3.min(lons), (d3.max(pts, (p) => p[1]) - d3.min(pts, (p) => p[1])) * 1.6);
    return { at: [lon, (d3.min(pts, (p) => p[1]) + d3.max(pts, (p) => p[1])) / 2], k: span > 120 ? 1.4 : span > 60 ? 2 : span > 25 ? 3 : span > 8 ? 4.5 : 7 };
  }

  // ---------- Cards ----------
  const IDS = { cab: ["cabCard", "cabBtn"], whs: ["whsCard", "whsBtn"], min: ["minCard", "minBtn"] };
  function order(which) {
    if (which === "cab") return cabShown().slice().sort((a, b) => (a.year || 9999) - (b.year || 9999)).map((c) => c.i);
    if (which === "whs") return whsShown().map((s) => s.i);  // already west to east
    return MIN[P.min.m][3].map((x) => x[0]);
  }
  function go(which, i) {
    const S = P[which]; S.pick = i;
    if (which === "cab") { const m = cabMid(CB.cables[i]); zoomTo(m.at, m.k); }
    else if (which === "whs") { const s = WH[i]; zoomTo([s.lon, s.lat], 5); }
    else W.zoomToCountry?.(i);
    card(which);
  }
  function card(which) {
    const S = P[which], [id, btn] = IDS[which];
    let el = $("#" + id);
    if (!el) { el = document.createElement("div"); el.id = id; el.className = "card livecard affcard"; $("#mapstage").appendChild(el); }
    el.hidden = !S.on || W.state.view !== "map" || (which === "cab" && !CB) || (which === "whs" && !WH);
    $("#" + btn)?.setAttribute("aria-pressed", String(S.on));
    if (el.hidden) { draw(); return; }
    let head, body, src;
    const ord = order(which), back = (t) => `<button type="button" class="linkbtn" data-back>${t}</button>`;
    if (which === "cab") {
      head = "〰️ Undersea cables";
      const c = S.pick != null ? CB.cables[S.pick] : null;
      const key = `<p class="cyc-key"><span><i style="background:#0f8a9a"></i>In service</span><span><i class="dash"></i>Planned</span><span><i style="background:#c2410c"></i>Part-owned by Google, Meta, Amazon or Microsoft</span></p>`;
      if (c) {
        const i = ord.indexOf(c.i);
        body = `${i >= 0 ? nav(i, ord.length, "Older", "Newer") : ""}<div class="aff-one"><h4>${esc(c.name)}</h4>
          <p class="aff-who">${c.planned ? `<span class="cs-tag" style="--cs:#e08b00">Planned${c.year ? `, ${c.year}` : ""}</span>` : `<span class="cs-tag" style="--cs:#0f8a9a">In service since ${c.year}</span>`}</p>
          <ul class="cs-facts">${c.len ? `<li>About ${d3.format(",")(c.len)} km long</li>` : ""}<li>Lands in: ${esc(c.countries.replace(/;/g, ","))}</li><li>Owned by: ${esc(c.owners.replace(/;/g, ",") || "not known")}</li>
          ${c.big ? `<li>Part-owned by <b>${esc(c.big.replace(/;/g, ","))}</b></li>` : ""}</ul>
          <p class="aff-links"><a href="${wiki(c.name + " submarine cable")}" target="_blank" rel="noopener">Read more ↗</a> · ${back("All cables")}</p></div>`;
      } else {
        const n = cabShown().length, inS = CB.cables.filter((x) => !x.planned).length;
        const hubs = CB.chokepoints.slice().sort((a, b) => b.n - a.n).slice(0, 8);
        body = `<p class="hint">About 99% of the data that crosses oceans, from video calls to bank payments, travels through about ${inS} cables on the sea floor, each about as thick as a garden hose. Click a cable for who owns it.</p>
          ${chips([["all", "All"], ["new", "Since 2020"], ["planned", "Planned"], ["big", "Big tech", "#c2410c"]], S.show, "show")}${key}
          <p class="cyc-n"><b>${n}</b> cables shown.</p>
          <p class="cur-cs">Where cables crowd together</p><ul class="aff-list">${hubs.map((h) => `<li><span class="ch-dot">!</span>${esc(h.name)} <small>${h.n} cables${h.np ? `, ${h.np} planned` : ""}</small></li>`).join("")}</ul>
          <p class="hint">Cables are sometimes cut by ships' anchors, earthquakes and, some fear, on purpose: cuts in the Red Sea in 2024 and the Baltic Sea in 2023–25 slowed the internet for millions. Google, Meta, Amazon and Microsoft now part-own about half the length of new cables.</p>
          <p class="aff-links"><button type="button" class="ghost cs-go" data-q="${(() => { const f = W.F.cables_intl; return f ? `f=cables_intl:${f.dmin}~${f.dmax}&c=cables_intl` : ""; })()}">Colour countries by number of cables</button></p>`;
      }
      src = "Cables: TeleGeography Submarine Cable Map (2026), CC BY-NC-SA 3.0, cleaned and counted by T. Hotham (2026), The internet's seabed. Routes are drawn roughly, not exactly.";
    } else if (which === "whs") {
      head = "🏛️ World Heritage Sites";
      const s = S.pick != null ? WH[S.pick] : null;
      if (s) {
        const i = ord.indexOf(s.i);
        body = `${i >= 0 ? nav(i, ord.length, "West", "East") : ""}<div class="aff-one"><h4>${esc(s.name)}</h4>
          <p class="aff-who"><span class="cs-tag" style="--cs:${WCOL[s.cat]}">${WNAME[s.cat]}</span></p>
          <ul class="cs-facts"><li>${s.cs.length ? s.cs.map((c) => `${cflag(c)} ${esc(cname(c))}`).join(", ") : "Jerusalem (proposed by Jordan)"}</li><li>On the list since ${s.year}</li></ul>
          <p class="aff-links"><a href="https://whc.unesco.org/en/list/${s.id}" target="_blank" rel="noopener">UNESCO page ↗</a> · <a href="${wiki(s.name)}" target="_blank" rel="noopener">Wikipedia ↗</a> · ${back("All sites")}</p></div>`;
      } else {
        const list = whsShown(), cnt = d3.rollups(list.flatMap((x) => x.cs), (v) => v.length, (c) => c).sort((a, b) => b[1] - a[1]).slice(0, 6);
        const show = S.q ? list.slice(0, 60) : [];
        body = `<p class="hint">Places UNESCO judges to be of “outstanding universal value” to humanity: cultural (built by people), natural, or both. Countries nominate them; being listed brings tourists and money, but can bring crowds too.</p>
          ${chips([["", "All"], ["c", "Cultural", WCOL.c], ["n", "Natural", WCOL.n], ["m", "Mixed", WCOL.m]], S.cat, "cat")}
          <input type="search" class="wh-q" placeholder="Find a site or country" value="${esc(S.q)}" aria-label="Find a World Heritage Site">
          <p class="cyc-n"><b>${list.length}</b> sites shown. Most: ${cnt.map(([c, n]) => `${cflag(c)} ${esc(cname(c))} ${n}`).join(", ")}.</p>
          ${show.length ? `<ul class="aff-list">${show.map((x) => `<li><span class="cf-dot" style="--cf:${WCOL[x.cat]}"></span><button type="button" class="linkbtn" data-c="${x.i}">${esc(x.name)}</button> <small>${esc(x.cs.map(cname).join(", "))}</small></li>`).join("")}</ul>` : `<p class="hint">Click a dot, or search for a list.</p>`}
          <p class="aff-links"><button type="button" class="ghost cs-go" data-q="${(() => { const f = W.F.world_heritage_sites; return f ? `f=world_heritage_sites:${f.dmin}~${f.dmax}&c=world_heritage_sites` : ""; })()}">Colour countries by number of sites</button></p>`;
      }
      src = "UNESCO World Heritage Centre, the World Heritage List (1,273 sites, as of August 2026). Sites in several countries are shown at one point.";
    } else {
      head = "⛏️ Critical minerals";
      const M = MIN[S.m];
      const tabs = chips(Object.entries(MIN).map(([k, m]) => [k, `${m[1]} ${m[0]}`]), S.m, "m");
      const r = S.pick ? M[3].find((x) => x[0] === S.pick) : null;
      body = `<p class="hint">The switch to clean energy needs huge amounts of a few minerals, and a handful of countries mine most of them. Pick a mineral; darker = a bigger share of world mining.</p>${tabs}
        <div class="aff-one"><h4>${M[1]} ${M[0]}</h4><p><b>Used for:</b> ${esc(M[2])}</p>
        <ul class="mn-list">${M[3].map(([c, v]) => `<li class="${S.pick === c ? "on" : ""}"><button type="button" class="linkbtn" data-c="${c}">${cflag(c)} ${esc(cname(c))}</button><span class="mn-bar"><i style="width:${v}%"></i></span><small>${v}%</small></li>`).join("")}</ul>
        <p>${esc(M[4])}</p>${r ? "" : ""}
        <p class="aff-links"><a href="${wiki(M[0] + " mining")}" target="_blank" rel="noopener">Read more ↗</a></p></div>`;
      src = "Shares of world mine production in 2025 (estimates), rounded: US Geological Survey, Mineral Commodity Summaries 2026 (checked November 2026). Refining shares: International Energy Agency.";
    }
    el.innerHTML = `<div class="dsc-head"><h3>${head}</h3><button type="button" class="iconbtn" data-x aria-label="Close">×</button></div>${body}<p class="hint aff-src">${src}</p>`;
    el.querySelector("[data-x]").onclick = () => toggle(which, false);
    el.querySelectorAll("[data-back]").forEach((b) => (b.onclick = () => { S.pick = null; card(which); }));
    el.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => go(which, which === "min" ? b.dataset.c : +b.dataset.c)));
    el.querySelectorAll("[data-show]").forEach((b) => (b.onclick = () => { S.show = b.dataset.show; S.pick = null; card(which); }));
    el.querySelectorAll("[data-cat]").forEach((b) => (b.onclick = () => { S.cat = b.dataset.cat; card(which); }));
    el.querySelectorAll("[data-m]").forEach((b) => (b.onclick = () => { S.m = b.dataset.m; S.pick = null; card(which); }));
    const q = el.querySelector(".wh-q");
    if (q) { let t; q.oninput = () => { clearTimeout(t); t = setTimeout(() => { S.q = q.value.trim(); card(which); const q2 = el.querySelector(".wh-q"); q2?.focus(); q2?.setSelectionRange(q2.value.length, q2.value.length); }, 300); }; }
    el.querySelectorAll(".cs-go").forEach((b) => (b.onclick = () => W.applyQS(b.dataset.q)));
    el.querySelectorAll("[data-step]").forEach((b) => (b.onclick = () => { const o = order(which), j = o.indexOf(S.pick) + +b.dataset.step; if (o[j] != null) go(which, o[j]); }));
    draw();
  }
  async function toggle(which, on) {
    const S = P[which];
    S.on = on ?? !S.on;
    if (S.on) await load(which);
    if (S.on && ((which === "cab" && !CB) || (which === "whs" && !WH))) S.on = false;
    card(which);
  }
  function init() {
    W = window.WC;
    let box = $("#mapbtns");
    if (!box) { box = document.createElement("div"); box.id = "mapbtns"; box.className = "mapbtns"; $("#mapstage").appendChild(box); }
    [["cab", "cabBtn", "〰️ Undersea cables"], ["whs", "whsBtn", "🏛️ World Heritage Sites"], ["min", "minBtn", "⛏️ Critical minerals"]].forEach(([k, id, t]) => {
      const b = document.createElement("button");
      b.type = "button"; b.id = id; b.className = "mmbtn"; b.setAttribute("aria-pressed", "false"); b.textContent = t;
      b.onclick = () => toggle(k);
      box.appendChild(b);
    });
  }
  window.WGL = { init, draw: () => draw(), zoomed, refresh: () => { Object.keys(P).forEach((k) => { if (P[k].on) card(k); }); }, toggle, _P: P };
})();
