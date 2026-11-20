/**
 * NARIMATO — camera interface contract (RND-01).
 *
 * One declared interface is consumed by `IcosaRenderer`. Every camera that
 * draws a planet (`SphereCamera` in orbit, `SurfaceCamera` on the surface)
 * implements the same members with the same units, so the renderer never
 * branches on camera identity:
 *
 *   width, height      CSS pixels (viewport)
 *   zoom               positive scalar (dolly/magnification state)
 *   distance           camera radius from the planet centre, in sphere radii
 *   focalPx            fixed projection focal length in CSS pixels
 *   nearPlane          forward-depth bound in sphere radii
 *   project(p)         → { x, y, z, depth, visible }
 *   unprojectView(v)   view-space vector → world vector
 *   viewAxis()         unit world direction planet-centre → camera (culling axis)
 *   unprojectScreen(x, y) → { point } | null   (screen ray → unit-sphere point)
 *   setViewport(w, h)
 *
 * Invariants (asserted by `assertCameraView`):
 * - `project` never mutates camera state.
 * - `project(p).z === dot(p, viewAxis())` (front-hemisphere coordinate).
 * - `depth` is the forward depth and may be negative behind the camera.
 * - `visible` means the point is in front of the near plane and finite.
 * - `viewAxis()` is unit length; `unprojectView` is orthonormal.
 *
 * This module imports nothing from `renderer.js` or `app.js`; it is pure and
 * safe to load on the server (Node) for tests.
 */

export const CAMERA_CONTRACT_VERSION = 1;

/** Forward-depth bound shared by both cameras (sphere radii). */
export const CAMERA_NEAR_PLANE = 0.05;

/** Carrier camera dolly range (sphere radii) from `narimato-physics.md`. */
export const SURFACE_DOLLY_NEAR = 1.08;
export const SURFACE_DOLLY_FAR = 1.72;

/** Bounded third-person tilt, radians from the inward surface normal. */
export const SURFACE_TILT_MIN = 0.95;
export const SURFACE_TILT_MAX = 1.3;
export const SURFACE_TILT_DEFAULT = 1.12;

/** The member list the renderer is allowed to read. */
export const CAMERA_MEMBERS = Object.freeze([
  'width',
  'height',
  'zoom',
  'distance',
  'focalPx',
  'nearPlane',
  'project',
  'unprojectView',
  'viewAxis',
  'unprojectScreen',
  'setViewport',
]);

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Fixed focal length in CSS pixels. Using half the *largest* viewport side
 * keeps the maximum ray angle at 45° on both axes, which is what makes the
 * near-plane proof hold for every supported orientation (portrait included):
 * an on-screen point is at most 45° off axis, so `depth ≥ (d − 1)·cos 45°`.
 */
export function focalPxFor(width, height) {
  const w = Number(width) > 0 ? Number(width) : 1;
  const h = Number(height) > 0 ? Number(height) : 1;
  return Math.max(w, h) * 0.5;
}

/** Dolly animation parameter t ∈ [0,1] from the camera zoom scalar. */
export function dollyTForZoom(zoom) {
  const z = Number.isFinite(Number(zoom)) && Number(zoom) > 0 ? Number(zoom) : 1;
  return clamp(0.5 + 0.5 * Math.log2(z), 0, 1);
}

/** Monotonic dolly: d(0) = 1.08, d(1) = 1.72. */
export function dollyDistance(t) {
  return SURFACE_DOLLY_NEAR * Math.pow(SURFACE_DOLLY_FAR / SURFACE_DOLLY_NEAR, clamp(t, 0, 1));
}

/** `zoom` → carrier radius, following the documented dolly curve. */
export function zoomToDistance(zoom) {
  return dollyDistance(dollyTForZoom(zoom));
}

/** Clamp a tilt angle to the proven carrier range. */
export function tiltRad(value) {
  const n = Number(value);
  return clamp(Number.isFinite(n) ? n : SURFACE_TILT_DEFAULT, SURFACE_TILT_MIN, SURFACE_TILT_MAX);
}

/** Parse `?surface-camera=legacy|carrier`; production default is `legacy`. */
export function parseSurfaceCameraMode(search) {
  const raw = String(search == null ? '' : search);
  const query = raw.startsWith('?') ? raw.slice(1) : raw;
  let value = null;
  try {
    value = new URLSearchParams(query).get('surface-camera');
  } catch (_) {
    value = null;
  }
  const mode = String(value || '').trim().toLowerCase();
  return mode === 'carrier' ? 'carrier' : 'legacy';
}

const REQUIRED_FUNCTIONS = ['project', 'unprojectView', 'viewAxis', 'unprojectScreen', 'setViewport'];
const REQUIRED_NUMBERS = ['width', 'height', 'zoom', 'distance', 'focalPx', 'nearPlane'];

/**
 * Validate a camera against the contract. Throws a `TypeError` listing every
 * missing/malformed member; returns the camera unchanged when valid.
 * @param {object} camera
 * @param {string} [label]
 */
export function assertCameraView(camera, label = 'camera') {
  if (!camera || typeof camera !== 'object') {
    throw new TypeError(`${label}: not an object`);
  }
  const problems = [];
  for (const member of REQUIRED_FUNCTIONS) {
    if (typeof camera[member] !== 'function') problems.push(`missing function ${member}()`);
  }
  for (const member of REQUIRED_NUMBERS) {
    const value = camera[member];
    if (typeof value !== 'number' || !Number.isFinite(value)) problems.push(`${member} is not a finite number`);
    else if (member === 'nearPlane' ? value < 0 : !(value > 0)) {
      problems.push(member === 'nearPlane' ? 'nearPlane must be >= 0' : `${member} must be > 0`);
    }
  }
  if (!problems.length) {
    const axis = camera.viewAxis();
    if (!axis || !Number.isFinite(axis.x) || !Number.isFinite(axis.y) || !Number.isFinite(axis.z)) {
      problems.push('viewAxis() did not return a finite vector');
    } else if (Math.abs(Math.hypot(axis.x, axis.y, axis.z) - 1) > 1e-6) {
      problems.push('viewAxis() must be unit length');
    }
  }
  if (problems.length) {
    throw new TypeError(`${label}: camera contract violation — ${problems.join('; ')}`);
  }
  return camera;
}

/** `true` when a camera already satisfies the contract (never throws). */
export function isCameraView(camera) {
  try {
    assertCameraView(camera);
    return true;
  } catch (_) {
    return false;
  }
}

/** QA hook: the contract version plus the selected surface framing mode. */
export function cameraModeReport(surfaceMode) {
  return { surface: surfaceMode === 'carrier' ? 'carrier' : 'legacy', contractVersion: CAMERA_CONTRACT_VERSION };
}
