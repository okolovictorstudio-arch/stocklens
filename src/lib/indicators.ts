/**
 * Pure, typed mathematical functions for calculating technical indicators locally.
 * Zero external API calls, preserving free-tier credit quotas.
 */
import type { CandleDataPoint } from "@/types/stock";
import type { IndicatorPoint, MacdPoint, TechnicalIndicators } from "@/types/indicator";

/**
 * Calculates Simple Moving Average (SMA).
 * Requires at least `period` candles.
 */
export function calculateSMA(candles: CandleDataPoint[], period: number): IndicatorPoint[] {
  if (!candles || candles.length < period || period <= 0) {
    return [];
  }

  const result: IndicatorPoint[] = [];
  let windowSum = 0;

  for (let i = 0; i < candles.length; i++) {
    windowSum += candles[i].close;

    if (i >= period) {
      windowSum -= candles[i - period].close;
    }

    if (i >= period - 1) {
      result.push({
        time: Number(candles[i].time),
        value: +(windowSum / period).toFixed(2),
      });
    }
  }

  return result;
}

/**
 * Calculates Exponential Moving Average (EMA).
 * Uses standard multiplier: 2 / (period + 1)
 */
export function calculateEMA(candles: CandleDataPoint[], period: number): IndicatorPoint[] {
  if (!candles || candles.length < period || period <= 0) {
    return [];
  }

  const result: IndicatorPoint[] = [];
  const k = 2 / (period + 1);

  // Initial EMA is the SMA of the first `period` candles
  let initialSum = 0;
  for (let i = 0; i < period; i++) {
    initialSum += candles[i].close;
  }

  let prevEma = initialSum / period;
  result.push({
    time: Number(candles[period - 1].time),
    value: +prevEma.toFixed(2),
  });

  // Calculate subsequent EMAs
  for (let i = period; i < candles.length; i++) {
    const currentClose = candles[i].close;
    const currentEma = currentClose * k + prevEma * (1 - k);
    result.push({
      time: Number(candles[i].time),
      value: +currentEma.toFixed(2),
    });
    prevEma = currentEma;
  }

  return result;
}

/**
 * Calculates Relative Strength Index (RSI) using Wilder's smoothing technique.
 * Standard period is 14. Output bounded between 0 and 100.
 */
export function calculateRSI(candles: CandleDataPoint[], period: number = 14): IndicatorPoint[] {
  if (!candles || candles.length <= period || period <= 0) {
    return [];
  }

  const result: IndicatorPoint[] = [];

  let gainsSum = 0;
  let lossesSum = 0;

  // Calculate price changes for first `period` candles
  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change > 0) {
      gainsSum += change;
    } else {
      lossesSum += Math.abs(change);
    }
  }

  let avgGain = gainsSum / period;
  let avgLoss = lossesSum / period;

  // First RSI value
  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);

  result.push({
    time: Number(candles[period].time),
    value: +rsi.toFixed(2),
  });

  // Calculate subsequent RSI using Wilder's smoothing
  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);

    result.push({
      time: Number(candles[i].time),
      value: +rsi.toFixed(2),
    });
  }

  return result;
}

/**
 * Calculates MACD (Moving Average Convergence Divergence).
 * Default parameters: Fast = 12, Slow = 26, Signal = 9.
 */
export function calculateMACD(
  candles: CandleDataPoint[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MacdPoint[] {
  if (!candles || candles.length < slowPeriod + signalPeriod) {
    return [];
  }

  const fastEma = calculateEMA(candles, fastPeriod);
  const slowEma = calculateEMA(candles, slowPeriod);

  // Align Fast and Slow EMAs by timestamp
  const slowMap = new Map<number, number>(slowEma.map((p) => [p.time, p.value]));

  const macdLinePoints: { time: number; macd: number }[] = [];
  for (const fast of fastEma) {
    const slowVal = slowMap.get(fast.time);
    if (slowVal !== undefined) {
      macdLinePoints.push({
        time: fast.time,
        macd: +(fast.value - slowVal).toFixed(2),
      });
    }
  }

  if (macdLinePoints.length < signalPeriod) {
    return [];
  }

  // Calculate Signal line: EMA(signalPeriod) of the MACD line
  const k = 2 / (signalPeriod + 1);
  let signalSum = 0;
  for (let i = 0; i < signalPeriod; i++) {
    signalSum += macdLinePoints[i].macd;
  }

  let prevSignal = signalSum / signalPeriod;
  const result: MacdPoint[] = [];

  const firstMacd = macdLinePoints[signalPeriod - 1].macd;
  result.push({
    time: macdLinePoints[signalPeriod - 1].time,
    macd: firstMacd,
    signal: +prevSignal.toFixed(2),
    histogram: +(firstMacd - prevSignal).toFixed(2),
  });

  for (let i = signalPeriod; i < macdLinePoints.length; i++) {
    const currentMacd = macdLinePoints[i].macd;
    const currentSignal = currentMacd * k + prevSignal * (1 - k);
    result.push({
      time: macdLinePoints[i].time,
      macd: currentMacd,
      signal: +currentSignal.toFixed(2),
      histogram: +(currentMacd - currentSignal).toFixed(2),
    });
    prevSignal = currentSignal;
  }

  return result;
}

/**
 * Helper to calculate all standard indicators for a series of candles.
 */
export function calculateAllIndicators(candles: CandleDataPoint[]): TechnicalIndicators {
  return {
    sma20: calculateSMA(candles, 20),
    sma50: calculateSMA(candles, 50),
    sma200: calculateSMA(candles, 200),
    ema20: calculateEMA(candles, 20),
    rsi14: calculateRSI(candles, 14),
    macd: calculateMACD(candles, 12, 26, 9),
  };
}
