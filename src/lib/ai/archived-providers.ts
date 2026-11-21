/**
 * Archived model providers.
 *
 * These catalogs are kept for reference and are not selectable. The active
 * catalog lives in `models.ts` and currently contains only Tencent Cloud
 * TokenHub DeepSeek models.
 */

type ArchivedModelDefinition = {
  id: string;
  name: string;
  contextWindow: number;
  supportsVision?: boolean;
};

export const ARCHIVED_PROVIDERS = {
  openai: {
    id: "openai",
    name: "OpenAI",
    models: [
      { id: "gpt-5.2-chat-latest", name: "GPT-5.2", contextWindow: 256000, supportsVision: true },
      { id: "gpt-4.1", name: "GPT-4.1", contextWindow: 1047576, supportsVision: true },
      { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", contextWindow: 1047576, supportsVision: true },
      { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", contextWindow: 1047576, supportsVision: true },
      { id: "gpt-4o", name: "GPT-4o", contextWindow: 128000, supportsVision: true },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", contextWindow: 128000, supportsVision: true },
      { id: "o3", name: "o3", contextWindow: 200000, supportsVision: true },
      { id: "o3-mini", name: "o3 Mini", contextWindow: 200000, supportsVision: false },
      { id: "o4-mini", name: "o4 Mini", contextWindow: 200000, supportsVision: true },
    ] satisfies ArchivedModelDefinition[],
    envKey: "OPENAI_API_KEY",
    supportsVision: true,
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    models: [
      { id: "claude-opus-4-6", name: "Claude Opus 4.6", contextWindow: 200000, supportsVision: true },
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", contextWindow: 200000, supportsVision: true },
      { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet", contextWindow: 200000, supportsVision: true },
      { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", contextWindow: 200000, supportsVision: true },
    ] satisfies ArchivedModelDefinition[],
    envKey: "ANTHROPIC_API_KEY",
    supportsVision: true,
  },
  gemini: {
    id: "gemini",
    name: "Gemini",
    models: [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", contextWindow: 1048576, supportsVision: true },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", contextWindow: 1048576, supportsVision: true },
      { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", contextWindow: 1048576, supportsVision: true },
      { id: "gemini-3-pro-preview", name: "Gemini 3 Pro", contextWindow: 1048576, supportsVision: true },
      { id: "gemini-3.1-pro-preview-thinking", name: "Gemini 3.1 Pro (Thinking)", contextWindow: 1048576, supportsVision: true },
    ] satisfies ArchivedModelDefinition[],
    envKey: "GEMINI_API_KEY",
    supportsVision: true,
  },
  shlab: {
    id: "shlab",
    name: "SH-Lab",
    models: [
      { id: "intern-s1-pro", name: "Intern S1 Pro", contextWindow: 200000, supportsVision: true },
      { id: "intern-s1", name: "Intern S1", contextWindow: 200000, supportsVision: true },
    ] satisfies ArchivedModelDefinition[],
    envKey: "SHLAB_API_KEY",
    supportsTools: true,
    supportsVision: true,
  },
  qwen: {
    id: "qwen",
    name: "Qwen",
    models: [
      { id: "Qwen3-235B", name: "Qwen3 235B", contextWindow: 200000, supportsVision: false },
      { id: "Qwen3.5-122B", name: "Qwen 3.5 122B", contextWindow: 40000, supportsVision: false },
      { id: "qwen3.5-397b", name: "Qwen 3.5 397B", contextWindow: 200000, supportsVision: true },
    ] satisfies ArchivedModelDefinition[],
    envKey: "QWEN_API_KEY",
    supportsTools: true,
    supportsVision: true,
  },
  moonshot: {
    id: "moonshot",
    name: "Moonshot",
    models: [
      { id: "kimi-k2.5", name: "Kimi K2.5", contextWindow: 200000, supportsVision: true },
    ] satisfies ArchivedModelDefinition[],
    envKey: "MOONSHOT_API_KEY",
    supportsTools: true,
    supportsVision: true,
  },
  minimax: {
    id: "minimax",
    name: "MiniMax",
    models: [
      { id: "minimax2.5", name: "MiniMax 2.5", contextWindow: 200000, supportsVision: false },
    ] satisfies ArchivedModelDefinition[],
    envKey: "MINIMAX_API_KEY",
    supportsTools: true,
    supportsVision: true,
  },
  zhipu: {
    id: "zhipu",
    name: "Zhipu",
    models: [
      { id: "glm-5", name: "GLM-5", contextWindow: 200000, supportsVision: false },
    ] satisfies ArchivedModelDefinition[],
    envKey: "ZHIPU_API_KEY",
    supportsTools: true,
    supportsVision: true,
  },
} as const;

export type ArchivedProviderId = keyof typeof ARCHIVED_PROVIDERS;

export function isArchivedProvider(providerId: string): boolean {
  return Object.prototype.hasOwnProperty.call(ARCHIVED_PROVIDERS, providerId);
}
