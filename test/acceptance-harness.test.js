import test from 'node:test';
import assert from 'node:assert/strict';

import {
  acceptanceExitCode,
  collectErrors,
} from '../scripts/lib/acceptance-harness.mjs';

test('acceptanceExitCode derives the exit code from the written report', () => {
  assert.equal(acceptanceExitCode({ ok: true }), 0);
  assert.equal(acceptanceExitCode({ ok: false }), 1);
  assert.equal(acceptanceExitCode({ ok: false }, { harnessFailure: true }), 2);
  assert.equal(acceptanceExitCode(null), 2);
});

test('NOT_A_LEAF is an expected protocol refusal, other refusals stay errors', () => {
  const clients = {
    errors: [],
    consoleErrors: [],
    refusals: [
      { status: 409, url: 'http://x/api/action', error: 'NOT_A_LEAF' },
      { status: 409, url: 'http://x/api/action', error: 'OWN_CELL_LOCKED' },
    ],
  };
  const signals = collectErrors(clients);
  assert.equal(signals.errors.length, 0, 'NOT_A_LEAF is a legitimate harvest refusal');
  assert.equal(signals.allowedRefusals.length, 2);

  const strict = collectErrors(clients, { allowedRefusals: ['OWN_CELL_LOCKED'] });
  assert.equal(strict.errors.length, 1, 'a stricter surface can still surface NOT_A_LEAF');
  assert.equal(strict.allowedRefusals.length, 1);
});
