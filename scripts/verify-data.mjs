#!/usr/bin/env node
/**
 * NARIMATO — read-only backup verification (OPS-03).
 *
 * Proves a `.tar.gz` backup is usable without touching DATA_DIR: every manifest
 * path is safe, every size/sha256 matches, the sidecar manifest agrees with the
 * archive root manifest and the persistence schema is readable by this build.
 *
 * Usage:
 *   node scripts/verify-data.mjs --archive <file> [--json]
 *
 * Exit codes: 0 ok, 2 usage, 3 nothing to verify, 4 integrity, 5 schema newer, 7 I/O.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DataError, EXIT, verifyBackupFile } from '../lib/data-integrity.js';

function parseArgs(argv) {
  const options = { archive: null, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--archive') options.archive = argv[++index];
    else if (arg.startsWith('--archive=')) options.archive = arg.slice('--archive='.length);
    else if (arg.startsWith('-')) throw new DataError(EXIT.USAGE, `unknown argument: ${arg}`);
    else options.archive = arg;
  }
  if (!options.archive) throw new DataError(EXIT.USAGE, '--archive is required');
  options.archive = path.resolve(options.archive);
  return options;
}

async function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`verify-data — ${error.message}`);
    return EXIT.USAGE;
  }
  if (options.help) {
    console.error('usage: node scripts/verify-data.mjs --archive <file> [--json]');
    return EXIT.OK;
  }
  try {
    const report = await verifyBackupFile(options.archive);
    const summary = {
      ok: true,
      archive: report.archive,
      files: report.files,
      bytes: report.bytes,
      appVersion: report.manifest.appVersion,
      persistVersion: report.manifest.persistVersion,
      planets: report.manifest.planets,
    };
    if (options.json) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.log(
        `OK ${report.archive} files=${report.files} bytes=${report.bytes} app=${report.manifest.appVersion} persist=${report.manifest.persistVersion} planets=${report.manifest.planets.length}`,
      );
    }
    return EXIT.OK;
  } catch (error) {
    if (error instanceof DataError) {
      console.error(`verify-data — ${error.message}`);
      if (options.json) console.log(JSON.stringify({ ok: false, archive: options.archive, exitCode: error.code, error: error.message }));
      return error.code;
    }
    console.error(`verify-data I/O — ${error?.message || error}`);
    return EXIT.IO;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}

export { main, parseArgs };
