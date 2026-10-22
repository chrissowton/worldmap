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
  url: "https://chrissowton.github.io/worldmap/",  // the site's address, used in share links and on downloaded images
};

window.FILTER_GROUPS = [
  "Development", "Population", "Health", "Gender", "Work & money", "Trade", "Global links", "Refugees",
  "Cities", "Culture", "Tourism", "Technology", "Politics", "UN & treaties", "Military", "Sport",
  "Geography", "Climate", "Energy & resources", "Environment",
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
  num("internet", "Technology", "Internet users", {
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
  num("natural_increase", "Population", "Natural increase", {
    short: "Natural increase", step: 0.5, format: "per1000", bounds: [-10, 40],
    say: (b) => `births minus deaths is ${b}`,
    info: "Birth rate minus death rate: how fast the population grows (or shrinks) before migration. Below zero, more people die than are born.",
    keywords: "natural increase decrease growth births deaths demographic transition",
  }),
  {
    key: "dtm_stage", type: "cat", group: "Population",
    label: "Demographic transition stage", short: "DTM stage",
    order: ["Stage 1 · High birth and death rates", "Stage 2 · Death rate falling, birth rate high", "Stage 3 · Birth rate falling",
      "Stage 4 · Low birth and death rates", "Stage 5 · Deaths outnumber births"],
    say: (v) => `it is at ${v.split(" · ")[0].toLowerCase()} of the demographic transition model`,
    sayNot: (v) => `it is not at ${v.split(" · ")[0].toLowerCase()} of the demographic transition model`,
    source: "worldbank", year: "dtm_stage_year",
    info: "A simple guide worked out on this site from birth and death rates per 1,000 people. Stage 1: births 35+ and deaths 20+. Stage 2: births 28+. Stage 3: births 15–28. Stage 4: births under 15 but above deaths. Stage 5: deaths above births. Real countries don't always fit neatly.",
    keywords: "demographic transition model dtm stage birth death population",
  },
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
    order: ["European Union", "NATO", "OECD", "G7", "G20", "BRICS", "ASEAN", "African Union", "Arab League", "Commonwealth", "Mercosur", "OPEC", "World Trade Organization"],
    modes: true,
    say: (v) => `the country belongs to ${v}`,
    sayNot: (v) => `the country does not belong to ${v}`,
    article: { "World Trade Organization": "the WTO", "European Union": "the European Union", OECD: "the OECD", G7: "the G7", G20: "the G20", "African Union": "the African Union", "Arab League": "the Arab League", Commonwealth: "the Commonwealth" },
    source: "groups", yearText: "October 2026",
    info: "Membership of international groups, alliances and the World Trade Organization (WTO). Full members only.",
    keywords: "eu nato oecd g7 g20 brics asean african union commonwealth mercosur opec arab league alliance bloc trade group membership",
  },
  num("trade_pct", "Trade", "Trade (exports + imports)", {
    short: "Trade", scale: "log", format: "pct",
    say: (b) => `imports plus exports are ${b} of GDP`,
    info: "Imports and exports added together, as a share of the economy (GDP). High values mean an economy that is very open to the rest of the world.",
    keywords: "trade imports exports globalisation globalization open economy",
  }),
  num("fdi_pct", "Trade", "Foreign investment", {
    short: "FDI", step: 0.5, format: "pct", clip: true,
    say: (b) => `foreign investment coming in is ${b} of GDP`,
    info: "Money invested in the country by foreign companies in a year (net FDI inflows), as a share of GDP. Can be negative when investors pull money out.",
    keywords: "fdi foreign direct investment tnc multinational globalisation",
  }),
  num("tourists", "Tourism", "Tourist arrivals", {
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

  // ---------------- Refugees ----------------
  num("refugees_hosted", "Refugees", "Refugees hosted", {
    short: "Refugees hosted", scale: "log", format: "people", source: "unhcr",
    say: (b) => `the country hosts ${b} refugees`,
    info: "Refugees and others needing international protection living in the country, under UNHCR's mandate. Palestinian refugees cared for by UNRWA (about 6 million, mostly in Jordan, Lebanon, Syria, Gaza and the West Bank) are not included. Open a country's profile to see where its refugees come from.",
    keywords: "refugees hosting asylum displaced host unhcr",
  }),
  num("refugees_hosted_per1000", "Refugees", "Refugees hosted per 1,000 people", {
    short: "Refugees per 1,000", scale: "log", format: "per1000", source: "unhcr",
    say: (b) => `refugees hosted are ${b}`,
    info: "Refugees hosted for every 1,000 people living in the country. Shows the size of hosting compared with the country's own population.",
    keywords: "refugees per capita hosting share burden",
  }),
  num("refugees_from", "Refugees", "Refugees from this country", {
    short: "Refugees from", scale: "log", format: "people", source: "unhcr",
    say: (b) => `${b} refugees have fled the country`,
    info: "People from this country living abroad as refugees or needing international protection, under UNHCR's mandate. Open a country's profile to see where they have gone.",
    keywords: "refugees origin fled displaced emigration conflict",
  }),
  num("refugees_from_per1000", "Refugees", "Refugees from, per 1,000 people", {
    short: "Fled per 1,000", scale: "log", format: "per1000", source: "unhcr",
    say: (b) => `refugees who have fled are ${b}`,
    info: "Refugees from the country for every 1,000 people still living there.",
    keywords: "refugees origin per capita fled share",
  }),
  num("idps", "Refugees", "Internally displaced people", {
    short: "IDPs", scale: "log", format: "people", source: "unhcr",
    say: (b) => `${b} people are displaced inside the country`,
    info: "People forced from their homes who are still inside their own country, mostly because of conflict. Figures come from UNHCR and its partners.",
    keywords: "idp internally displaced conflict war displacement",
  }),
  num("asylum_seekers_hosted", "Refugees", "Asylum seekers waiting", {
    short: "Asylum seekers", scale: "log", format: "people", source: "unhcr",
    say: (b) => `${b} asylum seekers are waiting for a decision`,
    info: "People who have applied for asylum in the country and are waiting for a decision.",
    keywords: "asylum seekers applications claims waiting",
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
    modes: true,
    say: (v, plural) => `${v} ${plural ? "are official languages" : "is an official language"}`,
    sayNot: (v) => `${v} is not an official language`,
    source: "countries", info: "Languages with official or national status.",
    keywords: "language speak spoken tongue official national",
  },
  {
    key: "spoken_languages", type: "multi", group: "Culture",
    label: "Language spoken by 10%+", short: "Spoken",
    modes: true,
    say: (v) => `at least 10% of people speak ${v}`,
    sayNot: (v) => `fewer than 10% of people speak ${v}`,
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

  // ---------------- UN & treaties ----------------
  {
    key: "security_council", type: "cat", group: "UN & treaties",
    label: "UN Security Council", short: "Security Council",
    order: ["Permanent member", "Elected member (2026)", "Not on the council"],
    say: (v) => `the country is ${v === "Not on the council" ? "not on the Security Council" : "a " + v.toLowerCase().replace(" (2026)", "") + " of the Security Council"}`,
    source: "un", yearText: "2026",
    info: "The five permanent members, who can veto decisions, and the ten members elected for two-year terms that include 2026.",
    keywords: "security council unsc veto permanent five p5 united nations",
  },
  ...[
    ["un_crc", "Children's rights (UNCRC)", "UNCRC", "the Convention on the Rights of the Child", "The UN Convention on the Rights of the Child (1989), the most widely ratified human rights treaty. The United States is the only UN member that has not joined.", "children child rights uncrc crc convention"],
    ["un_icc", "International Criminal Court", "ICC", "the International Criminal Court", "The Rome Statute, which created the International Criminal Court to try genocide, war crimes and crimes against humanity. Burkina Faso, Mali and Niger are leaving; their exit takes effect in 2027.", "icc international criminal court rome statute war crimes"],
    ["un_paris", "Paris climate agreement", "Paris Agreement", "the Paris climate agreement", "The 2015 agreement to limit global warming to well below 2°C. The United States left in January 2026.", "paris agreement climate change cop unfccc"],
    ["un_refugee", "Refugee Convention", "Refugee Convention", "the Refugee Convention", "The 1951 Refugee Convention or its 1967 Protocol, which define who is a refugee and their rights. Many countries that host large numbers of refugees have not joined.", "refugee convention 1951 protocol asylum"],
    ["un_cedaw", "Women's rights (CEDAW)", "CEDAW", "the women's rights convention (CEDAW)", "The Convention on the Elimination of All Forms of Discrimination against Women (1979).", "women cedaw gender discrimination convention rights"],
    ["un_crpd", "Disability rights (CRPD)", "CRPD", "the disability rights convention", "The Convention on the Rights of Persons with Disabilities (2006).", "disability crpd rights convention"],
    ["un_npt", "Nuclear Non-Proliferation Treaty", "NPT", "the Nuclear Non-Proliferation Treaty", "The 1968 treaty to stop the spread of nuclear weapons. India, Israel, Pakistan and South Sudan never joined; North Korea left in 2003.", "npt nuclear non-proliferation weapons treaty"],
    ["un_tpnw", "Nuclear weapons ban", "Nuclear ban", "the nuclear weapons ban treaty", "The Treaty on the Prohibition of Nuclear Weapons (2017), which bans nuclear weapons outright. No nuclear-armed state has joined.", "tpnw nuclear ban prohibition weapons treaty"],
    ["un_landmine", "Landmine ban (Ottawa Treaty)", "Landmine ban", "the landmine ban treaty", "The 1997 Ottawa Treaty banning anti-personnel landmines. Estonia, Latvia, Lithuania, Finland and Poland left in 2025–26.", "landmines mines ottawa treaty ban"],
  ].map(([key, label, short, name, info, keywords]) => ({
    key, type: "bool", group: "UN & treaties", label, short, hidden: true,
    say: (v) => (v ? `the country has joined ${name}` : `the country has not joined ${name}`),
    yes: `${short}: joined`, no: `${short}: not joined`,
    source: "treaties", yearText: "October 2026",
    info: info + " Counts countries that have ratified or acceded, not those that have only signed.",
    keywords: keywords + " treaty united nations un",
  })),

  {
    key: "treaties_joined", type: "multi", group: "UN & treaties",
    label: "Treaties joined", short: "Treaties",
    order: ["Children's rights (UNCRC)", "International Criminal Court", "Paris Agreement", "Refugee Convention", "Women's rights (CEDAW)", "Disability rights (CRPD)", "Non-Proliferation Treaty (NPT)", "Nuclear weapons ban", "Landmine ban"],
    modes: true,
    say: (v) => `the country has joined ${v}`,
    sayNot: (v) => `the country has not joined ${v}`,
    article: { "Children's rights (UNCRC)": "the children's rights convention (UNCRC)", "International Criminal Court": "the International Criminal Court", "Paris Agreement": "the Paris Agreement", "Refugee Convention": "the Refugee Convention", "Women's rights (CEDAW)": "the women's rights convention (CEDAW)", "Disability rights (CRPD)": "the disability rights convention (CRPD)", "Non-Proliferation Treaty (NPT)": "the Non-Proliferation Treaty", "Nuclear weapons ban": "the nuclear weapons ban", "Landmine ban": "the landmine ban" },
    source: "treaties", yearText: "October 2026",
    info: "Major UN treaties the country has joined (ratified or acceded, not just signed). Choose “None of these” to find countries that have not joined, such as the United States and the children's rights convention.",
    keywords: "treaty treaties convention uncrc crc icc international criminal court paris agreement refugee convention cedaw crpd npt nuclear ban landmine ottawa ratified",
  },

  // ---------------- Military ----------------
  num("military_spend_pct", "Military", "Military spending", {
    short: "Military spend", step: 0.1, format: "pct", clip: true, source: "sipri",
    say: (b) => `military spending is ${b} of GDP`,
    info: "Spending on the armed forces as a share of the economy (GDP). NATO members aim for at least 2%.",
    keywords: "military defence defense spending army budget armed forces",
  }),
  num("military_spend_usd", "Military", "Military spending (US$)", {
    short: "Military $", scale: "log", format: "usd", source: "sipri", year: "military_spend_usd_year",
    say: (b) => `military spending is ${b} a year`,
    info: "Total spending on the armed forces in a year, in US dollars.",
    keywords: "military defence defense spending budget dollars",
  }),
  num("armed_forces", "Military", "Armed forces", {
    short: "Armed forces", scale: "log", format: "people", source: "iiss",
    say: (b) => `there are ${b} people in the armed forces`,
    info: "Active military personnel, including paramilitary forces where they are trained and equipped like the military.",
    keywords: "soldiers troops army armed forces military personnel",
  }),
  num("armed_forces_pct", "Military", "Armed forces (% of workers)", {
    short: "Forces % of workers", step: 0.1, format: "pct", clip: true, source: "iiss", year: "armed_forces_pct_year",
    say: (b) => `${b} of the labour force is in the armed forces`,
    info: "Armed forces personnel as a share of everyone in work or looking for work.",
    keywords: "soldiers troops military share workforce militarisation",
  }),
  {
    key: "nuclear_armed", type: "bool", group: "Military",
    label: "Has nuclear weapons", short: "Nuclear-armed",
    say: (v) => (v ? "the country has nuclear weapons" : "the country has no nuclear weapons"),
    yes: "Nuclear-armed", no: "No nuclear weapons",
    source: "treaties", yearText: "2026",
    info: "The nine countries known or widely believed to have nuclear weapons. Israel has never confirmed its arsenal.",
    keywords: "nuclear weapons bomb arsenal warheads",
  },

  // ---------------- Sport ----------------
  num("wc_men_titles", "Sport", "Men's World Cup wins", {
    short: "World Cups (men)", format: "int", bounds: [0, 5], source: "sport", year: null, yearText: "1930–2026",
    say: (b) => `the men's team has won the World Cup ${b.replace("at least 1", "at least once").replace("at most ", "at most ")} times`.replace("once times", "once"),
    info: "Men's football World Cup titles, up to Spain's win in 2026. England's 1966 win counts for the United Kingdom, and West Germany's for Germany.",
    keywords: "football soccer world cup fifa winners champions men",
  }),
  num("wc_women_titles", "Sport", "Women's World Cup wins", {
    short: "World Cups (women)", format: "int", bounds: [0, 4], source: "sport", year: null, yearText: "1991–2023",
    say: (b) => `the women's team has won the World Cup ${b.replace("at least 1", "at least once")} times`.replace("once times", "once"),
    info: "Women's football World Cup titles, up to 2023.",
    keywords: "football soccer world cup fifa winners champions women",
  }),
  ...[
    ["wc_men_host", "Hosted the men's World Cup", "Hosted World Cup", "has hosted the men's football World Cup", "Every host from 1930 to 2026. Joint hosts all count.", "football soccer world cup host fifa"],
    ["wc_women_host", "Hosted the women's World Cup", "Hosted Women's WC", "has hosted the women's football World Cup", "Every host from 1991 to 2023.", "football soccer women world cup host"],
    ["olympics_summer_host", "Hosted the Summer Olympics", "Summer Olympics host", "has hosted the Summer Olympics", "Every host from Athens 1896 to Paris 2024. The Soviet Union's 1980 Games count for Russia.", "olympics olympic games summer host"],
    ["olympics_winter_host", "Hosted the Winter Olympics", "Winter Olympics host", "has hosted the Winter Olympics", "Every host from 1924 to Milan–Cortina 2026. Yugoslavia's 1984 Games in Sarajevo count for Bosnia and Herzegovina.", "olympics olympic winter games host skiing"],
    ["commonwealth_games_host", "Hosted the Commonwealth Games", "Commonwealth Games host", "has hosted the Commonwealth Games", "Every host from 1930 to Glasgow 2026.", "commonwealth games host"],
    ["fifa_member", "FIFA member", "FIFA member", "is a member of FIFA", "Member of FIFA, football's world governing body. The UK counts as a member through England, Scotland, Wales and Northern Ireland.", "fifa football soccer member association"],
  ].map(([key, label, short, phrase, info, keywords]) => ({
    key, type: "bool", group: "Sport", label, short, hidden: key !== "fifa_member",
    say: (v) => (v ? `the country ${phrase}` : `the country ${phrase.replace(/^has /, "has never ").replace(/^is /, "is not ")}`),
    yes: `${short}: yes`, no: `${short}: no`,
    source: "sport", info, keywords,
  })),
  {
    key: "events_hosted", type: "multi", group: "Sport",
    label: "Has hosted", short: "Hosted",
    order: ["Men's World Cup", "Women's World Cup", "Summer Olympics", "Winter Olympics", "Commonwealth Games"],
    modes: true,
    say: (v) => `the country has hosted ${v}`,
    sayNot: (v) => `the country has never hosted ${v}`,
    article: { "Men's World Cup": "the men's football World Cup", "Women's World Cup": "the women's football World Cup", "Summer Olympics": "the Summer Olympics", "Winter Olympics": "the Winter Olympics", "Commonwealth Games": "the Commonwealth Games" },
    source: "sport", yearText: "to 2026",
    info: "Big sporting events the country has hosted: football World Cups (to 2026), Summer Olympics (to Paris 2024), Winter Olympics (to Milan–Cortina 2026) and Commonwealth Games (to Glasgow 2026). Joint hosts all count.",
    keywords: "host hosted olympics world cup commonwealth games football events",
  },
  num("olympic_medals", "Sport", "Olympic medals (Paris 2024)", {
    short: "Medals 2024", scale: "linear", format: "int", clip: true, source: "olympics", year: null, yearText: "2024",
    say: (b) => `athletes won ${b} medals at Paris 2024`,
    info: "Gold, silver and bronze medals won at the Paris 2024 Summer Olympics.",
    keywords: "olympics medals gold silver bronze paris 2024 sport",
  }),
  num("olympic_golds", "Sport", "Olympic gold medals (Paris 2024)", {
    short: "Golds 2024", format: "int", clip: true, source: "olympics", year: null, yearText: "2024",
    say: (b) => `athletes won ${b} gold medals at Paris 2024`,
    info: "Gold medals won at the Paris 2024 Summer Olympics.",
    keywords: "olympics gold medals paris 2024",
  }),
  num("medals_per_million", "Sport", "Olympic medals per million people", {
    short: "Medals per million", step: 0.1, format: "dec1", clip: true, source: "olympics", year: null, yearText: "2024",
    say: (b) => `there were ${b} Paris 2024 medals per million people`,
    info: "Paris 2024 medals divided by population, which shows which small countries punch above their weight.",
    keywords: "olympics medals per capita population small countries",
  }),

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
    info: "Countries that share a land border, from Natural Earth's map. Open a country's profile to see who they are and how long each border is.",
    keywords: "borders neighbours neighbors bordering",
  }),
  num("border_km", "Geography", "Length of land borders", {
    short: "Land borders", scale: "linear", format: "kmlen", source: "boundaries", year: null, clip: true,
    say: (b) => `land borders total ${b}`,
    info: "Total length of all land borders, measured on Natural Earth's 1:10m map, so treat it as approximate. Open a country's profile to see each neighbour and border length.",
    keywords: "border length frontier km neighbours boundary",
  }),
  num("area_km2", "Geography", "Area", {
    short: "Area", scale: "log", format: "km2", source: "countries", year: null,
    say: (b) => `the area is ${b}`,
    info: "Total area in square kilometres.",
    keywords: "size big small area large",
  }),

  // ---------------- Trade ----------------
  num("exports_pct", "Trade", "Exports", {
    short: "Exports", scale: "log", format: "pct", clip: true,
    say: (b) => `exports are ${b} of GDP`,
    info: "Goods and services sold to other countries, as a share of the economy (GDP).",
    keywords: "exports export selling trade",
  }),
  num("imports_pct", "Trade", "Imports", {
    short: "Imports", scale: "log", format: "pct", clip: true,
    say: (b) => `imports are ${b} of GDP`,
    info: "Goods and services bought from other countries, as a share of the economy (GDP).",
    keywords: "imports import buying trade",
  }),
  num("trade_balance_pct", "Trade", "Trade balance", {
    short: "Trade balance", step: 0.5, format: "pct", clip: true,
    say: (b) => `the trade balance is ${b} of GDP`,
    info: "Exports minus imports of goods and services, as a share of GDP. Positive means a trade surplus (selling more than buying); negative means a deficit.",
    keywords: "trade balance surplus deficit",
  }),
  num("exports_usd", "Trade", "Exports (US$)", {
    short: "Exports $", scale: "log", format: "usd",
    say: (b) => `exports are worth ${b} a year`,
    info: "Total value of goods and services exported in a year, in US dollars.",
    keywords: "exports value dollars trade size",
  }),
  ...[
    ["exp_fuel_pct", "Fuel exports", "Fuel", "fuels (oil, gas, coal)"],
    ["exp_metals_pct", "Ore and metal exports", "Ores & metals", "ores and metals"],
    ["exp_food_pct", "Food exports", "Food", "food"],
    ["exp_agri_raw_pct", "Agricultural raw material exports", "Farm raw materials", "agricultural raw materials such as timber, cotton and rubber"],
    ["exp_manuf_pct", "Manufactured exports", "Manufactures", "manufactured goods"],
  ].map(([key, label, short, what]) => num(key, "Trade", label, {
    short, format: "pct", bounds: [0, 100],
    say: (b) => `${b} of goods exported are ${what}`,
    info: `Share of all goods exported (merchandise exports) that are ${what}. Shows what an economy sells to the world.`,
    keywords: "exports trade primary commodities dependence " + label.toLowerCase(),
  })),
  num("tariff_pct", "Trade", "Average tariff", {
    short: "Tariff", step: 0.5, format: "pct", clip: true,
    say: (b) => `the average tariff is ${b}`,
    info: "Average tax charged on imported goods, weighted by how much of each product is imported.",
    keywords: "tariff tax import duty protectionism free trade",
  }),
  {
    key: "wto_member", type: "bool", group: "Trade", hidden: true,
    label: "WTO member", short: "WTO",
    say: (v) => (v ? "the country is a member of the World Trade Organization" : "the country is not a member of the World Trade Organization"),
    yes: "WTO: member", no: "WTO: not a member",
    source: "treaties", yearText: "October 2026",
    info: "Member of the World Trade Organization, which sets the rules for trade between countries. Hong Kong, Macao and Taiwan are members in their own right.",
    keywords: "wto world trade organization member free trade",
  },

  // ---------------- Tourism ----------------
  num("tourists_per100", "Tourism", "Tourists per 100 residents", {
    short: "Tourists per 100", scale: "log", format: "per100", source: "worldbank", year: null, yearText: "2019",
    say: (b) => `tourist arrivals number ${b}`,
    info: "International tourist arrivals in 2019 for every 100 people living in the country. Shows how much tourism there is compared with the country's size.",
    keywords: "tourism tourists per capita intensity visitors",
  }),
  num("tourism_receipts_usd", "Tourism", "Money spent by tourists", {
    short: "Tourism income", scale: "log", format: "usd",
    say: (b) => `tourists spend ${b} a year`,
    info: "Money spent by international visitors in the country, in US dollars, in the last year before COVID-19 (usually 2019).",
    keywords: "tourism receipts income spending revenue",
  }),
  num("tourism_receipts_pct", "Tourism", "Tourism share of exports", {
    short: "Tourism % exports", scale: "log", format: "pct", clip: true,
    say: (b) => `tourism earns ${b} of export income`,
    info: "Money from international tourists as a share of all export earnings, before COVID-19 (usually 2019). High values mean an economy that depends on tourism.",
    keywords: "tourism dependence economy exports receipts",
  }),
  num("tourist_departures", "Tourism", "Trips abroad by residents", {
    short: "Trips abroad", scale: "log", format: "people",
    say: (b) => `residents make ${b} trips abroad a year`,
    info: "Trips abroad made by people living in the country, before COVID-19. Many countries don't report this.",
    keywords: "outbound tourism departures travel abroad holidays",
  }),
  num("world_heritage_sites", "Tourism", "UNESCO World Heritage sites", {
    short: "World Heritage", format: "count", clip: true, source: "whc", year: null, yearText: "2025",
    say: (b) => `the country has ${b} World Heritage sites`,
    info: "Places on UNESCO's World Heritage List for their cultural or natural importance, to the 2025 session. Sites shared between countries count for each of them. Sites added in 2026 are not yet included.",
    keywords: "unesco world heritage sites culture nature monuments",
  }),

  // ---------------- Technology ----------------
  num("ai_users_pct", "Technology", "People using AI", {
    short: "AI users", format: "pct", bounds: [0, 80], source: "msai", year: null, yearText: "early 2026",
    say: (b) => `${b} of working-age people use generative AI`,
    info: "Estimated share of people aged 15 to 64 who used a generative AI tool such as ChatGPT, Copilot, Gemini or Claude in early 2026. Estimated by Microsoft from anonymised usage data. Some countries, especially in Africa, share a regional estimate, so treat small differences with care.",
    keywords: "ai artificial intelligence chatgpt generative adoption technology",
  }),
  num("mobile_per100", "Technology", "Mobile phone subscriptions", {
    short: "Mobiles", format: "per100", clip: true,
    say: (b) => `mobile subscriptions number ${b}`,
    info: "Mobile phone subscriptions per 100 people. Can be over 100 because many people have more than one.",
    keywords: "mobile phones cell smartphones subscriptions",
  }),
  num("broadband_per100", "Technology", "Home broadband", {
    short: "Broadband", step: 0.5, format: "per100", clip: true,
    say: (b) => `fixed broadband connections number ${b}`,
    info: "Fixed (wired) high-speed internet subscriptions per 100 people.",
    keywords: "broadband internet fixed fibre connection",
  }),
  num("secure_servers_per_million", "Technology", "Secure internet servers", {
    short: "Servers", scale: "log", format: "permillion",
    say: (b) => `secure internet servers number ${b}`,
    info: "Secure web servers (using encryption) per million people. A rough measure of how much of the internet is hosted in the country.",
    keywords: "servers data centres internet hosting digital infrastructure",
  }),
  num("rnd_pct", "Technology", "Research & development spending", {
    short: "R&D", step: 0.1, format: "pct", clip: true,
    say: (b) => `research and development spending is ${b} of GDP`,
    info: "Spending on research and development by governments, businesses and universities, as a share of GDP.",
    keywords: "research development r&d innovation science spending",
  }),
  num("researchers_per_million", "Technology", "Researchers", {
    short: "Researchers", scale: "log", format: "permillion",
    say: (b) => `researchers number ${b}`,
    info: "People working in research and development per million people.",
    keywords: "researchers scientists science research",
  }),
  num("patents_per_million", "Technology", "Patent applications", {
    short: "Patents", scale: "log", format: "permillion",
    say: (b) => `patent applications by residents number ${b}`,
    info: "Patent applications by residents per million people. A measure of new inventions.",
    keywords: "patents inventions innovation intellectual property",
  }),
  num("articles_per_million", "Technology", "Scientific articles", {
    short: "Science articles", scale: "log", format: "permillion",
    say: (b) => `scientific articles published number ${b}`,
    info: "Scientific and technical journal articles per million people.",
    keywords: "science research articles publications universities",
  }),
  num("hightech_exports_pct", "Technology", "High-tech exports", {
    short: "High-tech exports", format: "pct", bounds: [0, 70],
    say: (b) => `${b} of manufactured exports are high-tech`,
    info: "Share of manufactured exports that are high-tech products such as computers, aircraft, medicines and scientific instruments.",
    keywords: "high tech exports technology electronics manufacturing",
  }),
  num("ict_services_exports_pct", "Technology", "Digital service exports", {
    short: "Digital services", format: "pct", bounds: [0, 80],
    say: (b) => `${b} of service exports are computer and communication services`,
    info: "Computer, communications and information services as a share of all services exported, such as software and IT outsourcing.",
    keywords: "ict software it services digital exports outsourcing",
  }),

  // ---------------- Climate ----------------
  {
    key: "main_climate", type: "cat", group: "Climate",
    label: "Main climate type", short: "Climate",
    order: ["Tropical", "Dry", "Temperate", "Continental", "Polar"],
    say: (v) => `the main climate type is ${v.toLowerCase()}`,
    source: "koppen", yearText: "1976–2000 climate",
    info: "The Köppen climate group covering most of the country's land: tropical (hot and wet), dry (desert and semi-arid), temperate (mild), continental (cold winters) or polar.",
    keywords: "climate koppen zone tropical dry desert temperate continental polar biome",
  },
  {
    key: "climate_zones", type: "multi", group: "Climate",
    label: "Has climate zone", short: "Climate zone",
    order: ["Tropical rainforest", "Tropical monsoon", "Tropical savanna", "Hot desert", "Cold desert", "Hot semi-arid", "Cold semi-arid", "Mediterranean", "Humid subtropical", "Subtropical highland or monsoon", "Oceanic", "Continental", "Subarctic", "Tundra", "Ice cap"],
    modes: true,
    say: (v) => `at least 10% of the land has a ${v.toLowerCase()} climate`,
    sayNot: (v) => `little or no land has a ${v.toLowerCase()} climate`,
    source: "koppen", yearText: "1976–2000 climate",
    info: "Köppen climate zones covering at least 10% of the country's land. Open a country's profile to see the share of each. Worked out on a half-degree grid, so very small countries take the zone nearest their centre.",
    keywords: "climate zone koppen rainforest savanna desert mediterranean monsoon tundra oceanic",
  },
  num("dry_climate_pct", "Climate", "Land with a dry climate", {
    short: "Dry land", format: "pct", bounds: [0, 100], source: "koppen", year: null, yearText: "1976–2000 climate",
    say: (b) => `${b} of the land has a desert or semi-arid climate`,
    info: "Share of the country's land with a desert or semi-arid (Köppen dry) climate.",
    keywords: "desert arid semi-arid drylands dry climate",
  }),
  num("avg_temp", "Climate", "Average temperature", {
    short: "Avg temp", step: 0.5, format: "temp", source: "temperature", year: null, yearText: "1961–1990",
    say: (b) => `the average temperature is ${b}`,
    info: "Average yearly temperature across the country, 1961–1990. Today's temperatures are generally around 1°C higher.",
    keywords: "temperature hot cold warm climate average",
  }),
  num("rainfall_mm", "Climate", "Average rainfall", {
    short: "Rainfall", scale: "log", format: "mm",
    say: (b) => `average rainfall is ${b} a year`,
    info: "Long-term average precipitation (rain and snow) in millimetres per year.",
    keywords: "rainfall precipitation rain wet dry climate",
  }),
  num("co2_mt", "Climate", "CO₂ emissions (total)", {
    short: "CO₂ total", scale: "log", format: "mt", source: "owid", year: "co2_mt_year",
    say: (b) => `CO₂ emissions are ${b} a year`,
    info: "Carbon dioxide from fossil fuels and industry, in millions of tonnes a year.",
    keywords: "co2 emissions carbon total climate change",
  }),
  num("co2_world_share", "Climate", "Share of world CO₂ emissions", {
    short: "% world CO₂", scale: "log", format: "pct", source: "owid", year: "co2_world_share_year",
    say: (b) => `the country emits ${b} of the world's CO₂`,
    info: "The country's share of the world's carbon dioxide emissions from fossil fuels and industry this year.",
    keywords: "co2 share global emissions polluters climate",
  }),
  num("co2_cumulative_share", "Climate", "Share of all CO₂ since 1750", {
    short: "Historical CO₂", scale: "log", format: "pct", source: "owid", year: "co2_cumulative_share_year",
    say: (b) => `the country has emitted ${b} of all CO₂ since 1750`,
    info: "The country's share of all carbon dioxide emitted from fossil fuels and industry since 1750: its historical responsibility for climate change.",
    keywords: "historical cumulative emissions responsibility climate justice co2",
  }),
  num("warming_share", "Climate", "Share of global warming caused", {
    short: "% of warming", scale: "log", format: "pct", source: "owid", year: "warming_share_year",
    say: (b) => `the country has caused ${b} of global warming so far`,
    info: "The country's share of the rise in global temperature caused by greenhouse gases (CO₂, methane and nitrous oxide, including from land use and farming).",
    keywords: "warming temperature responsibility climate change contribution",
  }),
  num("ghg_per_capita", "Climate", "Greenhouse gases per person", {
    short: "GHG per person", scale: "log", format: "tonnes", source: "owid", year: "ghg_per_capita_year",
    say: (b) => `greenhouse gas emissions are ${b} per person`,
    info: "All greenhouse gases (carbon dioxide, methane, nitrous oxide), including from land use and farming, in tonnes of CO₂-equivalent per person each year.",
    keywords: "greenhouse gases methane emissions per capita climate",
  }),
  num("co2_consumption_per_capita", "Climate", "CO₂ from what people buy", {
    short: "Consumption CO₂", scale: "log", format: "tonnes", source: "owid", year: "co2_consumption_per_capita_year",
    say: (b) => `consumption-based CO₂ is ${b} per person`,
    info: "CO₂ per person counting emissions where goods are used, not where they are made: imported goods add to the total and exports are taken off.",
    keywords: "consumption based emissions imported carbon footprint",
  }),

  // ---------------- Energy & resources ----------------
  num("energy_per_capita", "Energy & resources", "Energy use per person", {
    short: "Energy use", scale: "log", format: "kwh", source: "owidenergy",
    say: (b) => `energy use is ${b}`,
    info: "All energy used (for electricity, transport, heating and industry) per person each year, in kilowatt-hours.",
    keywords: "energy consumption use per capita",
  }),
  ...[
    ["renewables_elec_pct", "Electricity from renewables", "Renewable electricity", "renewable sources (hydro, wind, solar and others)"],
    ["low_carbon_elec_pct", "Electricity from low-carbon sources", "Low-carbon electricity", "low-carbon sources (renewables and nuclear)"],
    ["fossil_elec_pct", "Electricity from fossil fuels", "Fossil electricity", "fossil fuels (coal, oil and gas)"],
    ["coal_elec_pct", "Electricity from coal", "Coal power", "coal"],
    ["nuclear_elec_pct", "Electricity from nuclear", "Nuclear power", "nuclear power"],
    ["hydro_elec_pct", "Electricity from hydropower", "Hydropower", "hydropower"],
    ["wind_elec_pct", "Electricity from wind", "Wind power", "wind"],
    ["solar_elec_pct", "Electricity from solar", "Solar power", "solar"],
  ].map(([key, label, short, what]) => num(key, "Energy & resources", label, {
    short, format: "pct", bounds: [0, 100], source: "owidenergy",
    say: (b) => `${b} of electricity comes from ${what}`,
    info: `Share of the country's electricity generated from ${what}.`,
    keywords: "electricity power generation energy mix " + label.toLowerCase(),
  })),
  ...[
    ["oil_twh", "Oil production", "Oil", "oil"],
    ["gas_twh", "Natural gas production", "Gas", "natural gas"],
    ["coal_twh", "Coal production", "Coal", "coal"],
  ].map(([key, label, short, what]) => num(key, "Energy & resources", label, {
    short, scale: "log", format: "twh", source: "owidenergy",
    say: (b) => `${what} production is ${b} a year`,
    info: `Energy content of the ${what} produced each year, in terawatt-hours (TWh). Zero means none is produced.`,
    keywords: `${what} production fossil fuel resources producer`,
  })),
  {
    key: "major_producer", type: "multi", group: "Energy & resources",
    label: "Major mineral producer", short: "Major producer",
    order: ["Lithium", "Cobalt", "Copper", "Nickel", "Rare earths", "Graphite", "Iron ore", "Bauxite", "Manganese", "Tin", "Gold", "Silver", "Platinum"],
    modes: true,
    say: (v) => `the country mines at least 5% of the world's ${v.toLowerCase()}`,
    sayNot: (v) => `the country mines less than 5% of the world's ${v.toLowerCase()}`,
    source: "usgs", yearText: "2025",
    info: "Countries that mine at least 5% of the world's supply of each mineral (2025 estimates). Lithium, cobalt, nickel, graphite and rare earths are key for batteries and electronics. Open a country's profile to see its share of each.",
    keywords: "minerals mining lithium cobalt copper rare earths critical minerals gold iron ore bauxite resources",
  },
  num("resource_rents_pct", "Energy & resources", "Natural resource income", {
    short: "Resource income", step: 0.5, format: "pct", clip: true,
    say: (b) => `natural resources earn ${b} of GDP`,
    info: "Profit from oil, gas, coal, minerals and forests, as a share of GDP. High values mean an economy that depends on natural resources.",
    keywords: "resource rents dependence resource curse oil minerals",
  }),
  num("oil_rents_pct", "Energy & resources", "Oil income", {
    short: "Oil income", step: 0.5, format: "pct", clip: true,
    say: (b) => `oil earns ${b} of GDP`,
    info: "Profit from oil production as a share of GDP.",
    keywords: "oil rents petroleum dependence",
  }),
  num("mineral_rents_pct", "Energy & resources", "Mining income", {
    short: "Mining income", step: 0.5, format: "pct", clip: true,
    say: (b) => `mining earns ${b} of GDP`,
    info: "Profit from mining metals and minerals as a share of GDP.",
    keywords: "mineral rents mining dependence",
  }),

  // ---------------- Environment ----------------
  num("co2_per_capita", "Climate", "CO₂ per person", {
    short: "CO₂", scale: "log", format: "tonnes", source: "owid", year: "co2_year",
    say: (b) => `CO₂ emissions per person are ${b}`,
    info: "Carbon dioxide from fossil fuels and industry each year, in tonnes per person.",
    keywords: "carbon emissions climate pollution co2 environment",
  }),
  num("renewables_pct", "Energy & resources", "Renewable share of all energy", {
    short: "Renewables", format: "pct", bounds: [0, 100],
    say: (b) => `${b} of energy used is renewable`,
    info: "Share of all energy used (not just electricity) that comes from renewable sources, including hydro, wind, solar and wood. Wood burnt for cooking makes this high in many low-income countries.",
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
  unhcr: { name: "UNHCR Refugee Population Statistics", url: "https://www.unhcr.org/refugee-statistics/", licence: "CC BY 4.0" },
  un: { name: "United Nations Security Council", url: "https://main.un.org/securitycouncil/en/content/current-members", licence: "Public facts, compiled for this site" },
  treaties: { name: "UN Treaty Collection and treaty bodies, compiled for this site (lists.csv)", url: "https://treaties.un.org/", licence: "Public facts, CC0" },
  sipri: { name: "SIPRI Military Expenditure Database (via World Bank)", url: "https://www.sipri.org/databases/milex", licence: "SIPRI terms; check before commercial use" },
  iiss: { name: "IISS Military Balance (via World Bank)", url: "https://data.worldbank.org/indicator/MS.MIL.TOTL.P1", licence: "Check terms before commercial use" },
  sport: { name: "FIFA, IOC and Commonwealth Games records, compiled for this site (lists.csv, worldcups.csv)", url: "https://www.fifa.com/", licence: "Public facts, CC0" },
  olympics: { name: "Paris 2024 medal table", url: "https://olympics.com/en/olympic-games/paris-2024/medals", licence: "Public facts" },
  koppen: { name: "Köppen–Geiger climate zones (Kottek, Rubel et al.), via the kgc package", url: "https://github.com/cran/kgc", licence: "BSD 2-clause" },
  temperature: { name: "samayo/country-json (Wikipedia 1961–1990 averages)", url: "https://github.com/samayo/country-json", licence: "MIT" },
  owidenergy: { name: "Our World in Data, energy dataset", url: "https://github.com/owid/energy-data", licence: "CC BY 4.0" },
  usgs: { name: "USGS Mineral Commodity Summaries 2026", url: "https://pubs.usgs.gov/publication/mcs2026", licence: "Public domain" },
  whc: { name: "UNESCO World Heritage List (via worldheritagesite.org)", url: "https://whc.unesco.org/en/list/", licence: "Public facts" },
  msai: { name: "Microsoft AI Diffusion Report 2026 Q1", url: "https://www.microsoft.com/en-us/corporate-responsibility/topics/AI-Economy-Institute/", licence: "Microsoft terms of use; check before commercial use" },
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

/*
 * Families: related measures shown as ONE item in the filter menu. When added,
 * the filter panel has a picker to switch between them. Every measure keeps its
 * own entry above, so country profiles, sorting and old links are unchanged.
 *   id        family name (used only in code)
 *   label     full name, shown on hover / tap
 *   short     name on the menu chip
 *   info      one-line definition for the hover card
 *   variants  [key, picker label] pairs; the first is chosen when added
 */
window.FAMILIES = [
  { id: "hdi", label: "Human Development Index", short: "HDI", info: "A score from 0 to 1 combining life expectancy, schooling and income. Choose the score, world rank, or how much inequality lowers it.",
    variants: [["hdi", "Score"], ["hdi_rank", "World rank"], ["ihdi", "Adjusted for inequality"], ["hdi_loss", "Lost to inequality"]] },
  { id: "education", label: "Education", short: "Education", info: "Literacy, years in school and government spending on education.",
    variants: [["literacy", "Adult literacy"], ["mean_schooling", "Years in school (adults)"], ["expected_schooling", "Expected years (children)"], ["education_spend", "Spending, % GDP"]] },
  { id: "access", label: "Access to electricity and water", short: "Electricity & water", info: "Share of people with electricity, or with safe drinking water, at home.",
    variants: [["electricity", "Electricity"], ["safe_water", "Safe water"]] },
  { id: "births", label: "Birth and death rates", short: "Birth & death rates", info: "Births or deaths each year per 1,000 people: the key numbers in the demographic transition model.",
    variants: [["birth_rate", "Birth rate"], ["death_rate", "Death rate"], ["natural_increase", "Natural increase"]] },
  { id: "age", label: "Age structure", short: "Age", info: "How old the population is: median age, share of children, share of older people, and the dependency ratio.",
    variants: [["median_age", "Median age"], ["pct_under15", "% under 15"], ["pct_over65", "% 65 and over"], ["dependency", "Dependency ratio"]] },
  { id: "childdeaths", label: "Child deaths", short: "Child deaths", info: "Babies who die before age 1, or children before age 5, per 1,000 born.",
    variants: [["infant_mortality", "Under 1"], ["under5_mortality", "Under 5"]] },
  { id: "gii", label: "Gender Inequality Index", short: "GII", info: "UNDP's measure of inequality between women and men, from 0 (equal) to 1. Choose the score or the world rank.",
    variants: [["gii", "Score"], ["gii_rank", "World rank"]] },
  { id: "women", label: "Women's lives", short: "Women's lives", info: "The four measures behind the Gender Inequality Index: women in parliament, women in work, maternal deaths and teenage births.",
    variants: [["women_parliament", "In parliament"], ["female_labour", "In work"], ["maternal_mortality", "Maternal deaths"], ["adolescent_births", "Teenage births"]] },
  { id: "jobs", label: "Jobs by sector", short: "Jobs by sector", info: "Share of workers in farming (primary), industry (secondary) or services (tertiary): the Clark–Fisher model.",
    variants: [["emp_agriculture", "Farming"], ["emp_industry", "Industry"], ["emp_services", "Services"]] },
  { id: "tradesize", label: "Trade", short: "Trade", info: "How much a country trades: exports, imports, both together, the trade balance, or total exports in dollars.",
    variants: [["trade_pct", "Exports + imports"], ["exports_pct", "Exports"], ["imports_pct", "Imports"], ["trade_balance_pct", "Balance"], ["exports_usd", "Exports (US$)"]] },
  { id: "exportmix", label: "What exports are made of", short: "Export types", info: "Share of goods exported that are fuels, ores and metals, food, farm raw materials or manufactured goods.",
    variants: [["exp_fuel_pct", "Fuel"], ["exp_metals_pct", "Ores & metals"], ["exp_food_pct", "Food"], ["exp_agri_raw_pct", "Farm materials"], ["exp_manuf_pct", "Manufactures"]] },
  { id: "migration", label: "Migration", short: "Migration", info: "People born abroad, net migration, and money sent home by migrants.",
    variants: [["migrants_pct", "Born abroad"], ["net_migration", "Net migration"], ["remittances_pct", "Money sent home"]] },
  { id: "refugees", label: "Refugees and displaced people", short: "Refugees", info: "Refugees a country hosts, refugees who have fled it, people displaced inside it, and asylum seekers waiting for a decision.",
    variants: [["refugees_hosted", "Hosted"], ["refugees_hosted_per1000", "Hosted per 1,000"], ["refugees_from", "Fled"], ["refugees_from_per1000", "Fled per 1,000"], ["idps", "Displaced at home"], ["asylum_seekers_hosted", "Asylum seekers"]] },
  { id: "language", label: "Language", short: "Language", info: "Official languages, or languages spoken by at least 1 in 10 people.",
    variants: [["official_languages", "Official"], ["spoken_languages", "Spoken by 10%+"]] },
  { id: "religion", label: "Religion (% of people)", short: "Religion %", info: "Share of people who follow each religion, or who have no religion (Pew Research Center, 2010).",
    variants: [["pct_muslim", "Muslim"], ["pct_christian", "Christian"], ["pct_unaffiliated", "No religion"], ["pct_hindu", "Hindu"], ["pct_buddhist", "Buddhist"], ["pct_jewish", "Jewish"], ["pct_folk", "Folk"]] },
  { id: "touristnumbers", label: "Tourist numbers", short: "Tourists", info: "International tourist arrivals, arrivals per 100 residents, and trips abroad by residents (2019).",
    variants: [["tourists", "Arrivals"], ["tourists_per100", "Per 100 residents"], ["tourist_departures", "Trips abroad"]] },
  { id: "tourismmoney", label: "Tourism income", short: "Tourism income", info: "Money spent by international tourists, in dollars or as a share of export earnings (2019).",
    variants: [["tourism_receipts_usd", "US$"], ["tourism_receipts_pct", "% of exports"]] },
  { id: "connectivity", label: "Internet and phones", short: "Internet & phones", info: "Internet users, mobile phone subscriptions, home broadband and secure internet servers.",
    variants: [["internet", "Internet users"], ["mobile_per100", "Mobiles"], ["broadband_per100", "Broadband"], ["secure_servers_per_million", "Servers"]] },
  { id: "research", label: "Research and innovation", short: "Research", info: "Spending on research and development, researchers, patent applications and scientific articles.",
    variants: [["rnd_pct", "R&D spending"], ["researchers_per_million", "Researchers"], ["patents_per_million", "Patents"], ["articles_per_million", "Science articles"]] },
  { id: "techexports", label: "Technology exports", short: "Tech exports", info: "High-tech goods as a share of manufactured exports, or digital services as a share of service exports.",
    variants: [["hightech_exports_pct", "High-tech goods"], ["ict_services_exports_pct", "Digital services"]] },
  { id: "democracyscores", label: "Democracy scores", short: "Democracy scores", info: "V-Dem scores from 0 to 1 for liberal democracy and for freedom of expression.",
    variants: [["libdem", "Liberal democracy"], ["free_expression", "Free expression"]] },
  { id: "milspend", label: "Military spending", short: "Military spending", info: "Spending on the armed forces, as a share of GDP or in US dollars.",
    variants: [["military_spend_pct", "% of GDP"], ["military_spend_usd", "US$"]] },
  { id: "forces", label: "Armed forces", short: "Armed forces", info: "Number of active military personnel, or their share of all workers.",
    variants: [["armed_forces", "Number"], ["armed_forces_pct", "% of workers"]] },
  { id: "worldcups", label: "World Cup wins", short: "World Cup wins", info: "Men's or women's football World Cup titles.",
    variants: [["wc_men_titles", "Men's"], ["wc_women_titles", "Women's"]] },
  { id: "medals", label: "Olympic medals (Paris 2024)", short: "Olympic medals", info: "Medals or gold medals won at Paris 2024, or medals per million people.",
    variants: [["olympic_medals", "All medals"], ["olympic_golds", "Golds"], ["medals_per_million", "Per million people"]] },
  { id: "borders", label: "Borders", short: "Borders", info: "Number of neighbouring countries, or total length of land borders.",
    variants: [["neighbours", "Neighbours"], ["border_km", "Length"]] },
  { id: "weather", label: "Temperature and rainfall", short: "Temp & rainfall", info: "Average yearly temperature (1961–1990) and average rainfall.",
    variants: [["avg_temp", "Temperature"], ["rainfall_mm", "Rainfall"]] },
  { id: "emissions", label: "Emissions", short: "Emissions", info: "CO₂ per person or in total, all greenhouse gases per person, or CO₂ counted where goods are used.",
    variants: [["co2_per_capita", "CO₂ per person"], ["co2_mt", "CO₂ total"], ["ghg_per_capita", "All gases per person"], ["co2_consumption_per_capita", "From what people buy"]] },
  { id: "responsibility", label: "Responsibility for climate change", short: "Climate responsibility", info: "Share of the world's CO₂ emitted now, share of all CO₂ since 1750, and share of global warming caused.",
    variants: [["co2_world_share", "% of world CO₂ now"], ["co2_cumulative_share", "% of all CO₂ since 1750"], ["warming_share", "% of warming"]] },
  { id: "energyuse", label: "Energy use", short: "Energy use", info: "Energy used per person, and the share of all energy that is renewable.",
    variants: [["energy_per_capita", "Per person"], ["renewables_pct", "Renewable share"]] },
  { id: "electricity", label: "Where electricity comes from", short: "Electricity sources", info: "Share of electricity generated from renewables, low-carbon sources, fossil fuels, coal, nuclear, hydro, wind or solar.",
    variants: [["renewables_elec_pct", "Renewables"], ["low_carbon_elec_pct", "Low-carbon"], ["fossil_elec_pct", "Fossil fuels"], ["coal_elec_pct", "Coal"], ["nuclear_elec_pct", "Nuclear"], ["hydro_elec_pct", "Hydro"], ["wind_elec_pct", "Wind"], ["solar_elec_pct", "Solar"]] },
  { id: "fossilprod", label: "Fossil fuel production", short: "Oil, gas & coal", info: "Energy content of the oil, natural gas or coal a country produces each year.",
    variants: [["oil_twh", "Oil"], ["gas_twh", "Gas"], ["coal_twh", "Coal"]] },
  { id: "resourceincome", label: "Income from natural resources", short: "Resource income", info: "Profit from all natural resources, from oil, or from mining, as a share of GDP.",
    variants: [["resource_rents_pct", "All resources"], ["oil_rents_pct", "Oil"], ["mineral_rents_pct", "Mining"]] },
];

/* Themes along the top of the page; each opens a panel with these categories. */
window.THEMES = [
  { id: "people", label: "People", groups: ["Population", "Health", "Gender", "Culture", "Sport"] },
  { id: "wealth", label: "Wealth & work", groups: ["Development", "Work & money", "Trade", "Tourism", "Technology"] },
  { id: "world", label: "Politics & the world", groups: ["Politics", "UN & treaties", "Global links", "Refugees", "Military"] },
  { id: "places", label: "Places", groups: ["Geography", "Cities"] },
  { id: "planet", label: "Planet", groups: ["Climate", "Energy & resources", "Environment"] },
];

/* Shorter names for some filters on the menu chips (the full name shows on hover or tap). */
window.MENU_LABELS = {
  income_group: "Income group", hdi_group: "HDI group", gni_ppp: "Income per person", gini: "Inequality (Gini)",
  extreme_poverty: "Extreme poverty", ai_users_pct: "AI use", world_heritage_sites: "World Heritage sites",
  no_land_borders: "Island", capital_is_largest: "Capital is largest city", dry_climate_pct: "Dry land",
  city_population: "City size", city_capital: "Capital cities", cities_1m: "Million-plus cities",
  gdp_per_capita: "GDP per person", urban_pct: "Urban population", pop_growth: "Population growth",
  health_spend: "Health spending", nuclear_armed: "Nuclear weapons", main_climate: "Main climate",
  climate_zones: "Climate zones", major_producer: "Major mineral producer", gdi: "GDI", gdi_group: "GDI group",
  security_council: "UN Security Council", regime: "Type of government", treaties_joined: "Treaties joined",
  events_hosted: "Has hosted", density: "Population density", area_km2: "Area", subregion: "Region of the world",
};
