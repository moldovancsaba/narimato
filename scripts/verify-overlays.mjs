#!/usr/bin/env node
/**
 * NARIMATO — overlays browser evidence (UI-03).
 * Thin wrapper around scripts/verify-ui-migration.mjs --suite overlays.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const result = spawnSync(process.execPath, [path.join(here, 'verify-ui-migration.mjs'), '--suite', 'overlays'], {
  stdio: 'inherit',
  env: process.env,
});
process.exitCode = result.status == null ? 1 : result.status;
