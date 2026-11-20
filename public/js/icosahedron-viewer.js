/**
 * NARIMATO spherical icosahedron viewer.
 * WebGL ray–sphere shader: one object, front surface only, analytic geodesic edges.
 * Mouse rotates objectQ. Cursor keys move the camera carrier pos/up. Wheel changes radius.
 */
import { SPHERE_SCREEN_FRACTION, CAMERA_DISTANCE, baseIcosahedron } from './shared/geometry.js';
import { shortestArcQuat, carrierFrame, carrierProject, carrierUnproject, moveCarrier } from './shared/sphere-interaction.js';

const canvas = document.getElementById('icosa-canvas');
const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true });
if (!gl) throw new Error('WebGL unavailable');

const { vertices, faces } = baseIcosahedron();
const W0 = window.innerWidth;
const H0 = window.innerHeight;
let carrier = carrierFrame({ x: 0, y: 0, z: 1 }, { x: 0, y: 1, z: 0 });
let carrierDistance = CAMERA_DISTANCE;
const MIN_DISTANCE = 2.0;
const MAX_DISTANCE = 8.0;
const ORBIT_STEP = 0.12;
let objectQ = { x: 0, y: 0, z: 0, w: 1 };
let W = 1, H = 1, dpr = 1;

const qNorm = (q) => { const l = Math.hypot(q.x, q.y, q.z, q.w) || 1; return { x: q.x/l, y: q.y/l, z: q.z/l, w: q.w/l }; };
const qMul = (a, b) => ({
  x: a.w*b.x + a.x*b.w + a.y*b.z - a.z*b.y,
  y: a.w*b.y - a.x*b.z + a.y*b.w + a.z*b.x,
  z: a.w*b.z + a.x*b.y - a.y*b.x + a.z*b.w,
  w: a.w*b.w - a.x*b.x - a.y*b.y - a.z*b.z,
});
const qInv = (q) => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });
const qRotateVec = (q, v) => {
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  };
};


const vertSrc = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;
const fragSrc = `
precision highp float;
uniform vec2 uRes;
uniform float uDist;
uniform float uFocal;
uniform vec3 uPos;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec4 uObjInv;
uniform vec3 uEdgeA[30];
uniform vec3 uEdgeB[30];

vec3 qrot(vec4 q, vec3 v) {
  vec3 t = 2.0 * cross(q.xyz, v);
  return v + q.w * t + cross(q.xyz, t);
}

void main() {
  vec2 s = gl_FragCoord.xy - uRes * 0.5;
  vec3 dir = normalize(uRight * s.x + uUp * s.y - uPos * uFocal);
  vec3 O = uPos * uDist;
  float b = 2.0 * dot(O, dir);
  float c = uDist * uDist - 1.0;
  float disc = b * b - 4.0 * c;
  if (disc < 0.0) {
    gl_FragColor = vec4(0.043, 0.051, 0.071, 1.0);
    return;
  }
  float t = (-b - sqrt(disc)) * 0.5;
  vec3 P = normalize(O + dir * t);
  vec3 q = qrot(uObjInv, P); // object-space surface point

  vec3 n = normalize(q);
  float light = clamp(dot(n, normalize(vec3(-0.35, 0.55, 0.76))), 0.0, 1.0);
  float shade = 0.38 + 0.62 * light;
  vec3 col = mix(vec3(0.10, 0.25, 0.34), vec3(0.55, 0.83, 0.93), shade);

  float edge = 0.0;
  // Constant ~1.5 px edge width: angular threshold scales with depth/focal.
  float edgeWidth = max(1e-5, 1.5 * (uDist - 1.0) / uFocal);
  for (int i = 0; i < 30; i++) {
    vec3 A = uEdgeA[i];
    vec3 B = uEdgeB[i];
    vec3 plane = normalize(cross(A, B));
    float side = abs(dot(q, plane));
    float edgeCos = dot(A, B) - 0.0002;
    if (dot(q, A) >= edgeCos && dot(q, B) >= edgeCos && side < edgeWidth) edge = 1.0;
  }
  if (edge > 0.5) col = mix(col, vec3(0.012, 0.035, 0.052), 0.94);
  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || 'shader compile failed');
  return sh;
}
const program = gl.createProgram();
gl.attachShader(program, compile(gl.VERTEX_SHADER, vertSrc));
gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragSrc));
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'program link failed');
gl.useProgram(program);

const quad = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quad);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
const aPos = gl.getAttribLocation(program, 'aPos');
gl.enableVertexAttribArray(aPos);
gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

const edgeKeys = new Set();
const edgeA = new Float32Array(90);
const edgeB = new Float32Array(90);
let e = 0;
for (const [ia, ib, ic] of faces) {
  for (const [a, b] of [[ia, ib], [ib, ic], [ic, ia]]) {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    edgeA.set([vertices[a].x, vertices[a].y, vertices[a].z], e * 3);
    edgeB.set([vertices[b].x, vertices[b].y, vertices[b].z], e * 3);
    e += 1;
  }
}

const u = {
  res: gl.getUniformLocation(program, 'uRes'),
  dist: gl.getUniformLocation(program, 'uDist'),
  focal: gl.getUniformLocation(program, 'uFocal'),
  pos: gl.getUniformLocation(program, 'uPos'),
  right: gl.getUniformLocation(program, 'uRight'),
  up: gl.getUniformLocation(program, 'uUp'),
  objInv: gl.getUniformLocation(program, 'uObjInv'),
  edgeA: gl.getUniformLocation(program, 'uEdgeA'),
  edgeB: gl.getUniformLocation(program, 'uEdgeB'),
};

function focalPixels() { return Math.min(W, H) * SPHERE_SCREEN_FRACTION * CAMERA_DISTANCE; }
function unprojectSphere(xPx, yPx) {
  return carrierUnproject(carrierDistance, focalPixels(), carrier, xPx, yPx, W, H);
}
function projectPoint(v) {
  const p = carrierProject(carrierDistance, focalPixels(), carrier, v);
  return { x: W / 2 + p.x, y: H / 2 + p.y, z: p.z, visible: p.visible };
}

function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.max(1, Math.round(W * dpr));
  canvas.height = Math.max(1, Math.round(H * dpr));
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

function draw() {
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.043, 0.051, 0.071, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.disable(gl.DEPTH_TEST);
  gl.useProgram(program);
  const inv = qInv(objectQ);
  gl.uniform2f(u.res, canvas.width, canvas.height);
  gl.uniform1f(u.dist, carrierDistance);
  gl.uniform1f(u.focal, focalPixels() * dpr);
  gl.uniform3f(u.pos, carrier.pos.x, carrier.pos.y, carrier.pos.z);
  gl.uniform3f(u.right, carrier.right.x, carrier.right.y, carrier.right.z);
  gl.uniform3f(u.up, carrier.up.x, carrier.up.y, carrier.up.z);
  gl.uniform4f(u.objInv, inv.x, inv.y, inv.z, inv.w);
  gl.uniform3fv(u.edgeA, edgeA);
  gl.uniform3fv(u.edgeB, edgeB);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
function frame() { draw(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);

// ----- controls -------------------------------------------------------
const pointers = new Map();
let pointer = null;
let grab = null;
canvas.addEventListener('pointerdown', (event) => {
  canvas.setPointerCapture?.(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 1) {
    pointer = { id: event.pointerId };
    const p0 = unprojectSphere(event.clientX, event.clientY);
    if (p0) grab = { p0, q0: { ...objectQ } };
  }
});
canvas.addEventListener('pointermove', (event) => {
  if (!pointers.has(event.pointerId) || !pointer || !grab || pointer.id !== event.pointerId) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  const p1 = unprojectSphere(event.clientX, event.clientY);
  if (!p1) return;
  objectQ = qNorm(qMul(shortestArcQuat(grab.p0, p1), grab.q0));
});
function end(event) { pointers.delete(event.pointerId); grab = null; if (!pointers.size) pointer = null; }
canvas.addEventListener('pointerup', end);
canvas.addEventListener('pointercancel', end);

window.addEventListener('keydown', (event) => {
  switch (event.key) {
    case 'ArrowLeft': carrier = moveCarrier(carrier, -1, 0, ORBIT_STEP); event.preventDefault(); break;
    case 'ArrowRight': carrier = moveCarrier(carrier, 1, 0, ORBIT_STEP); event.preventDefault(); break;
    case 'ArrowUp': carrier = moveCarrier(carrier, 0, 1, ORBIT_STEP); event.preventDefault(); break;
    case 'ArrowDown': carrier = moveCarrier(carrier, 0, -1, ORBIT_STEP); event.preventDefault(); break;
    default: break;
  }
});

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  carrierDistance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, carrierDistance * Math.exp(event.deltaY * 0.0012)));
}, { passive: false });

window.__ICOSA_VIEW__ = {
  objectQ: () => objectQ,
  vertices,
  unprojectSphere,
  project: (v) => projectPoint(qRotateVec(objectQ, v)),
  carrier: () => ({ pos: { ...carrier.pos }, up: { ...carrier.up }, distance: carrierDistance }),
  pixel: (x, y) => { const a = new Uint8Array(4); gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, a); return [...a]; },
  coloredPixels: () => { const a = new Uint8Array(canvas.width * canvas.height * 4); gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, a); let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] > 25 || a[i+1] > 35 || a[i+2] > 45) n++; return n; },
};
