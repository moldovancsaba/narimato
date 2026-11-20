/**
 * SEC-01 — pure token-bucket limiter contract.
 *
 * Covers refill maths, burst capacity, retryAfter, injected clock, per-key
 * isolation, forget/reset/prune and the hard memory bound (no unbounded map).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { RateLimiter, normalizeRule, refillBucket, retryAfterMs } from '../lib/rate-limit.js';

function clock(start = 1_000_000) {
  let now = start;
  return {
    now: () => now,
    advance: (ms) => {
      now += ms;
      return now;
    },
  };
}

test('rate-limit: burst capacity is spent then refilled at max/windowMs', () => {
  const time = clock();
  const limiter = new RateLimiter({ now: time.now });
  const rule = { max: 10, windowMs: 1000, burst: 2 };
  assert.equal(limiter.allow(rule, 'ip:one').ok, true);
  assert.equal(limiter.allow(rule, 'ip:one').ok, true);
  const refused = limiter.allow(rule, 'ip:one');
  assert.equal(refused.ok, false);
  assert.ok(refused.retryAfterMs > 0 && refused.retryAfterMs <= 100, `retryAfter ${refused.retryAfterMs}`);
  // 100 ms refills exactly one token at 10/s.
  time.advance(100);
  assert.equal(limiter.allow(rule, 'ip:one').ok, true);
  assert.equal(limiter.allow(rule, 'ip:one').ok, false);
});

test('rate-limit: retryAfterMs is the exact wait for the next token', () => {
  const limiter = new RateLimiter({ now: () => 0 });
  const rule = { max: 10, windowMs: 60_000, burst: 1 };
  assert.equal(limiter.allow(rule, 'ip:x', 0).ok, true);
  const refused = limiter.allow(rule, 'ip:x', 0);
  assert.equal(refused.ok, false);
  assert.equal(refused.retryAfterMs, 6000, 'one token every 6 s at 10/min');
  assert.equal(limiter.allow(rule, 'ip:x', 5999).ok, false);
  assert.equal(limiter.allow(rule, 'ip:x', 6000).ok, true);
});

test('rate-limit: the injected clock, not wall time, drives refills', () => {
  const time = clock(0);
  const limiter = new RateLimiter({ now: time.now });
  const rule = { max: 60, windowMs: 60_000, burst: 1 };
  assert.equal(limiter.allow(rule, 'k').ok, true);
  assert.equal(limiter.allow(rule, 'k').ok, false);
  time.advance(1000); // 1 token/s
  assert.equal(limiter.allow(rule, 'k').ok, true);
});

test('rate-limit: keys are isolated (per token, per IP)', () => {
  const limiter = new RateLimiter({ now: () => 0 });
  const rule = { max: 1, windowMs: 60_000, burst: 1 };
  assert.equal(limiter.allow(rule, 'token:a', 0).ok, true);
  assert.equal(limiter.allow(rule, 'token:a', 0).ok, false);
  assert.equal(limiter.allow(rule, 'token:b', 0).ok, true, 'another token has its own bucket');
  assert.equal(limiter.allow(rule, 'ip:1.2.3.4', 0).ok, true);
  assert.equal(limiter.allow(rule, 'ip:5.6.7.8', 0).ok, true, 'another address has its own bucket');
});

test('rate-limit: memory is bounded and old keys are evicted', () => {
  const limiter = new RateLimiter({ now: () => 0, maxEntries: 8 });
  const rule = { max: 1, windowMs: 1000, burst: 1 };
  for (let index = 0; index < 100; index += 1) limiter.allow(rule, `ip:${index}`, 0);
  assert.equal(limiter.size, 8);
  // The most recent keys survive; the oldest are gone.
  assert.equal(limiter.allow(rule, 'ip:99', 0).ok, false);
  limiter.reset();
  assert.equal(limiter.size, 0);
});

test('rate-limit: forget and prune release state', () => {
  const limiter = new RateLimiter({ now: () => 0 });
  const rule = { max: 1, windowMs: 1000, burst: 1 };
  limiter.allow(rule, 'token:rotated', 0);
  assert.equal(limiter.forget('token:rotated'), true);
  assert.equal(limiter.allow(rule, 'token:rotated', 0).ok, true, 'rotated token starts fresh');
  limiter.allow(rule, 'token:old', 0);
  assert.equal(limiter.prune(3_600_001), 2);
  assert.equal(limiter.size, 0);
});

test('rate-limit: rule normalisation clamps invalid values', () => {
  const rule = normalizeRule({ max: 0, windowMs: -5, burst: 0 });
  assert.equal(rule.max, 1);
  assert.equal(rule.windowMs, 1);
  assert.equal(rule.burst, 1);
  const defaults = normalizeRule();
  assert.equal(defaults.max, 60);
  assert.equal(defaults.burst, 60);
  assert.equal(refillBucket(null, { max: 10, windowMs: 1000, burst: 3 }, 0).tokens, 3);
  assert.equal(refillBucket({ tokens: 0, at: 0 }, { max: 10, windowMs: 1000, burst: 3 }, 100).tokens, 1);
  assert.equal(retryAfterMs({ tokens: 1, at: 0 }, { max: 10, windowMs: 1000 }), 0);
});
