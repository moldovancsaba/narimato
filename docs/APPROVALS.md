# Approval ledger

Durable record of user approvals. An approval names the exact build, scope and evidence. Silence,
tests or a plan are not approval.

## v2 playtest build — APPROVED by the user on 2026-11-26

**Tested build**

- `main` commit: **`e7f65e5`** (PR #145)
- Online build: https://moldovancsaba.github.io/narimato/ (Pages final6)
- Tags: `v2-phase-7`, `v2-live`, `v2-approved-2026-11-26`
- Tests: **572/572**; CI/a11y/docs green.

**Approved scope** — based on the user's own test:

- Public online v2 playtest loads and is playable.
- Final four-step camera: 4.40 / 1.50 / 1.20 / 1.01 R; constant 50° FOV; horizon 25%; landing
  1.4% R camera arm; gamer hidden Steps 1–3, visible on the surface at Step 4.
- Non-Euler quaternion heading movement; WASD and cursor keys turn/move the same; pole crossing
  works; no pole stop.
- Pointer drag/cursor behaviour as tested: `grab` → `grabbing` → `grab`; pointer point-follow
  ~5.7 px; no camera clamp/pole stop.
- Surface faces are collectible; 30 breaks clear a planet; landed walking collects faces; four
  robots tick/respawn; silent minimal HUD; next planet.
- Current online Pages browser-state build is accepted for playtesting.

**Not covered by this approval**

- Production server-authoritative public hosting (#140).
- v2 GDS HUD and the full accessibility release gate (#142).
- Approved 3D gamer/robot models (#141).
- Literal `shortestArcQuat` object-Q implementation refinement (#137; behavioural pointer
  acceptance passed).
- Step-4 triangle-density ergonomics (#138; current build accepted, further polish optional).

**Evidence**

- `npm test` — 572/572.
- `npm run test:v2:camera` — Step surface rows 25.00 / 24.88 / 24.88 / 25.00% PASS.
- `npm run test:v2:pointer` — cursor states PASS; point-follow error 5.7 px PASS.
- Camera screenshots: `docs/plan/v2-final-step1..4.png`.
- Board and contracts: [V2_STATUS.md](V2_STATUS.md), [CAMERA_APPROVED.md](CAMERA_APPROVED.md),
  [CAMERA_LANDING_PROCESS.md](CAMERA_LANDING_PROCESS.md), [CONTROLS_APPROVED.md](CONTROLS_APPROVED.md).
