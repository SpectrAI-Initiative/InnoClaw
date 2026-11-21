import { describe, expect, it } from "vitest";
import {
  isSelectableModel,
  modelSupportsVision,
  providerSupportsTools,
  providerSupportsVision,
  resolveSelectableModel,
} from "./models";

describe("active model catalog", () => {
  it("allows only the Tencent Cloud DeepSeek models", () => {
    expect(isSelectableModel("deepseek", "deepseek-v4.1-flash")).toBe(true);
    expect(isSelectableModel("deepseek", "deepseek-v4-pro")).toBe(true);
    expect(isSelectableModel("deepseek", "deepseek-v3.2")).toBe(false);
    expect(isSelectableModel("openai", "gpt-4o")).toBe(false);
  });

  it("falls back to DeepSeek Flash when a stored selection is archived", () => {
    expect(resolveSelectableModel("openai", "gpt-4o-mini")).toEqual({
      providerId: "deepseek",
      modelId: "deepseek-v4.1-flash",
    });
    expect(resolveSelectableModel("deepseek", "deepseek-v4-pro")).toEqual({
      providerId: "deepseek",
      modelId: "deepseek-v4-pro",
    });
  });

  it("treats the active DeepSeek models as text-only and tool-capable", () => {
    expect(providerSupportsVision("deepseek")).toBe(false);
    expect(modelSupportsVision("deepseek", "deepseek-v4.1-flash")).toBe(false);
    expect(modelSupportsVision("deepseek", "deepseek-v4-pro")).toBe(false);
    expect(providerSupportsTools("deepseek")).toBe(true);
    expect(providerSupportsTools("openai")).toBe(false);
    expect(modelSupportsVision("unknown-provider", "unknown-model")).toBe(false);
  });
});
