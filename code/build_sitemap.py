#!/usr/bin/env python3
"""Build sitemap.xml for the Boundless Generator Archive: home + families + every ?gen= output."""
import gzip, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://justinahiggins614-cmyk.github.io/signature-boundless-generators/"
TODAY = "2026-10-02"

def esc(u):
    return u.replace("&", "&amp;")

urls = [BASE]
fams = json.loads(open(os.path.join(ROOT, "code", "families.json")).read()) if os.path.exists(os.path.join(ROOT, "code", "families.json")) else []
if not fams:
    import subprocess
    fams = json.loads(subprocess.run(["node", "code/engine.js", "families"], capture_output=True, text=True, cwd=ROOT).stdout)
for f in fams:
    urls.append(BASE + "?fam=" + f["key"])

manifest = json.load(open(os.path.join(ROOT, "data", "manifest.json")))
for c in manifest["chunks"]:
    with gzip.open(os.path.join(ROOT, "data", "chunks", c), "rt") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            r = json.loads(line)
            urls.append(BASE + "?gen=" + r[1] + "-" + str(r[2]))

with open(os.path.join(ROOT, "sitemap.xml"), "w") as fh:
    fh.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
    for u in urls:
        fh.write("<url><loc>%s</loc><lastmod>%s</lastmod></url>\n" % (esc(u), TODAY))
    fh.write("</urlset>\n")
print("sitemap URLs:", len(urls))
