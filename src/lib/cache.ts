/**
 * In-memory server-side cache with TTL for external API calls.
 * This protects free-tier API quotas (Finnhub: 60 calls/min, Twelve Data: 8 calls/min).
 * Designed to be swapped to Supabase persistence in Phase 5.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  cachedAt: number;
}

// Attach to globalThis to survive Next.js development hot module reloads
const globalCache = globalThis as unknown as {
  __stocklensCache?: Map<string, CacheEntry<unknown>>;
};

if (!globalCache.__stocklensCache) {
  globalCache.__stocklensCache = new Map();
}

const cache = globalCache.__stocklensCache;

export const CACHE_TTL = {
  QUOTE: 120, // 2 minutes (quotes ~1-5 min)
  CANDLES: 900, // 15 minutes (candles ~15 min)
  SEARCH: 3600, // 1 hour (symbol search ~1 hour)
  PROFILE: 86400, // 24 hours (company profile)
  INDICATORS: 900, // 15 minutes
} as const;

/**
 * Executes the fetcher function only if the key is missing or expired in cache.
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const cached = cache.get(key) as CacheEntry<T> | undefined;

  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  // Fetch fresh data
  const data = await fetcher();

  // Only cache valid (truthy or non-empty) results
  if (data !== undefined && data !== null) {
    cache.set(key, {
      data,
      expiresAt: now + ttlSeconds * 1000,
      cachedAt: now,
    });
  }

  return data;
}

/**
 * Inspect or debug cache item status
 */
export function getCacheInfo(key: string): { isCached: boolean; ttlRemaining?: number } {
  const cached = cache.get(key);
  if (!cached) return { isCached: false };
  const remaining = Math.max(0, Math.round((cached.expiresAt - Date.now()) / 1000));
  return {
    isCached: remaining > 0,
    ttlRemaining: remaining,
  };
}
