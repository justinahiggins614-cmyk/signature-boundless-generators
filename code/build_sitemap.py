#!/usr/bin/env python3
"""Build the sitemap INDEX for the Boundless Generator Archive.

Produces sitemap-index.xml + sharded record sitemaps (max 10,000 URLs each):
  - sitemap-core.xml    (home, hubs, ?fam= pages, llms.txt, developers.html)
  - sitemap-records-N.xml (every ?gen= output)

Also refreshes the static hub pages (code/build_hubs.py) and re-stamps the
static count line in index.html, so the 2h generator drip (which runs this
script after seed.py) keeps feeds, hubs, and counts fresh automatically.

Usage: python3 code/build_sitemap.py
"""
import datetime, gzip, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://justinahiggins614-cmyk.github.io/signature-boundless-generators/"
SHARD_SIZE = 10000


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


def write_urlset(path, urls):
    with open(path, "w") as fh:
        fh.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        for u in urls:
            fh.write("<url><loc>%s</loc><lastmod>%s</lastmod></url>\n" % (esc(u), TODAY))
        fh.write("</urlset>\n")


def main():
    counts = build_hubs.main()
    total = sum(counts.values())

    core = [BASE, BASE + "hubs/", BASE + "llms.txt", BASE + "developers.html",
            BASE + "api.json", BASE + "generators-catalog.json"]
    fams = build_hubs.families()
    for f in fams:
        core.append(BASE + "?fam=" + f["key"])
        core.append(BASE + "hubs/" + f["key"] + ".html")
    write_urlset(os.path.join(ROOT, "sitemap-core.xml"), core)

    record_urls = []
    manifest = json.load(open(os.path.join(ROOT, "data", "manifest.json")))
    for c in manifest["chunks"]:
        with gzip.open(os.path.join(ROOT, "data", "chunks", c), "rt") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                r = json.loads(line)
                record_urls.append(BASE + "?gen=" + r[1] + "-" + str(r[2]))
    assert len(record_urls) == manifest["count"] == total, \
        "sitemap record count mismatch: %d vs manifest %d" % (len(record_urls), manifest["count"])

    shards = []
    for i in range(0, len(record_urls), SHARD_SIZE):
        name = "sitemap-records-%d.xml" % (i // SHARD_SIZE + 1)
        write_urlset(os.path.join(ROOT, name), record_urls[i:i + SHARD_SIZE])
        shards.append(name)

    # sitemap index
    with open(os.path.join(ROOT, "sitemap-index.xml"), "w") as fh:
        fh.write('<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        for name in ["sitemap-core.xml"] + shards:
            fh.write("<sitemap><loc>%s%s</loc><lastmod>%s</lastmod></sitemap>\n" % (esc(BASE), name, TODAY))
        fh.write("</sitemapindex>\n")
    print("sitemap: index + %d shards (%d record URLs)" % (1 + len(shards), len(record_urls)))

    # retire any leftover shards from a previous layout
    n = len(shards) + 1
    while True:
        stale = os.path.join(ROOT, "sitemap-records-%d.xml" % n)
        if not os.path.exists(stale):
            break
        os.remove(stale)
        n += 1

    # robots.txt -> the index
    with open(os.path.join(ROOT, "robots.txt"), "w") as fh:
        fh.write("User-agent: *\nAllow: /\nSitemap: %ssitemap-index.xml\n" % BASE)

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
