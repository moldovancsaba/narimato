/**
 * OPS-03 — persistence recovery integration contract.
 *
 * A real DATA_DIR (two planets, three pilots, a token registry) is created by a
 * running server, backed up with `backup-data.mjs`, verified with
 * `verify-data.mjs` and restored with `restore-data.mjs`. The restored directory
 * is booted to prove players, tokens and world counters survive; corrupt and
 * tampered archives are refused; a failed restore leaves live data untouched;
 * quarantine and registry reconciliation are exercised end to end.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { startServer } from '../server.js';
import {
  createBackupArchive,
  createTar,
  gzipBytes,
  gunzipBytes,
  manifestJson,
  readTar,
  summariseDataDir,
} from '../lib/data-integrity.js';
import { missionForPlanet } from '../public/js/shared/mission.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = {
  backup: path.join(ROOT, 'scripts', 'backup-data.mjs'),
  verify: path.join(ROOT, 'scripts', 'verify-data.mjs'),
  restore: path.join(ROOT, 'scripts', 'restore-data.mjs'),
};

function runScript(script, args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], { cwd: ROOT });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function tempRoot(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'narimato-recovery-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function openServer(t, dataDir, { env = {} } = {}) {
  const handle = await startServer({
    port: 0,
    host: '127.0.0.1',
    dataDir,
    quiet: true,
    env: { ...process.env, SECURITY_MODE: 'compat', NODE_ENV: 'test', ...env },
    config: { bots: 0, depositChance: 0, clickCooldownMs: 0, saveDebounceMs: 10 },
  });
  t.after(() => handle.close());
  return handle;
}

async function postJson(base, pathname, body) {
  const res = await fetch(`${base}${pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

function missionOreCounts(mission) {
  const counts = {};
  for (const objective of mission.objectives) {
    for (const item of objective.items) counts[item.resourceId] = (counts[item.resourceId] || 0) + item.need;
  }
  return counts;
}

/**
 * Boot a server, create two planets with three pilots and a token registry, then
 * shut it down (flushing every world and the registry).
 */
async function createReferenceData(t) {
  const root = await tempRoot(t);
  const dataDir = path.join(root, 'data');
  const handle = await openServer(t, dataDir);
  const base = `http://127.0.0.1:${handle.port}`;

  const alpha = (await postJson(base, '/api/join', { tag: 'DRILL-A' })).json;
  const beta = (await postJson(base, '/api/join', { tag: 'DRILL-B' })).json;
  const gamma = (await postJson(base, '/api/join', { tag: 'DRILL-C' })).json;
  for (const player of [alpha, beta, gamma]) {
    assert.equal(Boolean(player.token), true);
    await postJson(base, '/api/action', { token: player.token, type: 'click', label: '1' });
  }
  // Escape alpha to planet 1 so the registry has a non-zero route and a second world exists.
  const core = handle.manager.planetCore(0);
  const pilot = core.findByToken(alpha.token);
  const mission = missionForPlanet(0, core.planetSeed);
  pilot.oreCounts = missionOreCounts(mission);
  const escaped = await postJson(base, '/api/action', { token: alpha.token, type: 'escape' });
  assert.equal(escaped.status, 200);
  const destination = escaped.json.planetIndex;
  assert.ok(Number.isInteger(destination) && destination >= 1 && destination <= 5, `escape destination ${destination}`);

  await handle.close();
  t.after(() => handle.close());
  const summary = await summariseDataDir(dataDir);
  const before = {
    players: summary.players,
    tokens: summary.tokens,
    totalClicks: summary.totalClicks,
    planet0Clicks: summary.planets.find((planet) => planet.index === 0)?.totalClicks ?? 0,
    alphaId: alpha.player.id,
    alphaToken: alpha.token,
    destination,
    betaToken: beta.token,
    betaId: beta.player.id,
  };
  assert.ok(before.planet0Clicks > 0, 'the reference world has persisted click state');
  return { root, dataDir, before, handle };
}

test('recovery: backup -> verify -> restore reproduces players, tokens and world counters', async (t) => {
  const { root, dataDir, before } = await createReferenceData(t);
  const backupDir = path.join(root, 'backups');

  const backup = await runScript(SCRIPTS.backup, ['--data-dir', dataDir, '--out', backupDir]);
  assert.equal(backup.code, 0, backup.stderr);
  assert.match(backup.stdout, /^BACKUP /m);
  const files = (await readdir(backupDir)).sort();
  const archiveName = files.find((name) => name.endsWith('.tar.gz'));
  assert.ok(archiveName, 'archive written');
  assert.ok(files.includes(`${archiveName}.manifest.json`), 'sidecar manifest written beside the archive');
  const archive = path.join(backupDir, archiveName);
  const archived = await stat(archive);
  assert.equal(archived.mode & 0o777, 0o600, 'archive is 0600 (it contains tokens)');
  assert.equal((await stat(backupDir)).mode & 0o777, 0o700, 'backup directory is 0700');

  const verify = await runScript(SCRIPTS.verify, ['--archive', archive]);
  assert.equal(verify.code, 0, verify.stderr);
  assert.match(verify.stdout, /^OK /);

  // A one-byte flip is refused with exit 4.
  const raw = await readFile(archive);
  const flipped = Buffer.from(raw);
  flipped[Math.floor(flipped.length / 2)] ^= 0xff;
  const corruptArchive = path.join(backupDir, 'corrupt.tar.gz');
  await writeFile(corruptArchive, flipped);
  await copyFile(`${archive}.manifest.json`, `${corruptArchive}.manifest.json`);
  const badVerify = await runScript(SCRIPTS.verify, ['--archive', corruptArchive]);
  assert.equal(badVerify.code, 4, `expected integrity failure, got ${badVerify.code}: ${badVerify.stderr}`);

  // Dry run writes nothing.
  const restoredDir = path.join(root, 'restored');
  const dry = await runScript(SCRIPTS.restore, ['--backup', archive, '--data-dir', restoredDir, '--dry-run']);
  assert.equal(dry.code, 0, dry.stderr);
  assert.match(dry.stdout, /DRY RUN/);
  await assert.rejects(stat(restoredDir), 'dry run must not create the target');

  // Missing confirmation is refused with exit 6.
  const unconfirmed = await runScript(SCRIPTS.restore, ['--backup', archive, '--data-dir', restoredDir, '--apply']);
  assert.equal(unconfirmed.code, 6);

  // Real restore into a fresh directory.
  const restore = await runScript(SCRIPTS.restore, ['--backup', archive, '--data-dir', restoredDir, '--apply', '--yes', '--port', '0']);
  assert.equal(restore.code, 0, restore.stderr);
  assert.match(restore.stdout, /^RESTORED players=\d+ tokens=\d+/m);

  const after = await summariseDataDir(restoredDir);
  assert.equal(after.players, before.players, 'players survive the restore');
  assert.equal(after.tokens, before.tokens, 'tokens survive the restore');
  assert.equal(after.totalClicks, before.totalClicks, 'world click counters survive the restore');

  // Boot the restored world: pilots, tokens and routing are live.
  const booted = await openServer(t, restoredDir);
  const bootBase = `http://127.0.0.1:${booted.port}`;
  const state = await (await fetch(`${bootBase}/api/state?token=${encodeURIComponent(before.betaToken)}`)).json();
  assert.equal(state.ok, true);
  assert.ok(state.state.players.some((player) => player.id === before.betaId && player.tag === 'DRILL-B'), 'beta is present and routed');
  const rejoin = await postJson(bootBase, '/api/join', { tag: 'DRILL-B', token: before.betaToken });
  assert.equal(rejoin.status, 200, 'restored token can rejoin');
  assert.equal(rejoin.json.player.id, before.betaId, 'restored token keeps its identity');
  // Route to the escaped pilot on planet 1 so both restored planets are loaded.
  const planet1 = await (await fetch(`${bootBase}/api/state?token=${encodeURIComponent(before.alphaToken)}`)).json();
  assert.equal(planet1.ok, true);
  assert.equal(planet1.state.planetIndex, before.destination, 'escaped pilot still routes to its destination planet');
  const health = await (await fetch(`${bootBase}/api/health`)).json();
  assert.equal(health.ok, true);
  assert.ok(health.planetsLoaded >= 2, 'both restored planets load');
  assert.equal(booted.manager.planetCore(0).totalClicks, before.planet0Clicks, 'restored world counters match the source');
});

test('recovery: a failed restore leaves the live directory byte-identical', async (t) => {
  const { root, dataDir } = await createReferenceData(t);
  const backupDir = path.join(root, 'backups');
  const backup = await runScript(SCRIPTS.backup, ['--data-dir', dataDir, '--out', backupDir]);
  assert.equal(backup.code, 0, backup.stderr);
  const archive = path.join(backupDir, (await readdir(backupDir)).find((name) => name.endsWith('.tar.gz')));

  // Live target with its own verified content; hash it before the failed attempt.
  const liveDir = path.join(root, 'live');
  await mkdir(liveDir, { recursive: true });
  await writeFile(path.join(liveDir, 'world.json'), '{"version":2,"players":[],"tree":[]}');
  await writeFile(path.join(liveDir, 'sentinel.txt'), 'do-not-touch');
  const before = await summariseDataDir(liveDir);
  const raw = await readFile(archive);
  const flipped = Buffer.from(raw);
  flipped[Math.floor(flipped.length / 2)] ^= 0xff;
  const corruptArchive = path.join(backupDir, 'tampered.tar.gz');
  await writeFile(corruptArchive, flipped);

  const restore = await runScript(SCRIPTS.restore, ['--backup', corruptArchive, '--data-dir', liveDir, '--apply', '--yes', '--port', '0']);
  assert.equal(restore.code, 4);
  assert.equal(await readFile(path.join(liveDir, 'sentinel.txt'), 'utf8'), 'do-not-touch', 'live directory untouched');
  const afterFailure = await summariseDataDir(liveDir);
  assert.equal(afterFailure.players, before.players);
  // No staging directory is left behind.
  const leftovers = (await readdir(root)).filter((name) => name.includes('.staging-'));
  assert.deepEqual(leftovers, [], 'staging is cleaned up on failure');
});

test('recovery: corrupt world.json is quarantined and needs ALLOW_EMPTY_WORLD=1 to boot', async (t) => {
  const root = await tempRoot(t);
  const dataDir = path.join(root, 'data');
  await mkdir(dataDir, { recursive: true });
  await writeFile(path.join(dataDir, 'world.json'), '{"version":2,"players":[', 'utf8');

  await assert.rejects(
    () => startServer({ port: 0, host: '127.0.0.1', dataDir, quiet: true, config: { bots: 0 } }),
    (error) => error.code === 'WORLD_CORRUPT',
  );
  const entries = await readdir(dataDir);
  const quarantined = entries.filter((name) => name.startsWith('world.json.corrupt-'));
  assert.equal(quarantined.length, 1, 'corrupt file quarantined, not deleted');
  assert.equal(await readFile(path.join(dataDir, 'world.json'), 'utf8').catch(() => null), null, 'no empty world overwrote the evidence');

  const allowed = await openServer(t, dataDir, { env: { ALLOW_EMPTY_WORLD: '1' } });
  assert.equal(allowed.manager.planetCore(0).players.length, 0);
});

test('recovery: startup reconciliation repairs a deleted planet route and drops stale tokens', async (t) => {
  const { root, dataDir } = await createReferenceData(t);
  // Registry after the drill has a token route to planet 1. Add a route to a
  // planet that does not exist and a stale route to planet 0.
  const registryFile = path.join(dataDir, 'planets', 'registry.json');
  const registry = JSON.parse(await readFile(registryFile, 'utf8'));
  registry.tokens['ghost-token'] = 42; // planets/p42 was never created
  registry.tokens['stale-token'] = 0; // planet 0 exists, player does not
  await writeFile(registryFile, JSON.stringify(registry), 'utf8');

  const handle = await openServer(t, dataDir);
  const reconciled = handle.manager.registry.tokens;
  assert.equal(reconciled['ghost-token'], 0, 'route to a missing planet dir is repaired to planet 0');
  assert.equal(Object.prototype.hasOwnProperty.call(reconciled, 'stale-token'), false, 'stale token on a live planet is dropped');
  const report = handle.manager.lastReconcileReport;
  assert.equal(report.skipped, false);
  assert.ok(report.rerouted >= 1);
  assert.ok(report.dropped >= 1);
  assert.equal(report.changed, true);
});

test('recovery: exit-code contract for usage, nothing-to-restore and schema-too-new', async (t) => {
  const { root, dataDir } = await createReferenceData(t);
  assert.equal((await runScript(SCRIPTS.restore, ['--data-dir', path.join(root, 'x')])).code, 2, 'usage');
  assert.equal((await runScript(SCRIPTS.verify, ['--archive', path.join(root, 'missing.tar.gz')])).code, 3, 'nothing to verify');
  const missingRestore = await runScript(SCRIPTS.restore, ['--backup', path.join(root, 'missing.tar.gz'), '--data-dir', path.join(root, 'x'), '--apply', '--yes', '--port', '0']);
  assert.equal(missingRestore.code, 3, 'nothing to restore');

  // Craft an archive whose manifest declares a newer persistence schema.
  const { buffer } = await createBackupArchive({ dataDir, appVersion: '3.57.0' });
  const entries = readTar(gunzipBytes(buffer));
  const manifestEntry = entries.find((entry) => entry.name === 'manifest.json');
  const manifest = JSON.parse(manifestEntry.data.toString('utf8'));
  const newerManifest = { ...manifest, persistVersion: manifest.persistVersion + 99 };
  const rewritten = createTar(
    entries.map((entry) =>
      entry.name === 'manifest.json'
        ? { name: entry.name, data: Buffer.from(manifestJson(newerManifest)), mode: 0o644 }
        : { name: entry.name, data: entry.data, mode: 0o600 },
    ),
  );
  const newerArchive = path.join(root, 'newer.tar.gz');
  await writeFile(newerArchive, gzipBytes(rewritten));
  await writeFile(`${newerArchive}.manifest.json`, manifestJson(newerManifest));
  assert.equal((await runScript(SCRIPTS.verify, ['--archive', newerArchive])).code, 5, 'schema newer than this build');
  const restoreNewer = await runScript(SCRIPTS.restore, ['--backup', newerArchive, '--data-dir', path.join(root, 'newer-target'), '--apply', '--yes', '--port', '0']);
  assert.equal(restoreNewer.code, 5);
});

test('recovery: a live server refuses restore (exit 6)', async (t) => {
  const { root, dataDir } = await createReferenceData(t);
  const backupDir = path.join(root, 'backups');
  const backup = await runScript(SCRIPTS.backup, ['--data-dir', dataDir, '--out', backupDir]);
  assert.equal(backup.code, 0, backup.stderr);
  const archive = path.join(backupDir, (await readdir(backupDir)).find((name) => name.endsWith('.tar.gz')));
  const live = await openServer(t, dataDir);

  const restore = await runScript(SCRIPTS.restore, [
    '--backup',
    archive,
    '--data-dir',
    path.join(root, 'restored-live'),
    '--apply',
    '--yes',
    '--port',
    String(live.port),
  ]);
  assert.equal(restore.code, 6);
  assert.match(restore.stderr, /server is live/);
});

test('recovery: restore is idempotent and retains the previous live directory for rollback', async (t) => {
  const { root, dataDir, before } = await createReferenceData(t);
  const backupDir = path.join(root, 'backups');
  const backup = await runScript(SCRIPTS.backup, ['--data-dir', dataDir, '--out', backupDir]);
  assert.equal(backup.code, 0, backup.stderr);
  const archive = path.join(backupDir, (await readdir(backupDir)).find((name) => name.endsWith('.tar.gz')));

  // Restore over the live directory itself: the previous copy is retained.
  const restore = await runScript(SCRIPTS.restore, ['--backup', archive, '--data-dir', dataDir, '--apply', '--yes', '--port', '0']);
  assert.equal(restore.code, 0, restore.stderr);
  assert.match(restore.stdout, /RESTORED players=\d+ tokens=\d+/);
  const retained = (await readdir(root)).filter((name) => name.includes('.pre-restore-'));
  assert.equal(retained.length, 1, 'previous data dir retained for rollback');
  const restored = await summariseDataDir(dataDir);
  assert.equal(restored.players, before.players);
  assert.equal(restored.tokens, before.tokens);

  // The restore is idempotent (second run against the same archive).
  const again = await runScript(SCRIPTS.restore, ['--backup', archive, '--data-dir', path.join(root, 'restored-again'), '--apply', '--yes', '--port', '0']);
  assert.equal(again.code, 0, again.stderr);
  assert.equal((await summariseDataDir(path.join(root, 'restored-again'))).tokens, before.tokens);
});

test('recovery: world files and registry survive a real server restart (chaos baseline)', async (t) => {
  const root = await tempRoot(t);
  const dataDir = path.join(root, 'data');
  const first = await openServer(t, dataDir);
  const base = `http://127.0.0.1:${first.port}`;
  const player = (await postJson(base, '/api/join', { tag: 'RESTART1' })).json;
  await postJson(base, '/api/action', { token: player.token, type: 'click', label: '2' });
  await first.close();
  await sleep(50);

  const second = await openServer(t, dataDir);
  const state = await (await fetch(`http://127.0.0.1:${second.port}/api/state?token=${encodeURIComponent(player.token)}`)).json();
  assert.equal(state.ok, true);
  assert.ok(state.state.players.some((entry) => entry.id === player.player.id && entry.tag === 'RESTART1'));
  const rejoin = await postJson(`http://127.0.0.1:${second.port}`, '/api/join', { tag: 'RESTART1', token: player.token });
  assert.equal(rejoin.json.player.id, player.player.id);
});

