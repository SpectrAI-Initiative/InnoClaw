import { describe, expect, it } from "vitest";
import {
  normalizeModelKey,
  resolveModelSelection,
  type ProviderModelCatalog,
} from "./model-selection";

const providers: ProviderModelCatalog[] = [
  {
    id: "openai",
    name: "OpenAI",
    models: [
      { id: "gpt-5.2-chat-latest", name: "GPT-5.2" },
      { id: "gpt-4.1-mini", name: "GPT-4.1 Mini" },
    ],
  },
];

describe("model selection helpers", () => {
  it("normalizes model ids consistently", () => {
    expect(normalizeModelKey("GPT-4.1_mini")).toBe("gpt41mini");
  });

  it("keeps exact matches unchanged", () => {
    expect(
      resolveModelSelection(
        { provider: "openai", model: "gpt-4.1-mini" },
        providers,
      ),
    ).toMatchObject({
      resolvedModel: "gpt-4.1-mini",
      displayName: "GPT-4.1 Mini",
      matchKind: "exact",
      unmatchedKind: null,
    });
  });

  it("canonicalizes normalized aliases without dropping the selection", () => {
    expect(
      resolveModelSelection(
        { provider: "openai", model: "GPT_4_1_MINI" },
        providers,
      ),
    ).toMatchObject({
      requestedModel: "GPT_4_1_MINI",
      resolvedModel: "gpt-4.1-mini",
      displayName: "GPT-4.1 Mini",
      matchKind: "normalized",
      unmatchedKind: null,
    });
  });

  it("preserves unknown models as custom values", () => {
    expect(
      resolveModelSelection(
        { provider: "openai", model: "gpt-5.4" },
        providers,
        { unmatchedKind: "custom" },
      ),
    ).toMatchObject({
      requestedModel: "gpt-5.4",
      resolvedModel: "gpt-5.4",
      displayName: "gpt-5.4",
      matchKind: "unmatched",
      unmatchedKind: "custom",
    });
  });
});
