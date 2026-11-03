"use client";

import * as React from "react";
import { AlertCircle, RefreshCw, MessageCircleQuestion } from "lucide-react";
import { AtAGlanceCard } from "@/components/stock/AtAGlanceCard";
import { PriceChart } from "@/components/stock/PriceChart";
import { AIAnalysisCard } from "@/components/stock/AIAnalysisCard";
import { FundamentalsGrid } from "@/components/stock/FundamentalsGrid";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { StockDetailsResponse } from "@/app/api/stock/route";
import type { ChatActionType } from "@/types/chat";

interface StockOverviewMessageProps {
  symbol: string;
  companyName: string;
  onSelectQuestion?: (question: string, actionType?: ChatActionType) => void;
}

export const QUICK_QUESTIONS: Array<{
  text: string;
  actionType: ChatActionType;
}> = [
  { text: "Is this company doing well?", actionType: "follow_up" },
  { text: "Is the price high or low right now?", actionType: "follow_up" },
  { text: "How risky is it?", actionType: "follow_up" },
  { text: "What if I'd invested $100 earlier?", actionType: "invested_earlier" },
  { text: "Does it pay dividends?", actionType: "follow_up" },
  { text: "Compare with another stock", actionType: "compare" },
];

export function StockOverviewMessage({
  symbol,
  companyName,
  onSelectQuestion,
}: StockOverviewMessageProps) {
  const [data, setData] = React.useState<StockDetailsResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [retryCount, setRetryCount] = React.useState(0);

  React.useEffect(() => {
    let isCancelled = false;
    async function fetchStockDetails() {
      setIsLoading(true);
      setErrorMsg(null);

      try {
        const res = await fetch(`/api/stock?symbol=${encodeURIComponent(symbol)}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Unable to load data for ${symbol}.`);
        }

        const json: StockDetailsResponse = await res.json();
        if (!isCancelled) {
          setData(json);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error(`[StockOverviewMessage] Error:`, err);
          setErrorMsg(
            err instanceof Error
              ? err.message
              : "Unable to retrieve stock data right now. Please try again."
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchStockDetails();
    return () => {
      isCancelled = true;
    };
  }, [symbol, retryCount]);

  if (isLoading) {
    return (
      <div className="w-full space-y-4 animate-in fade-in-0 duration-300">
        {/* At-a-glance Skeleton */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <Skeleton className="h-7 w-48 rounded-lg" />
              <Skeleton className="h-4 w-32 rounded" />
            </div>
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        </div>

        {/* Chart Skeleton */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <div className="flex justify-between items-center">
            <Skeleton className="h-8 w-40 rounded-lg" />
            <Skeleton className="h-8 w-56 rounded-lg" />
          </div>
          <Skeleton className="h-[380px] w-full rounded-xl" />
        </div>

        {/* AI Analysis Skeleton */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <Skeleton className="h-6 w-52 rounded" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (errorMsg || !data || !data.quote) {
    return (
      <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 text-center space-y-4">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <AlertCircle className="size-6" />
        </div>
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-foreground">
            Data Temporarily Unavailable for {symbol}
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            {errorMsg || "We couldn't retrieve live market information for this stock. Please check the symbol or try again."}
          </p>
        </div>
        <Button
          onClick={() => setRetryCount((c) => c + 1)}
          variant="outline"
          className="min-h-[44px] px-4 gap-2 text-sm rounded-xl cursor-pointer"
        >
          <RefreshCw className="size-4" />
          <span>Try again</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* 1. At-A-Glance Card (Top of every stock answer) */}
      <AtAGlanceCard
        quote={data.quote}
        profile={data.profile}
        fundamentals={data.fundamentals}
        candles={data.candles}
      />

      {/* 2. Price Chart with Time Ranges & Hidden-By-Default Advanced Tools */}
      <PriceChart
        symbol={data.symbol}
        initialRange="1M"
        initialCandles={data.candles}
        basePrice={data.quote.currentPrice}
        initialErrorMessage={data.candlesErrorMessage}
      />

      {/* 3. Plain-Language AI Explanation */}
      <AIAnalysisCard symbol={data.symbol} />

      {/* 4. Quick-Question Chips / Buttons Under Explanation */}
      <div className="rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <MessageCircleQuestion className="size-4.5 text-primary" />
          <span>Quick questions about {data.profile?.name || companyName || data.symbol}</span>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {QUICK_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectQuestion?.(q.text, q.actionType)}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-border/80 bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted hover:border-foreground/30 active:scale-[0.98] transition-all cursor-pointer shadow-2xs"
            >
              {q.text}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Verified Fundamentals Grid with Beginner Analogies */}
      <FundamentalsGrid
        fundamentals={data.fundamentals}
        currentPrice={data.quote.currentPrice}
      />
    </div>
  );
}
