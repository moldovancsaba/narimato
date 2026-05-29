#!/usr/bin/env node
/**
 * Canonical consumer verification (GDS 2.6.5+): compliance, guards, lint.
 * Run `npm run test:full` to include production build.
 */
const { spawnSync } = require('node:child_process');

const steps = [
  ['gds:ci-guard', ['run', 'gds:ci-guard']],
  ['gds:validate', ['run', 'gds:validate']],
  ['gds:compliance', ['run', 'gds:compliance']],
  ['lint', ['run', 'lint']],
];

let failed = false;

for (const [label, args] of steps) {
  const result = spawnSync('npm', args, { stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    console.error(`verify-gds: ${label} failed`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
