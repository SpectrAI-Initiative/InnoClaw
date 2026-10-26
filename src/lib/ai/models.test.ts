import { describe, expect, it } from "vitest";
import { modelSupportsVision, providerSupportsVision } from "./models";

describe("modelSupportsVision", () => {
  it("uses model-level overrides for text-only models under vision-capable providers", () => {
    expect(providerSupportsVision("openai")).toBe(true);
    expect(modelSupportsVision("openai", "o3-mini")).toBe(false);
    expect(modelSupportsVision("deepseek", "deepseek-v3.2")).toBe(false);
    expect(modelSupportsVision("zhipu", "glm-5")).toBe(false);
  });

  it("keeps vision enabled for multimodal models", () => {
    expect(modelSupportsVision("openai", "gpt-4o")).toBe(true);
    expect(modelSupportsVision("anthropic", "claude-sonnet-5-5")).toBe(true);
    expect(modelSupportsVision("moonshot", "kimi-k2.5")).toBe(true);
    expect(modelSupportsVision("qwen", "qwen3.5-397b")).toBe(true);
  });

  it("falls back to provider-level capability when model metadata is missing", () => {
    expect(modelSupportsVision("openai", "unknown-openai-model")).toBe(true);
    expect(modelSupportsVision("unknown-provider", "unknown-model")).toBe(false);
  });
});
