/**
 * Google Gemini AI client layer for StockLens.
 * Powered by the official @google/genai SDK with structured output validation,
 * hard timeouts, selective retries, and fallback model support.
 */
import { GoogleGenAI } from "@google/genai";
import { StockAnalysisSchema, type StockAnalysisOutput, type GroundTruthData } from "@/types/analysis";

// Primary free-tier Flash model in Google AI Studio
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
export const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "";

export const DISCLAIMER_TEXT = "Informational only. Not financial advice.";

export type GeminiErrorType =
  | "MISSING_KEY"
  | "QUOTA_EXCEEDED"
  | "MODEL_UNAVAILABLE"
  | "NETWORK_ERROR"
  | "VALIDATION_ERROR"
  | "UNKNOWN_ERROR";

export class GeminiAnalysisError extends Error {
  public readonly errorType: GeminiErrorType;

  constructor(message: string, errorType: GeminiErrorType) {
    super(message);
    this.name = "GeminiAnalysisError";
    this.errorType = errorType;
  }
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
3. NO financial jargon without an immediate one-line explanation in everyday words:
   - P/E ratio: "You pay about $X for every $1 the company earns in a year."
   - Market cap: "The whole company is valued at about $X."
   - Beta: "Moves more or less than the overall market."
4. NEVER provide buy, sell, or hold recommendations under any circumstance.
5. NEVER say "good investment", "bad investment", "undervalued", or "overvalued". Describe differences and trade-offs, never recommend.
6. NO future price predictions or speculative forecasts.
7. ONLY USE THE PROVIDED NUMBERS. Never invent, extrapolate, or hallucinate figures.
8. If any metric is labeled "unavailable", state clearly that it is not currently reported and do not guess.
9. Always adhere strictly to the JSON schema output.
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
 * Executes a single generation call to Gemini with a strict AbortSignal timeout.
 */
async function callGeminiWithTimeout(
  ai: GoogleGenAI,
  model: string,
  prompt: string,
  timeoutMs: number = 10000
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        temperature: 0.2,
        abortSignal: controller.signal,
      },
    });

    const text = response.text;
    if (!text || text.trim() === "") {
      throw new GeminiAnalysisError(
        "The AI service is busy, try again in a minute.",
        "MODEL_UNAVAILABLE"
      );
    }
    return text;
  } catch (err: unknown) {
    if (err instanceof GeminiAnalysisError) throw err;

    if (controller.signal.aborted) {
      throw new GeminiAnalysisError(
        "The AI service is busy, try again in a minute.",
        "MODEL_UNAVAILABLE"
      );
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

function is503Error(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("503") || m.includes("unavailable") || m.includes("overloaded");
}

function isQuotaError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("429") || m.includes("resource_exhausted") || m.includes("quota") || m.includes("rate");
}

function isAuthError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("401") || m.includes("403") || m.includes("unauthenticated") || m.includes("permission");
}

function isNotFoundError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("404") || m.includes("not found");
}

/**
 * Generates stock analysis with a shared 25-second overall deadline.
 * - Each attempt's timeout is min(10 seconds, time remaining).
 * - Never starts a retry or fallback with less than 5 seconds remaining.
 * - Returns a friendly "The AI service is busy, try again in a minute." error when budget expires.
 */
export async function generateStockAnalysis(
  data: GroundTruthData,
  deadlineTimestamp?: number
): Promise<StockAnalysisOutput> {
  const apiKey = getApiKey();
  const deadline = deadlineTimestamp ?? (Date.now() + 25000);
  const getRemainingMs = () => deadline - Date.now();

  // If no API key configured:
  if (!apiKey) {
    if (isDemoOrDevAllowed()) {
      return generateSampleAnalysis(data);
    }
    throw new GeminiAnalysisError(
      "Google Gemini API key not configured. Add GEMINI_API_KEY in .env.local to enable AI analysis.",
      "MISSING_KEY"
    );
  }

  const prompt = `
Analyze the following financial and technical data for ${data.companyName} (${data.symbol}):

[VERIFIED METRICS]
- Symbol: ${data.symbol}
- Company: ${data.companyName}
- Current Price: ${data.currentPrice} (${data.dailyChange} today)
- Market Status: ${data.marketStatus}
- 20-Day SMA: ${data.sma20}
- 50-Day SMA: ${data.sma50}
- 200-Day SMA: ${data.sma200}
- 20-Day EMA: ${data.ema20}
- 14-Day RSI: ${data.rsi14}
- MACD Line: ${data.macd.line}, Signal: ${data.macd.signal}, Histogram: ${data.macd.histogram}
- Market Capitalization: ${data.marketCap}
- P/E Ratio: ${data.peRatio}
- EPS (TTM): ${data.epsTTM}
- 52-Week Range: ${data.week52Range}
- Dividend Yield: ${data.dividendYield}
- Beta (Volatility): ${data.beta}
- Return on Equity (ROE): ${data.roe}
- Recent Earnings Surprise: ${data.recentEarningsSurprise || "unavailable"}

Produce a structured JSON response matching the required schema:
{
  "summary": "2-3 balanced, beginner-friendly sentences",
  "strengths": ["2-4 points citing real numbers"],
  "risks": ["2-4 cautionary points citing real numbers"],
  "technical_outlook": "Objective description of moving averages, RSI, and MACD",
  "key_metrics_explained": [
    { "metric": "name", "value": "value", "plainEnglish": "what this means" }
  ]
}
`.trim();

  const ai = new GoogleGenAI({ apiKey });
  const activeModel = GEMINI_MODEL;

  // Check remaining time before Attempt 1
  const remaining1 = getRemainingMs();
  if (remaining1 < 5000) {
    throw new GeminiAnalysisError(
      "The AI service is busy, try again in a minute.",
      "MODEL_UNAVAILABLE"
    );
  }

  const timeout1 = Math.min(10000, remaining1);

  try {
    // Attempt 1 with primary model (capped at min(10s, remaining))
    const text1 = await callGeminiWithTimeout(ai, activeModel, prompt, timeout1);
    const parsed1 = parseAndValidateOutput(text1);

    if (parsed1.success) {
      return parsed1.data;
    }

    // Schema validation failed: RETRY ONCE if at least 5s remaining
    const remainingRetry = getRemainingMs();
    if (remainingRetry < 5000) {
      throw new GeminiAnalysisError(
        "The AI service is busy, try again in a minute.",
        "MODEL_UNAVAILABLE"
      );
    }

    console.warn("[Gemini] Output failed schema validation. Retrying within remaining time budget...");
    const timeoutRetry = Math.min(10000, remainingRetry);
    const textRetry = await callGeminiWithTimeout(ai, activeModel, prompt, timeoutRetry);
    const parsedRetry = parseAndValidateOutput(textRetry);

    if (parsedRetry.success) {
      return parsedRetry.data;
    }

    throw new GeminiAnalysisError(
      "The AI service is busy, try again in a minute.",
      "VALIDATION_ERROR"
    );
  } catch (err: unknown) {
    if (err instanceof GeminiAnalysisError && (err.errorType === "NETWORK_ERROR" || err.errorType === "VALIDATION_ERROR" || err.errorType === "MODEL_UNAVAILABLE")) {
      throw err;
    }

    const rawMsg = err instanceof Error ? err.message : String(err);
    console.error("[Gemini Attempt 1 Error]:", sanitizeLog(rawMsg, apiKey));

    // Never retry on 401, 403, 404, or 429
    if (isAuthError(rawMsg)) {
      throw new GeminiAnalysisError(
        "Invalid Google Gemini API key. Please check your GEMINI_API_KEY in .env.local.",
        "MISSING_KEY"
      );
    }
    if (isQuotaError(rawMsg)) {
      throw new GeminiAnalysisError(
        "The AI service free-tier quota has been reached for this minute. Please try again shortly.",
        "QUOTA_EXCEEDED"
      );
    }
    if (isNotFoundError(rawMsg)) {
      throw new GeminiAnalysisError(
        `The requested AI model (${activeModel}) was not found. Please verify your GEMINI_MODEL setting.`,
        "MODEL_UNAVAILABLE"
      );
    }

    // Handle 503 / UNAVAILABLE: at most 1 retry after 1.5s delay if time permits (>=6.5s)
    if (is503Error(rawMsg)) {
      const remainingFor503 = getRemainingMs();
      if (remainingFor503 < 6500) {
        throw new GeminiAnalysisError(
          "The AI service is busy, try again in a minute.",
          "MODEL_UNAVAILABLE"
        );
      }

      console.warn("[Gemini] Model reported 503/UNAVAILABLE. Waiting 1.5s before retry...");
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const remaining2 = getRemainingMs();
      if (remaining2 < 5000) {
        throw new GeminiAnalysisError(
          "The AI service is busy, try again in a minute.",
          "MODEL_UNAVAILABLE"
        );
      }

      const timeout2 = Math.min(10000, remaining2);

      try {
        const text2 = await callGeminiWithTimeout(ai, activeModel, prompt, timeout2);
        const parsed2 = parseAndValidateOutput(text2);
        if (parsed2.success) {
          return parsed2.data;
        }
      } catch (err2: unknown) {
        const rawMsg2 = err2 instanceof Error ? err2.message : String(err2);
        console.error("[Gemini Attempt 2 Error]:", sanitizeLog(rawMsg2, apiKey));

        // Optional fallback: if 503 twice and GEMINI_FALLBACK_MODEL is configured
        if (is503Error(rawMsg2) && GEMINI_FALLBACK_MODEL.trim() !== "") {
          const remainingFallback = getRemainingMs();
          if (remainingFallback < 5000) {
            throw new GeminiAnalysisError(
              "The AI service is busy, try again in a minute.",
              "MODEL_UNAVAILABLE"
            );
          }

          const timeoutFallback = Math.min(10000, remainingFallback);
          const fallbackModel = GEMINI_FALLBACK_MODEL.trim();
          console.warn(`[Gemini] Primary model 503 twice. Attempting fallback model (${fallbackModel})...`);
          try {
            const textFallback = await callGeminiWithTimeout(ai, fallbackModel, prompt, timeoutFallback);
            const parsedFallback = parseAndValidateOutput(textFallback);
            if (parsedFallback.success) {
              return parsedFallback.data;
            }
          } catch (errFallback: unknown) {
            console.error(
              "[Gemini Fallback Model Error]:",
              sanitizeLog(errFallback instanceof Error ? errFallback.message : String(errFallback), apiKey)
            );
          }
        }
      }

      throw new GeminiAnalysisError(
        "The AI service is busy, try again in a minute.",
        "MODEL_UNAVAILABLE"
      );
    }

    // Network / other connection failures
    const lower = rawMsg.toLowerCase();
    if (lower.includes("fetch failed") || lower.includes("enotfound") || lower.includes("econnrefused")) {
      throw new GeminiAnalysisError(
        "Unable to connect to the AI service. Please check your network connection.",
        "NETWORK_ERROR"
      );
    }

    throw new GeminiAnalysisError(
      "The AI service is busy, try again in a minute.",
      "MODEL_UNAVAILABLE"
    );
  }
}

/**
 * Fallback generator for demo/local testing when no API key is provided.
 */
function generateSampleAnalysis(data: GroundTruthData): StockAnalysisOutput {
  return {
    summary: `${data.companyName} (${data.symbol}) is currently priced at ${data.currentPrice}. The whole company is valued at ${data.marketCap} and trades at about ${data.peRatio} times its yearly earnings, showing steady investor interest.`,
    strengths: [
      `The company is valued at ${data.marketCap}, providing deep financial stability and industry scale.`,
      `Consistently profitable, earning ${data.epsTTM} in profit per share over the past year.`,
      data.dividendYield !== "unavailable" && data.dividendYield !== "0.00%"
        ? `Pays cash back to shareholders with an annual dividend yield of ${data.dividendYield}.`
        : `Reinvests all profits back into research and expanding operations rather than paying cash out.`,
    ],
    risks: [
      `A Beta of ${data.beta} means the stock's price will swing alongside broader market mood.`,
      `Has traded between ${data.week52Range} over the past year, so sudden macroeconomic shifts can affect the price.`,
      `Competition or changes in consumer demand could affect future profit margins.`,
    ],
    technical_outlook: `The 14-day momentum gauge (RSI) is at ${data.rsi14}, sitting safely in the middle without extreme spikes. The 20-day moving average is ${data.sma20}, showing steady recent price action.`,
    key_metrics_explained: [
      {
        metric: "P/E Ratio",
        value: data.peRatio,
        plainEnglish: `You pay about $${data.peRatio} for every $1 the company earns in a year.`,
      },
      {
        metric: "Market Cap",
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
