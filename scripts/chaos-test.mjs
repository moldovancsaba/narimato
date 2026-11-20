#!/usr/bin/env node
/**
 * B3 chaos smoke: kill the authoritative server with live SSE clients, restart
 * on the same data dir, and verify pilots/tokens/world survive and reconnect.
 *
 * Usage: node scripts/chaos-test.mjs
 */
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.NARIMATO_CHAOS_PORT || 4404);
const BASE = `http://127.0.0.1:${PORT}`;
/** Same-origin writes so the chaos drill also works against SECURITY_MODE=enforce. */
const WRITE_HEADERS = { 'content-type': 'application/json', origin: BASE };
const CLIENTS = Math.max(2, Math.min(50, Number(process.env.CLIENTS) || 10));
const dataDir = await mkdtemp(path.join(os.tmpdir(), 'narimato-chaos-'));

function start() {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR: dataDir, BOTS: '0', CLICK_COOLDOWN_MS: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  return { child, getLog: () => log };
}
async function waitUp() {
  for (let i = 0; i < 80; i += 1) {
    try { if ((await fetch(`${BASE}/api/health`)).ok) return; } catch { /* retry */ }
    await delay(150);
  }
  throw new Error('chaos server did not start');
}
async function join(tag, token) {
  const res = await fetch(`${BASE}/api/join`, { method: 'POST', headers: WRITE_HEADERS, body: JSON.stringify({ tag, token }) });
  return { status: res.status, body: await res.json() };
}
async function openSse(token) {
  const controller = new AbortController();
  const res = await fetch(`${BASE}/api/events?token=${encodeURIComponent(token)}`, { signal: controller.signal });
  if (!res.ok || !res.body) throw new Error('SSE open failed');
  let events = 0;
  const reader = res.body.getReader();
  void (async () => {
    try { for (;;) { const { done } = await reader.read(); if (done) break; events += 1; } } catch { /* aborted */ }
  })();
  return { stop: () => controller.abort(), events: () => events };
}

let server = start();
await waitUp();
const players = [];
for (let i = 0; i < CLIENTS; i += 1) {
  const joined = await join(`CH${String(i).padStart(2, '0')}`);
  if (joined.body?.ok) players.push({ tag: joined.body.player.tag, token: joined.body.token, id: joined.body.player.id });
}
const streams = [];
for (const p of players.slice(0, Math.min(5, players.length))) streams.push(await openSse(p.token));
for (let i = 0; i < 20; i += 1) {
  const p = players[i % players.length];
  await fetch(`${BASE}/api/action`, { method: 'POST', headers: WRITE_HEADERS, body: JSON.stringify({ token: p.token, type: 'click', label: String(1 + (i % 8)) }) }).catch(() => {});
}
const before = (await (await fetch(`${BASE}/api/state`)).json()).state;
await delay(400);
for (const s of streams) s.stop();
server.child.kill('SIGTERM');
await new Promise((resolve) => server.child.once('exit', resolve));
await delay(400);

server = start();
await waitUp();
const after = (await (await fetch(`${BASE}/api/state`)).json()).state;
const failures = [];
if (after.players.length < before.players.length) failures.push('players lost after restart');
const reconnected = [];
for (const p of players) {
  const view = await (await fetch(`${BASE}/api/state?token=${encodeURIComponent(p.token)}`)).json();
  if (!view.state || view.state.players?.find((x) => x.id === p.id)?.tag !== p.tag) failures.push(`token routing lost for ${p.tag}`);
  const again = await join(p.tag, p.token);
  if (!again.body?.ok || again.body.player.id !== p.id) failures.push(`rejoin failed for ${p.tag}`);
  const sse = await openSse(again.body.token);
  reconnected.push(sse);
}
await delay(500);
for (const s of reconnected) s.stop();
await fetch(`${BASE}/api/action`, { method: 'POST', headers: WRITE_HEADERS, body: JSON.stringify({ token: players[0].token, type: 'click', label: '1' }) }).catch(() => {});
await delay(200);
const final = (await (await fetch(`${BASE}/api/state`)).json()).state;

console.log(JSON.stringify({ players: players.length, beforeFaces: before.faces, afterFaces: after.faces, afterPlayers: after.players.length, finalFaces: final.faces, reconnected: reconnected.length, failures }, null, 2));
server.child.kill('SIGTERM');
await new Promise((resolve) => server.child.once('exit', resolve));
await rm(dataDir, { recursive: true, force: true });
if (failures.length) {
  console.error('[chaos] FAIL');
  process.exit(1);
}
console.log('[chaos] clean: world, players and tokens survived restart; SSE clients reconnected.');
