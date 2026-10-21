#!/usr/bin/env python3
"""
Download the latest raw source files into this folder.

    pip install pyreadr pandas      # only needed for the V-Dem step
    python3 fetch_raw.py
    python3 build_data.py

The repository already contains a copy of every raw file, so you only need
this when you want to refresh the data.
"""
import csv
import io
import os
import shutil
import tempfile
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


def get(url):
    print("  downloading", url)
    with urllib.request.urlopen(url) as r:
        return r.read()


def main():
    for name, url in FILES.items():
        open(os.path.join(RAW, name), "wb").write(get(url))

    # CO2: keep only the columns and years the site uses
    rows = csv.DictReader(io.StringIO(get(CO2_URL).decode("utf-8")))
    with open(os.path.join(RAW, "co2.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["country", "year", "iso_code", "co2_per_capita"])
        for r in rows:
            if r["iso_code"] and r["co2_per_capita"] and int(r["year"]) >= 2010:
                w.writerow([r["country"], r["year"], r["iso_code"], r["co2_per_capita"]])

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
