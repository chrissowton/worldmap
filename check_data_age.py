#!/usr/bin/env python3
"""
Yearly check: which measures have data that is getting old?
Reads countries.json (made by build_data.py) and the source list in filters.js, and prints a Markdown report of
measures whose most common year is more than two years ago. Run by .github/workflows/data-check.yml once a year,
which turns the report into a GitHub issue. You can also run it yourself:  python3 check_data_age.py
"""
import collections
import datetime
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
rows = json.load(open(os.path.join(ROOT, "countries.json"), encoding="utf-8"))
filters_js = open(os.path.join(ROOT, "filters.js"), encoding="utf-8").read()
labels = dict(re.findall(r'num\("([a-z0-9_]+)",\s*"[^"]*",\s*"([^"]+)"', filters_js))
this_year = datetime.date.today().year
limit = this_year - 2

old = []
for key in sorted({k[:-5] for r in rows for k in r if k.endswith("_year")}):
    years = [r.get(key + "_year") for r in rows if isinstance(r.get(key + "_year"), (int, float)) and r.get(key) is not None]
    # years that are part of the fact itself (e.g. the year of the largest earthquake), not when the data was collected
    if len(years) < 20 or key in {"quake_max"}:
        continue
    common, _ = collections.Counter(int(y) for y in years).most_common(1)[0]
    if common < limit:
        old.append((common, key, labels.get(key, key), len(years)))

old.sort()
if not old:
    print(f"All measures have data from {limit} or later. Nothing to do this year.")
    sys.exit(0)
print(f"## Data more than two years old ({datetime.date.today():%B %Y})\n")
print(f"These measures' most common year is before {limit}. Check whether the source has newer figures, then run the build scripts again (see DATA.md).\n")
print("| Measure | Key | Most common year | Countries |\n|---|---|---|---|")
for common, key, label, n in old:
    print(f"| {label} | `{key}` | {common} | {n} |")
print("\nSurvey measures (World Values Survey, Pew, Afrobarometer…) only update when a new survey round is published, so some of these are expected.")
