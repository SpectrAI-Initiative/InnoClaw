import { beforeEach, describe, expect, it, vi } from "vitest";

describe("text-extractor startup", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("does not load the pdf parser during module import", async () => {
    vi.doMock("./pdf-parser", () => {
      throw new Error("pdf parser should not load during module import");
    });

    const imported = await import("./text-extractor");

    expect(imported.extractText).toEqual(expect.any(Function));
    expect(imported.isSupportedFile).toEqual(expect.any(Function));
  });
});
