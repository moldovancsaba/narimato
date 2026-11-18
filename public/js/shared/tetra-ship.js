/**
 * NARIMATO — five-tetrahedron ship.
 *
 * Deliberately tiny and dependency-free: a central hull tetra plus four fin
 * tetrahedra. 5 × 4 vertices, 5 × 4 triangular faces. The same model is used by
 * the intro (arrival to orbit), interplanetary transit, relief drop and alien
 * incident, so every ship in the game is instantly recognisable.
 */

const V = (x, y, z) => ({ x, y, z });

/** Shared, immutable ship model in local space (nose points +Z). */
export const TETRA_SHIP = Object.freeze([
  Object.freeze({
    id: 'hull',
    tone: 'hull',
    verts: Object.freeze([V(0, 0, 16), V(-5, -4, -8), V(5, -4, -8), V(0, 6, -2)]),
  }),
  Object.freeze({
    id: 'port',
    tone: 'fin',
    verts: Object.freeze([V(-5, -4, -8), V(-2, 0, -2), V(-2, 2, -5), V(-18, -1, -6)]),
  }),
  Object.freeze({
    id: 'starboard',
    tone: 'fin',
    verts: Object.freeze([V(5, -4, -8), V(2, 0, -2), V(2, 2, -5), V(18, -1, -6)]),
  }),
  Object.freeze({
    id: 'dorsal',
    tone: 'fin',
    verts: Object.freeze([V(0, 6, -2), V(2, 1, -1), V(-2, 1, -1), V(0, 16, -8)]),
  }),
  Object.freeze({
    id: 'ventral',
    tone: 'fin',
    verts: Object.freeze([V(0, -4, -6), V(3, 0, -2), V(-3, 0, -2), V(0, -14, -10)]),
  }),
]);

const FACES = Object.freeze([[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]]);

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v) => clamp(v, 0, 1);

function hexRgb(hex) {
  const raw = String(hex || '').replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const n = Number.parseInt(full.slice(0, 6), 16);
  return Number.isFinite(n)
    ? { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
    : { r: 220, g: 245, b: 255 };
}

const mix = (a, b, t) => Math.round(a + (b - a) * t);
const rgba = (color, alpha) => `rgba(${color.r},${color.g},${color.b},${clamp01(alpha)})`;

function rotate(v, yaw, pitch, roll) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  let x = v.x * cy + v.z * sy;
  let z = -v.x * sy + v.z * cy;
  let y = v.y * cp - z * sp;
  z = v.y * sp + z * cp;
  const x2 = x * cr - y * sr;
  const y2 = x * sr + y * cr;
  return { x: x2, y: y2, z };
}

/**
 * Project the ship's faces for a 2D canvas.
 * @returns {{faces:Array, engine:{x:number,y:number,z:number}, points:Array}}
 */
export function projectTetraShip({
  x = 0,
  y = 0,
  scale = 1,
  yaw = 0,
  pitch = 0,
  roll = 0,
  distance = 620,
} = {}) {
  const d = Math.max(80, Number(distance) || 620);
  const projected = [];
  const all = [];
  for (const tet of TETRA_SHIP) {
    const vs = tet.verts.map((v) => rotate(v, yaw, pitch, roll));
    const ps = vs.map((v) => {
      const f = d / Math.max(1, d + v.z * scale);
      return { x: x + v.x * scale * f, y: y - v.y * scale * f, z: v.z, v };
    });
    all.push(...ps);
    for (const face of FACES) {
      const a = ps[face[0]];
      const b = ps[face[1]];
      const c = ps[face[2]];
      // Screen-facing normal from the projected triangle; the sign only affects
      // the flat-shading mix, not the silhouette.
      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      const depth = (a.z + b.z + c.z) / 3;
      projected.push({ tet, a, b, c, cross, depth });
    }
  }
  const engineModel = rotate({ x: 0, y: 0, z: -11 }, yaw, pitch, roll);
  const ef = d / Math.max(1, d + engineModel.z * scale);
  return {
    faces: projected,
    points: all,
    engine: { x: x + engineModel.x * scale * ef, y: y - engineModel.y * scale * ef, z: engineModel.z },
  };
}

/**
 * Draw the ship. Flat-shaded tetrahedra, bright edges, engine glow. Works on any
 * CanvasRenderingContext2D (main game, intro, interlude, incidents).
 */
export function drawTetraShip(ctx, options = {}) {
  if (!ctx || typeof ctx.beginPath !== 'function') return null;
  const {
    x = 0,
    y = 0,
    scale = 1,
    yaw = 0.55,
    pitch = -0.35,
    roll = 0,
    alpha = 1,
    hull = '#dff8ff',
    fin = '#7ec9ff',
    edge = '#7af4ff',
    glow = '#55eaff',
    engine = true,
    shadow = true,
  } = options;
  const model = projectTetraShip({ x, y, scale, yaw, pitch, roll, distance: options.distance });
  const hullRgb = hexRgb(hull);
  const finRgb = hexRgb(fin);
  const edgeRgb = hexRgb(edge);
  const glowRgb = hexRgb(glow);
  const a = clamp01(alpha);

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (shadow) {
    ctx.globalAlpha = 0.28 * a;
    ctx.fillStyle = rgba({ r: 0, g: 8, b: 16 }, 1);
    ctx.beginPath();
    ctx.ellipse(x, y + 18 * scale, 32 * scale, 8 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Sort far-to-near so overlapping tetrahedra read correctly.
  model.faces.sort((p, q) => p.depth - q.depth);
  for (const face of model.faces) {
    const base = face.tet.tone === 'hull' ? hullRgb : finRgb;
    const shade = clamp01(0.4 + Math.abs(face.cross) / Math.max(1, 900 * scale * scale));
    const fill = {
      r: mix(base.r, hullRgb.r, shade * 0.4),
      g: mix(base.g, hullRgb.g, shade * 0.4),
      b: mix(base.b, hullRgb.b, shade * 0.4),
    };
    ctx.globalAlpha = a * (face.tet.tone === 'hull' ? 0.92 : 0.82);
    ctx.fillStyle = rgba(fill, 1);
    ctx.beginPath();
    ctx.moveTo(face.a.x, face.a.y);
    ctx.lineTo(face.b.x, face.b.y);
    ctx.lineTo(face.c.x, face.c.y);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = a * 0.78;
    ctx.strokeStyle = rgba(edgeRgb, 0.9);
    ctx.lineWidth = Math.max(0.6, 0.9 * scale);
    ctx.stroke();
  }
  if (engine) {
    const e = model.engine;
    const er = Math.max(3, 15 * scale);
    const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, er * 2.2);
    grad.addColorStop(0, rgba({ r: 255, g: 245, b: 210 }, 0.75 * a));
    grad.addColorStop(0.3, rgba(glowRgb, 0.5 * a));
    grad.addColorStop(1, rgba(glowRgb, 0));
    ctx.globalAlpha = 1;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(e.x, e.y, er * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgba({ r: 255, g: 252, b: 235 }, 0.9 * a);
    ctx.beginPath();
    ctx.arc(e.x, e.y, Math.max(1.4, 2.4 * scale), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  return model;
}

export default drawTetraShip;
