# Fixes log — renderer, controls and gates

Durable record of the corrective work landed after the first surface delivery. The development
rules derived from these incidents live in [GUARDRAILS.md](GUARDRAILS.md). Each
entry states the cause, the fix and the verification; the board owns status. Commit
links resolve on the repository at
[github.com/moldovancsaba/narimato](https://github.com/moldovancsaba/narimato).

## 2026-11-21 — Soak gate honored the scenario duration

**Cause.** `scripts/load-test.mjs` clamped `DURATION_SECONDS` to 3600 s, so the
120-minute soak ran 60 minutes and the gate still reported PASS.

**Fix.** Duration is honored up to a 4-hour safety cap; `perf-gate` fails any run
shorter than `scenario.durationSeconds` (5 s setup tolerance). The clamped attempt
was marked invalid and re-run for 120.02 minutes.

**Verification.** Regression tests; true soak PASS (HTTP p95 1 ms, loop p95 22.053 ms,
0 dropped SSE/errors).

Refs: [#71](https://github.com/moldovancsaba/narimato/issues/71),
[PR #72](https://github.com/moldovancsaba/narimato/pull/72).

## 2026-11-21 — Removed the second surface scene (derived mesh + surface camera)

**Cause.** The surface was a separate scene: a third-person `SurfaceCamera` plus a
derived 6000-triangle `live-surface-mesh` drawn over the real planet. It produced
broken spherical arc-triangle overlays and violated the one-renderer contract.

**Fix.** Deleted `surface-camera.js`, `camera-contract.js`, `live-surface-mesh.js`,
the derived-mesh pass, `surfaceView`/`opaqueSurface`/`materialProbe` modes, the
retired `?surface-renderer` flag, the fake two-camera acceptance and ~3,600 lines of
associated code/tests. One `IcosaRenderer` and one active-cell leaf pass remain.

**Verification.** 556 tests at that point; real two-client 7/7 and surface-truth 4/4;
no references to the deleted modules.

Refs: [#77](https://github.com/moldovancsaba/narimato/issues/77),
[PR #78](https://github.com/moldovancsaba/narimato/pull/78),
[PR #79](https://github.com/moldovancsaba/narimato/pull/79).

## 2026-11-21 — Pole-safe carrier camera for the surface

**Cause.** The surface branch overwrote `SphereCamera.yaw/pitch` from the pilot pose
every frame. That canceled mouse drag, reversed the cursor rotation, broke pole
crossing and produced an arbitrary camera angle.

**Fix.** `shared/carrier-camera.js` restores the approved v3.57 carrier model: the
camera is held at the pilot/cursor anchor with parallel transport; mouse drag rotates
the spherical object with exact surface-point follow (`shortestArcQuat`); wheel/pinch
change the carrier radius with fixed focal length.

**Verification.** Carrier tests cover point-follow (dot > 0.9999), pole-continuous
drag, fixed-focal dolly and anchor centring; walking keeps the carrier at the pilot.

Refs: [#80](https://github.com/moldovancsaba/narimato/issues/80),
[PR #81](https://github.com/moldovancsaba/narimato/pull/81).

## 2026-11-22 — One triangle per active leaf

**Cause.** `buildPlanetRenderFaces` subdivided every leaf into up to 256 render-only
child triangles plus LOD copies, so a 20–60-cell world drew thousands of triangles
and internal edges that are not cells.

**Fix.** One render face per authoritative active leaf; no subdivision recursion and
no LOD face copies. Boundary arcs stay slerp-sampled by the renderer edge pass, so
the triangle set equals the leaf set.

**Verification.** Live counts: 20 leaves = 20 faces on a fresh world and 62 = 62 on
the persistent world; CI green; 560/560 tests.

Refs: [#82](https://github.com/moldovancsaba/narimato/issues/82),
[PR #83](https://github.com/moldovancsaba/narimato/pull/83).

## 2026-11-22 — Opaque surface, no hidden back geometry

**Cause.** Hidden back-hemisphere wireframe was drawn under translucent front fills,
the sphere substrate was translucent, and unowned hologram fills were 3–13% alpha,
so background/space and back edges showed through the planet.

**Fix.** Opaque sphere substrate; hidden back wireframe/cage removed; front leaf fills
raised to opaque levels. Front-only culling remains and curved slerp polygons tile the
opaque surface.

**Verification.** Orbit, deep-zoom and surface screenshots show no starfield or back
arcs through the planet; no page errors; tests/a11y gates green.

Refs: [#84](https://github.com/moldovancsaba/narimato/issues/84).

## 2026-11-22 — Clean sphere silhouette, opaque seam-free fills

**Cause.** Cell edges, graticule, labels and markers were drawn without a silhouette clip, so arcs
floated outside the limb. Leaf fills were still semi-transparent, so overlapping leaves showed
double edges/seams and the sphere surface did not read as one closed surface.

**Fix.** All cell fills, cell edges and sphere-attached decorations are clipped to the projected
silhouette circle; hologram and terrain fills are fully opaque; the limb is a clean circle instead
of clipped triangle chords. No geometry/triangle count change.

**Verification.** Real-renderer captures at orbit, deep zoom and surface show a clean silhouette
with no off-sphere strokes and no fill seams; surface-truth 4/4 and two-client 7/7 still pass;
560/560 tests.

Refs: [#88](https://github.com/moldovancsaba/narimato/issues/88).
