import { getSupabaseAdmin } from "@/lib/supabase";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

// In-Memory Fallback Map (survives dev HMR via globalThis)
const gState = globalThis as unknown as {
  __stocklensRateLimits?: Map<string, { count: number; windowStart: number }>;
};

if (!gState.__stocklensRateLimits) {
  gState.__stocklensRateLimits = new Map();
}

const memoryLimits = gState.__stocklensRateLimits;

/**
 * Checks and increments a rate limit key using Supabase with automatic in-memory fallback.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const supabase = getSupabaseAdmin();
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  if (!supabase) {
    return checkMemoryRateLimit(key, limit, windowSeconds);
  }

  try {
    const { data: existing, error } = await supabase
      .from("rate_limits")
      .select("key, count, window_start")
      .eq("key", key)
      .maybeSingle();

    if (error || !existing) {
      // First hit in this window
      await supabase.from("rate_limits").upsert({
        key,
        count: 1,
        window_start: new Date(now).toISOString(),
      });
      return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
    }

    const windowStartMs = new Date(existing.window_start).getTime();
    const elapsed = now - windowStartMs;

    // Window expired: reset window
    if (elapsed >= windowMs) {
      await supabase.from("rate_limits").upsert({
        key,
        count: 1,
        window_start: new Date(now).toISOString(),
      });
      return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
    }

    // Within window: check limit
    if (existing.count < limit) {
      const nextCount = existing.count + 1;
      await supabase
        .from("rate_limits")
        .update({ count: nextCount })
        .eq("key", key);
      return {
        allowed: true,
        remaining: limit - nextCount,
        retryAfterSeconds: 0,
      };
    }

    // Exceeded
    const retryAfter = Math.max(1, Math.ceil((windowMs - elapsed) / 1000));
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: retryAfter,
    };
  } catch (err) {
    console.warn(`[RateLimit] Supabase error for ${key}, using memory:`, err);
    return checkMemoryRateLimit(key, limit, windowSeconds);
  }
}

function checkMemoryRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const entry = memoryLimits.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    memoryLimits.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (entry.count < limit) {
    entry.count += 1;
    return { allowed: true, remaining: limit - entry.count, retryAfterSeconds: 0 };
  }

  const retryAfter = Math.max(1, Math.ceil((windowMs - (now - entry.windowStart)) / 1000));
  return {
    allowed: false,
    remaining: 0,
    retryAfterSeconds: retryAfter,
  };
}

/**
 * Validates Gemini AI call spacing across global and per-device limits.
 */
export async function checkGeminiRateLimit(
  deviceId?: string | null
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  // Global limit: max 12 requests per 60 seconds across all users to protect 15/min free quota
  const globalCheck = await checkRateLimit("rl:global:gemini", 12, 60);
  if (!globalCheck.allowed) {
    return { allowed: false, retryAfterSeconds: globalCheck.retryAfterSeconds };
  }

  // Device limit if deviceId provided: max 4 requests per 60 seconds
  if (deviceId) {
    const deviceCheck = await checkRateLimit(`rl:device:${deviceId}:gemini`, 4, 60);
    if (!deviceCheck.allowed) {
      return { allowed: false, retryAfterSeconds: deviceCheck.retryAfterSeconds };
    }
  }

  return { allowed: true, retryAfterSeconds: 0 };
}
