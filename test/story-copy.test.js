import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

import {
  COPY_DEFAULTS,
  GENERIC_CATASTROPHE,
  GUIDE_STEPS,
  HELP_SECTIONS,
  INCIDENT_COPY,
  MISSION_LABELS,
  breakClicksFor,
  captainLog,
  clicksWord,
  copyContext,
  docBlocks,
  guideStepBody,
  guideThresholdSentence,
  incidentCopy,
  joinList,
  materialName,
  materialQuantity,
  plural,
  renderInlineHtml,
} from '../public/js/story-copy.js';
import { RESOURCES } from '../public/js/shared/resources.js';
import { missionForPlanet } from '../public/js/shared/mission.js';
import { NARRATION } from '../public/js/narrative-data.js';
import { INCIDENTS } from '../lib/world-core.js';
import {
  checkCopy,
  expectedInner,
  inspectBlock,
  markerEnd,
  markerStart,
  writeCopy,
} from '../scripts/sync-story-copy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COPY_FILES = ['GUIDE.md', 'GAMEPLAY.md', 'public/index.html'];

function temporaryCopyTree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'narimato-copy-'));
  for (const file of COPY_FILES) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, fs.readFileSync(path.join(ROOT, file), 'utf8'));
  }
  return root;
}

/* ---------------------------------------------------------------- grammar */

test('copy: plural follows the suffix table', () => {
  assert.equal(plural('cell', 1), 'cell');
  assert.equal(plural('cell', 2), 'cells');
  assert.equal(plural('box', 2), 'boxes');
  assert.equal(plural('ash', 3), 'ashes');
  assert.equal(plural('alloy', 2), 'alloys');
  assert.equal(plural('Alloy', 2), 'Alloys');
  assert.equal(plural('city', 2), 'cities');
  assert.equal(plural('day', 2), 'days');
  assert.equal(plural('', 2), '');
  assert.equal(plural('cell', '1'), 'cell');
});

test('copy: materials are mass nouns in prose (2 Uranium, never 2 Uraniums)', () => {
  for (const resource of RESOURCES) {
    const label = materialName(resource.name);
    for (const count of [1, 2, 3]) {
      const text = materialQuantity(resource.name, count);
      assert.equal(text, `${count} ${label}`);
      assert.ok(!/s$/.test(text.replace(label, '')), `${text} must not gain a plural suffix`);
    }
  }
  assert.equal(materialQuantity('uranium', 2), '2 Uranium');
  assert.equal(materialQuantity('URANIUM', 2), '2 Uranium');
  assert.equal(materialQuantity('silver', 3), '3 Silver');
  assert.equal(materialQuantity('palladium', 1), '1 Palladium');
  assert.equal(materialQuantity('Alloy', 2), '2 Alloys');
  assert.equal(materialQuantity('silver', 0), '0 Silver');
});

test('copy: joinList renders natural prose', () => {
  assert.equal(joinList([]), '');
  assert.equal(joinList(['a']), 'a');
  assert.equal(joinList(['a', 'b']), 'a and b');
  assert.equal(joinList(['a', 'b', 'c']), 'a, b and c');
});

test("copy: Captain's Log is grounded, almost-there and ready with correct grammar", () => {
  const grounded = captainLog({
    planetName: 'TATOOINE',
    planetSource: 'STAR WARS',
    missing: [
      { name: 'URANIUM', left: 2 },
      { name: 'SILVER', left: 3 },
      { name: 'PALLADIUM', left: 1 },
    ],
  });
  assert.match(grounded, /We're grounded on TATOOINE — STAR WARS\./);
  assert.match(grounded, /2 Uranium, 3 Silver and 1 Palladium/);
  assert.ok(!grounded.includes('Uraniums'), 'the plural drift must not return');

  const almost = captainLog({ planetName: 'MAGRATHEA', missing: [] });
  assert.match(almost, /almost there/);
  assert.match(almost, /MAGRATHEA/);

  const ready = captainLog({ planetName: 'MAGRATHEA', ready: true });
  assert.match(ready, /breathing again/);
  assert.ok(!ready.includes('still needs'));
  assert.equal(captainLog({ planetName: 'MAGRATHEA', missing: [{ name: 'URANIUM', left: 0 }] }), almost);
});

/* --------------------------------------------------------------- thresholds */

test('copy: breakClicksFor mirrors the planet override', () => {
  assert.equal(breakClicksFor(0, 8), 4);
  assert.equal(breakClicksFor(1, 8), 8);
  assert.equal(breakClicksFor(5, 8), 8);
  assert.equal(breakClicksFor(0, 6), 4);
  assert.equal(breakClicksFor(2, 6), 6);
  assert.equal(breakClicksFor(1, 1), 1);
  assert.equal(breakClicksFor(), COPY_DEFAULTS.breakClicks);
});

test('copy: click words and the guide threshold sentence are shared by every surface', () => {
  assert.equal(clicksWord(4), 'Four');
  assert.equal(clicksWord(8), 'Eight');
  assert.equal(clicksWord(12), '12');
  assert.equal(guideThresholdSentence(4), 'Four clicks break it into four smaller cells.');
  assert.equal(guideThresholdSentence(8), 'Eight clicks break it into four smaller cells.');
  assert.equal(guideStepBody('how', { breakClicks: 4, deeperClicks: 8 }), GUIDE_STEPS[1].body({ breakClicks: 4, deeperClicks: 8 }));
});

test('copy: Quick Guide steps exist for all four sections and reference narration cues', () => {
  assert.deepEqual(GUIDE_STEPS.map((step) => step.id), ['what', 'how', 'where', 'leave']);
  assert.deepEqual(GUIDE_STEPS.map((step) => step.title), ['WHAT TO MINE', 'HOW TO MINE', 'WHERE TO DIG', 'HOW TO LEAVE']);
  for (const step of GUIDE_STEPS) {
    assert.ok(NARRATION[step.cueId], `cue ${step.cueId} must exist`);
    assert.ok(step.body(copyContext()).length > 20);
  }
  assert.match(guideStepBody('how', { breakClicks: 4, deeperClicks: 8 }), /Four clicks/);
  assert.match(guideStepBody('how', { breakClicks: 8, deeperClicks: 8 }), /Eight clicks/);
  assert.match(guideStepBody('where'), /NAV/);
  assert.match(guideStepBody('leave'), /TRY TO FLY AWAY/);
});

test('copy: every surface states the same threshold rule for planets 1, 2 and deeper', () => {
  // docs use the marked blocks (generated), the guide card uses the same template.
  const blocks = docBlocks({ breakClicks: 4, deeperClicks: 8 });
  const mining = blocks.find((block) => block.id === 'gameplay-mining').content;
  assert.match(mining, /\*\*4 clicks\*\* on the first world, \*\*8\*\* on deeper worlds/);
  const guide = blocks.find((block) => block.id === 'guide-mining').content;
  assert.match(guide, /first world breaks a triangle at \*\*4 clicks\*\*; deeper worlds ask for \*\*8\*\*/);
  const card = blocks.find((block) => block.id === 'guide-steps').content;
  assert.match(card, /Four clicks break it into four smaller cells; deeper worlds ask for eight/);
  assert.match(card, /id="guide-how-copy"/);
  // a non-default configured threshold flows through every render
  const custom = docBlocks({ breakClicks: 4, deeperClicks: 12 });
  assert.match(custom.find((block) => block.id === 'gameplay-mining').content, /\*\*4 clicks\*\* on the first world, \*\*12\*\*/);
});

/* ------------------------------------------------------------------- labels */

test('copy: mission labels match the authoritative mission categories', () => {
  for (const planetIndex of [0, 1, 5]) {
    for (const seed of [0, 1, 42, 424242]) {
      const mission = missionForPlanet(planetIndex, seed);
      const names = mission.objectives.map((objective) => objective.name);
      assert.deepEqual(names, [MISSION_LABELS.fuel, MISSION_LABELS.hull, MISSION_LABELS.warp]);
    }
  }
});

test('copy: incident copy covers all four kinds and is the server source', () => {
  assert.deepEqual(INCIDENT_COPY.map((incident) => incident.kind), ['meteor', 'nuclear', 'solar', 'alien']);
  for (const incident of INCIDENT_COPY) {
    assert.ok(incident.title.length > 0);
    assert.ok(incident.message.includes('//'));
    assert.ok(incident.description.length > 40);
    assert.equal(INCIDENTS.find((entry) => entry.kind === incident.kind).description, incident.description);
  }
  assert.equal(incidentCopy('nuclear').title, 'NUCLEAR WAR');
  assert.equal(incidentCopy('unknown').title, GENERIC_CATASTROPHE.title);
  assert.ok(incidentCopy(null).description.length > 0);
});

test('copy: manual sections label their play buttons and reference real cues', () => {
  assert.ok(HELP_SECTIONS.length >= 6);
  const ids = new Set();
  for (const section of HELP_SECTIONS) {
    assert.ok(section.title);
    assert.ok(NARRATION[section.voiceId], `missing cue for ${section.id}`);
    assert.ok(Array.isArray(section.body) && section.body.length > 0);
    ids.add(section.id);
  }
  assert.equal(ids.size, HELP_SECTIONS.length);
});

/* --------------------------------------------------------------- doc blocks */

test('copy: doc blocks are unique, target real files and every marker pair exists once', () => {
  const blocks = docBlocks();
  assert.equal(blocks.length, 10);
  assert.equal(new Set(blocks.map((block) => block.id)).size, blocks.length);
  const allowed = new Set(['GUIDE.md', 'GAMEPLAY.md', 'public/index.html']);
  for (const block of blocks) {
    assert.ok(allowed.has(block.file), `unexpected target ${block.file}`);
    assert.ok(['markdown', 'html'].includes(block.format));
    const text = fs.readFileSync(path.join(ROOT, block.file), 'utf8');
    const state = inspectBlock(text, block);
    assert.equal(state.found, true, `${block.file} block ${block.id}: ${state.reason}`);
    assert.equal(text.split(markerStart(block.id)).length - 1, 1);
    assert.equal(text.split(markerEnd(block.id)).length - 1, 1);
    assert.equal(state.actual, expectedInner(block.content, state.indent));
  }
});

test('copy: repository blocks are clean and --check catches a one-character drift', () => {
  assert.deepEqual(checkCopy(ROOT).differences, []);
  const root = temporaryCopyTree();
  assert.equal(checkCopy(root).ok, true);
  const target = path.join(root, 'GAMEPLAY.md');
  const original = fs.readFileSync(target, 'utf8');
  fs.writeFileSync(target, original.replace('**4 clicks**', '**5 clicks**'));
  const drifted = checkCopy(root);
  assert.equal(drifted.ok, false);
  assert.equal(drifted.differences.length, 1);
  assert.equal(drifted.differences[0].reason, 'STALE_BLOCK');
  assert.equal(drifted.differences[0].file, 'GAMEPLAY.md');
  // --write restores the block and leaves the surrounding prose alone.
  writeCopy(root);
  assert.equal(checkCopy(root).ok, true);
  assert.equal(fs.readFileSync(target, 'utf8').includes('# NARIMATO — Gameplay Guide'), true);
});

test('copy: a missing marker pair is reported rather than guessed', () => {
  const root = temporaryCopyTree();
  const target = path.join(root, 'GUIDE.md');
  fs.writeFileSync(target, fs.readFileSync(target, 'utf8').replace(markerStart('guide-rare'), ''));
  const report = checkCopy(root);
  assert.ok(report.differences.some((difference) => difference.id === 'guide-rare' && difference.reason === 'MISSING_MARKER'));
});

test('copy: guide card keeps the existing accessible DOM contract', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
  const block = docBlocks().find((entry) => entry.id === 'guide-steps');
  const list = html.slice(html.indexOf('<ol class="guide-steps">'), html.indexOf('</ol>', html.indexOf('<ol class="guide-steps">')));
  assert.equal((list.match(/<li>/g) || []).length, 4);
  assert.equal((list.match(/<b>/g) || []).length, 4);
  assert.equal((list.match(/<span/g) || []).length, 4);
  assert.equal((list.match(/id="guide-how-copy"/g) || []).length, 1);
  // No new controls inside the generated list: the card's buttons stay outside it.
  assert.ok(!/<button|<a\s/i.test(list));
  assert.match(html, /id="guide-overlay"[^>]*role="dialog"[^>]*aria-modal="true"/);
  assert.equal(block.format, 'html');
});

test('copy: no hardcoded click thresholds outside the copy contract', () => {
  const sources = ['public/js/app.js', 'public/js/ui.js', 'public/js/renderer.js'];
  for (const file of sources) {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.ok(!/\b(?:four|eight)\s+clicks\b/i.test(text), `${file} hardcodes a threshold phrase`);
    assert.ok(!/\b[48]\s+clicks\b/i.test(text), `${file} hardcodes a click count`);
  }
});

test('copy: module stays inside the performance budget', () => {
  const source = fs.readFileSync(path.join(ROOT, 'public/js/story-copy.js'));
  const gzipped = zlib.gzipSync(source).length;
  assert.ok(gzipped <= 5 * 1024, `story-copy.js is ${gzipped} bytes gzipped (budget 5120)`);
});

test('copy: HTML renderer escapes and only adds emphasis', () => {
  assert.equal(renderInlineHtml('a *b* <c>'), 'a <em>b</em> &lt;c&gt;');
  assert.equal(renderInlineHtml('no markup'), 'no markup');
});
