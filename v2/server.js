#!/usr/bin/env node
/**
 * NARIMATO v2 scaffold server — zero runtime dependencies.
 * Serves the clean v2 client and a minimal authoritative state.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame, collectTriangle, publicState, tickRobots } from './server/game.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
};

export function createV2Server() {
  const game = createGame();
  const timer = setInterval(() => tickRobots(game), 2000);
  timer.unref?.();
  return http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname === '/api/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, version: 2 }));
      return;
    }
    if (url.pathname === '/api/state' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, version: 2, ...publicState(game) }));
      return;
    }
    if (url.pathname === '/api/collect' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; if (body.length > 1024) req.destroy(); });
      req.on('end', () => {
        let id = null;
        try { id = JSON.parse(body || '{}').triangleId; } catch {}
        const result = collectTriangle(game, id);
        res.writeHead(result.ok ? 200 : 409, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ...result, state: publicState(game) }));
      });
      return;
    }
    let file = url.pathname === '/' ? '/index.html' : url.pathname;
    file = decodeURIComponent(file);
    const full = path.join(PUBLIC, file);
    if (!full.startsWith(PUBLIC)) {
      res.writeHead(403); res.end('forbidden'); return;
    }
    fs.readFile(full, (err, data) => {
      if (err) {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('not found');
        return;
      }
      res.writeHead(200, { 'content-type': MIME[path.extname(full)] || 'application/octet-stream' });
      res.end(data);
    });
  });
}

export function startV2Server({ port = 4180, quiet = false } = {}) {
  const server = createV2Server();
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      if (!quiet) console.log(`[narimato v2] http://127.0.0.1:${address.port}`);
      resolve({ server, port: address.port, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startV2Server({ port: Number(process.env.V2_PORT) || 4180 }).catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
