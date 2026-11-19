import test from 'node:test';
import assert from 'node:assert/strict';

import { canHarvestCell } from '../public/js/shared/harvest.js';

test('harvest truth: green only when the server would accept the click', () => {
  assert.equal(canHarvestCell({ ownerIndex: -1, lastClickIndex: -1, depth: 1, resourceId: null }, 0, 8), true);
  assert.equal(canHarvestCell({ ownerIndex: 1, lastClickIndex: 1, depth: 1, resourceId: null }, 0, 8), true);
  assert.equal(canHarvestCell({ ownerIndex: 0, lastClickIndex: 1, depth: 1, resourceId: null }, 0, 8), true);
  assert.equal(canHarvestCell({ ownerIndex: 0, lastClickIndex: 0, depth: 1, resourceId: null }, 0, 8), false);
  assert.equal(canHarvestCell({ ownerIndex: -1, lastClickIndex: -1, depth: 8, resourceId: 'gold' }, 0, 8), false);
  assert.equal(canHarvestCell(null, 0, 8), false);
});
