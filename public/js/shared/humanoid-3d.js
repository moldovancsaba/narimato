/**
 * NARIMATO — closed-triangle humanoid rig (RND-05).
 *
 * One rig for the local pilot, peers and robot operators. The figure is made
 * from closed triangular volumes (head/visor face group, torso, pelvis, upper
 * and lower arms, thighs and shins) connected at the neck, shoulders, elbows,
 * hips and knees. Nothing here is a sprite: every vertex lives in the tangent
 * frame of the figure's surface anchor and is projected through the shared
 * `CameraView` contract (`camera.project`).
 *
 * Public API (issue RND-05 §10):
 *   buildRig(scale = 0.018) → { parts, joints, bounds, levels }
 *   poseRig(rig, pose[, out]) → Float32Array   // posed local vertices, deterministic
 *   poseJoints(rig, pose) → { neck, shoulderL, ... } posed joint anchors
 *   drawRig(ctx, camera, rig, pose, opts) → draw stats (painter-sorted, culled)
 *   lodForDistance(angle, currentLod) → 'L0' | 'L1' | 'L2'
 *
 * Geometry budget: 11 closed boxes × 12 triangles = 132 at L0, six merged
 * volumes = 72 at L1, one silhouette quad = 2 at L2. Every L0/L1 volume is a
 * closed 2-manifold (V − E + F = 2) and its faces wind outward.
 *
 * Pose is deterministic from `(walkPhase, minePhase, moving, lean)`: same input
 * gives an identical vertex buffer; no wall clock, no randomness, no DOM.
 * The module is pure ESM and safe to import under `node --test`.
 */

const TAU = Math.PI * 2;
const HALF_PI = Math.PI / 2;

/** Triangle budget per level; asserted at build time and by tests. */
export const TRIANGLE_COUNTS = Object.freeze({ L0: 132, L1: 72, L2: 2 });

/** Angular LOD thresholds (radians from the camera culling axis). */
export const LOD_LIMITS = Object.freeze({ L0: 0.35, L1: 0.8, HYSTERESIS: 0.03 });

/** LOD level order, most detailed first. */
export const LOD_LEVELS = Object.freeze(['L0', 'L1', 'L2']);

/** Joint ids required by the RND-05 contract. */
export const HUMAN_JOINTS = Object.freeze([
  'neck',
  'shoulderL',
  'shoulderR',
  'elbowL',
  'elbowR',
  'hipL',
  'hipR',
  'kneeL',
  'kneeR',
]);

/** Maximum joint rotation (radians) so extreme poses stay inside the volume. */
export const MAX_JOINT_ANGLE = 1.4;

/**
 * Figure height in rig units (head top minus foot plane). A rig unit is scaled
 * by `buildRig(scale)`; the production renderer passes 0.010, so a figure is
 * 0.0095 sphere radii tall — 12–90 CSS px under the legacy surface camera.
 * `buildRig(scale = 0.018)` keeps the issue's documented default; callers that
 * need the screen budget pass the production scale explicitly.
 */
export const FIGURE_HEIGHT_UNITS = 0.95;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const clampAngle = (v) => clamp(Number.isFinite(v) ? v : 0, -MAX_JOINT_ANGLE, MAX_JOINT_ANGLE);
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
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });

/** Rotate a vector around the X axis (the rig's right axis). */
function rotateX(v, angle) {
  if (!angle) return { x: v.x, y: v.y, z: v.z };
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: v.x, y: v.y * cos - v.z * sin, z: v.y * sin + v.z * cos };
}

/** Rotate a point about `pivot` around the local X axis. */
function rotateAboutX(point, pivot, angle) {
  const rel = rotateX(sub(point, pivot), angle);
  return add(pivot, rel);
}

/** easeOut(m) = 1 − (1 − m)² (RND-05 §11). */
export function easeOut(m) {
  const k = clamp(Number.isFinite(m) ? m : 0, 0, 1);
  return 1 - (1 - k) * (1 - k);
}

/**
 * Deterministic joint angles for a pose. `side` is −1 for left, +1 for right
 * (`-1` maps to the negative-X parts). Walk, knee bend and arm swing follow
 * RND-05 §11; the tool arm lift is the right shoulder.
 */
export function poseAngles(pose = {}) {
  const moving = pose.moving !== false;
  const w = moving ? Number(pose.walkPhase) || 0 : 0;
  const m = clamp(Number(pose.minePhase) || 0, 0, 1);
  const lean = clamp(Number(pose.lean) || 0, -MAX_JOINT_ANGLE, MAX_JOINT_ANGLE);
  const ease = easeOut(m);
  const hip = {};
  const knee = {};
  const shoulder = {};
  const elbow = {};
  for (const side of [-1, 1]) {
    const phase = w + side * HALF_PI;
    hip[side] = clampAngle(0.55 * Math.sin(phase));
    knee[side] = clampAngle(0.9 * Math.max(0, -Math.sin(phase + 0.6)));
    shoulder[side] = clampAngle(-0.45 * Math.sin(phase));
    elbow[side] = clampAngle(0.28 * Math.max(0, Math.sin(phase + 0.6)));
  }
  // Tool arm (right) lifts by −1.4·easeOut(m); a small counter-swing keeps the
  // silhouette readable while the beam fires.
  shoulder[1] = clampAngle(shoulder[1] - 1.4 * ease);
  elbow[1] = clampAngle(elbow[1] + 0.5 * ease);
  return { walkPhase: w, minePhase: m, moving, lean, hip, knee, shoulder, elbow, ease };
}

const BOX_FACES = Object.freeze([
  [0, 3, 2], [0, 2, 1], // back  (−z)
  [4, 5, 6], [4, 6, 7], // front (+z)
  [0, 4, 7], [0, 7, 3], // left  (−x)
  [1, 2, 6], [1, 6, 5], // right (+x)
  [0, 1, 5], [0, 5, 4], // bottom (−y)
  [3, 7, 6], [3, 6, 2], // top   (+y)
]);

/** Box vertices for a part centred at `center` with `half` extents. */
function boxVerts(center, half) {
  const [cx, cy, cz] = center;
  const [hx, hy, hz] = half;
  return [
    [cx - hx, cy - hy, cz - hz], [cx + hx, cy - hy, cz - hz],
    [cx + hx, cy + hy, cz - hz], [cx - hx, cy + hy, cz - hz],
    [cx - hx, cy - hy, cz + hz], [cx + hx, cy - hy, cz + hz],
    [cx + hx, cy + hy, cz + hz], [cx - hx, cy + hy, cz + hz],
  ];
}

/** Joint anchor points on the body, in rig units (figure height 0.5). */
export const JOINT_ANCHORS = Object.freeze({
  neck: { x: 0, y: 0.72, z: 0 },
  shoulderL: { x: -0.16, y: 0.66, z: 0 },
  shoulderR: { x: 0.16, y: 0.66, z: 0 },
  elbowL: { x: -0.205, y: 0.47, z: 0 },
  elbowR: { x: 0.205, y: 0.47, z: 0 },
  hipL: { x: -0.085, y: 0.39, z: 0 },
  hipR: { x: 0.085, y: 0.39, z: 0 },
  kneeL: { x: -0.085, y: 0.24, z: 0 },
  kneeR: { x: 0.085, y: 0.24, z: 0 },
  /** Pivot of the whole upper body / lean rotation (pelvis centre). */
  hipCenter: { x: 0, y: 0.4, z: 0 },
});

/**
 * L0 part volumes. `chain` lists the joint rotations applied to the part, in
 * order; `pivot` is the joint id that anchors the part. Materials select the
 * shaded palette (`head`, `visor`, `torso`, `hips`, `arm`, `leg`).
 */
const L0_PARTS = Object.freeze([
  {
    id: 'head', group: 'head', center: [0, 0.85, 0], half: [0.09, 0.13, 0.09],
    chain: [], pivot: 'neck', visorFaces: [2, 3],
  },
  {
    id: 'torso', group: 'torso', center: [0, 0.595, 0], half: [0.16, 0.125, 0.09],
    chain: [], pivot: 'neck', upperBody: true,
  },
  {
    id: 'pelvis', group: 'pelvis', center: [0, 0.445, 0], half: [0.145, 0.055, 0.085],
    chain: [], pivot: 'hipCenter', upperBody: true,
  },
  {
    id: 'upperArmL', group: 'arm', center: [-0.205, 0.585, 0], half: [0.045, 0.115, 0.05],
    chain: ['shoulderL'], pivot: 'shoulderL', upperBody: true,
  },
  {
    id: 'upperArmR', group: 'arm', center: [0.205, 0.585, 0], half: [0.045, 0.115, 0.05],
    chain: ['shoulderR'], pivot: 'shoulderR', upperBody: true,
  },
  {
    id: 'lowerArmL', group: 'arm', center: [-0.205, 0.36, 0], half: [0.04, 0.11, 0.045],
    chain: ['shoulderL', 'elbowL'], pivot: 'elbowL', upperBody: true,
  },
  {
    id: 'lowerArmR', group: 'arm', center: [0.205, 0.36, 0], half: [0.04, 0.11, 0.045],
    chain: ['shoulderR', 'elbowR'], pivot: 'elbowR', upperBody: true,
  },
  {
    id: 'thighL', group: 'leg', center: [-0.085, 0.315, 0], half: [0.055, 0.075, 0.06],
    chain: ['hipL'], pivot: 'hipL',
  },
  {
    id: 'thighR', group: 'leg', center: [0.085, 0.315, 0], half: [0.055, 0.075, 0.06],
    chain: ['hipR'], pivot: 'hipR',
  },
  {
    id: 'shinL', group: 'leg', center: [-0.085, 0.135, 0], half: [0.05, 0.105, 0.055],
    chain: ['hipL', 'kneeL'], pivot: 'kneeL',
  },
  {
    id: 'shinR', group: 'leg', center: [0.085, 0.135, 0], half: [0.05, 0.105, 0.055],
    chain: ['hipR', 'kneeR'], pivot: 'kneeR',
  },
]);

/**
 * L1 part volumes: the same silhouette with the limb joints merged, so a
 * distant figure keeps its body but loses elbow/knee detail. Six closed boxes
 * × 12 triangles = 72.
 */
const L1_PARTS = Object.freeze([
  {
    id: 'head', group: 'head', center: [0, 0.85, 0], half: [0.09, 0.13, 0.09],
    chain: [], pivot: 'neck', visorFaces: [2, 3],
  },
  {
    id: 'body', group: 'torso', center: [0, 0.555, 0], half: [0.16, 0.165, 0.09],
    chain: [], pivot: 'hipCenter',
  },
  {
    id: 'armL', group: 'arm', center: [-0.21, 0.45, 0], half: [0.05, 0.25, 0.05],
    chain: ['shoulderL'], pivot: 'shoulderL', upperBody: true,
  },
  {
    id: 'armR', group: 'arm', center: [0.21, 0.45, 0], half: [0.05, 0.25, 0.05],
    chain: ['shoulderR'], pivot: 'shoulderR', upperBody: true,
  },
  {
    id: 'legL', group: 'leg', center: [-0.085, 0.21, 0], half: [0.055, 0.18, 0.06],
    chain: ['hipL'], pivot: 'hipL',
  },
  {
    id: 'legR', group: 'leg', center: [0.085, 0.21, 0], half: [0.055, 0.18, 0.06],
    chain: ['hipR'], pivot: 'hipR',
  },
]);

/** Material id per box face for a part. */
function partMaterials(part) {
  const count = BOX_FACES.length;
  const materials = new Array(count).fill(part.group);
  if (part.visorFaces) {
    for (const index of part.visorFaces) materials[index] = 'visor';
  }
  // Face-level two-tone on the limbs keeps the low-poly volumes readable from
  // the back and the side without textures.
  if (part.group === 'arm') {
    for (let i = 0; i < count; i += 1) materials[i] = i % 4 < 2 ? 'armSide' : 'arm';
  }
  if (part.group === 'leg') {
    for (let i = 0; i < count; i += 1) materials[i] = i % 4 < 2 ? 'legSide' : 'leg';
  }
  return materials;
}

function buildPart(def, scale, offset, level) {
  const verts = boxVerts(def.center, def.half).map(([x, y, z]) => ({ x: x * scale, y: y * scale, z: z * scale }));
  const base = new Float32Array(verts.length * 3);
  for (let i = 0; i < verts.length; i += 1) {
    base[i * 3] = verts[i].x;
    base[i * 3 + 1] = verts[i].y;
    base[i * 3 + 2] = verts[i].z;
  }
  const faces = BOX_FACES.map(([a, b, c]) => ({ v: [a, b, c] }));
  const materials = partMaterials(def);
  const pivot = JOINT_ANCHORS[def.pivot] || JOINT_ANCHORS.hipCenter;
  return {
    id: def.id,
    level,
    group: def.group,
    offset,
    count: verts.length,
    base,
    faces,
    materials,
    chain: def.chain || [],
    pivot: { x: pivot.x * scale, y: pivot.y * scale, z: pivot.z * scale },
    upperBody: !!def.upperBody,
    visorFaces: def.visorFaces || null,
  };
}

function buildLevel(parts, level, scale) {
  let offset = 0;
  const built = parts.map((def) => {
    const part = buildPart(def, scale, offset, level);
    offset += part.count;
    return part;
  });
  const joints = {};
  for (const id of HUMAN_JOINTS) {
    const anchor = JOINT_ANCHORS[id];
    joints[id] = { id, at: { x: anchor.x * scale, y: anchor.y * scale, z: anchor.z * scale } };
  }
  joints.hipCenter = { id: 'hipCenter', at: { x: 0, y: JOINT_ANCHORS.hipCenter.y * scale, z: 0 } };
  const bounds = levelBounds(built);
  return {
    level,
    parts: built,
    joints,
    bounds,
    vertexCount: offset,
    triangles: built.reduce((sum, part) => sum + part.faces.length, 0),
    maxJointError: 0,
  };
}

function levelBounds(parts) {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const part of parts) {
    const base = part.base;
    for (let i = 0; i < base.length; i += 3) {
      const x = base[i];
      const y = base[i + 1];
      const z = base[i + 2];
      if (x < min.x) min.x = x;
      if (y < min.y) min.y = y;
      if (z < min.z) min.z = z;
      if (x > max.x) max.x = x;
      if (y > max.y) max.y = y;
      if (z > max.z) max.z = z;
    }
  }
  return { min, max, height: max.y - min.y };
}

/** L2 silhouette: four vertices, two triangles, no closed volumes. */
function buildSilhouette(scale) {
  const halfWidth = 0.16 * scale;
  const foot = 0.03 * scale;
  const height = foot + FIGURE_HEIGHT_UNITS * scale;
  const base = new Float32Array([
    -halfWidth, foot, 0,
    halfWidth, foot, 0,
    halfWidth, height, 0,
    -halfWidth, height, 0,
  ]);
  return {
    level: 'L2',
    parts: [{
      id: 'silhouette',
      level: 'L2',
      group: 'torso',
      offset: 0,
      count: 4,
      base,
      faces: [{ v: [0, 1, 2] }, { v: [1, 3, 2] }],
      materials: ['torso', 'torso'],
      chain: [],
      pivot: { x: 0, y: JOINT_ANCHORS.hipCenter.y * scale, z: 0 },
      upperBody: true,
      visorFaces: null,
      silhouette: true,
    }],
    joints: buildLevel([], 'L2', scale).joints,
    bounds: { min: { x: -halfWidth, y: foot, z: 0 }, max: { x: halfWidth, y: height, z: 0 }, height: height - foot },
    vertexCount: 4,
    triangles: 2,
  };
}

/**
 * Build the humanoid rig once. The returned object is immutable by convention
 * and shared by every figure; `poseRig` writes into a caller-provided buffer
 * (or a per-rig scratch buffer) so the frame loop allocates nothing.
 * @param {number} [scale] world size of one rig unit (sphere radii)
 */
export function buildRig(scale = 0.018) {
  const size = Number.isFinite(scale) && scale > 0 ? scale : 0.018;
  const levels = {
    L0: buildLevel(L0_PARTS, 'L0', size),
    L1: buildLevel(L1_PARTS, 'L1', size),
    L2: buildSilhouette(size),
  };
  for (const level of LOD_LEVELS) {
    const expected = TRIANGLE_COUNTS[level];
    if (levels[level].triangles !== expected) {
      throw new Error(`humanoid rig ${level}: expected ${expected} triangles, built ${levels[level].triangles}`);
    }
  }
  const rig = {
    scale: size,
    /** Default level exposed for convenience/tests. */
    level: 'L0',
    parts: levels.L0.parts,
    joints: levels.L0.joints,
    bounds: levels.L0.bounds,
    vertexCount: levels.L0.vertexCount,
    triangles: levels.L0.triangles,
    levels,
    _buffers: {},
  };
  return rig;
}

function bufferFor(rig, level, out) {
  const target = rig.levels[level];
  if (out && out.length === target.vertexCount * 3) return out;
  if (!rig._buffers[level] || rig._buffers[level].length !== target.vertexCount * 3) {
    rig._buffers[level] = new Float32Array(target.vertexCount * 3);
  }
  return rig._buffers[level];
}

/** Posed pivot of a chain joint: previous joints in the chain move it. */
function chainPivot(jointId, chain, anchors, angles) {
  const index = chain.indexOf(jointId);
  let pivot = { ...anchors[jointId] };
  for (const previous of chain.slice(0, Math.max(0, index))) {
    pivot = rotateAboutX(pivot, anchors[previous], angleFor(previous, angles));
  }
  return pivot;
}

/** Apply a part chain (parent joints first) to one point. */
function applyChain(point, chain, anchors, angles) {
  let result = { ...point };
  for (const jointId of chain) {
    result = rotateAboutX(result, chainPivot(jointId, chain, anchors, angles), angleFor(jointId, angles));
  }
  return result;
}

function angleFor(jointId, angles) {
  const side = jointId.endsWith('L') ? -1 : 1;
  if (jointId.startsWith('shoulder')) return angles.shoulder[side];
  if (jointId.startsWith('elbow')) return angles.elbow[side];
  if (jointId.startsWith('hip')) return angles.hip[side];
  if (jointId.startsWith('knee')) return angles.knee[side];
  return 0;
}

/** Apply the whole-body lean about the pelvis pivot. */
function leanPoint(point, angles, hipCenter) {
  if (!angles.lean) return point;
  return rotateAboutX(point, hipCenter, angles.lean);
}

/**
 * Pose the rig: deterministic local vertex buffer for one level.
 * @param {object} rig
 * @param {{walkPhase?:number,minePhase?:number,moving?:boolean,lean?:number}} [pose]
 * @param {Float32Array} [out] optional reusable buffer
 * @param {'L0'|'L1'|'L2'} [level]
 */
export function poseRig(rig, pose = {}, out = null, level = rig.level || 'L0') {
  if (!rig || !rig.levels || !rig.levels[level]) {
    throw new TypeError('poseRig: invalid rig or level');
  }
  const target = rig.levels[level];
  const buffer = bufferFor(rig, level, out);
  const angles = poseAngles(pose);
  const anchors = jointAnchors(target);
  const hipCenter = anchors.hipCenter;
  let cursor = 0;
  for (const part of target.parts) {
    const base = part.base;
    for (let i = 0; i < part.count; i += 1) {
      let point = { x: base[i * 3], y: base[i * 3 + 1], z: base[i * 3 + 2] };
      point = applyChain(point, part.chain, anchors, angles);
      // Lean is one whole-body rotation about the pelvis, so every joint stays
      // coincident while the walk leans into the step.
      point = leanPoint(point, angles, hipCenter);
      buffer[cursor] = point.x;
      buffer[cursor + 1] = point.y;
      buffer[cursor + 2] = point.z;
      cursor += 3;
    }
  }
  return buffer;
}

/** Flat joint anchor map ({id: {x,y,z}}) for a level. */
function jointAnchors(level) {
  const anchors = {};
  for (const [id, joint] of Object.entries(level.joints)) anchors[id] = joint.at;
  return anchors;
}

/**
 * Posed joint anchors for a pose. Used by tests to prove joint coincidence and
 * by `drawRig` for the beam tool point.
 * @returns {Record<string,{x:number,y:number,z:number}>}
 */
export function poseJoints(rig, pose = {}) {
  const level = rig.levels.L0;
  const angles = poseAngles(pose);
  const anchors = jointAnchors(level);
  const hipCenter = anchors.hipCenter;
  const out = {};
  const chains = {
    neck: [],
    shoulderL: ['shoulderL'],
    shoulderR: ['shoulderR'],
    elbowL: ['shoulderL', 'elbowL'],
    elbowR: ['shoulderR', 'elbowR'],
    hipL: ['hipL'],
    hipR: ['hipR'],
    kneeL: ['hipL', 'kneeL'],
    kneeR: ['hipR', 'kneeR'],
  };
  for (const id of HUMAN_JOINTS) {
    const chain = chains[id] || [];
    // The joint is fixed under its own rotation but moves under parent joints.
    out[id] = leanPoint(applyChain(anchors[id], chain, anchors, angles), angles, hipCenter);
  }
  return out;
}

/**
 * Joint coincidence error: every joint anchor resolved through the parent part
 * and through the child part must agree within tolerance for a pose.
 * @returns {{maxError:number, errors:Array<{joint:string,delta:number}>}}
 */
export function jointCoincidence(rig, pose = {}) {
  const level = rig.levels.L0;
  const angles = poseAngles(pose);
  const anchors = jointAnchors(level);
  const hipCenter = anchors.hipCenter;
  const errors = [];
  let maxError = 0;
  // joint -> [parent chain, child chain] (child chain includes the joint itself)
  const relations = {
    neck: [[], []],
    shoulderL: [[], ['shoulderL']],
    shoulderR: [[], ['shoulderR']],
    elbowL: [['shoulderL'], ['shoulderL', 'elbowL']],
    elbowR: [['shoulderR'], ['shoulderR', 'elbowR']],
    hipL: [[], ['hipL']],
    hipR: [[], ['hipR']],
    kneeL: [['hipL'], ['hipL', 'kneeL']],
    kneeR: [['hipR'], ['hipR', 'kneeR']],
  };
  for (const [id, [parentChain, childChain]] of Object.entries(relations)) {
    const viaParent = leanPoint(applyChain(anchors[id], parentChain, anchors, angles), angles, hipCenter);
    const viaChild = leanPoint(applyChain(anchors[id], childChain, anchors, angles), angles, hipCenter);
    const delta = Math.hypot(viaParent.x - viaChild.x, viaParent.y - viaChild.y, viaParent.z - viaChild.z);
    errors.push({ joint: id, delta });
    if (delta > maxError) maxError = delta;
  }
  return { maxError, errors };
}

/** FNV-1a 32-bit hash of a Float32Array (stable across processes). */
export function poseHash(buffer) {
  if (!(buffer instanceof Float32Array) || buffer.length === 0) return '00000000';
  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < bytes.length; i += 1) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Hysteretic LOD selection: detail drops when the figure leaves the cone and is
 * only restored 0.03 rad inside the boundary, so a figure hovering on the edge
 * cannot flicker between levels.
 * @param {number} angle angular distance from the camera culling axis (rad)
 * @param {'L0'|'L1'|'L2'|null} [currentLod]
 */
export function lodForDistance(angle, currentLod = null) {
  const d = Number.isFinite(angle) ? Math.max(0, angle) : 0;
  const { L0, L1, HYSTERESIS: h } = LOD_LIMITS;
  if (currentLod === 'L0') {
    if (d <= L0 + h) return 'L0';
    return d <= L1 + h ? 'L1' : 'L2';
  }
  if (currentLod === 'L1') {
    if (d <= L0 - h) return 'L0';
    return d <= L1 + h ? 'L1' : 'L2';
  }
  if (currentLod === 'L2') {
    if (d <= L0 - h) return 'L0';
    return d <= L1 - h ? 'L1' : 'L2';
  }
  return d <= L0 ? 'L0' : d <= L1 ? 'L1' : 'L2';
}

/** Angular distance of a figure anchor from a camera culling axis. */
export function angleFromAxis(anchor, camera) {
  if (!anchor || !camera) return 0;
  const axis = typeof camera.viewAxis === 'function' ? camera.viewAxis() : null;
  if (!axis) return 0;
  const denominator = Math.hypot(anchor.x, anchor.y, anchor.z) || 1;
  return Math.acos(clamp(dot(anchor, axis) / denominator, -1, 1));
}

/** Tangent frame at a unit-sphere anchor: `{ up, forward, right }`. */
export function tangentFrame(anchor, forward) {
  const up = norm(anchor);
  let f = forward && Number.isFinite(forward.x) ? { ...forward } : { x: 0, y: 0, z: 1 };
  f = sub(f, mul(up, dot(f, up)));
  if (Math.hypot(f.x, f.y, f.z) < 1e-9) {
    // Degenerate heading (anchor at a pole or parallel to it): deterministic
    // fallback frame, never NaN.
    const fallback = Math.abs(up.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    f = sub(fallback, mul(up, dot(fallback, up)));
  }
  f = norm(f);
  const right = norm(cross(up, f));
  return { up, forward: f, right };
}

/** World-space point for a rig-local vector inside a tangent frame. */
export function toWorld(local, frame, anchor) {
  return add(anchor, add(add(mul(frame.right, local.x), mul(frame.up, local.y)), mul(frame.forward, local.z)));
}

const FACE_LIGHTS = Object.freeze({
  // Local-frame light direction (above, camera-left, in front).
  x: -0.35,
  y: 0.78,
  z: 0.52,
});

function hexToRgb(hex) {
  const raw = String(hex || '').replace('#', '');
  if (raw.length !== 6 || !/^[0-9a-f]{6}$/i.test(raw)) return { r: 120, g: 200, b: 220 };
  return { r: parseInt(raw.slice(0, 2), 16), g: parseInt(raw.slice(2, 4), 16), b: parseInt(raw.slice(4, 6), 16) };
}

function mixRgb(a, b, t) {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

function scaleRgb(rgb, factor) {
  return {
    r: clamp(Math.round(rgb.r * factor), 0, 255),
    g: clamp(Math.round(rgb.g * factor), 0, 255),
    b: clamp(Math.round(rgb.b * factor), 0, 255),
  };
}

function rgbCss(rgb) {
  return `rgb(${rgb.r},${rgb.g},${rgb.b})`;
}

/**
 * Palette for one material. `opts.tint` is the pilot/robot colour, so one rig
 * serves local pilots (`#67ddff`), peers (player colour) and robots.
 */
export function materialColor(material, opts = {}) {
  const tint = hexToRgb(opts.tint || '#63dfff');
  const skin = hexToRgb(opts.skin || '#eefeff');
  switch (material) {
    case 'head':
      return skin;
    case 'visor':
      return { r: 150, g: 246, b: 255 };
    case 'torso':
      return tint;
    case 'pelvis':
      return scaleRgb(tint, 0.72);
    case 'arm':
      return mixRgb(tint, skin, 0.25);
    case 'armSide':
      return scaleRgb(mixRgb(tint, skin, 0.1), 0.78);
    case 'leg':
      return scaleRgb(mixRgb(tint, { r: 24, g: 60, b: 84 }, 0.65), 0.82);
    case 'legSide':
      return scaleRgb(mixRgb(tint, { r: 18, g: 46, b: 66 }, 0.7), 0.7);
    default:
      return tint;
  }
}

function faceNormal(base, face) {
  const a = { x: base[face[0] * 3], y: base[face[0] * 3 + 1], z: base[face[0] * 3 + 2] };
  const b = { x: base[face[1] * 3], y: base[face[1] * 3 + 1], z: base[face[1] * 3 + 2] };
  const c = { x: base[face[2] * 3], y: base[face[2] * 3 + 1], z: base[face[2] * 3 + 2] };
  return norm(cross(sub(b, a), sub(c, a)));
}

function scratchFor(rig) {
  if (!rig._scratch) {
    rig._scratch = {
      screens: [],
      worldVerts: [],
      world: { x: 0, y: 0, z: 0 },
      triangles: [],
      pool: [],
      colorCache: new Map(),
      camera: null,
    };
  }
  return rig._scratch;
}

function screenSlot(scratch, index) {
  let slot = scratch.screens[index];
  if (!slot) {
    slot = { x: 0, y: 0, depth: 0 };
    scratch.screens[index] = slot;
  }
  return slot;
}

function worldSlot(scratch, index) {
  let slot = scratch.worldVerts[index];
  if (!slot) {
    slot = { x: 0, y: 0, z: 0 };
    scratch.worldVerts[index] = slot;
  }
  return slot;
}

function triangleSlot(scratch, index) {
  let slot = scratch.pool[index];
  if (!slot) {
    slot = { a: null, b: null, c: null, depth: 0, material: 'torso', shade: 1, partId: '' };
    scratch.pool[index] = slot;
  }
  return slot;
}

/**
 * Project + cull + painter-sort the posed rig. Returns the screen triangles in
 * draw order so tests can assert culling/sorting without a canvas. Scratch
 * buffers and triangle objects are reused per rig, so a steady frame allocates
 * nothing beyond newly discovered palette strings.
 * @param {object} camera CameraView (project + viewAxis)
 * @param {object} rig
 * @param {Float32Array} posed posed local vertices from `poseRig`
 * @param {{level?:string, anchor:object, forward?:object, scale?:number}} opts
 */
export function projectRig(camera, rig, posed, opts = {}) {
  const levelName = opts.level || 'L0';
  const level = rig.levels[levelName];
  if (!camera || typeof camera.project !== 'function' || !level) {
    return { triangles: [], level: levelName, culled: 0, eye: null, frame: null, heightPx: 0 };
  }
  const scratch = scratchFor(rig);
  const scale = Number.isFinite(opts.scale) ? opts.scale : 1;
  const anchor = opts.anchor || { x: 0, y: 0, z: 1 };
  const frame = tangentFrame(anchor, opts.forward);
  const cameraAxis = typeof camera.viewAxis === 'function' ? camera.viewAxis() : null;
  // Front-hemisphere cull: a figure anchored behind the camera's surface
  // horizon (including the planet's far side) is never mirrored into view.
  if (cameraAxis && dot(norm(anchor), cameraAxis) <= 0) {
    return { triangles: [], level: levelName, culled: 1, eye: null, frame: null, heightPx: 0 };
  }
  const eye = opts.eye
    || (camera._frame && camera._frame.cam)
    || (cameraAxis
      ? mul(cameraAxis, Number.isFinite(camera.distance) && camera.distance > 1 ? camera.distance : 1.55)
      : { x: 0, y: 0, z: 3 });
  const triangles = scratch.triangles;
  triangles.length = 0;
  let poolCursor = 0;
  let culled = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  const world = scratch.world;
  const projectWorld = (localX, localY, localZ, out) => {
    world.x = anchor.x + frame.right.x * localX * scale + frame.up.x * localY * scale + frame.forward.x * localZ * scale;
    world.y = anchor.y + frame.right.y * localX * scale + frame.up.y * localY * scale + frame.forward.y * localY * 0 + frame.forward.y * localZ * scale;
    world.z = anchor.z + frame.right.z * localX * scale + frame.up.z * localY * scale + frame.forward.z * localZ * scale;
    const projected = camera.project(world);
    if (!projected || !projected.visible) return null;
    out.x = projected.x;
    out.y = projected.y;
    out.depth = Number.isFinite(projected.depth)
      ? projected.depth
      : (cameraAxis ? dot(world, cameraAxis) : world.z);
    return { x: out.x, y: out.y, depth: out.depth };
  };
  let cursor = 0;
  for (const part of level.parts) {
    for (let i = 0; i < part.count; i += 1) {
      const index = cursor + i;
      const localX = posed[index * 3];
      const localY = posed[index * 3 + 1];
      const localZ = posed[index * 3 + 2];
      const screen = screenSlot(scratch, index);
      const wslot = worldSlot(scratch, index);
      wslot.x = anchor.x + frame.right.x * localX * scale + frame.up.x * localY * scale + frame.forward.x * localZ * scale;
      wslot.y = anchor.y + frame.right.y * localX * scale + frame.up.y * localY * scale + frame.forward.y * localZ * scale;
      wslot.z = anchor.z + frame.right.z * localX * scale + frame.up.z * localY * scale + frame.forward.z * localZ * scale;
      const projected = camera.project(wslot);
      if (projected && projected.visible) {
        screen.x = projected.x;
        screen.y = projected.y;
        screen.depth = Number.isFinite(projected.depth)
          ? projected.depth
          : (cameraAxis ? dot(wslot, cameraAxis) : wslot.z);
        if (projected.y < minY) minY = projected.y;
        if (projected.y > maxY) maxY = projected.y;
        // Mark presence via depth: NaN depth is never produced by a valid camera.
        screen.visible = true;
      } else {
        screen.visible = false;
      }
    }
    cursor += part.count;
  }
  const heightPx = Number.isFinite(minY) && Number.isFinite(maxY) ? Math.max(0, maxY - minY) : 0;
  if (levelName === 'L2') {
    const a = scratch.screens[0];
    const b = scratch.screens[1];
    const c = scratch.screens[2];
    const d = scratch.screens[3];
    const behind = cameraAxis ? dot(norm(anchor), cameraAxis) <= 0 : false;
    if (!a || !b || !c || !d || !a.visible || !b.visible || !c.visible || !d.visible || behind) {
      return { triangles, level: levelName, culled: 1, eye, frame, heightPx: 0 };
    }
    const first = triangleSlot(scratch, poolCursor);
    poolCursor += 1;
    first.a = { x: a.x, y: a.y, depth: a.depth };
    first.b = { x: b.x, y: b.y, depth: b.depth };
    first.c = { x: c.x, y: c.y, depth: c.depth };
    first.depth = (a.depth + b.depth + c.depth) / 3;
    first.material = 'torso';
    first.shade = 1;
    first.partId = 'silhouette';
    triangles.push(first);
    const second = triangleSlot(scratch, poolCursor);
    second.a = first.b;
    second.b = { x: d.x, y: d.y, depth: d.depth };
    second.c = first.c;
    second.depth = (b.depth + d.depth + c.depth) / 3;
    second.material = 'torso';
    second.shade = 0.82;
    second.partId = 'silhouette';
    triangles.push(second);
    return { triangles, level: levelName, culled: 0, eye, frame, heightPx };
  }
  cursor = 0;
  let triangleCursor = 0;
  for (const part of level.parts) {
    for (let f = 0; f < part.faces.length; f += 1) {
      const face = part.faces[f].v;
      const A = scratch.screens[cursor + face[0]];
      const B = scratch.screens[cursor + face[1]];
      const C = scratch.screens[cursor + face[2]];
      if (!A || !B || !C || !A.visible || !B.visible || !C.visible) {
        culled += 1;
        continue;
      }
      const a = scratch.worldVerts[cursor + face[0]];
      const b = scratch.worldVerts[cursor + face[1]];
      const c = scratch.worldVerts[cursor + face[2]];
      const normal = norm(cross(sub(b, a), sub(c, a)));
      const centroid = { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3, z: (a.z + b.z + c.z) / 3 };
      const toEye = sub(eye, centroid);
      // Backface cull: outward winding must face the eye (RND-05 §11).
      if (dot(normal, toEye) <= 1e-12) {
        culled += 1;
        continue;
      }
      const localNormal = faceNormal(part.base, face);
      const light = clamp(dot(localNormal, FACE_LIGHTS), -1, 1);
      const triangle = triangleSlot(scratch, poolCursor);
      poolCursor += 1;
      triangleCursor += 1;
      triangle.a = A;
      triangle.b = B;
      triangle.c = C;
      triangle.depth = (A.depth + B.depth + C.depth) / 3;
      triangle.material = part.materials[f];
      triangle.shade = 0.58 + 0.42 * Math.max(0, light);
      triangle.partId = part.id;
      triangles.push(triangle);
    }
    cursor += part.count;
  }
  // Painter sort far → near. Array.prototype.sort is stable, so equal depths
  // keep a deterministic draw order.
  triangles.sort((left, right) => right.depth - left.depth);
  return { triangles, level: levelName, culled, eye, frame, heightPx };
}

const DEFAULT_EDGE = 'rgba(4,16,26,0.62)';

/** Memoised shaded fill string; the palette only allocates on a new shade. */
function shadedFill(scratch, material, shade, opts) {
  const q = Math.round(clamp(shade, 0, 1.4) * 32) / 32;
  const key = `${material}|${q}`;
  let value = scratch.colorCache.get(key);
  if (!value) {
    const base = materialColor(material, opts);
    value = rgbCss(scaleRgb(base, q));
    scratch.colorCache.set(key, value);
  }
  return value;
}

/**
 * Draw a posed rig into the shared canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} camera CameraView
 * @param {object} rig
 * @param {{walkPhase?:number,minePhase?:number,moving?:boolean,lean?:number}} pose
 * @param {{anchor:object,forward?:object,level?:string,angle?:number,currentLod?:string,
 *          scale?:number,tint?:string,skin?:string,alpha?:number,reducedMotion?:boolean,
 *          edge?:string}} opts
 * @returns {{level:string,triangles:number,drawn:number,culled:number,heightPx:number}}
 */
export function drawRig(ctx, camera, rig, pose, opts = {}) {
  if (!ctx || !camera || !rig) return { level: 'L0', triangles: 0, drawn: 0, culled: 0, heightPx: 0 };
  const anchor = opts.anchor;
  if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y) || !Number.isFinite(anchor.z)) {
    return { level: 'L0', triangles: 0, drawn: 0, culled: 0, heightPx: 0 };
  }
  const reducedMotion = !!opts.reducedMotion;
  const effectivePose = reducedMotion
    ? { walkPhase: 0, moving: false, minePhase: pose && pose.minePhase, lean: pose && pose.lean }
    : pose;
  const angle = Number.isFinite(opts.angle) ? opts.angle : angleFromAxis(anchor, camera);
  const level = opts.level || lodForDistance(angle, opts.currentLod || null);
  const posed = poseRig(rig, effectivePose, null, level);
  const scale = Number.isFinite(opts.scale) ? opts.scale : 1;
  const projection = projectRig(camera, rig, posed, {
    level,
    anchor,
    forward: opts.forward,
    scale,
    eye: opts.eye,
  });
  const scratch = scratchFor(rig);
  const alpha = Number.isFinite(opts.alpha) ? clamp(opts.alpha, 0, 1) : 1;
  const context = ctx;
  const previousAlpha = typeof context.globalAlpha === 'number' ? context.globalAlpha : 1;
  const previousEdge = context.strokeStyle;
  const edge = typeof opts.edge === 'string' ? opts.edge : DEFAULT_EDGE;
  for (let i = 0; i < projection.triangles.length; i += 1) {
    const triangle = projection.triangles[i];
    context.globalAlpha = alpha;
    context.fillStyle = shadedFill(scratch, triangle.material, triangle.shade, opts);
    context.beginPath();
    context.moveTo(triangle.a.x, triangle.a.y);
    context.lineTo(triangle.b.x, triangle.b.y);
    context.lineTo(triangle.c.x, triangle.c.y);
    context.closePath();
    context.fill();
    if (edge) {
      context.globalAlpha = alpha * 0.45;
      context.strokeStyle = edge;
      context.lineWidth = 0.55;
      context.stroke();
    }
  }
  context.globalAlpha = previousAlpha;
  if (previousEdge) context.strokeStyle = previousEdge;
  return {
    level,
    triangles: rig.levels[level].triangles,
    drawn: projection.triangles.length,
    culled: projection.culled,
    heightPx: projection.heightPx,
  };
}

/** Tool-arm world point (beam origin) for a posed figure. */
export function toolPoint(rig, pose, anchor, forward) {
  const frame = tangentFrame(anchor, forward);
  const joints = poseJoints(rig, pose);
  const hand = joints.elbowR;
  if (hand) return toWorld({ x: hand.x, y: hand.y - 0.06 * rig.scale, z: hand.z + 0.07 * rig.scale }, frame, anchor);
  return toWorld({ x: 0.2 * rig.scale, y: 0.45 * rig.scale, z: 0.1 * rig.scale }, frame, anchor);
}

/** Convenience factory used by the renderer. */
export function createRig(scale = 0.018) {
  return buildRig(scale);
}

export default drawRig;
