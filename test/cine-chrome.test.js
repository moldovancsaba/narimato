import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CAPTION_GAP_MS,
  clampProgress,
  durationScale,
  introCopy,
  mapCineSlice,
  nextProgress,
  shouldCaptureCineKey,
  speakerLabel,
  writeCaption,
} from '../public/js/shared/cine-chrome.js';

function fakeDocument() {
  return {
    createElement(tag) {
      return { tag, className: '', textContent: '', children: [] };
    },
  };
}

function fakeRegion() {
  return {
    textContent: 'stale',
    children: [],
    appendChild(node) {
      this.children.push(node);
      return node;
    },
  };
}

test('cine chrome: intro copy interpolates the planet name', () => {
  assert.equal(introCopy('wormhole', 'MAGRATHEA').main, 'WORMHOLE EXIT');
  assert.equal(introCopy('drift', 'MAGRATHEA').label, 'GRAVITY WELL // MAGRATHEA');
  assert.match(introCopy('descent', 'MAGRATHEA').sub, /FALLING INTO MAGRATHEA/);
  assert.equal(introCopy('bogus', 'X').main, 'WORMHOLE EXIT');
});

test('cine chrome: progress is clamped and never moves backwards', () => {
  assert.equal(clampProgress(-10), 0);
  assert.equal(clampProgress(101), 100);
  assert.equal(clampProgress('nope'), 0);
  assert.equal(clampProgress(41.6), 42);
  assert.equal(nextProgress(30, 1000, 5000, 1), 20 < 30 ? 30 : 20);
  assert.equal(nextProgress(10, 500, 1000, 0.35), 100);
  assert.equal(nextProgress(50, 100, 1000, 0.35), 50);
});

test('cine chrome: reduced motion scales the duration to 0.35', () => {
  assert.equal(durationScale(true), 0.35);
  assert.equal(durationScale(false), 1);
  assert.equal(CAPTION_GAP_MS, 340);
});

test('cine chrome: slice mapping fills every surface field', () => {
  const slice = mapCineSlice('intro', {
    phase: 'drift',
    progress: 62.4,
    copy: { kicker: 'GRAVITY WELL', title: 'GRAVITY LOCK', sub: 'THRUSTERS OFFLINE', alarm: 'LOCK' },
    captions: { speaker: 'ship ai', text: 'Hold on.', visible: true },
    motion: 'reduced',
    skipVisible: true,
    continueVisible: false,
    voice: true,
    subtitles: true,
  });
  assert.equal(slice.kind, 'intro');
  assert.equal(slice.phase, 'drift');
  assert.equal(slice.progress, 62);
  assert.equal(slice.copy.title, 'GRAVITY LOCK');
  assert.equal(slice.captions.speaker, 'ship ai');
  assert.equal(slice.captions.visible, true);
  assert.equal(slice.motion, 'reduced');
  assert.equal(slice.skipVisible, true);
  assert.equal(mapCineSlice('interlude', { phase: 'event' }).kind, 'interlude');
  assert.equal(mapCineSlice('bogus', { phase: 'bogus' }).kind, 'intro');
  assert.equal(mapCineSlice('intro', { phase: 'bogus' }).phase, 'idle');
});

test('cine chrome: caption write resets the region before appending text nodes', () => {
  const region = fakeRegion();
  const doc = fakeDocument();
  assert.equal(writeCaption(region, 'narrator', 'First sentence.', doc), true);
  assert.equal(region.textContent, '');
  assert.equal(region.children.length, 2);
  assert.equal(region.children[0].textContent, 'NARRATOR');
  assert.equal(region.children[1].textContent, 'First sentence.');
  // A repeated sentence is written again, not skipped.
  writeCaption(region, 'narrator', 'First sentence.', doc);
  assert.equal(region.children.length, 4);
  assert.equal(writeCaption(null, 'x', 'y', doc), false);
});

test('cine chrome: focused chrome controls keep their native keys', () => {
  const canvasTarget = { closest: () => null };
  const buttonTarget = { closest: (selector) => (selector.includes('button') ? {} : null) };
  assert.equal(shouldCaptureCineKey({ key: 'Escape', target: canvasTarget, active: true }), true);
  assert.equal(shouldCaptureCineKey({ key: 'w', target: canvasTarget, active: true }), true);
  assert.equal(shouldCaptureCineKey({ key: 'w', target: buttonTarget, active: true }), false);
  assert.equal(shouldCaptureCineKey({ key: 'w', target: canvasTarget, active: false }), false);
  assert.equal(shouldCaptureCineKey({ key: 'Enter', target: canvasTarget, active: true }), false);
});

test('cine chrome: the voice hint is part of the speaker label', () => {
  assert.equal(speakerLabel('ship ai', true, false), 'SHIP AI · TAP FOR VOICE');
  assert.equal(speakerLabel('ship ai', true, true), 'SHIP AI');
  assert.equal(speakerLabel('ship ai', false, false), 'SHIP AI');
  assert.equal(speakerLabel(null, false, true), 'NARIMATO');
});
