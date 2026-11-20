import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MOVE_KEYS,
  exitControl,
  isControlFocused,
  lapPercent,
  mapSurfaceSlice,
  modeChip,
  shouldCaptureSteering,
  targetStateBadge,
  targetStateText,
} from '../public/js/shared/surface-hud.js';

test('surface hud: slice mapping clamps and normalises every field', () => {
  const slice = mapSurfaceSlice({
    active: true,
    phase: 'running',
    lapFraction: 0.426,
    lapSeconds: 12.5,
    autoLabel: 'STORM',
    targetLabel: '8.3',
    targetHarvestable: true,
    missionDone: 2,
    missionTotal: 3,
    missionReady: false,
    keyboardMode: 'controls',
  });
  assert.equal(slice.active, true);
  assert.equal(slice.phase, 'running');
  assert.equal(slice.lap.run, 43);
  assert.equal(slice.lap.seconds, 12.5);
  assert.equal(slice.lap.auto, 'STORM');
  assert.deepEqual(slice.target, { label: '8.3', state: 'can' });
  assert.deepEqual(slice.mission, { done: 2, total: 3, ready: false });
  assert.deepEqual(slice.keyboard, { steering: false, mode: 'controls' });
});

test('surface hud: target state distinguishes can, locked, depleted and idle', () => {
  assert.equal(mapSurfaceSlice({ targetLabel: '8.3', targetHarvestable: true }).target.state, 'can');
  assert.equal(mapSurfaceSlice({ targetLabel: '8.3', targetHarvestable: false }).target.state, 'locked');
  assert.equal(mapSurfaceSlice({ targetLabel: '8.3', depleted: true }).target.state, 'depleted');
  assert.equal(mapSurfaceSlice({ targetLabel: null }).target.state, 'idle');
  assert.equal(mapSurfaceSlice({ phase: 'bogus' }).phase, 'idle');
});

test('surface hud: every target state has a text equivalent', () => {
  assert.equal(targetStateText('can', '8.3'), 'TARGET 8.3 // GREEN // HARVEST');
  assert.equal(targetStateText('locked', '8.3'), 'TARGET 8.3 // RED // LOCKED');
  assert.equal(targetStateText('depleted', '8.3'), 'TARGET 8.3 // RED // DEPLETED');
  assert.equal(targetStateText('idle', null), 'TARGET: —');
  assert.equal(targetStateBadge('can').status, 'success');
  assert.equal(targetStateBadge('locked').status, 'warning');
  assert.equal(targetStateBadge('depleted').status, 'danger');
  assert.equal(targetStateBadge('idle').status, 'neutral');
});

test('surface hud: lap percentage is clamped and integral', () => {
  assert.equal(lapPercent(-1), 0);
  assert.equal(lapPercent(0.426), 43);
  assert.equal(lapPercent(1), 100);
  assert.equal(lapPercent(2), 100);
  assert.equal(lapPercent('nope'), 0);
});

test('surface hud: keyboard capture is scoped to the canvas owner', () => {
  const canvasTarget = { closest: () => null };
  const buttonTarget = { closest: (selector) => (selector.includes('button') ? {} : null) };
  assert.equal(shouldCaptureSteering({ code: 'KeyW', target: canvasTarget, mode: 'canvas' }), true);
  assert.equal(shouldCaptureSteering({ code: 'KeyW', target: buttonTarget, mode: 'canvas' }), false);
  assert.equal(shouldCaptureSteering({ code: 'KeyW', target: canvasTarget, mode: 'controls' }), false);
  assert.equal(shouldCaptureSteering({ code: 'Enter', target: canvasTarget, mode: 'canvas' }), false);
  assert.equal(shouldCaptureSteering({ key: 'Escape', target: canvasTarget, mode: 'canvas' }), true);
  assert.equal(isControlFocused(buttonTarget), true);
  assert.equal(isControlFocused({ isContentEditable: true }), true);
  assert.equal(isControlFocused(canvasTarget), false);
});

test('surface hud: intent keys and exit copy are stable', () => {
  assert.deepEqual(MOVE_KEYS, { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD' });
  assert.deepEqual(exitControl('leaving'), { disabled: true, label: 'RETURNING TO ORBIT' });
  assert.deepEqual(exitControl('running'), { disabled: false, label: 'RETURN TO ORBIT' });
  assert.deepEqual(modeChip(mapSurfaceSlice({ active: true, keyboardMode: 'canvas' })), {
    surface: 'SURFACE',
    keyboard: 'STEERING',
  });
  assert.deepEqual(modeChip(mapSurfaceSlice({ active: false })), { surface: 'ORBIT', keyboard: 'STEERING' });
});
