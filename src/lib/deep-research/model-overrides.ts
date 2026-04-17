import { getCurrentEnv } from "@/lib/ai/provider-env";
import { PROVIDERS } from "@/lib/ai/models";
import type { DeepResearchConfig } from "./types";

type ModelRoute = { provider: string; modelId: string };

const LONG_FORM_FINAL_REPORT_PREFERENCES: ModelRoute[] = [
  { provider: "anthropic", modelId: "claude-opus-4-6" },
  { provider: "gemini", modelId: "gemini-2.5-pro" },
  { provider: "openai", modelId: "gpt-4.1" },
  { provider: "moonshot", modelId: "kimi-k2.5" },
  { provider: "qwen", modelId: "Qwen3-235B" },
];

function isConfiguredProvider(providerId: string): boolean {
  const env = getCurrentEnv();
  const provider = PROVIDERS[providerId as keyof typeof PROVIDERS];
  if (!provider) {
    return false;
  }

  return Boolean(env[provider.envKey]);
}

function isKnownModelRoute(route: ModelRoute): boolean {
  const provider = PROVIDERS[route.provider as keyof typeof PROVIDERS];
  if (!provider) {
    return false;
  }

  return provider.models.some((model) => model.id === route.modelId);
}

export function getPreferredFinalReportModelRoute(
  fallbackRoute?: ModelRoute | null,
): ModelRoute | null {
  for (const route of LONG_FORM_FINAL_REPORT_PREFERENCES) {
    if (isConfiguredProvider(route.provider) && isKnownModelRoute(route)) {
      return route;
    }
  }

  if (fallbackRoute && isKnownModelRoute(fallbackRoute)) {
    return fallbackRoute;
  }

  return null;
}

export function getDefaultDeepResearchModelOverrides(
  resolvedModel?: ModelRoute | null,
): DeepResearchConfig["modelOverrides"] | undefined {
  const finalReportRoute = getPreferredFinalReportModelRoute(resolvedModel ?? null);
  if (!finalReportRoute) {
    return undefined;
  }

  if (
    resolvedModel
    && resolvedModel.provider === finalReportRoute.provider
    && resolvedModel.modelId === finalReportRoute.modelId
  ) {
    return undefined;
  }

  return {
    research_asset_reuse_specialist: finalReportRoute,
  };
}

export function buildDeepResearchConfigWithRoleOverrides(input: {
  config: DeepResearchConfig;
  resolvedModel: ModelRoute;
}): DeepResearchConfig {
  const defaultOverrides = getDefaultDeepResearchModelOverrides(input.resolvedModel);
  const mergedOverrides = input.config.modelOverrides ?? defaultOverrides;

  return {
    ...input.config,
    resolvedModel: input.resolvedModel,
    modelOverrides: mergedOverrides,
  };
}
