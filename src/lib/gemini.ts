/**
 * Google Gemini AI client layer.
 * All requests are executed server-side.
 */
import { requireServerEnv } from "@/lib/env";

export function getGeminiApiKey(): string {
  return requireServerEnv("GEMINI_API_KEY", "gemini");
}
