import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEG,
  normalize,
  midpoint,
  faceCentroid,
  faceArea,
  latLonToVec,
  vecToLatLon,
  baseIcosahedron,
  buildMesh,
  getMesh,
  SphereCamera,
  pickFace,
  slerp,
  childLabelOrder,
  parseFaceLabel,
  resolveFaceLabel,
  childTriangles,
} from '../public/js/shared/geometry.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test('base icosahedron has 12 cartographic points and 20 outward faces', () => {
  const { vertices, faces } = baseIcosahedron();
  assert.equal(vertices.length, 12);
  assert.equal(faces.length, 20);

  // The two documented poles.
  assert.equal(vertices[0].y, 1);
  assert.equal(vertices[1].y, -1);
  const north = vecToLatLon(vertices[0]);
  const south = vecToLatLon(vertices[1]);
  assert.equal(north.lat, 90);
  assert.equal(north.lon, 0);
  assert.equal(south.lat, -90);
  assert.equal(south.lon, 0);

  // Staggered rings at ±atan(1/2).
  const expectedLat = Math.atan(0.5) / DEG;
  for (let i = 2; i < 12; i++) {
    const { lat } = vecToLatLon(vertices[i]);
    assert.ok(near(Math.abs(lat), expectedLat, 1e-9), `ring latitude ${lat}`);
  }
  const upper = vertices.slice(2, 7).map(vecToLatLon);
  const lower = vertices.slice(7, 12).map(vecToLatLon);
  const normLon = (lon) => ((Math.round(lon) % 360) + 360) % 360;
  assert.deepEqual(upper.map((p) => normLon(p.lon)), [0, 72, 144, 216, 288]);
  assert.deepEqual(lower.map((p) => normLon(p.lon)), [36, 108, 180, 252, 324]);
  for (const p of [...upper, ...lower]) assert.ok(near(Math.abs(p.lat), expectedLat, 1e-9));

  // Every face is a unit-vector triangle with positive spherical area and
  // outward winding (cross product points away from the origin).
  let totalArea = 0;
  for (const [ia, ib, ic] of faces) {
    const a = vertices[ia];
    const b = vertices[ib];
    const c = vertices[ic];
    const center = faceCentroid(a, b, c);
    const nx = (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y);
    const ny = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
    const nz = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    assert.ok(nx * center.x + ny * center.y + nz * center.z > 0, `face ${ia},${ib},${ic} outward`);
    const area = faceArea(a, b, c);
    assert.ok(area > 0);
    totalArea += area;
  }
  assert.ok(near(totalArea, 4 * Math.PI, 1e-9), `base area ${totalArea}`);
});

test('midpoints lie on the great-circle arc and stay on the sphere', () => {
  const A = latLonToVec(0, 0);
  const B = latLonToVec(0, 90);
  const M = midpoint(A, B);
  assert.ok(near(Math.hypot(M.x, M.y, M.z), 1, 1e-12));
  assert.ok(near(M.x, Math.SQRT1_2, 1e-12));
  assert.ok(near(M.z, Math.SQRT1_2, 1e-12));
  assert.ok(near(M.y, 0, 1e-12));

  // Midpoint is equidistant from both endpoints.
  const dA = Math.acos(Math.min(1, A.x * M.x + A.y * M.y + A.z * M.z));
  const dB = Math.acos(Math.min(1, B.x * M.x + B.y * M.y + B.z * M.z));
  assert.ok(near(dA, dB, 1e-12));
});

test('lat/lon <-> vector round-trips, including the poles', () => {
  const cases = [
    [0, 0],
    [26.56505117707799, 0],
    [26.56505117707799, 36],
    [-26.56505117707799, 324],
    [-45, 123],
    [12.3456, -77.7],
  ];
  for (const [lat, lon] of cases) {
    const back = vecToLatLon(latLonToVec(lat, lon));
    const lonDelta = ((back.lon - lon + 540) % 360) - 180;
    assert.ok(near(back.lat, lat, 1e-10), `lat ${lat} -> ${back.lat}`);
    assert.ok(near(lonDelta, 0, 1e-10), `lon ${lon} -> ${back.lon}`);
  }
  const p = vecToLatLon(latLonToVec(90, 123));
  assert.equal(p.lat, 90);
  assert.equal(p.lon, 0);
  const s = vecToLatLon(latLonToVec(-90, -12));
  assert.equal(s.lat, -90);
  assert.equal(s.lon, 0);
});

test('subdivision produces 20/80/320/1280 tiles with contiguous ids', () => {
  let expected = 20;
  for (let level = 0; level <= 3; level++) {
    const mesh = buildMesh(level);
    assert.equal(mesh.faceCount, expected);
    assert.equal(mesh.faces.length, expected);
    for (let i = 0; i < expected; i++) {
      assert.equal(mesh.faces[i].id, i);
      const { a, b, c, centroid, normal, area } = mesh.faces[i];
      assert.ok(area > 0, `face ${i} area`);
      assert.ok(near(Math.hypot(a.x, a.y, a.z), 1, 1e-12));
      assert.ok(near(Math.hypot(centroid.x, centroid.y, centroid.z), 1, 1e-12));
      assert.equal(normal, centroid);
    }
    expected *= 4;
  }
  assert.equal(getMesh(1), buildMesh(1), 'mesh caching');
});

test('subdivided spherical tiles exactly cover the unit sphere', () => {
  for (const level of [0, 1, 2, 3]) {
    const mesh = buildMesh(level);
    let total = 0;
    for (const face of mesh.faces) total += face.area;
    assert.ok(Math.abs(total - 4 * Math.PI) < 1e-9, `level ${level} area ${total}`);
  }
});

test('children of face p are ids 4p..4p+3 and lie inside it', () => {
  for (const level of [0, 1, 2]) {
    const parentMesh = buildMesh(level);
    const childMesh = buildMesh(level + 1);
    assert.equal(childMesh.faceCount, parentMesh.faceCount * 4);
    for (const parent of parentMesh.faces) {
      for (let k = 0; k < 4; k++) {
        const child = childMesh.faces[parent.id * 4 + k];
        assert.equal(child.id, parent.id * 4 + k);
        // Child centroid is in the parent's spherical triangle (positive dot
        // with its normal; comfortably inside, not merely on the boundary).
        const dot =
          child.centroid.x * parent.normal.x +
          child.centroid.y * parent.normal.y +
          child.centroid.z * parent.normal.z;
        assert.ok(dot > 0.5, `level ${level} parent ${parent.id} child ${k} dot ${dot}`);
        assert.ok(child.area > 0);
      }
    }
  }
});

test('camera projects the north pole above centre and picks fronts only', () => {
  const camera = new SphereCamera(1200, 800);
  const north = camera.project({ x: 0, y: 1, z: 0 });
  assert.ok(north.visible, 'north pole visible with default pitch');
  assert.ok(north.y < 400, 'north pole above screen centre');

  // Centre of the screen hits a face at every level.
  for (const level of [0, 1, 2]) {
    const mesh = getMesh(level);
    const hit = pickFace(mesh, camera, 600, 400);
    assert.ok(Number.isInteger(hit) && hit >= 0 && hit < mesh.faceCount, `level ${level} centre hit ${hit}`);
  }

  // Way off the sphere = no hit.
  assert.equal(pickFace(getMesh(2), camera, 5, 5), null);

  // The sphere is scale-able: zooming in grows the projected radius.
  const p1 = camera.project({ x: 1, y: 0, z: 0 });
  camera.zoomBy(1.5);
  const p2 = camera.project({ x: 1, y: 0, z: 0 });
  assert.ok(p2.x - 600 > p1.x - 600, 'zoom increases projected size');

  // Rotation changes the view.
  const before = pickFace(getMesh(2), camera, 600, 400);
  camera.rotate(320, 0);
  const after = pickFace(getMesh(2), camera, 600, 400);
  assert.ok(Number.isInteger(after));
  assert.notEqual(before, after);

  // The quaternion trackball has no pitch clamp: it can keep rolling through
  // both poles, and projection/picking stay finite afterwards.
  camera.pitch = 0;
  camera.rotate(0, 99999);
  assert.ok(Number.isFinite(camera.pitch));
  assert.ok(Math.abs(camera.pitch) > 1.35, 'pitch is intentionally unbounded');
  const pole = camera.project({ x: 0, y: 1, z: 0 });
  assert.ok(Number.isFinite(pole.x) && Number.isFinite(pole.y));
  const picked = pickFace(getMesh(2), camera, 600, 400);
  assert.ok(Number.isInteger(picked));
});

test('camera drag follows the cursor; keyboard yaw is inverse', () => {
  const front = { x: 0, y: 0, z: 1 };
  const direct = new SphereCamera(1200, 800);
  const before = direct.project(front).x;
  direct.beginArcball(0, 0, 360);
  direct.arcballTo(-100, 0, 360, false);
  assert.ok(direct.project(front).x < before, 'drag left moves the grabbed surface left');

  const inverted = new SphereCamera(1200, 800);
  const invBefore = inverted.project(front).x;
  inverted.beginArcball(0, 0, 360);
  inverted.arcballTo(-100, 0, 360, true);
  assert.ok(inverted.project(front).x > invBefore, 'reverse drag moves it right');

  // Increasing yaw moves the front point right. The keyboard applies the
  // opposite sign to ArrowLeft, so travel-left rotates the planet right.
  const orbit = new SphereCamera(1200, 800);
  const orbitBefore = orbit.project(front).x;
  orbit.yaw += 0.2;
  assert.ok(orbit.project(front).x > orbitBefore, 'positive yaw moves front surface right');
});

test('picking the projected pole hits a pole-cap face at level 0', () => {
  const camera = new SphereCamera(800, 800);
  camera.pitch = 0.9;
  const mesh = getMesh(0);
  const north = camera.project({ x: 0, y: 1, z: 0 });
  const hit = pickFace(mesh, camera, north.x, north.y);
  assert.ok(Number.isInteger(hit));
  assert.ok(hit >= 0 && hit <= 4, `north cap faces are 0..4, got ${hit}`);
});

test('slerp follows great-circle arcs between unit vectors', () => {
  const A = latLonToVec(0, 0);
  const B = latLonToVec(0, 90);
  const mid = slerp(A, B, 0.5);
  assert.ok(near(Math.hypot(mid.x, mid.y, mid.z), 1, 1e-12));
  assert.ok(near(mid.x, Math.SQRT1_2, 1e-12));
  assert.ok(near(mid.z, Math.SQRT1_2, 1e-12));
  for (const t of [0, 0.2, 0.5, 0.8, 1]) {
    const p = slerp(A, B, t);
    assert.ok(near(Math.hypot(p.x, p.y, p.z), 1, 1e-12), `t=${t} on sphere`);
    // Every sample sits on the great circle whose plane normal is A x B.
    const nx = A.y * B.z - A.z * B.y;
    const ny = A.z * B.x - A.x * B.z;
    const nz = A.x * B.y - A.y * B.x;
    assert.ok(Math.abs(nx * p.x + ny * p.y + nz * p.z) < 1e-12, `t=${t} on great circle`);
  }
});

test('spherical picking: aiming at each face centroid picks that face', () => {
  // Aim the camera independently at every face so perspective visibility and
  // boundary ambiguity cannot mask a containment bug.
  for (const level of [0, 1, 2]) {
    const mesh = getMesh(level);
    for (const face of mesh.faces) {
      const c = face.centroid;
      const camera = new SphereCamera(1200, 800);
      camera.yaw = Math.atan2(-c.x, c.z);
      camera.pitch = Math.atan2(c.y, Math.hypot(c.x, c.z));
      const p = camera.project(c);
      assert.ok(near(p.x, 600, 1e-6) && near(p.y, 400, 1e-6), `aim face ${face.id}`);
      assert.ok(near(p.z, 1, 1e-9), `centroid depth face ${face.id}`);
      assert.equal(pickFace(mesh, camera, p.x, p.y), face.id, `level ${level} face ${face.id}`);
    }
  }
});

test('spherical picking follows the curved geodesic edge, not the flat chord', () => {
  // Aim at a level-0 face, then sample just inside the projected great-circle
  // arc midpoint of one edge. That screen point lies outside the flat chord
  // triangle, so a planar picker would miss the face.
  const camera = new SphereCamera(1200, 800);
  const mesh = getMesh(0);
  const face = mesh.faces.find((f) => f.centroid.z > 0.2 && f.centroid.y > 0) || mesh.faces[0];
  const c = face.centroid;
  camera.yaw = Math.atan2(-c.x, c.z);
  camera.pitch = Math.atan2(c.y, Math.hypot(c.x, c.z));

  const M = camera.project(normalize({
    x: face.a.x + face.b.x,
    y: face.a.y + face.b.y,
    z: face.a.z + face.b.z,
  }));
  const cen = camera.project(face.centroid);
  // 2% of the way from the curved edge toward the face centre → strictly inside
  // the spherical triangle but outside the straight chord.
  const px = M.x + (cen.x - M.x) * 0.02;
  const py = M.y + (cen.y - M.y) * 0.02;
  assert.equal(pickFace(mesh, camera, px, py), face.id);

  // Sanity: the flat-chord midpoint projection and the curved arc midpoint are
  // measurably different, so this test is exercising curvature.
  const A = camera.project(face.a);
  const B = camera.project(face.b);
  const chordMid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  assert.ok(Math.hypot(M.x - chordMid.x, M.y - chordMid.y) > 0.5, 'arc bows away from chord');
});

test('base icosahedron is REGULAR: 30 equal 63.435° edges and equal face areas', () => {
  const { vertices, faces } = baseIcosahedron();
  const edge = new Map();
  const degree = new Map();
  for (const [a, b, c] of faces) {
    for (const v of [a, b, c]) degree.set(v, (degree.get(v) || 0) + 1);
    for (const [x, y] of [[a, b], [b, c], [c, a]]) {
      const key = x < y ? `${x}-${y}` : `${y}-${x}`;
      const angle = Math.acos(
        Math.min(1, Math.max(-1, vertices[x].x * vertices[y].x + vertices[x].y * vertices[y].y + vertices[x].z * vertices[y].z))
      );
      const prev = edge.get(key);
      if (prev) assert.ok(near(prev.angle, angle, 1e-12), `shared edge ${key} length mismatch`);
      edge.set(key, { angle, count: (prev ? prev.count : 0) + 1 });
    }
  }
  assert.equal(edge.size, 30, 'icosahedron has exactly 30 edges');
  const expected = Math.acos(1 / Math.sqrt(5)); // 63.4349488° central angle
  for (const [key, info] of edge) {
    assert.ok(near(info.angle, expected, 1e-9), `edge ${key} = ${(info.angle / DEG).toFixed(4)}°, not 63.4349°`);
    assert.equal(info.count, 2, `edge ${key} shared by two faces`);
  }
  // All 20 spherical faces are congruent.
  const targetArea = (4 * Math.PI) / 20;
  for (const [a, b, c] of faces) {
    const area = faceArea(vertices[a], vertices[b], vertices[c]);
    assert.ok(near(area, targetArea, 1e-9), `face ${a},${b},${c} area`);
  }
  // Regular triangulation: every vertex has degree 5.
  assert.equal(degree.size, 12);
  for (const [v, d] of degree) assert.equal(d, 5, `vertex ${v} degree`);
});

test('hierarchical face labels: base 1–20, then children 1–4', () => {
  const m0 = buildMesh(0);
  assert.deepEqual(m0.faces.map((f) => f.label), Array.from({ length: 20 }, (_, i) => String(i + 1)));
  assert.deepEqual(m0.faces.map((f) => f.depth), new Array(20).fill(0));

  for (let level = 1; level <= 3; level++) {
    const mesh = buildMesh(level);
    const labels = mesh.faces.map((f) => f.label);
    assert.equal(new Set(labels).size, labels.length, `unique labels at level ${level}`);
    for (const face of mesh.faces) {
      assert.equal(face.path.length, level + 1);
      assert.equal(face.label, face.path.join('.'));
      assert.match(face.label, /^(?:[1-9]|1[0-9]|20)(?:\.[1-4]){1,3}$/);
      if (level > 0) {
        assert.equal(face.parentId, Math.floor(face.id / 4));
        const parent = buildMesh(level - 1).faces[face.parentId];
        assert.ok(face.label.startsWith(`${parent.label}.`), `${face.label} prefix ${parent.label}`);
      }
    }
  }
});

test('label 1 = largest x+y, then clockwise, centre = 4 (camera independent)', () => {
  // Recompute the local tangent chart independently of childLabelOrder().
  const local = (parent, child) => {
    const G = faceCentroid(parent.a, parent.b, parent.c);
    const aDotG = parent.a.x * G.x + parent.a.y * G.y + parent.a.z * G.z;
    const e1 = normalize({
      x: parent.a.x - G.x * aDotG,
      y: parent.a.y - G.y * aDotG,
      z: parent.a.z - G.z * aDotG,
    });
    const cross = (p, q) => ({
      x: p.y * q.z - p.z * q.y,
      y: p.z * q.x - p.x * q.z,
      z: p.x * q.y - p.y * q.x,
    });
    const e2 = normalize(cross(G, e1));
    const P = faceCentroid(child.a, child.b, child.c);
    const w = P.x * e1.x + P.y * e1.y + P.z * e1.z;
    const denom = P.x * G.x + P.y * G.y + P.z * G.z;
    return { x: w / denom, y: (P.x * e2.x + P.y * e2.y + P.z * e2.z) / denom };
  };

  for (let level = 0; level <= 2; level++) {
    const parentMesh = buildMesh(level);
    const childMesh = buildMesh(level + 1);
    for (const parent of parentMesh.faces) {
      const kids = childMesh.faces.slice(parent.id * 4, parent.id * 4 + 4);
      const mids = [
        midpoint(parent.a, parent.b),
        midpoint(parent.b, parent.c),
        midpoint(parent.c, parent.a),
      ];
      const structural = [
        { a: parent.a, b: mids[0], c: mids[2] },
        { a: mids[0], b: parent.b, c: mids[1] },
        { a: mids[2], b: mids[1], c: parent.c },
        { a: mids[0], b: mids[1], c: mids[2] },
      ];
      const localCoords = structural.slice(0, 3).map((s) => {
        const q = local(parent, s);
        return { ...q, sum: q.x + q.y, angle: Math.atan2(q.y, q.x) };
      });
      const childLabels = kids.map((k) => Number(k.label.split('.').pop()));
      const byStructural = [0, 1, 2].map((k) => ({ k, ...localCoords[k], label: childLabels[k] }));

      const best = [...byStructural].sort(
        (p, q) => q.sum - p.sum || q.x - p.x || q.y - p.y || p.k - q.k
      )[0];
      assert.equal(best.label, 1, `level ${level}/${parent.label}: max x+y is label ${best.label}`);

      const startAngle = byStructural[best.k].angle;
      const TAU_ = Math.PI * 2;
      const expectedRest = byStructural
        .filter((p) => p.k !== best.k)
        .sort((p, q) => {
          const dp = (startAngle - p.angle + TAU_) % TAU_;
          const dq = (startAngle - q.angle + TAU_) % TAU_;
          return dp - dq || p.k - q.k;
        });
      assert.equal(expectedRest[0].label, 2);
      assert.equal(expectedRest[1].label, 3);
      assert.equal(childLabels[3], 4, `centre child of ${parent.label} is label 4`);

      // Clockwise in the outward-view chart ⇒ negative z cross product between
      // consecutive corner vectors.
      const order = [byStructural[best.k], expectedRest[0], expectedRest[1]];
      for (let i = 0; i < 3; i++) {
        const p = order[i];
        const q = order[(i + 1) % 3];
        const crossZ = p.x * q.y - p.y * q.x;
        assert.ok(crossZ < 0, `clockwise order at ${parent.label}: ${crossZ}`);
      }
    }
  }
});

test('parseFaceLabel / resolveFaceLabel round-trip and reject impossible ids', () => {
  assert.deepEqual(parseFaceLabel('11'), { path: [11], label: '11', level: 0 });
  assert.deepEqual(parseFaceLabel('11.4'), { path: [11, 4], label: '11.4', level: 1 });
  assert.deepEqual(parseFaceLabel('9.2.1.1'), { path: [9, 2, 1, 1], label: '9.2.1.1', level: 3 });
  for (const bad of ['', '0', '21', '1.0', '1.5', '11.4.5', '9.2.1.1.5', 'a', '11..4']) {
    assert.equal(parseFaceLabel(bad), null, `invalid ${bad}`);
  }
  for (let level = 0; level <= 3; level++) {
    const mesh = buildMesh(level);
    for (const face of mesh.faces) {
      assert.equal(resolveFaceLabel(level, face.label), face.id);
      assert.equal(resolveFaceLabel(level + 1, face.label), null);
    }
  }
  assert.equal(resolveFaceLabel(1, '20.4'), 79);
  assert.equal(resolveFaceLabel(0, '20'), 19);
});

test('childTriangles returns four labelled spherical children', () => {
  const parents = buildMesh(0).faces.slice(0, 3).concat(buildMesh(1).faces.slice(0, 2));
  for (const parent of parents) {
    const children = childTriangles(parent.a, parent.b, parent.c);
    assert.equal(children.length, 4);
    assert.deepEqual(children.map((c) => c.labelNumber).sort(), [1, 2, 3, 4]);
    let area = 0;
    for (const child of children) {
      assert.ok(near(faceArea(child.a, child.b, child.c) > 0 ? 1 : 0, 1));
      const centroid = faceCentroid(child.a, child.b, child.c);
      // Child centroid lies inside the parent spherical triangle.
      for (const [p, q] of [[parent.a, parent.b], [parent.b, parent.c], [parent.c, parent.a]]) {
        const nx = p.y * q.z - p.z * q.y;
        const ny = p.z * q.x - p.x * q.z;
        const nz = p.x * q.y - p.y * q.x;
        assert.ok(nx * centroid.x + ny * centroid.y + nz * centroid.z > 0);
      }
      area += faceArea(child.a, child.b, child.c);
    }
    assert.ok(near(area, parent.area, 1e-9), 'children tile the parent');
  }
});
