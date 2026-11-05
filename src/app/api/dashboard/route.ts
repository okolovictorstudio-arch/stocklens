import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, extractDeviceId, isValidUUID } from "@/lib/supabase";
import { getStockQuote, getStockProfile } from "@/lib/finnhub";
import { getFiveYearDailyCandles } from "@/lib/twelvedata";
import { cleanCompanyName } from "@/lib/utils";

export const maxDuration = 30;

const POPULAR_TICKERS = [
  { symbol: "AAPL", name: "Apple", desc: "iPhone and Mac" },
  { symbol: "MSFT", name: "Microsoft", desc: "Windows and Office" },
  { symbol: "NVDA", name: "Nvidia", desc: "AI and graphics chips" },
  { symbol: "TSLA", name: "Tesla", desc: "Electric vehicles and energy" },
  { symbol: "AMZN", name: "Amazon", desc: "E-commerce and cloud" },
  { symbol: "GOOGL", name: "Alphabet (Google)", desc: "Search and cloud computing" },
  { symbol: "META", name: "Meta Platforms", desc: "Social networks and VR" },
  { symbol: "BRK.B", name: "Berkshire Hathaway", desc: "Diversified investments" },
];

export interface DashboardStockCard {
  symbol: string;
  companyName: string;
  description?: string;
  currentPrice: number;
  change: number;
  percentChange: number;
  marketStatus: "open" | "closed" | "pre-market" | "after-hours";
  sparkline?: number[]; // last 14 closing prices if cached
  isWatchlisted?: boolean;
}

/**
 * GET /api/dashboard
 * Aggregates Watchlist cards and Popular Stocks cards using cached quotes.
 * One failed row does not break the dashboard.
 */
export async function GET(request: NextRequest) {
  try {
    const deviceId = extractDeviceId(request);
    const supabase = getSupabaseAdmin();

    // 1. Fetch user's saved watchlist tickers
    let watchlistTickers: string[] = [];
    if (deviceId && isValidUUID(deviceId) && supabase) {
      const { data } = await supabase
        .from("watchlist")
        .select("ticker")
        .eq("device_id", deviceId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (data) {
        watchlistTickers = data.map((d) => d.ticker.toUpperCase());
      }
    }

    const watchlistSet = new Set(watchlistTickers);

    // 2. Fetch Watchlist cards (with cached sparkline if available)
    const watchlistPromises = watchlistTickers.map(async (sym): Promise<DashboardStockCard | null> => {
      try {
        const [quote, profile, candles] = await Promise.all([
          getStockQuote(sym),
          getStockProfile(sym),
          getFiveYearDailyCandles(sym),
        ]);

        const sparkline = candles?.candles?.slice(-14).map((c) => c.close) || undefined;

        return {
          symbol: sym,
          companyName: cleanCompanyName(profile?.name || sym),
          currentPrice: quote?.currentPrice || 0,
          change: quote?.change || 0,
          percentChange: quote?.percentChange || 0,
          marketStatus: quote?.marketStatus || "closed",
          sparkline,
          isWatchlisted: true,
        };
      } catch (err) {
        console.warn(`[Dashboard] Failed loading watchlist stock ${sym}:`, err);
        return null;
      }
    });

    // 3. Fetch Popular stocks (all 8 resolved in parallel via allSettled)
    const popularPromises = POPULAR_TICKERS.map(async (stock): Promise<DashboardStockCard> => {
      try {
        const [quote, profile] = await Promise.all([
          getStockQuote(stock.symbol),
          getStockProfile(stock.symbol),
        ]);

        return {
          symbol: stock.symbol,
          companyName: cleanCompanyName(profile?.name || stock.name),
          description: stock.desc,
          currentPrice: quote?.currentPrice || 0,
          change: quote?.change || 0,
          percentChange: quote?.percentChange || 0,
          marketStatus: quote?.marketStatus || "closed",
          isWatchlisted: watchlistSet.has(stock.symbol),
        };
      } catch {
        // Fallback placeholder card so the grid remains complete
        return {
          symbol: stock.symbol,
          companyName: stock.name,
          description: stock.desc,
          currentPrice: 0,
          change: 0,
          percentChange: 0,
          marketStatus: "closed",
          isWatchlisted: watchlistSet.has(stock.symbol),
        };
      }
    });

    const [watchlistResults, popularResults] = await Promise.all([
      Promise.all(watchlistPromises),
      Promise.all(popularPromises),
    ]);

    const watchlistCards = watchlistResults.filter((item): item is DashboardStockCard => item !== null);

    return NextResponse.json({
      watchlist: watchlistCards,
      popular: popularResults,
    });
  } catch (err: unknown) {
    console.error("[GET /api/dashboard Error]:", err);
    return NextResponse.json({
      watchlist: [],
      popular: [],
    });
  }
}
