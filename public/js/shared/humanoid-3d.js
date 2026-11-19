/**
 * NARIMATO — projected low-poly 3D humanoid.
 *
 * Every vertex lives in the tangent frame of the actual surface point and is
 * projected through the shared SurfaceCamera. The figure is made from closed
 * triangular volumes (head, torso, hips, arms, legs), not a 2D billboard.
 * Depth sorting and per-face shading happen on the same overlay canvas as the
 * renderer's planet.
 */

const norm = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

function boxFaces(base, w, h, d) {
  const [cx, cy, cz] = base;
  const v = [
    [cx - w, cy, cz - d], [cx + w, cy, cz - d], [cx + w, cy + h, cz - d], [cx - w, cy + h, cz - d],
    [cx - w, cy, cz + d], [cx + w, cy, cz + d], [cx + w, cy + h, cz + d], [cx - w, cy + h, cz + d],
  ];
  const f = [
    [0, 1, 2], [0, 2, 3], [5, 4, 7], [5, 7, 6],
    [4, 0, 3], [4, 3, 7], [1, 5, 6], [1, 6, 2],
    [3, 2, 6], [3, 6, 7], [4, 5, 1], [4, 1, 0],
  ];
  return { v, f };
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{project:Function}} camera
 * @param {{x:number,y:number,z:number}} anchor foot point on unit sphere
 * @param {{x:number,y:number,z:number}} forward tangent
 */
export function drawHumanoid3D(ctx, camera, anchor, forward, opts = {}) {
  if (!ctx || !camera || !anchor || !camera.project) return;
  const up = norm(anchor);
  const f0 = norm(forward || { x: 1, y: 0, z: 0 });
  const f = norm(sub(f0, mul(up, dot(f0, up))));
  const r = norm(cross(f, up));
  const s = Number(opts.scale) || 0.018;
  const walk = Number(opts.walkPhase) || 0;
  const tint = opts.tint || '#63dfff';
  const skin = opts.skin || '#eefeff';
  const swing = Math.sin(walk) * s * 0.32;
  const p = (x, y, z) => add(add(add(anchor, mul(up, y)), mul(r, x)), mul(f, z));
  const colorFor = (part, faceIndex) => {
    if (part === 'head') return faceIndex % 2 ? skin : '#d8f8ff';
    if (part === 'visor') return '#9ff6ff';
    if (part === 'leg') return '#244b66';
    if (part === 'arm') return faceIndex % 2 ? '#386f8c' : tint;
    return faceIndex % 2 ? tint : '#2f6e88';
  };

  // Local boxes: [part, centerX, baseY, centerZ, halfW, height, halfD]
  const parts = [
    ['body', 0, s * 0.39, 0, s * 0.27, s * 0.31, s * 0.15],
    ['body', 0, s * 0.70, 0, s * 0.20, s * 0.13, s * 0.13],
    ['head', 0, s * 0.83, 0, s * 0.16, s * 0.20, s * 0.16],
    ['visor', 0, s * 0.90, s * 0.12, s * 0.12, s * 0.08, s * 0.035],
    ['arm', -s * 0.34, s * 0.50, 0, s * 0.075, s * 0.28, s * 0.08],
    ['arm', s * 0.34, s * 0.50, 0, s * 0.075, s * 0.28, s * 0.08],
    ['leg', -s * 0.13, s * 0.0, 0, s * 0.095, s * 0.40, s * 0.10],
    ['leg', s * 0.13, s * 0.0, 0, s * 0.095, s * 0.40, s * 0.10],
  ];
  const tris = [];
  for (const [part, cx, by, cz, hw, hh, hd] of parts) {
    const local = boxFaces([cx, by, cz], hw, hh, hd);
    const verts = local.v.map(([x, y, z]) => p(x, y + (part === 'arm' ? swing * (cx < 0 ? 1 : -1) : 0), z));
    const proj = verts.map((v) => camera.project(v));
    for (let i = 0; i < local.f.length; i += 1) {
      const [a, b, c] = local.f[i];
      const A = proj[a]; const B = proj[b]; const C = proj[c];
      if (!A || !B || !C || !A.visible || !B.visible || !C.visible) continue;
      tris.push({
        A, B, C,
        z: (A.z + B.z + C.z) / 3,
        color: colorFor(part, i),
        edge: part === 'head' ? '#baf7ff' : 'rgba(5,18,28,0.65)',
      });
    }
  }
  tris.sort((a, b) => b.z - a.z);
  for (const tri of tris) {
    ctx.globalAlpha = 0.98;
    ctx.fillStyle = tri.color;
    ctx.beginPath();
    ctx.moveTo(tri.A.x, tri.A.y);
    ctx.lineTo(tri.B.x, tri.B.y);
    ctx.lineTo(tri.C.x, tri.C.y);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = tri.edge;
    ctx.lineWidth = 0.55;
    ctx.stroke();
  }
  // Contact shadow: flat triangle fan at the feet, not a floating dot.
  const foot = camera.project(add(anchor, mul(up, 0.0002)));
  if (foot && foot.visible) {
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(foot.x, foot.y + 1, Math.max(6, s * 420), Math.max(2, s * 120), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
