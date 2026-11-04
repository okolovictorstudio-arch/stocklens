/**
 * Google Gemini AI client layer for StockLens.
 * Powered by the official @google/genai SDK with multi-model fallback chain,
 * strict quota management, structured output validation, and plain-language enforcement.
 */
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import {
  StockAnalysisSchema,
  type StockAnalysisOutput,
  type GroundTruthData,
  InvestedEarlierAISchema,
  type InvestedEarlierAIResponse,
  StockCompareAISchema,
  type StockCompareAIResponse,
} from "@/types/analysis";
import type { InvestmentScenario, StockCompareMetrics } from "@/lib/analytics";

// Default model hierarchy: primary fast-flash, then fallback lite, then 3.8
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
export const GEMINI_FALLBACK_MODELS =
  process.env.GEMINI_FALLBACK_MODELS || process.env.GEMINI_FALLBACK_MODEL || "gemini-3.1-flash-lite,gemini-3.8-flash";

export const DISCLAIMER_TEXT = "Informational only. Not financial advice.";

export type GeminiErrorType =
  | "DAILY_QUOTA_EXCEEDED"
  | "RATE_LIMITED"
  | "MODEL_UNAVAILABLE"
  | "NETWORK_ERROR"
  | "VALIDATION_ERROR"
  | "MISSING_KEY"
  | "UNKNOWN_ERROR";

export class GeminiAnalysisError extends Error {
  public readonly errorType: GeminiErrorType;

  constructor(message: string, errorType: GeminiErrorType) {
    super(message);
    this.name = "GeminiAnalysisError";
    this.errorType = errorType;
  }
}

/**
 * Global in-memory memory for exhausted models and startup call counter (survives dev HMR).
 */
interface ExhaustedModelEntry {
  exhaustedUntil: number;
  reason: "daily" | "rate" | "unavailable";
}

const gState = globalThis as unknown as {
  __geminiExhaustedModels?: Map<string, ExhaustedModelEntry>;
  __geminiTotalCallCount?: number;
};

if (!gState.__geminiExhaustedModels) {
  gState.__geminiExhaustedModels = new Map();
}
if (typeof gState.__geminiTotalCallCount !== "number") {
  gState.__geminiTotalCallCount = 0;
}

const exhaustedModels = gState.__geminiExhaustedModels;

function isModelExhausted(model: string): boolean {
  const entry = exhaustedModels.get(model);
  if (!entry) return false;
  if (Date.now() >= entry.exhaustedUntil) {
    exhaustedModels.delete(model);
    return false;
  }
  return true;
}

function markModelExhausted(model: string, reason: "daily" | "rate" | "unavailable", retryDelayMs?: number) {
  const durationMs =
    retryDelayMs && retryDelayMs > 0
      ? retryDelayMs
      : reason === "daily"
      ? 3600 * 1000 // Remember for 1 hour by default
      : reason === "rate"
      ? 60 * 1000 // 1 minute
      : 15 * 1000; // 15 seconds for 503
  const exhaustedUntil = Date.now() + durationMs;
  exhaustedModels.set(model, { exhaustedUntil, reason });
  console.warn(
    `[Gemini Quota] Model ${model} marked exhausted (${reason}) until ${new Date(
      exhaustedUntil
    ).toLocaleTimeString()} (${Math.round(durationMs / 1000)}s)`
  );
}

function recordGeminiCall(route: string, model: string) {
  gState.__geminiTotalCallCount = (gState.__geminiTotalCallCount || 0) + 1;
  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[Gemini Stats] Total Gemini calls since server startup: ${gState.__geminiTotalCallCount} (route=${route}, model=${model})`
    );
  }
}

export function getCandidateModels(): string[] {
  const primary = (process.env.GEMINI_MODEL || "gemini-3.5-flash-lite").trim();
  const fallbackRaw = (
    process.env.GEMINI_FALLBACK_MODELS ||
    process.env.GEMINI_FALLBACK_MODEL ||
    "gemini-3.1-flash-lite,gemini-3.8-flash"
  ).trim();

  const fallbacks = fallbackRaw
    .split(",")
    .map((m) => m.trim())
    .filter((m) => m.length > 0 && m !== primary);

  return [primary, ...fallbacks];
}

function getApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.trim() === "" || key.startsWith("your-")) {
    return null;
  }
  return key.trim();
}

function isDemoOrDevAllowed(): boolean {
  if (process.env.DEMO_MODE === "true") return true;
  if (process.env.NODE_ENV !== "production") return true;
  return false;
}

const SYSTEM_INSTRUCTION = `
You are StockLens AI, a friendly, honest friend who knows finance explaining stocks to normal people.
Your goal is to provide clear, calm, and strictly data-grounded explanations with zero Wall Street jargon.

CRITICAL PLAIN-LANGUAGE RULES:
1. Explain like a friendly, honest friend who knows finance.
2. Write for a smart 15-year-old. Short sentences.
3. NEVER USE TECHNICAL INDICATOR JARGON:
   - Do NOT use SMA, EMA, RSI, MACD, "moving average", or "histogram" anywhere.
   - Describe price movement using everyday words only (e.g. "over the past month the price has mostly moved sideways").
4. SHOW EACH FACT ONCE:
   - Do not repeat P/E, Market Cap, or Beta across Strengths and Risks if already described in Key Metrics.
   - Reword Beta as "tends to move a bit more (or less) than the overall market".
5. NEVER provide buy, sell, or hold recommendations under any circumstance.
6. NO future price predictions or speculative forecasts.
7. ONLY USE THE PROVIDED NUMBERS. Never invent, extrapolate, or hallucinate figures.
8. Always adhere strictly to the JSON schema output.
`.trim();

/**
 * Sanitizes server logs by redacting potential API keys and query tokens.
 */
function sanitizeLog(msg: string, apiKey?: string | null): string {
  let clean = msg;
  if (apiKey) {
    clean = clean.split(apiKey).join("[REDACTED_API_KEY]");
  }
  return clean
    .replace(/(?:key|token|api_key)=([^&\s]+)/gi, "$1=[REDACTED]")
    .replace(/AIza[0-9A-Za-z-_]{35}/g, "[REDACTED_GEMINI_KEY]");
}

/**
 * Resolves the lowest thinking configuration supported by the given model.
 */
function getThinkingConfig(model: string): { thinkingLevel: ThinkingLevel } | { thinkingBudget: number } {
  if (model.includes("3.8") || model.includes("3.5") || model.includes("3.1") || model.includes("3.")) {
    return { thinkingLevel: ThinkingLevel.LOW };
  }
  return { thinkingBudget: 0 };
}

/**
 * Extracts normalized HTTP status code and error classification from SDK errors.
 */
function extractHttpStatusAndType(err: unknown): {
  status: number | string;
  type: GeminiErrorType;
  isDaily: boolean;
  retryDelayMs?: number;
} {
  const statusNum = (err as { status?: number })?.status;
  const rawMsg = err instanceof Error ? err.message : String(err);
  const lower = rawMsg.toLowerCase();

  let detectedStatus: number | string = statusNum || "unknown";
  let detectedType: GeminiErrorType = "UNKNOWN_ERROR";
  let isDaily = false;
  let retryDelayMs: number | undefined = undefined;

  // Check for retryDelay in details
  const delayMatch = rawMsg.match(/"retryDelay"\s*:\s*"(\d+)s"/i);
  if (delayMatch) {
    retryDelayMs = parseInt(delayMatch[1], 10) * 1000;
  }

  if (lower.includes("429") || lower.includes("resource_exhausted") || detectedStatus === 429) {
    detectedStatus = 429;
    if (
      lower.includes("daily") ||
      lower.includes("per day") ||
      lower.includes("generaterequestsperday") ||
      lower.includes("limit: 20") ||
      lower.includes("limit: 500") ||
      (retryDelayMs && retryDelayMs > 3600 * 1000)
    ) {
      isDaily = true;
      detectedType = "DAILY_QUOTA_EXCEEDED";
    } else {
      detectedType = "RATE_LIMITED";
    }
  } else if (lower.includes("503") || lower.includes("unavailable") || lower.includes("overloaded") || detectedStatus === 503) {
    detectedStatus = 503;
    detectedType = "MODEL_UNAVAILABLE";
  } else if (lower.includes("400") || lower.includes("invalid_argument") || detectedStatus === 400) {
    detectedStatus = 400;
    detectedType = "UNKNOWN_ERROR";
  } else if (lower.includes("401") || lower.includes("403")) {
    detectedStatus = 403;
    detectedType = "MISSING_KEY";
  } else if (lower.includes("fetch failed") || lower.includes("enotfound")) {
    detectedStatus = "network";
    detectedType = "NETWORK_ERROR";
  }

  return { status: detectedStatus, type: detectedType, isDaily, retryDelayMs };
}

/**
 * Logs every Gemini attempt with route name, model, attempt number, deadline budget remaining, and outcome.
 * Never logs API keys or full prompts.
 */
export function logGeminiAttempt(params: {
  route: string;
  model: string;
  attempt: number;
  remainingMs: number;
  outcome: string;
}) {
  console.log(
    `[Gemini] route=${params.route} model=${params.model} attempt=${params.attempt} remaining=${params.remainingMs}ms outcome=${params.outcome}`
  );
}

/**
 * Executes a single generation call to Gemini with a strict AbortSignal timeout.
 */
async function callGeminiWithTimeout(
  ai: GoogleGenAI,
  model: string,
  prompt: string,
  timeoutMs: number,
  route: string,
  attempt: number,
  remainingMs: number
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const thinkingConfig = getThinkingConfig(model);

  recordGeminiCall(route, model);

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        temperature: 0.2,
        thinkingConfig,
        abortSignal: controller.signal,
      },
    });

    const text = response.text;
    if (!text || text.trim() === "") {
      logGeminiAttempt({
        route,
        model,
        attempt,
        remainingMs,
        outcome: "error HTTP 503 (empty response text)",
      });
      throw new GeminiAnalysisError("AI service is busy", "MODEL_UNAVAILABLE");
    }

    logGeminiAttempt({
      route,
      model,
      attempt,
      remainingMs,
      outcome: "success",
    });
    return text;
  } catch (err: unknown) {
    if (err instanceof GeminiAnalysisError) throw err;

    if (controller.signal.aborted) {
      logGeminiAttempt({
        route,
        model,
        attempt,
        remainingMs,
        outcome: `error TIMEOUT (exceeded ${timeoutMs}ms attempt budget)`,
      });
      throw new GeminiAnalysisError("AI service is busy", "MODEL_UNAVAILABLE");
    }

    const { status, type, isDaily, retryDelayMs } = extractHttpStatusAndType(err);
    logGeminiAttempt({
      route,
      model,
      attempt,
      remainingMs,
      outcome: `error HTTP ${status} (${type}${isDaily ? " daily" : ""})`,
    });

    if (type === "DAILY_QUOTA_EXCEEDED") {
      markModelExhausted(model, "daily", retryDelayMs);
    } else if (type === "RATE_LIMITED") {
      markModelExhausted(model, "rate", retryDelayMs || 60000);
    } else if (status === 503) {
      markModelExhausted(model, "unavailable", 15000);
    }

    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parses and validates text using Zod schema.
 */
function parseAndValidateOutput(text: string): { success: true; data: StockAnalysisOutput } | { success: false } {
  try {
    const rawJson = JSON.parse(text);
    const parsed = StockAnalysisSchema.safeParse(rawJson);
    if (parsed.success) {
      return { success: true, data: parsed.data };
    }
    return { success: false };
  } catch {
    return { success: false };
  }
}

/**
 * Generates stock analysis using a multi-model fallback chain and shared 25-second deadline.
 * - Tries models in order (GEMINI_MODEL -> GEMINI_FALLBACK_MODELS).
 * - On 429 daily limit or 503, immediately moves to the next candidate model.
 * - Remembers exhausted models for retryDelay or 1 hour so they are skipped in future requests.
 */
export async function generateStockAnalysis(
  data: GroundTruthData,
  deadlineTimestamp?: number,
  routeName: string = "/api/analyze"
): Promise<StockAnalysisOutput> {
  const apiKey = getApiKey();
  const deadline = deadlineTimestamp ?? Date.now() + 25000;
  const getRemainingMs = () => deadline - Date.now();

  if (!apiKey) {
    if (isDemoOrDevAllowed()) {
      return generateSampleAnalysis(data);
    }
    throw new GeminiAnalysisError(
      "Google Gemini API key not configured. Add GEMINI_API_KEY in .env.local to enable AI analysis.",
      "MISSING_KEY"
    );
  }

  // Construct prompt strictly avoiding indicator names and enforcing de-duplication
  const prompt = `
Analyze the financial overview and price movement for ${data.companyName} (${data.symbol}):

[VERIFIED COMPANY DATA]
- Symbol: ${data.symbol}
- Company: ${data.companyName}
- Current Price: ${data.currentPrice} (${data.dailyChange} today)
- Market Status: ${data.marketStatus}
- Recent Price Trend: ${data.recentTrendLabel || "moved with normal fluctuations"}
- Long-Term Trend: ${data.longTermTrendLabel || "trading near its recent average"}
- Momentum: ${data.momentumLabel || "balanced without extreme swings"}
- Market Capitalization: ${data.marketCap}
- P/E Ratio: ${data.peRatio}
- EPS (TTM): ${data.epsTTM}
- 52-Week Range: ${data.week52Range}
- Dividend Yield: ${data.dividendYield}
- Beta: ${data.beta}
- Return on Equity (ROE): ${data.roe}
- Recent Earnings Surprise: ${data.recentEarningsSurprise || "unavailable"}

CRITICAL PLAIN-LANGUAGE AND DE-DUPLICATION RULES:
1. NEVER USE INDICATOR NAMES OR VALUES:
   - Do NOT use SMA, EMA, RSI, MACD, "moving average", or "histogram" anywhere in your response.
   - Describe the price trend strictly using everyday words (e.g. "over the past month the price has mostly moved sideways", "it has risen steadily").
2. SHOW EACH FACT ONCE:
   - Do NOT repeat the company valuation (Market Cap), P/E ratio, or Beta in Strengths and Risks if they appear in Key Metrics.
   - Strengths must focus on business drivers (e.g. profitable operations, cash generation, balance sheet scale).
   - Risks must focus on business or valuation cautions (e.g. competitive pressures, consumer demand, economic shifts).
   - Key Metrics Explained provides a one-line plain English explanation of each reported number.
3. REWORD BETA:
   - Always explain beta as "tends to move a bit more (or less) than the overall market". Never use jargon.
4. NO BUY/SELL RECOMMENDATIONS:
   - Describe trade-offs, never advise to buy, sell, or hold.

Produce a structured JSON response matching the required schema:
{
  "summary": "2-3 balanced, beginner-friendly sentences",
  "strengths": ["2-4 points citing business facts without repeating P/E or Market Cap"],
  "risks": ["2-4 cautionary points citing business facts without repeating P/E or Market Cap"],
  "technical_outlook": "Everyday description of price trend in plain words. NEVER mention SMA, EMA, RSI, MACD, moving average, or histogram.",
  "key_metrics_explained": [
    { "metric": "name", "value": "value", "plainEnglish": "what this means" }
  ]
}
`.trim();

  const ai = new GoogleGenAI({ apiKey });
  const candidates = getCandidateModels();

  let lastErrorType: GeminiErrorType = "UNKNOWN_ERROR";
  let hasDailyExhaustionOnAny = false;
  let hasRateLimitOnAny = false;
  let has503OnAny = false;
  let attemptCounter = 0;

  for (const model of candidates) {
    attemptCounter++;
    const remainingMs = getRemainingMs();

    // Check if model is remembered as exhausted
    if (isModelExhausted(model)) {
      hasDailyExhaustionOnAny = true;
      logGeminiAttempt({
        route: routeName,
        model,
        attempt: attemptCounter,
        remainingMs,
        outcome: "skipped: model currently exhausted in cache",
      });
      continue;
    }

    // Check deadline budget before attempting this candidate
    if (remainingMs < 5000) {
      logGeminiAttempt({
        route: routeName,
        model,
        attempt: attemptCounter,
        remainingMs,
        outcome: "skipped: not enough time left",
      });
      break;
    }

    const timeout = Math.min(10000, remainingMs);

    try {
      const text = await callGeminiWithTimeout(ai, model, prompt, timeout, routeName, attemptCounter, remainingMs);
      const parsed = parseAndValidateOutput(text);
      if (parsed.success) {
        return parsed.data;
      }

      // Schema validation failed: retry once if time permits
      const remainingRetry = getRemainingMs();
      if (remainingRetry >= 5000) {
        const timeoutRetry = Math.min(10000, remainingRetry);
        const textRetry = await callGeminiWithTimeout(
          ai,
          model,
          prompt,
          timeoutRetry,
          routeName,
          attemptCounter + 1,
          remainingRetry
        );
        const parsedRetry = parseAndValidateOutput(textRetry);
        if (parsedRetry.success) {
          return parsedRetry.data;
        }
      }
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      const { type, isDaily } = extractHttpStatusAndType(err);
      lastErrorType = type;

      if (isDaily || type === "DAILY_QUOTA_EXCEEDED") {
        hasDailyExhaustionOnAny = true;
      } else if (type === "RATE_LIMITED") {
        hasRateLimitOnAny = true;
      } else if (type === "MODEL_UNAVAILABLE") {
        has503OnAny = true;
      }

      console.warn(
        `[Gemini Fallback] Model ${model} failed (${type}: ${sanitizeLog(rawMsg, apiKey)}). Moving to next model if available...`
      );
      // Fall through to next model in candidates chain
    }
  }

  // All candidate models failed or exhausted
  if (hasDailyExhaustionOnAny) {
    throw new GeminiAnalysisError(
      "AI explanations have reached their daily limit and return tomorrow. Numbers, charts and the history card still work.",
      "DAILY_QUOTA_EXCEEDED"
    );
  }

  if (hasRateLimitOnAny) {
    throw new GeminiAnalysisError("Try again in a few seconds", "RATE_LIMITED");
  }

  if (has503OnAny) {
    throw new GeminiAnalysisError("AI service is busy", "MODEL_UNAVAILABLE");
  }

  if (lastErrorType === "MISSING_KEY") {
    throw new GeminiAnalysisError(
      "Invalid Google Gemini API key. Please check your GEMINI_API_KEY in .env.local.",
      "MISSING_KEY"
    );
  }

  throw new GeminiAnalysisError("Something went wrong on our side.", "UNKNOWN_ERROR");
}

/**
 * Fallback generator for demo/local testing when no API key is provided.
 */
function generateSampleAnalysis(data: GroundTruthData): StockAnalysisOutput {
  const trendText = data.recentTrendLabel
    ? `${data.recentTrendLabel.charAt(0).toUpperCase() + data.recentTrendLabel.slice(1)}, and is currently ${data.longTermTrendLabel || "trading near its recent average"}. Price momentum is ${data.momentumLabel || "balanced"}.`
    : `Over the past month the price has mostly moved sideways. Price momentum remains balanced without extreme swings.`;

  return {
    summary: `${data.companyName} (${data.symbol}) is currently priced at ${data.currentPrice}. The whole company is valued at about ${data.marketCap} and trades at about $${data.peRatio} for every $1 the company earns in a year.`,
    strengths: [
      `The company is valued at about ${data.marketCap}, providing deep financial stability and industry scale.`,
      `Consistently profitable, producing about ${data.epsTTM} in profit per share over the past year.`,
      data.dividendYield !== "unavailable" && data.dividendYield !== "0.00%"
        ? `Pays cash back to shareholders with an annual dividend yield of about ${data.dividendYield}.`
        : `Reinvests all profits back into research, hiring, and expanding operations rather than paying cash out.`,
    ],
    risks: [
      `A Beta of ${data.beta} means the stock tends to move a bit ${parseFloat(data.beta) > 1 ? "more" : "less"} than the overall market.`,
      `Has traded between ${data.week52Range} over the past year, reflecting normal market price swings.`,
      `Shifts in consumer demand or economic conditions could impact future revenue and profit margins.`,
    ],
    technical_outlook: trendText,
    key_metrics_explained: [
      {
        metric: "P/E Ratio",
        value: data.peRatio,
        plainEnglish: `You pay about $${data.peRatio} for every $1 the company earns in a year.`,
      },
      {
        metric: "Market Valuation",
        value: data.marketCap,
        plainEnglish: `The whole company is valued at about ${data.marketCap}.`,
      },
      {
        metric: "52-Week Range",
        value: data.week52Range,
        plainEnglish: `The lowest and highest prices the stock traded at over the past 12 months.`,
      },
      {
        metric: "Return on Equity (ROE)",
        value: data.roe,
        plainEnglish: `Management turned each $100 of shareholder capital into about $${data.roe} of profit.`,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// "What if I'd invested earlier?" AI Generator
// ---------------------------------------------------------------------------

export interface InvestedEarlierPromptData {
  symbol: string;
  companyName: string;
  amount: number;
  currentPrice: number;
  dataHistoryYears: number;
  scenarios: {
    "1Y": InvestmentScenario;
    "3Y": InvestmentScenario;
    "5Y": InvestmentScenario;
  };
}

export async function generateInvestedEarlierAI(
  data: InvestedEarlierPromptData,
  deadlineTimestamp?: number,
  routeName: string = "/api/invested-earlier"
): Promise<InvestedEarlierAIResponse> {
  const apiKey = getApiKey();
  const deadline = deadlineTimestamp ?? Date.now() + 25000;
  const getRemainingMs = () => deadline - Date.now();

  if (!apiKey) {
    if (isDemoOrDevAllowed()) {
      return generateSampleInvestedEarlierAI(data);
    }
    throw new GeminiAnalysisError(
      "Google Gemini API key not configured. Add GEMINI_API_KEY in .env.local to enable AI analysis.",
      "MISSING_KEY"
    );
  }

  const formatScenario = (sc: InvestmentScenario) => {
    if (!sc.isAvailable) {
      return `${sc.periodLabel}: Not available (${sc.unavailableReason || "Company began trading more recently"})`;
    }
    return `
${sc.periodLabel} (Started on ${sc.startDate} at $${sc.startPrice.toFixed(2)}):
- Lump Sum: $${sc.lumpSum.investedAmount} grew to $${sc.lumpSum.valueToday.toFixed(2)} (${sc.lumpSum.returnPct >= 0 ? "+" : ""}${sc.lumpSum.returnPct}%).
- Monthly Deposits: $${sc.monthlyDca.monthlyDeposit}/mo across ${sc.monthlyDca.totalMonths} months ($${sc.monthlyDca.totalInvested.toFixed(2)} total invested) grew to $${sc.monthlyDca.valueToday.toFixed(2)} (${sc.monthlyDca.returnPct >= 0 ? "+" : ""}${sc.monthlyDca.returnPct}%).
- Worst Drop: Fell ${sc.drawdown.maxDropPct}% between ${sc.drawdown.peakDate} ($${sc.drawdown.peakPrice.toFixed(2)}) and ${sc.drawdown.troughDate} ($${sc.drawdown.troughPrice.toFixed(2)}). Recovery: ${sc.drawdown.recoveryExplanation}
    `.trim();
  };

  const prompt = `
You are StockLens AI, explaining historical investment results for ${data.companyName} (${data.symbol}) to a normal person (smart 15-year-old).
Write clear, short sentences. Absolutely no financial jargon without a one-line explanation.
Strictly ground your explanation in the numbers provided below.

VERIFIED CALCULATED NUMBERS:
- Symbol: ${data.symbol} (${data.companyName})
- Current Price: $${data.currentPrice.toFixed(2)}
- Base Amount Tested: $${data.amount}
- Public Trading History: about ${data.dataHistoryYears} years

SCENARIO OUTCOMES:
${formatScenario(data.scenarios["1Y"])}
${formatScenario(data.scenarios["3Y"])}
${formatScenario(data.scenarios["5Y"])}

RULES:
1. Use ONLY the numbers provided above.
2. Avoid general claims or broad generalizations about investing strategies (do NOT say 'DCA is always better' or 'timing the market is impossible'). Only describe what happened with these exact numbers over these specific timeframes.
3. Compare lump sum vs fixed monthly in plain terms without declaring a "winner". Note that lump sum puts all money to work on Day 1, while monthly deposits spread purchases over time.
4. Highlight the biggest drop and how long it took to recover.
5. NEVER call any period the "best time to buy" or "worst time to buy". Never recommend buying, selling, or timing the market.
6. Emphasize: "Past performance does not predict the future."
7. Provide output in JSON matching:
{
  "summary": "...",
  "lumpVsMonthlyLesson": "...",
  "drawdownLesson": "...",
  "disclaimer": "Past performance does not predict the future. Informational only. Not financial advice."
}
`.trim();

  const ai = new GoogleGenAI({ apiKey });
  const candidates = getCandidateModels();

  let attemptCounter = 0;
  let hasDailyExhaustion = false;
  let hasRateLimit = false;

  for (const model of candidates) {
    attemptCounter++;
    const remainingMs = getRemainingMs();

    if (isModelExhausted(model)) {
      hasDailyExhaustion = true;
      logGeminiAttempt({
        route: routeName,
        model,
        attempt: attemptCounter,
        remainingMs,
        outcome: "skipped: model currently exhausted in cache",
      });
      continue;
    }

    if (remainingMs < 5000) {
      logGeminiAttempt({
        route: routeName,
        model,
        attempt: attemptCounter,
        remainingMs,
        outcome: "skipped: not enough time left",
      });
      break;
    }

    const timeout = Math.min(10000, remainingMs);

    try {
      const text = await callGeminiWithTimeout(ai, model, prompt, timeout, routeName, attemptCounter, remainingMs);
      const parsed = parseAndValidateInvestedEarlier(text);
      if (parsed.success) {
        return parsed.data;
      }

      // Retry once if time permits
      const remainingRetry = getRemainingMs();
      if (remainingRetry >= 5000) {
        const timeoutRetry = Math.min(10000, remainingRetry);
        const textRetry = await callGeminiWithTimeout(
          ai,
          model,
          prompt,
          timeoutRetry,
          routeName,
          attemptCounter + 1,
          remainingRetry
        );
        const parsedRetry = parseAndValidateInvestedEarlier(textRetry);
        if (parsedRetry.success) {
          return parsedRetry.data;
        }
      }
    } catch (err: unknown) {
      const { type, isDaily } = extractHttpStatusAndType(err);
      if (isDaily || type === "DAILY_QUOTA_EXCEEDED") {
        hasDailyExhaustion = true;
      } else if (type === "RATE_LIMITED") {
        hasRateLimit = true;
      }
      // Fall through to next model
    }
  }

  if (hasDailyExhaustion) {
    throw new GeminiAnalysisError(
      "AI explanations have reached their daily limit and return tomorrow. Numbers, charts and the history card still work.",
      "DAILY_QUOTA_EXCEEDED"
    );
  }

  if (hasRateLimit) {
    throw new GeminiAnalysisError("Try again in a few seconds", "RATE_LIMITED");
  }

  throw new GeminiAnalysisError("AI service is busy", "MODEL_UNAVAILABLE");
}

function parseAndValidateInvestedEarlier(text: string): { success: true; data: InvestedEarlierAIResponse } | { success: false } {
  try {
    const json = JSON.parse(text);
    const result = InvestedEarlierAISchema.safeParse(json);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false };
  } catch {
    return { success: false };
  }
}

function generateSampleInvestedEarlierAI(data: InvestedEarlierPromptData): InvestedEarlierAIResponse {
  const sc1 = data.scenarios["1Y"];
  const sc5 = data.scenarios["5Y"].isAvailable ? data.scenarios["5Y"] : data.scenarios["3Y"].isAvailable ? data.scenarios["3Y"] : sc1;

  return {
    summary: `If you had put $${data.amount} into ${data.companyName} 1 year ago, it would be worth about $${sc1.lumpSum.valueToday.toFixed(2)} today (${sc1.lumpSum.returnPct >= 0 ? "+" : ""}${sc1.lumpSum.returnPct}%). Over ${sc5.years} years, that same initial $${data.amount} grew into about $${sc5.lumpSum.valueToday.toFixed(2)}.`,
    lumpVsMonthlyLesson: `Putting in a lump sum of $${data.amount} upfront took immediate advantage of early price levels, while putting in $${data.amount} every month spread your risk across ${sc5.monthlyDca.totalMonths} separate purchases, totaling $${sc5.monthlyDca.totalInvested.toFixed(2)} invested.`,
    drawdownLesson: `Investing is rarely a straight line up. Over the past ${sc5.years} years, the biggest drop was around ${sc5.drawdown.maxDropPct}%. ${sc5.drawdown.recoveryExplanation}`,
    disclaimer: "Past performance does not predict the future. Informational only. Not financial advice.",
  };
}

/**
 * Generates an objective, plain-language comparison between two stocks via Gemini.
 * Follows multi-model fallback chain, shared 25-second deadline, and strict no-jargon/no-winner rules.
 */
export async function generateStockComparisonAI(
  stockA: StockCompareMetrics,
  stockB: StockCompareMetrics,
  deadlineTimestamp: number,
  routeName: string = "/api/compare"
): Promise<StockCompareAIResponse> {
  const apiKey = getApiKey();

  if (!apiKey) {
    if (isDemoOrDevAllowed()) {
      return generateSampleStockCompareAI(stockA, stockB);
    }
    throw new GeminiAnalysisError(
      "Gemini API key is not configured.",
      "MISSING_KEY"
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const candidates = getCandidateModels();

  let hasDailyExhaustion = false;
  let hasRateLimit = false;
  let attemptCounter = 0;

  const prompt = `
You are a calm, objective financial educator writing for regular people (like a smart 15-year-old).
Explain the main differences and practical trade-offs between these two companies.

COMPANY A: ${stockA.companyName} (${stockA.symbol})
- Valuation / Size: ${stockA.companySizeWords}
- 1-Year Price Return: ${stockA.return1Y !== null ? `${stockA.return1Y}%` : "Not enough 1Y data"}
- Cash Dividends: ${stockA.dividendLabel}
- Volatility / Ups & Downs: ${stockA.upsAndDownsLabel}
- Yearly Price Position: ${stockA.pricePositionLabel}

COMPANY B: ${stockB.companyName} (${stockB.symbol})
- Valuation / Size: ${stockB.companySizeWords}
- 1-Year Price Return: ${stockB.return1Y !== null ? `${stockB.return1Y}%` : "Not enough 1Y data"}
- Cash Dividends: ${stockB.dividendLabel}
- Volatility / Ups & Downs: ${stockB.upsAndDownsLabel}
- Yearly Price Position: ${stockB.pricePositionLabel}

STRICT PLAIN-LANGUAGE AND COMPARISON RULES:
1. DO NOT quote live fluctuating share prices (e.g. do not say "Trading at $240 vs $420"). Focus on relative performance, business size, dividends, and volatility.
2. NEVER declare a "winner" or say one stock is "better" or a "buy". Describe differences, characteristics, and trade-offs neutrally.
3. NO technical indicator names or jargon: NEVER use SMA, EMA, RSI, MACD, moving average, or histogram.
4. Use ONLY the verified numbers provided above. Never invent extra numbers.
5. Keep sentences short, conversational, and easy to understand.
6. Provide 2 to 4 specific practical trade-offs for normal people (e.g. income from dividends vs growth from reinvestment, calm price stability vs bigger swings).
7. Must include mandatory disclaimer: "Informational only. Not financial advice. Past performance does not predict the future."

Respond strictly in valid JSON matching this schema:
{
  "summary": "2-3 plain-language sentences highlighting the main profile differences without live prices or winners",
  "tradeOffs": ["trade-off 1", "trade-off 2", "trade-off 3"],
  "takeaway": "balanced takeaway for normal people without advice",
  "disclaimer": "Informational only. Not financial advice. Past performance does not predict the future."
}
`.trim();

  for (const model of candidates) {
    attemptCounter++;
    const remainingMs = deadlineTimestamp - Date.now();

    if (isModelExhausted(model)) {
      logGeminiAttempt({
        route: routeName,
        model,
        attempt: attemptCounter,
        remainingMs,
        outcome: "skipped: model currently exhausted in cache",
      });
      continue;
    }

    if (remainingMs < 5000) {
      logGeminiAttempt({
        route: routeName,
        model,
        attempt: attemptCounter,
        remainingMs,
        outcome: "skipped: not enough time left",
      });
      break;
    }

    const timeout = Math.min(10000, remainingMs);

    try {
      const text = await callGeminiWithTimeout(ai, model, prompt, timeout, routeName, attemptCounter, remainingMs);
      const parsed = parseAndValidateCompare(text);
      if (parsed.success) {
        return parsed.data;
      }
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      const { type, isDaily, retryDelayMs } = extractHttpStatusAndType(err);
      if (isDaily || type === "DAILY_QUOTA_EXCEEDED") {
        hasDailyExhaustion = true;
        markModelExhausted(model, "daily", retryDelayMs);
      } else if (type === "RATE_LIMITED") {
        hasRateLimit = true;
        markModelExhausted(model, "rate", retryDelayMs);
      } else if (type === "MODEL_UNAVAILABLE") {
        markModelExhausted(model, "unavailable");
      }

      console.warn(
        `[Gemini Fallback] Model ${model} failed in ${routeName} (${type}: ${sanitizeLog(rawMsg, apiKey)}). Moving to next model if available...`
      );
    }
  }

  if (hasDailyExhaustion) {
    throw new GeminiAnalysisError(
      "AI explanations have reached their daily limit and return tomorrow. Numbers, charts and the history card still work.",
      "DAILY_QUOTA_EXCEEDED"
    );
  }

  if (hasRateLimit) {
    throw new GeminiAnalysisError("Try again in a few seconds", "RATE_LIMITED");
  }

  throw new GeminiAnalysisError("AI service is busy", "MODEL_UNAVAILABLE");
}

function parseAndValidateCompare(text: string): { success: true; data: StockCompareAIResponse } | { success: false } {
  try {
    const json = JSON.parse(text);
    const result = StockCompareAISchema.safeParse(json);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false };
  } catch {
    return { success: false };
  }
}

function generateSampleStockCompareAI(
  stockA: StockCompareMetrics,
  stockB: StockCompareMetrics
): StockCompareAIResponse {
  const paysA = (stockA.dividendYield || 0) > 0;
  const paysB = (stockB.dividendYield || 0) > 0;

  const tradeOffs: string[] = [
    `Company Size: ${stockA.companyName} is valued at ${stockA.companySizeWords}, while ${stockB.companyName} is valued at ${stockB.companySizeWords}.`,
    paysA !== paysB
      ? `Dividends: ${paysA ? stockA.companyName : stockB.companyName} pays cash dividends (${paysA ? stockA.dividendLabel : stockB.dividendLabel}), whereas ${paysA ? stockB.companyName : stockA.companyName} reinvests all profits back into expanding operations.`
      : `Dividends: ${paysA ? "Both companies distribute cash dividends to shareholders." : "Neither company pays cash dividends, choosing to fund ongoing growth instead."}`,
    `Price Swings: ${stockA.companyName}'s volatility is rated as ${stockA.upsAndDownsLabel.toLowerCase()}, compared to ${stockB.upsAndDownsLabel.toLowerCase()} for ${stockB.companyName}.`,
  ];

  return {
    summary: `${stockA.companyName} and ${stockB.companyName} represent two distinct market profiles. ${stockA.companyName} is rated as ${stockA.upsAndDownsLabel.toLowerCase()} with a 1-year return of ${stockA.return1Y !== null ? `${stockA.return1Y}%` : "steady trend"}, while ${stockB.companyName} is rated as ${stockB.upsAndDownsLabel.toLowerCase()}.`,
    tradeOffs,
    takeaway: "Neither company is universally 'better'—investors seeking regular income look at dividend yield, while those prioritizing long-term growth focus on reinvestment.",
    disclaimer: "Informational only. Not financial advice. Past performance does not predict the future.",
  };
}
