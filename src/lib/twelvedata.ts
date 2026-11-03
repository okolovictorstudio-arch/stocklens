/**
 * Twelve Data API data-access layer.
 * All requests are executed server-side.
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

interface RangeConfig {
  interval: string;
  outputsize: number;
}

const RANGE_CONFIGS: Record<TimeRange, RangeConfig> = {
  "1D": { interval: "5min", outputsize: 78 },   // 6.5 hours of trading / 5 min = 78 candles
  "1W": { interval: "30min", outputsize: 65 },  // 5 days of trading
  "1M": { interval: "1day", outputsize: 30 },
  "6M": { interval: "1day", outputsize: 130 },
  "1Y": { interval: "1day", outputsize: 260 },
  "5Y": { interval: "1week", outputsize: 260 },
};

/**
 * Generates realistic synthetic candle series for demo/fallback purposes.
 */
export function generateSampleCandles(
  basePrice: number,
  range: TimeRange,
  symbol: string
): HistoricalCandlesResponse {
  const count = range === "1D" ? 40 : range === "1W" ? 35 : range === "1M" ? 30 : 90;
  const nowSec = Math.floor(Date.now() / 1000);
  const stepSec = range === "1D" ? 300 : range === "1W" ? 1800 : 86400;

  const candles: CandleDataPoint[] = [];
  let current = basePrice * 0.92;

  for (let i = count; i >= 0; i--) {
    const time = nowSec - i * stepSec;
    const variation = (Math.random() - 0.48) * (basePrice * 0.02);
    const open = +(current).toFixed(2);
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
 * Fetches historical candles from Twelve Data.
 * Cached for 15 minutes per symbol & range.
 * Catches 429 rate limit errors and returns graceful status rather than throwing.
 */
export async function getHistoricalCandles(
  symbol: string,
  range: TimeRange = "1M",
  fallbackBasePrice?: number
): Promise<HistoricalCandlesResponse> {
  const cleanSymbol = symbol.trim().toUpperCase();
  const apiKey = getApiKey();
  const cacheKey = `candles:${cleanSymbol}:${range}`;

  return withCache(cacheKey, CACHE_TTL.CANDLES, async () => {
    // If no key is configured, supply synthetic candles so the UI chart works smoothly
    if (!apiKey) {
      return generateSampleCandles(fallbackBasePrice || 150, range, cleanSymbol);
    }

    const { interval, outputsize } = RANGE_CONFIGS[range] || RANGE_CONFIGS["1M"];

    try {
      const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(
        cleanSymbol
      )}&interval=${interval}&outputsize=${outputsize}&apikey=${apiKey}`;

      const res = await fetch(url);
      if (!res.ok) {
        return {
          symbol: cleanSymbol,
          range,
          candles: fallbackBasePrice ? generateSampleCandles(fallbackBasePrice, range, cleanSymbol).candles : [],
          isAvailable: false,
          errorMessage: `Twelve Data response returned HTTP ${res.status}`,
          isMock: Boolean(fallbackBasePrice),
        };
      }

      const data = await res.json();

      // Check for rate limit (429 or status error with API credits message)
      if (data.code === 429 || (data.status === "error" && data.message?.includes("run out of API credits"))) {
        return {
          symbol: cleanSymbol,
          range,
          candles: fallbackBasePrice ? generateSampleCandles(fallbackBasePrice, range, cleanSymbol).candles : [],
          isAvailable: false,
          isRateLimited: true,
          errorMessage: "Twelve Data free tier rate limit reached (8 calls/min). Please try again in 1 minute.",
          isMock: Boolean(fallbackBasePrice),
        };
      }

      // Check for general API errors (e.g., symbol not found)
      if (data.status === "error" || !Array.isArray(data.values) || data.values.length === 0) {
        return {
          symbol: cleanSymbol,
          range,
          candles: fallbackBasePrice ? generateSampleCandles(fallbackBasePrice, range, cleanSymbol).candles : [],
          isAvailable: false,
          errorMessage: data.message || "Historical candles not available for this symbol.",
          isMock: Boolean(fallbackBasePrice),
        };
      }

      // Parse and normalize values
      // Twelve Data returns newest first -> reverse so oldest is first
      const rawCandles = [...data.values].reverse();

      const candles: CandleDataPoint[] = [];
      const seenTimes = new Set<number>();

      for (const item of rawCandles) {
        // Parse datetime (e.g. "2024-03-28" or "2024-03-28 15:55:00")
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

      // Ensure strict ascending order by time for Lightweight Charts
      candles.sort((a, b) => (Number(a.time) - Number(b.time)));

      return {
        symbol: cleanSymbol,
        range,
        candles,
        isAvailable: true,
        isMock: false,
      };
    } catch (err) {
      console.error(`[TwelveData] Error fetching candles for ${cleanSymbol}:`, err);
      return {
        symbol: cleanSymbol,
        range,
        candles: fallbackBasePrice ? generateSampleCandles(fallbackBasePrice, range, cleanSymbol).candles : [],
        isAvailable: false,
        errorMessage: "Historical data temporarily unavailable. Please try again shortly.",
        isMock: Boolean(fallbackBasePrice),
      };
    }
  });
}
