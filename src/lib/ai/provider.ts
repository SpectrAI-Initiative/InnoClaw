import { openai } from "@ai-sdk/openai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_PROVIDER, DEFAULT_MODEL } from "./models";
import type { LanguageModel } from "ai";

/**
 * Check if any AI API key is configured.
 */
export function isAIAvailable(): boolean {
  return (
    !!process.env.OPENAI_API_KEY ||
    !!process.env.ANTHROPIC_API_KEY ||
    !!process.env.GEMINI_API_KEY
  );
}

/**
 * Normalize ANTHROPIC_BASE_URL for @ai-sdk/anthropic.
 *
 * Claude Code's SDK expects the base URL WITHOUT "/v1" (e.g. "http://host:3888")
 * and internally appends "/v1/messages".
 *
 * @ai-sdk/anthropic expects the base URL WITH "/v1" (e.g. "http://host:3888/v1")
 * and internally appends only "/messages".
 *
 * To avoid conflicts when the same ANTHROPIC_BASE_URL env var is shared between
 * Claude Code and this app, auto-append "/v1" if it's missing.
 */
function getAnthropicBaseURL(): string | undefined {
  const raw = process.env.ANTHROPIC_BASE_URL;
  if (!raw) return undefined;
  const trimmed = raw.replace(/\/+$/, ""); // strip trailing slashes
  if (trimmed.endsWith("/v1")) return trimmed;
  return `${trimmed}/v1`;
}

// Create a custom Anthropic provider with the normalized base URL
const anthropic = createAnthropic({
  baseURL: getAnthropicBaseURL(),
});

// Create a dedicated OpenAI-compatible provider for Gemini models,
// using separate GEMINI_API_KEY / GEMINI_BASE_URL env vars.
const gemini = createOpenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  baseURL: process.env.GEMINI_BASE_URL,
});

/**
 * Get the currently configured LLM model based on settings
 */
export async function getConfiguredModel(): Promise<LanguageModel> {
  const providerSetting = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "llm_provider"))
    .limit(1);

  const modelSetting = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "llm_model"))
    .limit(1);

  const provider = providerSetting[0]?.value || DEFAULT_PROVIDER;
  const modelId = modelSetting[0]?.value || DEFAULT_MODEL;

  switch (provider) {
    case "openai":
      // Use Chat Completions API (not Responses API) for maximum compatibility
      // with third-party proxies and OpenAI-compatible services.
      return openai.chat(modelId);
    case "gemini":
      // Gemini models served via a separate OpenAI-compatible proxy
      return gemini.chat(modelId);
    case "anthropic":
      return anthropic(modelId);
    default:
      // Use the configured modelId even for unknown providers – the user may be
      // pointing OPENAI_BASE_URL at a third-party OpenAI-compatible service.
      return openai.chat(modelId);
  }
}
