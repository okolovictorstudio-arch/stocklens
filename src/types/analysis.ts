import { z } from "zod";

export const KeyMetricExplanationSchema = z.object({
  metric: z.string().describe("Name of the metric, e.g. P/E Ratio, RSI (14), 52-Week Range"),
  value: z.union([z.string(), z.number()]).describe("The exact number or value provided"),
  plainEnglish: z.string().describe("Clear, educational, beginner-friendly explanation of what this specific number means"),
});

export const StockAnalysisSchema = z.object({
  summary: z.string().describe("2-3 balanced, educational sentences summarizing the stock's current financial and business state using strictly the provided numbers"),
  strengths: z
    .array(z.string())
    .min(2)
    .max(5)
    .describe("2 to 4 positive fundamental observations grounded in the provided data. Do not repeat P/E, Market Cap, or Beta if explained in Key Metrics."),
  risks: z
    .array(z.string())
    .min(2)
    .max(5)
    .describe("2 to 4 cautionary factors or potential risks visible in the numbers. Reword beta as 'tends to move a bit more (or less) than the overall market'."),
  technical_outlook: z
    .string()
    .describe("Everyday description of price trend in plain words. NEVER mention SMA, EMA, RSI, MACD, moving average, or histogram."),
  key_metrics_explained: z
    .array(KeyMetricExplanationSchema)
    .min(2)
    .max(6)
    .describe("Plain-English breakdown of key reported numbers for beginners. Explain each fact once."),
});

export type KeyMetricExplanation = z.infer<typeof KeyMetricExplanationSchema>;
export type StockAnalysisOutput = z.infer<typeof StockAnalysisSchema>;

export interface GroundTruthData {
  symbol: string;
  companyName: string;
  currentPrice: string;
  dailyChange: string;
  marketStatus: string;
  recentTrendLabel?: string;
  longTermTrendLabel?: string;
  momentumLabel?: string;
  sma20: string;
  sma50: string;
  sma200: string;
  ema20: string;
  rsi14: string;
  macd: {
    line: string;
    signal: string;
    histogram: string;
  };
  marketCap: string;
  peRatio: string;
  epsTTM: string;
  week52Range: string;
  dividendYield: string;
  beta: string;
  roe: string;
  recentEarningsSurprise?: string;
}

export interface StockAnalysisResponse {
  symbol: string;
  companyName: string;
  analysis: StockAnalysisOutput;
  groundTruthData: GroundTruthData;
  generatedAt: string;
  disclaimer: string;
  isCached?: boolean;
  isQuickSummary?: boolean;
  errorType?: string;
}

export const InvestedEarlierAISchema = z.object({
  summary: z
    .string()
    .describe(
      "2-3 short, friendly sentences summarizing what happened to the investment over time using strictly the provided numbers"
    ),
  lumpVsMonthlyLesson: z
    .string()
    .describe(
      "Clear, plain-language comparison of the lump sum result vs the fixed monthly deposits without declaring a 'winner'"
    ),
  drawdownLesson: z
    .string()
    .describe(
      "Everyday explanation of the biggest price drop experienced and how long it took to recover"
    ),
  disclaimer: z
    .string()
    .describe(
      "Mandatory disclaimer: 'Past performance does not predict the future. Informational only. Not financial advice.'"
    ),
});

export type InvestedEarlierAIResponse = z.infer<typeof InvestedEarlierAISchema>;

export const StockCompareAISchema = z.object({
  summary: z
    .string()
    .describe(
      "2-3 plain-language sentences highlighting the main profile differences between the two companies using only the provided numbers, without quoting live prices or picking a winner"
    ),
  tradeOffs: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe(
      "2 to 4 practical trade-offs for regular people (e.g. dividend income vs reinvested growth, volatility vs price stability)"
    ),
  takeaway: z
    .string()
    .describe(
      "A balanced takeaway reminding the reader that different companies suit different goals. No buy/sell advice or winner verdicts."
    ),
  disclaimer: z
    .string()
    .describe(
      "Standard disclaimer: 'Informational only. Not financial advice. Past performance does not predict the future.'"
    ),
});

export type StockCompareAIResponse = z.infer<typeof StockCompareAISchema>;
