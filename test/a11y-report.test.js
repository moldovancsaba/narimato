import test from 'node:test';
import assert from 'node:assert/strict';

import {
  A11Y_SCHEMA_VERSION,
  assembleReport,
  createFinding,
  summarize,
} from '../scripts/lib/a11y-report.mjs';
import { SURFACES, selectSurfaces, surfaceById } from '../public/js/a11y-surfaces.js';

const surface = (id) => ({ id, route: `/?surface=${id}`, viewport: { width: 1280, height: 800 } });
const finding = (overrides = {}) =>
  createFinding({ check: 'axe', surface: 'hud', selector: '#x', expected: 'none', actual: 'violation', ...overrides });

test('a11y report: findings carry check, surface, selector, expected and actual', () => {
  const value = finding({ id: 'color-contrast', severity: 'critical', status: 'failure', message: 'bad' });
  assert.equal(value.check, 'axe');
  assert.equal(value.id, 'color-contrast');
  assert.equal(value.surface, 'hud');
  assert.equal(value.selector, '#x');
  assert.equal(value.expected, 'none');
  assert.equal(value.actual, 'violation');
  assert.equal(value.status, 'failure');
});

test('a11y report: invalid severity or status is rejected', () => {
  assert.throws(() => createFinding({ check: 'axe', surface: 'hud', severity: 'blocker' }), /unknown severity/);
  assert.throws(() => createFinding({ check: 'axe', surface: 'hud', status: 'pass' }), /unknown finding status/);
  assert.throws(() => createFinding({ severity: 'serious' }), /requires check and surface/);
});

test('a11y report: summary counts every status and total', () => {
  const findings = [
    finding({ status: 'failure' }),
    finding({ status: 'warning' }),
    finding({ status: 'incomplete' }),
    finding({ status: 'suppressed' }),
  ];
  assert.deepEqual(summarize(findings), { pass: 0, warning: 1, failure: 1, incomplete: 1, suppressed: 1, total: 4 });
});

test('a11y report: surface status is failure > incomplete > warning > pass', () => {
  const surfaces = [surface('a'), surface('b'), surface('c'), surface('d')];
  const report = assembleReport({
    engine: 'chromium',
    surfaces,
    findings: [
      finding({ surface: 'a', status: 'warning' }),
      finding({ surface: 'b', status: 'incomplete' }),
      finding({ surface: 'c', status: 'failure' }),
      finding({ surface: 'd', status: 'suppressed' }),
    ],
  });
  assert.equal(report.surfaces.find((entry) => entry.id === 'a').status, 'warning');
  assert.equal(report.surfaces.find((entry) => entry.id === 'b').status, 'incomplete');
  assert.equal(report.surfaces.find((entry) => entry.id === 'c').status, 'failure');
  assert.equal(report.surfaces.find((entry) => entry.id === 'd').status, 'pass');
  assert.equal(report.status, 'failure');
  assert.equal(report.schemaVersion, A11Y_SCHEMA_VERSION);
});

test('a11y report: findings and surfaces are deterministic (sorted)', () => {
  const report = assembleReport({
    engine: 'chromium',
    surfaces: [surface('hud'), surface('landing')],
    findings: [
      finding({ surface: 'hud', selector: '#z' }),
      finding({ surface: 'hud', selector: '#a' }),
      finding({ surface: 'landing', selector: '#a' }),
    ],
  });
  assert.deepEqual(report.findings.map((entry) => `${entry.surface}:${entry.selector}`), ['hud:#a', 'hud:#z', 'landing:#a']);
  assert.deepEqual(report.surfaces.map((entry) => entry.id), ['hud', 'landing']);
});

test('a11y report: engine, commit, startedAt and duration are recorded', () => {
  const report = assembleReport({
    engine: 'webkit',
    commit: 'abc123',
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T00:01:00.000Z',
    durationMs: 60000,
  });
  assert.equal(report.engine, 'webkit');
  assert.equal(report.commit, 'abc123');
  assert.equal(report.startedAt, '2026-01-01T00:00:00.000Z');
  assert.equal(report.generatedAt, '2026-01-01T00:01:00.000Z');
  assert.equal(report.durationMs, 60000);
  assert.equal(report.mode, 'full');
});

test('a11y surfaces: registry has nine unique migrated surfaces', () => {
  assert.equal(SURFACES.length, 9);
  assert.equal(new Set(SURFACES.map((entry) => entry.id)).size, 9);
  for (const entry of SURFACES) {
    assert.ok(entry.route.startsWith('/?'), `${entry.id} route`);
    assert.ok(entry.viewport.width > 0 && entry.viewport.height > 0, `${entry.id} viewport`);
    assert.ok(Array.isArray(entry.expectedTabOrder) && entry.expectedTabOrder.length > 0, `${entry.id} tab order`);
    assert.ok(Array.isArray(entry.primarySelectors) && entry.primarySelectors.length > 0, `${entry.id} primary actions`);
    assert.equal(typeof entry.setup, 'function', `${entry.id} setup`);
  }
  assert.ok(surfaceById('incident'));
  assert.ok(surfaceById('incident').dialog);
  assert.ok(surfaceById('incident').expectedTabOrder.includes('#meteor-dismiss'));
  assert.equal(selectSurfaces('hud,incident').length, 2);
  assert.throws(() => selectSurfaces('nope'), /unknown surface/);
});
