#!/usr/bin/env python3
"""Build static per-family hub pages (hubs/<key>.html + hubs/index.html) for crawlers.

Each family hub is pre-rendered static HTML: family header, parameter preset
table, and a full table of that family's outputs (JAH-GEN id, seed, name,
tagline) linking to the live ?gen=<family>-<seed> deep links, plus JSON-LD.
Called from code/build_sitemap.py so the 2h generator drip keeps hubs fresh.

Usage: python3 code/build_hubs.py   (prints family count + total rows)
"""
import gzip, html as htmllib, json, os, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://justinahiggins614-cmyk.github.io/signature-boundless-generators/"
HUBS = os.path.join(ROOT, "hubs")


def esc(s):
    return htmllib.escape("" if s is None else str(s), quote=True)


def families():
    r = subprocess.run(["node", "code/engine.js", "families"],
                       capture_output=True, text=True, cwd=ROOT)
    if r.returncode != 0:
        raise RuntimeError("node engine.js families failed: " + r.stderr[:300])
    return json.loads(r.stdout)


def rows_by_family():
    out = {}
    with gzip.open(os.path.join(ROOT, "data", "index.json.gz"), "rt") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            r = json.loads(line)  # [id, family, seed, name, tagline]
            out.setdefault(r[1], []).append(r)
    for v in out.values():
        v.sort(key=lambda r: r[2])
    return out


def param_table(f):
    ps = f.get("params", [])
    if not ps:
        return ""
    trs = []
    for p in ps:
        if p.get("type") == "choice":
            val = "choose: " + ", ".join(p.get("options", []))
        else:
            val = "range %s to %s (step %s)" % (p.get("min"), p.get("max"), p.get("step", 1))
        trs.append("<tr><th>%s</th><td>%s</td></tr>" % (esc(p.get("label", p.get("id", ""))), esc(val)))
    return ('<h2>Parameter presets</h2>\n<table>\n' + "\n".join(trs) + "\n</table>\n")


def family_page(f, rows):
    key = f["key"]
    trs = []
    for r in rows:
        trs.append('<tr><td>%s</td><td>%d</td><td><a href="../?gen=%s-%d">%s</a></td><td>%s</td><td><span class="recbadge">GENERATED</span></td></tr>' %
                   (esc(r[0]), r[2], esc(key), r[2], esc(r[3]), esc(r[4])))
    ld = {"@context": "https://schema.org", "@type": "ItemList",
          "name": f["name"] + " — generated outputs",
          "numberOfItems": len(rows),
          "itemListElement": [
              {"@type": "CreativeWork", "position": i + 1, "identifier": r[0],
               "name": r[3], "description": r[4],
               "author": {"@type": "Person", "name": "Justin Addam Higgins"},
               "url": BASE + "?gen=" + key + "-" + str(r[2])}
              for i, r in enumerate(rows)]}
    return """<!doctype html>
<html lang="en">
<head>
<script src="../js/signin.js"></script>
<script>/* JAHProfile storage: signed-out behavior is byte-identical to before; signed-in profiles get per-profile namespaced storage. */
var PS = (typeof JAHProfile !== 'undefined') ? JAHProfile.store : localStorage;</script>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{name} — The Signature Boundless Generator Archive</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{canon}">
<script type="application/ld+json">{ld}</script>
<style>body{{font-family:Arial,Helvetica,sans-serif;background:#070b16;color:#d7e3ff;margin:0;line-height:1.55}}
.wrap{{max-width:1000px;margin:0 auto;padding:0 16px 60px}}
h1{{color:#c9a227}}h2{{color:#00f0ff;font-size:1.05em;border-bottom:1px solid #2a3a5f;padding-bottom:6px}}
a{{color:#9fc2ff}}table{{width:100%;border-collapse:collapse;font-size:.88em}}
td,th{{border-bottom:1px solid #1a2440;padding:7px 8px;text-align:left;vertical-align:top}}
th{{color:#9aa4b2;font-weight:400}}
.sitekicker{{font-size:11px;letter-spacing:.28em;color:#9aa4b2}}
.recbadge{{display:inline-block;border:2px solid #c9a227;background:#2a230c;color:#c9a227;border-radius:10px;padding:2px 10px;font-size:11px;font-weight:bold;letter-spacing:.06em}}</style>
</head>
<body><div class="wrap">
<p class="sitekicker"><b>SITE 15 OF 31</b> &middot; THE JAH NETWORK</p>
<p><a href="../">&larr; The Signature Boundless Generator Archive</a> &middot; <a href="./">All generator families</a></p>
<h1>{icon} {name}</h1>
<p>{blurb}</p>
<p>{count} fully-solved outputs on file. Every output is an exact-recreation package: piece-by-piece parts list, every measurement, build steps, filed-archive cross-references. Record status of every output below: <span class="recbadge">GENERATED</span>.</p>
{params}
<h2>Outputs ({count})</h2>
<table>
<tr><th>ID</th><th>Seed</th><th>Name</th><th>Tagline</th><th>Record status</th></tr>
{rows}
</table>
<p><a href="./">All generator families</a></p>
<script>
(function () {{
  var mount = document.querySelector('header .booksearch') ||
              document.querySelector('nav.jtabbar') ||
              document.querySelector('header nav') ||
              document.querySelector('header') ||
              document.body;
  if (window.JAHProfile && JAHProfile.ui) JAHProfile.ui.renderButton(mount);
}})();
</script><script>(function () {{ if (window.JAHProfile && JAHProfile.ui) {{ var mount = document.querySelector('header') || document.body; JAHProfile.ui.renderGreeting(mount); }} }})();</script>
</div></body></html>""".format(
        name=esc(f["name"]), desc=esc(f.get("blurb", "")), canon=BASE + "hubs/" + key + ".html",
        ld=json.dumps(ld, separators=(",", ":")), icon=esc(f.get("icon", "")),
        blurb=esc(f.get("blurb", "")), count=len(rows),
        params=param_table(f), rows="\n".join(trs))


def index_page(fams, counts):
    lis = []
    for f in fams:
        n = counts.get(f["key"], 0)
        lis.append('<li><a href="./%s.html">%s %s</a> — %d outputs<br><span>%s</span></li>' %
                   (esc(f["key"]), esc(f.get("icon", "")), esc(f["name"]), n, esc(f.get("blurb", ""))))
    return """<!doctype html>
<html lang="en">
<head>
<script src="../js/signin.js"></script>
<script>/* JAHProfile storage: signed-out behavior is byte-identical to before; signed-in profiles get per-profile namespaced storage. */
var PS = (typeof JAHProfile !== 'undefined') ? JAHProfile.store : localStorage;</script>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Generator families — The Signature Boundless Generator Archive</title>
<meta name="description" content="Static directory of all Signature Boundless Generator families with their fully-solved outputs.">
<link rel="canonical" href="{base}hubs/">
<style>body{{font-family:Arial,Helvetica,sans-serif;background:#070b16;color:#d7e3ff;margin:0;line-height:1.55}}
.wrap{{max-width:1000px;margin:0 auto;padding:0 16px 60px}}
h1{{color:#c9a227}}a{{color:#9fc2ff}}li{{margin:12px 0}}span{{color:#9aa4b2;font-size:.85em}}
.sitekicker{{font-size:11px;letter-spacing:.28em;color:#9aa4b2}}</style>
</head>
<body><div class="wrap">
<p class="sitekicker"><b>SITE 15 OF 31</b> &middot; THE JAH NETWORK</p>
<p><a href="../">&larr; The Signature Boundless Generator Archive</a></p>
<h1>Generator families (static directory)</h1>
<ul>
{lis}
</ul>
<script>
(function () {{
  var mount = document.querySelector('header .booksearch') ||
              document.querySelector('nav.jtabbar') ||
              document.querySelector('header nav') ||
              document.querySelector('header') ||
              document.body;
  if (window.JAHProfile && JAHProfile.ui) JAHProfile.ui.renderButton(mount);
}})();
</script><script>(function () {{ if (window.JAHProfile && JAHProfile.ui) {{ var mount = document.querySelector('header') || document.body; JAHProfile.ui.renderGreeting(mount); }} }})();</script>
</div></body></html>""".format(base=BASE, lis="\n".join(lis))


def main():
    fams = families()
    byfam = rows_by_family()
    os.makedirs(HUBS, exist_ok=True)
    counts = {}
    total = 0
    for f in fams:
        rows = byfam.get(f["key"], [])
        counts[f["key"]] = len(rows)
        total += len(rows)
        with open(os.path.join(HUBS, f["key"] + ".html"), "w") as fh:
            fh.write(family_page(f, rows))
    with open(os.path.join(HUBS, "index.html"), "w") as fh:
        fh.write(index_page(fams, counts))
    print("hubs built:", len(fams), "families,", total, "rows")
    return counts


if __name__ == "__main__":
    main()
