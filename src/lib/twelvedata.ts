/**
 * Twelve Data API data-access layer.
 * All requests are executed server-side.
 * Caches up to 5 years of daily candles once per ticker to conserve API credits.
 */
import { withCache, CACHE_TTL } from "@/lib/cache";
import type { CandleDataPoint, HistoricalCandlesResponse, TimeRange } from "@/types/stock";

function getApiKey(): string | null {
  const key = process.env.TWELVE_DATA_API_KEY;
  if (!key || key.trim() === "" || key.startsWith("your-")) {
    return null;
  }
  return key.trim();
}

/**
 * Synthetic/demo candles are strictly restricted to local development or DEMO_MODE=true.
 * In production, genuine missing/failed data states are displayed instead.
 */
function isDemoOrDevAllowed(): boolean {
  if (process.env.DEMO_MODE === "true") return true;
  if (process.env.NODE_ENV !== "production") return true;
  return false;
}

/**
 * Generates realistic synthetic candle series for local dev/demo mode only.
 */
export function generateSampleCandles(
  basePrice: number,
  range: TimeRange,
  symbol: string
): HistoricalCandlesResponse {
  const count =
    range === "1D"
      ? 40
      : range === "1W"
      ? 35
      : range === "1M"
      ? 30
      : range === "6M"
      ? 130
      : range === "1Y"
      ? 260
      : 1260; // 5Y
  const nowSec = Math.floor(Date.now() / 1000);
  const stepSec = range === "1D" ? 300 : range === "1W" ? 1800 : 86400;

  const candles: CandleDataPoint[] = [];
  let current = basePrice * 0.94;

  for (let i = count; i >= 0; i--) {
    const time = nowSec - i * stepSec;
    const variation = (Math.random() - 0.48) * (basePrice * 0.02);
    const open = +current.toFixed(2);
    const close = +(current + variation).toFixed(2);
    const high = +(Math.max(open, close) + Math.random() * (basePrice * 0.01)).toFixed(2);
    const low = +(Math.min(open, close) - Math.random() * (basePrice * 0.01)).toFixed(2);
    const volume = Math.floor(Math.random() * 500000 + 100000);

    candles.push({ time, open, high, low, close, volume });
    current = close;
  }

  return {
    symbol,
    range,
    candles,
    isAvailable: true,
    isMock: true,
  };
}

/**
 * Fetches up to 5 years of daily candles once per ticker and caches them for 15 minutes.
 * Slices 1M, 6M, 1Y, and 5Y from this cached master set to spend 0 extra Twelve Data credits.
 */
export async function getFiveYearDailyCandles(
  symbol: string,
  fallbackBasePrice?: number
): Promise<HistoricalCandlesResponse> {
  const cleanSymbol = symbol.trim().toUpperCase();
  const apiKey = getApiKey();
  const cacheKey = `candles:${cleanSymbol}:5Y_DAILY`;

  return withCache(cacheKey, CACHE_TTL.CANDLES, async () => {
    if (!apiKey) {
      if (isDemoOrDevAllowed() && fallbackBasePrice) {
        return generateSampleCandles(fallbackBasePrice, "5Y", cleanSymbol);
      }
      return {
        symbol: cleanSymbol,
        range: "5Y",
        candles: [],
        isAvailable: false,
        errorMessage: "Historical candles data temporarily unavailable. Please configure TWELVE_DATA_API_KEY.",
        isMock: false,
      };
    }

    try {
      // 5 years of daily trading candles ≈ 1260
      const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(
        cleanSymbol
      )}&interval=1day&outputsize=1260&apikey=${apiKey}`;

      const res = await fetch(url);
      if (!res.ok) {
        return {
          symbol: cleanSymbol,
          range: "5Y",
          candles: [],
          isAvailable: false,
          errorMessage: "Historical data temporarily unavailable. Please try again shortly.",
          isMock: false,
        };
      }

      const data = await res.json();

      if (data.code === 429 || (data.status === "error" && data.message?.includes("run out of API credits"))) {
        return {
          symbol: cleanSymbol,
          range: "5Y",
          candles: [],
          isAvailable: false,
          isRateLimited: true,
          errorMessage: "Twelve Data free tier rate limit reached (8 calls/min). Please try again in 1 minute.",
          isMock: false,
        };
      }

      if (data.status === "error" || !Array.isArray(data.values) || data.values.length === 0) {
        return {
          symbol: cleanSymbol,
          range: "5Y",
          candles: [],
          isAvailable: false,
          errorMessage: data.message || "Historical candles not available for this symbol.",
          isMock: false,
        };
      }

      const rawCandles = [...data.values].reverse();
      const candles: CandleDataPoint[] = [];
      const seenTimes = new Set<number>();

      for (const item of rawCandles) {
        const parsedTime = Math.floor(new Date(item.datetime).getTime() / 1000);
        if (isNaN(parsedTime) || seenTimes.has(parsedTime)) {
          continue;
        }
        seenTimes.add(parsedTime);

        candles.push({
          time: parsedTime,
          open: parseFloat(item.open),
          high: parseFloat(item.high),
          low: parseFloat(item.low),
          close: parseFloat(item.close),
          volume: item.volume ? parseInt(item.volume, 10) : undefined,
        });
      }

      candles.sort((a, b) => Number(a.time) - Number(b.time));

      return {
        symbol: cleanSymbol,
        range: "5Y",
        candles,
        isAvailable: true,
        isMock: false,
      };
    } catch (err) {
      console.error(`[TwelveData] Error fetching 5Y candles for ${cleanSymbol}:`, err);
      return {
        symbol: cleanSymbol,
        range: "5Y",
        candles: [],
        isAvailable: false,
        errorMessage: "Historical data temporarily unavailable. Please try again shortly.",
        isMock: false,
      };
    }
  });
}

/**
 * Fetches historical candles from Twelve Data.
 * Reuses the cached 5Y daily candles for 1M, 6M, 1Y, and 5Y.
 * Intraday (1D, 1W) are fetched and cached separately.
 */
export async function getHistoricalCandles(
  symbol: string,
  range: TimeRange = "1M",
  fallbackBasePrice?: number
): Promise<HistoricalCandlesResponse> {
  const cleanSymbol = symbol.trim().toUpperCase();

  // If daily ranges: reuse cached 5-year master dataset
  if (range === "1M" || range === "6M" || range === "1Y" || range === "5Y") {
    const master5Y = await getFiveYearDailyCandles(cleanSymbol, fallbackBasePrice);
    if (!master5Y.isAvailable || master5Y.candles.length === 0) {
      return {
        ...master5Y,
        range,
      };
    }

    const count =
      range === "1M"
        ? 30
        : range === "6M"
        ? 130
        : range === "1Y"
        ? 260
        : master5Y.candles.length;

    const sliced = master5Y.candles.slice(-count);

    return {
      symbol: cleanSymbol,
      range,
      candles: sliced,
      isAvailable: true,
      isMock: master5Y.isMock,
    };
  }

  // Intraday (1D, 1W)
  const apiKey = getApiKey();
  const cacheKey = `candles:${cleanSymbol}:${range}`;

  return withCache(cacheKey, CACHE_TTL.CANDLES, async () => {
    if (!apiKey) {
      if (isDemoOrDevAllowed() && fallbackBasePrice) {
        return generateSampleCandles(fallbackBasePrice, range, cleanSymbol);
      }
      return {
        symbol: cleanSymbol,
        range,
        candles: [],
        isAvailable: false,
        errorMessage: "Historical candles data temporarily unavailable. Please configure TWELVE_DATA_API_KEY.",
        isMock: false,
      };
    }

    const interval = range === "1D" ? "5min" : "30min";
    const outputsize = range === "1D" ? 78 : 65;

    try {
      const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(
        cleanSymbol
      )}&interval=${interval}&outputsize=${outputsize}&apikey=${apiKey}`;

      const res = await fetch(url);
      if (!res.ok) {
        return {
          symbol: cleanSymbol,
          range,
          candles: [],
          isAvailable: false,
          errorMessage: `Intraday chart (${range}) is not available on the free market data plan. Try 1M, 6M, 1Y, or 5Y to see the price history.`,
          isMock: false,
        };
      }

      const data = await res.json();

      if (data.code === 429 || (data.status === "error" && data.message?.includes("run out of API credits"))) {
        return {
          symbol: cleanSymbol,
          range,
          candles: [],
          isAvailable: false,
          isRateLimited: true,
          errorMessage: "Twelve Data free tier rate limit reached (8 calls/min). Please try again in 1 minute.",
          isMock: false,
        };
      }

      if (data.status === "error" || !Array.isArray(data.values) || data.values.length === 0) {
        return {
          symbol: cleanSymbol,
          range,
          candles: [],
          isAvailable: false,
          errorMessage: `Intraday chart (${range}) is not available on the free market data plan. Try 1M, 6M, 1Y, or 5Y to see the price history.`,
          isMock: false,
        };
      }

      const rawCandles = [...data.values].reverse();
      const candles: CandleDataPoint[] = [];
      const seenTimes = new Set<number>();

      for (const item of rawCandles) {
        const parsedTime = Math.floor(new Date(item.datetime).getTime() / 1000);
        if (isNaN(parsedTime) || seenTimes.has(parsedTime)) {
          continue;
        }
        seenTimes.add(parsedTime);

        candles.push({
          time: parsedTime,
          open: parseFloat(item.open),
          high: parseFloat(item.high),
          low: parseFloat(item.low),
          close: parseFloat(item.close),
          volume: item.volume ? parseInt(item.volume, 10) : undefined,
        });
      }

      candles.sort((a, b) => Number(a.time) - Number(b.time));

      return {
        symbol: cleanSymbol,
        range,
        candles,
        isAvailable: true,
        isMock: false,
      };
    } catch (err) {
      console.error(`[TwelveData] Error fetching ${range} candles for ${cleanSymbol}:`, err);
      return {
        symbol: cleanSymbol,
        range,
        candles: [],
        isAvailable: false,
        errorMessage: "Historical data temporarily unavailable. Please try again shortly.",
        isMock: false,
      };
    }
  });
}
