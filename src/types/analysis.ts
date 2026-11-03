import { z } from "zod";

export const KeyMetricExplanationSchema = z.object({
  metric: z.string().describe("Name of the metric, e.g. P/E Ratio, RSI (14), 52-Week Range"),
  value: z.union([z.string(), z.number()]).describe("The exact number or value provided"),
  plainEnglish: z.string().describe("Clear, educational, beginner-friendly explanation of what this specific number means"),
});

export const StockAnalysisSchema = z.object({
  summary: z.string().describe("2-3 balanced, educational sentences summarizing the stock's current financial and technical state using strictly the provided numbers"),
  strengths: z
    .array(z.string())
    .min(2)
    .max(5)
    .describe("2 to 4 positive fundamental or technical observations grounded in the provided data"),
  risks: z
    .array(z.string())
    .min(2)
    .max(5)
    .describe("2 to 4 cautionary factors or potential risks visible in the numbers"),
  technical_outlook: z
    .string()
    .describe("Objective overview of what moving averages, RSI, and MACD reflect about momentum and trend (without forecasting future prices)"),
  key_metrics_explained: z
    .array(KeyMetricExplanationSchema)
    .min(2)
    .max(6)
    .describe("Plain-English breakdown of key reported numbers for beginners"),
});

export type KeyMetricExplanation = z.infer<typeof KeyMetricExplanationSchema>;
export type StockAnalysisOutput = z.infer<typeof StockAnalysisSchema>;

export interface GroundTruthData {
  symbol: string;
  companyName: string;
  currentPrice: string;
  dailyChange: string;
  marketStatus: string;
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
}
