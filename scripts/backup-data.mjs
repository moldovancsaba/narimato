#!/usr/bin/env node
/**
 * NARIMATO — checksummed DATA_DIR backup (OPS-03).
 *
 * Writes a deterministic `narimato-<version>-<UTC stamp>-<digest>.tar.gz` plus a
 * sidecar manifest into BACKUP_DIR. Read-only on DATA_DIR; backups contain
 * tokens, so the directory is 0700 and files are 0600 and never printed.
 *
 * Usage:
 *   node scripts/backup-data.mjs --data-dir <dir> [--out <backupDir>]
 *                                [--max-bytes <n>] [--prune] [--json]
 *
 * Exit codes: 0 ok, 2 usage, 4 integrity, 6 refused, 7 I/O.
 */
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DataError,
  DEFAULT_MAX_BYTES,
  EXIT,
  MANIFEST_NAME,
  createBackupArchive,
  manifestJson,
  planRetention,
  sha256Hex,
  syncDir,
  utcStamp,
} from '../lib/data-integrity.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const options = {
    dataDir: process.env.DATA_DIR || path.join(ROOT, 'data'),
    out: process.env.BACKUP_DIR || null,
    maxBytes: DEFAULT_MAX_BYTES,
    prune: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') options.json = true;
    else if (arg === '--prune') options.prune = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--data-dir') options.dataDir = argv[++index];
    else if (arg.startsWith('--data-dir=')) options.dataDir = arg.slice('--data-dir='.length);
    else if (arg === '--out') options.out = argv[++index];
    else if (arg.startsWith('--out=')) options.out = arg.slice('--out='.length);
    else if (arg === '--max-bytes') options.maxBytes = Number(argv[++index]);
    else if (arg.startsWith('--max-bytes=')) options.maxBytes = Number(arg.slice('--max-bytes='.length));
    else throw new DataError(EXIT.USAGE, `unknown argument: ${arg}`);
  }
  if (!options.dataDir) throw new DataError(EXIT.USAGE, '--data-dir is required');
  if (options.maxBytes !== 0 && (!Number.isFinite(options.maxBytes) || options.maxBytes < 0)) {
    throw new DataError(EXIT.USAGE, '--max-bytes must be a non-negative number');
  }
  options.dataDir = path.resolve(options.dataDir);
  options.out = path.resolve(options.out || `${options.dataDir}-backups`);
  return options;
}

async function readAppVersion() {
  try {
    const pkg = JSON.parse(await fsp.readFile(path.join(ROOT, 'package.json'), 'utf8'));
    return typeof pkg.version === 'string' && pkg.version ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** Write `buffer` to `file` durably: temp file, fsync, rename, fsync dir. */
async function writeFileAtomic(file, buffer, mode = 0o600) {
  const dir = path.dirname(file);
  await fsp.mkdir(dir, { recursive: true, mode: 0o700 });
  await fsp.chmod(dir, 0o700).catch(() => {});
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.tmp`);
  const handle = await fsp.open(tmp, 'w', mode);
  try {
    await handle.writeFile(buffer);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fsp.rename(tmp, file);
  await fsp.chmod(file, mode).catch(() => {});
  await syncDir(dir);
  return file;
}

async function existingBackups(outDir) {
  let entries = [];
  try {
    entries = await fsp.readdir(outDir);
  } catch {
    return [];
  }
  const backups = [];
  for (const name of entries) {
    if (!name.endsWith('.tar.gz')) continue;
    const full = path.join(outDir, name);
    try {
      const stat = await fsp.stat(full);
      if (stat.isFile()) backups.push({ name, createdAt: stat.mtimeMs });
    } catch {
      /* raced away */
    }
  }
  return backups;
}

async function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`backup-data — ${error.message}`);
    return EXIT.USAGE;
  }
  if (options.help) {
    console.error('usage: node scripts/backup-data.mjs --data-dir <dir> [--out <backupDir>] [--max-bytes <n>] [--prune] [--json]');
    return EXIT.OK;
  }
  try {
    const appVersion = await readAppVersion();
    const { buffer, manifest, files } = await createBackupArchive({
      dataDir: options.dataDir,
      appVersion,
      maxBytes: options.maxBytes,
    });
    const digest = sha256Hex(buffer).slice(0, 8);
    const name = `narimato-${appVersion}-${utcStamp()}-${digest}.tar.gz`;
    const archive = path.join(options.out, name);
    const manifestFile = `${archive}.manifest.json`;
    await writeFileAtomic(archive, buffer, 0o600);
    await writeFileAtomic(manifestFile, Buffer.from(manifestJson(manifest), 'utf8'), 0o600);

    let retained = [];
    if (options.prune) {
      const plan = planRetention(await existingBackups(options.out), { now: Date.now() });
      for (const removeName of plan.remove) {
        await fsp.rm(path.join(options.out, removeName), { force: true });
        await fsp.rm(path.join(options.out, `${removeName}.manifest.json`), { force: true });
      }
      retained = plan.keep;
    }

    const summary = {
      ok: true,
      archive,
      manifestFile,
      files: files.length,
      bytes: buffer.length,
      planets: manifest.planets.length,
      players: manifest.planets.reduce((sum, planet) => sum + planet.players, 0),
      tokens: manifest.planets.reduce((sum, planet) => sum + planet.tokens, 0),
      appVersion: manifest.appVersion,
      persistVersion: manifest.persistVersion,
      retained,
    };
    if (options.json) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.log(
        `BACKUP ${archive} files=${summary.files} bytes=${summary.bytes} planets=${summary.planets} players=${summary.players} tokens=${summary.tokens} persist=${summary.persistVersion}`,
      );
      console.log(`manifest ${MANIFEST_NAME} at archive root and beside it: ${manifestFile}`);
    }
    return EXIT.OK;
  } catch (error) {
    if (error instanceof DataError) {
      console.error(`backup-data — ${error.message}`);
      return error.code;
    }
    console.error(`backup-data I/O — ${error?.message || error}`);
    return EXIT.IO;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}

export { main, parseArgs };
