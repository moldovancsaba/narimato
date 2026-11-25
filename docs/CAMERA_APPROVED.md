# Approved camera contract (v2)

**Status: camera contract approved 2026-11-23; landing process under revision.**
The revised process (25% horizon, gamer visibility/landing) is in
[CAMERA_LANDING_PROCESS.md](CAMERA_LANDING_PROCESS.md) and supersedes the horizon-anchor numbers
below once its Step-1 choice is confirmed.

## 1. The approved model

- **One camera, attached to the gamer rig.** The player and camera are one rig; the camera has a
  fixed **backward/up offset so the avatar is visible (third-person)**. The offset is fixed across all
  phases.
- **No zoom.** The four phases move the player physically closer to the planetary surface; the
  camera comes with the player. FOV and focal length never change.
- **Vertical rotation only.** The camera pitches around its local right axis per phase. No yaw, no
  roll, no second camera, no carrier/landed camera swap.
- **Fixed horizon row.** The real geometric horizon is placed on the **same screen row** in every
  phase: **10% of viewport height from the top**. Alignment comes exclusively from vertical pitch.
- **Full planet rendering.** The whole sphere is rendered: sky where rays miss, surface where they
  hit. No cut top, no mask, no crop, no painted horizon, no fake sky rectangle.
- **Fixed geometry.** The planet triangles/arcs do not change between phases; only the rig position
  and camera pitch change.

Prototype frames (approved):

- [proto-storyboard-4-phases.png](plan/proto-storyboard-4-phases.png)
- [L1 orbit](plan/proto-level1-orbit.png)
- [L2 halfway](plan/proto-level2-halfway.png)
- [L3 80%](plan/proto-level3-80.png)
- [L4 landed, drastically close](plan/proto-level4-landed.png)

## 2. Phase table (approved)

| Phase | Rig distance from planet centre | Camera pitch from nadir | Horizon row |
|---|---|---|---|
| L1 orbit | 3.20 R | 0° (look at centre) | no horizon (whole sphere) |
| L2 halfway | 2.10 R | 8° | 10% of viewport |
| L3 80% | 1.44 R | 23.5° | 10% of viewport |
| L4 landed | **1.04 R** | **53.5°** | 10% of viewport |

L4 is the approved drastic-close landing view: 4% of the planet radius above the surface.

## 3. Technical model

- Camera position `P = L · distance`, where `L` is the landing point unit vector.
- For phase pitch `θ` (from nadir) and tangent forward `F`:
  `D = normalize(-L cos θ + F sin θ)`; screen right/up are derived from the local vertical so the
  horizon is horizontal.
- Perspective projection with fixed focal length; the horizon is the real limb of the unit sphere.
- Sphere is rendered by ray–sphere intersection (front surface only); geodesic triangle edges are
  analytic great-circle edges. The earlier Canvas polygon/clip hacks are **not** part of v2.
- Player movement changes the rig distance; the camera follows automatically because it is attached.
- Pitch is solved so the horizon lands at the 10% row:
  `α = asin(1/d)`; `φ = atan((0.5 − 0.10) · H / focal)`; `θ = α − φ`.

## 4. Acceptance for the implementation

- One camera instance; no additional camera/zoom/FOV changes.
- Four phases driven by rig distance: 3.20 / 2.10 / 1.44 / 1.04 R.
- Horizon row measured at **10% ± 1%** of viewport height in L2, L3, L4.
- Full sphere rendered; no cut/mask/crop; no wedge/leak; no cartography.
- Fixed geometry: triangle count unchanged across phases.
- Real screenshots at all four phases plus a limb close-up; tests/CI/a11y green.

## 5. Forbidden deviations

- Second camera, optical zoom, FOV change, camera-height offset as a substitute for player movement.
- Any horizon mask, top crop, sky overlay, painted horizon or silhouette cut.
- Re-tilting geometry per phase or changing triangle density.
- Reusing the old surface-camera/derived-mesh code.

## 6. Play-view note

The approved L4 framing is 1.04 R / 53.5° for the planet/horizon view. The v2 **surface play view**
uses 1.44 R / 12° so local surface faces and the avatar remain visible while walking; the camera
contract distances/pitches above still govern the phase framing previews and the sequence.

## 7. Approved visibility decision

The avatar **must be visible**. The camera uses a fixed backward/up rig offset for all phases; still
one camera, no zoom, no second camera. The L4 distance/pitch remains 1.04 R / 53.5°, with the rig
offset applied. New prototype frames with the visible avatar will be captured in Wave 4 before the
camera is accepted in v2.
