/**
 * OPS-03 — data integrity unit contract.
 *
 * Covers the stable exit-code contract, path safety, deterministic archive
 * bytes, manifest validation, tar safety (no symlinks), checksum verification,
 * registry/world reconciliation and the 7-daily + 24-hourly retention plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  ARCHIVE_PREFIX,
  assertSafeRelativePath,
  buildManifest,
  createBackupArchive,
  createTar,
  DataError,
  gzipBytes,
  EXIT,
  extractToStaging,
  isSafeRelativePath,
  MANIFEST_NAME,
  manifestJson,
  parseManifest,
  planetIndexFromPath,
  planRetention,
  readBackupArchive,
  readTar,
  reconcileRegistry,
  sha256Hex,
  SUPPORTED_PERSIST_VERSION,
  summariseDataDir,
  utcStamp,
  verifyBackupFile,
  walkDataFiles,
  WORLD_FILE,
} from '../lib/data-integrity.js';
import { PERSIST_VERSION } from '../lib/world-core.js';

const WORLD = (players = []) =>
  JSON.stringify({
    version: PERSIST_VERSION,
    savedAt: 1,
    createdAt: 1,
    totalClicks: 7,
    players: players.map((token, index) => ({ id: `p_${index}`, tag: `P${index}`, token, color: '#334455' })),
    tree: [{ label: '1', owner: -1, clicks: 0, lastClickIndex: -1, children: null }],
  });

async function tempRoot(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'narimato-integrity-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

/** Build a DATA_DIR with two planets and a registry. */
async function makeDataDir(t) {
  const root = await tempRoot(t);
  const dataDir = path.join(root, 'data');
  await mkdir(path.join(dataDir, 'planets', 'p1'), { recursive: true });
  await writeFile(path.join(dataDir, 'world.json'), WORLD(['tok-a', 'tok-b']), 'utf8');
  await writeFile(path.join(dataDir, 'planets', 'p1', 'world.json'), WORLD(['tok-c']), 'utf8');
  await writeFile(
    path.join(dataDir, 'planets', 'registry.json'),
    JSON.stringify({ version: 1, createdAt: 1, tokens: { 'tok-a': 0, 'tok-b': 0, 'tok-c': 1 } }),
    'utf8',
  );
  return { root, dataDir };
}

/** Recompute the tar header checksum after tampering with a field. */
function fixChecksum(header) {
  header.fill(0x20, 148, 156);
  let sum = 0;
  for (const byte of header) sum += byte;
  header.write(sum.toString(8).padStart(6, '0').slice(-6), 148, 6, 'ascii');
  header[154] = 0;
  header[155] = 0x20;
}

test('data-integrity: exit codes are the documented stable contract', () => {
  assert.deepEqual(EXIT, { OK: 0, USAGE: 2, NOTHING_TO_RESTORE: 3, INTEGRITY: 4, SCHEMA_TOO_NEW: 5, REFUSED: 6, IO: 7 });
  assert.equal(SUPPORTED_PERSIST_VERSION, PERSIST_VERSION, 'restore schema guard must match world-core PERSIST_VERSION');
});

test('data-integrity: path safety rejects absolute, parent, backslash and NUL paths', () => {
  assert.equal(isSafeRelativePath('world.json'), true);
  assert.equal(isSafeRelativePath('planets/p1/world.json'), true);
  for (const bad of ['/etc/passwd', '../world.json', 'planets/../../x', 'a\\b', 'a\0b', '', '.', 'a//b', 'planets/p1/../world.json']) {
    assert.equal(isSafeRelativePath(bad), false, `${JSON.stringify(bad)} is unsafe`);
  }
  assert.throws(() => assertSafeRelativePath('/abs'), (error) => error instanceof DataError && error.code === EXIT.INTEGRITY);
});

test('data-integrity: planet paths, UTC stamp and sha256 helpers', () => {
  assert.equal(planetIndexFromPath('world.json'), 0);
  assert.equal(planetIndexFromPath('planets/p42/world.json'), 42);
  assert.equal(planetIndexFromPath('planets/registry.json'), null);
  assert.equal(planetIndexFromPath('planets/pX/world.json'), null);
  assert.match(utcStamp(new Date('2026-11-20T12:00:00.000Z')), /^20261120T120000Z$/);
  assert.equal(sha256Hex(Buffer.from('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('data-integrity: deterministic archives, manifest coverage and roundtrip verification', async (t) => {
  const { dataDir } = await makeDataDir(t);
  const first = await createBackupArchive({ dataDir, appVersion: '3.57.0' });
  const second = await createBackupArchive({ dataDir, appVersion: '3.57.0' });
  assert.deepEqual(first.buffer, second.buffer, 'identical input yields byte-identical archives');
  assert.deepEqual(first.manifest, second.manifest);

  assert.equal(first.manifest.schema, 1);
  assert.equal(first.manifest.appVersion, '3.57.0');
  assert.equal(first.manifest.persistVersion, PERSIST_VERSION);
  assert.deepEqual(first.manifest.files.map((file) => file.path), ['planets/p1/world.json', 'planets/registry.json', 'world.json']);
  assert.deepEqual(
    first.manifest.planets,
    [
      { index: 0, players: 2, tokens: 2 },
      { index: 1, players: 1, tokens: 1 },
    ],
    'manifest covers every world.json and the registry',
  );

  const archivePath = path.join(path.dirname(dataDir), 'backup.tar.gz');
  await writeFile(archivePath, first.buffer);
  await writeFile(`${archivePath}.manifest.json`, manifestJson(first.manifest));
  const verified = await verifyBackupFile(archivePath);
  assert.equal(verified.files, 3);
  assert.deepEqual(verified.manifest, first.manifest);

  const parsed = readBackupArchive(first.buffer);
  assert.equal(parsed.files.size, 3);
  assert.deepEqual([...parsed.files.keys()].sort(), first.manifest.files.map((file) => file.path).sort());

  // A flipped byte in the compressed stream is an integrity failure, not a crash.
  const tampered = Buffer.from(first.buffer);
  tampered[Math.floor(tampered.length / 2)] ^= 0xff;
  assert.throws(() => readBackupArchive(tampered), (error) => error instanceof DataError && error.code === EXIT.INTEGRITY);

  // A sidecar manifest that disagrees with the archive root manifest is refused.
  await writeFile(`${archivePath}.manifest.json`, JSON.stringify({ ...first.manifest, appVersion: '9.9.9' }));
  await assert.rejects(verifyBackupFile(archivePath), (error) => error.code === EXIT.INTEGRITY);
});

test('data-integrity: manifest validation rejects unsafe or forged entries', () => {
  const valid = buildManifest([
    { path: 'world.json', data: Buffer.from(WORLD(['t'])), bytes: Buffer.byteLength(WORLD(['t'])), sha256: sha256Hex(Buffer.from(WORLD(['t']))) },
  ]);
  assert.equal(parseManifest(valid).files.length, 1);
  for (const bad of [
    { ...valid, schema: 2 },
    { ...valid, files: [] },
    { ...valid, files: [{ path: '../world.json', bytes: 1, sha256: 'a'.repeat(64) }] },
    { ...valid, files: [{ path: 'world.json', bytes: 1, sha256: 'not-a-digest' }] },
    { ...valid, files: [...valid.files, ...valid.files] },
  ]) {
    assert.throws(() => parseManifest(bad), (error) => error instanceof DataError && error.code === EXIT.INTEGRITY);
  }
  assert.throws(() => parseManifest('{not json'), (error) => error.code === EXIT.INTEGRITY);
});

test('data-integrity: tar reader refuses symlink entries and corrupt checksums', async (t) => {
  const { dataDir } = await makeDataDir(t);
  const { buffer } = await createBackupArchive({ dataDir });
  const gunzipped = await import('node:zlib').then((zlib) => zlib.gunzipSync(buffer));

  const symlink = Buffer.from(gunzipped);
  symlink[156] = '2'.charCodeAt(0); // typeflag: symlink
  fixChecksum(symlink.subarray(0, 512));
  assert.throws(() => readTar(symlink), (error) => error.code === EXIT.INTEGRITY);

  const corrupt = Buffer.from(gunzipped);
  corrupt[0] = corrupt[0] === 0x77 ? 0x78 : 0x77;
  assert.throws(() => readTar(corrupt), (error) => error.code === EXIT.INTEGRITY);
});

test('data-integrity: reconciliation routes missing planets, drops stale tokens and adds orphans', () => {
  const registry = {
    version: 1,
    createdAt: 1,
    tokens: {
      'tok-live': 1, // on planet 1 -> keep
      'tok-missing-planet': 42, // p42 dir gone -> route to 0
      'tok-stale': 0, // planet 0 exists but player is gone -> drop
      'tok-dupe': 2, // also on planet 1 -> keep the lowest live index
    },
  };
  const planets = [
    { index: 0, tokens: ['tok-orphan', 'tok-dupe'] },
    { index: 1, tokens: ['tok-live', 'tok-dupe'] },
  ];
  const result = reconcileRegistry({ registry, planets });
  assert.deepEqual(result.registry.tokens, {
    'tok-live': 1,
    'tok-missing-planet': 0,
    'tok-dupe': 0,
    'tok-orphan': 0,
  });
  assert.equal(result.report.added, 1, 'orphan player without a registry entry is added');
  assert.equal(result.report.dropped, 1, 'stale token on a live planet is dropped');
  assert.equal(result.report.rerouted, 2, 'missing planet route and invalid duplicate route are rerouted');
  assert.equal(result.report.duplicates, 1);
  assert.deepEqual(result.report.missingPlanetIndexes, [2, 42]);
  assert.equal(result.report.changed, true);

  // Convergence: the fallback route to planet 0 is only kept while the token
  // has no player there; the next pass drops it (documented two-step repair).
  const again = reconcileRegistry({ registry: result.registry, planets });
  assert.equal(again.report.changed, true);
  assert.equal(Object.prototype.hasOwnProperty.call(again.registry.tokens, 'tok-missing-planet'), false);
  const settled = reconcileRegistry({ registry: again.registry, planets });
  assert.equal(settled.report.changed, false, 'a settled registry is idempotent');
  assert.deepEqual(settled.registry.tokens, again.registry.tokens);
});

test('data-integrity: reconciliation rebuilds a missing registry from the worlds', () => {
  const result = reconcileRegistry({
    registry: { version: 1, createdAt: 1, tokens: {} },
    planets: [
      { index: 0, tokens: ['a', 'b'] },
      { index: 1, tokens: ['c'] },
    ],
  });
  assert.deepEqual(result.registry.tokens, { a: 0, b: 0, c: 1 });
  assert.equal(result.report.added, 3);
});

test('data-integrity: retention keeps 24 hourly and 7 daily backups', () => {
  const now = Date.parse('2026-11-20T12:00:00Z');
  const backups = [];
  for (let hour = 0; hour < 24 * 12; hour += 1) {
    backups.push({ name: `narimato-${hour}.tar.gz`, createdAt: now - hour * 3_600_000 });
  }
  const plan = planRetention(backups, { now });
  // 24 hourly buckets plus the daily buckets that fall outside them (days -2..-6).
  assert.equal(plan.keep.length, 29);
  assert.equal(plan.keep.length, new Set(plan.keep).size, 'no duplicate keeps');
  assert.equal(plan.remove.length, backups.length - plan.keep.length);
  assert.ok(plan.keep.includes('narimato-0.tar.gz'), 'newest backup is always kept');
  assert.equal(plan.keep.includes(`narimato-${24 * 12 - 1}.tar.gz`), false, 'oldest hourly backup is pruned');

  // One backup per day for 30 days: the newest 24 hourly buckets already cover
  // the 7 daily buckets, so exactly 24 are kept.
  const dailyBed = [];
  for (let day = 0; day < 30; day += 1) dailyBed.push({ name: `d${day}.tar.gz`, createdAt: now - day * 86_400_000 });
  const dailyPlan = planRetention(dailyBed, { now });
  assert.equal(dailyPlan.keep.length, 24);
  assert.ok(dailyPlan.keep.includes('d0.tar.gz'));
  assert.ok(dailyPlan.remove.includes('d24.tar.gz'));
  // Future-dated entries are ignored rather than kept forever.
  assert.deepEqual(planRetention([{ name: 'future.tar.gz', createdAt: now + 86_400_000 }], { now }).keep, []);
});

test('data-integrity: summary, staging extraction and empty-world guard', async (t) => {
  const { dataDir } = await makeDataDir(t);
  const summary = await summariseDataDir(dataDir);
  assert.equal(summary.players, 3);
  assert.equal(summary.tokens, 3);
  assert.equal(summary.totalClicks, 14);
  assert.equal(summary.registryTokens, 3);

  const { buffer, manifest } = await createBackupArchive({ dataDir });
  const archive = readBackupArchive(buffer);
  assert.equal(archive.files.size, 3);
  const staging = path.join(path.dirname(dataDir), 'staging');
  await extractToStaging({ files: archive.files, stagingDir: staging });
  const extracted = await summariseDataDir(staging);
  assert.equal(extracted.players, summary.players, 'restore reproduces the player count');
  assert.equal(extracted.tokens, summary.tokens, 'restore reproduces the token count');
  assert.equal(extracted.totalClicks, summary.totalClicks);
  assert.equal((await readFile(path.join(staging, WORLD_FILE), 'utf8')).length > 0, true);
  await assert.rejects(
    () => extractToStaging({ files: archive.files, stagingDir: staging }),
    (error) => error.code === EXIT.REFUSED,
    'staging must be empty',
  );

  // No planet 0 -> refused unless explicitly allowed.
  const noPlanet0 = new Map([['planets/p1/world.json', Buffer.from(WORLD(['x']))]]);
  const emptyStaging = path.join(path.dirname(dataDir), 'staging-empty');
  await assert.rejects(() => extractToStaging({ files: noPlanet0, stagingDir: emptyStaging }), (error) => error.code === EXIT.INTEGRITY);
  const emptyStaging2 = path.join(path.dirname(dataDir), 'staging-empty-2');
  await assert.doesNotReject(() => extractToStaging({ files: noPlanet0, stagingDir: emptyStaging2, allowEmptyWorld: true }));

  // Every manifest path stays relative.
  for (const file of manifest.files) assert.equal(file.path.startsWith('/'), false);
  assert.equal(Array.from(archive.files.keys()).every((name) => name.startsWith(ARCHIVE_PREFIX) === false), true);
});

test('data-integrity: walk skips tmp/dotfiles and interrupted staging dirs', async (t) => {
  const root = await tempRoot(t);
  await mkdir(path.join(root, 'planets', 'p1'), { recursive: true });
  await mkdir(path.join(root, '.hidden'), { recursive: true });
  await mkdir(path.join(root, 'data.staging-123'), { recursive: true });
  await writeFile(path.join(root, 'world.json'), '{}');
  await writeFile(path.join(root, '.DS_Store'), 'x');
  await writeFile(path.join(root, 'world.json.123.tmp'), 'x');
  await writeFile(path.join(root, 'planets', 'p1', 'world.json'), '{}');
  await writeFile(path.join(root, 'data.staging-123', 'x.json'), '{}');
  await writeFile(path.join(root, '.hidden', 'x.json'), '{}');
  assert.deepEqual(await walkDataFiles(root), ['planets/p1/world.json', 'world.json']);
});

test('data-integrity: verify rejects a crafted archive whose payload is not valid JSON', async (t) => {
  const { dataDir } = await makeDataDir(t);
  const { manifest } = await createBackupArchive({ dataDir, appVersion: '3.57.0' });
  const original = [];
  for (const file of manifest.files) {
    original.push({ path: file.path, data: await readFile(path.join(dataDir, file.path)) });
  }
  const forged = original.map((file) => (file.path === 'world.json' ? { path: file.path, data: Buffer.from('{not json') } : file));
  const forgedManifest = {
    ...manifest,
    files: forged.map((file) => ({ path: file.path, bytes: file.data.length, sha256: sha256Hex(file.data) })),
  };
  const archive = gzipBytes(
    createTar([
      { name: MANIFEST_NAME, data: Buffer.from(manifestJson(forgedManifest)), mode: 0o644 },
      ...forged.map((file) => ({ name: `${ARCHIVE_PREFIX}${file.path}`, data: file.data, mode: 0o600 })),
    ]),
  );
  const archivePath = path.join(path.dirname(dataDir), 'crafted.tar.gz');
  await writeFile(archivePath, archive);
  await writeFile(`${archivePath}.manifest.json`, manifestJson(forgedManifest));
  await assert.rejects(verifyBackupFile(archivePath), (error) => error.code === EXIT.INTEGRITY);
});

test('data-integrity: a corrupt world fails a backup instead of producing a silent archive', async (t) => {
  const root = await tempRoot(t);
  await writeFile(path.join(root, 'world.json'), '{not json');
  await assert.rejects(createBackupArchive({ dataDir: root }), (error) => error.code === EXIT.INTEGRITY);
  assert.throws(() => readBackupArchive(Buffer.from('not gzip')), (error) => error.code === EXIT.INTEGRITY);
});
