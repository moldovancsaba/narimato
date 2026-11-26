# NARIMATO v2 — current delivery status and test guide

**Status: USER-APPROVED v2 playtest build — 2026-11-26.** Tested build `e7f65e5` (PR #145), Pages
final6, 574/574 tests. Approval scope and exclusions: [APPROVALS.md](APPROVALS.md). Remaining work is
production hosting, GDS/a11y release gate, 3D models and optional literal pointer/triangle refinements.

## 0. Final rules implemented — awaiting user test

The user-confirmed triangle/actor/planet rules in [TRIANGLE_RULES.md](TRIANGLE_RULES.md) are implemented
in the v2 playtest build on 2026-11-26: 20→80→320→1280 hierarchy, per-actor clicks/colours, level-4
all-red, reset when no click is possible, 30 clicks → 3-planet wrap, robots target 30 and respawn on
the same planet, centre-to-centre 0.5 s Bézier movement, 1.02 R surface camera, mouse orbit-only.
The user has not yet approved this new build. The mandatory arc renderer is restored after the
flat-chord regression in commit 23e6cac; see [FIXES.md](FIXES.md).

## 1. Public test build

- **Play online:** https://moldovancsaba.github.io/narimato/
- **Status page:** https://moldovancsaba.github.io/narimato/status.html
- **Phase index:** https://moldovancsaba.github.io/narimato/phases.html
- **Camera phase links:** `/?phase=0` … `/?phase=3`
- **Delivery phase pages:** `/phase-0.html` … `/phase-4.html`
- Pages uses a **browser-state fallback** because it is static. `npm start` runs the Node build with
  **server-authoritative** state at `http://127.0.0.1:4180/`.

## 2. What the player sees

Plain-English strategy, first-load screen and controls: [PLAYER_GUIDE.md](PLAYER_GUIDE.md).

## 3. What exists

### Clean v2 engine
- `v2/server.js` — zero-dependency HTTP server: `/api/health`, `/api/state`, `/api/collect`, static.
- `v2/server/game.js` / `v2/public/game-rules.js` — shared game rules (server + Pages fallback).
- `v2/public/geometry.js` — icosahedron/subdivision geometry; no legacy imports.
- `v2/public/renderer.js` — WebGL ray–sphere surface + geodesic arc edges, front surface only.
- `v2/public/camera.js` — final four-step camera + landing arm.
- `v2/public/controls.js` — non-Euler quaternion heading/turn/move with parallel transport.
- `v2/public/app.js` — session, faces, collection, 4 robots, gamer, clipped mesh overlay, HUD.
- `v2/test/` — camera, controls, game-rule and server tests. **574/574 tests pass.**

### Game rules (implemented)
- Surface is the collectible: active leaf hierarchy starts at 20 level-1 triangles and splits to
  80/320/1280; no pickup icons.
- Each face has 3 breaking levels; player target **30 breaks**; at 30 the planet advances/resets.
- Four server robots tick; each respawns as a new robot on reaching its target; non-blocking.
- Silent; no other challenge/interruption.

### Camera (implemented, final contract)
- One camera, constant 50° FOV; no masks/cuts/second camera/FOV zoom.
- Steps **4.40 / 1.50 / 1.20 / 1.01 R**; horizon **25%**; Step 1 planet top 25%, centre 50%.
- Step 4: **1.4% R rear camera arm**; gamer hidden Steps 1–3, visible on surface at Step 4.
- Distance-driven pitch; wheel/pinch step; keys 1–4 jump.
- Contracts: [CAMERA_APPROVED.md](CAMERA_APPROVED.md),
  [CAMERA_LANDING_PROCESS.md](CAMERA_LANDING_PROCESS.md).
- Screenshots: `docs/plan/v2-final-step1.png` … `v2-final-step4.png`.

### Controls (implemented)
- **Non-Euler movement:** player position + heading quaternion, parallel transport; A/Left turn left,
  D/Right turn right, W/Up forward, S/Down backward; same in orbit and landed.
- Browser pole test crossed the north pole continuously: `playerDir.y +0.99 → −0.31`, no stop.
- Cursor states verified: `grab` → `grabbing` → `grab`.
- Landed walking collects the face walked through; click collects a face.
- Pointer drag now solves the quaternion frame so the grabbed point follows the pointer; measured residual
  **5.7 px** with cursor `grab → grabbing → grab`. Literal object-Q `shortestArcQuat` is still the
  algorithm refinement, but the behavioural pointer test passes.
- Contract: [CONTROLS_APPROVED.md](CONTROLS_APPROVED.md).

## 4. How to test

1. Open the public URL; wheel/pinch or 1–4 through the steps.
   - Step 1: whole planet, 25% space above, centre at 50%.
   - Steps 2–4: horizon on the 25% line; gamer absent until Step 4.
   - Step 4: gamer visible on surface in the lower frame.
2. Drag the planet: cursor `grab` → `grabbing`; rotation continues through all directions/poles.
3. Keyboard: A/D and Left/Right turn; W/S and Up/Down move; verify near/through the pole.
4. Click a surface face to collect; at Step 4 walk with WASD and collect faces crossed.
5. Four robots tick/respawn; do not block progress. At 30/30 the planet advances.
6. Phase links: `/phases.html`, `/phase-0..4.html`, `/?phase=0..3`.

## 5. Evidence

- Tests **574/574**; docs gate 54 files/1016 links; CI green (Node 20/22, docs, GDS, a11y
  Chromium + WebKit).
- Browser verification: four camera steps with **first surface row 25.00 / 24.88 / 24.88 / 25.00%**
  (`npm run test:v2:camera` PASS); pointer/cursor **5.7 px** follow (`npm run test:v2:pointer` PASS);
  walking collection; pole crossing.
- Public build verified at the URL above.
- Merges: `656f138` (final camera/controls/status fixes), `13d670c` (non-Euler movement).
- Tags: `v2-phase-0..7`, `v2-live`, `v2-approved-2026-11-26`, `legacy-v3.58.0-retired`.

## 6. Approval and remaining work

**Approved:** the current playtest build and its behaviour as tested by the user on 2026-11-26 —
camera steps/25% horizon/landing arm/gamer visibility, non-Euler pole-free movement, pointer/cursor
behaviour, surface collection, walking, robots, 30/30→next planet, online Pages build. See
[APPROVALS.md](APPROVALS.md).

Remaining, not covered by the approval:

1. **#140** server-authoritative public hosting (Pages is browser-state).
2. **#142** v2 GDS HUD + accessibility release gate.
3. **#141** replace gamer/robot markers with approved models.
4. Optional refinements: literal object-Q `shortestArcQuat` pointer algorithm and Step-4 triangle
   density polish.

## 7. Rollback and links

- [V2_ROLLBACK.md](V2_ROLLBACK.md) — phase tags/releases, public phase pages, commands.
- [ARCHITECTURE.md](../ARCHITECTURE.md) — v2 architecture.
- [SSOT.md](SSOT.md), [GAME_V2.md](GAME_V2.md), [PLAN_GAME_V2.md](PLAN_GAME_V2.md).
- [TRIANGLE_RULES.md](TRIANGLE_RULES.md), [PLAYER_GUIDE.md](PLAYER_GUIDE.md).
- [CONTROLS_APPROVED.md](CONTROLS_APPROVED.md), [CAMERA_APPROVED.md](CAMERA_APPROVED.md),
  [CAMERA_LANDING_PROCESS.md](CAMERA_LANDING_PROCESS.md).
- [RELEASE_EVIDENCE.md](RELEASE_EVIDENCE.md).
