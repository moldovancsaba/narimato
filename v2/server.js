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
    const phaseMatch = /^\/phase\/([0-4])$/.exec(url.pathname);
    if (phaseMatch) {
      const phase = Number(phaseMatch[1]);
      const phases = [
        { tag: 'v2-phase-0', title: 'Phase 0 — clean scaffold', body: 'Zero-dependency server, minimal client and tests. No planet yet.' },
        { tag: 'v2-phase-1', title: 'Phase 1 — planet + approved camera', body: 'Geodesic ray–sphere planet and the one-rig four-phase camera (3.20 / 2.10 / 1.44 / 1.04 R).' },
        { tag: 'v2-phase-2', title: 'Phase 2 — collection + next planet', body: 'Server-authoritative triangle collection: 30 breaks, then the next planet. Robots tick.' },
        { tag: 'v2-phase-3', title: 'Phase 3 — playable client', body: 'Clickable triangles, four robots with respawn, HUD, visible gamer.' },
        { tag: 'v2-phase-4', title: 'Phase 4 — cutover + rollback docs', body: 'Legacy retired from the product entry, per-phase tags, phase links and rollback.' },
      ];
      const p = phases[phase];
      const link = `https://github.com/moldovancsaba/narimato/tree/${p.tag}`;
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${p.title}</title>
<style>body{margin:0;min-height:100vh;background:#05010f;color:#dffcff;font-family:ui-monospace,monospace;display:grid;place-items:center}main{width:min(760px,92vw)}h1{color:#7df9ff;font-size:24px;letter-spacing:.06em}a{display:block;margin:12px 0;padding:14px 16px;border:1px solid rgba(90,240,255,.4);border-radius:10px;color:#dffcff;text-decoration:none;background:rgba(8,20,30,.7)}a:hover{border-color:#7df9ff}code{color:#9ffcff}small{color:#9fdce8;display:block;margin-top:4px}</style></head>
<body><main><h1>${p.title}</h1><p>${p.body}</p>
<a href="/">▶ OPEN V2 GAME<small>current delivery</small></a>
<a href="/phases.html">CAMERA PHASE INDEX<small>orbit → halfway → 80% → landed</small></a>
<a href="${link}">GITHUB TAG ${p.tag}<small>${link}</small></a>
<a href="/phase/${Math.max(0, phase - 1)}">← PREVIOUS PHASE</a>
<a href="/phase/${Math.min(4, phase + 1)}">NEXT PHASE →</a>
<p><code>git checkout ${p.tag} &amp;&amp; node v2/server.js</code></p>
<p><small>Rollback docs: docs/V2_ROLLBACK.md · issues/PRs: #111, #112</small></p></main></body></html>`;
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
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
