/**
 * E2E smoke: v1 swipe_only + vote_only on #SampleDeck (requires dev server + .env.local).
 * Run: npm run dev &  node scripts/e2e-v1-play.js
 */
require('./load-env');

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const ORG = process.env.E2E_ORG_ID || 'be34910d-fc7b-475b-8112-67fe778bff2c';
const DECK = process.env.E2E_DECK_TAG || '#SampleDeck';

async function start(mode) {
  const res = await fetch(`${BASE}/api/v1/play/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organizationId: ORG, deckTag: DECK, mode }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`start ${mode}: ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function swipe(playId, cardId, direction = 'right') {
  const res = await fetch(`${BASE}/api/v1/play/${playId}/input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'swipe', payload: { cardId, direction } }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`swipe: ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function vote(playId, winner, loser) {
  const res = await fetch(`${BASE}/api/v1/play/${playId}/input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'vote', payload: { winner, loser } }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`vote: ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function next(playId) {
  const res = await fetch(`${BASE}/api/v1/play/${playId}/next`);
  const data = await res.json();
  if (!res.ok) throw new Error(`next: ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function results(playId) {
  const res = await fetch(`${BASE}/api/v1/play/${playId}/results`);
  const data = await res.json();
  if (!res.ok) throw new Error(`results: ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function meta(playId) {
  const res = await fetch(`${BASE}/api/v1/play/${playId}/meta`);
  const data = await res.json();
  if (!res.ok) throw new Error(`meta: ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function runSwipeOnly() {
  const s = await start('swipe_only');
  console.log('swipe_only playId:', s.playId);
  let cardId = s.currentCardId || s.cards?.[0]?.id;
  for (let i = 0; i < 10; i++) {
    const r = await swipe(s.playId, cardId, 'right');
    if (r.completed) break;
    cardId = r.nextCardId;
    if (!cardId) break;
  }
  const m = await meta(s.playId);
  if (m.organizationId !== ORG) throw new Error('meta organizationId mismatch');
  const fin = await results(s.playId);
  if (!fin.organizationId) throw new Error('results missing organizationId');
  console.log('swipe_only OK', fin.mode, fin.ranking?.length || 0, 'ranked');
}

async function runVoteOnly() {
  const s = await start('vote_only');
  console.log('vote_only playId:', s.playId);
  let n = await next(s.playId);
  let guard = 0;
  while (!n.completed && n.challenger && n.opponent && guard < 50) {
    await vote(s.playId, n.challenger, n.opponent);
    n = await next(s.playId);
    guard += 1;
  }
  const fin = await results(s.playId);
  if (fin.mode !== 'vote_only') throw new Error(`expected vote_only got ${fin.mode}`);
  console.log('vote_only OK', fin.ranking?.length || fin.personalRanking?.length, 'ranked');
}

async function main() {
  await runSwipeOnly();
  await runVoteOnly();
  console.log('E2E v1 play passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
