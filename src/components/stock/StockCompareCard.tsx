"use client";

import * as React from "react";
import {
  Scale,
  TrendingUp,
  TrendingDown,
  Sparkles,
  RefreshCw,
  Coins,
  Activity,
  Compass,
  AlertCircle,
  Clock,
  ArrowRightLeft,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NormalizedCompareChart } from "@/components/stock/NormalizedCompareChart";
import { CompareStockPicker } from "@/components/stock/CompareStockPicker";
import type { StockCompareMetrics, NormalizedComparisonResult } from "@/lib/analytics";
import type { StockCompareAIResponse } from "@/types/analysis";

interface StockCompareCardProps {
  baseSymbol: string;
  baseCompanyName: string;
  initialTargetSymbol?: string;
  initialTargetCompanyName?: string;
}

interface CompareDataResponse {
  stockA: StockCompareMetrics;
  stockB: StockCompareMetrics;
  normalized: Record<"1Y" | "3Y" | "5Y", NormalizedComparisonResult>;
}

interface CompareAIResponsePayload {
  aiComparison: StockCompareAIResponse;
  isQuickComparison?: boolean;
  errorType?: string;
}

export function StockCompareCard({
  baseSymbol,
  baseCompanyName,
  initialTargetSymbol,
}: StockCompareCardProps) {
  const [targetSymbol, setTargetSymbol] = React.useState<string | null>(
    initialTargetSymbol || null
  );
  const [isPickingTarget, setIsPickingTarget] = React.useState<boolean>(
    !initialTargetSymbol
  );

  const [data, setData] = React.useState<CompareDataResponse | null>(null);
  const [aiData, setAiData] = React.useState<CompareAIResponsePayload | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [isAiLoading, setIsAiLoading] = React.useState<boolean>(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [retryKey, setRetryKey] = React.useState<number>(0);

  // 1. Fetch side-by-side data and normalized chart data (computed in code)
  React.useEffect(() => {
    if (!targetSymbol) return;
    const currentTarget = targetSymbol;

    let isCancelled = false;

    async function fetchComparisonData() {
      setIsLoading(true);
      setErrorMsg(null);
      setData(null);
      setAiData(null);

      try {
        const url = `/api/compare?base=${encodeURIComponent(baseSymbol)}&target=${encodeURIComponent(currentTarget)}`;
        const res = await fetch(url);

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Unable to load comparison for ${currentTarget}.`);
        }

        const json: CompareDataResponse = await res.json();
        if (!isCancelled) {
          setData(json);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          console.error("[StockCompareCard] Error fetching comparison:", err);
          setErrorMsg(
            err instanceof Error
              ? err.message
              : "We couldn't retrieve market data for this comparison. Please try again."
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchComparisonData();

    return () => {
      isCancelled = true;
    };
  }, [baseSymbol, targetSymbol, retryKey]);

  // 2. Fetch AI comparison narrative strictly AFTER numbers have rendered
  React.useEffect(() => {
    if (!data || !targetSymbol) return;
    const currentData = data;

    let isCancelled = false;

    async function fetchAIComparison() {
      setIsAiLoading(true);
      try {
        const res = await fetch("/api/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbolA: currentData.stockA.symbol,
            symbolB: currentData.stockB.symbol,
            stockA: currentData.stockA,
            stockB: currentData.stockB,
          }),
        });

        if (res.ok) {
          const json: CompareAIResponsePayload = await res.json();
          if (!isCancelled) {
            setAiData(json);
          }
        }
      } catch (err) {
        console.warn("[StockCompareCard] AI comparison fetch failed:", err);
      } finally {
        if (!isCancelled) {
          setIsAiLoading(false);
        }
      }
    }

    fetchAIComparison();

    return () => {
      isCancelled = true;
    };
  }, [data, targetSymbol]);

  // If in picker mode or no target selected yet, show inline picker
  if (isPickingTarget || !targetSymbol) {
    return (
      <CompareStockPicker
        baseSymbol={baseSymbol}
        baseCompanyName={baseCompanyName}
        onSelectTarget={(sym) => {
          setTargetSymbol(sym);
          setIsPickingTarget(false);
        }}
        onCancel={targetSymbol ? () => setIsPickingTarget(false) : undefined}
      />
    );
  }

  // Loading skeleton while initial data loads
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xs space-y-4 animate-in fade-in-0">
        <div className="flex justify-between items-center">
          <Skeleton className="h-7 w-60 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  // Error state for comparison fetch
  if (errorMsg || !data) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 text-center space-y-4">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <AlertCircle className="size-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base sm:text-lg font-semibold text-foreground">
            Comparison Unavailable
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            {errorMsg || "Unable to load comparison numbers right now."}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <Button
            onClick={() => setRetryKey((k) => k + 1)}
            variant="outline"
            className="min-h-[44px] px-4 gap-2 text-sm rounded-xl cursor-pointer"
          >
            <RefreshCw className="size-4" />
            <span>Try again</span>
          </Button>
          <Button
            onClick={() => setIsPickingTarget(true)}
            variant="secondary"
            className="min-h-[44px] px-4 gap-2 text-sm rounded-xl cursor-pointer"
          >
            <ArrowRightLeft className="size-4" />
            <span>Pick a different stock</span>
          </Button>
        </div>
      </div>
    );
  }

  const { stockA, stockB, normalized } = data;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xs space-y-6">
      {/* Top Header: Comparing Stock A vs Stock B + Change Target Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Scale className="size-4 text-primary" />
            <span>Side-by-Side Stock Comparison</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex flex-wrap items-center gap-2">
            <span>{stockA.companyName}</span>
            <span className="text-muted-foreground font-normal text-base sm:text-lg">vs</span>
            <span>{stockB.companyName}</span>
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setIsPickingTarget(true)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border/80 bg-background px-3.5 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer self-start sm:self-auto shrink-0 shadow-2xs"
          title="Compare with another company"
        >
          <ArrowRightLeft className="size-4 text-muted-foreground" />
          <span>Change stock</span>
        </button>
      </div>

      {/* Side-by-side Cards: Stacks under 640px, side by side from tablet up */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Card 1: Stock A */}
        <Card className="rounded-2xl border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5 space-y-4">
          <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-emerald-500" />
                <h3 className="font-bold text-lg sm:text-xl text-foreground">
                  {stockA.companyName}
                </h3>
              </div>
              <span className="font-mono text-xs text-muted-foreground font-medium bg-background/60 px-2 py-0.5 rounded-md mt-1 inline-block">
                {stockA.symbol}
              </span>
            </div>

            {/* Current Price */}
            <div className="text-right">
              <div className="text-xl sm:text-2xl font-bold text-foreground font-sans tabular-nums">
                ${stockA.currentPrice.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground font-medium">
                {stockA.marketStatus === "open" ? "Market open" : "Last closing price"}
              </div>
            </div>
          </div>

          {/* Key Metric Rows */}
          <div className="space-y-2.5 text-sm">
            {/* 1-Year Return */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">1-Year Return:</span>
              {stockA.return1Y !== null ? (
                <span
                  className={`font-bold font-sans tabular-nums flex items-center gap-1 ${
                    stockA.return1Y >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {stockA.return1Y >= 0 ? (
                    <TrendingUp className="size-3.5" />
                  ) : (
                    <TrendingDown className="size-3.5" />
                  )}
                  {stockA.return1Y >= 0 ? "+" : ""}
                  {stockA.return1Y}%
                </span>
              ) : (
                <span className="text-muted-foreground">--</span>
              )}
            </div>

            {/* Company Size */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Company Size:</span>
              <span className="font-semibold text-foreground text-right font-sans">
                {stockA.companySizeWords}
              </span>
            </div>

            {/* Dividends */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Coins className="size-3.5 text-muted-foreground/70" />
                <span>Dividends:</span>
              </span>
              <span className="font-semibold text-foreground text-right font-sans">
                {stockA.dividendLabel}
              </span>
            </div>

            {/* Ups & Downs */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Activity className="size-3.5 text-muted-foreground/70" />
                <span>Ups & Downs:</span>
              </span>
              <span className="font-semibold text-foreground text-right font-sans">
                {stockA.upsAndDownsLabel}
                {stockA.beta !== null && (
                  <span className="text-muted-foreground font-normal ml-1">
                    (β {stockA.beta.toFixed(2)})
                  </span>
                )}
              </span>
            </div>

            {/* Price Position within Year */}
            <div className="space-y-1 pt-1 border-t border-border/40">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Compass className="size-3 text-muted-foreground/70" />
                  <span>Yearly Corridor:</span>
                </span>
                <span className="font-semibold text-foreground font-sans">
                  {stockA.pricePositionLabel}
                </span>
              </div>
              {stockA.positionPct !== null && (
                <div className="w-full bg-border/60 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(5, stockA.positionPct))}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Card 2: Stock B */}
        <Card className="rounded-2xl border-sky-500/30 bg-sky-500/5 p-4 sm:p-5 space-y-4">
          <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-sky-500" />
                <h3 className="font-bold text-lg sm:text-xl text-foreground">
                  {stockB.companyName}
                </h3>
              </div>
              <span className="font-mono text-xs text-muted-foreground font-medium bg-background/60 px-2 py-0.5 rounded-md mt-1 inline-block">
                {stockB.symbol}
              </span>
            </div>

            {/* Current Price */}
            <div className="text-right">
              <div className="text-xl sm:text-2xl font-bold text-foreground font-sans tabular-nums">
                ${stockB.currentPrice.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground font-medium">
                {stockB.marketStatus === "open" ? "Market open" : "Last closing price"}
              </div>
            </div>
          </div>

          {/* Key Metric Rows */}
          <div className="space-y-2.5 text-sm">
            {/* 1-Year Return */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">1-Year Return:</span>
              {stockB.return1Y !== null ? (
                <span
                  className={`font-bold font-sans tabular-nums flex items-center gap-1 ${
                    stockB.return1Y >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {stockB.return1Y >= 0 ? (
                    <TrendingUp className="size-3.5" />
                  ) : (
                    <TrendingDown className="size-3.5" />
                  )}
                  {stockB.return1Y >= 0 ? "+" : ""}
                  {stockB.return1Y}%
                </span>
              ) : (
                <span className="text-muted-foreground">--</span>
              )}
            </div>

            {/* Company Size */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Company Size:</span>
              <span className="font-semibold text-foreground text-right font-sans">
                {stockB.companySizeWords}
              </span>
            </div>

            {/* Dividends */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Coins className="size-3.5 text-muted-foreground/70" />
                <span>Dividends:</span>
              </span>
              <span className="font-semibold text-foreground text-right font-sans">
                {stockB.dividendLabel}
              </span>
            </div>

            {/* Ups & Downs */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Activity className="size-3.5 text-muted-foreground/70" />
                <span>Ups & Downs:</span>
              </span>
              <span className="font-semibold text-foreground text-right font-sans">
                {stockB.upsAndDownsLabel}
                {stockB.beta !== null && (
                  <span className="text-muted-foreground font-normal ml-1">
                    (β {stockB.beta.toFixed(2)})
                  </span>
                )}
              </span>
            </div>

            {/* Price Position within Year */}
            <div className="space-y-1 pt-1 border-t border-border/40">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Compass className="size-3 text-muted-foreground/70" />
                  <span>Yearly Corridor:</span>
                </span>
                <span className="font-semibold text-foreground font-sans">
                  {stockB.pricePositionLabel}
                </span>
              </div>
              {stockB.positionPct !== null && (
                <div className="w-full bg-border/60 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-sky-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(5, stockB.positionPct))}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Overlaid Normalized Chart (Both stocks normalized to 100) */}
      <NormalizedCompareChart
        symbolA={stockA.symbol}
        nameA={stockA.companyName}
        symbolB={stockB.symbol}
        nameB={stockB.companyName}
        normalizedData={normalized}
      />

      {/* Plain-Language AI Explanation or Code-Built Quick Comparison */}
      <div className="rounded-2xl border border-border/80 bg-muted/20 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-full bg-foreground text-background">
              <Sparkles className="size-3.5 text-sky-400" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-foreground">
              {aiData?.isQuickComparison ? "Quick Comparison" : "Plain-Language Comparison"}
            </h3>
            {aiData?.isQuickComparison && (
              <Badge variant="secondary" className="text-xs">
                Verified Data Summary
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            <span>Informational only. Not financial advice.</span>
          </div>
        </div>

        {isAiLoading && !aiData ? (
          <div className="space-y-3 animate-in fade-in-0">
            <Skeleton className="h-5 w-4/5 rounded" />
            <Skeleton className="h-5 w-full rounded" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : aiData?.aiComparison ? (
          <div className="space-y-4 text-sm sm:text-base leading-relaxed text-foreground">
            {/* Notice if Quick Comparison was used */}
            {aiData.isQuickComparison && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-xl border border-border/60">
                <Info className="size-4 shrink-0 text-muted-foreground" />
                <span>
                  AI service was busy; showing verified plain-language comparison computed directly from the metrics above.
                </span>
              </div>
            )}

            {/* Summary */}
            <p className="font-medium text-foreground">
              {aiData.aiComparison.summary}
            </p>

            {/* Trade-Offs */}
            {aiData.aiComparison.tradeOffs && aiData.aiComparison.tradeOffs.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border/60">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Key Trade-Offs for Investors:
                </span>
                <ul className="space-y-2">
                  {aiData.aiComparison.tradeOffs.map((tradeOff, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-foreground/90">
                      <span className="text-primary font-bold shrink-0">•</span>
                      <span>{tradeOff}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Takeaway */}
            {aiData.aiComparison.takeaway && (
              <div className="rounded-xl border border-border/80 bg-background/60 p-3.5 text-sm text-muted-foreground">
                <strong className="text-foreground font-semibold">Takeaway: </strong>
                {aiData.aiComparison.takeaway}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Mandatory Disclaimer */}
      <div className="text-xs text-muted-foreground/80 leading-relaxed border-t border-border/60 pt-3 space-y-1">
        <p className="font-semibold text-muted-foreground">
          Past performance does not predict the future.
        </p>
        <p>
          Historical returns and normalized charts show what happened under past market conditions, not future results. No statement is buy or sell advice.
        </p>
      </div>
    </div>
  );
}
