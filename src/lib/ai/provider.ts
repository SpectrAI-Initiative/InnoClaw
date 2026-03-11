import { openai } from "@ai-sdk/openai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { DEFAULT_PROVIDER, DEFAULT_MODEL, PROVIDERS } from "./models";
import type { ProviderId } from "./models";
import type { LanguageModel } from "ai";

/**
 * Check if any AI API key is configured.
 * Derived from PROVIDERS so new providers are automatically included.
 */
export function isAIAvailable(): boolean {
  return Object.values(PROVIDERS).some((p) => !!process.env[p.envKey]);
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

// Cache per-model OpenAI-compatible providers (shared across all per-model-URL providers).
const perModelProviderCache = new Map<string, ReturnType<typeof createOpenAI>>();

/**
 * Create (or return cached) OpenAI-compatible provider for providers that use
 * per-model base URLs. The env var name is derived from the provider and model:
 *   e.g. provider="moonshot", model="kimi-k2.5" → MOONSHOT_KIMI_K2_5_BASE_URL
 */
function getPerModelProvider(
  providerId: string,
  modelId: string
): LanguageModel {
  const prefix = providerId.toUpperCase();
  const providerDef = PROVIDERS[providerId as ProviderId];
  const model = providerDef?.models.find((m) => m.id === modelId);
  if (!model) {
    throw new Error(
      `Configured ${providerDef?.name ?? providerId} model "${modelId}" is unknown. ` +
        `Please update your llm_model setting or PROVIDERS configuration.`
    );
  }

  const envVarName =
    prefix +
    "_" +
    modelId.toUpperCase().replace(/[^A-Z0-9]/g, "_") +
    "_BASE_URL";
  const baseURL = process.env[envVarName];
  if (!baseURL) {
    throw new Error(
      `No base URL configured for ${providerDef?.name ?? providerId} model "${modelId}". ` +
        `Set the ${envVarName} environment variable.`
    );
  }

  const cacheKey = `${providerId}:${modelId}`;
  let cached = perModelProviderCache.get(cacheKey);
  if (!cached) {
    cached = createOpenAI({
      apiKey: process.env[`${prefix}_API_KEY`] || "",
      baseURL,
    });
    perModelProviderCache.set(cacheKey, cached);
  }
  return cached.chat(modelId);
}

/**
 * Get the currently configured LLM provider ID and model in a single DB query.
 * Returns both so callers can avoid duplicate round-trips and stay consistent.
 */
export async function getConfiguredModelWithProvider(): Promise<{
  providerId: string;
  model: LanguageModel;
}> {
  const settings = await db
    .select()
    .from(appSettings)
    .where(inArray(appSettings.key, ["llm_provider", "llm_model"]));

  const providerRow = settings.find((s) => s.key === "llm_provider");
  const modelRow = settings.find((s) => s.key === "llm_model");

  const provider = providerRow?.value || DEFAULT_PROVIDER;
  const modelId = modelRow?.value || DEFAULT_MODEL;

  let model: LanguageModel;
  switch (provider) {
    case "openai":
      // Use Chat Completions API (not Responses API) for maximum compatibility
      // with third-party proxies and OpenAI-compatible services.
      model = openai.chat(modelId);
      break;
    case "gemini":
      // Gemini models served via a separate OpenAI-compatible proxy
      model = gemini.chat(modelId);
      break;
    case "anthropic":
      model = anthropic(modelId);
      break;
    case "shlab":
    case "qwen":
    case "moonshot":
    case "deepseek":
    case "minimax":
    case "zhipu":
      model = getPerModelProvider(provider, modelId);
      break;
    default:
      // Use the configured modelId even for unknown providers – the user may be
      // pointing OPENAI_BASE_URL at a third-party OpenAI-compatible service.
      model = openai.chat(modelId);
      break;
  }
  return { providerId: provider, model };
}

/**
 * Get the currently configured LLM provider ID from settings.
 */
export async function getConfiguredProviderId(): Promise<string> {
  const { providerId } = await getConfiguredModelWithProvider();
  return providerId;
}

/**
 * Get the currently configured LLM model based on settings
 */
export async function getConfiguredModel(): Promise<LanguageModel> {
  const { model } = await getConfiguredModelWithProvider();
  return model;
}
