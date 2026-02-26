import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_PROVIDER, DEFAULT_MODEL } from "./models";
import type { LanguageModel } from "ai";

/**
 * Check if any AI API key is configured.
 */
export function isAIAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY || !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Get the currently configured LLM model based on settings
 */
export async function getConfiguredModel(): Promise<LanguageModel> {
  const providerSetting = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "llm_provider"))
    .limit(1);

  const modelSetting = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "llm_model"))
    .limit(1);

  const provider = providerSetting[0]?.value || DEFAULT_PROVIDER;
  const modelId = modelSetting[0]?.value || DEFAULT_MODEL;

  switch (provider) {
    case "openai":
      return openai(modelId);
    case "anthropic":
      return anthropic(modelId);
    default:
      return openai(DEFAULT_MODEL);
  }
}
