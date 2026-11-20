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

One camera. It always sits on a **concentric orbit sphere** around the object centre.

- The camera is fixed to a carrier point on that outer sphere.
- **Zoom changes the carrier sphere radius** (`camera.distance`) with a **fixed focal length**;
  moving the carrier changes perspective/size like a real dolly, not a projection zoom.
- The camera orbits freely and always faces the centre; zoom changes the carrier radius.
- “Space”, “flight”, “building” and “surface” are **the same object viewed by the same camera
  orbit at a chosen orientation**, not different cameras with different distances.

### Camera orbit (cursor keys)

Cursor keys move the camera, not the object.

| Key | Effect |
|---|---|
| `Up` | camera moves **up** in its current local orbit frame |
| `Down` | camera moves down |
| `Left` | camera orbits left |
| `Right` | camera orbits right |

- `Up`/`Down` work in the camera's local frame and must not jump when crossing a pole.
- The orbit is a **free quaternion**: repeated `Up` keeps moving the camera up and loops over the
  pole; there is no pitch clamp.
- Wheel/pinch changes the carrier sphere radius (`camera.distance`) within `[1.3, 8.0]`.
- Projection focal length is fixed; the carrier moving is a real dolly, not projection zoom.

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
focal  = min(W,H) * SPHERE_SCREEN_FRACTION * CAMERA_DISTANCE  // fixed
screenX = W/2 + focal * pv.x / (camera.distance - pv.z)
screenY = H/2 - focal * pv.y / (camera.distance - pv.z)
X = x - W/2
Y = H/2 - y                      // screen Y is down; camera Y is up

dirCam    = normalize(X, Y, -focal)      // NEGATIVE z: ray goes into the scene
dirWorld  = camera.unprojectView(dirCam) // camera space → world space
origin    = camera.viewAxis() * camera.distance
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
| Camera orbit | free quaternion (`camera.rotate` locally) | camera moves independently from object, no clamp |
| Mouse | surface-point unprojection + shortest-arc quaternion | grabbed point follows cursor exactly |
| Cursor keys | free camera quaternion | explicit local up/down/left/right, infinite orbit |
| Zoom | `camera.distance` (carrier radius) | zoom dollies the carrier toward/away from the planet |
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
- `scripts/verify-icosahedron-controls.mjs` — browser-level numeric acceptance;
- `scripts/verify-icosahedron-visual.mjs` — captures default/close/upside-down views and checks
  canvas coverage/background.
  - mouse-dragged surface point follows the cursor with error `< 0.01 px`;
  - cursor Up keeps moving the camera up locally across the pole, quaternion normalised.

Measured acceptance (1200×1200):

- point-follow error X: `5.061e-7 px`
- point-follow error Y: `7.054e-7 px`
- visual acceptance: default/close/upside-down screenshots pass coverage/background checks
- zoom: carrier `3.2 → 1.756` on wheel-up
- cursor Up: view-axis Y `0.2667 → 0.4004` (camera up), yaw unchanged
- 41× Up: quaternion norm `1.0`, no clamp/flip

## 8. Do / do not

### Do

- Split object rotation and camera orbit.
- Keep the carrier on the orbit; zoom changes its radius.
- Use `z = -focal` in unprojection.
- Rotate the object with the shortest quaternion from `P0` to `P1`.
- Test the actual projected numbers, not just “it feels right”.

### Do not

- Do not use incremental local-axis rotation for the mouse object grab.
- Do not invert screen Y unless you are converting from screen-down to camera-up.
- Do not generate per-camera surface geometry.
- Do not merge object and camera transforms.
- Do not use optical zoom (`camera.zoom`) — zoom is the carrier radius.
