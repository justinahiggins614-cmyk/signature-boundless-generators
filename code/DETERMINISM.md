# SigGen Determinism Specification — engine v1.0

The Signature Boundless Generator Archive promises: **same words → same design, forever.**
This document defines exactly what that promise means, technically.

## The chain

```
NORMALIZED INPUT
  → GENERATOR FAMILY (JAH-GF-##)
  → SEED
  → GENERATOR VERSION (engine v1.0)
  → OUTPUT (fully-solved design record)
  → VALIDATION (node code/engine.js validate)
  → CONTENT_SHA256
  → JAH-GEN ID
  → ARCHIVE (compact row in data/chunks/*.json.gz)
```

## Seeded family solves

- Seed string: `family + ":" + seed + ":" + JSON.stringify(paramOverrides || {})`
- String hash: `hashStr` — 32-bit FNV-style mix over `charCodeAt` values.
- RNG: `mulberry32` seeded from the string hash. All randomness in every family
  comes from this single RNG stream — no `Math.random()`, no dates, no network.
- Output ID: `JAH-GEN-<FAMILY>-<seed zero-padded to 6>`, where `<FAMILY>` is the
  family key uppercased, non-alphanumeric characters stripped, truncated to 12 chars.
  Example: `jet` seed `1` → `JAH-GEN-JET-000001`.
- Family IDs: `JAH-GF-01` … `JAH-GF-20` in catalog order (see `SigGen.familyId(key)`).

## Universal solver ("Describe anything")

- Normalization: whitespace collapsed to single spaces, trimmed, sliced to 140 chars.
- Seed string: `"custom:" + normalizedText`.
- Custom ID: `JAH-GEN-CUSTOM-` + base36(`hashStr(normalizedText)`), uppercased,
  zero-padded to 7 chars. Same words → same ID, forever.
- Classification: `classifyText` picks a specialized family or falls back to the
  universal solver (explicitly labeled "Universal Solver" — never a fake family).

## Content hash

- Canonical serialization: `stableStringify` — object keys sorted recursively,
  internal `_`-prefixed fields dropped, UTF-8 encoded.
- `CONTENT_SHA256 = sha256(canonical bytes)`.
- Identical in node and every browser (`SigGen.outputHash(o)`).

## "Forever" defined

"Forever" means:

1. Engine v1.0 source (`code/engine.js`) is pinned and preserved. Additive honest-status
   metadata fields do not alter solved content (name, tagline, dimensions, parts…).
2. Any future generator version gets a NEW version number and its own test vectors;
   v1 outputs remain reproducible under the preserved v1 engine.
3. Archived compact rows `[id, family, seed, name, tagline]` are verified by
   re-solving: `SigGen.verifyRecord(row)` must return `reproduced: true`.

## Test vectors

`code/test_vectors.json` pins, per family, seeds 1 / 42 / 976 → expected
`content_sha256`, plus universal-solver vectors. The QA gate
(`code/qa/check.py`) re-solves every vector and fails the build on any mismatch.

## What "fully solved" does and does not mean

Fully solved = the generator filled every required field of that family's record
(idea, dimensions with units, materials, colors, components, measurements,
piece-by-piece parts list, build steps, cross-references). It does NOT mean the
design was engineered, physically built, tested, certified, or proven safe.
Every archived output carries:

- `solve_status: "SOLVED"`, `design_status: "SPECIFIED"`
- `value_origin: "GENERATED"` (all numeric fields are seeded-RNG values inside
  documented ranges — generated, never measured)
- `physical_test_status: "NONE"`, `simulation_status: "NOT_SIMULATED"`
- `provenance: "GENERATED"`

Medical-family outputs additionally carry the wellness-concept safety notice
("speculative wellness concepts only — not medical advice").
