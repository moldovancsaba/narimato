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
  let meteorTitle = 'METEOR IMPACT';
  let incidentKind = 'meteor';
  let incidentDescription = '';
  let meteorRaf = 0;

  function collect() {
    for (const id of [
      'interlude-overlay', 'interlude-fx', 'interlude-title', 'interlude-sub',
      'interlude-story', 'interlude-status', 'interlude-bar', 'interlude-planet',
      'meteor-overlay', 'meteor-fx', 'meteor-title', 'meteor-sub', 'meteor-description',
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
    const t = elapsed / 1000;
    const k = clamp01(elapsed / 2100);
    meteorCtx.clearRect(0, 0, w, h);
    if (!prefersReducedMotion()) {
      meteorCtx.save();
      meteorCtx.globalCompositeOperation = 'lighter';
      if (incidentKind === 'nuclear') {
        // White flash → layered shockwaves → rising fire columns.
        if (t < 0.2) {
          meteorCtx.fillStyle = `rgba(255,255,240,${(0.85 * (1 - t / 0.2)).toFixed(3)})`;
          meteorCtx.fillRect(0, 0, w, h);
        }
        for (let i = 0; i < 4; i += 1) {
          const rr = 40 + (k * 0.9 + i * 0.08) * Math.max(w, h) * 0.65;
          meteorCtx.strokeStyle = `rgba(255,${140 - i * 20},${45 - i * 8},${0.38 * (1 - k)})`;
          meteorCtx.lineWidth = 8 - i * 1.5;
          meteorCtx.beginPath();
          meteorCtx.arc(cx, cy, Math.max(1, rr), 0, Math.PI * 2);
          meteorCtx.stroke();
        }
        for (let i = 0; i < 7; i += 1) {
          const x = cx + (i - 3) * 62 + Math.sin(t * 2 + i) * 7;
          const rise = Math.min(1, t / 1.8) * (160 + (i % 3) * 80);
          const grad = meteorCtx.createLinearGradient(x, cy, x, cy - rise);
          grad.addColorStop(0, 'rgba(255,210,110,0.4)');
          grad.addColorStop(0.55, 'rgba(255,80,35,0.22)');
          grad.addColorStop(1, 'rgba(90,20,10,0)');
          meteorCtx.fillStyle = grad;
          meteorCtx.fillRect(x - 22, cy - rise, 44, rise);
        }
      } else if (incidentKind === 'solar') {
        // White-gold flare, expanding halo, lens streaks.
        if (t < 0.35) {
          meteorCtx.fillStyle = `rgba(255,248,210,${(0.8 * (1 - t / 0.35)).toFixed(3)})`;
          meteorCtx.fillRect(0, 0, w, h);
        }
        const halo = meteorCtx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * (0.4 + k * 0.5));
        halo.addColorStop(0, `rgba(255,236,150,${0.5 * (1 - k)})`);
        halo.addColorStop(0.3, `rgba(255,170,60,${0.22 * (1 - k)})`);
        halo.addColorStop(1, 'rgba(255,100,20,0)');
        meteorCtx.fillStyle = halo;
        meteorCtx.fillRect(0, 0, w, h);
        for (let i = 0; i < 9; i += 1) {
          const ang = (i / 9) * Math.PI * 2 + Math.sin(t * 0.6 + i) * 0.04;
          const r0 = 60 + (i % 3) * 30;
          const r1 = 80 + (k * 0.9 + i * 0.03) * Math.max(w, h) * 0.55;
          meteorCtx.strokeStyle = `rgba(255,${225 - (i % 3) * 20},120,${0.2 * (1 - k)})`;
          meteorCtx.lineWidth = 2 + (i % 3);
          meteorCtx.beginPath();
          meteorCtx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
          meteorCtx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
          meteorCtx.stroke();
        }
      } else if (incidentKind === 'alien') {
        // Green/violet orbital beams and scanning saucer rings.
        for (let i = 0; i < 4; i += 1) {
          const x = cx + (i - 1.5) * Math.min(w, h) * 0.22;
          const grad = meteorCtx.createLinearGradient(x, 0, x, h);
          grad.addColorStop(0, `rgba(165,255,150,${0.22 * (1 - k)})`);
          grad.addColorStop(0.6, `rgba(90,255,170,${0.12 * (1 - k)})`);
          grad.addColorStop(1, 'rgba(80,255,160,0)');
          meteorCtx.fillStyle = grad;
          meteorCtx.fillRect(x - 26, 0, 52, h);
        }
        for (let i = 0; i < 5; i += 1) {
          const rr = 30 + k * Math.max(w, h) * (0.45 + i * 0.05);
          meteorCtx.strokeStyle = `rgba(${150 + i * 18},255,190,${0.28 * (1 - k)})`;
          meteorCtx.lineWidth = 2;
          meteorCtx.beginPath();
          meteorCtx.ellipse(cx, cy + Math.sin(t * 1.4 + i) * 18, rr, rr * 0.32, 0, 0, Math.PI * 2);
          meteorCtx.stroke();
        }
      } else {
        // Meteor: the original orange impact shock.
        meteorCtx.strokeStyle = `rgba(255, 190, 90, ${0.5 * (1 - k)})`;
        meteorCtx.lineWidth = 4 + 8 * (1 - k);
        meteorCtx.beginPath();
        meteorCtx.arc(cx, cy, 30 + k * Math.max(w, h) * 0.6, 0, Math.PI * 2);
        meteorCtx.stroke();
        for (let i = 0; i < 26; i += 1) {
          const a = (i / 26) * Math.PI * 2;
          const r = 60 + k * 260 + (i % 5) * 20;
          meteorCtx.strokeStyle = `rgba(255, 150, 60, ${0.18 * (1 - k)})`;
          meteorCtx.beginPath();
          meteorCtx.moveTo(cx + Math.cos(a) * r * 0.3, cy + Math.sin(a) * r * 0.3);
          meteorCtx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
          meteorCtx.stroke();
        }
      }
      meteorCtx.restore();
    }
    if (elapsed > 2400) {
      meteorActive = false;
      setMeteor(false);
      if (meteorCtx && meteorCanvas) meteorCtx.clearRect(0, 0, w, h);
      return;
    }
    meteorRaf = requestAnimationFrame(drawMeteor);
  }

  function incident(kind = 'meteor', title = 'INCIDENT', message = 'PLANET RESET', description = '') {
    collect();
    incidentKind = ['meteor', 'nuclear', 'solar', 'alien'].includes(kind) ? kind : 'meteor';
    meteorTitle = String(title || incidentKind.toUpperCase());
    incidentDescription = String(description || '');
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
      overlay.className = `meteor-overlay incident-${incidentKind}`;
      overlay.hidden = false;
      overlay.classList.add('is-active');
      overlay.setAttribute('aria-hidden', 'false');
    }
    if (document.body) {
      document.body.className = document.body.className.replace(/\bincident-\w+/g, '').trim();
      document.body.classList.add('is-meteor', 'is-shaking', `incident-${incidentKind}`);
    }
    setText('meteor-title', meteorTitle);
    setText('meteor-sub', meteorMessage);
    setText('meteor-description', incidentDescription);
    resizeCanvas(meteorCanvas, meteorCtx);
    cancelAnimationFrame(meteorRaf);
    meteorRaf = requestAnimationFrame(drawMeteor);
    setTimeout(() => {
      if (document.body) document.body.classList.remove('is-shaking');
    }, 1300);
    setTimeout(() => {
      meteorActive = false;
      setMeteor(false);
      if (meteorCtx && meteorCanvas) meteorCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }, 2600);
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
    incident,
    finish,
    resize,
  };
}
