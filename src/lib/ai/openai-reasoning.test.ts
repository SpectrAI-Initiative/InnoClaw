import { describe, expect, it, vi } from "vitest";
import type { LanguageModel } from "ai";
import {
  applyOpenAIReasoningEffort,
  normalizeOpenAIReasoningEffort,
} from "./openai-reasoning";

function fakeLanguageModel() {
  const doGenerate = vi.fn(async () => ({
    content: [],
    finishReason: { unified: "stop", raw: "stop" },
    usage: {
      inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 0, text: 0, reasoning: 0 },
    },
    warnings: [],
  }));
  const doStream = vi.fn(async () => ({
    stream: new ReadableStream(),
  }));
  const model = {
    specificationVersion: "v3",
    provider: "openai-compatible",
    modelId: "gpt-test",
    supportedUrls: {},
    doGenerate,
    doStream,
  } as unknown as LanguageModel;

  return { model, doGenerate, doStream };
}

describe("normalizeOpenAIReasoningEffort", () => {
  it.each(["none", "minimal", "low", "medium", "high", "xhigh"])(
    "accepts %s",
    (value) => expect(normalizeOpenAIReasoningEffort(value)).toBe(value),
  );

  it("normalizes case and maps the operator alias ultra to xhigh", () => {
    expect(normalizeOpenAIReasoningEffort(" Ultra ")).toBe("xhigh");
  });

  it.each([undefined, "", "   "])("preserves provider defaults for %j", (value) => {
    expect(normalizeOpenAIReasoningEffort(value)).toBeUndefined();
  });

  it("rejects unsupported values with the environment variable contract", () => {
    expect(() => normalizeOpenAIReasoningEffort("extreme")).toThrow(
      /OPENAI_REASONING_EFFORT.*none.*xhigh.*ultra/,
    );
  });
});

describe("applyOpenAIReasoningEffort", () => {
  it("returns the original model when no setting is configured", () => {
    const { model } = fakeLanguageModel();

    expect(applyOpenAIReasoningEffort(model, undefined)).toBe(model);
  });

  it("injects normalized effort into non-streaming calls", async () => {
    const { model, doGenerate } = fakeLanguageModel();
    const wrapped = applyOpenAIReasoningEffort(model, "ultra");

    await (wrapped as Exclude<LanguageModel, string>).doGenerate({ prompt: [] });

    expect(doGenerate).toHaveBeenCalledWith(expect.objectContaining({
      providerOptions: { openai: { reasoningEffort: "xhigh" } },
    }));
  });

  it("injects normalized effort into streaming calls", async () => {
    const { model, doStream } = fakeLanguageModel();
    const wrapped = applyOpenAIReasoningEffort(model, "high");

    await (wrapped as Exclude<LanguageModel, string>).doStream({ prompt: [] });

    expect(doStream).toHaveBeenCalledWith(expect.objectContaining({
      providerOptions: { openai: { reasoningEffort: "high" } },
    }));
  });

  it("lets explicit caller options override the configured default", async () => {
    const { model, doGenerate } = fakeLanguageModel();
    const wrapped = applyOpenAIReasoningEffort(model, "ultra");

    await (wrapped as Exclude<LanguageModel, string>).doGenerate({
      prompt: [],
      providerOptions: {
        openai: { reasoningEffort: "low" },
      },
    });

    expect(doGenerate).toHaveBeenCalledWith(expect.objectContaining({
      providerOptions: { openai: { reasoningEffort: "low" } },
    }));
  });
});
