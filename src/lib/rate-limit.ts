/**
 * In-memory per-device rate limiter for the AI analysis endpoint.
 * Protects the free Gemini API quota (15 requests/min / daily limit).
 * Ready to migrate to Supabase in Phase 5.
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const g = globalThis as unknown as {
  __stocklensRateLimits?: Map<string, RateLimitRecord>;
};

if (!g.__stocklensRateLimits) {
  g.__stocklensRateLimits = new Map();
}

const limits = g.__stocklensRateLimits;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetInSeconds: number;
}

/**
 * Checks and increments rate limit for a given device/client key.
 * Default: 15 requests per 10-minute window per device.
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 15,
  windowSeconds: number = 600
): RateLimitResult {
  const now = Date.now();
  const existing = limits.get(key);

  if (!existing || existing.resetAt <= now) {
    // New window
    limits.set(key, {
      count: 1,
      resetAt: now + windowSeconds * 1000,
    });
    return {
      allowed: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      resetInSeconds: windowSeconds,
    };
  }

  // Active window
  if (existing.count >= maxRequests) {
    const resetInSeconds = Math.max(1, Math.round((existing.resetAt - now) / 1000));
    return {
      allowed: false,
      limit: maxRequests,
      remaining: 0,
      resetInSeconds,
    };
  }

  existing.count += 1;
  const resetInSeconds = Math.max(1, Math.round((existing.resetAt - now) / 1000));
  return {
    allowed: true,
    limit: maxRequests,
    remaining: maxRequests - existing.count,
    resetInSeconds,
  };
}
