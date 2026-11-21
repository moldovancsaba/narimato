import test from 'node:test';
import assert from 'node:assert/strict';

import {
  A11Y_SCHEMA_VERSION,
  assembleReport,
  isAllowedRuntimeError,
} from '../scripts/lib/a11y-report.mjs';

const CONFLICT = 'Failed to load resource: the server responded with a status of 409 (Conflict)';
const SCRIPT_ERROR = 'Uncaught TypeError: boom';

test('isAllowedRuntimeError accepts the expected surface conflict', () => {
  const patterns = [/Failed to load resource: the server responded with a status of 409 \(Conflict\)/];
  assert.equal(isAllowedRuntimeError(CONFLICT, patterns), true);
});

test('isAllowedRuntimeError keeps unexpected errors fatal', () => {
  const patterns = [/409 \(Conflict\)/];
  assert.equal(isAllowedRuntimeError(SCRIPT_ERROR, patterns), false);
  assert.equal(isAllowedRuntimeError(CONFLICT, []), false);
  assert.equal(isAllowedRuntimeError(CONFLICT, [SCRIPT_ERROR]), false);
});

test('assembleReport records expected runtime errors once and keeps schema version', () => {
  const report = assembleReport({
    engine: 'chromium',
    surfaces: [{ id: 'surface', route: '/?gds=1', viewport: { width: 1440, height: 900 } }],
    findings: [],
    expectedRuntimeErrors: [CONFLICT, CONFLICT],
  });
  assert.equal(report.schemaVersion, A11Y_SCHEMA_VERSION);
  assert.deepEqual(report.expectedRuntimeErrors, [CONFLICT]);
  assert.equal(report.status, 'pass');
});
