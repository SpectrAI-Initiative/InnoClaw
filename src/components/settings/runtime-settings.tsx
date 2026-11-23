"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
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
import { modelSupportsVision, PROVIDERS, CONTEXT_MODES, DEFAULT_MODEL, DEFAULT_PROVIDER, isSelectableModel } from "@/lib/ai/models";
import { resolveModelSelection } from "@/lib/ai/model-selection";
import { cn } from "@/lib/utils";
import { ScheduledTasksCard } from "@/components/scheduled-tasks/scheduled-tasks-card";
import { useStyleTheme } from "@/lib/hooks/use-style-theme";
import { useFontSize } from "@/lib/hooks/use-font-size";
import { useFontFamily, FONT_OPTIONS } from "@/lib/hooks/use-font-family";
import { Minus, Plus, RotateCcw } from "lucide-react";
import type { K8sConfig } from "@/lib/cluster/config";

interface Settings {
  llmProvider: string;
  llmModel: string;
  contextMode: string;
  maxMode: boolean;
  workspaceRoots: string[];
  hasGithubToken: boolean;
  hasHfToken: boolean;
  hfTokenSource: "db" | "env" | null;
  providerKeys: Record<string, boolean>;
  providerBaseUrls: Record<string, string>;
  feishuBotEnabled: boolean;
  wechatBotEnabled: boolean;
  k8sConfig: K8sConfig;
}

export function RuntimeSettings() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [provider, setProvider] = useState<string>(DEFAULT_PROVIDER);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [hfToken, setHfToken] = useState("");
  const [hfTokenSaving, setHfTokenSaving] = useState(false);
  const [contextMode, setContextMode] = useState("normal");
  const [maxMode, setMaxMode] = useState(true);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [baseUrls, setBaseUrls] = useState<Record<string, string>>({});
  const [githubToken, setGithubToken] = useState("");
  const [apiKeySaving, setApiKeySaving] = useState(false);
  const { styleTheme, setStyleTheme } = useStyleTheme();
  const { fontSize, increase, decrease, reset, min, max } = useFontSize();
  const { fontFamily, setFontFamily: setFont, reset: resetFont } = useFontFamily();
  const [k8sConfig, setK8sConfig] = useState<K8sConfig>({
    kubeconfigPath: "", submitter: "", imagePullSecret: "", mountUser: "",
    clusterContextMap: { a3: "", muxi: "" },
    a3: { defaultImage: "", pvcAi4s: "", pvcUser: "", pvcAi4sA2: "" },
    muxi: { defaultImage: "", pvcAi4s: "", pvcUser: "", pvcAi4sA2: "" },
  });
  const [k8sSaving, setK8sSaving] = useState(false);

  const applyResolvedSelection = useCallback(
    (providerId: string, requestedModel: string) => {
      const catalog = PROVIDERS[providerId as keyof typeof PROVIDERS];
      if (!catalog || !isSelectableModel(providerId, requestedModel)) {
        setProvider(DEFAULT_PROVIDER);
        setModel(DEFAULT_MODEL);
        return;
      }
      const resolved = resolveModelSelection(
        { provider: providerId, model: requestedModel },
        [{ id: providerId, name: catalog.name, models: catalog.models }],
      );
      setProvider(providerId);
      setModel(resolved && resolved.matchKind !== "unmatched" ? resolved.resolvedModel : DEFAULT_MODEL);
    },
    [],
  );

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setSettings(data);
        const prov = data.llmProvider || DEFAULT_PROVIDER;
        const m = data.llmModel || DEFAULT_MODEL;
        applyResolvedSelection(prov, m);
        setContextMode(data.contextMode || "normal");
        setMaxMode(data.maxMode ?? true);
        if (data.providerBaseUrls) {
          setBaseUrls(data.providerBaseUrls);
        }
        if (data.k8sConfig) {
          setK8sConfig(data.k8sConfig);
        }
      });
  }, [applyResolvedSelection]);

  const handleSave = async () => {
    if (!model.trim()) {
      toast.error(tCommon("error"));
      return;
    }
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          llm_provider: provider,
          llm_model: model,
          context_mode: contextMode,
          max_mode: maxMode ? "true" : "false",
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast.error(data.error || tCommon("error"));
        return;
      }
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

  const handleApiKeysSave = async () => {
    setApiKeySaving(true);
    try {
      const payload: Record<string, string> = {};
      // Collect non-empty API keys
      for (const [providerId, key] of Object.entries(apiKeys)) {
        if (key.trim()) {
          payload[`${providerId}_api_key`] = key.trim();
        }
      }
      // Only send base URLs that actually changed
      for (const [providerId, url] of Object.entries(baseUrls)) {
        if (url !== (settings?.providerBaseUrls?.[providerId] ?? "")) {
          payload[`${providerId}_base_url`] = url;
        }
      }
      // GitHub token
      if (githubToken.trim()) {
        payload.github_token = githubToken.trim();
      }
      if (Object.keys(payload).length === 0) {
        return;
      }
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      // Re-fetch to update status
      const res = await fetch("/api/settings");
      const data = await res.json();
      setSettings(data);
      if (data.providerBaseUrls) setBaseUrls(data.providerBaseUrls);
      // Clear entered keys (they are now persisted)
      setApiKeys({});
      setGithubToken("");
      toast.success(tCommon("success"));
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setApiKeySaving(false);
    }
  };

  const handleK8sSave = async () => {
    setK8sSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kubeconfig_path: k8sConfig.kubeconfigPath,
          k8s_submitter: k8sConfig.submitter,
          k8s_image_pull_secret: k8sConfig.imagePullSecret,
          k8s_mount_user: k8sConfig.mountUser,
          kubeconfig_context_a3: k8sConfig.clusterContextMap.a3,
          k8s_pvc_ai4s: k8sConfig.a3.pvcAi4s,
          k8s_pvc_user: k8sConfig.a3.pvcUser,
          k8s_pvc_ai4s_a2: k8sConfig.a3.pvcAi4sA2,
          kubeconfig_context_muxi: k8sConfig.clusterContextMap.muxi,
          k8s_muxi_default_image: k8sConfig.muxi.defaultImage,
          k8s_muxi_pvc_ai4s: k8sConfig.muxi.pvcAi4s,
          k8s_muxi_pvc_user: k8sConfig.muxi.pvcUser,
          k8s_muxi_pvc_ai4s_a2: k8sConfig.muxi.pvcAi4sA2,
        }),
      });
      toast.success(tCommon("success"));
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setK8sSaving(false);
    }
  };

  const providerModels =
    PROVIDERS[provider as keyof typeof PROVIDERS]?.models || [];
  const resolvedCurrentSelection = useMemo(() => {
    const catalog = PROVIDERS[provider as keyof typeof PROVIDERS];
    if (!catalog || !model.trim()) return null;
    return resolveModelSelection(
      { provider, model },
      [{ id: provider, name: catalog.name, models: catalog.models }],
    );
  }, [model, provider]);
  const selectedKnownModelSupportsVision =
    resolvedCurrentSelection?.matchKind !== "unmatched" && resolvedCurrentSelection
      ? modelSupportsVision(provider, resolvedCurrentSelection.resolvedModel)
      : null;
  const triggerModelLabel = resolvedCurrentSelection?.displayName || model;

  return (
    <div className="bg-background">
      <ScrollArea className="max-h-[70vh]">
        <main className="max-w-5xl py-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {false && <>
            {/* Theme Style */}
            <Card>
              <CardHeader>
                <CardTitle>{t("styleTheme")}</CardTitle>
                <CardDescription>{t("styleThemeDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>{t("styleTheme")}</Label>
                  <Select
                    value={styleTheme}
                    onValueChange={(v) => setStyleTheme(v as "default" | "cartoon" | "cyberpunk-pixel" | "retro-handheld")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">{t("styleTheme_default")}</SelectItem>
                      <SelectItem value="cartoon">{t("styleTheme_cartoon")}</SelectItem>
                      <SelectItem value="cyberpunk-pixel">{t("styleTheme_cyberpunk")}</SelectItem>
                      <SelectItem value="retro-handheld">{t("styleTheme_retro")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Font Size */}
            <Card>
              <CardHeader>
                <CardTitle>{t("fontSize")}</CardTitle>
                <CardDescription>{t("fontSizeDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={decrease}
                    disabled={fontSize <= min}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[4rem] text-center text-lg font-medium tabular-nums">
                    {t("fontSizeValue", { size: fontSize })}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={increase}
                    disabled={fontSize >= max}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={reset}
                    className="ml-2"
                  >
                    <RotateCcw className="mr-1 h-3.5 w-3.5" />
                    {t("fontSizeReset")}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Font Family */}
            <Card>
              <CardHeader>
                <CardTitle>{t("fontFamily")}</CardTitle>
                <CardDescription>{t("fontFamilyDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Select value={fontFamily} onValueChange={(v) => setFont(v as typeof fontFamily)}>
                    <SelectTrigger className="w-[240px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" onClick={resetFont}>
                    <RotateCcw className="mr-1 h-3.5 w-3.5" />
                    {t("fontFamilyReset")}
                  </Button>
                </div>
                <p className="mt-3 text-sm text-muted-foreground" style={{ fontFamily: FONT_OPTIONS.find((f) => f.id === fontFamily)?.value }}>
                  The quick brown fox jumps over the lazy dog. 敏捷的棕色狐狸跳过了懒狗。
                </p>
              </CardContent>
            </Card>
            </>}

            {/* AI Provider Settings */}
            <Card className="md:col-span-2">
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
                      if (firstModel) {
                        setModel(firstModel);
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
                  <Label>{t("model")}</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger>
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="truncate">{triggerModelLabel}</span>
                        {typeof selectedKnownModelSupportsVision === "boolean" && (
                          <Badge
                            variant="outline"
                            className={`shrink-0 px-1 py-0 text-[10px] leading-4 ${
                              selectedKnownModelSupportsVision
                                ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                                : "border-amber-500/40 text-amber-700 dark:text-amber-300"
                            }`}
                          >
                            {selectedKnownModelSupportsVision ? tCommon("multimodal") : tCommon("textOnly")}
                          </Badge>
                        )}
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {providerModels.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          <div className="flex w-full items-center justify-between gap-2">
                            <span>{m.name}</span>
                            <Badge
                              variant="outline"
                              className={`shrink-0 px-1 py-0 text-[10px] leading-4 ${
                                modelSupportsVision(provider, m.id)
                                  ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                                  : "border-amber-500/40 text-amber-700 dark:text-amber-300"
                              }`}
                            >
                              {modelSupportsVision(provider, m.id) ? tCommon("multimodal") : tCommon("textOnly")}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {typeof selectedKnownModelSupportsVision === "boolean" && (
                    <p className="text-xs text-muted-foreground">
                      {selectedKnownModelSupportsVision ? tCommon("multimodal") : tCommon("textOnly")}
                    </p>
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
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>{t("apiKeys")}</CardTitle>
                <CardDescription>
                  {t("apiKeysDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {Object.entries(PROVIDERS).map(([id, p]) => (
                  <div key={id} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{p.name}</span>
                      <Badge
                        variant={settings?.providerKeys?.[id] ? "default" : "secondary"}
                      >
                        {settings?.providerKeys?.[id]
                          ? t("configured")
                          : t("notConfigured")}
                      </Badge>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t("apiKeyLabel")}</Label>
                      <Input
                        type="password"
                        placeholder={
                          settings?.providerKeys?.[id]
                            ? t("apiKeyConfiguredPlaceholder")
                            : p.envKey
                        }
                        value={apiKeys[id] || ""}
                        onChange={(e) =>
                          setApiKeys((prev) => ({ ...prev, [id]: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t("baseUrlLabel")}</Label>
                      <Input
                        type="text"
                        placeholder={t("baseUrlPlaceholder")}
                        value={baseUrls[id] || ""}
                        onChange={(e) =>
                          setBaseUrls((prev) => ({ ...prev, [id]: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                ))}
                {/* GitHub Token */}
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{t("githubToken")}</span>
                    <Badge
                      variant={settings?.hasGithubToken ? "default" : "secondary"}
                    >
                      {settings?.hasGithubToken
                        ? t("configured")
                        : t("notConfigured")}
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("apiKeyLabel")}</Label>
                    <Input
                      type="password"
                      placeholder={
                        settings?.hasGithubToken
                          ? t("apiKeyConfiguredPlaceholder")
                          : "GITHUB_TOKEN"
                      }
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  onClick={handleApiKeysSave}
                  disabled={apiKeySaving}
                  className="w-full"
                >
                  {tCommon("save")}
                </Button>
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

            {false && <>
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

            {/* K8s Cluster Configuration */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>{t("k8sCluster")}</CardTitle>
                <CardDescription>{t("k8sClusterDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Common Settings */}
                <div className="space-y-3 rounded-lg border p-3">
                  <span className="text-sm font-medium">{t("k8sCommon")}</span>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("k8sKubeconfigPath")}</Label>
                    <Input
                      placeholder="config/d_k8s"
                      value={k8sConfig.kubeconfigPath}
                      onChange={(e) => setK8sConfig((prev) => ({ ...prev, kubeconfigPath: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("k8sSubmitter")}</Label>
                    <Input
                      placeholder="your-ad-account"
                      value={k8sConfig.submitter}
                      onChange={(e) => setK8sConfig((prev) => ({ ...prev, submitter: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("k8sImagePullSecret")}</Label>
                    <Input
                      placeholder={t("k8sSubmitter")}
                      value={k8sConfig.imagePullSecret}
                      onChange={(e) => setK8sConfig((prev) => ({ ...prev, imagePullSecret: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("k8sMountUser")}</Label>
                    <Input
                      placeholder={t("k8sSubmitter")}
                      value={k8sConfig.mountUser}
                      onChange={(e) => setK8sConfig((prev) => ({ ...prev, mountUser: e.target.value }))}
                    />
                  </div>
                </div>

                {/* A3 Cluster */}
                <div className="space-y-3 rounded-lg border p-3">
                  <span className="text-sm font-medium">{t("k8sA3")}</span>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("k8sContextName")}</Label>
                    <Input
                      placeholder="vc-a3-ai4s"
                      value={k8sConfig.clusterContextMap.a3 ?? ""}
                      onChange={(e) => setK8sConfig((prev) => ({ ...prev, clusterContextMap: { ...prev.clusterContextMap, a3: e.target.value } }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("k8sPvcAi4s")}</Label>
                    <Input
                      placeholder="pvc-xxxxx"
                      value={k8sConfig.a3.pvcAi4s}
                      onChange={(e) => setK8sConfig((prev) => ({ ...prev, a3: { ...prev.a3, pvcAi4s: e.target.value } }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("k8sPvcUser")}</Label>
                    <Input
                      placeholder="pvc-xxxxx"
                      value={k8sConfig.a3.pvcUser}
                      onChange={(e) => setK8sConfig((prev) => ({ ...prev, a3: { ...prev.a3, pvcUser: e.target.value } }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("k8sPvcAi4sA2")}</Label>
                    <Input
                      placeholder="pvc-xxxxx"
                      value={k8sConfig.a3.pvcAi4sA2}
                      onChange={(e) => setK8sConfig((prev) => ({ ...prev, a3: { ...prev.a3, pvcAi4sA2: e.target.value } }))}
                    />
                  </div>
                </div>

                {/* Muxi Cluster */}
                <div className="space-y-3 rounded-lg border p-3">
                  <span className="text-sm font-medium">{t("k8sMuxi")}</span>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("k8sContextName")}</Label>
                    <Input
                      placeholder="vc-c550-jiaofu-test"
                      value={k8sConfig.clusterContextMap.muxi ?? ""}
                      onChange={(e) => setK8sConfig((prev) => ({ ...prev, clusterContextMap: { ...prev.clusterContextMap, muxi: e.target.value } }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("k8sDefaultImage")}</Label>
                    <Input
                      placeholder="registry2.d.pjlab.org.cn/..."
                      value={k8sConfig.muxi.defaultImage}
                      onChange={(e) => setK8sConfig((prev) => ({ ...prev, muxi: { ...prev.muxi, defaultImage: e.target.value } }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("k8sPvcAi4s")}</Label>
                    <Input
                      placeholder="pvc-xxxxx"
                      value={k8sConfig.muxi.pvcAi4s}
                      onChange={(e) => setK8sConfig((prev) => ({ ...prev, muxi: { ...prev.muxi, pvcAi4s: e.target.value } }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("k8sPvcUser")}</Label>
                    <Input
                      placeholder="pvc-xxxxx"
                      value={k8sConfig.muxi.pvcUser}
                      onChange={(e) => setK8sConfig((prev) => ({ ...prev, muxi: { ...prev.muxi, pvcUser: e.target.value } }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("k8sPvcAi4sA2")}</Label>
                    <Input
                      placeholder="pvc-xxxxx"
                      value={k8sConfig.muxi.pvcAi4sA2}
                      onChange={(e) => setK8sConfig((prev) => ({ ...prev, muxi: { ...prev.muxi, pvcAi4sA2: e.target.value } }))}
                    />
                  </div>
                </div>

                <Button
                  onClick={handleK8sSave}
                  disabled={k8sSaving}
                  className="w-full"
                >
                  {tCommon("save")}
                </Button>
              </CardContent>
            </Card>

            {/* Scheduled Tasks */}
            <ScheduledTasksCard className="md:col-span-2" />
            </>}
          </div>
        </main>
      </ScrollArea>
    </div>
  );
}
