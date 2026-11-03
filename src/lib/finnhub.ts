/**
 * Finnhub API data-access layer.
 * All requests are executed server-side.
 */
import { withCache, CACHE_TTL } from "@/lib/cache";
import type { StockQuote, StockProfile, SearchResultItem, MarketStatus } from "@/types/stock";

/**
 * Calculates current US Market Status (NYSE / NASDAQ) in America/New_York timezone.
 */
export function getUSMarketStatus(): MarketStatus {
  try {
    const now = new Date();
    // Convert to US Eastern Time
    const nyTimeStr = now.toLocaleString("en-US", { timeZone: "America/New_York" });
    const nyDate = new Date(nyTimeStr);
    const day = nyDate.getDay(); // 0 is Sunday, 6 is Saturday
    const hours = nyDate.getHours();
    const minutes = nyDate.getMinutes();
    const timeInMinutes = hours * 60 + minutes;

    // Weekend = closed
    if (day === 0 || day === 6) {
      return "closed";
    }

    // 04:00 to 09:30 (240 to 570 mins) = Pre-market
    if (timeInMinutes >= 240 && timeInMinutes < 570) {
      return "pre-market";
    }
    // 09:30 to 16:00 (570 to 960 mins) = Open
    if (timeInMinutes >= 570 && timeInMinutes < 960) {
      return "open";
    }
    // 16:00 to 20:00 (960 to 1200 mins) = After-hours
    if (timeInMinutes >= 960 && timeInMinutes < 1200) {
      return "after-hours";
    }

    return "closed";
  } catch {
    return "closed";
  }
}

const SAMPLE_STOCKS: Record<string, { name: string; price: number; change: number; pct: number; cap: number; industry: string }> = {
  AAPL: { name: "Apple Inc.", price: 238.40, change: 2.92, pct: 1.24, cap: 3620000, industry: "Technology" },
  NVDA: { name: "NVIDIA Corp.", price: 141.54, change: 3.95, pct: 2.87, cap: 3480000, industry: "Semiconductors" },
  MSFT: { name: "Microsoft Corp.", price: 428.15, change: 1.92, pct: 0.45, cap: 3180000, industry: "Software" },
  GOOGL: { name: "Alphabet Inc.", price: 172.98, change: -1.08, pct: -0.62, cap: 2150000, industry: "Internet Content" },
  AMZN: { name: "Amazon.com Inc.", price: 198.88, change: 2.06, pct: 1.05, cap: 2070000, industry: "E-Commerce" },
  TSLA: { name: "Tesla, Inc.", price: 242.84, change: -4.32, pct: -1.75, cap: 775000, industry: "Automotive" },
};

function getApiKey(): string | null {
  const key = process.env.FINNHUB_API_KEY;
  if (!key || key.trim() === "" || key.startsWith("your-")) {
    return null;
  }
  return key.trim();
}

/**
 * Searches ticker symbols using Finnhub, filtered for US common stocks.
 * Cached for 1 hour per query.
 */
export async function searchSymbols(query: string): Promise<SearchResultItem[]> {
  const cleanQuery = query.trim().toUpperCase();
  if (!cleanQuery) return [];

  const apiKey = getApiKey();
  const cacheKey = `search:${cleanQuery}`;

  return withCache(cacheKey, CACHE_TTL.SEARCH, async () => {
    if (!apiKey) {
      // Mock / fallback search using sample stocks
      return Object.entries(SAMPLE_STOCKS)
        .filter(([sym, data]) => sym.includes(cleanQuery) || data.name.toUpperCase().includes(cleanQuery))
        .map(([sym, data]) => ({
          symbol: sym,
          displaySymbol: sym,
          description: data.name,
          type: "Common Stock (Sample)",
        }));
    }

    try {
      const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(cleanQuery)}&token=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Finnhub search failed: ${res.statusText}`);
      }
      const data = await res.json();
      const rawResults = (data.result || []) as SearchResultItem[];

      // Filter for US stocks: Finnhub free tier works best with US equities (no '.' suffix, common stock)
      const usResults = rawResults.filter((item) => {
        const isNotForeign = !item.symbol.includes(".");
        const isCommonStock = item.type === "Common Stock" || item.type === "";
        return isNotForeign && isCommonStock;
      });

      return usResults.slice(0, 8);
    } catch (err) {
      console.error("[Finnhub] searchSymbols error:", err);
      return [];
    }
  });
}

/**
 * Fetches real-time stock quote from Finnhub.
 * Cached for 2 minutes.
 */
export async function getStockQuote(symbol: string): Promise<StockQuote | null> {
  const cleanSymbol = symbol.trim().toUpperCase();
  const apiKey = getApiKey();
  const cacheKey = `quote:${cleanSymbol}`;

  return withCache(cacheKey, CACHE_TTL.QUOTE, async () => {
    const marketStatus = getUSMarketStatus();

    if (!apiKey) {
      const sample = SAMPLE_STOCKS[cleanSymbol];
      if (sample) {
        return {
          symbol: cleanSymbol,
          currentPrice: sample.price,
          change: sample.change,
          percentChange: sample.pct,
          highPriceOfDay: +(sample.price * 1.015).toFixed(2),
          lowPriceOfDay: +(sample.price * 0.985).toFixed(2),
          openPriceOfDay: +(sample.price - sample.change).toFixed(2),
          previousClosePrice: +(sample.price - sample.change).toFixed(2),
          timestamp: Math.floor(Date.now() / 1000),
          marketStatus,
          isMock: true,
        };
      }
      return null;
    }

    try {
      const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(cleanSymbol)}&token=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) return null;

      const data = await res.json();
      // Finnhub returns 0 for invalid/unsupported symbols
      if (!data || data.c === 0 && data.pc === 0) {
        return null;
      }

      return {
        symbol: cleanSymbol,
        currentPrice: data.c,
        change: data.d ?? 0,
        percentChange: data.dp ?? 0,
        highPriceOfDay: data.h ?? data.c,
        lowPriceOfDay: data.l ?? data.c,
        openPriceOfDay: data.o ?? data.c,
        previousClosePrice: data.pc ?? data.c,
        timestamp: data.t ?? Math.floor(Date.now() / 1000),
        marketStatus,
        isMock: false,
      };
    } catch (err) {
      console.error(`[Finnhub] getStockQuote(${cleanSymbol}) error:`, err);
      return null;
    }
  });
}

/**
 * Fetches company profile (name, market cap, industry, logo) from Finnhub.
 * Cached for 24 hours.
 */
export async function getStockProfile(symbol: string): Promise<StockProfile | null> {
  const cleanSymbol = symbol.trim().toUpperCase();
  const apiKey = getApiKey();
  const cacheKey = `profile:${cleanSymbol}`;

  return withCache(cacheKey, CACHE_TTL.PROFILE, async () => {
    if (!apiKey) {
      const sample = SAMPLE_STOCKS[cleanSymbol];
      if (sample) {
        return {
          symbol: cleanSymbol,
          name: sample.name,
          country: "US",
          currency: "USD",
          exchange: "NASDAQ",
          marketCapitalization: sample.cap,
          finnhubIndustry: sample.industry,
          isMock: true,
        };
      }
      return null;
    }

    try {
      const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(cleanSymbol)}&token=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) return null;

      const data = await res.json();
      if (!data || !data.name) return null;

      return {
        symbol: cleanSymbol,
        name: data.name,
        country: data.country || "US",
        currency: data.currency || "USD",
        exchange: data.exchange || "US Exchange",
        ipo: data.ipo,
        marketCapitalization: data.marketCapitalization || 0,
        shareOutstanding: data.shareOutstanding,
        logo: data.logo,
        phone: data.phone,
        weburl: data.weburl,
        finnhubIndustry: data.finnhubIndustry,
        isMock: false,
      };
    } catch (err) {
      console.error(`[Finnhub] getStockProfile(${cleanSymbol}) error:`, err);
      return null;
    }
  });
}
