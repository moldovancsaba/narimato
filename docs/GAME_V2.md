# NARIMATO v2 — simple game specification

**Status: specification for the clean rewrite.** The current game is to be retired after v2 is
accepted. This document owns the rules; the board owns delivery state.

## 1. One-sentence game

A spherical triangle-collecting game: each planet has triangles and four robots; the gamer collects
30 triangles, then leaves for the next planet.

## 2. The loop

1. The player arrives at a planet rendered from the **approved camera** (one rig, four distance
   phases, horizon fixed at the 10% row).
2. The planet is a spherical icosahedron subdivided into triangles. Triangles are the only
   collectible.
3. **The player collects 30 triangles.**
4. **Four robots** are present and also collect triangles; their collection is visible.
5. When the player has 30, the rig leaves the planet and the next planet begins.
6. Repeat. There is no other challenge, timer, interruption, mission, event, supply, incident,
   leaderboard, story gate or fail state.

## 3. Approved decisions (2026-11-23)

1. **Robots respawn.** When a robot reaches its target it is replaced by a newly spawned robot; four
   robots remain active.
2. **Avatar is visible.** The landing camera is third-person: a fixed backward/up offset on the same
   rig so the player is visible; still one camera, no zoom, pitch-only alignment.
3. **Triangles break in 3 levels, then respawn when fully mined.** Triangle geometry has three
   breaking levels; when the planet's triangle field is fully mined it respawns. Player progress is
   still 30 collected triangles for this planet.
4. **Silent game.** No audio system, narration or sound cues.

## 4. Rules (simple and explicit)

- **The surface is the collectible.** There are no separate pickup objects. The planet is a spherical
  icosahedron surface subdivided into geodesic triangles; clicking a face while in orbit collects that
  surface cell, and walking through a face while landed collects it.
- **80 surface faces** at one subdivision; each face has three breaking levels. Collecting 30 breaks
  clears the planet and moves to the next. The surface field respawns when fully mined.

- **Player progress:** 0 → 30 collected triangles on the current planet. One collect per valid
  triangle click/tap, server-authoritative.
- **Robots:** exactly **4 per planet**. Each robot moves on the surface and collects its own
  triangles. Robots **never block or reduce the player's 30**; their collection is part of the
  world, not a competition/failure mechanic. (If robots must compete for the same triangles, that
  is a different game and needs explicit approval.)
- **Completion:** at 30/30 the player's next collect/transition action sends the rig to the next
  planet; progress resets to 0. No interruption.
- **No fail state, no timer, no damage, no resources, no scoring beyond 30/30 and planet count.**
- **Server authority:** planet composition, collected state, robot state, player progress and planet
  transitions are server decisions. No client-fabricated progress.
- **Persistence:** player progress/planet index survives reconnect; robots are server-owned.

## 5. Presentation

- **User controls:** [CONTROLS_APPROVED.md](CONTROLS_APPROVED.md) is binding: pointer grabs and
  exactly follows surface points with unlimited rotation; WASD and arrows turn/move the gamer
  identically in orbit and surface.
- **Camera:** [CAMERA_APPROVED.md](CAMERA_APPROVED.md) is binding: one camera, constant 50° FOV,
  25% horizon, steps 4.40 / 1.50 / 1.20 / 1.01 R, landing camera arm 1.4% R; the landing process is in
  [CAMERA_LANDING_PROCESS.md](CAMERA_LANDING_PROCESS.md).
- **Planet:** one solid sphere with geodesic triangle edges; front surface only; no cartography,
  glass shell, derived mesh or render tessellation.
- **Robots:** four simple closed-volume figures on the surface, visibly collecting.
- **Controls:** wheel/pinch move the gamer rig through the four approved steps (no FOV change);
  the horizon stays on the 25% row. The gamer is hidden behind the camera in Steps 1–3 and visible on
  the surface at Step 4. Clicking collects a surface face; landed WASD walking collects the face the
  gamer walks through.
- **HUD:** minimal GDS surfaces only: current planet, 0/30 progress, four robot indicators, controls.
  Every canvas visual has a DOM/text equivalent.
- **Accessibility:** keyboard/touch collection, focus, AA contrast, reduced motion, 200% zoom,
  screen-reader labels for progress and robots.

## 6. Explicitly out of scope

Mining resources, inventory, ship-refit parts, missions, story/narration, guide/manual, incidents,
supply drops, arcs, leaderboards, scores, PvP, timers, hazards, economy, audio beyond minimal UI
sounds, multiple concurrent human players (until separately approved).

## 7. Acceptance of v2

- A new player starts on planet 1 and can collect 30 triangles using keyboard/touch with the server
  confirming each one.
- Four robots are visible and collect; they never prevent completing 30.
- At 30 the player leaves and arrives at planet 2 with 0/30.
- Camera: four phases, one rig, horizon 10% row, full planet, no masks/cuts.
- Tests, docs, accessibility and release evidence gates green.

## 8. Resolved approvals

All four questions are answered above. Remaining implementation detail to fix in Wave 1: the exact
robot target count and triangle-respawn timing/scope; these must not add a challenge or interruption.
