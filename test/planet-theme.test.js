import test from 'node:test';
import assert from 'node:assert/strict';

import { planetPalette, planetTheme } from '../public/js/shared/planet-theme.js';

test('planet themes: deterministic per index/seed and visually distinct across neighbours', () => {
  const a = planetTheme(0, 424242);
  const b = planetTheme(0, 424242);
  assert.deepEqual(a, b);
  assert.match(a.accent, /^#[0-9a-f]{6}$/i);
  assert.match(a.secondary, /^#[0-9a-f]{6}$/i);
  assert.match(a.land, /^#[0-9a-f]{6}$/i);
  const ids = new Set();
  for (let i = 0; i < 8; i += 1) ids.add(planetTheme(i, 424242).id);
  assert.ok(ids.size >= 5, `expected several planet palettes, got ${[...ids].join(',')}`);
  assert.equal(planetPalette(0, 1).id, planetTheme(0, 1).id);
});
