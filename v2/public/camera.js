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
  { id: 3, name: 'LANDED', distance: 1.01, pitchDeg: 68.77 },
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
  const baseTangent = norm(cross(cross(baseLanding, { x: 0, y: 1, z: 0 }), baseLanding));
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
