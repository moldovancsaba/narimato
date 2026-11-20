#!/usr/bin/env node
/**
 * NARIMATO — surface browser evidence (UI-04).
 * Thin wrapper around scripts/verify-ui-migration.mjs --suite surface.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const result = spawnSync(process.execPath, [path.join(here, 'verify-ui-migration.mjs'), '--suite', 'surface'], {
  stdio: 'inherit',
  env: process.env,
});
process.exitCode = result.status == null ? 1 : result.status;
