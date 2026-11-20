import test from 'node:test';
import assert from 'node:assert/strict';

import {
  harvestStatus,
  harvestReadout,
  canHarvestCell,
  reasonForServerError,
  HARVEST_REASONS,
} from '../public/js/shared/harvest.js';

const ctx = (over = {}) => ({
  myIndex: 0,
  maxDepth: 8,
  serverTimeMs: 1000,
  lastClickAtMs: 900,
  clickCooldownMs: 40,
  leafEpoch: 3,
  ...over,
});

const cell = (over = {}) => ({
  label: '8.2',
  ownerIndex: -1,
  lastClickIndex: -1,
  depth: 1,
  leafEpoch: 3,
  ...over,
});

test('CTL-03: green if and only if the next click returns 200', () => {
  const unowned = harvestStatus(cell(), { index: 0 }, ctx());
  assert.deepEqual(unowned, { can: true, reason: 'ok', exhausted: false });

  const rivalLocked = harvestStatus(cell({ ownerIndex: 1, lastClickIndex: 1 }), { index: 0 }, ctx());
  assert.equal(rivalLocked.can, true, 'a rival-owned cell can be contested');
  assert.equal(rivalLocked.reason, 'ok');

  const mineClaimedByRival = harvestStatus(cell({ ownerIndex: 0, lastClickIndex: 1 }), { index: 0 }, ctx());
  assert.equal(mineClaimedByRival.can, true, 'reinforcement after a contest is legal');
});

test('CTL-03: own lock is red with the server reason', () => {
  const status = harvestStatus(cell({ ownerIndex: 0, lastClickIndex: 0 }), { index: 0 }, ctx());
  assert.equal(status.can, false);
  assert.equal(status.reason, 'own_lock');
  assert.equal(reasonForServerError('OWN_CELL_LOCKED'), 'own_lock');
});

test('CTL-03: cooldown is red and carries the remaining wait', () => {
  const status = harvestStatus(cell(), { index: 0 }, ctx({ serverTimeMs: 1010, lastClickAtMs: 1000 }));
  assert.equal(status.can, false);
  assert.equal(status.reason, 'cooldown');
  assert.equal(status.waitMs, 30);
  assert.equal(reasonForServerError('COOLDOWN'), 'cooldown');
  // Clock skew is clamped into the cooldown window, mirroring the server: a
  // future `lastClickAt` still reads as COOLDOWN, never a longer-than-real wait.
  const skewed = harvestStatus(cell(), { index: 0 }, ctx({ serverTimeMs: 900, lastClickAtMs: 1000 }));
  assert.equal(skewed.reason, 'cooldown');
  assert.equal(skewed.waitMs, 40);
});

test('CTL-03: stale leaf protects the evaluated cell', () => {
  const status = harvestStatus(cell({ leafEpoch: 2 }), { index: 0 }, ctx());
  assert.equal(status.can, false);
  assert.equal(status.reason, 'stale_leaf');
  assert.equal(reasonForServerError('NOT_A_LEAF'), 'stale_leaf');
  // Unstamped leaves (no epoch) are never called stale.
  assert.equal(harvestStatus(cell({ leafEpoch: undefined }), { index: 0 }, ctx()).can, true);
  assert.equal(harvestStatus(cell(), { index: 0 }, ctx({ leafEpoch: undefined })).can, true);
});

test('CTL-03: not joined is red before the identity resolves', () => {
  assert.equal(harvestStatus(cell(), { index: -1 }, ctx({ myIndex: -1 })).reason, 'not_joined');
  assert.equal(harvestStatus(cell(), null, ctx()).reason, 'not_joined');
  assert.equal(reasonForServerError('NOT_JOINED'), 'not_joined');
});

test('CTL-03: maximum depth is informational only and never turns a cell red', () => {
  const deep = cell({ depth: 8, resourceId: 'gold' });
  const status = harvestStatus(deep, { index: 0 }, ctx({ maxDepth: 8 }));
  assert.equal(status.can, true, 'the server accepts and scores deep cells');
  assert.equal(status.exhausted, true);
  assert.equal(status.reason, 'ok');
  assert.equal(canHarvestCell(deep, 0, 8), true, 'the boolean compatibility wrapper agrees');
  // Below max depth the informational flag stays false.
  assert.equal(harvestStatus(cell({ depth: 7 }), { index: 0 }, ctx()).exhausted, false);
});

test('CTL-03: lock plus cooldown resolves to cooldown (server precedence)', () => {
  const status = harvestStatus(cell({ ownerIndex: 0, lastClickIndex: 0 }), { index: 0 }, ctx({ serverTimeMs: 1005, lastClickAtMs: 1000 }));
  assert.equal(status.reason, 'cooldown');
  assert.equal(status.waitMs, 35);
});

test('CTL-03: every reason is in the documented enum', () => {
  for (const reason of ['ok', 'own_lock', 'cooldown', 'stale_leaf', 'not_joined']) {
    assert.ok(HARVEST_REASONS.includes(reason), `${reason} is a declared reason`);
  }
  assert.equal(HARVEST_REASONS.length, 5);
  assert.equal(reasonForServerError('NOPE'), null);
});

test('CTL-03: the target chip carries GREEN/RED plus the reason, never colour alone', () => {
  assert.equal(harvestReadout(null, null).text, 'TARGET: —');
  assert.equal(harvestReadout('8.3', { can: true, reason: 'ok', exhausted: false }).text, 'TARGET 8.3 // GREEN // HARVEST');
  assert.equal(harvestReadout('8.3', { can: false, reason: 'own_lock' }).text, 'TARGET 8.3 // RED // LOCKED');
  assert.equal(harvestReadout('8.3', { can: false, reason: 'cooldown' }).text, 'TARGET 8.3 // RED // COOLDOWN');
  assert.equal(harvestReadout('8.3', { can: false, reason: 'stale_leaf' }).text, 'TARGET 8.3 // RED // STALE');
  assert.equal(harvestReadout('8.3', { can: false, reason: 'not_joined' }, true).text, 'TARGET 8.3 // SYNCING');
  const deep = harvestReadout('8.3', { can: true, reason: 'ok', exhausted: true });
  assert.equal(deep.state, 'can');
  assert.equal(deep.exhausted, true);
});
