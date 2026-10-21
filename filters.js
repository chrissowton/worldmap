/*
 * Filter definitions for Which Countries?
 *
 * Each entry describes one characteristic. The interface is generated from
 * this list, so adding a characteristic is: add a field to countries.json
 * (see build_data.py), then add an entry here.
 *
 *   key       field name in countries.json (or cities.json for target: "city")
 *   type      "range" (numbers), "multi" (lists, e.g. languages),
 *             "cat" (one value per country), "bool" (yes / no)
 *   group     heading in the "Add a filter" menu
 *   label     name shown in menus and chips
 *   short     shorter chip label (optional)
 *   say       how the filter reads in the sentence "Showing N countries where …"
 *   source    key into SOURCES (bottom of file)
 *   year      field holding the data year, or a fixed year
 *   info      one or two plain sentences explaining what it measures
 *   keywords  extra words people might type to find it
 *   target    "city" for filters that apply to cities rather than countries
 *
 * Range filters also take:
 *   scale     "linear" or "log"
 *   step      rounding for linear scales
 *   format    "pct" | "people" | "usd" | "index" | "km2" | "tonnes" | "int" |
 *             "dec1" | "dec2" | "years" | "rank" | "per1000" | "per100k"
 *   bounds    [min, max] fixed ends for the slider (e.g. [0, 100] for shares)
 *   clip      true to set the slider ends at the 2nd and 98th percentile, so a
 *             few extreme values don't squash everyone else. The ends of the
 *             slider always mean "no limit".
 *   initial   { min, max } applied when the filter is first added
 */

/* Links shown under the results. Leave blank to hide. */
window.SITE = {
  github: "",   // e.g. "https://github.com/your-name/worldmap"
  donate: "",   // e.g. "https://opencollective.com/which-countries" or a Ko-fi page
};

window.FILTER_GROUPS = [
  "Development", "Population", "Health", "Gender", "Work & money",
  "Global links", "Cities", "Culture", "Politics", "Geography", "Environment",
];

// Helper for number filters. `say` gets a phrase like "at least 50%".
const num = (key, group, label, o) => ({ key, group, label, type: "range", scale: "linear", step: 1, source: "worldbank", year: key + "_year", ...o });

window.FILTERS = [
  // ---------------- Development ----------------
  {
    key: "income_group", type: "cat", group: "Development",
    label: "Income group", short: "Income",
    order: ["Low income", "Lower-middle income", "Upper-middle income", "High income"],
    say: (v) => `the World Bank rates it ${v.toLowerCase()}`,
    source: "worldbank", yearText: "2026–27",
    info: "The World Bank sorts countries into four groups by average income (GNI per person). These groups apply from July 2026.",
    keywords: "rich poor wealth development hic lic mic income level classification",
  },
  num("hdi", "Development", "Human Development Index (HDI)", {
    short: "HDI", step: 0.01, format: "dec3", bounds: [0.3, 1], source: "undp", year: "hdi_year",
    say: (b) => `the HDI score is ${b}`,
    info: "A score from 0 to 1 combining life expectancy, years of schooling and income. Higher means more developed.",
    keywords: "hdi development human undp index wellbeing",
  }),
  num("hdi_rank", "Development", "HDI rank", {
    short: "HDI rank", format: "rank", source: "undp", year: "hdi_rank_year",
    say: (b) => `the country ranks ${b} for human development`,
    info: "Position in the world on the HDI, where 1 is the highest. Countries with the same score share a rank.",
    keywords: "hdi rank ranking position development league table",
  }),
  {
    key: "hdi_group", type: "cat", group: "Development",
    label: "Human development group", short: "HDI group",
    order: ["Very high", "High", "Medium", "Low"],
    say: (v) => `human development is rated ${v.toLowerCase()}`,
    source: "undp", year: "hdi_year",
    info: "UNDP's four groups. Very high: HDI of 0.800 or more. High: 0.700 to 0.799. Medium: 0.550 to 0.699. Low: under 0.550.",
    keywords: "hdi group category very high low medium development level",
  },
  num("ihdi", "Development", "HDI adjusted for inequality", {
    short: "IHDI", step: 0.01, format: "dec3", bounds: [0.2, 1], source: "undp",
    say: (b) => `the inequality-adjusted HDI is ${b}`,
    info: "The HDI after taking account of how unequally health, education and income are shared. The bigger the gap from the HDI, the more unequal the country.",
    keywords: "ihdi inequality adjusted hdi development unequal",
  }),
  num("hdi_loss", "Development", "HDI lost to inequality", {
    short: "HDI loss", step: 0.5, format: "pct", bounds: [0, 50], source: "undp",
    say: (b) => `inequality reduces the HDI by ${b}`,
    info: "How much lower the HDI is once inequality is taken into account, as a percentage.",
    keywords: "inequality loss ihdi hdi unequal",
  }),
  num("mean_schooling", "Development", "Years in school (adults)", {
    short: "Years of school", step: 0.5, format: "years", source: "undp",
    say: (b) => `adults have spent ${b} in school on average`,
    info: "Average number of years of education received by people aged 25 and over. Part of the HDI.",
    keywords: "education schooling school years mean years of schooling",
  }),
  num("expected_schooling", "Development", "Expected years in school (children)", {
    short: "Expected school", step: 0.5, format: "years", source: "undp",
    say: (b) => `children can expect ${b} of school`,
    info: "Years of schooling a child starting school now can expect to receive. Part of the HDI.",
    keywords: "education schooling school years expected children",
  }),
  num("gni_ppp", "Development", "Income per person", {
    short: "Income", scale: "log", format: "usd",
    say: (b) => `income per person is ${b}`,
    info: "Gross national income per person, adjusted for what money buys locally (PPP, international dollars). A fairer comparison of living standards than GDP in US dollars.",
    keywords: "gni ppp income per capita wealth rich poor purchasing power",
  }),
  num("gini", "Development", "Income inequality (Gini)", {
    short: "Gini", step: 0.5, format: "dec1", bounds: [20, 65],
    say: (b) => `the Gini coefficient is ${b}`,
    info: "How unequally income is shared, from 0 (everyone has the same) to 100 (one person has everything). Above 40 is usually seen as high inequality.",
    keywords: "gini inequality unequal income distribution gap",
  }),
  num("extreme_poverty", "Development", "Living in extreme poverty", {
    short: "Extreme poverty", step: 0.5, format: "pct", bounds: [0, 100], clip: true,
    say: (b) => `${b} of people live on under $3 a day`,
    info: "Share of people living on less than $3 a day, the World Bank's international poverty line (adjusted for local prices).",
    keywords: "poverty poor extreme dollar a day",
  }),
  num("literacy", "Development", "Adult literacy", {
    short: "Literacy", format: "pct", bounds: [0, 100],
    say: (b) => `${b} of adults can read and write`,
    info: "Share of people aged 15 and over who can read and write. Many richer countries don't report this.",
    keywords: "literacy reading education school",
  }),
  num("internet", "Development", "Internet users", {
    short: "Internet", format: "pct", bounds: [0, 100],
    say: (b) => `${b} of people use the internet`,
    info: "Share of people who used the internet in the last three months.",
    keywords: "internet online digital technology web",
  }),
  num("electricity", "Development", "Access to electricity", {
    short: "Electricity", format: "pct", bounds: [0, 100],
    say: (b) => `${b} of people have electricity`,
    info: "Share of people with electricity at home.",
    keywords: "electricity power energy access",
  }),
  num("safe_water", "Development", "Safe drinking water", {
    short: "Safe water", format: "pct", bounds: [0, 100],
    say: (b) => `${b} of people have safe drinking water`,
    info: "Share of people with clean drinking water at home, available when needed.",
    keywords: "water drinking sanitation clean safe",
  }),
  num("education_spend", "Development", "Spending on education", {
    short: "Education spend", step: 0.5, format: "pct", clip: true,
    say: (b) => `government education spending is ${b} of GDP`,
    info: "Government spending on education as a share of the economy (GDP).",
    keywords: "education school spending government budget",
  }),

  // ---------------- Population ----------------
  num("population", "Population", "Population", {
    scale: "log", format: "people", year: "population_year",
    say: (b) => `the population is ${b}`,
    info: "Total number of people.",
    keywords: "people size big small inhabitants",
  }),
  num("density", "Population", "Population density", {
    short: "Density", scale: "log", format: "density",
    say: (b) => `population density is ${b}`,
    info: "People per square kilometre of land.",
    keywords: "density crowded sparse people per km",
  }),
  num("pop_growth", "Population", "Population growth", {
    short: "Growth", step: 0.1, format: "pct", clip: true,
    say: (b) => `the population is growing by ${b} a year`,
    info: "How fast the population is changing each year. Negative means it is shrinking.",
    keywords: "growth increase shrinking decline rate population change",
  }),
  num("fertility", "Population", "Fertility rate", {
    short: "Fertility", step: 0.1, format: "dec1", bounds: [0.5, 7],
    say: (b) => `women have ${b} children on average`,
    info: "Average number of children a woman has in her lifetime. About 2.1 keeps a population stable over time.",
    keywords: "fertility births children babies demographic transition",
  }),
  num("birth_rate", "Population", "Birth rate", {
    short: "Birth rate", step: 0.5, format: "per1000",
    say: (b) => `the birth rate is ${b}`,
    info: "Babies born each year per 1,000 people.",
    keywords: "birth rate births demographic transition",
  }),
  num("death_rate", "Population", "Death rate", {
    short: "Death rate", step: 0.5, format: "per1000",
    say: (b) => `the death rate is ${b}`,
    info: "Deaths each year per 1,000 people.",
    keywords: "death rate deaths mortality demographic transition",
  }),
  num("median_age", "Population", "Median age", {
    short: "Median age", format: "years", source: "unwpp",
    say: (b) => `the median age is ${b}`,
    info: "Half the population is younger than this age and half is older.",
    keywords: "age old young ageing median population pyramid",
  }),
  num("pct_under15", "Population", "Children (under 15)", {
    short: "Under 15", format: "pct", bounds: [0, 60],
    say: (b) => `${b} of people are under 15`,
    info: "Share of the population aged 0 to 14.",
    keywords: "children young youth age structure pyramid",
  }),
  num("pct_over65", "Population", "Older people (65 and over)", {
    short: "Over 65", format: "pct", bounds: [0, 40],
    say: (b) => `${b} of people are 65 or older`,
    info: "Share of the population aged 65 and over.",
    keywords: "elderly old ageing retired pension age structure pyramid",
  }),
  num("dependency", "Population", "Dependency ratio", {
    short: "Dependency", format: "int",
    say: (b) => `there are ${b} children and older people per 100 working-age adults`,
    info: "Children (under 15) and older people (65+) for every 100 people of working age (15 to 64).",
    keywords: "dependency ratio dependants working age",
  }),
  num("urban_pct", "Population", "Living in towns and cities", {
    short: "Urban", format: "pct", bounds: [0, 100],
    say: (b) => `${b} of people live in towns and cities`,
    info: "Share of people living in urban areas. Each country defines 'urban' its own way.",
    keywords: "urban urbanisation urbanization cities rural town",
  }),

  // ---------------- Health ----------------
  num("life_expectancy", "Health", "Life expectancy", {
    short: "Life expectancy", format: "years",
    say: (b) => `life expectancy is ${b}`,
    info: "How long a baby born today can expect to live, on average.",
    keywords: "life expectancy age health longevity",
  }),
  num("infant_mortality", "Health", "Infant deaths", {
    short: "Infant deaths", scale: "log", format: "per1000birth",
    say: (b) => `infant deaths are ${b}`,
    info: "Babies who die before age 1, per 1,000 born alive.",
    keywords: "infant mortality baby deaths health",
  }),
  num("under5_mortality", "Health", "Child deaths (under 5)", {
    short: "Under-5 deaths", scale: "log", format: "per1000birth",
    say: (b) => `child deaths are ${b}`,
    info: "Children who die before age 5, per 1,000 born alive.",
    keywords: "child mortality under five deaths health",
  }),
  num("health_spend", "Health", "Spending on health", {
    short: "Health spend", step: 0.5, format: "pct", clip: true,
    say: (b) => `health spending is ${b} of GDP`,
    info: "All spending on health care, public and private, as a share of the economy (GDP).",
    keywords: "health spending healthcare hospitals budget",
  }),

  // ---------------- Gender ----------------
  num("gii", "Gender", "Gender Inequality Index", {
    short: "GII", step: 0.01, format: "dec3", bounds: [0, 0.85], source: "undp",
    say: (b) => `the Gender Inequality Index is ${b}`,
    info: "UNDP's measure of inequality between women and men in health, education, politics and work, from 0 (equal) to 1 (very unequal). Lower is better.",
    keywords: "gii gender inequality index women equality undp",
  }),
  num("gii_rank", "Gender", "Gender Inequality rank", {
    short: "GII rank", format: "rank", source: "undp",
    say: (b) => `the country ranks ${b} for gender equality`,
    info: "Position in the world on the Gender Inequality Index, where 1 is the most equal.",
    keywords: "gii rank gender inequality ranking equality",
  }),
  num("gdi", "Gender", "Gender Development Index", {
    short: "GDI", step: 0.01, format: "dec3", bounds: [0.4, 1.1], source: "undp",
    say: (b) => `the Gender Development Index is ${b}`,
    info: "Women's HDI divided by men's HDI. 1 means equal; below 1 means women do worse than men.",
    keywords: "gdi gender development index women men equality",
  }),
  {
    key: "gdi_group", type: "cat", group: "Gender",
    label: "Gender Development group", short: "GDI group",
    say: (v) => `the GDI group is ${v.replace(/^\d · /, "").toLowerCase()}`,
    source: "undp", year: "gdi_year",
    info: "UNDP's five groups by how close women's HDI is to men's. Group 1 is closest to equal; group 5 has the biggest gap.",
    keywords: "gdi group gender equality",
  },
  num("women_parliament", "Gender", "Women in parliament", {
    short: "Women MPs", format: "pct", bounds: [0, 70],
    say: (b) => `${b} of members of parliament are women`,
    info: "Share of seats in the national parliament held by women. One of the measures in UNDP's Gender Inequality Index.",
    keywords: "gender women female parliament politics representation equality",
  }),
  num("female_labour", "Gender", "Women in work", {
    short: "Women in work", format: "pct", bounds: [0, 100],
    say: (b) => `${b} of women are in the labour force`,
    info: "Share of women aged 15 and over who are working or looking for work. One of the measures in UNDP's Gender Inequality Index.",
    keywords: "gender women female work employment labour jobs equality",
  }),
  num("maternal_mortality", "Gender", "Maternal deaths", {
    short: "Maternal deaths", scale: "log", format: "per100k",
    say: (b) => `maternal deaths are ${b}`,
    info: "Women who die from pregnancy or childbirth, per 100,000 live births. One of the measures in UNDP's Gender Inequality Index.",
    keywords: "maternal mortality mothers childbirth pregnancy health gender",
  }),
  num("adolescent_births", "Gender", "Teenage births", {
    short: "Teen births", scale: "log", format: "per1000women",
    say: (b) => `teenage births are ${b}`,
    info: "Births per 1,000 girls and women aged 15 to 19. One of the measures in UNDP's Gender Inequality Index.",
    keywords: "adolescent teenage teen births girls pregnancy gender",
  }),

  // ---------------- Work & money ----------------
  num("gdp_per_capita", "Work & money", "GDP per person", {
    short: "GDP/person", scale: "log", format: "usd", year: "gdp_year",
    say: (b) => `GDP per person is ${b}`,
    info: "Value of everything the economy produces in a year, divided by population, in US dollars.",
    keywords: "rich poor wealth economy gdp money",
  }),
  num("emp_agriculture", "Work & money", "Jobs in farming", {
    short: "Farming jobs", format: "pct", bounds: [0, 100],
    say: (b) => `${b} of workers are in farming, forestry or fishing`,
    info: "Share of workers in agriculture, forestry and fishing (the primary sector).",
    keywords: "agriculture farming primary sector employment jobs clark fisher",
  }),
  num("emp_industry", "Work & money", "Jobs in industry", {
    short: "Industry jobs", format: "pct", bounds: [0, 60],
    say: (b) => `${b} of workers are in industry`,
    info: "Share of workers in manufacturing, mining, construction and utilities (the secondary sector).",
    keywords: "industry manufacturing factory secondary sector employment jobs clark fisher",
  }),
  num("emp_services", "Work & money", "Jobs in services", {
    short: "Service jobs", format: "pct", bounds: [0, 100],
    say: (b) => `${b} of workers are in services`,
    info: "Share of workers in services such as shops, offices, health, education and tourism (the tertiary sector and beyond).",
    keywords: "services tertiary quaternary sector employment jobs clark fisher",
  }),
  {
    key: "currencies", type: "multi", group: "Work & money",
    label: "Currency", short: "Currency",
    say: (v) => `people pay in the ${v}`,
    source: "countries", info: "Currencies in official use.",
    keywords: "money currency euro dollar pound franc",
  },

  // ---------------- Global links ----------------
  {
    key: "groups", type: "multi", group: "Global links",
    label: "Member of", short: "Member of",
    order: ["European Union", "NATO", "OECD", "G7", "G20", "BRICS", "ASEAN", "African Union", "Arab League", "Commonwealth", "Mercosur", "OPEC"],
    say: (v) => `the country belongs to ${v}`,
    article: { "European Union": "the European Union", OECD: "the OECD", G7: "the G7", G20: "the G20", "African Union": "the African Union", "Arab League": "the Arab League", Commonwealth: "the Commonwealth" },
    source: "groups", yearText: "October 2026",
    info: "Membership of international groups and alliances. Full members only.",
    keywords: "eu nato oecd g7 g20 brics asean african union commonwealth mercosur opec arab league alliance bloc trade group membership",
  },
  num("trade_pct", "Global links", "Trade", {
    short: "Trade", scale: "log", format: "pct",
    say: (b) => `imports plus exports are ${b} of GDP`,
    info: "Imports and exports added together, as a share of the economy (GDP). High values mean an economy that is very open to the rest of the world.",
    keywords: "trade imports exports globalisation globalization open economy",
  }),
  num("fdi_pct", "Global links", "Foreign investment", {
    short: "FDI", step: 0.5, format: "pct", clip: true,
    say: (b) => `foreign investment coming in is ${b} of GDP`,
    info: "Money invested in the country by foreign companies in a year (net FDI inflows), as a share of GDP. Can be negative when investors pull money out.",
    keywords: "fdi foreign direct investment tnc multinational globalisation",
  }),
  num("tourists", "Global links", "Tourist arrivals", {
    short: "Tourists", scale: "log", format: "people",
    say: (b) => `${b} tourists arrive a year`,
    info: "International tourists arriving in a year, from the last year before COVID-19 (usually 2019).",
    keywords: "tourism tourists visitors travel holiday",
  }),
  num("migrants_pct", "Global links", "Born abroad", {
    short: "Born abroad", step: 0.5, format: "pct", clip: true,
    say: (b) => `${b} of people were born in another country`,
    info: "Share of the population who were born in another country (international migrant stock).",
    keywords: "migrants immigration immigrants foreign born migration",
  }),
  num("net_migration", "Global links", "Net migration", {
    short: "Net migration", step: 0.5, format: "per1000", clip: true,
    say: (b) => `net migration is ${b}`,
    info: "People arriving minus people leaving in a year, per 1,000 population. Negative means more people leave than arrive.",
    keywords: "migration emigration immigration net arrivals leaving",
  }),
  num("remittances_pct", "Global links", "Money sent home by migrants", {
    short: "Remittances", step: 0.5, format: "pct", clip: true,
    say: (b) => `remittances are ${b} of GDP`,
    info: "Money sent home by people working abroad (remittances), as a share of GDP.",
    keywords: "remittances migrants money sent home diaspora",
  }),

  // ---------------- Cities ----------------
  {
    key: "city_population", type: "range", target: "city", group: "Cities",
    label: "City population", short: "City pop.", scale: "log", format: "people", initial: { min: 1e6 },
    say: (b) => `the population is ${b}`,
    source: "geonames",
    info: "People living in the city itself, not counting suburbs and nearby towns. Shows cities on the map. Cities in countries that match your other filters are shown.",
    keywords: "city cities town urban megacity population metropolis",
  },
  {
    key: "city_capital", type: "bool", target: "city", group: "Cities",
    label: "Capital cities", short: "Capitals",
    say: (v) => (v ? "it is the capital" : "it is not the capital"),
    yes: "Capitals only", no: "Not capitals",
    source: "geonames", info: "Show only capital cities, or only cities that aren't capitals.",
    keywords: "capital city cities seat of government",
  },
  {
    key: "capital_is_largest", type: "bool", group: "Cities",
    label: "Capital is the largest city", short: "Capital largest",
    say: (v) => (v ? "the capital is the largest city" : "the capital is not the largest city"),
    yes: "Capital is largest", no: "Capital isn't largest",
    source: "geonames", info: "Whether the capital has more people than any other city. Compares cities themselves, not wider urban areas.",
    keywords: "primate city primacy capital largest biggest",
  },
  num("cities_1m", "Cities", "Cities over 1 million", {
    short: "Million cities", format: "int", source: "geonames", year: null, clip: true,
    say: (b) => `${b} cities have over a million people`,
    info: "Number of cities with more than a million people living in the city itself.",
    keywords: "million cities megacities urban big cities count",
  }),

  // ---------------- Culture ----------------
  {
    key: "official_languages", type: "multi", group: "Culture",
    label: "Official language", short: "Official",
    say: (v) => `${v} is an official language`,
    source: "countries", info: "Languages with official or national status.",
    keywords: "language speak spoken tongue official national",
  },
  {
    key: "spoken_languages", type: "multi", group: "Culture",
    label: "Language spoken by 10%+", short: "Spoken",
    say: (v) => `at least 10% of people speak ${v}`,
    source: "cldr", info: "Languages spoken by at least 1 in 10 people, including as a second language.",
    keywords: "language speak spoken second english french spanish",
  },
  {
    key: "largest_religion", type: "cat", group: "Culture",
    label: "Largest religion", short: "Largest religion",
    order: ["Christianity", "Islam", "No religion", "Hinduism", "Buddhism", "Judaism", "Folk religions", "Other religions"],
    say: (v) => `the largest religious group is ${v}`,
    source: "pew", year: 2010,
    info: "The religious group with the most followers. 'No religion' covers atheists, agnostics and people with no particular religion.",
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
    key: "pct_" + k, type: "range", group: "Culture",
    label: k === "unaffiliated" ? "% with no religion" : `% ${name}`,
    short: k === "unaffiliated" ? "No religion" : name,
    scale: "linear", step: 1, format: "pct", bounds: [0, 100], initial: { min: 50, max: 100 },
    say: (b) => (k === "unaffiliated" ? `${b} of people have no religion` : k === "folk" ? `${b} of people follow folk religions` : `${b} of people are ${name}`),
    source: "pew", year: 2010,
    info: `Share of people who are ${name === "No religion" ? "not religious" : name}.`,
    keywords: "religion faith belief percent share " + kw,
  })),
  {
    key: "driving_side", type: "cat", group: "Culture",
    label: "Side of the road", short: "Drives",
    order: ["Left", "Right"],
    say: (v) => `people drive on the ${v.toLowerCase()}`,
    source: "driving", info: "Which side of the road traffic keeps to.",
    keywords: "driving drive road car left right traffic",
  },

  // ---------------- Politics ----------------
  {
    key: "democracy", type: "bool", group: "Politics",
    label: "Democracy", short: "Democracy",
    say: (v) => (v ? "the country is a democracy" : "the country is not a democracy"),
    yes: "Democracy", no: "Not a democracy",
    source: "vdem", year: "vdem_year",
    info: "Rated a democracy by the V-Dem Institute, meaning it holds free and fair elections. Other organisations draw the line differently.",
    keywords: "democratic elections free government politics",
  },
  {
    key: "regime", type: "cat", group: "Politics",
    label: "Type of government", short: "Government",
    order: ["Liberal democracy", "Electoral democracy", "Electoral autocracy", "Closed autocracy"],
    say: (v) => `the government is rated ${v}`,
    article: { "Liberal democracy": "a liberal democracy", "Electoral democracy": "an electoral democracy", "Electoral autocracy": "an electoral autocracy", "Closed autocracy": "a closed autocracy" },
    source: "vdem", year: "vdem_year",
    info: "Closed autocracy: no real multi-party elections. Electoral autocracy: elections, but not free or fair. Electoral democracy: free and fair elections. Liberal democracy: free elections plus strong protection of rights and the rule of law.",
    keywords: "government autocracy dictatorship democracy politics system regime",
  },
  num("libdem", "Politics", "Democracy score", {
    short: "Democracy score", step: 0.01, format: "index", bounds: [0, 1], source: "vdem", year: "vdem_year",
    say: (b) => `the democracy score is ${b}`,
    info: "V-Dem's Liberal Democracy Index, from 0 (least) to 1 (most democratic). Combines free elections with civil liberties, the rule of law and limits on government power.",
    keywords: "democracy index score rating freedom",
  }),
  num("free_expression", "Politics", "Freedom of expression", {
    short: "Free speech", step: 0.01, format: "index", bounds: [0, 1], source: "vdem", year: "vdem_year",
    say: (b) => `freedom of expression scores ${b}`,
    info: "V-Dem's score for freedom of speech and the press, from 0 to 1.",
    keywords: "press media freedom speech censorship journalism",
  }),
  {
    key: "un_member", type: "bool", group: "Politics",
    label: "UN member", short: "UN member",
    say: (v) => (v ? "the country is a UN member" : "the country is not a UN member"),
    yes: "UN member", no: "Not a UN member",
    source: "countries", info: "A full member of the United Nations.",
    keywords: "united nations un member recognised",
  },

  // ---------------- Geography ----------------
  {
    key: "region", type: "cat", group: "Geography",
    label: "Continent", short: "Continent",
    order: ["Africa", "Americas", "Asia", "Europe", "Oceania", "Antarctic"],
    say: (v) => `the country is in ${v.replace("Americas", "the Americas")}`,
    source: "countries", info: "The UN's grouping of countries by continent.",
    keywords: "continent region africa asia europe americas oceania",
  },
  {
    key: "subregion", type: "cat", group: "Geography",
    label: "Part of the world", short: "Region",
    say: (v) => `the country is in ${v}`,
    source: "countries", info: "The UN's smaller regions, such as Western Africa or South-Eastern Asia.",
    keywords: "region area part caribbean middle east subregion",
  },
  {
    key: "landlocked", type: "bool", group: "Geography",
    label: "Landlocked", short: "Landlocked",
    say: (v) => (v ? "the country is landlocked" : "the country has a coastline"),
    yes: "Landlocked", no: "Has a coastline",
    source: "countries", info: "Has no coastline on the open sea.",
    keywords: "coast sea ocean coastline landlocked",
  },
  {
    key: "no_land_borders", type: "bool", group: "Geography",
    label: "Island (no land borders)", short: "Island",
    say: (v) => (v ? "the country has no land borders" : "the country has land borders"),
    yes: "No land borders", no: "Has land borders",
    source: "countries", info: "Shares no land border with another country. Mostly island nations.",
    keywords: "island borders isolated archipelago",
  },
  num("neighbours", "Geography", "Number of neighbours", {
    short: "Neighbours", format: "int", source: "countries", year: null,
    say: (b) => `it borders ${b} countries`,
    info: "Countries that share a land border.",
    keywords: "borders neighbours neighbors bordering",
  }),
  num("area_km2", "Geography", "Area", {
    short: "Area", scale: "log", format: "km2", source: "countries", year: null,
    say: (b) => `the area is ${b}`,
    info: "Total area in square kilometres.",
    keywords: "size big small area large",
  }),

  // ---------------- Environment ----------------
  num("co2_per_capita", "Environment", "CO₂ per person", {
    short: "CO₂", scale: "log", format: "tonnes", source: "owid", year: "co2_year",
    say: (b) => `CO₂ emissions per person are ${b}`,
    info: "Carbon dioxide from fossil fuels and industry each year, in tonnes per person.",
    keywords: "carbon emissions climate pollution co2 environment",
  }),
  num("renewables_pct", "Environment", "Renewable energy", {
    short: "Renewables", format: "pct", bounds: [0, 100],
    say: (b) => `${b} of energy used is renewable`,
    info: "Share of all energy used that comes from renewable sources, including hydro, wind, solar and wood.",
    keywords: "renewable energy solar wind hydro green",
  }),
  num("forest_pct", "Environment", "Forest cover", {
    short: "Forest", format: "pct", bounds: [0, 100],
    say: (b) => `${b} of land is forest`,
    info: "Share of land covered by forest.",
    keywords: "forest trees woodland deforestation",
  }),
  num("water_stress", "Environment", "Water stress", {
    short: "Water stress", scale: "log", format: "pct",
    say: (b) => `water use is ${b} of renewable supply`,
    info: "Fresh water taken each year as a share of the water that is naturally replenished. Above 25% is stress; above 100% means using more than nature replaces.",
    keywords: "water stress scarcity shortage drought resources",
  }),
];

window.SOURCES = {
  countries: { name: "mledoze/countries", url: "https://github.com/mledoze/countries", licence: "ODbL 1.0" },
  cldr: { name: "Unicode CLDR territory data", url: "https://cldr.unicode.org/", licence: "Unicode License" },
  worldbank: { name: "World Bank, World Development Indicators", url: "https://data.worldbank.org/", licence: "CC BY 4.0" },
  undp: { name: "UNDP Human Development Report 2025", url: "https://hdr.undp.org/data-center", licence: "CC BY 3.0 IGO" },
  unwpp: { name: "UN World Population Prospects (via Gapminder)", url: "https://population.un.org/wpp/", licence: "CC BY 3.0 IGO" },
  pew: { name: "Pew Research Center, Global Religious Landscape (2010 estimates)", url: "https://www.pewresearch.org/religion/2012/12/18/global-religious-landscape-exec/", licence: "Pew terms of use; attribution required" },
  vdem: { name: "V-Dem Institute, Varieties of Democracy", url: "https://v-dem.net/", licence: "CC BY-SA 4.0" },
  owid: { name: "Our World in Data, CO₂ dataset", url: "https://github.com/owid/co2-data", licence: "CC BY 4.0" },
  driving: { name: "samayo/country-json", url: "https://github.com/samayo/country-json", licence: "MIT" },
  groups: { name: "Official membership lists, compiled for this site", url: "groups.csv", licence: "CC0" },
  geonames: { name: "GeoNames", url: "https://www.geonames.org/", licence: "CC BY 4.0" },
  boundaries: { name: "Natural Earth via world-atlas", url: "https://github.com/topojson/world-atlas", licence: "Public domain" },
};

/* Ready-made questions shown before any filter is set. */
window.STARTERS = [
  { title: "Portuguese-speaking countries", filters: [{ key: "official_languages", values: ["Portuguese"] }] },
  { title: "Muslim-majority democracies", filters: [{ key: "pct_muslim", min: 50, max: 100 }, { key: "democracy", value: true }] },
  { title: "Very high inequality", filters: [{ key: "gini", min: 45 }] },
  { title: "Shrinking populations", filters: [{ key: "pop_growth", max: 0 }] },
  { title: "Cities over 10 million", filters: [{ key: "city_population", min: 1e7 }] },
  { title: "Capital isn't the largest city", filters: [{ key: "capital_is_largest", value: false }] },
  { title: "Low income, mostly urban", filters: [{ key: "income_group", values: ["Low income", "Lower-middle income"] }, { key: "urban_pct", min: 60 }] },
  { title: "Most jobs in farming", filters: [{ key: "emp_agriculture", min: 50 }] },
];

/* Puzzles for "Question of the day". Only puzzles with 1–8 answers in the current data are shown. */
window.PUZZLES = [
  { q: "Find a country that is majority Buddhist and a democracy.", filters: [{ key: "pct_buddhist", min: 50, max: 100 }, { key: "democracy", value: true }] },
  { q: "Which high-income countries have a fertility rate above 2.1?", filters: [{ key: "income_group", values: ["High income"] }, { key: "fertility", min: 2.1 }] },
  { q: "Find a BRICS country where the capital isn't the largest city.", filters: [{ key: "groups", values: ["BRICS"] }, { key: "capital_is_largest", value: false }] },
  { q: "Which countries have life expectancy over 80 but aren't high income?", filters: [{ key: "life_expectancy", min: 80 }, { key: "income_group", values: ["Low income", "Lower-middle income", "Upper-middle income"] }] },
  { q: "Where do more than half of women work, but under 10% of MPs are women?", filters: [{ key: "female_labour", min: 50 }, { key: "women_parliament", max: 10 }] },
  { q: "Find a landlocked country with a city of over 5 million people.", filters: [{ key: "landlocked", value: true }, { key: "city_population", min: 5e6 }] },
  { q: "Which countries in Europe have shrinking populations?", filters: [{ key: "region", values: ["Europe"] }, { key: "pop_growth", max: 0 }] },
  { q: "Find a country where over 20% of people were born abroad but it isn't high income.", filters: [{ key: "migrants_pct", min: 20 }, { key: "income_group", values: ["Low income", "Lower-middle income", "Upper-middle income"] }] },
  { q: "Which OPEC members are democracies?", filters: [{ key: "groups", values: ["OPEC"] }, { key: "democracy", value: true }] },
  { q: "Where is Arabic official but most people aren't Muslim?", filters: [{ key: "official_languages", values: ["Arabic"] }, { key: "pct_muslim", min: 0, max: 50 }] },
  { q: "Find a country with very high inequality (Gini over 50) outside Africa.", filters: [{ key: "gini", min: 50 }, { key: "region", values: ["Americas", "Asia", "Europe", "Oceania"] }] },
  { q: "Which countries rank in the HDI top 30 but have more than 25% of workers in industry?", filters: [{ key: "hdi_rank", max: 30 }, { key: "emp_industry", min: 25 }] },
  { q: "Which countries are in the top 20 for human development but not the top 20 for gender equality?", filters: [{ key: "hdi_rank", max: 20 }, { key: "gii_rank", min: 21 }] },
  { q: "Find a country with high human development where inequality cuts its HDI by more than 20%.", filters: [{ key: "hdi_group", values: ["High", "Very high"] }, { key: "hdi_loss", min: 20 }] },
];
