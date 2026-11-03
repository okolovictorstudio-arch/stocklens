import type { RecentChat } from "@/types/chat";

const STORAGE_KEY = "stocklens_recent_chats_v1";

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

export function saveRecentChat(symbol: string, companyName: string): RecentChat[] {
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
    ].slice(0, 15); // keep up to 15 recent chats

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function removeRecentChat(symbol: string): RecentChat[] {
  if (typeof window === "undefined") return [];
  try {
    const cleanSym = symbol.trim().toUpperCase();
    const updated = getRecentChats().filter((c) => c.symbol !== cleanSym);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}
