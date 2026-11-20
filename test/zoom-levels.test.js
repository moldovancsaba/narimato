import test from 'node:test';
import assert from 'node:assert/strict';

import { SphereCamera } from '../public/js/shared/geometry.js';
import {
  ORBIT_FAR_ZOOM,
  SURFACE_ENTER_LEVEL,
  MAX_ZOOM,
  zoomForLevel,
  zoomLevelForZoom,
  applyOrbitFarZoom,
  isFarOrbitZoom,
} from '../public/js/shared/zoom-levels.js';

test('CTL-04: the far zoom constant keeps its value and is exported', () => {
  assert.equal(ORBIT_FAR_ZOOM, 0.4);
  assert.equal(SURFACE_ENTER_LEVEL, 3);
  assert.equal(MAX_ZOOM, 16777216);
});

test('CTL-04: the far-orbit exit state sits beyond the ladder floor', () => {
  // Documented integration deviation: level 0 is the whole-sphere view (1),
  // and ORBIT_FAR_ZOOM (0.4) is one rung farther out, applied on every exit.
  assert.equal(zoomForLevel(0), 1);
  assert.ok(ORBIT_FAR_ZOOM < zoomForLevel(0), 'the far-orbit constant is the farthest zoom');
  assert.equal(isFarOrbitZoom(ORBIT_FAR_ZOOM), true);
  assert.equal(isFarOrbitZoom(1), false);
  assert.equal(zoomForLevel(1), 2);
  assert.equal(zoomForLevel(SURFACE_ENTER_LEVEL), 8);
  assert.equal(zoomForLevel(-5), 1, 'negative levels clamp to level 0');
  assert.equal(zoomForLevel(99, 12), 4096, 'the ladder tops out at level 12');
  assert.ok(MAX_ZOOM > zoomForLevel(12), 'the optical zoom ceiling is above the ladder');
  assert.equal(zoomForLevel(3, 4), 8, 'the dynamic max level is respected');
});

test('CTL-04: zoom levels round-trip through the ladder', () => {
  for (const level of [0, 1, 2, 3, 4, 6, 8]) {
    assert.equal(zoomLevelForZoom(zoomForLevel(level)), level);
  }
  assert.equal(zoomLevelForZoom(ORBIT_FAR_ZOOM), 0);
  assert.equal(zoomLevelForZoom(0.5), 0, 'values below the floor map to level 0');
  assert.equal(zoomLevelForZoom(7.9), 3);
  assert.equal(zoomLevelForZoom('nope'), 0);
});

test('CTL-04: applyOrbitFarZoom is idempotent from any prior zoom', () => {
  const camera = new SphereCamera({ width: 1000, height: 800 });
  camera.reset();
  camera.zoom = 7.25;
  camera.yaw = 1.9;
  camera.pitch = -0.4;
  assert.equal(applyOrbitFarZoom(camera), ORBIT_FAR_ZOOM);
  assert.equal(camera.zoom, ORBIT_FAR_ZOOM);
  assert.equal(zoomLevelForZoom(camera.zoom), 0);
  // Second application changes nothing.
  assert.equal(applyOrbitFarZoom(camera), ORBIT_FAR_ZOOM);
  assert.equal(camera.zoom, ORBIT_FAR_ZOOM);
  // Defensive: a missing camera never throws and reports the policy value.
  assert.equal(applyOrbitFarZoom(null), ORBIT_FAR_ZOOM);
  assert.equal(applyOrbitFarZoom({}), ORBIT_FAR_ZOOM);
});
