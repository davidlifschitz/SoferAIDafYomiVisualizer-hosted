/**
 * In-memory sliding-window rate limits for submission abuse protection.
 *
 * Approach: process-local counters keyed by user ID and client IP. Suitable for
 * preview/single-instance deployments and unit tests. On Vercel serverless,
 * counters reset on cold starts and are not shared across regions — migrate to
 * Redis/Upstash or a DB-backed counter table before high-traffic production.
 */

export type RateLimitConfig = {
  userWindowMs: number;
  userMaxRequests: number;
  ipWindowMs: number;
  ipMaxRequests: number;
};

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  userWindowMs: 60 * 60 * 1000,
  userMaxRequests: 20,
  ipWindowMs: 60 * 60 * 1000,
  ipMaxRequests: 40,
};

export type RateLimiter = {
  allowUser(userId: string, now?: number): boolean;
  allowIp(ip: string, now?: number): boolean;
};

function pruneWindow(timestamps: number[], windowMs: number, now: number): number[] {
  const cutoff = now - windowMs;
  return timestamps.filter((timestamp) => timestamp > cutoff);
}

function recordHit(
  buckets: Map<string, number[]>,
  key: string,
  windowMs: number,
  maxRequests: number,
  now: number,
): boolean {
  const existing = pruneWindow(buckets.get(key) ?? [], windowMs, now);
  if (existing.length >= maxRequests) {
    buckets.set(key, existing);
    return false;
  }

  existing.push(now);
  buckets.set(key, existing);
  return true;
}

export function createInMemoryRateLimiter(
  config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG,
): RateLimiter {
  const userBuckets = new Map<string, number[]>();
  const ipBuckets = new Map<string, number[]>();

  return {
    allowUser(userId: string, now = Date.now()): boolean {
      return recordHit(
        userBuckets,
        userId,
        config.userWindowMs,
        config.userMaxRequests,
        now,
      );
    },
    allowIp(ip: string, now = Date.now()): boolean {
      if (!ip.trim()) {
        return true;
      }

      return recordHit(
        ipBuckets,
        ip,
        config.ipWindowMs,
        config.ipMaxRequests,
        now,
      );
    },
  };
}