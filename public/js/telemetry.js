/**
 * NARIMATO — privacy-safe client telemetry beacon (Track B0).
 *
 * Sends ONE tiny numeric payload:
 *   - once when the page is hidden/pagehides (session summary),
 *   - once after the first spoken audio word (audio startup timing).
 *
 * There is no dependency on the server being up (every send is guarded), no
 * cookies, no identifiers, no tags/tokens — only the numeric fields below.
 * Aggregation/clamping is enforced by the server whitelist as well.
 *
 * Usage (app.js):
 *   import { telemetry } from './telemetry.js';   // auto-installs in a browser
 *   telemetry?.markAudioFirstWord(performance.now() - startedAt);
 *
 * In Node (tests/SSR) the module exports helpers but never touches `window`.
 */

export const TELEMETRY_ENDPOINT = '/api/telemetry';

const WEB_VITALS = ['lcp', 'cls', 'inp', 'ttfb'];
const HUD_KEYS = ['longTasks', 'maxLongTask'];
const AUDIO_KEYS = ['firstWordMs', 'clipFailures', 'resumeCount'];
const VIEWPORT_KEYS = ['width', 'height', 'dpr'];
const ERROR_KEYS = ['js', 'network', 'unhandled'];
// PERF-01: the only performance fields that leave the browser. Numeric only.
const PERF_KEYS = ['frameP95Ms', 'frameMaxMs', 'fps'];

const asNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

function pickNumbers(source, keys) {
  const out = {};
  if (!source || typeof source !== 'object') return out;
  for (const key of keys) {
    const value = asNumber(source[key]);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/**
 * Build the exact whitelisted beacon payload from collectable state.
 * Strings/objects/unknown keys are dropped so nothing identifying can leak.
 */
export function buildTelemetryPayload(state = {}) {
  const payload = {};
  const webVitals = pickNumbers(state.webVitals, WEB_VITALS);
  if (Object.keys(webVitals).length) payload.webVitals = webVitals;
  const hud = pickNumbers(state.hud, HUD_KEYS);
  if (Object.keys(hud).length) payload.hud = hud;
  const audio = pickNumbers(state.audio, AUDIO_KEYS);
  if (Object.keys(audio).length) payload.audio = audio;
  const viewport = pickNumbers(state.viewport, VIEWPORT_KEYS);
  if (Object.keys(viewport).length) payload.viewport = viewport;
  const errors = pickNumbers(state.errors, ERROR_KEYS);
  if (Object.keys(errors).length) payload.errors = errors;
  const perf = pickNumbers(state.perf, PERF_KEYS);
  if (Object.keys(perf).length) payload.perf = perf;
  const sessionMs = asNumber(state.sessionMs);
  if (sessionMs !== undefined) payload.sessionMs = sessionMs;
  return payload;
}

/**
 * Create a telemetry controller. `win` is injectable for tests; when omitted a
 * real browser window is used if present, otherwise the controller is a no-op.
 */
export function createTelemetry(options = {}) {
  const win = options.win !== undefined ? options.win : typeof window !== 'undefined' ? window : null;
  const doc = options.doc !== undefined ? options.doc : typeof document !== 'undefined' ? document : null;
  const endpoint = typeof options.endpoint === 'string' ? options.endpoint : TELEMETRY_ENDPOINT;
  const sessionStart = Number.isFinite(options.sessionStart) ? options.sessionStart : Date.now();
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const sent = new Set();
  let installed = false;

  const metrics = {
    webVitals: {},
    hud: { longTasks: 0, maxLongTask: 0 },
    audio: {},
    viewport: {},
    errors: { js: 0, network: 0, unhandled: 0 },
    perf: {},
  };

  const readViewport = () => {
    if (!win) return;
    if (Number.isFinite(win.innerWidth)) metrics.viewport.width = win.innerWidth;
    if (Number.isFinite(win.innerHeight)) metrics.viewport.height = win.innerHeight;
    const dpr = win.devicePixelRatio;
    if (Number.isFinite(dpr)) metrics.viewport.dpr = dpr;
  };

  const currentPayload = (extra = {}) => {
    readViewport();
    const state = {
      webVitals: metrics.webVitals,
      hud: metrics.hud,
      audio: metrics.audio,
      viewport: metrics.viewport,
      errors: metrics.errors,
      perf: metrics.perf,
      sessionMs: Math.max(0, now() - sessionStart),
      ...extra,
    };
    return buildTelemetryPayload(state);
  };

  const send = (reason = 'beacon', extra = {}) => {
    if (!endpoint || !win) return false; // safe no-op outside a browser
    const payload = currentPayload(extra);
    if (!Object.keys(payload).length) return false;
    const json = JSON.stringify(payload);
    try {
      const nav = win && win.navigator;
      if (nav && typeof nav.sendBeacon === 'function') {
        const BlobCtor = win.Blob || (typeof Blob !== 'undefined' ? Blob : null);
        const blob = BlobCtor ? new BlobCtor([json], { type: 'text/plain' }) : json;
        if (nav.sendBeacon(endpoint, blob)) {
          sent.add(reason);
          return true;
        }
      }
    } catch {
      /* fall through to fetch */
    }
    // fetch(keepalive) fallback — still no-op safely when offline.
    try {
      const fetcher = (win && typeof win.fetch === 'function' ? win.fetch : typeof fetch === 'function' ? fetch : null);
      if (!fetcher) return false;
      void fetcher(endpoint, {
        method: 'POST',
        keepalive: true,
        headers: { 'content-type': 'application/json' },
        body: json,
      }).catch(() => {});
      sent.add(reason);
      return true;
    } catch {
      return false;
    }
  };

  const markAudioFirstWord = (firstWordMs) => {
    if (sent.has('audio')) return;
    const value = Number(firstWordMs);
    // AUD-01: cue-relative (the caller measures from cue start), never
    // navigation-relative; the server clamps to [0, 120000] anyway.
    metrics.audio.firstWordMs = Number.isFinite(value) ? Math.max(0, value) : 0;
    send('audio');
  };

  /** AUD-01: count a clip that failed/stalled (numeric, never a reason string). */
  const markAudioClipFailure = () => {
    metrics.audio.clipFailures = Math.min(100_000, (metrics.audio.clipFailures || 0) + 1);
    if (!sent.has('audio-failure')) send('audio-failure');
    return metrics.audio.clipFailures;
  };

  /** AUD-01: count one successful interruption resume. */
  const markAudioResume = () => {
    metrics.audio.resumeCount = Math.min(100_000, (metrics.audio.resumeCount || 0) + 1);
    if (!sent.has('audio-resume')) send('audio-resume');
    return metrics.audio.resumeCount;
  };

  const recordError = (kind = 'js') => {
    const key = kind === 'network' || kind === 'unhandled' ? kind : 'js';
    if (metrics.errors[key] < 1_000_000) metrics.errors[key] += 1;
  };

  /**
   * Update the performance beacon fields. Called at most once per second by
   * the render loop; the values are the renderer's windowed measurements.
   * Never retries: if the page-hide beacon is dropped, the sample is gone.
   */
  const recordPerf = (values = {}) => {
    if (!values || typeof values !== 'object') return false;
    let changed = false;
    for (const key of PERF_KEYS) {
      const value = asNumber(values[key]);
      if (value === undefined) continue;
      const max = key === 'fps' ? 240 : 60000;
      const min = 0;
      metrics.perf[key] = Math.min(max, Math.max(min, value));
      changed = true;
    }
    return changed;
  };

  const onHidden = () => {
    if (sent.has('session')) return;
    send('session');
  };

  const observe = (type, handler) => {
    if (!win || typeof win.PerformanceObserver !== 'function') return;
    try {
      const observer = new win.PerformanceObserver((list) => {
        try {
          handler(list.getEntries ? list.getEntries() : []);
        } catch {
          /* never break the page */
        }
      });
      observer.observe({ type, buffered: true });
    } catch {
      /* unsupported entry type */
    }
  };

  const install = () => {
    if (installed || !win) return controller;
    installed = true;
    readViewport();

    // Web Vitals (LCP / CLS / INP) + navigation TTFB.
    observe('largest-contentful-paint', (entries) => {
      for (const entry of entries) if (Number.isFinite(entry.startTime)) metrics.webVitals.lcp = entry.startTime;
    });
    observe('layout-shift', (entries) => {
      let cls = metrics.webVitals.cls || 0;
      for (const entry of entries) if (entry.hadRecentInput !== true) cls += Number(entry.value) || 0;
      metrics.webVitals.cls = Math.round(cls * 1000) / 1000;
    });
    observe('event', (entries) => {
      let inp = metrics.webVitals.inp || 0;
      for (const entry of entries) {
        const duration = Number(entry.duration);
        if (Number.isFinite(duration) && duration > inp) inp = duration;
      }
      metrics.webVitals.inp = Math.round(inp);
    });
    observe('longtask', (entries) => {
      for (const entry of entries) {
        const duration = Number(entry.duration) || 0;
        metrics.hud.longTasks += 1;
        if (duration > metrics.hud.maxLongTask) metrics.hud.maxLongTask = Math.round(duration);
      }
    });
    try {
      const nav = win.performance && win.performance.getEntriesByType ? win.performance.getEntriesByType('navigation')[0] : null;
      if (nav && Number.isFinite(nav.responseStart) && nav.responseStart > 0) metrics.webVitals.ttfb = Math.round(nav.responseStart);
    } catch {
      /* ignore */
    }

    try {
      win.addEventListener('error', () => recordError('js'), true);
      win.addEventListener('unhandledrejection', () => recordError('unhandled'));
      win.addEventListener('pagehide', onHidden);
      if (doc && typeof doc.addEventListener === 'function') {
        doc.addEventListener('visibilitychange', () => {
          if (doc.visibilityState === 'hidden') onHidden();
        });
      }
    } catch {
      /* non-browser window shim */
    }
    return controller;
  };

  const controller = {
    install,
    send,
    markAudioFirstWord,
    markAudioClipFailure,
    markAudioResume,
    recordError,
    recordPerf,
    getPayload: currentPayload,
    get sentReasons() {
      return [...sent];
    },
    get endpoint() {
      return endpoint;
    },
  };
  return controller;
}

/**
 * Auto-install in a real browser. Modules imported in Node (tests/SSR) get a
 * safe no-op controller and never touch `window`/`document`.
 */
export const telemetry =
  typeof window !== 'undefined' && typeof document !== 'undefined' ? createTelemetry().install() : createTelemetry({ win: null, doc: null });

export default createTelemetry;
