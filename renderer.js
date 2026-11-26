/**
 * NARIMATO v2 renderer — WebGL ray–sphere planet with analytic geodesic edges.
 * One full-screen pass, front surface only. No masks, crops or derived meshes.
 */
import { subdividedIcosahedron } from './geometry.js?v=final6';

const VERT = `attribute vec2 aPos; void main(){ gl_Position = vec4(aPos,0.0,1.0); }`;
const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uFocal;
uniform vec3 uPos;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uFwd;
uniform vec3 uEdgeA[60];
uniform vec3 uEdgeB[60];
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
void main(){
  vec2 s = gl_FragCoord.xy - uRes * 0.5;
  vec3 dir = normalize(uRight * s.x + uUp * s.y + uFwd * uFocal);
  vec3 O = uPos;
  float b = 2.0 * dot(O, dir);
  float c = dot(O, O) - 1.0;
  float disc = b*b - 4.0*c;
  if (disc < 0.0) {
    float n = hash(gl_FragCoord.xy);
    vec3 sky = vec3(0.020, 0.016, 0.055) + vec3(0.02,0.03,0.07) * (gl_FragCoord.y/uRes.y);
    if (n > 0.9985) sky += vec3(0.6,0.75,0.9);
    gl_FragColor = vec4(sky, 1.0);
    return;
  }
  float t = (-b - sqrt(disc)) * 0.5;
  vec3 P = normalize(O + dir * t);
  vec3 n = normalize(P);
  float light = max(0.0, dot(n, normalize(vec3(-0.4,0.6,0.7))));
  float shade = 0.18 + 0.52 * light;
  vec3 col = vec3(0.055, 0.24, 0.28) * shade + vec3(0.01,0.03,0.04);
  // analytic geodesic edges of the base icosahedron
  float edgeWidth = max(0.00012, 2.0 * (length(O) - 1.0) / uFocal);
  for (int i = 0; i < 60; i++) {
    vec3 A = uEdgeA[i];
    vec3 B = uEdgeB[i];
    float edgeCos = dot(A,B) - 0.0002;
    if (dot(P,A) >= edgeCos && dot(P,B) >= edgeCos) {
      vec3 cr = cross(A,B);
      float side = abs(dot(normalize(cr), P));
      if (side < edgeWidth) { col = mix(col, vec3(0.15,0.85,1.0), 0.9); break; }
    }
  }
  gl_FragColor = vec4(col, 1.0);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
  return sh;
}

export class V2Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true });
    this.gl = gl;
    if (!gl) throw new Error('WebGL unavailable');
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    this.program = program;
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    for (const name of ['uRes','uFocal','uPos','uRight','uUp','uFwd','uEdgeA','uEdgeB']) {
      this.u[name] = gl.getUniformLocation(program, name);
    }
    const { vertices, faces } = subdividedIcosahedron(4);
    const seen = new Set();
    const edges = [];
    for (const [a, b, c] of faces) {
      for (const [i, j] of [[a, b], [b, c], [c, a]]) {
        const k = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (seen.has(k)) continue;
        seen.add(k);
        edges.push([vertices[i], vertices[j]]);
      }
    }
    this.edges = edges;
    this.edgeA = new Float32Array(180);
    this.edgeB = new Float32Array(180);
  }

  resize(width, height, dpr = 1) {
    this.canvas.width = Math.max(1, Math.round(width * dpr));
    this.canvas.height = Math.max(1, Math.round(height * dpr));
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  render(camera, dpr = 1) {
    const gl = this.gl;
    const { position, forward, up, right } = camera.basis;
    gl.uniform2f(this.u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.u.uFocal, camera.focal * dpr);
    gl.uniform3f(this.u.uPos, position.x, position.y, position.z);
    gl.uniform3f(this.u.uRight, right.x, right.y, right.z);
    gl.uniform3f(this.u.uUp, up.x, up.y, up.z);
    gl.uniform3f(this.u.uFwd, forward.x, forward.y, forward.z);
    const look = camera.landing || camera.axis || position;
    const ranked = this.edges
      .map(([a, b]) => ({ a, b, d: Math.hypot((a.x + b.x) / 2 - look.x, (a.y + b.y) / 2 - look.y, (a.z + b.z) / 2 - look.z) }))
      .sort((p, q) => p.d - q.d)
      .slice(0, 60);
    const A = this.edgeA, B = this.edgeB;
    ranked.forEach((e, i) => {
      A.set([e.a.x, e.a.y, e.a.z], i * 3);
      B.set([e.b.x, e.b.y, e.b.z], i * 3);
    });
    gl.uniform3fv(this.u.uEdgeA, A);
    gl.uniform3fv(this.u.uEdgeB, B);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
