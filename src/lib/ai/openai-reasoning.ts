import {
  defaultSettingsMiddleware,
  wrapLanguageModel,
  type LanguageModel,
} from "ai";
import type { LanguageModelV3 } from "@ai-sdk/provider";

export const OPENAI_REASONING_EFFORTS = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
] as const;

export type OpenAIReasoningEffort =
  (typeof OPENAI_REASONING_EFFORTS)[number];

export function normalizeOpenAIReasoningEffort(
  raw: string | undefined,
): OpenAIReasoningEffort | undefined {
  const normalized = raw?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "ultra") return "xhigh";
  if ((OPENAI_REASONING_EFFORTS as readonly string[]).includes(normalized)) {
    return normalized as OpenAIReasoningEffort;
  }
  throw new Error(
    `OPENAI_REASONING_EFFORT must be one of ${OPENAI_REASONING_EFFORTS.join(", ")}, or ultra`,
  );
}

export function applyOpenAIReasoningEffort(
  model: LanguageModel,
  raw: string | undefined,
): LanguageModel {
  const reasoningEffort = normalizeOpenAIReasoningEffort(raw);
  if (!reasoningEffort) return model;

  return wrapLanguageModel({
    model: model as LanguageModelV3,
    middleware: defaultSettingsMiddleware({
      settings: {
        providerOptions: {
          openai: { reasoningEffort },
        },
      },
    }),
  });
}
