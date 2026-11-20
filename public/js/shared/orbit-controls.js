/**
 * NARIMATO — orbit input SSOT (CTL-01).
 *
 * This is the only module that turns pointer/keyboard intent into camera math.
 * It is DOM-free and storage-free: `app.js` forwards events, this module owns
 * the numbers, `SphereCamera` owns the object quaternion and the carrier frame.
 *
 * Two gestures, one sign table:
 *  - pointer drag: absolute surface-point follow. The world point unprojected at
 *    pointer-down is mapped to the point under the pointer by a shortest-arc
 *    quaternion applied to the object transform captured at grab time. The
 *    grabbed point therefore follows the cursor, including upside down.
 *  - arrow keys: carrier travel on the concentric sphere at a fixed angular
 *    rate with parallel-transported `up`, so both poles survive with no Euler
 *    rebuild. Direction is inverse to the drag by construction.
 *
 * `follow` keeps the surface under the cursor; `reverse` mirrors the drag only
 * (arrows are unchanged). Persistence lives in `control-prefs.js` (CTL-05).
 */

import { qMul, qNormalize, qRotateInverse } from './geometry.js';
import { unprojectSphere, shortestArcQuat, carrierFrame, moveCarrier } from './sphere-interaction.js';

/** Carrier travel rate in radians/second at one arrow key. */
export const KEY_RATE_RAD_S = 1.05;
/** `Shift` multiplies the angular step (GAMEPLAY.md promise). */
export const SHIFT_BOOST = 2.1;
/** Longest frame step accepted after a tab switch, so a key cannot jump a hemisphere. */
export const MAX_STEP_DT = 0.05;

export const ORBIT_MODES = Object.freeze(['follow', 'reverse']);

/** Arrow -> carrier tangent in the live local frame: [right, up]. */
export const ARROW_TANGENTS = Object.freeze({
  ArrowLeft: Object.freeze([-1, 0]),
  ArrowRight: Object.freeze([1, 0]),
  ArrowUp: Object.freeze([0, 1]),
  ArrowDown: Object.freeze([0, -1]),
});

/** Only `follow` and `reverse` exist; anything else resolves to `follow`. */
export function normalizeMode(value) {
  return value === 'reverse' ? 'reverse' : 'follow';
}

/** `I` and the HUD toggle share this one transition. */
export function toggleMode(mode) {
  return normalizeMode(mode) === 'reverse' ? 'follow' : 'reverse';
}

/** Human-readable drag direction label (visible HUD state, not a toast). */
export function modeLabel(mode) {
  return normalizeMode(mode) === 'reverse' ? 'DRAG: REVERSE' : 'DRAG: FOLLOW CURSOR';
}

/** Sentence announced once per mode change. */
export function modeAnnouncement(mode) {
  return normalizeMode(mode) === 'reverse'
    ? 'Drag reversed — arrows unchanged'
    : 'Drag follows the cursor — arrows unchanged';
}

/**
 * A frozen view for the whole gesture: the unprojection must use the camera as
 * it was at pointer-down, otherwise the grabbed point drifts as the camera turns.
 * Focal length is captured too, so absolute drag stays exact at every zoom.
 */
function frozenView(camera, q0) {
  const distance = Number(camera && camera.distance) || 3.2;
  return {
    distance,
    project: () => ({ x: 0, y: 0, z: 0, depth: distance, visible: false }),
    unprojectView: (v) => qRotateInverse(q0, v),
    viewAxis: () => qRotateInverse(q0, { x: 0, y: 0, z: 1 }),
    focalPx: Number(camera && camera.focalPx) || 0,
  };
}

function quaternionOf(camera) {
  if (!camera) return null;
  if (typeof camera.viewQuaternion === 'function') {
    const q = camera.viewQuaternion();
    return q && Number.isFinite(q.w) ? q : null;
  }
  const q = camera._q;
  return q && Number.isFinite(q.w) ? { ...q } : null;
}

/**
 * Begin an absolute surface-point drag.
 * @returns {{q0:object,start:object|null,width:number,height:number,focalPx:number}|null}
 *   `start === null` means the pointer missed the sphere; the gesture is then a
 *   no-op and the camera stays untouched (matching the v3.57 "drag does nothing
 *   off the surface" rule).
 */
export function beginSurfaceDrag(camera, xPx, yPx, width, height) {
  const q0 = quaternionOf(camera);
  if (!q0) return null;
  const w = Math.max(1, Number(width) || 1);
  const h = Math.max(1, Number(height) || 1);
  const focalPx = Number(camera && camera.focalPx) || null;
  const start = unprojectSphere(frozenView(camera, q0), xPx, yPx, w, h, focalPx);
  return { q0, start, width: w, height: h, focalPx };
}

/**
 * Continue the drag: map the grabbed point to the point under the pointer with
 * `delta = shortestArcQuat(P0, P1)` on the object transform (`delta · q0`).
 * `reverse` mirrors the rotation; `follow` is the direct mapping.
 */
export function dragSurfaceTo(camera, drag, xPx, yPx) {
  if (!camera || !drag || !drag.q0) return camera;
  if (!drag.start) return camera;
  const view = frozenView(camera, drag.q0);
  const next = unprojectSphere(view, xPx, yPx, drag.width, drag.height, drag.focalPx || null);
  if (!next) return camera;
  return applySurfaceArc(camera, drag.q0, drag.start, next, drag.mode);
}

/**
 * Apply a shortest-arc rotation from `fromPoint` to `toPoint` on top of `q0`.
 *
 * The shortest arc is a world-space rotation, so it composes on the *right* of
 * the captured object transform: `q = q0 · delta`. That keeps the grabbed world
 * point under the pointer (`R1·P0 = R0·delta·P0 = R0·P1`). Exposed so the
 * drag/arrow inverse relation and the follow error are testable.
 */
export function applySurfaceArc(camera, q0, fromPoint, toPoint, mode = 'follow') {
  const arc = shortestArcQuat(fromPoint, toPoint);
  const delta = normalizeMode(mode) === 'reverse'
    ? { x: -arc.x, y: -arc.y, z: -arc.z, w: arc.w }
    : arc;
  const q = qNormalize(qMul(q0, delta));
  if (typeof camera.setOrientation === 'function') camera.setOrientation(q);
  else camera._q = q;
  return camera;
}

/**
 * Arrow travel: move the carrier along the live tangent frame and rebuild the
 * object quaternion from the parallel-transported frame. No Euler yaw/pitch is
 * assigned anywhere in this path, so a pole crossing cannot flip travel.
 */
export function applyArrowTravel(camera, key, dtSec, shift = false) {
  const tangent = ARROW_TANGENTS[key];
  if (!camera || !tangent) return camera;
  const dt = Math.min(Math.max(Number(dtSec) || 0, 0), MAX_STEP_DT);
  if (!(dt > 0)) return camera;
  const pos = typeof camera.viewAxis === 'function' ? camera.viewAxis() : null;
  if (!pos) return camera;
  const up = typeof camera.carrierUp === 'function' ? camera.carrierUp() : { x: 0, y: 1, z: 0 };
  const frame = carrierFrame(pos, up);
  const angle = KEY_RATE_RAD_S * dt * (shift ? SHIFT_BOOST : 1);
  const moved = moveCarrier(frame, tangent[0], tangent[1], angle);
  if (typeof camera.setCarrier === 'function') camera.setCarrier(moved.pos, moved.up);
  return camera;
}

/**
 * One frame of held-arrow travel. Returns the keys that contributed, so the app
 * can keep its telemetry mirror. Diagonal input is combined on the tangent
 * plane and normalised, so `Up`+`Right` is not faster than a straight arrow.
 */
export function applyArrowTravelFrame(camera, keys, dtSec, shift = false) {
  const pressed = [];
  let dx = 0;
  let dy = 0;
  for (const key of keys || []) {
    const tangent = ARROW_TANGENTS[key];
    if (!tangent) continue;
    dx += tangent[0];
    dy += tangent[1];
    pressed.push(key);
  }
  if (!pressed.length) return camera;
  const len = Math.hypot(dx, dy) || 1;
  const dt = Math.min(Math.max(Number(dtSec) || 0, 0), MAX_STEP_DT);
  if (!(dt > 0)) return camera;
  const pos = typeof camera.viewAxis === 'function' ? camera.viewAxis() : null;
  if (!pos) return camera;
  const up = typeof camera.carrierUp === 'function' ? camera.carrierUp() : { x: 0, y: 1, z: 0 };
  const frame = carrierFrame(pos, up);
  const angle = KEY_RATE_RAD_S * dt * (shift ? SHIFT_BOOST : 1);
  const moved = moveCarrier(frame, dx / len, dy / len, angle);
  if (typeof camera.setCarrier === 'function') camera.setCarrier(moved.pos, moved.up);
  return camera;
}
