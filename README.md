# Which Countries?

An open-source world map for asking questions about the world. Stack filters on language, religion, politics, wealth, geography and more, and watch the map narrow down to the countries that fit.

- *Which countries have Portuguese as an official language?*
- *Which Muslim-majority countries are democracies?*
- *Which countries drive on the left but aren't in Asia?*

It's a static website: no server, no database, no accounts. All the data (about 250 countries and territories) is one small JSON file that the browser loads once.

## Features

- **Search to add a filter.** Type "religion", "coast" or "Portuguese" and pick from filters or specific values. Or browse every filter by category.
- **Filters as chips.** Each active filter is a chip; click it to adjust, × to remove.
- **Smart controls.** Range sliders show a histogram of where countries sit. Option lists show how many countries each choice would give, and grey out choices that would give none.
- **Plain-English summary.** "Showing 4 countries where at least 50% of people are Muslim and the country is a democracy."
- **Near misses.** Countries that fail just one filter are listed (grouped by the filter they fail) and, when there are only a few, shaded on the map.
- **Help with dead ends.** If nothing matches, it tells you which filter to drop and how many countries that would bring back.
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
| `world-50m.json` | Country shapes (Natural Earth, 1:50m, via world-atlas) |
| `pop.csv`, `gdp.csv`, `co2.csv`, `vdem_2020_on.csv`, `pew_religion_2010.csv`, `cldr_*.json`, `driving_side.json`, `world_countries.json` | The original downloaded source files |
| `fetch_raw.py` | Downloads fresh copies of the source files |
| `build_data.py` | Joins the source files into `countries.json` |
| `build_single.py` | Bundles everything into one self-contained HTML file in `dist/` |

Libraries: [D3](https://d3js.org/) and [topojson-client](https://github.com/topojson/topojson-client), loaded from cdnjs. No build step and no framework.

## Adding a new characteristic

1. Get a source file with one value per country, ideally keyed by ISO 3-letter code, and add it to the repository.
2. In `build_data.py`, add a few lines that read it and set a field on each country, e.g. `rec["life_expectancy"] = ...`.
3. Run `python3 build_data.py`.
4. In `filters.js`, add an entry describing the field: its type (`range`, `multi`, `cat` or `bool`), group, label, the sentence wording, the source and a one-line explanation.
5. If it's a new source, add it to `SOURCES` at the bottom of `filters.js`.

That's it: the search menu, chip, slider or checklist, histogram, profile page and About table all pick it up automatically.

## Updating the data

```bash
pip install pyreadr pandas
python3 fetch_raw.py
python3 build_data.py
```

## Data sources and licences

| Data | Source | Licence |
|---|---|---|
| Country list, official languages, currencies, region, borders, area | [mledoze/countries](https://github.com/mledoze/countries) | ODbL 1.0 |
| Languages spoken by 10%+ | [Unicode CLDR](https://cldr.unicode.org/) | Unicode License |
| Population, GDP | [World Bank](https://data.worldbank.org/) via [datasets/population](https://github.com/datasets/population) and [datasets/gdp](https://github.com/datasets/gdp) | CC BY 4.0 |
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

## Ideas for next steps

- Swap in Pew's 2020 religion data.
- Add more characteristics: life expectancy, HDI, happiness, press freedom, time zones, plug types, flag colours.
- A "why" note per country for surprising results (e.g. why Equatorial Guinea has Portuguese as an official language).
- "Countries like mine": pick a country and find the most similar ones.
- Poster export of the current map.

## Licence

Code: MIT (see `LICENSE`). Data: see the table above.
