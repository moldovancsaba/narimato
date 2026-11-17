/**
 * NARIMATO — interplanetary transit cinematic.
 *
 * Plays when the pilot finishes the escape refit: launch burn → random space
 * story event (storm / pirates / wormhole tremor…) → hull damage + screen shake
 * → emergency landing on the next planet. Also plays the meteor reset flash.
 *
 * Visuals are DOM/CSS + one 2D canvas; no assets. The app supplies the story
 * object from the server and calls onComplete when the new planet is ready.
 */

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
  let meteorActive = false;
  let meteorStart = 0;
  let meteorMessage = '';
  let meteorRaf = 0;

  function collect() {
    for (const id of [
      'interlude-overlay', 'interlude-fx', 'interlude-title', 'interlude-sub',
      'interlude-story', 'interlude-status', 'interlude-bar', 'interlude-planet',
      'meteor-overlay', 'meteor-fx', 'meteor-title', 'meteor-sub',
    ]) {
      els[id] = document.getElementById(id);
    }
    canvas = els['interlude-fx'];
    if (canvas && canvas.getContext) ctx = canvas.getContext('2d');
    meteorCanvas = els['meteor-fx'];
    if (meteorCanvas && meteorCanvas.getContext) meteorCtx = meteorCanvas.getContext('2d');
  }

  function resizeCanvas(el, context) {
    if (!el || !context) return;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    el.width = Math.max(1, Math.round(window.innerWidth * dpr));
    el.height = Math.max(1, Math.round(window.innerHeight * dpr));
    el.style.width = `${window.innerWidth}px`;
    el.style.height = `${window.innerHeight}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    if (prefersReducedMotion()) return;
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

  function drawMeteor() {
    if (!meteorActive || !meteorCtx || !meteorCanvas) return;
    const elapsed = performance.now() - meteorStart;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;
    const cy = h / 2;
    meteorCtx.clearRect(0, 0, w, h);
    if (!prefersReducedMotion()) {
      meteorCtx.save();
      meteorCtx.globalCompositeOperation = 'lighter';
      const ring = clamp01(elapsed / 1800);
      meteorCtx.strokeStyle = `rgba(255, 190, 90, ${0.5 * (1 - ring)})`;
      meteorCtx.lineWidth = 4 + 8 * (1 - ring);
      meteorCtx.beginPath();
      meteorCtx.arc(cx, cy, 30 + ring * Math.max(w, h) * 0.6, 0, Math.PI * 2);
      meteorCtx.stroke();
      for (let i = 0; i < 26; i += 1) {
        const a = (i / 26) * Math.PI * 2;
        const r = 60 + ring * 260 + (i % 5) * 20;
        meteorCtx.strokeStyle = `rgba(255, 150, 60, ${0.18 * (1 - ring)})`;
        meteorCtx.beginPath();
        meteorCtx.moveTo(cx + Math.cos(a) * r * 0.3, cy + Math.sin(a) * r * 0.3);
        meteorCtx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        meteorCtx.stroke();
      }
      meteorCtx.restore();
    }
    if (elapsed > 2000) {
      meteorActive = false;
      setMeteor(false);
      if (meteorCtx && meteorCanvas) meteorCtx.clearRect(0, 0, w, h);
      return;
    }
    meteorRaf = requestAnimationFrame(drawMeteor);
  }

  function meteor(message = 'METEOR IMPACT // PLANET RESET') {
    collect();
    meteorActive = true;
    meteorStart = performance.now();
    meteorMessage = message;
    const overlay = els['meteor-overlay'];
    const fx = els['meteor-fx'];
    if (fx && fx.getContext) {
      meteorCanvas = fx;
      meteorCtx = fx.getContext('2d');
    }
    if (overlay) {
      overlay.hidden = false;
      overlay.classList.remove('is-hidden');
      overlay.classList.add('is-active');
      overlay.setAttribute('aria-hidden', 'false');
    }
    if (document.body) document.body.classList.add('is-meteor', 'is-shaking');
    setText('meteor-title', 'METEOR IMPACT');
    setText('meteor-sub', message);
    resizeCanvas(meteorCanvas, meteorCtx);
    cancelAnimationFrame(meteorRaf);
    meteorRaf = requestAnimationFrame(drawMeteor);
    setTimeout(() => {
      if (document.body) document.body.classList.remove('is-shaking');
    }, 1200);
    setTimeout(() => {
      meteorActive = false;
      setMeteor(false);
      if (meteorCtx && meteorCanvas) meteorCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }, 2300);
    safeAudio('introAlarm');
    return meteorMessage;
  }

  function resize() {
    resizeCanvas(canvas, ctx);
    resizeCanvas(meteorCanvas, meteorCtx);
  }

  if (typeof window !== 'undefined') window.addEventListener('resize', resize);

  return {
    get active() {
      return active;
    },
    get storm() {
      return active && currentPhase().id === 'event';
    },
    state: () => ({ active, phase: active ? currentPhase().id : 'idle', story: story ? story.id : null }),
    startEscape,
    meteor,
    finish,
    resize,
  };
}
