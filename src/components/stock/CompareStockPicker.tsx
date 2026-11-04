"use client";

import * as React from "react";
import { Search, Loader2, AlertCircle, X, Scale } from "lucide-react";
import { cleanCompanyName } from "@/lib/utils";
import type { SearchResultItem } from "@/types/stock";

interface CompareStockPickerProps {
  baseSymbol: string;
  baseCompanyName: string;
  onSelectTarget: (symbol: string, companyName: string) => void;
  onCancel?: () => void;
}

const POPULAR_COMPARE_OPTIONS = [
  { name: "Apple", symbol: "AAPL" },
  { name: "Microsoft", symbol: "MSFT" },
  { name: "Nvidia", symbol: "NVDA" },
  { name: "Tesla", symbol: "TSLA" },
  { name: "Amazon", symbol: "AMZN" },
  { name: "Google", symbol: "GOOGL" },
  { name: "Meta Platforms", symbol: "META" },
];

export function CompareStockPicker({
  baseSymbol,
  baseCompanyName,
  onSelectTarget,
  onCancel,
}: CompareStockPickerProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [sameStockWarning, setSameStockWarning] = React.useState<string | null>(null);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const cleanBaseName = cleanCompanyName(baseCompanyName || baseSymbol);

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
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside closes autocomplete
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePickStock = (symbol: string, companyName: string) => {
    const cleanSym = symbol.trim().toUpperCase();
    if (cleanSym === baseSymbol.toUpperCase()) {
      setSameStockWarning(`Please choose a different stock to compare with ${cleanBaseName}.`);
      return;
    }

    setSameStockWarning(null);
    setIsOpen(false);
    onSelectTarget(cleanSym, cleanCompanyName(companyName || cleanSym));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim().toUpperCase();
    if (!trimmed) return;

    if (trimmed === baseSymbol.toUpperCase()) {
      setSameStockWarning(`Please choose a different stock to compare with ${cleanBaseName}.`);
      return;
    }

    if (results.length > 0) {
      const topMatch = results[0];
      handlePickStock(topMatch.symbol, topMatch.description || topMatch.symbol);
    } else {
      handlePickStock(trimmed, trimmed);
    }
  };

  const popularCandidates = POPULAR_COMPARE_OPTIONS.filter(
    (item) => item.symbol !== baseSymbol.toUpperCase()
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xs space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Scale className="size-4 text-primary" />
            <span>Stock Comparison</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
            Compare {cleanBaseName} with another stock
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Search any company or ticker to see normalized performance, sizes, and plain-language trade-offs side by side.
          </p>
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel comparison"
            className="flex size-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer shrink-0"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      {/* Friendly Same-Stock Warning */}
      {sameStockWarning && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs sm:text-sm text-amber-900 dark:text-amber-200 animate-in fade-in-0">
          <AlertCircle className="size-4.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>{sameStockWarning}</span>
        </div>
      )}

      {/* Search Bar with Autocomplete */}
      <div ref={containerRef} className="relative w-full">
        <form onSubmit={handleFormSubmit} className="relative flex items-center">
          <Search className="absolute left-3.5 size-4.5 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => {
              const val = e.target.value;
              setQuery(val);
              setSameStockWarning(null);
              if (!val.trim()) {
                setResults([]);
                setIsLoading(false);
                setIsOpen(false);
              } else if (!isOpen) {
                setIsOpen(true);
              }
            }}
            onFocus={() => {
              if (query.trim() && results.length > 0) setIsOpen(true);
            }}
            placeholder="Type a company name or ticker (e.g. Microsoft or MSFT)"
            className="w-full h-12 pl-11 pr-11 rounded-xl border border-border/80 bg-muted/30 text-sm sm:text-base text-foreground placeholder:text-muted-foreground/70 outline-none focus:border-foreground/30 focus:ring-2 focus:ring-ring/30 transition-all"
          />
          {isLoading && (
            <div className="absolute right-3.5 flex items-center pointer-events-none">
              <Loader2 className="size-4.5 animate-spin text-muted-foreground" />
            </div>
          )}
        </form>

        {/* Autocomplete Dropdown */}
        {isOpen && query.trim() && (
          <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-2xl border border-border bg-popover/98 backdrop-blur-md p-2 shadow-xl animate-in fade-in-0 zoom-in-95">
            {results.length > 0 ? (
              <ul className="max-h-60 overflow-y-auto space-y-1">
                {results.map((item) => {
                  const isSame = item.symbol.toUpperCase() === baseSymbol.toUpperCase();
                  const cleanName = cleanCompanyName(item.description || item.symbol);
                  return (
                    <li key={item.symbol}>
                      <button
                        type="button"
                        onClick={() => handlePickStock(item.symbol, cleanName)}
                        className={`w-full flex min-h-[44px] items-center justify-between gap-3 px-3.5 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                          isSame
                            ? "opacity-50 hover:bg-transparent cursor-not-allowed"
                            : "hover:bg-muted text-foreground"
                        }`}
                      >
                        <div className="overflow-hidden">
                          <div className="font-semibold text-sm sm:text-base text-foreground truncate">
                            {cleanName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.symbol} • US Common Stock
                          </div>
                        </div>
                        <span className="text-xs font-mono text-muted-foreground/80 shrink-0 border border-border px-2 py-0.5 rounded-md">
                          {item.symbol}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : hasSearched && !isLoading ? (
              <div className="p-3 text-center text-xs sm:text-sm text-muted-foreground">
                No matching US stocks found for &quot;{query}&quot;. Try typing a ticker symbol.
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Popular Stock Chips */}
      <div className="space-y-2 pt-1">
        <span className="text-xs font-medium text-muted-foreground">
          Popular comparisons:
        </span>
        <div className="flex flex-wrap gap-2">
          {popularCandidates.map((cand) => (
            <button
              key={cand.symbol}
              type="button"
              onClick={() => handlePickStock(cand.symbol, cand.name)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border/80 bg-background px-3.5 py-2 text-xs sm:text-sm font-medium text-foreground hover:bg-muted hover:border-foreground/30 active:scale-[0.98] transition-all cursor-pointer shadow-2xs"
            >
              <span className="font-semibold">{cand.name}</span>
              <span className="text-xs text-muted-foreground font-mono">({cand.symbol})</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
