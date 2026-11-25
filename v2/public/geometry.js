/** NARIMATO v2 — minimal icosahedron geometry (no legacy imports). */
const PHI = (1 + Math.sqrt(5)) / 2;

export function normalize(v) {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

export function baseIcosahedron() {
  const t = PHI;
  const raw = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ];
  const vertices = raw.map(([x, y, z]) => normalize({ x, y, z }));
  const faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  return { vertices, faces };
}


/** One subdivision level: 20 base faces -> 80 spherical triangles. */
export function subdividedIcosahedron(level = 1) {
  const { vertices, faces } = baseIcosahedron();
  let verts = vertices.map((v) => ({ ...v }));
  let current = faces.map((f) => [...f]);
  for (let l = 0; l < level; l += 1) {
    const cache = new Map();
    const midpoint = (i, j) => {
      const key = i < j ? `${i}:${j}` : `${j}:${i}`;
      if (cache.has(key)) return cache.get(key);
      const v = normalize({
        x: verts[i].x + verts[j].x,
        y: verts[i].y + verts[j].y,
        z: verts[i].z + verts[j].z,
      });
      verts.push(v);
      const index = verts.length - 1;
      cache.set(key, index);
      return index;
    };
    const next = [];
    for (const [a, b, c] of current) {
      const ab = midpoint(a, b);
      const bc = midpoint(b, c);
      const ca = midpoint(c, a);
      next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
    }
    current = next;
  }
  return { vertices: verts, faces: current };
}
