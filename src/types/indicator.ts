export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorPoint {
  time: number;
  value: number;
}

export interface MacdPoint {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}

export interface TechnicalIndicators {
  sma20?: IndicatorPoint[];
  sma50?: IndicatorPoint[];
  sma200?: IndicatorPoint[];
  ema20?: IndicatorPoint[];
  rsi14?: IndicatorPoint[];
  macd?: MacdPoint[];
}
