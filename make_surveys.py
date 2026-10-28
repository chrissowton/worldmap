#!/usr/bin/env python3
"""
Opinion surveys besides the World Values Survey -> surveys.csv (+ surveys_cat.csv)

Sources (all free to use with attribution; the raw files are large, so they are not in this repository):
  --wgm      Wellcome Global Monitor 2026 public data set (CSV), fieldwork by Gallup in 2025, about 140 countries.
             https://wellcome.org/reports/wellcome-global-monitor
  --wrp      Folder holding WRP_2019.csv, WRP_2021.csv, WRP_2023.csv and WRP_2025.csv: the Lloyd's Register Foundation
             World Risk Poll (fieldwork by Gallup). https://www.lrfoundation.org.uk/world-risk-poll-data
  --happy    Our World in Data "happiness-cantril-ladder.csv": World Happiness Report life evaluations (Gallup World Poll).
  --safe     Our World in Data "safety-walking-alone.csv": UNODC, share who feel safe walking alone after dark.
  --whr      World Happiness Report 2026 "Data for Figure 2.1" (xlsx), for the happiness rank.
  --afro     (optional) Afrobarometer Round 10 merged data set (.sav), 38 African countries, 2024-2025.
             https://www.afrobarometer.org/data/  (needs: pip install pyreadstat)
  --pew      (optional) Pew Research Center Global Attitudes Spring 2025 dataset (CSV), 24 countries.
             https://www.pewresearch.org/dataset/spring-2025-survey-data/

    python3 make_surveys.py --wgm W.csv --wrp wrp_folder --happy happy.csv --safe safe.csv --whr WHR26_Data_Figure_2.1.xlsx \
        --afro AB_R10.sav --pew Pew_Spring_2025.csv
    python3 build_data.py

surveys.csv holds country-level figures only (weighted with each survey's own weight). Percentages leave out
"don't know" and refusals; a country needs at least 300 valid answers. wave = 0 marks yearly series.
"""
import argparse
import csv
import json
import os

import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__))
MIN_N = 300

# field: (variable, codes counted as "yes", valid codes)
WGM = {
    "wgm_trust_science": ("WP19996", (1,), (1, 2, 3, 4)),
    "wgm_trust_scientists": ("WP19991", (1,), (1, 2, 3, 4)),
    "wgm_trust_doctors": ("WP19993", (1,), (1, 2, 3, 4)),
    "wgm_trust_government": ("WP19990", (1,), (1, 2, 3, 4)),
    "wgm_trust_journalists": ("WP19992", (1,), (1, 2, 3, 4)),
    "wgm_trust_neighbours": ("WP19989", (1,), (1, 2, 3, 4)),
    "wgm_vaccines_now": ("WP24322", (1,), (1, 2, 3)),
    "wgm_no_vaccines": ("WP24322", (3,), (1, 2, 3)),
    "wgm_ai_benefit": ("WP24324", (1,), (1, 2, 3)),
    "wgm_heard_ai": ("WP24323", (1,), (1, 2)),
    "wgm_health_access": ("WP24325", (1, 2), (1, 2, 3, 4)),
}
WRP = {
    "wrp_climate_serious": ("WP20719", (1,), (1, 2, 3)),
    "wrp_worry_crime": ("WP20722", (1,), (1, 2, 3)),
    "wrp_worry_weather": ("WP20723", (1,), (1, 2, 3)),
    "wrp_worry_roads": ("WP22213", (1,), (1, 2, 3)),
    "wrp_worry_water": ("WP20721", (1,), (1, 2, 3)),
    "wrp_harm_crime": ("WP22444", (1, 2, 3), (1, 2, 3, 4)),
    "wrp_harm_weather": ("WP22445", (1, 2, 3), (1, 2, 3, 4)),
    "wrp_disaster_5y": ("WP24213", (1,), (1, 2)),
    "wrp_gov_prepared": ("WP24198", (1,), (1, 2)),
    "wrp_gov_cares": ("WP22231", (1,), (1, 2, 3)),
    "wrp_under_month": ("WP22228", (1,), (1, 2)),
    "wrp_discrim_skin": ("WP22259", (1,), (1, 2)),
    "wrp_discrim_religion": ("WP22260", (1,), (1, 2)),
    "wrp_discrim_ethnic": ("WP22261", (1,), (1, 2)),
    "wrp_discrim_gender": ("WP22262", (1,), (1, 2)),
    "wrp_risk_roads": ("WP22331", (1,), tuple(range(1, 24))),
    "wrp_resilience": ("resilience_index_100", "mean", None),
}
# "What is the greatest source of risk to your safety in your daily life?" grouped into broad answers
RISK_GROUPS = {1: "Road accidents", 2: "Road accidents", 3: "Crime and violence", 4: "War and terrorism",
               5: "Health", 6: "Health", 7: "Health", 8: "Health", 9: "Money and the economy", 10: "Money and the economy",
               15: "Money and the economy", 11: "Politics and corruption", 12: "Other", 13: "Other", 14: "Other", 16: "Other", 17: "Other",
               18: "Climate, weather and disasters", 19: "Climate, weather and disasters", 20: "Climate, weather and disasters",
               21: "Other", 22: "Other", 23: "No risks"}
FIX = {"XKX": "UNK", "KOS": "UNK"}
# Afrobarometer Round 10: (variable, codes counted as "yes", valid codes)
AFRO = {
    "ab_democracy_best": ("Q22", (3,), (1, 2, 3)),
    "ab_democracy_satisfied": ("Q33", (3, 4), (0, 1, 2, 3, 4)),
    "ab_military_approve": ("Q21B", (4, 5), (1, 2, 3, 4, 5)),
    "ab_trust_president": ("Q37A", (2, 3), (0, 1, 2, 3)),
    "ab_corruption_up": ("Q39A", (1, 2), (1, 2, 3, 4, 5)),
    "ab_right_direction": ("Q3", (2,), (1, 2)),
    "ab_no_food": ("Q7A", (1, 2, 3, 4), (0, 1, 2, 3, 4)),
    "ab_no_water": ("Q7B", (1, 2, 3, 4), (0, 1, 2, 3, 4)),
    "ab_no_medical": ("Q7C", (1, 2, 3, 4), (0, 1, 2, 3, 4)),
    "ab_unsafe": ("Q9", (1, 2, 3, 4), (0, 1, 2, 3, 4)),
    "ab_emigrate": ("Q71A", (2, 3), (0, 1, 2, 3)),
    "ab_china_positive": ("Q67B", (4, 5), (1, 2, 3, 4, 5)),
    "ab_us_positive": ("Q67C", (4, 5), (1, 2, 3, 4, 5)),
    "ab_russia_positive": ("Q67D", (4, 5), (1, 2, 3, 4, 5)),
    "ab_colonial_positive": ("Q67A", (4, 5), (1, 2, 3, 4, 5)),
    "ab_heard_climate": ("Q60A", (1,), (0, 1)),
    "ab_climate_worse": ("Q60B", (4, 5), (1, 2, 3, 4, 5)),
    "ab_men_jobs": ("Q49B", (4, 5), (1, 2, 3, 4, 5)),
    "ab_women_leaders": ("Q51", (3,), (2, 3, 5)),
    "ab_nb_gay_dislike": ("Q88C", (1, 2), (1, 2, 3, 4, 5)),
    "ab_nb_immigrants_dislike": ("Q88D", (1, 2), (1, 2, 3, 4, 5)),
}
# Pew Global Attitudes Spring 2025
FAV = (1, 2), (1, 2, 3, 4)
PEW = {
    "pew_fav_us": ("fav_us",) + FAV, "pew_fav_china": ("fav_china",) + FAV, "pew_fav_un": ("fav_un",) + FAV,
    "pew_fav_eu": ("fav_eu",) + FAV, "pew_fav_russia": ("fav_russia",) + FAV, "pew_fav_nato": ("fav_nato",) + FAV,
    "pew_econ_good": ("econ_sit", (1, 2), (1, 2, 3, 4)),
    "pew_democracy_satisfied": ("satisfied_democracy", (1, 2), (1, 2, 3, 4)),
    "pew_homosexuality_ok": ("moral_homosexuality", (1,), (1, 2, 3, 4)),
    "pew_god_needed": ("believe_god", (2,), (1, 2)),
    "pew_china_top_economy": ("econ_power", (2,), (1, 2, 3, 4, 5, 6)),
    "pew_ai_concerned": ("ai_cncexc", (2,), (1, 2, 3)),
}
NAMES_FIX = {"UK": "GBR", "Turkey": "TUR", "South Korea": "KOR", "Gambia, The": "GMB", "Congo-Brazzaville": "COG", "Côte d'Ivoire": "CIV",
             "Cabo Verde": "CPV", "Eswatini": "SWZ", "São Tomé and Príncipe": "STP", "Democratic Republic of the Congo": "COD"}


def pct(g, var, yes, valid, w):
    x = g[var]
    if yes == "mean":
        ok = x.notna()
        if ok.sum() < MIN_N:
            return None, 0
        return round(float((x[ok] * w[ok]).sum() / w[ok].sum()), 1), int(ok.sum())
    ok = x.isin(valid)
    n = int(ok.sum())
    if n < MIN_N:
        return None, n
    return round(float((w[ok] * x[ok].isin(yes)).sum() / w[ok].sum() * 100), 1), n


def survey(df, iso_col, year, measures, wave, rows):
    for c in df.columns:
        if c != iso_col:
            df[c] = pd.to_numeric(df[c], errors="coerce")
    for iso, g in df.groupby(iso_col):
        iso = FIX.get(str(iso), str(iso))
        w = g["WGT"].where(g["WGT"] > 0, 1.0)
        yy = g["Year"].dropna() if "Year" in g else None
        y = int(yy.mode().max()) if yy is not None and len(yy) else year
        for field, (var, yes, valid) in measures.items():
            if var not in g:
                continue
            v, n = pct(g, var, yes, valid, w)
            if v is not None:
                rows.append([iso, wave, y, field, v, n])


def main():
    ap = argparse.ArgumentParser()
    for a in ("wgm", "wrp", "happy", "safe", "whr"):
        ap.add_argument("--" + a, required=True)
    ap.add_argument("--afro")
    ap.add_argument("--pew")
    a = ap.parse_args()
    names = {r["name"]: r["iso3"] for r in json.load(open(os.path.join(ROOT, "countries.json"), encoding="utf-8"))}
    to_iso = lambda n: NAMES_FIX.get(n) or names.get(n)
    rows, cats = [], []
    # Wellcome Global Monitor (one wave, 2025)
    cols = ["COUNTRY_ISO3", "WGT", "YEAR_CALENDAR"] + sorted({v[0] for v in WGM.values()})
    wgm = pd.read_csv(a.wgm, usecols=cols, low_memory=False).rename(columns={"YEAR_CALENDAR": "Year"})
    survey(wgm, "COUNTRY_ISO3", 2025, WGM, 1, rows)
    # World Risk Poll, four waves
    for i, yr in enumerate((2019, 2021, 2023, 2025), 1):
        path = os.path.join(a.wrp, f"WRP_{yr}.csv")
        head = pd.read_csv(path, nrows=0, encoding="utf-8-sig").columns
        cols = ["COUNTRY_ISO3", "WGT", "Year"] + [c for c in sorted({v[0] for v in WRP.values()}) if c in head]
        df = pd.read_csv(path, usecols=cols, encoding="utf-8-sig", low_memory=False)
        survey(df, "COUNTRY_ISO3", yr, WRP, i, rows)
        if "WP22331" in df:
            df["WP22331"] = pd.to_numeric(df["WP22331"], errors="coerce")
            for iso, g in df.groupby("COUNTRY_ISO3"):
                g = g[g["WP22331"].isin(RISK_GROUPS)]
                if len(g) < MIN_N:
                    continue
                share = g.groupby(g["WP22331"].map(RISK_GROUPS))["WGT"].sum()
                share = share.drop("No risks", errors="ignore").drop("Other", errors="ignore")
                cats.append([FIX.get(iso, iso), yr, "wrp_top_risk", share.idxmax(), round(100 * share.max() / g["WGT"].sum(), 1)])
    # Afrobarometer Round 10 (one wave, 2024-2025)
    if a.afro:
        import pyreadstat
        cols = ["COUNTRY", "DATEINTR", "withinwt_hh"] + sorted({v[0] for v in AFRO.values()})
        ab, meta = pyreadstat.read_sav(a.afro, usecols=cols)
        ab["iso"] = ab["COUNTRY"].map(lambda c: to_iso(meta.variable_value_labels["COUNTRY"].get(c, "")))
        missed = sorted({meta.variable_value_labels["COUNTRY"].get(c) for c in ab.loc[ab["iso"].isna(), "COUNTRY"].unique()})
        if missed:
            print("Afrobarometer countries not matched:", missed)
        ab["Year"] = pd.to_datetime(ab["DATEINTR"], errors="coerce").dt.year
        ab = ab.dropna(subset=["iso"]).rename(columns={"withinwt_hh": "WGT"}).drop(columns=["COUNTRY", "DATEINTR"])
        survey(ab, "iso", 2025, AFRO, 10, rows)
    # Pew Global Attitudes Spring 2025
    if a.pew:
        pw = pd.read_csv(a.pew, usecols=["country", "weight"] + sorted({v[0] for v in PEW.values()}), low_memory=False)
        cn = {2: "Canada", 3: "France", 4: "Germany", 5: "Greece", 6: "Hungary", 7: "Italy", 8: "Netherlands", 9: "Poland", 10: "Spain", 11: "Sweden",
              12: "UK", 13: "Australia", 14: "India", 15: "Indonesia", 16: "Japan", 17: "South Korea", 18: "Israel", 19: "Turkey", 20: "Kenya",
              21: "Nigeria", 22: "South Africa", 23: "Argentina", 24: "Brazil", 25: "Mexico"}
        pw["iso"] = pd.to_numeric(pw["country"], errors="coerce").map(lambda c: to_iso(cn.get(c, "")))
        pw = pw.dropna(subset=["iso"]).rename(columns={"weight": "WGT"}).drop(columns=["country"])
        survey(pw, "iso", 2025, PEW, 1, rows)
    # yearly series from Our World in Data (wave 0)
    for path, field, dp in ((a.happy, "happiness_score", 2), (a.safe, "safe_walking", 1)):
        for r in csv.reader(open(path, encoding="utf-8")):
            if len(r) == 4 and len(r[1]) == 3 and r[2].isdigit() and r[3]:
                rows.append([r[1], 0, int(r[2]), field, round(float(r[3]), dp), ""])
    # World Happiness Report rank (latest year in the file)
    whr = pd.read_excel(a.whr)
    latest = whr["Year"].max()
    happy_iso = {}
    for r in csv.reader(open(a.happy, encoding="utf-8")):
        if len(r) == 4 and len(r[1]) == 3:
            happy_iso[r[0]] = r[1]
    alias = {"Czechia": "CZE", "Türkiye": "TUR", "Turkiye": "TUR", "Taiwan Province of China": "TWN", "Hong Kong SAR of China": "HKG",
             "State of Palestine": "PSE", "Republic of Korea": "KOR", "Russian Federation": "RUS", "DR Congo": "COD", "Kosovo": "UNK", "Viet Nam": "VNM", "Republic of Moldova": "MDA", "Lao PDR": "LAO", "Côte d’Ivoire": "CIV"}
    missed = []
    for _, r in whr[whr["Year"] == latest].iterrows():
        n = str(r["Country name"]).strip()
        iso = alias.get(n) or names.get(n) or happy_iso.get(n)
        if not iso:
            missed.append(n)
            continue
        rows.append([iso, 0, int(latest), "happiness_rank", int(r["Rank"]), ""])
    if missed:
        print("WHR names not matched:", missed)
    rows.sort()
    with open(os.path.join(ROOT, "surveys.csv"), "w", newline="", encoding="utf-8") as f:
        f.write("# Country figures from the Wellcome Global Monitor 2026, the Lloyd's Register Foundation World Risk Poll 2019-2025, "
                "the World Happiness Report (via Our World in Data) and UNODC (via Our World in Data). See make_surveys.py.\n")
        wr = csv.writer(f)
        wr.writerow(["iso3", "wave", "year", "field", "value", "n"])
        wr.writerows(rows)
    with open(os.path.join(ROOT, "surveys_cat.csv"), "w", newline="", encoding="utf-8") as f:
        f.write("# Most-named group of answers to the World Risk Poll question on the greatest risk to people's safety in daily life. See make_surveys.py.\n")
        wr = csv.writer(f)
        wr.writerow(["iso3", "year", "field", "value", "share_pct"])
        wr.writerows(sorted(cats))
    print(f"Wrote {len(rows)} rows ({len({r[0] for r in rows})} places) and {len(cats)} risk answers")


if __name__ == "__main__":
    main()
