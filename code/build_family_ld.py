#!/usr/bin/env python3
"""Stamp static JSON-LD CreativeWork schema for generator families into index.html <head>.

Reads families via `node code/engine.js families` (key, name, blurb, params) and
writes an ItemList of CreativeWork nodes — generator type, algorithmic
parameters (as PropertyValue additionalProperty entries), output format, and
author Justin Addam Higgins — between the __FAM_LD_START/END markers.
No license field (Manon's call — never invent one).

Idempotent; re-run whenever engine.js families/params change.
Usage: python3 code/build_family_ld.py
"""
import json, os, re, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://justinahiggins614-cmyk.github.io/signature-boundless-generators/"
START = "<!--__FAM_LD_START-->"
END = "<!--__FAM_LD_END-->"


def families():
    r = subprocess.run(["node", "code/engine.js", "families"],
                       capture_output=True, text=True, cwd=ROOT)
    if r.returncode != 0:
        raise RuntimeError("node engine.js families failed: " + r.stderr[:300])
    return json.loads(r.stdout)


def param_prop(p):
    pv = {"@type": "PropertyValue", "name": p.get("label", p.get("id", ""))}
    if p.get("type") == "choice":
        pv["value"] = "choice: " + ", ".join(p.get("options", []))
    else:
        lo, hi, step = p.get("min"), p.get("max"), p.get("step", 1)
        pv["value"] = "range %s..%s step %s" % (lo, hi, step)
    return pv


def main():
    fams = families()
    items = []
    for i, f in enumerate(fams):
        items.append({
            "@type": "CreativeWork",
            "position": i + 1,
            "name": f["name"],
            "description": f.get("blurb", ""),
            "author": {"@type": "Person", "name": "Justin Addam Higgins"},
            "url": BASE + "?fam=" + f["key"],
            "genre": "Signature-line generator",
            "keywords": f["key"] + ", signature-line generator, deterministic design solver",
            "additionalProperty": [param_prop(p) for p in f.get("params", [])],
            "encodingFormat": "text/html",
        })
    ld = {"@context": "https://schema.org", "@type": "ItemList",
          "name": "Signature Boundless Generator Archive — generator families",
          "itemListElement": items}
    block = START + '\n<script type="application/ld+json">\n' + \
        json.dumps(ld, separators=(",", ":")) + '\n</script>\n' + END

    p = os.path.join(ROOT, "index.html")
    html = open(p).read()
    if START not in html or END not in html:
        raise RuntimeError("markers missing from index.html head")
    html = re.sub(re.escape(START) + r".*?" + re.escape(END), lambda m: block,
                  html, count=1, flags=re.S)
    open(p, "w").write(html)
    print("stamped family JSON-LD:", len(items), "families")


if __name__ == "__main__":
    main()
