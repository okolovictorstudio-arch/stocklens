"use client";

import * as React from "react";
import {
  Plus,
  LayoutDashboard,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Trash2,
  X,
  Sparkles,
} from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { removeRecentChat, syncAndMigrateChats } from "@/lib/recent-chats";
import { useSidebarCollapsed } from "@/lib/sidebar-state";
import { cleanCompanyName } from "@/lib/utils";
import { getOrCreateDeviceId } from "@/lib/device-id";
import type { RecentChat } from "@/types/chat";
import type { WatchlistItem } from "@/app/api/watchlist/route";

interface AppSidebarProps {
  isOpenOnMobile: boolean;
  onCloseMobile: () => void;
  onNewChat: () => void;
  onSelectStock: (symbol: string, companyName: string, chatId?: string) => void;
  onOpenDashboard?: () => void;
  isDashboardActive?: boolean;
  activeSymbol?: string;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}

function subscribeRecentChats(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener("stocklens_recent_chats_updated", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("stocklens_recent_chats_updated", callback);
  };
}

export function AppSidebar({
  isOpenOnMobile,
  onCloseMobile,
  onNewChat,
  onSelectStock,
  onOpenDashboard,
  isDashboardActive = false,
  activeSymbol,
  triggerRef,
}: AppSidebarProps) {
  const drawerRef = React.useRef<HTMLDivElement>(null);
  const [isCollapsed, toggleCollapsed] = useSidebarCollapsed();
  const [watchlistItems, setWatchlistItems] = React.useState<WatchlistItem[]>([]);

  // Hydration-safe subscription for recent chats (fallback)
  const recentChatsRaw = React.useSyncExternalStore(
    subscribeRecentChats,
    () => {
      try {
        return localStorage.getItem("stocklens_recent_chats_v1") || "[]";
      } catch {
        return "[]";
      }
    },
    () => "[]"
  );

  const localRecentChats = React.useMemo<RecentChat[]>(() => {
    try {
      const parsed = JSON.parse(recentChatsRaw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [recentChatsRaw]);

  const [mergedChats, setMergedChats] = React.useState<RecentChat[]>([]);

  // Sync Watchlist from Supabase / API
  React.useEffect(() => {
    let isCancelled = false;

    async function loadWatchlist() {
      try {
        const deviceId = getOrCreateDeviceId();
        const res = await fetch("/api/watchlist", {
          headers: { "x-device-id": deviceId },
        });
        if (res.ok) {
          const json = await res.json();
          if (!isCancelled && Array.isArray(json.items)) {
            setWatchlistItems(json.items);
          }
        }
      } catch (err) {
        console.warn("[AppSidebar] Watchlist load error:", err);
      }
    }

    loadWatchlist();

    const handleWatchlistUpdate = () => loadWatchlist();
    window.addEventListener("stocklens_watchlist_updated", handleWatchlistUpdate);

    return () => {
      isCancelled = true;
      window.removeEventListener("stocklens_watchlist_updated", handleWatchlistUpdate);
    };
  }, []);

  // Sync Recent Chats: merge Supabase and localStorage, and trigger one-time migration
  React.useEffect(() => {
    let isCancelled = false;

    async function loadChats() {
      try {
        const synced = await syncAndMigrateChats(localRecentChats);
        if (!isCancelled) {
          setMergedChats(synced);
        }
      } catch {
        if (!isCancelled) {
          setMergedChats(localRecentChats);
        }
      }
    }

    loadChats();

    const handleChatsUpdate = () => loadChats();
    window.addEventListener("stocklens_recent_chats_updated", handleChatsUpdate);

    return () => {
      isCancelled = true;
      window.removeEventListener("stocklens_recent_chats_updated", handleChatsUpdate);
    };
  }, [localRecentChats]);

  // Merge both sources — never replace localStorage chats with an empty remote list
  const activeRecentChats = mergedChats.length > 0 ? mergedChats : localRecentChats;

  const handleDeleteChat = (e: React.MouseEvent, sym: string, id?: string) => {
    e.stopPropagation();
    removeRecentChat(sym, id);
    setMergedChats((prev) => prev.filter((c) => c.symbol !== sym));
    window.dispatchEvent(new Event("stocklens_recent_chats_updated"));
  };

  const handleRemoveWatchlist = async (e: React.MouseEvent, ticker: string) => {
    e.stopPropagation();
    setWatchlistItems((prev) => prev.filter((i) => i.ticker !== ticker));
    try {
      const deviceId = getOrCreateDeviceId();
      await fetch(`/api/watchlist?ticker=${encodeURIComponent(ticker)}`, {
        method: "DELETE",
        headers: { "x-device-id": deviceId },
      });
      window.dispatchEvent(new Event("stocklens_watchlist_updated"));
    } catch (err) {
      console.warn("[AppSidebar] Watchlist delete error:", err);
    }
  };

  // Keyboard accessibility & focus trap for mobile drawer
  React.useEffect(() => {
    if (!isOpenOnMobile) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusableElements = drawerRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements && focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseMobile();
        triggerRef?.current?.focus();
        return;
      }

      if (e.key === "Tab" && focusableElements && focusableElements.length > 0) {
        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpenOnMobile, onCloseMobile, triggerRef]);

  const handleClose = () => {
    onCloseMobile();
    triggerRef?.current?.focus();
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isOpenOnMobile && (
        <div
          onClick={handleClose}
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar (Drawer on mobile, persistent collapsible on desktop >=1024px) */}
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal={isOpenOnMobile ? "true" : undefined}
        aria-label="Navigation Sidebar"
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200 ease-in-out ${
          isCollapsed ? "lg:w-16" : "lg:w-72"
        } ${
          isOpenOnMobile
            ? "w-80 max-w-[85vw] translate-x-0 shadow-2xl"
            : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Header: Logo, App Title, Mobile Close */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border/60 px-4">
          <div
            onClick={() => {
              onNewChat();
              if (isOpenOnMobile) handleClose();
            }}
            className="flex items-center gap-2.5 cursor-pointer select-none"
          >
            <div className="flex size-9 items-center justify-center rounded-xl bg-foreground text-background shadow-xs">
              <Sparkles className="size-4.5 text-sky-400" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="font-bold tracking-tight text-sidebar-foreground text-lg leading-none">
                  StockLens
                </span>
                <span className="text-xs text-sidebar-foreground/60 font-medium">
                  Financial AI for Everyone
                </span>
              </div>
            )}
          </div>

          {/* Mobile close button */}
          <button
            onClick={handleClose}
            aria-label="Close navigation sidebar"
            className="lg:hidden flex size-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Action: New Chat Button */}
        <div className="p-3">
          <button
            onClick={() => {
              onNewChat();
              if (isOpenOnMobile) handleClose();
            }}
            className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-base font-semibold transition-all cursor-pointer ${
              !activeSymbol && !isDashboardActive
                ? "bg-foreground text-background ring-2 ring-primary/20 shadow-sm"
                : "border border-sidebar-border bg-sidebar-accent/50 text-sidebar-foreground hover:bg-sidebar-accent"
            } ${isCollapsed ? "lg:px-0" : ""}`}
            title="Start a new chat"
          >
            <Plus className="size-5 shrink-0" />
            {!isCollapsed && <span>New chat</span>}
          </button>
        </div>

        {/* Scrollable Navigation Area */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
          {/* Main Navigation Tab: Dashboard */}
          <div className="space-y-1">
            <button
              onClick={() => {
                onOpenDashboard?.();
                if (isOpenOnMobile) handleClose();
              }}
              className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-base font-medium transition-colors cursor-pointer ${
                isDashboardActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              <LayoutDashboard className="size-5 shrink-0 text-primary" />
              {!isCollapsed && <span>Dashboard</span>}
            </button>
          </div>

          {/* Watchlist Section (Max 10 pinned stocks with cached quotes) */}
          <div className="space-y-2">
            {!isCollapsed && (
              <div className="flex items-center justify-between px-3 text-sm font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Bookmark className="size-3.5 text-amber-500" />
                  <span>Watchlist</span>
                </span>
                <span className="text-xs font-mono">{watchlistItems.length}/10</span>
              </div>
            )}

            {!isCollapsed ? (
              watchlistItems.length > 0 ? (
                <ul className="space-y-1">
                  {watchlistItems.map((item) => {
                    const isPositive = item.change >= 0;
                    return (
                      <li key={item.ticker}>
                        <div
                          className="group flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left transition-colors cursor-pointer hover:bg-sidebar-accent/50 text-sidebar-foreground/85"
                          title={`${item.companyName} (${item.ticker})`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onSelectStock(item.ticker, item.companyName);
                              if (isOpenOnMobile) handleClose();
                            }}
                            className="flex flex-1 items-center justify-between overflow-hidden text-left min-h-[44px] gap-2"
                          >
                            <div className="overflow-hidden">
                              <div className="text-sm font-semibold text-foreground truncate">
                                {item.companyName}
                              </div>
                              <span className="text-xs font-mono text-muted-foreground">
                                {item.ticker}
                              </span>
                            </div>

                            <div className="text-right shrink-0 font-sans tabular-nums text-xs">
                              <div className="font-bold text-foreground">
                                ${item.currentPrice.toFixed(2)}
                              </div>
                              <div
                                className={`font-semibold ${
                                  isPositive
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-rose-600 dark:text-rose-400"
                                }`}
                              >
                                {isPositive ? "+" : ""}
                                {item.percentChange.toFixed(2)}%
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleRemoveWatchlist(e, item.ticker)}
                            aria-label={`Remove ${item.ticker} from watchlist`}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg opacity-80 sm:opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all cursor-pointer shrink-0 -mr-2"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="rounded-xl border border-dashed border-sidebar-border/80 p-3 text-center">
                  <Bookmark className="mx-auto size-5 text-sidebar-foreground/40 mb-1" />
                  <p className="text-xs text-sidebar-foreground/70 font-medium">
                    No stocks saved yet
                  </p>
                  <p className="text-[11px] text-sidebar-foreground/50 mt-0.5">
                    Click the star on any stock to pin it.
                  </p>
                </div>
              )
            ) : (
              <div className="flex justify-center py-2" title="Watchlist">
                <Bookmark className="size-5 text-sidebar-foreground/50" />
              </div>
            )}
          </div>

          {/* Recent Chats Section (Max 20 per device) */}
          <div className="space-y-2">
            {!isCollapsed && (
              <div className="px-3 text-sm font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
                <span>Recent Chats</span>
              </div>
            )}

            {activeRecentChats.length > 0 ? (
              <ul className="space-y-1">
                {activeRecentChats.map((chat) => {
                  const isActive = activeSymbol === chat.symbol && !isDashboardActive;
                  return (
                    <li key={chat.symbol}>
                      <div
                        className={`group flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left transition-colors cursor-pointer ${
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        }`}
                        title={`${chat.companyName} (${chat.symbol})`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onSelectStock(chat.symbol, chat.companyName, chat.id);
                            if (isOpenOnMobile) handleClose();
                          }}
                          className="flex flex-1 items-center gap-3 overflow-hidden text-left min-h-[44px]"
                        >
                          <MessageSquare className="size-4.5 shrink-0 opacity-70" />
                          {!isCollapsed && (
                            <span className="truncate text-sm font-medium">
                              {cleanCompanyName(chat.companyName || chat.symbol)}
                            </span>
                          )}
                        </button>

                        {!isCollapsed && (
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-mono opacity-70">
                              {chat.symbol}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteChat(e, chat.symbol, chat.id)}
                              aria-label={`Remove ${chat.symbol} from recent chats`}
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg opacity-80 sm:opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all cursor-pointer"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              !isCollapsed && (
                <p className="px-3 text-sm text-sidebar-foreground/50 italic py-1">
                  No recent chats yet
                </p>
              )
            )}
          </div>
        </div>

        {/* Footer: Theme Toggle & Desktop Collapse Button */}
        <div className="flex h-16 items-center justify-between border-t border-sidebar-border/60 px-3 pb-safe">
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {!isCollapsed && (
              <span className="text-sm text-sidebar-foreground/70 hidden lg:inline">
                Theme
              </span>
            )}
          </div>

          {/* Desktop-only Collapse Toggle Button */}
          <button
            onClick={toggleCollapsed}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden lg:flex min-h-[44px] min-w-[44px] size-11 items-center justify-center rounded-xl text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors cursor-pointer"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="size-5" />
            ) : (
              <ChevronLeft className="size-5" />
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
