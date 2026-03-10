import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";

// We need to mock process.cwd() to point at a temp directory so tests don't
// touch the real project .env.local.
const tmpDir = path.join(__dirname, "__tmp_env_test__");

vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return { ...actual, default: actual };
});

beforeEach(() => {
  fs.mkdirSync(tmpDir, { recursive: true });
  vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("ensureEnvLocal", () => {
  it("creates .env.local from .env.example when it does not exist", async () => {
    // Write a mock .env.example
    fs.writeFileSync(path.join(tmpDir, ".env.example"), "FOO=bar\nBAZ=qux\n");

    const { ensureEnvLocal } = await import("./env-file");
    ensureEnvLocal();

    const content = fs.readFileSync(path.join(tmpDir, ".env.local"), "utf-8");
    expect(content).toBe("FOO=bar\nBAZ=qux\n");
  });

  it("does nothing when .env.local already exists", async () => {
    fs.writeFileSync(path.join(tmpDir, ".env.local"), "EXISTING=yes\n");
    fs.writeFileSync(path.join(tmpDir, ".env.example"), "FOO=bar\n");

    const { ensureEnvLocal } = await import("./env-file");
    ensureEnvLocal();

    const content = fs.readFileSync(path.join(tmpDir, ".env.local"), "utf-8");
    expect(content).toBe("EXISTING=yes\n");
  });

  it("creates a minimal .env.local when .env.example does not exist", async () => {
    const { ensureEnvLocal } = await import("./env-file");
    ensureEnvLocal();

    const content = fs.readFileSync(path.join(tmpDir, ".env.local"), "utf-8");
    expect(content).toContain("# InnoClaw configuration");
  });
});

describe("updateEnvLocal", () => {
  it("updates existing keys in-place", async () => {
    fs.writeFileSync(
      path.join(tmpDir, ".env.local"),
      "# comment\nLLM_PROVIDER=openai\nLLM_MODEL=gpt-4o\n",
    );

    const { updateEnvLocal } = await import("./env-file");
    updateEnvLocal({ LLM_MODEL: "qwen-plus" });

    const content = fs.readFileSync(path.join(tmpDir, ".env.local"), "utf-8");
    expect(content).toContain("LLM_MODEL=qwen-plus");
    expect(content).toContain("LLM_PROVIDER=openai");
    expect(content).toContain("# comment");
    expect(content).not.toContain("gpt-4o");
  });

  it("appends new keys when they do not exist", async () => {
    fs.writeFileSync(path.join(tmpDir, ".env.local"), "OTHER=val\n");

    const { updateEnvLocal } = await import("./env-file");
    updateEnvLocal({ LLM_PROVIDER: "openai", LLM_MODEL: "gpt-4o-mini" });

    const content = fs.readFileSync(path.join(tmpDir, ".env.local"), "utf-8");
    expect(content).toContain("OTHER=val");
    expect(content).toContain("LLM_PROVIDER=openai");
    expect(content).toContain("LLM_MODEL=gpt-4o-mini");
  });

  it("creates .env.local if it does not exist", async () => {
    const { updateEnvLocal } = await import("./env-file");
    updateEnvLocal({ LLM_MODEL: "custom-model" });

    const content = fs.readFileSync(path.join(tmpDir, ".env.local"), "utf-8");
    expect(content).toContain("LLM_MODEL=custom-model");
  });

  it("preserves commented-out lines", async () => {
    fs.writeFileSync(
      path.join(tmpDir, ".env.local"),
      "# LLM_MODEL=old\nLLM_MODEL=current\n",
    );

    const { updateEnvLocal } = await import("./env-file");
    updateEnvLocal({ LLM_MODEL: "new" });

    const content = fs.readFileSync(path.join(tmpDir, ".env.local"), "utf-8");
    expect(content).toContain("# LLM_MODEL=old");
    expect(content).toContain("LLM_MODEL=new");
    expect(content).not.toContain("LLM_MODEL=current");
  });
});
