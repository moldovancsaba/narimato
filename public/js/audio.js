/**
 * NARIMATO — synthesized arcade audio.
 *
 * Every sound is generated at runtime with the Web Audio API: oscillators,
 * envelopes, biquad filters and a pre-baked white-noise buffer. No files, no
 * network, no dependencies.
 *
 * Browser autoplay policy: the context cannot make sound before a user
 * gesture. `unlock()` is idempotent and safe to call from every pointerdown;
 * all SFX no-op until it succeeds, so the game stays silent until the player
 * interacts. `isMuted` reflects the player's explicit choice.
 */

const DEFAULT_LEVEL = 0.34;
const NOISE_SECONDS = 1;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const maybe = (fn) => {
  try {
    return fn();
  } catch {
    return undefined;
  }
};

export class ArcadeAudio {
  constructor({ level = DEFAULT_LEVEL } = {}) {
    /** Master level before per-sound gains. */
    this.level = clamp(Number(level) || DEFAULT_LEVEL, 0, 1);
    this._muted = false;
    this._unlocked = false;
    this._ctx = null;
    this._master = null;
    this._noiseBuffer = null;
    this._lastAt = Object.create(null);
    this._dead = false;
  }

  /** True when the player has muted the arcade. */
  get isMuted() {
    return this._muted;
  }

  /** True once a user gesture has allowed audio to start. */
  get isUnlocked() {
    return this._unlocked && !!this._ctx && this._ctx.state !== 'closed';
  }

  /**
   * Create/resume the AudioContext. Must be called from a user gesture the
   * first time; later calls are cheap and only resume if suspended.
   */
  unlock() {
    if (this._dead) return false;
    if (typeof window === 'undefined') return false;

    if (!this._ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) {
        this._dead = true;
        return false;
      }
      try {
        this._ctx = new Ctx({ latencyHint: 'interactive' });
      } catch {
        this._dead = true;
        return false;
      }
      this._buildGraph();
    }

    if (this._ctx.state !== 'running') {
      maybe(() => this._ctx.resume());
    }
    this._unlocked = true;
    return true;
  }

  /** Resume an interrupted/suspended context after visibility changes. */
  resume() {
    if (this._dead || !this._ctx) return false;
    if (this._ctx.state !== 'running') maybe(() => this._ctx.resume());
    return this._ctx.state === 'running';
  }

  /** Explicit mute/unmute; ramps the master bus so tails do not click. */
  setMuted(muted) {
    this._muted = !!muted;
    if (this._master && this._ctx) {
      const target = this._muted ? 0.0001 : this.level;
      maybe(() => {
        this._master.gain.cancelScheduledValues(this._ctx.currentTime);
        this._master.gain.setTargetAtTime(target, this._ctx.currentTime, 0.015);
      });
    }
    return this._muted;
  }

  /** Toggle mute and return the new muted state (used by the sound button). */
  toggle() {
    return this.setMuted(!this._muted);
  }

  /** Tear down the context (tests / page teardown). */
  destroy() {
    this._dead = true;
    this._unlocked = false;
    const ctx = this._ctx;
    this._ctx = null;
    this._master = null;
    if (ctx) maybe(() => ctx.close());
  }

  /* ---------------------------------------------------------------- *
   * Sound design
   * ---------------------------------------------------------------- */

  /** Friendly rising handshake when a tag is accepted. */
  join() {
    if (!this._ready('join', 120)) return;
    const t = this._now();
    this._tone({ freq: 392, type: 'triangle', dur: 0.1, level: 0.16, at: t });
    this._tone({ freq: 523.25, type: 'triangle', dur: 0.1, level: 0.18, at: t + 0.07 });
    this._tone({ freq: 783.99, type: 'sine', dur: 0.22, level: 0.14, at: t + 0.14 });
    this._tone({ freq: 1567.98, type: 'sine', dur: 0.18, level: 0.05, at: t + 0.15 });
    this._noise({ dur: 0.06, level: 0.05, at: t, type: 'highpass', freq: 2400 });
  }

  /** Claim blip; pitch climbs with the streak so combos feel alive. */
  claim(streak = 1) {
    if (!this._ready('claim', 35)) return;
    const n = clamp(Number(streak) || 1, 1, 12);
    const t = this._now();
    const freq = 480 + (n - 1) * 52;
    this._tone({ freq, type: 'triangle', dur: 0.07, level: 0.15, at: t });
    this._tone({ freq: freq * 1.5, type: 'sine', dur: 0.09, level: 0.11, at: t + 0.045 });
    if (n >= 4) this._tone({ freq: freq * 2, type: 'sine', dur: 0.08, level: 0.06, at: t + 0.085 });
    this._noise({ dur: 0.035, level: 0.045, at: t, type: 'bandpass', freq: 2600, q: 1.4 });
  }

  /** Aggressive descending rip when turf changes hands. */
  steal() {
    if (!this._ready('steal', 80)) return;
    const t = this._now();
    this._tone({ freq: 540, to: 180, type: 'sawtooth', dur: 0.18, level: 0.13, at: t });
    this._tone({ freq: 548, to: 184, type: 'square', dur: 0.16, level: 0.06, at: t + 0.01 });
    this._noise({ dur: 0.16, level: 0.1, at: t, type: 'bandpass', freq: 1500, toFreq: 320, q: 1.1 });
  }

  /** Deep wormhole whoosh for the intro. */
  introWhoosh() {
    if (!this._ready('introWhoosh', 400)) return;
    const t = this._now();
    this._noise({ dur: 1.4, level: 0.12, at: t, type: 'lowpass', freq: 180, toFreq: 1400, q: 0.7, attack: 0.25 });
    this._tone({ freq: 42, to: 88, type: 'sine', dur: 1.2, level: 0.18, at: t, attack: 0.2 });
    this._tone({ freq: 220, to: 880, type: 'triangle', dur: 1.1, level: 0.05, at: t + 0.15, attack: 0.3 });
  }

  /** Cockpit alarm chirp. */
  introAlarm() {
    if (!this._ready('introAlarm', 350)) return;
    const t = this._now();
    this._tone({ freq: 880, type: 'square', dur: 0.12, level: 0.1, at: t });
    this._tone({ freq: 660, type: 'square', dur: 0.12, level: 0.1, at: t + 0.16 });
    this._tone({ freq: 880, type: 'square', dur: 0.12, level: 0.08, at: t + 0.32 });
  }

  /** Planet reveal swell at the end of the descent. */
  introReveal() {
    if (!this._ready('introReveal', 500)) return;
    const t = this._now();
    [261.63, 392, 523.25, 783.99].forEach((freq, i) => {
      this._tone({ freq, type: 'triangle', dur: 1.1, level: 0.07, at: t + i * 0.08, attack: 0.2 });
    });
    this._noise({ dur: 0.9, level: 0.06, at: t, type: 'highpass', freq: 2200, attack: 0.2 });
  }

  /** Bright ore-discovery chime: rising shimmer for a fresh deposit. */
  discovery() {
    if (!this._ready('discovery', 90)) return;
    const t = this._now();
    this._tone({ freq: 740, type: 'triangle', dur: 0.08, level: 0.12, at: t });
    this._tone({ freq: 1108.73, type: 'triangle', dur: 0.1, level: 0.13, at: t + 0.055 });
    this._tone({ freq: 1661.22, type: 'sine', dur: 0.22, level: 0.1, at: t + 0.11 });
    this._tone({ freq: 2217.46, type: 'sine', dur: 0.2, level: 0.05, at: t + 0.16 });
    this._noise({ dur: 0.16, level: 0.05, at: t + 0.05, type: 'highpass', freq: 4800 });
  }

  /** Soft reinforced-clink when charging a cell you already own. */
  reinforce() {
    if (!this._ready('reinforce', 40)) return;
    const t = this._now();
    this._tone({ freq: 1046.5, type: 'sine', dur: 0.05, level: 0.09, at: t });
    this._tone({ freq: 1568, type: 'sine', dur: 0.06, level: 0.05, at: t + 0.018 });
    this._noise({ dur: 0.02, level: 0.025, at: t, type: 'highpass', freq: 6000 });
  }

  /**
   * Glass-shatter hit for a cell breaking into its four children: sub thud,
   * wide noise spray and a cascade of shrinking shard pings.
   */
  breakShatter() {
    if (!this._ready('breakShatter', 120)) return;
    const t = this._now();
    this._tone({ freq: 190, to: 54, type: 'sine', dur: 0.3, level: 0.2, at: t, attack: 0.002 });
    this._tone({ freq: 96, to: 40, type: 'triangle', dur: 0.34, level: 0.12, at: t });
    this._noise({ dur: 0.34, level: 0.16, at: t, type: 'highpass', freq: 3600, toFreq: 900, q: 0.8, attack: 0.002 });
    this._noise({ dur: 0.18, level: 0.1, at: t + 0.02, type: 'bandpass', freq: 2400, toFreq: 1400, q: 2.2 });
    const shards = [3520, 2960, 2640, 1980, 1760, 1318];
    shards.forEach((freq, i) => {
      this._tone({
        freq,
        to: freq * 0.72,
        type: 'triangle',
        dur: 0.09,
        level: 0.05,
        at: t + 0.02 + i * 0.032,
        pan: i % 2 ? 0.36 : -0.36,
      });
    });
  }

  /** Big two-stage whoomp for a grid SURGE. */
  surge() {
    if (!this._ready('surge', 600)) return;
    const t = this._now();
    this._tone({ freq: 82, to: 220, type: 'sawtooth', dur: 0.42, level: 0.16, at: t, attack: 0.02 });
    this._tone({ freq: 164, to: 880, type: 'sawtooth', dur: 0.5, level: 0.07, at: t + 0.04, attack: 0.05 });
    this._noise({ dur: 0.5, level: 0.16, at: t, type: 'bandpass', freq: 240, toFreq: 4200, q: 0.9, attack: 0.05 });
    this._tone({ freq: 1318.51, type: 'triangle', dur: 0.12, level: 0.1, at: t + 0.44 });
    this._tone({ freq: 1760, type: 'triangle', dur: 0.18, level: 0.07, at: t + 0.49 });
  }

  /** Countdown-to-fight triple stab. */
  roundStart() {
    if (!this._ready('roundStart', 400)) return;
    const t = this._now();
    [523.25, 659.25, 880].forEach((freq, i) => {
      this._tone({ freq, type: 'square', dur: 0.1, level: 0.12, at: t + i * 0.11 });
    });
    this._tone({ freq: 110, type: 'sine', dur: 0.3, level: 0.16, at: t + 0.33, attack: 0.01 });
    this._noise({ dur: 0.08, level: 0.06, at: t + 0.33, type: 'highpass', freq: 3000 });
  }

  /** Diminishing cycle when the grid powers down. */
  roundEnd() {
    if (!this._ready('roundEnd', 400)) return;
    const t = this._now();
    [880, 659.25, 523.25, 392].forEach((freq, i) => {
      this._tone({ freq, type: 'triangle', dur: 0.13, level: 0.12, at: t + i * 0.12 });
    });
    this._tone({ freq: 130.81, to: 65.4, type: 'sawtooth', dur: 0.5, level: 0.1, at: t + 0.2 });
  }

  /** Triumphant little fanfare for the results panel. */
  result() {
    if (!this._ready('result', 500)) return;
    const t = this._now();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      this._tone({ freq, type: 'triangle', dur: 0.12, level: 0.13, at: t + i * 0.09 });
      this._tone({ freq: freq / 2, type: 'sine', dur: 0.2, level: 0.05, at: t + i * 0.09 });
    });
    [523.25, 659.25, 783.99, 1046.5].forEach((freq) => {
      this._tone({ freq, type: 'sine', dur: 0.55, level: 0.06, at: t + 0.38, attack: 0.02 });
    });
    this._noise({ dur: 0.3, level: 0.05, at: t + 0.38, type: 'highpass', freq: 5000 });
  }

  /** Buzz for rejected input / dropped uplink. */
  error() {
    if (!this._ready('error', 320)) return;
    const t = this._now();
    this._tone({ freq: 150, type: 'square', dur: 0.09, level: 0.16, at: t });
    this._tone({ freq: 112, type: 'square', dur: 0.12, level: 0.13, at: t + 0.11 });
    this._noise({ dur: 0.05, level: 0.05, at: t, type: 'lowpass', freq: 400 });
  }

  /** Tiny UI tick (level changes, options, mute). */
  tick() {
    if (!this._ready('tick', 45)) return;
    const t = this._now();
    this._tone({ freq: 2093, type: 'sine', dur: 0.03, level: 0.05, at: t });
    this._noise({ dur: 0.012, level: 0.02, at: t, type: 'highpass', freq: 6000 });
  }

  /* ---------------------------------------------------------------- *
   * Internals
   * ---------------------------------------------------------------- */

  _buildGraph() {
    const ctx = this._ctx;
    if (!ctx) return;
    const master = ctx.createGain();
    master.gain.value = this._muted ? 0.0001 : this.level;

    let tail = master;
    maybe(() => {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 18;
      comp.ratio.value = 5;
      comp.attack.value = 0.003;
      comp.release.value = 0.14;
      master.connect(comp);
      comp.connect(ctx.destination);
      tail = null;
    });
    if (tail) master.connect(ctx.destination);

    this._master = master;
    this._noiseBuffer = this._makeNoise(ctx);
  }

  _makeNoise(ctx) {
    try {
      const length = Math.floor(ctx.sampleRate * NOISE_SECONDS);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      return buffer;
    } catch {
      return null;
    }
  }

  _ready(name, minGapMs) {
    if (!this._ctx || !this._unlocked || this._muted || this._dead) return false;
    if (this._ctx.state === 'interrupted') maybe(() => this._ctx.resume());
    if (this._ctx.state !== 'running' && this._ctx.state !== 'suspended') return false;
    if (this._ctx.state === 'suspended') maybe(() => this._ctx.resume());
    const t = this._ctx.currentTime;
    const last = this._lastAt[name] || 0;
    if (t - last < minGapMs / 1000) return false;
    this._lastAt[name] = t;
    return true;
  }

  _now() {
    return this._ctx ? this._ctx.currentTime : 0;
  }

  _out(node, pan) {
    if (!this._master) return;
    const ctx = this._ctx;
    if (pan && ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = clamp(pan, -1, 1);
      node.connect(panner);
      panner.connect(this._master);
    } else {
      node.connect(this._master);
    }
  }

  /**
   * One enveloped oscillator note.
   * @param {object} opts
   */
  _tone({
    freq = 440,
    to = 0,
    type = 'square',
    dur = 0.12,
    level = 0.12,
    at = 0,
    attack = 0.004,
    release = 0.05,
    detune = 0,
    pan = 0,
  } = {}) {
    const ctx = this._ctx;
    if (!ctx) return;
    maybe(() => {
      const start = Math.max(at, ctx.currentTime);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(clamp(freq, 20, 18000), start);
      if (to) osc.frequency.exponentialRampToValueAtTime(clamp(to, 20, 18000), start + dur);
      if (detune) osc.detune.value = detune;

      const peak = Math.max(0.0002, level);
      const a = Math.min(Math.max(attack, 0.001), dur * 0.5);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(peak, start + a);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(dur, a + 0.01));

      osc.connect(gain);
      this._out(gain, pan);
      osc.start(start);
      osc.stop(start + dur + release + 0.02);
    });
  }

  /**
   * Filtered white-noise burst for texture (steals, surges, air).
   */
  _noise({
    dur = 0.1,
    level = 0.08,
    at = 0,
    type = 'bandpass',
    freq = 1200,
    toFreq = 0,
    q = 1,
    attack = 0.005,
  } = {}) {
    const ctx = this._ctx;
    if (!ctx || !this._noiseBuffer) return;
    maybe(() => {
      const start = Math.max(at, ctx.currentTime);
      const src = ctx.createBufferSource();
      src.buffer = this._noiseBuffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.setValueAtTime(clamp(freq, 20, 18000), start);
      if (toFreq) filter.frequency.exponentialRampToValueAtTime(clamp(toFreq, 20, 18000), start + dur);
      filter.Q.value = clamp(q, 0.0001, 24);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(Math.max(0.0002, level), start + Math.min(attack, dur * 0.5));
      gain.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(dur, 0.02));
      src.connect(filter);
      filter.connect(gain);
      this._out(gain);
      src.start(start);
      src.stop(start + dur + 0.05);
    });
  }
}
