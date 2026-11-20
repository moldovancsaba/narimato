import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_PLAYER_ROWS,
  chargePercent,
  chargeText,
  connectionText,
  formatNumber,
  formatZoom,
  hudSignature,
  missionDoneRatio,
  normalizeConnection,
  normalizeTag,
  pad2,
  rankPlayers,
  targetState,
  zoomBand,
  zoomPercent,
} from '../public/js/shared/hud-contract.js';

test('hud format: grouping keeps thousands separators and signs', () => {
  assert.equal(formatNumber(0), '0');
  assert.equal(formatNumber(999), '999');
  assert.equal(formatNumber(1000), '1,000');
  assert.equal(formatNumber(1234567), '1,234,567');
  assert.equal(formatNumber(-4321), '-4,321');
  assert.equal(formatNumber('nope'), '0');
});

test('hud format: pad2 charge text and percentage', () => {
  assert.equal(pad2(3), '03');
  assert.equal(pad2(30), '30');
  assert.equal(chargeText(3, 8), '03 / 08');
  assert.equal(chargeText(null, 8), '— / 08');
  assert.equal(chargeCount(chargePercent(3, 8)), 38);
  assert.equal(chargePercent(10, 8), 100);
  assert.equal(chargePercent(-1, 8), 0);
  assert.equal(chargePercent(3, 0), 100);
});

function chargeCount(value) {
  return Math.round(value);
}

test('hud format: zoom labels and bands are clamped', () => {
  assert.equal(formatZoom(0.1), '×0.4');
  assert.equal(formatZoom(1), '×1.0');
  assert.equal(formatZoom(64), '×64');
  assert.equal(formatZoom(2048), '×2.0K');
  assert.equal(formatZoom(1_500_000), '×1.50M');
  assert.equal(zoomBand(0.5), 'wide');
  assert.equal(zoomBand(8), 'mid');
  assert.equal(zoomBand(64), 'deep');
  assert.equal(zoomBand(2048), 'macro');
  assert.ok(zoomPercent(0.4) === 0);
  assert.ok(zoomPercent(16777216) === 100);
});

test('hud format: connection and tag normalisation', () => {
  assert.equal(normalizeConnection('reconnecting'), 'reconnecting');
  assert.equal(normalizeConnection('TRANSIT'), 'transit');
  assert.equal(normalizeConnection('bogus'), 'connecting');
  assert.equal(connectionText('offline'), 'OFFLINE');
  assert.equal(normalizeTag('  pilot_one '), 'PILOT_ONE');
  assert.equal(normalizeTag(null), '');
});

test('hud format: ranking is online-first, score desc, tag asc, capped at 14', () => {
  const players = [];
  for (let index = 0; index < 20; index += 1) {
    players.push({ id: `p${index}`, tag: `PILOT${index}`, score: 20 - index, online: index !== 3 });
  }
  players.push({ id: 'p1b', tag: 'ALPHA', score: 19, online: true });
  const ranked = rankPlayers(players, 'p1');
  assert.equal(ranked.rows.length, MAX_PLAYER_ROWS);
  assert.equal(ranked.total, 21);
  assert.equal(ranked.hidden, 7);
  assert.equal(ranked.rows[0].id, 'p0');
  assert.equal(ranked.rows.some((row) => row.id === 'p1' && row.isMe), true);
  // Offline rows sort after online rows regardless of score.
  assert.equal(ranked.rows.some((row) => row.id === 'p3' && row.online), false);
  const tie = rankPlayers(
    [
      { id: 'b', tag: 'BETA', score: 10 },
      { id: 'a', tag: 'ALPHA', score: 10 },
    ],
    null
  );
  assert.deepEqual(tie.rows.map((row) => row.tag), ['ALPHA', 'BETA']);
  assert.deepEqual(rankPlayers(null), { rows: [], total: 0, online: 0, hidden: 0 });
});

test('hud format: mission ratio and target states are never colour-only', () => {
  assert.equal(missionDoneRatio(null), 0);
  assert.equal(missionDoneRatio({ objectives: [{ done: true }, { done: false }] }), 0.5);
  assert.equal(missionDoneRatio({ objectives: [{ done: true }] }), 1);
  assert.equal(targetState(null, 8), 'idle');
  assert.equal(targetState({ label: '1', depth: 8 }, 8), 'depleted');
  assert.equal(targetState({ label: '1', depth: 2, locked: true }, 8), 'locked');
  assert.equal(targetState({ label: '1', depth: 2, terrain: { mineable: false } }, 8), 'submerged');
  assert.equal(targetState({ label: '1', depth: 2 }, 8), 'active');
});

test('hud format: signature changes only when rendered values change', () => {
  const slice = {
    score: 10,
    faces: 1,
    clicks: 2,
    breaks: 3,
    worldText: 'WORLD D0 · 20 FACES',
    planet: { name: 'MAGRATHEA', depth: 2 },
    players: [{ id: 'a', tag: 'A', score: 10, faces: 1, online: true }],
    mission: { ready: false },
    cargo: { total: 0 },
    zoom: { value: 1, depth: 0 },
    connection: 'connected',
  };
  assert.equal(hudSignature(slice), hudSignature({ ...slice, players: [...slice.players] }));
  assert.notEqual(hudSignature(slice), hudSignature({ ...slice, score: 11 }));
  assert.equal(hudSignature(null), '');
});
