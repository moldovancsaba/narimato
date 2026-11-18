/**
 * NARIMATO — emergency supply crash cinematic.
 *
 * A relief ship streaks into frame and breaks apart on the crust; the server
 * has already marked the nearby cells with the player's missing ore. This
 * module is purely presentational and fails safe.
 */

import { drawTetraShip } from './shared/tetra-ship.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createSupplyDrop() {
  const doc = typeof document !== 'undefined' ? document : null;
  const els = {};
  let canvas = null;
  let ctx = null;
  let raf = 0;
  let active = false;
  let start = 0;

  function collect() {
    for (const id of ['supply-overlay', 'supply-fx', 'supply-sub']) els[id] = doc ? doc.getElementById(id) : null;
    canvas = els['supply-fx'];
    if (canvas && canvas.getContext) ctx = canvas.getContext('2d');
  }

  function resize() {
    if (!canvas || !ctx) return;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(window.innerWidth * dpr));
    canvas.height = Math.max(1, Math.round(window.innerHeight * dpr));
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(now) {
    if (!active || !ctx || !canvas) return;
    const elapsed = now - start;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const k = clamp01(elapsed / 2800);
    ctx.clearRect(0, 0, w, h);
    if (!prefersReducedMotion()) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // Ship streak entering from upper-left toward a low impact point.
      const ix = w * 0.62;
      const iy = h * 0.6;
      const sx = w * 0.05;
      const sy = -h * 0.15;
      const t = clamp01(k * 2.6);
      const px = sx + (ix - sx) * t;
      const py = sy + (iy - sy) * t;
      const trail = ctx.createLinearGradient(px - 160, py - 100, px, py);
      trail.addColorStop(0, 'rgba(255,160,50,0)');
      trail.addColorStop(0.7, `rgba(255,184,92,${0.5 * (1 - k)})`);
      trail.addColorStop(1, `rgba(255,240,200,${0.8 * (1 - k)})`);
      ctx.strokeStyle = trail;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(px - 180, py - 110);
      ctx.lineTo(px, py);
      ctx.stroke();
      // The relief ship is the same five-tetrahedron silhouette as our own.
      const shipScale = (0.55 + (1 - clamp01(t * 1.4)) * 0.5) * Math.min(w, h) / 900;
      drawTetraShip(ctx, {
        x: px,
        y: py,
        scale: shipScale,
        yaw: 0.7 + t * 2.4,
        pitch: -0.35,
        roll: t * 1.8,
        hull: '#fff2d2',
        fin: '#ffbd6a',
        edge: '#ffe7b0',
        glow: '#ffcf72',
        alpha: clamp01(1 - k * 0.4),
      });
      // Impact shock rings + scattered salvage sparks.
      const ring = clamp01((elapsed - 850) / 1600);
      if (elapsed > 700) {
        for (let i = 0; i < 3; i += 1) {
          const rr = 30 + ring * Math.max(w, h) * (0.22 + i * 0.06);
          ctx.strokeStyle = `rgba(255,${190 - i * 20},${90 - i * 15},${0.42 * (1 - ring)})`;
          ctx.lineWidth = 6 - i;
          ctx.beginPath();
          ctx.arc(ix, iy, Math.max(1, rr), 0, Math.PI * 2);
          ctx.stroke();
        }
        for (let i = 0; i < 22; i += 1) {
          const a = (i / 22) * Math.PI * 2;
          const r = 30 + ring * 220;
          ctx.fillStyle = `rgba(255,190,100,${0.55 * (1 - ring)})`;
          ctx.fillRect(ix + Math.cos(a) * r, iy + Math.sin(a) * r * 0.7, 3, 3);
        }
      }
      // Recovery canisters.
      if (elapsed > 1200) {
        const a = clamp01((elapsed - 1200) / 800);
        ctx.fillStyle = `rgba(215,255,0,${0.75 * (1 - k)})`;
        for (let i = 0; i < 5; i += 1) {
          const ang = -0.9 + i * 0.42;
          const rr = 34 + a * 120;
          const px2 = ix + Math.cos(ang) * rr;
          const py2 = iy + Math.sin(ang) * rr * 0.7;
          ctx.beginPath();
          ctx.moveTo(px2 - 5, py2 - 4);
          ctx.lineTo(px2 + 5, py2 - 4);
          ctx.lineTo(px2, py2 + 5);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
    }
    if (elapsed > 3200) {
      active = false;
      if (ctx) ctx.clearRect(0, 0, w, h);
      hide();
      return;
    }
    raf = requestAnimationFrame(draw);
  }

  function hide() {
    const overlay = els['supply-overlay'];
    if (overlay) {
      overlay.classList.add('is-hidden');
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
    }
    if (doc && doc.body) doc.body.classList.remove('is-supply-drop');
    if (ctx) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }

  function show({ message, cells } = {}) {
    if (!doc) return false;
    if (!els['supply-overlay']) collect();
    const overlay = els['supply-overlay'];
    if (!overlay) return false;
    active = true;
    start = performance.now();
    overlay.hidden = false;
    overlay.classList.remove('is-hidden');
    overlay.setAttribute('aria-hidden', 'false');
    if (els['supply-sub']) {
      const count = Array.isArray(cells) ? cells.length : 0;
      els['supply-sub'].textContent = message
        ? `${message}${count ? ` // ${count} marked triangle${count === 1 ? '' : 's'}` : ''}`
        : 'A relief ship just came down hard. Salvage the marked triangles.';
    }
    if (doc.body) doc.body.classList.add('is-supply-drop');
    resize();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
    return true;
  }

  if (doc) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', collect, { once: true });
    else collect();
  }

  return { show, hide, get active() { return active; } };
}
