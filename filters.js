/*
 * Filter definitions for Which Countries?
 *
 * Each entry describes one characteristic. The interface is generated from
 * this list, so adding a characteristic is: add a field to data/countries.json
 * (see scripts/build_data.py), then add an entry here.
 *
 *   key       field name in countries.json
 *   type      "range" (numbers), "multi" (lists, e.g. languages),
 *             "cat" (one value per country), "bool" (yes / no)
 *   group     heading in the "Add a filter" menu
 *   label     name shown in menus and chips
 *   short     shorter chip label (optional)
 *   say       how the filter reads in the sentence "Showing N countries where …"
 *   source    key into SOURCES (bottom of file)
 *   year      field holding the data year, or a fixed year
 *   info      one or two sentences explaining what it measures
 *   keywords  extra words people might type to find it
 *
 * Range filters also take:
 *   scale     "linear" or "log"
 *   step      rounding for linear scales
 *   format    "pct" | "people" | "usd" | "index" | "km2" | "tonnes" | "int"
 *   initial   { min, max } applied when the filter is first added
 */

/* Links shown under the results. Leave blank to hide. */
window.SITE = {
  github: "",   // e.g. "https://github.com/your-name/which-countries"
  donate: "",   // e.g. "https://opencollective.com/which-countries" or a Ko-fi page
};

window.FILTER_GROUPS = ["People", "Beliefs", "Politics", "Economy", "Geography", "Environment", "Fun"];

window.FILTERS = [
  // People
  {
    key: "official_languages", type: "multi", group: "People",
    label: "Official language", short: "Official",
    say: (v) => `${v} is an official language`,
    source: "countries", info: "Languages with official or national status in law or the constitution.",
    keywords: "language speak spoken tongue official national",
  },
  {
    key: "spoken_languages", type: "multi", group: "People",
    label: "Language spoken by 10%+", short: "Spoken",
    say: (v) => `at least 10% of people speak ${v}`,
    source: "cldr", info: "Languages spoken by at least 10% of the population, including as a second language. Estimates from the Unicode CLDR project.",
    keywords: "language speak spoken second english french spanish",
  },
  {
    key: "population", type: "range", group: "People",
    label: "Population", scale: "log", format: "people",
    say: (b) => `the population is ${b}`,
    source: "worldbank", year: "population_year", info: "Total population, World Bank estimate.",
    keywords: "people size big small inhabitants",
  },

  // Beliefs
  {
    key: "largest_religion", type: "cat", group: "Beliefs",
    label: "Largest religion", short: "Largest religion",
    order: ["Christianity", "Islam", "No religion", "Hinduism", "Buddhism", "Judaism", "Folk religions", "Other religions"],
    say: (v) => `the largest religious group is ${v}`,
    source: "pew", year: 2010, info: "The religious group with the most adherents. 'No religion' covers atheists, agnostics and people with no particular affiliation.",
    keywords: "religion faith belief majority",
  },
  ...[
    ["muslim", "Muslim", "Islam muslim mosque"],
    ["christian", "Christian", "Christianity christian church catholic protestant orthodox"],
    ["unaffiliated", "No religion", "atheist agnostic secular none irreligious"],
    ["hindu", "Hindu", "Hinduism hindu"],
    ["buddhist", "Buddhist", "Buddhism buddhist"],
    ["jewish", "Jewish", "Judaism jewish jew"],
    ["folk", "Folk religion", "traditional folk indigenous animist"],
  ].map(([k, name, kw]) => ({
    key: "pct_" + k, type: "range", group: "Beliefs",
    label: k === "unaffiliated" ? "% with no religion" : `% ${name}`,
    short: k === "unaffiliated" ? "No religion" : name,
    scale: "linear", step: 1, format: "pct", initial: { min: 50, max: 100 },
    say: (b) => k === "unaffiliated" ? `${b} of people have no religion` : `${b} of people are ${name}`,
    source: "pew", year: 2010,
    info: `Share of the population that is ${name === "No religion" ? "religiously unaffiliated" : name}.`,
    keywords: "religion faith belief percent share " + kw,
  })),

  // Politics
  {
    key: "democracy", type: "bool", group: "Politics",
    label: "Democracy", short: "Democracy",
    say: (v) => v ? "the country is a democracy" : "the country is not a democracy",
    yes: "Democracy", no: "Not a democracy",
    source: "vdem", year: "vdem_year",
    info: "Rated an electoral or liberal democracy in V-Dem's Regimes of the World classification. Other indices draw the line differently.",
    keywords: "democratic elections free government politics",
  },
  {
    key: "regime", type: "cat", group: "Politics",
    label: "Regime type", short: "Regime",
    order: ["Liberal democracy", "Electoral democracy", "Electoral autocracy", "Closed autocracy"],
    say: (v) => `the government is rated ${v.toLowerCase()}`,
    source: "vdem", year: "vdem_year",
    info: "V-Dem's Regimes of the World: closed autocracies hold no meaningful multi-party elections; electoral autocracies hold elections that are not free or fair; electoral democracies hold free and fair elections; liberal democracies also protect individual rights and the rule of law.",
    keywords: "government autocracy dictatorship democracy politics system",
  },
  {
    key: "libdem", type: "range", group: "Politics",
    label: "Liberal democracy score", short: "Democracy score",
    scale: "linear", step: 0.01, format: "index",
    say: (b) => `the liberal democracy score is ${b}`,
    source: "vdem", year: "vdem_year",
    info: "V-Dem Liberal Democracy Index, from 0 (least) to 1 (most democratic). Combines free elections with civil liberties, rule of law and checks on government.",
    keywords: "democracy index score rating freedom",
  },
  {
    key: "free_expression", type: "range", group: "Politics",
    label: "Freedom of expression", short: "Free expression",
    scale: "linear", step: 0.01, format: "index",
    say: (b) => `freedom of expression scores ${b}`,
    source: "vdem", year: "vdem_year",
    info: "V-Dem index of freedom of expression and alternative sources of information, from 0 to 1. Covers press freedom, censorship and academic freedom.",
    keywords: "press media freedom speech censorship journalism",
  },
  {
    key: "un_member", type: "bool", group: "Politics",
    label: "UN member", short: "UN member",
    say: (v) => v ? "the country is a UN member" : "the country is not a UN member",
    yes: "UN member", no: "Not a UN member",
    source: "countries", info: "Full member state of the United Nations.",
    keywords: "united nations un member recognised",
  },

  // Economy
  {
    key: "gdp_per_capita", type: "range", group: "Economy",
    label: "GDP per person", scale: "log", format: "usd",
    say: (b) => `GDP per person is ${b}`,
    source: "worldbank", year: "gdp_year",
    info: "Gross domestic product divided by population, in current US dollars. A rough measure of average income; it ignores how income is shared.",
    keywords: "rich poor wealth income money gdp economy",
  },
  {
    key: "currencies", type: "multi", group: "Economy",
    label: "Currency", short: "Currency",
    say: (v) => `people pay in the ${v}`,
    source: "countries", info: "Currencies in official use.",
    keywords: "money currency euro dollar pound franc",
  },

  // Geography
  {
    key: "region", type: "cat", group: "Geography",
    label: "Continent", short: "Continent",
    order: ["Africa", "Americas", "Asia", "Europe", "Oceania", "Antarctic"],
    say: (v) => `the country is in ${v.replace("Americas", "the Americas")}`,
    source: "countries", info: "UN geoscheme region.",
    keywords: "continent region africa asia europe americas oceania",
  },
  {
    key: "subregion", type: "cat", group: "Geography",
    label: "Sub-region", short: "Sub-region",
    say: (v) => `the country is in ${v}`,
    source: "countries", info: "UN geoscheme sub-region, such as Western Africa or South-Eastern Asia.",
    keywords: "region area part caribbean middle east",
  },
  {
    key: "landlocked", type: "bool", group: "Geography",
    label: "Landlocked", short: "Landlocked",
    say: (v) => v ? "the country is landlocked" : "the country has a coastline",
    yes: "Landlocked", no: "Has a coastline",
    source: "countries", info: "No coastline on the open sea.",
    keywords: "coast sea ocean coastline landlocked",
  },
  {
    key: "no_land_borders", type: "bool", group: "Geography",
    label: "Island (no land borders)", short: "Island",
    say: (v) => v ? "the country has no land borders" : "the country has land borders",
    yes: "No land borders", no: "Has land borders",
    source: "countries", info: "Shares no land border with another country. Mostly island nations.",
    keywords: "island borders isolated archipelago",
  },
  {
    key: "neighbours", type: "range", group: "Geography",
    label: "Number of neighbours", short: "Neighbours",
    scale: "linear", step: 1, format: "int",
    say: (b) => `the number of neighbouring countries is ${b}`,
    source: "countries", info: "Countries that share a land border.",
    keywords: "borders neighbours neighbors bordering",
  },
  {
    key: "area_km2", type: "range", group: "Geography",
    label: "Land area", short: "Area", scale: "log", format: "km2",
    say: (b) => `the area is ${b}`,
    source: "countries", info: "Total area in square kilometres.",
    keywords: "size big small area large",
  },

  // Environment
  {
    key: "co2_per_capita", type: "range", group: "Environment",
    label: "CO₂ per person", short: "CO₂", scale: "log", format: "tonnes",
    say: (b) => `CO₂ emissions per person are ${b}`,
    source: "owid", year: "co2_year",
    info: "Annual carbon dioxide emissions from fossil fuels and industry, in tonnes per person. Excludes land-use change.",
    keywords: "carbon emissions climate pollution co2 environment",
  },

  // Fun
  {
    key: "driving_side", type: "cat", group: "Fun",
    label: "Side of the road", short: "Drives",
    order: ["Left", "Right"],
    say: (v) => `people drive on the ${v.toLowerCase()}`,
    source: "driving", info: "Which side of the road traffic keeps to.",
    keywords: "driving drive road car left right traffic",
  },
];

window.SOURCES = {
  countries: { name: "mledoze/countries", url: "https://github.com/mledoze/countries", licence: "ODbL 1.0" },
  cldr: { name: "Unicode CLDR territory data", url: "https://cldr.unicode.org/", licence: "Unicode License" },
  worldbank: { name: "World Bank World Development Indicators", url: "https://data.worldbank.org/", licence: "CC BY 4.0" },
  pew: { name: "Pew Research Center, Global Religious Landscape (2010 estimates)", url: "https://www.pewresearch.org/religion/2012/12/18/global-religious-landscape-exec/", licence: "Pew terms of use; attribution required" },
  vdem: { name: "V-Dem Institute, Varieties of Democracy", url: "https://v-dem.net/", licence: "CC BY-SA 4.0" },
  owid: { name: "Our World in Data, CO₂ dataset", url: "https://github.com/owid/co2-data", licence: "CC BY 4.0" },
  driving: { name: "samayo/country-json", url: "https://github.com/samayo/country-json", licence: "MIT" },
  boundaries: { name: "Natural Earth via world-atlas", url: "https://github.com/topojson/world-atlas", licence: "Public domain" },
};

/* Ready-made questions shown before any filter is set. */
window.STARTERS = [
  { title: "Portuguese-speaking countries", filters: [{ key: "official_languages", values: ["Portuguese"] }] },
  { title: "Muslim-majority democracies", filters: [{ key: "pct_muslim", min: 50, max: 100 }, { key: "democracy", value: true }] },
  { title: "Landlocked democracies", filters: [{ key: "landlocked", value: true }, { key: "democracy", value: true }] },
  { title: "Drive on the left, outside Asia", filters: [{ key: "driving_side", values: ["Left"] }, { key: "region", values: ["Africa", "Americas", "Europe", "Oceania"] }] },
  { title: "Wealthy but low-emission", filters: [{ key: "gdp_per_capita", min: 30000 }, { key: "co2_per_capita", max: 5 }] },
  { title: "Islands where English is official", filters: [{ key: "no_land_borders", value: true }, { key: "official_languages", values: ["English"] }] },
];

/* Puzzles for "Question of the day". Only puzzles with 1–8 answers in the current data are shown. */
window.PUZZLES = [
  { q: "Find a country that is majority Buddhist and a democracy.", filters: [{ key: "pct_buddhist", min: 50, max: 100 }, { key: "democracy", value: true }] },
  { q: "Find a landlocked country where most people are Muslim and the government is a democracy.", filters: [{ key: "landlocked", value: true }, { key: "pct_muslim", min: 50, max: 100 }, { key: "democracy", value: true }] },
  { q: "Which countries in Africa drive on the left and are democracies?", filters: [{ key: "region", values: ["Africa"] }, { key: "driving_side", values: ["Left"] }, { key: "democracy", value: true }] },
  { q: "Find a country where French is an official language outside Europe and Africa.", filters: [{ key: "official_languages", values: ["French"] }, { key: "region", values: ["Americas", "Asia", "Oceania"] }] },
  { q: "Which countries have more than 10 neighbours?", filters: [{ key: "neighbours", min: 11 }] },
  { q: "Find a country where most people have no religion.", filters: [{ key: "pct_unaffiliated", min: 50, max: 100 }] },
  { q: "Find a Spanish-speaking country with a GDP per person above $20,000.", filters: [{ key: "official_languages", values: ["Spanish"] }, { key: "gdp_per_capita", min: 20000 }] },
  { q: "Which island nations are closed autocracies?", filters: [{ key: "no_land_borders", value: true }, { key: "regime", values: ["Closed autocracy"] }] },
  { q: "Find a country with more than 100 million people that is a liberal democracy.", filters: [{ key: "population", min: 1e8 }, { key: "regime", values: ["Liberal democracy"] }] },
  { q: "Where is Arabic official but Islam not the religion of most people?", filters: [{ key: "official_languages", values: ["Arabic"] }, { key: "pct_muslim", min: 0, max: 50 }] },
];
