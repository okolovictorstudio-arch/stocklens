"use client";

import * as React from "react";
import {
  Bookmark,
  Star,
  TrendingUp,
  TrendingDown,
  Sparkles,
  RefreshCw,
  Info,
  Building2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getOrCreateDeviceId, DEVICE_PRIVACY_NOTE } from "@/lib/device-id";
import type { DashboardStockCard } from "@/app/api/dashboard/route";

interface MarketDashboardProps {
  onSelectStock: (symbol: string, companyName: string) => void;
}

function MiniSparkline({ points, isPositive }: { points?: number[]; isPositive: boolean }) {
  if (!points || points.length < 2) {
    return (
      <div className="h-9 w-full flex items-center justify-center">
        <div className="h-0.5 w-full bg-border/60 rounded-full" />
      </div>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 120;
  const height = 36;

  const svgPoints = points
    .map((val, idx) => {
      const x = (idx / (points.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const strokeColor = isPositive ? "#10b981" : "#f43f5e";

  return (
    <div className="h-9 w-28 shrink-0">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full overflow-visible"
        preserveAspectRatio="none"
      >
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={svgPoints}
        />
      </svg>
    </div>
  );
}

export function MarketDashboard({ onSelectStock }: MarketDashboardProps) {
  const [watchlist, setWatchlist] = React.useState<DashboardStockCard[]>([]);
  const [popular, setPopular] = React.useState<DashboardStockCard[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let isCancelled = false;

    async function fetchDashboard() {
      if (reloadKey > 0) setIsRefreshing(true);
      const deviceId = getOrCreateDeviceId();

      try {
        const res = await fetch("/api/dashboard", {
          headers: {
            "x-device-id": deviceId,
          },
        });

        if (res.ok) {
          const json = await res.json();
          if (!isCancelled) {
            setWatchlist(json.watchlist || []);
            setPopular(json.popular || []);
          }
        }
      } catch (err) {
        console.warn("[MarketDashboard] Fetch error:", err);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    fetchDashboard();

    return () => {
      isCancelled = true;
    };
  }, [reloadKey]);

  const handleToggleWatchlist = async (e: React.MouseEvent, stock: DashboardStockCard) => {
    e.stopPropagation();
    const deviceId = getOrCreateDeviceId();
    const currentlyWatchlisted = stock.isWatchlisted;

    // Optimistic UI update
    setWatchlist((prev) =>
      currentlyWatchlisted
        ? prev.filter((s) => s.symbol !== stock.symbol)
        : [{ ...stock, isWatchlisted: true }, ...prev].slice(0, 10)
    );
    setPopular((prev) =>
      prev.map((s) => (s.symbol === stock.symbol ? { ...s, isWatchlisted: !currentlyWatchlisted } : s))
    );

    try {
      if (currentlyWatchlisted) {
        await fetch(`/api/watchlist?ticker=${encodeURIComponent(stock.symbol)}`, {
          method: "DELETE",
          headers: { "x-device-id": deviceId },
        });
      } else {
        await fetch("/api/watchlist", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-device-id": deviceId,
          },
          body: JSON.stringify({
            ticker: stock.symbol,
            companyName: stock.companyName,
          }),
        });
      }
      // Broadcast update event so the sidebar updates in real-time
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("stocklens_watchlist_updated"));
      }
    } catch (err) {
      console.warn("[MarketDashboard] Watchlist toggle error:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 space-y-8 animate-in fade-in-0">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48 rounded-lg" />
            <Skeleton className="h-4 w-72 rounded" />
          </div>
          <Skeleton className="size-10 rounded-xl" />
        </div>

        <div className="space-y-4">
          <Skeleton className="h-6 w-36 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <Skeleton className="h-6 w-36 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 space-y-8 overflow-x-hidden">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Building2 className="size-7 text-primary" />
            <span>Market Dashboard</span>
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Track your saved stocks and explore popular US companies. Tap any stock to open its full plain-language breakdown.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={isRefreshing}
          onClick={() => setReloadKey((k) => k + 1)}
          className="min-h-[44px] px-3.5 rounded-xl cursor-pointer gap-2 self-start sm:self-auto shrink-0 shadow-2xs"
        >
          <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
          <span>Refresh quotes</span>
        </Button>
      </div>

      {/* 1. Watchlist Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bookmark className="size-5 text-amber-500" />
            <h2 className="text-lg sm:text-xl font-bold text-foreground">
              Your Watchlist
            </h2>
            <Badge variant="secondary" className="text-xs font-mono ml-1">
              {watchlist.length}/10
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Max 10 pinned stocks
          </span>
        </div>

        {watchlist.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {watchlist.map((stock) => {
              const isPositive = stock.change >= 0;
              return (
                <Card
                  key={stock.symbol}
                  onClick={() => onSelectStock(stock.symbol, stock.companyName)}
                  className="group relative rounded-2xl border-border/80 bg-card p-4 sm:p-5 shadow-2xs hover:border-foreground/30 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="overflow-hidden">
                      <h3 className="font-bold text-base text-foreground truncate group-hover:text-primary transition-colors">
                        {stock.companyName}
                      </h3>
                      <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md inline-block mt-0.5">
                        {stock.symbol}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleToggleWatchlist(e, stock)}
                      aria-label={`Remove ${stock.symbol} from watchlist`}
                      className="flex size-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-amber-500 hover:bg-amber-500/10 transition-colors cursor-pointer -mr-2 -mt-2"
                      title="Remove from watchlist"
                    >
                      <Star className="size-5 fill-amber-500" />
                    </button>
                  </div>

                  <div className="flex items-end justify-between gap-2 pt-2 border-t border-border/50">
                    <div>
                      <div className="text-xl sm:text-2xl font-bold text-foreground font-sans tabular-nums">
                        ${stock.currentPrice.toFixed(2)}
                      </div>
                      <div
                        className={`flex items-center gap-1 text-xs sm:text-sm font-semibold font-sans tabular-nums ${
                          isPositive
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {isPositive ? (
                          <TrendingUp className="size-3.5 shrink-0" />
                        ) : (
                          <TrendingDown className="size-3.5 shrink-0" />
                        )}
                        <span>
                          {isPositive ? "+" : ""}
                          {stock.change.toFixed(2)} ({isPositive ? "+" : ""}
                          {stock.percentChange.toFixed(2)}%)
                        </span>
                      </div>
                    </div>

                    <MiniSparkline points={stock.sparkline} isPositive={isPositive} />
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/90 bg-muted/20 p-8 text-center space-y-2">
            <Bookmark className="mx-auto size-7 text-muted-foreground/50 mb-1" />
            <h3 className="text-base font-semibold text-foreground">No stocks pinned yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Search any company from the home chat or tap the star icon on any stock card to pin it to your dashboard.
            </p>
          </div>
        )}
      </section>

      {/* 2. Popular Stocks Section */}
      <section className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-sky-500" />
            <h2 className="text-lg sm:text-xl font-bold text-foreground">
              Popular Stocks
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">
            Cached market quotes
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {popular.map((stock) => {
            const isPositive = stock.change >= 0;
            const isSaved = stock.isWatchlisted;

            return (
              <Card
                key={stock.symbol}
                onClick={() => onSelectStock(stock.symbol, stock.companyName)}
                className="group relative rounded-2xl border-border/80 bg-card p-4 sm:p-5 shadow-2xs hover:border-foreground/30 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="overflow-hidden">
                    <h3 className="font-bold text-base text-foreground truncate group-hover:text-primary transition-colors">
                      {stock.companyName}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                        {stock.symbol}
                      </span>
                      {stock.description && (
                        <span className="text-xs text-muted-foreground truncate max-w-[130px]">
                          {stock.description}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleToggleWatchlist(e, stock)}
                    aria-label={isSaved ? "Remove from watchlist" : "Add to watchlist"}
                    className={`flex size-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl transition-colors cursor-pointer -mr-2 -mt-2 ${
                      isSaved
                        ? "text-amber-500 hover:bg-amber-500/10"
                        : "text-muted-foreground/60 hover:text-foreground hover:bg-muted"
                    }`}
                    title={isSaved ? "Remove from watchlist" : "Add to watchlist"}
                  >
                    <Star className={`size-5 ${isSaved ? "fill-amber-500" : ""}`} />
                  </button>
                </div>

                <div className="pt-2 border-t border-border/50 flex items-baseline justify-between gap-2">
                  <div className="text-xl sm:text-2xl font-bold text-foreground font-sans tabular-nums">
                    ${stock.currentPrice.toFixed(2)}
                  </div>
                  <div
                    className={`flex items-center gap-1 text-xs sm:text-sm font-semibold font-sans tabular-nums ${
                      isPositive
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {isPositive ? (
                      <TrendingUp className="size-3.5 shrink-0" />
                    ) : (
                      <TrendingDown className="size-3.5 shrink-0" />
                    )}
                    <span>
                      {isPositive ? "+" : ""}
                      {stock.percentChange.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Device Storage & Privacy Note */}
      <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 sm:p-5 flex items-start gap-3 text-xs sm:text-sm text-muted-foreground">
        <Info className="size-5 shrink-0 text-muted-foreground/80 mt-0.5" />
        <p className="leading-relaxed">
          {DEVICE_PRIVACY_NOTE}
        </p>
      </div>
    </div>
  );
}
