"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/header";
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { PROVIDERS } from "@/lib/ai/models";

interface Settings {
  llmProvider: string;
  llmModel: string;
  workspaceRoots: string[];
  hasOpenAIKey: boolean;
  hasAnthropicKey: boolean;
  hasGithubToken: boolean;
  hasHfToken: boolean;
  hfTokenSource: "db" | "env" | null;
  openaiBaseUrl: string;
  anthropicBaseUrl: string;
  feishuBotEnabled: boolean;
  wechatBotEnabled: boolean;
}

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-4o-mini");
  const [hfToken, setHfToken] = useState("");
  const [hfTokenSaving, setHfTokenSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setSettings(data);
        setProvider(data.llmProvider || "openai");
        setModel(data.llmModel || "gpt-4o-mini");
      });
  }, []);

  const handleSave = async () => {
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          llm_provider: provider,
          llm_model: model,
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

  return (
    <div className="min-h-screen bg-background">
      <Header />
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
                    const firstModel =
                      PROVIDERS[v as keyof typeof PROVIDERS]?.models[0]?.id;
                    if (firstModel) setModel(firstModel);
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
                <Label>{t("model")}</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {providerModels.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
        </div>
      </main>
    </div>
  );
}
