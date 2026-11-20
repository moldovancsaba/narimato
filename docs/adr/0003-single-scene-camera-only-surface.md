# ADR-0003: One spherical icosahedron, one renderer, camera-only surface change

status: Accepted
date: 2026-11-20
supersedes: none
superseded_by: none
keys: RND-01, RND-02, RND-03, RND-04, RND-06

## Context

The planet is a regular spherical icosahedron: 12 vertices, 30 equal edges, 20 congruent spherical
triangles, adaptively subdivided into a stable label tree. Earlier delivery kept two renderers:
an orbital Canvas 2D renderer and a separate surface Canvas overlay with its own projection,
palette and HUD. That duplication caused visually different cells, two HUDs and separate bug
classes (the v3.58 surface-camera experiment failed and was reverted).

The confirmed camera model is a carrier point on a hidden concentric sphere with a
parallel-transported tangent frame, fixed focal length, wheel-driven radius, and analytic
front-surface WebGL rendering for the isolated viewer (see `narimato-physics.md`).

## Decision

- There is exactly **one scene**: one `World` leaf tree, one set of cells, owners, materials,
  markers and labels, at every camera distance.
- There is exactly **one renderer path**. Surface mode is a **camera + control-mode change**
  behind the existing `IcosaRenderer`, using a `SurfaceCamera` that implements the same camera
  interface (`project`, `unprojectView`, `viewAxis`, width/height, zoom/distance).
- The separate surface renderer/overlay is deleted. Surface UI adds only controls, target, lap
  and exit affordances on top of the same HUD DOM.
- No second terrain generation, no LOD swap that changes the object, no generated planet copy.
  Derived visual triangles are rebuilt from the live authoritative leaves.
- No automatic zoom on click/break; zoom is manual; exit returns to the farthest orbit constant.

## Consequences

- One bug class to fix and one place to change colour, material and picking rules.
- The upstream renderer becomes the critical path for both views; its camera interface must be
  stable and unit-tested.
- HUD/DOM parity becomes a hard acceptance test, not a visual review.
- Any future view (e.g. approach, cockpit, telescope) must be expressed as a camera, not a
  renderer.

## Alternatives considered

- **Keep both renderers and share a palette module**: rejected; it preserves duplicated
  projection, HUD and interaction code and cannot guarantee pixel/material parity.
- **Switch to a general 3D engine**: rejected; it would replace the spherical label/picking model
  and add a runtime dependency (ADR-0001).
- **Generate a mesh per LOD**: rejected; the planet is analytic and the leaf tree is the single
  source of truth.

## Links

- [narimato-physics.md](../../narimato-physics.md) — carrier camera, fixed focal, WebGL
  front-surface solution and failure history.
- [ALGORITHM.md](../../ALGORITHM.md) — spherical geometry, labels and picking.
- Issues: [RND-01](../ISSUE_MAP.md), [RND-02](../ISSUE_MAP.md), [RND-03](../ISSUE_MAP.md),
  [RND-04](../ISSUE_MAP.md), [RND-06](../ISSUE_MAP.md).
