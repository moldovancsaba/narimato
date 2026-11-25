# NARIMATO v2 — current delivery status and test guide

**As of 2026-11-25.** Single status/entry document for the v2 playtest. Durable contracts live in the
camera/control/game docs; the project board owns remaining work (issues #137–#142).

## 1. Public test build

- **Play online:** https://moldovancsaba.github.io/narimato/
- **Status page:** https://moldovancsaba.github.io/narimato/status.html
- **Phase index:** https://moldovancsaba.github.io/narimato/phases.html
- **Camera phase links:** `/?phase=0` … `/?phase=3`
- **Delivery phase pages:** `/phase-0.html` … `/phase-4.html`
- Pages uses a **browser-state fallback** because it is static. `npm start` runs the Node build with
  **server-authoritative** state at `http://127.0.0.1:4180/`.

## 2. What exists

### Clean v2 engine
- `v2/server.js` — zero-dependency HTTP server: `/api/health`, `/api/state`, `/api/collect`, static.
- `v2/server/game.js` / `v2/public/game-rules.js` — shared game rules (server + Pages fallback).
- `v2/public/geometry.js` — icosahedron/subdivision geometry; no legacy imports.
- `v2/public/renderer.js` — WebGL ray–sphere surface + geodesic arc edges, front surface only.
- `v2/public/camera.js` — final four-step camera + landing arm.
- `v2/public/controls.js` — non-Euler quaternion heading/turn/move with parallel transport.
- `v2/public/app.js` — session, faces, collection, 4 robots, gamer, clipped mesh overlay, HUD.
- `v2/test/` — camera, controls, game-rule and server tests. **572/572 tests pass.**

### Game rules (implemented)
- Surface is the collectible: 1280 spherical geodesic faces at three subdivisions; no pickup icons.
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

### Controls (implemented, one open pointer gap)
- **Non-Euler movement:** player position + heading quaternion, parallel transport; A/Left turn left,
  D/Right turn right, W/Up forward, S/Down backward; same in orbit and landed.
- Browser pole test crossed the north pole continuously: `playerDir.y +0.99 → −0.31`, no stop.
- Cursor states verified: `grab` → `grabbing` → `grab`.
- Landed walking collects the face walked through; click collects a face.
- Pointer drag rotates the quaternion frame in both axes with no pole/limit clamps, **but exact
  grabbed-point follow (`shortestArcQuat`) is still open** (issue #137).
- Contract: [CONTROLS_APPROVED.md](CONTROLS_APPROVED.md).

## 3. How to test

1. Open the public URL; wheel/pinch or 1–4 through the steps.
   - Step 1: whole planet, 25% space above, centre at 50%.
   - Steps 2–4: horizon on the 25% line; gamer absent until Step 4.
   - Step 4: gamer visible on surface in the lower frame.
2. Drag the planet: cursor `grab` → `grabbing`; rotation continues through all directions/poles.
3. Keyboard: A/D and Left/Right turn; W/S and Up/Down move; verify near/through the pole.
4. Click a surface face to collect; at Step 4 walk with WASD and collect faces crossed.
5. Four robots tick/respawn; do not block progress. At 30/30 the planet advances.
6. Phase links: `/phases.html`, `/phase-0..4.html`, `/?phase=0..3`.

## 4. Evidence

- Tests **572/572**; docs gate 54 files/1016 links; CI green (Node 20/22, docs, GDS, a11y
  Chromium + WebKit).
- Browser verification: four steps; step 4 horizon/gamer; walking collection; pole crossing;
  cursor states; pointer drag axes.
- Public build verified at the URL above.
- Merges: `656f138` (final camera/controls/status fixes), `13d670c` (non-Euler movement).
- Tags: `v2-phase-0..6`, `v2-live`, `legacy-v3.58.0-retired`.

## 5. Known gaps (board issues)

1. **#137** pointer exact `shortestArcQuat` grabbed-point follow.
2. **#138** Step-4 local surface triangle density/visual acceptance.
3. **#139** automated 25% horizon row + transition stability test.
4. **#142** v2 GDS HUD + accessibility release gate.
5. **#140** server-authoritative public hosting (Pages is browser-state).
6. **#141** replace gamer/robot markers with approved models.
7. Robots/gamer remain simple markers; v2 release evidence is not complete.

## 6. Rollback and links

- [V2_ROLLBACK.md](V2_ROLLBACK.md) — phase tags/releases, public phase pages, commands.
- [ARCHITECTURE.md](../ARCHITECTURE.md) — v2 architecture.
- [SSOT.md](SSOT.md), [GAME_V2.md](GAME_V2.md), [PLAN_GAME_V2.md](PLAN_GAME_V2.md).
- [CONTROLS_APPROVED.md](CONTROLS_APPROVED.md), [CAMERA_APPROVED.md](CAMERA_APPROVED.md),
  [CAMERA_LANDING_PROCESS.md](CAMERA_LANDING_PROCESS.md).
- [RELEASE_EVIDENCE.md](RELEASE_EVIDENCE.md).
