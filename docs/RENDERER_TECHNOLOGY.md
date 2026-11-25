# Renderer technology contract — how the planet must work, and what is NOT OK

This document records the core renderer/camera technology; the approved v2 camera contract is in
[CAMERA_APPROVED.md](CAMERA_APPROVED.md). and the concrete anti-patterns that caused
the surface regressions. It is binding for renderer, camera and control work; see also
[GUARDRAILS.md](GUARDRAILS.md) and [FIXES.md](FIXES.md).

## 1. One planet, one surface

- One Canvas 2D renderer (`public/js/renderer.js`) draws the planet; no second renderer/canvas/HUD.
- The authoritative geometry is the **active leaf set** from `World.leaves`: one render entry per
  active leaf. Triangle count equals the active leaf count.
- Geometry is a **solid opaque sphere**: an opaque shaded sphere base clipped to the exact projected
  silhouette, with cell boundaries drawn as great-circle arcs on top.
- No derived mesh, no cached seed globe, no per-camera mesh, no LOD face copies.
- No flat facet fills. The sphere surface is solid shading; cells are **arc boundaries**, not flat
  coloured triangles.
- Surface is front-only: no hidden hemisphere, no back-face geometry, no translucent covering.

## 2. Silhouette and visibility

- The clip is the **projected silhouette** of the sphere for the active camera (screen-centred circle
  for product cameras; tangent-circle projection for an explicit off-centre basis).
- Face visibility uses the **tangent plane** `x·P = 1` (`P` = camera eye): a face is in view only
  where its sampled boundary is in front of that plane.
- A face may be included when part of its boundary is in front, but **only the original boundary
  segments that lie in front are stroked**.
- The artificial **tangent-cut chord is never stroked**: it is not a cell boundary and produced the
  wavy double-edge/back-side-looking loops.
- Every cell boundary is sampled with slerp along the great circle: 24/20/16/10/8 samples by depth.
  No straight-chord edges.
- Sphere-attached labels/markers/arcs are clipped to the silhouette and must be driven by current
  visible-face coordinates only; stale coordinates are forbidden (they drew rings on the planet).
- No charge-arc rings, graticule, latitude/longitude lines or pole labels. They are cartography, not
  icosahedron geometry.

## 3. Camera model

- Orbit uses `SphereCamera`; surface uses the approved `CarrierCamera` (camera held at the
  pilot/cursor anchor; parallel transport; fixed-focal radius dolly).
- The surface camera is never overwritten with Euler yaw/pitch each frame.
- Mouse drag rotates the object with exact point follow (`shortestArcQuat`); pointer drag must never
  be cancelled by a follow hack. The full approved input model is in
  [CONTROLS_APPROVED.md](CONTROLS_APPROVED.md).
- Wheel/pinch change the carrier radius, not the field of view.

### Horizon anchor

L2, L3 and L4 must place the horizon on the **same screen row: 10% from the top** (y = 0.10 ×
viewport height). The camera's vertical pitch is solved per distance (`θ = asin(1/d) − φ`, with φ the
angle for the 10% row at the chosen focal), so the horizon does not drift between zoom levels. L1
(orbit) has no horizon.

### Four zoom levels (core framing contract)

| Level | Name | Camera | Pitch from nadir | Framing |
|---|---|---|---|---|
| L1 | Orbit | 3.20 R | 0° | Whole sphere, centred, no horizon |
| L2 | Halfway | 2.10 R | 13° | Surface fills lower ~70%, horizon top band |
| L3 | 80% | 1.44 R | 24° | Surface fills frame, horizon top |
| L4 | Landed (Option A) | **1.18 R** | **36°** | Close to surface; horizon fixed at the 10% top anchor; ship/pilot + terrain visible |

L4 literal 30 m is **not approved** with the current pilot/terrain scale. Do not ship it without a
separate metres-per-world-unit scale model.

## 4. What is NOT OK — never reintroduce

| Anti-pattern | Why it is banned |
|---|---|
| Second renderer/canvas/HUD/scene | Violates one-scene rule; duplicate truth |
| Derived surface mesh / cached globe | Separate geometry, broken arcs, user rejection |
| Render-only triangle tessellation/LOD copies | Extra triangles not cells |
| Flat coloured facet fills | Not a spherical arc surface; looks like 2-sided shell |
| Transparent/translucent sphere or fills | Shows back side/space through the planet |
| Glass-dome FX, halo, rim shells | Hollow/2-sided edge look |
| Back/other-side arcs stroked | Immediate leak |
| Stroking the tangent-cut chord | Wavy double-edge loops at the limb |
| Charge-arc rings/stale marker coords | Back-side rings and fake surface detail |
| Graticule / latitude-longitude / pole labels | Cartography, not icosahedron geometry |
| Euler yaw/pitch camera overwrite | Cancels mouse drag, breaks poles |
| Camera follow hacks | Mouse/cursor regression |
| Fake acceptance/metrics-only proof | Green tests with broken visuals |

## 5. Verification (must pass before claiming fixed)

1. Four real-renderer captures at L1–L4 with HUD hidden, plus limb close-ups.
2. Check: solid opaque sphere; no back-side arcs; no wavy limb loops; no cartography; no flat facet
   fills; arcs visibly curved; sky top at L4.
3. Zoom/limb inspection at full resolution; if any loop/leak appears, do not ship.
4. `npm test`, `docs:check`, `evidence:check`, CI/a11y, and the relevant acceptance scripts.

## 6. Incident map

- #77 removed the second surface scene.
- #80 restored the carrier camera.
- #82 restored one triangle per active leaf.
- #88/#91/#93/#95 removed hollow shell, glass, back arcs, cut-chord loops and stale rings.
- This document plus `GUARDRAILS.md` is the prevention contract.
