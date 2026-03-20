"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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

export function useModelSelection(storageKey: string) {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const { data: settings } = useSWR("/api/settings", swrFetcher);

  // Initialize from localStorage, then fall back to global settings
  useEffect(() => {
    if (selectedProvider !== null) return;

    let storedSelection: { provider: string; model: string } | null = null;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          storedSelection = JSON.parse(stored);
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }

    const configuredProviders = settings?.configuredProviders as string[] | undefined;

    const isValid = (sel: { provider: string; model: string } | null) => {
      if (!sel || !sel.provider || !sel.model) return false;
      const providerDef = PROVIDERS[sel.provider as ProviderId];
      if (!providerDef) return false;
      if (configuredProviders && !configuredProviders.includes(sel.provider)) return false;
      return providerDef.models.some((m) => m.id === sel.model);
    };

    if (isValid(storedSelection)) {
      setSelectedProvider(storedSelection!.provider);
      setSelectedModel(storedSelection!.model);
      return;
    } else if (storedSelection) {
      try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
    }

    if (settings?.llmProvider && settings?.llmModel) {
      const fallback = { provider: settings.llmProvider as string, model: settings.llmModel as string };
      if (isValid(fallback)) {
        setSelectedProvider(fallback.provider);
        setSelectedModel(fallback.model);
      }
    }
  }, [settings?.llmProvider, settings?.llmModel, settings?.configuredProviders, selectedProvider, storageKey]);

  const handleModelChange = useCallback((providerId: string, modelId: string) => {
    setSelectedProvider(providerId);
    setSelectedModel(modelId);
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
