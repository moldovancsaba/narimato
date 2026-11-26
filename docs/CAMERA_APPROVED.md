# Approved camera contract (v2)

**Status: FINAL — approved 2026-11-25; v2 implementation user-approved 2026-11-26.** This supersedes all earlier camera/landing numbers,
including the 10% horizon and the 1.44 R surface play view. The camera arm at landing is approved.

The detailed landing process is in [CAMERA_LANDING_PROCESS.md](CAMERA_LANDING_PROCESS.md).

## 1. The approved model

- **One camera, attached to the gamer rig.** Same camera object in all steps. No second camera,
  no carrier/landed camera swap.
- **No optical zoom / no FOV change.** Constant vertical FOV **50°**. Wheel/pinch and the four steps
  move the **gamer rig physically**; they never change the lens.
- **The top 25% of the viewport is always space/sky.** The real horizon/limb sits exactly on the
  **25% line** in Steps 2–4. In Step 1 the whole planet is visible: planet top on the 25% line,
  planet centre on the 50% line.
- **Vertical pitch only.** The camera pitches so the horizon stays on the 25% row. No yaw/roll
  animation hacks, no per-frame orientation overwrite from an animation pose.
- **Full planet rendering.** Sky where rays miss, surface where they hit. No cut top, mask, crop,
  painted horizon or fake sky.
- **Fixed geometry.** The same spherical surface triangles are rendered in every step.

## 2. Final step table (FOV 50°, H = viewport height)

| Step | Rig distance from centre | Camera pitch from nadir | Gamer | Horizon row |
|---|---|---|---|---|
| 1 far orbit | **4.40 R** | 0° (looks at centre) | behind camera, not rendered | planet top at 25%, centre 50% |
| 2 closer | **1.50 R** | **28.68°** | behind camera, not rendered | 25% |
| 3 almost landed | **1.20 R** | **43.31°** | behind camera, not rendered | 25% |
| 4 landed | **1.15 R radial** (wheel/pinch out to 1.70 R) | re-solve | in front, exactly on surface | 25% |

**Step-4 camera arm:** dynamic, derived from the current surface height so the gamer stays around
70% down the frame while the horizon remains at 25%. Default surface height **1.15 R**; wheel/pinch
can move the camera out to **1.70 R**. This is the 2026-11-26 implemented value, pending user visual
approval.
This puts the gamer at roughly **75–80% down the screen**, on the surface, while the horizon stays
at 25%.

## 3. Technical model

- Landing point unit vector `L`; forward tangent `F`; rig distance `d`.
- Horizon angle from nadir: `α = asin(1/d)`.
- For a 25% horizon row: `φ = atan(0.25 · H / focal)`; with H=800 and 50° FOV, `φ = 13.13°`.
- Camera pitch: `θ = α − φ`.
- At Step 4 the camera is at radial distance **1.01 R** and displaced **0.014 R backward** along the
  tangent. The camera-to-gamer direction is about **54.5° from nadir**, so the gamer projects below
  the horizon but inside the 50° FOV.
- Rendering is ray–sphere front surface with analytic great-circle triangle edges. No polygon-clip
  hacks are part of v2.
- Pitch is re-solved from the current distance every frame; distance is the animation driver.
  This is what prevents horizon wobble during transitions.

## 4. Acceptance for the implementation

- One camera instance; constant 50° FOV; no camera swap.
- Step distances: **4.40 / 1.50 / 1.20 / 1.01 R**.
- Horizon at **25% ± 1%** of viewport height in Steps 2–4; stable during transitions (no wobble).
- Step 1: planet centre at **50% ± 1%**, planet top at **25% ± 1%**.
- Step 4: camera arm **1.4% R ± 0.2%**, radial 1.01 R; gamer visible on the surface in the lower
  frame, inside the FOV; gamer absent in Steps 1–3.
- No cut/mask/crop, no wedge, no leak, no cartography; fixed triangle count.
- Real browser screenshots at all four steps plus transition frames; tests/CI/a11y green.

## 5. Forbidden deviations

- Second camera, optical zoom, FOV change, camera swap, or animation-driven camera overwrite.
- Any horizon mask, top crop, sky overlay, painted horizon or silhouette cut.
- Moving the camera independently of the gamer rig except the approved fixed 1.4% R landing arm.
- Re-tilting geometry per step or changing triangle density.
- Reusing the old adaptive/derived-mesh surface renderer.

## 6. Approved prototype frames

The frames under `docs/plan/proto-*` are the earlier prototype that approved the one-rig,
full-planet, no-mask rendering approach. Their distances/pitches/10% horizon are **historical** and
are not the final numbers above. Final acceptance needs new real screenshots at the steps in Section 2.
