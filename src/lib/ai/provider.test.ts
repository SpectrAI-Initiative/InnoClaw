import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Unit tests for getPerModelProvider base-URL resolution in provider.ts.
 *
 * We mock @ai-sdk/openai and @ai-sdk/anthropic so the tests don't need real
 * API keys or network access—only the env-var lookup logic is exercised.
 */

// Fake chat model returned by the mocked provider
const fakeChatModel = { modelId: "test" };

// Track calls to createOpenAI so we can assert baseURL / apiKey
const createOpenAISpy = vi.fn(() => ({
  chat: vi.fn(() => fakeChatModel),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: { chat: vi.fn(() => fakeChatModel) },
  createOpenAI: (...args: unknown[]) => createOpenAISpy(...args),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: vi.fn(() => vi.fn(() => fakeChatModel)),
}));

// Mock the DB import so it doesn't try to open SQLite
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/db/schema", () => ({ appSettings: {} }));

describe("getPerModelProvider – base URL resolution", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    createOpenAISpy.mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  /**
   * We can't directly import getPerModelProvider because it's not exported.
   * Instead, we test through the exported getModelFromOverride which calls
   * buildLanguageModel → getPerModelProvider for per-model-URL providers.
   */
  async function callGetModelFromOverride(provider: string, model: string) {
    // Clear module cache so env vars are re-read
    vi.resetModules();

    // Re-apply mocks after resetModules
    vi.doMock("@ai-sdk/openai", () => ({
      openai: { chat: vi.fn(() => fakeChatModel) },
      createOpenAI: (...args: unknown[]) => createOpenAISpy(...args),
    }));
    vi.doMock("@ai-sdk/anthropic", () => ({
      createAnthropic: vi.fn(() => vi.fn(() => fakeChatModel)),
    }));
    vi.doMock("@/lib/db", () => ({ db: {} }));
    vi.doMock("@/lib/db/schema", () => ({ appSettings: {} }));

    const mod = await import("./provider");
    return mod.getModelFromOverride(provider, model);
  }

  it("uses per-model base URL when set", async () => {
    process.env.MOONSHOT_API_KEY = "sk-test";
    process.env.MOONSHOT_KIMI_K2_5_BASE_URL = "https://per-model.example.com/v1";
    process.env.MOONSHOT_BASE_URL = "https://vendor.example.com/v1";

    await callGetModelFromOverride("moonshot", "kimi-k2.5");

    expect(createOpenAISpy).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "https://per-model.example.com/v1",
      }),
    );
  });

  it("falls back to vendor-level base URL when per-model URL is not set", async () => {
    process.env.QWEN_API_KEY = "sk-test";
    process.env.QWEN_BASE_URL = "https://vendor.example.com/v1";

    await callGetModelFromOverride("qwen", "Qwen3-235B");

    expect(createOpenAISpy).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "https://vendor.example.com/v1",
      }),
    );
  });

  it("throws when neither per-model nor vendor-level URL is set", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-test";
    delete process.env.DEEPSEEK_DEEPSEEK_V3_2_BASE_URL;
    delete process.env.DEEPSEEK_BASE_URL;

    await expect(
      callGetModelFromOverride("deepseek", "deepseek-v3.2"),
    ).rejects.toThrow(/DEEPSEEK_DEEPSEEK_V3_2_BASE_URL.*DEEPSEEK_BASE_URL/);
  });

  it("error message mentions both env var names", async () => {
    process.env.ZHIPU_API_KEY = "sk-test";
    delete process.env.ZHIPU_GLM_5_BASE_URL;
    delete process.env.ZHIPU_BASE_URL;

    await expect(
      callGetModelFromOverride("zhipu", "glm-5"),
    ).rejects.toThrow("Set ZHIPU_GLM_5_BASE_URL or ZHIPU_BASE_URL");
  });

  it("works for all per-model-URL providers with vendor-level URL", async () => {
    const cases = [
      { provider: "shlab", model: "intern-s1-pro", envPrefix: "SHLAB" },
      { provider: "qwen", model: "Qwen3-235B", envPrefix: "QWEN" },
      { provider: "moonshot", model: "kimi-k2.5", envPrefix: "MOONSHOT" },
      { provider: "deepseek", model: "deepseek-v3.2", envPrefix: "DEEPSEEK" },
      { provider: "minimax", model: "minimax2.5", envPrefix: "MINIMAX" },
      { provider: "zhipu", model: "glm-5", envPrefix: "ZHIPU" },
    ];

    for (const { provider, model, envPrefix } of cases) {
      process.env[`${envPrefix}_API_KEY`] = "sk-test";
      process.env[`${envPrefix}_BASE_URL`] = `https://${provider}.example.com/v1`;
      createOpenAISpy.mockClear();

      await callGetModelFromOverride(provider, model);

      expect(createOpenAISpy).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: `https://${provider}.example.com/v1`,
        }),
      );

      // Cleanup
      delete process.env[`${envPrefix}_API_KEY`];
      delete process.env[`${envPrefix}_BASE_URL`];
    }
  });
});
