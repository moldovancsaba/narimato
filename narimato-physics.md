# NARIMATO — Physics, Camera & Rendering Solution

<!-- delivery-ssot:start -->
> **Delivery SSOT:** [NARIMATO delivery board](https://github.com/users/moldovancsaba/projects/80) · [Definition of Done](docs/DEFINITION_OF_DONE.md) · [Issue index](docs/ISSUE_MAP.md).
> This document owns durable knowledge; it does not track delivery status.
>
> **Related delivery issues:** [QA-01](https://github.com/moldovancsaba/narimato/issues/5) · [DOC-01](https://github.com/moldovancsaba/narimato/issues/6) · [RND-01](https://github.com/moldovancsaba/narimato/issues/14) · [RND-02](https://github.com/moldovancsaba/narimato/issues/15) · [RND-03](https://github.com/moldovancsaba/narimato/issues/16) · [RND-04](https://github.com/moldovancsaba/narimato/issues/17) · [CTL-01](https://github.com/moldovancsaba/narimato/issues/26) · [CTL-02](https://github.com/moldovancsaba/narimato/issues/27)
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
| `public/js/shared/camera-contract.js` | `CameraView` member list, `assertCameraView`, `focalPxFor`, dolly/tilt helpers, `?surface-camera` parser |
| `public/js/shared/surface-camera.js` | `SurfaceCamera` (legacy third-person frame and carrier framing) on the shared contract |
| `public/js/icosahedron-viewer.js` | WebGL ray–sphere shader, carrier controls, object drag, fixed-focal dolly |
| `public/js/shared/orbit-controls.js` | shared game mouse/trackball/cursor primitives |
| `test/sphere-interaction.test.js` | pure carrier/unprojection/shortest-arc tests |
| `test/orbit-controls.test.js` | shared game control direction tests |
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
- Do not use optical zoom or scale the projection.
- Do not draw a generated surface mesh or hidden back edges.
- Do not call a pixel-coverage test “visual proof” by itself.

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

### Surface carrier framing

`SurfaceCamera` composes the proven carrier primitives (section 2) for the
surface view:

```
pos     = normalize(anchor)                 // pilot ground point
fwd     = tangent(pos, heading)             // pilot heading
right   = normalize(cross(fwd, pos))
forward = normalize(−cos(tilt)·pos + sin(tilt)·fwd)
cam     = pos · distance
up      = normalize(cross(right, forward))

depth = dot(v − cam, forward)
z     = dot(v, pos)                          // front-hemisphere coordinate
x     = W/2 + focalPx · dot(v − cam, right) / depth
y     = H/2 − focalPx · dot(v − cam, up) / depth
```

- `focalPx = focalPxFor(W, H) = max(W, H) / 2` — fixed for the viewport.
- `tilt` is clamped to `[0.95, 1.30]` rad from the inward normal (54.4° … 74.5°).
- Dolly: `d(z) = 1.08 · (1.72 / 1.08)^z`, `z = clamp(0.5 + 0.5·log2(zoom), 0, 1)`;
  `zoom = 0.25 → 1.08`, `zoom = 1 → 1.363`, `zoom = 4 → 1.72`.
- Screen inverse casts the pixel ray from `cam` and returns the near root
  `(−b − √(b² − 4c)) / 2`.

Near-plane proof: the fixed focal makes the largest on-screen ray angle 45°,
so any point projecting inside the viewport has
`depth ≥ (d − 1)·cos 45° ≥ 0.08 · 0.7071 = 0.0566 > 0.05` for every
`d ∈ [1.08, 1.72]`. Only points behind the camera or beyond the rendered field
of view fall below the near plane.

Framing selector: `?surface-camera=legacy|carrier` (default `legacy`). The
legacy third-person frame (eye `1 + 0.024` radii, fixed focal `height × 1.36`)
is the production surface framing until RND-06 proves carrier pixel parity; the
carrier framing is the opt-in, contract-complete implementation.
`window.__ICOSA__.cameraMode()` returns `{ surface, contractVersion }`.

The surface camera never reads tokens, tags or player ids: it consumes only
unit-sphere geometry and the server-validated surface pose.

## 11. Surface mode is a camera change (RND-02)

Surface mode draws the same planet object through the same `IcosaRenderer` on
the same `#arena-canvas`. There is no second canvas, second RAF loop, second
projection or second HUD:

- `app.js` owns `view ∈ {orbit, surface}` and the single `requestAnimationFrame`
  loop.
- Entering stores `{ yaw, pitch, zoom, distance }` and switches the camera to
  `SurfaceCamera` plus the control mode; exiting restores the stored orbit
  exactly (one frame).
- `surface-controller.js` advances the pilot pose, resolves the harvest target
  through `shared/harvest.js`, and produces `SurfaceEntity[]`
  (`self`, `peer`, `pin`, `beam`). Entities reference cells by `cellLabel`.
- The renderer draws backdrop → planet → cells → markers → labels → entity pass
  (avatars, pins, beams, harvest FX, landing/leaving ship).
- `World.leaves` is the only client tree; surface entities never copy `a`/`b`/`c`.
- The surface underlay is the live leaf mesh (RND-04): it is derived from
  `World.leaves` on every revision change, budget-clamped to 6000 triangles and
  rebuilt at most once per frame. There is no cached seed-keyed globe.
- Canvas terrain keeps its accessible equivalent in the HUD: the surface target
  readout reports the cell label and harvest state, and `#surface-controls` is a
  labelled `role="group"` with 44 px targets.

Rollback: `?surface-renderer=overlay` is parsed but fails closed to the single
scene; the only real rollback is reverting the RND-02 commit.
