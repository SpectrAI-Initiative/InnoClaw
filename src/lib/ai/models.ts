export const PROVIDERS = {
  openai: {
    id: "openai",
    name: "OpenAI",
    models: [
      { id: "gpt-5.2-chat-latest", name: "GPT-5.2", contextWindow: 256000 },
      { id: "gpt-4.1", name: "GPT-4.1", contextWindow: 1047576 },
      { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", contextWindow: 1047576 },
      { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", contextWindow: 1047576 },
      { id: "gpt-4o", name: "GPT-4o", contextWindow: 128000 },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", contextWindow: 128000 },
      { id: "o3", name: "o3", contextWindow: 200000 },
      { id: "o3-mini", name: "o3 Mini", contextWindow: 200000 },
      { id: "o4-mini", name: "o4 Mini", contextWindow: 200000 },
    ],
    envKey: "OPENAI_API_KEY",
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    models: [
      {
        id: "claude-opus-4-6",
        name: "Claude Opus 4.6",
        contextWindow: 200000,
      },
      {
        id: "claude-sonnet-4-20250514",
        name: "Claude Sonnet 4",
        contextWindow: 200000,
      },
      {
        id: "claude-3-7-sonnet-20250219",
        name: "Claude 3.7 Sonnet",
        contextWindow: 200000,
      },
      {
        id: "claude-3-5-haiku-20241022",
        name: "Claude 3.5 Haiku",
        contextWindow: 200000,
      },
    ],
    envKey: "ANTHROPIC_API_KEY",
  },
  gemini: {
    id: "gemini",
    name: "Gemini",
    models: [
      {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        contextWindow: 1048576,
      },
      {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        contextWindow: 1048576,
      },
      {
        id: "gemini-3-flash-preview",
        name: "Gemini 3 Flash",
        contextWindow: 1048576,
      },
      {
        id: "gemini-3-pro-preview",
        name: "Gemini 3 Pro",
        contextWindow: 1048576,
      },
      {
        id: "gemini-3.1-pro-preview-thinking",
        name: "Gemini 3.1 Pro (Thinking)",
        contextWindow: 1048576,
      },
    ],
    envKey: "GEMINI_API_KEY",
  },
} as const;

export type ProviderId = keyof typeof PROVIDERS;

/**
 * Read default provider / model from environment variables.
 * Falls back to hardcoded values when the env vars are not set.
 */
export const DEFAULT_PROVIDER: ProviderId =
  (process.env.LLM_PROVIDER as ProviderId) || "openai";
export const DEFAULT_MODEL =
  process.env.LLM_MODEL || "gpt-4o-mini";

export const CONTEXT_MODES = {
  conservative: { id: "conservative", ratio: 0.6 },
  normal: { id: "normal", ratio: 0.8 },
  extended: { id: "extended", ratio: 0.95 },
} as const;

export type ContextModeId = keyof typeof CONTEXT_MODES;
export const DEFAULT_CONTEXT_MODE: ContextModeId = "normal";

/**
 * Compute the overflow threshold (in characters) for a given provider/model/mode.
 * Uses ~4 chars per token and the mode's ratio of the model's context window.
 */
export function getOverflowThresholdChars(
  providerId: string,
  modelId: string,
  contextMode: string = "normal"
): number {
  const provider = PROVIDERS[providerId as ProviderId];
  const model = provider?.models.find((m) => m.id === modelId);
  const contextWindow = model?.contextWindow ?? 200_000;
  const ratio = CONTEXT_MODES[contextMode as ContextModeId]?.ratio ?? 0.8;
  return Math.floor(contextWindow * 4 * ratio);
}

/**
 * Compute the maximum transcript length (in characters) the summarization
 * endpoint should process.  Uses ~75% of the model's context window in chars,
 * leaving room for the system prompt and generated summary.
 */
export function getSummarizationLimitChars(
  providerId: string,
  modelId: string
): number {
  const provider = PROVIDERS[providerId as ProviderId];
  const model = provider?.models.find((m) => m.id === modelId);
  const contextWindow = model?.contextWindow ?? 200_000;
  return Math.floor(contextWindow * 3);
}

/**
 * Measure the text-only character length of a UI message (ignoring JSON
 * metadata like id, role, parts structure).
 */
export function getMessageTextLength(
  message: { parts?: Array<{ type: string; text?: string }> }
): number {
  if (!message.parts) return 0;
  return message.parts
    .filter((p) => p.type === "text")
    .reduce((sum, p) => sum + (p.text?.length ?? 0), 0);
}
