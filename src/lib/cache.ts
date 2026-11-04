/**
 * Pluggable Server-Side Cache Layer for StockLens.
 *
 * Current implementation: In-Memory TTL Cache (survives dev HMR via globalThis).
 * Phase 5 migration: Swap adapter to Supabase persistence via `setCacheAdapter()`
 * without altering any callers across the codebase.
 */

export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  cachedAt: number;
}

export interface CacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, data: T, ttlSeconds: number): Promise<void>;
  getInfo?(key: string): Promise<{ isCached: boolean; ttlRemaining?: number }>;
}

export const CACHE_TTL = {
  QUOTE: 120, // 2 minutes (quotes ~1-5 min)
  CANDLES: 900, // 15 minutes (candles & indicators)
  SEARCH: 3600, // 1 hour (symbol search)
  FUNDAMENTALS: 86400, // 24 hours (company profile, metrics, earnings)
  PROFILE: 86400, // 24 hours
  AI_ANALYSIS: 86400, // 24 hours (AI stock analysis)
  INVESTED_EARLIER: 86400, // 24 hours (What if I'd invested earlier)
} as const;

// In-Memory Adapter with globalThis retention
class InMemoryCacheAdapter implements CacheAdapter {
  private map: Map<string, CacheEntry<unknown>>;

  constructor() {
    const g = globalThis as unknown as { __stocklensCache?: Map<string, CacheEntry<unknown>> };
    if (!g.__stocklensCache) {
      g.__stocklensCache = new Map();
    }
    this.map = g.__stocklensCache;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.map.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.map.delete(key);
      return null;
    }
    return entry.data;
  }

  async set<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
    const now = Date.now();
    this.map.set(key, {
      data,
      expiresAt: now + ttlSeconds * 1000,
      cachedAt: now,
    });
  }

  async getInfo(key: string): Promise<{ isCached: boolean; ttlRemaining?: number }> {
    const entry = this.map.get(key);
    if (!entry) return { isCached: false };
    const remaining = Math.max(0, Math.round((entry.expiresAt - Date.now()) / 1000));
    return {
      isCached: remaining > 0,
      ttlRemaining: remaining,
    };
  }
}

// Active cache provider instance
let activeAdapter: CacheAdapter = new InMemoryCacheAdapter();

/**
 * Plugs in an external cache adapter (e.g., Supabase in Phase 5).
 */
export function setCacheAdapter(adapter: CacheAdapter): void {
  activeAdapter = adapter;
}

/**
 * Universal caching wrapper: fetches fresh data only on cache miss or expiration.
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = await activeAdapter.get<T>(key);
  if (cached !== null && cached !== undefined) {
    return cached;
  }

  const fresh = await fetcher();

  if (fresh !== null && fresh !== undefined) {
    await activeAdapter.set(key, fresh, ttlSeconds);
  }

  return fresh;
}

/**
 * Inspects cache status for debugging/telemetry.
 */
export async function getCacheInfo(key: string): Promise<{ isCached: boolean; ttlRemaining?: number }> {
  if (activeAdapter.getInfo) {
    return activeAdapter.getInfo(key);
  }
  return { isCached: false };
}
