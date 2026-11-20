/**
 * Pure sphere-interaction math shared by tests and the viewer.
 * No DOM, no renderer state.
 */
import { SPHERE_SCREEN_FRACTION } from './geometry.js';

const norm = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });

/** Screen point -> visible unit-sphere surface point, or null. */
export function unprojectSphere(camera, xPx, yPx, width, height, focalPx = null) {
  if (!camera || typeof camera.project !== 'function') return null;
  const focal = Number.isFinite(focalPx) ? focalPx : Math.min(width, height) * SPHERE_SCREEN_FRACTION * camera.distance;
  const X = xPx - width / 2;
  const Y = height / 2 - yPx;
  const dirCam = norm({ x: X, y: Y, z: -focal }); // negative Z: into the scene
  const dirWorld = camera.unprojectView(dirCam);
  const origin = mul(norm(camera.viewAxis()), camera.distance);
  const b = 2 * dot(origin, dirWorld);
  const c = dot(origin, origin) - 1;
  const disc = b * b - 4 * c;
  if (!(disc >= 0)) return null;
  const t = (-b - Math.sqrt(disc)) / 2;
  if (!(t > 0)) return null;
  return norm(add(origin, mul(dirWorld, t)));
}

/** Shortest quaternion taking unit point p0 to unit point p1. */
export function shortestArcQuat(p0, p1) {
  const axis = cross(p0, p1);
  const len = Math.hypot(axis.x, axis.y, axis.z);
  const angle = Math.acos(Math.max(-1, Math.min(1, dot(p0, p1))));
  if (!(angle > 1e-9) || !(len > 1e-12)) return { x: 0, y: 0, z: 0, w: 1 };
  const s = Math.sin(angle / 2);
  return { x: (axis.x / len) * s, y: (axis.y / len) * s, z: (axis.z / len) * s, w: Math.cos(angle / 2) };
}

export const dotVec = dot;
export const normVec = norm;

/** Orthonormal camera frame on the carrier sphere. */
export function carrierFrame(pos, up) {
  const p = norm(pos);
  let u = norm(up);
  u = norm(sub(u, mul(p, dot(u, p))));
  if (Math.hypot(u.x, u.y, u.z) < 1e-9) {
    const seed = Math.abs(p.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 };
    u = norm(sub(seed, mul(p, dot(seed, p))));
  }
  const right = norm(cross(u, p));
  return { pos: p, up: u, right };
}

/** Fixed-focal projection from a carrier point; the camera always faces centre. */
export function carrierProject(carrierDistance, focalPx, frame, point) {
  const depth = carrierDistance - dot(point, frame.pos);
  if (!(depth > 1e-9)) return { x: 0, y: 0, z: 0, visible: false };
  return {
    x: (focalPx * dot(point, frame.right)) / depth,
    y: -(focalPx * dot(point, frame.up)) / depth,
    z: dot(point, frame.pos),
    visible: dot(point, frame.pos) > 0,
    depth,
  };
}

/** Screen ray -> sphere point from the carrier frame. */
export function carrierUnproject(carrierDistance, focalPx, frame, xPx, yPx, width, height) {
  const X = xPx - width / 2;
  const Y = height / 2 - yPx;
  const dir = norm(add(add(mul(frame.right, X), mul(frame.up, Y)), mul(frame.pos, -focalPx)));
  const origin = mul(frame.pos, carrierDistance);
  const b = 2 * dot(origin, dir);
  const c = dot(origin, origin) - 1;
  const disc = b * b - 4 * c;
  if (!(disc >= 0)) return null;
  const t = (-b - Math.sqrt(disc)) / 2;
  if (!(t > 0)) return null;
  return norm(add(origin, mul(dir, t)));
}

/** Move carrier on its sphere. dx=right/left, dy=up/down; no Euler/pole lock. */
export function moveCarrier(frame, dx, dy, angle) {
  const p = frame.pos;
  const t = norm(add(mul(frame.right, dx), mul(frame.up, dy)));
  if (Math.hypot(t.x, t.y, t.z) < 1e-12) return frame;
  const a = angle;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const nextPos = norm(add(mul(p, cos), mul(t, sin)));
  // Parallel transport up around the great-circle normal.
  const axis = norm(cross(p, t));
  const q = {
    x: axis.x * Math.sin(-a / 2),
    y: axis.y * Math.sin(-a / 2),
    z: axis.z * Math.sin(-a / 2),
    w: Math.cos(a / 2),
  };
  const rotate = (v) => {
    const tx = 2 * (q.y * v.z - q.z * v.y);
    const ty = 2 * (q.z * v.x - q.x * v.z);
    const tz = 2 * (q.x * v.y - q.y * v.x);
    return { x: v.x + q.w * tx + (q.y * tz - q.z * ty), y: v.y + q.w * ty + (q.z * tx - q.x * tz), z: v.z + q.w * tz + (q.x * ty - q.y * tx) };
  };
  return carrierFrame(nextPos, rotate(frame.up));
}


function rotateAroundAxis(v, axis, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const cr = cross(axis, v);
  const d = dot(axis, v);
  return { x: v.x * c + cr.x * s + axis.x * d * (1 - c), y: v.y * c + cr.y * s + axis.y * d * (1 - c), z: v.z * c + cr.z * s + axis.z * d * (1 - c) };
}

/** Camera look frame: 0 = look at centre, 1 = tangent/horizon view. */
export function lookFrame(pos, up, t, downAngle = 0) {
  const p = norm(pos);
  let u = norm(up);
  u = norm(sub(u, mul(p, dot(u, p))));
  if (Math.hypot(u.x, u.y, u.z) < 1e-9) {
    const seed = Math.abs(p.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 };
    u = norm(sub(seed, mul(p, dot(seed, p))));
  }
  const tangent = norm(cross(u, p)); // horizontal horizon tangent
  const centre = mul(p, -1);          // straight down toward planet centre
  const horizon = norm(add(mul(centre, 1 - t), mul(tangent, t)));
  // As the camera nears the surface, pitch down toward the centre so the
  // horizon stays at the top and the ground fills the lower screen.
  const down = downAngle * t;
  const forward = norm(add(mul(horizon, Math.cos(down)), mul(centre, Math.sin(down))));
  const right = norm(cross(forward, u));
  const vup = norm(cross(right, forward));
  return { pos: p, up: vup, right, forward };
}

/** Generic fixed-focal projection for any look frame. */
export function frameProject(distance, focalPx, frame, point) {
  const cam = mul(frame.pos, distance);
  const rel = sub(point, cam);
  const depth = dot(rel, frame.forward);
  if (!(depth > 1e-9)) return { x: 0, y: 0, z: 0, visible: false, depth };
  return {
    x: (focalPx * dot(rel, frame.right)) / depth,
    y: -(focalPx * dot(rel, frame.up)) / depth,
    z: dot(point, frame.pos),
    visible: depth > 0,
    depth,
  };
}

/** Generic fixed-focal screen→sphere unprojection for any look frame. */
export function frameUnproject(distance, focalPx, frame, xPx, yPx, width, height) {
  const X = xPx - width / 2;
  const Y = height / 2 - yPx;
  const dir = norm(add(add(mul(frame.right, X), mul(frame.up, Y)), mul(frame.forward, focalPx)));
  const origin = mul(frame.pos, distance);
  const b = 2 * dot(origin, dir);
  const c = dot(origin, origin) - 1;
  const disc = b * b - 4 * c;
  if (!(disc >= 0)) return null;
  const t = (-b - Math.sqrt(disc)) / 2;
  if (!(t > 0)) return null;
  return norm(add(origin, mul(dir, t)));
}
