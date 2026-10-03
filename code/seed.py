#!/usr/bin/env python3
"""Seed / drip the Boundless Generator Archive.

Generates N new outputs per family via the deterministic JS engine
(node code/engine.js batch), appends compact rows to gz chunks, and
rebuilds manifest + index + sitemap + api.json.

Usage: python3 code/seed.py --per-family 150
"""
import argparse, gzip, json, os, subprocess, sys

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
    manifest["count"] = sum(1 for _ in iter_rows(chunks))
    manifest["per_family"] = {k: v - 1 for k, v in ns.items()}  # seeds issued per family
    json.dump(manifest, open(manifest_p, "w"), indent=1)
    json.dump(state, open(os.path.join(DATA, "state.json"), "w"), indent=1)

    # compact full index (for search)
    fam_counts = {}
    with gzip.open(os.path.join(DATA, "index.json.gz"), "wt") as fh:
        for r in iter_rows(chunks):
            fh.write(json.dumps(r, separators=(",", ":")) + "\n")
            fam_counts[r[1]] = fam_counts.get(r[1], 0) + 1

    # api.json
    api = {
        "site": "The Signature Boundless Generator Archive",
        "outputs": manifest["count"],
        "goal": 1000000,
        "families": [{"key": f["key"], "name": f["name"], "icon": f["icon"], "blurb": f["blurb"]} for f in fams],
        "manifest": "data/manifest.json",
        "index": "data/index.json.gz",
    }
    json.dump(api, open(os.path.join(ROOT, "api.json"), "w"), indent=1)

    # SITE-17 DIAG FIX-02: machine-readable catalog feed (rebuilt on every drip)
    import datetime
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

    print("TOTAL outputs:", manifest["count"])

def iter_rows(chunks):
    for c in chunks:
        with gzip.open(os.path.join(CHUNKS, c), "rt") as fh:
            for l in fh:
                if l.strip():
                    yield json.loads(l)

if __name__ == "__main__":
    main()
