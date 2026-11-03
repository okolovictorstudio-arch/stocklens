import { NextRequest, NextResponse } from "next/server";
import { getStockQuote, getStockProfile, getStockFundamentals } from "@/lib/finnhub";
import { getFiveYearDailyCandles } from "@/lib/twelvedata";
import { calculateSMA, calculateEMA, calculateRSI, calculateMACD } from "@/lib/indicators";
import {
  generateStockAnalysis,
  GeminiAnalysisError,
  GEMINI_MODEL,
  DISCLAIMER_TEXT,
} from "@/lib/gemini";
import { withCache, CACHE_TTL } from "@/lib/cache";
import { checkRateLimit } from "@/lib/rate-limit";
import type { GroundTruthData, StockAnalysisResponse, StockAnalysisOutput } from "@/types/analysis";

export const maxDuration = 30;

// Global server-side in-flight map: deduplicates concurrent requests for the same ticker
const globalState = globalThis as unknown as {
  __stocklensInFlightAnalysis?: Map<string, Promise<StockAnalysisResponse>>;
};

if (!globalState.__stocklensInFlightAnalysis) {
  globalState.__stocklensInFlightAnalysis = new Map();
}

const inFlightMap = globalState.__stocklensInFlightAnalysis;

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  const deadlineTimestamp = requestStartTime + 25000; // Overall 25-second deadline

  try {
    const body = await request.json().catch(() => ({}));
    const symbol = (body.symbol || "").trim().toUpperCase();
    const deviceId = (body.deviceId || request.headers.get("x-device-id") || "anonymous-device").trim();

    if (!symbol) {
      return NextResponse.json(
        { error: "Missing ticker symbol", errorType: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    // Per-device rate limiting (15 analyses per 10 min)
    const rateLimit = checkRateLimit(deviceId, 15, 600);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Analysis limit reached for this session. Please wait ${rateLimit.resetInSeconds} seconds before requesting another review.`,
          errorType: "QUOTA_EXCEEDED",
          isRateLimited: true,
          resetInSeconds: rateLimit.resetInSeconds,
        },
        { status: 429 }
      );
    }

    const cacheKey = `analysis:${symbol}`;

    // Deduplicate concurrent in-flight requests for the same ticker
    let activePromise = inFlightMap.get(symbol);

    if (!activePromise) {
      activePromise = withCache<StockAnalysisResponse>(
        cacheKey,
        CACHE_TTL.AI_ANALYSIS,
        async () => {
          // Check remaining time before data gathering
          if (deadlineTimestamp - Date.now() < 5000) {
            throw new GeminiAnalysisError(
              "The AI service is busy, try again in a minute.",
              "MODEL_UNAVAILABLE"
            );
          }

          // Gather all verified data concurrently on the server while tracking stage timings
          const dataFetchStart = Date.now();
          let quoteDuration = 0;
          let profileDuration = 0;
          let fundDuration = 0;
          let candlesDuration = 0;

          const quoteStart = Date.now();
          const quotePromise = getStockQuote(symbol).finally(() => {
            quoteDuration = Date.now() - quoteStart;
          });

          const profileStart = Date.now();
          const profilePromise = getStockProfile(symbol).finally(() => {
            profileDuration = Date.now() - profileStart;
          });

          const fundStart = Date.now();
          const fundPromise = getStockFundamentals(symbol).finally(() => {
            fundDuration = Date.now() - fundStart;
          });

          const candlesStart = Date.now();
          const candlesPromise = getFiveYearDailyCandles(symbol).finally(() => {
            candlesDuration = Date.now() - candlesStart;
          });

          const [quote, profile, fundamentals, candlesRes] = await Promise.all([
            quotePromise,
            profilePromise,
            fundPromise,
            candlesPromise,
          ]);

          const dataFetchDuration = Date.now() - dataFetchStart;
          const remainingBeforeGemini = deadlineTimestamp - Date.now();

          console.log(
            `[/api/analyze] Stage timings for ${symbol}: quote=${quoteDuration}ms, fundamentals=${fundDuration}ms, 5-year candles=${candlesDuration}ms, profile=${profileDuration}ms (data fetch total: ${dataFetchDuration}ms, budget remaining before Gemini: ${remainingBeforeGemini}ms)`
          );

          if (!quote) {
            throw new GeminiAnalysisError(
              `Unable to fetch real-time quote for ${symbol}. Please verify the ticker.`,
              "UNKNOWN_ERROR"
            );
          }

          const candles = candlesRes.candles || [];

          // Calculate technical indicators from the real candles
          const sma20 = calculateSMA(candles, 20);
          const sma50 = calculateSMA(candles, 50);
          const sma200 = calculateSMA(candles, 200);
          const ema20 = calculateEMA(candles, 20);
          const rsi14 = calculateRSI(candles, 14);
          const macd = calculateMACD(candles, 12, 26, 9);

          // Helper to format values or state "unavailable"
          const lastVal = (arr: { value: number }[]) =>
            arr.length > 0 ? `$${arr[arr.length - 1].value.toFixed(2)}` : "unavailable";
          const lastRsi = rsi14.length > 0 ? rsi14[rsi14.length - 1].value.toFixed(1) : "unavailable";
          const lastMacd =
            macd.length > 0
              ? {
                  line: macd[macd.length - 1].macd.toFixed(2),
                  signal: macd[macd.length - 1].signal.toFixed(2),
                  histogram: macd[macd.length - 1].histogram.toFixed(2),
                }
              : { line: "unavailable", signal: "unavailable", histogram: "unavailable" };

          const fmtCap = (c: number | null) => {
            if (!c) return "unavailable";
            if (c >= 1000000) return `$${(c / 1000000).toFixed(2)}T`;
            if (c >= 1000) return `$${(c / 1000).toFixed(2)}B`;
            return `$${c.toFixed(2)}M`;
          };

          const rangeStr =
            fundamentals.week52Low !== null && fundamentals.week52High !== null
              ? `$${fundamentals.week52Low.toFixed(2)} - $${fundamentals.week52High.toFixed(2)}`
              : "unavailable";

          const latestEarnings =
            fundamentals.earningsTrend && fundamentals.earningsTrend.length > 0
              ? `${fundamentals.earningsTrend[fundamentals.earningsTrend.length - 1].period}: Actual $${fundamentals.earningsTrend[fundamentals.earningsTrend.length - 1].actual} vs Est $${fundamentals.earningsTrend[fundamentals.earningsTrend.length - 1].estimate}`
              : "unavailable";

          // Assemble verified Ground Truth Data - ONLY these numbers reach the model
          const groundTruthData: GroundTruthData = {
            symbol,
            companyName: profile?.name || symbol,
            currentPrice: `$${quote.currentPrice.toFixed(2)}`,
            dailyChange: `${quote.change >= 0 ? "+" : ""}${quote.change.toFixed(2)} (${quote.percentChange >= 0 ? "+" : ""}${quote.percentChange.toFixed(2)}%)`,
            marketStatus: quote.marketStatus,
            sma20: lastVal(sma20),
            sma50: lastVal(sma50),
            sma200: lastVal(sma200),
            ema20: lastVal(ema20),
            rsi14: lastRsi,
            macd: lastMacd,
            marketCap: fmtCap(fundamentals.marketCap),
            peRatio: fundamentals.peRatio !== null ? fundamentals.peRatio.toFixed(1) : "unavailable",
            epsTTM: fundamentals.eps !== null ? `$${fundamentals.eps.toFixed(2)}` : "unavailable",
            week52Range: rangeStr,
            dividendYield: fundamentals.dividendYield !== null ? `${fundamentals.dividendYield.toFixed(2)}%` : "0.00%",
            beta: fundamentals.beta !== null ? fundamentals.beta.toFixed(2) : "unavailable",
            roe: fundamentals.roe !== null ? `${fundamentals.roe.toFixed(1)}%` : "unavailable",
            recentEarningsSurprise: latestEarnings,
          };

          // Call Gemini with schema enforcement and shared 25-second deadline, tracking Gemini stage duration
          const geminiStart = Date.now();
          let analysis: StockAnalysisOutput;
          try {
            analysis = await generateStockAnalysis(groundTruthData, deadlineTimestamp, "/api/analyze");
          } finally {
            const geminiDuration = Date.now() - geminiStart;
            console.log(
              `[/api/analyze] Stage timing for ${symbol}: Gemini=${geminiDuration}ms (budget remaining: ${deadlineTimestamp - Date.now()}ms)`
            );
          }

          return {
            symbol,
            companyName: groundTruthData.companyName,
            analysis,
            groundTruthData,
            modelUsed: GEMINI_MODEL,
            generatedAt: new Date().toISOString(),
            disclaimer: DISCLAIMER_TEXT,
          };
        }
      );

      inFlightMap.set(symbol, activePromise);
    }

    try {
      const result = await activePromise;
      return NextResponse.json(result);
    } finally {
      inFlightMap.delete(symbol);
    }
  } catch (err: unknown) {
    if (err instanceof GeminiAnalysisError) {
      const statusCode =
        err.errorType === "MISSING_KEY"
          ? 400
          : err.errorType === "QUOTA_EXCEEDED"
          ? 429
          : err.errorType === "MODEL_UNAVAILABLE"
          ? 503
          : 500;

      return NextResponse.json(
        {
          error: err.message,
          errorType: err.errorType,
          isRateLimited: err.errorType === "QUOTA_EXCEEDED",
        },
        { status: statusCode }
      );
    }

    const rawMessage = err instanceof Error ? err.message : String(err);
    console.error("[API /api/analyze Error]:", rawMessage);

    return NextResponse.json(
      {
        error: "The AI service is busy, try again in a minute.",
        errorType: "UNKNOWN_ERROR",
        isRateLimited: false,
      },
      { status: 500 }
    );
  }
}
