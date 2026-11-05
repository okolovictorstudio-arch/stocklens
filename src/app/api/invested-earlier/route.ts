import { NextRequest, NextResponse } from "next/server";
import { getStockQuote, getStockProfile } from "@/lib/finnhub";
import { getFiveYearDailyCandles } from "@/lib/twelvedata";
import { calculateInvestedEarlier } from "@/lib/analytics";
import { generateInvestedEarlierAI, GeminiAnalysisError } from "@/lib/gemini";
import { withCache, CACHE_TTL } from "@/lib/cache";
import { checkGeminiRateLimit } from "@/lib/rate-limit";
import { cleanCompanyName } from "@/lib/utils";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  const deadlineTimestamp = requestStartTime + 25000; // Shared 25s deadline

  try {
    const body = await request.json().catch(() => ({}));
    const symbol = (body.symbol || "").trim().toUpperCase();
    const rawAmount = parseFloat(body.amount);
    const amount = !isNaN(rawAmount) && rawAmount > 0 ? Math.round(rawAmount * 100) / 100 : 100;
    const reqCompanyName = (body.companyName || "").trim();
    const deviceId = (body.deviceId || request.headers.get("x-device-id") || "").trim();

    if (!symbol) {
      return NextResponse.json(
        { error: "Missing ticker symbol" },
        { status: 400 }
      );
    }

    // Check remaining deadline before data gathering
    if (deadlineTimestamp - Date.now() < 5000) {
      return NextResponse.json(
        { error: "Try again in a few seconds", errorType: "RATE_LIMITED" },
        { status: 429 }
      );
    }

    const cacheKey = `invested_earlier:${symbol}:${amount}`;

    const result = await withCache(
      cacheKey,
      CACHE_TTL.INVESTED_EARLIER,
      async () => {
        // Fetch cached 5-year daily candles & quote concurrently
        // Reuses server cache: 0 extra Twelve Data API credits!
        const [quote, profile, candlesRes] = await Promise.all([
          getStockQuote(symbol),
          getStockProfile(symbol),
          getFiveYearDailyCandles(symbol),
        ]);

        const candles = candlesRes.candles || [];
        const currentPrice = quote?.currentPrice || (candles.length > 0 ? candles[candles.length - 1].close : 100);
        const companyName = cleanCompanyName(reqCompanyName || profile?.name || symbol);

        if (candles.length === 0) {
          throw new Error(`Historical candle data is not available for ${symbol}.`);
        }

        // 1. Pure calculation in code (always succeeds when candles exist)
        const calculations = calculateInvestedEarlier(candles, amount, currentPrice, symbol);

        // 2. Attempt AI explanation in plain language, but NEVER let AI failure fail the calculations!
        let aiExplanation = null;
        let aiError: string | null = null;

        try {
          const geminiLimit = await checkGeminiRateLimit(deviceId);
          if (!geminiLimit.allowed) {
            throw new GeminiAnalysisError(
              `AI explanation is taking a brief rest. Please try again in ${geminiLimit.retryAfterSeconds} seconds.`,
              "RATE_LIMITED"
            );
          }
          aiExplanation = await generateInvestedEarlierAI(
            {
              symbol,
              companyName,
              amount,
              currentPrice,
              dataHistoryYears: calculations.dataHistoryYears,
              scenarios: calculations.scenarios,
            },
            deadlineTimestamp,
            "/api/invested-earlier"
          );
        } catch (aiErr) {
          console.warn("[API /api/invested-earlier] AI explanation unavailable, returning verified numbers:", aiErr);
          aiError =
            aiErr instanceof GeminiAnalysisError && aiErr.errorType === "DAILY_QUOTA_EXCEEDED"
              ? "AI explanations have reached their daily limit and return tomorrow. Numbers, charts and the history card still work."
              : "Explanation unavailable right now, the numbers below are still accurate.";
        }

        return {
          symbol,
          companyName,
          amount,
          currentPrice,
          calculations,
          aiExplanation,
          aiError,
          generatedAt: new Date().toISOString(),
        };
      }
    );

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("[API /api/invested-earlier Error]:", err);
    if (err instanceof GeminiAnalysisError) {
      return NextResponse.json(
        { error: err.message, errorType: err.errorType },
        { status: err.errorType === "DAILY_QUOTA_EXCEEDED" || err.errorType === "RATE_LIMITED" ? 429 : 503 }
      );
    }

    return NextResponse.json(
      { error: "Something went wrong on our side.", errorType: "UNKNOWN_ERROR" },
      { status: 500 }
    );
  }
}
