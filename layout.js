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
  const MAPBOXES = ["#liveCard", "#cgCard", "#climCard", "#rgCard", "#dispCard", "#confCard", "#elecCard", "#csCard", "#shipCard", "#cycCard", "#protCard", "#pmCard", "#curCard", "#nightCard", "#forestCard", "#cabCard", "#whsCard", "#minCard", "#briCard", "#waterCard", "#firesCard", "#iceCard", "#colCard"];
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

  // ---------- When two or more boxes are open on the map, they become tabs: one shown at a time ----------
  let activeCard = null, lastShown = [];
  function tabs() {
    const box = $("#mapcards");
    if (!box) return;
    const shown = [...box.children].filter((c) => c.classList.contains("card") && !c.hidden && c.id !== "mmCard");
    const ids = shown.map((c) => c.id);
    const fresh = ids.find((id) => !lastShown.includes(id));
    if (fresh) activeCard = fresh;
    if (!ids.includes(activeCard)) activeCard = ids[ids.length - 1] || null;
    lastShown = ids;
    let bar = $("#mapcardtabs");
    if (shown.length < 2) { shown.forEach((c) => c.classList.remove("tab-off")); if (bar) bar.hidden = true; return; }
    if (!bar) { bar = document.createElement("div"); bar.id = "mapcardtabs"; bar.className = "mapcardtabs"; bar.setAttribute("role", "tablist"); }
    if (bar.parentElement !== box || box.firstElementChild !== bar) box.prepend(bar);
    bar.hidden = false;
    const title = (c) => (c.querySelector(".dsc-head h3, .dsc-head h2")?.textContent || c.id).trim();
    const html = shown.map((c) => `<button type="button" role="tab" data-card="${c.id}" aria-selected="${c.id === activeCard}" title="${title(c).replace(/"/g, "&quot;")}">${title(c).replace(/^(\S+)\s.*$/u, "$1") === title(c) ? title(c) : title(c).split(" ").slice(0, 3).join(" ")}</button>`).join("");
    if (bar.innerHTML !== html) {
      bar.innerHTML = html;
      bar.querySelectorAll("[data-card]").forEach((b) => (b.onclick = () => { activeCard = b.dataset.card; tabs(); }));
    }
    shown.forEach((c) => c.classList.toggle("tab-off", c.id !== activeCard));
  }

  // ---------- "More on the map": the extra layers in one menu, grouped ----------
  // Map style stays as its own button; the layers go in a menu that opens above the button (always on screen),
  // with a line about each and a fuller explanation on hover. The button says how many are switched on.
  const LAYERS = [
    ["People and places", [
      ["#rgBtn", "Regions within countries", "Human development, life expectancy, schooling and income for 1,800 regions, for women and men.", "Colours about 1,800 regions in 188 countries (Global Data Lab). See the richest and poorest regions in the world, the countries with the biggest gaps between regions, and the HDI of any region since 1990."],
      ["#nightBtn", "Night-time lights", "The Earth at night from space: where people live, and who has electricity.", "NASA's Black Marble image of the world's lights, drawn onto this map, with places to look at: the two Koreas, the Nile, gas flares in Nigeria, the dark Amazon and more."],
      ["#whsBtn", "World Heritage Sites", "All 1,273 UNESCO World Heritage Sites.", "Every cultural, natural and mixed World Heritage Site as a dot. Filter by type, search for a site or country, and click one for its details and UNESCO page."],
      ["#cgBtn", "City growth", "How the world's cities have grown since 1975, with UN projections to 2050.", "About 2,600 cities as circles sized by population, coloured by how fast they grew. Play it to watch megacities appear, and see the fastest-growing cities (UN World Urbanization Prospects 2025)."]]],
    ["World affairs", [
      ["#confBtn", "Current conflicts", "Wars and crises around the world, and whether each is getting worse.", "The 27 conflicts followed by the Council on Foreign Relations' Global Conflict Tracker, with a short explainer for each. Red: worsening; orange: unchanging; purple: developing; green: improving."],
      ["#dispBtn", "Disputed borders and territories", "Kashmir, Western Sahara, Taiwan, Crimea and other places where the border or ruler is disputed.", "Striped areas and markers show 24 disputes, each with a short, neutral explainer of who claims what and why. Borders on the main map are de facto (who controls the land), not a judgement on who is right."],
      ["#colBtn", "Colonial history", "Which European power ruled each of today's countries, any year from 1500 to 2000.", "Press play to watch the empires of Britain, France, Spain, Portugal, the Netherlands, Belgium, Germany and Italy grow and break up, with the colonial history of each country (COLDAT)."],
      ["#elecBtn", "Elections", "National elections coming up in the next year, and those in the last 12 months.", "Countries with a national election coming up are shaded blue, those that held one in the last year green. Click a country for the date and type of election, with a link for candidates and results."]]],
    ["Global links", [
      ["#cabBtn", "Undersea cables", "The internet's submarine cables, who owns them, and where they crowd together.", "About 600 cables in service and 100 planned (TeleGeography, 2026). Click one for its owners and the countries it links; see the cables part-owned by Google, Meta, Amazon and Microsoft, and the straits where many cables squeeze through."],
      ["#briBtn", "China's overseas lending", "About 9,300 projects China paid for abroad, 2000–2021: the Belt and Road and more.", "Roads, railways, ports, power stations, mines, hospitals and schools financed by China (AidData), sized by cost and coloured by type. Filter by type or since the Belt and Road began in 2013, see the countries receiving most, and click a project for details."],
      ["#minBtn", "Critical minerals", "Who mines the lithium, cobalt, rare earths, nickel, copper, graphite and platinum the world needs for clean energy.", "Countries shaded by their share of world mining of each mineral, with what it is used for and the issues around it (child labour, export bans, China's control of refining)."],
      ["#shipBtn", "Shipping lanes and chokepoints", "The world's main shipping routes, the narrow straits and canals they depend on, and the busiest ports.", "About 80% of world trade goes by sea. See the main shipping lanes, the chokepoints (Suez, Panama, Hormuz, Malacca, Bab-el-Mandeb, Dover and more) with an explainer for each, and the busiest container ports."]]],
    ["Teaching", [
      ["#csBtn", "Case studies", "About 30 GCSE and A-level case studies: earthquakes, storms, floods, cities, ecosystems and UK landscapes.", "Pins for the case studies used by the exam boards (Nepal 2015, Typhoon Haiyan, the Somerset Levels, Rio, Mumbai, the Amazon, Holderness and more), each with key facts and links to the right maps. Step through them with the arrows."]]],
    ["Planet", [
      ["#iceBtn", "Arctic sea ice", "How much ice is left on the Arctic Ocean each September, from 1980 to 2026.", "The outline of the sea ice at its smallest each year (1980, 1990, 2000, 2007, 2012, 2020, 2026), with any year as an outline to compare, and a chart of every September since 1979 (NSIDC)."],
      ["#pmBtn", "Plate movement", "Which way each tectonic plate moves, how fast, and what happens at its edges.", "Arrows show each plate's direction and speed (2 to 10 cm a year), and arrows along the boundaries show plates moving apart, together or sliding past each other, from the PB2002 model."],
      ["#curBtn", "Ocean currents", "The main warm and cold surface currents and the gyres they make.", "Flowing lines for 27 currents, from the Gulf Stream and North Atlantic Drift to the Humboldt and Benguela, each explained: how they affect climate, deserts, fog and fishing."],
      ["#waterBtn", "Water: shared rivers", "Rivers that cross borders, where countries argue (or cooperate) over water.", "The Nile and Ethiopia's dam, the Mekong, the Indus, the Colorado, the Aral Sea and more, each explained, with examples of sharing that works; plus water stress for every country."],
      ["#forestBtn", "Forest loss", "Where forests are being cleared, and why.", "Hotspots of deforestation (the Amazon's arc of deforestation, the Chaco, Borneo, the Congo Basin, the cocoa belt…) with the causes, and the countries losing the most tree cover."],
      ["#cycBtn", "Cyclone tracks", "The path of every hurricane, typhoon and cyclone of category 3 or more since 1980.", "About 1,100 storms from the IBTrACS archive, coloured by strength. Choose a decade, a strength or an ocean; see the strongest; click a track to follow a storm and see how it grew and faded (Katrina, Haiyan, Idai, Melissa…)."],
      ["#protBtn", "Protected areas", "The biggest and best-known national parks and marine reserves, and the “30 by 30” target.", "Two dozen protected areas on land and at sea, from Yellowstone and the Serengeti to the Great Barrier Reef and the Ross Sea, each explained; plus the countries that have protected 30% of their land or sea."],
      ["#climBtn", "Climate graphs", "Climate graphs for thousands of weather stations (1991–2020 averages).", "Click a weather station for its climate graph: average temperature and rainfall for each month, its Köppen climate zone, and a comparison with another station."],
      ["#firesBtn", "Fires now", "Fires spotted by satellite in the last 24 hours, live from NASA.", "Every fire NASA's satellites detected in the last day, counted in squares: farm and savanna burning in Africa, wildfires in Canada, Siberia, Australia and the Mediterranean. The pattern moves with the dry seasons."],
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
      lb.onclick = (e) => { e.stopPropagation(); if (menu.hidden) { menu.hidden = false; lb.setAttribute("aria-expanded", "true"); fillMenu(); placeMenu(); if (window.matchMedia("(pointer: fine)").matches) menu.querySelector("#lmQ")?.focus({ preventScroll: true }); } else close(); };
      document.addEventListener("click", (e) => { if (!menu.hidden && !menu.contains(e.target) && e.target !== lb) close(); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) close(); });
      window.addEventListener("resize", () => { if (!menu.hidden) placeMenu(); });
      // a click on a layer switches it on or off; the menu closes so the map can be seen
      menu.addEventListener("click", (e) => { if (e.target.closest(".lm-row button:not(.lm-star)") || e.target.closest(".lm-fav button")) setTimeout(close, 120); });
      btns.appendChild(lb);
      document.body.appendChild(menu);   // on the page itself, so it is never cut off by the map
    }
    const phys = W?.state?.mode === "physical";
    // a library: each theme folds open; the Physical map lists Planet first
    const groups = phys ? [LAYERS[4], LAYERS[3], LAYERS[0], LAYERS[1], LAYERS[2]] : LAYERS;
    if (menu.dataset.mode !== (phys ? "p" : "h")) {
      menu.dataset.mode = phys ? "p" : "h";
      menu.innerHTML = `<p class="lm-top">Add to the map <small>Open a theme · hover for more · ☆ to keep a favourite at the top</small></p><input type="search" id="lmQ" class="lm-q" placeholder="Find a layer: ice, war, trade, storms…" aria-label="Find a layer"><div class="lm-fav" id="lmFav"></div><p class="lm-none" id="lmNone" hidden>No layer matches. Try another word.</p><div class="lm-on" id="lmOn"></div><p class="lm-busy" id="lmBusy" hidden>That's quite a lot on the map at once: you may want to switch one off.</p>` + groups.map(([g, items]) => `<details class="lm-g" data-g="${g}"><summary>${g} <small>${items.map(([, n]) => n).join(" · ")}</small></summary>${items.map(([sel, n, d, more]) => `<div class="lm-row" data-sel="${sel}" data-find="${(n + " " + d + " " + more).toLowerCase().replace(/"/g, "")}" title="${more.replace(/"/g, "&quot;")}"><small>${d}</small><button type="button" class="lm-star" data-star="${sel}" aria-pressed="false" aria-label="Keep ${n} at the top of this menu">☆</button></div>`).join("")}</details>`).join("") +
        `<p class="lm-h">Map style</p><div class="lm-row" title="${phys ? "Change what the background shows: landforms (the big shapes of the land), biomes, Köppen climate zones or tectonic plates, and which features are drawn: rivers, lakes, volcanoes, earthquakes and more." : "Colour the map by your filters (the default), by change over time between two years, or by two measures at once; or draw countries as circles sized by population."}"><button type="button" class="mmbtn" id="lmStyle">🎨 Map style</button><small>${phys ? "Background (landforms, biomes, climate zones, plates) and features: rivers, volcanoes…" : "Colour by your filters, by change over time, or by two measures at once."}</small></div>`;
      menu.querySelector("#lmStyle").onclick = () => { setTimeout(() => $("#mmBtn")?.click(), 150); };
      // search: show only the layers whose name or description has every word typed
      const q = menu.querySelector("#lmQ");
      q.oninput = () => {
        const words = q.value.toLowerCase().split(/\s+/).filter(Boolean).map((w) => new RegExp("(^|[^a-z])" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        let any = false;
        menu.querySelectorAll("details.lm-g").forEach((d) => {
          let n = 0;
          d.querySelectorAll(".lm-row[data-find]").forEach((r) => { const hit = words.every((w) => w.test(r.dataset.find)); r.hidden = !hit; n += hit; });
          d.hidden = words.length > 0 && !n; if (words.length && n) d.open = true;
          any ||= n > 0;
        });
        menu.querySelector("#lmNone").hidden = !words.length || any;
      };
      q.onkeydown = (e) => { if (e.key === "Enter") { const r = menu.querySelector("details.lm-g:not([hidden]) .lm-row:not([hidden]) button:not(.lm-star)"); r?.click(); } };
      menu.querySelectorAll("[data-star]").forEach((b) => (b.onclick = (e) => {
        e.stopPropagation();
        const fav = new Set(store.get("wc-fav-layers", [])), k = b.dataset.star;
        fav.has(k) ? fav.delete(k) : fav.add(k);
        store.set("wc-fav-layers", [...fav]); fillMenu();
      }));
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
    // what's switched on, at the top of the menu (click to switch off); the themes holding them open
    const menu = $("#layersMenu");
    if (menu) {
      const box = menu.querySelector("#lmOn");
      if (box) {
        const html = on.length ? `<span>On now:</span>${on.map((b) => `<button type="button" class="lm-off" data-off="#${b.id}" title="Switch off">${b.textContent.replace(/ ✓$/, "")} ×</button>`).join("")}` : "";
        if (box.innerHTML !== html) { box.innerHTML = html; box.querySelectorAll("[data-off]").forEach((x) => (x.onclick = (e) => { e.stopPropagation(); $(x.dataset.off)?.click(); })); }
      }
      const busy = menu.querySelector("#lmBusy"); if (busy) busy.hidden = on.length < 3;
      // favourites: a row of quick buttons at the top
      const fav = store.get("wc-fav-layers", []).filter((k) => IDS.includes(k) && $(k));
      menu.querySelectorAll("[data-star]").forEach((b) => { const f = fav.includes(b.dataset.star); b.textContent = f ? "★" : "☆"; b.setAttribute("aria-pressed", String(f)); b.title = f ? "Remove from favourites" : "Keep at the top of this menu"; });
      const fb = menu.querySelector("#lmFav");
      if (fb) {
        const html = fav.length ? `<span>★ Favourites:</span>${fav.map((k) => { const b = $(k); return `<button type="button" class="lm-fv${b.getAttribute("aria-pressed") === "true" ? " on" : ""}" data-fv="${k}">${b.textContent}</button>`; }).join("")}` : "";
        if (fb.innerHTML !== html) { fb.innerHTML = html; fb.querySelectorAll("[data-fv]").forEach((x) => (x.onclick = () => $(x.dataset.fv)?.click())); }
      }
      if (!menu.dataset.opened && !menu.hidden) {
        menu.dataset.opened = "1";
        menu.querySelectorAll("details.lm-g").forEach((d, i) => { d.open = i === 0 || on.some((b) => d.contains(b)); });
      }
      if (menu.hidden) delete menu.dataset.opened;
    }
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
  const tick = () => { queued = false; enhance(); stack(); tabs(); layersMenu(); placeToggles(); };
  function init() {
    W = window.WC;
    makeToggles();
    mapDownload();
    tick();
    new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(tick); } }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-pressed", "hidden"] });
    window.addEventListener("resize", placeToggles);
  }
  window.WLY = { init, setFS };
})();
