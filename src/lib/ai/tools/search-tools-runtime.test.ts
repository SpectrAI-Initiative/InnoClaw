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

    const module = await import("./search-tools");

    expect(module.createSearchTools).toEqual(expect.any(Function));
  });
});
