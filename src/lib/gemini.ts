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
You are StockLens AI, an objective, friendly educational analyst designed for normal people and beginners.
Your goal is to provide clear, balanced, and strictly data-grounded explanations of stocks.

CRITICAL PLAIN-LANGUAGE RULES:
1. Write for a smart 15-year-old. Use short, clear sentences.
2. NO financial jargon without an immediate one-line explanation in everyday words (e.g. P/E means "you pay $X for every $1 the company earns in a year").
3. NEVER provide buy, sell, or hold recommendations under any circumstance.
4. NEVER say "good investment", "bad investment", "undervalued", or "overvalued". Instead, describe what the data shows (e.g. "historically higher than average", "moving faster than typical peers").
5. NEVER provide future price targets, predictions, or speculative forecasts.
6. ONLY USE THE PROVIDED NUMBERS. You must never invent, estimate, or hallucinate figures or dates.
7. If any metric is labeled "unavailable", state clearly that it is not currently reported and do not guess.
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
 * Executes a single generation call to Gemini with a strict AbortSignal timeout.
 */
async function callGeminiWithTimeout(
  ai: GoogleGenAI,
  model: string,
  prompt: string,
  timeoutMs: number = 20000
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
        "The AI service returned an empty response. Please try again.",
        "MODEL_UNAVAILABLE"
      );
    }
    return text;
  } catch (err: unknown) {
    if (err instanceof GeminiAnalysisError) throw err;

    if (controller.signal.aborted) {
      throw new GeminiAnalysisError(
        "The AI analysis request timed out. Please try again.",
        "NETWORK_ERROR"
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
 * Generates stock analysis with strict timeouts, selective retries, and optional fallback.
 * Maximum total execution is capped well under 25s for Vercel Hobby maxDuration: 30.
 */
export async function generateStockAnalysis(
  data: GroundTruthData
): Promise<StockAnalysisOutput> {
  const apiKey = getApiKey();

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

  try {
    // Attempt 1 with primary model (20s timeout)
    const text1 = await callGeminiWithTimeout(ai, activeModel, prompt, 20000);
    const parsed1 = parseAndValidateOutput(text1);

    if (parsed1.success) {
      return parsed1.data;
    }

    // Schema validation failed: RETRY ONCE immediately
    console.warn("[Gemini] Output failed schema validation. Retrying once...");
    const textRetry = await callGeminiWithTimeout(ai, activeModel, prompt, 15000);
    const parsedRetry = parseAndValidateOutput(textRetry);

    if (parsedRetry.success) {
      return parsedRetry.data;
    }

    throw new GeminiAnalysisError(
      "The AI service returned an unreadable response format. Please try again.",
      "VALIDATION_ERROR"
    );
  } catch (err: unknown) {
    if (err instanceof GeminiAnalysisError && (err.errorType === "NETWORK_ERROR" || err.errorType === "VALIDATION_ERROR")) {
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

    // Handle 503 / UNAVAILABLE: at most 1 retry after 1.5s delay
    if (is503Error(rawMsg)) {
      console.warn("[Gemini] Model reported 503/UNAVAILABLE. Waiting 1.5s before 1 retry...");
      await new Promise((resolve) => setTimeout(resolve, 1500));

      try {
        const text2 = await callGeminiWithTimeout(ai, activeModel, prompt, 15000);
        const parsed2 = parseAndValidateOutput(text2);
        if (parsed2.success) {
          return parsed2.data;
        }
      } catch (err2: unknown) {
        const rawMsg2 = err2 instanceof Error ? err2.message : String(err2);
        console.error("[Gemini Attempt 2 Error]:", sanitizeLog(rawMsg2, apiKey));

        // Optional fallback: if 503 twice and GEMINI_FALLBACK_MODEL is configured
        if (is503Error(rawMsg2) && GEMINI_FALLBACK_MODEL.trim() !== "") {
          const fallbackModel = GEMINI_FALLBACK_MODEL.trim();
          console.warn(`[Gemini] Primary model 503 twice. Attempting fallback model: ${fallbackModel}...`);
          try {
            const textFallback = await callGeminiWithTimeout(ai, fallbackModel, prompt, 15000);
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
      "UNKNOWN_ERROR"
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
