import { beforeEach, describe, expect, it, vi } from "vitest";

describe("search-tools startup", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("does not load paper-content during module import", async () => {
    vi.doMock("@/lib/article-search/paper-content", () => {
      throw new Error("paper-content should not load during module import");
    });

    const imported = await import("./search-tools");

    expect(imported.createSearchTools).toEqual(expect.any(Function));
  });
});
