/**
 * NARIMATO — cinematic intro controller.
 *
 * The renderer keeps drawing the actual planet. This controller frames it as a
 * cockpit view: the planet is tiny and far away, the camera is pulled in by
 * gravity, the cockpit frame fades, and the normal game is revealed. All visuals
 * are DOM/CSS + one small 2D canvas — no external assets.
 *
 * Wiring (app.js): createIntro({...}); intro.shouldPlay(); intro.start(); call
 * intro.update(now, dt) from the render loop; intro.skip() / intro.replay().
 */

import { drawTetraShip } from './shared/tetra-ship.js';

const INTRO_SEEN_KEY = 'icosa.introSeen';
const INTRO_START = { yaw: 1.18, pitch: 0.34, zoom: 0.16 };
const INTRO_END = { yaw: 0.55, pitch: 0.27, zoom: 1 };
const PHASE_ORDER = ['wormhole', 'drift', 'descent'];
const PHASE_COPY = {
  wormhole: {
    label: 'WORMHOLE EXIT // YEAR 2189',
    main: 'WORMHOLE EXIT',
    sub: 'HULL STRESS CRITICAL // UNKNOWN SYSTEM',
  },
  drift: {
    label: 'GRAVITY WELL',
    main: 'GRAVITY LOCK',
    sub: 'THRUSTERS UNRESPONSIVE // WASD / ARROWS / DRAG TO STEER',
  },
  descent: {
    label: 'ATMOSPHERIC CAPTURE',
    main: 'PLANETARY CAPTURE',
    sub: 'FALLING INTO THE GRAVITY WELL // COCKPIT FRAME FAILING',
  },
  complete: {
    label: 'SURFACE CONTACT',
    main: 'FUEL EMPTY',
    sub: 'GRAVITY CAPTURE // MINE REQUIRED ORES TO REBUILD THE DRIVE',
  },
};

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createIntro({
  camera,
  ui,
  safeCall,
  safeAudio,
  onComplete,
  onStart,
  onPhase,
  planetName,
} = {}) {
  const params = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();
  const els = {};
  let canvas = null;
  let ctx = null;
  let active = false;
  let seen = readSeen();
  let phase = 'idle';
  let startTime = 0;
  let elapsed = 0;
  let durationScale = 1;
  let starts = null;
  let descentFrom = null;
  let finished = false;
  let wasLandingHidden = false;
  let lastDraw = 0;
  let replaying = false;
  const steer = { x: 0, y: 0, keys: new Set() };
  const pointerPads = new Map();
  let bound = false;

  function readSeen() {
    try {
      return localStorage.getItem(INTRO_SEEN_KEY) === '1';
    } catch {
      return false;
    }
  }

  function writeSeen() {
    seen = true;
    try {
      localStorage.setItem(INTRO_SEEN_KEY, '1');
    } catch {
      /* private mode */
    }
  }

  function collectEls() {
    for (const id of [
      'intro-overlay', 'intro-fx', 'intro-status', 'intro-sub', 'intro-phase',
      'intro-bar', 'btn-skip-intro', 'intro-steer',
      'steer-left', 'steer-right', 'steer-up', 'steer-down',
      'btn-replay-intro', 'join-overlay', 'hud',
    ]) {
      els[id] = document.getElementById(id);
    }
    canvas = els['intro-fx'];
    if (canvas && canvas.getContext) {
      ctx = canvas.getContext('2d');
    }
  }

  function resize() {
    if (!canvas) return;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(window.innerWidth * dpr));
    canvas.height = Math.max(1, Math.round(window.innerHeight * dpr));
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function shouldPlay() {
    // The cockpit sequence is the game's launch/loading cine every time the
    // client boots. It is always skippable; only share-report pages or an
    // explicit ?intro=0 (QA/debug) suppress it.
    if (params.get('report')) return false;
    if (params.get('intro') === '0') return false;
    return true;
  }

  function setStatus(main, sub, phaseLabel) {
    if (!els['intro-overlay']) return;
    if (els['intro-status']) els['intro-status'].textContent = main;
    if (els['intro-sub']) els['intro-sub'].textContent = sub;
    if (els['intro-phase']) els['intro-phase'].textContent = phaseLabel;
    els['intro-overlay'].classList.add(`is-${phase}`);
  }

  function setProgress(value) {
    const pct = clamp01(value) * 100;
    if (els['intro-bar']) els['intro-bar'].style.width = `${pct}%`;
    if (ui && typeof ui.setIntroProgress === 'function') safeCall(ui, 'setIntroProgress', pct);
  }

  function setDescent(value) {
    if (!els['intro-overlay']) return;
    els['intro-overlay'].style.setProperty('--intro-descent', String(clamp01(value)));
    if (value > 0.05) els['intro-overlay'].classList.add('is-descending');
    else els['intro-overlay'].classList.remove('is-descending');
  }

  function bindInput() {
    if (bound) return;
    bound = true;
    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', resize);
    if (els['btn-skip-intro']) {
      els['btn-skip-intro'].addEventListener('click', (event) => {
        event.preventDefault();
        skip();
      });
    }
    for (const [id, dx, dy] of [
      ['steer-left', -1, 0], ['steer-right', 1, 0],
      ['steer-up', 0, -1], ['steer-down', 0, 1],
    ]) {
      const el = els[id];
      if (!el) continue;
      el.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        pointerPads.set(id, { dx, dy });
      });
      for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
        el.addEventListener(type, () => pointerPads.delete(id));
      }
    }
  }

  function onKeyDown(event) {
    if (!active) return;
    const key = String(event.key || '').toLowerCase();
    if (key === 'escape') {
      event.preventDefault();
      skip();
      return;
    }
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd'].includes(key)) {
      event.preventDefault();
      steer.keys.add(key);
    }
  }

  function onKeyUp(event) {
    steer.keys.delete(String(event.key || '').toLowerCase());
  }

  function readSteer() {
    let x = 0;
    let y = 0;
    if (steer.keys.has('arrowleft') || steer.keys.has('a')) x -= 1;
    if (steer.keys.has('arrowright') || steer.keys.has('d')) x += 1;
    if (steer.keys.has('arrowup') || steer.keys.has('w')) y -= 1;
    if (steer.keys.has('arrowdown') || steer.keys.has('s')) y += 1;
    for (const pad of pointerPads.values()) {
      x += pad.dx;
      y += pad.dy;
    }
    return { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
  }

  function drawFx(t, kind, intensity) {
    if (!ctx || !canvas) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    if (prefersReducedMotion()) return;
    const cx = w / 2;
    const cy = h / 2;
    const now = t / 1000;
    if (kind === 'wormhole') {
      const fade = 1 - clamp01(elapsed / 2100);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 46; i += 1) {
        const a = (i / 46) * Math.PI * 2 + now * 0.5;
        const r0 = 28 + (i % 9) * 13 + Math.sin(now * 2 + i) * 12;
        const r1 = r0 + 140 + (i % 5) * 60;
        ctx.strokeStyle = `rgba(${120 + (i % 4) * 25}, ${60 + (i % 6) * 22}, 255, ${0.1 * fade})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.stroke();
      }
      // Wormhole iris.
      const iris = (now * 90) % 280;
      ctx.strokeStyle = `rgba(0, 240, 255, ${0.3 * fade})`;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.arc(cx, cy, 24 + iris + i * 64, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      // Gravity/descent speed streaks radiating out from the planet.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const count = kind === 'descent' ? 42 : 16;
      for (let i = 0; i < count; i += 1) {
        const seedAngle = (i / count) * Math.PI * 2 + (i % 7) * 0.21;
        const r0 = 60 + ((now * (kind === 'descent' ? 260 : 26) + i * 73) % (Math.max(w, h) * 0.7));
        const a = seedAngle + Math.sin(now * 0.4 + i) * 0.02;
        const r1 = r0 + (kind === 'descent' ? 160 : 46) * intensity;
        ctx.strokeStyle = `rgba(120, 245, 255, ${(kind === 'descent' ? 0.06 : 0.05) * intensity})`;
        ctx.lineWidth = kind === 'descent' ? 1.6 : 1;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Our five-tetrahedron ship arrives out of the wormhole and settles into
    // orbit. It is the same ship used for transit and relief drops.
    if (kind === 'wormhole' || kind === 'drift') {
      const arrive = clamp01(elapsed / (kind === 'wormhole' ? 1800 : 2600));
      const scale = kind === 'wormhole' ? 1.05 + arrive * 1.1 : 1.8;
      drawTetraShip(ctx, {
        x: cx + Math.sin(now * 0.7) * (1 - arrive) * 26,
        y: cy + 66 - arrive * 38,
        scale,
        yaw: 0.55 + now * 0.6,
        pitch: -0.28 + Math.sin(now * 0.5) * 0.08,
        roll: Math.sin(now * 0.4) * 0.22,
        hull: '#e8fbff',
        fin: '#52d9ff',
        edge: '#bffaff',
        glow: '#55eaff',
        alpha: kind === 'wormhole' ? 0.65 + arrive * 0.35 : 0.9,
      });
    }
  }

  function goPhase(next) {
    phase = next;
    const copy = { ...PHASE_COPY[next] };
    const planet = typeof planetName === 'string' && planetName.trim() ? planetName.trim().toUpperCase() : 'UNKNOWN WORLD';
    if (next === 'drift') copy.label = `GRAVITY WELL // ${planet}`;
    if (next === 'descent') copy.sub = `FALLING INTO ${planet} // COCKPIT FRAME FAILING`;
    if (copy) setStatus(copy.main, copy.sub, copy.label);
    if (ui && typeof ui.setIntroPhase === 'function') safeCall(ui, 'setIntroPhase', next);
    if (next === 'wormhole') safeAudio('introWhoosh');
    else if (next === 'drift') safeAudio('introAlarm');
    else if (next === 'descent') safeAudio('introReveal');
    if (typeof onPhase === 'function') {
      try {
        onPhase(next, copy);
      } catch {
        /* narration is best-effort */
      }
    }
  }

  function durations() {
    const reduced = prefersReducedMotion();
    return reduced
      ? { wormhole: 600, drift: 900, descent: 1200 }
      : { wormhole: 2100, drift: 4200, descent: 3000 };
  }

  function start({ replay = false } = {}) {
    collectEls();
    if (!els['intro-overlay']) {
      // UI not available yet: never trap the player.
      return false;
    }
    if (active) return true;
    replaying = replay;
    active = true;
    finished = false;
    durationScale = prefersReducedMotion() ? 0.35 : 1;
    phase = 'wormhole';
    startTime = performance.now();
    elapsed = 0;
    descentFrom = null;
    starts = { ...INTRO_START };
    steer.keys.clear();
    pointerPads.clear();
    els['intro-overlay'].hidden = false;
    els['intro-overlay'].classList.remove('is-hidden', 'is-descending');
    els['intro-overlay'].classList.add('is-active', 'is-wormhole');
    document.body.classList.add('intro-active');
    safeCall(ui, 'showIntro', true);
    if (els['btn-skip-intro']) els['btn-skip-intro'].hidden = false;
    if (els['join-overlay']) {
      wasLandingHidden = els['join-overlay'].hidden === false || !els['join-overlay'].classList.contains('is-hidden');
      safeCall(ui, 'hideLanding');
    }
    camera.zoom = starts.zoom;
    camera.yaw = starts.yaw;
    camera.pitch = starts.pitch;
    setProgress(0);
    setDescent(0);
    bindInput();
    resize();
    goPhase('wormhole');
    safeCall(ui, 'setInputLocked', true);
    if (typeof onStart === 'function') onStart({ replay });
    return true;
  }

  function finish(skipped = false) {
    if (!active || finished) return;
    finished = true;
    active = false;
    writeSeen();
    if (els['intro-overlay']) {
      els['intro-overlay'].classList.add('is-hidden');
      els['intro-overlay'].hidden = true;
      els['intro-overlay'].classList.remove('is-active', 'is-descending');
    }
    document.body.classList.remove('intro-active');
    safeCall(ui, 'showIntro', false);
    setDescent(0);
    camera.zoom = INTRO_END.zoom;
    camera.yaw = INTRO_END.yaw;
    camera.pitch = INTRO_END.pitch;
    steer.keys.clear();
    pointerPads.clear();
    safeCall(ui, 'setInputLocked', false);
    if (ctx && canvas) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    if (typeof onComplete === 'function') onComplete({ skipped, replay: replaying });
  }

  function skip() {
    finish(true);
  }

  function replay() {
    if (!active) start({ replay: true });
  }

  function update(t, dt) {
    if (!active) return;
    elapsed = Math.max(0, t - startTime);
    const d = durations();
    const total = d.wormhole + d.drift + d.descent;
    setProgress(elapsed / total);
    if (phase === 'wormhole' && elapsed >= d.wormhole) {
      goPhase('drift');
    }
    if (phase === 'drift' && elapsed >= d.wormhole + d.drift) {
      descentFrom = { yaw: camera.yaw, pitch: camera.pitch, zoom: camera.zoom };
      goPhase('descent');
    }
    const reduced = prefersReducedMotion();
    if (phase === 'wormhole') {
      const k = clamp01(elapsed / d.wormhole);
      camera.zoom = starts.zoom + Math.sin(k * Math.PI) * 0.02;
      camera.yaw = starts.yaw + k * 0.05;
      camera.pitch = starts.pitch + Math.sin(k * Math.PI) * 0.02;
      setDescent(0);
      drawFx(t, 'wormhole', 1);
    } else if (phase === 'drift') {
      const input = readSteer();
      const drift = clamp01((elapsed - d.wormhole) / d.drift);
      // Gravity pulls more than the pilot can correct: steering gives limited
      // yaw/pitch authority and a slight wobble, but the planet keeps growing.
      camera.yaw += (input.x * 0.55 + 0.055) * (dt / 1000) + (reduced ? 0 : Math.sin(elapsed / 380) * 0.0007);
      camera.pitch += input.y * 0.32 * (dt / 1000);
      camera.zoom = starts.zoom + 0.03 + drift * 0.09;
      setDescent(0);
      drawFx(t, 'drift', 1);
      if (input.x || input.y) {
        const copy = PHASE_COPY.drift;
        setStatus(copy.main, 'STEERING RESPONDS // GRAVITY WINS', copy.label);
      }
    } else if (phase === 'descent') {
      const from = descentFrom || { yaw: camera.yaw, pitch: camera.pitch, zoom: camera.zoom };
      const k = easeInOut(clamp01((elapsed - d.wormhole - d.drift) / d.descent));
      camera.yaw = from.yaw + (INTRO_END.yaw - from.yaw) * k;
      camera.pitch = from.pitch + (INTRO_END.pitch - from.pitch) * k;
      camera.zoom = from.zoom * (INTRO_END.zoom / from.zoom) ** k;
      setDescent(k);
      drawFx(t, 'descent', k);
      if (k >= 1 || elapsed >= total + 80) {
        finish(false);
        return;
      }
    }
    lastDraw = t;
  }

  return {
    get active() {
      return active;
    },
    get phase() {
      return phase;
    },
    get seen() {
      return seen;
    },
    get replaying() {
      return replaying;
    },
    state: () => ({ active, phase, elapsed, seen, replay: replaying }),
    shouldPlay,
    start,
    skip,
    replay,
    update,
    finish,
    resize,
    setSeen: (value) => {
      if (value) writeSeen();
    },
  };
}
