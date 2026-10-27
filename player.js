/* Which Countries? — shared bits for the year players (map, Compare, Charts):
 *   a speed button (½×, 1×, 2×, 4×, remembered), and
 *   "big change" markers: years when a measure changed far more than usual, shown as amber or red marks
 *   on the slider, with a pulsing light and a note when the player reaches them.
 * How a year is judged: for every country, the change from the year before (percentage change for things that
 * are counted, like population; plain change for rates, like life expectancy). The year's median change is compared
 * with the usual median change across all years, and we count how many countries jumped by much more than their own usual.
 *   amber: the typical change was 2–4 times the usual, or 7–15% of countries had an unusual jump
 *   red:   the typical change was over 4 times the usual, or over 15% of countries had an unusual jump */
(function () {
  "use strict";
  const SPEEDS = [0.5, 1, 2, 4];
  let speed = 1;
  try { const s = +localStorage.getItem("wc-speed"); if (SPEEDS.includes(s)) speed = s; } catch (e) { /* storage may be off */ }
  const label = (s) => (s === 0.5 ? "½×" : s + "×");
  function speedHTML(id) { return `<button type="button" class="spd" id="${id}" title="Playing speed: click to change" aria-label="Playing speed ${label(speed)}">${label(speed)}</button>`; }
  function bindSpeed(btn, onChange) {
    if (!btn) return;
    btn.onclick = () => {
      speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
      try { localStorage.setItem("wc-speed", speed); } catch (e) { /* ignore */ }
      document.querySelectorAll(".spd").forEach((b) => { b.textContent = label(speed); b.setAttribute("aria-label", `Playing speed ${label(speed)}`); });
      onChange?.();
    };
  }
  const ms = (base) => Math.round(base / speed);

  // ---------- Big changes ----------
  const cache = new Map();
  function significance(key) {
    if (cache.has(key)) return cache.get(key);
    const W = window.WC, TS = W.TS, YEARS = W.TS_YEARS, f = W.F[key];
    const out = new Map();
    const series = TS[key];
    if (!series || W.CAT_TS[key] || !f) { cache.set(key, out); return out; }
    const counted = window.WCH?.isSum ? window.WCH.isSum(key) : false;
    const rows = W.rows.filter((r) => r.sovereign && series[r.iso3]).map((r) => series[r.iso3]);
    // each country's change from one year to the next
    const delta = (s, i) => {
      const a = s[i - 1], b = s[i];
      if (a == null || b == null) return null;
      if (counted) return a > 0 ? (100 * (b - a)) / a : null;
      return b - a;
    };
    // for each year: the typical size of change across countries (the median of the absolute changes) and its direction
    const size = [], med = [], n = [], all = [];
    for (let i = 1; i < YEARS.length; i++) {
      const ds = rows.map((s) => delta(s, i)).filter((d) => d != null);
      n[i] = ds.length;
      if (ds.length < 20) continue;
      size[i] = d3.median(ds.map(Math.abs));
      med[i] = d3.median(ds);
      all.push(size[i]);
    }
    // a year stands out when its typical change is far from the typical change in other years
    // (a robust z-score: distance from the median, measured in median absolute deviations)
    const meds = med.filter((m) => m != null);
    const typ = d3.median(meds);
    const mad = d3.median(meds.map((m) => Math.abs(m - typ))) || d3.mean(meds.map((m) => Math.abs(m - typ)));
    const usual = d3.median(all);
    if (!mad || !usual) { cache.set(key, out); return out; }
    const score = [];
    for (let i = 1; i < YEARS.length; i++) if (med[i] != null) score[i] = Math.abs(med[i] - typ) / mad;
    const ratios = score.filter((x) => x != null).sort(d3.ascending);
    // at least 3 for amber and 6 for red, and never more than about 1 year in 7
    const amberT = Math.max(3, d3.quantileSorted(ratios, 0.86)), redT = Math.max(6, d3.quantileSorted(ratios, 0.95));
    const own = rows.map((s) => d3.median(YEARS.slice(1).map((y, j) => delta(s, j + 1)).filter((d) => d != null && d !== 0).map(Math.abs)) || 0);
    const num = (d) => (f.format === "usd" && !counted ? `$${d3.format(",")(Math.round(Math.abs(d)))}` : counted ? `${Math.abs(d).toFixed(1)}%` : f.format === "pct" ? `${Math.abs(d) < 1 ? Math.abs(d).toFixed(2) : Math.abs(d).toFixed(1)} percentage points` : `${+Math.abs(d).toPrecision(2)}${f.format === "years" || /expectancy|age/.test(key) ? " years" : ""}`);
    for (let i = 1; i < YEARS.length; i++) {
      if (score[i] == null) continue;
      const ratio = score[i];
      const level = ratio >= redT ? 2 : ratio >= amberT ? 1 : 0;
      if (!level) continue;
      let up = 0, down = 0;
      rows.forEach((s, k) => { const d = delta(s, i); if (d != null && own[k] && Math.abs(d) > 4 * own[k]) d < 0 ? down++ : up++; });
      const dir = med[i] < 0 ? "fell" : med[i] > 0 ? "rose" : "changed";
      const usualTxt = `${typ < 0 ? "a fall" : typ > 0 ? "a rise" : "no change"}${typ ? ` of ${num(typ)}` : ""}`;
      let text = `${YEARS[i]}: ${f.short || f.label} ${dir} by ${num(med[i])} in the typical country, against ${usualTxt} in a usual year.`;
      if (up + down >= 5) text += ` ${down >= up ? `${down} countries had an unusually big drop` : `${up} countries had an unusually big rise`}.`;
      out.set(YEARS[i], { level, text });
    }
    cache.set(key, out);
    return out;
  }
  // several measures at once: keep the bigger level for each year
  function merged(keys) {
    const m = new Map();
    for (const k of keys) for (const [y, s] of significance(k)) {
      const cur = m.get(y);
      if (!cur) m.set(y, { level: s.level, text: s.text });
      else m.set(y, { level: Math.max(cur.level, s.level), text: cur.text + " " + s.text });
    }
    return m;
  }
  // marks above a slider (an <input type=range>), from min to max
  function marks(input, sig) {
    if (!input) return;
    let box = input.parentElement.querySelector(":scope > .ymarks");
    if (!box) {
      input.parentElement.classList.add("hasmarks");
      box = document.createElement("div");
      box.className = "ymarks";
      input.parentElement.insertBefore(box, input);
    }
    const lo = +input.min, hi = +input.max;
    box.style.left = input.offsetLeft + "px";
    box.style.width = input.offsetWidth + "px";
    box.innerHTML = [...sig].filter(([y]) => y >= lo && y <= hi && hi > lo)
      .map(([y, s]) => `<span class="ym l${s.level}" style="left:calc(${((y - lo) / (hi - lo)) * 100}% + ${8 - ((y - lo) / (hi - lo)) * 16}px)" title="${s.text.replace(/"/g, "&quot;")}"></span>`).join("");
  }
  // the light and note for the year being shown
  function light(el, sig, year) {
    if (!el) return;
    const s = year != null ? sig.get(year) : null;
    el.hidden = !s;
    if (!s) return;
    el.className = `ysig l${s.level}`;
    el.innerHTML = `<span class="ydot" aria-hidden="true"></span><span class="ytxt">${s.level === 2 ? "Big change" : "Unusual change"}</span>`;
    el.title = s.text;
  }
  window.WPL = { speedHTML, bindSpeed, ms, significance, merged, marks, light, get speed() { return speed; } };
})();
