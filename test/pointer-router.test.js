import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createPointerRouter,
  watchPointerEnvironment,
  pointerRecord,
  PINCH_DEAD_ZONE,
  TAP_SLOP_PX,
} from '../public/js/shared/pointer-router.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Minimal element stand-in: attributes + parent link, no DOM. */
function el(attrs = {}, parent = null) {
  return {
    attrs: { ...attrs },
    parentNode: parent,
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
    },
  };
}

function harness(options = {}) {
  const intents = [];
  const captures = [];
  const releases = [];
  const router = createPointerRouter({
    capture: (element, pointerId) => {
      captures.push(pointerId);
      if (options.captureThrows) throw new Error('denied');
      return options.captureFails ? false : true;
    },
    release: (element, pointerId) => {
      releases.push(pointerId);
    },
    onIntent: (intent) => intents.push(intent),
    now: () => options.now ? options.now() : 0,
  });
  const canvas = el({ 'data-pointer-role': 'orbit-drag' });
  return { router, intents, captures, releases, canvas, pad: (hold) => el({ 'data-pointer-role': 'steer', 'data-surface-hold': hold }) };
}

const record = (pointerId, x, y, target, t = 0) => ({ pointerId, clientX: x, clientY: y, target, t });

test('CTL-06: role precedence prefers a pad over the canvas', () => {
  const h = harness();
  assert.equal(h.router.roleOf(1), null);
  const pad = h.pad('KeyW');
  assert.equal(h.router.down(record(1, 10, 10, pad)), 'steer');
  assert.equal(h.router.roleOf(1), 'steer');
  // A pointer on the canvas is a drag.
  const canvas = el({ 'data-pointer-role': 'orbit-drag' });
  assert.equal(h.router.down(record(2, 10, 10, canvas)), 'orbit-drag');
  // A third target that is neither pad nor canvas is chrome: ignored.
  assert.equal(h.router.down(record(3, 10, 10, el({}))), 'ui');
  assert.equal(h.router.roleOf(3), null);
});

test('CTL-06: pads capture the pointer and keep steering when the finger slides off', () => {
  const h = harness();
  const pad = h.pad('KeyW');
  h.router.down(record(1, 10, 10, pad));
  assert.deepEqual(h.captures, [1], 'capture is requested on down');
  const steerStart = h.intents.find((intent) => intent.kind === 'steer' && intent.phase === 'start');
  assert.equal(steerStart.hold, 'KeyW');
  h.router.move(record(1, 400, 600, el({})));
  const moving = h.intents.filter((intent) => intent.kind === 'steer' && intent.phase === 'move');
  assert.equal(moving.length, 1, 'a captured pointer still reports steering outside the pad');
  // A captured pointer leaving its element does not end the gesture.
  assert.equal(h.router.leave(record(1, 10, 10, pad)), false);
  assert.equal(h.router.activeCount(), 1);
  h.router.end(record(1, 10, 10, pad));
  assert.equal(h.router.activeCount(), 0);
  assert.deepEqual(h.releases, [1], 'capture is released exactly once');
});

test('CTL-06: capture failure degrades to pointerleave cleanup', () => {
  const h = harness({ captureThrows: true });
  const pad = h.pad('KeyA');
  h.router.down(record(1, 10, 10, pad));
  assert.equal(h.router.activeCount(), 1);
  assert.equal(h.router.leave(record(1, 300, 300, el({}))), true, 'leave ends an uncaptured steer');
  assert.equal(h.router.activeCount(), 0);
  const releases = h.intents.filter((intent) => intent.kind === 'steer' && intent.phase === 'end');
  assert.equal(releases.length, 1);
});

test('CTL-06: pointercancel clears the role and emits the end intent', () => {
  const h = harness();
  const pad = h.pad('KeyD');
  h.router.down(record(1, 10, 10, pad));
  h.intents.length = 0;
  h.router.cancel(record(1, 10, 10, pad));
  assert.equal(h.router.activeCount(), 0);
  assert.deepEqual(h.releases, [1]);
  const ended = h.intents.find((intent) => intent.kind === 'steer');
  assert.equal(ended.phase, 'end');
  assert.equal(ended.cancelled, true);
});

test('CTL-06: a second canvas pointer demotes the first to pinch and reports scale', () => {
  const h = harness();
  const canvas = el({ 'data-pointer-role': 'orbit-drag' });
  h.router.down(record(1, 100, 100, canvas));
  assert.equal(h.router.roleOf(1), 'orbit-drag');
  h.router.down(record(2, 300, 100, canvas));
  assert.equal(h.router.roleOf(1), 'pinch');
  assert.equal(h.router.roleOf(2), 'pinch');
  const start = h.intents.find((intent) => intent.kind === 'pinch' && intent.phase === 'start');
  assert.ok(start);
  // Spreading the pointers zooms in: scale = newDistance / previousDistance.
  h.router.move(record(2, 400, 100, canvas));
  const move = h.intents.find((intent) => intent.kind === 'pinch' && intent.phase === 'move');
  assert.ok(move, 'a pinch move intent is emitted');
  assert.ok(move.scale > 1.4 && move.scale < 1.6, `scale ${move.scale}`);
  // Sub-dead-zone jitter is ignored.
  h.intents.length = 0;
  h.router.move(record(2, 402, 100, canvas));
  assert.equal(h.intents.filter((intent) => intent.kind === 'pinch').length, 0, `dead zone ${PINCH_DEAD_ZONE}`);
});

test('CTL-06: lifting one pinch finger returns the gesture to a drag', () => {
  const h = harness();
  const canvas = el({ 'data-pointer-role': 'orbit-drag' });
  h.router.down(record(1, 100, 100, canvas));
  h.router.down(record(2, 300, 100, canvas));
  h.intents.length = 0;
  h.router.end(record(2, 300, 100, canvas));
  assert.equal(h.router.roleOf(1), 'orbit-drag', 'the remaining finger keeps steering the camera');
  assert.equal(h.router.activeCount(), 1);
});

test('CTL-06: a third finger during pinch is ignored until the count returns to two', () => {
  const h = harness();
  const canvas = el({ 'data-pointer-role': 'orbit-drag' });
  h.router.down(record(1, 100, 100, canvas));
  h.router.down(record(2, 300, 100, canvas));
  assert.equal(h.router.down(record(3, 200, 300, canvas)), 'ignored');
  assert.equal(h.router.activeCount(), 3);
  assert.equal(h.router.roleOf(3), 'ignored');
  h.router.end(record(3, 200, 300, canvas));
  assert.equal(h.router.activeCount(), 2);
  assert.equal(h.router.roleOf(1), 'pinch', 'the pinch gesture survives');
});

test('CTL-06: a tap is travel within the slop budget only', () => {
  const h = harness();
  const canvas = el({ 'data-pointer-role': 'orbit-drag' });
  h.router.down(record(1, 100, 100, canvas));
  h.router.end(record(1, 104, 103, canvas));
  const tap = h.intents.find((intent) => intent.kind === 'tap');
  assert.ok(tap, 'a small, short press is a tap');
  assert.equal(TAP_SLOP_PX, 7);

  h.intents.length = 0;
  h.router.down(record(2, 100, 100, canvas));
  h.router.move(record(2, 140, 100, canvas));
  h.router.end(record(2, 140, 100, canvas));
  assert.equal(h.intents.filter((intent) => intent.kind === 'tap').length, 0, 'a drag is not a tap');
});

test('CTL-06: cancel-all clears every role on blur, visibility and orientation', () => {
  const h = harness();
  const pad = h.pad('KeyW');
  const canvas = el({ 'data-pointer-role': 'orbit-drag' });
  h.router.down(record(1, 10, 10, pad));
  h.router.down(record(2, 100, 100, canvas));
  const handlers = { win: {}, doc: {} };
  const win = {
    addEventListener: (type, fn) => { handlers.win[type] = fn; },
    removeEventListener: (type) => { delete handlers.win[type]; },
  };
  const doc = {
    visibilityState: 'visible',
    addEventListener: (type, fn) => { handlers.doc[type] = fn; },
    removeEventListener: (type) => { delete handlers.doc[type]; },
  };
  const detach = watchPointerEnvironment(h.router, { win, doc });
  handlers.win.blur();
  assert.equal(h.router.activeCount(), 0, 'blur clears input');
  assert.ok(h.intents.some((intent) => intent.kind === 'cancel-all' && intent.reason === 'blur'));

  h.router.down(record(3, 10, 10, pad));
  handlers.win.orientationchange();
  assert.equal(h.router.activeCount(), 0, 'orientation change clears input');

  h.router.down(record(4, 10, 10, pad));
  doc.visibilityState = 'hidden';
  handlers.doc.visibilitychange();
  assert.equal(h.router.activeCount(), 0, 'backgrounding the tab clears input');
  doc.visibilityState = 'visible';
  h.router.down(record(5, 10, 10, pad));
  handlers.doc.visibilitychange();
  assert.equal(h.router.activeCount(), 1, 'becoming visible does not cancel');
  detach();
  assert.equal(handlers.win.blur, undefined);
});

test('CTL-06: only the pointer router calls setPointerCapture', () => {
  const allowed = new Set(['public/js/shared/pointer-router.js']);
  const offenders = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
        walk(full);
      } else if (name.endsWith('.js') || name.endsWith('.mjs')) {
        const rel = path.relative(ROOT, full).split(path.sep).join('/');
        if (allowed.has(rel)) continue;
        const source = fs.readFileSync(full, 'utf8');
        if (/\.setPointerCapture\s*\(/.test(source)) offenders.push(rel);
      }
    }
  };
  walk(path.join(ROOT, 'public/js'));
  assert.deepEqual(offenders, [], 'capture is centralised in the router');
});

test('CTL-06: pointerRecord extracts a plain record from a DOM-like event', () => {
  const rec = pointerRecord({ pointerId: 7, clientX: 12, clientY: 34, target: null }, () => 99);
  assert.deepEqual(rec, { pointerId: 7, clientX: 12, clientY: 34, target: null, t: 99 });
  assert.equal(pointerRecord(null), null);
});
