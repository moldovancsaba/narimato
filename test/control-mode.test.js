import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CONTROL_MODES,
  deriveControlMode,
  modeLabel,
  dragLabel,
  canToggle,
  actionLabel,
  actionReason,
  modeSentence,
} from '../public/js/shared/control-mode.js';

test('CTL-05: derivation is total over the five documented modes', () => {
  assert.deepEqual(CONTROL_MODES, ['offline', 'orbit', 'descending', 'surface', 'leaving']);
  assert.equal(deriveControlMode({ joined: false, surfaceActive: false, surfacePhase: 'idle' }), 'offline');
  assert.equal(deriveControlMode({ joined: true, surfaceActive: false, surfacePhase: 'idle' }), 'orbit');
  assert.equal(deriveControlMode({ joined: true, surfaceActive: true, surfacePhase: 'landing' }), 'descending');
  assert.equal(deriveControlMode({ joined: true, surfaceActive: true, surfacePhase: 'walking' }), 'surface');
  assert.equal(deriveControlMode({ joined: true, surfaceActive: true, surfacePhase: 'leaving' }), 'leaving');
});

test('CTL-05: every input combination maps to exactly one declared mode', () => {
  const joined = [true, false];
  const active = [true, false];
  const phases = [undefined, null, 'idle', 'landing', 'walking', 'leaving', 'nonsense'];
  for (const j of joined) {
    for (const a of active) {
      for (const phase of phases) {
        const mode = deriveControlMode({ joined: j, surfaceActive: a, surfacePhase: phase });
        assert.ok(CONTROL_MODES.includes(mode), `${j}/${a}/${phase} -> ${mode}`);
      }
    }
  }
  assert.equal(deriveControlMode(null), 'offline', 'missing input is offline, never a crash');
  assert.equal(deriveControlMode({}), 'offline');
});

test('CTL-05: labels, drag direction and the action stay in one vocabulary', () => {
  assert.equal(modeLabel('orbit'), 'ORBIT');
  assert.equal(modeLabel('descending'), 'DESCENT');
  assert.equal(modeLabel('surface'), 'SURFACE');
  assert.equal(modeLabel('offline'), 'OFFLINE');
  assert.equal(modeLabel('leaving'), 'LEAVING');
  assert.equal(modeLabel('unexpected'), 'OFFLINE');
  assert.equal(dragLabel(false), 'DRAG: FOLLOW CURSOR');
  assert.equal(dragLabel(true), 'DRAG: REVERSE');
  assert.equal(actionLabel('orbit'), 'ENTER SURFACE');
  assert.equal(actionLabel('surface'), 'RETURN TO ORBIT');
});

test('CTL-05: the toggle is gated to the two stable states only', () => {
  assert.equal(canToggle('orbit'), true);
  assert.equal(canToggle('surface'), true);
  for (const mode of ['offline', 'descending', 'leaving']) assert.equal(canToggle(mode), false, mode);
  assert.equal(actionReason('orbit'), '');
  assert.match(actionReason('offline'), /Join/);
  assert.match(actionReason('descending'), /Descending/);
  assert.match(actionReason('leaving'), /Leaving/);
});

test('CTL-05: one polite sentence per mode change names the drag direction', () => {
  assert.match(modeSentence('orbit', false), /Orbit controls live/);
  assert.match(modeSentence('orbit', true), /reverse/);
  assert.match(modeSentence('surface', false), /Surface controls live/);
  assert.match(modeSentence('descending', false), /Descending/);
  assert.match(modeSentence('leaving', false), /Leaving/);
  assert.match(modeSentence('offline', false), /offline/i);
});
