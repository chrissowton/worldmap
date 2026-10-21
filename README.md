# Which Countries?

An open-source world map for asking questions about the world, built with human geography students in mind. Stack filters on development, population, health, gender, work, globalisation, refugees, cities, culture, politics, UN treaties, military, sport and the environment, and watch the map narrow down to the countries that fit.

- *Which countries have very high inequality (Gini over 50) outside Africa?*
- *Which high-income countries still have a fertility rate above 2.1?*
- *Which cities over 5 million are in lower-middle-income countries?*
- *In which BRICS countries is the capital not the largest city?*

There are over 100 measures for 194 countries, plus 6,000+ cities and 1,500 refugee routes. **[DATA.md](DATA.md) lists every measure with its source, year and coverage.**

It's a static website: no server, no database, no accounts. All the data is in a few JSON files that the browser loads once.

## Features

- **Search to add a filter.** Type "religion", "coast" or "Portuguese" and pick from filters or specific values. Or browse every filter by category.
- **Filters as chips.** Each active filter is a chip; click it to adjust, × to remove.
- **Smart controls.** Range sliders show a histogram of where countries sit. Option lists show how many countries each choice would give, and grey out choices that would give none.
- **Plain-English summary.** "Showing 4 countries where at least 50% of people are Muslim and the country is a democracy."
- **Near misses.** Countries that fail just one filter are listed (grouped by the filter they fail) and, when there are only a few, shaded on the map.
- **Help with dead ends.** If nothing matches, it tells you which filter to drop and how many countries that would bring back.
- **Cities.** Add a city filter (population, capital) to show cities as dots sized by population, inside the countries that match your other filters. A Cities tab lists them.
- **Year slider.** Drag back to 1960, or press play, and filters with yearly data (population, fertility, life expectancy, urbanisation, GDP, HDI, democracy, CO₂, refugees and more) show that year. [DATA.md](DATA.md) marks which measures have yearly data.
- **Refugee flows.** Open any country's profile to see where its refugees have gone, or where the refugees it hosts come from, and map either one.
- **Colour-coded categories.** Each category has its own colour, used in the search menu, the filter chips and the filter panel.
- **Colour by any number,** e.g. filter to democracies, then colour them by GDP per person.
- **Country profiles** with every value and its source year.
- **Shareable links.** The URL holds the current filters, e.g. `?f=official_languages:Portuguese,democracy:1`.
- **Starter questions and a question of the day** for people who don't know where to begin.
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
| `filters.js` | **The list of filters.** The interface is generated from this, plus starter questions, puzzles and source credits |
| `app.js` | Map, filtering logic, results list, URL state |
| `countries.json` | One record per country (built by `build_data.py`) |
| `cities.json` | Cities with 100,000+ people, plus every capital (built by `build_data.py`) |
| `world-50m.json` | Country shapes (Natural Earth, 1:50m, via world-atlas) |
| `worldbank_latest.csv`, `hdi_median_age.csv`, `cities.csv`, `pop.csv`, `gdp.csv`, `co2.csv`, `vdem_2020_on.csv`, `pew_religion_2010.csv`, `cldr_*.json`, `driving_side.json`, `world_countries.json` | The downloaded source files |
| `undp_hdr.csv` | UNDP's latest HDI, GII and related figures, extracted from UNDP's composite indices file |
| `lists.csv` | Yes/no facts, one row per country: UN treaties joined, Security Council seats, nuclear weapons, FIFA membership, World Cup / Olympics / Commonwealth Games hosts. **Edited by hand** |
| `worldcups.csv`, `olympic_medals.csv` | World Cup titles and the Paris 2024 medal table. **Edited by hand** |
| `refugees.csv`, `refugee_flows.csv` | UNHCR refugee totals per country, and every origin → host route with 100+ people |
| `timeseries.csv` | Yearly values since 1960 for the year slider |
| `timeseries.json` | The yearly values for the website (built by `build_data.py`) |
| `refugee_flows.json` | The refugee routes for the website (built by `build_data.py`) |
| `groups.csv` | Membership of the EU, NATO, OECD, G7, G20, BRICS, ASEAN, African Union, Arab League, Commonwealth, Mercosur and OPEC. **Edited by hand**: update it when a country joins or leaves |
| `fetch_raw.py` | Downloads fresh copies of the source files |
| `build_data.py` | Joins the source files into `countries.json` and `cities.json` |
| `make_data_table.js` | Writes `DATA.md` from the filter list |
| `build_single.py` | Bundles everything into one self-contained HTML file in `dist/` |

Libraries: [D3](https://d3js.org/) and [topojson-client](https://github.com/topojson/topojson-client), loaded from cdnjs. No build step and no framework.

## Adding a new characteristic

1. Get a source file with one value per country, ideally keyed by ISO 3-letter code, and add it to the repository.
2. In `build_data.py`, add a few lines that read it and set a field on each country, e.g. `rec["life_expectancy"] = ...`.
3. Run `python3 build_data.py`, then `node make_data_table.js` to refresh `DATA.md`.
4. In `filters.js`, add an entry describing the field: its type (`range`, `multi`, `cat` or `bool`), group, label, the sentence wording, the source and a one-line explanation.
5. If it's a new source, add it to `SOURCES` at the bottom of `filters.js`.

That's it: the search menu, chip, slider or checklist, histogram, profile page and About table all pick it up automatically.

## Updating the data

```bash
pip install pyreadr pandas geonamescache
python3 fetch_raw.py
python3 build_data.py
node make_data_table.js
```

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
| Religion (2010 estimates) | [Pew Research Center](https://www.pewresearch.org/religion/2012/12/18/global-religious-landscape-exec/) via [curran/data](https://github.com/curran/data) | Pew terms of use; attribution required |
| Regime type, democracy and freedom of expression scores | [V-Dem Institute](https://v-dem.net/) via [vdemdata](https://github.com/vdeminstitute/vdemdata) | CC BY-SA 4.0 |
| CO₂ per person | [Our World in Data](https://github.com/owid/co2-data) | CC BY 4.0 |
| Driving side | [samayo/country-json](https://github.com/samayo/country-json), with corrections | MIT |
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
- Armed forces figures are for 2020, the latest the World Bank publishes.
- Group memberships are as of October 2026. BRICS excludes Saudi Arabia (status unconfirmed); OPEC excludes the UAE (announced exit, May 2026).

## Ideas for next steps

- Swap in Pew's 2020 religion data.
- A scatter plot view: pick any two measures (e.g. HDI against fertility) to see correlations.
- Compare two countries side by side; export the map as an image and the results as a spreadsheet.
- A "why" note per country for surprising results (e.g. why Equatorial Guinea has Portuguese as an official language).
- "Countries like mine": pick a country and find the most similar ones.
- Poster export of the current map.

## Licence

Code: MIT (see `LICENSE`). Data: see the table above.
