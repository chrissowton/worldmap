/* Which Countries? — My worksheet: collect maps, charts, country facts, quiz questions and number-hunt posters
 * with "＋" buttons as you go, then print them as a worksheet (with space for answers and an optional answer key).
 * Kept in this browser only (localStorage), so there's no account; it stays until you clear it.
 * Loaded after app.js; uses window.WC (app.js) and window.WV (views.js). */
(function () {
  "use strict";
  const KEY = "wc-worksheet";
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const strip = (h) => { const d = document.createElement("div"); d.innerHTML = h; return d.textContent.replace(/\s+/g, " ").trim(); };
  let ws = load();

  function load() {
    try { return Object.assign({ title: "Geography worksheet", items: [], answers: false }, JSON.parse(localStorage.getItem(KEY) || "{}")); }
    catch (e) { return { title: "Geography worksheet", items: [], answers: false }; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(ws)); return true; }
    catch (e) { toast("Your worksheet is full: remove a picture or two, then try again."); return false; }
  }
  function count() { const b = $("#wsBtn"); if (b) b.querySelector(".wsn").textContent = ws.items.length ? ` (${ws.items.length})` : ""; }
  function toast(t) {
    let el = $("#wsToast");
    if (!el) { el = document.createElement("div"); el.id = "wsToast"; el.className = "wstoast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.innerHTML = t;
    el.classList.add("on");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove("on"), 2600);
  }
  function add(item) {
    item.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    item.lines ??= item.type === "question" ? 2 : 3;
    item.note ??= "";
    ws.items.push(item);
    if (!save()) { ws.items.pop(); return; }
    count();
    toast(`Added to your worksheet (${ws.items.length}). <button type="button" class="linkbtn" id="wsToastOpen">Open it</button>`);
    $("#wsToastOpen").onclick = open;
  }

  // ---------- Things that can be added ----------
  async function picture(svgEl, bg) {
    const cv = await window.WV.svgToCanvas(svgEl, 1.4, bg);
    // a JPEG keeps the saved worksheet small
    const out = document.createElement("canvas");
    const k = Math.min(1, 1400 / cv.width);
    out.width = Math.round(cv.width * k); out.height = Math.round(cv.height * k);
    const ctx = out.getContext("2d");
    ctx.fillStyle = bg || "#ffffff"; ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(cv, 0, 0, out.width, out.height);
    return out.toDataURL("image/jpeg", 0.85);
  }
  async function addView() {
    const W = window.WC, view = W.state.view;
    const source = window.WV?.currentSource?.() || "";
    try {
      if (view === "insights") {
        const head = $("#viewwrap .ihead")?.textContent.trim() || "Insights";
        const rows = [...document.querySelectorAll("#viewwrap .irow, #viewwrap .ilink")].slice(0, 10).map((r) => r.innerText.replace(/\s*\n\s*/g, " · ").trim());
        return add({ type: "text", title: head, list: rows, source });
      }
      const svgEl = view === "map" ? W.mapSVG() : $("#vsvg");
      if (!svgEl) return;
      const bg = getComputedStyle(document.documentElement).getPropertyValue(view === "map" ? "--ocean" : "--surface").trim() || "#ffffff";
      const img = await picture(svgEl, bg);
      const title = view === "map" ? ($("#sentence")?.textContent || "World map").replace(/Clear all$/, "").trim() : window.WV_H?.V?.title || "Chart";
      add({ type: "view", title, img, source });
    } catch (e) { console.error(e); toast("Sorry, that couldn't be added in this browser."); }
  }
  function addCountry(iso) {
    const W = window.WC, r = W.byIso.get(iso);
    if (!r) return;
    const box = $("#results .pkeys");
    const facts = box ? [...box.querySelectorAll("dt")].map((dt) => [dt.textContent.trim(), dt.nextElementSibling?.textContent.trim() || ""]) : [];
    add({ type: "facts", title: `${r.name}: key facts`, facts });
  }
  function addQuestion(q, topic) {
    if (!q) return;
    const answer = q.explain ? strip(q.explain()) : "";
    add({ type: "question", title: topic || "Question", text: q.text, options: (q._opts || []).map((o) => o.label), answer });
  }
  async function addSVG(svgEl, title, bg) {
    try { add({ type: "view", title, img: await picture(svgEl, bg || "#ffffff"), source: "" }); }
    catch (e) { toast("Sorry, that couldn't be added in this browser."); }
  }

  // ---------- The worksheet itself ----------
  function open() {
    let el = $("#worksheet");
    if (!el) {
      el = document.createElement("div");
      el.id = "worksheet"; el.className = "ff-overlay ws-overlay"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "My worksheet");
      document.body.appendChild(el);
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !el.hidden) close(); });
    }
    el.hidden = false;
    draw();
  }
  function close() { const el = $("#worksheet"); if (el) el.hidden = true; }
  function draw() {
    const el = $("#worksheet");
    const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const lines = (n) => (n ? `<div class="ws-lines">${"<span></span>".repeat(n)}</div>` : "");
    const itemHTML = (it, i) => {
      let body = "";
      if (it.type === "view") body = `<img src="${it.img}" alt="${esc(it.title)}">${it.source ? `<p class="ws-src">${esc(it.source)}</p>` : ""}`;
      else if (it.type === "facts") body = `<dl class="ws-facts">${it.facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`;
      else if (it.type === "question") body = `<p class="ws-q">${esc(it.text)}</p>${it.showOpts && it.options?.length ? `<ol class="ws-opts" type="A">${it.options.map((o) => `<li>${esc(o)}</li>`).join("")}</ol>` : ""}`;
      else if (it.type === "text") body = `<ul class="ws-list">${(it.list || []).map((l) => `<li>${esc(l)}</li>`).join("")}</ul>${it.source ? `<p class="ws-src">${esc(it.source)}</p>` : ""}`;
      return `<section class="ws-item" data-id="${it.id}">
        <div class="ws-tools no-print">
          <button type="button" class="iconbtn" data-a="up" aria-label="Move up" ${i ? "" : "disabled"}>↑</button>
          <button type="button" class="iconbtn" data-a="down" aria-label="Move down" ${i < ws.items.length - 1 ? "" : "disabled"}>↓</button>
          <label>Answer lines <select data-a="lines">${[0, 2, 3, 5, 8].map((n) => `<option ${n === it.lines ? "selected" : ""}>${n}</option>`).join("")}</select></label>
          ${it.type === "question" && it.options?.length ? `<label><input type="checkbox" data-a="opts" ${it.showOpts ? "checked" : ""}> Show the options</label>` : ""}
          <button type="button" class="iconbtn ws-del" data-a="del" aria-label="Remove">✕</button>
        </div>
        <h3><span class="ws-n">${i + 1}.</span> <span class="ws-t" contenteditable="true" data-a="title">${esc(it.title)}</span></h3>
        ${body}
        <div class="ws-note" contenteditable="true" data-a="note" data-ph="Add a question or instruction for this (optional)…">${esc(it.note)}</div>
        ${lines(it.lines)}
      </section>`;
    };
    const key = ws.items.map((it, i) => (it.type === "question" && it.answer ? `<li value="${i + 1}">${esc(it.answer)}</li>` : "")).join("");
    el.innerHTML = `<div class="ff-bar no-print">
        <h2 class="ws-h">📋 My worksheet</h2>
        <div class="ff-actions">
          <label class="tog"><input type="checkbox" id="wsKey" ${ws.answers ? "checked" : ""}> Print the answer key</label>
          <button type="button" class="primary" id="wsPrint" ${ws.items.length ? "" : "disabled"}>Print or save as PDF</button>
          <button type="button" class="ghost" id="wsClear" ${ws.items.length ? "" : "disabled"}>Clear</button>
          <button type="button" class="ghost" id="wsClose">Close</button>
        </div></div>
      <div class="ff-scroll"><article class="ffdoc wsdoc">
        <header class="ws-head"><h1 contenteditable="true" id="wsTitle">${esc(ws.title)}</h1>
          <p class="ws-name">Name: <span></span> Date: <span></span></p></header>
        ${ws.items.length ? ws.items.map(itemHTML).join("") : `<div class="ws-empty no-print"><p><b>Your worksheet is empty.</b> Use the <b>＋</b> buttons around the site to collect things for it:</p>
          <ul><li><b>＋ Add to worksheet</b> in the left panel adds the map or chart on screen (with its title and source)</li>
          <li><b>＋ Worksheet</b> in the quiz card adds the question (the answer goes in the answer key)</li>
          <li><b>＋ Worksheet</b> in a country's profile adds its key facts</li>
          <li><b>＋ Worksheet</b> in the Number hunt adds the poster</li></ul>
          <p>It is kept in this browser until you clear it, and you can add a question or instruction to each part before printing.</p></div>`}
        ${ws.answers && key ? `<section class="ws-key"><h3>Answer key</h3><ol>${key}</ol></section>` : ""}
        <p class="ws-foot">Made with Which Countries? (chrissowton.github.io/worldmap) on ${today}.</p>
      </article></div>`;
    $("#wsClose").onclick = close;
    $("#wsPrint").onclick = () => { document.body.classList.add("print-ws"); const t = document.title; document.title = ws.title; window.print(); document.title = t; setTimeout(() => document.body.classList.remove("print-ws"), 500); };
    $("#wsClear").onclick = () => { if (confirmClear()) { ws.items = []; save(); count(); draw(); } };
    $("#wsKey").onchange = (e) => { ws.answers = e.target.checked; save(); draw(); };
    $("#wsTitle").oninput = (e) => { ws.title = e.target.textContent.trim() || "Geography worksheet"; save(); };
    el.querySelectorAll(".ws-item").forEach((sec) => {
      const it = ws.items.find((x) => x.id === sec.dataset.id), i = ws.items.indexOf(it);
      sec.querySelector("[data-a=up]").onclick = () => { ws.items.splice(i - 1, 0, ws.items.splice(i, 1)[0]); save(); draw(); };
      sec.querySelector("[data-a=down]").onclick = () => { ws.items.splice(i + 1, 0, ws.items.splice(i, 1)[0]); save(); draw(); };
      sec.querySelector("[data-a=del]").onclick = () => { ws.items.splice(i, 1); save(); count(); draw(); };
      sec.querySelector("[data-a=lines]").onchange = (e) => { it.lines = +e.target.value; save(); draw(); };
      const o = sec.querySelector("[data-a=opts]"); if (o) o.onchange = (e) => { it.showOpts = e.target.checked; save(); draw(); };
      sec.querySelector("[data-a=title]").oninput = (e) => { it.title = e.target.textContent.trim(); save(); };
      sec.querySelector("[data-a=note]").oninput = (e) => { it.note = e.target.textContent; save(); };
    });
  }
  // the page may be inside a frame where confirm() is blocked: then just clear
  function confirmClear() { try { return window.confirm("Remove everything from your worksheet?"); } catch (e) { return true; } }

  // ---------- Buttons ----------
  let inited = false;
  function init() {
    if (inited) return;
    inited = true;
    const tools = $("#cpLearn");
    if (tools) {
      const a = document.createElement("button");
      a.type = "button"; a.id = "wsAdd"; a.className = "cp-tool"; a.title = "Add the map or chart on screen to your worksheet";
      a.innerHTML = `<span class="cp-ic" aria-hidden="true">＋</span>Add to worksheet`;
      a.onclick = addView;
      const b = document.createElement("button");
      b.type = "button"; b.id = "wsBtn"; b.className = "cp-tool"; b.title = "See, arrange and print what you've collected";
      b.innerHTML = `<span class="cp-ic" aria-hidden="true">📋</span>Worksheet<span class="wsn"></span>`;
      b.onclick = open;
      tools.append(a, b);
    }
    count();
  }
  window.WK = { init, add, addView, addCountry, addQuestion, addSVG, open };
})();
