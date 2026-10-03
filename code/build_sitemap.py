#!/usr/bin/env python3
"""Build sitemap.xml for the Boundless Generator Archive: home + families + hubs + every ?gen= output.

Also refreshes the static hub pages (code/build_hubs.py) and re-stamps the
static count line in index.html, so the 2h generator drip (which runs this
script after seed.py) keeps feeds, hubs, and counts fresh automatically.

Usage: python3 code/build_sitemap.py
"""
import datetime, gzip, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://justinahiggins614-cmyk.github.io/signature-boundless-generators/"


def today_ny():
    try:
        from zoneinfo import ZoneInfo
        return datetime.datetime.now(ZoneInfo("America/New_York")).date().isoformat()
    except Exception:
        return datetime.date.today().isoformat()


TODAY = today_ny()

sys.path.insert(0, os.path.join(ROOT, "code"))
import build_hubs  # noqa: E402  (rebuilds hubs/<key>.html + hubs/index.html)


def esc(u):
    return u.replace("&", "&amp;")


def main():
    counts = build_hubs.main()
    total = sum(counts.values())

    urls = [BASE, BASE + "hubs/"]
    fams = build_hubs.families()
    for f in fams:
        urls.append(BASE + "?fam=" + f["key"])
        urls.append(BASE + "hubs/" + f["key"] + ".html")

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

    # re-stamp the static count line in index.html (assert-verified total)
    p = os.path.join(ROOT, "index.html")
    html = open(p).read()
    pat = re.compile(r'<p class="staticcount">.*?</p>')
    new = ('<p class="staticcount">%s fully-solved generator outputs on file across %d generator families, '
           'as of %s. Live count above.</p>' % (format(total, ","), len(fams), TODAY))
    assert pat.search(html), "staticcount marker missing"
    html = pat.sub(new, html, count=1)
    open(p, "w").write(html)
    print("stamped staticcount:", total)


if __name__ == "__main__":
    main()
