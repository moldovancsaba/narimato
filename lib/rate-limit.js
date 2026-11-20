/**
 * NARIMATO — pure token-bucket rate limiter (SEC-01).
 *
 * One limiter instance, injectable clock, bounded memory. Every route passes a
 * rule + an opaque key (`ip:<address>` or `token:<callsign token>`); no address
 * or token is ever logged or exported.
 *
 * Token bucket (matches SEC-01 §11):
 *   tokens = min(burst, tokens + (now - at) * (max / windowMs))
 *   if tokens < 1 -> refuse with retryAfterMs; else store tokens - 1
 *
 * `max` is the sustained rate per `windowMs` and `burst` is the bucket
 * capacity (defaults to `max`, i.e. a full window of credit at boot).
 */

const DEFAULT_MAX_ENTRIES = 4096;

/** Normalise an untrusted rule; returns a frozen, valid rule. */
export function normalizeRule(rule = {}) {
  const max = Number.isFinite(rule.max) ? Math.max(1, Math.trunc(rule.max)) : 60;
  const windowMs = Number.isFinite(rule.windowMs) ? Math.max(1, Math.trunc(rule.windowMs)) : 60_000;
  const burst = Number.isFinite(rule.burst) ? Math.max(1, Math.trunc(rule.burst)) : max;
  return Object.freeze({ ...rule, max, windowMs, burst });
}

/**
 * Refilled bucket state. Pure: takes and returns `{ tokens, at }`.
 * `null` bucket means a fresh bucket at full burst.
 */
export function refillBucket(bucket, rule, now) {
  const normalized = normalizeRule(rule);
  if (!bucket) return { tokens: normalized.burst, at: now };
  const elapsed = Math.max(0, now - bucket.at);
  return {
    tokens: Math.min(normalized.burst, bucket.tokens + elapsed * (normalized.max / normalized.windowMs)),
    at: now,
  };
}

/** ms until one token is available (0 when a token is already available). */
export function retryAfterMs(bucket, rule) {
  const normalized = normalizeRule(rule);
  if (!bucket || bucket.tokens >= 1) return 0;
  const deficit = 1 - bucket.tokens;
  return Math.max(1, Math.ceil((deficit * normalized.windowMs) / normalized.max));
}

export class RateLimiter {
  /**
   * @param {object} [options]
   * @param {() => number} [options.now] injectable clock (epoch ms)
   * @param {number} [options.maxEntries] hard memory bound (LRU-ish: oldest keys first)
   */
  constructor({ now = Date.now, maxEntries = DEFAULT_MAX_ENTRIES } = {}) {
    this.now = typeof now === 'function' ? now : Date.now;
    this.maxEntries = Math.max(1, Math.trunc(maxEntries) || DEFAULT_MAX_ENTRIES);
    /** @type {Map<string, {tokens:number, at:number}>} */
    this.buckets = new Map();
  }

  get size() {
    return this.buckets.size;
  }

  /**
   * Consume one token for `key` under `rule`.
   * Returns `{ ok, retryAfterMs, remaining, limit }`; a refusal never mutates
   * another key and counts no identifiers.
   */
  allow(rule, key, at = this.now()) {
    const normalized = normalizeRule(rule);
    const now = Number.isFinite(at) ? at : this.now();
    const bucket = refillBucket(this.buckets.get(key), normalized, now);
    if (bucket.tokens < 1) {
      this.buckets.set(key, bucket);
      this._evict();
      return { ok: false, retryAfterMs: retryAfterMs(bucket, normalized), remaining: 0, limit: normalized.max };
    }
    bucket.tokens = Math.max(0, bucket.tokens - 1);
    this.buckets.set(key, bucket);
    this._evict();
    return { ok: true, retryAfterMs: 0, remaining: Math.floor(bucket.tokens), limit: normalized.max };
  }

  /** Remove a key immediately (e.g. token rotation). */
  forget(key) {
    return this.buckets.delete(key);
  }

  /** Drop expired buckets; returns how many were evicted. */
  prune(at = this.now(), maxAgeMs = 3_600_000) {
    let removed = 0;
    for (const [key, bucket] of this.buckets) {
      if (at - bucket.at > maxAgeMs) {
        this.buckets.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  reset() {
    this.buckets.clear();
  }

  /** Bound memory: a flood of unique keys cannot grow the map unbounded. */
  _evict() {
    while (this.buckets.size > this.maxEntries) {
      const oldest = this.buckets.keys().next().value;
      this.buckets.delete(oldest);
    }
  }
}

export default RateLimiter;
