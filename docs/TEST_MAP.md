# Test Map — file ownership

The `node:test` suite is the executable contract of the repository. Tests for the removed
separate-surface-camera/derived-mesh hacks are deleted; surface and orbit share one camera. Every test file owns one
behaviour area; every repository change must keep its area green and add coverage to the owning
file (or a new file with a new row here).

The executed total is generated into `README.md` and `ARCHITECTURE.md` as
`<!-- test-count:N -->N<!-- /test-count -->`; `scripts/test-count.mjs` fails CI when a marker and
the executed suite disagree. Never edit the marker by hand — run the suite and update it from the
real count.

| Test file | Owns | Module | Issue |
|---|---|---|---|
| `test/a11y-report.test.js` | Accessibility report schema, finding validation, surface status precedence, deterministic ordering, migrated surface registry | `scripts/lib/a11y-report.mjs`, `public/js/a11y-surfaces.js` | A11Y-01 |
| `test/a11y-suppression.test.js` | Suppression owner/expiry validation, selector/route matching, expired never suppresses, unused audit | `scripts/lib/a11y-report.mjs`, `a11y-suppressions.json` | A11Y-01 |
| `test/a11y-runtime-filter.test.js` | Allow-listed expected runtime errors vs fatal errors in the a11y report | `scripts/lib/a11y-report.mjs` | A11Y-01 |
| `test/adr.test.js` | ADR numbering, front matter, index coverage, key existence | `docs/adr/` | DOC-01 |
| `test/camera-controls.test.js` | Camera control semantics, unchanged orbital pixel fixture, 720-step two-pole loop, pole/roll face sweep, culling bounds, frame stats | `public/js/shared/geometry.js`, `public/js/renderer.js` | CTL-01, CTL-02, RND-01 |
| `test/cdn-preflight.test.js` | CDN config validation, production-host classification, DNS/header checks, CORS/range/cache policy, fail-closed exit codes | `scripts/cdn-preflight.mjs` | OPS-04 |
| `test/data-integrity.test.js` | Manifest/tar determinism, path safety, checksums, reconciliation, retention, exit codes | `lib/data-integrity.js` | OPS-03 |
| `test/device-gate.test.js` | Fixed 20-row device matrix, ledger schema, coverage, evidence paths, defect links, approvals, freshness, commit provenance, CLI exit codes | `scripts/device-gate.mjs` | A11Y-02 |
| `test/release-gate.test.js` | Release gate exit-code matrix, version triple, count parsing, prerequisite/owner validation, manifest contract, atomic report writing, dry-run plan | `lib/release-checks.js`, `scripts/release-gate.mjs`, `scripts/rollback-drill.mjs` | REL-01 |
| `test/evidence-check.test.js` | Claim table parsing, closed status vocabulary, typed evidence resolution, planned-as-live tense, broken links, exit-code precedence | `lib/claim-ledger.js`, `scripts/evidence-check.mjs` | REL-02 |
| `test/acceptance-harness.test.js` | Acceptance report exit-code contract and scoped expected-refusal handling | `scripts/lib/acceptance-harness.mjs` | TST-01 |
| `test/docs-check.test.js` | R1–R6 docs gate, link/anchor/placeholder/key rules | `scripts/check-docs.mjs` | SSOT-02 |
| `test/geometry.test.js` | Regular spherical icosahedron, subdivision, labels, picking, projection | `public/js/shared/geometry.js` | RND-01 |
| `test/harvest.test.js` | Harvest truth table: joined/stale/cooldown/lock precedence, deep-cell informational, server error mapping, chip text | `public/js/shared/harvest.js` | CTL-03 |
| `test/mission.test.js` | Per-planet requirements, depth progression, sanitization | `public/js/shared/mission.js` | — (delivered) |
| `test/narration-manifest.test.js` | Cue matrix completeness (40 cues/115 units/345 clips), manifest schema, hashes, content-derived version, cache-bust, licence guard, caption/voice sync | `scripts/voice-lib.mjs`, `public/js/audio-version.js` | STR-01 |
| `test/observability.test.js` | Metrics shape/aggregates, SSE counters, telemetry privacy/clamps, beacon | `lib/metrics.js`, `public/js/telemetry.js` | OPS-01 |
| `test/perf-budget.test.js` | Device budgets, windowed frame percentiles, tier hysteresis, evaluator, ring exclusions, bundle gzip budget | `public/js/perf-budget.js`, `lib/perf-bundle.js` | PERF-01 |
| `test/perf-gate.test.js` | Scenario schema, ruleset threshold resolution, flaky policy, RSS/correctness evaluation, artifact redaction | `observability/load-scenarios.json`, `observability/slo.json`, `scripts/perf-gate.mjs` | OPS-02 |
| `test/sharding-decision.test.js` | Sharding gate thresholds/verdicts, two-capture rule, stale/reset evidence, decision-record drift | `scripts/scale-gate.mjs`, `scripts/check-scale-decision.mjs`, `observability/scale-profile.json` | OPS-05 |
| `test/planet-theme.test.js` | Planet palette/theme identity | `public/js/shared/planet.js`, CSS | — (delivered) |
| `test/planet.test.js` | Deterministic terrain, biomes, deposits, client/server parity | `public/js/shared/planet.js` | — (delivered) |
| `test/rate-limit.test.js` | Token bucket: refill, burst, retryAfter, clock injection, eviction | `lib/rate-limit.js` | SEC-01 |
| `test/recovery.test.js` | Backup -> verify -> restore drill, quarantine, ALLOW_EMPTY_WORLD, reconciliation, failed-restore safety | `lib/data-integrity.js`, `scripts/*-data.mjs`, `lib/world-core.js` | OPS-03 |
| `test/security.test.js` | Header matrix, origin policy, limits, body caps, static safety, SSE admission, compat rollback | `lib/security.js`, `server.js` | SEC-01 |
| `test/server.test.js` | HTTP/SSE protocol, rooms, escape, persistence, static safety, health, surface pose/leave/mine frames, supply focus | `server.js`, `lib/planet-manager.js` | SRV-01, SRV-03, SRV-04, TST-01, OPS-03, SEC-01 |
| `test/slo-contract.test.js` | SLO ruleset schema, path resolution, warm-up, checker exit codes, docs drift, privacy | `lib/slo.js`, `observability/slo.json` | OPS-01 |
| `test/story-copy.test.js` | Copy SSOT: plural/naming table, Captain's Log grammar, threshold rendering, incident copy, doc-block sync and drift failure, guide card DOM contract | `public/js/story-copy.js`, `scripts/sync-story-copy.mjs` | STR-02 |
| `test/sphere-interaction.test.js` | Carrier frame, projection/unprojection, point-follow, shortest arc, 720-step two-pole carrier loop | `public/js/shared/sphere-interaction.js` | RND-01, CTL-01, CTL-02 |
| `test/surface-render.test.js` | Surface view state machine, orbit restore, entity mapping, rollback flag | `public/js/surface-controller.js`, `public/js/shared/view-state.js` | RND-02 |
| `test/hud-parity.test.js` | HUD snapshot parity, duplicate detection, target/lap fallbacks, static markup contract | `public/js/shared/hud-parity.js`, `public/index.html` | RND-03 |
| `test/humanoid-rig.test.js` | Closed-manifold volumes, joint coincidence, deterministic poses, walk/mining angles, 132/72/2 LOD hysteresis, culling, no sprite path | `public/js/shared/humanoid-3d.js` | RND-05 |
| `test/renderer-surface.test.js` | Renderer peer interpolation, beam drop/count, resource pins, peer fade/clear, event forwarding | `public/js/renderer.js` | RND-07 |
| `test/surface-math.test.js` | Surface tangent/down-angle and projection helpers | `public/js/shared/sphere-interaction.js` | RND-01 |
| `test/test-count.test.js` | TAP summary parsing, marker verification, failure propagation | `scripts/test-count.mjs` | QA-01 |
| `test/tetra-ship.test.js` | Five-tetrahedron ship geometry and incident models | `public/js/shared/tetra-ship.js` | EVT-02 |
| `test/version.test.js` | Version slots, lineages, fix/bump, semver ordering | `scripts/check-version.mjs` | SSOT-03 |
| `test/orbit-controls.test.js` | Orbit input SSOT: four arrow signs, drag/arrow inverse relation, absolute drag ≤1 px at eight orientations, Shift ratio, dt clamp, 10 000 seeded steps, polarity vocabulary | `public/js/shared/orbit-controls.js` | CTL-01 |
| `test/zoom-levels.test.js` | Ladder constants, floor/rounding invariants, idempotent `applyOrbitFarZoom` | `public/js/shared/zoom-levels.js` | CTL-04 |
| `test/control-mode.test.js` | Five-state control-mode derivation over every input combination, labels, toggle gating, announcements | `public/js/shared/control-mode.js` | CTL-05 |
| `test/control-prefs.test.js` | Defaults, corrupt-record repair, legacy migration, write isolation, blocked storage | `public/js/control-prefs.js` | CTL-05 |
| `test/pointer-router.test.js` | Pointer roles/precedence, capture and capture failure, pinch demotion/scale/dead zone, third finger, cancel-all, tap slop, capture-ownership grep | `public/js/shared/pointer-router.js` | CTL-06 |
| `test/world-core.test.js` | Authoritative world: players, scoring, breaks, locks, resources, robots, persistence, incidents, surface poses, seeded routes, resolver mining, supply placements | `lib/world-core.js` | SRV-01, SRV-02, SRV-03, SRV-04, EVT-01, OPS-03 |

## Rules

- A behaviour change updates its owning test file and the row above if ownership changes.
- New test files require a row here and a matching source module; orphan files fail review.
- Tests must not spawn browsers or require network access; browser acceptance lives in
  `scripts/verify-*` and `scripts/acceptance-*` and is documented by its issue.
- The total count in `README.md`/`ARCHITECTURE.md` is generated by `node scripts/test-count.mjs`;
  CI runs the suite, tees the TAP log, and verifies the markers against it.
