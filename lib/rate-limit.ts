import { LRUCache } from 'lru-cache';

type RateLimitOptions = {
  interval: string; // Time window for rate limiting (e.g., '10m', '1h')
  uniqueTokenPerInterval: number; // Maximum number of unique tokens per interval
};

/**
 * Rate limiting implementation using LRU cache
 * Provides a flexible way to rate limit API requests based on time intervals
 * 
 * @param options Configuration options for rate limiting
 * @returns Object with check method to verify rate limit
 */
export function rateLimit(options: RateLimitOptions) {
  const tokenCache = new LRUCache({
    max: options.uniqueTokenPerInterval || 500,
    ttl: getDurationInMs(options.interval || '10m'),
  });

  return {
    check: async (limit = options.uniqueTokenPerInterval) => {
      const tokenCount = tokenCache.size;
      
      if (tokenCount >= limit) {
        throw new Error('Rate limit exceeded');
      }

      tokenCache.set(Date.now().toString(), true);
    }
  };
}

/**
 * Converts a time string into milliseconds
 * Supports formats like '10s', '5m', '24h', etc.
 * 
 * @param duration Time duration string (e.g., '10m', '1h')
 * @returns Duration in milliseconds
 */
function getDurationInMs(duration: string): number {
  const match = duration.match(/^(\d+)([smh])$/);
  if (!match) throw new Error('Invalid duration format');

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    default:
      throw new Error('Invalid time unit');
  }
}
