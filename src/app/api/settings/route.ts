import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getWorkspaceRoots } from "@/lib/files/filesystem";
import { updateEnvLocal } from "@/lib/env-file";

export async function GET() {
  try {
    const settings = await db.select().from(appSettings);

    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }

    return NextResponse.json({
      llmProvider: settingsMap["llm_provider"] || "openai",
      llmModel: settingsMap["llm_model"] || "gpt-4o-mini",
      workspaceRoots: getWorkspaceRoots(),
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
      hasGithubToken: !!process.env.GITHUB_TOKEN,
      hasAIKey: !!process.env.OPENAI_API_KEY || !!process.env.ANTHROPIC_API_KEY,
      openaiBaseUrl: process.env.OPENAI_BASE_URL || "",
      anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL || "",
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
    if (Object.keys(envUpdates).length > 0) {
      updateEnvLocal(envUpdates);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
