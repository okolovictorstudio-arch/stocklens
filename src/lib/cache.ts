/**
 * Pluggable Server-Side Cache Layer for StockLens.
 *
 * Current implementation: In-Memory TTL Cache (survives dev HMR via globalThis).
 * Phase 5 migration: Swap adapter to Supabase persistence via `setCacheAdapter()`
 * without altering any callers across the codebase.
 */

import { getSupabaseAdmin } from "@/lib/supabase";

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
  COMPARE: 86400, // 24 hours (Stock comparison)
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

// Supabase-backed Cache Adapter with in-memory fallback
class SupabaseCacheAdapter implements CacheAdapter {
  private inMemoryFallback = new InMemoryCacheAdapter();
  private lastCleanupTime = 0;

  async get<T>(key: string): Promise<T | null> {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return this.inMemoryFallback.get<T>(key);
    }

    try {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("api_cache")
        .select("value, expires_at")
        .eq("key", key)
        .gt("expires_at", nowIso)
        .maybeSingle();

      if (error || !data) {
        return this.inMemoryFallback.get<T>(key);
      }

      const ttlRem = Math.max(1, Math.round((new Date(data.expires_at).getTime() - Date.now()) / 1000));
      await this.inMemoryFallback.set(key, data.value as T, ttlRem);

      this.triggerLazyCleanup(supabase);
      return data.value as T;
    } catch {
      return this.inMemoryFallback.get<T>(key);
    }
  }

  async set<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
    // Always mirror to in-memory for instant local availability
    await this.inMemoryFallback.set(key, data, ttlSeconds);

    const supabase = getSupabaseAdmin();
    if (!supabase) return;

    try {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
      await supabase.from("api_cache").upsert({
        key,
        value: data,
        expires_at: expiresAt,
      });
    } catch {
      // In-memory already saved, continue smoothly without user error
    }
  }

  async getInfo(key: string): Promise<{ isCached: boolean; ttlRemaining?: number }> {
    return this.inMemoryFallback.getInfo(key);
  }

  private triggerLazyCleanup(supabase: ReturnType<typeof getSupabaseAdmin>) {
    if (!supabase) return;
    const now = Date.now();
    if (now - this.lastCleanupTime < 10 * 60 * 1000) return; // at most once every 10 min
    this.lastCleanupTime = now;

    // Fire and forget asynchronous cleanup of expired cache entries
    Promise.resolve(
      supabase
        .from("api_cache")
        .delete()
        .lt("expires_at", new Date().toISOString())
    ).catch(() => {});
  }
}

// Active cache provider instance (Supabase with transparent memory fallback)
let activeAdapter: CacheAdapter = new SupabaseCacheAdapter();

/**
 * Plugs in an external cache adapter.
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
