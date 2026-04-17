import { describe, expect, it, vi } from "vitest";

async function importWithEnv(env: Record<string, string>) {
  vi.resetModules();
  vi.doMock("@/lib/ai/provider-env", () => ({
    getCurrentEnv: () => env,
  }));
  return import("./model-overrides");
}

describe("deep research model overrides", () => {
  it("prefers Claude Opus for final-report packaging when Anthropic is configured", async () => {
    const mod = await importWithEnv({
      ANTHROPIC_API_KEY: "test-key",
    });

    const overrides = mod.getDefaultDeepResearchModelOverrides({
      provider: "openai",
      modelId: "gpt-4o-mini",
    });

    expect(overrides?.research_asset_reuse_specialist).toEqual({
      provider: "anthropic",
      modelId: "claude-opus-4-6",
    });
  });

  it("does not force an override when no preferred long-form provider is configured", async () => {
    const mod = await importWithEnv({});

    const overrides = mod.getDefaultDeepResearchModelOverrides({
      provider: "openai",
      modelId: "gpt-4.1",
    });

    expect(overrides).toBeUndefined();
  });
});
