/**
 * NARIMATO — INFINITE GRID authoritative server (SPEC_INFINITE.md §2).
 *
 * Zero npm dependencies. Responsibilities:
 *   - static serving of `public/` (traversal-safe, MIME, no-store html/js/css)
 *   - REST: /api/join, /api/action, /api/state, /api/world, /api/leaderboard,
 *     /api/health, /api/metrics (observability), /api/telemetry (privacy-safe client beacons)
 *   - SSE: /api/events?token=… (snapshot{state,leaves,focus}, throttled state ~1/s +
 *     on player changes, cell, break, resource, surface <= 10 Hz, surface_leave,
 *     surface_mine, supply, supply_focus, toast, `:hb` heartbeat every 15s)
 *   - persistent world in DATA_DIR/world.json (via lib/world-core.js), saved
 *     debounced and flushed on shutdown
 *   - graceful SIGINT/SIGTERM shutdown
 *
 * Importable: `startServer()` returns `{server, core, app, config, port, host,
 * url, close()}` (works with port 0). The process only auto-listens when this
 * file is the entry module (`node server.js`).
 */
import http from 'node:http';
import fsp from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveConfig } from './lib/world-core.js';
import { PlanetManager } from './lib/planet-manager.js';
import { Metrics } from './lib/metrics.js';
import { RateLimiter } from './lib/rate-limit.js';
import {
  checkOrigin,
  checkTelemetryOrigin,
  clientIp,
  hasDotfileSegment,
  isPathInside,
  requestIsHttps,
  resolveSecurityConfig,
  securityHeadersFor,
} from './lib/security.js';

const MODULE_FILE = fileURLToPath(import.meta.url);
export const PUBLIC_DIR = path.join(path.dirname(MODULE_FILE), 'public');
const PACKAGE_JSON_URL = new URL('./package.json', import.meta.url);

/** Read the single app version declaration once at boot (never per request). */
export async function readAppVersion() {
  try {
    const pkg = JSON.parse(await fsp.readFile(PACKAGE_JSON_URL, 'utf8'));
    return typeof pkg.version === 'string' && pkg.version ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** Hard cap for JSON request bodies (~16KB). */
export const MAX_BODY_BYTES = 16 * 1024;
const PUMP_MS = 100;
const STATE_INTERVAL_MS = 1000; // "~1/s"; player changes force an immediate state
const HEARTBEAT_MS = 15_000;
const SSE_BACKPRESSURE_BYTES = 1024 * 1024;
/** Strict body cap for client telemetry beacons (tiny numeric payloads only). */
export const TELEMETRY_BODY_BYTES = 4096;
/** Retry-After advertised when SSE admission refuses a stream (SEC-01). */
export const SSE_REFUSED_RETRY_AFTER_SECONDS = 30;

const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.wasm': 'application/wasm',
});

const NO_STORE_EXTENSIONS = new Set(['.html', '.htm', '.js', '.mjs', '.css', '.json', '.map', '.webmanifest']);

function httpError(code, message, statusCode = 400) {
  const err = new Error(message);
  err.code = code;
  err.statusCode = statusCode;
  return err;
}

function sendBuffer(res, status, headers, body) {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  res.writeHead(status, { ...headers, 'Content-Length': buffer.length });
  if (res.req && res.req.method === 'HEAD') {
    res.end();
    return;
  }
  res.end(buffer);
}

function sendJson(res, status, payload, extraHeaders = {}) {
  sendBuffer(
    res,
    status,
    {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
    JSON.stringify(payload),
  );
}

function sendText(res, status, text) {
  sendBuffer(
    res,
    status,
    {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
    text,
  );
}

/** Read and parse a JSON request body, rejecting bodies over `maxBytes`. */
function readJsonBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let overflowed = false;
    req.on('data', (chunk) => {
      if (overflowed) return;
      size += chunk.length;
      if (size > maxBytes) {
        overflowed = true;
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (overflowed) {
        reject(httpError('PAYLOAD_TOO_LARGE', `Request body must be at most ${maxBytes} bytes.`, 413));
        return;
      }
      const text = Buffer.concat(chunks).toString('utf8').trim();
      if (!text) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(text);
        resolve(parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {});
      } catch {
        reject(httpError('INVALID_JSON', 'Request body must be valid JSON.', 400));
      }
    });
    req.on('error', (err) => reject(err));
  });
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** HTTP + SSE application around a WorldCore instance. */
export class InfiniteServerApp {
  constructor({
    manager,
    config,
    publicDir = PUBLIC_DIR,
    now = Date.now,
    quiet = false,
    metrics = null,
    assetBaseUrl = '',
    appVersion = '0.0.0',
    security = null,
  } = {}) {
    this.manager = manager;
    this.config = config;
    this.appVersion = typeof appVersion === 'string' && appVersion ? appVersion : '0.0.0';
    this.assetBaseUrl = typeof assetBaseUrl === 'string' ? assetBaseUrl.replace(/\/+$/, '') : '';
    this.metrics = metrics || new Metrics({ now });
    this.security = security || resolveSecurityConfig({});
    this.publicDir = publicDir;
    this.now = typeof now === 'function' ? now : Date.now;
    this.limiter = new RateLimiter({ now: this.now });
    /** @type {Map<string, number>} per-address SSE stream counts (memory only, never exported) */
    this._ssePerIp = new Map();
    this.quiet = !!quiet;
    this.startedAt = this.now();
    /** @type {Set<{res: import('node:http').ServerResponse, playerId: string, dead: boolean}>} */
    this.clients = new Set();
    this._closed = false;
    /** @type {Map<number, {lastStateAt:number,lastRevision:number}>} */
    this._planetState = new Map();
    this._pumpTimer = null;
    this._heartbeatTimer = null;
  }

  start() {
    if (this._pumpTimer) return;
    this._pumpTimer = setInterval(() => this.pump(), PUMP_MS);
    this._pumpTimer.unref?.();
    this._heartbeatTimer = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
    this._heartbeatTimer.unref?.();
  }

  async close() {
    this._closed = true;
    if (this._pumpTimer) clearInterval(this._pumpTimer);
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    this._pumpTimer = null;
    this._heartbeatTimer = null;
    for (const client of [...this.clients]) {
      client.dead = true;
      if (!client.metricsCounted) {
        client.metricsCounted = true;
        this.metrics.sseClosed(client.planetIndex, { dropped: false });
      }
      try {
        client.res.end();
      } catch {
        /* already gone */
      }
    }
    this.clients.clear();
    this.metrics.close();
  }

  // ------------------------------------------------------------------ routing

  async handle(req, res) {
    const method = (req.method || 'GET').toUpperCase();
    const requestPath = typeof req.url === 'string' ? req.url.split('?')[0] : '/';
    const startedAt = this.now();
    let recorded = false;
    const finalize = (status) => {
      if (recorded) return;
      recorded = true;
      this.metrics.recordRequest({
        method,
        pathname: requestPath,
        status: Number.isInteger(status) ? status : 0,
        durationMs: this.now() - startedAt,
        // SSE connections are counted as connections, not HTTP latency samples.
        sse: requestPath.startsWith('/api/events'),
      });
    };
    this.metrics.beginRequest();
    res.on('finish', () => finalize(res.statusCode));
    res.on('close', () => finalize(res.statusCode));
    try {
      let url;
      try {
        url = new URL(req.url || '/', 'http://localhost');
      } catch {
        sendText(res, 400, 'Bad request');
        return;
      }
      const pathname = url.pathname;
      const ip = clientIp(req, this.security);
      // Header policy runs before routing so every response (including 403/413/429
      // and static errors) carries the same security headers.
      this._applySecurityHeaders(req, res);

      if (pathname === '/api/health') {
        if (!this._allow(method, res, ['GET', 'HEAD'], true)) return;
        sendJson(res, 200, { ok: true, appVersion: this.appVersion, ...this.manager.health() });
        return;
      }
      if (pathname === '/api/state') {
        if (!this._allow(method, res, ['GET', 'HEAD'], true)) return;
        const view = await this.manager.routedView(url.searchParams.get('token'), 'state');
        sendJson(res, 200, { ok: true, state: view.state });
        return;
      }
      if (pathname === '/api/world') {
        if (!this._allow(method, res, ['GET', 'HEAD'], true)) return;
        const view = await this.manager.routedView(url.searchParams.get('token'), 'world');
        sendJson(res, 200, { ok: true, state: view.state, leaves: view.leaves });
        return;
      }
      if (pathname === '/api/leaderboard') {
        if (!this._allow(method, res, ['GET', 'HEAD'], true)) return;
        const view = await this.manager.routedView(url.searchParams.get('token'), 'leaderboard');
        sendJson(res, 200, { ok: true, leaderboard: view.leaderboard });
        return;
      }
      if (pathname === '/api/join') {
        if (!this._allow(method, res, ['POST'], true)) return;
        if (!this._guardOrigin(req, res, 'write')) return;
        if (!this._guardLimit(req, res, ip, 'join')) return;
        await this._handleJoin(req, res);
        return;
      }
      if (pathname === '/api/action') {
        if (!this._allow(method, res, ['POST'], true)) return;
        if (!this._guardOrigin(req, res, 'write')) return;
        // The per-address bucket runs before body parsing; the per-token bucket
        // runs in `_handleAction` once the token is known.
        if (!this._guardLimit(req, res, ip, 'actionIp')) return;
        await this._handleAction(req, res);
        return;
      }
      if (pathname === '/api/events') {
        if (!this._allow(method, res, ['GET'], true)) return;
        if (!this._guardOrigin(req, res, 'read')) return;
        await this._handleEvents(req, res, url, ip);
        return;
      }

      if (pathname === '/api/metrics') {
        if (!this._allow(method, res, ['GET', 'HEAD'], true)) return;
        sendJson(res, 200, this.metricsSnapshot());
        return;
      }
      if (pathname === '/api/telemetry') {
        if (!this._allow(method, res, ['GET', 'HEAD', 'POST'], true)) return;
        if (method === 'POST') {
          if (!this._guardOrigin(req, res, 'telemetry')) return;
          await this._handleTelemetry(req, res, ip);
          return;
        }
        sendJson(res, 200, { ok: true, telemetry: this.metrics.telemetrySnapshot() });
        return;
      }

      if (pathname.startsWith('/api/')) {
        sendJson(res, 404, { ok: false, error: 'NOT_FOUND', message: 'Unknown API endpoint.' });
        return;
      }

      await this._serveStatic(req, res, pathname);
    } catch (err) {
      if (err && err.code === 'PAYLOAD_TOO_LARGE') {
        this.metrics.recordSecurity('bodyTooLarge');
        sendJson(res, 413, { ok: false, error: 'PAYLOAD_TOO_LARGE', message: err.message });
        return;
      }
      if (err && err.code === 'INVALID_JSON') {
        sendJson(res, 400, { ok: false, error: 'INVALID_JSON', message: err.message });
        return;
      }
      if (!this.quiet) console.error('[server] request failed:', err?.stack || err);
      if (!res.headersSent) {
        sendJson(res, 500, { ok: false, error: 'INTERNAL_ERROR', message: 'Internal server error.' });
      } else {
        try {
          res.end();
        } catch {
          /* socket already gone */
        }
      }
    }
  }

  _allow(method, res, allowed, json) {
    if (allowed.includes(method)) return true;
    if (json) sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED', message: `Use ${allowed.join(' or ')}.` });
    else sendText(res, 405, 'Method not allowed');
    return false;
  }

  // ------------------------------------------------------------ security policy

  /** Attach the header policy (CSP/HSTS/referrer/permissions) to this response. */
  _applySecurityHeaders(req, res) {
    const headers = securityHeadersFor(this.security, {
      assetBaseUrl: this.assetBaseUrl,
      https: requestIsHttps(req, this.security),
    });
    for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  }

  /**
   * Origin policy. `kind` is `write` (join/action), `read` (SSE) or `telemetry`.
   * Rejections are counted as `crossOrigin` and never echo the received Origin.
   */
  _guardOrigin(req, res, kind) {
    if (kind === 'telemetry') {
      const verdict = checkTelemetryOrigin({ origin: req.headers.origin, host: req.headers.host });
      if (verdict.ok) return true;
      this.metrics.recordSecurity('crossOrigin');
      sendJson(res, 403, { ok: false, error: 'CROSS_ORIGIN', message: 'Telemetry must be same-origin.' });
      return false;
    }
    const verdict = checkOrigin({
      origin: req.headers.origin,
      host: req.headers.host,
      method: req.method,
      config: this.security,
    });
    if (verdict.ok) return true;
    this.metrics.recordSecurity('crossOrigin');
    sendJson(res, 403, { ok: false, error: 'CROSS_ORIGIN', message: 'Cross-origin request refused.' });
    return false;
  }

  /** Apply one named limiter rule to `key`; enforce mode only (telemetry is separate). */
  _guardLimit(req, res, key, ruleName) {
    if (this.security.mode !== 'enforce') return true;
    const rule = this.security.limits[ruleName];
    const verdict = this.limiter.allow(rule, key);
    if (verdict.ok) return true;
    this.metrics.recordSecurity('rateLimited');
    this._sendRateLimited(res, verdict.retryAfterMs);
    return false;
  }

  _sendRateLimited(res, retryAfterMs) {
    const waitMs = Number.isFinite(retryAfterMs) ? Math.max(1, retryAfterMs) : 1000;
    sendJson(
      res,
      429,
      { ok: false, error: 'RATE_LIMITED', message: 'Too many requests — retry shortly.', retryAfterMs: waitMs },
      { 'Retry-After': String(Math.max(1, Math.ceil(waitMs / 1000))) },
    );
  }

  /**
   * SSE admission (enforce mode): one stream per token replaces the previous
   * connection; otherwise per-IP and global caps apply. Refusals are 429 with a
   * 30 s Retry-After so clients stop auto-retrying.
   */
  _admitSse(req, res, token, ip) {
    if (this.security.mode !== 'enforce') return true;
    for (const client of [...this.clients]) {
      if (client.token !== token) continue;
      this._removeClient(client, { end: true });
      this.metrics.recordSecurity('sseReplaced');
    }
    const perIp = this._ssePerIp.get(ip) || 0;
    const refuse =
      (this.security.maxSsePerIp > 0 && perIp >= this.security.maxSsePerIp) ||
      (this.security.maxSseGlobal > 0 && this.clients.size >= this.security.maxSseGlobal);
    if (!refuse) return true;
    this.metrics.recordSecurity('sseRefused');
    sendJson(
      res,
      429,
      { ok: false, error: 'RATE_LIMITED', message: 'Too many event streams — retry shortly.', retryAfterMs: SSE_REFUSED_RETRY_AFTER_SECONDS * 1000 },
      { 'Retry-After': String(SSE_REFUSED_RETRY_AFTER_SECONDS) },
    );
    return false;
  }

  // ------------------------------------------------------------------- routes

  async _handleJoin(req, res) {
    const body = await readJsonBody(req);
    const result = await this.manager.join({ tag: body.tag, token: body.token });
    if (!result.ok) {
      sendJson(res, 409, { ok: false, error: result.error, message: result.message });
      return;
    }
    this.pump(); // broadcast the new player/online change immediately
    sendJson(res, 200, result);
  }

  async _handleAction(req, res) {
    const body = await readJsonBody(req);
    const type = typeof body.type === 'string' ? body.type.trim().toLowerCase() : '';
    if (!this._guardLimit(req, res, `token:${typeof body.token === 'string' ? body.token : ''}`, 'action')) return;

    if (type === 'escape') {
      const result = await this.manager.escape({ token: body.token });
      if (!result.ok) {
        sendJson(res, 409, {
          ok: false,
          error: result.error,
          message: result.message,
          ...(result.mission ? { mission: result.mission } : {}),
        });
        return;
      }
      // The pilot now belongs to the next planet: stop the old-planet stream so
      // the client reconnects to the new room.
      this._closeStreamsForToken(result.token, result.planetIndex);
      this.pump();
      sendJson(res, 200, result);
      return;
    }

    if (type === 'surface' || type === 'surface_leave') {
      const result = type === 'surface'
        ? await this.manager.surfacePose({
            token: body.token,
            pos: body.pos,
            heading: body.heading,
            state: body.state,
            moving: body.moving,
          })
        : await this.manager.surfaceLeave({ token: body.token });
      if (!result.ok) {
        sendJson(res, 409, { ok: false, error: result.error, message: result.message });
        return;
      }
      // The pump owns both the coalesced `surface` frame (<= 10 Hz per player)
      // and the one-shot `surface_leave`; never fan out directly from the request.
      this.pump();
      if (type === 'surface_leave') {
        sendJson(res, 200, { ok: true, planetIndex: result.planetIndex, playerId: result.playerId });
        return;
      }
      sendJson(res, 200, {
        ok: true,
        planetIndex: result.planetIndex,
        playerId: result.playerId,
        leaf: result.leaf,
        pos: result.pos,
        heading: result.heading,
        bearingRad: result.bearingRad,
        state: result.state,
        moving: result.moving,
        rev: result.rev,
        updatedAt: result.updatedAt,
      });
      return;
    }

    if (type === 'supply') {
      const result = await this.manager.emergencySupply({ token: body.token, label: body.label });
      if (!result.ok) {
        sendJson(res, 409, {
          ok: false,
          error: result.error,
          message: result.message,
          ...(result.readyInMs !== undefined ? { readyInMs: result.readyInMs } : {}),
          ...(result.mission ? { mission: result.mission } : {}),
        });
        return;
      }
      this._broadcastToRoom(result.planetIndex, {
        type: 'supply',
        impactLabel: result.impactLabel,
        cells: result.cells,
        resources: result.resources,
        message: result.message,
        playerId: result.playerId,
      });
      // SRV-04: the additive focus frame carries one placement per online human
      // and converges reconnect via `snapshot.focus` / the join response.
      if (result.focus) {
        this._broadcastSupplyFocus(result.planetIndex, {
          type: 'supply_focus',
          impactLabel: result.impactLabel,
          impactPos: result.focus.impactPos,
          cells: result.focus.cells,
          resources: result.focus.resources,
          placements: result.focus.placements,
          rev: result.focus.rev,
          expiresAt: result.focus.expiresAt,
          message: result.focus.message,
        });
      }
      this.pump();
      sendJson(res, 200, {
        ok: true,
        planetIndex: result.planetIndex,
        impactLabel: result.impactLabel,
        cells: result.cells,
        resources: result.resources,
        message: result.message,
        playerId: result.playerId,
        placements: result.placements,
        rev: result.rev,
        expiresAt: result.expiresAt,
        focus: result.focus,
        mission: result.mission,
        state: result.state,
        leaves: result.leaves,
      });
      return;
    }

    if (type !== 'click') {
      sendJson(res, 400, { ok: false, error: 'INVALID_ACTION', message: 'Action type must be "click", "escape", "supply", "surface" or "surface_leave".' });
      return;
    }
    const routed = await this.manager.click({ token: body.token, label: body.label });
    if (!routed.result.ok) {
      sendJson(res, 409, { ok: false, error: routed.result.error, message: routed.result.message });
      return;
    }
    if (routed.meteor) this._broadcastMeteor(routed.index, routed.meteor);
    // Broadcast cell/break/resource events (and any pending state) before responding.
    this.pump();
    sendJson(res, 200, routed.result);
  }

  // ---------------------------------------------------- observability / telemetry

  /** Read-only per-planet aggregates — never tokens/tags/ids/hidden deposits. */
  metricsSnapshot() {
    const planets = this.manager.loadedPlanets().map(({ index, core }) => ({
      index,
      name: this.manager.name(index),
      depth: this.manager.depth(index),
      playersOnline: core.onlineHumanCount(),
      playersTotal: core.players.length,
      robots: core.robotInfos().length,
      posesLive: core.poseCount,
      robotReplans: core.robotReplanCount,
      robotMineRejected: core.robotMineRejectedCount,
      supplyDrops: core.supplyDropCount,
      faces: core.leafCount,
      clicks: core.totalClicks,
      breaks: core.totalBreaks,
      maxDepthReached: core.maxDepthReached,
      revision: core.revision,
    }));
    const snapshot = this.metrics.snapshot({
      planets,
      uptimeMs: this.now() - this.startedAt,
      generatedAt: this.now(),
    });
    snapshot.security.mode = this.security.mode;
    return snapshot;
  }

  async _handleTelemetry(req, res, ip) {
    let body;
    try {
      body = await readJsonBody(req, TELEMETRY_BODY_BYTES);
    } catch (err) {
      const status = err && err.code === 'PAYLOAD_TOO_LARGE' ? 413 : 400;
      if (status === 413) this.metrics.recordSecurity('bodyTooLarge');
      sendJson(res, status, {
        ok: false,
        error: err && err.code ? err.code : 'INVALID_JSON',
        message: err && err.message ? err.message : 'Invalid telemetry payload.',
      });
      return;
    }
    // The telemetry bucket keeps its per-IP cap in every mode (compat parity).
    const verdict = this.limiter.allow(this.security.limits.telemetry, `ip:${ip}`);
    if (!verdict.ok) {
      this.metrics.recordSecurity('rateLimited');
      this._sendRateLimited(res, verdict.retryAfterMs);
      return;
    }
    const result = this.metrics.recordTelemetry(body);
    sendJson(res, 200, { ok: true, accepted: result.accepted });
  }

  // --------------------------------------------------------------------- SSE

  async _handleEvents(req, res, url, ip) {
    const token = url.searchParams.get('token');
    const { index, core } = await this.manager.coreForToken(token);
    const playerId = core.getPlayerIdByToken(token);
    if (!playerId) {
      // Token guessing resistance: failed attempts are counted and rate limited
      // per address (enforce mode). The response never reveals which part failed.
      if (this.security.mode === 'enforce') {
        const verdict = this.limiter.allow(this.security.limits.auth, `auth:${ip}`);
        if (!verdict.ok) {
          this.metrics.recordSecurity('rateLimited');
          this._sendRateLimited(res, verdict.retryAfterMs);
          return;
        }
      }
      this.metrics.recordSecurity('authFailures');
      sendJson(res, 401, {
        ok: false,
        error: 'INVALID_TOKEN',
        message: 'Missing or invalid token — POST /api/join first.',
      });
      return;
    }
    if (!this._admitSse(req, res, token, ip)) return;

    this.metrics.recordRoute('/api/events');
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 1500\n\n');

    const client = { res, playerId, token, ip, planetIndex: index, dead: false, metricsCounted: false };
    this.clients.add(client);
    this._ssePerIp.set(ip, (this._ssePerIp.get(ip) || 0) + 1);
    this.metrics.sseOpened(index);
    core.setOnline(playerId, true);

    const snapshot = {
      type: 'snapshot',
      state: this.manager.decorateState(core.getState(), index),
      leaves: core.getLeaves(),
      focus: core.getFocus(),
    };
    this._writeClient(client, `data: ${JSON.stringify(snapshot)}\n\n`);

    res.on('close', () => this._removeClient(client));
    res.on('error', () => this._removeClient(client));
    req.on('error', () => this._removeClient(client));

    // Announce the presence change to everyone (including a fresh state frame).
    this.pump();
  }

  _writeClient(client, payload) {
    const res = client.res;
    if (client.dead || res.writableEnded || res.destroyed) {
      this._removeClient(client);
      return false;
    }
    if (res.writableLength > SSE_BACKPRESSURE_BYTES) {
      // Slow/stalled consumer: drop it instead of buffering unbounded state.
      this._removeClient(client, { end: true });
      return false;
    }
    try {
      res.write(payload);
      return true;
    } catch {
      this._removeClient(client, { end: true });
      return false;
    }
  }

  _removeClient(client, { end = false } = {}) {
    if (!client || client.dead) return;
    client.dead = true;
    this.clients.delete(client);
    const perIp = (this._ssePerIp.get(client.ip) || 0) - 1;
    if (perIp > 0) this._ssePerIp.set(client.ip, perIp);
    else this._ssePerIp.delete(client.ip);
    if (!client.metricsCounted) {
      client.metricsCounted = true;
      this.metrics.sseClosed(client.planetIndex, { dropped: !!end });
    }
    if (end) {
      try {
        client.res.end();
      } catch {
        /* already closed */
      }
    }
    if (this._closed) return;
    const stillConnected = [...this.clients].some(
      (other) => other.playerId === client.playerId && other.planetIndex === client.planetIndex,
    );
    if (!stillConnected) {
      const core = this.manager.planetCore(client.planetIndex);
      if (core && core.setOnline(client.playerId, false)) {
        // SRV-01: a closed tab leaves no ghost body in `state`.
        core.clearSurfacePose(client.playerId, 'disconnect');
        this.pump();
      }
    }
  }

  heartbeat() {
    for (const client of [...this.clients]) this._writeClient(client, ':hb\n\n');
  }

  // ------------------------------------------------------------------- pump

  /** Clients subscribed to one planet room. */
  _roomClients(index) {
    return [...this.clients].filter((client) => client.planetIndex === index);
  }

  _broadcastToRoom(index, payloadObject) {
    const clients = this._roomClients(index);
    if (!clients.length) return { sent: 0, failed: 0 };
    const payload = `data: ${JSON.stringify(payloadObject)}\n\n`;
    let sent = 0;
    let failed = 0;
    for (const client of clients) {
      if (this._writeClient(client, payload)) sent += 1;
      else failed += 1;
    }
    return { sent, failed };
  }

  /**
   * Supply focus converges even when the first frame write fails: one retry
   * after 250 ms; `snapshot.focus` and the join response are the final fallback.
   */
  _broadcastSupplyFocus(index, payloadObject, retries = 1) {
    const attempt = (remaining) => {
      if (this._closed) return;
      const { failed } = this._broadcastToRoom(index, payloadObject);
      if (failed > 0 && remaining > 0) {
        const timer = setTimeout(() => attempt(remaining - 1), 250);
        timer.unref?.();
      }
    };
    attempt(retries);
  }

  /** Meteor reset: event + fresh snapshot to the affected planet room only. */
  _broadcastMeteor(index, meteor) {
    const core = this.manager.planetCore(index);
    if (!core) return;
    this._broadcastToRoom(index, { ...meteor.event, planetIndex: index });
    this._broadcastToRoom(index, {
      type: 'snapshot',
      state: this.manager.decorateState(core.getState(), index),
      leaves: core.getLeaves(),
    });
  }

  /** End every SSE stream for a token that is not in `planetIndex` (escape). */
  _closeStreamsForToken(token, planetIndex) {
    for (const client of [...this.clients]) {
      if (client.token !== token) continue;
      if (client.planetIndex === planetIndex) continue;
      this._removeClient(client, { end: true });
    }
  }

  /** Drain every loaded planet's events, then emit throttled per-room state. */
  pump() {
    if (this._closed) return;

    // Advance robot controllers on all loaded planets.
    this.manager.tick(this.now());

    for (const { index, core } of this.manager.loadedPlanets()) {
      const events = core.drainEvents();
      if (events.length) for (const event of events) this._broadcastToRoom(index, event);

      // Coalesced surface frames (humans + robots share one stream) after the
      // per-planet robot tick that `manager.tick()` already performed.
      const frames = core.flushPoses(this.now());
      for (const frame of frames) this._broadcastToRoom(index, frame);
      // Expiry leaves are emitted by the sweep above; publish them in this pump
      // so a silent body disappears without waiting for another tick.
      const expired = core.drainEvents();
      if (expired.length) for (const event of expired) this._broadcastToRoom(index, event);

      let tracker = this._planetState.get(index);
      if (!tracker) {
        tracker = { lastStateAt: 0, lastRevision: -1 };
        this._planetState.set(index, tracker);
      }
      const revision = core.revision;
      if (revision === tracker.lastRevision) continue;
      const urgent = core.peekStateUrgent();
      const at = this.now();
      if (!urgent && at - tracker.lastStateAt < STATE_INTERVAL_MS) continue;
      tracker.lastStateAt = at;
      tracker.lastRevision = revision;
      core.clearStateUrgent();
      const clients = this._roomClients(index);
      if (!clients.length) continue;
      const payload = `data: ${JSON.stringify({
        type: 'state',
        state: this.manager.decorateState(core.getState(), index),
      })}\n\n`;
      for (const client of clients) this._writeClient(client, payload);
    }
  }

  // ------------------------------------------------------------------ static

  async _serveStatic(req, res, pathname) {
    const method = (req.method || 'GET').toUpperCase();
    if (!this._allow(method, res, ['GET', 'HEAD'], false)) return;

    const denied = () => {
      this.metrics.recordSecurity('traversalBlocked');
      sendText(res, 404, 'Not found');
    };
    const decoded = safeDecode(pathname);
    if (decoded === null || decoded.includes('\0') || decoded.includes('\\')) {
      denied();
      return;
    }
    // Dotfiles (`.env`, `.git`, `.DS_Store`, …) are never served.
    if (decoded.split('/').includes('..') || hasDotfileSegment(decoded)) {
      denied();
      return;
    }

    const root = path.resolve(this.publicDir);
    let realRoot;
    try {
      realRoot = await fsp.realpath(root);
    } catch {
      realRoot = root;
    }
    let rel = path.posix.normalize(decoded).replace(/^\/+/, '');
    if (rel === '' || rel === '.' || rel.endsWith('/')) rel = `${rel}index.html`;
    const resolved = path.resolve(root, rel);
    if (!isPathInside(root, resolved)) {
      denied();
      return;
    }

    let filePath;
    let stat;
    try {
      // realpath containment: a symlink inside public/ must not escape it.
      filePath = await fsp.realpath(resolved);
      if (!isPathInside(realRoot, filePath)) {
        denied();
        return;
      }
      stat = await fsp.stat(filePath);
      if (stat.isDirectory()) {
        filePath = await fsp.realpath(path.join(filePath, 'index.html'));
        if (!isPathInside(realRoot, filePath)) {
          denied();
          return;
        }
        stat = await fsp.stat(filePath);
      }
    } catch {
      // Missing files are a plain 404, not an attack signature.
      sendText(res, 404, 'Not found');
      return;
    }
    if (!stat.isFile()) {
      sendText(res, 404, 'Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    // Optional CDN asset base: rewrite the asset-base meta tag at serve time.
    if (ext === '.html' && this.assetBaseUrl) {
      const html = await fsp.readFile(filePath, 'utf8');
      const escaped = this.assetBaseUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const body = html.replace(
        /(<meta name="narimato-asset-base" content=")[^"]*(")/,
        `$1${escaped}$2`,
      );
      res.writeHead(200, {
        'Content-Type': mime,
        'Content-Length': Buffer.byteLength(body),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      if (method === 'HEAD') res.end();
      else res.end(body);
      return;
    }
    const cacheControl =
      ext === '.m4a'
        ? 'public, max-age=31536000, immutable'
        : NO_STORE_EXTENSIONS.has(ext)
          ? 'no-store'
          : 'public, max-age=3600';
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': stat.size,
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff',
    });
    if (method === 'HEAD') {
      res.end();
      return;
    }
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      try {
        res.destroy();
      } catch {
        /* already gone */
      }
    });
    stream.pipe(res);
  }
}

/**
 * Boot a fully wired infinite-grid server. Binds `config.port` (pass 0 for an
 * ephemeral port) and returns `{server, core, app, config, port, host, url,
 * close()}`. Never auto-listens; `node server.js` handles that below.
 */
export async function startServer(options = {}) {
  const env = options.env || process.env;
  const overrides = { ...(options.config || {}) };
  if (options.port !== undefined && options.port !== null) overrides.port = options.port;
  if (options.host !== undefined && options.host !== null) overrides.host = options.host;
  if (options.dataDir !== undefined && options.dataDir !== null) overrides.dataDir = options.dataDir;
  const config = resolveConfig(env, overrides);
  const now = typeof options.now === 'function' ? options.now : Date.now;

  const rng = typeof options.rng === 'function' ? options.rng : Math.random;
  const manager = await PlanetManager.open({
    dataDir: config.dataDir,
    config,
    now,
    rng,
    quiet: options.quiet === true,
    autoSave: options.autoSave !== false,
  });
  // Backward compatible handle: `core` is planet 0's WorldCore.
  const core = manager.planetCore(0);

  const metrics = new Metrics({
    now,
    eventLoop: options.metricsEventLoop !== false,
    eventLoopResolutionMs: options.metricsEventLoopResolutionMs || 20,
  });

  // SEC-01: resolve the header/origin/limit policy once at boot. `SECURITY_MODE`
  // and the other env vars are honoured; tests may inject `options.security`.
  const securityOverrides = {
    ...(options.security && typeof options.security === 'object' ? options.security : {}),
    clickCooldownMs: config.clickCooldownMs,
  };
  if (options.securityMode !== undefined) securityOverrides.mode = options.securityMode;
  if (options.telemetryRateLimit) {
    securityOverrides.limits = {
      ...(securityOverrides.limits || {}),
      telemetry: { ...((securityOverrides.limits || {}).telemetry || {}), ...options.telemetryRateLimit },
    };
  }
  const security = resolveSecurityConfig(env, securityOverrides);

  const appVersion = typeof options.appVersion === 'string' ? options.appVersion : await readAppVersion();
  const app = new InfiniteServerApp({
    manager,
    config,
    now,
    publicDir: options.publicDir || PUBLIC_DIR,
    quiet: options.quiet === true,
    metrics,
    assetBaseUrl: options.assetBaseUrl ?? env.ASSET_BASE_URL ?? '',
    appVersion,
    security,
  });

  const server = http.createServer((req, res) => {
    void app.handle(req, res);
  });
  server.on('clientError', (err, socket) => {
    if (!socket.destroyed) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  });

  await new Promise((resolve, reject) => {
    const onError = (err) => {
      server.removeListener('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      server.removeListener('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(config.port, config.host);
  });

  const address = server.address();
  const port = address && typeof address === 'object' ? address.port : config.port;
  config.port = port;
  app.start();

  const displayHost = config.host === '0.0.0.0' || config.host === '::' ? 'localhost' : config.host;
  let closed = false;
  const handle = {
    server,
    core,
    manager,
    app,
    metrics,
    security,
    config,
    dataDir: config.dataDir,
    port,
    host: config.host,
    url: `http://${displayHost}:${port}`,
    async close() {
      if (closed) return;
      closed = true;
      await app.close();
      await manager.close();
      await new Promise((resolve) => {
        let settled = false;
        const finish = () => {
          if (!settled) {
            settled = true;
            resolve();
          }
        };
        server.close(finish);
        server.closeIdleConnections?.();
        const forced = setTimeout(() => {
          server.closeAllConnections?.();
          finish();
        }, 250);
        forced.unref?.();
      });
    },
  };
  return handle;
}

const isMainModule = (() => {
  try {
    const entry = process.argv[1];
    if (!entry) return false;
    return path.resolve(entry) === path.resolve(MODULE_FILE);
  } catch {
    return false;
  }
})();

if (isMainModule) {
  startServer()
    .then((handle) => {
      const { config } = handle;
      console.log('NARIMATO // INFINITE GRID server online');
      console.log(`  url:       ${handle.url}`);
      console.log(`  data dir:  ${config.dataDir} (world.json + planets/p<i>/ + planets/registry.json)`);
      console.log(
        `  planets:   ICOSA-9 depth ${handle.manager.depth(0)} // threshold ${config.breakClicks} clicks // click cooldown ${config.clickCooldownMs}ms`,
      );
      console.log(`  registry:  ${path.join(config.dataDir, 'planets', 'registry.json')}`);
      let shuttingDown = false;
      const shutdown = async (signal) => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log(`\n[server] ${signal} received — saving world and shutting down…`);
        const force = setTimeout(() => process.exit(1), 5000);
        force.unref?.();
        try {
          await handle.close();
          console.log('[server] world saved. bye.');
        } catch (err) {
          console.error('[server] shutdown error:', err?.message || err);
        } finally {
          clearTimeout(force);
          process.exit(0);
        }
      };
      process.on('SIGINT', () => void shutdown('SIGINT'));
      process.on('SIGTERM', () => void shutdown('SIGTERM'));
    })
    .catch((err) => {
      console.error('[server] failed to start:', err?.stack || err);
      process.exit(1);
    });
}
