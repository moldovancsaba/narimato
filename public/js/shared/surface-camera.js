/**
 * NARIMATO — surface camera.
 *
 * A camera that consumes the SAME unit-sphere cell geometry as the orbital
 * SphereCamera. It exists so IcosaRenderer can draw the actual planet from a
 * close third-person position; it does not own terrain, cells or HUD.
 */

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

export class SurfaceCamera {
  constructor(width = 1, height = 1, options = {}) {
    this.width = Math.max(1, Number(width) || 1);
    this.height = Math.max(1, Number(height) || 1);
    this.zoom = 1;
    this.distance = 1;
    this.surfaceMode = true;
    this.eyeHeight = Number(options.eyeHeight) || 0.024;
    this.behind = Number(options.behind) || 0.15;
    this.focal = Number(options.focal) || 1.36;
    this._pos = { x: 0, y: 0, z: 1 };
    this._forward = { x: 1, y: 0, z: 0 };
    this._view = null;
    this.yaw = 0;
    this.pitch = 0;
  }

  setViewport(width, height) {
    this.width = Math.max(1, Number(width) || 1);
    this.height = Math.max(1, Number(height) || 1);
    return this;
  }

  /** Set player position/tangent from the surface controller. */
  setPose(pos, forward) {
    this._pos = norm(pos);
    this.origin = this._pos;
    const f = norm(forward);
    const tangent = norm(sub(f, mul(this._pos, dot(f, this._pos))));
    this._forward = tangent.x || tangent.y || tangent.z ? tangent : { x: 1, y: 0, z: 0 };
    this._computeView();
    return this;
  }

  _computeView() {
    const up = this._pos;
    const fwd = this._forward;
    const cam = add(mul(up, 1 + this.eyeHeight), mul(fwd, -this.behind));
    const target = add(add(up, mul(fwd, 0.58)), mul(up, -0.18));
    const f = norm(sub(target, cam));
    const r = norm(cross(f, up));
    const u = norm(cross(r, f));
    this._view = { cam, f, r, u };
    // Starfield/legacy consumers only need a stable orientation pair.
    const axis = norm(cam);
    this.yaw = Math.atan2(-axis.x, axis.z);
    this.pitch = Math.asin(clamp(axis.y, -1, 1));
  }

  /** Draw the actual unit-sphere cell geometry from the surface. */
  project(v) {
    if (!this._view) this._computeView();
    const rel = sub(v, this._view.cam);
    const z = dot(rel, this._view.f);
    if (z <= 0.006) return { x: 0, y: 0, z, visible: false };
    const focal = this.height * this.focal;
    return {
      x: this.width / 2 + (dot(rel, this._view.r) / z) * focal,
      y: this.height * 0.56 - (dot(rel, this._view.u) / z) * focal,
      z,
      visible: true,
    };
  }

  /** World-space camera position direction for renderer culling fallbacks. */
  viewAxis() {
    if (!this._view) this._computeView();
    return norm(this._view.cam);
  }

  unprojectView(v) {
    if (!this._view) this._computeView();
    return add(add(mul(this._view.r, v.x), mul(this._view.u, v.y)), mul(this._view.f, v.z));
  }

  /** Screen anchor for the player point (overlay/avatar use). */
  playerScreen() {
    return this.project(this._pos);
  }
}

export default SurfaceCamera;
