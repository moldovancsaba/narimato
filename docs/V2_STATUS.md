# NARIMATO v2 — current delivery status and test guide

**As of 2026-11-25. This is the single status/entry document for the v2 playtest.**
Docs are contracts; the board owns delivery state; the live URL is the test target.

## 1. Public test build

- **Play online:** https://moldovancsaba.github.io/narimato/
- **Phase index:** https://moldovancsaba.github.io/narimato/phases.html
- **Camera phase links:** `/?phase=0`, `/?phase=1`, `/?phase=2`, `/?phase=3`
- **Delivery phase pages:** `/phase-0.html` … `/phase-4.html`
- This Pages build runs the same game rules with a **browser-state fallback** because Pages is static.
- **Authoritative build:** `npm start` (Node server, server-authoritative state) at `http://127.0.0.1:4180/`.

## 2. What exists now

### Clean v2 engine
- `v2/server.js` — zero-dependency Node HTTP server, `/api/health`, `/api/state`, `/api/collect`,
  static client.
- `v2/server/game.js` — server-authoritative game state.
- `v2/public/game-rules.js` — shared rules used by the server and the Pages fallback.
- `v2/public/geometry.js` — icosahedron and subdivision geometry (no legacy imports).
- `v2/public/renderer.js` — WebGL ray–sphere surface and geodesic arc edges.
- `v2/public/camera.js` — final four-step camera + landing arm.
- `v2/public/app.js` — game session, controls, surface faces, robots, gamer, HUD.
- `v2/test/` — camera, rules and server tests.

### Game rules (implemented)
- Surface is the collectible: spherical geodesic faces, no separate pickup icons.
- 1280 faces at three subdivisions; each face has 3 breaking levels.
- Player target: **30 breaks**; at 30 the planet advances and progress resets.
- Four server robots tick; each respawns as a new robot when it reaches its target (5).
- Silent; no other challenge/interruption.
- Surface field and robots reset on planet transition.

### Camera (implemented, final contract)
- One camera, constant 50° FOV, no masks/cuts/second camera/FOV zoom.
- Steps: **4.40 R / 1.50 R / 1.20 R / 1.01 R radial**.
- Horizon fixed at **25%** of viewport height in Steps 2–4; Step 1 planet top 25%, centre 50%.
- Step 4: **1.4% R backward camera arm**, gamer hidden in Steps 1–3, visible on the surface at Step 4.
- Distance-driven pitch; wheel/pinch step the camera; keys 1–4 jump steps.
- Final screenshots: `docs/plan/v2-final-step1.png` … `v2-final-step4.png`.
- Contract: [CAMERA_APPROVED.md](CAMERA_APPROVED.md),
  [CAMERA_LANDING_PROCESS.md](CAMERA_LANDING_PROCESS.md).

### Controls (implemented)
- **WASD and arrow keys are identical**: A/left turn left, D/right turn right, W/up forward,
  S/down backward; same in orbit and landed.
- Landed walking collects the face the gamer walks through.
- Click a surface face to collect it.
- Wheel/pinch move the camera through the four steps.
- Pointer drag rotates the view.
- Contract and **partial status**: [CONTROLS_APPROVED.md](CONTROLS_APPROVED.md).

## 3. How to test

1. Open the public URL.
2. **Step framing:** use wheel/pinch or 1–4.
   - Step 1: whole planet, 25% space above, centre at 50%.
   - Steps 2–4: horizon on the 25% line; gamer absent until Step 4.
   - Step 4: gamer visible on the surface in the lower frame.
3. **Collecting:** click visible surface faces. Progress increases by one per break.
4. **Walking:** at Step 4 hold W/A/S/D or arrows; the gamer moves and collects faces walked through.
5. **Robots:** four robot counters tick and respawn; they do not block player progress.
6. **Planet transition:** reach 30/30; planet number increments and progress resets to 0/30.
7. **Phase links:** open `/phases.html`, `/phase/0..4` or `/?phase=0..3`.

## 4. Evidence

- Tests: **569/569 pass** (`npm test`).
- Docs gate: 53 markdown files, 995 links, 0 findings.
- Latest CI: green (test 20/22, docs, gds-ui, a11y chromium + webkit).
- Real screenshots at every camera step: `docs/plan/v2-final-step1..4.png`.
- Online verification: public URL loaded in Chromium, four-step zoom reached Step 4, click collected,
  landed walking collected, no page errors.
- Merges: camera/landing/control work merged on `main`; latest implementation merge `6108689`
  (PR #131).
- Phase tags/releases: `v2-phase-0..4`, `v2-live`, `legacy-v3.58.0-retired`.

## 5. Known gaps / not yet accepted

1. **Pointer point-follow is numerically solved** on a quaternion camera axis with no pole/limit
   clamps; a real drag test shows about 10 px residual. The literal shortest-arc object-quaternion
   algorithm is still the next refinement. [CONTROLS_APPROVED.md](CONTROLS_APPROVED.md).
2. **Horizon/transition automation** is not yet measured frame-by-frame; current evidence is real
   screenshots, not an automated 25% ±1% row test.
3. **Step-4 surface triangle visibility** shows local arc faces but is sparse; visual acceptance of
   triangle density at landing is still pending.
4. **Gamer and robots are simple markers**, not finished character models.
5. **v2 GDS HUD and accessibility release gates** are not complete; the public HUD is a minimal
   playtest HUD.
6. **Pages build is browser-state**, not server-authoritative; the Node build is authoritative.
7. **Legacy game is retired from the product entry** but preserved for rollback; it is not deleted.

## 6. Rollback and phase links

- Every delivery phase has a tag, release, and rollback command:
  [V2_ROLLBACK.md](V2_ROLLBACK.md).
- Public phase pages: `/phase-0.html` … `/phase-4.html`.
- Camera phase pages: `/?phase=0..3` and `/phases.html`.
- Local rollback: `git checkout v2-phase-N && node v2/server.js`.
- Legacy rollback: `git checkout legacy-v3.58.0-retired && npm run start:legacy`.

## 7. Documentation map

- [SSOT.md](SSOT.md) — delivery entry and source-of-truth model.
- [CAMERA_APPROVED.md](CAMERA_APPROVED.md) — binding camera contract.
- [CAMERA_LANDING_PROCESS.md](CAMERA_LANDING_PROCESS.md) — 25% horizon, steps, landing arm.
- [CONTROLS_APPROVED.md](CONTROLS_APPROVED.md) — pointer/keyboard contract and partial status.
- [GAME_V2.md](GAME_V2.md) — game rules and scope.
- [PLAN_GAME_V2.md](PLAN_GAME_V2.md) — implementation/retirement waves.
- [V2_ROLLBACK.md](V2_ROLLBACK.md) — per-phase links and rollback.
- [RENDERER_TECHNOLOGY.md](RENDERER_TECHNOLOGY.md), [GUARDRAILS.md](GUARDRAILS.md),
  [RELEASE_EVIDENCE.md](RELEASE_EVIDENCE.md).
