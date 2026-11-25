# Camera landing process — revised 25% horizon contract

**Status: feasibility confirmed, documentation only. No game code was changed.**
Two numbers remain a choice (Step 1 distance vs FOV); everything else is fixed by the user.

## 1. Screen rule

- The top **25% of the viewport is always space/sky**.
- In Steps 2–4 the real horizon/limb is exactly on the **25% line**.
- In Step 1 the whole planet is visible: the top of the planet is on the 25% line and the planet
  centre is on the 50% line.
- One camera attached to the gamer rig. No lens zoom, no FOV change between steps, no second
  camera, no cut/mask/painted sky, no geometry change.
- Only the rig distance and camera pitch change. Pitch is solved from the distance every frame so the
  horizon row never wobbles.

## 2. Fixed step values (user-provided)

| Step | Rig distance from centre | Gamer visibility | Horizon row |
|---|---|---|---|
| 1 far orbit | see Step-1 choice below | behind camera, not rendered | planet top at 25%, centre at 50% |
| 2 closer | **1.50 R** | behind camera, not rendered | 25% |
| 3 almost landed | **1.20 R** | behind camera, not rendered | 25% |
| 4 landed | **1.01 R** | in front of camera, on the surface | 25% |

At Step 4 the rig is **1% of the planet radius above the surface** (1.01 R from centre). The user's
earlier "2%" is superseded by this number.

## 3. Step 1 — the one feasibility choice

With vertical FOV 50° (focal = 857.8 px at 800 px height):

- "25% space above the planet, planet centre at screen centre" means the planet's projected radius is
  **25% of viewport height** = 200 px.
- Required sphere angular radius: `atan(200 / 857.8) = 13.13°`.
- Required camera distance: `1 / sin(13.13°) = **4.40 R**`.

So there are two feasible constant-FOV designs:

| Option | Step 1 | Constant vertical FOV | Consequence |
|---|---|---|---|
| **A (recommended)** | **4.40 R** | **50°** (current approved) | Keeps approved FOV; Step 1 is farther than the old 3.20 R. |
| **B** | **3.20 R** | **66.7°** | Keeps old Step 1 distance; changes the constant FOV contract. |

At 3.20 R with 50° FOV the planet would project to radius 281 px (35% of height), so top of planet
would be at 15%, not 25%. That is why a choice is required.

## 4. Pitch per step (Option A, FOV 50°)

For camera distance `d`, horizon angle from nadir `α = asin(1/d)`.
For a 25% horizon row, the horizon sits `φ = atan(0.25·H / focal) = 13.13°` above the optical axis.
Pitch from nadir: `θ = α − φ`.

| Step | d | α | Pitch θ | Horizon |
|---|---|---|---|---|
| 1 | 4.40 R | 13.13° | 0° (looks at centre) | planet top 25%, centre 50% |
| 2 | 1.50 R | 41.81° | **28.68°** | 25% |
| 3 | 1.20 R | 56.44° | **43.31°** | 25% |
| 4 | 1.01 R | 81.90° | **68.77°** | 25% |

Option B uses FOV 66.7° → `φ = 18.22°`; pitches become **23.59° / 38.22° / 63.68°** for Steps 2/3/4
and Step 1 stays 3.20 R at pitch 0°.

## 5. What happens during zoom

1. Wheel/pinch moves the rig to the next distance: 4.40 → 1.50 → 1.20 → 1.01 R (Option A).
2. Distance is the driver. Camera pitch is re-solved from the current distance every frame.
3. The horizon therefore stays exactly on the 25% row throughout the transition.
4. The planet centre moves down the screen as the camera tilts up.
5. The gamer stays behind the camera and is not rendered in Steps 1–3.
6. In the Step 3 → Step 4 transition the gamer moves from behind the camera to in front of it and
   lands exactly on the surface. The camera path/pitch is independent of that move, so the horizon
   cannot wobble.
7. No FOV change, no second camera, no masks, no cuts, no geometry change. The same surface triangles
   remain.

## 6. Step-4 geometric limit (important)

At 1.01 R the camera is 1% of the radius above the surface. The visible surface cap from the camera's
ground point has angular radius `acos(1/1.01) = **8.07°**`. A gamer standing on that surface is
visible only if the camera is at most ~8° behind the gamer, and then the gamer projects **almost
exactly on the horizon line**.

Therefore, with 1.01 R and a 25% horizon row:

- **Feasible:** gamer visible at the front, on the surface, at/just below the horizon.
- **Not feasible with these exact numbers:** gamer clearly lower in the frame, with lots of ground
  visible in front of them. That requires a higher rig or a wider FOV; both would change the contract.

This is a geometry consequence, not a rendering choice.

## 7. Acceptance checks (when implemented)

- All four steps: measured top space is **25% ± 1% of viewport height**; horizon row stable during
  transitions (no per-frame drift/wobble).
- Step 1: planet centre within ±1% of screen centre and planet top on the 25% line (Option A/B choice).
- Gamer not rendered in Steps 1–3; visible on the surface in Step 4.
- One camera object; constant FOV; no camera swap; no mask/cut; fixed triangle count.
- Step 4: gamer anchored on the surface, rig 1.01 R, horizon 25%.
- Real browser screenshots at all steps plus transition frames; tests for pitch/horizon and gamer
  visibility.

## 8. Status

**Not implemented.** The current v2 build still uses the old 10% anchor and a landed surface view
without the horizon; it does not meet this document. The Step 1 Option A/B choice must be confirmed
before implementation.
