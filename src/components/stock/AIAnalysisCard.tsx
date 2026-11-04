"use client";

import * as React from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Activity,
  FileText,
  ChevronDown,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Clock,
  BookOpen,
  WifiOff,
  ServerCrash,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AIAnalysisSkeleton } from "@/components/stock/AIAnalysisSkeleton";
import type { StockAnalysisResponse } from "@/types/analysis";
import type { GeminiErrorType } from "@/lib/gemini";

interface AIAnalysisCardProps {
  symbol: string;
}

interface ApiErrorResponse {
  error: string;
  errorType?: GeminiErrorType;
  isRateLimited?: boolean;
}

// Retrieves or generates anonymous client device ID
function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "server-client";
  const KEY = "stocklens_device_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = "dev_" + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function AIAnalysisCard({ symbol }: AIAnalysisCardProps) {
  const [data, setData] = React.useState<StockAnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [errorType, setErrorType] = React.useState<GeminiErrorType | null>(null);
  const [showGroundTruth, setShowGroundTruth] = React.useState(false);
  const [fetchIndex, setFetchIndex] = React.useState(0);

  const refetch = () => {
    setIsLoading(true);
    setErrorMsg(null);
    setErrorType(null);
    setFetchIndex((i) => i + 1);
  };

  React.useEffect(() => {
    let isCancelled = false;
    const controller = new AbortController();

    // Client-side hard timeout (28 seconds)
    const timer = setTimeout(() => {
      if (!isCancelled) {
        console.warn("[AIAnalysisCard] Client 28s timeout triggered");
        setErrorMsg("AI service is busy");
        setErrorType("MODEL_UNAVAILABLE");
        setIsLoading(false);
        controller.abort();
      }
    }, 28000);

    async function execute() {
      try {
        const deviceId = getOrCreateDeviceId();
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-device-id": deviceId,
          },
          body: JSON.stringify({ symbol, deviceId }),
          signal: controller.signal,
        });

        const json = await res.json();

        if (isCancelled || controller.signal.aborted) return;

        if (!res.ok) {
          const errData = json as ApiErrorResponse;
          const detectedType = errData.errorType || "UNKNOWN_ERROR";
          setErrorType(detectedType);
          throw new Error(errData.error || "Something went wrong on our side.");
        }

        setData(json);
        setErrorMsg(null);
        if (json.errorType) {
          setErrorType(json.errorType as GeminiErrorType);
        }
      } catch (err: unknown) {
        if (isCancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;

        console.error("[AIAnalysisCard] Fetch error:", err);
        const msg = err instanceof Error ? err.message : "Something went wrong on our side.";
        setErrorMsg(msg);
      } finally {
        clearTimeout(timer);
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    execute();

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [symbol, fetchIndex]);

  if (isLoading) {
    return <AIAnalysisSkeleton />;
  }

  // Error State Handling when NO data is available
  if ((errorMsg || !data) && !data?.analysis) {
    const isMissingKey = errorType === "MISSING_KEY";
    const isDailyLimit = errorType === "DAILY_QUOTA_EXCEEDED";
    const isRateLimit = errorType === "RATE_LIMITED";
    const isModelUnavail = errorType === "MODEL_UNAVAILABLE";
    const isNetwork = errorType === "NETWORK_ERROR";

    let displayMsg = errorMsg || "Something went wrong on our side.";
    if (isDailyLimit) {
      displayMsg = "AI explanations have reached their daily limit and return tomorrow. Numbers, charts and the history card still work.";
    } else if (isRateLimit) {
      displayMsg = "Try again in a few seconds";
    } else if (isModelUnavail) {
      displayMsg = "AI service is busy";
    }

    const errorTitle = isMissingKey
      ? "Gemini API Key Required"
      : isDailyLimit
      ? "Daily AI Quota Reached"
      : isRateLimit
      ? "Short-Term Limit Reached"
      : isNetwork
      ? "Network Connection Issue"
      : isModelUnavail
      ? "AI Service Busy"
      : "Notice";

    const errorIcon = isNetwork ? (
      <WifiOff className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
    ) : isModelUnavail ? (
      <ServerCrash className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
    ) : (
      <ShieldAlert className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
    );

    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <Sparkles className="size-4.5 text-sky-500" />
          <span>Plain-Language Overview</span>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 space-y-3">
          <div className="flex items-start gap-3">
            {errorIcon}
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                {errorTitle}
              </h3>
              <p className="text-xs text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
                {displayMsg}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-amber-500/20">
            {isMissingKey ? (
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
              >
                <span>Get Free Gemini Key</span>
                <ExternalLink className="size-3" />
              </a>
            ) : isDailyLimit ? (
              <span className="text-xs text-muted-foreground">
                Charts and history cards remain fully accessible below.
              </span>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={refetch}
                className="gap-1.5 text-xs rounded-lg cursor-pointer min-h-[44px]"
              >
                <RefreshCw className="size-3.5" />
                <span>Try again</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const { analysis, groundTruthData, disclaimer, isQuickSummary, errorType: responseErrorType } = data!;
  const isDailyLimit = responseErrorType === "DAILY_QUOTA_EXCEEDED";
  const isRateLimit = responseErrorType === "RATE_LIMITED";
  const isModelBusy = responseErrorType === "MODEL_UNAVAILABLE";

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-6">
      {/* Header with Disclaimer (Model badge removed from UI) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500">
            <Sparkles className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
                {isQuickSummary ? "Quick Summary" : "Plain-Language Overview"}
              </h2>
              {isQuickSummary && (
                <Badge variant="secondary" className="text-xs">
                  Market Data Summary
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Friendly, honest facts calculated strictly from verified market data.
            </p>
          </div>
        </div>

        {/* Persistent Legal Disclaimer */}
        <div className="self-start sm:self-auto inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3.5 py-1.5 text-sm font-medium text-muted-foreground">
          <Clock className="size-3.5" />
          <span>{disclaimer}</span>
        </div>
      </div>

      {/* AI Unavailable Banner if Quick Summary is active */}
      {isQuickSummary && (
        <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Info className="size-4 text-sky-500 shrink-0" />
            <span>
              {isDailyLimit
                ? "AI explanations have reached their daily limit and return tomorrow. Numbers, charts and the history card still work."
                : isRateLimit
                ? "Try again in a few seconds."
                : isModelBusy
                ? "AI service is busy. Showing verified summary built from market numbers."
                : "Showing verified summary built directly from market data."}
            </span>
          </div>
          {!isDailyLimit && (
            <Button
              variant="outline"
              size="sm"
              onClick={refetch}
              className="min-h-[44px] px-3 text-xs rounded-xl cursor-pointer shrink-0 self-end sm:self-auto"
            >
              <RefreshCw className="size-3.5 mr-1.5" />
              <span>Try again</span>
            </Button>
          )}
        </div>
      )}

      {/* Executive Summary */}
      <div className="rounded-xl border border-border/70 bg-muted/20 p-5 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground uppercase tracking-wider">
          <BookOpen className="size-4 text-primary" />
          <span>What You Need to Know</span>
        </div>
        <p className="text-base text-foreground/95 leading-relaxed font-sans">
          {analysis.summary}
        </p>
      </div>

      {/* Recent Price Trend (Strictly no indicator names) */}
      <div className="rounded-xl border border-border/70 bg-card p-5 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground uppercase tracking-wider">
          <Activity className="size-4 text-emerald-500" />
          <span>Recent Price Trend</span>
        </div>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed font-sans">
          {analysis.technical_outlook}
        </p>
      </div>

      {/* Strengths & Risks Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Strengths */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-4.5 shrink-0" />
            <span>Key Strengths & Positive Signals</span>
          </div>
          <ul className="space-y-2.5">
            {analysis.strengths.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-foreground/90 leading-relaxed font-sans">
                <span className="text-emerald-500 font-bold shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Risks */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-4.5 shrink-0" />
            <span>Things to Keep in Mind (Risks)</span>
          </div>
          <ul className="space-y-2.5">
            {analysis.risks.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-foreground/90 leading-relaxed font-sans">
                <span className="text-amber-500 font-bold shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Key Metrics Explained for Beginners (Explain each fact once) */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Everyday Explanations of Key Numbers
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {analysis.key_metrics_explained.map((metric, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-border/70 bg-card p-4 space-y-1.5 hover:border-foreground/20 transition-colors"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{metric.metric}</span>
                <span className="text-sm font-bold text-primary tabular-nums font-sans">
                  {String(metric.value)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed font-sans">
                {metric.plainEnglish}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* "Data Used" Verification Drawer */}
      <div className="border-t border-border/60 pt-4">
        <button
          type="button"
          onClick={() => setShowGroundTruth((v) => !v)}
          className="flex min-h-[44px] items-center justify-between w-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <FileText className="size-4 text-muted-foreground" />
            <span>Inspect Verified Data Sent to Gemini</span>
            <Badge variant="outline" className="text-xs font-mono">
              Ground Truth Numbers
            </Badge>
          </span>
          <ChevronDown className={`size-4.5 transition-transform ${showGroundTruth ? "rotate-180" : ""}`} />
        </button>

        {showGroundTruth && (
          <div className="mt-3 rounded-xl border border-border bg-muted/40 p-4 space-y-3 animate-in fade-in-0 duration-200">
            <p className="text-sm text-muted-foreground leading-relaxed">
              StockLens explicitly instructs the Gemini model to reference only these verified numbers. Users can verify that every statement in the analysis aligns with the data below:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-sm tabular-nums font-sans">
              <div className="bg-background/60 p-2.5 rounded-lg border border-border/40">
                <div className="text-xs text-muted-foreground">Price</div>
                <div className="font-semibold text-foreground">{groundTruthData.currentPrice}</div>
              </div>
              <div className="bg-background/60 p-2.5 rounded-lg border border-border/40">
                <div className="text-xs text-muted-foreground">Market Cap</div>
                <div className="font-semibold text-foreground">{groundTruthData.marketCap}</div>
              </div>
              <div className="bg-background/60 p-2.5 rounded-lg border border-border/40">
                <div className="text-xs text-muted-foreground">P/E Ratio</div>
                <div className="font-semibold text-foreground">{groundTruthData.peRatio}</div>
              </div>
              <div className="bg-background/60 p-2.5 rounded-lg border border-border/40">
                <div className="text-xs text-muted-foreground">EPS (TTM)</div>
                <div className="font-semibold text-foreground">{groundTruthData.epsTTM}</div>
              </div>
              <div className="bg-background/60 p-2.5 rounded-lg border border-border/40">
                <div className="text-xs text-muted-foreground">52-Wk Range</div>
                <div className="font-semibold text-foreground">{groundTruthData.week52Range}</div>
              </div>
              <div className="bg-background/60 p-2.5 rounded-lg border border-border/40">
                <div className="text-xs text-muted-foreground">RSI (14)</div>
                <div className="font-semibold text-foreground">{groundTruthData.rsi14}</div>
              </div>
              <div className="bg-background/60 p-2.5 rounded-lg border border-border/40">
                <div className="text-xs text-muted-foreground">SMA 50 / 200</div>
                <div className="font-semibold text-foreground">{groundTruthData.sma50} / {groundTruthData.sma200}</div>
              </div>
              <div className="bg-background/60 p-2.5 rounded-lg border border-border/40">
                <div className="text-xs text-muted-foreground">MACD Histogram</div>
                <div className="font-semibold text-foreground">{groundTruthData.macd.histogram}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
