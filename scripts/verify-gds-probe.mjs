#!/usr/bin/env node
/**
 * NARIMATO — GDS browser probe compatibility entry (UI-01 → UI-05).
 *
 * The standalone UI-01 proof component was retired when UI-02…UI-05 migrated the
 * real game surfaces. `?gds=proof` now mounts the migrated app surface with
 * `data-gds-proof-ready`, and the contract it used to prove is covered by the
 * migrated-surface harness: required ids, focus/restore, axe, nine viewports,
 * 200% zoom and reduced motion. This entry keeps the old command working.
 *
 * Usage:
 *   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node scripts/verify-gds-probe.mjs
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const result = spawnSync(process.execPath, [path.join(here, 'verify-ui-migration.mjs'), '--suite', 'hud'], {
  stdio: 'inherit',
  env: process.env,
});
process.exitCode = result.status == null ? 1 : result.status;
