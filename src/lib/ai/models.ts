type ModelDefinition = {
  id: string;
  name: string;
  contextWindow: number;
  supportsVision?: boolean;
};

/** Tencent Cloud TokenHub OpenAI-compatible endpoint (Guangzhou). */
export const TOKENHUB_DEFAULT_BASE_URL = "https://tokenhub.tencentmaas.com/v1";

/**
 * Active model catalog. Only these provider/model pairs can be selected or called.
 * Previously supported vendors are kept in `archived-providers.ts`.
 */
export const PROVIDERS = {
  /**
   * UI-first research model. It shares the configured DeepSeek key/endpoint:
   * the server maps it to a real callable model before building the request.
   * Kept in the catalog so the model selector and request validation agree.
   */
  scireasoner: {
    id: "scireasoner",
    name: "SciReasoner",
    models: [
      {
        id: "sci-reasoner",
        name: "SciReasoner",
        contextWindow: 1_000_000,
        supportsVision: false,
      },
    ] satisfies ModelDefinition[],
    envKey: "DEEPSEEK_API_KEY",
    supportsTools: true,
    supportsVision: false,
  },
  deepseek: {
    id: "deepseek",
    name: "Tencent Cloud DeepSeek",
    models: [
      {
        id: "deepseek-v4.1-flash",
        name: "DeepSeek V4.1 Flash",
        contextWindow: 1_000_000,
        supportsVision: false,
      },
      {
        id: "deepseek-v4-pro",
        name: "DeepSeek V4 Pro",
        contextWindow: 1_000_000,
        supportsVision: false,
      },
    ] satisfies ModelDefinition[],
    envKey: "DEEPSEEK_API_KEY",
    supportsTools: true,
    supportsVision: false,
  },
} as const;

export type ProviderId = keyof typeof PROVIDERS;

export function isSelectableModel(providerId: string, modelId: string): boolean {
  const provider = PROVIDERS[providerId as ProviderId];
  if (!provider || !modelId) return false;
  return provider.models.some((model) => model.id === modelId);
}

export function resolveSelectableModel(
  providerId?: string | null,
  modelId?: string | null,
): { providerId: ProviderId; modelId: string } {
  if (providerId && modelId && isSelectableModel(providerId, modelId)) {
    return { providerId: providerId as ProviderId, modelId };
  }
  return { providerId: DEFAULT_PROVIDER, modelId: DEFAULT_MODEL };
}

/**
 * Check whether a provider supports tool calling.
 * Unknown providers are treated as unsupported so archived vendors stay off.
 */
export function providerSupportsTools(providerId: string): boolean {
  const p = PROVIDERS[providerId as ProviderId];
  if (!p) return false;
  return (p as { supportsTools?: boolean }).supportsTools !== false;
}

/**
 * Check whether a provider supports vision (image) inputs.
 * Defaults to false for providers without an explicit `supportsVision` field.
 */
export function providerSupportsVision(providerId: string): boolean {
  const p = PROVIDERS[providerId as ProviderId];
  if (!p) return false;
  return (p as { supportsVision?: boolean }).supportsVision === true;
}

/**
 * Check whether a specific provider/model pair supports vision (image) inputs.
 * Falls back to provider-level capability when model metadata is absent.
 */
export function modelSupportsVision(
  providerId: string,
  modelId?: string | null,
): boolean {
  const provider = PROVIDERS[providerId as ProviderId];
  if (!provider) return false;

  if (!modelId) {
    return providerSupportsVision(providerId);
  }

  const model = provider.models.find((entry) => entry.id === modelId);
  if (!model) {
    return providerSupportsVision(providerId);
  }

  if (typeof model.supportsVision === "boolean") {
    return model.supportsVision;
  }

  return providerSupportsVision(providerId);
}

/** Active defaults. Stored or environment selections outside the catalog fall back here. */
export const DEFAULT_PROVIDER: ProviderId = "deepseek";
export const DEFAULT_MODEL = "deepseek-v4.1-flash";

export const CONTEXT_MODES = {
  conservative: { id: "conservative", ratio: 0.6 },
  normal: { id: "normal", ratio: 0.8 },
  extended: { id: "extended", ratio: 0.95 },
} as const;

export type ContextModeId = keyof typeof CONTEXT_MODES;
export const DEFAULT_CONTEXT_MODE: ContextModeId = "normal";

/** Resolve the context window (in tokens) for a provider/model pair. */
function resolveContextWindow(providerId: string, modelId: string): number {
  const provider = PROVIDERS[providerId as ProviderId];
  const model = provider?.models.find((m) => m.id === modelId);
  return model?.contextWindow ?? 200_000;
}

/**
 * Compute the overflow threshold (in characters) for a given provider/model/mode.
 * Uses ~4 chars per token and the mode's ratio of the model's context window.
 */
export function getOverflowThresholdChars(
  providerId: string,
  modelId: string,
  contextMode: string = "normal"
): number {
  const contextWindow = resolveContextWindow(providerId, modelId);
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
  return Math.floor(resolveContextWindow(providerId, modelId) * 3);
}

/**
 * Return the full context window size in characters (~4 chars per token)
 * for percentage display purposes. Does NOT apply mode ratio.
 */
export function getContextWindowChars(
  providerId: string,
  modelId: string
): number {
  return resolveContextWindow(providerId, modelId) * 4;
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
