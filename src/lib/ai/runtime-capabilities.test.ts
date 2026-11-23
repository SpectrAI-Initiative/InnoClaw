import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

describe("runtimeProviderSupportsTools", () => {
  const originalEnv = { ...process.env };
  let tmpDir: string;

  beforeEach(() => {
    process.env = { ...originalEnv };
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "innobuddy-runtime-capabilities-"));
    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("keeps tools enabled for the active DeepSeek provider", async () => {
    const { runtimeProviderSupportsTools } = await import("./runtime-capabilities");
    expect(runtimeProviderSupportsTools("deepseek")).toBe(true);
  });

  it("keeps archived providers from using tools unless explicitly overridden", async () => {
    const { runtimeProviderSupportsTools } = await import("./runtime-capabilities");
    expect(runtimeProviderSupportsTools("qwen")).toBe(false);
    expect(runtimeProviderSupportsTools("openai")).toBe(false);
  });

  it("allows explicitly overriding provider-specific tool flags", async () => {
    fs.writeFileSync(path.join(tmpDir, ".env.local"), "QWEN_TOOLS_ENABLED=false\n");
    const { runtimeProviderSupportsTools } = await import("./runtime-capabilities");
    expect(runtimeProviderSupportsTools("qwen")).toBe(false);
  });
});
