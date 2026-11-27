# Camera approach plan — four levels, vertical-only, horizon on top

**Status: DRAFT FOR APPROVAL. No implementation, no production files changed.**
This document plans the camera behaviour only; it is not delivered work.

Related visuals:

**Real renderer captures (approval basis, HUD hidden to judge framing):**

- [Real storyboard](real-storyboard-4-phases.png) — L1–L4 actual renderer frames
- [Real L1 orbit](real-phase-1-orbit.png)
- [Real L2 halfway](real-phase-2-halfway.png)
- [Real L3 80%](real-phase-3-80.png)
- [Real L4 30 m — scale issue](real-phase-4-landed.png)
- [Side-view camera path diagram](camera-approach-diagram.png)

**Illustrative concept frames (not screenshots; superseded by the real captures):**

- [Concept storyboard](storyboard-4-phases.png) · [L1](phase-1-orbit.png) · [L2](phase-2-halfway.png) · [L3](phase-3-80.png) · [L4](phase-4-landed.png)

## 1. Goal

One continuous landing approach with four zoom levels. The camera starts pointing at the **planet
centre** in orbit, then only its **vertical angle** changes per level while it descends; from L2
onward the **horizon stays in the top band** of the frame. At L4 the ship has landed about **30 m
above the surface**, the **player is visible**, and the frame shows the **terrain and direction the
player can move**.

## 2. Fixed constraints (from the request)

- Four zoom levels only: **L1 orbit**, **L2 halfway**, **L3 80%**, **L4 landed (~30 m)**.
- Camera tilt changes **only vertically**, one step at a time. No yaw or roll changes during the
  descent.
- **Horizon on top** is visible from L2 onward and stays inside a stable top band.
- Orbit looks at the **planet centre**.
- L4 must show the **player** and the **path/terrain ahead**.
- One renderer, one scene, one active-leaf geometry. No second camera scene, no derived mesh, no
  extra triangles.

## 3. Camera model

- Planet radius = **R**; camera positions lie on the **radial line through the landing point**.
- **Pitch** is measured from the **nadir** (straight down at the planet):
  - `0°` = looking at the planet centre / straight down;
  - increasing pitch = tilting **up toward the horizon** (vertical only).
- Fixed focal length (no FOV zoom); zoom is the carrier distance change.
- Landing point = the surface point under the ship/pilot at the approach start; the camera aims at
  a blend of the planet centre → landing point → player.

### Phase table

| Level | Name | Distance | Look target | Pitch from nadir | Horizon (top of frame) | Player | HUD / input |
|---|---|---|---|---|---|---|---|
| **L1** | Orbit | **3.20 R** | Planet centre | **0°** | Off-screen (space around the limb) | No | Orbit HUD; pointer drag moves the planet; wheel enters L2 |
| **L2** | Halfway | **2.10 R** (50% of the descent) | Landing point (centre→point blend) | **13°** (real-capture value) | Top band **≈ 19%** | Landing zone only | Transition HUD; wheel/pinch continues |
| **L3** | 80% to surface | **1.44 R** (80% of the descent) | Landing pad / surface point | **24°** (19° captured; horizon still at/above edge) | Top band **≈ 10–15%** | Ship/pilot legible | Surface HUD begins; landing sequence armed |
| **L4** | Landed (Option A) | **1.20 R** | Player + forward path | **35°** | Full horizon band at the top | Third-person; ship/pilot + terrain visible | Surface controls active; camera follows player horizontally |

Distances are relative to the orbit radius: L2 = `R + 0.5 · (3.20R − R)`, L3 = `R + 0.2 · (3.20R − R)`
(80% of the way in), L4 = `R + 30 m/R` (about `1.004R` for an Earth-sized R).

## 4. What each frame must show

- **L1** — whole sphere, centre crosshair, no horizon, no player; the orbit interaction is unchanged.
- **L2** — surface fills the lower ~70%; horizon enters the top band; landing area/target visible.
- **L3** — surface fills ~90%; horizon locked in the top band; ship/pilot small but legible at the
  landing point; immediate terrain readable.
- **L4** — third-person camera above/behind the pilot: horizon top band, pilot lower-centre, visible
  path ahead and surrounding terrain; UI state is the surface HUD.

The four images at the top are the approval frames. They are concept frames (drawn to scale), not
gameplay screenshots; after approval the same frames are reproduced from the real renderer as
acceptance screenshots.

## 5. Transition specification

- Each step animates **700 ms, ease-in-out**, and animates only:
  - carrier distance (`3.20R → 2.10R → 1.44R → 1.004R`), and
  - pitch (`0° → 35° → 55° → 65°`).
- No yaw, no roll, no roll-correcting horizon drift; horizon height stays inside the defined band at
  the end of each step.
- Discrete detents: one wheel notch per level (touch pinch snaps to the nearest level). A short
  in-level settle is allowed but the camera cannot free-orbit off the radial line.
- Entering L4 arms the landing sequence; surface controls/HUD activate when the transition settles.
- Exit is the reverse animation; returning to L1 restores the orbit camera and orbit HUD.


## 5. Real renderer findings (2026-11-22)

The approval frames above are actual `IcosaRenderer` output from the running game with a temporary
approach camera; **no production camera code was added**. Only the DOM HUD was hidden so the
framing can be judged.

1. **L1 orbit** — real scene as shipped; centre framing, no horizon. Good.
2. **L2 2.10 R / 13°** — real horizon reaches the top band (~19% from the top). The original concept
   pitch of 35° was wrong: it would put the horizon below centre. 13° is the value that matches the
   spherical limb geometry (`asin(1/d)` minus the horizon offset).
3. **L3 1.44 R / 19°** — horizon sits at/above the frame edge. Raising the vertical tilt to **24°**
   brings it into the top ~10–15%. This is a plan correction; no implementation yet.
4. **L4 at a literal 30 m is not viable with the current asset scale.** At `1.004 R` the pilot rig and
   terrain shards project at enormous size (see the real L4 frame): the avatar/terrain scale is tuned
   for the current surface camera (~1.35 R), not for a 30 m third-person camera. Two routes:
   - **Option A (recommended for approval):** define L4 at the current playable surface distance
     (≈1.35 R) with vertical tilt to put the horizon in the top band; the pilot/path are readable.
   - **Option B:** keep literal 30 m and add an asset scale model (metres per world unit) plus
     avatar/terrain scaling; larger change, needs its own issue.
5. World HUD per phase is still to be specified; the captures hide it deliberately.

## 6. Input and protected behaviour

- **L1**: current approved pointer behaviour is untouched (object-follow drag, pole-safe quaternion,
  carrier math).
- **L2–L3**: pointer drag, if enabled, may adjust **vertical pitch only** inside a small clamp and
  then eases back to the preset on the next step. No horizontal yaw is invented.
- **L4**: pointer/keys steer the pilot heading; the camera follows the pilot horizontally while its
  pitch (65° from nadir) and the horizon top band stay locked.
- Mouse point-follow, pole crossing, fixed-focal dolly, opaque surface, leaf-count geometry and
  accessibility are **regression-protected**; the camera preset work may not change them.

## 7. Implementation plan (only after approval)

### RND-08a — camera presets
- Extend the carrier camera with a vertical `pitch`/aim offset and four presets; keep the existing
  `CarrierCamera` projection contract.
- Pure unit tests: distance/pitch per level, horizon projection height in the expected band, target
  centring, fixed focal length.

### RND-08b — ladder and transition
- Map wheel/pinch to four detents; 700 ms vertical-only tween; arm landing at L4; surface HUD/controls
  activation; ESC/return restores L1.
- No renderer geometry changes; no second camera/scene; no HUD duplication.

### RND-08c — acceptance evidence
- Real-renderer screenshots at the four levels at desktop and mobile portrait.
- Measure horizon top band, player visibility, path visibility; mouse point-follow and pole-crossing
  regression; opaque-surface check; leaf-count check; a11y gates.
- Update `narimato-physics.md`, this plan and the fixes log only after the frames are approved.

### Files likely touched
`public/js/shared/carrier-camera.js`, `public/js/app.js`, `public/js/surface-controller.js` (landing
trigger only), `test/carrier-camera.test.js`, a new acceptance script under `scripts/`, docs.

### Rollback
The preset ladder is additive to the carrier camera; reverting the commit restores the current
controls. No migration or persisted state changes. No feature flag that creates a second scene.

## 8. Approval questions

Please answer these to freeze the plan:

1. **L4 scale (blocking decision)** — **Option A:** playable surface distance ≈1.35 R with horizon
   top band (pilot/path readable), or **Option B:** literal 30 m with a new avatar/terrain scale
   model? The real frame shows Option B is not acceptable as-is.
2. **L4 framing** — third-person above/behind the pilot (pilot lower-centre, horizon top), or a
   different height/offset?
3. **Horizon band** — approve L2 ≈19%, L3 ≈10–15%, L4 ≈15–20% from the top? Or pin one value?
4. **Distances** — approve 3.20R / 2.10R / 1.44R for L1–L3, and choose the L4 option above?
5. **L2–L3 mouse drag** — vertical pitch adjustment only (proposed), or disabled until L4?
6. **L3 player** — show the ship only, or the pilot silhouette too?
7. **L4 path** — show a suggested route/path to the nearest goal (proposed), or only terrain?
8. **Transition** — 700 ms, vertical-only, one detent per wheel notch; approval?
9. **Exit** — reverse through the levels to L1, or ESC/instant return to L1 (current behaviour)?
10. **Planet/asset scale** — for Option B, what is the intended metres-per-world-unit for the pilot
    and terrain? For Option A, the current surface distance is accepted as “landed”.
11. **Approval phrase** — reply “approved” with the L4 option (A or B) or list the changes; no code
    will ship before that.

## 9. Approval checklist

- [ ] Four levels and their names accepted.
- [ ] Distances/pitches accepted (or amended).
- [ ] Horizon top band accepted (or amended).
- [ ] L4 player/path framing accepted (or amended).
- [ ] L2–L3 input behaviour accepted.
- [ ] Transition timing accepted.
- [ ] No second scene/mesh/derived geometry expectation confirmed.
- [ ] Approval recorded in the issue/board before implementation starts.
