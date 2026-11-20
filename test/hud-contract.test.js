/**
 * NARIMATO — migrated HUD DOM/ARIA contract (UI-02).
 *
 * Pure source-level assertions: the island owns one copy of every required id,
 * the HUD keeps the `data-mission="hud"` hook, the charge inspector is a real
 * progress control, and the island never imports a parallel component library.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { REQUIRED_HUD_IDS } from '../public/js/shared/hud-contract.js';
import { readIslandSources } from '../scripts/verify-gds-build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const sources = readIslandSources(ROOT);
const all = Object.values(sources).join('\n');
const intents = sources['ui/src/surfaces/intents.js'] || '';
const hud = sources['ui/src/surfaces/HudSurface.jsx'] || '';
const overlay = sources['ui/src/surfaces/OverlaySurface.jsx'] || '';
const cine = sources['ui/src/surfaces/CineChrome.jsx'] || '';
const surface = sources['ui/src/surfaces/SurfaceStrip.jsx'] || '';

test('hud contract: every required id is in the island id map', () => {
  for (const id of REQUIRED_HUD_IDS) {
    assert.ok(intents.includes(`'${id}'`) || intents.includes(`"${id}"`), `id ${id} is mapped in intents.js`);
  }
  assert.ok(intents.includes("missionList: 'mission-list'"));
  assert.ok(intents.includes("chargeBar: 'target-charge-bar'"));
});

test('hud contract: the single HUD tree keeps the mission hook and data-node hooks', () => {
  assert.ok(hud.includes('data-mission="hud"'), 'the mission list keeps data-mission="hud"');
  for (const node of ['hud', 'score', 'world', 'planet', 'mission', 'mission-list', 'players', 'arcade', 'target', 'zoom', 'nav', 'hint']) {
    assert.ok(hud.includes(`data-hud-node="${node}"`), `HUD node ${node} is rendered`);
  }
  for (const node of ['surface-controls', 'surface-target', 'surface-lap']) {
    assert.ok(surface.includes(`data-hud-node="${node}"`), `surface node ${node} is rendered`);
  }
  assert.equal((all.match(/data-hud-node="hud"/g) || []).length, 1, 'one HUD root');
});

test('hud contract: the charge inspector is a labelled progress control with min/max', () => {
  assert.ok(hud.includes('id={IDS.chargeBar}'), 'target-charge-bar is rendered');
  assert.ok(hud.includes("aria-label={`Cell ${target.label || 'target'} charge`}"), 'the charge bar has an accessible name');
  assert.ok(hud.includes('Progress'), 'progress uses the shipped GDS progress component');
  assert.ok(hud.includes('value={target.chargePercent || 0}'), 'the current charge is the governed progress value');
  assert.ok(hud.includes('chargeText(target.clicks, target.threshold)'), 'min/max/now are mirrored in text');
});

test('hud contract: panel toggles expose aria-expanded and aria-controls', () => {
  for (const controller of ['IDS.mission', 'IDS.players', 'IDS.arcade']) {
    assert.ok(hud.includes(`aria-controls={${controller}}`), `aria-controls for ${controller}`);
  }
  assert.ok(hud.includes("aria-expanded={ui.drawer === 'mission' ? 'true' : 'false'}"));
  assert.ok(hud.includes("aria-expanded={ui.drawer === 'operators' ? 'true' : 'false'}"));
  assert.ok(hud.includes("aria-expanded={ui.drawer === 'arcade' ? 'true' : 'false'}"));
});

test('hud contract: empty, loading and error states are designed', () => {
  assert.ok(hud.includes('No other operators'), 'empty pilots state');
  assert.ok(hud.includes('THE HOLD IS EMPTY'), 'empty cargo state');
  assert.ok(overlay.includes('AWAITING MISSION DATA'), 'empty mission state');
  assert.ok(overlay.includes('InlineAlert'), 'join errors use the GDS alert');
  assert.ok(hud.includes('AWAITING') || hud.includes('RETRY') || overlay.includes('error'), 'a recovery/error path exists');
});

test('hud contract: no direct @mantine/@tabler imports or second provider in the island', () => {
  assert.equal(all.includes('@mantine/'), false);
  assert.equal(all.includes('@tabler/'), false);
  assert.equal((all.match(/<GdsProvider\b/g) || []).length, 1);
  assert.equal((all.match(/createRoot\s*\(/g) || []).length, 1);
});

test('hud contract: the overlay and cine chrome preserve their ids', () => {
  assert.ok(overlay.includes("tagInput: 'tag-input'") || intents.includes("tagInput: 'tag-input'"));
  assert.ok(intents.includes("reportCard: 'report-card-preview'"));
  assert.ok(intents.includes("manualSections: 'manual-sections'"));
  assert.ok(cine.includes('id="btn-skip-intro"'));
  assert.ok(cine.includes('id="btn-interlude-continue"'));
  assert.ok(cine.includes('id="intro-bar"'));
  assert.ok(cine.includes('id="interlude-bar"'));
});
