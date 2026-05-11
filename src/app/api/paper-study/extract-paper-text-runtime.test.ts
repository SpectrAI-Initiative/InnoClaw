import { beforeEach, describe, expect, it, vi } from "vitest";

describe("extract-paper-text startup", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("does not load the remote paper fetcher during module import", async () => {
    vi.doMock("@/lib/paper-study/remote-paper-fetcher", () => {
      throw new Error("remote-paper-fetcher should not load during module import");
    });

    const module = await import("./extract-paper-text");

    expect(module.extractPaperFullText).toEqual(expect.any(Function));
    expect(module.extractPaperFullContent).toEqual(expect.any(Function));
  });
});
