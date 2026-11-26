# Final triangle, actor and planet rules

**Status: user-confirmed 2026-11-26; implemented in the playtest build the same day, pending user visual approval.**
This document supersedes the earlier 10-triangle/30-target rules in GAME_V2.

## 1. Triangle hierarchy

The planet starts with **20 level-1 triangles**.

| Level | Triangle count |
|---|---|
| 1 | **20** |
| 2 | **80** |
| 3 | **320** |
| 4 | **1,280** |

- A level-1/2/3 triangle that receives two **distinct actor clicks** is replaced by
  **4 smaller triangles** at the next level. The four children start green.
- A level-4 triangle that receives its second distinct actor click **stays in the world** and
  becomes **red for everybody permanently**. It does not split again.

## 2. Actors and clicks

The player, the 4 robots and (future) other gamers are all **actors**.

- Each actor may click a given triangle **once**.
- The first click on a triangle shows **red only for the actor who clicked it**.
- The same triangle stays **green for every other actor** who has not clicked it.
- Those other actors may click it; the second distinct actor click performs the split.
- Colour is therefore per viewer: the server stores `clickedBy`, and a client colours a triangle
  red only when the current actor is in `clickedBy`; level-4 fully-clicked triangles are red for
  everyone.
- No actor can click the same triangle twice.
- A triangle needs **two different actors**; one actor alone cannot split it.

## 3. Reset

A planet's triangle set resets when **no click is possible anywhere on that planet**:

- every remaining active leaf is **level 4**, and
- every one of those leaves is **red for everybody** (already clicked by two distinct actors).

On reset:

- the planet becomes **20 fresh green level-1 triangles**;
- all per-triangle click history clears;
- actors' personal 30-click counts are **kept**;
- robots stay on the same planet; a robot's count also continues unless it reached 30.

Resets do not remove actors or change planet ownership.

## 4. Player goal, 3 planets and robots

- A player needs **30 successful clicks on the current planet**.
- A successful click is:
  - a click on a triangle in orbit, or
  - walking into a triangle centre on the surface when that triangle is green for the player.
- Walking into a triangle that is already red for the player moves the gamer but records **no click**.
- At **30**, the player immediately leaves the current planet, regardless of the planet's state, and
  arrives at the next planet with a **fresh round**.
- There are **3 planets**; after planet 3 the player goes back to planet 1.
- The current single-player build starts a fresh round on arrival. Future multiplayer can join or
  continue the planet left behind; other real gamers are the idea-bank option, not current scope.
- **Robots have the same 30-click target.** When a robot reaches 30 it **respawns as a new robot on
  the same planet**; robots belong to the planet and do not travel with the player.
- The planet left by the player remains for future multiplayer play.

## 5. Surface movement

- The gamer moves **triangle centre to triangle centre**, using the current active leaf triangles.
- Movement graph: each active triangle has 3 edge-neighbours.
- Up/forward: step to the neighbouring centre in the facing direction.
- Down/back: step to the centre behind.
- Left/right: rotate to the next neighbouring centre around the current triangle
  (3 directions, 120° increments).
- Every move or rotation is **0.5 seconds**, regardless of triangle size.
- Paths are **spherical quadratic Bézier** curves between the two centres; rotations use the same
  0.5 s eased quaternion interpolation.
- The next input is accepted only when the previous move/rotation finishes. The implementation may
  buffer one input.
- On arrival at a centre, if the triangle is green for the player it records one click for the
  player; if it is red for the player, movement still happens and no click is recorded.
- When a triangle splits or the planet resets, the movement graph updates to the new active leaves.

## 6. Surface camera and mouse

- Surface camera height starts at **1.15 R radial** and can be moved outward with the mouse wheel or
  pinch to **1.70 R** (and back to 1.02 R) to see more surface. The rig is higher than the old 1.02 R view.
- The camera pitch is re-solved so the horizon stays at **25%** and the gamer remains visible.
- Camera transitions between pitch steps use the same **0.5 s Bézier/eased, sectioned motion** as
  player movement; distance, pitch and landing arm move together and the horizon is solved every
  frame.
- **Mouse on the surface moves the camera outward/inward** (wheel or pinch) between 1.02 R and 1.70 R.
  Pointer drag/click remains orbit-only; keyboard controls the gamer on the surface.

## 7. Rendering rules

- Only the current active leaf triangles are rendered; children replace the parent.
- Green = the current player has not clicked that triangle.
- Red = the current player has clicked it; a level-4 triangle clicked by two distinct actors is red
  for every viewer.
- No separate collectible icons: the triangles themselves are the game surface.
- No audio, no menu, no story interruption.

## 8. Acceptance

- Start: exactly 20 level-1 green triangles.
- Two distinct actor clicks: 4 children at the next level; level 4 stays red for everybody.
- Same actor cannot click twice; another actor can.
- Per-viewer colour: player sees red only for their own clicks; other actors' clicks stay green.
- Planet reset: all active leaves level 4 and globally red → 20 fresh level-1 green triangles;
  personal counts preserved.
- Player 30 clicks → next planet; 3 → 1 wrap; fresh round on arrival.
- Robot 30 clicks → respawn on the same planet.
- Surface: centre-to-centre Bézier, 0.5 s per move/turn, input lock, auto-click on arrival only when
  green for the player.
- Camera: 1.15 R default surface height, wheel/pinch out to 1.70 R, horizon 25%, 0.5 s Bézier/eased
  pitch transitions; surface mouse wheel/pinch controls camera distance.

## 9. Implementation status

**Implemented in the v2 playtest build on 2026-11-26.** Server rules, per-actor click state, hierarchy
split, level-4 all-red, planet reset, 3-planet wrap, robot target/respawn, surface movement and camera
are in `v2/`. Tests: **574/574**; camera acceptance PASS 24.98 / 25.00 / 25.00 / 24.82; pointer/cursor
acceptance PASS. This is a delivered playtest build, not the final approval; visual acceptance is
pending the user's test.
