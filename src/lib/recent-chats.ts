import type { RecentChat, ChatMessage } from "@/types/chat";
import { getOrCreateDeviceId } from "@/lib/device-id";

const STORAGE_KEY = "stocklens_recent_chats_v1";
const MIGRATED_KEY = "stocklens_migrated_chats_v1";

export function getRecentChats(): RecentChat[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getSavedChatMessages(symbol: string): ChatMessage[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`stocklens_chat_${symbol.trim().toUpperCase()}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function getMigratedTickers(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MIGRATED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function markTickersAsMigrated(tickers: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const current = new Set(getMigratedTickers());
    for (const t of tickers) {
      if (t) current.add(t.toUpperCase());
    }
    localStorage.setItem(MIGRATED_KEY, JSON.stringify(Array.from(current)));
  } catch {}
}

/**
 * Merges local and remote recent chats by ticker symbol.
 * Preserves existing local chats if remote list is empty, and prioritizes
 * newer timestamps when a ticker exists in both sources.
 */
export function mergeRecentChats(
  localList: RecentChat[],
  remoteList: RecentChat[]
): RecentChat[] {
  const map = new Map<string, RecentChat>();

  // 1. Add all local chats first
  for (const c of localList) {
    if (!c?.symbol) continue;
    const key = c.symbol.trim().toUpperCase();
    map.set(key, c);
  }

  // 2. Merge remote chats
  for (const r of remoteList) {
    if (!r?.symbol) continue;
    const key = r.symbol.trim().toUpperCase();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, r);
    } else {
      // Keep the record with the newer timestamp
      const newerTime = Math.max(existing.createdAt || 0, r.createdAt || 0);
      map.set(key, {
        id: r.id || existing.id,
        symbol: key,
        companyName: r.companyName || existing.companyName,
        createdAt: newerTime,
      });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 20);
}

/**
 * Synchronizes recent chats across Supabase and localStorage.
 * Performs a one-time migration of unmigrated local chats to Supabase.
 */
export async function syncAndMigrateChats(
  initialLocal?: RecentChat[]
): Promise<RecentChat[]> {
  const localChats = initialLocal && initialLocal.length > 0 ? initialLocal : getRecentChats();
  const deviceId = getOrCreateDeviceId();
  let remoteChats: RecentChat[] = [];
  let migratedCount = 0;

  try {
    const res = await fetch(`/api/chats?deviceId=${encodeURIComponent(deviceId)}`, {
      headers: { "x-device-id": deviceId },
    });

    if (res.ok) {
      const json = await res.json().catch(() => ({}));
      if (Array.isArray(json.chats)) {
        remoteChats = json.chats;
      }
    } else {
      console.warn(`[recent-chats] GET /api/chats returned HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn("[recent-chats] GET /api/chats network error, using local:", err);
  }

  // Merge both sources — NEVER replace localStorage with an empty remote list
  const merged = mergeRecentChats(localChats, remoteChats);

  // Update local storage with the merged dataset
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {}

  // Check which local chats need migration to Supabase
  const remoteSet = new Set(remoteChats.map((c) => c.symbol.toUpperCase()));
  const alreadyMigratedSet = new Set(getMigratedTickers());

  const unmigrated = localChats.filter(
    (c) => !remoteSet.has(c.symbol.toUpperCase()) && !alreadyMigratedSet.has(c.symbol.toUpperCase())
  );

  if (unmigrated.length > 0) {
    const migrationPayload = unmigrated.slice(0, 20).map((c) => {
      const messages = getSavedChatMessages(c.symbol) || undefined;
      return {
        symbol: c.symbol,
        companyName: c.companyName,
        createdAt: c.createdAt,
        messages,
      };
    });

    try {
      const migrateRes = await fetch("/api/chats/migrate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": deviceId,
        },
        body: JSON.stringify({
          deviceId,
          chats: migrationPayload,
        }),
      });

      if (migrateRes.ok) {
        const migJson = await migrateRes.json().catch(() => ({}));
        if (migJson.success && Array.isArray(migJson.tickers)) {
          markTickersAsMigrated(migJson.tickers);
          migratedCount = migJson.migratedCount ?? migJson.tickers.length;
        }
      } else {
        const errDetails = await migrateRes.json().catch(() => ({}));
        console.warn("[recent-chats] Migration request error:", migrateRes.status, errDetails);
      }
    } catch (migErr) {
      console.warn("[recent-chats] Migration network error:", migErr);
    }
  }

  // Dev-only console message showing counts from each source and migration total
  if (
    process.env.NODE_ENV === "development" ||
    (typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"))
  ) {
    console.log(
      `[StockLens Chats] Loaded: ${localChats.length} from localStorage, ${remoteChats.length} from Supabase. Migrated to Supabase: ${migratedCount}.`
    );
  }

  return merged;
}

export function saveRecentChat(
  symbol: string,
  companyName: string,
  messages?: ChatMessage[]
): RecentChat[] {
  if (typeof window === "undefined") return [];
  try {
    const cleanSym = symbol.trim().toUpperCase();
    const existing = getRecentChats().filter((c) => c.symbol !== cleanSym);
    const updated: RecentChat[] = [
      {
        id: `chat_${cleanSym}_${Date.now()}`,
        symbol: cleanSym,
        companyName,
        createdAt: Date.now(),
      },
      ...existing,
    ].slice(0, 20); // up to 20 recent chats

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    if (messages && messages.length > 0) {
      try {
        localStorage.setItem(`stocklens_chat_${cleanSym}`, JSON.stringify(messages));
      } catch {}
    }

    // Asynchronously sync with Supabase backend
    const deviceId = getOrCreateDeviceId();
    fetch("/api/chats", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-device-id": deviceId,
      },
      body: JSON.stringify({
        deviceId,
        symbol: cleanSym,
        companyName,
        messages,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.warn("[recent-chats] POST /api/chats failed:", res.status, errData);
        } else {
          markTickersAsMigrated([cleanSym]);
        }
        window.dispatchEvent(new Event("stocklens_recent_chats_updated"));
      })
      .catch((err) => {
        console.warn("[recent-chats] POST /api/chats network error:", err);
      });

    return updated;
  } catch {
    return [];
  }
}

export function removeRecentChat(symbol: string, id?: string): RecentChat[] {
  if (typeof window === "undefined") return [];
  try {
    const cleanSym = symbol.trim().toUpperCase();
    const updated = getRecentChats().filter((c) => c.symbol !== cleanSym);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    try {
      localStorage.removeItem(`stocklens_chat_${cleanSym}`);
    } catch {}

    try {
      const migrated = getMigratedTickers().filter((t) => t !== cleanSym);
      localStorage.setItem(MIGRATED_KEY, JSON.stringify(migrated));
    } catch {}

    // Asynchronously delete from Supabase backend
    const deviceId = getOrCreateDeviceId();
    const deleteUrl = id
      ? `/api/chats?id=${encodeURIComponent(id)}&deviceId=${encodeURIComponent(deviceId)}`
      : `/api/chats?symbol=${encodeURIComponent(cleanSym)}&deviceId=${encodeURIComponent(deviceId)}`;

    fetch(deleteUrl, {
      method: "DELETE",
      headers: {
        "x-device-id": deviceId,
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.warn("[recent-chats] DELETE /api/chats failed:", res.status, errData);
        }
        window.dispatchEvent(new Event("stocklens_recent_chats_updated"));
      })
      .catch((err) => {
        console.warn("[recent-chats] DELETE /api/chats network error:", err);
      });

    return updated;
  } catch {
    return [];
  }
}
