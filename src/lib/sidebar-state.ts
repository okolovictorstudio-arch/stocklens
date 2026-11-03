"use client";

import * as React from "react";

const STORAGE_KEY = "stocklens_sidebar_collapsed";
const EVENT_NAME = "stocklens_sidebar_updated";

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT_NAME, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT_NAME, callback);
  };
}

export function useSidebarCollapsed(): [boolean, () => void] {
  const isCollapsed = React.useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(STORAGE_KEY) === "true";
      } catch {
        return false;
      }
    },
    () => false
  );

  const toggle = React.useCallback(() => {
    try {
      const next = !isCollapsed;
      localStorage.setItem(STORAGE_KEY, String(next));
      window.dispatchEvent(new Event(EVENT_NAME));
    } catch {
      // ignore
    }
  }, [isCollapsed]);

  return [isCollapsed, toggle];
}
