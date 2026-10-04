#!/usr/bin/env python3
"""Build the browse.html lazy-loading A-Z catalog artifacts.

Reads data/manifest.json (authoritative count source) + the gz chunk files,
then writes:
  data/browse/browse-<family>.json.gz   one gz file per family (lazy-loaded by
      browse.html only when a letter list is opened):
      {"key","name","icon","count","letters":{"A":[[id,seed,title,spec],...]}}
      letters sorted (# first, then A..Z); rows in seed order.
  data/browse/index.json   tiny plain-JSON manifest:
      {"count", "families":[{key,name,icon,outputs,letters:{L:count}}], "updated"}

Then re-stamps browse.html (assert-verified, fail-loud):
  - the family/letter <details> tree between __BROWSE_TREE_START/END
  - the real-count stats block between __BROWSE_COUNT_START/END

Runs inside the 2h drip from code/seed.py AFTER the manifest/index rebuild, so
browse.html is never one run behind. Idempotent: byte-stable output when the
underlying data has not changed.

Usage: python3 code/build_browse_index.py
"""
import datetime
import gzip
import html as htmlmod
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
CHUNKS = os.path.join(DATA, "chunks")
BROWSE = os.path.join(DATA, "browse")


def utcnow():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def families():
    r = subprocess.run(["node", "code/engine.js", "families"],
                       capture_output=True, text=True, cwd=ROOT)
    if r.returncode != 0:
        raise RuntimeError("node code/engine.js families failed: " + r.stderr[:500])
    return json.loads(r.stdout)


def letter_of(title):
    c = (title or "").strip()[:1].upper()
    return c if "A" <= c <= "Z" else "#"


def esc(s):
    return htmlmod.escape(s or "", quote=True)


def build_tree(fam_meta):
    """Static family -> letter <details> skeleton (row lists load lazily)."""
    out = ["<!--__BROWSE_TREE_START-->", '<div id="jah-askai-scope">']
    out.append('<div class="famjump" aria-label="Jump to a generator family">')
    for fm in fam_meta:
        out.append('<a href="#fam-%s">%s %s</a>'
                   % (fm["key"], esc(fm["icon"]), esc(fm["name"])))
    out.append('</div>')
    for fm in fam_meta:
        out.append('<details class="famblock" id="fam-%s">' % fm["key"])
        out.append('<summary><span class="fic">%s</span> %s <b>&middot; %s outputs</b></summary>'
                   % (esc(fm["icon"]), esc(fm["name"]), format(fm["outputs"], ",")))
        out.append('<div class="lettergrid">')
        for letter, cnt in fm["letters"].items():
            out.append('<details class="letterblock" data-fam="%s" data-letter="%s">'
                       % (fm["key"], esc(letter)))
            out.append('<summary>%s <b>&middot; %s</b></summary>' % (esc(letter), format(cnt, ",")))
            out.append('<div class="browselist"><p class="note">Opening this list loads it '
                       '&mdash; one tap, never the whole archive at once.</p></div>')
            out.append('</details>')
        out.append('</div>')
        out.append('</details>')
    out.append('</div>')
    out.append('<!--__BROWSE_TREE_END-->')
    return "\n".join(out)


def stamp_browse_html(manifest, fam_meta):
    p = os.path.join(ROOT, "browse.html")
    html = open(p).read()

    count_block = (
        '<!--__BROWSE_COUNT_START-->'
        '<div class="stats">'
        '<div class="stat"><b>%s</b><span>outputs on file</span></div>'
        '<div class="stat"><b>%d</b><span>generator families</span></div>'
        '<div class="stat"><b>1,000,000</b><span>march goal</span></div>'
        '</div><!--__BROWSE_COUNT_END-->'
        % (format(manifest["count"], ","), len(fam_meta)))
    cpat = re.compile(r"<!--__BROWSE_COUNT_START-->.*?<!--__BROWSE_COUNT_END-->", re.S)
    assert cpat.search(html), "BROWSE_COUNT markers missing in browse.html"
    html = cpat.sub(lambda m: count_block, html, count=1)

    tree = build_tree(fam_meta)
    tpat = re.compile(r"<!--__BROWSE_TREE_START-->.*?<!--__BROWSE_TREE_END-->", re.S)
    assert tpat.search(html), "BROWSE_TREE markers missing in browse.html"
    html = tpat.sub(lambda m: tree, html, count=1)

    open(p, "w").write(html)
    print("stamped browse.html: %d outputs, %d families"
          % (manifest["count"], len(fam_meta)))


def main():
    manifest = json.load(open(os.path.join(DATA, "manifest.json")))
    chunks = manifest["chunks"]
    fams = families()

    groups = {f["key"]: {} for f in fams}
    for c in chunks:
        with gzip.open(os.path.join(CHUNKS, c), "rt") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                r = json.loads(line)  # [id, family, seed, title, spec]
                key = r[1]
                if key not in groups:
                    raise RuntimeError("unknown family in chunk %s: %s" % (c, key))
                groups[key].setdefault(letter_of(r[3]), []).append([r[0], r[2], r[3], r[4]])

    os.makedirs(BROWSE, exist_ok=True)
    fam_meta = []
    for f in fams:
        key = f["key"]
        letters = groups[key]
        for rows in letters.values():
            rows.sort(key=lambda r: r[1])  # seed order = permanent ID order
        order = (["#"] if "#" in letters else []) + sorted(k for k in letters if k != "#")
        count = sum(len(v) for v in letters.values())
        payload = {"key": key, "name": f["name"], "icon": f["icon"], "count": count,
                   "letters": {L: letters[L] for L in order}}
        with gzip.open(os.path.join(BROWSE, "browse-%s.json.gz" % key), "wb") as fh:
            fh.write(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
        fam_meta.append({"key": key, "name": f["name"], "icon": f["icon"],
                         "outputs": count,
                         "letters": {L: len(letters[L]) for L in order}})

    total = sum(fm["outputs"] for fm in fam_meta)
    assert total == manifest["count"], \
        "browse total %d != manifest count %d" % (total, manifest["count"])

    json.dump({"count": total, "families": fam_meta, "updated": utcnow(),
               "manifest_count": manifest["count"]},
              open(os.path.join(BROWSE, "index.json"), "w"), indent=1)

    stamp_browse_html(manifest, fam_meta)
    print("browse artifacts: %d family files, %d outputs" % (len(fam_meta), total))


if __name__ == "__main__":
    main()
