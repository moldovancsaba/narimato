/**
 * NARIMATO — DATA_DIR integrity, backup/restore and registry reconciliation (OPS-03).
 *
 * Pure, dependency-free logic shared by the operator scripts and the tests:
 *
 *   - deterministic tar + gzip archive writer/reader (sorted entries, mtime 0,
 *     uid/gid 0, fixed modes) so identical input yields identical bytes;
 *   - checksummed manifest (`schema: 1`) beside the archive and at its root;
 *   - path-safety rules (relative only, no `..`, no absolute, no symlinks);
 *   - backup retention plan (7 daily + 24 hourly);
 *   - registry/world reconciliation with a machine-readable report;
 *   - the stable script exit-code contract.
 *
 * Data model (see docs/RECOVERY.md):
 *   BackupManifest = {
 *     schema: 1, appVersion, persistVersion,
 *     planets: [{ index, players, tokens }],
 *     files: [{ path, bytes, sha256 }]
 *   }
 *
 * This module never prints tokens or callsigns and never writes outside the
 * directories its callers hand it.
 */
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

/** Stable script exit codes (contract asserted by test/recovery.test.js). */
export const EXIT = Object.freeze({
  OK: 0,
  USAGE: 2,
  NOTHING_TO_RESTORE: 3,
  INTEGRITY: 4,
  SCHEMA_TOO_NEW: 5,
  REFUSED: 6,
  IO: 7,
});

/** Highest `world.json` PERSIST_VERSION this build can read (must match lib/world-core.js). */
export const SUPPORTED_PERSIST_VERSION = 2;

export const MANIFEST_SCHEMA = 1;
export const MANIFEST_NAME = 'manifest.json';
export const ARCHIVE_PREFIX = 'data/';
export const WORLD_FILE = 'world.json';
export const REGISTRY_PATH = 'planets/registry.json';
export const DEFAULT_MAX_BYTES = 64 * 1024 * 1024;

const TAR_BLOCK = 512;
const MAX_UNPACKED_BYTES = 256 * 1024 * 1024;

/** Error carrying the process exit code the scripts must return. */
export class DataError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'DataError';
    this.code = code;
    this.extra = extra;
  }
}

export const usageError = (message) => new DataError(EXIT.USAGE, message);
export const integrityError = (message) => new DataError(EXIT.INTEGRITY, message);
export const schemaTooNewError = (message) => new DataError(EXIT.SCHEMA_TOO_NEW, message);
export const refusedError = (message) => new DataError(EXIT.REFUSED, message);
export const ioError = (message) => new DataError(EXIT.IO, message);

// --------------------------------------------------------------------- hashing

export function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/** Compact UTC stamp used in archive/quarantine names: 20261120T120000Z. */
export function utcStamp(date = new Date()) {
  const iso = (date instanceof Date ? date : new Date(date)).toISOString();
  return iso.replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '');
}

/** Convert `world.json` / `planets/pN/world.json` to a planet index, else null. */
export function planetIndexFromPath(relativePath) {
  const value = String(relativePath || '');
  if (value === WORLD_FILE) return 0;
  const match = /^planets\/p(\d+)\/world\.json$/.exec(value);
  return match ? Number(match[1]) : null;
}

// ---------------------------------------------------------------- path safety

/**
 * True when `relativePath` is a manifest-safe relative POSIX path.
 * Rejects absolute paths, `.`/`..` segments, backslashes, NUL and empty segments.
 */
export function isSafeRelativePath(relativePath) {
  if (typeof relativePath !== 'string' || !relativePath) return false;
  if (relativePath.startsWith('/') || relativePath.includes('\\') || relativePath.includes('\0')) return false;
  const segments = relativePath.split('/');
  if (!segments.length) return false;
  return segments.every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

export function assertSafeRelativePath(relativePath) {
  if (!isSafeRelativePath(relativePath)) throw integrityError(`unsafe archive path: ${JSON.stringify(relativePath)}`);
  return relativePath;
}

// ------------------------------------------------------------ data directory

/**
 * List DATA_DIR files as sorted POSIX-relative paths.
 * Skips dotfiles, `*.tmp` leftovers, and interrupted staging/pre-restore dirs.
 */
export async function walkDataFiles(dataDir) {
  const root = path.resolve(dataDir);
  const files = [];
  const walk = async (dir) => {
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch (error) {
      if (error && error.code === 'ENOENT') return;
      throw ioError(`cannot read ${dir}: ${error?.message || error}`);
    }
    for (const entry of entries) {
      const name = entry.name;
      if (name.startsWith('.')) continue;
      if (name.endsWith('.tmp')) continue;
      const full = path.join(dir, name);
      if (entry.isDirectory()) {
        if (name.includes('.staging-') || name.includes('.pre-restore-')) continue;
        await walk(full);
      } else if (entry.isFile()) {
        files.push(path.relative(root, full).split(path.sep).join('/'));
      }
    }
  };
  await walk(root);
  return files.sort();
}

/** Parse a `world.json` buffer into the summary the manifest/report needs. */
export function readWorldSummary(buffer, file = WORLD_FILE) {
  let world;
  try {
    world = JSON.parse(Buffer.isBuffer(buffer) ? buffer.toString('utf8') : String(buffer));
  } catch {
    throw integrityError(`${file} is not valid JSON`);
  }
  if (!world || typeof world !== 'object' || Array.isArray(world)) throw integrityError(`${file} is not a JSON object`);
  if (!Array.isArray(world.players)) throw integrityError(`${file} has no players array`);
  const tokens = new Set();
  for (const player of world.players) {
    if (player && typeof player === 'object' && typeof player.token === 'string') tokens.add(player.token);
  }
  return {
    version: Number.isInteger(world.version) ? world.version : 0,
    players: world.players.length,
    tokens: tokens.size,
    totalClicks: Number.isInteger(world.totalClicks) ? world.totalClicks : 0,
    planetSeed: Number.isInteger(world.planetSeed) ? world.planetSeed : null,
  };
}

export function readRegistrySummary(buffer, file = REGISTRY_PATH) {
  let registry;
  try {
    registry = JSON.parse(Buffer.isBuffer(buffer) ? buffer.toString('utf8') : String(buffer));
  } catch {
    throw integrityError(`${file} is not valid JSON`);
  }
  if (!registry || typeof registry !== 'object' || !registry.tokens || typeof registry.tokens !== 'object') {
    throw integrityError(`${file} has no tokens map`);
  }
  return registry;
}

// ------------------------------------------------------------------- manifest

/** Build the deterministic manifest for a set of `{path, bytes, sha256, data}` files. */
export function buildManifest(files, { appVersion = '0.0.0', persistVersion = 0 } = {}) {
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  const planets = [];
  let maxVersion = Number.isInteger(persistVersion) ? persistVersion : 0;
  for (const file of sorted) {
    const index = planetIndexFromPath(file.path);
    if (index === null) continue;
    const summary = readWorldSummary(file.data, file.path);
    maxVersion = Math.max(maxVersion, summary.version);
    planets.push({ index, players: summary.players, tokens: summary.tokens });
  }
  planets.sort((a, b) => a.index - b.index);
  return {
    schema: MANIFEST_SCHEMA,
    appVersion: typeof appVersion === 'string' && appVersion ? appVersion : '0.0.0',
    persistVersion: maxVersion,
    planets,
    files: sorted.map((file) => ({ path: assertSafeRelativePath(file.path), bytes: file.bytes, sha256: file.sha256 })),
  };
}

/** Validate and normalise a parsed manifest object. Throws `DataError(4)` on shape errors. */
export function parseManifest(input, { source = MANIFEST_NAME } = {}) {
  let manifest = input;
  if (typeof input === 'string' || Buffer.isBuffer(input)) {
    try {
      manifest = JSON.parse(Buffer.isBuffer(input) ? input.toString('utf8') : input);
    } catch {
      throw integrityError(`${source} is not valid JSON`);
    }
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw integrityError(`${source} is not a manifest object`);
  if (manifest.schema !== MANIFEST_SCHEMA) throw integrityError(`${source} schema ${manifest.schema} is unsupported`);
  if (typeof manifest.appVersion !== 'string' || !manifest.appVersion) throw integrityError(`${source} has no appVersion`);
  if (!Number.isInteger(manifest.persistVersion) || manifest.persistVersion < 0) throw integrityError(`${source} has no persistVersion`);
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) throw integrityError(`${source} has no files`);
  if (!Array.isArray(manifest.planets)) throw integrityError(`${source} has no planets array`);
  const seen = new Set();
  const files = manifest.files.map((file) => {
    if (!file || typeof file !== 'object') throw integrityError(`${source} has a malformed file entry`);
    assertSafeRelativePath(file.path);
    if (seen.has(file.path)) throw integrityError(`${source} lists ${file.path} twice`);
    seen.add(file.path);
    if (!Number.isInteger(file.bytes) || file.bytes < 0) throw integrityError(`${source} has an invalid byte count for ${file.path}`);
    if (typeof file.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(file.sha256)) throw integrityError(`${source} has an invalid sha256 for ${file.path}`);
    return { path: file.path, bytes: file.bytes, sha256: file.sha256 };
  });
  const planets = manifest.planets.map((planet) => {
    if (!planet || !Number.isInteger(planet.index) || planet.index < 0) throw integrityError(`${source} has an invalid planet entry`);
    return {
      index: planet.index,
      players: Number.isInteger(planet.players) ? planet.players : 0,
      tokens: Number.isInteger(planet.tokens) ? planet.tokens : 0,
    };
  });
  return {
    schema: MANIFEST_SCHEMA,
    appVersion: manifest.appVersion,
    persistVersion: manifest.persistVersion,
    planets,
    files,
  };
}

/** Stable manifest serialisation used both inside the archive and beside it. */
export function manifestJson(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/** Refuse an archive produced by a newer persistence schema. */
export function assertSchemaSupported(manifest) {
  if (!Number.isInteger(manifest.persistVersion)) throw integrityError(`${MANIFEST_NAME} has no persistVersion`);
  if (manifest.persistVersion > SUPPORTED_PERSIST_VERSION) {
    throw schemaTooNewError(
      `backup persistVersion ${manifest.persistVersion} is newer than this build (${SUPPORTED_PERSIST_VERSION}); use the matching release`,
    );
  }
  return manifest;
}

// ------------------------------------------------------------------------ tar

function writeString(buffer, offset, length, value) {
  const text = Buffer.from(String(value), 'utf8');
  if (text.length > length) throw new Error(`tar field overflow: ${value}`);
  text.copy(buffer, offset, 0, text.length);
}

function writeOctal(buffer, offset, length, value) {
  const text = Math.max(0, Math.trunc(value)).toString(8).padStart(length - 1, '0');
  if (text.length > length - 1) throw new Error(`tar octal overflow: ${value}`);
  buffer.write(text, offset, length - 1, 'ascii');
  buffer[offset + length - 1] = 0;
}

function tarHeader({ name, size, mode = 0o600, type = '0' }) {
  const header = Buffer.alloc(TAR_BLOCK, 0);
  writeString(header, 0, 100, name);
  writeOctal(header, 100, 8, mode);
  writeOctal(header, 108, 8, 0); // uid
  writeOctal(header, 116, 8, 0); // gid
  writeOctal(header, 124, 12, size);
  writeOctal(header, 136, 12, 0); // mtime: fixed for determinism
  header.fill(0x20, 148, 156); // checksum placeholder: spaces
  writeString(header, 156, 1, type);
  writeString(header, 257, 6, 'ustar\0');
  writeString(header, 263, 2, '00');
  // uname/gname stay blank; devmajor/devminor stay NUL.
  let checksum = 0;
  for (const byte of header) checksum += byte;
  const octal = checksum.toString(8).padStart(6, '0').slice(-6);
  header.write(octal, 148, 6, 'ascii');
  header[154] = 0;
  header[155] = 0x20;
  return header;
}

/** Build a deterministic ustar archive from `[{name, data, mode}]` (name order is caller-owned). */
export function createTar(entries) {
  const chunks = [];
  for (const entry of entries) {
    const name = assertSafeRelativePath(entry.name);
    if (Buffer.byteLength(name) > 100) throw integrityError(`archive entry name too long: ${name}`);
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data), 'utf8');
    chunks.push(tarHeader({ name, size: data.length, mode: entry.mode ?? 0o600 }));
    chunks.push(data);
    const padding = (TAR_BLOCK - (data.length % TAR_BLOCK)) % TAR_BLOCK;
    if (padding) chunks.push(Buffer.alloc(padding, 0));
  }
  chunks.push(Buffer.alloc(TAR_BLOCK * 2, 0));
  return Buffer.concat(chunks);
}

function parseOctal(buffer, offset, length) {
  const text = buffer.toString('ascii', offset, offset + length).replace(/\0.*$/, '').trim();
  if (!text) return 0;
  if (!/^[0-7]+$/.test(text)) throw integrityError('corrupt tar header (non-octal field)');
  return parseInt(text, 8);
}

/** Parse a ustar archive, rejecting unsafe paths and any non-regular entry. */
export function readTar(buffer) {
  const entries = [];
  let offset = 0;
  while (offset + TAR_BLOCK <= buffer.length) {
    const header = buffer.subarray(offset, offset + TAR_BLOCK);
    if (header.every((byte) => byte === 0)) break;
    const storedChecksum = parseOctal(header, 148, 8);
    const check = Buffer.from(header);
    check.fill(0x20, 148, 156);
    let sum = 0;
    for (const byte of check) sum += byte;
    if (sum !== storedChecksum) throw integrityError('corrupt tar header (checksum mismatch)');
    const name = header.toString('utf8', 0, 100).replace(/\0.*$/, '');
    const prefix = header.toString('utf8', 345, 500).replace(/\0.*$/, '');
    const fullName = prefix ? `${prefix}/${name}` : name;
    const type = String.fromCharCode(header[156]) || '\0';
    if (type !== '0' && type !== '\0') throw integrityError(`unsupported tar entry type for ${fullName} (symlinks are refused)`);
    assertSafeRelativePath(fullName);
    const size = parseOctal(header, 124, 12);
    if (size > MAX_UNPACKED_BYTES || offset + TAR_BLOCK + size > buffer.length) throw integrityError('corrupt tar entry size');
    const data = buffer.subarray(offset + TAR_BLOCK, offset + TAR_BLOCK + size);
    entries.push({ name: fullName, data: Buffer.from(data) });
    offset += TAR_BLOCK + size + ((TAR_BLOCK - (size % TAR_BLOCK)) % TAR_BLOCK);
  }
  if (!entries.length) throw integrityError('archive contains no files');
  return entries;
}

// -------------------------------------------------------------------- archive

/** Deterministic gzip wrapper (same input -> same bytes). */
export function gzipBytes(buffer) {
  return zlib.gzipSync(buffer, { level: 9 });
}

export function gunzipBytes(buffer) {
  try {
    return zlib.gunzipSync(buffer, { maxOutputLength: MAX_UNPACKED_BYTES });
  } catch (error) {
    throw integrityError(`archive is not a readable gzip stream: ${error?.message || error}`);
  }
}

/**
 * Read every DATA_DIR file, build the manifest and return deterministic archive
 * bytes. `now` only labels warnings; it never enters the archive.
 */
export async function createBackupArchive({ dataDir, appVersion = '0.0.0', maxBytes = DEFAULT_MAX_BYTES } = {}) {
  const root = path.resolve(dataDir);
  let stat;
  try {
    stat = await fsp.stat(root);
  } catch {
    throw usageError(`data dir does not exist: ${root}`);
  }
  if (!stat.isDirectory()) throw usageError(`data dir is not a directory: ${root}`);
  const paths = await walkDataFiles(root);
  if (!paths.length) throw usageError(`data dir has no files to back up: ${root}`);
  const files = [];
  let totalBytes = 0;
  for (const relativePath of paths) {
    assertSafeRelativePath(relativePath);
    const data = await fsp.readFile(path.join(root, relativePath));
    totalBytes += data.length;
    files.push({ path: relativePath, data, bytes: data.length, sha256: sha256Hex(data) });
  }
  if (maxBytes > 0 && totalBytes > maxBytes) {
    throw refusedError(`data dir is ${totalBytes} bytes (limit ${maxBytes}); pass --max-bytes to raise it`);
  }
  const manifest = buildManifest(files, { appVersion });
  const entries = [{ name: MANIFEST_NAME, data: Buffer.from(manifestJson(manifest), 'utf8'), mode: 0o644 }];
  for (const file of files) entries.push({ name: `${ARCHIVE_PREFIX}${file.path}`, data: file.data, mode: 0o600 });
  const tar = createTar(entries);
  return { buffer: gzipBytes(tar), manifest, files, totalBytes };
}

/** Parse an archive buffer back into `{ manifest, files }` and verify every digest. */
export function readBackupArchive(buffer, { source = 'archive' } = {}) {
  const tar = gunzipBytes(buffer);
  const entries = readTar(tar);
  const byName = new Map(entries.map((entry) => [entry.name, entry.data]));
  const manifestData = byName.get(MANIFEST_NAME);
  if (!manifestData) throw integrityError(`${source} has no root ${MANIFEST_NAME}`);
  const manifest = parseManifest(manifestData, { source: `${source} ${MANIFEST_NAME}` });
  const files = new Map();
  for (const file of manifest.files) {
    const data = byName.get(`${ARCHIVE_PREFIX}${file.path}`);
    if (!data) throw integrityError(`${source} is missing ${file.path}`);
    if (data.length !== file.bytes) throw integrityError(`${source} size mismatch for ${file.path}`);
    if (sha256Hex(data) !== file.sha256) throw integrityError(`${source} checksum mismatch for ${file.path}`);
    files.set(file.path, data);
  }
  const expectedNames = new Set([MANIFEST_NAME, ...manifest.files.map((file) => `${ARCHIVE_PREFIX}${file.path}`)]);
  for (const entry of entries) {
    if (!expectedNames.has(entry.name)) throw integrityError(`${source} contains an unexpected entry: ${entry.name}`);
  }
  return { manifest, files };
}

/** Verify an archive file plus its sidecar manifest (read-only). */
export async function verifyBackupFile(archivePath) {
  let buffer;
  try {
    buffer = await fsp.readFile(archivePath);
  } catch (error) {
    if (error && error.code === 'ENOENT') throw new DataError(EXIT.NOTHING_TO_RESTORE, `archive not found: ${archivePath}`);
    throw ioError(`cannot read archive ${archivePath}: ${error?.message || error}`);
  }
  const { manifest, files } = readBackupArchive(buffer, { source: path.basename(archivePath) });
  assertSchemaSupported(manifest);
  // Digests prove transport integrity; parse the JSON too so a crafted archive
  // with matching checksums cannot pass as a usable backup.
  for (const [relativePath, data] of files.entries()) {
    if (planetIndexFromPath(relativePath) !== null) readWorldSummary(data, relativePath);
    else if (relativePath === REGISTRY_PATH) readRegistrySummary(data, relativePath);
  }
  const sidecar = `${archivePath}.manifest.json`;
  try {
    const sidecarText = await fsp.readFile(sidecar, 'utf8');
    const sidecarManifest = parseManifest(sidecarText, { source: path.basename(sidecar) });
    if (manifestJson(sidecarManifest) !== manifestJson(manifest)) {
      throw integrityError(`sidecar manifest does not match the archive root manifest`);
    }
  } catch (error) {
    if (error instanceof DataError) throw error;
    if (error && error.code !== 'ENOENT') throw ioError(`cannot read sidecar manifest ${sidecar}: ${error?.message || error}`);
  }
  return { archive: archivePath, manifest, files: files.size, bytes: files.size ? [...files.values()].reduce((sum, data) => sum + data.length, 0) : 0 };
}

// -------------------------------------------------------------- reconciliation

/**
 * Reconcile the token→planet registry against the planets that actually exist.
 *
 * `planets` is `[{ index, tokens: string[] }]` for every world file present
 * (planet 0 first). Rules (OPS-03):
 *   - a token routed to a missing planet dir is routed to planet 0 (its player
 *     record may no longer exist, but the token keeps the reconnect identity);
 *   - a token absent from the players of a planet that still exists is dropped;
 *   - a player without a registry entry is added;
 *   - a token present on two planets keeps its existing registry route when that
 *     planet is one of them (escape leaves an offline clone on the old planet),
 *     otherwise the lowest live index.
 *
 * Returns `{ registry, report }` where `report` is machine-readable and counts
 * only what changed. Input objects are not mutated.
 */
export function reconcileRegistry({ registry, planets = [], version = 1, createdAt = 0 } = {}) {
  if (!registry || typeof registry !== 'object' || !registry.tokens || typeof registry.tokens !== 'object') {
    throw integrityError('registry has no tokens map');
  }
  const tokenPlanets = new Map();
  const live = [];
  for (const planet of planets) {
    if (!planet || !Number.isInteger(planet.index) || planet.index < 0) throw integrityError('planet entry has an invalid index');
    live.push(planet.index);
    for (const token of planet.tokens || []) {
      if (typeof token !== 'string' || !token) continue;
      if (!tokenPlanets.has(token)) tokenPlanets.set(token, new Set());
      tokenPlanets.get(token).add(planet.index);
    }
  }
  const missingPlanets = new Set();
  for (const value of Object.values(registry.tokens)) {
    if (Number.isInteger(value) && !live.includes(value)) missingPlanets.add(value);
  }
  const tokens = {};
  let rerouted = 0;
  let dropped = 0;
  let added = 0;
  let duplicates = 0;
  const kept = new Set();
  const liveSet = new Set(live);
  for (const [token, oldIndex] of Object.entries(registry.tokens)) {
    const indices = tokenPlanets.get(token);
    if (indices && indices.size > 0) {
      kept.add(token);
      if (indices.size > 1) duplicates += 1;
      // Prefer the recorded route when the token really is on that planet:
      // escape intentionally leaves an offline clone on the previous planet.
      const liveIndexes = [...indices].sort((a, b) => a - b);
      const target = indices.has(oldIndex) ? oldIndex : liveIndexes[0];
      if (target !== oldIndex) rerouted += 1;
      tokens[token] = target;
      continue;
    }
    // The token's player record is gone. A registry entry pointing at a planet
    // directory that no longer exists keeps its identity by routing to planet 0;
    // an entry pointing at a live planet is stale and is dropped.
    const oldIndexLive = Number.isInteger(oldIndex) && liveSet.has(oldIndex);
    if (!oldIndexLive && liveSet.has(0)) {
      tokens[token] = 0;
      rerouted += 1;
    } else {
      dropped += 1;
    }
  }
  for (const [token, indices] of tokenPlanets.entries()) {
    if (kept.has(token)) continue;
    tokens[token] = Math.min(...indices);
    added += 1;
  }
  const report = {
    planets: live.length,
    planetIndexes: [...live].sort((a, b) => a - b),
    missingPlanetIndexes: [...missingPlanets].sort((a, b) => a - b),
    tokensBefore: Object.keys(registry.tokens).length,
    tokensAfter: Object.keys(tokens).length,
    added,
    dropped,
    rerouted,
    duplicates,
    changed: added + dropped + rerouted > 0,
  };
  return {
    registry: {
      version: Number.isInteger(registry.version) ? registry.version : version,
      createdAt: Number.isInteger(registry.createdAt) ? registry.createdAt : createdAt,
      tokens,
    },
    report,
  };
}

// ------------------------------------------------------------------- retention

/**
 * Retention plan: keep the newest backup per hour for 24 hours and the newest
 * per UTC day for 7 days; everything else is removable. Pure and sorted.
 */
export function planRetention(backups, { now = Date.now(), hourly = 24, daily = 7 } = {}) {
  const entries = [...backups]
    .filter((entry) => entry && typeof entry.name === 'string' && Number.isFinite(entry.createdAt))
    .sort((a, b) => b.createdAt - a.createdAt || b.name.localeCompare(a.name));
  const keep = new Set();
  const hourKeys = new Set();
  const dayKeys = new Set();
  for (const entry of entries) {
    if (entry.createdAt > now + 60_000) continue;
    const hourKey = Math.floor(entry.createdAt / 3_600_000);
    if (!hourKeys.has(hourKey) && hourKeys.size < hourly) {
      hourKeys.add(hourKey);
      keep.add(entry.name);
    }
  }
  for (const entry of entries) {
    if (entry.createdAt > now + 60_000) continue;
    const dayKey = new Date(entry.createdAt).toISOString().slice(0, 10);
    if (!dayKeys.has(dayKey) && dayKeys.size < daily) {
      dayKeys.add(dayKey);
      keep.add(entry.name);
    }
  }
  return {
    keep: entries.filter((entry) => keep.has(entry.name)).map((entry) => entry.name),
    remove: entries.filter((entry) => !keep.has(entry.name)).map((entry) => entry.name),
  };
}

// -------------------------------------------------------------------- restore

/** Read the per-planet summaries from a directory of world files. */
export async function summariseDataDir(dataDir) {
  const root = path.resolve(dataDir);
  const planets = [];
  let registryTokens = 0;
  const files = await walkDataFiles(root);
  for (const relativePath of files) {
    if (relativePath === REGISTRY_PATH) {
      const registry = readRegistrySummary(await fsp.readFile(path.join(root, relativePath)), relativePath);
      registryTokens = Object.keys(registry.tokens).length;
      continue;
    }
    const index = planetIndexFromPath(relativePath);
    if (index === null) continue;
    const summary = readWorldSummary(await fsp.readFile(path.join(root, relativePath)), relativePath);
    planets.push({ index, ...summary });
  }
  planets.sort((a, b) => a.index - b.index);
  return {
    planets,
    players: planets.reduce((sum, planet) => sum + planet.players, 0),
    tokens: planets.reduce((sum, planet) => sum + planet.tokens, 0),
    registryTokens,
    totalClicks: planets.reduce((sum, planet) => sum + planet.totalClicks, 0),
  };
}

/**
 * Write verified archive files into a fresh staging directory (0700 dirs, 0600
 * files) and re-hash them from disk. Throws `DataError(4)` on any mismatch.
 */
export async function extractToStaging({ files, stagingDir, allowEmptyWorld = false }) {
  const root = path.resolve(stagingDir);
  let existing = null;
  try {
    existing = await fsp.readdir(root);
  } catch {
    existing = null;
  }
  if (existing && existing.length) throw refusedError(`staging directory is not empty: ${root}`);
  await fsp.mkdir(root, { recursive: true, mode: 0o700 });
  await fsp.chmod(root, 0o700).catch(() => {});
  for (const [relativePath, data] of files.entries()) {
    assertSafeRelativePath(relativePath);
    const target = path.join(root, relativePath);
    if (!target.startsWith(root + path.sep)) throw integrityError(`archive path escapes the data dir: ${relativePath}`);
    await fsp.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    await fsp.writeFile(target, data, { mode: 0o600 });
    await fsp.chmod(target, 0o600).catch(() => {});
    const written = await fsp.readFile(target);
    if (written.length !== data.length || sha256Hex(written) !== sha256Hex(data)) {
      throw integrityError(`staging verification failed for ${relativePath}`);
    }
  }
  if (!allowEmptyWorld) {
    const worldFound = [...files.keys()].some((relativePath) => planetIndexFromPath(relativePath) === 0);
    if (!worldFound) throw integrityError('archive has no planet-0 world.json (refusing an empty restore)');
  }
  return root;
}

/** Write a JSON file atomically (temp + rename) inside `dir`. */
export async function writeJsonAtomic(file, data) {
  const dir = path.dirname(file);
  await fsp.mkdir(dir, { recursive: true, mode: 0o700 });
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`);
  await fsp.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  await fsp.rename(tmp, file);
  await fsp.chmod(file, 0o600).catch(() => {});
  return file;
}

/** Best-effort directory fsync after a rename swap. */
export async function syncDir(dir) {
  try {
    const handle = await fsp.open(dir, 'r');
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
    return true;
  } catch {
    return false;
  }
}

/** Detect a live server through `GET /api/health` (used to refuse restore). */
export async function detectLiveServer({ host = '127.0.0.1', port = 4173, timeoutMs = 750 } = {}) {
  if (!port) return { live: false, skipped: true };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  try {
    const response = await fetch(`http://${host}:${port}/api/health`, { signal: controller.signal });
    if (!response.ok) return { live: false, status: response.status };
    const body = await response.json();
    return { live: body && body.ok === true, status: response.status };
  } catch (error) {
    return { live: false, error: error?.name === 'AbortError' ? 'timeout' : 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

export default {
  EXIT,
  SUPPORTED_PERSIST_VERSION,
  MANIFEST_SCHEMA,
  MANIFEST_NAME,
  ARCHIVE_PREFIX,
  createBackupArchive,
  readBackupArchive,
  verifyBackupFile,
  createTar,
  readTar,
  buildManifest,
  parseManifest,
  reconcileRegistry,
  planRetention,
  summariseDataDir,
  extractToStaging,
  detectLiveServer,
};
