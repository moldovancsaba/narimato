/**
 * NARIMATO — shared spherical geometry.
 *
 * A regular spherical icosahedron defined in cartographic coordinates:
 *   - 12 unit points on the sphere: North pole (90.0000, 0.0000), South pole
 *     (-90.0000, 0.0000) and two staggered rings of five at
 *     lat = ±atan(1/2) ≈ ±26.5650511770°, lon multiples of 72°/36°.
 *   - 20 outward-oriented spherical triangles whose edges are great-circle arcs.
 *   - Recursive 4-way subdivision through exact great-circle arc midpoints
 *     (normalize(a + b)): 20 → 80 → 320 → 1280 faces.
 *
 * This module is imported by both the browser client and the Node server so
 * face ids, areas, cartography and camera math are identical on both sides.
 * No external dependencies; all vectors are plain {x, y, z} unit objects.
 */

export const DEG = Math.PI / 180;

const PITCH_LIMIT = 1.35;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 16777216;
export const CAMERA_DISTANCE = 3.2;
export const SPHERE_SCREEN_FRACTION = 0.4;

const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

/** Normalize a 3-vector to unit length. */
export function normalize(v) {
  const len = Math.hypot(v.x, v.y, v.z);
  if (!len) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/** Exact great-circle arc midpoint of two unit vectors. */
export function midpoint(a, b) {
  return normalize({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
}

/**
 * Spherical linear interpolation between two unit vectors (great-circle arc).
 * Used by the renderer to draw/tessellate spherical triangle edges as arcs.
 */
export function slerp(a, b, t) {
  const tt = clamp(Number(t) || 0, 0, 1);
  const dot = clamp(a.x * b.x + a.y * b.y + a.z * b.z, -1, 1);
  const omega = Math.acos(dot);
  if (omega < 1e-8) {
    return normalize({
      x: a.x + (b.x - a.x) * tt,
      y: a.y + (b.y - a.y) * tt,
      z: a.z + (b.z - a.z) * tt,
    });
  }
  const sinOmega = Math.sin(omega);
  const w1 = Math.sin((1 - tt) * omega) / sinOmega;
  const w2 = Math.sin(tt * omega) / sinOmega;
  return {
    x: a.x * w1 + b.x * w2,
    y: a.y * w1 + b.y * w2,
    z: a.z * w1 + b.z * w2,
  };
}

/** Spherical centroid of a triangle, projected back onto the sphere. */
export function faceCentroid(a, b, c) {
  return normalize({ x: a.x + b.x + c.x, y: a.y + b.y + c.y, z: a.z + b.z + c.z });
}

/**
 * Area of a spherical triangle in steradians, via the van Oosterom–Strackee
 * formula: tan(E/2) = |a · (b × c)| / (1 + a·b + b·c + c·a).
 */
export function faceArea(a, b, c) {
  const det =
    a.x * (b.y * c.z - b.z * c.y) +
    a.y * (b.z * c.x - b.x * c.z) +
    a.z * (b.x * c.y - b.y * c.x);
  const denom = 1 + (a.x * b.x + a.y * b.y + a.z * b.z) + (b.x * c.x + b.y * c.y + b.z * c.z) + (c.x * a.x + c.y * a.y + c.z * a.z);
  return 2 * Math.atan2(Math.abs(det), denom);
}

const dot3 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

const cross3 = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

/**
 * Cartographic (latitude, longitude) in degrees -> unit vector.
 * North pole is +Y; longitude 0° faces +X, increasing toward +Z.
 */
export function latLonToVec(lat, lon) {
  const phi = lat * DEG;
  const lambda = lon * DEG;
  return {
    x: Math.cos(phi) * Math.cos(lambda),
    y: Math.sin(phi),
    z: Math.cos(phi) * Math.sin(lambda),
  };
}

/** Unit vector -> { lat, lon } in degrees (lon in (-180, 180]). */
export function vecToLatLon(v) {
  const u = normalize(v);
  const lat = Math.asin(clamp(u.y, -1, 1)) / DEG;
  let lon = Math.atan2(u.z, u.x) / DEG;
  if (lon <= -180) lon += 360;
  if (lon > 180) lon -= 360;
  // Poles have no meaningful longitude; report 0 like the source coordinates.
  if (Math.abs(Math.abs(lat) - 90) < 1e-9) return { lat: Math.sign(lat) * 90, lon: 0 };
  return { lat, lon };
}

const BASE_LAT = Math.atan(0.5) / DEG; // 26.56505117707799
const UPPER_LONS = [0, 72, 144, 216, 288];
const LOWER_LONS = [36, 108, 180, 252, 324];

let baseCache = null;

/**
 * The 12-point, 20-face base spherical icosahedron.
 * Vertices: 0 = North pole, 1 = South pole, 2..6 upper ring, 7..11 lower ring.
 * Faces are auto-oriented outward and delivered in a fixed order.
 */
export function baseIcosahedron() {
  if (baseCache) return baseCache;

  const vertices = [];
  vertices.push({ x: 0, y: 1, z: 0 }); // 0 — North Pole (90, 0)
  vertices.push({ x: 0, y: -1, z: 0 }); // 1 — South Pole (-90, 0)
  for (const lon of UPPER_LONS) vertices.push(latLonToVec(BASE_LAT, lon)); // 2..6
  for (const lon of LOWER_LONS) vertices.push(latLonToVec(-BASE_LAT, lon)); // 7..11

  const faces = [];
  const pushFace = (a, b, c) => {
    const A = vertices[a];
    const B = vertices[b];
    const C = vertices[c];
    const center = faceCentroid(A, B, C);
    // Orient outward: the counter-clockwise face normal must point away from the centre.
    const nx = (B.y - A.y) * (C.z - A.z) - (B.z - A.z) * (C.y - A.y);
    const ny = (B.z - A.z) * (C.x - A.x) - (B.x - A.x) * (C.z - A.z);
    const nz = (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x);
    const outward = nx * center.x + ny * center.y + nz * center.z >= 0;
    faces.push(outward ? [a, b, c] : [a, c, b]);
  };

  // North cap (5 faces).
  for (let i = 0; i < 5; i++) pushFace(0, 2 + i, 2 + ((i + 1) % 5));
  // Middle belt (10 faces). The lower ring is rotated 36° against the upper
  // ring, so each upper-edge triangle uses the lower vertex *between* its end
  // points (L_i) and each lower-edge triangle uses the upper vertex *between*
  // its end points (U_{i+1}). Splitting the quads across the other diagonal
  // produces 116.565° edges — i.e. not a regular icosahedron.
  for (let i = 0; i < 5; i++) {
    const ui = 2 + i;
    const uj = 2 + ((i + 1) % 5);
    const li = 7 + i;
    const lj = 7 + ((i + 1) % 5);
    pushFace(ui, uj, li); // upper-ring edge + lower vertex between them
    pushFace(li, lj, uj); // lower-ring edge + upper vertex between them
  }
  // South cap (5 faces).
  for (let i = 0; i < 5; i++) pushFace(1, 7 + ((i + 1) % 5), 7 + i);

  baseCache = { vertices, faces };
  return baseCache;
}

const meshCache = new Map();

/**
 * Hierarchical child numbering (1..4) for one spherical parent triangle.
 *
 * Algorithm, all in closed form on the unit sphere:
 *   1. G = normalized(A+B+C) is the parent centroid; it is the parent's local
 *      chart origin.
 *   2. Build an orthonormal tangent frame at G:
 *        e1 = normalize(A - (A·G)G)   (points toward vertex A)
 *        e2 = G × e1                  (so e1,e2,G is right-handed)
 *   3. Gnomonic-project the four child centroids onto that chart:
 *        (x, y) = (P·e1, P·e2) / (P·G)
 *   4. Label 1 = the corner child with the largest (x + y) — ties: larger x,
 *      then larger y, then lower structural index.
 *   5. Labels 2 and 3 = the remaining corner children, clockwise around G
 *      starting from label 1 (decreasing polar angle in the chart).
 *   6. Label 4 = the central child (the one containing G).
 *
 * This is camera-independent, so a face keeps the same number no matter how
 * the sphere is rotated. Structural child order stays [corner A, corner B,
 * corner C, centre] to preserve the 4·parent indexing rule.
 *
 * @returns {number[]} label number (1..4) for each structural child.
 */
export function childLabelOrder(a, b, c) {
  const ab = midpoint(a, b);
  const bc = midpoint(b, c);
  const ca = midpoint(c, a);
  const children = [
    [a, ab, ca], // structural 0 — corner A
    [ab, b, bc], // structural 1 — corner B
    [ca, bc, c], // structural 2 — corner C
    [ab, bc, ca], // structural 3 — centre
  ];
  const G = faceCentroid(a, b, c);
  const aDotG = dot3(a, G);
  const e1raw = { x: a.x - G.x * aDotG, y: a.y - G.y * aDotG, z: a.z - G.z * aDotG };
  const e1 = normalize(e1raw);
  const e2raw = cross3(G, e1);
  const e2 = normalize(e2raw);

  const corners = [];
  for (let k = 0; k < 3; k++) {
    const P = faceCentroid(children[k][0], children[k][1], children[k][2]);
    const denom = dot3(P, G);
    const x = dot3(P, e1) / denom;
    const y = dot3(P, e2) / denom;
    corners.push({ k, x, y, sum: x + y, angle: Math.atan2(y, x) });
  }

  // Label 1: largest horizontal + vertical coordinate (then x, y, index).
  corners.sort((p, q) => q.sum - p.sum || q.x - p.x || q.y - p.y || p.k - q.k);
  const start = corners[0];
  // Labels 2,3: clockwise (decreasing polar angle) around the parent centroid.
  const TAU_ = Math.PI * 2;
  const rest = corners.slice(1).sort((p, q) => {
    const dp = (start.angle - p.angle + TAU_) % TAU_;
    const dq = (start.angle - q.angle + TAU_) % TAU_;
    return dp - dq || p.k - q.k;
  });

  const labels = [0, 0, 0, 4]; // centre child is always 4
  labels[start.k] = 1;
  labels[rest[0].k] = 2;
  labels[rest[1].k] = 3;
  return labels;
}

/**
 * The four spherical child triangles of one face, in structural order
 * (corner A, corner B, corner C, centre), each with its hierarchical label
 * number 1..4 computed by childLabelOrder().
 * Shared by the server's adaptive world and the client's tree reconstruction.
 */
export function childTriangles(a, b, c) {
  const ab = midpoint(a, b);
  const bc = midpoint(b, c);
  const ca = midpoint(c, a);
  const labels = childLabelOrder(a, b, c);
  return [
    { a, b: ab, c: ca, labelNumber: labels[0] },
    { a: ab, b, c: bc, labelNumber: labels[1] },
    { a: ca, b: bc, c, labelNumber: labels[2] },
    { a: ab, b: bc, c: ca, labelNumber: labels[3] },
  ];
}

function subdivideLabeled(a, b, c, level, path, out) {
  if (level === 0) {
    out.push({ a, b, c, path });
    return;
  }
  const ab = midpoint(a, b);
  const bc = midpoint(b, c);
  const ca = midpoint(c, a);
  const labels = childLabelOrder(a, b, c);
  // Structural order is fixed [A, B, C, centre] so children of face p at the
  // next level always land at ids 4p .. 4p+3. Labels are attached separately.
  const childTris = [
    [a, ab, ca],
    [ab, b, bc],
    [ca, bc, c],
    [ab, bc, ca],
  ];
  for (let k = 0; k < 4; k++) {
    const tri = childTris[k];
    subdivideLabeled(tri[0], tri[1], tri[2], level - 1, [...path, labels[k]], out);
  }
}

/**
 * Build (and cache) the subdivided spherical mesh for a level.
 *
 * Face ids remain array indices (20/80/320/1280), and every face additionally
 * carries its hierarchical `path` + `label`:
 *   level 0 → "1" … "20"
 *   level 1 → "11.4", level 2 → "9.2.1", level 3 → "9.2.1.1"
 * Children of face p at the next level are ids 4p .. 4p+3 (structural order),
 * regardless of the label numbers.
 *
 * Returns { level, faceCount, faces: [{ id, a, b, c, centroid, normal, area,
 * path, label, depth, parentId }] }.
 */
export function buildMesh(level) {
  if (!Number.isInteger(level) || level < 0 || level > 4) {
    throw new RangeError(`mesh level must be an integer 0..4, got ${level}`);
  }
  const cached = meshCache.get(level);
  if (cached) return cached;

  const { vertices, faces: baseFaces } = baseIcosahedron();
  const raw = [];
  for (let f = 0; f < baseFaces.length; f++) {
    const [ia, ib, ic] = baseFaces[f];
    subdivideLabeled(vertices[ia], vertices[ib], vertices[ic], level, [f + 1], raw);
  }

  const faces = raw.map((tri, id) => {
    const center = faceCentroid(tri.a, tri.b, tri.c);
    const path = tri.path;
    return {
      id,
      a: tri.a,
      b: tri.b,
      c: tri.c,
      centroid: center,
      normal: center,
      area: faceArea(tri.a, tri.b, tri.c),
      path,
      label: path.join('.'),
      depth: path.length - 1,
      parentId: path.length > 1 ? Math.floor(id / 4) : null,
    };
  });

  const mesh = { level, faceCount: faces.length, faces };
  meshCache.set(level, mesh);
  return mesh;
}

/* ------------------------------------------------------------------ *
 * Hierarchical face labels: parse / resolve
 * ------------------------------------------------------------------ */

/**
 * Parse "11", "11.4", "9.2.1.1". Base digit is 1..20; every child digit is
 * 1..4 (four-way subdivision), up to the supported depth of 3.
 * Returns { path, label, level } or null.
 */
export function parseFaceLabel(value) {
  const text = String(value == null ? '' : value).trim();
  if (!text) return null;
  const parts = text.split('.');
  if (parts.length < 1 || parts.length > 4) return null;
  const path = [];
  for (let i = 0; i < parts.length; i++) {
    if (!/^\d{1,2}$/.test(parts[i])) return null;
    const n = Number(parts[i]);
    const ok = i === 0 ? n >= 1 && n <= 20 : n >= 1 && n <= 4;
    if (!ok) return null;
    path.push(n);
  }
  return { path, label: path.join('.'), level: path.length - 1 };
}

/** Resolve a hierarchical label at a mesh level to its face id (or null). */
export function resolveFaceLabel(level, value) {
  const parsed = parseFaceLabel(value);
  if (!parsed || parsed.level !== level) return null;
  const mesh = buildMesh(level);
  for (const face of mesh.faces) {
    if (face.label === parsed.label) return face.id;
  }
  return null;
}

/** Convenience: label string for face id at a level (or null). */
export function faceLabel(level, faceId) {
  const mesh = buildMesh(level);
  const face = mesh.faces[faceId];
  return face ? face.label : null;
}

/** Cached mesh getter (equivalent to buildMesh). */
export function getMesh(level) {
  return buildMesh(level);
}

/**
 * Perspective camera looking at the unit sphere from +Z.
 * The client owns one instance; the renderer projects with it and the app
 * pick-tests with it, so visuals and hit-testing are always in sync.
 */
/* ------------------------------------------------------------------ *
 * Quaternion camera helpers.
 *
 * The old camera stored yaw/pitch and clamped pitch at ±1.35 rad, which made
 * the view stop at the poles. The orientation is now a unit quaternion; drag
 * and arrow input rotate around the camera's local axes, so the view keeps
 * going in every direction (a trackball, not an orbit clamp).
 * ------------------------------------------------------------------ */
const qIdentity = () => ({ x: 0, y: 0, z: 0, w: 1 });
const qMul = (a, b) => ({
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
});
const qFromAxis = (axis, angle) => {
  const h = angle / 2;
  const s = Math.sin(h);
  return { x: axis.x * s, y: axis.y * s, z: axis.z * s, w: Math.cos(h) };
};
const qNormalize = (q) => {
  const len = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return { x: q.x / len, y: q.y / len, z: q.z / len, w: q.w / len };
};
const qFromYawPitch = (yaw, pitch) => {
  // Matches the legacy view matrix Rx(pitch) * Ry(yaw).
  const qy = qFromAxis({ x: 0, y: 1, z: 0 }, yaw || 0);
  const qx = qFromAxis({ x: 1, y: 0, z: 0 }, pitch || 0);
  return qNormalize(qMul(qx, qy));
};
const qRotate = (q, v) => {
  // v' = q * v * q^-1, expanded without allocating a quaternion per point.
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  };
};
const qRotateInverse = (q, v) => qRotate(qNormalize({ x: -q.x, y: -q.y, z: -q.z, w: q.w }), v);
const arcballVector = (xPx, yPx, radius) => {
  // Bell/Shoemake virtual trackball: project onto a hemisphere, and onto a
  // hyperbolic sheet outside the ball so the pointer never clamps/flips.
  const r = Math.max(1, Number(radius) || 1);
  const x = (Number(xPx) || 0) / r;
  const y = (Number(yPx) || 0) / r;
  const l2 = x * x + y * y;
  if (l2 <= 0.5) return { x, y, z: Math.sqrt(Math.max(0, 1 - l2)) };
  const z = 0.5 / Math.sqrt(l2);
  return { x, y, z };
};

export class SphereCamera {
  constructor(widthOrOpts = 1, heightArg) {
    let width = 1;
    let height = 1;
    if (typeof widthOrOpts === 'object' && widthOrOpts !== null) {
      width = Number(widthOrOpts.width) || 1;
      height = Number(widthOrOpts.height) || 1;
    } else {
      width = Number(widthOrOpts) || 1;
      height = Number(heightArg) || width;
    }
    this.width = width;
    this.height = height;
    this.distance = CAMERA_DISTANCE;
    this._yaw = 0.55;
    this._pitch = 0.27;
    this._q = qFromYawPitch(this._yaw, this._pitch);
    this.zoom = 1;
    this._viewAxis = qRotateInverse(this._q, { x: 0, y: 0, z: 1 });
  }

  setViewport(width, height) {
    this.width = Math.max(1, Number(width) || 1);
    this.height = Math.max(1, Number(height) || 1);
    return this;
  }

  /** Legacy Euler access: setting either property resets a clean yaw/pitch view. */
  get yaw() { return this._yaw; }
  set yaw(value) {
    this._yaw = Number.isFinite(Number(value)) ? Number(value) : 0;
    this._syncEuler();
  }
  get pitch() { return this._pitch; }
  set pitch(value) {
    this._pitch = Number.isFinite(Number(value)) ? Number(value) : 0;
    this._syncEuler();
  }

  _syncEuler() {
    this._q = qFromYawPitch(this._yaw, this._pitch);
    this._viewAxis = qRotateInverse(this._q, { x: 0, y: 0, z: 1 });
  }

  reset() {
    this._yaw = 0.55;
    this._pitch = 0.27;
    this._syncEuler();
    this.zoom = 1;
    return this;
  }

  /** Quaternion trackball: local-axis rotation continues through both poles. */
  rotate(dxPx, dyPx) {
    const dx = Number(dxPx) || 0;
    const dy = Number(dyPx) || 0;
    this._yaw += dx * 0.006;
    this._pitch += dy * 0.006;
    const localYaw = qFromAxis({ x: 0, y: 1, z: 0 }, dx * 0.006);
    const localPitch = qFromAxis({ x: 1, y: 0, z: 0 }, dy * 0.006);
    this._q = qNormalize(qMul(qMul(this._q, localYaw), localPitch));
    this._viewAxis = qRotateInverse(this._q, { x: 0, y: 0, z: 1 });
    return this;
  }

  /** World-space direction from planet centre to the camera (culling axis). */
  viewAxis() {
    return this._viewAxis || { x: 0, y: 0, z: 1 };
  }

  /** Upright yaw/pitch of the current view centre, used by keyboard travel. */
  viewEuler() {
    const k = this.viewAxis();
    const pitch = Math.asin(clamp(k.y, -1, 1));
    const yaw = Math.atan2(-k.x, k.z);
    return { yaw, pitch };
  }

  /** Invert the camera rotation for screen-ray picking. */
  unprojectView(v) {
    return qRotateInverse(this._q, v);
  }

  /** Start a stable screen-space drag: remember the orientation at grab time. */
  beginArcball(xPx, yPx, radius) {
    this._arc = {
      q0: { ...this._q },
      start: arcballVector(xPx, yPx, radius),
    };
    return this;
  }

  /**
   * Absolute pointer-to-view rotation. Unlike incremental local-axis rotation,
   * the grabbed point follows the cursor consistently for the whole drag.
   */
  arcballTo(xPx, yPx, radius, invert = false) {
    if (!this._arc) return this;
    const current = arcballVector(xPx, yPx, radius);
    const a = this._arc.start;
    const cross = {
      x: a.y * current.z - a.z * current.y,
      y: a.z * current.x - a.x * current.z,
      z: a.x * current.y - a.y * current.x,
    };
    const crossLen = Math.hypot(cross.x, cross.y, cross.z);
    const dot = clamp(a.x * current.x + a.y * current.y + a.z * current.z, -1, 1);
    let angle = Math.atan2(crossLen, dot);
    if (!(angle > 1e-7)) return this;
    const axis = { x: cross.x / crossLen, y: cross.y / crossLen, z: cross.z / crossLen };
    const delta = qFromAxis(axis, invert ? -angle : angle);
    this._q = qNormalize(qMul(delta, this._arc.q0));
    this._viewAxis = qRotateInverse(this._q, { x: 0, y: 0, z: 1 });
    const e = this.viewEuler();
    this._yaw = e.yaw;
    this._pitch = e.pitch;
    return this;
  }

  /** Begin a free virtual-trackball drag (quaternion, no gimbal/pole lock). */
  beginVirtualTrackball(xPx, yPx, radius) {
    this._track = {
      q0: { ...this._q },
      start: arcballVector(xPx, yPx, radius),
    };
    return this;
  }

  /** Absolute free rotation from the grabbed sphere point to the pointer. */
  virtualTrackballTo(xPx, yPx, radius, invert = false) {
    if (!this._track) return this;
    const current = arcballVector(xPx, yPx, radius);
    const a = this._track.start;
    const cross = {
      x: a.y * current.z - a.z * current.y,
      y: a.z * current.x - a.x * current.z,
      z: a.x * current.y - a.y * current.x,
    };
    const len = Math.hypot(cross.x, cross.y, cross.z);
    const dot = clamp(a.x * current.x + a.y * current.y + a.z * current.z, -1, 1);
    const angle = Math.atan2(len, dot);
    if (!(angle > 1e-7)) return this;
    const axis = { x: cross.x / len, y: cross.y / len, z: cross.z / len };
    const delta = qFromAxis(axis, invert ? -angle : angle);
    this._q = qNormalize(qMul(delta, this._track.q0));
    this._viewAxis = qRotateInverse(this._q, { x: 0, y: 0, z: 1 });
    const e = this.viewEuler();
    this._yaw = e.yaw;
    this._pitch = e.pitch;
    return this;
  }

  zoomBy(factor) {
    const f = Number(factor);
    if (Number.isFinite(f) && f > 0) this.zoom = clamp(this.zoom * f, ZOOM_MIN, ZOOM_MAX);
    return this;
  }

  /** Project a unit vector to CSS pixels. z > 0 means front hemisphere. */
  project(v) {
    const pv = qRotate(this._q, v);
    const x1 = pv.x;
    const y2 = pv.y;
    const z2 = pv.z;
    const denom = this.distance - z2;
    const radius = Math.min(this.width, this.height) * SPHERE_SCREEN_FRACTION * this.zoom;
    const scale = (radius * this.distance) / denom;
    return {
      x: this.width / 2 + x1 * scale,
      y: this.height / 2 - y2 * scale,
      z: z2,
      visible: z2 > 0,
    };
  }
}

/**
 * Exact spherical face picking.
 *
 * Casts the camera ray through the screen point, intersects the unit sphere,
 * then tests spherical containment against each face: a point is inside the
 * spherical triangle when it is on the inner side of all three great-circle
 * edge planes. This matches the rendered geodesic faces (curved arcs), unlike
 * a planar projected-triangle test which is slightly too small near the bulges.
 */
export function pickFace(mesh, camera, sx, sy) {
  if (!mesh || !camera) return null;
  const width = Number(camera.width) || 1;
  const height = Number(camera.height) || 1;
  const zoom = Number(camera.zoom) || 1;
  const distance = Number(camera.distance) || CAMERA_DISTANCE;
  const scale = Math.min(width, height) * SPHERE_SCREEN_FRACTION * zoom * distance;
  if (!(scale > 0)) return null;

  // Camera sits at (0, 0, distance) looking down -Z. Invert the projection to
  // get a view-space ray direction, then intersect the unit sphere.
  const qx = sx - width / 2;
  const qy = height / 2 - sy;
  let dx = qx / scale;
  let dy = qy / scale;
  let dz = -1;
  const dLen = Math.hypot(dx, dy, dz);
  if (!(dLen > 0)) return null;
  dx /= dLen;
  dy /= dLen;
  dz /= dLen;

  const b = distance * dz;
  const c = distance * distance - 1;
  const disc = b * b - c;
  if (disc < 0) return null; // ray misses the sphere
  const t = -b - Math.sqrt(disc);
  if (!(t > 0)) return null;

  const pv = { x: t * dx, y: t * dy, z: distance + t * dz };

  // Undo the camera orientation (quaternion camera, so this stays correct
  // even after the view rolls past a pole).
  const hit = normalize(camera.unprojectView ? camera.unprojectView(pv) : pv);

  // The outward-oriented face whose three edge planes all contain the hit wins.
  // Ties at shared edges are broken deterministically by the safest margin.
  let bestId = null;
  let bestMargin = -Infinity;
  for (const face of mesh.faces) {
    const a = face.a;
    const b2 = face.b;
    const c2 = face.c;
    // Edge plane normals (outward orientation): n = a x b etc.
    const n1x = a.y * b2.z - a.z * b2.y;
    const n1y = a.z * b2.x - a.x * b2.z;
    const n1z = a.x * b2.y - a.y * b2.x;
    const n2x = b2.y * c2.z - b2.z * c2.y;
    const n2y = b2.z * c2.x - b2.x * c2.z;
    const n2z = b2.x * c2.y - b2.y * c2.x;
    const n3x = c2.y * a.z - c2.z * a.y;
    const n3y = c2.z * a.x - c2.x * a.z;
    const n3z = c2.x * a.y - c2.y * a.x;
    const m1 = n1x * hit.x + n1y * hit.y + n1z * hit.z;
    const m2 = n2x * hit.x + n2y * hit.y + n2z * hit.z;
    const m3 = n3x * hit.x + n3y * hit.y + n3z * hit.z;
    if (m1 < -1e-9 || m2 < -1e-9 || m3 < -1e-9) continue;
    const margin = Math.min(m1, m2, m3);
    if (margin > bestMargin) {
      bestMargin = margin;
      bestId = face.id;
    }
  }
  return bestId;
}
