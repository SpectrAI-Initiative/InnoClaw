import { createOpenAI } from "@ai-sdk/openai";
import { shouldUseRemoteAgent } from "@/lib/ai/remote-agent-proxy";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { isArchivedProvider } from "./archived-providers";
import {
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  PROVIDERS,
  TOKENHUB_DEFAULT_BASE_URL,
  isSelectableModel,
  resolveSelectableModel,
} from "./models";
import type { ProviderId } from "./models";
import type { LanguageModel } from "ai";
import {
  getApiKeyEnvKey,
  getCurrentEnv,
  getPerModelBaseUrlEnvKey,
  getVendorBaseUrlEnvKey,
} from "./provider-env";

/**
 * Check if any AI API key is configured.
 * Derived from PROVIDERS so new providers are automatically included.
 */
export function isAIAvailable(): boolean {
  const env = getCurrentEnv();
  return Object.values(PROVIDERS).some((p) => !!env[p.envKey]);
}

const perModelProviderCache = new Map<string, ReturnType<typeof createOpenAI>>();

/**
 * OpenAI-compatible TokenHub client.
 * Resolution order: per-model base URL, vendor base URL, then the TokenHub default.
 */
function getPerModelProvider(
  providerId: string,
  modelId: string
): LanguageModel {
  const env = getCurrentEnv();
  const providerDef = PROVIDERS[providerId as ProviderId];
  const perModelEnvVar = getPerModelBaseUrlEnvKey(providerId, modelId);
  const vendorEnvVar = getVendorBaseUrlEnvKey(providerId);
  const rawKey = env[providerDef?.envKey || getApiKeyEnvKey(providerId)] || "";
  // 本地验证：key 为占位符(none/ssm:)且配置了线上账号时，走本地 LLM 中继，
  // 由中继把请求转发到线上真实模型。仅在本地 Docker 副本中生效。
  const isPlaceholderKey = !rawKey || rawKey === "none" || rawKey.startsWith("ssm:");
  const useRelay = isPlaceholderKey && shouldUseRemoteAgent();
  const relayBaseUrl =
    process.env.LLM_RELAY_BASE_URL || "http://127.0.0.1:3000/api/llm-relay/v1";
  const baseURL = useRelay
    ? relayBaseUrl
    : env[perModelEnvVar] || env[vendorEnvVar] || TOKENHUB_DEFAULT_BASE_URL;

  const cacheKey = `${providerId}:${modelId}:${baseURL}`;
  let cached = perModelProviderCache.get(cacheKey);
  if (!cached) {
    cached = createOpenAI({
      apiKey: useRelay ? "local-relay" : rawKey,
      baseURL,
    });
    perModelProviderCache.set(cacheKey, cached);
  }
  return cached.chat(modelId);
}

function assertActiveModel(provider: string, modelId: string): void {
  if (isSelectableModel(provider, modelId)) return;
  if (isArchivedProvider(provider)) {
    throw new Error(
      `Provider "${provider}" is archived. Select deepseek/deepseek-v4.1-flash or deepseek/deepseek-v4-pro.`,
    );
  }
  throw new Error(
    `Model "${provider}/${modelId}" is outside the active catalog. ` +
      `Select deepseek/deepseek-v4.1-flash or deepseek/deepseek-v4-pro.`,
  );
}

/**
 * Build a LanguageModel for a catalog provider/model pair.
 * Calls stay on the Vercel AI SDK Chat Completions client.
 */
/**
 * UI-facing model aliases that are served by a real callable model.
 * SciReasoner is the default shown in the composer; until a dedicated
 * endpoint exists it runs on the strongest configured DeepSeek model.
 */
const MODEL_ALIASES: Record<string, { providerId: string; modelId: string }> = {
  "scireasoner/sci-reasoner": { providerId: "deepseek", modelId: "deepseek-v4-pro" },
};

export function resolveRuntimeModel(provider: string, modelId: string) {
  return MODEL_ALIASES[`${provider}/${modelId}`] ?? { providerId: provider, modelId };
}

function buildLanguageModel(provider: string, modelId: string): LanguageModel {
  const resolved = resolveRuntimeModel(provider, modelId);
  assertActiveModel(resolved.providerId, resolved.modelId);
  return getPerModelProvider(resolved.providerId, resolved.modelId);
}

/**
 * Get the currently configured LLM provider ID and model in a single DB query.
 * Returns both so callers can avoid duplicate round-trips and stay consistent.
 */
export async function getConfiguredModelWithProvider(): Promise<{
  providerId: string;
  modelId: string;
  model: LanguageModel;
}> {
  const { providerId: provider, modelId } = await getConfiguredModelSelection();

  return { providerId: provider, modelId, model: buildLanguageModel(provider, modelId) };
}

/**
 * Read the currently configured provider/model ids from app settings.
 */
export async function getConfiguredModelSelection(): Promise<{
  providerId: string;
  modelId: string;
}> {
  const env = getCurrentEnv();
  const settings = await db
    .select()
    .from(appSettings)
    .where(inArray(appSettings.key, ["llm_provider", "llm_model"]));

  const providerRow = settings.find((s) => s.key === "llm_provider");
  const modelRow = settings.find((s) => s.key === "llm_model");

  return resolveSelectableModel(
    env.LLM_PROVIDER || providerRow?.value || DEFAULT_PROVIDER,
    env.LLM_MODEL || modelRow?.value || DEFAULT_MODEL,
  );
}

/**
 * Read the current provider/model ids from the latest live environment.
 * `.env.local` overrides process.env so manual edits are visible immediately.
 */
export function getConfiguredModelSelectionFromEnv(): {
  providerId: string;
  modelId: string;
} {
  const env = getCurrentEnv();
  return resolveSelectableModel(
    env.LLM_PROVIDER || DEFAULT_PROVIDER,
    env.LLM_MODEL || DEFAULT_MODEL,
  );
}

/**
 * Build a model from an explicit provider/model pair without querying the DB.
 * Used for per-request model overrides from the agent panel.
 */
export function getModelFromOverride(
  provider: string,
  modelId: string
): { providerId: string; model: LanguageModel } {
  return { providerId: provider, model: buildLanguageModel(provider, modelId) };
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
