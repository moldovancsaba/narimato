/** NARIMATO v2 — pole-free quaternion movement frame. No Euler yaw/pitch, no world-up basis. */
export const norm = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const mul = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const qNorm = (q) => { const l = Math.hypot(q.x, q.y, q.z, q.w) || 1; return { x: q.x / l, y: q.y / l, z: q.z / l, w: q.w / l }; };
export const qMul = (a, b) => ({
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
});
export const qAxis = (axis, angle) => { const h = angle / 2; return { x: axis.x * Math.sin(h), y: axis.y * Math.sin(h), z: axis.z * Math.sin(h), w: Math.cos(h) }; };
export const qRotate = (q, v) => {
  const p = { x: v.x, y: v.y, z: v.z, w: 0 };
  const c = qNorm(q);
  const inv = { x: -c.x, y: -c.y, z: -c.z, w: c.w };
  const r = qMul(qMul(c, p), inv);
  return { x: r.x, y: r.y, z: r.z };
};

/** A stable initial tangent. Uses the least-aligned world axis, never the landing radial. */
export function initialHeading(landing) {
  const ax = Math.abs(landing.x), ay = Math.abs(landing.y), az = Math.abs(landing.z);
  const up = ax <= ay && ax <= az ? { x: 1, y: 0, z: 0 } : ay <= az ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 };
  return reorthogonalize(landing, cross(up, landing));
}

/** Project any vector into the local tangent plane; pick a fallback only if degenerate. */
export function reorthogonalize(landing, heading) {
  let h = add(heading, mul(landing, -dot(landing, heading)));
  let l = Math.hypot(h.x, h.y, h.z);
  if (l < 1e-7) {
    const ax = Math.abs(landing.x), ay = Math.abs(landing.y), az = Math.abs(landing.z);
    const up = ax <= ay && ax <= az ? { x: 1, y: 0, z: 0 } : ay <= az ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 };
    h = cross(up, landing);
    l = Math.hypot(h.x, h.y, h.z) || 1;
  }
  return { x: h.x / l, y: h.y / l, z: h.z / l };
}

/** Turn the heading around the local surface normal. */
export function turnHeading(landing, heading, angle) {
  return reorthogonalize(landing, qRotate(qAxis(landing, angle), heading));
}

/** Move forward (positive) or backward along the heading; parallel-transport the heading. */
export function moveHeading(landing, heading, angle) {
  const axis = cross(landing, heading);
  const q = qAxis(axis, angle);
  return {
    landing: norm(qRotate(q, landing)),
    heading: reorthogonalize(norm(qRotate(q, landing)), qRotate(q, heading)),
  };
}

/** Rotate the frame by a quaternion (pointer orbit). */
export function rotateFrame(landing, heading, q) {
  const nextLanding = norm(qRotate(q, landing));
  return { landing: nextLanding, heading: reorthogonalize(nextLanding, qRotate(q, heading)) };
}
