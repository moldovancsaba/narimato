# v2 regression fix plan — root causes and ordered implementation

**Status: plan only; no code changes.**
Source of truth for rules: [TRIANGLE_RULES.md](TRIANGLE_RULES.md),
[SURFACE_ADJACENCY.md](SURFACE_ADJACENCY.md), [RENDERER_TECHNOLOGY.md](RENDERER_TECHNOLOGY.md),
[GUARDRAILS.md](GUARDRAILS.md). Documents are binding; no code may contradict them.

## R1 — First screenshot: incomplete/dark active leaf fills

**Report.** Planet shows only some green faces, large dark/teal regions and irregular small child
faces; unacceptable.

**Root cause.** `v2/public/app.js` fills a leaf only when **all** sampled boundary points are front
(`allFront`). Partial faces near the limb are arc-only, leaving the base sphere dark. The active leaf
set is also non-conforming because robots split some faces; the renderer has no spherical front-region
clipping. Commit `4dcc083` introduced the `allFront` fill gate while restoring arcs; commit
`23e6cac` introduced the mixed-level active-leaf rendering.

**Required fix.**

- For every active leaf, fill its **visible spherical region**, bounded only by slerp-sampled
  great-circle arcs; clip the region to the front tangent hemisphere and include the limb
  intersection arc where needed.
- No flat chord fill, no back/limb vertex projection, no dark holes from skipped partial faces.
- Alternatively move active-leaf colour into the ray–sphere shader with per-leaf IDs/colours; the
  arc boundary contract still applies.
- No render-only mesh or triangle-count change.

**Acceptance.** Real orbit/surface screenshots show all visible active leaves coloured green/red
within their arc boundaries; the only dark area is real sky; no flat chords or overlaps.

## R2 — Orbit arrow keys do nothing

**Root cause.** Current `keydown` calls surface movement only when `surfaceActive()` is true. The
approved build `e7f65e5` collected WASD/arrow keys in `walkKeys` and ran `moveGamer` in every view.
Commit `23e6cac` rewrote input with `if (surfaceActive() && ...)`, removing orbit movement. It was
never restored.

**Required fix.** One shared movement controller for orbit and surface:
- arrows and WASD are never gated to surface only;
- orbit arrows/WASD reproduce the approved free camera movement around the planet; continuous while
  held, no distance change;
- when orbit arrow input stops, the planet snaps to the closest active triangle centre exactly like
  mouse release: shortest turn, ties right, at every orbit distance;
- surface uses the edge-neighbour movement contract;
- no orbit-only gating and no duplicate controller for orbit arrows.

**Acceptance.** Real browser: orbit arrows move freely, release snaps to closest centre at every orbit
distance; surface movement uses only edge-neighbours.

## R3 — Camera does not step/stop between orbit and surface

**Root cause.** Two camera states:
- orbit/step ladder `stepDistance()` from `PHASES`;
- separate `surfaceDistance = 1.15` used whenever `step > 2.5` (commit `bbf74f7`; threshold from
  `23e6cac`).

Crossing `step > 2.5` switches distance, pitch and arm discontinuously; wheel on the surface changes
`surfaceDistance` only, not the step ladder; returning to orbit jumps back.

**Required fix.** One camera state with four discrete stops:
`4.40 → 1.50 → 1.20 → surface`. Each step must settle exactly and stop. Orbit drag only rotates the
planet and never changes distance; on release the planet snaps to the closest triangle centre at the
current orbit distance (shortest turn, ties right), at **every** orbit distance. Surface wheel/pinch
dolly changes in discrete steps and stops at each step; range 1.02–1.70 R, default 1.15 R. Pitch/arm
solve at every stop; camera transitions remain 0.5 s eased. Remove the
`surfaceActive()` distance override or replace it with an explicit continuous value that also updates
the stop state.

**Acceptance.** Browser test drives all four stops forward and backward, verifies each stop settles,
no jump at 2.5, horizon stays 25% at every stop.

## R4 — Surface arrows go to random triangles

**Root cause.** `v2/public/app.js` uses `nearestLeafCenter` over **all active leaves** and
`startTurn` over all leaves scored by a side vector. There is no edge-adjacency graph. `currentLeaf`
is not guaranteed to still exist after a split. Introduced in `23e6cac`.

**Required fix.** Build and maintain an active-leaf **edge-contact adjacency graph**:
- neighbours are edge-contact triangles only;
- handle parent/child split sides with multiple child edges (up to 24 per level-1 triangle under the
  current depth);
- previous triangle is a valid neighbour and can be faced/moved back to;
- no limit on repeated turns;
- forward/back/left/right target only edge-neighbours;
- “closest” means **shortest turn from the current facing**, not centre-to-centre distance;
- after any arrival the camera rig turns to the next possible forward direction, literally aims at
  that next centre if it is not already front; ties right;
- forward target: shortest turn among front edge-neighbours; ties right;
- backward target: shortest turn among edge-neighbours behind; ties left-behind;
- left/right: every edge-neighbour centre on that side is a candidate, including all child centres
  on a split side; choose shortest turn; ties right;
- input lock 0.5 s; one buffered input.

**Acceptance.** Graph tests for conforming (3), split-side (6/12/24) cases; browser movement lands only
on true edge-neighbours; previous can be faced and revisited.

## R5 — “Four options” explanation

**Root cause.** The four options are the four keyboard directions; each selects one globally
best-scoring leaf. They are not geometry neighbours. Additionally, split triangles can create four
children meeting around a split point — a non-conforming local pattern, not a valid four-way movement
rule.

**Correct contract.** Use the edge-contact adjacency graph and movement rules in
[SURFACE_ADJACENCY.md](SURFACE_ADJACENCY.md). There is no fixed four-option set. A conforming triangle
has 3 edge-neighbours; a split hierarchy can have more (derived max 24 at level 1 with level-4
neighbours).

## Order of implementation

1. **Documentation lock** — contracts for orbit free arrow movement/snap, surface edge adjacency, and
   discrete surface camera steps are written in SURFACE_ADJACENCY/CONTROLS_APPROVED. Only
   implementation constants remain; do not invent new behaviour.
2. **Adjacency core** — pure edge-contact graph + tests (conforming and split sides); no rendering
   change yet.
3. **Input/camera ladder** — one four-stop camera state; restore orbit arrow movement; remove
   surface distance override; tests.
4. **Surface movement** — use adjacency graph for forward/back/left/right; camera facing/tie rules;
   previous allowed; 0.5 s lock.
5. **Renderer active-leaf spherical fill** — front-clipped arc fill for every leaf; no flat chords;
   real screenshots.
6. **Full acceptance** — browser tests for orbit arrows, four-stop ladder, surface neighbours,
   previous revisits, arc rendering, first screenshot; 575+ tests, CI/a11y green.

## Guardrails for the fix

- No flat chords/flat facet fills; no derived mesh; no render-only tessellation.
- No hardcoded 90° turns; no four-direction target selection.
- No “previous triangle excluded” rule.
- No second camera/input path.
- No code change that contradicts docs; if a doc is wrong, fix the doc first with approval.
- Do not call fixed without real browser evidence for each R1–R5.
