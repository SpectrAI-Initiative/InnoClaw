import { describe, expect, it, vi } from "vitest";
import {
  getModelSettings,
  parseModelCommandArgs,
  setModelSettings,
} from "../../../plugins/innoclaw-cli/src/model-client.mjs";

describe("innoclaw-cli model client", () => {
  it("parses /model with no args as a show command", () => {
    expect(parseModelCommandArgs([], "openai")).toEqual({ action: "show" });
  });

  it("parses /model set <model> using the current provider", () => {
    expect(parseModelCommandArgs(["set", "gpt-5.4"], "openai")).toEqual({
      action: "set",
      provider: "openai",
      model: "gpt-5.4",
    });
  });

  it("parses /model set <provider> <model>", () => {
    expect(parseModelCommandArgs(["set", "anthropic", "claude-sonnet-4-20250514"], "openai")).toEqual({
      action: "set",
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
    });
  });

  it("loads current model settings from /api/settings", async () => {
    const apiClient = {
      requestJson: vi.fn(async () => ({
        payload: {
          llmProvider: "openai",
          llmModel: "gpt-5.4",
        },
      })),
    };

    await expect(getModelSettings(apiClient)).resolves.toEqual({
      provider: "openai",
      model: "gpt-5.4",
    });
  });

  it("persists model settings through /api/settings", async () => {
    const apiClient = {
      requestJson: vi.fn(async () => ({ payload: { success: true } })),
    };

    await expect(setModelSettings(apiClient, {
      provider: "openai",
      model: "gpt-5.4",
    })).resolves.toEqual({
      provider: "openai",
      model: "gpt-5.4",
    });

    expect(apiClient.requestJson).toHaveBeenCalledWith("/api/settings", expect.objectContaining({
      method: "PATCH",
      body: {
        llm_provider: "openai",
        llm_model: "gpt-5.4",
      },
    }));
  });
});
