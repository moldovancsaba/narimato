import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_SHARE_TEXT,
  MAX_SHARE_URL,
  sanitizeShareText,
  sanitizeShareUrl,
  sanitizeText,
} from '../public/js/shared/share-text.js';
import { buildShareText } from '../public/js/result-card.js';

test('share text: control characters collapse and length is capped', () => {
  const text = sanitizeText('  hello\u0000   world  ');
  assert.equal(text, 'hello world');
  const long = sanitizeText('x'.repeat(MAX_SHARE_TEXT + 50));
  assert.equal(long.length, MAX_SHARE_TEXT);
  assert.ok(long.endsWith('…'));
  const multi = sanitizeShareText('line one\nline two\nline three');
  assert.equal(multi, 'line one\nline two\nline three');
});

test('share url: only https/http or same-origin relative URLs survive', () => {
  assert.equal(sanitizeShareUrl('https://narimato.example/play?report=abc'), 'https://narimato.example/play?report=abc');
  assert.equal(sanitizeShareUrl('javascript:alert(1)'), '');
  assert.equal(sanitizeShareUrl('data:text/html,<script>'), '');
  assert.equal(sanitizeShareUrl('//evil.example/x'), '');
  assert.equal(sanitizeShareUrl('https://user:pass@evil.example/'), '');
  assert.equal(sanitizeShareUrl(`https://example.com/${'a'.repeat(MAX_SHARE_URL)}`), '');
  assert.equal(sanitizeShareUrl('/play?report=abc'), '/play?report=abc');
  assert.equal(sanitizeShareUrl('https://other.example/x', { origin: 'https://narimato.example' }), '');
  assert.equal(sanitizeShareUrl('', {}), '');
});

test('share text: report copy excludes tokens and never exceeds 280 chars', () => {
  const text = buildShareText(
    {
      tag: 'PILOT_ONE',
      score: 12345,
      sessionScore: 1234,
      rank: 2,
      totalPlayers: 9,
      clicks: 100,
      breaks: 20,
      facesHeld: 4,
      depth: 3,
      claims: 10,
      steals: 1,
      ores: 12,
      oreValue: 900,
      bestFind: { name: 'SILVER', value: 90 },
      token: 'secret-token',
      playerId: 'internal-id',
    },
    'https://narimato.example/play?report=abc'
  );
  assert.ok(text.length <= MAX_SHARE_TEXT, `share text ${text.length} > ${MAX_SHARE_TEXT}`);
  assert.match(text, /NARIMATO/);
  assert.match(text, /PILOT_ONE/);
  assert.match(text, /https:\/\/narimato\.example/);
  assert.equal(text.includes('secret-token'), false);
  assert.equal(text.includes('internal-id'), false);
});

test('share text: a hostile URL is dropped instead of rendered', () => {
  const text = buildShareText(
    { tag: 'ACE', score: 1, rank: 1, totalPlayers: 1, shareUrl: 'javascript:alert(1)' },
    'javascript:alert(1)'
  );
  assert.equal(text.includes('javascript'), false);
});
