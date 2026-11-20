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
