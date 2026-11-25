# NARIMATO v2 — implementation and retirement plan

**Status: planning only. No v2 code yet.** Companion to [GAME_V2.md](GAME_V2.md) and
[CAMERA_APPROVED.md](CAMERA_APPROVED.md).

## 1. Principles

- Build a **clean engine**, not a modification of the current game. Do not port legacy systems.
- Reuse only the approved geometry/camera math and the GDS UI foundation.
- One feature track: collect 30 triangles → next planet, with four robots. No scope additions.
- Server authoritative; minimal zero-runtime-dependency Node app; one client surface.
- Every phase has a test and a real screenshot; no feature is accepted from mock frames.

## 2. Target architecture

```
v2/
  server.js            HTTP + SSE (or polling) + static files; zero runtime deps
  server/game.js       planet generation, collect, robot AI, transition
  server/store.js      atomic JSON persistence
  public/              index.html, v2 canvas client
  public/renderer.js   ray–sphere + geodesic edges (approved camera math)
  public/camera.js     attached rig, four distances, pitch solver, horizon anchor
  public/ui/           minimal GDS HUD (progress, planet, robots)
test/                  geometry/camera, server rules, transition, acceptance harness
```

- **Server state:** one world, N planets; per planet seed, triangle set (30 player + robot copy),
  4 robots, player progress/planet.
- **API:** `GET /api/state`; `POST /api/collect {triangleId}`; `POST /api/leave` (or auto on 30th
  collect); events for robot progress; minimal auth/session token.
- **Renderer:** WebGL ray–sphere front surface; analytic geodesic edges; fixed focal; no Canvas
  polygon hacks; no derived mesh.
- **Camera:** single attached camera; L1 3.20, L2 2.10, L3 1.44, L4 1.04; pitch 0/8/23.5/53.5°;
  horizon at 10% row; sky from rays that miss the sphere.
- **UI:** GDS HUD only; progress text/live region; keyboard/touch; reduced motion; 200% zoom.
- **Data:** fresh v2 state; no legacy migration required unless preserving player records.

## 3. Implementation waves

### Wave 0 — scaffold and contract
Create the clean v2 tree, server skeleton, test harness, approved camera module. No gameplay.
Acceptance: server starts, static page loads, camera unit tests pass, CI green.

### Wave 1 — planet + geometry
Server generates a spherical triangle planet (30 player triangles + 4 robots); client renders the
approved sphere/arcs with the camera. No interaction yet.
Acceptance: stable planet, triangle count/ids, fixed geometry across camera phases, screenshots.

### Wave 2 — collecting + progress
Click/tap triangle → server validates → progress increments; HUD 0/30; duplicate/invalid clicks
rejected; 30th collect triggers transition to next planet. Robots collect non-blocking.
Acceptance: server tests for validation/idempotency; full loop planet 1→2; accessibility journey.

### Wave 3 — robots
Four server robots move/collect on the surface; client renders them and their collection; never
block player.
Acceptance: deterministic test clock, four robots, visible collection, player can still finish 30.

### Wave 4 — camera phases
Wire one attached rig to the final approved steps **4.40 / 1.50 / 1.20 / 1.01 R** with constant 50° FOV;
solve pitch for the **25% horizon row**; add the fixed **1.4% R landing camera arm**; gamer hidden in
Steps 1–3 and visible on the surface at Step 4; no zoom/masks.
Acceptance: four real screenshots + transition frames, horizon 25% ±1%, gamer visibility rules,
one camera, fixed geometry, no cut/leak.

### Wave 5 — UI/accessibility/release
GDS HUD, keyboard/touch, screen-reader progress, reduced motion, 200% zoom; docs/evidence; release
gate on v2.
Acceptance: a11y gates, 30/30→next planet, release evidence, CI green.

## 4. Cutover / retirement of the current game

1. Freeze the current game; tag it `v3.58.0` / final legacy release; keep the branch for history.
2. Build v2 on the clean tree behind `/` or `/v2`; do not add v2 features to the legacy code.
3. Run v2 acceptance and release gates; collect evidence.
4. Point the product route to v2; keep `/legacy` read-only for one release window if desired.
5. Archive/remove legacy systems (surface/events/story/audio/arcs/etc.) from the active product.
6. Update README/GA/SSOT to the v2 contract; mark the legacy game retired; no dual maintenance.
7. Back up legacy DATA_DIR before cutover; v2 starts fresh unless a migration is explicitly approved.
8. Rollback: keep the legacy tag and route available until v2 passes one full acceptance cycle.

## 5. Risks and rules

- **Scope creep is the main risk.** No extra mechanics; every addition needs a new approved issue.
- Camera regression: reuse approved math, real screenshots, horizon row test; no masks/cuts.
- Robot rule ambiguity: robots non-blocking unless explicitly approved otherwise.
- Legacy code leakage: v2 must not import surface/event/story modules or the old adaptive renderer.
- Do not ship mock frames as acceptance; only v2 renderer output.

## 6. Definition of done for v2

A player can start, collect 30 triangles with server confirmation, see four robots collecting, leave
to the next planet, with approved camera and minimal GDS HUD; tests/a11y/docs/release evidence pass;
legacy game retired with rollback preserved.

## 7. Resolved decisions (2026-11-23)

- Robots respawn when they reach their target; four remain active; collection stays non-blocking.
- Third-person fixed rig offset; avatar visible; one camera, pitch-only horizon alignment.
- Triangles: three breaking levels; the triangle field respawns when fully mined.
- Silent game; no audio system.

The remaining exact numbers (robot target, triangle-respawn timing) are fixed in Wave 1 and must not
add challenge or interruption.
