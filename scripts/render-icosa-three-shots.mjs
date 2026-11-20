/**
 * EXACTLY ONE ICOSAHEDRON = 20 spherical arc triangles.
 * One camera instance. Three shots: orbit, flight altitude, building height/horizon.
 * No subdivision, no active-cell render mesh.
 */
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import fs from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:4173';
const outDir = process.env.OUT_DIR || 'media';
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));
await page.goto(`${base}/?intro=0`, { waitUntil: 'domcontentloaded' });
await delay(500);
await page.fill('#tag-input', `ICO${Date.now().toString(36).slice(-5)}`.toUpperCase());
await page.click('#btn-join');
await page.waitForFunction(() => window.__ICOSA__?.joined === true, null, { timeout: 15000 });
await delay(700);

const result = await page.evaluate(async () => {
  const { IcosaRenderer } = await import('/js/renderer.js');
  const { getMesh, faceCentroid } = await import('/js/shared/geometry.js');
  const { terrainAt } = await import('/js/shared/planet.js');
  const app = window.__ICOSA__;
  const seed = app.state.planetSeed;
  const baseFaces = getMesh(0).faces; // exactly 20
  const faces = baseFaces.map((face, i) => ({
    label: String(i + 1),
    a: face.a, b: face.b, c: face.c,
    centroid: faceCentroid(face.a, face.b, face.c),
    depth: 0,
    ownerIndex: -1,
    clicks: 0,
    lastClickIndex: -1,
    terrain: terrainAt(seed, faceCentroid(face.a, face.b, face.c)),
    resourceId: null,
  }));

  const W = 1600, H = 1000;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = `width:${W}px;height:${H}px`;
  document.body.appendChild(canvas);
  const renderer = new IcosaRenderer(canvas);
  renderer.resize();
  renderer.setFaces(faces); // ONLY 20 faces
  renderer.setOpaqueSurface(true);
  // Deliberately do NOT call setPlanetSurface: the only triangles are these 20.

  const norm = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x:v.x/l, y:v.y/l, z:v.z/l }; };
  const dot = (a,b) => a.x*b.x+a.y*b.y+a.z*b.z;
  const cross = (a,b) => ({ x:a.y*b.z-a.z*b.y, y:a.z*b.x-a.x*b.z, z:a.x*b.y-a.y*b.x });
  const add = (a,b) => ({ x:a.x+b.x, y:a.y+b.y, z:a.z+b.z });
  const sub = (a,b) => ({ x:a.x-b.x, y:a.y-b.y, z:a.z-b.z });
  const mul = (a,k) => ({ x:a.x*k, y:a.y*k, z:a.z*k });
  const tangent = (up,v) => norm(sub(v, mul(up, dot(v,up))));

  class OneCamera {
    constructor(w,h){ this.width=w; this.height=h; this.mode='orbit'; this.origin=null; this._v=null; }
    orbit(){ this.mode='orbit'; this.origin=null; this._v=null; return this; }
    altitude(pos, alt){
      this.mode='near'; this.origin=norm(pos);
      const up=this.origin;
      const f=tangent(up,{x:1,y:0,z:0});
      const cam=add(mul(up,1+alt), mul(f,-Math.max(0.003,alt*0.06)));
      const target=add(add(up,mul(f,0.9)),mul(up,-Math.max(0.002,alt*0.12)));
      const fwd=norm(sub(target,cam));
      const right=norm(cross(fwd,up));
      const vup=norm(cross(right,fwd));
      this._v={cam,fwd,right,up:vup};
      return this;
    }
    viewAxis(){ return this._v ? norm(this._v.cam) : {x:0,y:0,z:1}; }
    get yaw(){return 0;} get pitch(){return 0;}
    project(v){
      if(this.mode==='orbit'){
        const d=3.2, radius=Math.min(this.width,this.height)*0.34;
        const scale=radius*d/Math.max(.001,d-v.z);
        return {x:this.width/2+v.x*scale,y:this.height/2-v.y*scale,z:v.z};
      }
      const {cam,fwd,right,up}=this._v; const rel=sub(v,cam); const z=dot(rel,fwd);
      if(z<=.002) return {x:0,y:0,z,visible:false};
      const focal=this.height*1.35;
      return {x:this.width/2+(dot(rel,right)/z)*focal,y:this.height*.58-(dot(rel,up)/z)*focal,z,visible:true};
    }
  }

  const camera=new OneCamera(W,H);
  const shots={};
  camera.orbit(); renderer.setSurfaceView(false); renderer.render(camera,performance.now());
  shots.orbit=canvas.toDataURL('image/png');
  const home=faces[0].centroid;
  camera.altitude(home,0.22); renderer.setSurfaceView(true); renderer.render(camera,performance.now());
  shots.flight=canvas.toDataURL('image/png');
  camera.altitude(home,0.012); renderer.render(camera,performance.now());
  shots.building=canvas.toDataURL('image/png');
  return { shots, triangles: faces.length, sameSet: renderer.faces.length };
});

const decode = (url) => Buffer.from(url.split(',')[1], 'base64');
await fs.writeFile(`${outDir}/icosa-orbit.png`, decode(result.shots.orbit));
await fs.writeFile(`${outDir}/icosa-flight.png`, decode(result.shots.flight));
await fs.writeFile(`${outDir}/icosa-building.png`, decode(result.shots.building));
console.log(JSON.stringify({ triangles: result.triangles, sameSet: result.sameSet, errors }, null, 2));
await browser.close();
if (result.triangles !== 20 || result.sameSet !== 20 || errors.length) process.exitCode = 1;
