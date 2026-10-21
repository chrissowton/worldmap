#!/usr/bin/env python3
"""
Download the latest raw source files into this folder.

    pip install pyreadr pandas geonamescache   # for the V-Dem and cities steps
    python3 fetch_raw.py
    python3 build_data.py

The repository already contains a copy of every raw file, so you only need
this when you want to refresh the data. groups.csv (membership of the EU,
NATO, BRICS and so on) is edited by hand and is not downloaded, and so are
lists.csv, worldcups.csv, olympic_medals.csv, minerals.csv (USGS Mineral
Commodity Summaries), world_heritage.csv and ai_diffusion.csv (Microsoft AI
Diffusion Report). Climate zones come from make_climate_zones.py.

UNHCR refugee data comes from UNHCR's own "refugees" package. Run
`python3 fetch_raw.py --unhcr` to refresh refugees.csv and refugee_flows.csv
(needs `pip install pyreadr pandas`).

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
    "avg_temperature.json": GH + "samayo/country-json/master/src/country-by-yearly-average-temperature.json",
}
CO2_URL = GH + "owid/co2-data/master/owid-co2-data.csv"
ENERGY_URL = GH + "owid/energy-data/master/owid-energy-data.csv"
CO2_COLS = ["co2", "share_global_co2", "share_global_cumulative_co2", "ghg_per_capita", "consumption_co2_per_capita",
            "temperature_change_from_ghg", "share_of_temperature_change_from_ghg"]
ENERGY_COLS = ["energy_per_capita", "renewables_share_elec", "low_carbon_share_elec", "fossil_share_elec", "coal_share_elec",
               "nuclear_share_elec", "solar_share_elec", "wind_share_elec", "hydro_share_elec",
               "oil_production", "gas_production", "coal_production"]


def latest_columns(rows, cols, out_name):
    """Latest value since 2010 of each column per country, as iso3,indicator,year,value."""
    best = {}
    for r in rows:
        iso = r.get("iso_code", "")
        if not iso or iso.startswith("OWID"):
            continue
        y = int(r["year"])
        if y < 2010:
            continue
        for c in cols:
            if r.get(c):
                if (iso, c) not in best or y > best[(iso, c)][0]:
                    best[(iso, c)] = (y, r[c])
    with open(os.path.join(RAW, out_name), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["iso3", "indicator", "year", "value"])
        for (iso, c), (y, v) in sorted(best.items()):
            w.writerow([iso, c, y, v])


def fetch_energy_climate():
    co2 = read_csv(CO2_URL)
    latest_columns(co2, CO2_COLS, "co2_climate.csv")
    latest_columns(read_csv(ENERGY_URL), ENERGY_COLS, "energy_latest.csv")
    return co2
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
    "ms_mil_xpnd_gd_zs", "ms_mil_xpnd_cd", "ms_mil_totl_p1", "ms_mil_totl_tf_zs",
    # climate, trade, resources, tourism, technology
    "ag_lnd_prcp_mm", "ne_exp_gnfs_zs", "ne_imp_gnfs_zs", "ne_rsb_gnfs_zs", "ne_exp_gnfs_cd",
    "tx_val_fuel_zs_un", "tx_val_mmtl_zs_un", "tx_val_food_zs_un", "tx_val_agri_zs_un", "tx_val_manf_zs_un",
    "tx_val_tech_mf_zs", "tm_tax_mrch_wm_ar_zs", "tx_val_ictg_zs_un", "bx_gsr_ccis_zs",
    "ny_gdp_totl_rt_zs", "ny_gdp_petr_rt_zs", "ny_gdp_ngas_rt_zs", "ny_gdp_minr_rt_zs", "ny_gdp_coal_rt_zs",
    "st_int_rcpt_cd", "st_int_rcpt_xp_zs", "st_int_dprt",
    "it_cel_sets_p2", "it_net_bbnd_p2", "it_net_secr_p6", "gb_xpd_rsdv_gd_zs", "sp_pop_scie_rd_p6",
    "ip_pat_resd", "ip_jrn_artc_sc",
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
            if code.startswith("st_int_") and y > 2019:  # tourism: last year before COVID
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


TS_WDI = ["sp_dyn_tfrt_in", "sp_dyn_le00_in", "sp_urb_totl_in_zs", "sp_dyn_imrt_in", "sp_pop_65up_to_zs",
          "sp_dyn_cbrt_in", "sp_dyn_cdrt_in", "sp_pop_grow"]


def write_timeseries(new_rows, replace):
    """Update timeseries.csv: drop the indicators in `replace`, add new_rows."""
    path = os.path.join(RAW, "timeseries.csv")
    keep = []
    if os.path.exists(path):
        keep = [r for r in csv.reader(open(path, encoding="utf-8"))][1:]
        keep = [r for r in keep if r[1] not in replace]
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["iso3", "indicator", "year", "value"])
        w.writerows(keep + new_rows)


def fetch_timeseries():
    """Yearly values since 1960 for the year slider (World Bank, UN median age, V-Dem, UNHCR)."""
    import pyreadr
    valid = {c["cca3"] for c in json.load(open(os.path.join(RAW, "world_countries.json"), encoding="utf-8"))}
    out = []
    for code in TS_WDI:
        for r in read_csv(WDI_URL.format(code)):
            iso = {"XKX": "UNK"}.get(r["geo"].upper(), r["geo"].upper())
            if r[code] and int(r["time"]) >= 1960 and iso in valid:
                out.append([iso, code, int(r["time"]), f"{float(r[code]):.4g}"])
    for r in read_csv(GM_URL.format("median_age_years")):
        y, iso = int(r["time"]), r["geo"].upper()
        if 1960 <= y <= 2025 and r["median_age_years"] and iso in valid:
            out.append([iso, "median_age", y, f"{float(r['median_age_years']):.3g}"])
    tmp = tempfile.mkdtemp()
    try:
        path = os.path.join(tmp, "vdem.RData")
        open(path, "wb").write(get(VDEM_URL))
        df = pyreadr.read_r(path)["vdem"][["country_text_id", "year", "v2x_regime", "v2x_libdem"]]
        for r in df[df.year >= 1960].itertuples():
            iso = {"XKX": "UNK"}.get(r.country_text_id, r.country_text_id)
            if iso not in valid:
                continue
            if r.v2x_regime == r.v2x_regime:
                out.append([iso, "v2x_regime", int(r.year), int(r.v2x_regime)])
            if r.v2x_libdem == r.v2x_libdem:
                out.append([iso, "v2x_libdem", int(r.year), f"{r.v2x_libdem:.3f}"])
        path = os.path.join(tmp, "population.rda")
        open(path, "wb").write(get(GH + "cran/refugees/master/data/population.rda"))
        d = list(pyreadr.read_r(path).values())[0].fillna(0)
        d = d[d.year >= 1960]
        d = d.assign(intl=d.refugees + d.oip)
        for (iso, y), v in d.groupby(["coa_iso", "year"]).intl.sum().items():
            if iso in valid:
                out.append([iso, "refugees_hosted", int(y), int(v)])
        for (iso, y), v in d[d.coo_iso != d.coa_iso].groupby(["coo_iso", "year"]).intl.sum().items():
            if iso in valid:
                out.append([iso, "refugees_from", int(y), int(v)])
    finally:
        shutil.rmtree(tmp)
    for name, url, col in (("renewables_share_elec", ENERGY_URL, "renewables_share_elec"), ("co2", CO2_URL, "co2")):
        for r in read_csv(url):
            if r["iso_code"] in valid and r[col] and int(r["year"]) >= 1960:
                out.append([r["iso_code"], name, int(r["year"]), f"{float(r[col]):.4g}"])
    write_timeseries(out, set(TS_WDI) | {"median_age", "v2x_regime", "v2x_libdem", "refugees_hosted", "refugees_from",
                                         "renewables_share_elec", "co2"})


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
    # HDI history for the year slider
    hist = []
    for r in rows:
        for c, v in r.items():
            m = re.match(r"^hdi_(\d{4})$", c)
            if m and v:
                hist.append([r["iso3"], "hdi", int(m.group(1)), v])
    write_timeseries(hist, {"hdi"})
    print("Wrote undp_hdr.csv and updated timeseries.csv. Now run: python3 build_data.py")


def fetch_unhcr():
    """Refugee totals per country and origin -> host routes (100+ people), latest year, from UNHCR's package."""
    import pyreadr
    tmp = tempfile.mkdtemp()
    try:
        path = os.path.join(tmp, "population.rda")
        open(path, "wb").write(get(GH + "cran/refugees/master/data/population.rda"))
        df = list(pyreadr.read_r(path).values())[0]
    finally:
        shutil.rmtree(tmp)
    y = int(df.year.max())
    d = df[df.year == y].fillna(0)
    d = d.assign(intl=d.refugees + d.oip)  # refugees plus others in need of international protection
    valid = {c["cca3"] for c in json.load(open(os.path.join(RAW, "world_countries.json"), encoding="utf-8"))}
    flows = d[(d.intl >= 100) & (d.coo_iso != d.coa_iso)]
    with open(os.path.join(RAW, "refugee_flows.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["origin", "host", "refugees"])
        for r in flows.itertuples():
            w.writerow([r.coo_iso, r.coa_iso, int(r.intl)])
    host = d.groupby("coa_iso").agg(refugees=("intl", "sum"), asylum=("asylum_seekers", "sum"))
    orig = d[d.coo_iso != d.coa_iso].groupby("coo_iso")["intl"].sum()
    idp = d[d.coo_iso == d.coa_iso].groupby("coa_iso")["idps"].sum()
    with open(os.path.join(RAW, "refugees.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["iso3", "year", "refugees_hosted", "asylum_seekers_hosted", "refugees_from", "idps"])
        for iso in sorted((set(host.index) | set(orig.index) | set(idp.index)) & valid):
            h = host.loc[iso] if iso in host.index else None
            w.writerow([iso, y, int(h.refugees) if h is not None else 0, int(h.asylum) if h is not None else 0,
                        int(orig.get(iso, 0)), int(idp.get(iso, 0))])
    print(f"Wrote refugees.csv and refugee_flows.csv for {y}")


def main():
    if "--unhcr" in sys.argv:
        return fetch_unhcr()
    if "--undp" in sys.argv:
        return extract_undp(sys.argv[sys.argv.index("--undp") + 1])
    for name, url in FILES.items():
        open(os.path.join(RAW, name), "wb").write(get(url))

    co2_rows = fetch_energy_climate()
    # CO2 per person history: keep only the columns and years the site uses
    with open(os.path.join(RAW, "co2.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["country", "year", "iso_code", "co2_per_capita"])
        for r in co2_rows:
            if r["iso_code"] and r["co2_per_capita"] and int(r["year"]) >= 1960:
                w.writerow([r["country"], r["year"], r["iso_code"], r["co2_per_capita"]])

    fetch_worldbank()
    fetch_hdi_median_age()
    try:
        fetch_unhcr()
        fetch_timeseries()
    except ImportError:
        print("  skipping UNHCR and yearly data: run `pip install pyreadr pandas` first")
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
