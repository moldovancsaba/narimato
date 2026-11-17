import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ESCAPE_MISSION,
  sanitizeOreCounts,
  missionProgress,
  missionOreList,
  missionForPlanet,
  planetDepth,
  planetName,
} from '../public/js/shared/mission.js';
import { resourceById } from '../public/js/shared/resources.js';

test('mission: requirements are three objectives over known resources', () => {
  assert.equal(ESCAPE_MISSION.objectives.length, 3);
  assert.deepEqual(ESCAPE_MISSION.objectives.map((o) => o.name), ['FUEL RODS', 'HULL PLATES', 'WARP CORE']);
  for (const objective of ESCAPE_MISSION.objectives) {
    for (const item of objective.items) {
      assert.ok(resourceById(item.resourceId), `known resource ${item.resourceId}`);
      assert.ok(item.need > 0);
    }
  }
});

test('mission: empty inventory is 0%, not ready', () => {
  const p = missionProgress({});
  assert.equal(p.ready, false);
  assert.equal(p.have, 0);
  assert.equal(p.need, 11);
  assert.ok(p.objectives.every((o) => o.done === false));
  assert.equal(p.ratio, 0);
});

test('mission: partial progress counts each required ore and clamps overshoot', () => {
  const p = missionProgress({ uranium: 1, silver: 10, gold: 1, palladium: 0 });
  const fuel = p.objectives.find((o) => o.id === 'fuel');
  const hull = p.objectives.find((o) => o.id === 'hull');
  const warp = p.objectives.find((o) => o.id === 'warp');
  assert.equal(fuel.items[0].have, 1);
  assert.equal(fuel.done, false);
  assert.equal(hull.items.find((i) => i.resourceId === 'silver').have, 10);
  assert.equal(hull.items.find((i) => i.resourceId === 'gold').done, false);
  assert.equal(hull.done, false);
  assert.equal(warp.done, false);
  assert.equal(p.have, 1 + 5 + 1); // clamped silver at 5
  assert.ok(p.ratio > 0.6 && p.ratio < 1);
  assert.equal(p.ready, false);
});

test('mission: complete inventory is ready exactly at requirements', () => {
  const p = missionProgress({ uranium: 3, silver: 5, gold: 2, palladium: 1 });
  assert.equal(p.ready, true);
  assert.equal(p.have, p.need);
  assert.equal(p.ratio, 1);
  for (const objective of p.objectives) assert.equal(objective.done, true);
});

test('mission: sanitize keeps only known ids and positive integer counts', () => {
  const clean = sanitizeOreCounts({ gold: 2.9, silver: -1, magic: 5, uranium: '3', palladium: 0 });
  assert.deepEqual(clean, { gold: 2, uranium: 3 });
  assert.deepEqual(sanitizeOreCounts(null), {});
  assert.deepEqual(sanitizeOreCounts('nope'), {});
});

test('mission: flat ore list totals duplicate resource requirements', () => {
  const list = missionOreList();
  assert.ok(list.length >= 4);
  const silver = list.find((item) => item.resourceId === 'silver');
  assert.equal(silver.need, 5);
  const uranium = list.find((item) => item.resourceId === 'uranium');
  assert.equal(uranium.glyph, 'U');
});


test('planets: first planet is depth 2, second is depth 3, infinite progression is capped safely', () => {
  assert.equal(planetDepth(0), 2);
  assert.equal(planetDepth(1), 3);
  assert.equal(planetDepth(2), 4);
  assert.equal(planetDepth(50), 8);
  assert.equal(planetName(0), 'ICOSA-9');
  assert.equal(planetName(1), 'ICOSA-10');
});

test('planets: later missions demand more resources than planet 0', () => {
  const p0 = missionProgress({}, missionForPlanet(0));
  const p1 = missionProgress({}, missionForPlanet(1));
  const p2 = missionProgress({}, missionForPlanet(2));
  assert.ok(p1.need > p0.need, 'planet 1 is a bigger refit');
  assert.ok(p2.need > p1.need, 'planet 2 is bigger still');
  assert.equal(p1.ready, false);
  assert.equal(planetDepth(0) < planetDepth(1), true);
  const almost = missionProgress({ uranium: 5, silver: 8, gold: 3, palladium: 2 }, missionForPlanet(1));
  assert.equal(almost.ready, true, 'planet 1 refit completable with its own requirements');
});
