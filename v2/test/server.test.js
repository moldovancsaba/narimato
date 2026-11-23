import test from 'node:test';
import assert from 'node:assert/strict';
import { startV2Server } from '../server.js';

test('v2 scaffold: health, state and client are served', async () => {
  const handle = await startV2Server({ port: 0, quiet: true });
  try {
    const base = `http://127.0.0.1:${handle.port}`;
    const health = await fetch(`${base}/api/health`).then((r) => r.json());
    assert.equal(health.ok, true);
    assert.equal(health.version, 2);
    const state = await fetch(`${base}/api/state`).then((r) => r.json());
    assert.equal(state.player.target, 30);
    assert.equal(state.robots, 4);
    const html = await fetch(`${base}/`).then((r) => r.text());
    assert.ok(html.includes('planet-canvas'));
  } finally {
    await handle.close();
  }
});
