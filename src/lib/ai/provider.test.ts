import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
/**
 * Unit tests for getPerModelProvider base-URL resolution in provider.ts.
 *
 * We mock @ai-sdk/openai and @ai-sdk/anthropic so the tests don't need real
 * API keys or network access—only the env-var lookup logic is exercised.
 */

const openAIDoGenerate = vi.fn(async () => ({
  content: [],
  finishReason: { unified: "stop", raw: "stop" },
  usage: {
    inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 0, text: 0, reasoning: 0 },
  },
  warnings: [],
}));

// Fake v3 chat model returned by the mocked providers.
const fakeChatModel = {
  specificationVersion: "v3" as const,
  provider: "test-provider",
  modelId: "test",
  supportedUrls: {},
  doGenerate: openAIDoGenerate,
  doStream: vi.fn(async () => ({ stream: new ReadableStream() })),
};

// Track calls to createOpenAI so we can assert baseURL / apiKey
const createOpenAISpy = vi.fn((config: unknown) => {
  void config;
  return {
    chat: vi.fn(() => fakeChatModel),
  };
});

vi.mock("@ai-sdk/openai", () => ({
  openai: { chat: vi.fn(() => fakeChatModel) },
  createOpenAI: (config: unknown) => createOpenAISpy(config),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: vi.fn(() => vi.fn(() => fakeChatModel)),
}));

// Mock the DB import so it doesn't try to open SQLite
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/db/schema", () => ({ appSettings: {} }));

describe("getPerModelProvider – base URL resolution", () => {
  const originalEnv = { ...process.env };
  let tmpDir: string;

  beforeEach(() => {
    process.env = { ...originalEnv };
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "innoclaw-provider-test-"));
    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
    createOpenAISpy.mockClear();
    openAIDoGenerate.mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
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
      createOpenAI: (config: unknown) => createOpenAISpy(config),
    }));
    vi.doMock("@ai-sdk/anthropic", () => ({
      createAnthropic: vi.fn(() => vi.fn(() => fakeChatModel)),
    }));
    vi.doMock("@/lib/db", () => ({ db: {} }));
    vi.doMock("@/lib/db/schema", () => ({ appSettings: {} }));

    const mod = await import("./provider");
    createOpenAISpy.mockClear();
    return mod.getModelFromOverride(provider, model);
  }

  async function importProviderModule(
    settingsRows: Array<{ key: string; value: string }> = [],
  ) {
    vi.resetModules();

    vi.doMock("@ai-sdk/openai", () => ({
      openai: { chat: vi.fn(() => fakeChatModel) },
      createOpenAI: (config: unknown) => createOpenAISpy(config),
    }));
    vi.doMock("@ai-sdk/anthropic", () => ({
      createAnthropic: vi.fn(() => vi.fn(() => fakeChatModel)),
    }));
    vi.doMock("drizzle-orm", () => ({
      inArray: vi.fn(() => Symbol("inArray")),
    }));
    vi.doMock("@/lib/db", () => ({
      db: {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(async () => settingsRows),
          })),
        })),
      },
    }));
    vi.doMock("@/lib/db/schema", () => ({
      appSettings: { key: "key" },
    }));

    return import("./provider");
  }

  it("uses the TokenHub endpoint when no DeepSeek base URL is configured", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-test";
    delete process.env.DEEPSEEK_BASE_URL;
    delete process.env.DEEPSEEK_DEEPSEEK_V4_1_FLASH_BASE_URL;

    await callGetModelFromOverride("deepseek", "deepseek-v4.1-flash");

    expect(createOpenAISpy).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "sk-test",
        baseURL: "https://tokenhub.tencentmaas.com/v1",
      }),
    );
  });

  it("prefers a per-model base URL over the vendor URL", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-test";
    process.env.DEEPSEEK_DEEPSEEK_V4_PRO_BASE_URL = "https://pro.example.com/v1";
    process.env.DEEPSEEK_BASE_URL = "https://vendor.example.com/v1";

    await callGetModelFromOverride("deepseek", "deepseek-v4-pro");

    expect(createOpenAISpy).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "https://pro.example.com/v1",
      }),
    );
  });

  it("rejects archived providers and models outside the catalog", async () => {
    await expect(callGetModelFromOverride("openai", "gpt-4o")).rejects.toThrow(/archived/);
    await expect(
      callGetModelFromOverride("deepseek", "deepseek-v3.2"),
    ).rejects.toThrow(/outside the active catalog/);
  });

  it("prefers a selectable .env.local model over stored settings", async () => {
    fs.writeFileSync(
      path.join(tmpDir, ".env.local"),
      "LLM_PROVIDER=deepseek\nLLM_MODEL=deepseek-v4-pro\n",
    );

    const mod = await importProviderModule([
      { key: "llm_provider", value: "deepseek" },
      { key: "llm_model", value: "deepseek-v4.1-flash" },
    ]);

    await expect(mod.getConfiguredModelSelection()).resolves.toEqual({
      providerId: "deepseek",
      modelId: "deepseek-v4-pro",
    });
  });

  it("falls back to the active default when stored settings name an archived model", async () => {
    const mod = await importProviderModule([
      { key: "llm_provider", value: "anthropic" },
      { key: "llm_model", value: "claude-sonnet-4-20250514" },
    ]);

    await expect(mod.getConfiguredModelSelection()).resolves.toEqual({
      providerId: "deepseek",
      modelId: "deepseek-v4.1-flash",
    });
  });

  it("reads a selectable model from .env.local", async () => {
    process.env.LLM_PROVIDER = "openai";
    process.env.LLM_MODEL = "gpt-4o-mini";
    fs.writeFileSync(
      path.join(tmpDir, ".env.local"),
      "LLM_PROVIDER=deepseek\nLLM_MODEL=deepseek-v4-pro\n",
    );

    const mod = await importProviderModule();

    expect(mod.getConfiguredModelSelectionFromEnv()).toEqual({
      providerId: "deepseek",
      modelId: "deepseek-v4-pro",
    });
  });
});
