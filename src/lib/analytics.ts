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
