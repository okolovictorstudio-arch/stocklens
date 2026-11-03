"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, AlertCircle, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { SearchResultItem } from "@/types/stock";

interface StockSearchProps {
  isSearchEnabled?: boolean;
  className?: string;
  autoFocus?: boolean;
  onSelect?: () => void;
}

export function StockSearch({
  isSearchEnabled = true,
  className = "",
  autoFocus = false,
  onSelect,
}: StockSearchProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState<number>(-1);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Debounced fetch of symbol suggestions
  React.useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || !isSearchEnabled) {
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
  }, [query, isSearchEnabled]);

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

  const handleSelect = (symbol: string) => {
    setIsOpen(false);
    setQuery("");
    router.push(`/stock/${symbol.toUpperCase()}`);
    if (onSelect) onSelect();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) {
      if (e.key === "Enter" && query.trim()) {
        e.preventDefault();
        handleSelect(query.trim());
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
        handleSelect(results[selectedIndex].symbol);
      } else if (query.trim()) {
        handleSelect(query.trim());
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <Search className="absolute left-3 size-4 text-muted-foreground pointer-events-none" />
        <Input
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
          autoFocus={autoFocus}
          placeholder={
            isSearchEnabled
              ? "Search US ticker or company (e.g. AAPL, NVDA)..."
              : "Search disabled (add FINNHUB_API_KEY)"
          }
          disabled={!isSearchEnabled}
          className="w-full pl-9 pr-16 h-9 bg-muted/40 border-border/80 focus-visible:bg-background transition-colors text-sm rounded-lg"
        />
        <div className="absolute right-2.5 flex items-center gap-1.5">
          {isLoading ? (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          ) : query ? (
            <button
              onClick={() => {
                setQuery("");
                setResults([]);
                setIsOpen(false);
                inputRef.current?.focus();
              }}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          ) : (
            <kbd className="hidden lg:inline-flex h-5 items-center rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground shadow-2xs">
              /
            </kbd>
          )}
        </div>
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && query.trim() && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-xl border border-border bg-popover/95 backdrop-blur-md p-1.5 shadow-lg animate-in fade-in-0 zoom-in-95">
          {results.length > 0 ? (
            <ul className="max-h-80 overflow-y-auto space-y-0.5">
              {results.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <li key={item.symbol}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item.symbol)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                        isSelected ? "bg-accent text-accent-foreground" : "hover:bg-muted/70 text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="flex size-7 items-center justify-center rounded-md bg-muted font-mono font-semibold text-[11px] shrink-0 text-foreground">
                          {item.symbol.slice(0, 4)}
                        </div>
                        <div className="overflow-hidden">
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            <span>{item.symbol}</span>
                            <span className="text-[10px] font-normal text-muted-foreground uppercase border border-border/80 px-1 rounded">
                              US
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {item.description}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 capitalize">
                        {item.type || "Stock"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : hasSearched && !isLoading ? (
            <div className="p-4 text-center">
              <div className="mx-auto flex size-8 items-center justify-center rounded-full bg-muted/60 text-muted-foreground mb-2">
                <AlertCircle className="size-4" />
              </div>
              <p className="text-xs font-medium text-foreground">No US symbols found for &quot;{query}&quot;</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Finnhub free tier supports major US equities. Check the ticker spelling or try AAPL, NVDA, TSLA.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
