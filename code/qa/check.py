#!/usr/bin/env python3
"""Build gates for the Boundless Generator Archive. Exit 1 on ANY failure.

Gates:
  1. count reconciliation: manifest.count == index rows == sum(chunk counts)
     == sum(per_family) == sum(chunk_manifest counts)
  2. duplicate IDs: none across the archive index
  3. chunk continuity: every chunk_manifest entry's first/last/count/sha256
     verified against the actual chunk file
  4. per-family seed continuity: seeds 1..N contiguous, IDs permanent
  5. determinism: `node code/engine.js validate` + every code/test_vectors.json
     vector re-solved with matching content_sha256
  6. sitemap count: record URLs across sitemap-records-N.xml == manifest count
  7. filed cross-reference resolution: every FILED_REFS spec/patent ID resolves
     to a real record in the local filed-archive search files
  8. manifest schema: all required fields present; api.json consistent
"""
import gzip, hashlib, json, os, re, subprocess, sys, xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, "data")
CHUNKS = os.path.join(DATA, "chunks")
FAIL = []


def fail(msg):
    FAIL.append(msg)
    print("FAIL:", msg)


def ok(msg):
    print("ok:", msg)


def load_manifest():
    return json.load(open(os.path.join(DATA, "manifest.json")))


def iter_index():
    with gzip.open(os.path.join(DATA, "index.json.gz"), "rt") as fh:
        for line in fh:
            if line.strip():
                yield json.loads(line)


def gate_counts(m):
    rows = list(iter_index())
    n_idx = len(rows)
    if n_idx != m["count"]:
        fail("index rows %d != manifest count %d" % (n_idx, m["count"]))
    else:
        ok("index rows == manifest count (%d)" % n_idx)
    per = {}
    for r in rows:
        per[r[1]] = per.get(r[1], 0) + 1
    if per != m["per_family"]:
        fail("per_family mismatch vs index scan")
    else:
        ok("per_family reconciles (%d families)" % len(per))
    cm = m.get("chunk_manifest", [])
    if sum(c["count"] for c in cm) != m["count"]:
        fail("chunk_manifest counts sum != manifest count")
    else:
        ok("chunk_manifest counts sum == manifest count")
    return rows


def gate_dupes(rows):
    seen = set()
    dupes = 0
    for r in rows:
        if r[0] in seen:
            dupes += 1
            if dupes <= 5:
                fail("duplicate ID: " + r[0])
        seen.add(r[0])
    if dupes == 0:
        ok("no duplicate IDs across %d records" % len(seen))


def gate_chunks(m):
    for c in m.get("chunk_manifest", []):
        p = os.path.join(CHUNKS, c["chunk"])
        if not os.path.exists(p):
            fail("chunk missing: " + c["chunk"])
            continue
        h = hashlib.sha256()
        first = last = None
        n = 0
        with gzip.open(p, "rb") as fh:
            for line in fh:
                h.update(line)
                if line.strip():
                    r = json.loads(line)
                    n += 1
                    if first is None:
                        first = r[0]
                    last = r[0]
        if (first, last, n, h.hexdigest()) != (c["first_id"], c["last_id"], c["count"], c["sha256"]):
            fail("chunk_manifest mismatch: " + c["chunk"])
    ok("chunk_manifest integrity verified (%d chunks)" % len(m.get("chunk_manifest", [])))


def gate_seeds(rows):
    per = {}
    for r in rows:
        per.setdefault(r[1], []).append((r[2], r[0]))
    bad = 0
    for fam, lst in per.items():
        seeds = sorted(s for s, _ in lst)
        if seeds != list(range(1, len(seeds) + 1)):
            bad += 1
            fail("seed gap in family " + fam)
    if bad == 0:
        ok("per-family seeds contiguous 1..N (%d families)" % len(per))


def gate_determinism():
    v = subprocess.run(["node", os.path.join(ROOT, "code", "engine.js"), "validate"],
                       capture_output=True, text=True, cwd=ROOT)
    if v.returncode != 0:
        fail("engine validate failed:\n" + v.stderr[:1500] + v.stdout[:1500])
        return
    ok("engine validate passed")
    vec = json.load(open(os.path.join(ROOT, "code", "test_vectors.json")))
    js = """
require(%s);
var e = globalThis.SigGen;
var vec = JSON.parse(require('fs').readFileSync(%s, 'utf8'));
var bad = [];
vec.vectors.forEach(function(vv){
  var o = vv.family === 'custom' ? e.solveCustom(vv.input) : e.solve(vv.family, vv.seed, null);
  if (o.id !== vv.id || e.outputHash(o) !== vv.content_sha256) bad.push(vv.family + ':' + (vv.seed !== undefined ? vv.seed : vv.input));
});
console.log(bad.length ? 'MISMATCH ' + bad.join(',') : 'ALL ' + vec.vectors.length + ' VECTORS MATCH');
""" % (json.dumps(os.path.join(ROOT, "code", "engine.js")),
       json.dumps(os.path.join(ROOT, "code", "test_vectors.json")))
    r = subprocess.run(["node", "-e", js], capture_output=True, text=True)
    if "MISMATCH" in r.stdout or r.returncode != 0:
        fail("test vector mismatch: " + r.stdout[:500] + r.stderr[:500])
    else:
        ok(r.stdout.strip().lower())


def gate_sitemap(m):
    total = 0
    n = 1
    while True:
        p = os.path.join(ROOT, "sitemap-records-%d.xml" % n)
        if not os.path.exists(p):
            break
        tree = ET.parse(p)
        ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        urls = tree.getroot().findall("s:url", ns)
        if len(urls) > 10000:
            fail("sitemap shard exceeds 10000 URLs: " + p)
        total += len(urls)
        n += 1
    if n == 1:
        fail("no sitemap record shards found")
    elif total != m["count"]:
        fail("sitemap record URLs %d != manifest count %d" % (total, m["count"]))
    else:
        ok("sitemap shards cover all %d records" % total)
    idx = os.path.join(ROOT, "sitemap-index.xml")
    if not os.path.exists(idx):
        fail("sitemap-index.xml missing")
    else:
        ok("sitemap-index.xml present")


def gate_crossrefs():
    src = open(os.path.join(ROOT, "code", "engine.js")).read()
    a = src.index("/*__FILED_REFS__*/")
    b = src.index("/*__FILED_REFS_END__*/")
    block = src[a:b].split("var FILED_REFS =", 1)[1].rsplit(";", 1)[0]
    refs = json.loads(block)
    spec_ids, pat_ids = set(), set()
    for fam, rr in refs.items():
        for sid, title in rr.get("specs", []):
            spec_ids.add(sid)
        for pub, title in rr.get("patents", []):
            pat_ids.add(pub)
    spec_src = os.path.expanduser("~/workspace/signature-one-archive/data/index/specs.search.json.gz")
    pat_src = os.path.expanduser("~/workspace/cyber-patent-catalog/data/patents.search.json.gz")
    if not os.path.exists(spec_src) or not os.path.exists(pat_src):
        print("skip: filed-archive search files not present locally")
        return
    have_spec = set()
    with gzip.open(spec_src, "rt") as fh:
        for line in fh:
            if line.strip():
                r = json.loads(line)
                if r[0] in spec_ids:
                    have_spec.add(r[0])
    missing_spec = spec_ids - have_spec
    if missing_spec:
        fail("FILED_REFS spec IDs not in the real archive: %s" % sorted(missing_spec)[:5])
    else:
        ok("all %d FILED_REFS spec IDs resolve to real records" % len(spec_ids))
    have_pat = set()
    with gzip.open(pat_src, "rt") as fh:
        for line in fh:
            if not line.strip():
                continue
            rows = json.loads(line)
            cands = rows if (isinstance(rows, list) and rows and isinstance(rows[0], list)) else [rows]
            for r in cands:
                if isinstance(r, list) and r and r[0] in pat_ids:
                    have_pat.add(r[0])
    missing_pat = pat_ids - have_pat
    if missing_pat:
        fail("FILED_REFS patent pubs not in the real archive: %s" % sorted(missing_pat)[:5])
    else:
        ok("all %d FILED_REFS patent pubs resolve to real records" % len(pat_ids))


def gate_schema(m):
    required = ["site", "count", "goal", "per_family", "chunks", "chunk_manifest",
                "engine_version", "generator_version", "schema_version", "index_version",
                "index_sha256", "updated", "archive_version", "family_ids",
                "latest_ids", "earliest_ids"]
    missing = [k for k in required if k not in m]
    if missing:
        fail("manifest missing fields: " + ",".join(missing))
    else:
        ok("manifest schema complete")
    api = json.load(open(os.path.join(ROOT, "api.json")))
    if api.get("outputs") != m["count"]:
        fail("api.json outputs != manifest count")
    else:
        ok("api.json consistent with manifest")


def main():
    m = load_manifest()
    rows = gate_counts(m)
    gate_dupes(rows)
    gate_chunks(m)
    gate_seeds(rows)
    gate_determinism()
    gate_sitemap(m)
    gate_crossrefs()
    gate_schema(m)
    if FAIL:
        print("\n%d GATE(S) FAILED" % len(FAIL))
        return 1
    print("\nALL GATES PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
