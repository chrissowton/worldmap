#!/usr/bin/env python3
"""
Download the latest raw source files into this folder.

    pip install pyreadr pandas geonamescache   # for the V-Dem and cities steps
    python3 fetch_raw.py
    python3 build_data.py

The repository already contains a copy of every raw file, so you only need
this when you want to refresh the data. groups.csv (membership of the EU,
NATO, BRICS and so on) is edited by hand and is not downloaded.

UNDP's figures (HDI, Gender Inequality Index and so on) can't be downloaded
automatically. When a new Human Development Report comes out, download the
"composite indices complete time series" CSV from https://hdr.undp.org/data-center
and run:

    python3 fetch_raw.py --undp HDR25_Composite_indices_complete_time_series.csv
"""
import csv
import io
import json
import os
import re
import shutil
import sys
import tempfile
import unicodedata
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
RAW = ROOT
GH = "https://raw.githubusercontent.com/"

FILES = {
    "pop.csv": GH + "datasets/population/main/data/population.csv",
    "gdp.csv": GH + "datasets/gdp/main/data/gdp.csv",
    "pew_religion_2010.csv": GH + "curran/data/gh-pages/pew/religion/religionByCountry.csv",
    "driving_side.json": GH + "samayo/country-json/master/src/country-by-driving-side.json",
    "cldr_territoryInfo.json": GH + "unicode-org/cldr-json/main/cldr-json/cldr-core/supplemental/territoryInfo.json",
    "cldr_languages_en.json": GH + "unicode-org/cldr-json/main/cldr-json/cldr-localenames-full/main/en/languages.json",
    "world_countries.json": GH + "mledoze/countries/master/countries.json",
}
CO2_URL = GH + "owid/co2-data/master/owid-co2-data.csv"
VDEM_URL = GH + "vdeminstitute/vdemdata/master/data/vdem.RData"

# World Bank World Development Indicators, mirrored on GitHub by Gapminder's open-numbers project
WDI_URL = GH + "open-numbers/ddf--open_numbers--world_development_indicators/master/datapoints/ddf--datapoints--{}--by--geo--time.csv"
WDI_CODES = [
    "ny_gnp_pcap_cd", "ny_gnp_pcap_pp_cd", "si_pov_gini", "si_pov_dday", "sp_dyn_le00_in", "sp_dyn_imrt_in",
    "sh_dyn_mort", "sh_sta_mmrt", "se_adt_litr_zs", "eg_elc_accs_zs", "sh_h2o_smdw_zs", "it_net_user_zs",
    "sh_xpd_chex_gd_zs", "se_xpd_totl_gd_zs", "en_pop_dnst", "sp_pop_grow", "sp_dyn_tfrt_in", "sp_dyn_cbrt_in",
    "sp_dyn_cdrt_in", "sp_pop_0014_to_zs", "sp_pop_65up_to_zs", "sp_pop_dpnd", "sp_urb_totl_in_zs",
    "sm_pop_netm", "sp_pop_totl", "sm_pop_totl_zs", "bx_trf_pwkr_dt_gd_zs", "sl_agr_empl_zs", "sl_ind_empl_zs",
    "sl_srv_empl_zs", "ne_trd_gnfs_zs", "bx_klt_dinv_wd_gd_zs", "st_int_arvl", "ag_lnd_frst_zs",
    "eg_fec_rnew_zs", "er_h2o_fwst_zs", "sp_ado_tfrt", "sg_gen_parl_zs", "sl_tlf_cact_fe_zs", "sl_tlf_cact_ma_zs",
]
# HDI (UNDP) and median age (UN WPP), mirrored by Gapminder
GM_URL = GH + "open-numbers/ddf--gapminder--systema_globalis/master/countries-etc-datapoints/ddf--datapoints--{}--by--geo--time.csv"


def get(url):
    print("  downloading", url)
    with urllib.request.urlopen(url) as r:
        return r.read()


def read_csv(url):
    return list(csv.DictReader(io.StringIO(get(url).decode("utf-8"))))


def fetch_worldbank():
    """Keep the latest value since 2010 per country and indicator. Tourism uses the last year before COVID."""
    best = {}
    for code in WDI_CODES:
        for r in read_csv(WDI_URL.format(code)):
            v = r.get(code, "")
            if v == "":
                continue
            y = int(r["time"])
            if y < 2010:  # older figures are too out of date to compare
                continue
            if code == "st_int_arvl" and y > 2019:
                continue
            k = (r["geo"].upper(), code)
            if k not in best or y > best[k][0]:
                best[k] = (y, v)
    with open(os.path.join(RAW, "worldbank_latest.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["iso3", "indicator", "year", "value"])
        for (iso, code), (y, v) in sorted(best.items()):
            w.writerow([iso, code, y, v])


def fetch_hdi_median_age():
    out = []
    for name, ind, max_year in [("hdi_human_development_index", "hdi", 9999), ("median_age_years", "median_age", 2025)]:
        latest = {}
        for r in read_csv(GM_URL.format(name)):
            y, v = int(r["time"]), r[name]
            if v == "" or y > max_year:
                continue
            if r["geo"] not in latest or y > latest[r["geo"]][0]:
                latest[r["geo"]] = (y, v)
        out += [(g.upper(), ind, y, v) for g, (y, v) in sorted(latest.items())]
    with open(os.path.join(RAW, "hdi_median_age.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["iso3", "indicator", "year", "value"])
        w.writerows(out)


def fetch_cities():
    """Cities of 100,000+ people, plus every capital, from GeoNames (via the geonamescache package)."""
    import geonamescache

    def n(s):
        return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower().strip()

    countries = json.load(open(os.path.join(RAW, "world_countries.json"), encoding="utf-8"))
    iso2to3 = {c["cca2"]: c["cca3"] for c in countries}
    caps = {c["cca3"]: [n(x) for x in (c.get("capital") or [])] for c in countries}
    cities = list(geonamescache.GeonamesCache(min_city_population=15000).get_cities().values())
    by_country = {}
    for c in cities:
        by_country.setdefault(iso2to3.get(c["countrycode"]), []).append(c)
    capital_ids = set()
    for iso, lst in by_country.items():
        for cap in caps.get(iso) or []:
            exact = [c for c in lst if n(c["name"]) == cap]
            alt = [c for c in lst if any(n(a) == cap for a in c.get("alternatenames", []) if a)]
            if exact or alt:
                capital_ids.add(max(exact or alt, key=lambda c: c["population"])["geonameid"])
    rows = []
    for c in cities:
        iso = iso2to3.get(c["countrycode"])
        cap = c["geonameid"] in capital_ids
        if iso and (c["population"] >= 100000 or cap):
            rows.append([c["geonameid"], c["name"], iso, round(c["latitude"], 3), round(c["longitude"], 3), c["population"], int(cap)])
    rows.sort(key=lambda r: -r[5])
    with open(os.path.join(RAW, "cities.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["geonameid", "name", "iso3", "lat", "lon", "population", "capital"])
        w.writerows(rows)


def extract_undp(path):
    """Keep the latest value of each UNDP index per country, from UNDP's composite indices CSV."""
    keep = ["hdi", "hdi_rank", "gii", "gii_rank", "gdi", "gdi_group", "mys", "eys", "ihdi", "loss"]
    text = open(path, "rb").read().decode("latin-1")
    rows = [r for r in csv.DictReader(text.splitlines()) if re.match(r"^[A-Z]{3}$", r["iso3"])]
    with open(os.path.join(RAW, "undp_hdr.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["iso3", "country", "hdi_group", "indicator", "year", "value"])
        for r in rows:
            for k in keep:
                years = sorted(int(c[-4:]) for c in r if re.match(rf"^{k}_\d{{4}}$", c) and r[c])
                if years:
                    y = years[-1]
                    w.writerow([r["iso3"], r["country"], r["hdicode"], k, y, r[f"{k}_{y}"]])
    print("Wrote undp_hdr.csv. Now run: python3 build_data.py")


def main():
    if "--undp" in sys.argv:
        return extract_undp(sys.argv[sys.argv.index("--undp") + 1])
    for name, url in FILES.items():
        open(os.path.join(RAW, name), "wb").write(get(url))

    # CO2: keep only the columns and years the site uses
    with open(os.path.join(RAW, "co2.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["country", "year", "iso_code", "co2_per_capita"])
        for r in read_csv(CO2_URL):
            if r["iso_code"] and r["co2_per_capita"] and int(r["year"]) >= 2010:
                w.writerow([r["country"], r["year"], r["iso_code"], r["co2_per_capita"]])

    fetch_worldbank()
    fetch_hdi_median_age()
    try:
        fetch_cities()
    except ImportError:
        print("  skipping cities: run `pip install geonamescache` first")

    # V-Dem: the full dataset is an R data file (~35 MB); keep recent years and a few indices
    try:
        import pyreadr
    except ImportError:
        print("  skipping V-Dem: run `pip install pyreadr pandas` first")
        return
    tmp = tempfile.mkdtemp()
    try:
        path = os.path.join(tmp, "vdem.RData")
        open(path, "wb").write(get(VDEM_URL))
        df = pyreadr.read_r(path)["vdem"]
        cols = ["country_name", "country_text_id", "year", "v2x_regime", "v2x_libdem", "v2x_polyarchy", "v2x_freexp_altinf"]
        df = df[cols]
        df[df.year >= df.year.max() - 5].to_csv(os.path.join(RAW, "vdem_2020_on.csv"), index=False)
    finally:
        shutil.rmtree(tmp)
    print("Done. Now run: python3 build_data.py")


if __name__ == "__main__":
    main()
