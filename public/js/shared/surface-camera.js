/**
 * NARIMATO — surface camera (RND-01).
 *
 * Implements the `CameraView` contract from `camera-contract.js` on the proven
 * v3.57 carrier primitives, so `IcosaRenderer` draws the surface through the
 * same projection interface it uses for orbit:
 *
 *   z      = dot(point, viewAxis())   // front-hemisphere coordinate
 *   depth  = dot(point − cam, forward) // forward depth; may be negative
 *   visible = depth > nearPlane
 *
 * Two framing modes share one class and one contract:
 *
 * - `legacy`  (default, production until RND-06 pixel parity): the shipped
 *   third-person frame — eye slightly above and behind the pilot, fixed focal
 *   `height × 1.36`. Output pixels are unchanged from v3.57.
 * - `carrier` (opt-in, `?surface-camera=carrier`): the carrier model from
 *   `narimato-physics.md` — camera on a concentric sphere above the anchor,
 *   fixed focal length, bounded tilt, dolly radius 1.08 … 1.72.
 *
 * `setPose()` rebuilds the frame once per pose change; `project()` is pure and
 * never mutates camera state.
 */

import {
  CAMERA_NEAR_PLANE,
  SURFACE_TILT_DEFAULT,
  dollyDistance,
  focalPxFor,
  tiltRad,
  zoomToDistance,
} from './camera-contract.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const norm = (v) => {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
};
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

const LEGACY_FOCAL_FRACTION = 1.36;
const LEGACY_CENTER_Y = 0.56;
const LEGACY_NEAR_PLANE = 0.006;

export class SurfaceCamera {
  /**
   * @param {number} width CSS pixels
   * @param {number} height CSS pixels
   * @param {{mode?:'legacy'|'carrier', tilt?:number, eyeHeight?:number, behind?:number, focal?:number}} [options]
   */
  constructor(width = 1, height = 1, options = {}) {
    this.width = Math.max(1, Number(width) || 1);
    this.height = Math.max(1, Number(height) || 1);
    this.zoom = 1;
    this.mode = options && options.mode === 'carrier' ? 'carrier' : 'legacy';
    this.nearPlane = this.mode === 'carrier' ? CAMERA_NEAR_PLANE : LEGACY_NEAR_PLANE;
    this.tilt = tiltRad(options && options.tilt != null ? options.tilt : SURFACE_TILT_DEFAULT);
    // Legacy frame constants (v3.57 pixels).
    this.eyeHeight = Number(options && options.eyeHeight) || 0.024;
    this.behind = Number(options && options.behind) || 0.15;
    this.focal = Number(options && options.focal) || LEGACY_FOCAL_FRACTION;
    this._centerY = this.height * LEGACY_CENTER_Y;
    this.distance = this._distanceForMode();
    this.focalPx = this._focalForMode();
    this._pos = { x: 0, y: 0, z: 1 };
    this._forward = { x: 1, y: 0, z: 0 };
    this._frame = null;
    this.yaw = 0;
    this.pitch = 0;
    this.origin = this._pos;
    this._computeFrame();
  }

  _focalForMode() {
    return this.mode === 'carrier' ? focalPxFor(this.width, this.height) : this.height * this.focal;
  }

  _distanceForMode() {
    return this.mode === 'carrier' ? zoomToDistance(this.zoom) : 1 + this.eyeHeight;
  }

  /** Resize the projection viewport; keeps the pose and re-derives the focal. */
  setViewport(width, height) {
    this.width = Math.max(1, Number(width) || 1);
    this.height = Math.max(1, Number(height) || 1);
    this._centerY = this.height * LEGACY_CENTER_Y;
    this.focalPx = this._focalForMode();
    return this;
  }

  /** Dolly. Carrier mode maps zoom onto the 1.08 … 1.72 radius curve. */
  setZoom(zoom) {
    const next = Number(zoom);
    if (Number.isFinite(next) && next > 0) this.zoom = next;
    this.distance = this._distanceForMode();
    this._computeFrame();
    return this;
  }

  /** Carrier tilt in radians (clamped to the proven 0.95 … 1.30 range). */
  setTilt(radians) {
    this.tilt = tiltRad(radians);
    this._computeFrame();
    return this;
  }

  /** Set the pilot pose. `pos` is the unit surface anchor, `forward` a tangent. */
  setPose(pos, forward) {
    if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) {
      return this;
    }
    const anchor = norm(pos);
    if (!Number.isFinite(anchor.x) || Math.hypot(anchor.x, anchor.y, anchor.z) < 1e-9) return this;
    let tangent = null;
    if (forward && Number.isFinite(forward.x) && Number.isFinite(forward.y) && Number.isFinite(forward.z)) {
      tangent = norm(sub(forward, mul(anchor, dot(forward, anchor))));
    }
    if (!tangent || Math.hypot(tangent.x, tangent.y, tangent.z) < 1e-9) {
      // Heading parallel to the anchor (degenerate): keep the previous frame.
      return this;
    }
    this._pos = anchor;
    this._forward = tangent;
    this.origin = anchor;
    this._computeFrame();
    return this;
  }

  _computeFrame() {
    const pos = this._pos;
    const fwd = this._forward;
    if (this.mode === 'carrier') {
      const tilt = this.tilt;
      const right = norm(cross(fwd, pos));
      const forward = norm(add(mul(pos, -Math.cos(tilt)), mul(fwd, Math.sin(tilt))));
      const cam = mul(pos, this.distance);
      const up = norm(cross(right, forward));
      this._frame = { cam, f: forward, r: right, u: up, axis: pos };
      this.focalPx = this._focalForMode();
    } else {
      const up = pos;
      const cam = add(mul(up, 1 + this.eyeHeight), mul(fwd, -this.behind));
      const target = add(add(up, mul(fwd, 0.58)), mul(up, -0.18));
      const f = norm(sub(target, cam));
      const r = norm(cross(f, up));
      const u = norm(cross(r, f));
      this._frame = { cam, f, r, u, axis: norm(cam) };
      this.distance = Math.hypot(cam.x, cam.y, cam.z);
      this.focalPx = this._focalForMode();
    }
    // Stable orientation pair for starfield/legacy consumers.
    const axis = this._frame.axis;
    this.yaw = Math.atan2(-axis.x, axis.z);
    this.pitch = Math.asin(clamp(axis.y, -1, 1));
  }

  /** World direction planet-centre → camera (unit, culling axis). */
  viewAxis() {
    if (!this._frame) this._computeFrame();
    return this._frame.axis;
  }

  /** Project a unit-sphere point to CSS pixels. Pure: never mutates state. */
  project(v) {
    if (!this._frame) this._computeFrame();
    const frame = this._frame;
    const rel = sub(v, frame.cam);
    const depth = dot(rel, frame.f);
    const z = dot(v, frame.axis);
    if (!(depth > this.nearPlane)) {
      return { x: 0, y: 0, z, depth, visible: false };
    }
    const focal = this.focalPx;
    return {
      x: this.width / 2 + (dot(rel, frame.r) / depth) * focal,
      y: this._centerY - (dot(rel, frame.u) / depth) * focal,
      z,
      depth,
      visible: true,
    };
  }

  /** View-space vector → world vector (orthonormal inverse of the projection). */
  unprojectView(v) {
    if (!this._frame) this._computeFrame();
    const frame = this._frame;
    return add(add(mul(frame.r, v.x), mul(frame.u, v.y)), mul(frame.f, v.z));
  }

  /**
   * Screen pixel → nearest visible unit-sphere point.
   * Casts the pixel ray from the carrier origin and returns the near root.
   * @returns {{point:{x:number,y:number,z:number}}|null}
   */
  unprojectScreen(xPx, yPx) {
    if (!this._frame) this._computeFrame();
    const x = Number(xPx);
    const y = Number(yPx);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const frame = this._frame;
    const X = x - this.width / 2;
    const Y = this._centerY - y;
    const dir = norm(add(add(mul(frame.r, X), mul(frame.u, Y)), mul(frame.f, this.focalPx)));
    const origin = frame.cam;
    const b = 2 * dot(origin, dir);
    const c = dot(origin, origin) - 1;
    const disc = b * b - 4 * c;
    if (!(disc >= 0)) return null;
    const t = (-b - Math.sqrt(disc)) / 2;
    if (!(t > 0)) return null;
    return { point: norm(add(origin, mul(dir, t))) };
  }

  /** Screen anchor for the pilot point (HUD/overlay consumers). */
  playerScreen() {
    return this.project(this._pos);
  }
}

/** Convenience factory: builds the production surface camera from a flag mode. */
export function createSurfaceCamera(width, height, mode = 'legacy', options = {}) {
  return new SurfaceCamera(width, height, { ...options, mode: mode === 'carrier' ? 'carrier' : 'legacy' });
}

export { dollyDistance };

export default SurfaceCamera;
