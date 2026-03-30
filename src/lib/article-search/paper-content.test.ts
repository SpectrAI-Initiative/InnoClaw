import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("paper-content", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.resetModules();
  });

  it("normalizes arxiv pdf urls to https", async () => {
    const { resolvePaperPdfUrl } = await import("./paper-content");

    expect(
      resolvePaperPdfUrl({
        url: "http://arxiv.org/abs/1706.03762",
        source: "arxiv",
      }),
    ).toBe("https://arxiv.org/pdf/1706.03762");

    expect(
      resolvePaperPdfUrl({
        url: "https://arxiv.org/abs/1706.03762",
        pdfUrl: "http://arxiv.org/pdf/1706.03762",
        source: "arxiv",
      }),
    ).toBe("https://arxiv.org/pdf/1706.03762");

    expect(
      resolvePaperPdfUrl({
        url: "http://www.biorxiv.org/content/10.1101/2025.01.01.123456v1",
        source: "biorxiv",
      }),
    ).toBe("https://www.biorxiv.org/content/10.1101/2025.01.01.123456v1.full.pdf");
  });

  it("downloads and reads an arxiv paper over https", async () => {
    vi.doMock("@/lib/files/pdf-parser", () => ({
      extractPdfText: vi.fn().mockResolvedValue("attention paper full text"),
    }));

    const { readPaperText } = await import("./paper-content");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer),
    });

    const result = await readPaperText({
      url: "http://arxiv.org/abs/1706.03762",
      source: "arxiv",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://arxiv.org/pdf/1706.03762",
      expect.objectContaining({
        headers: expect.objectContaining({
          "User-Agent": "open-notebook/1.0",
        }),
      }),
    );
    expect(result).toMatchObject({
      source: "arxiv",
      pdfUrl: "https://arxiv.org/pdf/1706.03762",
      text: "attention paper full text",
      truncated: false,
    });
  });
});
