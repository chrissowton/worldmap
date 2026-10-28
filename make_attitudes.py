#!/usr/bin/env python3
"""
Social attitudes from the World Values Survey -> attitudes.csv

The WVS Trend File (1981-2022) may not be redistributed, so it is NOT in this repository.
The European Values Study (EVS) Trend File 1981-2017 is merged in: most European countries are surveyed by the EVS.
To rebuild attitudes.csv:
  1. Download "WVS_Trend_1981_2022_v4.1" (Stata) from https://www.worldvaluessurvey.org/WVSEVStrend.jsp
     and the EVS Trend File 1981-2017 (ZA7503, Stata) from https://search.gesis.org/research_data/ZA7503
     (both free, for non-profit use: research, teaching and similar).
  2. python3 make_attitudes.py path/to/Trends_VS_1981_2022_Stata_v4_1.dta path/to/ZA7503_v3-0-0.dta
  3. python3 build_data.py

attitudes.csv holds only country-level percentages (weighted with the survey's own weight, S017),
one row per country, survey wave and measure. "Don't know" and "no answer" are left out of the
percentages, and a country-wave needs at least 300 valid answers.

Citation: Haerpfer, C., Inglehart, R., Moreno, A., Welzel, C., Kizilova, K., Diez-Medrano J., M. Lagos,
P. Norris, E. Ponarin & B. Puranen et al. (eds.). World Values Survey Trend File (1981-2022)
Cross-National Data-Set. Madrid, Spain & Vienna, Austria: JD Systems Institute & WVSA Secretariat.
Version 4.0.0, doi:10.14281/18241.27.
EVS (2022): EVS Trend File 1981-2017. GESIS Data Archive, Cologne. ZA7503 Data file Version 3.0.0, doi:10.4232/1.14021.
"""
import json
import csv
import os
import sys

import pandas as pd

# field on the site: (WVS variable, codes counted as "yes", valid codes)  - or "mean" for a 1-10 scale
AGREE = (1, 2)            # agree strongly / agree, very good / fairly good, a great deal / quite a lot
FOUR = (1, 2, 3, 4)
TEN = tuple(range(1, 11))
MEASURES = {
    "att_trust": ("A165", (1,), (1, 2)),
    "att_religion_important": ("A006", (1,), FOUR),
    "att_not_religious": ("F034", (2, 3), (1, 2, 3)),
    "att_atheist": ("F034", (3,), (1, 2, 3)),
    "att_attend_weekly": ("F028", (1, 2), tuple(range(1, 9))),
    "att_happy": ("A008", AGREE, FOUR),
    "att_life_satisfaction": ("A170", "mean", TEN),
    "att_homosexuality_never": ("F118", (1,), TEN),
    "att_abortion_never": ("F120", (1,), TEN),
    "att_bribe_never": ("F117", (1,), TEN),
    "att_men_leaders": ("D059", AGREE, FOUR),
    "att_men_jobs": ("C001", (1,), (1, 2, 3)),
    "att_uni_boys": ("D060", AGREE, FOUR),
    "att_democracy_good": ("E117", AGREE, FOUR),
    "att_strong_leader_good": ("E114", AGREE, FOUR),
    "att_army_rule_good": ("E116", AGREE, FOUR),
    "att_experts_good": ("E115", AGREE, FOUR),
    "att_fight": ("E012", (1,), (0, 1)),
    "att_very_proud": ("G006", (1,), FOUR),
    "att_environment_first": ("B008", (1,), (1, 2, 3)),
    "att_postmaterialist": ("Y002", (3,), (1, 2, 3)),
    "att_conf_government": ("E069_11", AGREE, FOUR),
    "att_conf_parliament": ("E069_07", AGREE, FOUR),
    "att_conf_police": ("E069_06", AGREE, FOUR),
    "att_conf_courts": ("E069_17", AGREE, FOUR),
    "att_conf_press": ("E069_04", AGREE, FOUR),
    "att_conf_army": ("E069_02", AGREE, FOUR),
    "att_conf_churches": ("E069_01", AGREE, FOUR),
    "att_conf_un": ("E069_20", AGREE, FOUR),
    "att_nb_gay": ("A124_09", (1,), (0, 1)),
    "att_nb_immigrants": ("A124_06", (1,), (0, 1)),
    "att_nb_race": ("A124_02", (1,), (0, 1)),
    "att_nb_religion": ("A124_12", (1,), (0, 1)),
    "att_nb_drinkers": ("A124_03", (1,), (0, 1)),
}
MIN_N = 300
# WVS codes that differ from the site's
ISO_FIX = {"NIR": None, "SCG": None}


def summarise(df, iso_col, wave_col, wave_offset, rows):
    for (iso, wave), g in df.groupby([iso_col, wave_col]):
        if not iso:
            continue
        year = int(g["S020"].mode().max())  # the main fieldwork year
        w = g["S017"].where(g["S017"] >= 0, 0).fillna(0)
        if w.sum() <= 0:
            w = w * 0 + 1.0
        for field, (var, yes, valid) in MEASURES.items():
            if var not in g:
                continue
            x = g[var]
            ok = x.isin(valid) & (w > 0)
            n = int(ok.sum())
            if n < MIN_N:
                continue
            if yes == "mean":
                val = round(float((x[ok] * w[ok]).sum() / w[ok].sum()), 2)
            else:
                val = round(float((w[ok] * x[ok].isin(yes)).sum() / w[ok].sum() * 100), 1)
            rows.append([iso, int(wave) + wave_offset, year, field, val, n])


def main(wvs_path, evs_path=None):
    vars_ = sorted({v[0] for v in MEASURES.values()})
    rows = []
    df = pd.read_stata(wvs_path, columns=["S002VS", "S020", "S017", "COUNTRY_ALPHA"] + vars_, convert_categoricals=False)
    df["COUNTRY_ALPHA"] = df["COUNTRY_ALPHA"].astype(str).str.strip().map(lambda c: ISO_FIX.get(c, c))
    summarise(df, "COUNTRY_ALPHA", "S002VS", 0, rows)
    if evs_path:
        have = set(pd.io.stata.StataReader(evs_path).variable_labels())
        ev = pd.read_stata(evs_path, columns=["S002EVS", "S020", "S017", "S009"] + [v for v in vars_ if v in have], convert_categoricals=False)
        iso2 = {r["iso2"]: r["iso3"] for r in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "countries.json"), encoding="utf-8")) if r.get("iso2")}
        iso2.update({"GB-GBN": "GBR", "RS-KM": "UNK", "GB-NIR": None, "CY-TCC": None})
        ev["iso3"] = ev["S009"].astype(str).str.strip().map(lambda c: iso2.get(c, iso2.get(c[:2]) if "-" not in c else None))
        summarise(ev, "iso3", "S002EVS", 100, rows)  # EVS waves are numbered 101-105
    rows.sort()
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "attitudes.csv")
    with open(out, "w", newline="", encoding="utf-8") as f:
        f.write("# Country-level figures calculated from the World Values Survey Trend File 1981-2022 (v4.1). See make_attitudes.py.\n")
        wr = csv.writer(f)
        wr.writerow(["iso3", "wave", "year", "field", "value", "n"])
        wr.writerows(rows)
    print(f"Wrote {len(rows)} rows for {len({r[0] for r in rows})} countries to {out}")


if __name__ == "__main__":
    if len(sys.argv) not in (2, 3):
        sys.exit(__doc__)
    main(*sys.argv[1:])
