# NARIMATO — Physics, Camera & Rendering Solution

<!-- delivery-ssot:start -->
> **Delivery SSOT:** [NARIMATO delivery board](https://github.com/users/moldovancsaba/projects/80) · [Definition of Done](docs/DEFINITION_OF_DONE.md) · [Issue index](docs/ISSUE_MAP.md).
> This document owns durable knowledge; it does not track delivery status.
>
> **Related delivery issues:** [QA-01](https://github.com/moldovancsaba/narimato/issues/5) · [DOC-01](https://github.com/moldovancsaba/narimato/issues/6) · [RND-01](https://github.com/moldovancsaba/narimato/issues/14) · [RND-02](https://github.com/moldovancsaba/narimato/issues/15) · [RND-03](https://github.com/moldovancsaba/narimato/issues/16) · [RND-04](https://github.com/moldovancsaba/narimato/issues/17) · [CTL-01](https://github.com/moldovancsaba/narimato/issues/26) · [CTL-02](https://github.com/moldovancsaba/narimato/issues/27) · [RND-05](https://github.com/moldovancsaba/narimato/issues/18) · [RND-07](https://github.com/moldovancsaba/narimato/issues/24) · [TST-01](https://github.com/moldovancsaba/narimato/issues/25)
<!-- delivery-ssot:end -->

> Authoritative record of the final working model, why it works, and the models that were wrong.
> If code and this document disagree, the code is a regression.

## 1. The single object

- One object: the regular **spherical icosahedron** — 12 vertices, 30 edges, 20 spherical
  triangular faces.
- Geometry source: `public/js/shared/geometry.js` → `baseIcosahedron()`.
- The same object/faces are used at every camera distance. No per-camera mesh, no LOD swap, no
  generated denser surface, no second planet.
- The viewer is a WebGL ray–sphere shader. It does **not** build a mesh at all; it intersects the
  unit sphere per pixel. That is why it cannot show hidden back faces or back edges.

## 2. The camera carrier

The camera is not a free-floating orientation. It is a **carrier point on a hidden concentric
sphere** around the planet centre.

Carrier state:

```js
carrier = {
  pos:  unit vector from planet centre to camera, // position on outer sphere
  up:   unit tangent at pos,                       // camera local up
  right = normalize(cross(up, pos))
}
```

- The camera is attached to the carrier and **always faces the planet centre**.
- The carrier moves freely on its sphere with the cursor keys.
- `Up`/`Down` move the carrier along the current local `up`; `Left`/`Right` along local `right`.
- After every move, `up` is **parallel-transported** so the local frame stays consistent across the
  poles. There is no Euler yaw/pitch and no clamp.
- Carrier distance is fixed during orbit: `3.2` by default.
- **Zoom changes the carrier radius** (`camera.distance`), from `2.0` to `8.0` in the viewer.
  Projection focal length is fixed; the camera physically dollies toward/away from the planet.

### Why this works

- A carrier point + tangent frame has no gimbal lock.
- `pos` remains unit length and `up` stays tangent automatically.
- A full loop over a pole never reverses the local Up because `up` is parallel-transported, not
  recomputed from Euler angles.
- The camera always faces the centre by construction, so it cannot roll away or flip.

## 3. Mouse: rotate the object, follow the surface point

Mouse drag rotates the **object**, never the camera carrier.

1. On pointer-down, unproject the cursor to the visible sphere surface → `P0`.
2. On pointer-move, unproject to → `P1`.
3. Compute the shortest quaternion taking `P0` to `P1`:

```text
axis  = normalize(cross(P0, P1))
angle = acos(clamp(dot(P0, P1), -1, 1))
delta = axisAngle(axis, angle)
objectQ = normalize(delta * objectQ_at_pointer_down)
```

The camera carrier is untouched, so the grabbed point follows the cursor exactly.

## 4. Screen → sphere unprojection

Carrier basis: `pos`, `up`, `right`; fixed focal length.

```text
focal = min(W,H) * SPHERE_SCREEN_FRACTION * CAMERA_DISTANCE   // fixed
X = x - W/2
Y = H/2 - y

dirWorld = normalize(right*X + up*Y - pos*focal)   // ray into the scene
origin   = pos * camera.distance

b = 2*dot(origin, dirWorld)
c = dot(origin, origin) - 1
t = (-b - sqrt(b² - 4c)) / 2
P = normalize(origin + t*dirWorld)
```

Critical detail: the ray direction is **`-pos*focal`**, into the scene. Using `+focal` makes the ray
point out of the screen, the intersection fails, and the drag does nothing.

## 5. Rendering: WebGL ray–sphere shader

The viewer uses a full-screen WebGL shader rather than a mesh:

- Per pixel, a ray from the carrier is intersected with the unit sphere.
- The nearest intersection is the **front surface**; back faces are impossible to draw because
  there is no rasterized back surface.
- Shading uses the sphere normal.
- The 30 icosahedron edges are analytic great-circle bands, front surface only.
- Edge width is scaled to a constant screen-pixel width (`1.5 * (distance-1)/focal`), so close
  dollies do not create giant black bands.
- Object rotation is applied by rotating the surface point into object space before edge tests.
- No stars, halo, background pseudo-planet, or back-edge wireframe.

### Why the WebGL solution works

Canvas2D projected mesh/wireframe could not reliably hide back edges or partial spherical triangles
at the silhouette. The shader solves it at the pixel level: only the nearest sphere intersection is
shaded, and edge bands are tested on that surface point. There is no hidden geometry to leak through.

## 6. What was wrong (do not reintroduce)

1. **Euler/turntable camera with clamped pitch.** It could not loop over the pole; after crossing,
   Up/Down reversed. Cursor keys must move the carrier, not change clamped Euler pitch.
2. **Mouse and camera were the same transform.** Mouse drag rotated the camera, so “rotate object”
   and “move camera” could not be independent. They are now `objectQ` and carrier state.
3. **Abstract arcball / incremental screen rotation for the object.** It did not keep the grabbed
   surface point under the cursor. Use surface-point unprojection + shortest-arc quaternion.
4. **Ray sign bug.** Unprojection used `+focal` (out of screen) instead of `-focal` (into scene).
   The intersection returned null and the drag appeared dead.
5. **Optical zoom.** Scale/focal changed instead of moving the camera. Zoom must change carrier
   radius with fixed focal length.
6. **Canvas2D front/back rendering.** Partial faces, hidden back edges, overhangs and fragmented
   arcs at the silhouette. Replaced by WebGL front-surface intersection.
7. **Verification only checked pixels, not gestures.** Tests now check per-key direction, carrier
   normals, object/camera separation, point-follow error, and live WebGL screenshots.

## 7. Implementation map

| File | Responsibility |
|---|---|
| `public/js/shared/geometry.js` | icosahedron vertices/faces, `SphereCamera` projection primitives |
| `public/js/shared/sphere-interaction.js` | `carrierFrame`, `carrierProject`, `carrierUnproject`, `moveCarrier`, `shortestArcQuat` |
| `public/js/icosahedron-viewer.js` | WebGL ray–sphere shader, carrier controls, object drag, fixed-focal dolly |
| `public/js/shared/orbit-controls.js` | orbit input SSOT: absolute surface-point drag, carrier arrow travel, mode polarity (CTL-01) |
| `public/js/shared/pointer-router.js` | pointer roles, capture, cancellation and pinch intents (CTL-06) |
| `public/js/shared/zoom-levels.js` | ladder constants, `zoomForLevel`, `zoomLevelForZoom`, `applyOrbitFarZoom` (CTL-04) |
| `test/sphere-interaction.test.js` | pure carrier/unprojection/shortest-arc tests, 720-step two-pole loop |
| `test/orbit-controls.test.js` | per-key sign table, drag/arrow inverse relation, Shift, dt clamp, 10 000 seeded steps |
| `scripts/verify-icosahedron-controls.mjs` | live numeric gesture acceptance |
| `scripts/verify-camera-carrier.mjs` | live camera/object separation and radius acceptance |
| `scripts/verify-icosahedron-visual.mjs` | live WebGL screenshot/coverage acceptance |

## 8. Acceptance evidence

Measured on live viewport 1200×1200:

- Mouse point-follow error: **< 1e-6 px** X and Y.
- 200 consecutive Up carrier steps: every step moves along the previous local Up, no reversal.
- 80 consecutive Right steps: same local Right direction.
- Carrier `pos` norm = `1.0`, `up` norm = `1.0`, `dot(pos,up)=0`.
- Cursor orbit leaves camera distance unchanged (`3.2`).
- Mouse drag changes `objectQ`, camera delta = `0`.
- Wheel-up changes carrier radius `3.2 → 1.756` (dolly in).
- WebGL visual acceptance passes default, close and upside-down screenshots.
- **116/116 tests passed at the v3.57.0 delivery.** The current suite total is generated into
  `ARCHITECTURE.md`/`README.md` and enforced by `scripts/test-count.mjs`; see `docs/TEST_MAP.md`.

## 9. Rules

### Must

- One icosahedron, 20 spherical faces, same object at all distances.
- Camera = carrier `pos` + parallel-transported `up`; always faces centre.
- Cursor keys move carrier only; mouse rotates object only.
- Unproject screen points to the actual sphere surface with `-focal` ray direction.
- Fixed focal length; zoom changes carrier radius.
- Render the front surface only; no back faces/edges.
- Test both numbers and live visuals before claiming a fix.

### Must not

- Do not use Euler/clamped camera pitch or accumulate camera roll.
- Do not merge object and camera transforms.
- Do not use incremental screen rotation for the dragged surface point.
- Do not compose the drag arc on the left of the captured transform (use `q0 · delta`).
- Do not assign Euler yaw/pitch from keyboard travel; move the carrier frame instead.
- Do not add a second input path beside `shared/orbit-controls.js`.
- Do not use optical zoom or scale the projection.
- Do not draw a generated surface mesh or hidden back edges.
- Do not call a pixel-coverage test “visual proof” by itself.

## 9b. Orbit input SSOT (CTL-01)

There is exactly one input→camera contract; `public/js/shared/orbit-controls.js` owns it.
`app.js` forwards events and never computes an orientation itself.

### Sign table

| Input | Carrier tangent | Screen delta of a fixed surface point |
|---|---|---|
| `ArrowRight` / `ArrowLeft` | `+right` / `−right` | `Δx < 0` / `Δx > 0` |
| `ArrowUp` / `ArrowDown` | `+up` / `−up` | `Δy > 0` / `Δy < 0` |
| drag right / drag down | absolute (grabbed point follows) | `Δx > 0` / `Δy > 0` |

- Arrow travel is **inverse to drag** by construction: arrows move the carrier, drag moves
  the object.
- `KEY_RATE_RAD_S = 1.05`, `SHIFT_BOOST = 2.1`, `MAX_STEP_DT = 0.05` (a tab-switch frame
  cannot jump a hemisphere).
- No Euler yaw/pitch is assigned in the input path. `SphereCamera.setCarrier(pos, up)` rebuilds
  the object quaternion from the parallel-transported carrier frame.

### Absolute drag

At pointer-down the grabbed world point `P0` and the object quaternion `q0` are captured, with the
focal length frozen for the gesture. Every move unprojects the pointer against that frozen view to
`P1`, then applies the world-space shortest arc on the **right** of the captured transform:

```text
delta = shortestArcQuat(P0, P1)      // world space
q     = normalize(q0 · delta)        // grabbed point follows the pointer
```

Composing on the left (`delta · q0`) is the same-family mistake the v3.57 rewrite made: the
grabbed point drifts instead of following (measured 144 px over a 120×80 px drag; the right-side
composition measures 0 px). `reverse` mode negates the arc; arrows are unchanged.

## 9c. Culling bounds and frame truth (CTL-02)

- `_computeCameraFrame` takes its axis **only** from `camera.viewAxis()` and throws when it is
  absent or non-finite. There is no Euler fallback anywhere in the renderer.
- `NEAR_EPS = 1e-3` — samples nearer than this to the camera plane are skipped, never mirrored.
- `OVERSCAN = 4` — projected coordinates clamp to `±4·max(W, H)` so a silhouette sample cannot
  produce an unbounded bbox or streak.
- `frameStats()` returns `{ visCount, culled, nearSkipped, emptyFrames, axis }` and is mirrored as
  `window.__ICOSA__.renderStats()`. `emptyFrames` counts a frame that drew zero faces while the
  world has faces; the app surfaces `VIEW RECOVERY` once and resets the camera.

## 10. Camera interface contract (RND-01)

`IcosaRenderer` draws one planet through one interface. Both cameras implement
`public/js/shared/camera-contract.js` (`CAMERA_CONTRACT_VERSION = 1`), so the
renderer never branches on camera identity.

| Member | Unit / meaning |
|---|---|
| `width`, `height` | CSS pixels of the viewport |
| `zoom` | positive scalar; dolly/magnification state |
| `distance` | camera radius from the planet centre, in sphere radii |
| `focalPx` | projection focal length in CSS pixels |
| `nearPlane` | forward-depth bound in sphere radii |
| `project(p)` | → `{ x, y, z, depth, visible }` |
| `unprojectView(v)` | view-space vector → world vector (orthonormal) |
| `viewAxis()` | unit world direction planet-centre → camera (culling axis) |
| `unprojectScreen(x, y)` | pixel ray → `{ point }` or `null` |
| `setViewport(w, h)` | resize the projection |

Invariants: `z === dot(point, viewAxis())`; `depth` is the forward depth and may
be negative behind the camera; `visible` means the point is drawable inside the
camera's near bound; `project()` never mutates camera state.

The orbital `SphereCamera` keeps its quaternion view and pixels; the contract
members are additive (`depth`, `focalPx`, `nearPlane`, `unprojectScreen`).

### Surface view uses the same camera

There is **no separate surface camera and no derived surface mesh**. The game has
one `SphereCamera` instance and one `IcosaRenderer` instance for the whole zoom
range. Entering the surface does not swap projection, canvas, RAF loop or scene:
it moves the same camera deeper (zoom), keeps the same active-cell leaf pass, and
adds the pilot/peer/entity overlay through the same `project()`/`viewAxis()`
interface. Scrolling in/out continues the same camera; scrolling out past the
surface entry rung returns to orbit through the exit policy.

The earlier experiments (a third-person `SurfaceCamera`, a seed-keyed globe, and
a revision-gated 6000-triangle "live surface mesh") were separate-scene hacks.
They produced broken arc-triangle overlays and are removed from the product and
from the renderer.

## 11. Surface mode is a camera change (RND-02)

Surface mode draws the same planet object through the same `IcosaRenderer` on
the same `#arena-canvas`. There is no second canvas, second RAF loop, second
projection or second HUD:

- `app.js` owns `view ∈ {orbit, surface}` and the single `requestAnimationFrame`
  loop.
- Entering keeps the same `SphereCamera` and deepens its zoom; the surface adds
  the control mode and entity overlay only. Exiting returns to the farthest orbit
  through the single exit policy (CTL-04).
- `surface-controller.js` advances the pilot pose, resolves the harvest target
  through `shared/harvest.js`, and produces `SurfaceEntity[]`
  (`self`, `peer`, `pin`, `beam`). Entities reference cells by `cellLabel`.
- The renderer draws backdrop → planet → cells → markers → labels → entity pass
  (avatars, pins, beams, harvest FX, landing/leaving ship).
- `World.leaves` is the only client tree; surface entities never copy `a`/`b`/`c`.
- The planet, cells, edges, labels and markers are the same render pipeline and
  the same `World.leaves` tree at every zoom. No derived mesh, cached globe or
  second projection exists.
- Canvas terrain keeps its accessible equivalent in the HUD: the surface target
  readout reports the cell label and harvest state, and `#surface-controls` is a
  labelled `role="group"` with 44 px targets.

Rollback: revert the commit; there is no second renderer or flag to fall back to.

## 12. Surface figures and event visuals (RND-05, RND-07)

Pilots and robots are closed-triangle bodies placed in the tangent frame of their
authoritative surface pose; they are never billboards and never a second
projection:

```
up      = normalize(anchor)                       // unit sphere point
forward = tangent(pos, heading)                   // parallel-transported heading
right   = normalize(cross(up, forward))
world   = anchor + up·v_y + right·v_x + forward·v_z   // v = posed rig vertex × scale
screen  = camera.project(world)
```

- **Projection is the shared camera contract.** The rig consumes only
  `project()`/`viewAxis()`; orbit and surface camera maths do not change for
  figures. A figure's screen height is `focalPx · worldHeight / depth`; the
  production scale maps a 0.95-unit figure to 12–90 CSS px at the legacy
  surface depth.
- **Depth order and culling.** Faces are painter-sorted far → near by mean
  projected depth (stable sort for equal depths) and back-face culled against
  the camera eye; a figure anchored behind the camera's surface horizon is
  skipped entirely, so a far-side peer never projects a mirrored silhouette.
- **Distance LOD is hysteretic.** `d = acos(clamp(dot(anchor, viewAxis)))`;
  L0 ≤ 0.35 rad (132 triangles), L1 ≤ 0.80 rad (72), L2 beyond (2-triangle
  silhouette). A level is retained 0.03 rad outside its boundary and only
  restored 0.03 rad inside it, so a figure on the edge cannot flicker.
- **Mining visuals are server events.** `surface_mine` carries the awarded cell
  label plus the click-time pose; the renderer interpolates peer poses on a
  fixed 120 ms delay (twice the 10 Hz surface broadcast, holding the newest
  sample and never extrapolating past it), starts a beam at the peer's tool arm
  and ends it on that leaf's centroid with `alpha = 1 − age/ttlMs`. A beam whose
  target leaf is absent is dropped and counted; a beam whose cell is off screen
  is indicated by a canvas-edge chevron, never a new DOM surface. Under
  `prefers-reduced-motion` the walk freezes and the beam renders as a static
  marker.

Rollback: revert the commit; there is no second renderer or flag to fall back to.
