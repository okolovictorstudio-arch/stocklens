"use client";

import * as React from "react";
import {
  Building2,
  TrendingUp,
  TrendingDown,
  Scale,
  Activity,
  Coins,
  Compass,
  HelpCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { StockQuote, StockProfile, StockFundamentals, CandleDataPoint } from "@/types/stock";
import { computeAtAGlanceOverview } from "@/lib/analytics";
import { cleanCompanyName } from "@/lib/utils";

interface AtAGlanceCardProps {
  quote: StockQuote;
  profile: StockProfile | null;
  fundamentals: StockFundamentals;
  candles: CandleDataPoint[];
}

export function AtAGlanceCard({
  quote,
  profile,
  fundamentals,
  candles,
}: AtAGlanceCardProps) {
  const isPositive = quote.change >= 0;
  const companyName = cleanCompanyName(profile?.name || quote.symbol);

  const overview = React.useMemo(() => {
    return computeAtAGlanceOverview({
      marketCapMillions: fundamentals.marketCap,
      currentPrice: quote.currentPrice,
      low52: fundamentals.week52Low,
      high52: fundamentals.week52High,
      candles,
      beta: fundamentals.beta,
      dividendYield: fundamentals.dividendYield,
    });
  }, [
    fundamentals.marketCap,
    quote.currentPrice,
    fundamentals.week52Low,
    fundamentals.week52High,
    candles,
    fundamentals.beta,
    fundamentals.dividendYield,
  ]);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xs space-y-5">
      {/* Top row: Company name first, ticker second, industry */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {companyName}
            </h2>
            <span className="font-mono text-sm font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
              {quote.symbol}
            </span>
          </div>

          <p className="mt-1 text-sm text-muted-foreground flex items-center gap-2">
            <Building2 className="size-4 shrink-0 text-muted-foreground/70" />
            <span>{profile?.finnhubIndustry || "US Equities"}</span>
            {profile?.exchange && (
              <>
                <span className="text-muted-foreground/40">•</span>
                <span>{profile.exchange}</span>
              </>
            )}
          </p>
        </div>

        {/* Current price and daily change */}
        <div className="flex flex-col sm:items-end">
          <div className="flex items-baseline gap-2.5 sm:text-right">
            <div className="text-2xl sm:text-3xl font-bold text-foreground font-sans tabular-nums">
              ${quote.currentPrice.toFixed(2)}
            </div>
            <div
              className={`flex items-center gap-1 text-sm sm:text-base font-semibold font-sans tabular-nums ${
                isPositive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {isPositive ? (
                <TrendingUp className="size-4 shrink-0" />
              ) : (
                <TrendingDown className="size-4 shrink-0" />
              )}
              <span>
                {isPositive ? "+" : ""}
                {quote.change.toFixed(2)} ({isPositive ? "+" : ""}
                {quote.percentChange.toFixed(2)}%)
              </span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 font-medium">
            {quote.marketStatus === "open" ? "Market open" : "Last closing price"}
          </div>
        </div>
      </div>

      {/* 4 Plain-Language At-A-Glance Metric Chips */}
      <div>
        <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <span>At a glance</span>
          <span className="text-sm font-normal lowercase tracking-normal text-muted-foreground/70">
            (essential facts in plain language)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Company Size */}
          <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-2 hover:border-foreground/20 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <Scale className="size-4 text-muted-foreground/70" />
                <span>Company size</span>
              </span>
              <Tooltip>
                <TooltipTrigger
                  aria-label="Explain company size"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-muted-foreground/60 hover:text-foreground cursor-pointer rounded-lg -mr-2 -mt-2"
                >
                  <HelpCircle className="size-4" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-sm">
                  <p className="font-semibold text-foreground">Market Size</p>
                  <p className="mt-1 text-muted-foreground leading-relaxed">
                    {overview.companySize.explanation}
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-base sm:text-lg font-bold text-foreground">
                {overview.companySize.label}
              </div>
              <span className="text-sm font-sans font-medium text-muted-foreground tabular-nums">
                {overview.companySize.formattedCap}
              </span>
            </div>
          </div>

          {/* 2. Current Price Position */}
          <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-2 hover:border-foreground/20 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <Compass className="size-4 text-muted-foreground/70" />
                <span>Yearly price range</span>
              </span>
              <Tooltip>
                <TooltipTrigger
                  aria-label="Explain yearly price range"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-muted-foreground/60 hover:text-foreground cursor-pointer rounded-lg -mr-2 -mt-2"
                >
                  <HelpCircle className="size-4" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-sm">
                  <p className="font-semibold text-foreground">52-Week Position</p>
                  <p className="mt-1 text-muted-foreground leading-relaxed">
                    {overview.pricePosition.explanation}
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="space-y-1.5">
              <div className="text-base sm:text-lg font-bold text-foreground">
                {overview.pricePosition.label}
              </div>
              {overview.pricePosition.positionPct !== null && (
                <div className="w-full bg-border/60 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(5, overview.pricePosition.positionPct))}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* 3. Ups and Downs (Volatility) */}
          <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-2 hover:border-foreground/20 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <Activity className="size-4 text-muted-foreground/70" />
                <span>Ups & downs</span>
              </span>
              <Tooltip>
                <TooltipTrigger
                  aria-label="Explain price volatility"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-muted-foreground/60 hover:text-foreground cursor-pointer rounded-lg -mr-2 -mt-2"
                >
                  <HelpCircle className="size-4" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-sm">
                  <p className="font-semibold text-foreground">Price Stability</p>
                  <p className="mt-1 text-muted-foreground leading-relaxed">
                    {overview.volatility.explanation}
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-base sm:text-lg font-bold text-foreground">
                {overview.volatility.label}
              </div>
              {overview.volatility.maxDrawdownPct !== null ? (
                <span className="text-sm font-sans font-medium text-muted-foreground tabular-nums">
                  -{overview.volatility.maxDrawdownPct}% dip
                </span>
              ) : overview.volatility.beta !== null ? (
                <span className="text-sm font-sans font-medium text-muted-foreground tabular-nums">
                  β {overview.volatility.beta.toFixed(2)}
                </span>
              ) : null}
            </div>
          </div>

          {/* 4. Pays Dividends */}
          <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-2 hover:border-foreground/20 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <Coins className="size-4 text-muted-foreground/70" />
                <span>Pays dividends?</span>
              </span>
              <Tooltip>
                <TooltipTrigger
                  aria-label="Explain dividend payouts"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-muted-foreground/60 hover:text-foreground cursor-pointer rounded-lg -mr-2 -mt-2"
                >
                  <HelpCircle className="size-4" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-sm">
                  <p className="font-semibold text-foreground">Dividend Cash Payout</p>
                  <p className="mt-1 text-muted-foreground leading-relaxed">
                    {overview.dividend.explanation}
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-base sm:text-lg font-bold text-foreground">
                {overview.dividend.label}
              </div>
              <Badge
                variant={overview.dividend.pays ? "default" : "secondary"}
                className="text-xs font-medium"
              >
                {overview.dividend.pays ? "Cash income" : "Growth focus"}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
