import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ESCAPE_MISSION,
  MISSION_POOLS,
  sanitizeOreCounts,
  missionProgress,
  missionOreList,
  missionForPlanet,
  missionUnitTotal,
  planetDepth,
  planetName,
} from '../public/js/shared/mission.js';
import { resourceById } from '../public/js/shared/resources.js';

const CATEGORY_OBJECTIVES = {
  fuel: 'FUEL RODS',
  hull: 'HULL PLATES',
  warp: 'WARP CORE',
};

function missionItems(mission) {
  return mission.objectives.flatMap((objective) => objective.items);
}
function totalNeed(mission) {
  return missionItems(mission).reduce((sum, item) => sum + item.need, 0);
}
function oreCountsForMission(mission) {
  const counts = {};
  for (const item of missionItems(mission)) counts[item.resourceId] = (counts[item.resourceId] || 0) + item.need;
  return counts;
}

test('mission: planet 0 is exactly 3 units, one material per objective, no fixed ids', () => {
  for (const seed of [0, 1, 42, 424242, 0xffffffff]) {
    const mission = missionForPlanet(0, seed);
    assert.equal(mission.planetIndex, 0);
    assert.equal(mission.objectives.length, 3);
    assert.deepEqual(mission.objectives.map((o) => o.id), ['fuel', 'hull', 'warp']);
    assert.deepEqual(mission.objectives.map((o) => o.name), ['FUEL RODS', 'HULL PLATES', 'WARP CORE']);
    for (const objective of mission.objectives) {
      assert.equal(objective.items.length, 1, 'planet 0 starts minimal (one resource per objective)');
      assert.equal(objective.items[0].need, 1);
      assert.ok(resourceById(objective.items[0].resourceId), 'known resource');
      assert.ok(objective.hint && typeof objective.hint === 'string');
    }
    assert.equal(totalNeed(mission), 3);
    assert.equal(missionUnitTotal(0, seed), 3);
    assert.equal(missionUnitTotal(0, 0), 3);
  }
});

test('mission: deterministic for the same seed/index, varied across seeds', () => {
  for (const index of [0, 1, 3, 7]) {
    assert.deepEqual(missionForPlanet(index, 12345), missionForPlanet(index, 12345));
    assert.deepEqual(missionForPlanet(index, 12345), missionForPlanet(index, 12345 >>> 0));
  }
  assert.deepEqual(missionForPlanet(2, 0), missionForPlanet(2)); // default seed 0
  // Planet 0 materials vary with the planet seed (no hardcoded requirements).
  const planet0Sets = new Set();
  for (let seed = 0; seed < 40; seed += 1) {
    planet0Sets.add(
      missionItems(missionForPlanet(0, seed))
        .map((item) => item.resourceId)
        .join(','),
    );
  }
  assert.ok(planet0Sets.size >= 2, 'planet 0 materials depend on the planet seed');
  // Deep planets differ between seeds too.
  const deepA = JSON.stringify(missionForPlanet(4, 7));
  const deepB = JSON.stringify(missionForPlanet(4, 8));
  assert.notEqual(deepA, deepB);
});

test('mission: cumulative growth is a random 0..3 units per deeper planet', () => {
  for (const seed of [0, 1, 42, 424242, 0xabcdef]) {
    let previous = missionUnitTotal(0, seed);
    assert.equal(previous, 3);
    let previousUnits = 3;
    for (let index = 1; index <= 12; index += 1) {
      const total = missionUnitTotal(index, seed);
      const delta = total - previousUnits;
      assert.ok(Number.isInteger(delta) && delta >= 0 && delta <= 3, `delta ${delta} on planet ${index}`);
      previous = total;
      previousUnits = total;
      const mission = missionForPlanet(index, seed);
      assert.equal(totalNeed(mission), total, 'mission units match the cumulative total');
      assert.ok(total >= missionUnitTotal(index - 1, seed), 'totals never shrink');
    }
  }
});

test('mission: materials come from the objective category pools, no duplicates, positive needs', () => {
  for (const seed of [0, 3, 77, 424242]) {
    for (let index = 0; index < 20; index += 1) {
      const mission = missionForPlanet(index, seed);
      const seen = new Set();
      for (const objective of mission.objectives) {
        assert.ok(objective.items.length >= 1);
        for (const item of objective.items) {
          assert.ok(MISSION_POOLS[objective.id].includes(item.resourceId), `${item.resourceId} in ${objective.id} pool`);
          assert.ok(Number.isInteger(item.need) && item.need > 0);
          assert.equal(seen.has(item.resourceId), false, `duplicate resource ${item.resourceId} in mission ${index}`);
          seen.add(item.resourceId);
          assert.ok(resourceById(item.resourceId));
        }
      }
      assert.ok(mission.name && mission.tagline && mission.briefing);
      assert.ok(mission.objectives.every((objective) => CATEGORY_OBJECTIVES[objective.id] === objective.name));
    }
  }
});

test('mission: progress derives from the generated mission and reaches ready exactly', () => {
  const mission = missionForPlanet(3, 424242);
  const empty = missionProgress({}, mission);
  assert.equal(empty.ready, false);
  assert.equal(empty.have, 0);
  assert.equal(empty.need, totalNeed(mission));
  const counts = oreCountsForMission(mission);
  const done = missionProgress(counts, mission);
  assert.equal(done.ready, true);
  assert.equal(done.have, done.need);
  assert.equal(done.ratio, 1);
  // Carry-style partial inventory: drop one unit of the first required ore.
  const first = missionItems(mission)[0];
  const partial = { ...counts };
  partial[first.resourceId] = Math.max(0, partial[first.resourceId] - 1);
  assert.equal(missionProgress(partial, mission).ready, false);
  const flat = missionOreList(mission);
  assert.equal(flat.reduce((sum, item) => sum + item.need, 0), totalNeed(mission));
  for (const item of flat) assert.equal(item.need, counts[item.resourceId]);
});

test('mission: ESCAPE_MISSION compatibility export is the generated planet-0/seed-0 mission', () => {
  assert.deepEqual(ESCAPE_MISSION, missionForPlanet(0, 0));
  assert.ok(Object.isFrozen(ESCAPE_MISSION));
  assert.ok(Object.isFrozen(ESCAPE_MISSION.objectives));
  assert.ok(Object.isFrozen(ESCAPE_MISSION.objectives[0].items));
  assert.deepEqual(ESCAPE_MISSION.objectives.map((o) => o.name), ['FUEL RODS', 'HULL PLATES', 'WARP CORE']);
});

test('mission: sanitize keeps only known ids and positive integer counts', () => {
  const clean = sanitizeOreCounts({ gold: 2.9, silver: -1, magic: 5, uranium: '3', palladium: 0 });
  assert.deepEqual(clean, { gold: 2, uranium: 3 });
  assert.deepEqual(sanitizeOreCounts(null), {});
  assert.deepEqual(sanitizeOreCounts('nope'), {});
});

test('planets: first planet is depth 2, second is depth 3, infinite progression is capped safely', () => {
  assert.equal(planetDepth(0), 2);
  assert.equal(planetDepth(1), 3);
  assert.equal(planetDepth(2), 4);
  assert.equal(planetDepth(50), 8);
  assert.equal(planetName(0), 'ICOSA-9');
  assert.equal(planetName(1), 'ICOSA-10');
});
