# NARIMATO v2 — game specification

**Status: final rules confirmed by the user on 2026-11-26; implementation pending.**
The binding detailed rule set is [TRIANGLE_RULES.md](TRIANGLE_RULES.md). The plain-English player
experience is [PLAYER_GUIDE.md](PLAYER_GUIDE.md).

## 1. One-sentence game

Players and robots share a spherical planet, click/harvest triangles that split through four levels,
and a player who collects 30 clicks leaves for the next of 3 planets.

## 2. Core rules

- Planet starts with **20 level-1 triangles**; levels are **20 / 80 / 320 / 1,280**.
- Every actor — player, robot, future gamer — may click a triangle **once**.
- A triangle splits into **4 smaller triangles** after **two distinct actor clicks**; level 1–3 only.
- A level-4 triangle clicked twice **stays** and becomes red for everybody.
- Colour is per actor: red for the actor who clicked; green for actors who have not; level-4 fully
  clicked faces are red for everybody.
- When no click is possible (all active leaves level 4 and globally red), the planet resets to
  **20 fresh level-1 triangles**. Personal counts are kept.
- A player needs **30 successful clicks** (orbit click or walking into a centre that is green for
  the player), then leaves immediately for the next planet.
- There are **3 planets**, wrapping 3 → 1. Arrival starts a fresh round in the current build.
- Robots have the same 30 target and respawn on the same planet.
- The planet left behind remains for future multiplayer players.
- No audio, no menu/cinematic, no other challenge or interruption.

## 3. Surface and camera

- Movement is triangle-centre to triangle-centre; 0.5 s Bézier move or rotation; input locked until
  the previous animation completes.
- Up/forward steps; left/right rotates to the next neighbour centre; down/back reverses.
- Walking into a green-for-player centre records one click; walking into a red-for-player centre
  records none.
- Surface camera height starts at **1.15 R**, wheel/pinch move it out in discrete steps to **1.70 R**; horizon **25%**.
- Camera pitch transitions use the same 0.5 s Bézier/eased, sectioned motion.
- Mouse on the surface moves the camera outward/inward (wheel/pinch); pointer drag stays orbit-only;
  surface gamer movement is keyboard-only.

## 4. Out of scope

Real other gamers/multiplayer, mining inventory, missions, story/audio, incidents, leaderboards,
timers, hazards, economy and PvP are not current scope. Other real gamers are tracked in the
idea bank.

## 5. Acceptance

See [TRIANGLE_RULES.md](TRIANGLE_RULES.md) §8. The current playtest does not yet implement these rules;
this is recorded as pending implementation, not as delivered.
