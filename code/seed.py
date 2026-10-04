#!/usr/bin/env python3
"""Seed / drip the Boundless Generator Archive.

Generates N new outputs per family via the deterministic JS engine
(node code/engine.js batch), appends compact rows to gz chunks, and
rebuilds manifest + index + browse catalog files + api.json.
(The 2h drip runs code/build_sitemap.py next for sitemaps.)

Usage: python3 code/seed.py --per-family 150
"""
import argparse, datetime, gzip, hashlib, json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
CHUNKS = os.path.join(DATA, "chunks")
CHUNK_SIZE = 150

def sh(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT)
    if r.returncode != 0:
        raise RuntimeError("node failed: " + r.stderr[:500])
    return r.stdout

def families():
    return json.loads(sh(["node", "code/engine.js", "families"]))

def load_state():
    p = os.path.join(DATA, "state.json")
    if os.path.exists(p):
        return json.load(open(p))
    return {"next_seed": {}}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-family", type=int, default=150)
    a = ap.parse_args()
    os.makedirs(CHUNKS, exist_ok=True)

    # GATE 0: the deterministic engine must validate before anything is written.
    print("validating engine...", flush=True)
    v = subprocess.run(["node", "code/engine.js", "validate"], capture_output=True, text=True, cwd=ROOT)
    if v.returncode != 0:
        raise RuntimeError("engine validate FAILED — drip aborted:\n" + v.stderr[:2000] + v.stdout[:2000])
    print("  " + v.stdout.strip(), flush=True)

    fams = families()
    state = load_state()
    ns = state.setdefault("next_seed", {})

    new_rows = []
    for f in fams:
        key = f["key"]
        start = ns.get(key, 1)
        raw = sh(["node", "code/engine.js", "batch", key, str(start), str(a.per_family)])
        outs = json.loads(raw)
        for o in outs:
            new_rows.append([o["id"], o["family"], o["seed"], o["name"], o["tagline"]])
        ns[key] = start + a.per_family
        print(f"  {key}: seeds {start}..{start + a.per_family - 1}", flush=True)

    # append rows to chunks (fill the last partial chunk first)
    manifest_p = os.path.join(DATA, "manifest.json")
    manifest = json.load(open(manifest_p)) if os.path.exists(manifest_p) else {"chunks": [], "count": 0}
    chunks = manifest["chunks"]
    buf = []
    if chunks:
        last = chunks[-1]
        with gzip.open(os.path.join(CHUNKS, last), "rt") as fh:
            buf = [json.loads(l) for l in fh if l.strip()]
        if len(buf) < CHUNK_SIZE:
            os.remove(os.path.join(CHUNKS, last))
            chunks.pop()
        else:
            buf = []
    for row in new_rows:
        buf.append(row)
        if len(buf) >= CHUNK_SIZE:
            name = "gen-c%05d.json.gz" % len(chunks)
            with gzip.open(os.path.join(CHUNKS, name), "wt") as fh:
                for r in buf:
                    fh.write(json.dumps(r, separators=(",", ":")) + "\n")
            chunks.append(name)
            buf = []
    if buf:
        name = "gen-c%05d.json.gz" % len(chunks)
        with gzip.open(os.path.join(CHUNKS, name), "wt") as fh:
            for r in buf:
                fh.write(json.dumps(r, separators=(",", ":")) + "\n")
        chunks.append(name)

    manifest["chunks"] = chunks
    total = 0
    per_fam = {}
    chunk_manifest = []
    for c in chunks:
        p = os.path.join(CHUNKS, c)
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
                    per_fam[r[1]] = per_fam.get(r[1], 0) + 1
        total += n
        chunk_manifest.append({"chunk": c, "first_id": first, "last_id": last,
                               "count": n, "sha256": h.hexdigest()})
    manifest["count"] = total
    manifest["per_family"] = {k: v - 1 for k, v in ns.items()}  # seeds issued per family
    assert total == sum(per_fam.values()), "count mismatch"
    assert manifest["per_family"] == per_fam, "per_family mismatch vs chunk scan"

    # ---- authoritative manifest fields (the ONE count source) ----
    now = datetime.datetime.now(datetime.timezone.utc)
    fam_ids = {}
    for i, f in enumerate(fams):
        n2 = str(i + 1)
        while len(n2) < 2:
            n2 = "0" + n2
        fam_ids[f["key"]] = "JAH-GF-" + n2
    latest, earliest = {}, {}
    for key, cnt in per_fam.items():
        fam = key.upper().replace("-", "")
        latest[key] = "JAH-GEN-%s-%06d" % (fam, cnt)
        earliest[key] = "JAH-GEN-%s-000001" % fam
    drips = manifest.get("drip_history", [])
    drips.append({"date": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                  "added": len(new_rows), "per_family": a.per_family})
    drips = drips[-50:]
    manifest.update({
        "site": "The Signature Boundless Generator Archive",
        "site_id": "SIGNATURE-BOUNDLESS-GENERATORS",
        "site_number": 17,
        "goal": 1000000,
        "family_ids": fam_ids,
        "latest_ids": latest,
        "earliest_ids": earliest,
        "chunk_manifest": chunk_manifest,
        "drip_history": drips,
        "archive_version": now.strftime("%Y-%m-%d"),
        "generator_version": "1.0",
        "engine_version": "1.0",
        "schema_version": "1.0",
        "index_version": "1.0",
        "index_url": "data/index.json.gz",
        "updated": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "canonical_url": "https://justinahiggins614-cmyk.github.io/signature-boundless-generators/",
        "id_scheme": "JAH-GEN-<FAMILY>-<seed 6-digit> (family key uppercased); universal solves JAH-GEN-CUSTOM-<base36 hash>",
    })
    json.dump(manifest, open(manifest_p, "w"), indent=1)
    json.dump(state, open(os.path.join(DATA, "state.json"), "w"), indent=1)

    # compact full index (for search)
    fam_counts = {}
    with gzip.open(os.path.join(DATA, "index.json.gz"), "wt") as fh:
        for r in iter_rows(chunks):
            fh.write(json.dumps(r, separators=(",", ":")) + "\n")
            fam_counts[r[1]] = fam_counts.get(r[1], 0) + 1
    assert sum(fam_counts.values()) == total, "index row mismatch"

    # index hash (computed after the index is rebuilt)
    ih = hashlib.sha256()
    with open(os.path.join(DATA, "index.json.gz"), "rb") as fh:
        for blk in iter(lambda: fh.read(1 << 20), b""):
            ih.update(blk)
    manifest["index_sha256"] = ih.hexdigest()
    json.dump(manifest, open(manifest_p, "w"), indent=1)

    # api.json (extends the same authoritative source)
    api = {
        "site": "The Signature Boundless Generator Archive",
        "outputs": manifest["count"],
        "goal": 1000000,
        "updated": manifest["updated"],
        "generator_version": "1.0",
        "schema_version": "1.0",
        "manifest": "data/manifest.json",
        "index": "data/index.json.gz",
        "index_sha256": manifest["index_sha256"],
        "families": [{"key": f["key"], "family_id": fam_ids[f["key"]], "name": f["name"],
                      "icon": f["icon"], "blurb": f["blurb"],
                      "outputs": fam_counts.get(f["key"], 0)} for f in fams],
    }
    json.dump(api, open(os.path.join(ROOT, "api.json"), "w"), indent=1)

    # SITE-17 DIAG FIX-02: machine-readable catalog feed (rebuilt on every drip)
    cat = {
        "site": "The Signature Boundless Generator Archive",
        "updated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "outputs": manifest["count"],
        "goal": 1000000,
        "manifest": "data/manifest.json",
        "index": "data/index.json.gz",
        "hubs": "hubs/",
        "families": [{
            "key": f["key"], "name": f["name"], "icon": f["icon"], "blurb": f["blurb"],
            "outputs": fam_counts.get(f["key"], 0),
            "url": "https://justinahiggins614-cmyk.github.io/signature-boundless-generators/?fam=" + f["key"],
            "hub": "https://justinahiggins614-cmyk.github.io/signature-boundless-generators/hubs/" + f["key"] + ".html",
        } for f in fams],
    }
    json.dump(cat, open(os.path.join(ROOT, "generators-catalog.json"), "w"), indent=1)

    # refresh the AI-manifest count lines in llms.txt from the same source
    llms_p = os.path.join(ROOT, "llms.txt")
    if os.path.exists(llms_p):
        import re
        t = open(llms_p).read()
        t = re.sub(r"^OUTPUTS_ON_FILE: .*$",
                   "OUTPUTS_ON_FILE: %d" % manifest["count"], t, flags=re.M)
        t = re.sub(r"^GENERATOR_FAMILIES: .*$",
                   "GENERATOR_FAMILIES: %d" % len(fams), t, flags=re.M)
        t = re.sub(r"^ARCHIVE_UPDATED: .*$",
                   "ARCHIVE_UPDATED: %s" % now.strftime("%Y-%m-%d"), t, flags=re.M)
        open(llms_p, "w").write(t)

    # browse.html lazy A-Z catalog (runs AFTER the manifest/index/api rebuild above,
    # so the stamped count can never be one run behind)
    subprocess.run([sys.executable, "code/build_browse_index.py"],
                   cwd=ROOT, check=True)

    print("TOTAL outputs:", manifest["count"])

def iter_rows(chunks):
    for c in chunks:
        with gzip.open(os.path.join(CHUNKS, c), "rt") as fh:
            for l in fh:
                if l.strip():
                    yield json.loads(l)

if __name__ == "__main__":
    main()
