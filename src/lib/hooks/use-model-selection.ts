"use client";

import { useState, useCallback, useMemo } from "react";
import useSWR from "swr";
import {
  PROVIDERS,
  modelSupportsVision,
} from "@/lib/ai/models";
import type { ProviderId } from "@/lib/ai/models";
import {
  resolveModelSelection,
  type ModelCatalogEntry,
  type ProviderModelCatalog,
} from "@/lib/ai/model-selection";

type ModelSelection = { provider: string; model: string };
type AgentModelOptionsKey = readonly ["agent-model-options", ...ProviderId[]];

function readStoredModelSelection(storageKey: string): ModelSelection | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (
      typeof parsed?.provider === "string" &&
      parsed.provider &&
      typeof parsed?.model === "string" &&
      parsed.model
    ) {
      return { provider: parsed.provider, model: parsed.model };
    }
  } catch {
    // Ignore storage access and parse errors.
  }
  return null;
}

interface UseModelSelectionOptions {
  storageKey: string;
  configuredProviderIds: ProviderId[];
  settingsFallback: ModelSelection | null;
  /** Fallback display name when no model is resolved */
  fallbackDisplayName?: string;
}

export function useModelSelection({
  storageKey,
  configuredProviderIds,
  settingsFallback,
  fallbackDisplayName = "Model",
}: UseModelSelectionOptions) {
  const [userSelection, setUserSelection] = useState<ModelSelection | null>(
    () => readStoredModelSelection(storageKey),
  );

  // --- Discover models from configured providers ---
  const modelOptionsKey = useMemo<AgentModelOptionsKey | null>(() => {
    if (configuredProviderIds.length === 0) return null;
    return ["agent-model-options", ...configuredProviderIds];
  }, [configuredProviderIds]);

  const { data: discoveredModelsByProvider, mutate: refreshDiscoveredModels } = useSWR<
    Record<string, ModelCatalogEntry[]>
  >(
    modelOptionsKey,
    async (key: AgentModelOptionsKey) => {
      const [, ...providerIds] = key;
      const entries = await Promise.all(
        providerIds.map(async (providerId) => {
          try {
            const response = await fetch(`/api/models?provider=${encodeURIComponent(providerId)}`);
            const data = await response.json().catch(() => ({}));
            return [providerId, Array.isArray(data.models) ? data.models : []] as const;
          } catch {
            return [providerId, []] as const;
          }
        }),
      );
      return Object.fromEntries(entries);
    },
  );

  // --- Build available providers list ---
  const availableProviders = useMemo<ProviderModelCatalog[]>(() => {
    const providers: ProviderModelCatalog[] = [];
    for (const id of configuredProviderIds) {
      const provider = PROVIDERS[id];
      if (!provider) continue;
      const knownIds = new Set(provider.models.map((m) => m.id));
      const extraModels = (discoveredModelsByProvider?.[id] ?? []).filter(
        (m) => !knownIds.has(m.id),
      );
      providers.push({
        id: provider.id,
        name: provider.name,
        models: [...provider.models, ...extraModels],
      });
    }
    return providers;
  }, [configuredProviderIds, discoveredModelsByProvider]);

  // --- Resolve selection ---
  const resolvedSelection = useMemo(() => {
    const selection = userSelection ?? settingsFallback;
    const unmatchedKind =
      selection && (discoveredModelsByProvider?.[selection.provider]?.length ?? 0) > 0
        ? "not-found"
        : "custom";
    return resolveModelSelection(selection, availableProviders, { unmatchedKind });
  }, [availableProviders, discoveredModelsByProvider, settingsFallback, userSelection]);

  const canonicalSelection = useMemo<ModelSelection | null>(
    () =>
      resolvedSelection
        ? { provider: resolvedSelection.provider, model: resolvedSelection.resolvedModel }
        : null,
    [resolvedSelection],
  );

  // --- Sync selection during render when provider is removed or canonical drifts ---
  const isProviderValid =
    userSelection &&
    Boolean(PROVIDERS[userSelection.provider as ProviderId]) &&
    (configuredProviderIds.length === 0 ||
      configuredProviderIds.includes(userSelection.provider as ProviderId));

  if (userSelection && !isProviderValid) {
    setUserSelection(null);
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(storageKey);
      }
    } catch { /* ignore */ }
  }

  if (
    userSelection &&
    isProviderValid &&
    canonicalSelection &&
    (canonicalSelection.provider !== userSelection.provider ||
      canonicalSelection.model !== userSelection.model)
  ) {
    setUserSelection(canonicalSelection);
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(storageKey, JSON.stringify(canonicalSelection));
      }
    } catch { /* ignore */ }
  }

  const selectedProvider = canonicalSelection?.provider ?? null;
  const selectedModel = canonicalSelection?.model ?? null;

  const handleModelChange = useCallback(
    (providerId: string, modelId: string) => {
      setUserSelection({ provider: providerId, model: modelId });
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(
            storageKey,
            JSON.stringify({ provider: providerId, model: modelId }),
          );
        }
      } catch {
        // Ignore storage access errors.
      }
    },
    [storageKey],
  );

  const modelDisplayName = resolvedSelection?.displayName ?? fallbackDisplayName;

  const selectedSupportsVision = useMemo(() => {
    if (!selectedProvider || !selectedModel || resolvedSelection?.matchKind === "unmatched") {
      return null;
    }
    return modelSupportsVision(selectedProvider, selectedModel);
  }, [resolvedSelection?.matchKind, selectedProvider, selectedModel]);

  return {
    selectedProvider,
    selectedModel,
    modelDisplayName,
    resolvedSelection,
    availableProviders,
    selectedSupportsVision,
    handleModelChange,
    refreshDiscoveredModels,
  };
}
