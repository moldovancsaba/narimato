# NARIMATO v2 — player guide and first-load experience

**Status: describes the user-approved v2 playtest build (2026-11-26).** This is the plain-English
game experience. Technical contracts live in the camera/control/game documents.

## 1. The game in one sentence

You are on a spherical planet: collect 30 surface triangles, then leave for the next planet.

## 2. The strategy — the whole loop

1. Start on a planet.
2. The planet's **surface triangles are the collectible** — there are no separate pickups.
3. Collect **30 triangle breaks**.
4. **Four robots** also collect. They **do not block you**. When a robot reaches its target it
   respawns as a new robot.
5. At **30/30** you leave that planet and arrive at the next one; progress resets to 0/30.
6. Repeat.

There is **no timer, no failure, no enemies, no story interruption, no mission, no score beyond
30/30 and the planet number, and no audio**. The strategy is simply to choose how to collect:
click surface triangles from above, or get close, land, and walk across them.

## 3. What you see immediately after loading

You start in **Step 1 — Orbit**. There is no title menu and no intro cinematic.

- A **whole spherical planet** in the centre of the screen.
- The planet is covered by the **spherical icosahedron triangle mesh** — curved triangle borders
  across the visible surface.
- **25% empty space above the planet.**
- The planet's **centre is on the screen centre** (the 50% line).
- **No horizon line yet**, because the whole sphere is visible.
- The **gamer is not visible**; the gamer is behind the camera in Steps 1–3.
- **Four robot markers** on/near the surface.
- A minimal HUD in the top left:
  - `STEP 1 // ORBIT`
  - `0 / 30`
  - `PLANET 1`
  - four robot rows, each `0/5 · respawns 0`
- The pointer cursor is a **grab hand** over the game.
- Bottom hint: click faces, drag to rotate, wheel/pinch zoom, WASD/arrows turn and move, keys 1–4
  select steps.
- On the public Pages build, a brief **“PUBLIC PLAYTEST — browser state”** badge may appear.

There is **no intro cinematic, no title menu, no “press start”, no landing sequence, and no audio**.

## 4. What you do from that first screen

- **Drag** to rotate the planet freely.
- **Wheel/pinch** to move the rig closer through the four camera steps.
- **Click a surface triangle** to break/collect it.
- **A / Left** turns left, **D / Right** turns right, **W / Up** moves forward, **S / Down** moves
  backward.
- At **Step 4 — Landed**, the gamer appears on the surface; walking through triangles collects them.
- Reach **30/30** to move to Planet 2.

## 5. The four camera steps in play

| Step | What it means | What changes |
|---|---|---|
| 1 — Orbit | Whole planet visible | 25% empty space above; centre at 50%; gamer hidden |
| 2 — Closer | Planet fills the screen | horizon fixed at 25%; gamer hidden |
| 3 — Almost landed | Much closer | horizon still 25%; gamer hidden |
| 4 — Landed | Gamer on the surface | horizon 25%; gamer visible; walking collects faces |

## 6. What is not in the game

- No menu, launch cinematic, story events, missions, incidents, supply, mining inventory,
  leaderboard, timer, hazard or fail state.
- No audio or narration.
- No separate collectible icons; the surface itself is collectible.

## 7. Current playtest caveats

- The HUD is a minimal playtest HUD, not yet the full GDS release HUD.
- The gamer and robots are simple markers, not final 3D models.
- The public Pages build keeps game state in the browser; the Node build (`npm start`) is
  server-authoritative.
- Production hosting, the full accessibility release gate and 3D models are future work.

## 8. Related documents

- [GAME_V2.md](GAME_V2.md) — rules and scope.
- [CONTROLS_APPROVED.md](CONTROLS_APPROVED.md) — control contract.
- [CAMERA_APPROVED.md](CAMERA_APPROVED.md) /
  [CAMERA_LANDING_PROCESS.md](CAMERA_LANDING_PROCESS.md) — camera contract.
- [V2_STATUS.md](V2_STATUS.md) — current delivery status.
- [APPROVALS.md](APPROVALS.md) — user-approved build and scope.
