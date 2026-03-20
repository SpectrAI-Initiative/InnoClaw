import { PROVIDERS } from "@/lib/ai/models";
import type { ProviderId } from "@/lib/ai/models";
import { getModelFromOverride } from "@/lib/ai/provider";
import type { LanguageModel } from "ai";
import type {
  ModelRole,
  DeepResearchConfig,
  BudgetLimits,
  BudgetUsage,
} from "./types";

// --- Default route chains per role ---
// Enforces hierarchy: Main Brain = Opus, Reviewers = Sonnet, Workers = Kimi/Sonnet

interface ModelRoute {
  provider: string;
  modelId: string;
}

const DEFAULT_ROUTES: Record<ModelRole, ModelRoute[]> = {
  // Main Brain: Kimi first for testing, then Opus/Sonnet fallback
  main_brain: [
    { provider: "moonshot", modelId: "kimi-k2.5" },
    { provider: "anthropic", modelId: "claude-opus-4-20250514" },
    { provider: "anthropic", modelId: "claude-sonnet-4-20250514" },
  ],
  // Reviewer A: Kimi first for testing
  reviewer_a: [
    { provider: "moonshot", modelId: "kimi-k2.5" },
    { provider: "anthropic", modelId: "claude-sonnet-4-20250514" },
  ],
  // Reviewer B: Kimi first for testing
  reviewer_b: [
    { provider: "moonshot", modelId: "kimi-k2.5" },
    { provider: "anthropic", modelId: "claude-sonnet-4-20250514" },
  ],
  // Workers: Kimi first for testing
  worker: [
    { provider: "moonshot", modelId: "kimi-k2.5" },
    { provider: "anthropic", modelId: "claude-sonnet-4-20250514" },
    { provider: "openai", modelId: "gpt-4o" },
  ],
  // Synthesizer: same as main_brain (synthesis needs strong reasoning)
  synthesizer: [
    { provider: "moonshot", modelId: "kimi-k2.5" },
    { provider: "anthropic", modelId: "claude-sonnet-4-20250514" },
    { provider: "openai", modelId: "gpt-4o" },
  ],
};

/** Sentinel values that mean "not really configured". */
const PLACEHOLDER_KEYS = new Set(["none", "null", "undefined", "placeholder", "xxx", "your-api-key-here", ""]);

function isProviderAvailable(provider: string): boolean {
  const p = PROVIDERS[provider as ProviderId];
  if (!p) return false;
  const key = (process.env[p.envKey] ?? "").trim();
  return key.length > 0 && !PLACEHOLDER_KEYS.has(key.toLowerCase());
}

/**
 * Resolve the model for a given role. Tries config overrides first,
 * then walks the fallback chain until a provider with an API key is found.
 */
export function getModelForRole(
  role: ModelRole,
  config?: DeepResearchConfig
): { model: LanguageModel; provider: string; modelId: string } {
  // Check config overrides first
  const override = config?.modelOverrides?.[role];
  if (override && isProviderAvailable(override.provider)) {
    const { model } = getModelFromOverride(override.provider, override.modelId);
    return { model, provider: override.provider, modelId: override.modelId };
  }

  // Walk fallback chain
  const chain = DEFAULT_ROUTES[role];
  for (const route of chain) {
    if (isProviderAvailable(route.provider)) {
      const { model } = getModelFromOverride(route.provider, route.modelId);
      return { model, provider: route.provider, modelId: route.modelId };
    }
  }

  throw new Error(
    `No available model for role "${role}". Configure at least one API key for: ${chain.map((r) => r.provider).join(", ")}`
  );
}

/**
 * Get all available models for a role in fallback order.
 * Used by executeWithFallback to retry with the next model on failure.
 */
export function getModelChainForRole(
  role: ModelRole,
  config?: DeepResearchConfig
): Array<{ model: LanguageModel; provider: string; modelId: string }> {
  const results: Array<{ model: LanguageModel; provider: string; modelId: string }> = [];

  // Config override first
  const override = config?.modelOverrides?.[role];
  if (override && isProviderAvailable(override.provider)) {
    const { model } = getModelFromOverride(override.provider, override.modelId);
    results.push({ model, provider: override.provider, modelId: override.modelId });
  }

  // Then walk fallback chain
  const chain = DEFAULT_ROUTES[role];
  for (const route of chain) {
    if (isProviderAvailable(route.provider)) {
      // Avoid duplicates with the override
      if (!results.some(r => r.provider === route.provider && r.modelId === route.modelId)) {
        const { model } = getModelFromOverride(route.provider, route.modelId);
        results.push({ model, provider: route.provider, modelId: route.modelId });
      }
    }
  }

  return results;
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
