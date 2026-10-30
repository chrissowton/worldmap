# Which Countries?

An open-source world map for asking questions about the world, built with human geography students in mind. Stack filters on development, population, health, gender, work, trade, globalisation, refugees, cities, culture, tourism, technology (including AI), politics, UN treaties, military, sport, climate, energy and mineral resources, and the environment, and watch the map narrow down to the countries that fit.

- *Which countries have very high inequality (Gini over 50) outside Africa?*
- *Which high-income countries still have a fertility rate above 2.1?*
- *Which cities over 5 million are in lower-middle-income countries?*
- *In which BRICS countries is the capital not the largest city?*

There are over 160 measures for 194 countries, plus 6,000+ cities and 1,500 refugee routes. **[DATA.md](DATA.md) lists every measure with its source, year and coverage.**

It's a static website: no server, no database, no accounts. All the data is in a few JSON files that the browser loads once.

## Features

- **One control panel.** On a computer, everything sits in a panel on the left, in the order you use it: **1 Filters** (your active filters, then the themes to add more), **2 Show the results as** (Map, Compare, Rankings, Charts, Insights), **3 Learn & share** (Quiz, Factfile, Side by side, Share, Download), with **Back / Home / Clear all** at its foot. Search and plain-English questions go in the box at the top. On a phone, a tab bar along the bottom (Filters, View, List, Quiz, More) opens each part as a sheet, and Back / Home / Clear all sit at the top.
- **Attitudes & values** (World Values Survey): what people believe, for about 115 countries (the European Values Study covers most of Europe). Happiness, life satisfaction and trust in others; how religious people are; views on homosexuality, abortion and bribery; gender roles; support for democracy, strong leaders or army rule; confidence in the government, parliament, police, courts, press, army, churches and the UN; willingness to fight for one's country and national pride; who people would not want as neighbours; environment versus growth; and post-materialism. Plus, from Gallup-run surveys covering about 140 countries: the World Happiness Report score and rank; trust in science, scientists, doctors, government, journalists and neighbours, views on vaccines and AI (Wellcome Global Monitor 2026); and worries about crime, weather, roads and water, harm from crime and severe weather, disasters and how prepared governments are, discrimination, how long households could last without income, the biggest everyday risk and a resilience index (World Risk Poll 2019–2025). For Africa, Afrobarometer Round 10 (38 countries) adds support for democracy, lived poverty, thoughts of emigrating and views of China, the USA, Russia and former colonial powers; Pew's 2025 survey (24 countries) adds views of the USA, China, the UN, the EU, Russia and NATO. Each figure is the latest survey from 2010 on; earlier waves (back to the 1990s) show on the year slider, and Charts shows each country's surveys as dots.
- **My worksheet**: "＋" buttons collect the map or chart on screen, quiz questions (answers go in an answer key), a country's key facts and Number hunt posters. Arrange them, add your own questions and answer lines, and print. It's kept in your browser until you clear it, with no account needed.
- **Number hunt** (Learn & share, or type a number in the search box and press Enter): finds facts from across the site that come to that number (life expectancy of 42 years, 42% of land covered by forest, a peak 4,200 m high…) and lays them out as a one-page poster to save or print.
- **Physical and human filters work together**: a physical filter with a limit (deserts over 100,000 km², rivers through 3+ countries) also picks out the countries that contain such a feature, so "countries with a big desert and a river through 3+ countries and over 20 million people" works.
- **Six themes in the panel** (People, Attitudes & values, Wealth & work, Politics & the world, Places, Planet). Each opens its categories as small colour-coded chips. Hover over a chip (or tap it on a phone) for a plain-English definition, then click (or tap **Add filter**) to add it. A clock marks measures with yearly data. You can also search by name.
- **Related measures are grouped.** For example, one "Religion %" filter lets you switch between Muslim, Christian, Hindu and so on; "Electricity sources" switches between coal, nuclear, wind and the rest. List filters such as "Treaties joined" or "Member of" can match **any**, **all** or **none** of the ticked options.
- **Filters as chips.** Each active filter is a chip; click it to adjust, × to remove.
- **Smart controls.** Range sliders show a histogram of where countries sit. Option lists show how many countries each choice would give, and grey out choices that would give none.
- **Plain-English summary.** "Showing 4 countries where at least 50% of people are Muslim and the country is a democracy."
- **Near misses.** Countries that fail just one filter are listed (grouped by the filter they fail) and, when there are only a few, shaded on the map.
- **Help with dead ends.** If nothing matches, it tells you which filter to drop and how many countries that would bring back.
- **Cities.** Add a city filter (population, capital) to show cities as dots sized by population, inside the countries that match your other filters. A Cities tab lists them.
- **Year slider.** Drag back in time, or press play, and filters with yearly data (population, fertility, life expectancy, urbanisation, GDP, HDI, democracy, CO₂, refugees and more) show that year. The slider only covers years the active filters have data for (HDI from 1990, for example). [DATA.md](DATA.md) marks which measures have yearly data.
- **Zoom in for detail.** Country names, then capitals and cities, seas, lakes, rivers, mountain ranges, deserts and peaks appear as you zoom in. The **Aa** button turns them on and off.
- **Country factfiles.** The 📄 Factfile button (or the button on any country profile) makes a printable summary of every measure for one country, with an outline map, a locator map and key facts. Each measure shows the country's value, its world rank, and the medians for its continent and for the world, with a small chart of where it sits. A "Changes over time" section has eight small trend charts and the population pyramid (now and in 1990). Print it, save it as a PDF from the print window, or download it as a Word file. (Printing and downloads don't work inside the claude.ai preview, only on the real website.)
- **Human and physical geography.** A switch in the header changes the whole site between human geography (the default) and physical geography, each with its own themes, filters, quiz topics and map.
  - **Physical themes:** Landscape (heights, mountain ranges, peaks, plateaus, deserts and other landforms), Water & ice (rivers, lakes, waterfalls, deltas, glaciers), Tectonics (plates, plate boundaries, volcanoes, earthquakes), Climate & biomes, Coasts & oceans (coastlines, seas, trenches) and Hazards.
  - **Filters for features as well as countries.** Some physical filters pick out features on the map instead of countries: rivers by length or the ocean they drain to, lakes, peaks, landforms, waterfalls, deltas by shape, trenches, volcanoes (by type, last eruption, setting, VEI), earthquakes of magnitude 6+ since 1900 (by magnitude, year, depth and the nearest plate boundary) and plate boundaries (constructive, destructive, collision, conservative). Each kind gets its own tab in the results list, with a profile for every feature. Country filters still work alongside them: add "Continent: Asia" to see only Asia's volcanoes.
  - **Show everything at once.** The physical 🎨 Map style card has "Show all on the map" switches for earthquakes (all 14,000+ of magnitude 6 or more, drawn on a fast canvas layer), volcanoes, peaks, mountain ranges, deserts, rivers, lakes, plate boundaries, trenches, waterfalls and deltas.
  - **Labels.** Features on the map are named, starting with the most important (the biggest earthquakes, highest peaks, longest rivers) and adding more as you zoom in, without overlapping.
  - **Deserts, mountain ranges, rivers and lakes show their own shapes,** not the countries they cross. Pick them by name, or leave the list unticked to show them all.
  - **Physical base maps:** landforms, biomes, climate zones or tectonic plates, with plate boundaries, major rivers and ice drawn on top (🎨 Map style).
  - **Country profiles and factfiles** gain a physical geography section: terrain, highest and lowest points, coastline, seas, plates, volcanoes, earthquakes, rivers, lakes, biomes and hazards.
  - **About 4,000 physical quiz questions**, on mountains, rivers and lakes, volcanoes, earthquakes, plates, deserts and landforms, coasts and oceans, biomes and hazards.
- **Four ways to look at the results.** The tabs above the map switch between:
  - **Map**, with a 🎨 **Map style** button: colour by your filters, by **change over time** (any yearly measure between two years you choose, as an amount or a % change), or by **two measures at once** (each split into thirds, with a 3 × 3 colour key). Tick **Size countries by population** to draw every country as a circle sized by its population.
  - **Compare**: a Gapminder-style bubble chart of any two measures, with bubbles sized by population (or another total) and coloured by continent or income group. When both measures have yearly data, press ▶ to watch the bubbles move through the years; click a bubble to follow it and draw its path. A plain-English line says how strong the link is (and that a link isn't proof of cause), and you can add a trend line or log scales.
  - **Rankings**: every country in order as bars, or grouped by continent with each continent's median, for any year.
  - **Ask in plain English**: type a question such as “How many democracies have between 45 and 55% women in parliament and are at stage 4 or 5 of the demographic transition?” in the search box. It is turned into filters (shown as chips before you press Enter), plus a chart, comparison, ranking or total when the question asks for one. It runs entirely in the browser (`ask.js`), with no AI service, so some wordings won't be understood; anything it skipped is listed.
  - **Highest/lowest n, quartiles and quintiles**: any number filter can pick the top or bottom n countries, or one or more quartiles or quintiles, instead of a range, either from all countries or only from those that pass your other filters.
  - **Glossary**: key terms (electoral autocracy, demographic transition stages, Köppen climates, plate boundaries, volcano types and more) have a dotted underline or an ⓘ: hover or tap to see what they mean (`glossary.js`).
  - **SDG tracker**: for 14 of the 17 Sustainable Development Goals, whether each country has achieved the goal, is on track for 2030, is improving too slowly, stagnating or getting worse, from the speed of change since 2015 (a simplified version of the SDSN's method; targets are listed in `filters.js` and `build_data.py`). Filters under Politics & the world, and a goal dashboard in every country profile.
  - **Insights** (`insights.js`): patterns found for you, using only the countries that match your filters: the strongest links between measures (rank correlations, with obvious pairs hidden), the biggest rises and falls over 5–30 years, countries changing demographic transition stage, human development group or type of government, who is next to cross a line such as 100 million people (a simple projection of the last ten years), and countries far above or below what another measure predicts.
  - **Year players** (map, Compare, Charts) have a speed button (½× to 4×) and mark years of unusually big change in amber or red on the slider; when the player reaches one, a light pulses, the player pauses a little longer and a note says what happened (for example life expectancy falling in 2020–21, or tourist numbers in 2020).
  - **Find out more**: country profiles, filter panes, “why?” links on each filter for a country, SDG goals and physical features link to Wikipedia, BBC News, Our World in Data and videos, plus hand-picked extras in `links.js`.
  - **Charts**: one measure drawn many ways, chosen from a row of tabs, like Our World in Data:
    - **Line**, **Bar**, **Table** (any two years, with the change) and **Map**.
    - **Stacked area**: totals by continent over time, as amounts or as shares of the world.
    - **Slope**: two years side by side, to see who rose and who fell.
    - **Marimekko**: bar heights show a measure (such as GDP per person) and bar widths show population, so you see how many people live at each level.
    - **Parts of a whole**: 100% bars for mixes: where electricity comes from, jobs by sector, what exports are made of, religions and age groups.
    - **Sankey**: refugee flows from where people fled to where they live now (by continent or country, every year since 1960), and exports by continent and type of product (goods by type, and services).
    - Groups (the world, each continent, the countries matching your filters) can show the **median** country, the **average** (weighted by population, or by GDP, exports or electricity where that makes more sense) or the **total**. Totals are offered only for things you can add up, such as population, GDP, CO₂ emissions, exports and refugees.
    - Chart types that don't suit a measure are dimmed; clicking one explains why and suggests measures that work.
  Your filters apply in every view: countries that don't match are greyed out.
- **More yearly data.** 58 measures now go back in time (most from 1960), including income, inequality, poverty, schooling, child and maternal deaths, internet and mobile use, jobs by sector, trade, forest cover, women in parliament and military spending. Survey-based measures that aren't collected every year use the latest figure from up to 4 years earlier.
- **Population pyramids and the demographic transition model.** Each country profile has a population pyramid for any year since 1960 (with an optional outline of another year), a trend chart against the world and continent medians, and the country's demographic transition stage. "DTM stage" and "Natural increase" are also filters, and change with the year slider.
- **Side by side.** Compare two or three countries on every measure, with a strip showing where each sits among all countries. It can be printed or saved as a PDF.
- **Share and set a task.** 🔗 Share gives a link to exactly what you see (filters, year, view, map style and the open country). Teachers can add a question or task, which students see at the top of the page when they open the link.
- **Download.** ⬇ Download saves the current map or chart as a PNG image (with a title and source line), or the data behind it as a CSV file that opens in Excel.
- **Neighbours.** Every country profile lists its neighbours and the approximate length of each land border.
- **Sorting.** A–Z and ↑/↓ buttons sort the results, like a spreadsheet. The red **Clear all** button on the map resets everything.
- **Refugee flows.** Open any country's profile to see where its refugees have gone, or where the refugees it hosts come from, and map either one.
- **Colour-coded categories.** Each category has its own colour, used in the search menu, the filter chips and the filter panel.
- **Shading by value.** Matching countries are shaded darker for higher values of the last number filter you added, or any number you pick under "Shade by". Near misses are striped.
- **Country profiles** with every value and its source year.
- **Shareable links.** The URL holds the current filters, e.g. `?f=official_languages:Portuguese,democracy:1`.
- **Quiz: "Ask the map a question".** Pick a topic (languages, religion, population, capitals, borders, wealth, health, gender, politics, climate, trade, technology, sport, refugees, or "Surprise me") and get a random question from a bank of about 6,000, generated from the site's own data. Type a guess, or ask for options: one right, two plausible and one clearly wrong. Typed answers allow small spelling slips and other names for countries ("Holland", "Ivory Coast", "USA"), and numbers allow a sensible margin. Each answer explains the facts and links to the map or the rankings. Questions already answered in this browser don't come up again, and a running score is kept. The 🎯 Quiz button brings the card back. Ready-made starter maps are underneath.
- Works on phones, in light and dark mode.

## Run it locally

Any static web server works:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

(Opening `index.html` directly from disk won't work, because browsers block loading the data files that way.)

## Publish it for free on GitHub Pages

1. Create a new public repository on GitHub and upload these files (or `git push` them).
2. In the repository, go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, pick `main` and `/ (root)`, and save.
4. After a minute the site is live at `https://<your-username>.github.io/<repo-name>/`.

Netlify and Cloudflare Pages also work: point them at the repository with no build command.

Then set your GitHub and donation links at the top of `filters.js` (`window.SITE`) so the "Contribute" and "Support this project" links appear.

## How it's built

Every file sits at the top level, so the repository can be uploaded through GitHub's website in one go.

| File | What it does |
|---|---|
| `index.html` | Page structure |
| `style.css` | All styling, including the dark theme |
| `filters.js` | **The list of filters.** The interface is generated from this, plus families (related measures grouped in the menu), themes, short menu names, starter questions, puzzles and source credits |
| `app.js` | Map (including the map styles), filtering logic, results list, URL state, and the Back / Home / Clear all dock, and the control panel and phone tab bar |
| `player.js` | Shared parts of the year players: the speed button and the amber/red “big change” years |
| `links.js` | “Find out more” links (Wikipedia, BBC, Our World in Data, videos). Add your own favourite articles or videos to `CURATED`, by measure key, country code or SDG |
| `ask.js` | Turns a question in plain English into filters and a view |
| `glossary.js` | Definitions of key terms, shown on hover |
| `picker.js` | The two-level measure picker: any `<select data-pick>` becomes a button that opens categories on the left and their measures on the right, with a search box |
| `TwemojiCountryFlags.woff2` | A small font that draws flag emojis, so flags appear on Windows (which otherwise shows two letters) |
| `quiz.js` | The quiz: builds the question bank from the data, checks typed answers and makes the multiple-choice options |
| `physical.js` | The physical side: feature layers, base maps, feature lists and profiles |
| `physical.json` | Physical map layers: peaks, landforms, rivers, lakes, ice, plates and boundaries, volcanoes, earthquakes, trenches, deltas, waterfalls, biomes, climate zones (built by `make_physical.py`) |
| `fetch_physical.py`, `make_physical.py` | Download and build the physical data (see "Updating the data") |
| `factbook_physical.csv`, `rivers.csv`, `lakes.csv`, `watersheds.csv` | Country facts, rivers, lakes and drainage basins from the CIA World Factbook |
| `volcanoes.csv`, `earthquakes.csv` | Volcanoes (Smithsonian GVP) and magnitude 6+ earthquakes since 1900 (USGS) |
| `trenches.csv`, `deltas.csv`, `waterfalls.csv` | Ocean trenches, river deltas and waterfalls. **Edited by hand** |
| `physical_countries.json` | Physical facts per country, merged into `countries.json` by `build_data.py` |
| `insights.js` | The Insights view |
| `charts.js` | The Charts view: line, bar, table, stacked area, slope, Marimekko, parts of a whole and Sankey charts, with medians, weighted averages and totals for groups of countries |
| `views.js` | The Compare and Rankings charts; trend charts and population pyramids in profiles and factfiles; side by side; share links and tasks; image and CSV downloads |
| `countries.json` | One record per country (built by `build_data.py`) |
| `cities.json` | Cities with 100,000+ people, plus every capital (built by `build_data.py`) |
| `world-50m.json` | Country shapes (Natural Earth, 1:50m, via world-atlas) |
| `worldbank_latest.csv`, `hdi_median_age.csv`, `cities.csv`, `pop.csv`, `gdp.csv`, `co2.csv`, `vdem_2020_on.csv`, `pew_religion_2010.csv`, `cldr_*.json`, `driving_side.json`, `world_countries.json` | The downloaded source files |
| `undp_hdr.csv` | UNDP's latest HDI, GII and related figures, extracted from UNDP's composite indices file |
| `lists.csv` | Yes/no facts, one row per country: UN treaties joined, Security Council seats, nuclear weapons, FIFA membership, World Cup / Olympics / Commonwealth Games hosts. **Edited by hand** |
| `worldcups.csv`, `olympic_medals.csv` | World Cup titles and the Paris 2024 medal table. **Edited by hand** |
| `refugees.csv`, `refugee_flows.csv` | UNHCR refugee totals per country, and every origin → host route with 100+ people |
| `timeseries.csv.gz` | Yearly values since 1960 for the year slider (gzipped, as the CSV is over 20 MB) |
| `timeseries.json` | The yearly values for the website (built by `build_data.py`) |
| `pyramids.csv`, `pyramids.json` | Population by 5-year age group and sex (World Bank / UN World Population Prospects); the JSON keeps every 5th year plus the latest (built by `build_data.py`) |
| `refugee_flows.json` | The refugee routes for the website (built by `build_data.py`) |
| `refugee_flows_years.json` | Refugee flows between countries for every year since 1960, for the Sankey chart (built by `build_data.py` from `refugee_flows_yearly.csv`) |
| `groups.csv` | Membership of the EU, NATO, OECD, G7, G20, BRICS, ASEAN, African Union, Arab League, Commonwealth, Mercosur and OPEC. **Edited by hand**: update it when a country joins or leaves |
| `climate_zones.csv` | Each country's Köppen climate zones and their share of its land (built by `make_climate_zones.py`) |
| `co2_climate.csv`, `energy_latest.csv` | Latest climate and energy figures from Our World in Data |
| `avg_temperature.json` | Average temperature, 1961–1990 |
| `minerals.csv` | Mine production of 13 minerals by country, from USGS. **Edited by hand** |
| `world_heritage.csv`, `ai_diffusion.csv` | World Heritage site counts and AI use. **Edited by hand** |
| `make_climate_zones.py` | Works out climate zones from a world climate grid |
| `features.json` | Rivers, lakes and named seas, mountain ranges, deserts and peaks for the zoom labels (built by `make_features.mjs`) |
| `borders.csv` | Every land border and its length (built by `make_borders.mjs`) |
| `make_features.mjs`, `make_borders.mjs`, `package.json` | Node tools for the two files above: run `npm install`, then `npm run features` or `npm run borders` |
| `factfile.js` | Country factfiles: the printable page and the Word download (uses the [docx](https://github.com/dolanmiu/docx) library, loaded only when someone downloads a Word file) |
| `fetch_raw.py` | Downloads fresh copies of the source files |
| `build_data.py` | Joins the source files into `countries.json` and `cities.json` |
| `make_data_table.cjs` | Writes `DATA.md` from the filter list |
| `build_single.py` | Bundles everything into one self-contained HTML file in `dist/` |

Libraries: [D3](https://d3js.org/) and [topojson-client](https://github.com/topojson/topojson-client), loaded from cdnjs. No build step and no framework.

## Adding a new characteristic

1. Get a source file with one value per country, ideally keyed by ISO 3-letter code, and add it to the repository.
2. In `build_data.py`, add a few lines that read it and set a field on each country, e.g. `rec["life_expectancy"] = ...`.
3. Run `python3 build_data.py`, then `node make_data_table.cjs` to refresh `DATA.md`.
4. In `filters.js`, add an entry describing the field: its type (`range`, `multi`, `cat` or `bool`), group, label, the sentence wording, the source and a one-line explanation.
5. If it's a new source, add it to `SOURCES` at the bottom of `filters.js`.

That's it: the search menu, chip, slider or checklist, histogram, profile page and About table all pick it up automatically.

## Updating the data

The attitudes figures (`attitudes.csv`) come from the World Values Survey Trend File, which may not be shared, so it is not in this repository. To rebuild them, download the Stata version from the [WVS site](https://www.worldvaluessurvey.org/WVSEVStrend.jsp), then run `python3 make_attitudes.py path/to/Trends_VS_1981_2022_Stata_v4_1.dta path/to/ZA7503_v3-0-0.dta` (the second file is the European Values Study Trend File from GESIS) before `build_data.py`. The other surveys (`surveys.csv`) are rebuilt the same way with `make_surveys.py`; run it without arguments to see which downloads it needs.


```bash
pip install pyreadr pandas geonamescache
python3 fetch_raw.py
python3 fetch_raw.py --history                  # yearly history for more measures, and population pyramids
python3 fetch_raw.py --undp HDR25_Composite_indices_complete_time_series.csv   # UNDP file, downloaded by hand
python3 fetch_physical.py                       # physical: Factbook facts, volcanoes
python3 fetch_physical.py --quakes query.csv    # earthquakes, from the USGS link in fetch_physical.py
python3 make_physical.py                        # physical map layers and country facts (a few minutes)
python3 build_data.py
node make_data_table.cjs
```

To give another World Bank measure yearly data, add it to `TS_WB_HISTORY` in `fetch_raw.py` and to the list after `TS_CODES` in `build_data.py`. It then appears with a clock in the menus, on the year slider, in Compare, Charts and the change map automatically. If it is something you can add up (a count or an amount of money), add its key to `SUM_KEYS` in `charts.js` so Charts offers totals.

The Charts view also uses `refugee_flows_years.json` (refugee flows between countries for every year) and some extra yearly series. Refresh them with `python3 fetch_raw.py --charts`, then `python3 build_data.py`.

## Data sources and licences

| Data | Source | Licence |
|---|---|---|
| Country list, official languages, currencies, region, borders, area | [mledoze/countries](https://github.com/mledoze/countries) | ODbL 1.0 |
| Languages spoken by 10%+ | [Unicode CLDR](https://cldr.unicode.org/) | Unicode License |
| Population, GDP | [World Bank](https://data.worldbank.org/) via [datasets/population](https://github.com/datasets/population) and [datasets/gdp](https://github.com/datasets/gdp) | CC BY 4.0 |
| Income groups, Gini, poverty, health, education, demographics, urbanisation, jobs by sector, trade, migration, gender measures, environment | [World Bank World Development Indicators](https://data.worldbank.org/) via [open-numbers](https://github.com/open-numbers/ddf--open_numbers--world_development_indicators) | CC BY 4.0 |
| HDI and ranks, Gender Inequality Index, Gender Development Index, schooling, inequality-adjusted HDI | [UNDP Human Development Report 2025](https://hdr.undp.org/data-center), composite indices file (`undp_hdr.csv`) | CC BY 3.0 IGO |
| Median age | [UN World Population Prospects](https://population.un.org/wpp/) via Gapminder | CC BY 3.0 IGO |
| Cities | [GeoNames](https://www.geonames.org/) via [geonamescache](https://pypi.org/project/geonamescache/) | CC BY 4.0 |
| Group memberships | Official membership lists, compiled by hand in `groups.csv` | CC0 |
| Refugees, asylum seekers, internally displaced people, refugee routes | [UNHCR Refugee Population Statistics](https://www.unhcr.org/refugee-statistics/) via the [refugees](https://github.com/cran/refugees) package | CC BY 4.0 |
| Military spending | [SIPRI](https://www.sipri.org/databases/milex) via the World Bank | SIPRI terms — check before commercial use |
| Armed forces personnel | IISS Military Balance via the World Bank | Check terms before commercial use |
| UN treaties, Security Council, nuclear-armed states, sport | Compiled by hand in `lists.csv`, `worldcups.csv` and `olympic_medals.csv` from the UN Treaty Collection, treaty bodies, FIFA, the IOC and Commonwealth Sport | CC0 |
| Afrobarometer measures: democracy, lived poverty, emigration, foreign influence, climate, gender, tolerance (38 African countries, 2024–2025) | [Afrobarometer Round 10](https://www.afrobarometer.org/data/). Country percentages calculated by `make_surveys.py` | Free to use with citation |
| Pew measures: views of the USA, China, UN, EU, Russia and NATO; economy; democracy; morality; AI (24 countries, 2025) | [Pew Research Center Global Attitudes Spring 2025](https://www.pewresearch.org/dataset/spring-2025-survey-data/). Country percentages calculated by `make_surveys.py` | Pew terms of use; attribution required |
| Trust in science, doctors and others; vaccines; AI; healthcare access (2025) | [Wellcome Global Monitor 2026](https://wellcome.org/reports/wellcome-global-monitor), fieldwork by Gallup. Country percentages calculated by `make_surveys.py` | Free to use with attribution |
| Worries, harm, disasters, discrimination, savings, resilience (2019–2025) | [Lloyd's Register Foundation World Risk Poll](https://www.lrfoundation.org.uk/world-risk-poll-data), fieldwork by Gallup. Country percentages calculated by `make_surveys.py` | "Freely available to download and use (with attribution)" |
| Happiness score and rank (2011–2025) | [World Happiness Report 2026](https://worldhappiness.report/data/) (Gallup World Poll), via [Our World in Data](https://ourworldindata.org/grapher/happiness-cantril-ladder) | Free to download; cite the World Happiness Report |
| Feel safe walking alone at night | UNODC (SDG indicator 16.1.4), via [Our World in Data](https://ourworldindata.org/grapher/safety-walking-alone) | CC BY 4.0 |
| Social attitudes and values (34 measures, 1981–2022) | [World Values Survey Trend File 1981–2022, v4.1](https://www.worldvaluessurvey.org/WVSEVStrend.jsp): Haerpfer, C., Inglehart, R., Moreno, A., Welzel, C. et al. (eds.), JD Systems Institute & WVSA Secretariat, doi:10.14281/18241.27; and the [EVS Trend File 1981–2017](https://search.gesis.org/research_data/ZA7503), GESIS, ZA7503 v3.0.0, doi:10.4232/1.14021. Country percentages calculated by `make_attitudes.py` | Free for non-profit use (research, teaching); the survey file itself may not be redistributed, so only country figures are included |
| Religion (2010 estimates) | [Pew Research Center](https://www.pewresearch.org/religion/2012/12/18/global-religious-landscape-exec/) via [curran/data](https://github.com/curran/data) | Pew terms of use; attribution required |
| Regime type, democracy and freedom of expression scores | [V-Dem Institute](https://v-dem.net/) via [vdemdata](https://github.com/vdeminstitute/vdemdata) | CC BY-SA 4.0 |
| CO₂ per person | [Our World in Data](https://github.com/owid/co2-data) | CC BY 4.0 |
| Driving side | [samayo/country-json](https://github.com/samayo/country-json), with corrections | MIT |
| Climate zones | Köppen–Geiger 0.5° grid (Kottek, Rubel et al., 1976–2000) via the [kgc](https://github.com/cran/kgc) package | BSD 2-clause |
| Average temperature | [samayo/country-json](https://github.com/samayo/country-json) (Wikipedia, 1961–1990) | MIT |
| CO₂ totals, shares and historical emissions, greenhouse gases, share of warming | [Our World in Data CO₂ data](https://github.com/owid/co2-data) | CC BY 4.0 |
| Energy use, electricity mix, oil/gas/coal production | [Our World in Data energy data](https://github.com/owid/energy-data) | CC BY 4.0 |
| Exports, imports, export make-up, tariffs, resource income, tourism spending, mobile, broadband, servers, R&D, researchers, patents, science articles, high-tech and digital exports, rainfall | World Bank World Development Indicators | CC BY 4.0 |
| Physical facts per country (heights, coastline, land use, terrain, hazards, climate), major rivers and lakes | [CIA World Factbook](https://www.cia.gov/the-world-factbook/) via [factbook.json](https://github.com/factbook/factbook.json) | Public domain |
| Landforms, peaks, rivers, lakes, glaciers, seas | [Natural Earth](https://www.naturalearthdata.com/) | Public domain |
| Tectonic plates and boundaries | PB2002 model (Bird, 2003) via [fraxen/tectonicplates](https://github.com/fraxen/tectonicplates) | ODC-By 1.0 |
| Volcanoes and eruptions | [Smithsonian Global Volcanism Program](https://volcano.si.edu/) via the [volcanoes](https://github.com/cran/volcanoes) R package | Free to use with citation |
| Earthquakes (magnitude 6+, 1900–2026) | [USGS earthquake catalogue](https://earthquake.usgs.gov/earthquakes/search/) | Public domain |
| Biomes (approximate) | Worked out from the Köppen–Geiger grid in [kgc](https://github.com/cran/kgc) | BSD 2-clause |
| Ocean trenches, deltas, waterfalls | Compiled by hand from Wikipedia and other references | CC0 |
| Mineral production | [USGS Mineral Commodity Summaries 2026](https://pubs.usgs.gov/publication/mcs2026) | Public domain |
| World Heritage sites | UNESCO, counted via [worldheritagesite.org](https://www.worldheritagesite.org/) plus 2025 inscriptions | Public facts |
| People using AI | [Microsoft AI Diffusion Report 2026 Q1](https://www.microsoft.com/en-us/corporate-responsibility/topics/AI-Economy-Institute/) | Microsoft terms of use — check before commercial use |
| Rivers, lakes, seas, mountain ranges, deserts, peaks, border lengths | [Natural Earth](https://www.naturalearthdata.com/) via [natural-earth-vector](https://github.com/nvkelso/natural-earth-vector) | Public domain |
| Country shapes | [Natural Earth](https://www.naturalearthdata.com/) via [world-atlas](https://github.com/topojson/world-atlas) | Public domain |

The compiled `countries.json` inherits the ODbL (share-alike) from the base country list and CC BY-SA from V-Dem. Both allow commercial use with attribution and share-alike. **Before adding a dataset, check its licence for "NC" (non-commercial) or "ND" (no derivatives) terms,** which would block posters, paid tiers or other income.

### Known limitations

- **Religion figures are Pew's 2010 estimates.** Pew published 2020 estimates in June 2025 ([dataset page](https://www.pewresearch.org/dataset/dataset-of-global-religious-composition-estimates-for-2010-and-2020/)); download them from Pew and swap them in for the most valuable single upgrade.
- "Democracy" here means V-Dem's *electoral* or *liberal democracy* categories. Other indices (EIU, Freedom House) draw the line differently.
- Disputed areas: Somaliland and Northern Cyprus take the data of the internationally recognised state. Kosovo, Taiwan and Palestine have their own entries but count as territories (tick "Include territories").
- CLDR language shares are estimates and include second-language speakers.
- **City populations count the city itself, not its wider urban area.** So Tokyo shows about 10 million rather than 37 million, and Manila is split into several cities (Quezon City is listed as the largest). That also affects "capital is the largest city". The UN's urban agglomeration figures would be better for megacities, if a usable copy can be found.
- UNDP's figures describe 2023, the latest year in the 2025 report. When a new report comes out, download its composite indices CSV and run `python3 fetch_raw.py --undp <file>`.
- Income groups are worked out from GNI per person using the World Bank's July 2026 thresholds, plus the World Bank's own classification for countries without published GNI. Venezuela is unclassified.
- Treaty membership, Security Council seats and sport records are as of October 2026 and compiled by hand, so check `lists.csv` against the UN Treaty Collection now and then. Treaties count countries that have ratified or acceded, not those that have only signed.
- Refugee figures are for the end of 2025 and cover people under UNHCR's mandate. About 6 million Palestinian refugees cared for by UNRWA are not included.
- The year slider uses today's borders. For years before 1991, figures for countries that were then part of the Soviet Union, Yugoslavia or Czechoslovakia are estimates for today's territory where the source provides them, and blank otherwise.
- **AI use** is Microsoft's estimate from its own usage data, for 147 countries. Several countries, mostly in Africa, share a regional estimate. Microsoft's data is not openly licensed, so check its terms before using it commercially.
- **World Heritage counts** run to the 2025 session; sites added in July 2026 are not yet included.
- **Climate zones** describe 1976–2000 climate on a half-degree grid. Very small countries take the zone nearest their centre, which can be slightly off (Monaco shows warm-summer rather than hot-summer Mediterranean).
- **Average temperature** is for 1961–1990; most places are now around 1°C warmer.
- **Tourism spending** and trips abroad are for 2019, the last year before COVID-19, matching tourist arrivals.
- **Mineral production** counts only countries USGS lists by name; small producers fall under "other countries" and are left out. "Major producer" means at least 5% of world mine production.
- Border lengths are measured on Natural Earth's 1:10m map, which smooths out bends, so they come out shorter than official figures (often by 10–25%). Compare countries with each other rather than quoting the exact kilometres.
- Armed forces figures are for 2020, the latest the World Bank publishes.
- Group memberships are as of October 2026. BRICS excludes Saudi Arabia (status unconfirmed); OPEC excludes the UAE (announced exit, May 2026).

## Ideas for next steps

- Swap in Pew's 2020 religion data.
- A "why" note per country for surprising results (e.g. why Equatorial Guinea has Portuguese as an official language).
- "Countries like mine": pick a country and find the most similar ones.
- Poster export of the current map.

## Licence

Code: MIT (see `LICENSE`). Data: see the table above.

Flags: `TwemojiCountryFlags.woff2` comes from [country-flag-emoji-polyfill](https://github.com/talkjs/country-flag-emoji-polyfill) (MIT); the flag pictures are from [Twemoji](https://github.com/jdecked/twemoji), © Twitter, Inc. and other contributors, licensed CC BY 4.0.
