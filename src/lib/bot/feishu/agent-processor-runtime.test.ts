import { beforeEach, describe, expect, it, vi } from "vitest";

describe("agent-processor startup", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("does not load the tool registry during module import", async () => {
    vi.doMock("@/lib/ai/tools", () => {
      throw new Error("tool registry should not load during module import");
    });

    const imported = await import("./agent-processor");

    expect(imported.processAgentMessage).toEqual(expect.any(Function));
  });
});
