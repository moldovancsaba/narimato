# NARIMATO — Physics, Camera & Rendering Solution

<!-- delivery-ssot:start -->
> **Delivery SSOT:** [NARIMATO delivery board](https://github.com/users/moldovancsaba/projects/80) · [Definition of Done](docs/DEFINITION_OF_DONE.md) · [Issue index](docs/ISSUE_MAP.md).
> This document owns durable knowledge; it does not track delivery status.
>
> **Related delivery issues:** [QA-01](https://github.com/moldovancsaba/narimato/issues/5) · [DOC-01](https://github.com/moldovancsaba/narimato/issues/6) · [RND-01](https://github.com/moldovancsaba/narimato/issues/14) · [CTL-01](https://github.com/moldovancsaba/narimato/issues/26) · [CTL-02](https://github.com/moldovancsaba/narimato/issues/27)
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
