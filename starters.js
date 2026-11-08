/* Lesson starters (v69): three questions for each layer in More on the map, shown in a fold-open box at the
   bottom of the layer's box on the map, with a button to copy them for a slide or worksheet. */
(function () {
  "use strict";
  const Q = {
    liveCard: ["Describe the distribution of this week's earthquakes.", "Switch to the Physical map: how far do the plate boundaries explain the pattern?", "Choose one disaster alert. Suggest how its effects might differ in a high-income and a low-income country."],
    cgCard: ["Describe where the fastest-growing cities are.", "Explain two reasons why cities in lower-income countries are growing so fast.", "Compare how London and Lagos grew between 1975 and 2025, and how they are expected to grow to 2050."],
    climCard: ["Describe the climate graph: the hottest and coldest months, the temperature range and when most rain falls.", "Compare two stations in different climate zones.", "Explain why the wettest months come when they do."],
    rgCard: ["Which country has the biggest gap between its richest and poorest regions?", "Describe the pattern of the HDI within one country.", "Suggest three reasons for inequality between regions of the same country."],
    dispCard: ["For one dispute, outline who claims the land and why.", "Why do the borders drawn on a map matter, and who decides them?", "Suggest how a border dispute can affect the people who live there."],
    confCard: ["Describe the distribution of the world's current conflicts.", "Choose one conflict: explain its causes and its effects on development.", "Explain how conflict can lead to migration, and where people go."],
    elecCard: ["Which of the world's ten most populous countries vote in the next year?", "Why might an election in one country matter to people in other countries?", "Add the democracy filter: are all of these elections free and fair?"],
    csCard: ["Choose a case study: use its key facts to explain its causes, effects and responses.", "Compare two hazard case studies in countries at different levels of development.", "Evaluate how well people responded to one of the case studies."],
    shipCard: ["Why are chokepoints so important to world trade?", "Explain how closing the Strait of Hormuz or Bab-el-Mandeb affects oil prices, and people in the UK.", "Suggest why ports such as Singapore and Rotterdam became so busy."],
    cycCard: ["Describe the distribution of tropical cyclones.", "Explain why tropical cyclones do not form on the equator.", "Compare the number of category 4 and 5 storms in the 1980s and the 2020s. What might explain the difference?"],
    protCard: ["How close is the UK to protecting 30% of its land and 30% of its sea?", "Evaluate the benefits and costs of a national park for the people who live in or near it.", "Why are marine reserves harder to protect than reserves on land?"],
    pmCard: ["Find a place where plates move apart and a place where they move together.", "Explain why Iceland has volcanoes and Japan has both volcanoes and big earthquakes.", "Which plate moves fastest? Suggest what is happening at its edges."],
    curCard: ["Explain how the Gulf Stream and North Atlantic Drift affect the UK's climate.", "Why are there deserts on the west coasts of South America and southern Africa?", "Explain how El Niño affects fishing in Peru."],
    nightCard: ["Describe the difference between North and South Korea at night. What does it tell you?", "What can night-time lights tell us about development, and what can't they?", "Find three places where the lights follow a river, a coast or a railway. Explain why."],
    forestCard: ["Describe the distribution of the deforestation hotspots.", "Choose one hotspot: explain the causes and who benefits.", "Evaluate two ways of reducing deforestation (for example protected areas, or not buying products from cleared land)."],
    cabCard: ["Describe the pattern of the world's undersea cables. Which areas have fewest?", "Why is a country with only one cable vulnerable?", "Big tech companies now own many new cables. Why might that matter?"],
    whsCard: ["Describe the distribution of World Heritage Sites. Why does Europe have so many?", "Explain the advantages and disadvantages of World Heritage status for a place.", "Choose a natural site: what threatens it, and how could it be protected?"],
    minCard: ["Which countries mine most of each mineral? Why might that worry other countries?", "Explain the costs and benefits of mining for a country such as the DR Congo or Chile.", "How is the switch to electric cars and renewable energy changing the demand for minerals?"],
    briCard: ["Describe the distribution of China's overseas lending.", "Choose one big project: evaluate its benefits and risks for the country receiving it.", "How does lending help China gain influence as a superpower?"],
    waterCard: ["Why do countries upstream and downstream on a river often disagree?", "Choose one river: explain the views of the different countries that share it.", "Suggest how water could be shared fairly. Use the cooperation examples."],
    firesCard: ["Describe where most fires are burning today.", "Explain why the pattern of fires changes through the year.", "What is the difference between farmers' fires and wildfires, and why are wildfires increasing?"],
    iceCard: ["By how much has September sea ice shrunk since 1980?", "Explain how melting ice can speed up warming (the albedo feedback).", "Who might gain and who might lose from an ice-free Arctic?"],
    colCard: ["When did most African countries gain independence? Use the slider.", "How might colonial history help explain borders, languages and trade links today?", "Compare the size of the British and French empires in 1914 and in 1960."],
  };
  const open = {};
  function add(card) {
    const qs = Q[card.id];
    if (!qs || card.hidden || card.querySelector(".lq")) return;
    const d = document.createElement("details");
    d.className = "lq"; d.open = !!open[card.id];
    d.innerHTML = `<summary>💬 Lesson starters</summary><ol>${qs.map((q) => `<li>${q}</li>`).join("")}</ol><button type="button" class="ghost lq-copy">Copy the questions</button>`;
    d.addEventListener("toggle", () => (open[card.id] = d.open));
    d.querySelector(".lq-copy").onclick = async (e) => {
      const b = e.currentTarget, title = card.querySelector(".dsc-head h3")?.textContent.trim() || "";
      try { await navigator.clipboard.writeText(`${title}\n${qs.map((q, i) => `${i + 1}. ${q}`).join("\n")}`); b.textContent = "Copied ✓"; } catch (_) { b.textContent = "Couldn't copy"; }
      setTimeout(() => (b.textContent = "Copy the questions"), 1600);
    };
    const src = card.querySelector(".aff-src");
    src ? card.insertBefore(d, src) : card.appendChild(d);
  }
  let queued = false;
  function scan() { queued = false; Object.keys(Q).forEach((id) => { const c = document.getElementById(id); if (c) add(c); }); }
  function init() {
    const stage = document.getElementById("mapstage") || document.body;
    new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(scan); } }).observe(stage, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    scan();
  }
  window.WSQ = { init, questions: Q };
})();
