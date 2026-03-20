import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import os from "os";
import path from "path";
import { getWorkspaceRoots } from "@/lib/files/filesystem";
import { updateEnvLocal } from "@/lib/env-file";
import { PROVIDERS } from "@/lib/ai/models";
import { getK8sConfig, SETTINGS_TO_ENV, invalidateK8sConfigCache } from "@/lib/cluster/config";

/**
 * Derive the base-URL env var name for a provider (e.g. "openai" → "OPENAI_BASE_URL").
 */
function baseUrlEnvKey(providerId: string): string {
  return `${providerId.toUpperCase()}_BASE_URL`;
}

/**
 * Build a dynamic provider status map:
 *   providerKeys: { [providerId]: boolean }   — whether the API key env var is set
 *   providerBaseUrls: { [providerId]: string } — the base URL env var value (or "")
 */
function getProviderEnvInfo() {
  const providerKeys: Record<string, boolean> = {};
  const providerBaseUrls: Record<string, string> = {};
  for (const p of Object.values(PROVIDERS)) {
    providerKeys[p.id] = !!process.env[p.envKey];
    providerBaseUrls[p.id] = process.env[baseUrlEnvKey(p.id)] || "";
  }
  return { providerKeys, providerBaseUrls };
}

export async function GET() {
  try {
    const settings = await db.select().from(appSettings);

    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }

    const hasHfToken = !!settingsMap["hf_token"] || !!process.env.HF_TOKEN;
    const { providerKeys, providerBaseUrls } = getProviderEnvInfo();

    return NextResponse.json({
      llmProvider: settingsMap["llm_provider"] || "openai",
      llmModel: settingsMap["llm_model"] || "gpt-4o-mini",
      contextMode: settingsMap["context_mode"] || "normal",
      maxMode: settingsMap["max_mode"] !== "false",
      workspaceRoots: getWorkspaceRoots(),
      defaultBrowsePath: path.join(os.homedir(), "Desktop"),
      hasOpenAIKey: providerKeys["openai"] ?? false,
      hasAnthropicKey: providerKeys["anthropic"] ?? false,
      hasGeminiKey: providerKeys["gemini"] ?? false,
      hasGithubToken: !!process.env.GITHUB_TOKEN,
      hasHfToken,
      hfTokenSource: settingsMap["hf_token"] ? "db" : (process.env.HF_TOKEN ? "env" : null),
      hasAIKey: Object.values(providerKeys).some(Boolean),
      configuredProviders: Object.entries(providerKeys)
        .filter(([, has]) => has)
        .map(([id]) => id),
      providerKeys,
      providerBaseUrls,
      feishuBotEnabled:
        process.env.FEISHU_BOT_ENABLED === "true" &&
        !!process.env.FEISHU_APP_ID &&
        !!process.env.FEISHU_APP_SECRET &&
        !!process.env.FEISHU_VERIFICATION_TOKEN,
      wechatBotEnabled:
        process.env.WECHAT_BOT_ENABLED === "true" &&
        !!process.env.WECHAT_CORP_ID &&
        !!process.env.WECHAT_CORP_SECRET &&
        !!process.env.WECHAT_TOKEN &&
        !!process.env.WECHAT_ENCODING_AES_KEY &&
        !!process.env.WECHAT_AGENT_ID,
      styleTheme: settingsMap["style_theme"] || "default",
      k8sConfig: await getK8sConfig(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to get settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    for (const [key, value] of Object.entries(body)) {
      if (typeof value !== "string") continue;

      const existing = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, key))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(appSettings)
          .set({ value })
          .where(eq(appSettings.key, key));
      } else {
        await db.insert(appSettings).values({ key, value });
      }
    }

    // Persist LLM settings to .env.local so they survive restarts
    const envUpdates: Record<string, string> = {};
    if (typeof body.llm_provider === "string")
      envUpdates.LLM_PROVIDER = body.llm_provider;
    if (typeof body.llm_model === "string")
      envUpdates.LLM_MODEL = body.llm_model;

    // Persist provider API keys and base URLs to .env.local
    for (const p of Object.values(PROVIDERS)) {
      const apiKeyField = `${p.id}_api_key`;
      if (typeof body[apiKeyField] === "string" && body[apiKeyField]) {
        envUpdates[p.envKey] = body[apiKeyField];
      }
      const baseUrlField = `${p.id}_base_url`;
      if (typeof body[baseUrlField] === "string") {
        envUpdates[baseUrlEnvKey(p.id)] = body[baseUrlField];
      }
    }
    // GitHub token
    if (typeof body.github_token === "string" && body.github_token) {
      envUpdates.GITHUB_TOKEN = body.github_token;
    }

    // K8s cluster settings → .env.local mapping (uses shared SETTINGS_TO_ENV)
    for (const [settingsKey, envKey] of Object.entries(SETTINGS_TO_ENV)) {
      if (typeof body[settingsKey] === "string") {
        envUpdates[envKey] = body[settingsKey];
      }
    }

    if (Object.keys(envUpdates).length > 0) {
      updateEnvLocal(envUpdates);
      // Update process.env in-memory so changes take effect immediately
      for (const [k, v] of Object.entries(envUpdates)) {
        process.env[k] = v;
      }
      // Bust K8s config cache so next read picks up the new values
      invalidateK8sConfigCache();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
