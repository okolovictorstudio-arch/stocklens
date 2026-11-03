import { NextRequest, NextResponse } from "next/server";
import { getStockQuote, getStockProfile } from "@/lib/finnhub";
import { getFiveYearDailyCandles } from "@/lib/twelvedata";
import { calculateInvestedEarlier } from "@/lib/analytics";
import { generateInvestedEarlierAI, GeminiAnalysisError } from "@/lib/gemini";

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

    if (!symbol) {
      return NextResponse.json(
        { error: "Missing ticker symbol" },
        { status: 400 }
      );
    }

    // Check remaining deadline before data gathering
    if (deadlineTimestamp - Date.now() < 5000) {
      return NextResponse.json(
        { error: "The AI service is busy, try again in a minute." },
        { status: 503 }
      );
    }

    // Fetch cached 5-year daily candles & quote concurrently
    // Reuses server cache: 0 extra Twelve Data API credits!
    const [quote, profile, candlesRes] = await Promise.all([
      getStockQuote(symbol),
      getStockProfile(symbol),
      getFiveYearDailyCandles(symbol),
    ]);

    const candles = candlesRes.candles || [];
    const currentPrice = quote?.currentPrice || (candles.length > 0 ? candles[candles.length - 1].close : 100);
    const companyName = reqCompanyName || profile?.name || symbol;

    if (candles.length === 0) {
      return NextResponse.json(
        {
          error: `Historical candle data is not available for ${symbol}.`,
        },
        { status: 404 }
      );
    }

    // 1. Pure calculation in code (always succeeds when candles exist)
    const calculations = calculateInvestedEarlier(candles, amount, currentPrice, symbol);

    // 2. Attempt AI explanation in plain language, but NEVER let AI failure fail the calculations!
    let aiExplanation = null;
    let aiError: string | null = null;

    try {
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
      aiError = "Explanation unavailable right now, the numbers below are still accurate.";
    }

    return NextResponse.json({
      symbol,
      companyName,
      amount,
      currentPrice,
      calculations,
      aiExplanation,
      aiError,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error("[API /api/invested-earlier Error]:", err);
    if (err instanceof GeminiAnalysisError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.errorType === "QUOTA_EXCEEDED" ? 429 : 503 }
      );
    }

    return NextResponse.json(
      { error: "The AI service is busy, try again in a minute." },
      { status: 500 }
    );
  }
}
