/**
 * Token usage and cost tracking for agent sessions.
 * Ported from cc-mini's cost_tracker.py
 */

// ---------------------------------------------------------------------------
// Pricing per million tokens ($/MTok)
// ---------------------------------------------------------------------------

interface PricingTier {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

const TIER_3_15: PricingTier = { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.30 };
const TIER_15_75: PricingTier = { input: 15.0, output: 75.0, cacheWrite: 18.75, cacheRead: 1.50 };
const TIER_5_25: PricingTier = { input: 5.0, output: 25.0, cacheWrite: 6.25, cacheRead: 0.50 };
const TIER_HAIKU_35: PricingTier = { input: 0.80, output: 4.0, cacheWrite: 1.0, cacheRead: 0.08 };
const TIER_HAIKU_45: PricingTier = { input: 1.0, output: 5.0, cacheWrite: 1.25, cacheRead: 0.10 };

// OpenAI pricing (approximate)
const TIER_GPT4O: PricingTier = { input: 2.50, output: 10.0, cacheWrite: 2.50, cacheRead: 1.25 };
const TIER_GPT4O_MINI: PricingTier = { input: 0.15, output: 0.60, cacheWrite: 0.15, cacheRead: 0.075 };
const TIER_GPT41: PricingTier = { input: 2.0, output: 8.0, cacheWrite: 2.0, cacheRead: 0.50 };
const TIER_GPT41_MINI: PricingTier = { input: 0.40, output: 1.60, cacheWrite: 0.40, cacheRead: 0.10 };
const TIER_GPT41_NANO: PricingTier = { input: 0.10, output: 0.40, cacheWrite: 0.10, cacheRead: 0.025 };
const TIER_O3: PricingTier = { input: 2.0, output: 8.0, cacheWrite: 2.0, cacheRead: 0.50 };
const TIER_O3_MINI: PricingTier = { input: 1.10, output: 4.40, cacheWrite: 1.10, cacheRead: 0.275 };
const TIER_O4_MINI: PricingTier = { input: 1.10, output: 4.40, cacheWrite: 1.10, cacheRead: 0.275 };

// Gemini pricing
const TIER_GEMINI_FLASH: PricingTier = { input: 0.15, output: 0.60, cacheWrite: 0.15, cacheRead: 0.04 };
const TIER_GEMINI_PRO: PricingTier = { input: 1.25, output: 10.0, cacheWrite: 1.25, cacheRead: 0.32 };

// Model prefix/substring -> tier. First match wins.
const MODEL_PRICING: [string, PricingTier][] = [
  // Anthropic
  ["claude-3-5-haiku", TIER_HAIKU_35],
  ["claude-haiku-4-5", TIER_HAIKU_45],
  ["claude-opus-4-6", TIER_5_25],
  ["claude-opus-4-5", TIER_5_25],
  ["claude-opus-4-1", TIER_15_75],
  ["claude-opus-4", TIER_15_75],
  ["claude-sonnet", TIER_3_15],
  ["claude-3-5-sonnet", TIER_3_15],
  ["claude-3-7-sonnet", TIER_3_15],
  // OpenAI
  ["gpt-5", TIER_GPT4O],
  ["gpt-4o-mini", TIER_GPT4O_MINI],
  ["gpt-4o", TIER_GPT4O],
  ["gpt-4.1-nano", TIER_GPT41_NANO],
  ["gpt-4.1-mini", TIER_GPT41_MINI],
  ["gpt-4.1", TIER_GPT41],
  ["o4-mini", TIER_O4_MINI],
  ["o3-mini", TIER_O3_MINI],
  ["o3", TIER_O3],
  // Gemini
  ["gemini-3", TIER_GEMINI_FLASH],
  ["gemini-2.5-flash", TIER_GEMINI_FLASH],
  ["gemini-2.5-pro", TIER_GEMINI_PRO],
];

const DEFAULT_TIER = TIER_3_15;

function tierForModel(model: string): PricingTier | null {
  const modelLower = model.toLowerCase();
  for (const [prefix, tier] of MODEL_PRICING) {
    if (modelLower.includes(prefix)) {
      return tier;
    }
  }
  // Unknown non-Claude model
  if (modelLower.startsWith("gpt-") || modelLower.startsWith("o1") || modelLower.startsWith("o3") || modelLower.startsWith("o4")) {
    return null;
  }
  return DEFAULT_TIER;
}

// ---------------------------------------------------------------------------
// Usage data
// ---------------------------------------------------------------------------

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  costUsd: number;
  pricingKnown: boolean;
}

export interface UsageData {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
  // AI SDK uses these names
  promptTokens?: number;
  completionTokens?: number;
}

export interface CostSnapshot {
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  modelUsage: Record<string, ModelUsage>;
  startTime: number;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return v === Math.floor(v) ? `${v}m` : `${v.toFixed(1)}m`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return v === Math.floor(v) ? `${v}k` : `${v.toFixed(1)}k`;
  }
  return String(n);
}

// ---------------------------------------------------------------------------
// CostTracker
// ---------------------------------------------------------------------------

export class CostTracker {
  private _totalCostUsd = 0;
  private _modelUsage: Record<string, ModelUsage> = {};
  private _startTime = Date.now();

  get totalCostUsd(): number {
    return this._totalCostUsd;
  }

  get totalInputTokens(): number {
    return Object.values(this._modelUsage).reduce((sum, mu) => sum + mu.inputTokens, 0);
  }

  get totalOutputTokens(): number {
    return Object.values(this._modelUsage).reduce((sum, mu) => sum + mu.outputTokens, 0);
  }

  static calculateCost(model: string, usage: UsageData): number {
    const tier = tierForModel(model);
    if (!tier) return 0;
    const inp = usage.inputTokens ?? usage.promptTokens ?? 0;
    const out = usage.outputTokens ?? usage.completionTokens ?? 0;
    const cacheRead = usage.cacheReadInputTokens ?? 0;
    const cacheWrite = usage.cacheCreationInputTokens ?? 0;
    const regularInput = Math.max(inp - cacheRead - cacheWrite, 0);
    return (
      regularInput * tier.input +
      out * tier.output +
      cacheRead * tier.cacheRead +
      cacheWrite * tier.cacheWrite
    ) / 1_000_000;
  }

  addUsage(model: string, usage: UsageData): number {
    const cost = CostTracker.calculateCost(model, usage);
    this._totalCostUsd += cost;

    const inp = usage.inputTokens ?? usage.promptTokens ?? 0;
    const out = usage.outputTokens ?? usage.completionTokens ?? 0;
    const cacheRead = usage.cacheReadInputTokens ?? 0;
    const cacheWrite = usage.cacheCreationInputTokens ?? 0;

    if (!this._modelUsage[model]) {
      this._modelUsage[model] = {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
        costUsd: 0,
        pricingKnown: tierForModel(model) !== null,
      };
    }
    const mu = this._modelUsage[model];
    mu.inputTokens += inp;
    mu.outputTokens += out;
    mu.cacheReadInputTokens += cacheRead;
    mu.cacheCreationInputTokens += cacheWrite;
    mu.costUsd += cost;
    return cost;
  }

  getSnapshot(): CostSnapshot {
    return {
      totalCostUsd: this._totalCostUsd,
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      modelUsage: { ...this._modelUsage },
      startTime: this._startTime,
    };
  }

  toJSON(): CostSnapshot {
    return this.getSnapshot();
  }

  static fromJSON(data: CostSnapshot): CostTracker {
    const tracker = new CostTracker();
    tracker._totalCostUsd = data.totalCostUsd ?? 0;
    tracker._modelUsage = data.modelUsage ?? {};
    tracker._startTime = data.startTime ?? Date.now();
    return tracker;
  }

  reset(): void {
    this._totalCostUsd = 0;
    this._modelUsage = {};
    this._startTime = Date.now();
  }
}
