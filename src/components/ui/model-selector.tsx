"use client";

import React, { useState, useCallback, useMemo } from "react";
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
import useSWR from "swr";
import { swrFetcher } from "@/lib/fetcher";
import { PROVIDERS, type ProviderId } from "@/lib/ai/models";

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
      if (parsed?.provider && parsed?.model) {
        const providerDef = PROVIDERS[parsed.provider as ProviderId];
        if (providerDef && providerDef.models.some((m: { id: string }) => m.id === parsed.model)) {
          return parsed;
        }
      }
      // Invalid stored selection — clean up
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

  // Derive effective provider/model: user selection > settings fallback
  const settingsFallback = useMemo(() => {
    if (!settings?.llmProvider || !settings?.llmModel) return null;
    const configuredProviders = settings.configuredProviders as string[] | undefined;
    const provider = settings.llmProvider as string;
    const model = settings.llmModel as string;
    const providerDef = PROVIDERS[provider as ProviderId];
    if (providerDef && (!configuredProviders || configuredProviders.includes(provider)) && providerDef.models.some((m) => m.id === model)) {
      return { provider, model };
    }
    return null;
  }, [settings]);

  const selectedProvider = userSelection?.provider ?? settingsFallback?.provider ?? null;
  const selectedModel = userSelection?.model ?? settingsFallback?.model ?? null;

  const handleModelChange = useCallback((providerId: string, modelId: string) => {
    setUserSelection({ provider: providerId, model: modelId });
    try {
      localStorage.setItem(storageKey, JSON.stringify({ provider: providerId, model: modelId }));
    } catch {
      // ignore
    }
  }, [storageKey]);

  const modelDisplayName = useMemo(() => {
    if (!selectedProvider || !selectedModel) return null;
    const provider = PROVIDERS[selectedProvider as ProviderId];
    const model = provider?.models.find((m) => m.id === selectedModel);
    return model?.name ?? selectedModel;
  }, [selectedProvider, selectedModel]);

  const availableProviders = useMemo(() => {
    const configured = settings?.configuredProviders as string[] | undefined;
    if (!configured) return [];
    return configured
      .map((id: string) => PROVIDERS[id as ProviderId])
      .filter(Boolean);
  }, [settings?.configuredProviders]);

  return {
    selectedProvider,
    selectedModel,
    modelDisplayName,
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
  const {
    selectedProvider,
    selectedModel,
    modelDisplayName,
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`flex items-center gap-1 shrink-0 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted/50 transition-colors max-w-[140px] ${className ?? ""}`}
        >
          <span className="truncate">{modelDisplayName || label}</span>
          <ChevronDown className="h-3 w-3 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 max-h-80 overflow-y-auto">
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
                  {model.name}
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
