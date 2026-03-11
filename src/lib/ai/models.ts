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
  shlab: {
    id: "shlab",
    name: "SH-Lab",
    models: [
      { id: "intern-s1-pro", name: "Intern S1 Pro", contextWindow: 200000 },
      { id: "intern-s1", name: "Intern S1", contextWindow: 200000 },
    ],
    envKey: "SHLAB_API_KEY",
    supportsTools: true,
  },
  qwen: {
    id: "qwen",
    name: "Qwen",
    models: [
      { id: "Qwen3-235B", name: "Qwen3 235B", contextWindow: 200000 },
      { id: "qwen3.5-397b", name: "Qwen 3.5 397B", contextWindow: 200000 },
    ],
    envKey: "QWEN_API_KEY",
    supportsTools: true,
  },
  moonshot: {
    id: "moonshot",
    name: "Moonshot",
    models: [
      { id: "kimi-k2.5", name: "Kimi K2.5", contextWindow: 200000 },
    ],
    envKey: "MOONSHOT_API_KEY",
    supportsTools: true,
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    models: [
      { id: "deepseek-v3.2", name: "DeepSeek V3.2", contextWindow: 200000 },
    ],
    envKey: "DEEPSEEK_API_KEY",
    supportsTools: true,
  },
  minimax: {
    id: "minimax",
    name: "MiniMax",
    models: [
      { id: "minimax2.5", name: "MiniMax 2.5", contextWindow: 200000 },
    ],
    envKey: "MINIMAX_API_KEY",
    supportsTools: true,
  },
  zhipu: {
    id: "zhipu",
    name: "Zhipu",
    models: [
      { id: "glm-5", name: "GLM-5", contextWindow: 200000 },
    ],
    envKey: "ZHIPU_API_KEY",
    supportsTools: true,
  },
} as const;

export type ProviderId = keyof typeof PROVIDERS;

/**
 * Check whether a provider supports tool calling.
 * Defaults to true for providers without an explicit `supportsTools` field
 * (OpenAI, Anthropic, Gemini).
 */
export function providerSupportsTools(providerId: string): boolean {
  const p = PROVIDERS[providerId as ProviderId];
  if (!p) return true;
  return (p as { supportsTools?: boolean }).supportsTools !== false;
}

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
 * Measure the approximate character length of a UI message across ALL part
 * types — text, reasoning, and tool invocations (input args + output).
 *
 * Tool payloads (JSON, code, file contents) tokenize at ~2-3 chars/token,
 * while the overflow threshold assumes ~4 chars/token (natural text).
 * We apply a 0.5× discount to tool content so that character counts stay
 * comparable to the threshold without triggering too aggressively.
 */
const TOOL_CONTENT_DISCOUNT = 0.5;

export function getMessageTextLength(
  message: { parts?: Array<Record<string, unknown>> }
): number {
  if (!message.parts) return 0;
  let total = 0;
  for (const part of message.parts) {
    const type = part.type as string;
    if (type === "text" || type === "reasoning") {
      total += ((part.text as string) ?? "").length;
    } else if (type.startsWith("tool-") || type === "dynamic-tool") {
      let toolChars = 0;
      // Tool input (arguments)
      if (part.input != null) {
        toolChars += typeof part.input === "string"
          ? part.input.length
          : JSON.stringify(part.input).length;
      }
      // Tool output (results) — can be very large (file contents, bash output)
      if (part.output != null) {
        toolChars += typeof part.output === "string"
          ? part.output.length
          : JSON.stringify(part.output).length;
      }
      total += Math.floor(toolChars * TOOL_CONTENT_DISCOUNT);
    }
  }
  return total;
}
