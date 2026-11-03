/**
 * Environment configuration and lazy validation for StockLens.
 *
 * Rules:
 * 1. Third-party keys are SERVER-ONLY and never sent to or prefixed with NEXT_PUBLIC_.
 * 2. Validation is strictly lazy (checked only when a feature is used or checked),
 *    preventing build-time failures on Vercel or local CI before keys are set.
 */

export type FeatureKey = "finnhub" | "twelvedata" | "gemini" | "supabase";

export interface FeatureStatus {
  key: FeatureKey;
  name: string;
  isConfigured: boolean;
  requiredVars: string[];
  missingVars: string[];
  setupUrl: string;
  description: string;
}

export const FEATURE_CONFIGS: Record<
  FeatureKey,
  {
    name: string;
    vars: string[];
    setupUrl: string;
    description: string;
  }
> = {
  finnhub: {
    name: "Finnhub Quotes & Search",
    vars: ["FINNHUB_API_KEY"],
    setupUrl: "https://finnhub.io/register",
    description: "Powers ticker autocomplete search and company fundamentals.",
  },
  twelvedata: {
    name: "Twelve Data Candles & Indicators",
    vars: ["TWELVE_DATA_API_KEY"],
    setupUrl: "https://twelvedata.com/",
    description: "Powers candlestick charts and technical indicator calculations.",
  },
  gemini: {
    name: "Google Gemini AI Analysis",
    vars: ["GEMINI_API_KEY"],
    setupUrl: "https://aistudio.google.com/app/apikey",
    description: "Generates plain-language AI market insights and metric breakdowns.",
  },
  supabase: {
    name: "Supabase Database & Cache",
    vars: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    setupUrl: "https://supabase.com/dashboard",
    description: "Stores user watchlists and caches API responses to respect free tier limits.",
  },
};

/**
 * Lazily inspect which features have their required environment variables set.
 * Returns only public status metadata (never raw secrets).
 */
export function getFeatureStatus(feature: FeatureKey): FeatureStatus {
  const config = FEATURE_CONFIGS[feature];
  const missingVars = config.vars.filter((varName) => {
    const val = process.env[varName];
    return !val || val.trim() === "" || val.startsWith("your-");
  });

  return {
    key: feature,
    name: config.name,
    isConfigured: missingVars.length === 0,
    requiredVars: config.vars,
    missingVars,
    setupUrl: config.setupUrl,
    description: config.description,
  };
}

/**
 * Returns the status for all supported features.
 * Safe to expose to client components via API.
 */
export function getAllFeaturesStatus(): FeatureStatus[] {
  return (Object.keys(FEATURE_CONFIGS) as FeatureKey[]).map(getFeatureStatus);
}

/**
 * Lazily retrieves a required server environment variable.
 * Throws a descriptive error if not set or is placeholder.
 */
export function requireServerEnv(varName: string, feature: FeatureKey): string {
  const value = process.env[varName];
  if (!value || value.trim() === "" || value.startsWith("your-")) {
    const config = FEATURE_CONFIGS[feature];
    throw new Error(
      `[StockLens] Missing required environment variable "${varName}" for ${config.name}. ` +
      `Please set it in your .env.local file. Get a free key at: ${config.setupUrl}`
    );
  }
  return value.trim();
}
