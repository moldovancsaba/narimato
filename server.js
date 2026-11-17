/**
 * NARIMATO — INFINITE GRID authoritative server (SPEC_INFINITE.md §2).
 *
 * Zero npm dependencies. Responsibilities:
 *   - static serving of `public/` (traversal-safe, MIME, no-store html/js/css)
 *   - REST: /api/join, /api/action, /api/state, /api/world, /api/leaderboard,
 *     /api/health
 *   - SSE: /api/events?token=… (snapshot{state,leaves}, throttled state ~1/s +
 *     on player changes, cell, break, toast, `:hb` heartbeat every 15s)
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

const MODULE_FILE = fileURLToPath(import.meta.url);
export const PUBLIC_DIR = path.join(path.dirname(MODULE_FILE), 'public');

/** Hard cap for JSON request bodies (~16KB). */
export const MAX_BODY_BYTES = 16 * 1024;
const PUMP_MS = 100;
const STATE_INTERVAL_MS = 1000; // "~1/s"; player changes force an immediate state
const HEARTBEAT_MS = 15_000;
const SSE_BACKPRESSURE_BYTES = 1024 * 1024;

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
  constructor({ manager, config, publicDir = PUBLIC_DIR, now = Date.now, quiet = false } = {}) {
    this.manager = manager;
    this.config = config;
    this.publicDir = publicDir;
    this.now = typeof now === 'function' ? now : Date.now;
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
      try {
        client.res.end();
      } catch {
        /* already gone */
      }
    }
    this.clients.clear();
  }

  // ------------------------------------------------------------------ routing

  async handle(req, res) {
    try {
      const method = (req.method || 'GET').toUpperCase();
      let url;
      try {
        url = new URL(req.url || '/', 'http://localhost');
      } catch {
        sendText(res, 400, 'Bad request');
        return;
      }
      const pathname = url.pathname;

      if (pathname === '/api/health') {
        if (!this._allow(method, res, ['GET', 'HEAD'], true)) return;
        sendJson(res, 200, { ok: true, ...this.manager.health() });
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
        await this._handleJoin(req, res);
        return;
      }
      if (pathname === '/api/action') {
        if (!this._allow(method, res, ['POST'], true)) return;
        await this._handleAction(req, res);
        return;
      }
      if (pathname === '/api/events') {
        if (!this._allow(method, res, ['GET'], true)) return;
        await this._handleEvents(req, res, url);
        return;
      }

      if (pathname.startsWith('/api/')) {
        sendJson(res, 404, { ok: false, error: 'NOT_FOUND', message: 'Unknown API endpoint.' });
        return;
      }

      await this._serveStatic(req, res, pathname);
    } catch (err) {
      if (err && err.code === 'PAYLOAD_TOO_LARGE') {
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

    if (type !== 'click') {
      sendJson(res, 400, { ok: false, error: 'INVALID_ACTION', message: 'Action type must be "click" or "escape".' });
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

  // --------------------------------------------------------------------- SSE

  async _handleEvents(req, res, url) {
    const token = url.searchParams.get('token');
    const { index, core } = await this.manager.coreForToken(token);
    const playerId = core.getPlayerIdByToken(token);
    if (!playerId) {
      sendJson(res, 401, {
        ok: false,
        error: 'INVALID_TOKEN',
        message: 'Missing or invalid token — POST /api/join first.',
      });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 1500\n\n');

    const client = { res, playerId, token, planetIndex: index, dead: false };
    this.clients.add(client);
    core.setOnline(playerId, true);

    const snapshot = {
      type: 'snapshot',
      state: this.manager.decorateState(core.getState(), index),
      leaves: core.getLeaves(),
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
      if (core && core.setOnline(client.playerId, false)) this.pump();
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
    if (!clients.length) return;
    const payload = `data: ${JSON.stringify(payloadObject)}\n\n`;
    for (const client of clients) this._writeClient(client, payload);
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

    const decoded = safeDecode(pathname);
    if (decoded === null || decoded.includes('\0') || decoded.includes('\\')) {
      sendText(res, 404, 'Not found');
      return;
    }
    if (decoded.split('/').includes('..')) {
      sendText(res, 404, 'Not found');
      return;
    }

    const root = path.resolve(this.publicDir);
    let rel = path.posix.normalize(decoded).replace(/^\/+/, '');
    if (rel === '' || rel === '.' || rel.endsWith('/')) rel = `${rel}index.html`;
    let resolved = path.resolve(root, rel);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      sendText(res, 404, 'Not found');
      return;
    }

    let stat;
    try {
      stat = await fsp.stat(resolved);
    } catch {
      sendText(res, 404, 'Not found');
      return;
    }
    if (stat.isDirectory()) {
      resolved = path.join(resolved, 'index.html');
      try {
        stat = await fsp.stat(resolved);
      } catch {
        sendText(res, 404, 'Not found');
        return;
      }
    }
    if (!stat.isFile()) {
      sendText(res, 404, 'Not found');
      return;
    }

    const ext = path.extname(resolved).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
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
    const stream = fs.createReadStream(resolved);
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

  const app = new InfiniteServerApp({
    manager,
    config,
    now,
    publicDir: options.publicDir || PUBLIC_DIR,
    quiet: options.quiet === true,
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
