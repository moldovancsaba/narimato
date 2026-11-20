# NARIMATO — Physics & Interaction Model

> Source of truth for how the planet, camera and cursor work. Any renderer, viewer or future
> client must follow these rules. If code and this document disagree, fix the code.

## 1. The single planet object

- One object: the **regular spherical icosahedron**, 20 faces, 12 vertices, 30 edges.
- Geometry comes only from `public/js/shared/geometry.js` (`baseIcosahedron()`).
- Runtime rendering must use the **same triangles** for every camera height:
  - orbit / spaceship,
  - commercial flight height,
  - building height,
  - surface.
- **Forbidden:**
  - generating a denser “surface” mesh,
  - adaptive/per-camera triangle density,
  - LOD that swaps the object,
  - drawing a second copy of the planet.
- If the object needs more detail, the object itself must be modelled at a higher fixed
  resolution **before** it is used; it must never be synthesised per-camera at runtime.

## 2. Camera

One camera. It always sits on a **fixed-radius orbit around the object centre**.

- Camera centre distance is constant (`CAMERA_DISTANCE`).
- The camera may orbit (change yaw/pitch) and zoom optically, but it never changes the centre
  distance for zoom.
- “Space”, “flight”, “building” and “surface” are **the same object viewed by the same camera
  orbit at a chosen orientation**, not different cameras with different distances.

### Camera orbit (cursor keys)

Cursor keys move the camera, not the object.

| Key | Effect |
|---|---|
| `Up` | camera flies **straight down** around the planet (pitch decreases) |
| `Down` | camera flies straight up (pitch increases) |
| `Left` | camera orbits left |
| `Right` | camera orbits right |

- `Up`/`Down` must not change yaw.
- The orbit is a **free quaternion**: `Up` keeps moving the camera up locally and loops over the
  pole; there is no pitch clamp.
- Wheel/pinch changes `camera.zoom` only — it is optical zoom, **not** radius.

## 3. Object rotation (mouse)

Mouse drag rotates the **object**, never the camera.

- On pointer-down, unproject the cursor onto the visible sphere to get the grabbed surface point
  `P0` in world space.
- On pointer-move, unproject the new cursor to `P1`.
- Rotate the object by the shortest quaternion taking `P0` to `P1`:

```
axis = normalize(cross(P0, P1))
angle = acos(clamp(dot(P0, P1), -1, 1))
delta = axisAngle(axis, angle)
objectQ = normalize(delta * objectQ_at_pointer_down)
```

This makes the **grabbed surface point follow the cursor exactly**. Do not use incremental
screen-axis rotation for the object; do not use an abstract arcball vector when the requirement is
“the surface point follows the mouse”.

## 4. Unprojection math

Screen → ray → sphere intersection:

```
radius = min(W,H) * SPHERE_SCREEN_FRACTION * camera.zoom
focal  = radius * CAMERA_DISTANCE
X = x - W/2
Y = H/2 - y                      // screen Y is down; camera Y is up

dirCam    = normalize(X, Y, -focal)      // NEGATIVE z: ray goes into the scene
dirWorld  = camera.unprojectView(dirCam) // camera space → world space
origin    = camera.viewAxis() * CAMERA_DISTANCE
```

Intersect the ray `origin + t·dirWorld` with the unit sphere centred at the origin:

```
b = 2·dot(origin, dirWorld)
c = dot(origin, origin) - 1
t = (-b - sqrt(b² - 4c)) / 2
P = normalize(origin + t·dirWorld)
```

Common bug: using `z = +focal` points the ray out of the screen, the intersection fails, and the
grab returns `null` — dragging then does nothing.

## 5. What we use and why

| Piece | Choice | Why |
|---|---|---|
| Object rotation | world-space quaternion `objectQ` | no gimbal lock, arbitrary orientation, shortest-arc |
| Camera orbit | separate `orbitYaw` / `orbitPitch` | camera moves independently from object |
| Mouse | surface-point unprojection + shortest-arc quaternion | grabbed point follows cursor exactly |
| Cursor keys | `orbitYaw`/`orbitPitch` | explicit up/down/left/right camera orbit |
| Zoom | `camera.zoom` (optical) | fixed centre distance; never a dolly |
| Geometry | `baseIcosahedron()` | one object, 20 spherical triangles |

## 6. Implementation

- `public/js/shared/geometry.js`
  - `SphereCamera` quaternion orientation, `project()`, `unprojectView()`, `viewAxis()`,
    `beginVirtualTrackball()` / `virtualTrackballTo()` (kept for generic trackball use only).
- `public/js/shared/orbit-controls.js`
  - shared `applyScreenDrag`, `applyArrowKey`, `beginTrackball`, `dragTrackball`.
- `public/js/icosahedron-viewer.js`
  - split `objectQ` (mouse) and free `camera` quaternion orbit (cursor keys);
  - exact point-follow via `unprojectSphere()`.
- `public/js/app.js`
  - pointer input routes to the shared control primitives.

## 7. Tests / verification

- `test/orbit-controls.test.js` — drag direction, cursor-key direction, fixed orbit radius,
  virtual-trackball finiteness across poles.
- `scripts/verify-icosahedron-controls.mjs` — browser-level acceptance:
  - mouse-dragged surface point follows the cursor with error `< 0.01 px`;
  - cursor Up keeps moving the camera up locally across the pole, quaternion normalised.

Measured acceptance (1200×1200):

- point-follow error X: `5.061e-7 px`
- point-follow error Y: `7.054e-7 px`
- cursor Up: `yaw 0.55 → 0.55`, `pitch 0.27 → 0.22`

## 8. Do / do not

### Do

- Split object rotation and camera orbit.
- Keep camera centre distance fixed; zoom is optical.
- Use `z = -focal` in unprojection.
- Rotate the object with the shortest quaternion from `P0` to `P1`.
- Test the actual projected numbers, not just “it feels right”.

### Do not

- Do not use incremental local-axis rotation for the mouse object grab.
- Do not invert screen Y unless you are converting from screen-down to camera-up.
- Do not generate per-camera surface geometry.
- Do not merge object and camera transforms.
- Do not change camera distance to zoom.
