import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ALL_HUD_NODES,
  ORBIT_HUD_NODES,
  SURFACE_HUD_NODES,
  isSurfaceOnlyNode,
  lapPercent,
  modeAttributes,
  parity,
  snapshotFromIds,
  targetReadout,
} from '../public/js/shared/hud-parity.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'public/css/cyberpunk.css'), 'utf8');

function hudNodeIds(html) {
  return [...html.matchAll(/data-hud-node="([^"]+)"/g)].map((match) => match[1]);
}

test('hud parity: snapshot keeps order, counts and duplicate ids', () => {
  const snapshot = snapshotFromIds(['hud', 'score', 'world', 'score', 'hud']);
  assert.deepEqual(snapshot.nodes, ['hud', 'score', 'world']);
  assert.equal(snapshot.total, 5);
  assert.equal(snapshot.unique, 3);
  assert.deepEqual(snapshot.duplicates.sort(), ['hud', 'score']);
  assert.equal(snapshotFromIds([null, '', 5, 'hud']).total, 1);
});

test('hud parity: P = 1.0 and duplicates = 0 when surface only adds its nodes', () => {
  const orbit = snapshotFromIds(ORBIT_HUD_NODES);
  const during = snapshotFromIds([...ORBIT_HUD_NODES, ...SURFACE_HUD_NODES]);
  const after = snapshotFromIds(ORBIT_HUD_NODES);
  const report = parity(orbit, during, after);
  assert.equal(report.P, 1);
  assert.equal(report.ok, true);
  assert.deepEqual(report.missingDuring, []);
  assert.deepEqual(report.missingAfter, []);
  assert.deepEqual(report.unexpectedDuring, []);
  assert.deepEqual(report.duplicates, []);
  assert.equal(report.addedDuring.length, SURFACE_HUD_NODES.length);
  for (const id of report.addedDuring) assert.equal(isSurfaceOnlyNode(id), true);
});

test('hud parity: a recreated or missing panel fails the parity contract', () => {
  const orbit = snapshotFromIds(ORBIT_HUD_NODES);
  const missing = snapshotFromIds(ORBIT_HUD_NODES.filter((id) => id !== 'players'));
  const damaged = parity(orbit, missing, orbit);
  assert.ok(damaged.P < 1);
  assert.equal(damaged.ok, false);
  assert.deepEqual(damaged.missingDuring, ['players']);
  const duplicated = snapshotFromIds([...ORBIT_HUD_NODES, ...ORBIT_HUD_NODES]);
  const dupReport = parity(orbit, duplicated, orbit);
  assert.equal(dupReport.P, 1);
  assert.equal(dupReport.ok, false, 'duplicate ids fail even at full parity');
  assert.ok(dupReport.duplicates.includes('score'));
  const foreign = parity(orbit, snapshotFromIds([...ORBIT_HUD_NODES, 'surface-target', 'mission-copy']), orbit);
  assert.deepEqual(foreign.unexpectedDuring, ['mission-copy']);
});

test('hud parity: target readout falls back safely for every state', () => {
  assert.deepEqual(targetReadout(null, false), { text: 'TARGET: —', state: 'idle' });
  assert.deepEqual(targetReadout('', true), { text: 'TARGET: —', state: 'idle' });
  assert.deepEqual(targetReadout('8.3', true), { text: 'TARGET 8.3 // GREEN // HARVEST', state: 'can' });
  assert.deepEqual(targetReadout('8.3', false), { text: 'TARGET 8.3 // RED // LOCKED', state: 'locked' });
});

test('hud parity: lap percentage is clamped and integral', () => {
  assert.equal(lapPercent(-1), 0);
  assert.equal(lapPercent(0), 0);
  assert.equal(lapPercent(0.426), 43);
  assert.equal(lapPercent(1), 100);
  assert.equal(lapPercent(2), 100);
  assert.equal(lapPercent('nope'), 0);
  assert.equal(lapPercent(Number.NaN), 0);
});

test('hud parity: mode attributes describe the one tree switch', () => {
  assert.deepEqual(modeAttributes('surface'), { hudMode: 'surface', controlsHidden: false });
  assert.deepEqual(modeAttributes('orbit'), { hudMode: 'orbit', controlsHidden: true });
  assert.deepEqual(modeAttributes(undefined), { hudMode: 'orbit', controlsHidden: true });
});

test('hud parity: index.html mounts every HUD node exactly once inside #hud', () => {
  const ids = hudNodeIds(HTML);
  assert.equal(ids.length, new Set(ids).size, 'no duplicated data-hud-node ids');
  for (const id of ALL_HUD_NODES) {
    assert.equal(ids.filter((value) => value === id).length, 1, `node ${id} mounted once`);
  }
  assert.equal(ids.length, ALL_HUD_NODES.length, 'no undeclared HUD nodes');
  const hudStart = HTML.indexOf('id="hud"');
  const hudEnd = HTML.indexOf('<!-- ========================== LANDING');
  assert.ok(hudStart > 0 && hudEnd > hudStart, 'HUD block located');
  const hudBlock = HTML.slice(hudStart, hudEnd);
  assert.equal(hudNodeIds(hudBlock).length, ALL_HUD_NODES.length, 'all HUD nodes live in the single #hud tree');
  assert.ok(hudBlock.includes('id="surface-controls"'), 'surface strip is inside #hud');
  assert.equal(HTML.includes('data-mode="orbit"'), true, '#hud starts in orbit mode');
});

test('hud parity: no duplicate surface panels and no second canvas remain', () => {
  for (const banned of ['surface-canvas', 'surface-overlay', 'is-surface', 'surface-mission-list', 'surface-goal', 'surface-title']) {
    assert.equal(HTML.includes(banned), false, `index.html must not contain ${banned}`);
    assert.equal(CSS.includes(banned), false, `cyberpunk.css must not contain ${banned}`);
  }
  const planetCanvases = [...HTML.matchAll(/<canvas[^>]*id="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(planetCanvases.filter((id) => id === 'arena-canvas'), ['arena-canvas']);
  assert.equal((HTML.match(/id="arena-canvas"/g) || []).length, 1, 'exactly one planet canvas');
  assert.equal((HTML.match(/id="surface-controls"/g) || []).length, 1, 'one surface control strip');
});

test('hud parity: the surface strip is an accessible named group', () => {
  const strip = /<div id="surface-controls"[^>]*>/.exec(HTML);
  assert.ok(strip, 'surface controls exist');
  assert.match(strip[0], /role="group"/);
  assert.match(strip[0], /aria-label="Surface controls"/);
  assert.match(strip[0], /hidden/, 'strip is hidden in orbit');
  const target = /<p id="surface-target"[^>]*>/.exec(HTML);
  assert.ok(target, 'target readout exists');
  assert.match(target[0], /aria-live="polite"/);
  const lap = /<div id="surface-lap"[^>]*>/.exec(HTML);
  assert.ok(lap, 'lap progressbar exists');
  assert.match(lap[0], /role="progressbar"/);
  assert.match(lap[0], /aria-valuemin="0"/);
  assert.match(lap[0], /aria-valuemax="100"/);
  const pads = [...HTML.matchAll(/<button[^>]*data-surface-hold="([^"]+)"[^>]*>/g)];
  assert.equal(pads.length, 4, 'four movement pads');
  for (const [tag] of pads) assert.match(tag, /aria-label="[^"]+"/, 'each pad has an accessible name');
  const exit = /<button id="btn-surface-exit"[^>]*>/.exec(HTML);
  assert.ok(exit, 'exit control exists');
  assert.equal(exit[0].includes('disabled'), false, 'exit stays enabled during landing/leaving');
});

test('hud parity: pinned orbital panels stay visible on the surface', () => {
  for (const id of ['mission-panel', 'players-panel', 'arcade-panel', 'hud-score', 'hud-world', 'hud-clicks', 'hud-breaks', 'nav-chip', 'planet-badge', 'hud-target', 'hud-hint']) {
    assert.ok(HTML.includes(`id="${id}"`), `${id} exists`);
  }
  // No surface rule hides the orbital HUD or the target panel.
  assert.equal(/body\.is-surface[^{]*\{[^}]*visibility:\s*hidden/.test(CSS), false);
  assert.equal(/#target-panel\s*\{\s*visibility:\s*hidden/.test(CSS), false);
  assert.equal(/#hud-hint[^{]*\{[^}]*display:\s*none/.test(CSS), false, 'the hint bar is never hidden by surface mode');
});
