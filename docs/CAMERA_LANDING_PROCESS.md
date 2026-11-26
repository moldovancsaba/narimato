# Camera landing process — final approved 25% horizon + camera arm

**Status: APPROVED 2026-11-25; implemented in v2 and user-approved 2026-11-26 (build e7f65e5).**
This supersedes the earlier 10% horizon and all previous landing views.

## 1. Plain-English process

The gamer rig carries one camera. The gamer flies behind the camera and is **not visible** while the
rig is in space. Zooming moves the rig physically closer; it never changes the lens. At every step the
camera tilts just enough to keep the real horizon on the **25% line from the top of the screen**.
At landing the gamer moves to the front of the camera, exactly onto the surface, and becomes visible.
The camera sits 1% of the planet radius above the surface, with a fixed 1.4% R arm behind the gamer.

One camera. Constant 50° FOV. No mask, no cut, no second camera, no geometry change.

## 2. Final steps

| Step | Rig distance | Pitch from nadir | Gamer | What you see |
|---|---|---|---|---|
| 1 far orbit | **4.40 R** | 0° | behind camera, not rendered | whole planet, top at 25%, centre at 50%, 25% space above |
| 2 closer | **1.50 R** | **28.68°** | behind camera, not rendered | horizon at 25%, surface fills below, no gamer |
| 3 almost landed | **1.20 R** | **43.31°** | behind camera, not rendered | much closer, horizon still 25%, no gamer |
| 4 landed | **1.02 R radial** (revised 2026-11-26; double altitude) | re-solve | in front, on the surface | horizon at 25%, gamer visible, surface triangles |

**Step-4 camera arm:** **1.4% R** behind the gamer along the backward tangent. Approved range
1.2–1.7% R. The radial height is **1.02 R** under the 2026-11-26 revision; exact pitch/arm
re-solve is pending implementation.

## 3. Why Step 1 is 4.40 R

With 50° vertical FOV and H=800 px, focal = **857.8 px**.

- 25% space above the planet + planet centre at 50% means the planet's projected radius is
  **25% H = 200 px**.
- Required angular radius: `atan(200 / 857.8) = 13.13°`.
- Required distance: `1 / sin(13.13°) = **4.40 R**`.

At 3.20 R with 50° FOV the planet would appear larger (top at 15%), so it cannot meet the 25%
framing. Step 1 is therefore 4.40 R.

## 4. Pitch math

- Horizon from nadir: `α = asin(1/d)`.
- 25% horizon row: `φ = atan(0.25 · H / focal) = 13.13°`.
- Camera pitch: `θ = α − φ`.

| Step | d | α | θ |
|---|---|---|---|
| 1 | 4.40 R | 13.13° | 0° |
| 2 | 1.50 R | 41.81° | 28.68° |
| 3 | 1.20 R | 56.44° | 43.31° |
| 4 | 1.01 R | 81.90° | 68.77° |

## 5. Step-4 gamer visibility — solved by the camera arm

With the camera directly above the gamer at 1.01 R, the gamer would sit on the horizon. The approved
camera arm fixes that:

- radial height `h = 0.01 R`
- backward arm `a = 0.014 R`
- camera-to-gamer angle from nadir: `atan(a/h) ≈ **54.5°**`
- horizon angle: **81.9°**
- camera pitch: **68.77°**
- gamer below optical axis: about **14.3°**
- approximate screen position: `400 + 857.8 · tan(14.3°) ≈ **619 px**` → **≈77% down** an 800 px screen
- horizon at 25% (200 px), gamer at ~77%, both inside the 50° FOV

The gamer is on the real surface and inside the visible horizon cap; no overlay or mask is involved.

## 6. Transitions — no wobble

1. Wheel/pinch moves the rig: 4.40 → 1.50 → 1.20 → 1.01 R.
2. Distance is the driver; pitch is re-solved every frame, so the horizon stays exactly on 25%.
3. The planet centre moves down as the camera tilts up.
4. Gamer stays behind the camera and unrendered in Steps 1–3.
5. Step 3 → Step 4: the rig settles at 1.01 R; the camera arm extends to 1.4% R; the gamer moves
   from behind the camera to the front and onto the surface. Camera path/pitch and gamer move are
   independent, so the horizon cannot wobble.
6. No FOV change, no second camera, no mask/cut, no geometry change.

## 7. Acceptance

- Horizon measured at **25% ± 1%** in Steps 2–4 and stable through transitions.
- Step 1: planet centre 50% ± 1%, planet top 25% ± 1%.
- Gamer not rendered in Steps 1–3; visible on the surface at Step 4 around 70–85% screen height.
- Step 4: radial 1.01 R, arm 1.4% R ± 0.2%.
- Constant 50° FOV; one camera; fixed triangle count; no masks/cuts.
- Real screenshots for every step and transition frames.

## 8. Implementation status

**Implemented in the v2 playtest on 2026-11-25** at https://moldovancsaba.github.io/narimato/:
four distance steps, 25% horizon, constant 50° FOV, landing camera arm, gamer hidden in Steps 1–3 and
visible on the surface at Step 4, distance-driven pitch, no masks/cuts/second camera. Real screenshots
were captured at all four steps. Final acceptance still requires transition recording, measured
horizon-row automation and the remaining pointer-control parity.
