/**
 * Pure, typed financial and stock analytics helpers.
 * Built for everyday investors and beginners with plain-language interpretations.
 */
import type { CandleDataPoint } from "@/types/stock";

export interface CompanySizeInfo {
  label: "Giant" | "Large" | "Medium" | "Small";
  rawCapMillions: number | null;
  formattedCap: string;
  explanation: string;
}

export interface PricePositionInfo {
  label: "Near its yearly low" | "In the middle" | "Near its yearly high" | "Unavailable";
  positionPct: number | null; // 0 (at 52w low) to 100 (at 52w high)
  low52: number | null;
  high52: number | null;
  currentPrice: number;
  explanation: string;
}

export interface VolatilityInfo {
  label: "Calm" | "Moderate" | "Bumpy";
  maxDrawdownPct: number | null;
  beta: number | null;
  explanation: string;
}

export interface DividendInfo {
  pays: boolean;
  yieldPct: number | null;
  label: string;
  explanation: string;
}

export interface AtAGlanceOverview {
  companySize: CompanySizeInfo;
  pricePosition: PricePositionInfo;
  volatility: VolatilityInfo;
  dividend: DividendInfo;
}

/**
 * Calculates company size category and plain-language explanation based on Market Capitalization.
 * Thresholds:
 * - < $2B: Small cap
 * - $2B to $10B: Medium cap
 * - $10B to $200B: Large cap
 * - > $200B: Giant cap (Mega cap)
 */
export function getCompanySize(marketCapMillions: number | null): CompanySizeInfo {
  if (marketCapMillions === null || marketCapMillions <= 0) {
    return {
      label: "Medium",
      rawCapMillions: null,
      formattedCap: "Unavailable",
      explanation: "Market valuation data is not currently reported.",
    };
  }

  let formatted = "";
  if (marketCapMillions >= 1000000) {
    formatted = `$${(marketCapMillions / 1000000).toFixed(2)} trillion`;
  } else if (marketCapMillions >= 1000) {
    formatted = `$${(marketCapMillions / 1000).toFixed(2)} billion`;
  } else {
    formatted = `$${marketCapMillions.toFixed(2)} million`;
  }

  if (marketCapMillions >= 200000) {
    // >= $200B
    return {
      label: "Giant",
      rawCapMillions: marketCapMillions,
      formattedCap: formatted,
      explanation: `Valued at ${formatted}. One of the most massive, well-established corporations in the world.`,
    };
  }

  if (marketCapMillions >= 10000) {
    // $10B to $200B
    return {
      label: "Large",
      rawCapMillions: marketCapMillions,
      formattedCap: formatted,
      explanation: `Valued at ${formatted}. A major industry leader with significant scale and resources.`,
    };
  }

  if (marketCapMillions >= 2000) {
    // $2B to $10B
    return {
      label: "Medium",
      rawCapMillions: marketCapMillions,
      formattedCap: formatted,
      explanation: `Valued at ${formatted}. An established mid-sized business with potential for continued expansion.`,
    };
  }

  return {
    label: "Small",
    rawCapMillions: marketCapMillions,
    formattedCap: formatted,
    explanation: `Valued at ${formatted}. A smaller company, which often means higher growth opportunities but larger price swings.`,
  };
}

/**
 * Determines where the current stock price sits relative to its 52-week trading corridor.
 */
export function getPricePosition(
  currentPrice: number,
  low52: number | null,
  high52: number | null
): PricePositionInfo {
  if (
    low52 === null ||
    high52 === null ||
    high52 <= low52 ||
    currentPrice <= 0
  ) {
    return {
      label: "Unavailable",
      positionPct: null,
      low52,
      high52,
      currentPrice,
      explanation: "52-week price range is not currently available.",
    };
  }

  // Calculate percentage within the range (0% = at low, 100% = at high)
  const clampedPrice = Math.max(low52, Math.min(high52, currentPrice));
  const ratio = (clampedPrice - low52) / (high52 - low52);
  const positionPct = Math.round(ratio * 100);

  if (ratio <= 0.33) {
    return {
      label: "Near its yearly low",
      positionPct,
      low52,
      high52,
      currentPrice,
      explanation: `Trading at $${currentPrice.toFixed(2)}, which is in the bottom third of its 52-week range ($${low52.toFixed(2)} - $${high52.toFixed(2)}).`,
    };
  }

  if (ratio >= 0.67) {
    return {
      label: "Near its yearly high",
      positionPct,
      low52,
      high52,
      currentPrice,
      explanation: `Trading at $${currentPrice.toFixed(2)}, which is in the top third of its 52-week range ($${low52.toFixed(2)} - $${high52.toFixed(2)}).`,
    };
  }

  return {
    label: "In the middle",
    positionPct,
    low52,
    high52,
    currentPrice,
    explanation: `Trading at $${currentPrice.toFixed(2)}, right around the midpoint of its 52-week range ($${low52.toFixed(2)} - $${high52.toFixed(2)}).`,
  };
}

/**
 * Calculates price stability (Ups and downs) from historical candles or beta.
 * Calm: Max drop < 15% (or Beta < 0.85)
 * Moderate: Max drop 15% - 30% (or Beta 0.85 - 1.3)
 * Bumpy: Max drop > 30% (or Beta > 1.3)
 */
export function getVolatility(
  candles: CandleDataPoint[],
  beta: number | null
): VolatilityInfo {
  let maxDrawdownPct: number | null = null;

  if (candles && candles.length >= 10) {
    let peak = -Infinity;
    let maxDrawdown = 0;

    for (const c of candles) {
      if (c.close > peak) {
        peak = c.close;
      }
      if (peak > 0) {
        const drawdown = (peak - c.close) / peak;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }
    }

    maxDrawdownPct = Math.round(maxDrawdown * 1000) / 10; // e.g. 18.5%
  }

  // Evaluate volatility label
  if (maxDrawdownPct !== null) {
    if (maxDrawdownPct < 15) {
      return {
        label: "Calm",
        maxDrawdownPct,
        beta,
        explanation: `Price swings have been relatively gentle, with the biggest drop around ${maxDrawdownPct}% from its peak.`,
      };
    }
    if (maxDrawdownPct <= 30) {
      return {
        label: "Moderate",
        maxDrawdownPct,
        beta,
        explanation: `Experienced regular ups and downs typical of the stock market, with a peak-to-trough dip of ${maxDrawdownPct}%.`,
      };
    }
    return {
      label: "Bumpy",
      maxDrawdownPct,
      beta,
      explanation: `Noticed significant volatility, having experienced a sharp dip of ${maxDrawdownPct}% from its high point.`,
    };
  }

  // Fallback to beta if candles are not yet loaded
  if (beta !== null) {
    if (beta < 0.85) {
      return {
        label: "Calm",
        maxDrawdownPct: null,
        beta,
        explanation: `Beta is ${beta.toFixed(2)}, indicating the price tends to swing less than the broader market.`,
      };
    }
    if (beta <= 1.3) {
      return {
        label: "Moderate",
        maxDrawdownPct: null,
        beta,
        explanation: `Beta is ${beta.toFixed(2)}, moving generally in tandem with typical stock market swings.`,
      };
    }
    return {
      label: "Bumpy",
      maxDrawdownPct: null,
      beta,
      explanation: `Beta is ${beta.toFixed(2)}, indicating the price tends to swing noticeably wider than the broader market.`,
    };
  }

  return {
    label: "Moderate",
    maxDrawdownPct: null,
    beta: null,
    explanation: "Typical market swings based on general industry benchmarks.",
  };
}

/**
 * Determines whether the company pays cash dividends to shareholders.
 */
export function getDividendStatus(yieldPct: number | null): DividendInfo {
  if (yieldPct !== null && yieldPct > 0.05) {
    return {
      pays: true,
      yieldPct,
      label: `Yes (${yieldPct.toFixed(2)}% / yr)`,
      explanation: `The company pays an estimated ${yieldPct.toFixed(2)}% of the share price back to investors as cash each year.`,
    };
  }

  return {
    pays: false,
    yieldPct: 0,
    label: "No",
    explanation: "The company reinvests all profits back into expanding the business rather than paying cash to shareholders.",
  };
}

/**
 * Generates the complete 4-metric At-a-glance overview.
 */
export function computeAtAGlanceOverview(params: {
  marketCapMillions: number | null;
  currentPrice: number;
  low52: number | null;
  high52: number | null;
  candles: CandleDataPoint[];
  beta: number | null;
  dividendYield: number | null;
}): AtAGlanceOverview {
  return {
    companySize: getCompanySize(params.marketCapMillions),
    pricePosition: getPricePosition(params.currentPrice, params.low52, params.high52),
    volatility: getVolatility(params.candles, params.beta),
    dividend: getDividendStatus(params.dividendYield),
  };
}

// ---------------------------------------------------------------------------
// "What if I'd invested earlier?" Analytics
// ---------------------------------------------------------------------------

export interface DrawdownRecoveryInfo {
  maxDropPct: number; // e.g. 24.5%
  peakPrice: number;
  peakDate: string;
  troughPrice: number;
  troughDate: string;
  isRecovered: boolean;
  recoveryDays: number | null;
  recoveryExplanation: string;
}

export interface InvestmentScenario {
  periodKey: "1Y" | "3Y" | "5Y";
  periodLabel: "1 year ago" | "3 years ago" | "5 years ago";
  years: number;
  isAvailable: boolean;
  unavailableReason?: string;
  startDate: string;
  startPrice: number;
  currentPrice: number;

  // Lump sum ($X invested once on start date)
  lumpSum: {
    investedAmount: number;
    sharesBought: number;
    valueToday: number;
    totalProfit: number;
    returnPct: number;
  };

  // Fixed monthly investment ($X deposited each month over the period)
  monthlyDca: {
    monthlyDeposit: number;
    totalMonths: number;
    totalInvested: number;
    sharesBought: number;
    valueToday: number;
    totalProfit: number;
    returnPct: number;
  };

  // Drawdown & recovery
  drawdown: DrawdownRecoveryInfo;
}

export interface InvestedEarlierAnalysis {
  symbol: string;
  amount: number;
  currentPrice: number;
  dataHistoryYears: number;
  hasFullFiveYears: boolean;
  historyNotice?: string;
  scenarios: {
    "1Y": InvestmentScenario;
    "3Y": InvestmentScenario;
    "5Y": InvestmentScenario;
  };
}

/**
 * Normalizes candle time to Unix seconds regardless of whether it was stored as number or ISO string.
 */
export function toUnixSec(time: string | number): number {
  if (typeof time === "number") return time;
  const parsed = Math.floor(new Date(time).getTime() / 1000);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Finds the first trading candle on or immediately after target timestamp.
 * Gracefully accounts for weekends, market holidays, and closures.
 */
export function findCandleOnOrAfter(
  candles: CandleDataPoint[],
  targetSec: number
): CandleDataPoint | null {
  if (!candles || candles.length === 0) return null;
  for (const c of candles) {
    if (toUnixSec(c.time) >= targetSec) {
      return c;
    }
  }
  return null;
}

/**
 * Calculates max peak-to-trough drop and recovery time for a slice of daily candles.
 */
export function calculateDrawdownAndRecovery(
  periodCandles: CandleDataPoint[],
  currentPrice: number
): DrawdownRecoveryInfo {
  if (!periodCandles || periodCandles.length < 2) {
    return {
      maxDropPct: 0,
      peakPrice: currentPrice,
      peakDate: "N/A",
      troughPrice: currentPrice,
      troughDate: "N/A",
      isRecovered: true,
      recoveryDays: 0,
      recoveryExplanation: "Price stayed stable over this timeframe.",
    };
  }

  let runningPeak = periodCandles[0].close;
  let runningPeakTime = toUnixSec(periodCandles[0].time);

  let maxDrop = 0;
  let worstPeak = runningPeak;
  let worstPeakTime = runningPeakTime;
  let worstTrough = runningPeak;
  let worstTroughTime = runningPeakTime;

  for (const c of periodCandles) {
    const cTime = toUnixSec(c.time);
    if (c.close > runningPeak) {
      runningPeak = c.close;
      runningPeakTime = cTime;
    } else if (runningPeak > 0) {
      const drop = (runningPeak - c.close) / runningPeak;
      if (drop > maxDrop) {
        maxDrop = drop;
        worstPeak = runningPeak;
        worstPeakTime = runningPeakTime;
        worstTrough = c.close;
        worstTroughTime = cTime;
      }
    }
  }

  const maxDropPct = Math.round(maxDrop * 1000) / 10;
  const peakDateStr = new Date(worstPeakTime * 1000).toISOString().split("T")[0];
  const troughDateStr = new Date(worstTroughTime * 1000).toISOString().split("T")[0];

  // Did the stock price recover back to worstPeak after worstTroughTime?
  const recoveryCandle = periodCandles.find(
    (c) => toUnixSec(c.time) > worstTroughTime && c.close >= worstPeak
  );

  if (recoveryCandle) {
    const recoveryDays = Math.round((toUnixSec(recoveryCandle.time) - worstTroughTime) / 86400);
    let recoveryExplanation = "";
    if (recoveryDays <= 30) {
      recoveryExplanation = `Quickly bounced back in about ${recoveryDays} days.`;
    } else if (recoveryDays <= 365) {
      const months = Math.max(1, Math.round(recoveryDays / 30.4));
      recoveryExplanation = `Took about ${months} month${months > 1 ? "s" : ""} to climb back to its previous high.`;
    } else {
      const years = (recoveryDays / 365).toFixed(1);
      recoveryExplanation = `Took about ${years} years to recover back to its peak.`;
    }

    return {
      maxDropPct,
      peakPrice: worstPeak,
      peakDate: peakDateStr,
      troughPrice: worstTrough,
      troughDate: troughDateStr,
      isRecovered: true,
      recoveryDays,
      recoveryExplanation,
    };
  }

  // Not yet recovered
  const currentDropPct = worstPeak > 0 ? Math.round(((worstPeak - currentPrice) / worstPeak) * 1000) / 10 : 0;
  return {
    maxDropPct,
    peakPrice: worstPeak,
    peakDate: peakDateStr,
    troughPrice: worstTrough,
    troughDate: troughDateStr,
    isRecovered: false,
    recoveryDays: null,
    recoveryExplanation: currentDropPct > 0
      ? `Has not yet climbed back to that peak (currently ${currentDropPct}% below it).`
      : "Currently re-testing its peak high.",
  };
}

/**
 * Computes a single scenario (1, 3, or 5 years) for lump sum vs fixed monthly DCA.
 */
export function computeScenario(
  candles: CandleDataPoint[],
  years: 1 | 3 | 5,
  amount: number,
  currentPrice: number,
  refDate: Date
): InvestmentScenario {
  const periodKey = `${years}Y` as const;
  const periodLabel: "1 year ago" | "3 years ago" | "5 years ago" =
    years === 1 ? "1 year ago" : years === 3 ? "3 years ago" : "5 years ago";

  const targetDate = new Date(refDate);
  targetDate.setFullYear(refDate.getFullYear() - years);
  const targetSec = Math.floor(targetDate.getTime() / 1000);

  const earliestCandle = candles[0];
  const earliestSec = earliestCandle ? toUnixSec(earliestCandle.time) : 0;

  // If earliest candle started after targetDate + 14 days, historical data doesn't span this far
  if (!earliestCandle || earliestSec > targetSec + 14 * 86400) {
    const earliestDateStr = earliestCandle
      ? new Date(earliestSec * 1000).toISOString().split("T")[0]
      : "unknown";
    return {
      periodKey,
      periodLabel,
      years,
      isAvailable: false,
      unavailableReason: `Only has trading history back to ${earliestDateStr}.`,
      startDate: targetDate.toISOString().split("T")[0],
      startPrice: currentPrice,
      currentPrice,
      lumpSum: { investedAmount: amount, sharesBought: 0, valueToday: amount, totalProfit: 0, returnPct: 0 },
      monthlyDca: { monthlyDeposit: amount, totalMonths: 0, totalInvested: 0, sharesBought: 0, valueToday: 0, totalProfit: 0, returnPct: 0 },
      drawdown: { maxDropPct: 0, peakPrice: currentPrice, peakDate: "N/A", troughPrice: currentPrice, troughDate: "N/A", isRecovered: true, recoveryDays: 0, recoveryExplanation: "Data not available." },
    };
  }

  // Find start candle on or immediately after targetSec (skipping weekends/holidays)
  const startCandle = findCandleOnOrAfter(candles, targetSec) || earliestCandle;
  const startPrice = startCandle.close;
  const startDateStr = new Date(toUnixSec(startCandle.time) * 1000).toISOString().split("T")[0];

  // 1. Lump Sum
  const lumpShares = startPrice > 0 ? amount / startPrice : 0;
  const lumpValueToday = Math.round(lumpShares * currentPrice * 100) / 100;
  const lumpProfit = Math.round((lumpValueToday - amount) * 100) / 100;
  const lumpReturnPct = amount > 0 ? Math.round(((lumpValueToday - amount) / amount) * 1000) / 10 : 0;

  // 2. Monthly Dollar-Cost Averaging (DCA)
  // Deposit $amount every month from targetDate to refDate
  const totalMonths = years * 12;
  let totalDcaShares = 0;
  let monthsContributed = 0;

  for (let m = 0; m < totalMonths; m++) {
    const mDate = new Date(targetDate);
    mDate.setMonth(targetDate.getMonth() + m);
    const mSec = Math.floor(mDate.getTime() / 1000);
    const candle = findCandleOnOrAfter(candles, mSec);
    if (candle && toUnixSec(candle.time) <= Math.floor(refDate.getTime() / 1000)) {
      if (candle.close > 0) {
        totalDcaShares += amount / candle.close;
        monthsContributed++;
      }
    }
  }

  const dcaInvested = amount * monthsContributed;
  const dcaValueToday = Math.round(totalDcaShares * currentPrice * 100) / 100;
  const dcaProfit = Math.round((dcaValueToday - dcaInvested) * 100) / 100;
  const dcaReturnPct = dcaInvested > 0 ? Math.round(((dcaValueToday - dcaInvested) / dcaInvested) * 1000) / 10 : 0;

  // 3. Drawdown in this period
  const periodCandles = candles.filter((c) => toUnixSec(c.time) >= toUnixSec(startCandle.time));
  const drawdown = calculateDrawdownAndRecovery(periodCandles, currentPrice);

  return {
    periodKey,
    periodLabel,
    years,
    isAvailable: true,
    startDate: startDateStr,
    startPrice,
    currentPrice,
    lumpSum: {
      investedAmount: amount,
      sharesBought: Math.round(lumpShares * 1000) / 1000,
      valueToday: lumpValueToday,
      totalProfit: lumpProfit,
      returnPct: lumpReturnPct,
    },
    monthlyDca: {
      monthlyDeposit: amount,
      totalMonths: monthsContributed,
      totalInvested: dcaInvested,
      sharesBought: Math.round(totalDcaShares * 1000) / 1000,
      valueToday: dcaValueToday,
      totalProfit: dcaProfit,
      returnPct: dcaReturnPct,
    },
    drawdown,
  };
}

/**
 * Complete "What if I'd invested earlier?" calculation for 1, 3, and 5 years.
 */
export function calculateInvestedEarlier(
  candles: CandleDataPoint[],
  amount: number = 100,
  currentPrice: number,
  symbol: string = ""
): InvestedEarlierAnalysis {
  const safeAmount = Math.max(1, isNaN(amount) ? 100 : amount);
  const safePrice = currentPrice > 0 ? currentPrice : candles.length > 0 ? candles[candles.length - 1].close : 100;

  if (!candles || candles.length === 0) {
    return {
      symbol,
      amount: safeAmount,
      currentPrice: safePrice,
      dataHistoryYears: 0,
      hasFullFiveYears: false,
      historyNotice: "No historical candle data is currently available.",
      scenarios: {
        "1Y": computeScenario([], 1, safeAmount, safePrice, new Date()),
        "3Y": computeScenario([], 3, safeAmount, safePrice, new Date()),
        "5Y": computeScenario([], 5, safeAmount, safePrice, new Date()),
      },
    };
  }

  // Reference date is latest candle date (or today)
  const latestCandle = candles[candles.length - 1];
  const earliestCandle = candles[0];
  const latestSec = toUnixSec(latestCandle.time);
  const earliestSec = toUnixSec(earliestCandle.time);
  const refDate = new Date(latestSec * 1000);

  const spanDays = Math.round((latestSec - earliestSec) / 86400);
  const dataHistoryYears = Math.round((spanDays / 365.25) * 10) / 10;
  const hasFullFiveYears = dataHistoryYears >= 4.8;

  let historyNotice: string | undefined = undefined;
  if (!hasFullFiveYears) {
    historyNotice = `This stock has about ${dataHistoryYears} years of public market records. Scenarios beyond its IPO date are marked unavailable.`;
  }

  return {
    symbol,
    amount: safeAmount,
    currentPrice: safePrice,
    dataHistoryYears,
    hasFullFiveYears,
    historyNotice,
    scenarios: {
      "1Y": computeScenario(candles, 1, safeAmount, safePrice, refDate),
      "3Y": computeScenario(candles, 3, safeAmount, safePrice, refDate),
      "5Y": computeScenario(candles, 5, safeAmount, safePrice, refDate),
    },
  };
}
