#!/usr/bin/env python3
"""
Bundle the site into one self-contained HTML file (data included), for
sharing as a single file, embedding, or offline use.

    python3 build_single.py            # writes dist/which-countries.html
    python3 build_single.py --fragment # body-only version for hosts that add their own <head>
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))


def read(p):
    return open(os.path.join(ROOT, p), encoding="utf-8").read()


def main():
    fragment = "--fragment" in sys.argv
    html = read("index.html")
    body = re.search(r"<!--APP-->(.*)<!--/APP-->", html, re.S).group(1)
    fonts = re.search(r'<link rel="stylesheet" href="(https://fonts[^"]+)">', html).group(1)
    cdn = re.findall(r'<script src="(https://cdnjs[^"]+)"></script>', html)
    css = read("style.css")
    # the flag font goes inside the file too
    import base64
    font = base64.b64encode(open(os.path.join(ROOT, "TwemojiCountryFlags.woff2"), "rb").read()).decode()
    css = css.replace('url("TwemojiCountryFlags.woff2")', f'url("data:font/woff2;base64,{font}")')
    data = read("countries.json")
    world = read("world-50m.json")
    cities = read("cities.json")
    flows = read("refugee_flows.json")
    timeseries = read("timeseries.json")
    features = read("features.json")
    pyramids = read("pyramids.json")
    physical = read("physical.json")
    rflows = read("refugee_flows_years.json")
    scripts = "\n".join(f'<script src="{u}"></script>' for u in cdn)
    inline = (
        f"<script>window.__COUNTRIES__={data};window.__WORLD__={world};window.__CITIES__={cities};window.__FLOWS__={flows};window.__TIMESERIES__={timeseries};window.__FEATURES__={features};window.__PYRAMIDS__={pyramids};window.__PHYSICAL__={physical};window.__RFLOWS__={rflows};</script>\n"
        f"<script>{read('filters.js')}</script>\n<script>{read('glossary.js')}</script>\n<script>{read('picker.js')}</script>\n<script>{read('physical.js')}</script>\n<script>{read('views.js')}</script>\n<script>{read('charts.js')}</script>\n<script>{read('quiz.js')}</script>\n<script>{read('app.js')}</script>\n<script>{read('ask.js')}</script>\n<script>{read('factfile.js')}</script>"
    )
    head = (
        f"<title>Which Countries?</title>\n"
        f'<link rel="stylesheet" href="{fonts}">\n<style>{css}</style>\n'
    )
    if fragment:
        out = head + body + scripts + "\n" + inline
    else:
        out = (
            '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            + head + "</head><body>" + body + scripts + "\n" + inline + "</body></html>"
        )
    os.makedirs(os.path.join(ROOT, "dist"), exist_ok=True)
    name = "which-countries-fragment.html" if fragment else "which-countries.html"
    path = os.path.join(ROOT, "dist", name)
    open(path, "w", encoding="utf-8").write(out)
    print(f"Wrote {path} ({len(out) // 1024} KB)")


if __name__ == "__main__":
    main()
