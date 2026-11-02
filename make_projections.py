"""How certain are the UN's projections? (UN World Population Prospects 2024, probabilistic projections, CC BY 3.0 IGO)
Download from population.un.org/wpp/downloads (Probabilistic Projections):
  UN_PPP2024_Output_PopTot.xlsx (total population), UN_PPP2024_Output_e0.xlsx (life expectancy), UN_PPP2024_…_TFR.xlsx (fertility)
Usage: python3 make_projections.py <one or more of those .xlsx files>
Writes ranges_pop.json, ranges_e0.json and ranges_tfr.json: for the world, the continents and every country, every year
2024–2100, the lower 95%, lower 80%, median, upper 80% and upper 95% figures (population in thousands)."""
import json, os, sys
import openpyxl

ROOT = os.path.dirname(os.path.abspath(__file__))
SHEETS = ["Lower 95", "Lower 80", "Median", "Upper 80", "Upper 95"]
REGIONS = {"World": "World", "Africa": "Africa", "Asia": "Asia", "Europe": "Europe", "Oceania": "Oceania"}
KINDS = {"POPTOT": ("pop", 0), "E0": ("e0", 2), "TFR": ("tfr", 3)}
for path in sys.argv[1:]:
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    out = {"years": None, "loc": {}}
    kind = None
    for si, sh in enumerate(SHEETS):
        ws = wb[sh]
        ws.reset_dimensions()  # the files give the wrong size
        rows = list(ws.iter_rows(values_only=True))
        if kind is None:
            code = next((str(v) for r in rows[:15] for v in r if isinstance(v, str) and "/PPP/" in v), "")
            kind = next((KINDS[k] for k in KINDS if code.rstrip().endswith("/" + k)), None)
            if not kind:
                sys.exit(f"Can't tell what {path} is (looked for {code!r})")
        hi = next(i for i, r in enumerate(rows) if r and r[0] == "Index")
        hdr = rows[hi]
        ycols = [i for i, v in enumerate(hdr) if isinstance(v, (int, float)) and 1900 < v < 2200]
        out["years"] = [int(hdr[i]) for i in ycols]
        for r in rows[hi + 1:]:
            if not r or r[0] is None:
                continue
            name, iso, typ = r[2], r[5], r[8]
            key = iso if iso and typ == "Country/Area" else REGIONS.get(name) if typ in ("World", "Region") else None
            if not key:
                continue
            d = out["loc"].setdefault(key, [None] * len(SHEETS))
            nd = kind[1]
            d[si] = [(round(float(r[i]), nd) if nd else round(float(r[i]))) if r[i] not in (None, "", "...") else None for i in ycols]
    name = f"ranges_{kind[0]}.json"
    with open(os.path.join(ROOT, name), "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"{name}: {len(out['loc'])} places, {out['years'][0]}-{out['years'][-1]}")
