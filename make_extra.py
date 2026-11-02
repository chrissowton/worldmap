#!/usr/bin/env python3
"""
More measures (hazards, food, water, forests, footprint, urbanisation, population projections, aid and debt)
-> extra.csv (field, iso3, year, value, wave) and cities_growth.json

wave 0 = a yearly series 1960-2025 (stored in full in timeseries.json)
wave 1 = stored sparsely (any years, including UN projections into the future)
wave 2 = latest figure only (no history)

Put the downloads in one folder and run:  python3 make_extra.py path/to/folder
Files used (any you leave out are skipped):
  worldriskindex-trend.csv                                   WorldRiskReport, via HDX (data.humdata.org/dataset/worldriskindex)
  annual-deaths-from-all-natural-disasters.csv               EM-DAT via Our World in Data
  IDMC_Internal_Displacement_Conflict-Violence_Disasters.xlsx IDMC Global Internal Displacement Database
  annual-temperature-anomalies.csv                           Copernicus ERA5 via Our World in Data
  2026.xlsx (Global Hunger Index 2026 data)                  globalhungerindex.org
  daily-per-capita-caloric-supply.csv                        FAO via Our World in Data
  water-withdrawals-per-capita.csv, agricultural-water-as-a-share-of-total-water-withdrawals.csv   FAO AQUASTAT via OWID
  tree-cover-loss.csv                                        Global Forest Watch via Our World in Data
  NFBA 2026 Public Data Package*.xlsx                        Global Footprint Network / FoDaFo (CC BY-SA 4.0)
  WUP2025-DB-National-Definitions-Population-Data.csv.gz     UN World Urbanization Prospects 2025
  WUP2025-DB-DEGURBA-Level1-Population-Surface-Data.csv.gz
  WUP2025-DB-DEGURBA-Population-by-size-class-of-cities.csv.gz
  WUP2025-DB-DEGURBA-Cities-Population-Surface-Data*.gz      (-> cities_growth.json)
  WPP2024_GEN_F01_DEMOGRAPHIC_INDICATORS_COMPACT.xlsx        UN World Population Prospects 2024
  API_DT.DOD.DECT.GN.ZS_*.csv, API_DT.ODA.ODAT.PC.ZS_*.csv   World Bank
"""
import csv
import glob
import gzip
import json
import os
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.abspath(__file__))
rows = json.load(open(os.path.join(ROOT, "countries.json"), encoding="utf-8"))
ISO = {r["iso3"] for r in rows}
AREA = {r["iso3"]: r.get("area_km2") for r in rows}
NAMES = {}
for r in rows:
    NAMES[r["name"].lower()] = r["iso3"]
    for a in r.get("aliases") or []:
        NAMES.setdefault(str(a).lower(), r["iso3"])
NAME_FIX = {"bosnia & herzegovina": "BIH", "congo, dem. rep.": "COD", "dem. rep. of the congo": "COD", "democratic republic of the congo": "COD",
            "congo (republic of)": "COG", "congo, rep.": "COG", "republic of congo": "COG", "côte d'ivoire": "CIV", "cote d'ivoire": "CIV",
            "türkiye": "TUR", "turkey": "TUR", "korea (dpr)": "PRK", "korea, dem. people's rep.": "PRK", "korea, democratic people's republic of": "PRK",
            "korea, republic of": "KOR", "republic of korea": "KOR", "lao pdr": "LAO", "lao people's democratic republic": "LAO", "laos": "LAO",
            "viet nam": "VNM", "russian federation": "RUS", "syrian arab republic": "SYR", "iran (islamic republic of)": "IRN", "iran, islamic rep.": "IRN",
            "venezuela (bolivarian republic of)": "VEN", "bolivia (plurinational state of)": "BOL", "tanzania, united republic of": "TZA", "united republic of tanzania": "TZA",
            "eswatini": "SWZ", "cabo verde": "CPV", "czechia": "CZE", "moldova (republic of)": "MDA", "republic of moldova": "MDA", "timor-leste": "TLS",
            "gambia": "GMB", "the gambia": "GMB", "united kingdom of great britain and northern ireland": "GBR", "united states of america": "USA",
            "micronesia (federated states of)": "FSM", "kyrgyz republic": "KGZ", "slovak republic": "SVK", "north macedonia": "MKD", "brunei darussalam": "BRN",
            "palestine, state of": "PSE", "state of palestine": "PSE", "sao tome and principe": "STP", "são tomé and príncipe": "STP", "guinea-bissau": "GNB",
            "bolivia (plurinat. state of)": "BOL", "moldova (rep. of)": "MDA", "tanzania (united rep. of)": "TZA", "trinidad & tobago": "TTO",
            "venezuela (boliv. rep. of)": "VEN", "congo, democratic republic of": "COD"}
def iso_of(name):
    n = str(name or "").strip().lower().replace("\n", " ")
    return NAME_FIX.get(n) or NAMES.get(n)

OUT = []  # field, iso3, year, value, wave
def add(field, iso, year, value, wave, nd=3):
    if iso in ISO and value is not None:
        try:
            v = float(value)
        except (TypeError, ValueError):
            return
        if v != v:
            return
        OUT.append([field, iso, int(year), round(v, nd), wave])

def find(folder, pattern):
    hits = glob.glob(os.path.join(folder, pattern))
    return hits[0] if hits else None
def fnum(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None

def main(folder):
    # ---------- WorldRiskIndex 2000-2026 ----------
    p = find(folder, "*worldriskindex*trend*.csv")
    if p:
        for r in csv.DictReader(open(p, encoding="utf-8-sig")):
            iso, y = r["ISO3.Code"], int(r["Year"])
            for col, f in (("W", "wri_risk"), ("E", "wri_exposure"), ("V", "wri_vulnerability"), ("S", "wri_susceptibility"), ("C", "wri_coping"), ("A", "wri_adaptive")):
                add(f, iso, y, fnum(r[col]), 1, 2)
        print("WorldRiskIndex done")

    # ---------- WPP 2024: population and projections (needed below for rates) ----------
    pop = {}  # (iso, year) -> people
    p = find(folder, "*WPP2024*DEMOGRAPHIC*COMPACT*.xlsx")
    if p:
        import openpyxl
        wb = openpyxl.load_workbook(p, read_only=True, data_only=True)
        cols = {"pop_un": 12, "fertility_un": 26, "life_exp_un": 34, "median_age_un": 17, "natural_change_un": 19, "net_migration_un": 64, "pop_growth_un": 21}
        for sheet in ("Estimates", "Medium variant"):
            ws = wb[sheet]
            for i, r in enumerate(ws.iter_rows(values_only=True)):
                if i < 17 or not r[5] or r[8] != "Country/Area":
                    continue
                iso, y = r[5], int(r[10])
                if r[12] not in (None, "..."):
                    pop[(iso, y)] = float(r[12]) * 1000
                # every 5 years, plus 2023 (the last estimate) and 2024
                if y % 5 and y not in (2023, 2024):
                    continue
                for f, c in cols.items():
                    v = fnum(r[c])
                    if v is None:
                        continue
                    if f == "pop_un":
                        v = round(v * 1000)
                    add(f, iso, y, v, 1, 2)
        print("WPP done")

    # ---------- Disaster deaths (EM-DAT via OWID): deaths in the 10 years up to each year ----------
    p = find(folder, "annual-deaths-from-all-natural-disasters.csv")
    if p:
        by = defaultdict(dict)
        types = {"All disasters": "dis_deaths", "Earthquakes": "quake_deaths", "Floods": "flood_deaths", "Storms": "storm_deaths", "Droughts": "drought_deaths",
                 "Extreme temperatures": "heat_deaths"}
        for r in csv.DictReader(open(p, encoding="utf-8-sig")):
            if r["Code"] in ISO:
                by[r["Code"]][int(r["Year"])] = {f: fnum(r[c]) or 0 for c, f in types.items()}
        for iso, yrs in by.items():
            for y in range(1960, 2026):
                for f in types.values():
                    tot = sum(yrs.get(yy, {}).get(f, 0) for yy in range(y - 9, y + 1))
                    add(f + "_10y", iso, y, tot, 0, 0)
                    if f == "dis_deaths":
                        pp = pop.get((iso, y)) or pop.get((iso, min(y, 2023)))
                        if pp:
                            add("dis_deaths_10y_pm", iso, y, tot / pp * 1e6, 0, 1)
        print("Disaster deaths done")

    # ---------- IDMC displacement 2008-2025 ----------
    p = find(folder, "*IDMC*Internal_Displacement*.xlsx")
    if p:
        import openpyxl
        wb = openpyxl.load_workbook(p, read_only=True, data_only=True)
        ws = wb.worksheets[0]
        hdr = None
        for r in ws.iter_rows(values_only=True):
            if hdr is None:
                hdr = [str(h or "") for h in r]
                ci = {h: i for i, h in enumerate(hdr)}
                cdis = next(i for h, i in ci.items() if h.startswith("Disaster Internal Displacements") and "Raw" not in h)
                ccon = next(i for h, i in ci.items() if h.startswith("Conflict Internal Displacements") and "Raw" not in h)
                continue
            if not r or r[0] is None or r[2] is None:
                continue
            g = lambda i: r[i] if i < len(r) else None
            iso, y = r[0], int(r[2])
            dis = fnum(g(cdis)) or 0
            add("dis_displaced", iso, y, dis, 0, 0)
            pp = pop.get((iso, y)) or pop.get((iso, min(y, 2024)))
            if pp:
                add("dis_displaced_per1000", iso, y, dis / pp * 1000, 0, 2)
            if fnum(g(ccon)) is not None:
                add("conf_displaced", iso, y, fnum(g(ccon)), 0, 0)
        print("IDMC done")

    # ---------- Simple OWID series (Entity, Code, Year, value) ----------
    def owid(fname, field, nd=2, scale=1.0, wave=0):
        p = find(folder, fname)
        if not p:
            return
        for r in csv.reader(open(p, encoding="utf-8-sig")):
            if r[0] == "Entity" or len(r) < 4:
                continue
            add(field, r[1], int(r[2]), (fnum(r[3]) or 0) * scale if r[3] else None, wave, nd)
        print(field, "done")
    owid("annual-temperature-anomalies.csv", "temp_anomaly", 2)
    owid("daily-per-capita-caloric-supply.csv", "calories", 0)
    owid("water-withdrawals-per-capita.csv", "water_pc", 0)
    owid("agricultural-water-as-a-share-of-total-water-withdrawals.csv", "water_agri_pct", 1)
    p = find(folder, "tree-cover-loss.csv")
    if p:
        for r in csv.reader(open(p, encoding="utf-8-sig")):
            if r[0] == "Entity" or not r[3]:
                continue
            iso, y, ha = r[1], int(r[2]), fnum(r[3])
            add("tree_loss_ha", iso, y, ha, 0, 0)
            if AREA.get(iso):
                add("tree_loss_pct", iso, y, ha / (AREA[iso] * 100) * 100, 0, 3)
        print("tree loss done")

    # ---------- Global Hunger Index 2026 (scores for 2000, 2006, 2012, 2018, 2026) ----------
    p = find(folder, "2026.xlsx") or find(folder, "*GHI*2026*.xlsx")
    if p:
        import openpyxl
        wb = openpyxl.load_workbook(p, read_only=True, data_only=True)
        ws = next(w for w in wb.worksheets if w.title.strip().startswith("GHI Scores"))
        miss = []
        for r in ws.iter_rows(values_only=True):
            if not r[0] or not isinstance(r[1], (int, float, str)) or str(r[0]).startswith(("Country", "2000")):
                continue
            iso = iso_of(r[0])
            if not iso:
                miss.append(r[0]); continue
            for y, v in zip((2000, 2006, 2012, 2018, 2026), r[1:6]):
                if v is None or v == "—" or v == "-":
                    continue
                v = 4.9 if str(v).strip().startswith("<") else fnum(v)
                add("ghi", iso, y, v, 1, 1)
        if miss:
            print("GHI names not matched:", miss[:20])
        print("GHI done")

    # ---------- Ecological footprint 2023 ----------
    p = find(folder, "NFBA*.xlsx")
    if p:
        import openpyxl
        wb = openpyxl.load_workbook(p, read_only=True, data_only=True)
        ws = wb["Country Results (2023)"]
        miss = []
        for i, r in enumerate(ws.iter_rows(values_only=True)):
            if i < 20 or not r[0] or r[0] in ("Country", "World"):
                continue
            iso = iso_of(r[0])
            if not iso:
                if len(str(r[0])) < 40 and not str(r[0]).endswith(":"):
                    miss.append(r[0])
                continue
            for f, c in (("eco_footprint", 23), ("biocapacity", 29), ("eco_reserve", 30), ("earths_needed", 31)):
                add(f, iso, 2023, fnum(r[c]), 2, 2)  # one year only: no history to show
        if miss:
            print("Footprint names not matched:", miss[:30])
        print("Footprint done")

    # ---------- World Urbanization Prospects 2025 ----------
    def wup(pattern):
        p = find(folder, pattern)
        return (r for r in csv.DictReader(gzip.open(p, "rt", encoding="utf-8-sig")) if (r.get("Year") or "").isdigit()) if p else None
    rd = wup("*National-Definitions-Population-Data*.gz")
    if rd:
        for r in rd:
            y = int(r["Year"])
            if r["Category"] == "Urban" and r["LocTypeName"] == "Country/Area" and (y % 5 == 0 or y in (2024, 2025)):
                add("urban_pct_un", r["ISO3_Code"], y, fnum(r["percPop"]), 1, 1)
        print("WUP national done")
    rd = wup("*DEGURBA-Level1-Population-Surface-Data*.gz")
    if rd:
        cat = {"Cities": "pct_cities_un", "Towns": "pct_towns_un", "Towns and semi-dense areas": "pct_towns_un", "Rural": "pct_rural_un"}
        seen = set()
        for r in rd:
            y = int(r["Year"])
            if r["LocTypeName"] == "Country/Area" and (y % 5 == 0 or y == 2025):
                f = cat.get(r["Category"])
                if f:
                    add(f, r["ISO3_Code"], y, fnum(r["percPop"]), 1, 1); seen.add(r["Category"])
        print("WUP DEGURBA done", sorted(seen))
    rd = wup("*Population-by-size-class-of-cities*.gz")
    if rd:
        big, mega = defaultdict(float), defaultdict(float)
        for r in rd:
            if r["LocTypeName"] != "Country/Area":
                continue
            y = int(r["Year"])
            if not (y % 5 == 0 or y == 2025):
                continue
            v = (fnum(r["Pop"]) or 0) * 1000  # countries' figures are in thousands
            big[(r["ISO3_Code"], y)] += 0
            if r["Category"] in ("1-2.5 millions", "2.5-5 millions", "5-10 millions", ">10 millions"):
                big[(r["ISO3_Code"], y)] += v
            if r["Category"] == ">10 millions":
                mega[(r["ISO3_Code"], y)] += v
        for (iso, y), v in big.items():
            pp = pop.get((iso, y))
            if pp:
                add("pct_million_cities", iso, y, v / pp * 100, 1, 1)
                add("pct_megacities", iso, y, mega.get((iso, y), 0) / pp * 100, 1, 1)
        print("WUP size classes done")
    p = find(folder, "*DEGURBA-Cities-Population-Surface-Data*")
    if p:
        cities = {}
        for r in csv.DictReader(gzip.open(p, "rt", encoding="utf-8-sig")):
            if not (r.get("Year") or "").isdigit():
                continue
            y = int(r["Year"])
            if y % 5 or y < 1975 or r["ISO3_Code"] not in ISO:
                continue
            c = cities.setdefault(r["City_Code"], {"n": r["City_Name"], "i": r["ISO3_Code"], "cap": r["Capital"] == "1", "p": {}})
            c["p"][y] = fnum(r["Pop"])
            if y == 2025:
                c["lat"], c["lon"] = round(float(r["PWCent_Latitude"]), 3), round(float(r["PWCent_Longitude"]), 3)
        years = list(range(1975, 2051, 5))
        keep = [c for c in cities.values() if "lat" in c and max((v or 0) for v in c["p"].values()) >= 300]
        keep.sort(key=lambda c: -(c["p"].get(2025) or 0))
        out = {"years": years, "c": [[c["n"], c["i"], c["lat"], c["lon"], 1 if c["cap"] else 0, [round(c["p"].get(y) or 0) for y in years]] for c in keep]}
        json.dump(out, open(os.path.join(ROOT, "cities_growth.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        print(f"Wrote {len(keep)} cities to cities_growth.json (population in thousands)")

    # ---------- World Bank: debt and aid ----------
    for pat, f, nd in (("API_DT.DOD.DECT.GN.ZS_*.csv", "debt_gni_pct", 1), ("API_DT.ODA.ODAT.PC.ZS_*.csv", "aid_pc", 1)):
        p = find(folder, pat) or find(folder, "*/" + pat)
        if not p:
            continue
        lines = open(p, encoding="utf-8-sig").read().splitlines()[4:]
        rd = csv.reader(lines)
        hdr = next(rd)
        for r in rd:
            for j in range(4, len(hdr)):
                if hdr[j].isdigit() and j < len(r) and r[j]:
                    add(f, r[1], int(hdr[j]), fnum(r[j]), 0, nd)
        print(f, "done")

    # ---------- Corruption Perceptions Index 2012-2025 (Transparency International; "strict" Excel file) ----------
    p = find(folder, "CPI*Results*.xlsx")
    if p:
        import zipfile, re
        import xml.etree.ElementTree as ET
        z = zipfile.ZipFile(p)
        N = "{http://purl.oclc.org/ooxml/spreadsheetml/main}"
        if b"purl.oclc.org" not in z.read("xl/workbook.xml"):
            N = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
        ss = ["".join(t.text or "" for t in si.iter(N + "t")) for si in ET.fromstring(z.read("xl/sharedStrings.xml")).iter(N + "si")]
        names = [x.get("name") for x in ET.fromstring(z.read("xl/workbook.xml")).iter(N + "sheet")]
        sheet = "xl/worksheets/sheet%d.xml" % (next(i for i, n in enumerate(names) if n.startswith("CPI Timeseries")) + 1)
        col = lambda ref: re.match(r"[A-Z]+", ref).group(0)
        hdr = None
        for row in ET.fromstring(z.read(sheet)).iter(N + "row"):
            cells = {}
            for c in row.iter(N + "c"):
                v = c.find(N + "v")
                if v is None:
                    continue
                cells[col(c.get("r"))] = ss[int(v.text)] if c.get("t") == "s" else v.text
            if hdr is None:
                if "ISO3" in cells.values():
                    hdr = {k: v for k, v in cells.items()}
                continue
            iso = next((cells.get(k) for k, v in hdr.items() if v == "ISO3"), None)
            for k, h in hdr.items():
                m = re.match(r"CPI score (\d{4})", h or "")
                if m and cells.get(k) not in (None, ""):
                    add("cpi", iso, int(m.group(1)), fnum(cells[k]), 0, 0)
        print("CPI done")

    # ---------- RSF World Press Freedom Index (semicolon CSV, decimal commas, Latin-1) ----------
    p = find(folder, "*20[23][0-9].csv")
    if p:
        txt = open(p, "rb").read().decode("latin-1")
        rd = csv.reader(txt.splitlines(), delimiter=";")
        hdr = next(rd)
        if "Score N-1" in hdr or any(h.startswith("Score 20") for h in hdr):
            ci = {h: i for i, h in enumerate(hdr)}
            sc = next(h for h in hdr if h.startswith("Score 20"))
            yr = int(sc.split()[-1])
            for r in rd:
                if len(r) < len(hdr) - 2:
                    continue
                num = lambda x: fnum(x.replace(",", ".")) if x else None
                add("press_freedom", r[ci["ISO"]], yr, num(r[ci[sc]]), 1, 1)
                if "Score N-1" in ci:
                    add("press_freedom", r[ci["ISO"]], yr - 1, num(r[ci["Score N-1"]]), 1, 1)
            print("RSF done")

    # ---------- More Our World in Data files ----------
    p = find(folder, "deaths-in-armed-conflicts-by-country.csv")
    if p:
        for r in csv.reader(open(p, encoding="utf-8-sig")):
            if r[0] == "Entity" or not r[3] or not r[2].isdigit():
                continue
            iso, y, v = r[1], int(r[2]), fnum(r[3])
            add("conflict_deaths", iso, y, v, 0, 0)
            pp = pop.get((iso, y)) or pop.get((iso, min(y, 2024)))
            if pp:
                add("conflict_deaths_per100k", iso, y, v / pp * 1e5, 0, 2)
        print("conflict deaths done")
    owid("share-of-births-outside-marriage.csv", "births_outside_marriage", 1)
    owid("mismanaged-plastic-waste-per-capita.csv", "plastic_mismanaged", 2, wave=2)
    owid("women-married-by-age-15.csv", "married_by_15", 1, wave=2)

    # ---------- UN Tourism: inbound overnight visitors (tourists) ----------
    p = find(folder, "UN_Tourism*inbound*.xlsx")
    if p:
        import openpyxl
        wb = openpyxl.load_workbook(p, read_only=True, data_only=True)
        m49 = {int(r["num"]): r["iso3"] for r in rows if str(r.get("num") or "").isdigit()}
        best = {}
        for i, r in enumerate(wb["Data"].iter_rows(values_only=True)):
            if i == 0 or not r[0]:
                continue
            code = r[0]
            if code not in ("INBD_TRIP_TOTL_TOTL_TOUR", "INBD_TRIP_TOTL_TOTL_VSTR") or r[8] is None:
                continue
            iso = m49.get(int(r[3])) if str(r[3]).isdigit() else None
            if not iso:
                continue
            # tourists (overnight visitors) where reported, otherwise all visitors
            k = (iso, int(r[7]))
            if code.endswith("TOUR") or k not in best:
                best[k] = float(r[8]) * 1000
        # only recent years: earlier ones are already in the World Bank series, and 2020-2022 were COVID years
        for (iso, y), v in best.items():
            if y >= 2023:
                add("tourists", iso, y, round(v), 0, 0)
        print("UN Tourism done")

    # ---------- Energy (Our World in Data energy dataset): rewrite energy_latest.csv ----------
    p = find(folder, "owid-energy-data.csv")
    if p:
        keep = ["energy_per_capita", "renewables_share_elec", "low_carbon_share_elec", "fossil_share_elec", "coal_share_elec", "nuclear_share_elec",
                "solar_share_elec", "wind_share_elec", "hydro_share_elec", "oil_production", "gas_production", "coal_production"]
        latest = {}
        for r in csv.DictReader(open(p, encoding="utf-8")):
            iso = r["iso_code"]
            if not iso or (iso.startswith("OWID") and iso != "OWID_KOS"):
                continue
            for k in keep:
                if r.get(k):
                    if (iso, k) not in latest or int(r["year"]) >= latest[(iso, k)][0]:
                        latest[(iso, k)] = (int(r["year"]), float(r[k]))
        # small producers' figures stop in 2016: a zero then is still a zero now
        for (iso, k), (y, v) in list(latest.items()):
            if k.endswith("_production") and v == 0 and (iso, "energy_per_capita") in latest:
                latest[(iso, k)] = (max(y, latest[(iso, "energy_per_capita")][0]), v)
        with open(os.path.join(ROOT, "energy_latest.csv"), "w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(["iso3", "indicator", "year", "value"])
            for (iso, k), (y, v) in sorted(latest.items()):
                w.writerow([iso, k, y, f"{v:.3f}"])
        print("energy_latest.csv rewritten")

    out = os.path.join(ROOT, "extra.csv")
    with open(out, "w", newline="", encoding="utf-8") as fh:
        fh.write("# Built by make_extra.py from the downloads listed in its notes.\n")
        w = csv.writer(fh)
        w.writerow(["field", "iso3", "year", "value", "wave"])
        w.writerows(OUT)
    print(f"Wrote {len(OUT)} rows for {len({o[0] for o in OUT})} measures to {out}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
