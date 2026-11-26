/**
 * NARIMATO v2 — approved camera rig.
 *
 * One camera attached to the gamer rig. Four phases only change the rig
 * distance; the camera pitches vertically so the real horizon stays on the
 * same 10% screen row. No zoom, no second camera, no masks/cuts.
 */
export const PHASES = Object.freeze([
  { id: 0, name: 'ORBIT', distance: 4.40, pitchDeg: 0.00 },
  { id: 1, name: 'CLOSER', distance: 1.50, pitchDeg: 28.68 },
  { id: 2, name: 'ALMOST LANDED', distance: 1.20, pitchDeg: 43.31 },
  { id: 3, name: 'LANDED', distance: 1.02, pitchDeg: 65.39 },
]);
export const FOV_DEG = 50;
export const HORIZON_FRACTION = 0.25;
export const LANDING_ARM = 0.014; // fraction of planet radius behind the gamer

const norm = (v) => {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
};
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });

/** Landing point + tangent forward (fixed for v2 phase tests). */
export const LANDING = norm({ x: 0, y: 0.25, z: 0.968 });
const TANGENT = norm(cross(cross(LANDING, { x: 0, y: 1, z: 0 }), LANDING));

/** Required horizon row (px) for a viewport. */
export function horizonRow(height) {
  return height * HORIZON_FRACTION;
}

/**
 * Build one camera for a phase. `width`/`height` are CSS pixels.
 * The camera position is the rig distance along the landing radial; the view
 * direction is pitched toward the tangent so the limb lands on the fixed row.
 */
export function phaseCamera(phaseIndex, width, height, options = {}) {
  const phase = PHASES[Math.max(0, Math.min(PHASES.length - 1, phaseIndex | 0))];
  const W = Math.max(1, Number(width) || 1);
  const H = Math.max(1, Number(height) || 1);
  const yaw = ((Number(options.yawDeg) || 0) * Math.PI) / 180;
  const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
  const rotateY = (v) => ({ x: v.x * cosY + v.z * sinY, y: v.y, z: -v.x * sinY + v.z * cosY });
  const baseLanding = options.landing && Number.isFinite(options.landing.x) ? norm(options.landing) : LANDING;
  let baseTangent = null;
  if (options.forward && Number.isFinite(options.forward.x)) {
    const f = options.forward;
    const proj = { x: f.x - baseLanding.x * dot(f, baseLanding), y: f.y - baseLanding.y * dot(f, baseLanding), z: f.z - baseLanding.z * dot(f, baseLanding) };
    const l = Math.hypot(proj.x, proj.y, proj.z);
    if (l > 1e-6) baseTangent = { x: proj.x / l, y: proj.y / l, z: proj.z / l };
  }
  if (!baseTangent) {
    // Pole-free fallback: use the world axis least aligned with the landing normal.
    const ax = Math.abs(baseLanding.x), ay = Math.abs(baseLanding.y), az = Math.abs(baseLanding.z);
    const up = ax <= ay && ax <= az ? { x: 1, y: 0, z: 0 } : ay <= az ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 };
    baseTangent = norm(cross(cross(baseLanding, up), baseLanding));
  }
  const axis = rotateY(baseLanding);
  const tangent = rotateY(baseTangent);
  const distance = Number.isFinite(options.distance) ? Math.max(1.005, Number(options.distance)) : phase.distance;
  const pitchDeg = Number.isFinite(options.pitchDeg) ? Number(options.pitchDeg) : phase.pitchDeg;
  const theta = (pitchDeg * Math.PI) / 180;
  const arm = Number.isFinite(options.arm) ? Number(options.arm) : 0;
  const P = add(mul(axis, distance), mul(tangent, -arm));
  const horizonDistance = Math.hypot(P.x, P.y, P.z);
  const D = norm(add(mul(axis, -Math.cos(theta)), mul(tangent, Math.sin(theta))));
  const U = phase.id === 0
    ? tangent
    : norm(add(axis, mul(D, -dot(axis, D))));
  const R = norm(cross(D, U));
  const focal = (H / 2) / Math.tan((FOV_DEG * Math.PI) / 360);
  const project = (v) => {
    const rel = add(v, mul(P, -1));
    const depth = dot(rel, D);
    if (!(depth > 1e-9)) return { x: 0, y: 0, z: 0, depth, visible: false };
    return {
      x: W / 2 + (focal * dot(rel, R)) / depth,
      y: H / 2 - (focal * dot(rel, U)) / depth,
      z: dot(v, LANDING),
      depth,
      visible: true,
    };
  };
  return {
    phase,
    width: W,
    height: H,
    distance,
    pitchDeg,
    arm,
    horizonDistance,
    focal,
    origin: P,
    landing: LANDING,
    forward: TANGENT,
    basis: { forward: D, up: U, right: R, position: P },
    axis,
    tangent,
    project,
    get screenRadius() {
      return focal / Math.sqrt(Math.max(1e-6, distance * distance - 1));
    },
  };
}

/** Screen angle (above optical axis) of the geometric limb for a phase. */
export function horizonAngle(phase) {
  const alpha = Math.asin(Math.min(1, 1 / phase.distance));
  return alpha - (phase.pitchDeg * Math.PI) / 180;
}
