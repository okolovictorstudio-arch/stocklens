import { NextRequest, NextResponse } from "next/server";
import { getStockQuote, getStockProfile, getStockFundamentals } from "@/lib/finnhub";
import { getHistoricalCandles } from "@/lib/twelvedata";
import type { StockQuote, StockProfile, StockFundamentals, CandleDataPoint } from "@/types/stock";

export interface StockDetailsResponse {
  symbol: string;
  quote: StockQuote | null;
  profile: StockProfile | null;
  fundamentals: StockFundamentals;
  candles: CandleDataPoint[];
  isCandlesAvailable: boolean;
  candlesErrorMessage?: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawSymbol = searchParams.get("symbol");

  if (!rawSymbol || rawSymbol.trim().length === 0) {
    return NextResponse.json(
      { error: "Missing ticker symbol" },
      { status: 400 }
    );
  }

  const symbol = rawSymbol.trim().toUpperCase();

  try {
    // Fetch quote, profile, fundamentals, and candles in parallel
    const [quote, profile, fundamentals] = await Promise.all([
      getStockQuote(symbol),
      getStockProfile(symbol),
      getStockFundamentals(symbol),
    ]);

    if (!quote) {
      return NextResponse.json(
        { error: `Unable to find quote for symbol ${symbol}. Free tier supports major US equities.` },
        { status: 404 }
      );
    }

    // Fetch initial 1M candles (cached)
    const candlesRes = await getHistoricalCandles(symbol, "1M", quote.currentPrice);

    const responseData: StockDetailsResponse = {
      symbol,
      quote,
      profile,
      fundamentals,
      candles: candlesRes.candles || [],
      isCandlesAvailable: candlesRes.isAvailable,
      candlesErrorMessage: candlesRes.errorMessage,
    };

    return NextResponse.json(responseData);
  } catch (err) {
    console.error(`[API /api/stock] Error fetching details for ${symbol}:`, err);
    return NextResponse.json(
      { error: "Failed to retrieve stock data. Please try again shortly." },
      { status: 500 }
    );
  }
}
