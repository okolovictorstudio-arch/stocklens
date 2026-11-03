"use client";

import * as React from "react";
import { Menu, Plus, TrendingUp, Sparkles } from "lucide-react";

interface MobileTopBarProps {
  onOpenDrawer: () => void;
  onNewChat: () => void;
  hamburgerRef: React.RefObject<HTMLButtonElement | null>;
  isDrawerOpen: boolean;
}

export function MobileTopBar({
  onOpenDrawer,
  onNewChat,
  hamburgerRef,
  isDrawerOpen,
}: MobileTopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border/80 bg-background/90 px-3 backdrop-blur-md lg:hidden pt-safe">
      {/* Left: Accessible Hamburger button (min 44x44px) */}
      <button
        ref={hamburgerRef}
        onClick={onOpenDrawer}
        aria-label="Open sidebar menu"
        aria-expanded={isDrawerOpen}
        aria-controls="app-sidebar"
        className="flex min-h-[44px] min-w-[44px] size-11 items-center justify-center rounded-xl text-foreground/80 hover:bg-muted active:scale-95 transition-all cursor-pointer"
      >
        <Menu className="size-5" />
      </button>

      {/* Center: Brand Logo (min 44px tap target) */}
      <button
        onClick={onNewChat}
        className="flex min-h-[44px] items-center gap-2.5 cursor-pointer px-2 py-1 rounded-xl hover:opacity-90 active:scale-98 transition-all"
        aria-label="StockLens Home - Start new chat"
      >
        <div className="flex size-8 items-center justify-center rounded-xl bg-foreground text-background shadow-xs">
          <TrendingUp className="size-4.5" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-base sm:text-lg tracking-tight text-foreground">
            StockLens
          </span>
          <span className="flex items-center gap-1 rounded-full border border-border bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
            <Sparkles className="size-2.5 text-sky-500" />
            AI
          </span>
        </div>
      </button>

      {/* Right: New Chat button (min 44x44px) */}
      <button
        onClick={onNewChat}
        aria-label="Start new chat"
        className="flex min-h-[44px] min-w-[44px] size-11 items-center justify-center rounded-xl text-foreground/80 hover:bg-muted active:scale-95 transition-all cursor-pointer"
        title="Start new chat"
      >
        <Plus className="size-5" />
      </button>
    </header>
  );
}
