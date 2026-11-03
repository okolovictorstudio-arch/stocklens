export type MarketStatus = "open" | "closed" | "pre-market" | "after-hours";

export interface StockQuote {
  symbol: string;
  currentPrice: number;
  change: number;
  percentChange: number;
  highPriceOfDay: number;
  lowPriceOfDay: number;
  openPriceOfDay: number;
  previousClosePrice: number;
  timestamp: number;
  marketStatus: MarketStatus;
  isMock?: boolean;
}

export interface StockProfile {
  symbol: string;
  name: string;
  country: string;
  currency: string;
  exchange: string;
  ipo?: string;
  marketCapitalization: number; // in Millions USD
  shareOutstanding?: number;
  logo?: string;
  phone?: string;
  weburl?: string;
  finnhubIndustry?: string;
  isMock?: boolean;
}

export interface SearchResultItem {
  description: string;
  displaySymbol: string;
  symbol: string;
  type: string;
}

export type TimeRange = "1D" | "1W" | "1M" | "6M" | "1Y" | "5Y";

export interface CandleDataPoint {
  time: string | number; // 'YYYY-MM-DD' or Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface HistoricalCandlesResponse {
  symbol: string;
  range: TimeRange;
  candles: CandleDataPoint[];
  isAvailable: boolean;
  isRateLimited?: boolean;
  errorMessage?: string;
  isMock?: boolean;
}

export interface EarningsQuarter {
  period: string; // e.g. "2024-Q3"
  actual: number | null;
  estimate: number | null;
  surprise?: number | null;
  surprisePercent?: number | null;
}

export interface StockFundamentals {
  symbol: string;
  marketCap: number | null; // In Millions USD
  peRatio: number | null;
  eps: number | null;
  week52High: number | null;
  week52Low: number | null;
  dividendYield: number | null;
  beta: number | null;
  roe: number | null;
  avgVolume10D?: number | null;
  earningsTrend?: EarningsQuarter[];
  isAvailable: boolean;
  isMock?: boolean;
}
