/**
 * Finnhub API data-access layer.
 * All requests are executed server-side.
 */
import { withCache, CACHE_TTL } from "@/lib/cache";
import type {
  StockQuote,
  StockProfile,
  SearchResultItem,
  MarketStatus,
  StockFundamentals,
  EarningsQuarter,
} from "@/types/stock";

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

function isDemoOrDevAllowed(): boolean {
  if (process.env.DEMO_MODE === "true") return true;
  if (process.env.NODE_ENV !== "production") return true;
  return false;
}

const SAMPLE_STOCKS: Record<
  string,
  {
    name: string;
    price: number;
    change: number;
    pct: number;
    cap: number;
    industry: string;
    pe: number;
    eps: number;
    high52: number;
    low52: number;
    divYield: number;
    beta: number;
    roe: number;
    earnings: EarningsQuarter[];
  }
> = {
  AAPL: {
    name: "Apple Inc.",
    price: 238.40,
    change: 2.92,
    pct: 1.24,
    cap: 3620000,
    industry: "Technology",
    pe: 34.2,
    eps: 6.97,
    high52: 245.30,
    low52: 164.08,
    divYield: 0.42,
    beta: 1.08,
    roe: 147.2,
    earnings: [
      { period: "Q4 23", actual: 1.46, estimate: 1.39 },
      { period: "Q1 24", actual: 2.18, estimate: 2.10 },
      { period: "Q2 24", actual: 1.53, estimate: 1.50 },
      { period: "Q3 24", actual: 1.40, estimate: 1.35 },
      { period: "Q4 24", actual: 1.64, estimate: 1.60 },
    ],
  },
  NVDA: {
    name: "NVIDIA Corp.",
    price: 141.54,
    change: 3.95,
    pct: 2.87,
    cap: 3480000,
    industry: "Semiconductors",
    pe: 55.4,
    eps: 2.56,
    high52: 153.13,
    low52: 45.43,
    divYield: 0.03,
    beta: 1.68,
    roe: 115.4,
    earnings: [
      { period: "Q3 23", actual: 0.40, estimate: 0.34 },
      { period: "Q4 23", actual: 0.52, estimate: 0.46 },
      { period: "Q1 24", actual: 0.61, estimate: 0.56 },
      { period: "Q2 24", actual: 0.68, estimate: 0.64 },
      { period: "Q3 24", actual: 0.81, estimate: 0.75 },
    ],
  },
  MSFT: {
    name: "Microsoft Corp.",
    price: 428.15,
    change: 1.92,
    pct: 0.45,
    cap: 3180000,
    industry: "Software",
    pe: 35.8,
    eps: 11.96,
    high52: 468.35,
    low52: 366.50,
    divYield: 0.78,
    beta: 0.91,
    roe: 38.6,
    earnings: [
      { period: "Q1 24", actual: 2.99, estimate: 2.65 },
      { period: "Q2 24", actual: 2.93, estimate: 2.78 },
      { period: "Q3 24", actual: 2.94, estimate: 2.82 },
      { period: "Q4 24", actual: 2.95, estimate: 2.93 },
      { period: "Q1 25", actual: 3.30, estimate: 3.10 },
    ],
  },
  GOOGL: {
    name: "Alphabet Inc.",
    price: 172.98,
    change: -1.08,
    pct: -0.62,
    cap: 2150000,
    industry: "Internet Content",
    pe: 23.4,
    eps: 7.39,
    high52: 193.31,
    low52: 129.01,
    divYield: 0.46,
    beta: 1.05,
    roe: 31.2,
    earnings: [
      { period: "Q3 23", actual: 1.55, estimate: 1.45 },
      { period: "Q4 23", actual: 1.64, estimate: 1.59 },
      { period: "Q1 24", actual: 1.89, estimate: 1.51 },
      { period: "Q2 24", actual: 1.89, estimate: 1.84 },
      { period: "Q3 24", actual: 2.12, estimate: 1.85 },
    ],
  },
  AMZN: {
    name: "Amazon.com Inc.",
    price: 198.88,
    change: 2.06,
    pct: 1.05,
    cap: 2070000,
    industry: "E-Commerce",
    pe: 43.1,
    eps: 4.61,
    high52: 215.90,
    low52: 139.46,
    divYield: 0,
    beta: 1.15,
    roe: 22.4,
    earnings: [
      { period: "Q3 23", actual: 0.94, estimate: 0.58 },
      { period: "Q4 23", actual: 1.00, estimate: 0.80 },
      { period: "Q1 24", actual: 0.98, estimate: 0.83 },
      { period: "Q2 24", actual: 1.26, estimate: 1.03 },
      { period: "Q3 24", actual: 1.43, estimate: 1.14 },
    ],
  },
  TSLA: {
    name: "Tesla, Inc.",
    price: 242.84,
    change: -4.32,
    pct: -1.75,
    cap: 775000,
    industry: "Automotive",
    pe: 72.8,
    eps: 3.34,
    high52: 271.00,
    low52: 138.80,
    divYield: 0,
    beta: 2.35,
    roe: 21.8,
    earnings: [
      { period: "Q3 23", actual: 0.66, estimate: 0.73 },
      { period: "Q4 23", actual: 0.71, estimate: 0.74 },
      { period: "Q1 24", actual: 0.45, estimate: 0.51 },
      { period: "Q2 24", actual: 0.52, estimate: 0.62 },
      { period: "Q3 24", actual: 0.72, estimate: 0.58 },
    ],
  },
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
      if (!isDemoOrDevAllowed()) return [];
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
      if (isDemoOrDevAllowed()) {
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
      }
      return null;
    }

    try {
      const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(cleanSymbol)}&token=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) return null;

      const data = await res.json();
      if (!data || (data.c === 0 && data.pc === 0)) {
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
      if (isDemoOrDevAllowed()) {
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

/**
 * Fetches fundamentals and earnings history from Finnhub free endpoints.
 * Endpoint: /stock/metric?symbol=...&metric=all and /stock/earnings?symbol=...
 * Cached for 24 hours.
 */
export async function getStockFundamentals(symbol: string): Promise<StockFundamentals> {
  const cleanSymbol = symbol.trim().toUpperCase();
  const apiKey = getApiKey();
  const cacheKey = `fundamentals:${cleanSymbol}`;

  return withCache(cacheKey, CACHE_TTL.FUNDAMENTALS, async () => {
    if (!apiKey) {
      if (isDemoOrDevAllowed()) {
        const sample = SAMPLE_STOCKS[cleanSymbol];
        if (sample) {
          return {
            symbol: cleanSymbol,
            marketCap: sample.cap,
            peRatio: sample.pe,
            eps: sample.eps,
            week52High: sample.high52,
            week52Low: sample.low52,
            dividendYield: sample.divYield,
            beta: sample.beta,
            roe: sample.roe,
            earningsTrend: sample.earnings,
            isAvailable: true,
            isMock: true,
          };
        }
      }
      return {
        symbol: cleanSymbol,
        marketCap: null,
        peRatio: null,
        eps: null,
        week52High: null,
        week52Low: null,
        dividendYield: null,
        beta: null,
        roe: null,
        isAvailable: false,
        isMock: false,
      };
    }

    try {
      // 1. Fetch metrics from /stock/metric?symbol=...&metric=all (Free tier)
      const metricUrl = `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(
        cleanSymbol
      )}&metric=all&token=${apiKey}`;

      // 2. Fetch quarterly earnings surprise from /stock/earnings?symbol=... (Free tier)
      const earningsUrl = `https://finnhub.io/api/v1/stock/earnings?symbol=${encodeURIComponent(
        cleanSymbol
      )}&token=${apiKey}`;

      const [metricRes, earningsRes] = await Promise.all([
        fetch(metricUrl),
        fetch(earningsUrl),
      ]);

      let metricData: Record<string, unknown> = {};
      let earningsTrend: EarningsQuarter[] | undefined = undefined;

      if (metricRes.ok) {
        const json = await metricRes.json();
        metricData = (json.metric || {}) as Record<string, unknown>;
      }

      if (earningsRes.ok) {
        const earningsJson = await earningsRes.json();
        if (Array.isArray(earningsJson) && earningsJson.length > 0) {
          // Take the last 4-5 quarters and sort chronologically (oldest to newest)
          earningsTrend = earningsJson
            .slice(0, 5)
            .reverse()
            .map((item: { period?: string; actual?: number; estimate?: number; surprise?: number; surprisePercent?: number }) => ({
              period: item.period ? item.period.slice(0, 7) : "Quarter",
              actual: item.actual !== undefined && item.actual !== null ? +item.actual : null,
              estimate: item.estimate !== undefined && item.estimate !== null ? +item.estimate : null,
              surprise: item.surprise !== undefined && item.surprise !== null ? +item.surprise : undefined,
              surprisePercent: item.surprisePercent !== undefined && item.surprisePercent !== null ? +item.surprisePercent : undefined,
            }));
        }
      }

      // Helper to safely extract numeric metric
      const getNum = (val: unknown): number | null => {
        if (typeof val === "number" && !isNaN(val)) return +val.toFixed(2);
        return null;
      };

      const marketCap = getNum(metricData.marketCapitalization);
      const peRatio = getNum(metricData.peNormalizedAnnual || metricData.peTTM || metricData.peExclExtraTTM);
      const eps = getNum(metricData.epsNormalizedAnnual || metricData.epsTTM);
      const week52High = getNum(metricData["52WeekHigh"]);
      const week52Low = getNum(metricData["52WeekLow"]);
      const dividendYield = getNum(metricData.dividendYieldIndicatedAnnual);
      const beta = getNum(metricData.beta);
      const roe = getNum(metricData.roeTTM);
      const avgVolume10D = getNum(metricData["10DayAverageTradingVolume"]);

      const hasAnyMetric = [marketCap, peRatio, eps, week52High, week52Low].some((v) => v !== null);

      return {
        symbol: cleanSymbol,
        marketCap,
        peRatio,
        eps,
        week52High,
        week52Low,
        dividendYield,
        beta,
        roe,
        avgVolume10D,
        earningsTrend,
        isAvailable: hasAnyMetric,
        isMock: false,
      };
    } catch (err) {
      console.error(`[Finnhub] getStockFundamentals(${cleanSymbol}) error:`, err);
      return {
        symbol: cleanSymbol,
        marketCap: null,
        peRatio: null,
        eps: null,
        week52High: null,
        week52Low: null,
        dividendYield: null,
        beta: null,
        roe: null,
        isAvailable: false,
        isMock: false,
      };
    }
  });
}
