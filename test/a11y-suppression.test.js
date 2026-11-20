import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applySuppressions,
  createFinding,
  isExpired,
  loadSuppressionLedger,
  validateSuppression,
} from '../scripts/lib/a11y-report.mjs';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const good = (overrides = {}) => ({
  id: 'color-contrast',
  selector: '#vendor-map',
  route: 'hud',
  reason: 'Third-party map internals.',
  owner: 'Maps team',
  expiresAt: '2026-07-01',
  replacementPath: 'Remove after the provider update.',
  ...overrides,
});
const finding = (overrides = {}) =>
  createFinding({
    check: 'axe',
    id: 'color-contrast',
    surface: 'hud',
    selector: '#vendor-map',
    expected: '>= 4.5:1',
    actual: '3.2:1',
    ...overrides,
  });

test('suppression policy: a complete, in-window, owned waiver validates', () => {
  const result = validateSuppression(good(), { now: NOW, maxExpiryDays: 90 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('suppression policy: owner, reason, expiry and replacement path are mandatory', () => {
  for (const field of ['id', 'reason', 'owner', 'expiresAt', 'replacementPath']) {
    const result = validateSuppression(good({ [field]: '' }), { now: NOW });
    assert.equal(result.ok, false, `${field} must be required`);
    assert.ok(result.errors.includes(`missing ${field}`), `${field}: ${result.errors.join(', ')}`);
  }
});

test('suppression policy: expired, malformed and over-long waivers are rejected', () => {
  assert.equal(validateSuppression(good({ expiresAt: '2026-05-31' }), { now: NOW }).ok, false);
  assert.match(validateSuppression(good({ expiresAt: 'soon' }), { now: NOW }).errors.join(' '), /YYYY-MM-DD/);
  assert.match(validateSuppression(good({ expiresAt: '2027-01-01' }), { now: NOW, maxExpiryDays: 90 }).errors.join(' '), /exceeds/);
});

test('suppression policy: ledger validation reports invalid entries as critical findings', () => {
  const ledger = loadSuppressionLedger(
    { policy: { maxExpiryDays: 90 }, suppressions: [good(), good({ owner: '', id: 'region' })] },
    { now: NOW },
  );
  assert.equal(ledger.suppressions.length, 1);
  assert.equal(ledger.findings.length, 1);
  assert.equal(ledger.findings[0].check, 'suppression-policy');
  assert.equal(ledger.findings[0].status, 'failure');
  assert.equal(ledger.findings[0].severity, 'critical');
});

test('suppression policy: a live suppression marks the matching finding suppressed', () => {
  const result = applySuppressions([finding()], [good()], { now: NOW });
  assert.equal(result.findings[0].status, 'suppressed');
  assert.equal(result.findings[0].suppression.owner, 'Maps team');
  assert.equal(result.applied.length, 1);
  assert.equal(result.unused.length, 0);
});

test('suppression policy: matching narrows on selector and route', () => {
  assert.equal(applySuppressions([finding()], [good({ selector: '#other' })], { now: NOW }).findings[0].status, 'failure');
  assert.equal(applySuppressions([finding()], [good({ route: 'landing' })], { now: NOW }).findings[0].status, 'failure');
  assert.equal(applySuppressions([finding()], [good({ route: undefined, selector: undefined })], { now: NOW }).findings[0].status, 'suppressed');
});

test('suppression policy: an expired suppression never hides a finding', () => {
  const result = applySuppressions([finding()], [good({ expiresAt: '2026-05-31' })], { now: NOW });
  assert.equal(result.findings[0].status, 'failure');
  assert.match(result.findings[0].message, /Suppression color-contrast expired on 2026-05-31/);
  assert.equal(result.expired.length, 1);
});

test('suppression policy: unused suppressions are surfaced for strict mode', () => {
  const result = applySuppressions([finding({ selector: '#no-match' })], [good()], { now: NOW });
  assert.equal(result.findings[0].status, 'failure');
  assert.equal(result.unused.length, 1);
  assert.equal(result.applied.length, 0);
});

test('suppression policy: isExpired treats the expiry date as end of day UTC', () => {
  assert.equal(isExpired('2026-06-01', new Date('2026-06-01T23:59:00.000Z')), false);
  assert.equal(isExpired('2026-06-01', new Date('2026-06-02T00:00:01.000Z')), true);
  assert.equal(isExpired('nonsense', NOW), true);
});
