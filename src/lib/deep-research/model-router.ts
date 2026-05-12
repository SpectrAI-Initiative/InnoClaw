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

export function getRouteCandidatesForRole(
  role: ModelRole,
  config?: DeepResearchConfig,
): ModelRoute[] {
  const candidates: ModelRoute[] = [];
  const seen = new Set<string>();
  const push = (route: ModelRoute | null | undefined) => {
    if (!route?.provider || !route?.modelId) {
      return;
    }
    const key = `${route.provider}::${route.modelId}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    candidates.push(route);
  };

  const override = config?.modelOverrides?.[role];
  if (override?.provider && override?.modelId) {
    push({ provider: override.provider, modelId: override.modelId });
  }

  const resolved = config?.resolvedModel;
  if (resolved?.provider && resolved?.modelId) {
    push({ provider: resolved.provider, modelId: resolved.modelId });
  }

  const envConfigured = getConfiguredModelSelectionFromEnv();
  push({ provider: envConfigured.providerId, modelId: envConfigured.modelId });

  return candidates;
}

function resolveConfiguredModel(
  route: ModelRoute,
): { model: LanguageModel; provider: string; modelId: string } {
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
  const chain = getModelChainForRole(role, config);
  if (chain.length === 0) {
    const candidates = getRouteCandidatesForRole(role, config);
    const last = candidates[candidates.length - 1];
    throw new Error(
      last
        ? `Deep Research could not initialize any model for role "${role}". Last attempted route: ${last.provider}/${last.modelId}`
        : `Deep Research could not initialize any model for role "${role}". No route candidates were available.`,
    );
  }

  return chain[0];
}

/**
 * Get all available models for a role in fallback order.
 * Used by executeWithFallback to retry with the next model on failure.
 */
export function getModelChainForRole(
  role: ModelRole,
  config?: DeepResearchConfig
): Array<{ model: LanguageModel; provider: string; modelId: string }> {
  const resolved: Array<{ model: LanguageModel; provider: string; modelId: string }> = [];
  for (const route of getRouteCandidatesForRole(role, config)) {
    try {
      resolved.push(resolveConfiguredModel(route));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.warn(`[model-router] Failed to initialize route ${route.provider}/${route.modelId} for role ${role}: ${detail}`);
    }
  }
  return resolved;
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
