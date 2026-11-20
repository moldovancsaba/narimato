#!/usr/bin/env node
/**
 * NARIMATO — staged, verified DATA_DIR restore (OPS-03).
 *
 * Plan → verify → extract into a sibling staging dir → verify digests →
 * reconcile registry/worlds → swap with two renames. A failure before the swap
 * deletes staging and leaves the live directory untouched; the previous live
 * directory is retained as `DATA_DIR.pre-restore-<UTC stamp>`.
 *
 * Usage:
 *   node scripts/restore-data.mjs --backup <archive> --data-dir <dir> --dry-run
 *   node scripts/restore-data.mjs --backup <archive> --data-dir <dir> --apply --yes
 *
 * Options: --port <n> (server-live check, 0 disables), --no-server-check,
 *          --allow-empty-world, --json.
 *
 * Exit codes: 0 ok, 2 usage, 3 nothing to restore, 4 integrity, 5 schema newer,
 * 6 refused (live server / missing confirmation), 7 I/O.
 */
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DataError,
  EXIT,
  assertSchemaSupported,
  detectLiveServer,
  extractToStaging,
  integrityError,
  ioError,
  planetIndexFromPath,
  readBackupArchive,
  readRegistrySummary,
  reconcileRegistry,
  refusedError,
  schemaTooNewError,
  SUPPORTED_PERSIST_VERSION,
  summariseDataDir,
  syncDir,
  utcStamp,
  walkDataFiles,
  writeJsonAtomic,
} from '../lib/data-integrity.js';

function parseArgs(argv) {
  const options = {
    backup: null,
    dataDir: process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : null,
    dryRun: false,
    apply: false,
    yes: false,
    json: false,
    serverCheck: true,
    port: process.env.PORT !== undefined ? Number(process.env.PORT) : 4173,
    host: process.env.HOST === '0.0.0.0' ? '127.0.0.1' : process.env.HOST || '127.0.0.1',
    allowEmptyWorld: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--apply') options.apply = true;
    else if (arg === '--yes') options.yes = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--no-server-check') options.serverCheck = false;
    else if (arg === '--allow-empty-world') options.allowEmptyWorld = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--backup') options.backup = argv[++index];
    else if (arg.startsWith('--backup=')) options.backup = arg.slice('--backup='.length);
    else if (arg === '--data-dir') options.dataDir = path.resolve(argv[++index]);
    else if (arg.startsWith('--data-dir=')) options.dataDir = path.resolve(arg.slice('--data-dir='.length));
    else if (arg === '--port') options.port = Number(argv[++index]);
    else if (arg.startsWith('--port=')) options.port = Number(arg.slice('--port='.length));
    else if (arg === '--host') options.host = argv[++index];
    else if (arg.startsWith('--host=')) options.host = arg.slice('--host='.length);
    else throw new DataError(EXIT.USAGE, `unknown argument: ${arg}`);
  }
  if (!options.backup) throw new DataError(EXIT.USAGE, '--backup is required');
  if (!options.dataDir) throw new DataError(EXIT.USAGE, '--data-dir is required');
  if (options.dryRun && options.apply) throw new DataError(EXIT.USAGE, '--dry-run and --apply are mutually exclusive');
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535) throw new DataError(EXIT.USAGE, '--port must be 0..65535');
  options.backup = path.resolve(options.backup);
  options.dataDir = path.resolve(options.dataDir);
  return options;
}

/** Token list per planet read straight from a directory (staging or live). */
async function planetTokenMap(dataDir) {
  const root = path.resolve(dataDir);
  const planets = [];
  const files = await walkDataFiles(root);
  for (const relativePath of files) {
    const index = planetIndexFromPath(relativePath);
    if (index === null) continue;
    let world;
    try {
      world = JSON.parse(await fsp.readFile(path.join(root, relativePath), 'utf8'));
    } catch {
      throw integrityError(`${relativePath} is not valid JSON`);
    }
    const tokens = Array.isArray(world?.players)
      ? world.players.filter((player) => player && typeof player.token === 'string').map((player) => player.token)
      : [];
    planets.push({ index, tokens });
  }
  return planets.sort((a, b) => a.index - b.index);
}

async function readRegistryOrNull(dataDir) {
  const file = path.join(dataDir, 'planets', 'registry.json');
  try {
    return readRegistrySummary(await fsp.readFile(file), 'planets/registry.json');
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    if (error instanceof DataError) throw error;
    return null;
  }
}

async function exists(target) {
  try {
    await fsp.lstat(target);
    return true;
  } catch {
    return false;
  }
}

function printPlan(options, plan) {
  if (options.json) return;
  console.log('RESTORE PLAN');
  console.log(`  backup:       ${options.backup}`);
  console.log(`  target:       ${options.dataDir}`);
  console.log(`  staging:      ${plan.stagingDir}`);
  console.log(`  retained:     ${plan.retainedDir}`);
  console.log(`  archive:      files=${plan.files} bytes=${plan.bytes} planets=${plan.planets} app=${plan.appVersion} persist=${plan.persistVersion}`);
  console.log(`  current:      ${plan.current.exists ? `players=${plan.current.players} tokens=${plan.current.tokens}${plan.current.corrupt ? ' (corrupt)' : ''}` : 'no existing data dir'}`);
  console.log(`  actions:      verify archive -> extract staging -> verify digests -> reconcile -> rename swap`);
}

async function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`restore-data — ${error.message}`);
    return EXIT.USAGE;
  }
  if (options.help) {
    console.error(
      'usage: node scripts/restore-data.mjs --backup <archive> --data-dir <dir> [--dry-run] [--apply --yes] [--port <n>] [--no-server-check] [--allow-empty-world] [--json]',
    );
    return EXIT.OK;
  }

  const stamp = utcStamp();
  const parent = path.dirname(options.dataDir);
  const stagingDir = path.join(parent, `${path.basename(options.dataDir)}.staging-${process.pid}-${crypto.randomBytes(3).toString('hex')}`);
  const retainedDir = path.join(parent, `${path.basename(options.dataDir)}.pre-restore-${stamp}`);
  let stagingCreated = false;
  let response = EXIT.OK;

  try {
    const archiveBuffer = await readFileOrThrow(options.backup);
    const { manifest, files } = readBackupArchive(archiveBuffer, { source: path.basename(options.backup) });
    assertSchemaSupported(manifest);

    const current = {
      exists: await exists(options.dataDir),
      players: 0,
      tokens: 0,
      corrupt: false,
    };
    if (current.exists) {
      // A corrupt live world is the main reason to restore: summarise defensively.
      try {
        const summary = await summariseDataDir(options.dataDir);
        current.players = summary.players;
        current.tokens = summary.tokens;
      } catch {
        current.corrupt = true;
      }
    }
    const plan = {
      stagingDir,
      retainedDir,
      files: files.size,
      bytes: archiveBuffer.length,
      planets: manifest.planets.length,
      appVersion: manifest.appVersion,
      persistVersion: manifest.persistVersion,
      current,
    };
    printPlan(options, plan);
    if (options.json) {
      console.log(JSON.stringify({ ok: true, dryRun: !options.apply, plan }, null, 2));
    }

    if (!options.apply) {
      if (options.dryRun) {
        if (!options.json) console.log('DRY RUN — nothing written.');
        return EXIT.OK;
      }
      console.error('restore-data — refusing to write: pass --apply --yes (or use --dry-run)');
      return EXIT.REFUSED;
    }
    if (!options.yes) {
      console.error('restore-data — refusing to write: --apply requires --yes');
      return EXIT.REFUSED;
    }

    if (options.serverCheck) {
      const live = await detectLiveServer({ host: options.host, port: options.port });
      if (live.live) {
        console.error(`restore-data — refusing to run: a server is live at http://${options.host}:${options.port}/api/health`);
        return EXIT.REFUSED;
      }
    }

    await fsp.mkdir(parent, { recursive: true });
    await extractToStaging({ files, stagingDir, allowEmptyWorld: options.allowEmptyWorld });
    stagingCreated = true;

    // Refuse a payload that a newer schema wrote even if the manifest lied.
    const stagedSummaries = await summariseDataDir(stagingDir);
    const tooNew = stagedSummaries.planets.filter((planet) => planet.version > SUPPORTED_PERSIST_VERSION);
    if (tooNew.length) {
      throw schemaTooNewError(
        `restored world schema ${tooNew.map((planet) => planet.version).join(', ')} is newer than this build (${SUPPORTED_PERSIST_VERSION})`,
      );
    }

    // Reconcile the restored registry against the restored worlds before the swap.
    const registry = await readRegistryOrNull(stagingDir);
    const planets = await planetTokenMap(stagingDir);
    const reconciled = reconcileRegistry({
      registry: registry || { version: 1, createdAt: Date.now(), tokens: {} },
      planets,
    });
    const repaired = reconciled.report.added + reconciled.report.dropped + reconciled.report.rerouted;
    if (!registry || repaired > 0) {
      await writeJsonAtomic(path.join(stagingDir, 'planets', 'registry.json'), reconciled.registry);
    }

    const after = await summariseDataDir(stagingDir);

    // Two-rename swap. The live directory is retained for rollback.
    let movedLive = false;
    if (await exists(options.dataDir)) {
      if (await exists(retainedDir)) throw refusedError(`retained directory already exists: ${retainedDir}`);
      await fsp.rename(options.dataDir, retainedDir);
      movedLive = true;
    }
    try {
      await fsp.rename(stagingDir, options.dataDir);
      stagingCreated = false;
    } catch (error) {
      if (movedLive) await fsp.rename(retainedDir, options.dataDir).catch(() => {});
      throw ioError(`swap failed, live data left untouched: ${error?.message || error}`);
    }
    await syncDir(parent);

    const report = {
      ok: true,
      status: 'RESTORED',
      dataDir: options.dataDir,
      retained: movedLive ? retainedDir : null,
      playersBefore: current.players,
      playersAfter: after.players,
      tokensBefore: current.tokens,
      tokensAfter: after.tokens,
      repaired,
      reconcile: reconciled.report,
      archive: options.backup,
      appVersion: manifest.appVersion,
      persistVersion: manifest.persistVersion,
    };
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(`RESTORED players=${after.players} tokens=${after.tokens} repaired=${repaired}`);
      if (movedLive) console.log(`retained previous data dir: ${retainedDir}`);
      console.log(`reconcile: added=${reconciled.report.added} dropped=${reconciled.report.dropped} rerouted=${reconciled.report.rerouted} duplicates=${reconciled.report.duplicates} planets=${reconciled.report.planets}`);
    }
    return EXIT.OK;
  } catch (error) {
    if (stagingCreated) await fsp.rm(stagingDir, { recursive: true, force: true }).catch(() => {});
    if (error instanceof DataError) {
      console.error(`restore-data — ${error.message}`);
      response = error.code;
    } else {
      console.error(`restore-data I/O — ${error?.message || error}`);
      response = EXIT.IO;
    }
    return response;
  }
}

async function readFileOrThrow(file) {
  try {
    return await fsp.readFile(file);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new DataError(EXIT.NOTHING_TO_RESTORE, `no such backup: ${file} — create one with node scripts/backup-data.mjs --data-dir <dir>`);
    }
    throw ioError(`cannot read backup ${file}: ${error?.message || error}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}

export { main, parseArgs, planetTokenMap };
