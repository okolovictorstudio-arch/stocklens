"use client";

import * as React from "react";
import {
  TrendingUp,
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
import { removeRecentChat } from "@/lib/recent-chats";
import { useSidebarCollapsed } from "@/lib/sidebar-state";
import type { RecentChat } from "@/types/chat";

interface AppSidebarProps {
  isOpenOnMobile: boolean;
  onCloseMobile: () => void;
  onNewChat: () => void;
  onSelectStock: (symbol: string, companyName: string) => void;
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
  activeSymbol,
  triggerRef,
}: AppSidebarProps) {
  const drawerRef = React.useRef<HTMLDivElement>(null);
  const [isCollapsed, toggleCollapsed] = useSidebarCollapsed();

  // Hydration-safe subscription for recent chats
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

  const recentChats = React.useMemo<RecentChat[]>(() => {
    try {
      const parsed = JSON.parse(recentChatsRaw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [recentChatsRaw]);

  const handleDeleteChat = (e: React.MouseEvent, sym: string) => {
    e.stopPropagation();
    removeRecentChat(sym);
    window.dispatchEvent(new Event("stocklens_recent_chats_updated"));
  };

  // Keyboard accessibility & focus trap for mobile drawer
  React.useEffect(() => {
    if (!isOpenOnMobile) return;

    // Lock page scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus the first focusable element inside drawer
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

      // Tab trap
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

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpenOnMobile, onCloseMobile, triggerRef]);

  // Handle mobile drawer close and return focus
  const handleClose = () => {
    onCloseMobile();
    triggerRef?.current?.focus();
  };

  return (
    <>
      {/* Mobile/Tablet Dimmed Overlay */}
      {isOpenOnMobile && (
        <div
          onClick={handleClose}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity duration-200 lg:hidden"
        />
      )}

      {/* Sidebar Container: Drawer on mobile/tablet, Fixed on desktop */}
      <aside
        id="app-sidebar"
        ref={drawerRef}
        aria-label="Application Sidebar"
        aria-hidden={!isOpenOnMobile && typeof window !== "undefined" && window.innerWidth < 1024}
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col border-r border-border/80 bg-sidebar text-sidebar-foreground transition-all duration-200 ease-in-out pl-safe
          ${
            isOpenOnMobile
              ? "translate-x-0 w-72 sm:w-80 shadow-2xl"
              : "-translate-x-full lg:translate-x-0"
          }
          ${isCollapsed ? "lg:w-16" : "lg:w-72"}
        `}
      >
        {/* Top Header: Brand + Close/Toggle */}
        <div className="flex h-16 items-center justify-between px-3 border-b border-sidebar-border/60">
          <button
            type="button"
            onClick={() => {
              onNewChat();
              if (isOpenOnMobile) handleClose();
            }}
            className="flex min-h-[44px] items-center gap-2.5 cursor-pointer overflow-hidden p-1.5 rounded-xl hover:bg-sidebar-accent/50 transition-colors text-left"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-foreground text-background shadow-xs">
              <TrendingUp className="size-5" />
            </div>
            {!isCollapsed && (
              <div className="flex items-center gap-2 truncate">
                <span className="font-semibold tracking-tight text-lg text-sidebar-foreground">
                  StockLens
                </span>
                <span className="flex items-center gap-1 rounded-full border border-sidebar-border bg-sidebar-accent px-2 py-0.5 text-xs font-medium text-sidebar-foreground/80">
                  <Sparkles className="size-3 text-sky-500" />
                  AI
                </span>
              </div>
            )}
          </button>

          {/* Close button for Mobile/Tablet */}
          <button
            onClick={handleClose}
            aria-label="Close menu drawer"
            className="flex size-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground lg:hidden cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Action: New Chat Button (min 44px tap target, highlighted on empty home screen) */}
        <div className="p-3">
          <button
            onClick={() => {
              onNewChat();
              if (isOpenOnMobile) handleClose();
            }}
            className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-base font-semibold shadow-xs transition-all cursor-pointer ${
              !activeSymbol
                ? "bg-foreground text-background ring-2 ring-primary/20 shadow-sm"
                : "border border-sidebar-border bg-sidebar-accent/50 text-sidebar-foreground hover:bg-sidebar-accent"
            } ${
              isCollapsed ? "lg:px-0" : ""
            }`}
            title="Start a new chat"
          >
            <Plus className="size-5 shrink-0" />
            {!isCollapsed && <span>New chat</span>}
          </button>
        </div>

        {/* Scrollable Navigation Area */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
          {/* Main Navigation Tab */}
          <div className="space-y-1">
            <button
              onClick={() => {
                onNewChat();
                if (isOpenOnMobile) handleClose();
              }}
              className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-base font-medium transition-colors cursor-pointer text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            >
              <LayoutDashboard className="size-5 shrink-0" />
              {!isCollapsed && <span>Dashboard</span>}
            </button>
          </div>

          {/* Watchlist Section */}
          <div className="space-y-2">
            {!isCollapsed && (
              <div className="flex items-center justify-between px-3 text-sm font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
                <span>Watchlist</span>
              </div>
            )}
            {!isCollapsed ? (
              <div className="rounded-xl border border-dashed border-sidebar-border/80 p-3.5 text-center">
                <Bookmark className="mx-auto size-5 text-sidebar-foreground/40 mb-1.5" />
                <p className="text-sm text-sidebar-foreground/70 font-medium leading-snug">
                  No stocks saved yet
                </p>
                <p className="text-sm text-sidebar-foreground/50 mt-1">
                  Search any stock to add it.
                </p>
              </div>
            ) : (
              <div className="flex justify-center py-2" title="Watchlist">
                <Bookmark className="size-5 text-sidebar-foreground/50" />
              </div>
            )}
          </div>

          {/* Recent Chats Section */}
          <div className="space-y-2">
            {!isCollapsed && (
              <div className="px-3 text-sm font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
                <span>Recent Chats</span>
              </div>
            )}

            {recentChats.length > 0 ? (
              <ul className="space-y-1">
                {recentChats.map((chat) => {
                  const isActive = activeSymbol === chat.symbol;
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
                            onSelectStock(chat.symbol, chat.companyName);
                            if (isOpenOnMobile) handleClose();
                          }}
                          className="flex flex-1 items-center gap-3 overflow-hidden text-left min-h-[44px]"
                        >
                          <MessageSquare className="size-4.5 shrink-0 opacity-70" />
                          {!isCollapsed && (
                            <span className="truncate text-sm font-medium">
                              {chat.companyName}
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
                              onClick={(e) => handleDeleteChat(e, chat.symbol)}
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
