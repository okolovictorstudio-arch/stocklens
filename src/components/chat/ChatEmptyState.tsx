"use client";

import * as React from "react";
import { Search, Loader2, Sparkles, AlertCircle, X } from "lucide-react";
import type { SearchResultItem } from "@/types/stock";

interface ChatEmptyStateProps {
  onSelectStock: (symbol: string, companyName: string) => void;
}

const POPULAR_STOCKS = [
  { name: "Apple", symbol: "AAPL", highlight: "iPhone and Mac" },
  { name: "Microsoft", symbol: "MSFT", highlight: "Windows and Office" },
  { name: "Nvidia", symbol: "NVDA", highlight: "AI chips" },
  { name: "Tesla", symbol: "TSLA", highlight: "Electric cars" },
  { name: "Amazon", symbol: "AMZN", highlight: "Online shopping" },
  { name: "Google", symbol: "GOOGL", highlight: "Search and Android" },
];

export function ChatEmptyState({ onSelectStock }: ChatEmptyStateProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(-1);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Debounced search
  React.useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setHasSearched(false);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
          setIsOpen(true);
        } else {
          setResults([]);
        }
      } catch (err) {
        console.error("Search error:", err);
        setResults([]);
      } finally {
        setIsLoading(false);
        setHasSearched(true);
        setSelectedIndex(-1);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside to close
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (symbol: string, companyName: string) => {
    setIsOpen(false);
    setQuery("");
    onSelectStock(symbol.toUpperCase(), companyName);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) {
      if (e.key === "Enter" && query.trim()) {
        e.preventDefault();
        handleSelect(query.trim(), query.trim());
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        const item = results[selectedIndex];
        handleSelect(item.symbol, item.description || item.symbol);
      } else if (query.trim()) {
        handleSelect(query.trim(), query.trim());
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className="flex flex-col items-center px-4 sm:px-6 pt-5 pb-8 sm:py-16 text-center max-w-2xl mx-auto w-full my-auto">
      {/* Calm Claude-style header */}
      <div className="space-y-3 mb-6 sm:mb-8">
        <div className="mx-auto flex size-12 sm:size-14 items-center justify-center rounded-2xl bg-foreground text-background shadow-xs">
          <Sparkles className="size-6 sm:size-7 text-sky-400" />
        </div>
        <h1
          className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground text-balance"
          style={{ textWrap: "balance" }}
        >
          Which stock do you want to understand?
        </h1>
        <p
          className="text-sm sm:text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto text-balance"
          style={{ textWrap: "balance" }}
        >
          Search any company or ticker. We&apos;ll explain the price, numbers, and trends in plain English—no Wall Street jargon.
        </p>
      </div>

      {/* Big Search Input with Autocomplete */}
      <div ref={containerRef} className="relative w-full max-w-xl text-left mb-6 sm:mb-8">
        <div className="relative flex items-center shadow-xs rounded-2xl border border-border/80 bg-card transition-all focus-within:ring-2 focus-within:ring-ring/40 focus-within:border-foreground/30">
          <Search className="absolute left-4 size-5 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => {
              const val = e.target.value;
              setQuery(val);
              if (!val.trim()) {
                setResults([]);
                setIsLoading(false);
                setHasSearched(false);
                setIsOpen(false);
              } else if (!isOpen) {
                setIsOpen(true);
              }
            }}
            onFocus={() => {
              if (query.trim() && results.length > 0) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search a company or ticker"
            className="w-full pl-12 pr-12 h-13 sm:h-14 bg-transparent text-base text-foreground placeholder:text-muted-foreground/70 outline-none rounded-2xl"
          />
          <div className="absolute right-2 flex items-center">
            {isLoading ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground mr-2" />
            ) : query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setResults([]);
                  setIsOpen(false);
                  inputRef.current?.focus();
                }}
                className="flex size-11 min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground hover:text-foreground rounded-xl transition-colors cursor-pointer"
                aria-label="Clear search input"
              >
                <X className="size-5" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Autocomplete Dropdown - Company name first, ticker second */}
        {isOpen && query.trim() && (
          <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-2xl border border-border bg-popover/98 backdrop-blur-md p-2 shadow-xl animate-in fade-in-0 zoom-in-95">
            {results.length > 0 ? (
              <ul className="max-h-72 overflow-y-auto space-y-1">
                {results.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <li key={item.symbol}>
                      <button
                        type="button"
                        onClick={() => handleSelect(item.symbol, item.description || item.symbol)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full flex min-h-[48px] items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-muted/70 text-foreground"
                        }`}
                      >
                        <div className="overflow-hidden">
                          {/* Company Name First */}
                          <div className="font-semibold text-foreground text-base truncate">
                            {item.description || item.symbol}
                          </div>
                          {/* Ticker Second */}
                          <div className="text-sm text-muted-foreground flex items-center gap-2 font-mono">
                            <span>{item.symbol}</span>
                            <span>•</span>
                            <span className="text-sm font-sans">US Common Stock</span>
                          </div>
                        </div>
                        <span className="text-sm font-mono text-muted-foreground/80 shrink-0 uppercase border border-border px-2 py-0.5 rounded-md">
                          {item.symbol}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : hasSearched && !isLoading ? (
              <div className="p-4 text-center">
                <div className="mx-auto flex size-9 items-center justify-center rounded-full bg-muted/60 text-muted-foreground mb-2">
                  <AlertCircle className="size-5" />
                </div>
                <p className="text-base font-medium text-foreground">
                  No US stocks found for &quot;{query}&quot;
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try typing the company name (like Apple) or ticker symbol (like AAPL).
                </p>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* 6 Popular Stock Chips (min 44x44px tap targets, 2 cols on mobile, 3 cols from md) */}
      <div className="w-full space-y-2.5 sm:space-y-3">
        <p className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Or tap a popular company to start:
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 w-full">
          {POPULAR_STOCKS.map((stock) => (
            <button
              key={stock.symbol}
              type="button"
              onClick={() => handleSelect(stock.symbol, stock.name)}
              className="flex min-h-[48px] sm:min-h-[56px] items-center justify-between gap-2 sm:gap-3 rounded-xl border border-border/80 bg-card px-3 sm:px-4 py-2.5 sm:py-3 text-left transition-all hover:border-foreground/30 hover:bg-muted/50 active:scale-[0.98] cursor-pointer shadow-2xs group"
            >
              <div className="overflow-hidden">
                <div className="font-semibold text-sm sm:text-base text-foreground group-hover:underline truncate">
                  {stock.name}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground truncate font-sans hidden sm:block">
                  {stock.highlight}
                </div>
              </div>
              <span className="text-xs sm:text-sm font-mono font-medium text-muted-foreground/80 shrink-0 bg-muted/80 px-1.5 sm:px-2 py-0.5 rounded-md">
                {stock.symbol}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
