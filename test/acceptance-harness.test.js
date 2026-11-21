import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_ALLOWED_REFUSALS,
  acceptanceExitCode,
  collectErrors,
} from '../scripts/lib/acceptance-harness.mjs';

test('acceptanceExitCode derives the exit code from the written report', () => {
  assert.equal(acceptanceExitCode({ ok: true }), 0);
  assert.equal(acceptanceExitCode({ ok: false }), 1);
  assert.equal(acceptanceExitCode({ ok: false }, { harnessFailure: true }), 2);
  assert.equal(acceptanceExitCode(null), 2);
});

test('surface-truth can allow its own expected 409 NOT_A_LEAF without hiding other refusals', () => {
  const clients = {
    errors: [],
    consoleErrors: [],
    refusals: [
      { status: 409, url: 'http://x/api/action', error: 'NOT_A_LEAF' },
      { status: 409, url: 'http://x/api/action', error: 'OWN_CELL_LOCKED' },
    ],
  };
  const defaultSignals = collectErrors(clients);
  assert.equal(defaultSignals.errors.length, 1, 'NOT_A_LEAF is unexpected by default');
  assert.equal(defaultSignals.allowedRefusals.length, 1);

  const surfaceTruth = collectErrors(clients, {
    allowedRefusals: [...DEFAULT_ALLOWED_REFUSALS, 'NOT_A_LEAF'],
  });
  assert.equal(surfaceTruth.errors.length, 0);
  assert.equal(surfaceTruth.allowedRefusals.length, 2);
});
