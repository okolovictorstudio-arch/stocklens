"use client";

import * as React from "react";
import Link from "next/link";
import { TrendingUp, Sparkles, Bookmark, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import { StockSearch } from "@/components/search/StockSearch";

interface NavbarProps {
  isSearchEnabled?: boolean;
}

export function Navbar({ isSearchEnabled = true }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        
        {/* Brand Logo */}
        <div className="flex items-center gap-6 shrink-0">
          <Link href="/" className="group flex items-center gap-2.5 transition-opacity hover:opacity-90">
            <div className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background shadow-xs transition-transform group-hover:scale-105">
              <TrendingUp className="size-4.5" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold tracking-tight text-base sm:text-lg">StockLens</span>
              <span className="flex items-center gap-0.5 rounded-full border border-border bg-muted/60 px-1.5 py-0.2 text-[10px] font-medium text-muted-foreground">
                <Sparkles className="size-2.5 text-sky-500" />
                AI
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-muted-foreground">
            <Link
              href="/"
              className="rounded-md px-3 py-1.5 transition-colors hover:text-foreground hover:bg-muted/50"
            >
              Dashboard
            </Link>
            <Link
              href="/#watchlist"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors hover:text-foreground hover:bg-muted/50"
            >
              <Bookmark className="size-3.5" />
              Watchlist
            </Link>
          </nav>
        </div>

        {/* Search Bar - Desktop */}
        <div className="hidden sm:block flex-1 max-w-md">
          <StockSearch isSearchEnabled={isSearchEnabled} />
        </div>

        {/* Actions & Theme Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden size-9"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="border-t border-border/60 bg-background px-4 py-4 md:hidden space-y-4">
          <StockSearch
            isSearchEnabled={isSearchEnabled}
            onSelect={() => setMobileMenuOpen(false)}
          />
          <div className="flex flex-col space-y-1 text-sm font-medium">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-md px-3 py-2 text-foreground hover:bg-muted"
            >
              Dashboard
            </Link>
            <Link
              href="/#watchlist"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-foreground hover:bg-muted"
            >
              <Bookmark className="size-4" />
              Watchlist
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
