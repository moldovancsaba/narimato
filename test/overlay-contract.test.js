import test from 'node:test';
import assert from 'node:assert/strict';

import { createOverlayPort } from '../public/js/shared/overlay-port.js';

function fakeElement(name) {
  return {
    name,
    inert: false,
    focusCalls: 0,
    focus() {
      this.focusCalls += 1;
      return true;
    },
    querySelector() {
      return null;
    },
  };
}

function makePort() {
  const events = [];
  const port = createOverlayPort({
    document: { activeElement: null },
    onInert: (element, value) => events.push([element.name, value]),
  });
  return { port, events };
}

test('overlay port: opening records the invoker and focuses the initial control', () => {
  const { port } = makePort();
  const invoker = fakeElement('invoker');
  const initial = fakeElement('initial');
  const element = fakeElement('landing');
  port.open({ name: 'landing', element, invoker, initialFocus: initial });
  assert.equal(port.depth(), 1);
  assert.equal(port.top().name, 'landing');
  assert.equal(port.top().invoker, invoker);
  assert.equal(initial.focusCalls, 1);
});

test('overlay port: escape resolves only the top of the stack', () => {
  const { port } = makePort();
  const landing = fakeElement('landing');
  const report = fakeElement('report');
  port.open({ name: 'landing', element: landing });
  port.open({ name: 'report', element: report });
  assert.deepEqual(port.names(), ['landing', 'report']);
  assert.equal(landing.inert, true, 'the background overlay is inert');
  const closed = port.escape();
  assert.equal(closed.name, 'report');
  assert.deepEqual(port.names(), ['landing']);
  assert.equal(report.inert, false);
  assert.equal(landing.inert, false, 'the lower overlay becomes interactive again');
  assert.equal(port.escape().name, 'landing');
  assert.equal(port.depth(), 0);
});

test('overlay port: close restores focus to the invoker', () => {
  const { port } = makePort();
  const invoker = fakeElement('button');
  const element = fakeElement('confirm');
  port.open({ name: 'confirm', element, invoker });
  port.close('confirm');
  assert.equal(invoker.focusCalls, 1);
});

test('overlay port: duplicate opens are ignored and close(wrongName) is a no-op', () => {
  const { port } = makePort();
  const element = fakeElement('guide');
  const first = port.open({ name: 'guide', element });
  const second = port.open({ name: 'guide', element });
  assert.equal(first, second);
  assert.equal(port.depth(), 1);
  assert.equal(port.close('landing'), null);
  assert.equal(port.depth(), 1);
});

test('overlay port: a second confirm cannot stack a duplicate surface', () => {
  const { port } = makePort();
  port.open({ name: 'confirm', element: fakeElement('c1') });
  const duplicate = port.open({ name: 'confirm', element: fakeElement('c2') });
  assert.deepEqual(port.names(), ['confirm']);
  assert.equal(duplicate.element.name, 'c1', 'the first surface wins while it is open');
  assert.equal(port.escape().element.name, 'c1');
});

test('overlay port: unknown overlay names are rejected', () => {
  const { port } = makePort();
  assert.throws(() => port.open({ name: 'toast' }), /unknown overlay/);
});
