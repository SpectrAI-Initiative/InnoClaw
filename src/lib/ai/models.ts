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
