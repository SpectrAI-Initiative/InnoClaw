"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/header";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { PROVIDERS, CONTEXT_MODES } from "@/lib/ai/models";
import { cn } from "@/lib/utils";
import { ScheduledTasksCard } from "@/components/scheduled-tasks/scheduled-tasks-card";

interface Settings {
  llmProvider: string;
  llmModel: string;
  contextMode: string;
  maxMode: boolean;
  workspaceRoots: string[];
  hasOpenAIKey: boolean;
  hasAnthropicKey: boolean;
  hasGeminiKey: boolean;
  hasGithubToken: boolean;
  hasHfToken: boolean;
  hfTokenSource: "db" | "env" | null;
  openaiBaseUrl: string;
  anthropicBaseUrl: string;
  geminiBaseUrl: string;
  feishuBotEnabled: boolean;
  wechatBotEnabled: boolean;
}

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-4o-mini");
  const [customModel, setCustomModel] = useState("");
  const [hfToken, setHfToken] = useState("");
  const [hfTokenSaving, setHfTokenSaving] = useState(false);
  const [remoteModels, setRemoteModels] = useState<
    { id: string; name: string }[]
  >([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [contextMode, setContextMode] = useState("normal");
  const [maxMode, setMaxMode] = useState(true);

  const fetchRemoteModels = useCallback(
    async (prov: string) => {
      setFetchingModels(true);
      try {
        const res = await fetch(`/api/models?provider=${prov}`);
        const data = await res.json();
        if (res.ok && Array.isArray(data.models)) {
          setRemoteModels(data.models);
          toast.success(
            t("fetchModelsSuccess", { count: data.models.length }),
          );
        } else {
          toast.error(data.error || tCommon("error"));
        }
      } catch {
        toast.error(tCommon("error"));
      } finally {
        setFetchingModels(false);
      }
    },
    [t, tCommon],
  );

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setSettings(data);
        const prov = data.llmProvider || "openai";
        setProvider(prov);
        const m = data.llmModel || "gpt-4o-mini";
        const known = (
          PROVIDERS[prov as keyof typeof PROVIDERS]?.models || []
        ).some((pm) => pm.id === m);
        if (known) {
          setModel(m);
          setCustomModel("");
        } else {
          setModel("__custom__");
          setCustomModel(m);
        }
        setContextMode(data.contextMode || "normal");
        setMaxMode(data.maxMode ?? true);
      });
  }, []);

  /** The model ID that will be saved */
  const effectiveModel = model === "__custom__" ? customModel : model;

  const handleSave = async () => {
    if (!effectiveModel.trim()) {
      toast.error(tCommon("error"));
      return;
    }
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          llm_provider: provider,
          llm_model: effectiveModel,
          context_mode: contextMode,
          max_mode: maxMode ? "true" : "false",
        }),
      });
      toast.success(tCommon("success"));
    } catch {
      toast.error(tCommon("error"));
    }
  };

  const handleHfTokenSave = async () => {
    setHfTokenSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hf_token: hfToken }),
      });
      setSettings((prev) =>
        prev ? { ...prev, hasHfToken: !!hfToken, hfTokenSource: hfToken ? "db" : prev.hfTokenSource } : prev
      );
      setHfToken("");
      toast.success(tCommon("success"));
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setHfTokenSaving(false);
    }
  };

  const handleHfTokenClear = async () => {
    setHfTokenSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hf_token: "" }),
      });
      // Re-fetch settings to get updated hasHfToken from server
      const res = await fetch("/api/settings");
      const data = await res.json();
      setSettings(data);
      setHfToken("");
      toast.success(tCommon("success"));
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setHfTokenSaving(false);
    }
  };

  const providerModels =
    PROVIDERS[provider as keyof typeof PROVIDERS]?.models || [];

  // Merge hardcoded models with remote models, avoiding duplicates
  const hardcodedIds = new Set<string>(providerModels.map((m) => m.id));
  const extraRemote = remoteModels.filter((m) => !hardcodedIds.has(m.id));

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header />
      <ScrollArea className="flex-1">
        <main className="container max-w-2xl px-4 py-8">
          <h1 className="mb-8 text-2xl font-bold">{t("title")}</h1>

          <div className="space-y-6">
            {/* AI Provider Settings */}
            <Card>
              <CardHeader>
                <CardTitle>{t("provider")}</CardTitle>
                <CardDescription>
                  {t("providerDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("provider")}</Label>
                  <Select
                    value={provider}
                    onValueChange={(v) => {
                      setProvider(v);
                      setRemoteModels([]);
                      const firstModel =
                        PROVIDERS[v as keyof typeof PROVIDERS]?.models[0]?.id;
                      if (firstModel) {
                        setModel(firstModel);
                        setCustomModel("");
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PROVIDERS).map(([id, p]) => (
                        <SelectItem key={id} value={id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{t("model")}</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={fetchingModels}
                      onClick={() => fetchRemoteModels(provider)}
                    >
                      {fetchingModels
                        ? t("fetchingModels")
                        : t("fetchModels")}
                    </Button>
                  </div>
                  <Select
                    value={model}
                    onValueChange={(v) => {
                      setModel(v);
                      if (v !== "__custom__") setCustomModel("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {providerModels.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                      {extraRemote.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="__custom__">
                        {t("customModel")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {model === "__custom__" && (
                    <Input
                      value={customModel}
                      onChange={(e) => setCustomModel(e.target.value)}
                      placeholder={t("customModelPlaceholder")}
                    />
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="max-mode">{t("maxMode")}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t("maxModeDesc")}
                    </p>
                  </div>
                  <Switch
                    id="max-mode"
                    checked={maxMode}
                    onCheckedChange={setMaxMode}
                  />
                </div>

                <div className={cn("space-y-2", !maxMode && "opacity-50")}>
                  <Label>{t("contextMode")}</Label>
                  <Select value={contextMode} onValueChange={setContextMode} disabled={!maxMode}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CONTEXT_MODES).map(([id, mode]) => (
                        <SelectItem key={id} value={id}>
                          {t(`contextMode_${mode.id}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t("contextModeDesc")}
                  </p>
                </div>

                <Button onClick={handleSave}>{tCommon("save")}</Button>
              </CardContent>
            </Card>

            {/* API Keys & Endpoints */}
            <Card>
              <CardHeader>
                <CardTitle>{t("apiKeys")}</CardTitle>
                <CardDescription>
                  {t("apiKeysDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">OpenAI API Key</span>
                  <Badge
                    variant={settings?.hasOpenAIKey ? "default" : "secondary"}
                  >
                    {settings?.hasOpenAIKey
                      ? t("configured")
                      : t("notConfigured")}
                  </Badge>
                </div>
                {settings?.openaiBaseUrl && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">OpenAI Base URL</span>
                    <span className="max-w-[60%] truncate rounded bg-muted px-2 py-1 font-mono text-xs">
                      {settings.openaiBaseUrl}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm">Anthropic API Key</span>
                  <Badge
                    variant={
                      settings?.hasAnthropicKey ? "default" : "secondary"
                    }
                  >
                    {settings?.hasAnthropicKey
                      ? t("configured")
                      : t("notConfigured")}
                  </Badge>
                </div>
                {settings?.anthropicBaseUrl && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Anthropic Base URL</span>
                    <span className="max-w-[60%] truncate rounded bg-muted px-2 py-1 font-mono text-xs">
                      {settings.anthropicBaseUrl}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm">Gemini API Key</span>
                  <Badge
                    variant={
                      settings?.hasGeminiKey ? "default" : "secondary"
                    }
                  >
                    {settings?.hasGeminiKey
                      ? t("configured")
                      : t("notConfigured")}
                  </Badge>
                </div>
                {settings?.geminiBaseUrl && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Gemini Base URL</span>
                    <span className="max-w-[60%] truncate rounded bg-muted px-2 py-1 font-mono text-xs">
                      {settings.geminiBaseUrl}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t("githubToken")}</span>
                  <Badge
                    variant={
                      settings?.hasGithubToken ? "default" : "secondary"
                    }
                  >
                    {settings?.hasGithubToken
                      ? t("configured")
                      : t("notConfigured")}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* HuggingFace Token */}
            <Card>
              <CardHeader>
                <CardTitle>{t("hfToken")}</CardTitle>
                <CardDescription>
                  {t("hfTokenDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t("hfToken")}</span>
                  <Badge
                    variant={settings?.hasHfToken ? "default" : "secondary"}
                  >
                    {settings?.hasHfToken
                      ? `${t("configured")}${settings?.hfTokenSource === "env" ? " (env)" : ""}`
                      : t("notConfigured")}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <Label>{t("hfTokenPlaceholder")}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="hf_..."
                      value={hfToken}
                      onChange={(e) => setHfToken(e.target.value)}
                    />
                    <Button
                      onClick={handleHfTokenSave}
                      disabled={!hfToken || hfTokenSaving}
                    >
                      {tCommon("save")}
                    </Button>
                  </div>
                  {settings?.hfTokenSource === "db" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleHfTokenClear}
                      disabled={hfTokenSaving}
                    >
                      {t("hfTokenClear")}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Workspace Roots */}
            <Card>
              <CardHeader>
                <CardTitle>{t("workspaceRoots")}</CardTitle>
                <CardDescription>
                  {t("workspaceRootsDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {settings?.workspaceRoots && settings.workspaceRoots.length > 0 ? (
                  <div className="space-y-1">
                    {settings.workspaceRoots.map((root) => (
                      <div
                        key={root}
                        className="rounded bg-muted px-3 py-2 font-mono text-sm"
                      >
                        {root}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("notConfigured")}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* IM Bot Integrations */}
            <Card>
              <CardHeader>
                <CardTitle>{t("botIntegrations")}</CardTitle>
                <CardDescription>
                  {t("botIntegrationsDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t("feishuBot")}</span>
                  <Badge
                    variant={settings?.feishuBotEnabled ? "default" : "secondary"}
                  >
                    {settings?.feishuBotEnabled
                      ? t("configured")
                      : t("notConfigured")}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t("wechatBot")}</span>
                  <Badge
                    variant={settings?.wechatBotEnabled ? "default" : "secondary"}
                  >
                    {settings?.wechatBotEnabled
                      ? t("configured")
                      : t("notConfigured")}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Scheduled Tasks */}
            <ScheduledTasksCard />
          </div>
        </main>
      </ScrollArea>
    </div>
  );
}
