# Approved user-control contract (v2)

**Status: APPROVED by the user on 2026-11-25. Documentation only — not implemented in the game yet.**
This is the binding user-control model for the planet and the gamer, in orbit and on the surface.
It is separate from the camera/zoom contract in [CAMERA_APPROVED.md](CAMERA_APPROVED.md) and
[CAMERA_LANDING_PROCESS.md](CAMERA_LANDING_PROCESS.md).

## 1. The gamer's model — plain English

- The planet is a **free rock in space**. No star, no orbit around a star, no natural rotation and no
  automatic spin. It stays exactly where the gamer leaves it.
- The pointer can grab the planet **wherever it touched the surface**. That exact surface point
  follows the pointer **exactly, in any direction** — up, down, sideways, diagonally, in circles.
- The planet can be rotated **infinitely in any direction**. It never reaches a pole, never becomes
  upside down, never hits a limit and never reaches a physical or theoretical end.
- The gamer moves with **WASD and the cursor keys**, and **both do exactly the same**:
  - **A / Left** turns the gamer left.
  - **D / Right** turns the gamer right.
  - **W / Up** moves the gamer forward.
  - **S / Down** moves the gamer backward.
- This movement works **the same in orbit and on the surface**. There is no different control mode,
  no second input path, and no point where movement stops because of a pole or an edge.

## 2. Technical translation

### 2.1 Object model

- The planet is a unit sphere with an **object-orientation quaternion `Q`**, not Euler yaw/pitch.
- Pointer drag rotates the **planet object**; the camera does not get overwritten.
- `Q` is unconstrained: no yaw clamp, no pitch clamp, no pole limit, no roll limit. Any orientation is
  reachable; repeated rotations compose indefinitely.
- There is no idle/automatic rotation applied to `Q`.
- Up vectors are carried locally; orientation is never rebuilt from global yaw/pitch, so there is no
  gimbal lock or pole singularity.

### 2.2 Pointer: absolute surface-point follow

1. **Pointer down:** unproject the pointer from screen space onto the unit sphere using the camera
   view frozen at that moment. If the ray misses the sphere, the gesture is a no-op.
2. Capture the frozen view (camera position/orientation, focal length, viewport) and the object
   orientation at grab time `Q0`, plus the grabbed unit-sphere point `P0`.
3. **Pointer move:** unproject the current pointer with the frozen view to `P1`.
4. Compute `delta = shortestArcQuat(P0, P1)`.
5. Set `Q = normalize(Q0 · delta)`. Right-multiplication is what keeps the grabbed point under the
   pointer: `Q · P0` projects to the current pointer position.
6. **Pointer up/cancel:** end the gesture. If the pointer moved less than the drag threshold, treat the
   gesture as a tap/collect; otherwise it is a rotation drag.

There is **no constraint** on `delta`: it can be any rotation, in any direction, for any number of
full rotations. No snapping, no pole detection, no clamp, no inversion.

### 2.3 Keyboard: turn and move on the sphere

Both WASD and the cursor keys produce the same intents:

| Intent | Keys |
|---|---|
| turn left | `A`, `ArrowLeft` |
| turn right | `D`, `ArrowRight` |
| move forward | `W`, `ArrowUp` |
| move backward | `S`, `ArrowDown` |

- The gamer has a **heading tangent `h`** on the local surface frame and a local up `n`.
- Left/right rotate `h` around `n` (heading turn), not a sideways slide.
- Forward/back move the gamer along a great circle in the direction of `h`; backward is the exact
  reverse.
- The local frame is **parallel-transported** as the gamer moves. Heading and up never jump, never
  flip, and never hit a pole.
- The **same controller and the same movement law** run in orbit and on surface. The view mode never
  changes key meaning; no surface-only branch, no orbit-only branch.
- Rates are implementation constants (turning angular speed, movement angular speed), not user-facing
  limits on reachable orientation.
- Diagonal input is combined and normalised; opposite keys cancel.

### 2.4 Interaction precedence

- Pointer drag on the planet = rotate the planet with absolute point follow.
- Pointer tap (no drag) = collect the surface face under the pointer.
- Keyboard = gamer turn/move.
- Wheel/pinch = camera rig distance per the camera contract; it must not rotate the planet or change
  pointer/keyboard semantics.
- One shared input path for pointer and keyboard; no duplicate alternate control implementation.

## 3. Acceptance

- Grab a surface point, drag in a full circle and in every direction: the grabbed point stays under
  the pointer within a small pixel tolerance for the entire gesture.
- Repeat drags can reach any orientation; no clamp, no pole warning, no inversion, no end reached.
- A/`ArrowLeft` turns left, D/`ArrowRight` turns right, W/`ArrowUp` moves forward, S/`ArrowDown`
  moves backward; the same in orbit and surface, verified with matching trajectories.
- The same input at a former pole region keeps turning/moving continuously; no singularity or flip.
- No per-frame camera orientation overwrite from animations cancels or fights the pointer.
- Tap still collects; drag does not accidentally collect.
- Tests and real-browser screenshots/video for pointer follow, infinite rotation, keyboard parity and
  orbit/surface parity.

## 4. Forbidden deviations

- Euler yaw/pitch control, pitch/yaw clamps, latitude/longitude limits or pole stopping.
- Relative-only drag that does not keep the grabbed point under the pointer.
- Per-frame orientation overwrite, animation pose overriding the pointer, or camera-follow hacks.
- A separate surface movement path with different keys or limits.
- Adding an auto-rotation or star-based natural spin.
- Inverting axes, snapping to poles, or declaring “upside down” as a blocked state.
- Replacing this shared input path with a second independent controller without an approved issue and
  parity tests.

## 5. Relationship to the camera contract

- Camera/zoom/landing is owned by [CAMERA_APPROVED.md](CAMERA_APPROVED.md) and
  [CAMERA_LANDING_PROCESS.md](CAMERA_LANDING_PROCESS.md).
- User movement/rotation is owned by this document.
- The camera is attached to the gamer rig; rotating the planet with the pointer rotates the object,
  not the camera framing contract.
- Wheel/pinch changes camera rig distance; it does not change this control contract.

## 6. Implementation status

**Non-Euler quaternion movement is implemented in the v2 playtest (2026-11-25)** at
https://moldovancsaba.github.io/narimato/:

- Player position and heading are maintained in a **quaternion frame**, not Euler yaw/pitch.
- A/D and Left/Right turn the heading around the local normal; W/Up and S/Down move forward/backward
  along the heading with **parallel transport**; the same controller runs in orbit and landed views.
- Browser pole test: starting just below the north pole and holding W crossed the pole continuously
  (`playerDir.y` went from +0.99 to −0.61); heading stayed tangent and finite. No pole stop.
- Camera forward is supplied by the transported heading; the camera no longer derives a tangent from
  a fixed world Y axis.
- Cursor states verified: `grab` → `grabbing` → `grab`.
- Pointer drag rotates the quaternion frame in both axes with no pitch/yaw clamps and no pole stop.

**Residual:** pointer drag does not yet satisfy the literal absolute point-follow requirement; the
grabbed point follows through the frame rotation approximately, not via the documented
`shortestArcQuat` object rotation. Exact point-follow remains the next control refinement.
