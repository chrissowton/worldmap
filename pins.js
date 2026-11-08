/* Pins on the map (v64):
   - Case studies: about 30 GCSE and A-level case studies, each with key facts and links (casestudies.json)
   - Shipping: the main shipping lanes, the chokepoints ships must pass through, and the busiest ports (shipping.json, lanes.json) */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let W, CS = null, SH = null, LN = null, loading = {};
  const P = { cs: { on: false, pick: null, topic: "" }, ship: { on: false, pick: null } };
  const TCOL = { tect: "#c0392b", weather: "#2f7fd1", cities: "#7b55c7", eco: "#2e9d55", dev: "#d9822b", uk: "#0d5f70" };
  const get = (url, pre) => (window[pre] ? Promise.resolve(window[pre]) : fetch(url + "?v=64").then((r) => r.json()));
  function load(kind) {
    if (kind === "cs") return (loading.cs ||= get("casestudies.json", "__CASESTUDIES__").then((j) => (CS = j)).catch(() => null));
    return (loading.ship ||= Promise.all([get("shipping.json", "__SHIPPING__"), get("lanes.json", "__LANES__")])
      .then(([s, l]) => { SH = s; LN = topojson.feature(l, l.objects.lanes).features; }).catch(() => null));
  }
  const byLon = (arr) => arr.map((x, i) => [x, i]).sort((a, b) => a[0].at[0] - b[0].at[0]).map(([, i]) => i);
  function zoomTo(at, k) {
    const card = $("#mapcards"), stage = $("#mapstage");
    const shift = card && stage ? Math.min(card.getBoundingClientRect().width / 2, stage.clientWidth / 4) : 0;
    W.zoomToPoint(at[0], at[1], k);
    if (shift) setTimeout(() => W.panBy?.(shift, 0), 650);
  }
  const nav = (i, n, a, b) => `<div class="aff-nav"><button type="button" class="ghost" data-step="-1" ${i <= 0 ? "disabled" : ""}>◀ ${a}</button><span>${i + 1} of ${n}</span><button type="button" class="ghost" data-step="1" ${i >= n - 1 ? "disabled" : ""}>${b} ▶</button></div>`;

  // ---------- Drawing ----------
  let laneFor = "";
  function draw() {
    if (!W) return;
    const map = W.state.view === "map", k = W.k || 1;
    {
      const g = W.layer("shipping");
      const show = P.ship.on && SH && map;
      g.style("display", show ? null : "none");
      if (show) {
        const sig = `${W.state.mode}|${$("#map")?.getAttribute("viewBox")}`;
        if (laneFor !== sig) {
          laneFor = sig;
          g.selectAll("path.lane").data(LN).join("path").attr("class", (f) => "lane lane-" + String(f.properties.Type).toLowerCase()).attr("d", W.geoPath()).attr("vector-effect", "non-scaling-stroke");
        }
        const ports = SH.ports.map(([n, iso, lon, lat, t], i) => ({ n, iso, t, i, xy: W.project(lon, lat) })).filter((p) => p.xy);
        g.selectAll("g.port").data(ports, (p) => p.i).join((en) => { const gg = en.append("g").attr("class", "port"); gg.append("rect"); return gg; })
          .attr("transform", (p) => `translate(${p.xy[0]},${p.xy[1]}) scale(${1 / k})`)
          .attr("data-base", (p) => `⚓ ${p.n}, ${W.byIso.get(p.iso)?.name || p.iso}${p.t ? ` · ${p.t}` : " · one of the world's busiest container ports"}`);
        g.selectAll("g.port rect").attr("x", -4).attr("y", -4).attr("width", 8).attr("height", 8).attr("transform", "rotate(45)").attr("data-base", function () { return this.parentNode.getAttribute("data-base"); });
        const cps = SH.chokepoints.map((c, i) => ({ c, i, xy: W.project(c.at[0], c.at[1]) })).filter((p) => p.xy);
        g.selectAll("g.choke").data(cps, (p) => p.i).join((en) => { const gg = en.append("g").attr("class", "choke"); gg.append("circle"); gg.append("text").text("!"); return gg; })
          .attr("transform", (p) => `translate(${p.xy[0]},${p.xy[1]}) scale(${1 / k})`).classed("on", (p) => P.ship.pick === p.i)
          .on("click", (ev, p) => { ev.stopPropagation(); P.ship.pick = p.i; card("ship"); });
        g.selectAll("g.choke circle").attr("r", 8).attr("data-base", function () { const p = d3.select(this.parentNode).datum(); return `${p.c.name} · a chokepoint (click for more)`; });
        g.raise();
      }
    }
    {
      const g = W.layer("casestudies");
      const show = P.cs.on && CS && map;
      g.style("display", show ? null : "none");
      if (show) {
        const pts = CS.items.map((c, i) => ({ c, i, xy: W.project(c.at[0], c.at[1]) })).filter((p) => p.xy && (!P.cs.topic || p.c.topic === P.cs.topic));
        g.selectAll("g.csp").data(pts, (p) => p.i).join((en) => { const gg = en.append("g").attr("class", "csp"); gg.append("path").attr("d", "M0,0 C-7,-9 -9,-13 -9,-17 A9,9 0 1 1 9,-17 C9,-13 7,-9 0,0Z"); gg.append("circle").attr("cy", -17).attr("r", 3.6); return gg; })
          .attr("transform", (p) => `translate(${p.xy[0]},${p.xy[1]}) scale(${1 / k})`).style("--cs", (p) => TCOL[p.c.topic]).classed("on", (p) => P.cs.pick === p.i)
          .on("click", (ev, p) => { ev.stopPropagation(); P.cs.pick = p.i; card("cs"); });
        g.selectAll("g.csp path, g.csp circle").attr("data-base", function () { const p = d3.select(this.parentNode).datum(); return `📍 ${p.c.name}${p.c.date ? `, ${p.c.date}` : ""} · ${CS.topics[p.c.topic]}`; });
        g.raise();
      }
    }
  }
  function zoomed() {
    if (!W) return;
    const k = W.k || 1;
    ["g.port", "g.choke"].forEach((s) => W.layer("shipping").selectAll(s).attr("transform", (p) => (p?.xy ? `translate(${p.xy[0]},${p.xy[1]}) scale(${1 / k})` : null)));
    W.layer("casestudies").selectAll("g.csp").attr("transform", (p) => (p?.xy ? `translate(${p.xy[0]},${p.xy[1]}) scale(${1 / k})` : null));
  }

  // ---------- Cards ----------
  function card(kind) {
    const S = P[kind], id = kind === "cs" ? "csCard" : "shipCard";
    let el = $("#" + id);
    if (!el) { el = document.createElement("div"); el.id = id; el.className = "card livecard affcard"; $("#mapstage").appendChild(el); }
    const data = kind === "cs" ? CS : SH;
    el.hidden = !S.on || W.state.view !== "map" || !data;
    $(kind === "cs" ? "#csBtn" : "#shipBtn")?.setAttribute("aria-pressed", String(S.on));
    if (el.hidden) { draw(); return; }
    let head, body, src;
    if (kind === "cs") {
      head = "📍 Case studies";
      const list = CS.items.map((c, i) => [c, i]).filter(([c]) => !P.cs.topic || c.topic === P.cs.topic).map(([, i]) => i);
      const c = CS.items[S.pick];
      body = c ? `${nav(list.indexOf(S.pick), list.length, "Previous", "Next")}<div class="aff-one"><h4>${esc(c.name)}</h4>
          <p class="aff-who"><span class="cs-tag" style="--cs:${TCOL[c.topic]}">${esc(CS.topics[c.topic])}</span> ${esc(c.date || "")}</p>
          <ul class="cs-facts">${c.facts.map((f) => `<li>${esc(f)}</li>`).join("")}</ul><p>${esc(c.text)}</p>
          <p class="aff-links">${c.links.map(([l, q]) => `<button type="button" class="ghost cs-go" data-q="${esc(q)}">${esc(l)}</button>`).join(" ")}</p>
          <p class="aff-links"><a href="https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(c.name)}" target="_blank" rel="noopener">Read more ↗</a> · <button type="button" class="linkbtn" data-back>All case studies</button></p></div>`
        : `<p class="hint">Case studies from GCSE and A-level geography, with key facts. Click a pin, or one below.</p>
          <div class="cs-topics"><button type="button" class="cs-t ${!P.cs.topic ? "on" : ""}" data-t="">All</button>${Object.entries(CS.topics).map(([k, l]) => `<button type="button" class="cs-t ${P.cs.topic === k ? "on" : ""}" data-t="${k}" style="--cs:${TCOL[k]}">${esc(l)}</button>`).join("")}</div>
          <ul class="aff-list">${list.map((i) => { const x = CS.items[i]; return `<li><span class="cf-dot" style="--cf:${TCOL[x.topic]}"></span><button type="button" class="linkbtn" data-c="${i}">${esc(x.name)}</button> <small>${esc(x.date || "")}</small></li>`; }).join("")}</ul>`;
      src = esc(CS.notes);
    } else {
      head = "🚢 Shipping lanes and chokepoints";
      const order = byLon(SH.chokepoints), c = SH.chokepoints[S.pick];
      body = c ? `${nav(order.indexOf(S.pick), order.length, "West", "East")}<div class="aff-one"><h4>${esc(c.name)}</h4><p>${esc(c.text)}</p>
          <p class="aff-links"><a href="https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(c.name)}" target="_blank" rel="noopener">Read more ↗</a> · <button type="button" class="linkbtn" data-back>All chokepoints</button></p></div>`
        : `<p class="hint">About 80% of the world's trade goes by sea. Lines: the main shipping lanes (thicker = busier). <b>!</b> Chokepoints: narrow straits and canals that much of the world's trade must pass through. ◆ The busiest container ports.</p>
          <p class="aff-key"><span class="ln-sw major"></span>Major lane <span class="ln-sw middle"></span>Busy <span class="ln-sw minor"></span>Other</p>
          <ul class="aff-list">${order.map((i) => `<li><span class="ch-dot">!</span><button type="button" class="linkbtn" data-c="${i}">${esc(SH.chokepoints[i].name)}</button></li>`).join("")}</ul>`;
      src = "Shipping lanes: Benden (2022), Global Shipping Lanes, CC BY 4.0. Chokepoints and ports: written for this site, checked November 2026; figures are approximate.";
    }
    el.innerHTML = `<div class="dsc-head"><h3>${head}</h3><button type="button" class="iconbtn" data-x aria-label="Close">×</button></div>${body}<p class="hint aff-src">${src}</p>`;
    el.querySelector("[data-x]").onclick = () => toggle(kind, false);
    el.querySelectorAll("[data-back]").forEach((b) => (b.onclick = () => { S.pick = null; card(kind); }));
    const items = kind === "cs" ? CS.items : SH.chokepoints;
    el.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => { S.pick = +b.dataset.c; zoomTo(items[S.pick].at, kind === "cs" ? 4 : 3.5); card(kind); }));
    el.querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => { P.cs.topic = b.dataset.t; card(kind); }));
    el.querySelectorAll(".cs-go").forEach((b) => (b.onclick = () => W.applyQS(b.dataset.q)));
    el.querySelectorAll("[data-step]").forEach((b) => (b.onclick = () => {
      const order = kind === "cs" ? CS.items.map((c, i) => [c, i]).filter(([c]) => !P.cs.topic || c.topic === P.cs.topic).map(([, i]) => i) : byLon(SH.chokepoints);
      S.pick = order[order.indexOf(S.pick) + +b.dataset.step];
      zoomTo(items[S.pick].at, kind === "cs" ? 4 : 3.5); card(kind);
    }));
    draw();
  }
  async function toggle(kind, on) {
    const S = P[kind];
    S.on = on ?? !S.on;
    if (S.on) await load(kind);
    if (S.on && !(kind === "cs" ? CS : SH)) S.on = false;
    card(kind);
  }
  function init() {
    W = window.WC;
    let box = $("#mapbtns");
    if (!box) { box = document.createElement("div"); box.id = "mapbtns"; box.className = "mapbtns"; $("#mapstage").appendChild(box); }
    [["cs", "csBtn", "📍 Case studies"], ["ship", "shipBtn", "🚢 Shipping and chokepoints"]].forEach(([k, id, t]) => {
      const b = document.createElement("button");
      b.type = "button"; b.id = id; b.className = "mmbtn"; b.setAttribute("aria-pressed", "false"); b.textContent = t;
      b.onclick = () => toggle(k);
      box.appendChild(b);
    });
  }
  window.WPN = { init, draw: () => draw(), zoomed, refresh: () => { ["cs", "ship"].forEach((k) => { if (P[k].on) card(k); }); }, toggle, _P: P };
})();
