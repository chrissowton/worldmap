#!/usr/bin/env python3
"""
Build countries.json from the raw source files in this folder.

Run from the repository root:
    python3 fetch_raw.py      # downloads fresh raw files
    python3 build_data.py     # rebuilds countries.json

Every characteristic shown on the site comes from one of the sources listed
in SOURCES below. To add a new characteristic: add its raw file, add a few
lines here that put a value on each country record, and add a filter entry
in filters.js.
"""
import csv
import json
import os
import re
import sys
import unicodedata

ROOT = os.path.dirname(os.path.abspath(__file__))
RAW = ROOT
OUT = os.path.join(ROOT, "countries.json")


def raw(name):
    return os.path.join(RAW, name)


def norm(s):
    """Normalise a country name for matching across sources."""
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = s.lower().replace("&", "and")
    s = re.sub(r"\(.*?\)", "", s)
    s = re.sub(r"\bst\.? ", "saint ", s)
    s = re.sub(r"[^a-z ]", " ", s)
    s = re.sub(r"\b(the|of|republic|rep|islands?|is|and)\b", " ", s)
    return re.sub(r"\s+", " ", s).strip()


# --- 1. Base list of countries and territories (mledoze/countries, ODbL) ---
base = json.load(open(raw("world_countries.json"), encoding="utf-8"))
countries = {}
by_name = {}
for c in base:
    iso3 = c["cca3"]
    rec = {
        "iso3": iso3,
        "iso2": c["cca2"],
        "num": c.get("ccn3") or "",
        "name": c["name"]["common"],
        "flag": c.get("flag", ""),
        "capital": ", ".join(c.get("capital") or []),
        "region": c.get("region") or "",
        "subregion": c.get("subregion") or "",
        "sovereign": bool(c.get("independent")),
        "un_member": bool(c.get("unMember")) and c["cca3"] != "VAT",  # the Holy See is an observer
        "official_languages": sorted(set((c.get("languages") or {}).values())),
        "currencies": sorted({v["name"] for v in (c.get("currencies") or {}).values()}),
        "landlocked": bool(c.get("landlocked")),
        "neighbours": len(c.get("borders") or []),
        "no_land_borders": len(c.get("borders") or []) == 0 and not c.get("landlocked"),
        "area_km2": c.get("area"),
        "latlng": [round(x, 2) for x in (c.get("latlng") or [])],
    }
    # other names people might type in the quiz (no 2-letter codes)
    rec["aliases"] = sorted({n for n in [c["name"]["official"]] + list(c.get("altSpellings") or [])
                             if n != rec["name"] and (len(n) > 3 or n in ("UK", "USA", "UAE", "DRC", "PRC", "ROK", "DPRK"))})
    countries[iso3] = rec
    names = [c["name"]["common"], c["name"]["official"]] + list(c.get("altSpellings") or [])
    for n in names:
        by_name.setdefault(norm(n), iso3)

# Manual aliases for names other sources spell differently
ALIASES = {
    "burma": "MMR", "myanmar": "MMR", "ivory coast": "CIV", "cote d ivoire": "CIV",
    "east timor": "TLS", "timor leste": "TLS", "swaziland": "SWZ", "eswatini": "SWZ",
    "macedonia": "MKD", "north macedonia": "MKD", "czech": "CZE", "czechia": "CZE",
    "congo": "COG", "congo brazzaville": "COG", "congo kinshasa": "COD",
    "democratic congo": "COD", "dr congo": "COD", "korea north": "PRK", "north korea": "PRK",
    "korea south": "KOR", "south korea": "KOR", "laos": "LAO", "vatican city": "VAT",
    "holy see": "VAT", "palestinian territories": "PSE", "palestine": "PSE",
    "fiji": "FJI", "micronesia": "FSM", "federated states micronesia": "FSM",
    "virgin british": "VGB", "british virgin": "VGB", "virgin us": "VIR",
    "us virgin": "VIR", "u s virgin": "VIR", "united states virgin": "VIR", "russia": "RUS",
    "cape verde": "CPV", "gambia": "GMB", "bahamas": "BHS", "kosovo": "UNK",
    "macau": "MAC", "macao": "MAC", "reunion": "REU", "curacao": "CUW",
    "saint barthelemy": "BLM", "sint maarten": "SXM", "st martin": "MAF",
    "falkland malvinas": "FLK", "falkland": "FLK", "turkey": "TUR", "turkiye": "TUR",
}
for k, v in ALIASES.items():
    by_name[norm(k)] = v


def find(name):
    return by_name.get(norm(name))


unmatched = {}

# --- 2. Population & GDP (World Bank via datasets/population & datasets/gdp, CC BY 4.0) ---
WB_FIX = {"XKX": "UNK"}


def latest_by_iso(path):
    out = {}
    for row in csv.DictReader(open(path, encoding="utf-8")):
        iso = WB_FIX.get(row["Country Code"], row["Country Code"])
        if not row["Value"]:
            continue
        y = int(row["Year"])
        if iso not in out or y > out[iso][0]:
            out[iso] = (y, float(row["Value"]))
    return out


pop = latest_by_iso(raw("pop.csv"))
gdp = latest_by_iso(raw("gdp.csv"))
for iso, rec in countries.items():
    if iso in pop:
        rec["population"] = round(pop[iso][1])
        rec["population_year"] = pop[iso][0]
    if iso in gdp:
        rec["_gdp"] = gdp[iso]

# per-capita GDP needs same-year population
pop_year = {}
for row in csv.DictReader(open(raw("pop.csv"), encoding="utf-8")):
    if row["Value"]:
        pop_year[(WB_FIX.get(row["Country Code"], row["Country Code"]), int(row["Year"]))] = float(row["Value"])
for iso, rec in countries.items():
    g = rec.pop("_gdp", None)
    if g and (iso, g[0]) in pop_year:
        rec["gdp_per_capita"] = round(g[1] / pop_year[(iso, g[0])])
        rec["gdp_year"] = g[0]

# --- 3. CO2 per capita (Our World in Data co2-data, CC BY 4.0) ---
co2 = {}
for row in csv.DictReader(open(raw("co2.csv"), encoding="utf-8")):
    iso, v = row["iso_code"], row["co2_per_capita"]
    if not iso or iso.startswith("OWID") or not v:
        continue
    y = int(row["year"])
    if iso not in co2 or y > co2[iso][0]:
        co2[iso] = (y, float(v))
for iso, (y, v) in co2.items():
    if iso in countries:
        countries[iso]["co2_per_capita"] = round(v, 2)
        countries[iso]["co2_year"] = y

# --- 4. Political regime (V-Dem v16, CC BY-SA 4.0) ---
REGIMES = ["Closed autocracy", "Electoral autocracy", "Electoral democracy", "Liberal democracy"]
VDEM_FIX = {"XKX": "UNK", "PSE": "PSE", "SML": None, "ZZB": None, "PSG": None}
vdem = {}
for row in csv.DictReader(open(raw("vdem_2020_on.csv"), encoding="utf-8")):
    iso = row["country_text_id"]
    iso = VDEM_FIX.get(iso, iso)
    if not iso or not row["v2x_regime"]:
        continue
    y = int(float(row["year"]))
    if iso not in vdem or y > vdem[iso]["y"]:
        vdem[iso] = {"y": y, **row}
for iso, r in vdem.items():
    if iso not in countries:
        unmatched.setdefault("vdem", []).append(iso)
        continue
    rec = countries[iso]
    rec["regime"] = REGIMES[int(float(r["v2x_regime"]))]
    rec["democracy"] = rec["regime"] in ("Electoral democracy", "Liberal democracy")
    rec["libdem"] = round(float(r["v2x_libdem"]), 3) if r["v2x_libdem"] else None
    rec["free_expression"] = round(float(r["v2x_freexp_altinf"]), 3) if r["v2x_freexp_altinf"] else None
    rec["vdem_year"] = r["y"]

# --- 5. Religion (Pew Research Center, Global Religious Landscape, 2010 estimates) ---
REL = {"Christian": "christian", "Muslim": "muslim", "Unaffiliated": "unaffiliated",
       "Hindu": "hindu", "Buddhist": "buddhist", "Folk Religions": "folk",
       "Jewish": "jewish", "Other Religions": "other_religion"}
LABEL = {"christian": "Christianity", "muslim": "Islam", "unaffiliated": "No religion",
         "hindu": "Hinduism", "buddhist": "Buddhism", "folk": "Folk religions",
         "jewish": "Judaism", "other_religion": "Other religions"}


def num(v):
    v = v.replace(",", "").strip()
    if v.startswith("<"):
        return 0.0  # Pew reports fewer than 10,000 adherents
    return float(v or 0)


for row in csv.DictReader(open(raw("pew_religion_2010.csv"), encoding="utf-8")):
    iso = find(row["Country"])
    if not iso or iso not in countries:
        unmatched.setdefault("pew", []).append(row["Country"])
        continue
    vals = {k: num(row[col]) for col, k in REL.items()}
    total = sum(vals.values())
    if total <= 0:
        continue
    rec = countries[iso]
    for k, v in vals.items():
        rec["pct_" + k] = round(100 * v / total, 1)
    top = max(vals, key=vals.get)
    rec["largest_religion"] = LABEL[top]

# --- 6. Languages spoken by >= 10% of the population (Unicode CLDR) ---
names = json.load(open(raw("cldr_languages_en.json"), encoding="utf-8"))
names = names["main"]["en"]["localeDisplayNames"]["languages"]
tinfo = json.load(open(raw("cldr_territoryInfo.json"), encoding="utf-8"))["supplemental"]["territoryInfo"]
iso2_to_3 = {r["iso2"]: k for k, r in countries.items()}
for t, info in tinfo.items():
    iso = iso2_to_3.get(t)
    if not iso:
        continue
    spoken = []
    for code, lp in (info.get("languagePopulation") or {}).items():
        pct = float(lp.get("_populationPercent", 0))
        if pct >= 10:
            base_code = code.split("_")[0]
            nm = names.get(code) or names.get(base_code) or code
            nm = re.sub(r"\s*\(.*\)", "", nm)
            spoken.append(nm)
    countries[iso]["spoken_languages"] = sorted(set(spoken))

# --- 7. Driving side (samayo/country-json, MIT) with known corrections ---
DRIVE_FIX = {"NCL": "right", "WLF": "right", "VIR": "left", "BMU": "left"}
for row in json.load(open(raw("driving_side.json"), encoding="utf-8")):
    iso = find(row["country"])
    if iso and iso in countries and row.get("side"):
        countries[iso]["driving_side"] = row["side"].capitalize()
    else:
        unmatched.setdefault("driving", []).append(row["country"])
for iso, side in DRIVE_FIX.items():
    if iso in countries:
        countries[iso]["driving_side"] = side.capitalize()

# --- 8. More World Bank indicators (World Development Indicators via open-numbers, CC BY 4.0) ---
WB = {
    # field: (indicator code, decimals)
    "gni_ppp": ("ny_gnp_pcap_pp_cd", 0),
    "gini": ("si_pov_gini", 1),
    "extreme_poverty": ("si_pov_dday", 1),
    "life_expectancy": ("sp_dyn_le00_in", 1),
    "infant_mortality": ("sp_dyn_imrt_in", 1),
    "under5_mortality": ("sh_dyn_mort", 1),
    "maternal_mortality": ("sh_sta_mmrt", 0),
    "literacy": ("se_adt_litr_zs", 1),
    "electricity": ("eg_elc_accs_zs", 1),
    "safe_water": ("sh_h2o_smdw_zs", 1),
    "internet": ("it_net_user_zs", 1),
    "health_spend": ("sh_xpd_chex_gd_zs", 1),
    "education_spend": ("se_xpd_totl_gd_zs", 1),
    "density": ("en_pop_dnst", 1),
    "pop_growth": ("sp_pop_grow", 2),
    "fertility": ("sp_dyn_tfrt_in", 2),
    "birth_rate": ("sp_dyn_cbrt_in", 1),
    "death_rate": ("sp_dyn_cdrt_in", 1),
    "pct_under15": ("sp_pop_0014_to_zs", 1),
    "pct_over65": ("sp_pop_65up_to_zs", 1),
    "dependency": ("sp_pop_dpnd", 1),
    "urban_pct": ("sp_urb_totl_in_zs", 1),
    "migrants_pct": ("sm_pop_totl_zs", 1),
    "remittances_pct": ("bx_trf_pwkr_dt_gd_zs", 1),
    "emp_agriculture": ("sl_agr_empl_zs", 1),
    "emp_industry": ("sl_ind_empl_zs", 1),
    "emp_services": ("sl_srv_empl_zs", 1),
    "trade_pct": ("ne_trd_gnfs_zs", 1),
    "fdi_pct": ("bx_klt_dinv_wd_gd_zs", 1),
    "tourists": ("st_int_arvl", 0),
    "forest_pct": ("ag_lnd_frst_zs", 1),
    "renewables_pct": ("eg_fec_rnew_zs", 1),
    "water_stress": ("er_h2o_fwst_zs", 1),
    "adolescent_births": ("sp_ado_tfrt", 1),
    "women_parliament": ("sg_gen_parl_zs", 1),
    "female_labour": ("sl_tlf_cact_fe_zs", 1),
    "military_spend_pct": ("ms_mil_xpnd_gd_zs", 2),
    "military_spend_usd": ("ms_mil_xpnd_cd", 0),
    "armed_forces": ("ms_mil_totl_p1", 0),
    "armed_forces_pct": ("ms_mil_totl_tf_zs", 2),
    # climate
    "rainfall_mm": ("ag_lnd_prcp_mm", 0),
    # trade
    "exports_pct": ("ne_exp_gnfs_zs", 1), "imports_pct": ("ne_imp_gnfs_zs", 1), "trade_balance_pct": ("ne_rsb_gnfs_zs", 1),
    "exports_usd": ("ne_exp_gnfs_cd", 0), "exp_fuel_pct": ("tx_val_fuel_zs_un", 1), "exp_metals_pct": ("tx_val_mmtl_zs_un", 1),
    "exp_food_pct": ("tx_val_food_zs_un", 1), "exp_agri_raw_pct": ("tx_val_agri_zs_un", 1), "exp_manuf_pct": ("tx_val_manf_zs_un", 1),
    "hightech_exports_pct": ("tx_val_tech_mf_zs", 1), "tariff_pct": ("tm_tax_mrch_wm_ar_zs", 1),
    "ict_goods_exports_pct": ("tx_val_ictg_zs_un", 1), "ict_services_exports_pct": ("bx_gsr_ccis_zs", 1),
    # natural resources
    "resource_rents_pct": ("ny_gdp_totl_rt_zs", 1), "oil_rents_pct": ("ny_gdp_petr_rt_zs", 1), "gas_rents_pct": ("ny_gdp_ngas_rt_zs", 1),
    "mineral_rents_pct": ("ny_gdp_minr_rt_zs", 1), "coal_rents_pct": ("ny_gdp_coal_rt_zs", 2),
    # tourism (2019, the last year before COVID)
    "tourism_receipts_usd": ("st_int_rcpt_cd", 0), "tourism_receipts_pct": ("st_int_rcpt_xp_zs", 1), "tourist_departures": ("st_int_dprt", 0),
    # technology
    "mobile_per100": ("it_cel_sets_p2", 0), "broadband_per100": ("it_net_bbnd_p2", 1), "secure_servers_per_million": ("it_net_secr_p6", 0),
    "rnd_pct": ("gb_xpd_rsdv_gd_zs", 2), "researchers_per_million": ("sp_pop_scie_rd_p6", 0),
    "patents": ("ip_pat_resd", 0), "science_articles": ("ip_jrn_artc_sc", 0),
}
wb = {}
for row in csv.DictReader(open(raw("worldbank_latest.csv"), encoding="utf-8")):
    iso = WB_FIX.get(row["iso3"], row["iso3"])
    wb[(iso, row["indicator"])] = (int(row["year"]), float(row["value"]))
for iso, rec in countries.items():
    for field, (code, dp) in WB.items():
        v = wb.get((iso, code))
        if v is None:
            continue
        rec[field] = round(v[1], dp) if dp else round(v[1])
        rec[field + "_year"] = v[0]
    # net migration per 1,000 people
    nm, pp = wb.get((iso, "sm_pop_netm")), wb.get((iso, "sp_pop_totl"))
    if nm and pp and pp[1] > 0:
        rec["net_migration"] = round(1000 * nm[1] / pp[1], 1)
        rec["net_migration_year"] = nm[0]

# World Bank income groups (FY2027, from July 2026), from GNI per person, Atlas method
INCOME = [(1175, "Low income"), (4635, "Lower-middle income"), (14375, "Upper-middle income"), (float("inf"), "High income")]
for iso, rec in countries.items():
    g = wb.get((iso, "ny_gnp_pcap_cd"))
    if g and g[0] >= 2024:
        rec["income_group"] = next(name for limit, name in INCOME if g[1] <= limit)
# The World Bank classifies these without publishing GNI figures; Venezuela is unclassified.
INCOME_FIX = {"CUB": "Upper-middle income", "ERI": "Low income", "LIE": "High income", "MCO": "High income",
              "PRK": "Low income", "SMR": "High income", "SSD": "Low income", "SYR": "Low income", "YEM": "Low income", "VEN": None}
for iso, g in INCOME_FIX.items():
    if iso in countries:
        if g:
            countries[iso]["income_group"] = g
        else:
            countries[iso].pop("income_group", None)

# --- 9. UNDP Human Development Report 2025 (undp_hdr.csv, extracted from UNDP's composite indices file) ---
# and median age (UN World Population Prospects, via Gapminder)
UNDP = {
    # field: (indicator, decimals)
    "hdi": ("hdi", 3), "hdi_rank": ("hdi_rank", 0),
    "gii": ("gii", 3), "gii_rank": ("gii_rank", 0),
    "gdi": ("gdi", 3), "gdi_group": ("gdi_group", 0),
    "mean_schooling": ("mys", 1), "expected_schooling": ("eys", 1),
    "ihdi": ("ihdi", 3), "hdi_loss": ("loss", 1),
}
GDI_GROUPS = {1: "1 · High equality", 2: "2 · Medium-high equality", 3: "3 · Medium equality", 4: "4 · Medium-low equality", 5: "5 · Low equality"}
undp = {}
for row in csv.DictReader(open(raw("undp_hdr.csv"), encoding="utf-8")):
    undp[(row["iso3"], row["indicator"])] = (int(row["year"]), float(row["value"]))
    if row["iso3"] in countries and row["hdi_group"]:
        countries[row["iso3"]]["hdi_group"] = row["hdi_group"].replace("Very High", "Very high")
for iso, rec in countries.items():
    for field, (ind, dp) in UNDP.items():
        v = undp.get((iso, ind))
        if v is None:
            continue
        rec[field] = round(v[1], dp) if dp else int(v[1])
        rec[field + "_year"] = v[0]
    if "gdi_group" in rec:
        rec["gdi_group"] = GDI_GROUPS[rec["gdi_group"]]
for row in csv.DictReader(open(raw("hdi_median_age.csv"), encoding="utf-8")):
    iso = row["iso3"]
    if iso in countries and row["indicator"] == "median_age":
        countries[iso]["median_age"] = round(float(row["value"]), 1)
        countries[iso]["median_age_year"] = int(row["year"])

# --- 10. Membership of international groups (groups.csv, compiled by hand) ---
for line in open(raw("groups.csv"), encoding="utf-8"):
    if line.startswith("#") or line.startswith("group,") or not line.strip():
        continue
    group, iso = line.strip().split(",")
    if iso in countries:
        countries[iso].setdefault("groups", []).append(group)
for rec in countries.values():
    rec["groups"] = sorted(rec.get("groups", []))

# --- 11. Cities (GeoNames, CC BY 4.0): written to cities.json ---
cities = []
for row in csv.DictReader(open(raw("cities.csv"), encoding="utf-8")):
    if row["iso3"] not in countries:
        continue
    cities.append([row["name"], row["iso3"], float(row["lat"]), float(row["lon"]), int(row["population"]), int(row["capital"])])
with open(os.path.join(ROOT, "cities.json"), "w", encoding="utf-8") as f:
    json.dump(cities, f, ensure_ascii=False, separators=(",", ":"))
print(f"Wrote {len(cities)} cities")
for rec in countries.values():
    cs = [c for c in cities if c[1] == rec["iso3"]]
    rec["cities_1m"] = sum(1 for c in cs if c[4] >= 1_000_000)
    big = max(cs, key=lambda c: c[4], default=None)
    cap = max((c for c in cs if c[5]), key=lambda c: c[4], default=None)
    if big:
        rec["largest_city"] = big[0]
        rec["largest_city_pop"] = big[4]
        rec["capital_is_largest"] = bool(cap) and cap[0] == big[0]
    if cap:
        rec["capital_pop"] = cap[4]

# --- 12. Yes/no lists: treaties, Security Council, nuclear weapons, sport (lists.csv, edited by hand) ---
LISTS = {}
for line in open(raw("lists.csv"), encoding="utf-8"):
    if line.startswith("#") or line.startswith("list,") or not line.strip():
        continue
    name, iso = line.strip().split(",")
    LISTS.setdefault(name, set()).add(iso)
for name, members in LISTS.items():
    for iso, rec in countries.items():
        if iso in members:
            rec[name] = True
        elif rec["sovereign"]:
            rec[name] = False
# One list per country of the treaties it has joined and the events it has hosted
TREATIES = [("un_crc", "Children's rights (UNCRC)"), ("un_icc", "International Criminal Court"), ("un_paris", "Paris Agreement"),
            ("un_refugee", "Refugee Convention"), ("un_cedaw", "Women's rights (CEDAW)"), ("un_crpd", "Disability rights (CRPD)"),
            ("un_npt", "Non-Proliferation Treaty (NPT)"), ("un_tpnw", "Nuclear weapons ban"), ("un_landmine", "Landmine ban")]
EVENTS = [("wc_men_host", "Men's World Cup"), ("wc_women_host", "Women's World Cup"), ("olympics_summer_host", "Summer Olympics"),
          ("olympics_winter_host", "Winter Olympics"), ("commonwealth_games_host", "Commonwealth Games")]
for rec in countries.values():
    if rec["sovereign"] or any(rec.get(k) for k, _ in TREATIES):
        rec["treaties_joined"] = [n for k, n in TREATIES if rec.get(k)]
    if rec["sovereign"] or any(rec.get(k) for k, _ in EVENTS):
        rec["events_hosted"] = [n for k, n in EVENTS if rec.get(k)]
    if rec.get("wto_member"):
        rec.setdefault("groups", []).append("World Trade Organization")
        rec["groups"] = sorted(set(rec["groups"]))
for rec in countries.values():
    if rec.get("unsc_permanent"):
        rec["security_council"] = "Permanent member"
    elif rec.get("unsc_elected"):
        rec["security_council"] = "Elected member (2026)"
    elif rec["sovereign"]:
        rec["security_council"] = "Not on the council"
    rec.pop("unsc_permanent", None)
    rec.pop("unsc_elected", None)

# Football World Cup titles (worldcups.csv) and Paris 2024 Olympic medals (olympic_medals.csv)
wc = {r["iso3"]: r for r in csv.DictReader(l for l in open(raw("worldcups.csv"), encoding="utf-8") if not l.startswith("#"))}
medals = {r["iso3"]: r for r in csv.DictReader(l for l in open(raw("olympic_medals.csv"), encoding="utf-8") if not l.startswith("#"))}
for iso, rec in countries.items():
    if not rec["sovereign"] and iso not in wc and iso not in medals:
        continue
    rec["wc_men_titles"] = int(wc[iso]["men"]) if iso in wc else 0
    rec["wc_women_titles"] = int(wc[iso]["women"]) if iso in wc else 0
    m = medals.get(iso)
    rec["olympic_medals"] = int(m["total"]) if m else 0
    rec["olympic_golds"] = int(m["gold"]) if m else 0
    if rec.get("population"):
        rec["medals_per_million"] = round(rec["olympic_medals"] / rec["population"] * 1e6, 2)

# --- 13. Refugees (UNHCR Refugee Population Statistics, CC BY 4.0) ---
for row in csv.DictReader(open(raw("refugees.csv"), encoding="utf-8")):
    rec = countries.get(row["iso3"])
    if not rec:
        continue
    y = int(row["year"])
    for f in ("refugees_hosted", "asylum_seekers_hosted", "refugees_from", "idps"):
        rec[f] = int(row[f])
        rec[f + "_year"] = y
    if rec.get("population"):
        rec["refugees_hosted_per1000"] = round(1000 * rec["refugees_hosted"] / rec["population"], 1)
        rec["refugees_from_per1000"] = round(1000 * rec["refugees_from"] / rec["population"], 1)
        rec["refugees_hosted_per1000_year"] = rec["refugees_from_per1000_year"] = y
for rec in countries.values():
    if rec["sovereign"] and "refugees_hosted" not in rec:
        rec["refugees_hosted"] = rec["refugees_from"] = 0
flows = [[r["origin"], r["host"], int(r["refugees"])] for r in csv.DictReader(open(raw("refugee_flows.csv"), encoding="utf-8"))
         if r["origin"] in countries and r["host"] in countries]
with open(os.path.join(ROOT, "refugee_flows.json"), "w", encoding="utf-8") as f:
    json.dump(flows, f, separators=(",", ":"))
print(f"Wrote {len(flows)} refugee flows")

# --- 13a. Climate, energy, minerals, tourism and technology ---
def latest_file(name, fields, dp=1):
    for row in csv.DictReader(open(raw(name), encoding="utf-8")):
        rec = countries.get({"OWID_KOS": "UNK"}.get(row["iso3"], row["iso3"]))
        if rec and row["indicator"] in fields:
            f = fields[row["indicator"]]
            v = float(row["value"])
            rec[f] = round(v, dp) if abs(v) < 1e6 else round(v)
            rec[f + "_year"] = int(row["year"])
latest_file("co2_climate.csv", {"co2": "co2_mt", "share_global_co2": "co2_world_share", "share_global_cumulative_co2": "co2_cumulative_share",
    "ghg_per_capita": "ghg_per_capita", "consumption_co2_per_capita": "co2_consumption_per_capita",
    "share_of_temperature_change_from_ghg": "warming_share"}, 2)
latest_file("energy_latest.csv", {"energy_per_capita": "energy_per_capita", "renewables_share_elec": "renewables_elec_pct",
    "low_carbon_share_elec": "low_carbon_elec_pct", "fossil_share_elec": "fossil_elec_pct", "coal_share_elec": "coal_elec_pct",
    "nuclear_share_elec": "nuclear_elec_pct", "solar_share_elec": "solar_elec_pct", "wind_share_elec": "wind_elec_pct",
    "hydro_share_elec": "hydro_elec_pct", "oil_production": "oil_twh", "gas_production": "gas_twh", "coal_production": "coal_twh"}, 1)
for rec in countries.values():  # producing nothing is a real zero, not missing data
    for f in ("oil_twh", "gas_twh", "coal_twh"):
        if f not in rec and rec.get("energy_per_capita") is not None:
            rec[f] = 0
            rec[f + "_year"] = rec.get("energy_per_capita_year")

# Average temperature (samayo/country-json, from Wikipedia's 1961–1990 averages)
for row in json.load(open(raw("avg_temperature.json"), encoding="utf-8")):
    iso = find(row["country"])
    if iso in countries and row.get("temperature") is not None:
        countries[iso]["avg_temp"] = round(float(row["temperature"]), 1)

# Köppen–Geiger climate zones (climate_zones.csv, from make_climate_zones.py)
KOPPEN = {
    "Af": "Tropical rainforest", "Am": "Tropical monsoon", "Aw": "Tropical savanna", "As": "Tropical savanna",
    "BWh": "Hot desert", "BWk": "Cold desert", "BSh": "Hot semi-arid", "BSk": "Cold semi-arid",
    "Csa": "Mediterranean", "Csb": "Mediterranean", "Csc": "Mediterranean",
    "Cwa": "Subtropical highland or monsoon", "Cwb": "Subtropical highland or monsoon", "Cwc": "Subtropical highland or monsoon",
    "Cfa": "Humid subtropical", "Cfb": "Oceanic", "Cfc": "Oceanic",
    "Dsa": "Continental", "Dsb": "Continental", "Dwa": "Continental", "Dwb": "Continental", "Dfa": "Continental", "Dfb": "Continental",
    "Dsc": "Subarctic", "Dsd": "Subarctic", "Dwc": "Subarctic", "Dwd": "Subarctic", "Dfc": "Subarctic", "Dfd": "Subarctic",
    "ET": "Tundra", "EF": "Ice cap",
}
MAIN = {"A": "Tropical", "B": "Dry", "C": "Temperate", "D": "Continental", "E": "Polar"}
zones = {}
for row in csv.DictReader(open(raw("climate_zones.csv"), encoding="utf-8")):
    zones.setdefault(row["iso3"], []).append((row["zone"], float(row["share_pct"])))
for iso, zs in zones.items():
    if iso not in countries:
        continue
    rec = countries[iso]
    main, named = {}, {}
    for code, pct in zs:
        main[MAIN[code[0]]] = main.get(MAIN[code[0]], 0) + pct
        named[KOPPEN.get(code, code)] = named.get(KOPPEN.get(code, code), 0) + pct
    rec["main_climate"] = max(main, key=main.get)
    rec["climate_zones"] = sorted(n for n, p in named.items() if p >= 10)
    rec["dry_climate_pct"] = round(main.get("Dry", 0), 1)
    rec["climate_list"] = sorted(([n, round(p)] for n, p in named.items() if p >= 1), key=lambda x: -x[1])

# Minerals: major producer = at least 5% of world mine production (USGS, 2025 estimates)
for row in csv.DictReader(l for l in open(raw("minerals.csv"), encoding="utf-8") if not l.startswith("#")):
    rec = countries.get(row["iso3"])
    if not rec:
        continue
    share = 100 * float(row["production_2025"]) / float(row["world_total_2025"])
    rec.setdefault("minerals_list", []).append([row["mineral"], round(share, 1)])
for rec in countries.values():
    ml = sorted(rec.get("minerals_list", []), key=lambda x: -x[1])
    rec["minerals_list"] = ml
    rec["major_producer"] = sorted(m.capitalize() for m, sh in ml if sh >= 5)
    rec["minerals_count"] = len(rec["major_producer"])

# AI use (Microsoft AI Diffusion Report, Q1 2026) and World Heritage sites
for name, field, conv in (("ai_diffusion.csv", "ai_users_pct", float), ("world_heritage.csv", "world_heritage_sites", int)):
    for row in csv.DictReader(l for l in open(raw(name), encoding="utf-8") if not l.startswith("#")):
        if row["iso3"] in countries:
            countries[row["iso3"]][field] = conv(list(row.values())[1])

# Per-person versions
for rec in countries.values():
    p = rec.get("population")
    if not p:
        continue
    if rec.get("tourists") is not None:
        rec["tourists_per100"] = round(100 * rec["tourists"] / p, 1)
    if rec.get("patents") is not None:
        rec["patents_per_million"] = round(rec["patents"] / p * 1e6, 1)
        rec["patents_per_million_year"] = rec.get("patents_year")
    if rec.get("science_articles") is not None:
        rec["articles_per_million"] = round(rec["science_articles"] / p * 1e6)
        rec["articles_per_million_year"] = rec.get("science_articles_year")

# --- 13b. Land borders: each neighbour and the shared border length (borders.csv, from make_borders.mjs) ---
for rec in countries.values():
    rec.pop("borders_list", None)
for line in open(raw("borders.csv"), encoding="utf-8"):
    if line.startswith("#") or line.startswith("country_a") or not line.strip():
        continue
    a, b, km = line.strip().split(",")
    for x, y in ((a, b), (b, a)):
        if x in countries:
            countries[x].setdefault("borders_list", []).append([y, int(km)])
for rec in countries.values():
    bl = sorted(rec.get("borders_list", []), key=lambda p: -p[1])
    rec["borders_list"] = bl
    rec["neighbours"] = len(bl)
    rec["border_km"] = sum(k for _, k in bl)
    rec["no_land_borders"] = not bl and not rec["landlocked"]

# --- 14. Time series for the year slider (timeseries.csv.gz + pop/gdp/co2 files) -> timeseries.json ---
YEARS = list(range(1960, 2026))
TS_CODES = {  # field on the site: indicator in timeseries.csv.gz
    "fertility": "sp_dyn_tfrt_in", "life_expectancy": "sp_dyn_le00_in", "urban_pct": "sp_urb_totl_in_zs",
    "infant_mortality": "sp_dyn_imrt_in", "pct_over65": "sp_pop_65up_to_zs", "birth_rate": "sp_dyn_cbrt_in",
    "death_rate": "sp_dyn_cdrt_in", "pop_growth": "sp_pop_grow", "hdi": "hdi", "median_age": "median_age",
    "libdem": "v2x_libdem", "regime": "v2x_regime", "refugees_hosted": "refugees_hosted", "refugees_from": "refugees_from",
    "renewables_elec_pct": "renewables_share_elec", "co2_mt": "co2",
    "gii": "gii", "mean_schooling": "undp_mys", "expected_schooling": "undp_eys", "ihdi": "ihdi",
}
# every World Bank measure with yearly history (see TS_WB_HISTORY in fetch_raw.py)
TS_CODES.update({f: WB[f][0] for f in ["gni_ppp", "gini", "extreme_poverty", "under5_mortality", "maternal_mortality", "literacy",
    "electricity", "safe_water", "internet", "health_spend", "education_spend", "density", "pct_under15", "dependency",
    "migrants_pct", "remittances_pct", "emp_agriculture", "emp_industry", "emp_services", "trade_pct", "fdi_pct", "tourists",
    "forest_pct", "renewables_pct", "adolescent_births", "women_parliament", "female_labour", "military_spend_pct",
    "armed_forces_pct", "exports_pct", "imports_pct", "mobile_per100", "broadband_per100", "rnd_pct", "resource_rents_pct"]})
# Charts view: totals and mixes over time (see fetch_charts in fetch_raw.py)
TS_CODES.update({
    "exports_usd": "ne_exp_gnfs_cd", "goods_exports_usd": "tx_val_mrch_cd_wt", "services_exports_usd": "bx_gsr_nfsv_cd",
    "exp_fuel_pct": "tx_val_fuel_zs_un", "exp_metals_pct": "tx_val_mmtl_zs_un", "exp_food_pct": "tx_val_food_zs_un",
    "exp_agri_raw_pct": "tx_val_agri_zs_un", "exp_manuf_pct": "tx_val_manf_zs_un",
    "armed_forces": "ms_mil_totl_p1", "military_spend_usd": "ms_mil_xpnd_cd", "tourism_receipts_usd": "st_int_rcpt_cd",
    "coal_elec_pct": "coal_share_elec", "gas_elec_pct": "gas_share_elec", "oil_elec_pct": "oil_share_elec",
    "nuclear_elec_pct": "nuclear_share_elec", "hydro_elec_pct": "hydro_share_elec", "wind_elec_pct": "wind_share_elec",
    "solar_elec_pct": "solar_share_elec", "other_renew_elec_pct": "other_renewables_share_elec",
    "fossil_elec_pct": "fossil_share_elec", "low_carbon_elec_pct": "low_carbon_share_elec", "elec_twh": "electricity_generation",
})
# SDG tracker measures (see SDG_WB in fetch_raw.py)
SDG_WB_CODES = {
    "undernourishment": "sn_itk_defc_zs", "stunting": "sh_sta_stnt_me_zs", "neonatal_mortality": "sh_dyn_nmrt",
    "tb_incidence": "sh_tbs_incd", "basic_water": "sh_h2o_basw_zs", "basic_sanitation": "sh_sta_bass_zs",
    "clean_cooking": "eg_cft_accs_zs", "primary_completion": "se_prm_cmpt_zs", "lower_secondary_completion": "se_sec_cmpt_lo_zs",
    "unemployment": "sl_uem_totl_zs", "tax_revenue_pct": "gc_tax_totl_gd_zs", "homicides": "vc_ihr_psrc_p5",
    "pm25": "en_atm_pm25_mc_m3", "protected_land_pct": "er_lnd_ptld_zs",
}
TS_CODES.update(SDG_WB_CODES)
series = {k: {} for k in list(TS_CODES) + ["population", "gdp_per_capita", "co2_per_capita", "gdp_usd"]}
def put(field, iso, year, value):
    if iso in countries and 1960 <= year <= 2025:
        series[field].setdefault(iso, [None] * len(YEARS))[year - 1960] = value
code_to_field = {v: k for k, v in TS_CODES.items()}
import gzip
for row in csv.DictReader(gzip.open(raw("timeseries.csv.gz"), "rt", encoding="utf-8")):
    f = code_to_field.get(row["indicator"])
    if f:
        v = float(row["value"])
        put(f, row["iso3"], int(row["year"]), int(v) if f in ("regime", "refugees_hosted", "refugees_from") else v)
for (iso, y), v in pop_year.items():
    put("population", iso, y, round(v))
for row in csv.DictReader(open(raw("gdp.csv"), encoding="utf-8")):
    iso = WB_FIX.get(row["Country Code"], row["Country Code"]); y = int(row["Year"])
    if row["Value"] and (iso, y) in pop_year and pop_year[(iso, y)] > 0:
        put("gdp_per_capita", iso, y, round(float(row["Value"]) / pop_year[(iso, y)]))
    if row["Value"]:
        put("gdp_usd", iso, y, float(f"{float(row['Value']):.4g}"))
for row in csv.DictReader(open(raw("co2.csv"), encoding="utf-8")):
    if row["iso_code"] and row["co2_per_capita"]:
        put("co2_per_capita", row["iso_code"], int(row["year"]), round(float(row["co2_per_capita"]), 2))
sparse = {}
# Social attitudes (World Values Survey Trend File 1981-2022, country figures from make_attitudes.py):
# a value for every survey year, and the latest survey from 2010 on as the current value
for row in csv.DictReader(l for l in open(raw("attitudes.csv"), encoding="utf-8") if not l.startswith("#")):
    f, iso, y = row["field"], row["iso3"], int(row["year"])
    v = float(row["value"])
    if iso in countries:  # stored sparsely ([year, value, year, value…]); app.js fills in the empty years
        sparse.setdefault(f, {}).setdefault(iso, []).extend([y, v])
    rec = countries.get(iso)
    if rec is not None and y >= 2010 and y >= rec.get(f + "_year", 0):
        rec[f] = v; rec[f + "_year"] = y
# Other opinion surveys (Wellcome Global Monitor, World Risk Poll, World Happiness Report, UNODC), from make_surveys.py.
# wave 0 = a yearly series (stored in full); other waves are surveys every year or two (stored sparsely)
for row in csv.DictReader(l for l in open(raw("surveys.csv"), encoding="utf-8") if not l.startswith("#")):
    f, iso, y, wave = row["field"], row["iso3"], int(row["year"]), int(row["wave"])
    v = float(row["value"])
    if iso not in countries:
        continue
    if f == "happiness_rank":
        v = int(v)
    elif wave == 0:
        series.setdefault(f, {})
        put(f, iso, y, v)
    elif not f.startswith(("ab_", "pew_", "wgm_")):  # one-off surveys (one wave) have no history to show
        sparse.setdefault(f, {}).setdefault(iso, []).extend([y, v])
    rec = countries[iso]
    if y >= 2010 and y >= rec.get(f + "_year", 0):
        rec[f] = v; rec[f + "_year"] = y
for row in csv.DictReader(l for l in open(raw("surveys_cat.csv"), encoding="utf-8") if not l.startswith("#")):
    rec = countries.get(row["iso3"])
    if rec is not None and int(row["year"]) >= rec.get(row["field"] + "_year", 0):
        rec[row["field"]] = row["value"]; rec[row["field"] + "_year"] = int(row["year"])
        rec[row["field"] + "_share"] = float(row["share_pct"])
# Demographic transition model stage and natural increase, from the birth and death rates of each year
DTM_STAGES = ["Stage 1 · High birth and death rates", "Stage 2 · Death rate falling, birth rate high",
              "Stage 3 · Birth rate falling", "Stage 4 · Low birth and death rates", "Stage 5 · Deaths outnumber births"]
def dtm_stage(br, dr):
    if br >= 35 and dr >= 20: return 0
    if br >= 28: return 1
    if br >= 15: return 2
    if br > dr: return 3
    return 4
series["dtm_stage"], series["natural_increase"] = {}, {}
for iso, brs in series["birth_rate"].items():
    drs = series["death_rate"].get(iso)
    if not drs:
        continue
    st = [dtm_stage(b, d) if b is not None and d is not None else None for b, d in zip(brs, drs)]
    ni = [round(b - d, 1) if b is not None and d is not None else None for b, d in zip(brs, drs)]
    series["dtm_stage"][iso], series["natural_increase"][iso] = st, ni
for iso, rec in countries.items():
    if rec.get("birth_rate") is not None and rec.get("death_rate") is not None:
        rec["dtm_stage"] = DTM_STAGES[dtm_stage(rec["birth_rate"], rec["death_rate"])]
        rec["natural_increase"] = round(rec["birth_rate"] - rec["death_rate"], 1)
        rec["dtm_stage_year"] = rec["natural_increase_year"] = min(rec.get("birth_rate_year") or 0, rec.get("death_rate_year") or 0) or None
# exports in a year with no total: goods plus services, when both are known (e.g. Nigeria)
for iso, g in series["goods_exports_usd"].items():
    sv = series["services_exports_usd"].get(iso)
    if not sv:
        continue
    ex = series["exports_usd"].setdefault(iso, [None] * len(YEARS))
    for i in range(len(YEARS)):
        if ex[i] is None and g[i] is not None and sv[i] is not None:
            ex[i] = float(f"{g[i] + sv[i]:.4g}")
    rec = countries.get(iso)
    if rec is not None and rec.get("exports_usd") is None:
        for i in range(len(YEARS) - 1, -1, -1):
            if ex[i] is not None and YEARS[i] >= 2010:
                rec["exports_usd"] = ex[i]; rec["exports_usd_year"] = YEARS[i]
                break
# measures whose latest value comes from their yearly history (new with the Charts view)
for f in ("goods_exports_usd", "services_exports_usd", "gas_elec_pct", "oil_elec_pct", "other_renew_elec_pct", "elec_twh", "gdp_usd", *SDG_WB_CODES):
    for iso, vals in series[f].items():
        rec = countries.get(iso)
        if not rec:
            continue
        for i in range(len(vals) - 1, -1, -1):
            if vals[i] is not None and YEARS[i] >= 2010:
                rec[f] = vals[i]; rec[f + "_year"] = YEARS[i]
                break
# --- 14c. SDG tracker: is each country on track to meet each goal by 2030? ---
# Inspired by the trend method of the Sustainable Development Report (SDSN): for each measure we compare the speed of
# change since about 2015 with the speed needed to reach the 2030 target. Targets: official SDG targets where they are
# numbers, otherwise the "goal achieved" thresholds used by the SDSN, or widely used ones (noted in filters.js).
SDG_TARGETS = {  # goal: [(field, target, "max" = at most / "min" = at least)]
    1: [("extreme_poverty", 3, "max")],
    2: [("undernourishment", 7.5, "max"), ("stunting", 7.5, "max")],
    3: [("maternal_mortality", 70, "max"), ("under5_mortality", 25, "max"), ("neonatal_mortality", 12, "max"),
        ("tb_incidence", 10, "max"), ("life_expectancy", 80, "min"), ("adolescent_births", 25, "max")],
    4: [("primary_completion", 95, "min"), ("lower_secondary_completion", 90, "min")],
    5: [("women_parliament", 40, "min")],
    6: [("basic_water", 98, "min"), ("basic_sanitation", 95, "min")],
    7: [("electricity", 98, "min"), ("clean_cooking", 85, "min")],
    8: [("unemployment", 5, "max")],
    9: [("internet", 80, "min"), ("rnd_pct", 1.5, "min")],
    10: [("gini", 30, "max")],
    11: [("pm25", 10, "max")],
    13: [("co2_per_capita", 2, "max")],
    15: [("protected_land_pct", 30, "min")],
    16: [("homicides", 1.5, "max")],
}  # goals 12, 14 and 17 are left out: there is no good yearly data for every country
SDG_NAMES = {1: "No poverty", 2: "Zero hunger", 3: "Good health and well-being", 4: "Quality education", 5: "Gender equality",
    6: "Clean water and sanitation", 7: "Affordable and clean energy", 8: "Decent work and economic growth",
    9: "Industry, innovation and infrastructure", 10: "Reduced inequalities", 11: "Sustainable cities and communities",
    13: "Climate action", 15: "Life on land", 16: "Peace, justice and strong institutions"}
SDG_STATUS = ["Achieved", "On track", "Improving too slowly", "Stagnating", "Getting worse"]
def sdg_point(vals, lo, hi):
    """The latest value in years lo..hi (newest first), as (year, value)."""
    for y in range(hi, lo - 1, -1):
        v = vals[y - YEARS[0]]
        if v is not None:
            return y, v
    return None
def sdg_status(field, iso, target, way):
    vals = series.get(field, {}).get(iso)
    if not vals:
        return None
    now = sdg_point(vals, 2015, YEARS[-1])
    if not now:
        return None
    y1, v1 = now
    good = (lambda v: v <= target) if way == "max" else (lambda v: v >= target)
    if good(v1):
        return 0, v1, y1
    base = sdg_point(vals, 2010, min(2016, y1 - 3))
    if not base:
        return None  # not achieved, and no earlier figure to show the direction
    y0, v0 = base
    sign = -1 if way == "max" else 1
    speed = sign * (v1 - v0) / (y1 - y0)            # improvement per year (positive = better)
    needed = sign * (target - v1) / max(1, 2030 - y1)  # improvement per year still needed
    if speed >= needed:
        return 1, v1, y1
    if speed >= 0.5 * needed:
        return 2, v1, y1
    if speed > 0:
        return 3, v1, y1
    return 4, v1, y1
for iso, rec in countries.items():
    detail, goal_status = {}, {}
    for goal, inds in SDG_TARGETS.items():
        sts = []
        for field, target, way in inds:
            r = sdg_status(field, iso, target, way)
            if r:
                sts.append(r[0])
                detail.setdefault(str(goal), []).append([field, r[1], r[2], r[0]])
        if sts:
            goal_status[goal] = max(sts)  # a goal is only as good as its weakest measure
    if not goal_status:
        continue
    for goal, st in goal_status.items():
        rec[f"sdg{goal}_status"] = SDG_STATUS[st]
    rec["sdg_detail"] = detail
    rec["sdg_measured"] = len(goal_status)
    rec["sdg_achieved"] = sum(1 for s in goal_status.values() if s == 0)
    rec["sdg_on_track"] = sum(1 for s in goal_status.values() if s <= 1)
    rec["sdg_on_track_pct"] = round(100 * rec["sdg_on_track"] / len(goal_status))
    rec["sdg_goals_on_track"] = [f"{g} · {SDG_NAMES[g]}" for g, s in goal_status.items() if s <= 1]
    for f in ("sdg_measured", "sdg_achieved", "sdg_on_track", "sdg_on_track_pct"):
        rec[f + "_year"] = 2025
print("SDG tracker:", sum(1 for r in countries.values() if r.get("sdg_measured")), "countries")
# refugee flows between countries for every year (Sankey chart): {years, flows: {year: [[from, to, people], ...]}}
if os.path.exists(raw("refugee_flows_yearly.csv")):
    fy = {}
    for r in csv.DictReader(open(raw("refugee_flows_yearly.csv"), encoding="utf-8")):
        if int(r["people"]) >= 1000 and r["from"] in countries and r["to"] in countries:
            fy.setdefault(r["year"], []).append([r["from"], r["to"], int(r["people"])])
    with open(os.path.join(ROOT, "refugee_flows_years.json"), "w", encoding="utf-8") as f:
        json.dump({"years": sorted(int(y) for y in fy), "flows": fy}, f, separators=(",", ":"))
    print(f"Wrote refugee flows for {len(fy)} years")
# refugee counts: a country with no row in a year it reports nothing for is left blank, not zero
# written by hand so decimals stay short: 1.779e+13 rather than 17790000000000.0
def num_json(v):
    if v is None:
        return "null"
    if isinstance(v, bool) or isinstance(v, int):
        return str(int(v))
    t = format(v, ".4g")
    return t.replace("e+0", "e").replace("e+", "e").replace("e-0", "e-")
with open(os.path.join(ROOT, "timeseries.json"), "w", encoding="utf-8") as f:
    f.write('{"years":' + json.dumps(YEARS, separators=(",", ":")) + ',"series":{')
    f.write(",".join(json.dumps(k) + ":{" + ",".join(json.dumps(iso) + ":[" + ",".join(num_json(v) for v in vals) + "]" for iso, vals in s.items()) + "}" for k, s in series.items()))
    f.write('},"sparse":' + json.dumps(sparse, separators=(",", ":")) + "}")
print("Wrote timeseries.json:", {k: len(v) for k, v in series.items()})

# --- 14b. Population pyramids (World Bank / UN WPP): % of the whole population in each 5-year age group ---
# pyramids.json: {"ages": [...], "data": {iso3: {year: [male 0-4 .. 80+, female 0-4 .. 80+]}}}, every 5 years plus the latest
pyr = {}
if os.path.exists(raw("pyramids.csv")):
    prow = list(csv.DictReader(open(raw("pyramids.csv"), encoding="utf-8")))
    latest_y = {}
    for r in prow:
        latest_y[r["iso3"]] = max(latest_y.get(r["iso3"], 0), int(r["year"]))
    for r in prow:
        iso, y = r["iso3"], int(r["year"])
        if iso not in countries or not (y % 5 == 0 or y == latest_y[iso]):
            continue
        fs = float(r["female_pct"])
        ages = [k[1:] for k in r if k.startswith("m")]
        m = [round(float(r["m" + a]) * (100 - fs) / 100, 2) for a in ages]
        fe = [round(float(r["f" + a]) * fs / 100, 2) for a in ages]
        pyr.setdefault(iso, {})[y] = m + fe
    with open(os.path.join(ROOT, "pyramids.json"), "w", encoding="utf-8") as f:
        json.dump({"ages": ["0–4", "5–9", "10–14", "15–19", "20–24", "25–29", "30–34", "35–39", "40–44", "45–49", "50–54",
                            "55–59", "60–64", "65–69", "70–74", "75–79", "80+"], "data": pyr}, f, separators=(",", ":"))
    print(f"Wrote pyramids.json for {len(pyr)} countries")

# --- 15. Physical geography (physical_countries.json, built by make_physical.py) ---
if os.path.exists(raw("physical_countries.json")):
    phys = json.load(open(raw("physical_countries.json"), encoding="utf-8"))
    for iso, facts in phys.items():
        if iso not in countries:
            continue
        rec = countries[iso]
        rec.update(facts)
        if rec.get("lowest_m") is not None:
            rec["below_sea_level"] = rec["lowest_m"] < 0
        if rec.get("coastline_km") is not None and rec.get("area_km2"):
            rec["coast_ratio"] = round(100 * rec["coastline_km"] / rec["area_km2"], 2)
        for k in ("rivers", "lakes"):
            if k in rec:
                rec[k] = sorted(set(rec[k]))
    for rec in countries.values():
        rec["island"] = bool(rec.get("no_land_borders"))
        rec["no_coast"] = bool(rec.get("landlocked"))
        if rec["sovereign"]:
            for k in ("volcanoes", "volcanoes_active", "quakes", "quakes7", "eruptions_1900"):
                rec.setdefault(k, 0)
            rec.setdefault("glacier_pct", 0)
            rec.setdefault("hazards", [])

# --- Survey years: most survey measures for a country come from the same fieldwork year, so store that year once
# per source ("sy_att", "sy_wgm", "sy_wrp") and only keep a measure's own *_year when it differs (app.js fills them back in)
from collections import Counter
for rec in countries.values():
    for pre in ("att", "wgm", "wrp", "ab", "pew"):
        ys = [v for k, v in rec.items() if k.startswith(pre + "_") and k.endswith("_year")]
        if not ys:
            continue
        common = Counter(ys).most_common(1)[0][0]
        rec["sy_" + pre] = common
        for k in [k for k in rec if k.startswith(pre + "_") and k.endswith("_year") and rec[k] == common]:
            del rec[k]

# --- Write ---
out = sorted(countries.values(), key=lambda r: r["name"])
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
print(f"Wrote {len(out)} records to {OUT}")
for k, v in unmatched.items():
    print(f"  unmatched in {k} ({len(v)}): {', '.join(map(str, v))}", file=sys.stderr)
