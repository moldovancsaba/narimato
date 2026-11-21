/**
 * NARIMATO — carrier camera (the approved spherical control model).
 *
 * One sphere object, one camera held by the cursor/pilot anchor:
 *   - mouse drag rotates the OBJECT with exact surface-point follow (quaternion,
 *     no Euler yaw/pitch and no pole reversal);
 *   - the carrier frame (pos/up) is the camera position; cursor/pilot movement
 *     advances it by parallel transport;
 *   - wheel changes the carrier RADIUS (fixed focal length), not the field of view.
 *
 * The projection maths live in `shared/sphere-interaction.js`; this class is the
 * CameraView adapter used by the renderer and picking. No DOM, no second scene.
 */

import { CAMERA_DISTANCE, SPHERE_SCREEN_FRACTION } from './geometry.js';
import {
  carrierFrame,
  carrierProject,
  carrierUnproject,
  shortestArcQuat,
} from './sphere-interaction.js';

const qNorm = (q) => {
  const l = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return { x: q.x / l, y: q.y / l, z: q.z / l, w: q.w / l };
};
const qMul = (a, b) => ({
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
});
const qInv = (q) => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });
const qRotate = (q, v) => {
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  };
};
const mul = (v, k) => ({ x: v.x * k, y: v.y * k, z: v.z * k });

export const MIN_CARRIER_DISTANCE = 1.05;
export const SURFACE_CARRIER_DISTANCE = 1.35;
export const MAX_CARRIER_DISTANCE = 8;

export class CarrierCamera {
  constructor(width = 1, height = 1, options = {}) {
    this.width = Math.max(1, Number(width) || 1);
    this.height = Math.max(1, Number(height) || 1);
    this.distance = CAMERA_DISTANCE;
    this.minDistance = Number.isFinite(options.minDistance) ? options.minDistance : MIN_CARRIER_DISTANCE;
    this.maxDistance = Number.isFinite(options.maxDistance) ? options.maxDistance : MAX_CARRIER_DISTANCE;
    this.carrier = carrierFrame({ x: 0, y: 0, z: 1 }, { x: 0, y: 1, z: 0 });
    this.objectQ = { x: 0, y: 0, z: 0, w: 1 };
    this._drag = null;
  }

  setViewport(width, height) {
    this.width = Math.max(1, Number(width) || 1);
    this.height = Math.max(1, Number(height) || 1);
    return this;
  }

  /** CameraView contract: fixed focal length for this viewport (px). */
  get focalPx() {
    return Math.min(this.width, this.height) * SPHERE_SCREEN_FRACTION * CAMERA_DISTANCE;
  }

  get nearPlane() {
    return 0;
  }

  /** Optical-equivalent zoom number for HUD/telemetry. */
  get zoom() {
    return CAMERA_DISTANCE / Math.max(1e-6, this.distance);
  }

  /** Screen radius of the sphere silhouette (used by the renderer halo). */
  get screenRadius() {
    const d = this.distance;
    if (!(d > 1)) return this.focalPx;
    return this.focalPx / Math.sqrt(d * d - 1);
  }

  /** World-space direction from the planet centre to the camera (front cull). */
  viewAxis() {
    return qRotate(qInv(this.objectQ), this.carrier.pos);
  }

  /** World-space camera eye. */
  get origin() {
    return mul(qRotate(qInv(this.objectQ), this.carrier.pos), this.distance);
  }

  /** Hold the camera at the pilot/cursor anchor; `up` is a tangent direction. */
  setPose(pos, up) {
    if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) return this;
    this.carrier = carrierFrame(pos, up || { x: 0, y: 1, z: 0 });
    return this;
  }

  setDistance(distance) {
    const next = Number(distance);
    if (Number.isFinite(next)) {
      this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, next));
    }
    return this;
  }

  /** Wheel/touch dolly: scale the carrier radius, keep focal fixed. */
  dolly(factor) {
    const f = Number(factor);
    if (Number.isFinite(f) && f > 0) this.setDistance(this.distance * f);
    return this;
  }

  /** World point -> screen (front-surface projection). */
  project(point) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) {
      return { x: 0, y: 0, z: 0, visible: false };
    }
    const rotated = qRotate(this.objectQ, point);
    const p = carrierProject(this.distance, this.focalPx, this.carrier, rotated);
    return {
      x: this.width / 2 + p.x,
      y: this.height / 2 + p.y,
      z: p.z,
      depth: p.depth,
      visible: p.visible,
    };
  }

  /** Carrier-space screen point -> world surface point under the cursor. */
  unprojectScreen(xPx, yPx) {
    const p = carrierUnproject(this.distance, this.focalPx, this.carrier, xPx, yPx, this.width, this.height);
    return p ? qRotate(qInv(this.objectQ), p) : null;
  }

  /** Camera-space direction -> world direction (inverse object rotation). */
  unprojectView(v) {
    return qRotate(qInv(this.objectQ), v);
  }

  /** Begin an absolute object drag from a screen point. */
  beginDrag(xPx, yPx) {
    const point = this.unprojectScreen(xPx, yPx);
    this._drag = point ? { point, q0: { ...this.objectQ } } : null;
    return !!this._drag;
  }

  /** Continue the drag so the grabbed surface point stays under the cursor. */
  dragTo(xPx, yPx) {
    if (!this._drag) return false;
    const next = this.unprojectScreen(xPx, yPx);
    if (!next) return false;
    const arc = shortestArcQuat(this._drag.point, next);
    this.objectQ = qNorm(qMul(arc, this._drag.q0));
    return true;
  }

  endDrag() {
    this._drag = null;
  }

  reset() {
    this.distance = CAMERA_DISTANCE;
    this.carrier = carrierFrame({ x: 0, y: 0, z: 1 }, { x: 0, y: 1, z: 0 });
    this.objectQ = { x: 0, y: 0, z: 0, w: 1 };
    this._drag = null;
    return this;
  }
}
