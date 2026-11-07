/* Layout helpers (v50):
   - every pop-up box can be resized (drag its bottom-right corner) and made full screen (⛶ in its title bar)
   - the map's buttons (live hazards, climate, city growth, map style) and the boxes they open sit together in the bottom-left corner (the South Pacific)
   - the two side columns can be closed with the arrows on their edges, to give the map or chart more room
   - charts and other views have a full-screen button ([data-fs]) */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  let W;
  const rerender = () => setTimeout(() => { window.dispatchEvent(new Event("resize")); W?.render(); }, 30);

  // ---------- Full screen for any box ----------
  function setFS(el, on) {
    el.classList.toggle("is-fs", on);
    document.body.classList.toggle("has-fs", !!document.querySelector(".is-fs"));
    el.querySelectorAll(".fsbtn").forEach((b) => { b.textContent = on ? "🗗" : "⛶"; b.title = on ? "Leave full screen (Esc)" : "Full screen"; b.setAttribute("aria-pressed", String(on)); });
    if (el.matches("[data-fs-target], #viewwrap")) document.querySelectorAll(`[data-fs="#${el.id}"]`).forEach((b) => { b.textContent = on ? "🗗" : "⛶"; b.title = on ? "Leave full screen (Esc)" : "Full screen (Esc to leave)"; });
    rerender();
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-fs]");
    if (b) { const el = $(b.dataset.fs); if (el) setFS(el, !el.classList.contains("is-fs")); return; }
    const f = e.target.closest?.(".fsbtn");
    if (f) { const el = f.closest(POPUPS); if (el) setFS(el, !el.classList.contains("is-fs")); }
  });
  // the window clicked last comes to the front
  let topZ = 70;
  document.addEventListener("pointerdown", (e) => {
    const box = e.target.closest?.(".dsc, #factfile, #sbs, #numhunt");
    if (box && !box.classList.contains("is-fs")) box.style.zIndex = String(++topZ > 89 ? (topZ = 71) : topZ);
  }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { const el = [...document.querySelectorAll(".is-fs")].pop(); if (el) { setFS(el, false); e.stopPropagation(); } } }, true);

  // ---------- Pop-ups: resizable, with a full-screen button ----------
  const POPUPS = ".dsc, .livecard, #starter, #mmCard, #factfile, #sbs, #numhunt";
  const HEADS = ".dsc-head, .mmhead, .qz-head, .ff-bar, .nh-bar";
  function enhance() {
    document.querySelectorAll(POPUPS).forEach((box) => {
      box.classList.add("rsz");
      const head = box.querySelector(HEADS);
      if (!head || head.querySelector(".fsbtn")) return;
      const b = document.createElement("button");
      b.type = "button"; b.className = "iconbtn fsbtn"; b.textContent = box.classList.contains("is-fs") ? "🗗" : "⛶";
      b.title = box.classList.contains("is-fs") ? "Leave full screen (Esc)" : "Full screen"; b.setAttribute("aria-label", "Full screen");
      const close = head.querySelector(".iconbtn:not(.fsbtn), .hide");
      if (close && close.parentElement === head) head.insertBefore(b, close); else head.appendChild(b);
    });
  }

  // ---------- Buttons and boxes on the map: all together in the bottom-left corner ----------
  // (on a laptop or bigger; on a phone they stay where they were, at the top)
  const MAPBOXES = ["#liveCard", "#cgCard", "#climCard", "#rgCard", "#dispCard", "#confCard", "#elecCard"];
  const wide = window.matchMedia("(min-width: 761px)");
  function stack() {
    const stage = $("#mapstage");
    if (!stage) return;
    let dock = $("#mapdock");
    if (!dock) { dock = document.createElement("div"); dock.id = "mapdock"; dock.className = "mapdock"; stage.appendChild(dock); }
    let box = $("#mapcards");
    if (!box) { box = document.createElement("div"); box.id = "mapcards"; box.className = "mapcards"; }
    if (box.parentElement !== dock) dock.prepend(box);
    MAPBOXES.forEach((sel) => { const el = $(sel); if (el && el.parentElement !== box && !el.classList.contains("is-fs")) box.appendChild(el); });
    const btns = $("#mapbtns"), mm = $("#mmBtn"), mmCard = $("#mmCard");
    // the colour key and the note about unusual years sit in the dock too, just above the buttons
    const leg = $("#legend"), sig = $("#mapsig");
    if (wide.matches) {
      if (leg && leg.parentElement !== dock) { leg.classList.add("card", "dockkey"); dock.insertBefore(leg, btns && btns.parentElement === dock ? btns : null); }
      if (sig && sig.parentElement !== dock) dock.insertBefore(sig, leg && leg.parentElement === dock ? leg.nextSibling : null);
      if (btns && btns.parentElement === dock && leg && leg.parentElement === dock && leg.nextSibling !== sig && sig) dock.insertBefore(sig, btns);
    } else {
      const foot = $("#mapfoot");
      if (leg && foot && leg.parentElement !== foot) { leg.classList.remove("card", "dockkey"); foot.prepend(leg); }
    }
    if (wide.matches) {
      if (btns && btns.parentElement !== dock) dock.appendChild(btns);
      if (btns && mm && mm.parentElement !== btns) btns.appendChild(mm);
      if (mmCard && mmCard.parentElement !== box && !mmCard.classList.contains("is-fs")) box.prepend(mmCard);
    } else {
      // a phone: the buttons go back to the top of the map
      if (btns && btns.parentElement !== stage) stage.appendChild(btns);
      if (mm && mm.parentElement !== stage) stage.insertBefore(mm, $(".zoom"));
      if (mmCard && mmCard.parentElement !== stage) stage.insertBefore(mmCard, $(".zoom"));
    }
  }
  wide.addEventListener?.("change", () => stack());

  // ---------- "More on the map": the extra layers in one menu, grouped ----------
  // Map style stays as its own button; the layers go in a menu that opens above the button (always on screen),
  // with a line about each and a fuller explanation on hover. The button says how many are switched on.
  const LAYERS = [
    ["People and places", [
      ["#rgBtn", "Regions within countries", "Human development, life expectancy, schooling and income for 1,800 regions, for women and men.", "Colours about 1,800 regions in 188 countries (Global Data Lab). See the richest and poorest regions in the world, the countries with the biggest gaps between regions, and the HDI of any region since 1990."],
      ["#cgBtn", "City growth", "How the world's cities have grown since 1975, with UN projections to 2050.", "About 2,600 cities as circles sized by population, coloured by how fast they grew. Play it to watch megacities appear, and see the fastest-growing cities (UN World Urbanization Prospects 2025)."]]],
    ["World affairs", [
      ["#confBtn", "Current conflicts", "Wars and crises around the world, and whether each is getting worse.", "The 27 conflicts followed by the Council on Foreign Relations' Global Conflict Tracker, with a short explainer for each. Red: worsening; orange: unchanging; purple: developing; green: improving."],
      ["#dispBtn", "Disputed borders and territories", "Kashmir, Western Sahara, Taiwan, Crimea and other places where the border or ruler is disputed.", "Striped areas and markers show 24 disputes, each with a short, neutral explainer of who claims what and why. Borders on the main map are de facto (who controls the land), not a judgement on who is right."],
      ["#elecBtn", "Elections", "National elections coming up in the next year, and those in the last 12 months.", "Countries with a national election coming up are shaded blue, those that held one in the last year green. Click a country for the date and type of election, with a link for candidates and results."]]],
    ["Planet", [
      ["#climBtn", "Climate graphs", "Climate graphs for thousands of weather stations (1991–2020 averages).", "Click a weather station for its climate graph: average temperature and rainfall for each month, its Köppen climate zone, and a comparison with another station."],
      ["#liveBtn", "Live hazards", "This week's earthquakes, storms, floods and eruptions.", "Earthquakes from the US Geological Survey (the last 7 days) and current disaster alerts (GDACS), updated each time you open it."]]],
  ];
  const IDS = LAYERS.flatMap(([, it]) => it.map((x) => x[0]));
  function layersMenu() {
    const btns = $("#mapbtns");
    if (!btns || !$("#climBtn") || !$("#liveBtn")) return;
    let lb = $("#layersBtn"), menu = $("#layersMenu");
    if (!lb) {
      lb = document.createElement("button"); lb.type = "button"; lb.id = "layersBtn"; lb.className = "mmbtn layersbtn"; lb.setAttribute("aria-haspopup", "true"); lb.setAttribute("aria-expanded", "false");
      menu = document.createElement("div"); menu.id = "layersMenu"; menu.className = "card layersmenu"; menu.hidden = true; menu.setAttribute("role", "menu");
      const close = () => { menu.hidden = true; lb.setAttribute("aria-expanded", "false"); };
      lb.onclick = (e) => { e.stopPropagation(); if (menu.hidden) { menu.hidden = false; lb.setAttribute("aria-expanded", "true"); fillMenu(); placeMenu(); } else close(); };
      document.addEventListener("click", (e) => { if (!menu.hidden && !menu.contains(e.target) && e.target !== lb) close(); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) close(); });
      window.addEventListener("resize", () => { if (!menu.hidden) placeMenu(); });
      // a click on a layer switches it on or off; the menu closes so the map can be seen
      menu.addEventListener("click", (e) => { if (e.target.closest(".lm-row button")) setTimeout(close, 120); });
      btns.appendChild(lb);
      document.body.appendChild(menu);   // on the page itself, so it is never cut off by the map
    }
    const phys = W?.state?.mode === "physical";
    const groups = phys ? [LAYERS[2], LAYERS[1], LAYERS[0]] : LAYERS;
    if (menu.dataset.mode !== (phys ? "p" : "h")) {
      menu.dataset.mode = phys ? "p" : "h";
      menu.innerHTML = `<p class="lm-top">Add to the map <small>Hover over any of these for more</small></p>` + groups.map(([g, items]) => `<p class="lm-h">${g}</p>${items.map(([sel, , d, more]) => `<div class="lm-row" data-sel="${sel}" title="${more.replace(/"/g, "&quot;")}"><small>${d}</small></div>`).join("")}`).join("") +
        `<p class="lm-h">Map style</p><div class="lm-row" title="${phys ? "Change what the background shows: landforms (the big shapes of the land), biomes, Köppen climate zones or tectonic plates, and which features are drawn: rivers, lakes, volcanoes, earthquakes and more." : "Colour the map by your filters (the default), by change over time between two years, or by two measures at once; or draw countries as circles sized by population."}"><button type="button" class="mmbtn" id="lmStyle">🎨 Map style</button><small>${phys ? "Background (landforms, biomes, climate zones, plates) and features: rivers, volcanoes…" : "Colour by your filters, by change over time, or by two measures at once."}</small></div>`;
      menu.querySelector("#lmStyle").onclick = () => { setTimeout(() => $("#mmBtn")?.click(), 150); };
    }
    menu.querySelectorAll(".lm-row[data-sel]").forEach((row) => { const b = $(row.dataset.sel); if (b && b.parentElement !== row) { row.prepend(b); b.title = row.title; } });
    // keep Map style first, then the menu button
    const mm = $("#mmBtn");
    if (mm && mm.parentElement === btns && btns.firstElementChild !== mm) btns.prepend(mm);
    if (lb.previousElementSibling !== mm && mm?.parentElement === btns) mm.after(lb);
    fillMenu();
  }
  // open above the button if there is room, otherwise below; never off the screen
  function placeMenu() {
    const lb = $("#layersBtn"), menu = $("#layersMenu");
    if (!lb || !menu || menu.hidden) return;
    const r = lb.getBoundingClientRect(), vh = window.innerHeight, vw = window.innerWidth;
    const w = Math.min(400, vw - 16);
    menu.style.width = w + "px";
    menu.style.left = Math.max(8, Math.min(r.left, vw - w - 8)) + "px";
    const above = r.top - 16, below = vh - r.bottom - 16;
    if (above >= below) { menu.style.top = ""; menu.style.bottom = (vh - r.top + 8) + "px"; menu.style.maxHeight = above + "px"; }
    else { menu.style.bottom = ""; menu.style.top = (r.bottom + 8) + "px"; menu.style.maxHeight = below + "px"; }
  }
  function fillMenu() {
    const lb = $("#layersBtn"); if (!lb) return;
    const on = IDS.map((s) => $(s)).filter((b) => b?.getAttribute("aria-pressed") === "true");
    const txt = `🗂️ More on the map${on.length ? ` (${on.length} on)` : ""} ▾`;
    if (lb.textContent !== txt) lb.textContent = txt;
    lb.classList.toggle("on", on.length > 0);
    lb.title = on.length ? `Showing: ${on.map((b) => b.textContent.replace(/^\W+\s*/, "")).join(", ")}` : "Regions, city growth, conflicts, disputed borders, elections, climate graphs and live hazards";
  }

  // ---------- Closing the side columns ----------
  let cpOff = !!store.get("wc-cp-off", false), resOff = !!store.get("wc-res-off", false);
  function sides() {
    document.body.classList.toggle("cp-off", cpOff);
    document.body.classList.toggle("res-off", resOff);
    const a = $("#cpToggle"), b = $("#resToggle");
    if (a) { a.innerHTML = cpOff ? "<span>›</span><small>Panel</small>" : "<span>‹</span>"; a.title = cpOff ? "Show the control panel" : "Hide the control panel (more room for the map)"; a.setAttribute("aria-expanded", String(!cpOff)); }
    if (b) { b.innerHTML = resOff ? "<span>‹</span><small>Detailed data view</small>" : "<span>›</span>"; b.title = resOff ? "Show the detailed data: every country's figures, in a list you can sort" : "Hide the detailed data view (more room for the map)"; b.setAttribute("aria-expanded", String(!resOff)); }
    placeToggles();
  }
  function placeToggles() {
    const b = $("#resToggle"), res = $("#results");
    if (b && res) b.style.right = (resOff ? 0 : res.offsetWidth) + "px";
  }
  function makeToggles() {
    const content = $(".content"), main = $(".main");
    if (content && !$("#cpToggle")) {
      const a = document.createElement("button"); a.type = "button"; a.id = "cpToggle"; a.className = "sidetoggle left";
      a.onclick = () => { cpOff = !cpOff; store.set("wc-cp-off", cpOff); sides(); rerender(); };
      content.appendChild(a);
    }
    if (main && !$("#resToggle")) {
      const b = document.createElement("button"); b.type = "button"; b.id = "resToggle"; b.className = "sidetoggle right";
      b.onclick = () => { resOff = !resOff; store.set("wc-res-off", resOff); sides(); rerender(); };
      main.appendChild(b);
    }
    sides();
  }

  // a Download button on the map too, under the zoom buttons
  function mapDownload() {
    const z = $(".zoom");
    if (!z || $("#mapDl")) return;
    const b = document.createElement("button");
    b.type = "button"; b.id = "mapDl"; b.textContent = "⬇"; b.title = "Download this map as a picture, or its data as a spreadsheet"; b.setAttribute("aria-label", "Download");
    b.onclick = (e) => { e.stopPropagation(); window.WV?.openDownloadMenu(b); };
    z.appendChild(b);
  }

  let queued = false;
  const tick = () => { queued = false; enhance(); stack(); layersMenu(); placeToggles(); };
  function init() {
    W = window.WC;
    makeToggles();
    mapDownload();
    tick();
    new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(tick); } }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-pressed"] });
    window.addEventListener("resize", placeToggles);
  }
  window.WLY = { init, setFS };
})();
