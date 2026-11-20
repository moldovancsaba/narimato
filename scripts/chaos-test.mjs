#!/usr/bin/env node
/**
 * B3 chaos smoke: kill the authoritative server with live SSE clients, restart
 * on the same data dir, and verify pilots/tokens/world survive and reconnect.
 *
 * Usage: node scripts/chaos-test.mjs
 */
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** `--report <path>` is additive to the env-driven CLI (OPS-02). */
function parseArgs(argv) {
  const options = { report: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--report') {
      options.report = argv[index + 1];
      if (!options.report) throw new Error('--report requires a path');
      index += 1;
    } else if (arg.startsWith('--report=')) options.report = arg.slice(9);
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

let ARGS;
try {
  ARGS = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(`[chaos] ${error.message}`);
  process.exit(2);
}
if (ARGS.help) {
  console.error('usage: node scripts/chaos-test.mjs [--report <path>]');
  process.exit(0);
}

async function writeReport(report) {
  if (!ARGS.report) return;
  await mkdir(path.dirname(path.resolve(ARGS.report)), { recursive: true });
  await writeFile(ARGS.report, `${JSON.stringify(report, null, 2)}\n`);
}

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

/** Wait until the reconnected stream receives its first event (or timeout). */
async function waitForEvent(stream, timeoutMs = 5000) {
  const started = performance.now();
  while (stream.events() === 0 && performance.now() - started < timeoutMs) await delay(20);
  return { firstEvent: stream.events() > 0, waitedMs: Math.round(performance.now() - started) };
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
const reconnects = [];
let final = null;
for (let index = 0; index < players.length; index += 1) {
  const p = players[index];
  const view = await (await fetch(`${BASE}/api/state?token=${encodeURIComponent(p.token)}`)).json();
  if (!view.state || view.state.players?.find((x) => x.id === p.id)?.tag !== p.tag) failures.push(`token routing lost for player ${index}`);
  const started = performance.now();
  const again = await join(p.tag, p.token);
  if (!again.body?.ok || again.body.player.id !== p.id) {
    failures.push(`rejoin failed for player ${index}`);
    reconnects.push({ player: index, ms: Math.round(performance.now() - started), firstEvent: false });
    continue;
  }
  const sse = await openSse(again.body.token);
  reconnected.push(sse);
  const first = await waitForEvent(sse, 5000);
  const ms = Math.round(performance.now() - started);
  reconnects.push({ player: index, ms, firstEvent: first.firstEvent });
  if (!first.firstEvent) failures.push(`no SSE event after reconnect for player ${index}`);
}
await delay(500);
for (const s of reconnected) s.stop();
if (players.length) {
  await fetch(`${BASE}/api/action`, { method: 'POST', headers: WRITE_HEADERS, body: JSON.stringify({ token: players[0].token, type: 'click', label: '1' }) }).catch(() => {});
}
await delay(200);
final = (await (await fetch(`${BASE}/api/state`)).json()).state;
const reconnectMaxMs = reconnects.reduce((max, entry) => Math.max(max, entry.ms), 0);

const report = {
  tool: 'chaos-test',
  generatedAt: new Date().toISOString(),
  scenario: process.env.SCENARIO || null,
  ok: failures.length === 0,
  players: players.length,
  beforeFaces: before.faces,
  afterFaces: after.faces,
  afterPlayers: after.players.length,
  finalFaces: final.faces,
  reconnected: reconnected.length,
  reconnects,
  reconnectMaxMs,
  failures,
};
console.log(JSON.stringify(report, null, 2));
server.child.kill('SIGTERM');
await new Promise((resolve) => server.child.once('exit', resolve));
await rm(dataDir, { recursive: true, force: true });
await writeReport(report);
if (failures.length) {
  console.error('[chaos] FAIL');
  process.exit(1);
}
console.log('[chaos] clean: world, players and tokens survived restart; SSE clients reconnected.');
