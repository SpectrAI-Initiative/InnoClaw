import { beforeEach, describe, expect, it, vi } from "vitest";

describe("extract-paper-content startup", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("does not load PDF helpers during module import", async () => {
    vi.doMock("@/lib/article-search/paper-content", () => {
      throw new Error("paper-content should not load during module import");
    });
    vi.doMock("@/lib/files/pdf-image-extractor", () => {
      throw new Error("pdf-image-extractor should not load during module import");
    });
    vi.doMock("@/lib/files/text-extractor", () => {
      throw new Error("text-extractor should not load during module import");
    });

    const module = await import("./extract-paper-content");

    expect(module.extractPaperContent).toEqual(expect.any(Function));
    expect(module.extractPaperFullText).toEqual(expect.any(Function));
  });
});
