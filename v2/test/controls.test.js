import test from 'node:test';
import assert from 'node:assert/strict';
import { dot, initialHeading, moveHeading, turnHeading } from '../public/controls.js';

const nearNorth = (() => { const a = 0.12; return { x: Math.sin(a), y: Math.cos(a), z: 0 }; })();

test('v2 controls: heading is tangent and stable at the pole', () => {
  const h = initialHeading(nearNorth);
  assert.ok(Math.abs(dot(h, nearNorth)) < 1e-9);
});

test('v2 controls: forward movement crosses the north pole without stopping', () => {
  let landing = nearNorth;
  let heading = initialHeading(landing);
  let crossed = false;
  for (let i = 0; i < 40; i += 1) {
    const next = moveHeading(landing, heading, 0.08);
    landing = next.landing;
    heading = next.heading;
    assert.ok(Number.isFinite(landing.x + landing.y + landing.z));
    assert.ok(Math.abs(dot(heading, landing)) < 1e-6);
    if (landing.y < 0) crossed = true;
  }
  assert.equal(crossed, true);
});

test('v2 controls: turn left/right keeps a valid tangent heading', () => {
  let landing = nearNorth;
  let heading = initialHeading(landing);
  for (let i = 0; i < 20; i += 1) {
    heading = turnHeading(landing, heading, 0.1);
    assert.ok(Math.abs(dot(heading, landing)) < 1e-6);
  }
  assert.ok(Math.hypot(heading.x, heading.y, heading.z) > 0.999);
});
