import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DWELL_FULL_MS,
  DWELL_REDUCED_MS,
  FALLBACK_DETAIL,
  INCIDENT_KINDS,
  INCIDENT_TITLES,
  MAX_DETAIL_CHARS,
  OUTCOME,
  UNKNOWN_KIND_FALLBACK,
  buildIncidentAnnouncement,
  captionUnits,
  firstSentence,
  incidentDwellMs,
} from '../public/js/shared/incident-announcements.js';
import { INCIDENT_COPY } from '../public/js/story-copy.js';
import { NARRATION, narrationSegments } from '../public/js/narrative-data.js';

const PLANET = { name: 'MAGRATHEA', planetIndex: 0 };

function frameFor(kind) {
  const copy = INCIDENT_COPY.find((entry) => entry.kind === kind);
  return {
    type: 'incident',
    kind: copy.kind,
    title: copy.title,
    tone: copy.tone,
    message: copy.message,
    description: copy.description,
    revision: 7,
  };
}

test('incident announcements: every kind maps to the documented shape', () => {
  assert.deepEqual(INCIDENT_KINDS, ['meteor', 'nuclear', 'solar', 'alien']);
  for (const kind of INCIDENT_KINDS) {
    const announcement = buildIncidentAnnouncement(frameFor(kind), PLANET, { revision: 7 });
    assert.equal(announcement.kind, kind);
    assert.equal(announcement.id, `${kind}:0:7`, 'dedupe key is kind:planetIndex:revision');
    assert.equal(announcement.politeness, 'polite', 'incidents never steal focus');
    assert.equal(announcement.title, INCIDENT_TITLES[kind]);
    assert.equal(announcement.planetName, 'MAGRATHEA');
    assert.equal(announcement.planetIndex, 0);
    assert.equal(announcement.visualLabel, `${INCIDENT_TITLES[kind]} // MAGRATHEA`);
    assert.equal(announcement.captionCueId, `event-incident-${kind}`);
    assert.ok(announcement.spoken.startsWith(`${INCIDENT_TITLES[kind]} on MAGRATHEA.`));
    assert.ok(announcement.spoken.includes(OUTCOME));
    assert.ok(!announcement.spoken.includes('//'), 'screen readers must never hear slash slash');
    assert.equal(announcement.captions.length, 3, 'captions reuse the three narration sentence units');
    assert.ok(announcement.detail.length <= MAX_DETAIL_CHARS);
    assert.equal(announcement.dwellMs, DWELL_FULL_MS);
  }
});

test('incident announcements: unknown kind degrades to meteor with fallback copy', () => {
  const announcement = buildIncidentAnnouncement(
    { type: 'incident', kind: 'volcano', title: '', message: '', description: '' },
    { name: 'MAGRATHEA', planetIndex: 2 },
  );
  assert.equal(announcement.kind, UNKNOWN_KIND_FALLBACK);
  assert.equal(announcement.title, INCIDENT_TITLES.meteor);
  assert.equal(announcement.detail, FALLBACK_DETAIL.meteor);
  assert.ok(!announcement.spoken.includes('//'));
  assert.equal(announcement.planetIndex, 2);
});

test('incident announcements: missing description uses the per-kind fallback; planet falls back', () => {
  for (const kind of INCIDENT_KINDS) {
    const announcement = buildIncidentAnnouncement({ kind }, {});
    assert.equal(announcement.detail, FALLBACK_DETAIL[kind]);
    assert.equal(announcement.planetName, 'this planet');
    assert.equal(announcement.planetIndex, 0);
  }
});

test('incident announcements: over-long descriptions clamp to a 240-char first sentence', () => {
  const long = `${'Quake'.padEnd(400, 'x')} tail that should be cut. Second sentence stays out.`;
  const announcement = buildIncidentAnnouncement({ kind: 'nuclear', description: long }, PLANET);
  assert.ok(announcement.detail.length <= MAX_DETAIL_CHARS, `detail length ${announcement.detail.length}`);
  assert.ok(!announcement.detail.includes('Second sentence'), 'only the first sentence is used');
  assert.ok(announcement.detail.endsWith('…'), 'clamped copy is marked');
  assert.equal(firstSentence('One. Two.'), 'One.');
  assert.equal(firstSentence(''), '');
  assert.equal(firstSentence(null), '');
});

test('incident announcements: dwell is 1200 ms reduced / 2600 ms otherwise', () => {
  assert.equal(incidentDwellMs({}), DWELL_FULL_MS);
  assert.equal(incidentDwellMs({ reducedMotion: false }), DWELL_FULL_MS);
  assert.equal(incidentDwellMs({ reducedMotion: true }), DWELL_REDUCED_MS);
  assert.equal(buildIncidentAnnouncement(frameFor('solar'), PLANET, { reducedMotion: true }).dwellMs, DWELL_REDUCED_MS);
  assert.equal(buildIncidentAnnouncement(frameFor('solar'), PLANET, { reducedMotion: false }).dwellMs, DWELL_FULL_MS);
});

test('incident announcements: revision makes dedupe keys stable but distinct per event', () => {
  const a = buildIncidentAnnouncement(frameFor('meteor'), PLANET, { revision: 3 });
  const b = buildIncidentAnnouncement(frameFor('meteor'), PLANET, { revision: 3 });
  const c = buildIncidentAnnouncement(frameFor('meteor'), PLANET, { revision: 4 });
  assert.equal(a.id, b.id, 'same event replays dedupe');
  assert.notEqual(a.id, c.id, 'a new event is a new announcement');
  assert.equal(buildIncidentAnnouncement(frameFor('meteor'), { name: 'X', planetIndex: 1 }, { revision: 3 }).id, 'meteor:1:3');
  assert.equal(buildIncidentAnnouncement(frameFor('meteor'), PLANET, {}).id, 'meteor:0:7', 'frame revision is used');
});

test('incident announcements: captions are plain sentence units with no markup', () => {
  assert.deepEqual(captionUnits('One thing. Two things!'), ['One thing.', 'Two things!']);
  assert.deepEqual(captionUnits(''), []);
  const announcement = buildIncidentAnnouncement(frameFor('alien'), PLANET);
  for (const line of announcement.captions) {
    assert.ok(!/[<>]/.test(line), 'captions are text, never HTML');
  }
  const cue = NARRATION['event-incident-alien'];
  assert.deepEqual(announcement.captions, narrationSegments(cue), 'captions equal the voice sentence units');
});
