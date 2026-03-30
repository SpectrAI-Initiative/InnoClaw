import { getConfiguredModelSelectionFromEnv, getModelFromOverride } from "@/lib/ai/provider";
import type { LanguageModel } from "ai";
import type {
  ModelRole,
  DeepResearchConfig,
  BudgetLimits,
  BudgetUsage,
} from "./types";

interface ModelRoute {
  provider: string;
  modelId: string;
}

function getConfiguredRoute(config?: DeepResearchConfig): ModelRoute {
  const resolved = config?.resolvedModel;
  if (resolved?.provider && resolved?.modelId) {
    return { provider: resolved.provider, modelId: resolved.modelId };
  }

  const { providerId, modelId } = getConfiguredModelSelectionFromEnv();
  return { provider: providerId, modelId };
}

function resolveConfiguredModel(
  config?: DeepResearchConfig,
): { model: LanguageModel; provider: string; modelId: string } {
  const route = getConfiguredRoute(config);
  try {
    const { model } = getModelFromOverride(route.provider, route.modelId);
    return { model, provider: route.provider, modelId: route.modelId };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Deep Research configured model "${route.provider}/${route.modelId}" could not be initialized. ${detail}`,
    );
  }
}

/**
 * Resolve the model for a given role. Tries config overrides first,
 * then walks the fallback chain until a provider with an API key is found.
 */
export function getModelForRole(
  role: ModelRole,
  config?: DeepResearchConfig
): { model: LanguageModel; provider: string; modelId: string } {
  void role;
  return resolveConfiguredModel(config);
}

/**
 * Get all available models for a role in fallback order.
 * Used by executeWithFallback to retry with the next model on failure.
 */
export function getModelChainForRole(
  role: ModelRole,
  config?: DeepResearchConfig
): Array<{ model: LanguageModel; provider: string; modelId: string }> {
  void role;
  return [resolveConfiguredModel(config)];
}

// --- Budget tracking ---

export function checkBudget(
  role: ModelRole,
  usage: BudgetUsage,
  limits: BudgetLimits
): { allowed: boolean; reason?: string } {
  if (usage.totalTokens >= limits.maxTotalTokens) {
    return { allowed: false, reason: `Total token budget exceeded (${usage.totalTokens}/${limits.maxTotalTokens})` };
  }
  if (role === "main_brain" && usage.opusTokens >= limits.maxOpusTokens) {
    return { allowed: false, reason: `Opus token budget exceeded (${usage.opusTokens}/${limits.maxOpusTokens})` };
  }
  return { allowed: true };
}

export function trackUsage(
  usage: BudgetUsage,
  role: ModelRole,
  nodeId: string,
  tokens: number
): BudgetUsage {
  const updated = { ...usage };
  updated.totalTokens += tokens;
  if (role === "main_brain") {
    updated.opusTokens += tokens;
  }
  updated.byRole = { ...updated.byRole };
  updated.byRole[role] = (updated.byRole[role] || 0) + tokens;
  updated.byNode = { ...updated.byNode, [nodeId]: (updated.byNode[nodeId] || 0) + tokens };
  return updated;
}
