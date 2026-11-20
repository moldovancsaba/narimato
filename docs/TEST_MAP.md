# Test Map — file ownership

The `node:test` suite is the executable contract of the repository. Every test file owns one
behaviour area; every repository change must keep its area green and add coverage to the owning
file (or a new file with a new row here).

The executed total is generated into `README.md` and `ARCHITECTURE.md` as
`<!-- test-count:N -->N<!-- /test-count -->`; `scripts/test-count.mjs` fails CI when a marker and
the executed suite disagree. Never edit the marker by hand — run the suite and update it from the
real count.

| Test file | Owns | Module | Issue |
|---|---|---|---|
| `test/adr.test.js` | ADR numbering, front matter, index coverage, key existence | `docs/adr/` | DOC-01 |
| `test/camera-contract.test.js` | `CameraView` conformance for both cameras, units, orthonormal basis, malformed rejection | `public/js/shared/camera-contract.js` | RND-01 |
| `test/camera-controls.test.js` | Camera control semantics (invert, focus, zoom guards) and the unchanged orbital pixel fixture | `public/js/app.js`, `public/js/shared/orbit-controls.js`, `public/js/shared/geometry.js` | CTL-01, RND-01 |
| `test/data-integrity.test.js` | Manifest/tar determinism, path safety, checksums, reconciliation, retention, exit codes | `lib/data-integrity.js` | OPS-03 |
| `test/docs-check.test.js` | R1–R6 docs gate, link/anchor/placeholder/key rules | `scripts/check-docs.mjs` | SSOT-02 |
| `test/geometry.test.js` | Regular spherical icosahedron, subdivision, labels, picking, projection | `public/js/shared/geometry.js` | RND-01 |
| `test/harvest.test.js` | Can-harvest predicate (own lock, cooldown, depth) | `public/js/shared/harvest.js` | CTL-03 |
| `test/mission.test.js` | Per-planet requirements, depth progression, sanitization | `public/js/shared/mission.js` | — (delivered) |
| `test/narration-manifest.test.js` | Cue matrix completeness (40 cues/115 units/345 clips), manifest schema, hashes, content-derived version, cache-bust, licence guard, caption/voice sync | `scripts/voice-lib.mjs`, `public/js/audio-version.js` | STR-01 |
| `test/observability.test.js` | Metrics shape/aggregates, SSE counters, telemetry privacy/clamps, beacon | `lib/metrics.js`, `public/js/telemetry.js` | OPS-01 |
| `test/orbit-controls.test.js` | Shared drag/travel direction primitives | `public/js/shared/orbit-controls.js` | CTL-01 |
| `test/planet-theme.test.js` | Planet palette/theme identity | `public/js/shared/planet.js`, CSS | — (delivered) |
| `test/planet.test.js` | Deterministic terrain, biomes, deposits, client/server parity | `public/js/shared/planet.js` | — (delivered) |
| `test/rate-limit.test.js` | Token bucket: refill, burst, retryAfter, clock injection, eviction | `lib/rate-limit.js` | SEC-01 |
| `test/recovery.test.js` | Backup -> verify -> restore drill, quarantine, ALLOW_EMPTY_WORLD, reconciliation, failed-restore safety | `lib/data-integrity.js`, `scripts/*-data.mjs`, `lib/world-core.js` | OPS-03 |
| `test/security.test.js` | Header matrix, origin policy, limits, body caps, static safety, SSE admission, compat rollback | `lib/security.js`, `server.js` | SEC-01 |
| `test/server.test.js` | HTTP/SSE protocol, rooms, escape, persistence, static safety, health, surface pose/leave/mine frames, supply focus | `server.js`, `lib/planet-manager.js` | SRV-01, SRV-03, SRV-04, TST-01, OPS-03, SEC-01 |
| `test/slo-contract.test.js` | SLO ruleset schema, path resolution, warm-up, checker exit codes, docs drift, privacy | `lib/slo.js`, `observability/slo.json` | OPS-01 |
| `test/story-copy.test.js` | Copy SSOT: plural/naming table, Captain's Log grammar, threshold rendering, incident copy, doc-block sync and drift failure, guide card DOM contract | `public/js/story-copy.js`, `scripts/sync-story-copy.mjs` | STR-02 |
| `test/sphere-interaction.test.js` | Carrier frame, projection/unprojection, point-follow, shortest arc | `public/js/shared/sphere-interaction.js` | RND-01, CTL-01 |
| `test/surface-camera.test.js` | Surface camera framing, carrier dolly/tilt, round-trip, near plane, resize | `public/js/shared/surface-camera.js` | RND-01 |
| `test/surface-render.test.js` | Surface view state machine, orbit restore, entity mapping, rollback flag | `public/js/surface-controller.js`, `public/js/shared/view-state.js` | RND-02 |
| `test/hud-parity.test.js` | HUD snapshot parity, duplicate detection, target/lap fallbacks, static markup contract | `public/js/shared/hud-parity.js`, `public/index.html` | RND-03 |
| `test/surface-math.test.js` | Surface tangent/down-angle and projection helpers | `public/js/shared/sphere-interaction.js` | RND-01 |
| `test/test-count.test.js` | TAP summary parsing, marker verification, failure propagation | `scripts/test-count.mjs` | QA-01 |
| `test/tetra-ship.test.js` | Five-tetrahedron ship geometry and incident models | `public/js/shared/tetra-ship.js` | EVT-02 |
| `test/version.test.js` | Version slots, lineages, fix/bump, semver ordering | `scripts/check-version.mjs` | SSOT-03 |
| `test/world-core.test.js` | Authoritative world: players, scoring, breaks, locks, resources, robots, persistence, incidents, surface poses, seeded routes, resolver mining, supply placements | `lib/world-core.js` | SRV-01, SRV-02, SRV-03, SRV-04, EVT-01, OPS-03 |

## Rules

- A behaviour change updates its owning test file and the row above if ownership changes.
- New test files require a row here and a matching source module; orphan files fail review.
- Tests must not spawn browsers or require network access; browser acceptance lives in
  `scripts/verify-*` and `scripts/acceptance-*` and is documented by its issue.
- The total count in `README.md`/`ARCHITECTURE.md` is generated by `node scripts/test-count.mjs`;
  CI runs the suite, tees the TAP log, and verifies the markers against it.
