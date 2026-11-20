/**
 * NARIMATO — observability collectors (Track B0).
 *
 * Zero npm dependencies. This module is deliberately aggregation-only:
 * it never sees or stores tokens, player tags/ids, hidden deposits or any
 * other gameplay secret. Everything it exposes is counters, timings and byte
 * figures suitable for a dashboard or `/api/metrics`.
 */
import { monitorEventLoopDelay } from 'node:perf_hooks';

const LATENCY_SAMPLES = 2048;
/** Payload contract version for additive `/api/metrics` changes (OPS-01). */
export const METRICS_VERSION = 1;

/** Telemetry whitelist: dotted path -> [min, max] clamp range. */
export const TELEMETRY_SCHEMA = Object.freeze({
  'webVitals.lcp': [0, 120_000],
  'webVitals.cls': [0, 100],
  'webVitals.inp': [0, 60_000],
  'webVitals.ttfb': [0, 60_000],
  'hud.longTasks': [0, 1_000_000],
  'hud.maxLongTask': [0, 600_000],
  'audio.firstWordMs': [0, 120_000],
  'audio.clipFailures': [0, 100_000],
  'audio.resumeCount': [0, 100_000],
  'viewport.width': [1, 20_000],
  'viewport.height': [1, 20_000],
  'viewport.dpr': [0.25, 10],
  // PERF-01 client frame budgets: numeric, clamped and additive.
  'perf.frameP95Ms': [0, 60_000],
  'perf.frameMaxMs': [0, 60_000],
  'perf.fps': [0, 240],
  sessionMs: [0, 86_400_000],
  'errors.js': [0, 1_000_000],
  'errors.network': [0, 1_000_000],
  'errors.unhandled': [0, 1_000_000],
});

/** Group prefixes accepted from the client payload. */
const TELEMETRY_GROUPS = Object.freeze(['webVitals', 'hud', 'audio', 'viewport', 'errors', 'perf']);

function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

/**
 * Normalise an untrusted telemetry payload.
 * - only whitelisted NUMERIC fields survive (strings/objects/arrays dropped),
 * - numbers are clamped to plausible ranges,
 * - unknown groups/keys are ignored,
 * - returns a nested object plus the number of accepted fields.
 */
export function normalizeTelemetryPayload(payload) {
  const out = { fields: {}, accepted: 0 };
  const source = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  for (const [path, [min, max]] of Object.entries(TELEMETRY_SCHEMA)) {
    const dot = path.indexOf('.');
    let raw;
    if (dot === -1) {
      raw = source[path];
    } else {
      const group = path.slice(0, dot);
      const key = path.slice(dot + 1);
      const container = source[group];
      raw = container && typeof container === 'object' && !Array.isArray(container) ? container[key] : undefined;
    }
    // Strict numeric whitelist: strings (could carry PII/tokens) are ignored.
    if (typeof raw !== 'number') continue;
    const value = clampNumber(raw, min, max);
    if (value === null) continue;
    out.fields[path] = value;
    out.accepted += 1;
  }
  return out;
}

/** Normalise a request path into a bounded route label for metrics. */
export function normalizeRoute(pathname) {
  const text = typeof pathname === 'string' ? pathname.split('?')[0] : '';
  if (!text) return '/';
  if (text.startsWith('/api/')) {
    const segment = text.slice(5).split('/')[0].replace(/[^a-z0-9_-]/gi, '').slice(0, 32);
    return segment ? `/api/${segment}` : '/api';
  }
  if (text === '/' || text === '') return 'static:/';
  return 'static';
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

export class Metrics {
  constructor({ now = Date.now, eventLoop = true, eventLoopResolutionMs = 20 } = {}) {
    this.now = typeof now === 'function' ? now : Date.now;
    this.startedAt = this.now();
    this.metricsVersion = METRICS_VERSION;
    /** RSS at collector construction — the baseline for the rss-growth SLO rule. */
    this.bootRssBytes = process.memoryUsage().rss;

    this._latency = new Float64Array(LATENCY_SAMPLES);
    this._latencyCount = 0;
    this._latencyIndex = 0;
    this._latencySum = 0;
    this._latencyMax = 0;

    this.http = {
      requests: 0,
      finished: 0,
      errors: 0, // >= 500
      clientErrors: 0, // 400..499
      routes: Object.create(null),
      statuses: Object.create(null),
    };
    this.sse = { active: 0, opened: 0, closed: 0, dropped: 0, byPlanet: new Map() };
    this.telemetry = {
      reports: 0,
      rejected: 0,
      lastReportedAt: 0,
      aggregates: Object.create(null),
    };
    /**
     * Abuse counters (SEC-01). IP-free by construction: a rejection bumps a
     * named counter, never a key derived from an address or token.
     */
    this.security = {
      rateLimited: 0,
      bodyTooLarge: 0,
      crossOrigin: 0,
      sseRefused: 0,
      traversalBlocked: 0,
      authFailures: 0,
      sseReplaced: 0,
    };

    this._eventLoopHistogram = null;
    if (eventLoop) {
      try {
        this._eventLoopHistogram = monitorEventLoopDelay({ resolution: eventLoopResolutionMs });
        this._eventLoopHistogram.enable();
        this.eventLoop = { enabled: true, resolutionMs: eventLoopResolutionMs };
      } catch {
        this._eventLoopHistogram = null;
        this.eventLoop = { enabled: false, resolutionMs: 0 };
      }
    } else {
      this.eventLoop = { enabled: false, resolutionMs: 0 };
    }
  }

  // ------------------------------------------------------------------- HTTP

  beginRequest() {
    this.http.requests += 1;
  }

  /** Count a route label immediately (used for SSE connections). */
  recordRoute(pathname) {
    const route = normalizeRoute(pathname);
    this.http.routes[route] = (this.http.routes[route] || 0) + 1;
  }

  /** Record a finished HTTP request. SSE connections should pass sse:true (latency excluded). */
  recordRequest({ method = 'GET', pathname = '/', status = 200, durationMs = 0, sse = false } = {}) {
    this.http.finished += 1;
    // SSE route counts are recorded when the stream opens (recordRoute), so a
    // long-lived connection is visible as a connection rather than only on close.
    if (!sse) this.recordRoute(pathname);
    this.http.statuses[status] = (this.http.statuses[status] || 0) + 1;
    if (status >= 500) this.http.errors += 1;
    else if (status >= 400) this.http.clientErrors += 1;
    void method;
    if (sse) return;
    const duration = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
    this._latency[this._latencyIndex] = duration;
    this._latencyIndex = (this._latencyIndex + 1) % LATENCY_SAMPLES;
    this._latencyCount = Math.min(LATENCY_SAMPLES, this._latencyCount + 1);
    this._latencySum += duration;
    if (duration > this._latencyMax) this._latencyMax = duration;
  }

  /** Bump one abuse counter; unknown events are ignored (cannot pollute the shape). */
  recordSecurity(event, count = 1) {
    if (!Object.prototype.hasOwnProperty.call(this.security, event)) return false;
    this.security[event] += Math.max(0, count | 0) || 1;
    return true;
  }

  securitySnapshot() {
    return { ...this.security };
  }

  latencySnapshot() {
    const count = this._latencyCount;
    if (!count) {
      return { count: 0, sumMs: 0, avgMs: 0, maxMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, windowSamples: LATENCY_SAMPLES };
    }
    const samples = Array.from(this._latency.subarray(0, count)).sort((a, b) => a - b);
    return {
      count,
      sumMs: Math.round(this._latencySum * 100) / 100,
      avgMs: Math.round((this._latencySum / count) * 100) / 100,
      maxMs: Math.round(this._latencyMax * 100) / 100,
      p50Ms: Math.round(percentile(samples, 50) * 100) / 100,
      p95Ms: Math.round(percentile(samples, 95) * 100) / 100,
      p99Ms: Math.round(percentile(samples, 99) * 100) / 100,
      windowSamples: LATENCY_SAMPLES,
    };
  }

  // -------------------------------------------------------------------- SSE

  _planetSse(planetIndex) {
    let entry = this.sse.byPlanet.get(planetIndex);
    if (!entry) {
      entry = { active: 0, opened: 0, closed: 0, dropped: 0 };
      this.sse.byPlanet.set(planetIndex, entry);
    }
    return entry;
  }

  sseOpened(planetIndex) {
    const planet = this._planetSse(planetIndex);
    this.sse.active += 1;
    this.sse.opened += 1;
    planet.active += 1;
    planet.opened += 1;
  }

  sseClosed(planetIndex, { dropped = false } = {}) {
    const planet = this._planetSse(planetIndex);
    this.sse.active = Math.max(0, this.sse.active - 1);
    this.sse.closed += 1;
    planet.active = Math.max(0, planet.active - 1);
    planet.closed += 1;
    if (dropped) {
      this.sse.dropped += 1;
      planet.dropped += 1;
    }
  }

  // -------------------------------------------------------------- telemetry

  recordTelemetry(payload) {
    const normalized = normalizeTelemetryPayload(payload);
    if (normalized.accepted === 0) {
      this.telemetry.rejected += 1;
      return { accepted: 0 };
    }
    this.telemetry.reports += 1;
    this.telemetry.lastReportedAt = this.now();
    for (const [path, value] of Object.entries(normalized.fields)) {
      let aggregate = this.telemetry.aggregates[path];
      if (!aggregate) {
        aggregate = { count: 0, sum: 0, min: value, max: value };
        this.telemetry.aggregates[path] = aggregate;
      }
      aggregate.count += 1;
      aggregate.sum += value;
      if (value < aggregate.min) aggregate.min = value;
      if (value > aggregate.max) aggregate.max = value;
    }
    return { accepted: normalized.accepted };
  }

  telemetrySnapshot() {
    const aggregates = {};
    for (const [path, aggregate] of Object.entries(this.telemetry.aggregates)) {
      aggregates[path] = {
        count: aggregate.count,
        sum: Math.round(aggregate.sum * 1000) / 1000,
        avg: Math.round((aggregate.sum / aggregate.count) * 1000) / 1000,
        min: aggregate.min,
        max: aggregate.max,
      };
    }
    return {
      reports: this.telemetry.reports,
      rejected: this.telemetry.rejected,
      lastReportedAt: this.telemetry.lastReportedAt,
      aggregates,
    };
  }

  // ------------------------------------------------------------------ reads

  processSnapshot() {
    const memory = process.memoryUsage();
    return {
      heapUsedBytes: memory.heapUsed,
      heapTotalBytes: memory.heapTotal,
      rssBytes: memory.rss,
      externalBytes: memory.external,
      bootRssBytes: this.bootRssBytes,
    };
  }

  eventLoopSnapshot() {
    const histogram = this._eventLoopHistogram;
    if (!histogram) {
      return { p50Ms: 0, p95Ms: 0, p99Ms: 0, maxMs: 0, meanMs: 0 };
    }
    const toMs = (ns) => (Number.isFinite(ns) ? Math.round((ns / 1e6) * 1000) / 1000 : 0);
    return {
      p50Ms: toMs(histogram.percentile(50)),
      p95Ms: toMs(histogram.percentile(95)),
      p99Ms: toMs(histogram.percentile(99)),
      maxMs: toMs(histogram.max),
      meanMs: toMs(histogram.mean),
    };
  }

  /**
   * Full `/api/metrics` payload. `planets` must be supplied by the caller as
   * read-only aggregates (no player ids/tags, no hidden deposits).
   */
  snapshot({ planets = [], uptimeMs = 0, generatedAt = this.now() } = {}) {
    const byPlanet = {};
    for (const [index, entry] of this.sse.byPlanet.entries()) {
      byPlanet[index] = { ...entry };
    }
    return {
      ok: true,
      metricsVersion: this.metricsVersion,
      generatedAt,
      uptimeMs: Math.max(0, Math.round(uptimeMs)),
      process: this.processSnapshot(),
      security: this.securitySnapshot(),
      http: {
        requests: this.http.requests,
        finished: this.http.finished,
        inFlight: Math.max(0, this.http.requests - this.http.finished),
        errors: this.http.errors,
        clientErrors: this.http.clientErrors,
        routes: { ...this.http.routes },
        statuses: { ...this.http.statuses },
        latencyMs: this.latencySnapshot(),
      },
      sse: {
        active: this.sse.active,
        opened: this.sse.opened,
        closed: this.sse.closed,
        dropped: this.sse.dropped,
        byPlanet,
      },
      planets,
      eventLoop: { ...this.eventLoop },
      eventLoopDelay: this.eventLoopSnapshot(),
      telemetry: this.telemetrySnapshot(),
    };
  }

  close() {
    if (this._eventLoopHistogram) {
      try {
        this._eventLoopHistogram.disable();
      } catch {
        /* already disabled */
      }
      this._eventLoopHistogram = null;
    }
    this.eventLoop = { enabled: false, resolutionMs: 0 };
  }
}
