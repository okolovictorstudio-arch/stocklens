import { NextRequest, NextResponse } from "next/server";
import { getStockQuote, getStockProfile, getStockFundamentals } from "@/lib/finnhub";
import { getFiveYearDailyCandles } from "@/lib/twelvedata";
import {
  computeAtAGlanceOverview,
  calculate1YearReturn,
  computeNormalizedComparison,
  buildQuickComparison,
  formatMarketCapWords,
  type StockCompareMetrics,
  type NormalizedComparisonResult,
} from "@/lib/analytics";
import { generateStockComparisonAI, GeminiAnalysisError } from "@/lib/gemini";
import { withCache, CACHE_TTL } from "@/lib/cache";
import { cleanCompanyName } from "@/lib/utils";

export const maxDuration = 30;

function buildStockMetrics(
  symbol: string,
  rawName: string,
  quote: Awaited<ReturnType<typeof getStockQuote>>,
  profile: Awaited<ReturnType<typeof getStockProfile>>,
  fundamentals: Awaited<ReturnType<typeof getStockFundamentals>>,
  candles: Awaited<ReturnType<typeof getFiveYearDailyCandles>>["candles"]
): StockCompareMetrics {
  const currentPrice = quote?.currentPrice || (candles.length > 0 ? candles[candles.length - 1].close : 0);
  const change = quote?.change || 0;
  const percentChange = quote?.percentChange || 0;
  const marketStatus = quote?.marketStatus || "closed";
  const companyName = cleanCompanyName(profile?.name || rawName || symbol);

  const overview = computeAtAGlanceOverview({
    marketCapMillions: fundamentals?.marketCap ?? profile?.marketCapitalization ?? null,
    currentPrice,
    low52: fundamentals?.week52Low ?? null,
    high52: fundamentals?.week52High ?? null,
    candles,
    beta: fundamentals?.beta ?? null,
    dividendYield: fundamentals?.dividendYield ?? null,
  });

  const return1Y = calculate1YearReturn(candles, currentPrice);
  const capWords = formatMarketCapWords(fundamentals?.marketCap ?? profile?.marketCapitalization ?? null);

  return {
    symbol,
    companyName,
    currentPrice,
    change,
    percentChange,
    marketStatus,
    return1Y,
    companySizeWords: `${overview.companySize.label} (${capWords})`,
    dividendLabel: overview.dividend.pays
      ? `${(overview.dividend.yieldPct || 0).toFixed(2)}% cash payout / yr`
      : "No cash dividend (reinvests)",
    dividendYield: overview.dividend.yieldPct,
    upsAndDownsLabel: overview.volatility.label,
    beta: fundamentals?.beta ?? null,
    maxDrawdownPct: overview.volatility.maxDrawdownPct,
    pricePositionLabel: overview.pricePosition.label,
    positionPct: overview.pricePosition.positionPct,
    week52Low: fundamentals?.week52Low ?? null,
    week52High: fundamentals?.week52High ?? null,
  };
}

/**
 * GET /api/compare?base=AAPL&target=MSFT
 * Fetches quotes, profiles, and cached 5-year candles for both stocks.
 * Computes side-by-side metrics and normalized 100-baseline series in pure code.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const baseSym = (searchParams.get("base") || "").trim().toUpperCase();
    const targetSym = (searchParams.get("target") || "").trim().toUpperCase();

    if (!baseSym || !targetSym) {
      return NextResponse.json(
        { error: "Please provide both base and target stock symbols." },
        { status: 400 }
      );
    }

    if (baseSym === targetSym) {
      return NextResponse.json(
        { error: `Please choose a different stock to compare with ${baseSym}.` },
        { status: 400 }
      );
    }

    // Concurrently fetch both stocks' market and fundamental records
    const [
      quoteA,
      quoteB,
      profileA,
      profileB,
      fundA,
      fundB,
      candlesResA,
      candlesResB,
    ] = await Promise.all([
      getStockQuote(baseSym),
      getStockQuote(targetSym),
      getStockProfile(baseSym),
      getStockProfile(targetSym),
      getStockFundamentals(baseSym),
      getStockFundamentals(targetSym),
      getFiveYearDailyCandles(baseSym),
      getFiveYearDailyCandles(targetSym),
    ]);

    const candlesA = candlesResA.candles || [];
    const candlesB = candlesResB.candles || [];

    if (!candlesA.length) {
      return NextResponse.json(
        { error: `Historical price data is not available for ${baseSym}.` },
        { status: 404 }
      );
    }

    if (!candlesB.length) {
      return NextResponse.json(
        { error: `Historical price data is not available for ${targetSym}.` },
        { status: 404 }
      );
    }

    const stockA = buildStockMetrics(baseSym, profileA?.name || baseSym, quoteA, profileA, fundA, candlesA);
    const stockB = buildStockMetrics(targetSym, profileB?.name || targetSym, quoteB, profileB, fundB, candlesB);

    // Compute normalized 100-base series for 1Y, 3Y, 5Y
    const normalized: Record<"1Y" | "3Y" | "5Y", NormalizedComparisonResult> = {
      "1Y": computeNormalizedComparison(candlesA, candlesB, "1Y", stockA.companyName, stockB.companyName),
      "3Y": computeNormalizedComparison(candlesA, candlesB, "3Y", stockA.companyName, stockB.companyName),
      "5Y": computeNormalizedComparison(candlesA, candlesB, "5Y", stockA.companyName, stockB.companyName),
    };

    return NextResponse.json({
      stockA,
      stockB,
      normalized,
    });
  } catch (err: unknown) {
    console.error("[GET /api/compare Error]:", err);
    return NextResponse.json(
      { error: "Unable to calculate comparison right now. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/compare
 * Generates an objective, plain-language comparison narrative via Gemini.
 * At most 1 call per comparison, cached 24h by sorted ticker pair.
 * Falls back to code-built quick comparison if AI is busy or quota is exhausted.
 */
export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  const deadlineTimestamp = requestStartTime + 25000;

  try {
    const body = await request.json().catch(() => ({}));
    const stockA = body.stockA as StockCompareMetrics;
    const stockB = body.stockB as StockCompareMetrics;

    if (!stockA?.symbol || !stockB?.symbol) {
      return NextResponse.json(
        { error: "Missing stock comparison metrics." },
        { status: 400 }
      );
    }

    const sortedKey = [stockA.symbol.toUpperCase(), stockB.symbol.toUpperCase()].sort().join(":");
    const cacheKey = `compare:${sortedKey}`;

    const result = await withCache(
      cacheKey,
      CACHE_TTL.COMPARE,
      async () => {
        let aiComparison = null;
        let isQuickComparison = false;
        let errorType: string | undefined;

        try {
          aiComparison = await generateStockComparisonAI(
            stockA,
            stockB,
            deadlineTimestamp,
            "/api/compare"
          );
        } catch (aiErr) {
          console.warn("[POST /api/compare] Gemini unavailable, returning code-built quick comparison:", aiErr);
          isQuickComparison = true;
          if (aiErr instanceof GeminiAnalysisError) {
            errorType = aiErr.errorType;
          } else {
            errorType = "UNKNOWN_ERROR";
          }
          aiComparison = buildQuickComparison(stockA, stockB);
        }

        return {
          symbolA: stockA.symbol,
          symbolB: stockB.symbol,
          aiComparison,
          isQuickComparison,
          errorType,
          generatedAt: new Date().toISOString(),
        };
      }
    );

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("[POST /api/compare Error]:", err);
    return NextResponse.json(
      { error: "Something went wrong generating the comparison." },
      { status: 500 }
    );
  }
}
