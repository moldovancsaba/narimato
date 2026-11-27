# HANDOVER — NARIMATO v2 (2026-11-27)

This file is for the next agent. Read it before changing anything.

## Repository / live

- Repo: `moldovancsaba/narimato`
- Working copy: `/Users/Shared/Projects/step/icosa-arcade`
- Live public playtest: https://moldovancsaba.github.io/narimato/
- Status page: https://moldovancsaba.github.io/narimato/status.html
- Public assets are on `gh-pages`; the last deployed build is **final10**. It is **not fixed** for the
  regressions below.
- Approved build/tag: **`v2-approved-2026-11-26`** = `e7f65e5` (Merge PR #145). `v2-live` still points
  at the previously approved build. The current live playtest is not user-approved.
- Current main at handover: see `git log -1`. Worktree is clean after this handover commit.

## Baseline

- Tests: **575/575 pass** (`npm test`).
- Docs: `node scripts/check-docs.mjs` OK (59 markdown files).
- CI: test 20/22, docs, gds-ui, a11y chromium+webkit were green on the latest docs PRs.
- Board: Project 80 — 88 Done, 5 Todo, 6 Backlog (SOONER), 1 Roadmap (LATER), 1 Idea Bank (SOMEDAY).

## Current state: contracts complete, code NOT fixed

The five regressions reported at **2026-11-26 20:14 CET** are documented but not implemented.

Docs are binding. Read in this order:

1. [docs/GUARDRAILS.md](docs/GUARDRAILS.md) — documentation is binding; renderer rules are release blockers.
2. [docs/RENDERER_TECHNOLOGY.md](docs/RENDERER_TECHNOLOGY.md) — mandatory solid sphere, front-clipped
   active-leaf fill, slerp great-circle arcs; partial-face arc-only/dark holes are strictly prohibited.
3. [docs/SURFACE_ADJACENCY.md](docs/SURFACE_ADJACENCY.md) — edge-contact neighbours only, previous
   triangle valid, unlimited turns, shortest-turn metric, tie rules.
4. [docs/CONTROLS_APPROVED.md](docs/CONTROLS_APPROVED.md) — orbit arrows are free camera movement;
   release/stop snaps like mouse; surface arrows are edge-neighbour triangle movement.
5. [docs/CAMERA_APPROVED.md](docs/CAMERA_APPROVED.md) and
   [docs/CAMERA_LANDING_PROCESS.md](docs/CAMERA_LANDING_PROCESS.md) — four discrete camera stops,
   orbit snap, surface discrete wheel/pinch steps.
6. [docs/V2_REGRESSION_FIX_PLAN.md](docs/V2_REGRESSION_FIX_PLAN.md) — R1–R5 root causes, R1 solution,
   Phase 0–5 implementation plan.
7. [docs/TRIANGLE_RULES.md](docs/TRIANGLE_RULES.md), [docs/GAME_V2.md](docs/GAME_V2.md).

## Active board issues (all Todo / Ready)

- **#162** R1 — renderer: fill every visible active leaf with front-clipped spherical arcs.
- **#163** R2 — orbit arrow/WASD movement is disabled.
- **#164** R3 — camera: one four-stop ladder; remove `surfaceDistance` override jump.
- **#165** R5 — acceptance for all regressions.
- **#166** R4 — edge-contact adjacency + correct surface next-triangle movement.

## Root causes (historical, do not repeat)

| Regression | Root cause / commit |
|---|---|
| R1 dark/incomplete surface | `allFront` fill gate in `v2/public/app.js`; partial limb leaves arc-only; no spherical front clipping. Docs contradiction removed in `8190e59`; `allFront` gate remains in code. |
| R2 orbit arrows dead | `23e6cac` gated movement behind `surfaceActive()`. Approved `e7f65e5` ran movement in all views. |
| R3 camera jumps/doesn't stop | Two states: `stepDistance()` ladder + separate `surfaceDistance = 1.15` after `step > 2.5` (`bbf74f7`, threshold `23e6cac`). |
| R4 random surface targets | No adjacency graph; `nearestLeafCenter`/`startTurn` scan all leaves (`23e6cac`). |
| R5 four options | Four directional keys select four global winners; not edge-neighbours; split children can create a local four-children pattern. |

Approved build `e7f65e5` is the reference for orbit arrows and arc rendering. Do not “restore” the
broken `23e6cac` flat-chord renderer.

## Non-negotiable rules

- Documentation is binding and mandatory. Do not implement behaviour that contradicts it.
- Flat chords, flat facet fills, `allFront`-only fill, partial leaf left arc-only/dark, back/limb
  projections and render-only meshes are **strictly prohibited**.
- Every visible active leaf must be filled with its viewer colour over its visible spherical region,
  including leaves clipped by the limb.
- Surface neighbours are **edge-contact only**; vertex-only contacts are not neighbours.
- The previous triangle is valid; the gamer can turn unlimited times and go back.
- Orbit arrows are free camera movement; release snaps to closest triangle centre, shortest turn,
  ties right, every orbit distance.
- Surface wheel/pinch camera distance stops at discrete steps.
- Do not use fixed 90° turns, fixed four-option target selection, or a separate orbit-only controller.
- No new rule without updating the owning document first and getting user approval.

## Next action

Start **Phase 1 / #162** only. Replace `allFront` with spherical front-hemisphere clipping and fill
every visible leaf. Do not start Phase 2–4 in the same change. Produce real browser screenshots; do
not claim fixed from code inspection. Then proceed in the documented Phase order.

## Verification commands

```bash
npm test
node scripts/check-docs.mjs
node scripts/test-count.mjs
npm run test:v2:camera
npm run test:v2:pointer
```

## Git / deployment notes

- Commit docs and code separately; do not mix contract changes with implementation.
- Public deploy is separate (`gh-pages`); updating `main` does not update the live playtest.
- Do not move `v2-live` or `v2-approved-2026-11-26` until the user approves the fixed build.
- The `docs/plan/` images are historical investigation evidence, not acceptance proof for future fixes.
