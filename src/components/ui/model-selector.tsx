"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import useSWR from "swr";
import { swrFetcher } from "@/lib/fetcher";
import { modelSupportsVision, PROVIDERS, type ProviderId } from "@/lib/ai/models";
import {
  resolveModelSelection,
  type ProviderModelCatalog,
} from "@/lib/ai/model-selection";

interface ModelSelectorProps {
  storageKey: string;
  label?: string;
  className?: string;
  onModelChange?: (provider: string | null, model: string | null) => void;
}

function readStoredSelection(storageKey: string): { provider: string; model: string } | null {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (
        typeof parsed?.provider === "string" &&
        parsed.provider &&
        typeof parsed?.model === "string" &&
        parsed.model
      ) {
        return parsed;
      }
      localStorage.removeItem(storageKey);
    }
  } catch {
    // ignore
  }
  return null;
}

export function useModelSelection(storageKey: string) {
  // Tracks explicit user selection; null means "use default from settings"
  const [userSelection, setUserSelection] = useState<{ provider: string; model: string } | null>(
    () => readStoredSelection(storageKey)
  );

  const { data: settings } = useSWR("/api/settings", swrFetcher);

  const availableProviders = useMemo<ProviderModelCatalog[]>(() => {
    const configured = settings?.configuredProviders as string[] | undefined;
    if (!configured) return [];
    return configured
      .map((id: string) => PROVIDERS[id as ProviderId])
      .filter(Boolean);
  }, [settings?.configuredProviders]);

  // Derive effective provider/model: user selection > settings fallback
  const settingsFallback = useMemo(() => {
    if (!settings?.llmProvider || !settings?.llmModel) return null;
    const configuredProviders = settings.configuredProviders as string[] | undefined;
    const provider = settings.llmProvider as string;
    const model = settings.llmModel as string;
    if (
      configuredProviders &&
      configuredProviders.length > 0 &&
      !configuredProviders.includes(provider)
    ) {
      return null;
    }
    return resolveModelSelection(
      { provider, model },
      availableProviders,
      { unmatchedKind: "custom" },
    );
  }, [availableProviders, settings]);

  const resolvedUserSelection = useMemo(
    () => resolveModelSelection(userSelection, availableProviders, { unmatchedKind: "custom" }),
    [availableProviders, userSelection],
  );

  const resolvedSelection = resolvedUserSelection ?? settingsFallback;
  const canonicalSelection = useMemo(
    () => resolvedSelection
      ? { provider: resolvedSelection.provider, model: resolvedSelection.resolvedModel }
      : null,
    [resolvedSelection],
  );

  const selectedProvider = canonicalSelection?.provider ?? null;
  const selectedModel = canonicalSelection?.model ?? null;

  const handleModelChange = useCallback((providerId: string, modelId: string) => {
    setUserSelection({ provider: providerId, model: modelId });
    try {
      localStorage.setItem(storageKey, JSON.stringify({ provider: providerId, model: modelId }));
    } catch {
      // ignore
    }
  }, [storageKey]);

  const modelDisplayName = useMemo(() => {
    return resolvedSelection?.displayName ?? null;
  }, [resolvedSelection]);

  return {
    selectedProvider,
    selectedModel,
    modelDisplayName,
    modelMatchKind: resolvedSelection?.matchKind ?? null,
    unmatchedKind: resolvedSelection?.unmatchedKind ?? null,
    availableProviders,
    handleModelChange,
  };
}

export function ModelSelector({
  storageKey,
  label = "Model",
  className,
  onModelChange,
}: ModelSelectorProps) {
  const tCommon = useTranslations("common");
  const {
    selectedProvider,
    selectedModel,
    modelDisplayName,
    modelMatchKind,
    unmatchedKind,
    availableProviders,
    handleModelChange,
  } = useModelSelection(storageKey);

  const handleChange = useCallback(
    (providerId: string, modelId: string) => {
      handleModelChange(providerId, modelId);
      onModelChange?.(providerId, modelId);
    },
    [handleModelChange, onModelChange]
  );

  const selectedSupportsVision = useMemo(() => {
    if (!selectedProvider || !selectedModel || modelMatchKind === "unmatched") return null;
    return modelSupportsVision(selectedProvider, selectedModel);
  }, [modelMatchKind, selectedProvider, selectedModel]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`flex items-center gap-1.5 shrink-0 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted/50 transition-colors max-w-[220px] ${className ?? ""}`}
        >
          <span className="truncate">{modelDisplayName || label}</span>
          {unmatchedKind && (
            <Badge
              variant="outline"
              className="shrink-0 px-1 py-0 text-[10px] leading-4 border-slate-500/40 text-slate-700 dark:text-slate-300"
            >
              {unmatchedKind === "not-found" ? tCommon("modelNotFound") : tCommon("customModel")}
            </Badge>
          )}
          {typeof selectedSupportsVision === "boolean" && (
            <Badge
              variant="outline"
              className={`shrink-0 px-1 py-0 text-[10px] leading-4 ${
                selectedSupportsVision
                  ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                  : "border-amber-500/40 text-amber-700 dark:text-amber-300"
              }`}
            >
              {selectedSupportsVision ? tCommon("multimodal") : tCommon("textOnly")}
            </Badge>
          )}
          <ChevronDown className="h-3 w-3 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 max-h-80 overflow-y-auto">
        <DropdownMenuLabel className="text-xs">{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {availableProviders.map((provider) => (
          <React.Fragment key={provider.id}>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {provider.name}
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={selectedProvider === provider.id ? (selectedModel ?? "") : ""}
              onValueChange={(modelId) => handleChange(provider.id, modelId)}
            >
              {provider.models.map((model: { id: string; name: string }) => (
                <DropdownMenuRadioItem key={model.id} value={model.id}>
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="truncate">{model.name}</span>
                    <Badge
                      variant="outline"
                      className={`shrink-0 px-1 py-0 text-[10px] leading-4 ${
                        modelSupportsVision(provider.id, model.id)
                          ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                          : "border-amber-500/40 text-amber-700 dark:text-amber-300"
                      }`}
                    >
                      {modelSupportsVision(provider.id, model.id) ? tCommon("multimodal") : tCommon("textOnly")}
                    </Badge>
                  </div>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
