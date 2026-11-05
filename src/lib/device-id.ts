/**
 * Client-side anonymous device identifier for StockLens.
 *
 * Generates and stores a unique UUID in localStorage to link watchlists and
 * recent chats without requiring a password or user account.
 */

export const DEVICE_ID_STORAGE_KEY = "stocklens_device_id_v1";

export const DEVICE_PRIVACY_NOTE =
  "Your saved stocks and chats are linked to this device. Clearing your browser history/storage or switching devices will start a fresh session.";

/**
 * Returns the current device UUID or creates a new random UUID if not found.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") {
    return "00000000-0000-0000-0000-000000000000";
  }

  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing)) {
      return existing.trim().toLowerCase();
    }

    const newId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : generateFallbackUUID();

    localStorage.setItem(DEVICE_ID_STORAGE_KEY, newId);
    return newId;
  } catch {
    return "00000000-0000-0000-0000-000000000000";
  }
}

function generateFallbackUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
