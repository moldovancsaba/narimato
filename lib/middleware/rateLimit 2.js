// In-memory sliding window rate limiter for Next.js API routes
// FUNCTIONAL: Apply per-IP (and contextual) request caps over a time window
// STRATEGIC: Protects endpoints from abuse and accidental floods without external deps

const buckets = new Map(); // key -> array<number> timestamps (ms)

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

/**
 * Apply a simple sliding window rate limit. Returns true if request was limited
 * so callers can early-return after sending 429.
 *
 * @param {import('http').IncomingMessage & { headers: any, query?: any }} req
 * @param {import('http').ServerResponse} res
 * @param {{ windowMs: number, max: number, key?: string }} options
 */
export async function applyRateLimit(req, res, options) {
  const { windowMs, max } = options;
  const ip = getClientIp(req);
  const customKey = options.key || '';
  const key = `${ip}::${customKey}`;

  const now = Date.now();
  const windowStart = now - windowMs;

  const arr = buckets.get(key) || [];
  // prune old
  const recent = arr.filter(ts => ts > windowStart);
  recent.push(now);
  buckets.set(key, recent);

  if (recent.length > max) {
    try {
      res.statusCode = 429;
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(windowMs / 1000)));
      res.end(JSON.stringify({ error: 'Too many requests', status: 429 }));
    } catch {}
    return true;
  } else {
    // Provide remaining headers for observability
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - recent.length)));
    return false;
  }
}

