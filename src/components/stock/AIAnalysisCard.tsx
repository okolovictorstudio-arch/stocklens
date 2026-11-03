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

  // Ref guard to prevent React StrictMode duplicate network calls
  const activeRequestKeyRef = React.useRef<string | null>(null);

  const refetch = () => {
    setIsLoading(true);
    setErrorMsg(null);
    setErrorType(null);
    activeRequestKeyRef.current = null;
    setFetchIndex((i) => i + 1);
  };

  React.useEffect(() => {
    const requestKey = `${symbol}:${fetchIndex}`;
    if (activeRequestKeyRef.current === requestKey) {
      return;
    }
    activeRequestKeyRef.current = requestKey;

    const controller = new AbortController();

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

        if (controller.signal.aborted) return;

        if (!res.ok) {
          const errData = json as ApiErrorResponse;
          setErrorType(errData.errorType || "UNKNOWN_ERROR");
          throw new Error(errData.error || "The AI service is busy, try again in a minute.");
        }

        setData(json);
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        if (err instanceof DOMException && err.name === "AbortError") return;

        console.error("[AIAnalysisCard] Fetch error:", err);
        const msg = err instanceof Error ? err.message : "The AI service is busy, try again in a minute.";
        setErrorMsg(msg);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    execute();

    return () => {
      controller.abort();
    };
  }, [symbol, fetchIndex]);

  if (isLoading) {
    return <AIAnalysisSkeleton />;
  }

  // Error State Handling with friendly messages and no raw error leaks
  if (errorMsg || !data) {
    const isMissingKey = errorType === "MISSING_KEY";
    const isQuota = errorType === "QUOTA_EXCEEDED";
    const isNetwork = errorType === "NETWORK_ERROR";
    const isModelUnavail = errorType === "MODEL_UNAVAILABLE";

    const errorTitle = isMissingKey
      ? "Gemini API Key Required"
      : isQuota
      ? "AI Rate Limit Reached"
      : isNetwork
      ? "Network Connection Issue"
      : isModelUnavail
      ? "AI Service Busy"
      : "AI Analysis Temporarily Unavailable";

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
          <span>AI Market & Metric Synthesis</span>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 space-y-3">
          <div className="flex items-start gap-3">
            {errorIcon}
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                {errorTitle}
              </h3>
              <p className="text-xs text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
                {errorMsg || "The AI service is busy, try again in a minute."}
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
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={refetch}
                className="gap-1.5 text-xs rounded-lg cursor-pointer"
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

  const { analysis, groundTruthData, disclaimer } = data;
  const activeModel = "gemini-3.8-flash";

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-6">
      {/* Header with Model Badge & Disclaimer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500">
            <Sparkles className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
                Plain-Language Overview
              </h2>
              <Badge variant="outline" className="text-xs font-mono border-sky-500/30 text-sky-600 dark:text-sky-400">
                {activeModel}
              </Badge>
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

      {/* Executive Summary */}
      <div className="rounded-xl border border-border/70 bg-muted/20 p-5 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground uppercase tracking-wider">
          <BookOpen className="size-4 text-primary" />
          <span>What You Need to Know</span>
        </div>
        <p className="text-base text-foreground/95 leading-relaxed">
          {analysis.summary}
        </p>
      </div>

      {/* Technical Outlook */}
      <div className="rounded-xl border border-border/70 bg-card p-5 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground uppercase tracking-wider">
          <Activity className="size-4 text-emerald-500" />
          <span>Price Momentum & Trend</span>
        </div>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
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
              <li key={idx} className="flex items-start gap-2 text-sm text-foreground/90 leading-relaxed">
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
              <li key={idx} className="flex items-start gap-2 text-sm text-foreground/90 leading-relaxed">
                <span className="text-amber-500 font-bold shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Key Metrics Explained for Beginners */}
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
                <span className="font-mono text-sm font-bold text-primary tabular-nums">
                  {String(metric.value)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-sm tabular-nums">
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
