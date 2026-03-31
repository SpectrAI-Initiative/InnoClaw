export type ModelCatalogEntry = {
  id: string;
  name: string;
};

export type ProviderModelCatalog = {
  id: string;
  name: string;
  models: ModelCatalogEntry[];
};

export type ModelMatchKind = "exact" | "normalized" | "unmatched";
export type UnmatchedModelKind = "custom" | "not-found";

export type ResolvedModelSelection = {
  provider: string;
  requestedModel: string;
  resolvedModel: string;
  displayName: string;
  matchKind: ModelMatchKind;
  unmatchedKind: UnmatchedModelKind | null;
  matchedModel: ModelCatalogEntry | null;
};

export function normalizeModelKey(modelId: string): string {
  return modelId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

export function resolveModelSelection(
  selection: { provider: string; model: string } | null | undefined,
  providers: ProviderModelCatalog[],
  options?: { unmatchedKind?: UnmatchedModelKind },
): ResolvedModelSelection | null {
  if (!selection?.provider || !selection.model) {
    return null;
  }

  const providerCatalog = providers.find((provider) => provider.id === selection.provider);
  const exactMatch = providerCatalog?.models.find((model) => model.id === selection.model) ?? null;

  if (exactMatch) {
    return {
      provider: selection.provider,
      requestedModel: selection.model,
      resolvedModel: exactMatch.id,
      displayName: exactMatch.name,
      matchKind: "exact",
      unmatchedKind: null,
      matchedModel: exactMatch,
    };
  }

  const normalizedSelection = normalizeModelKey(selection.model);
  const normalizedMatch = providerCatalog?.models.find(
    (model) => normalizeModelKey(model.id) === normalizedSelection,
  ) ?? null;

  if (normalizedMatch) {
    return {
      provider: selection.provider,
      requestedModel: selection.model,
      resolvedModel: normalizedMatch.id,
      displayName: normalizedMatch.name,
      matchKind: "normalized",
      unmatchedKind: null,
      matchedModel: normalizedMatch,
    };
  }

  return {
    provider: selection.provider,
    requestedModel: selection.model,
    resolvedModel: selection.model,
    displayName: selection.model,
    matchKind: "unmatched",
    unmatchedKind: options?.unmatchedKind ?? "custom",
    matchedModel: null,
  };
}
