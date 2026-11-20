/**
 * NARIMATO — interplanetary transit cinematic + incident FX.
 *
 * The interlude plays when the pilot finishes the escape refit: launch burn →
 * random space story event (storm / pirates / wormhole tremor…) → hull damage +
 * screen shake → emergency landing on the next planet.
 *
 * The incident overlay (meteor / nuclear / solar / alien) is drawn here too.
 * Every incident effect must be *measurable* (EVT-02): the FX canvas is sized
 * to device pixels, each kind has a distinct ship/sun/effect signature drawn
 * through the shared five-tetrahedron ship model, reduced motion paints one
 * static poster instead of a loop, and `incidentFxStats()` reports frames,
 * pixel coverage, ships and blank state for the automated acceptance script.
 *
 * EVT-03: this module owns motion only. Announcement/caption text is built by
 * `shared/incident-announcements.js` and written by `ui.js`; here the overlay
 * gains keyboard dismissal (Escape, DISMISS) and never adds `body.is-shaking`
 * under reduced motion. Canvas FX stay `aria-hidden="true"`.
 */

import { drawTetraShip } from './shared/tetra-ship.js';

const PHASES = [
  { id: 'launch', duration: 1700, status: 'ESCAPE BURN', sub: 'CLEARING THE GRAVITY WELL', className: 'mode-launch' },
  { id: 'event', duration: 2500, status: 'SPACE STORM', sub: 'HULL BREACH // UNCONTROLLED DRIFT', className: 'mode-storm' },
  { id: 'fall', duration: 1700, status: 'EMERGENCY LANDING', sub: 'NEW PLANET DETECTED // BRACE FOR IMPACT', className: 'mode-fall' },
];

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

const INCIDENT_KINDS = Object.freeze(['meteor', 'nuclear', 'solar', 'alien']);
const INCIDENT_SHIP_COUNTS = Object.freeze({ meteor: 1, nuclear: 0, solar: 0, alien: 2 });
const INCIDENT_FX_MS = 2100;

/** EVT-02 measurement contract (issue #33). */
export const MIN_COVERAGE = 0.03;
export const POSTER_FRAME_MS = 400;
export const INCIDENT_DWELL_MS = 2600;
export const INCIDENT_DWELL_REDUCED_MS = 1200;
/** Sample every 40th device pixel, alpha > 8 counts as painted. */
const COVERAGE_PIXEL_STRIDE = 160; // 4 bytes/pixel * 40 pixels
const COVERAGE_ALPHA_FLOOR = 8;
const FULL_MOTION_FRAMES = 30;

const maxDpr = () => Math.max(1, Math.min(3, (typeof window !== 'undefined' && window.devicePixelRatio) || 1));

function canvasCssSize() {
  if (typeof window === 'undefined') return { width: 1, height: 1 };
  return {
    width: Math.max(1, Math.round(window.innerWidth || 1)),
    height: Math.max(1, Math.round(window.innerHeight || 1)),
  };
}

function prefersReducedMotionNow() {
  return prefersReducedMotion();
}

export function createInterlude({ safeCall, safeAudio } = {}) {
  const els = {};
  let canvas = null;
  let ctx = null;
  let meteorCanvas = null;
  let meteorCtx = null;
  let active = false;
  let startTime = 0;
  let story = null;
  let fromInfo = null;
  let toInfo = null;
  let onComplete = null;
  let holdMs = 0;
  let raf = 0;
  let lastRain = 0;
  let shake = 0;

  // ---- Incident FX state (EVT-02/EVT-03) --------------------------------
  let meteorActive = false;
  let incidentOpen = false;
  let meteorStart = 0;
  let meteorMessage = '';
  let meteorTitle = 'PLANETARY EVENT';
  let incidentKind = 'meteor';
  let incidentDescription = '';
  let meteorRaf = 0;
  let incidentDwellTimer = 0;
  let incidentDwellMs = INCIDENT_DWELL_MS;
  let incidentFocusBefore = null;
  let incidentControlsBound = false;
  let incidentFirstFrameMeasured = false;
  const incidentBackgrounds = new Map(); // cached static per-kind backdrop canvases
  const incidentFxStats = {
    kind: 'meteor',
    frames: 0,
    coverage: 0,
    dpr: 1,
    reducedMotion: false,
    ships: 0,
    blank: true,
    poster: false,
    open: false,
    dwellMs: INCIDENT_DWELL_MS,
    firstFrameLuminance: 0,
  };

  function collect() {
    for (const id of [
      'interlude-overlay', 'interlude-fx', 'interlude-title', 'interlude-sub',
      'interlude-story', 'interlude-status', 'interlude-bar', 'interlude-planet',
      'meteor-overlay', 'meteor-fx', 'meteor-title', 'meteor-sub', 'meteor-description',
      'meteor-dismiss', 'arena-canvas',
    ]) {
      els[id] = document.getElementById(id);
    }
    canvas = els['interlude-fx'];
    if (canvas && canvas.getContext) ctx = canvas.getContext('2d');
    meteorCanvas = els['meteor-fx'];
    if (meteorCanvas && meteorCanvas.getContext) meteorCtx = meteorCanvas.getContext('2d', { willReadFrequently: true });
  }

  /**
   * Size a full-screen FX canvas to `cssSize × devicePixelRatio` and scale the
   * 2D context back to CSS coordinates, so drawing code never has to know DPR.
   * Re-runs when the DPR or viewport changes mid-effect.
   */
  function resizeCanvas(el, context) {
    if (!el || !context) return { width: 1, height: 1, dpr: 1 };
    const { width, height } = canvasCssSize();
    const dpr = maxDpr();
    const deviceWidth = Math.max(1, Math.round(width * dpr));
    const deviceHeight = Math.max(1, Math.round(height * dpr));
    if (el.width !== deviceWidth || el.height !== deviceHeight) {
      el.width = deviceWidth;
      el.height = deviceHeight;
    }
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width, height, dpr };
  }

  function setText(id, text) {
    if (els[id]) els[id].textContent = text;
  }

  function setProgress(value) {
    if (els['interlude-bar']) els['interlude-bar'].style.width = `${clamp01(value) * 100}%`;
  }

  function renderStory() {
    const host = els['interlude-story'];
    if (!host) return;
    host.textContent = '';
    const lines = (story && Array.isArray(story.lines) ? story.lines : []).slice(0, 4);
    for (const line of lines) {
      const p = document.createElement('p');
      p.className = 'interlude-story-line';
      p.textContent = line;
      host.appendChild(p);
    }
  }

  function setOverlay(visible) {
    const overlay = els['interlude-overlay'];
    if (!overlay) return;
    overlay.classList.toggle('is-hidden', !visible);
    overlay.classList.toggle('is-active', visible);
    overlay.hidden = !visible;
    overlay.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (document.body) {
      document.body.classList.toggle('is-interlude', visible);
      document.body.classList.toggle('is-shaking', false);
    }
  }

  function setMeteor(visible) {
    const overlay = els['meteor-overlay'];
    if (!overlay) return;
    overlay.classList.toggle('is-hidden', !visible);
    overlay.classList.toggle('is-active', visible);
    overlay.hidden = !visible;
    overlay.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (document.body) document.body.classList.toggle('is-meteor', visible);
  }

  function draw(t) {
    if (!ctx || !canvas) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    if (prefersReducedMotionNow()) return;
    const now = t / 1000;
    const cx = w / 2;
    const cy = h / 2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const phaseId = currentPhase().id;
    // Starfield / speed streaks.
    const count = phaseId === 'event' ? 90 : 50;
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2 + Math.sin(now * 0.2 + i) * 0.04;
      const r0 = 70 + ((now * (phaseId === 'event' ? 420 : 160) + i * 97) % (Math.max(w, h) * 0.8));
      const len = phaseId === 'event' ? 120 : 60;
      ctx.strokeStyle = phaseId === 'event'
        ? `rgba(255, 90, 120, ${0.06 + (i % 3) * 0.02})`
        : `rgba(140, 240, 255, ${0.04 + (i % 3) * 0.015})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len));
      ctx.stroke();
    }
    // Storm / damage rings.
    if (phaseId === 'event') {
      const pulse = (now * 80) % 360;
      ctx.strokeStyle = `rgba(255, 70, 90, ${0.12 + 0.06 * Math.sin(now * 7)})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.arc(cx, cy, 80 + pulse + i * 120, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // Destination planet approaching (fall phase).
    if (phaseId === 'fall') {
      const grow = clamp01((t - startTime - PHASES[0].duration - PHASES[1].duration) / PHASES[2].duration);
      const radius = 18 + grow * Math.min(w, h) * 0.42;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, 'rgba(120, 210, 255, 0.5)');
      grad.addColorStop(0.7, 'rgba(40, 130, 220, 0.18)');
      grad.addColorStop(1, 'rgba(20, 60, 120, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // The ship itself: burning away from the old world, drifting damaged, then
    // falling toward the new one. Five tetrahedra, same silhouette as the intro.
    const phaseIndex = PHASES.findIndex((phase) => phase.id === phaseId);
    const phaseStart = startTime + PHASES.slice(0, Math.max(0, phaseIndex)).reduce((sum, phase) => sum + phase.duration, 0);
    const phase = PHASES[Math.max(0, phaseIndex)] || PHASES[0];
    const k = clamp01((t - phaseStart) / Math.max(1, phase.duration));
    let shipX = cx;
    let shipY = cy;
    let shipScale = 1.15;
    let shipYaw = now * 0.8;
    if (phaseId === 'launch') {
      shipX = cx + Math.sin(now * 0.5) * 12;
      shipY = cy + 56 - k * 130;
      shipScale = 1.1 + k * 0.35;
    } else if (phaseId === 'event') {
      shipX = cx + Math.sin(now * 2.4) * 44 - 12;
      shipY = cy + 10 + Math.sin(now * 1.7) * 24;
      shipScale = 1.05;
      shipYaw += 1.6 + Math.sin(now * 4) * 0.5;
    } else {
      shipX = cx - 78 + k * 40;
      shipY = cy - 150 + k * 210;
      shipScale = 0.8 + k * 0.8;
      shipYaw += 3.1;
    }
    drawTetraShip(ctx, {
      x: shipX,
      y: shipY,
      scale: shipScale * Math.min(w, h) / 900,
      yaw: shipYaw,
      pitch: -0.3 + Math.sin(now * 0.8) * 0.1,
      roll: phaseId === 'event' ? Math.sin(now * 2.2) * 0.6 : 0.12,
      hull: phaseId === 'event' ? '#ffd9c8' : '#e8fbff',
      fin: phaseId === 'event' ? '#ff8d72' : '#52d9ff',
      edge: phaseId === 'event' ? '#ffb38e' : '#bffaff',
      glow: phaseId === 'event' ? '#ff704f' : '#55eaff',
      alpha: phaseId === 'fall' ? 0.58 + k * 0.3 : 0.9,
    });
    ctx.restore();
  }

  function currentPhase() {
    const elapsed = performance.now() - startTime;
    let acc = 0;
    for (const phase of PHASES) {
      acc += phase.duration;
      if (elapsed < acc) return phase;
    }
    return PHASES[PHASES.length - 1];
  }

  function paint() {
    if (!active) return;
    const now = performance.now();
    const elapsed = now - startTime;
    let acc = 0;
    let phase = PHASES[PHASES.length - 1];
    for (const candidate of PHASES) {
      acc += candidate.duration;
      if (elapsed < acc) {
        phase = candidate;
        break;
      }
    }
    const total = PHASES.reduce((sum, p) => sum + p.duration, 0);
    setProgress(elapsed / total);
    if (els['interlude-overlay'] && els['interlude-overlay'].dataset.phase !== phase.id) {
      for (const p of PHASES) els['interlude-overlay'].classList.remove(p.className);
      els['interlude-overlay'].classList.add(phase.className);
      els['interlude-overlay'].dataset.phase = phase.id;
      setText('interlude-status', phase.status);
      if (phase.id === 'event') {
        setText('interlude-title', story ? story.title : 'SPACE STORM');
        setText('interlude-sub', story ? story.subtitle || phase.sub : phase.sub);
        renderStory();
        safeAudio('introAlarm');
      } else if (phase.id === 'fall') {
        setText('interlude-title', toInfo ? `LANDING ON ${toInfo.name}` : 'EMERGENCY LANDING');
        setText('interlude-sub', toInfo ? `PLANET ${toInfo.name} // DEPTH ${toInfo.depth}` : phase.sub);
        safeAudio('introReveal');
      } else {
        setText('interlude-title', 'ESCAPE BURN');
        setText('interlude-sub', fromInfo ? `LEAVING ${fromInfo.name}` : phase.sub);
        safeAudio('introWhoosh');
      }
      if (phase.id === 'event' && document.body) {
        document.body.classList.add('is-shaking');
        shake = 1600;
      }
    }
    if (document.body) {
      if (shake > 0) {
        shake -= 16;
        if (shake < 0) shake = 0;
        document.body.classList.toggle('is-shaking', shake > 0);
      }
    }
    draw(now);
    if (elapsed >= total + holdMs + 120) {
      finish();
      return;
    }
    raf = requestAnimationFrame(paint);
  }

  function finish() {
    if (!active) return;
    active = false;
    cancelAnimationFrame(raf);
    setOverlay(false);
    if (document.body) {
      document.body.classList.remove('is-shaking', 'is-interlude');
    }
    if (ctx && canvas) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    if (els['interlude-overlay']) delete els['interlude-overlay'].dataset.phase;
    const callback = onComplete;
    onComplete = null;
    if (typeof callback === 'function') callback();
  }

  function startEscape({ story: nextStory, from, to, planetName, planetDepth, holdMs: nextHold = 0 }, done) {
    holdMs = Math.max(0, Math.min(15000, Math.trunc(Number(nextHold) || 0)));
    collect();
    fromInfo = from || null;
    toInfo = to
      ? { name: to.name || planetName || 'NEXT PLANET', depth: to.depth || planetDepth || 3 }
      : { name: planetName || 'NEXT PLANET', depth: planetDepth || 3 };
    story = nextStory || { title: 'SPACE STORM', lines: ['Hull integrity failing.'] };
    onComplete = done;
    active = true;
    startTime = performance.now();
    setOverlay(true);
    setProgress(0);
    setText('interlude-planet', `TRANSIT // ${toInfo.name}`);
    renderStory();
    if (els['interlude-overlay']) {
      els['interlude-overlay'].dataset.phase = '';
      for (const p of PHASES) els['interlude-overlay'].classList.remove(p.className);
    }
    resizeCanvas(canvas, ctx);
    safeAudio('introWhoosh');
    if (prefersReducedMotion()) {
      // Short, calm version; still tells the story.
      setText('interlude-title', story.title || 'SPACE STORM');
      setText('interlude-sub', story.subtitle || 'EMERGENCY TRANSIT');
      renderStory();
      setTimeout(finish, 1800);
      return;
    }
    raf = requestAnimationFrame(paint);
  }

  // ------------------------------------------------------- incident FX (EVT-02)

  /** The shared five-tetra ship posed for one incident role. */
  function shipPose(t, role, w, h) {
    const base = Math.min(w, h) / 900;
    if (role === 'alpha') {
      return {
        x: w / 2 - Math.min(w, h) * 0.22 + Math.sin(t * 1.2) * 26,
        y: h / 2 - Math.min(w, h) * 0.3 + Math.sin(t * 0.9) * 12,
        scale: base * 1.35,
        yaw: 0.7 + t * 0.5,
        pitch: -0.4,
        roll: 0.25 + Math.sin(t) * 0.2,
        hull: '#b6ffd2',
        fin: '#42ff9d',
        edge: '#c8ffe0',
        glow: '#5cffb3',
        alpha: 0.92,
      };
    }
    if (role === 'beta') {
      return {
        x: w / 2 + Math.min(w, h) * 0.22 - Math.sin(t * 1.2 + 1.7) * 26,
        y: h / 2 - Math.min(w, h) * 0.3 + Math.sin(t * 0.9 + 1) * 12,
        scale: base * 1.15,
        yaw: 0.7 + t * 0.5 + 1,
        pitch: -0.4,
        roll: 0.25 + Math.sin(t + 1) * 0.2,
        hull: '#b6ffd2',
        fin: '#42ff9d',
        edge: '#c8ffe0',
        glow: '#5cffb3',
        alpha: 0.92,
      };
    }
    // relief: our own ship fleeing the impact.
    return {
      x: w / 2 - Math.min(w, h) * 0.16 + t * 34,
      y: h / 2 + Math.min(w, h) * 0.23 - t * 16,
      scale: base * 1.25,
      yaw: 0.8 + t * 0.9,
      pitch: -0.35,
      roll: 0.25,
      hull: '#fff1d0',
      fin: '#ff9e4a',
      edge: '#ffe0a0',
      glow: '#ffd36b',
      alpha: 0.95,
    };
  }

  /**
   * Static per-kind backdrop, painted once per size/DPR into an offscreen canvas
   * and blitted each frame. This keeps the full-screen gradient off the hot path
   * so the FX loop stays well above the 30-frame acceptance floor.
   */
  function backgroundFor(kind, w, h, dpr) {
    const key = `${kind}:${w}x${h}@${dpr}`;
    if (incidentBackgrounds.has(key)) return incidentBackgrounds.get(key);
    if (typeof document === 'undefined') return null;
    const bg = document.createElement('canvas');
    bg.width = Math.max(1, Math.round(w * dpr));
    bg.height = Math.max(1, Math.round(h * dpr));
    const g = bg.getContext('2d');
    if (!g) return null;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = w / 2;
    const cy = h / 2;
    const rad = Math.max(w, h) * 0.72;
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
    if (kind === 'nuclear') {
      grad.addColorStop(0, 'rgba(255, 120, 30, 0.42)');
      grad.addColorStop(0.5, 'rgba(150, 30, 20, 0.18)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    } else if (kind === 'solar') {
      grad.addColorStop(0, 'rgba(255, 236, 150, 0.4)');
      grad.addColorStop(0.55, 'rgba(255, 176, 48, 0.16)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    } else if (kind === 'alien') {
      grad.addColorStop(0, 'rgba(90, 255, 170, 0.28)');
      grad.addColorStop(0.55, 'rgba(120, 60, 220, 0.14)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    } else {
      grad.addColorStop(0, 'rgba(255, 92, 60, 0.34)');
      grad.addColorStop(0.55, 'rgba(120, 30, 20, 0.14)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    }
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    incidentBackgrounds.set(key, bg);
    if (incidentBackgrounds.size > 8) incidentBackgrounds.delete(incidentBackgrounds.keys().next().value);
    return bg;
  }

  function paintMeteor(t, w, h, k) {
    const cx = w / 2;
    const cy = h / 2;
    const shards = 18;
    for (let i = 0; i < shards; i += 1) {
      const a = (i / shards) * Math.PI * 2;
      const r0 = 24 + k * 90 + (i % 4) * 12;
      const r1 = r0 + 26 + k * 70;
      const spread = 0.06 + (i % 3) * 0.025;
      meteorCtx.fillStyle = `rgba(255,${170 - (i % 4) * 20},70,${0.3 * (1 - k * 0.4)})`;
      meteorCtx.beginPath();
      meteorCtx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      meteorCtx.lineTo(cx + Math.cos(a - spread) * r1, cy + Math.sin(a - spread) * r1);
      meteorCtx.lineTo(cx + Math.cos(a + spread) * r1, cy + Math.sin(a + spread) * r1);
      meteorCtx.closePath();
      meteorCtx.fill();
    }
    // One relief ship flees the crater (meteor ships signature = 1).
    drawTetraShip(meteorCtx, shipPose(t, 'relief', w, h));
  }

  function paintNuclear(t, w, h, k) {
    const cx = w / 2;
    const cy = h / 2;
    // First-frame luminance > 0.6 signature: a full white flash.
    if (t < 0.2) {
      meteorCtx.fillStyle = `rgba(255,255,240,${(0.9 * (1 - t / 0.2)).toFixed(3)})`;
      meteorCtx.fillRect(0, 0, w, h);
    }
    for (let i = 0; i < 4; i += 1) {
      const rr = 40 + (k * 0.9 + i * 0.08) * Math.max(w, h) * 0.65;
      meteorCtx.strokeStyle = `rgba(255,${140 - i * 20},${45 - i * 8},${0.4 * (1 - k)})`;
      meteorCtx.lineWidth = 8 - i * 1.5;
      meteorCtx.beginPath();
      meteorCtx.arc(cx, cy, Math.max(1, rr), 0, Math.PI * 2);
      meteorCtx.stroke();
    }
    for (let i = 0; i < 7; i += 1) {
      const x = cx + (i - 3) * 62 + Math.sin(t * 2 + i) * 7;
      const rise = Math.min(1, t / 1.8) * (160 + (i % 3) * 80);
      const grad = meteorCtx.createLinearGradient(x, cy, x, cy - rise);
      grad.addColorStop(0, 'rgba(255,210,110,0.45)');
      grad.addColorStop(0.55, 'rgba(255,80,35,0.24)');
      grad.addColorStop(1, 'rgba(90,20,10,0)');
      meteorCtx.fillStyle = grad;
      meteorCtx.beginPath();
      meteorCtx.moveTo(x - 22, cy);
      meteorCtx.lineTo(x + 22, cy);
      meteorCtx.lineTo(x, cy - rise);
      meteorCtx.closePath();
      meteorCtx.fill();
    }
  }

  function paintSolar(t, w, h, k) {
    const cx = w / 2;
    const cy = h / 2;
    const sunX = cx + Math.min(w, h) * 0.31;
    const sunY = cy - Math.min(w, h) * 0.24;
    const sunR = Math.min(w, h) * (0.085 + k * 0.015);
    const facets = 18;
    for (let i = 0; i < facets; i += 1) {
      const a0 = (i / facets) * Math.PI * 2;
      const a1 = ((i + 1) / facets) * Math.PI * 2;
      meteorCtx.fillStyle = i % 2
        ? `rgba(255,232,120,${0.9 * (1 - k * 0.2)})`
        : `rgba(255,176,48,${0.84 * (1 - k * 0.25)})`;
      meteorCtx.beginPath();
      meteorCtx.moveTo(sunX, sunY);
      meteorCtx.lineTo(sunX + Math.cos(a0) * sunR, sunY + Math.sin(a0) * sunR);
      meteorCtx.lineTo(sunX + Math.cos(a1) * sunR, sunY + Math.sin(a1) * sunR);
      meteorCtx.closePath();
      meteorCtx.fill();
    }
    // Signature: 48 triangular corona rays, no ship.
    const rays = 48;
    for (let i = 0; i < rays; i += 1) {
      const ang = (i / rays) * Math.PI * 2 + t * 0.13;
      const rIn = sunR * 1.12;
      const rOut = sunR * (1.7 + ((i * 7) % 5) * 0.18 + Math.sin(t * 1.8 + i) * 0.14);
      const half = 0.022 + (i % 3) * 0.01;
      meteorCtx.fillStyle = `rgba(255,${205 - (i % 4) * 22},95,${0.3 * (1 - k * 0.5)})`;
      meteorCtx.beginPath();
      meteorCtx.moveTo(sunX + Math.cos(ang - half) * rIn, sunY + Math.sin(ang - half) * rIn);
      meteorCtx.lineTo(sunX + Math.cos(ang) * rOut, sunY + Math.sin(ang) * rOut);
      meteorCtx.lineTo(sunX + Math.cos(ang + half) * rIn, sunY + Math.sin(ang + half) * rIn);
      meteorCtx.closePath();
      meteorCtx.fill();
    }
  }

  function paintAlien(t, w, h, k) {
    const cx = w / 2;
    for (let i = 0; i < 4; i += 1) {
      const bx = cx + (i - 1.5) * Math.min(w, h) * 0.22;
      const beamW = 34 + (i % 2) * 18;
      meteorCtx.fillStyle = `rgba(90,255,165,${0.16 * (1 - k)})`;
      meteorCtx.beginPath();
      meteorCtx.moveTo(bx, 0);
      meteorCtx.lineTo(bx + beamW, h);
      meteorCtx.lineTo(bx - beamW, h);
      meteorCtx.closePath();
      meteorCtx.fill();
    }
    // Signature: two five-tetra alien ships (alpha + beta).
    drawTetraShip(meteorCtx, shipPose(t, 'alpha', w, h));
    drawTetraShip(meteorCtx, shipPose(t, 'beta', w, h));
  }

  /** Paint one complete incident frame at animation time `elapsedMs`. */
  function paintIncidentFrame(elapsedMs) {
    if (!meteorCtx || !meteorCanvas) return null;
    const { width: w, height: h, dpr } = resizeCanvas(meteorCanvas, meteorCtx);
    incidentFxStats.dpr = dpr;
    const t = elapsedMs / 1000;
    const k = clamp01(elapsedMs / INCIDENT_FX_MS);
    meteorCtx.clearRect(0, 0, w, h);
    meteorCtx.save();
    const bg = backgroundFor(incidentKind, w, h, dpr);
    if (bg) meteorCtx.drawImage(bg, 0, 0, w, h);
    meteorCtx.globalCompositeOperation = 'lighter';
    if (incidentKind === 'nuclear') paintNuclear(t, w, h, k);
    else if (incidentKind === 'solar') paintSolar(t, w, h, k);
    else if (incidentKind === 'alien') paintAlien(t, w, h, k);
    else paintMeteor(t, w, h, k);
    meteorCtx.restore();
    if (!incidentFirstFrameMeasured) {
      incidentFirstFrameMeasured = true;
      incidentFxStats.firstFrameLuminance = sampleLuminance();
    }
    return { w, h };
  }

  /**
   * Measured coverage: fraction of sampled device pixels with alpha > 8.
   * Samples every 40th pixel so a frame is cheap enough to run periodically.
   */
  function sampleCoverage() {
    if (!meteorCtx || !meteorCanvas) return 0;
    const width = Math.max(1, meteorCanvas.width);
    const height = Math.max(1, meteorCanvas.height);
    try {
      const data = meteorCtx.getImageData(0, 0, width, height).data;
      let sampled = 0;
      let painted = 0;
      for (let i = 3; i < data.length; i += COVERAGE_PIXEL_STRIDE) {
        sampled += 1;
        if (data[i] > COVERAGE_ALPHA_FLOOR) painted += 1;
      }
      return sampled ? painted / sampled : 0;
    } catch {
      return 0;
    }
  }

  function measureFrame() {
    incidentFxStats.coverage = Math.round(sampleCoverage() * 10000) / 10000;
    incidentFxStats.blank = incidentFxStats.coverage < MIN_COVERAGE;
  }

  /** Average sampled luminance (0..1) of the first painted frame. */
  function sampleLuminance() {
    if (!meteorCtx || !meteorCanvas) return 0;
    try {
      const data = meteorCtx.getImageData(0, 0, Math.max(1, meteorCanvas.width), Math.max(1, meteorCanvas.height)).data;
      let sampled = 0;
      let sum = 0;
      for (let i = 0; i < data.length; i += COVERAGE_PIXEL_STRIDE) {
        if (data[i + 3] <= COVERAGE_ALPHA_FLOOR) {
          sampled += 1;
          continue;
        }
        sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
        sampled += 1;
      }
      return sampled ? Math.round((sum / sampled) * 10000) / 10000 : 0;
    } catch {
      return 0;
    }
  }

  function drawIncident() {
    if (!meteorActive) return;
    const elapsed = performance.now() - meteorStart;
    paintIncidentFrame(elapsed);
    incidentFxStats.frames += 1;
    // Sampling is a read-back; do it every tenth frame plus the last one.
    if (incidentFxStats.frames % 10 === 1) measureFrame();
    if (elapsed >= INCIDENT_FX_MS) {
      measureFrame();
      meteorActive = false;
      meteorRaf = 0;
      return; // hold the last frame until the dwell timer closes the overlay
    }
    meteorRaf = requestAnimationFrame(drawIncident);
  }

  function clearIncidentCanvas() {
    if (!meteorCanvas) return;
    if (meteorCtx) {
      meteorCtx.save();
      meteorCtx.setTransform(1, 0, 0, 1, 0, 0);
      meteorCtx.clearRect(0, 0, meteorCanvas.width, meteorCanvas.height);
      meteorCtx.restore();
    }
  }

  function focusIncidentReturnTarget() {
    if (typeof document === 'undefined') return;
    const active = document.activeElement;
    const overlay = els['meteor-overlay'];
    const movedIntoOverlay = !!(overlay && active && overlay.contains(active));
    if (!movedIntoOverlay) {
      incidentFocusBefore = null;
      return;
    }
    const previous =
      incidentFocusBefore &&
      document.contains(incidentFocusBefore) &&
      incidentFocusBefore !== document.body &&
      incidentFocusBefore !== document.documentElement
        ? incidentFocusBefore
        : null;
    const target = previous || els['arena-canvas'] || document.body;
    if (active && typeof active.blur === 'function') {
      try {
        active.blur();
      } catch {
        /* ignore */
      }
    }
    if (target && typeof target.focus === 'function') {
      try {
        target.focus({ preventScroll: true });
      } catch {
        try {
          target.focus();
        } catch {
          /* focus is best-effort */
        }
      }
    }
    incidentFocusBefore = null;
  }

  function closeIncident() {
    if (!incidentOpen) return;
    incidentOpen = false;
    meteorActive = false;
    incidentFxStats.open = false;
    cancelAnimationFrame(meteorRaf);
    meteorRaf = 0;
    if (incidentDwellTimer) clearTimeout(incidentDwellTimer);
    incidentDwellTimer = 0;
    setMeteor(false);
    if (document.body) {
      document.body.classList.remove('is-shaking');
      document.body.classList.remove('is-meteor');
    }
    clearIncidentCanvas();
    focusIncidentReturnTarget();
    return true;
  }

  function scheduleIncidentClose(ms) {
    if (incidentDwellTimer) clearTimeout(incidentDwellTimer);
    incidentDwellMs = Math.max(0, Math.trunc(ms) || INCIDENT_DWELL_MS);
    incidentFxStats.dwellMs = incidentDwellMs;
    incidentDwellTimer = setTimeout(() => {
      incidentDwellTimer = 0;
      closeIncident();
    }, incidentDwellMs);
    incidentDwellTimer.unref?.();
  }

  function bindIncidentControls() {
    if (incidentControlsBound) return;
    incidentControlsBound = true;
    if (typeof document === 'undefined') return;
    if (els['meteor-dismiss']) {
      els['meteor-dismiss'].addEventListener('click', () => closeIncident());
    }
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Escape' || !incidentOpen) return;
        event.preventDefault();
        event.stopPropagation();
        closeIncident();
      },
      true,
    );
  }

  /**
   * Open the incident overlay for one kind. Returns the message (kept for the
   * legacy `meteor()` contract) and leaves measurement in `incidentFxStats()`.
   *
   * @param {string} kind
   * @param {string} title
   * @param {string} message
   * @param {string} description
   * @param {{dwellMs?:number}} [options]
   */
  function incident(kind = 'meteor', title = 'PLANETARY EVENT', message = 'PLANET RESET', description = '', options = {}) {
    collect();
    bindIncidentControls();
    // A second incident replaces the first; never double-open.
    if (incidentOpen) closeIncident();
    incidentKind = INCIDENT_KINDS.includes(kind) ? kind : 'meteor';
    meteorTitle = String(title || incidentKind.toUpperCase());
    incidentDescription = String(description || '');
    meteorMessage = String(message || '');
    const reduced = prefersReducedMotionNow();
    const dwellMs = Number.isFinite(options.dwellMs)
      ? Math.max(0, Math.trunc(options.dwellMs))
      : reduced
        ? INCIDENT_DWELL_REDUCED_MS
        : INCIDENT_DWELL_MS;
    incidentOpen = true;
    meteorActive = true;
    meteorStart = performance.now();
    incidentFocusBefore = typeof document !== 'undefined' ? document.activeElement : null;
    incidentFirstFrameMeasured = false;
    Object.assign(incidentFxStats, {
      kind: incidentKind,
      frames: 0,
      coverage: 0,
      dpr: maxDpr(),
      reducedMotion: reduced,
      ships: INCIDENT_SHIP_COUNTS[incidentKind],
      blank: true,
      poster: false,
      open: true,
      dwellMs,
      firstFrameLuminance: 0,
    });
    const overlay = els['meteor-overlay'];
    const fx = els['meteor-fx'];
    if (fx && fx.getContext) {
      meteorCanvas = fx;
      meteorCtx = fx.getContext('2d', { willReadFrequently: true });
    }
    if (overlay) {
      overlay.className = `meteor-overlay incident-${incidentKind}`;
      overlay.hidden = false;
      overlay.classList.add('is-active');
      overlay.setAttribute('aria-hidden', 'false');
    }
    if (document.body) {
      document.body.className = document.body.className.replace(/\bincident-\w+/g, '').trim();
      document.body.classList.add('is-meteor', `incident-${incidentKind}`);
      // Reduced motion: no shake class at all (EVT-03).
      if (!reduced) document.body.classList.add('is-shaking');
    }
    setText('meteor-title', meteorTitle);
    setText('meteor-sub', meteorMessage);
    setText('meteor-description', incidentDescription);
    if (reduced) {
      // One static poster frame, no animation loop, no shake.
      paintIncidentFrame(POSTER_FRAME_MS);
      incidentFxStats.frames = 1;
      incidentFxStats.poster = true;
      measureFrame();
      safeAudio('introAlarm');
      scheduleIncidentClose(dwellMs);
      return meteorMessage;
    }
    resizeCanvas(meteorCanvas, meteorCtx);
    cancelAnimationFrame(meteorRaf);
    meteorRaf = requestAnimationFrame(drawIncident);
    setTimeout(() => {
      if (document.body && incidentOpen) document.body.classList.remove('is-shaking');
    }, 1300);
    scheduleIncidentClose(dwellMs);
    safeAudio('introAlarm');
    return meteorMessage;
  }

  function meteor(message = 'METEOR IMPACT // PLANET RESET') {
    return incident('meteor', 'METEOR IMPACT', message);
  }

  function resize() {
    resizeCanvas(canvas, ctx);
    resizeCanvas(meteorCanvas, meteorCtx);
  }

  if (typeof window !== 'undefined') window.addEventListener('resize', resize);

  /** EVT-02 debug/acceptance surface: counts and ratios only, no game state. */
  function incidentFxStatsReport() {
    return {
      kind: incidentFxStats.kind,
      frames: incidentFxStats.frames,
      coverage: incidentFxStats.coverage,
      dpr: incidentFxStats.dpr,
      reducedMotion: incidentFxStats.reducedMotion,
      ships: incidentFxStats.ships,
      blank: incidentFxStats.blank,
      poster: incidentFxStats.poster,
      open: incidentFxStats.open,
      firstFrameLuminance: incidentFxStats.firstFrameLuminance,
      dwellMs: incidentFxStats.dwellMs,
      minCoverage: MIN_COVERAGE,
      posterFrameMs: POSTER_FRAME_MS,
      minFrames: FULL_MOTION_FRAMES,
    };
  }

  return {
    get active() {
      return active;
    },
    get storm() {
      return active && currentPhase().id === 'event';
    },
    get incidentOpen() {
      return incidentOpen;
    },
    state: () => ({ active, phase: active ? currentPhase().id : 'idle', story: story ? story.id : null }),
    startEscape,
    meteor,
    incident,
    incidentFxStats: incidentFxStatsReport,
    dismissIncident: () => closeIncident(),
    finish,
    resize,
  };
}
