"use client";

import * as React from "react";
import {
  Calendar,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  RotateCcw,
  Sparkles,
  HelpCircle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { InvestedEarlierAnalysis, InvestmentScenario } from "@/lib/analytics";
import type { InvestedEarlierAIResponse } from "@/types/analysis";
import { cleanCompanyName } from "@/lib/utils";

interface InvestedEarlierCardProps {
  symbol: string;
  companyName: string;
  initialAmount?: number;
}

interface ApiResponse {
  symbol: string;
  companyName: string;
  amount: number;
  currentPrice: number;
  calculations: InvestedEarlierAnalysis;
  aiExplanation?: InvestedEarlierAIResponse | null;
  aiError?: string | null;
  error?: string;
}

const PRESET_AMOUNTS = [50, 100, 500, 1000];

export function InvestedEarlierCard({
  symbol,
  companyName,
  initialAmount = 100,
}: InvestedEarlierCardProps) {
  const displayCompanyName = cleanCompanyName(companyName || symbol);
  const [amount, setAmount] = React.useState<number>(initialAmount);
  const [inputVal, setInputVal] = React.useState<string>(String(initialAmount));
  const [selectedPeriod, setSelectedPeriod] = React.useState<"1Y" | "3Y" | "5Y">("1Y");
  const [data, setData] = React.useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isExplLoading, setIsExplLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [activeTooltip, setActiveTooltip] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  // Fetch initial calculations and AI narrative
  React.useEffect(() => {
    let isCancelled = false;

    async function executeFetch() {
      try {
        const res = await fetch("/api/invested-earlier", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol,
            companyName,
            amount,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "The calculation service is busy, try again in a minute.");
        }

        const json: ApiResponse = await res.json();
        if (!isCancelled) {
          setData(json);
          setErrorMsg(null);

          // Auto-select the longest available period if 1Y isn't available
          if (json.calculations) {
            const sc = json.calculations.scenarios;
            if (sc["5Y"]?.isAvailable) {
              setSelectedPeriod("5Y");
            } else if (sc["3Y"]?.isAvailable) {
              setSelectedPeriod("3Y");
            } else {
              setSelectedPeriod("1Y");
            }
          }
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          console.error("[InvestedEarlierCard] Error:", err);
          setErrorMsg(
            err instanceof Error
              ? err.message
              : "Historical candle data is not available for this symbol."
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    executeFetch();

    return () => {
      isCancelled = true;
    };
  }, [symbol, companyName, amount, reloadKey]);

  // Retry specifically the AI explanation without losing rendered numbers
  const handleRetryExplanation = async () => {
    setIsExplLoading(true);
    try {
      const res = await fetch("/api/invested-earlier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          companyName,
          amount,
        }),
      });

      if (res.ok) {
        const json: ApiResponse = await res.json();
        setData((prev) =>
          prev
            ? {
                ...prev,
                aiExplanation: json.aiExplanation,
                aiError: json.aiError,
              }
            : json
        );
      }
    } catch (err) {
      console.warn("[InvestedEarlierCard] Retry explanation error:", err);
    } finally {
      setIsExplLoading(false);
    }
  };

  const handleAmountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(inputVal.replace(/[^0-9.]/g, ""));
    if (!isNaN(parsed) && parsed > 0) {
      const clean = Math.round(parsed);
      setIsLoading(true);
      setAmount(clean);
      setInputVal(String(clean));
    } else {
      setInputVal(String(amount));
    }
  };

  const handlePresetSelect = (preset: number) => {
    setIsLoading(true);
    setAmount(preset);
    setInputVal(String(preset));
  };

  const toggleTooltip = (key: string) => {
    setActiveTooltip((prev) => (prev === key ? null : key));
  };

  const scenarios = data?.calculations?.scenarios;
  const activeScenario: InvestmentScenario | undefined = scenarios ? scenarios[selectedPeriod] : undefined;

  // Format currency helpers
  const fmt = (num: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);

  if (isLoading && !data) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xs space-y-4 animate-in fade-in-0">
        <div className="flex items-center gap-2">
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-6 w-60 rounded-md" />
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <Skeleton className="h-28 rounded-xl" />
      </div>
    );
  }

  // Only display full-card error state if candle data itself could not be loaded
  if (errorMsg && !data?.calculations) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xs space-y-3 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="size-6" />
        </div>
        <h3 className="text-base font-semibold text-foreground">
          Historical Calculation Unavailable
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {errorMsg}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setIsLoading(true);
            setReloadKey((k) => k + 1);
          }}
          className="min-h-[44px] rounded-xl cursor-pointer gap-2"
        >
          <RotateCcw className="size-4" />
          <span>Try again</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xs space-y-6">
      {/* Header: Title + Question */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Calendar className="size-4 text-sky-500" />
          <span>Historical Investment Explorer</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          What if you had invested in {displayCompanyName} earlier?
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
          See what an investment would be worth today based on real historical daily prices.
        </p>
      </div>

      {/* Editable Amount Control + Presets (Min 44px tap targets) */}
      <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label
            htmlFor="invest-amount-input"
            className="text-sm font-semibold text-foreground flex items-center gap-1.5"
          >
            <span>Starting amount to test:</span>
          </label>

          <form onSubmit={handleAmountSubmit} className="flex items-center gap-2">
            <div className="relative flex items-center">
              <span className="absolute left-3 text-sm font-semibold text-muted-foreground">
                $
              </span>
              <input
                id="invest-amount-input"
                type="number"
                min="1"
                step="1"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onBlur={handleAmountSubmit}
                className="w-32 h-11 pl-7 pr-3 rounded-xl border border-border bg-background text-base font-mono font-semibold text-foreground outline-none focus:ring-2 focus:ring-ring/40 tabular-nums"
                aria-label="Investment amount in dollars"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              className="min-h-[44px] px-3 rounded-xl cursor-pointer text-sm font-medium"
            >
              Update
            </Button>
          </form>
        </div>

        {/* Quick Amount Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/60">
          <span className="text-xs text-muted-foreground font-medium">Quick pick:</span>
          {PRESET_AMOUNTS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handlePresetSelect(preset)}
              className={`min-h-[44px] px-3 rounded-lg text-xs font-semibold font-mono transition-all cursor-pointer ${
                amount === preset
                  ? "bg-foreground text-background shadow-xs"
                  : "bg-background border border-border text-foreground hover:bg-muted"
              }`}
            >
              ${preset}
            </button>
          ))}
        </div>
      </div>

      {/* Trading History Notice (if less than 5 years of data) */}
      {data?.calculations && !data.calculations.hasFullFiveYears && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
          <Info className="size-4.5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold">Shorter Trading History:</span>
            <p className="leading-relaxed">
              {data.calculations.historyNotice ||
                `This stock has about ${data.calculations.dataHistoryYears} years of public market records. Scenarios beyond its earliest listing date are marked unavailable.`}
            </p>
          </div>
        </div>
      )}

      {/* Timeframe Selector Tabs (1 Year / 3 Years / 5 Years) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <span>Choose a timeframe:</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(["1Y", "3Y", "5Y"] as const).map((periodKey) => {
            const sc = scenarios?.[periodKey];
            const isAvail = sc?.isAvailable ?? false;
            const isSelected = selectedPeriod === periodKey;

            return (
              <button
                key={periodKey}
                type="button"
                disabled={!isAvail}
                onClick={() => setSelectedPeriod(periodKey)}
                className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl p-2 text-center transition-all cursor-pointer ${
                  !isAvail
                    ? "opacity-40 cursor-not-allowed border border-dashed border-border bg-muted/20"
                    : isSelected
                    ? "bg-foreground text-background shadow-sm"
                    : "border border-border bg-background hover:bg-muted text-foreground"
                }`}
              >
                <span className="text-sm font-bold font-mono">
                  {periodKey === "1Y" ? "1 Year" : periodKey === "3Y" ? "3 Years" : "5 Years"}
                </span>
                <span className={`text-[11px] ${isSelected ? "text-background/80" : "text-muted-foreground"}`}>
                  {isAvail ? `since ${sc?.startDate.split("-")[0]}` : "No data"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Scenario Calculations */}
      {activeScenario && activeScenario.isAvailable ? (
        <div className="space-y-4">
          {/* Lump Sum vs Fixed Monthly (DCA) Comparison Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* 1. Lump Sum Card */}
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3 flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Lump Sum (All at once)
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleTooltip("lumpSum")}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer -mr-2 -my-2"
                    aria-label="Explain lump sum investing"
                  >
                    <HelpCircle className="size-4" />
                  </button>
                </div>
                {activeTooltip === "lumpSum" && (
                  <div className="rounded-lg bg-popover border border-border p-2.5 text-xs text-popover-foreground leading-relaxed animate-in fade-in-0">
                    You invest the entire ${amount} on Day 1 ({activeScenario.startDate}) at $
                    {activeScenario.startPrice.toFixed(2)} per share.
                  </div>
                )}
                <div className="text-2xl font-bold font-sans tracking-tight text-foreground tabular-nums">
                  {fmt(activeScenario.lumpSum.valueToday)}
                </div>
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  {activeScenario.lumpSum.returnPct >= 0 ? (
                    <span className="flex items-center text-emerald-600 dark:text-emerald-400 font-sans tabular-nums">
                      <ArrowUpRight className="size-4 shrink-0" />
                      +{activeScenario.lumpSum.returnPct}% ({fmt(activeScenario.lumpSum.totalProfit)})
                    </span>
                  ) : (
                    <span className="flex items-center text-rose-600 dark:text-rose-400 font-sans tabular-nums">
                      <ArrowDownRight className="size-4 shrink-0" />
                      {activeScenario.lumpSum.returnPct}% ({fmt(activeScenario.lumpSum.totalProfit)})
                    </span>
                  )}
                </div>
              </div>

              <div className="text-xs text-muted-foreground border-t border-border/60 pt-2 font-sans space-y-0.5">
                <div>Invested: <span className="font-sans tabular-nums text-foreground">{fmt(amount)}</span></div>
                <div>Shares bought: <span className="font-sans tabular-nums text-foreground">{activeScenario.lumpSum.sharesBought}</span></div>
              </div>
            </div>

            {/* 2. Fixed Monthly (DCA) Card */}
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3 flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Fixed Monthly (DCA)
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleTooltip("monthlyDca")}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer -mr-2 -my-2"
                    aria-label="Explain dollar cost averaging"
                  >
                    <HelpCircle className="size-4" />
                  </button>
                </div>
                {activeTooltip === "monthlyDca" && (
                  <div className="rounded-lg bg-popover border border-border p-2.5 text-xs text-popover-foreground leading-relaxed animate-in fade-in-0">
                    You invest ${amount} each month across {activeScenario.monthlyDca.totalMonths} months.
                    This averages out your purchase price during highs and lows.
                  </div>
                )}
                <div className="text-2xl font-bold font-sans tracking-tight text-foreground tabular-nums">
                  {fmt(activeScenario.monthlyDca.valueToday)}
                </div>
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  {activeScenario.monthlyDca.returnPct >= 0 ? (
                    <span className="flex items-center text-emerald-600 dark:text-emerald-400 font-sans tabular-nums">
                      <ArrowUpRight className="size-4 shrink-0" />
                      +{activeScenario.monthlyDca.returnPct}% ({fmt(activeScenario.monthlyDca.totalProfit)})
                    </span>
                  ) : (
                    <span className="flex items-center text-rose-600 dark:text-rose-400 font-sans tabular-nums">
                      <ArrowDownRight className="size-4 shrink-0" />
                      {activeScenario.monthlyDca.returnPct}% ({fmt(activeScenario.monthlyDca.totalProfit)})
                    </span>
                  )}
                </div>
              </div>

              <div className="text-xs text-muted-foreground border-t border-border/60 pt-2 font-sans space-y-0.5">
                <div>Total deposited: <span className="font-sans tabular-nums text-foreground">{fmt(activeScenario.monthlyDca.totalInvested)}</span></div>
                <div>Contributions: <span className="font-sans tabular-nums text-foreground">{activeScenario.monthlyDca.totalMonths} months</span></div>
              </div>
            </div>
          </div>

          {/* Comparing Lump Sum vs Monthly Buying Guidance */}
          <p className="text-xs text-muted-foreground leading-relaxed">
            Monthly buying put in more money over time, so compare the percentages, not the dollars.
          </p>

          {/* Biggest Drop & Recovery Time Card */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowDownRight className="size-4 text-amber-500" />
                <span className="text-sm font-semibold text-foreground">
                  Biggest Drop Over This Time:
                </span>
              </div>
              <span className="font-sans font-bold text-sm text-rose-600 dark:text-rose-400 tabular-nums">
                -{activeScenario.drawdown.maxDropPct}%
              </span>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Fell from <span className="font-sans tabular-nums font-semibold text-foreground">${activeScenario.drawdown.peakPrice.toFixed(2)}</span> down to{" "}
              <span className="font-sans tabular-nums font-semibold text-foreground">${activeScenario.drawdown.troughPrice.toFixed(2)}</span>.{" "}
              <span className="text-foreground font-medium">{activeScenario.drawdown.recoveryExplanation}</span>
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground space-y-1">
          <p className="text-sm font-medium">This timeframe is not available.</p>
          <p className="text-xs">{activeScenario?.unavailableReason || "The company had not yet gone public."}</p>
        </div>
      )}

      {/* AI Plain-Language Explanation or Graceful Fallback */}
      {data?.aiExplanation ? (
        <div className="rounded-xl border border-border/80 bg-muted/30 p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <div className="flex size-6 items-center justify-center rounded-full bg-foreground text-background">
              <Sparkles className="size-3 text-sky-400" />
            </div>
            <span>What this means in plain English</span>
          </div>

          <p className="text-sm sm:text-base text-foreground leading-relaxed">
            {data.aiExplanation.summary}
          </p>

          <div className="space-y-2 pt-2 border-t border-border/60 text-xs sm:text-sm text-muted-foreground">
            <div>
              <strong className="text-foreground font-semibold">Lump Sum vs Monthly Deposits: </strong>
              {data.aiExplanation.lumpVsMonthlyLesson}
            </div>
            <div>
              <strong className="text-foreground font-semibold">The Ups and Downs: </strong>
              {data.aiExplanation.drawdownLesson}
            </div>
          </div>
        </div>
      ) : !isLoading ? (
        <div className="rounded-xl border border-border/80 bg-muted/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
            <Info className="size-4 shrink-0 text-muted-foreground" />
            <span>Explanation unavailable right now, the numbers above are still accurate.</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={isExplLoading}
            onClick={handleRetryExplanation}
            className="min-h-[44px] px-3 text-xs rounded-xl cursor-pointer gap-1.5 shrink-0 self-end sm:self-auto"
          >
            <RotateCcw className={`size-3.5 ${isExplLoading ? "animate-spin" : ""}`} />
            <span>Try again</span>
          </Button>
        </div>
      ) : null}

      {/* Mandatory Disclaimer & Past Performance Note */}
      <div className="text-xs text-muted-foreground/80 leading-relaxed border-t border-border/60 pt-3 space-y-1">
        <p className="font-semibold text-muted-foreground">
          Past performance does not predict the future.
        </p>
        <p>
          Based on share price only. Dividends are not included.
        </p>
        <p>
          Monthly buying put in more money over time, so compare the percentages, not the dollars.
        </p>
        <p>
          Historical numbers show what happened under past market conditions, not what will happen next. Informational only. Not financial advice.
        </p>
      </div>
    </div>
  );
}
