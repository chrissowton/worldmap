/* The Earth on the map (v66), in More on the map:
   - Plate movement: which way, and how fast, each plate moves, and whether plates move apart, together or past each other
     at their boundaries (PB2002, Bird 2003; platemotion.json from make_platemotion.cjs)
   - Ocean currents: the main surface currents, warm and cold (drawn for this site, simplified)
   - Night-time lights: NASA's Black Marble (VIIRS, 2016), loaded from NASA GIBS when switched on
   - Forest loss: hotspots of deforestation, and the countries losing the most tree cover (Global Forest Watch) */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const wiki = (q) => `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(q)}`;
  const rad = Math.PI / 180;
  let W, PM = null, pmLoad = null;
  const P = { plates: { on: false, pick: null }, cur: { on: false, pick: null, kind: "" }, night: { on: false, pick: null, blend: 0.9, state: "" }, forest: { on: false, pick: null } };
  const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
  const toward = (az) => COMPASS[Math.round(((az % 360) + 360) % 360 / 45) % 8];

  // ---------- Ocean currents: [name, warm (1) or cold (0), points west to east along the flow, what it does] ----------
  const CUR = [
    ["Gulf Stream", 1, [[-80.5, 25.3], [-79.8, 28], [-79, 31], [-76, 34], [-72, 37], [-66, 39.5], [-58, 41], [-50, 42.5]], "Carries warm water from the Gulf of Mexico up the coast of the USA and out across the Atlantic. One of the fastest ocean currents, up to about 2 m a second."],
    ["North Atlantic Drift", 1, [[-50, 42.5], [-40, 46], [-30, 50], [-20, 54], [-12, 57], [-5, 60], [2, 63], [8, 66], [14, 70]], "The Gulf Stream's continuation towards Europe. With the westerly winds, it helps keep the UK and Norway several degrees milder in winter than places as far north in Canada, and keeps Norway's ports free of ice."],
    ["Canary Current", 0, [[-11, 41], [-13, 35], [-16, 30], [-18, 25], [-20, 19], [-22, 14]], "Cool water flowing south past Portugal and north-west Africa. Cold water cools the air above it, so it brings little rain: part of the reason the western Sahara is so dry."],
    ["North Equatorial Current (Atlantic)", 1, [[-22, 14], [-32, 14], [-42, 14], [-52, 14.5], [-60, 14.5]], "Pushed west by the north-east trade winds, carrying warm water towards the Caribbean."],
    ["Caribbean Current and Loop Current", 1, [[-60, 14.5], [-70, 14.5], [-79, 15.5], [-85, 20], [-86.5, 24], [-84, 25.8], [-81, 25]], "Warm water heading through the Caribbean into the Gulf of Mexico. Hurricanes that pass over the very warm Loop Current can strengthen quickly."],
    ["Labrador Current", 0, [[-61, 64], [-58, 60], [-55, 55], [-52, 50], [-50, 46], [-52, 43]], "Cold water from the Arctic flowing south past Canada, carrying icebergs (the Titanic sank where it meets the Gulf Stream). Where the two meet, fog is common and the Grand Banks fishing grounds are rich."],
    ["East Greenland Current", 0, [[-8, 79], [-14, 74], [-20, 70], [-27, 67], [-35, 64], [-42, 60.5]], "Carries cold water and sea ice south out of the Arctic along Greenland's east coast."],
    ["Brazil Current", 1, [[-35, -8], [-38, -15], [-40, -22], [-46, -27], [-51, -34], [-54, -38]], "Warm water flowing south along Brazil's coast, the western side of the South Atlantic gyre."],
    ["South Equatorial Current (Atlantic)", 1, [[9, -4], [0, -4], [-10, -5], [-20, -6], [-30, -7], [-34, -7.5]], "Pushed west by the south-east trade winds, carrying warm water from Africa towards Brazil."],
    ["Benguela Current", 0, [[18, -34.5], [16, -30], [13.5, -25], [11.5, -20], [10, -15], [9, -8]], "Cold water flowing north up the coast of south-west Africa. It cools the air, so clouds and rain rarely form: the main reason the Namib Desert is there, with coastal fog instead of rain. Upwelling makes it rich in fish."],
    ["Falklands Current", 0, [[-64, -55], [-60, -50], [-58, -45], [-56, -40]], "A branch of the Antarctic Circumpolar Current carrying cold, nutrient-rich water north along Argentina."],
    ["Antarctic Circumpolar Current", 0, [[-180, -60], [-150, -60], [-120, -58.5], [-90, -58], [-70, -58], [-60, -57], [-40, -53], [-20, -50], [0, -48], [20, -46], [40, -46], [60, -47], [80, -48], [100, -49], [120, -50], [140, -52], [160, -55], [180, -60]], "The world's biggest current, flowing all the way round Antarctica with nothing to stop it, driven by strong westerly winds. It keeps Antarctica cold by cutting it off from warmer water."],
    ["Kuroshio", 1, [[122, 21], [123, 25], [127, 28], [131, 31], [136, 33.5], [140, 35.2], [145, 36], [152, 37]], "The Pacific's version of the Gulf Stream: warm water flowing north past Taiwan and Japan, giving southern Japan its mild, wet climate."],
    ["North Pacific Current", 1, [[152, 37], [165, 40], [180, 41], [-165, 42], [-150, 43], [-138, 45]], "Carries water east across the North Pacific. The Great Pacific Garbage Patch collects in the calm middle of this gyre."],
    ["Alaska Current", 1, [[-137, 49], [-138, 55], [-146, 59.5], [-155, 57.5]], "Relatively warm water circling north into the Gulf of Alaska, keeping its coast ice-free."],
    ["California Current", 0, [[-131, 48], [-127, 42], [-123, 36], [-118, 30], [-114, 24]], "Cold water flowing south along the west coast of North America. It brings the summer fog of San Francisco and keeps the coast cool and dry."],
    ["Oyashio", 0, [[166, 58], [162, 54], [157, 49], [151, 45], [147, 42], [145, 39.5]], "Cold, nutrient-rich water from the Arctic flowing south past Kamchatka to Japan, where it meets the Kuroshio: one of the world's richest fishing grounds."],
    ["North Equatorial Current (Pacific)", 1, [[-112, 15], [-130, 14], [-150, 13], [-170, 13], [170, 13], [150, 13.5], [133, 14], [123, 18]], "Pushed west across the Pacific by the trade winds. Typhoons that form along it often head for the Philippines."],
    ["Equatorial Counter Current (Pacific)", 1, [[128, 6], [150, 6], [180, 7], [-150, 7], [-120, 7], [-90, 6]], "Flows east, against the trade winds, between the two westward equatorial currents. It gets stronger in El Niño years."],
    ["South Equatorial Current (Pacific)", 1, [[-84, -2], [-100, -4], [-120, -5], [-140, -6], [-160, -7], [180, -9], [162, -11], [152, -13]], "Pushed west by the trade winds, piling warm water up in the western Pacific. When the trade winds weaken, this warm water spreads back east: an El Niño."],
    ["East Australian Current", 1, [[155, -14], [154.5, -20], [154, -25], [153.8, -30], [152.3, -35], [153, -39]], "Warm water flowing south along Australia's east coast (the current in Finding Nemo). It carries tropical fish south, and warming of it is pushing kelp forests and fish further south."],
    ["Humboldt (Peru) Current", 0, [[-78, -45], [-75.5, -38], [-73, -30], [-72, -22], [-76.5, -14], [-81, -6], [-84, -2]], "Cold water flowing north along Chile and Peru. Upwelling brings nutrients to the surface, making it one of the most productive fisheries on Earth (anchovies), and the cool air helps make the Atacama the driest desert. El Niño weakens it."],
    ["West Australian Current", 0, [[112, -35], [111, -30], [109.5, -25], [107, -20]], "Cool water flowing north along Western Australia, part of the reason that coast is so dry."],
    ["Agulhas Current", 1, [[41, -12], [40, -18], [36, -25], [32.5, -30], [28, -34], [23, -37], [19, -38.5]], "Warm water flowing south through the Mozambique Channel and down South Africa's east coast, one of the strongest currents. Giant waves form where it meets storms from the south."],
    ["South Equatorial Current (Indian)", 1, [[108, -12], [95, -12], [80, -13], [65, -14], [55, -15], [49.5, -14]], "Pushed west by the south-east trade winds, carrying warm water towards Madagascar."],
    ["Somali Current", 1, [[42, -2], [46, 3], [50, 8], [52, 11.5]], "The only big current that reverses with the seasons: it flows north-east in the summer monsoon (as shown), with strong upwelling off Somalia, and south-west in winter."],
    ["Norwegian Current and West Spitsbergen", 1, [[14, 70], [16, 73], [12, 77], [10, 80]], "The last of the Gulf Stream's warmth, flowing into the Arctic and keeping the sea west of Svalbard free of ice in winter."],
  ];

  // ---------- Night lights: places to look at ----------
  const NIGHT = [
    ["The two Koreas", 127.5, 38.5, 4.5, "South Korea is one of the brightest countries on Earth; North Korea is almost completely dark except for Pyongyang. Electricity shows a huge gap in wealth across one border. The lights in the sea are fishing boats using bright lamps to attract squid."],
    ["The Nile", 31.5, 27, 3.6, "A bright line through the dark Sahara: almost all of Egypt's 110 million people live along the Nile and in its delta, where there is water to farm."],
    ["Europe", 8, 49, 2.6, "The densely populated, rich core of Europe, from England through Benelux to the Ruhr and northern Italy, shines brightly. Notice how dark much of Scandinavia, Scotland and Spain's interior are."],
    ["India and the Ganges", 80, 23, 2.6, "Lights spread across the whole Ganges plain, one of the most crowded places on Earth. India brought electricity to almost every village between 2010 and 2020."],
    ["Nigeria and the Niger Delta", 6.5, 6, 4.2, "Lagos shines, but many bright spots in the Delta are gas flares at oil wells: waste gas burned off, polluting the air."],
    ["Eastern USA", -84, 37, 2.6, "Cities and suburbs spread across the east; the line of lights from Boston to Washington is a megalopolis. West of about 100° W it suddenly gets darker: the dry Great Plains have far fewer people."],
    ["Japan", 138, 36, 3.6, "Tokyo is the brightest city region on Earth, and lights line the coast from Tokyo to Osaka. Mountains in between are dark."],
    ["The Persian Gulf", 51, 27, 3.8, "Oil-rich cities such as Dubai, Doha and Kuwait City are very bright, with gas flares and oil platforms out at sea."],
    ["Africa", 20, 2, 2.2, "Much of central Africa is still dark at night: about 600 million Africans have no electricity at home. Bright spots are big cities, mines and gas flares."],
    ["The Trans-Siberian Railway", 85, 55, 2.8, "A chain of lights across Russia's empty north follows the railway, along which most Siberian towns grew."],
    ["The Amazon", -60, -5, 2.6, "The world's largest rainforest is almost completely dark, apart from Manaus and the towns along the rivers. In the dry season, fires can show up as lights too."],
    ["Australia", 134, -27, 2.4, "Almost all Australians live on the coast, especially the south-east. The interior, the Outback, is nearly empty."],
  ];
  // ---------- Forest loss hotspots ----------
  const FOREST = [
    ["The arc of deforestation, Brazil", -55, -10, "BRA", "The southern and eastern edge of the Amazon, where forest is cleared for cattle ranching and soya, often illegally, and roads open up new land. Brazil's Amazon deforestation fell by about half between 2022 and 2025 with stronger enforcement, but fires are a growing threat."],
    ["Cerrado, Brazil", -47, -13, "BRA", "A savanna with scattered trees, very rich in wildlife, south of the Amazon. Much of it has been cleared for soya and cattle, and it has less protection than the Amazon."],
    ["Gran Chaco", -61, -22, "PRY ARG BOL", "Dry forest in Paraguay, Argentina and Bolivia, being cleared very fast for cattle ranching, much of it legally."],
    ["Santa Cruz, Bolivia", -62, -16, "BOL", "Forest cleared for soya and cattle, and burned: in 2024 fires made Bolivia's loss of tropical forest the second highest in the world after Brazil's."],
    ["Congo Basin", 23, -1, "COD COG CMR", "The second-largest rainforest. Most clearing is by families growing food (shifting cultivation) and making charcoal, as the population grows and few have other fuels."],
    ["Borneo", 114, 0, "IDN MYS", "Lowland rainforest and peat swamps cleared for oil palm and pulpwood plantations since the 1980s; orangutans have lost much of their habitat. Clearing has slowed since about 2016."],
    ["Sumatra", 101.5, 0, "IDN", "Rainforest and peat swamp forest drained and cleared for oil palm and paper. Drained peat burns easily, and the smoke can cover Singapore and Malaysia (the haze)."],
    ["Mekong region", 105, 14, "KHM LAO MMR", "Forests in Cambodia, Laos and Myanmar cleared for rubber, cassava and timber, often for export to China and Vietnam."],
    ["West Africa's cocoa belt", -5.5, 6.5, "CIV GHA", "Côte d'Ivoire and Ghana grow about 60% of the world's cocoa. Côte d'Ivoire has lost most of its rainforest since 1960, much of it to cocoa farms."],
    ["Madagascar", 47, -18, "MDG", "Slash-and-burn farming (tavy) and charcoal have removed most of the island's original forest, home to lemurs found nowhere else."],
    ["Canada's boreal forest", -110, 57, "CAN", "Not deforestation but fire: the record wildfires of 2023 burned about 15 million hectares. Tree cover lost to fire usually grows back, unlike forest cleared for farms."],
  ];

  function loadPM() { return (pmLoad ||= (window.__PLATEMOTION__ ? Promise.resolve(window.__PLATEMOTION__) : fetch("platemotion.json?v=66").then((r) => r.json())).then((j) => (PM = j)).catch(() => null)); }
  const PLATE_NAME = (c) => PM?.plates.find((p) => p[0] === c)?.[1] || c;

  // screen angle (degrees, 0 = right, clockwise) for moving from a point on a compass bearing
  function screenAngle(lon, lat, az) {
    const a = W.project(lon, lat), d = 0.6;
    const b = W.project(lon + d * Math.sin(az * rad) / Math.max(0.2, Math.cos(lat * rad)), lat + d * Math.cos(az * rad));
    if (!a || !b) return null;
    return Math.atan2(b[1] - a[1], b[0] - a[0]) / rad;
  }
  // a smooth line through projected points, broken where it crosses the 180° line
  const smooth = d3.line().curve(d3.curveCatmullRom.alpha(0.5));
  function pieces(pts) {
    const out = [[]];
    pts.forEach((p, i) => {
      if (i && Math.abs(p[0] - pts[i - 1][0]) > 180) {
        const q = pts[i - 1], s = q[0] > 0 ? 180 : -180, t = (s - q[0]) / ((p[0] + (s > 0 ? 360 : -360)) - q[0]), lat = q[1] + t * (p[1] - q[1]);
        out[out.length - 1].push([s, lat]); out.push([[-s, lat]]);
      }
      out[out.length - 1].push(p);
    });
    return out.filter((x) => x.length > 1);
  }

  // ---------- Night lights: NASA's Black Marble drawn into the map's projection ----------
  let nightImg = null, nightFor = "", nightReq = null;
  // NASA GIBS: Black Marble 2016, at two sizes, then the 2012 city lights if that fails
  const NIGHT_TRY = [["VIIRS_Black_Marble", 4096, "&TIME=2016-01-01"], ["VIIRS_Black_Marble", 2048, "&TIME=2016-01-01"], ["VIIRS_CityLights_2012", 2048, ""]];
  const NIGHT_URL = ([layer, w, t]) => `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${layer}&STYLES=&SRS=EPSG:4326&BBOX=-180,-90,180,90&WIDTH=${w}&HEIGHT=${w / 2}&FORMAT=image/jpeg${t}`;
  function loadNight() {
    if (nightImg) return Promise.resolve(nightImg);
    return (nightReq ||= new Promise((ok, bad) => {
      const tryW = (n) => {
        const im = new Image(); im.crossOrigin = "anonymous";
        im.onload = () => { const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const x = c.getContext("2d"); x.drawImage(im, 0, 0);
          try { nightImg = { w: im.width, h: im.height, d: x.getImageData(0, 0, im.width, im.height).data }; ok(nightImg); } catch (e) { bad(e); } };
        im.onerror = () => (n + 1 < NIGHT_TRY.length ? tryW(n + 1) : bad(new Error("no image")));
        im.src = NIGHT_URL(NIGHT_TRY[n]);
      };
      tryW(0);
    })).catch((e) => { nightReq = null; throw e; });
  }
  function drawNight(g) {
    const vb = ($("#map")?.getAttribute("viewBox") || "0 0 1000 500").split(" ").map(Number), w = vb[2], h = vb[3];
    const sig = `${w}|${h}|${W.state.mode}|${W.project(0, 0)}`;
    if (!nightImg || nightFor === sig) return;
    nightFor = sig;
    const sc = Math.min(2, 2600 / w), cw = Math.round(w * sc), ch = Math.round(h * sc);
    const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
    const cx = cv.getContext("2d"), out = cx.createImageData(cw, ch), o = out.data, S = nightImg;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const ll = W.invert((x + 0.5) / sc, (y + 0.5) / sc), i = (y * cw + x) * 4;
      if (!ll || !isFinite(ll[0]) || Math.abs(ll[0]) > 180 || Math.abs(ll[1]) > 90) continue;
      const p = W.project(ll[0], ll[1]);
      if (!p || Math.abs(p[0] - (x + 0.5) / sc) > 1 || Math.abs(p[1] - (y + 0.5) / sc) > 1) continue;  // outside the globe
      const sx = Math.min(S.w - 1, Math.floor((ll[0] + 180) / 360 * S.w)), sy = Math.min(S.h - 1, Math.floor((90 - ll[1]) / 180 * S.h)), j = (sy * S.w + sx) * 4;
      o[i] = S.d[j]; o[i + 1] = S.d[j + 1]; o[i + 2] = S.d[j + 2]; o[i + 3] = 255;
    }
    cx.putImageData(out, 0, 0);
    const svg = d3.select(W.mapSVG()); let defs = svg.select("defs"); if (defs.empty()) defs = svg.append("defs");
    defs.selectAll("clipPath#nightClip").data([0]).join((en) => en.append("clipPath").attr("id", "nightClip")).selectAll("path").data([0]).join("path").attr("d", W.geoPath()({ type: "Sphere" }));
    g.attr("clip-path", "url(#nightClip)");
    g.selectAll("image").data([0]).join("image").attr("x", 0).attr("y", 0).attr("width", w).attr("height", h).attr("preserveAspectRatio", "none")
      .attr("href", cv.toDataURL("image/jpeg", 0.88));
  }

  // ---------- Drawing ----------
  let plFor = "", curFor = "";
  function draw() {
    if (!W) return;
    const map = W.state.view === "map", k = W.k || 1;
    {  // night lights sit just above the countries, below cities and labels
      const g = W.layer("night");
      const land = W.landNode();
      if (land && g.node().previousSibling !== land) land.parentNode.insertBefore(g.node(), land.nextSibling);
      const show = P.night.on && map && nightImg;
      g.style("display", show ? null : "none").style("opacity", P.night.blend);
      if (show) drawNight(g);
    }
    {
      const g = W.layer("currents");
      const show = P.cur.on && map;
      g.style("display", show ? null : "none");
      if (show) {
        const sig = `${W.state.mode}|${$("#map")?.getAttribute("viewBox")}|${P.cur.kind}|${P.cur.pick}`;
        if (curFor !== sig) {
          curFor = sig;
          const items = CUR.map((c, i) => ({ c, i })).filter((d) => P.cur.kind === "" || String(d.c[1]) === P.cur.kind);
          const sel = g.selectAll("g.cur").data(items, (d) => d.i).join((en) => { const gg = en.append("g").attr("class", "cur"); return gg; })
            .classed("warm", (d) => d.c[1] === 1).classed("on", (d) => P.cur.pick === d.i).classed("dim", (d) => P.cur.pick != null && P.cur.pick !== d.i)
            .attr("data-base", (d) => `${d.c[1] ? "🔴 Warm" : "🔵 Cold"} current: ${d.c[0]} (click for more)`)
            .on("click", (ev, d) => { ev.stopPropagation(); P.cur.pick = d.i; card("cur"); });
          sel.each(function (d) {
            const gg = d3.select(this);
            const segs = pieces(d.c[2]).map((pc) => pc.map((p) => W.project(p[0], p[1])).filter(Boolean)).filter((pc) => pc.length > 1);
            gg.selectAll("path.cur-hit").data(segs).join("path").attr("class", "cur-hit").attr("d", smooth).attr("vector-effect", "non-scaling-stroke").attr("data-base", gg.attr("data-base"));
            gg.selectAll("path.cur-l").data(segs).join("path").attr("class", "cur-l").attr("d", smooth).attr("vector-effect", "non-scaling-stroke");
            const last = segs[segs.length - 1], a = last[last.length - 2], b = last[last.length - 1];
            gg.selectAll("path.cur-h").data([0]).join("path").attr("class", "cur-h").attr("d", "M-7,-5 L2,0 L-7,5Z")
              .attr("transform", `translate(${b[0]},${b[1]}) rotate(${Math.atan2(b[1] - a[1], b[0] - a[0]) / rad}) scale(${1 / k})`).datum([b, Math.atan2(b[1] - a[1], b[0] - a[0]) / rad]);
          });
        }
        g.raise();
      }
    }
    {
      const g = W.layer("platemotion");
      const show = P.plates.on && map && PM;
      g.style("display", show ? null : "none");
      if (show) {
        const sig = `${W.state.mode}|${$("#map")?.getAttribute("viewBox")}|${P.plates.pick}`;
        if (plFor !== sig) {
          plFor = sig;
          const arr = PM.arrows.map(([lon, lat, c, ve, vn]) => {
            const sp = Math.hypot(ve, vn), az = (Math.atan2(ve, vn) / rad + 360) % 360, xy = W.project(lon, lat), ang = screenAngle(lon, lat, az);
            return { lon, lat, c, sp, az, xy, ang };
          }).filter((d) => d.xy && d.ang != null && d.sp > 3);
          g.selectAll("g.pm").data(arr).join((en) => { const gg = en.append("g").attr("class", "pm"); gg.append("path"); return gg; })
            .classed("on", (d) => P.plates.pick === d.c).classed("dim", (d) => P.plates.pick != null && P.plates.pick !== d.c)
            .attr("transform", (d) => `translate(${d.xy[0]},${d.xy[1]}) rotate(${d.ang}) scale(${1 / k})`)
            .on("click", (ev, d) => { ev.stopPropagation(); P.plates.pick = d.c; card("plates"); })
            .select("path").attr("d", (d) => { const L = 6 + d.sp * 0.32; return `M${-L / 2},-1.6 L${L / 2 - 6},-1.6 L${L / 2 - 6},-5 L${L / 2 + 2},0 L${L / 2 - 6},5 L${L / 2 - 6},1.6 L${-L / 2},1.6Z`; })
            .attr("data-base", (d) => `${PLATE_NAME(d.c)} plate here: moving ${toward(d.az)}, about ${(d.sp / 10).toFixed(1)} cm a year`);
          // boundaries: arrows apart (spreading), together (colliding) or past each other (sliding)
          const bd = PM.boundaries.map(([lon, lat, id, cls, v, div, rl, az]) => {
            const xy = W.project(lon, lat), ang = screenAngle(lon, lat, az);
            const kind = /OSR|CRB/.test(cls) ? "apart" : /SUB|OCB|CCB/.test(cls) ? "together" : "past";
            return { lon, lat, id, cls, v, div, rl, az, xy, ang, kind };
          }).filter((d) => d.xy && d.ang != null);
          const NAMES = { OSR: "a mid-ocean ridge (constructive)", CRB: "a rift valley (constructive)", SUB: "a subduction zone (destructive)", OCB: "an ocean collision zone (destructive)", CCB: "a continental collision zone (collision)", OTF: "a transform fault (conservative)", CTF: "a transform fault (conservative)" };
          g.selectAll("g.pb").data(bd).join((en) => { const gg = en.append("g").attr("class", "pb"); gg.append("path"); return gg; })
            .attr("class", (d) => `pb pb-${d.kind}`)
            .attr("transform", (d) => `translate(${d.xy[0]},${d.xy[1]}) rotate(${d.ang}) scale(${1 / k})`)
            .select("path").attr("d", (d) => (d.kind === "apart" ? "M0,-3 L0,-9 L-3,-6 M0,-9 L3,-6 M0,3 L0,9 L-3,6 M0,9 L3,6" : d.kind === "together" ? "M0,-10 L0,-3 L-3,-6 M0,-3 L3,-6 M0,10 L0,3 L-3,6 M0,3 L3,6" : "M-6,-3 L6,-3 L3,-6 M6,3 L-6,3 L-3,6"))
            .attr("data-base", (d) => `${d.id.split("-").map(PLATE_NAME).join(" and ")} plates: ${NAMES[d.cls] || "a boundary"}, moving ${d.kind} at about ${Math.max(1, Math.round(d.v))} mm a year`);
        }
        g.raise();
      }
    }
    {
      const g = W.layer("forest");
      const show = P.forest.on && map;
      g.style("display", show ? null : "none");
      if (show) {
        const pts = FOREST.map((f, i) => ({ f, i, xy: W.project(f[1], f[2]) })).filter((p) => p.xy);
        g.selectAll("g.fh").data(pts, (p) => p.i).join((en) => { const gg = en.append("g").attr("class", "fh"); gg.append("circle").attr("r", 14); gg.append("circle").attr("class", "c").attr("r", 6); return gg; })
          .attr("transform", (p) => `translate(${p.xy[0]},${p.xy[1]}) scale(${1 / k})`).classed("on", (p) => P.forest.pick === p.i)
          .on("click", (ev, p) => { ev.stopPropagation(); P.forest.pick = p.i; card("forest"); });
        g.selectAll("g.fh circle").attr("data-base", function () { const p = d3.select(this.parentNode).datum(); return `🪓 ${p.f[0]} (click for more)`; });
        g.raise();
      }
    }
  }
  function zoomed() {
    if (!W) return;
    const k = W.k || 1;
    W.layer("platemotion").selectAll("g.pm, g.pb").attr("transform", (d) => (d?.xy ? `translate(${d.xy[0]},${d.xy[1]}) rotate(${d.ang}) scale(${1 / k})` : null));
    W.layer("currents").selectAll("path.cur-h").attr("transform", (d) => (d ? `translate(${d[0][0]},${d[0][1]}) rotate(${d[1]}) scale(${1 / k})` : null));
    W.layer("forest").selectAll("g.fh").attr("transform", (p) => (p?.xy ? `translate(${p.xy[0]},${p.xy[1]}) scale(${1 / k})` : null));
  }
  function zoomTo(at, k) {
    const card = $("#mapcards"), stage = $("#mapstage");
    const shift = card && stage ? Math.min(card.getBoundingClientRect().width / 2, stage.clientWidth / 4) : 0;
    W.zoomToPoint(at[0], at[1], k);
    if (shift) setTimeout(() => W.panBy?.(shift, 0), 650);
  }
  const nav = (i, n, a, b) => `<div class="aff-nav"><button type="button" class="ghost" data-step="-1" ${i <= 0 ? "disabled" : ""}>◀ ${a}</button><span>${i + 1} of ${n}</span><button type="button" class="ghost" data-step="1" ${i >= n - 1 ? "disabled" : ""}>${b} ▶</button></div>`;
  const chips = (opts, cur, attr) => `<div class="cs-topics">${opts.map(([v, l, c]) => `<button type="button" class="cs-t ${cur === v ? "on" : ""}" data-${attr}="${v}" ${c ? `style="--cs:${c}"` : ""}>${l}</button>`).join("")}</div>`;
  const measureQS = (key) => { const f = W.F[key]; return f ? `f=${key}:${f.dmin}~${f.dmax}&c=${key}` : ""; };

  // ---------- Cards ----------
  const IDS = { plates: ["pmCard", "pmBtn"], cur: ["curCard", "curBtn"], night: ["nightCard", "nightBtn"], forest: ["forestCard", "forestBtn"] };
  function order(which) {
    if (which === "plates") return PM.plates.filter((p) => p[2] >= 1e6).map((p) => p[0]);
    if (which === "cur") return CUR.map((c, i) => [c, i]).filter(([c]) => P.cur.kind === "" || String(c[1]) === P.cur.kind).sort((a, b) => a[0][2][0][0] - b[0][2][0][0]).map(([, i]) => i);
    if (which === "night") return NIGHT.map((x, i) => [x, i]).sort((a, b) => a[0][1] - b[0][1]).map(([, i]) => i);
    return FOREST.map((x, i) => [x, i]).sort((a, b) => a[0][1] - b[0][1]).map(([, i]) => i);
  }
  function centreOf(code) {
    const a = PM.arrows.filter((x) => x[2] === code);
    if (!a.length) return null;
    let lons = a.map((x) => x[0]); if (d3.max(lons) - d3.min(lons) > 180) lons = lons.map((x) => (x < 0 ? x + 360 : x));
    let lon = d3.mean(lons); if (lon > 180) lon -= 360;
    return [lon, d3.mean(a, (x) => x[1])];
  }
  function go(which, i) {
    const S = P[which]; S.pick = i;
    if (which === "plates") { const c = centreOf(i); if (c) zoomTo(c, 1.8); }
    else if (which === "cur") { const p = CUR[i][2]; zoomTo(p[Math.floor(p.length / 2)], 3); }
    else if (which === "night") { const n = NIGHT[i]; zoomTo([n[1], n[2]], n[3]); }
    else zoomTo([FOREST[i][1], FOREST[i][2]], 3.6);
    card(which);
  }
  function card(which) {
    const S = P[which], [id, btn] = IDS[which];
    let el = $("#" + id);
    if (!el) { el = document.createElement("div"); el.id = id; el.className = "card livecard affcard"; $("#mapstage").appendChild(el); }
    el.hidden = !S.on || W.state.view !== "map" || (which === "plates" && !PM);
    $("#" + btn)?.setAttribute("aria-pressed", String(S.on));
    if (el.hidden) { draw(); return; }
    let head, body, src;
    const ord = order(which), back = (t) => `<button type="button" class="linkbtn" data-back>${t}</button>`;
    if (which === "plates") {
      head = "🧭 Plate movement";
      const p = S.pick ? PM.plates.find((x) => x[0] === S.pick) : null;
      const key = `<p class="pm-key"><span><i class="pm-k a"></i>Moving apart</span><span><i class="pm-k t"></i>Moving together</span><span><i class="pm-k p"></i>Sliding past</span></p>`;
      if (p) {
        const bs = PM.boundaries.filter((b) => b[2].split("-").includes(p[0]));
        const fast = bs.slice().sort((a, b) => b[4] - a[4])[0];
        body = `${ord.includes(p[0]) ? nav(ord.indexOf(p[0]), ord.length, "Bigger", "Smaller") : ""}<div class="aff-one"><h4>${esc(p[1])} plate</h4>
          <ul class="cs-facts"><li>About ${d3.format(",")(p[2])} km²</li><li>Moving <b>${toward(p[4])}</b> at about <b>${(p[3] / 10).toFixed(1)} cm a year</b> on average${p[3] >= 50 ? " (fast for a plate)" : p[3] <= 15 ? " (slow for a plate)" : ""}</li>
          ${fast ? `<li>Fastest at its edges: about ${Math.round(fast[4])} mm a year against the ${esc(fast[2].split("-").filter((c) => c !== p[0]).map(PLATE_NAME)[0] || "")} plate</li>` : ""}</ul>
          <p class="hint">Speeds are measured against the average of all the plates (a “no-net-rotation” frame), so they show how the plates move relative to the Earth as a whole.</p>${key}
          <p class="aff-links"><a href="${wiki(p[1] + " plate")}" target="_blank" rel="noopener">Read more ↗</a> · ${back("All plates")}</p></div>`;
      } else {
        body = `<p class="hint">Arrows inside each plate show which way it moves and how fast (longer = faster). Arrows along the edges show what happens at the boundary. Most plates move 2 to 10 cm a year, about as fast as your fingernails grow. Click an arrow.</p>${key}
          <ul class="aff-list">${ord.map((c) => { const x = PM.plates.find((q) => q[0] === c); return `<li><button type="button" class="linkbtn" data-c="${c}">${esc(x[1])}</button> <small>${(x[3] / 10).toFixed(1)} cm a year, ${toward(x[4])}</small></li>`; }).join("")}</ul>
          <p class="aff-links"><button type="button" class="ghost cs-go" data-q="m=p">Show the plates on the Physical map</button></p>`;
      }
      src = "Plate outlines, Euler poles and boundary types: PB2002 (Bird, 2003), via Ahlenius and Nordpil, ODC-By. The no-net-rotation speeds are worked out on this site from Bird's poles.";
    } else if (which === "cur") {
      head = "🌊 Ocean currents";
      const c = S.pick != null ? CUR[S.pick] : null;
      if (c) {
        body = `${nav(ord.indexOf(S.pick), ord.length, "West", "East")}<div class="aff-one"><h4>${esc(c[0])}</h4>
          <p class="aff-who"><span class="cs-tag" style="--cs:${c[1] ? "#d8432b" : "#2f6fd1"}">${c[1] ? "Warm current" : "Cold current"}</span></p><p>${esc(c[3])}</p>
          <p class="aff-links"><a href="${wiki(c[0])}" target="_blank" rel="noopener">Read more ↗</a> · ${back("All currents")}</p></div>`;
      } else {
        body = `<p class="hint">Winds drive the surface currents, and the spinning Earth (the Coriolis effect) turns them into giant loops called gyres: clockwise in the northern hemisphere, anticlockwise in the southern. Warm currents carry heat from the tropics towards the poles; cold currents flow back towards the equator and often bring dry, foggy climates and rich fishing.</p>
          ${chips([["", "All"], ["1", "Warm", "#d8432b"], ["0", "Cold", "#2f6fd1"]], S.kind, "k")}
          <ul class="aff-list">${ord.map((i) => `<li><span class="cf-dot" style="--cf:${CUR[i][1] ? "#d8432b" : "#2f6fd1"}"></span><button type="button" class="linkbtn" data-c="${i}">${esc(CUR[i][0])}</button></li>`).join("")}</ul>
          <p class="hint">Under the surface, cold, salty water sinks near Greenland and Antarctica and creeps round the world's oceans for centuries (the global conveyor belt). Scientists are watching for signs that melting ice is slowing the Atlantic part of it.</p>`;
      }
      src = "Currents drawn for this site from standard maps of the main surface currents; positions are simplified and real currents shift with the seasons. Checked November 2026.";
    } else if (which === "night") {
      head = "🌃 Night-time lights";
      const n = S.pick != null ? NIGHT[S.pick] : null;
      const status = S.state === "loading" ? `<p class="hint">Loading NASA's image of the Earth at night…</p>` : S.state === "error" ? `<p class="hint warn">The night-lights image couldn't be loaded from NASA just now (it needs an internet connection). Try again later.</p>` : "";
      const blend = `<label class="nl-blend">Mix with the map <input type="range" min="0.4" max="1" step="0.05" value="${S.blend}"></label>`;
      if (n) {
        body = `${nav(ord.indexOf(S.pick), ord.length, "West", "East")}${status}<div class="aff-one"><h4>${esc(n[0])}</h4><p>${esc(n[4])}</p><p class="aff-links">${back("All places")}</p></div>${blend}`;
      } else {
        body = `${status}<p class="hint">The Earth at night, photographed from space by the VIIRS sensor. Lights show where people live, and where they can afford electricity: compare the Koreas, or Africa with Europe. Some lights are fishing fleets, oil and gas flares, or fires.</p>
          <p class="cur-cs">Places to look at</p><ul class="aff-list">${ord.map((i) => `<li><button type="button" class="linkbtn" data-c="${i}">${esc(NIGHT[i][0])}</button></li>`).join("")}</ul>${blend}
          <p class="aff-links"><button type="button" class="ghost cs-go" data-q="${measureQS("electricity")}">Colour countries by access to electricity</button></p>`;
      }
      src = "NASA Earth Observatory, Black Marble 2016 (Suomi NPP VIIRS), served by NASA GIBS. NASA images are free to use.";
    } else {
      head = "🪓 Forest loss";
      const f = S.pick != null ? FOREST[S.pick] : null;
      const top = [...W.byIso.values()].filter((r) => typeof r.tree_loss_ha === "number" && r.un_member).sort((a, b) => b.tree_loss_ha - a.tree_loss_ha).slice(0, 8);
      const yr = top[0]?.tree_loss_ha_year || "";
      if (f) {
        const rs = f[3].split(" ").map((c) => W.byIso.get(c)).filter(Boolean);
        body = `${nav(ord.indexOf(S.pick), ord.length, "West", "East")}<div class="aff-one"><h4>${esc(f[0])}</h4><p class="aff-who">${rs.map((r) => `${r.flag || ""} ${esc(r.name)}`).join(", ")}</p><p>${esc(f[4])}</p>
          <ul class="cs-facts">${rs.filter((r) => r.tree_loss_ha).map((r) => `<li>${esc(r.name)}: ${d3.format(",")(Math.round(r.tree_loss_ha))} hectares of tree cover lost in ${r.tree_loss_ha_year}</li>`).join("")}</ul>
          <p class="aff-links"><a href="https://www.globalforestwatch.org/map/" target="_blank" rel="noopener">Global Forest Watch map ↗</a> · ${back("All hotspots")}</p></div>`;
      } else {
        body = `<p class="hint">The world loses millions of hectares of tree cover each year, most of it in the tropics. Forest is cleared for cattle, soya, palm oil, cocoa, mining and small farms; fires are a growing cause. Lost rainforest means lost wildlife, less rain downwind and more carbon dioxide in the air.</p>
          <p class="cur-cs">Hotspots</p><ul class="aff-list">${ord.map((i) => `<li><span class="cf-dot" style="--cf:#b5651d"></span><button type="button" class="linkbtn" data-c="${i}">${esc(FOREST[i][0])}</button></li>`).join("")}</ul>
          <p class="cur-cs">Most tree cover lost${yr ? ` in ${yr}` : ""}</p><ol class="fl-top">${top.map((r) => `<li>${r.flag || ""} ${esc(r.name)} <small>${d3.format(".2s")(r.tree_loss_ha).replace("M", " million").replace("k", " thousand")} ha</small></li>`).join("")}</ol>
          <p class="aff-links"><button type="button" class="ghost cs-go" data-q="${measureQS("tree_loss_pct")}">Colour countries by tree cover lost</button> <button type="button" class="ghost cs-go" data-q="${measureQS("forest_pct")}">… by forest cover</button></p>
          <p class="hint">Tree cover loss includes trees lost to fire and logging that may grow back, so it is not the same as deforestation.</p>`;
      }
      src = "Country figures: Global Forest Watch (Hansen and others, University of Maryland). Hotspot notes: written for this site, checked November 2026.";
    }
    el.innerHTML = `<div class="dsc-head"><h3>${head}</h3><button type="button" class="iconbtn" data-x aria-label="Close">×</button></div>${body}<p class="hint aff-src">${src}</p>`;
    el.querySelector("[data-x]").onclick = () => toggle(which, false);
    el.querySelectorAll("[data-back]").forEach((b) => (b.onclick = () => { S.pick = null; if (which === "cur" || which === "plates") draw(); card(which); }));
    el.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => go(which, which === "plates" ? b.dataset.c : +b.dataset.c)));
    el.querySelectorAll("[data-k]").forEach((b) => (b.onclick = () => { S.kind = b.dataset.k; S.pick = null; card(which); }));
    el.querySelectorAll(".cs-go").forEach((b) => (b.onclick = () => W.applyQS(b.dataset.q)));
    const rg = el.querySelector(".nl-blend input"); if (rg) rg.oninput = () => { S.blend = +rg.value; W.layer("night").style("opacity", S.blend); };
    el.querySelectorAll("[data-step]").forEach((b) => (b.onclick = () => { const o = order(which), j = o.indexOf(S.pick) + +b.dataset.step; if (o[j] != null) go(which, o[j]); }));
    draw();
  }
  async function toggle(which, on) {
    const S = P[which];
    S.on = on ?? !S.on;
    if (S.on && which === "plates") { await loadPM(); if (!PM) S.on = false; }
    if (S.on && which === "night" && !nightImg) {
      S.state = "loading"; card(which);
      try { await loadNight(); S.state = ""; } catch (e) { S.state = "error"; }
    }
    card(which);
  }
  function init() {
    W = window.WC;
    let box = $("#mapbtns");
    if (!box) { box = document.createElement("div"); box.id = "mapbtns"; box.className = "mapbtns"; $("#mapstage").appendChild(box); }
    [["plates", "pmBtn", "🧭 Plate movement"], ["cur", "curBtn", "🌊 Ocean currents"], ["night", "nightBtn", "🌃 Night-time lights"], ["forest", "forestBtn", "🪓 Forest loss"]].forEach(([k, id, t]) => {
      const b = document.createElement("button");
      b.type = "button"; b.id = id; b.className = "mmbtn"; b.setAttribute("aria-pressed", "false"); b.textContent = t;
      b.onclick = () => toggle(k);
      box.appendChild(b);
    });
  }
  window.WEA = { init, draw: () => draw(), zoomed, refresh: () => { Object.keys(P).forEach((k) => { if (P[k].on) card(k); }); }, toggle, _P: P };
})();
