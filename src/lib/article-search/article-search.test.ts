import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Article } from "./types";

// Mock global fetch before importing modules that use it
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("arxiv", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // Reset modules to clear module-level state (rate limiter, cache)
    vi.resetModules();
  });

  it("parses arXiv Atom XML response correctly", async () => {
    const { searchArxiv } = await import("./arxiv");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>ArXiv Query</title>
  <entry>
    <id>http://arxiv.org/abs/2401.12345v1</id>
    <title>Test Paper Title</title>
    <summary>This is a test abstract about transformers.</summary>
    <published>2025-01-15T00:00:00Z</published>
    <author><name>John Doe</name></author>
    <author><name>Jane Smith</name></author>
    <link title="pdf" href="http://arxiv.org/pdf/2401.12345v1" rel="related" type="application/pdf"/>
  </entry>
</feed>`;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(xml),
    });

    const result = await searchArxiv({ keywords: ["transformer"] });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "2401.12345v1",
      title: "Test Paper Title",
      authors: ["John Doe", "Jane Smith"],
      abstract: "This is a test abstract about transformers.",
      source: "arxiv",
    });
    expect(result[0].pdfUrl).toBe("http://arxiv.org/pdf/2401.12345v1");
  });

  it("returns empty array for empty keywords", async () => {
    const { searchArxiv } = await import("./arxiv");
    const result = await searchArxiv({ keywords: [] });
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("filters by date range", async () => {
    const { searchArxiv } = await import("./arxiv");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed>
  <entry>
    <id>http://arxiv.org/abs/2401.00001v1</id>
    <title>Old Paper</title>
    <summary>Old abstract</summary>
    <published>2024-01-01T00:00:00Z</published>
    <author><name>Author A</name></author>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2501.00001v1</id>
    <title>New Paper</title>
    <summary>New abstract</summary>
    <published>2025-06-01T00:00:00Z</published>
    <author><name>Author B</name></author>
  </entry>
</feed>`;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(xml),
    });

    const result = await searchArxiv({
      keywords: ["test"],
      dateFrom: "2025-01-01",
    });

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("New Paper");
  });

  it("throws on API error", async () => {
    const { searchArxiv } = await import("./arxiv");

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
    });

    await expect(
      searchArxiv({ keywords: ["test"] })
    ).rejects.toThrow("arXiv API error: 503");
  });
});

describe("huggingface", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
    vi.resetModules();
  });

  it("parses Hugging Face API response and filters by keyword", async () => {
    const { searchHuggingFace } = await import("./huggingface");

    const mockData = [
      {
        title: "Attention Is All You Need",
        publishedAt: "2025-01-15T00:00:00Z",
        paper: {
          id: "1706.03762",
          title: "Attention Is All You Need",
          summary: "We propose a new architecture based on attention mechanisms.",
          authors: [{ name: "Ashish Vaswani", user: { fullname: "Ashish Vaswani" } }],
          publishedAt: "2025-01-15T00:00:00Z",
        },
      },
      {
        title: "BERT Paper",
        publishedAt: "2025-01-10T00:00:00Z",
        paper: {
          id: "1810.04805",
          title: "BERT: Pre-training of Deep Bidirectional Transformers",
          summary: "We introduce BERT for language understanding.",
          authors: [{ name: "Jacob Devlin" }],
          publishedAt: "2025-01-10T00:00:00Z",
        },
      },
      {
        title: "Unrelated Paper",
        publishedAt: "2025-01-12T00:00:00Z",
        paper: {
          id: "0000.00000",
          title: "A Study on Fluid Dynamics",
          summary: "Computational fluid dynamics simulation.",
          authors: [{ name: "Someone Else" }],
          publishedAt: "2025-01-12T00:00:00Z",
        },
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const result = await searchHuggingFace({
      keywords: ["attention"],
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "1706.03762",
      title: "Attention Is All You Need",
      source: "huggingface",
    });
    expect(result[0].url).toBe("https://huggingface.co/papers/1706.03762");
  });

  it("returns empty array for empty keywords", async () => {
    const { searchHuggingFace } = await import("./huggingface");
    const result = await searchHuggingFace({ keywords: [] });
    expect(result).toEqual([]);
  });

  it("throws on API error", async () => {
    const { searchHuggingFace } = await import("./huggingface");

    // Mock both initial request and retry (500 triggers a retry)
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    await expect(
      searchHuggingFace({ keywords: ["test"] })
    ).rejects.toThrow("Hugging Face API error: 500");
  });
});

describe("searchArticles (index)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.resetModules();
  });

  it("aggregates results from multiple sources", async () => {
    const { searchArticles } = await import("./index");

    // Mock arXiv response
    const arxivXml = `<feed>
  <entry>
    <id>http://arxiv.org/abs/2401.99999v1</id>
    <title>ArXiv Paper About LLM</title>
    <summary>ArXiv abstract about LLM</summary>
    <published>2025-01-15T00:00:00Z</published>
    <author><name>Author A</name></author>
  </entry>
</feed>`;

    // Mock HF response
    const hfData = [
      {
        title: "HF Paper About LLM",
        publishedAt: "2025-01-10T00:00:00Z",
        paper: {
          id: "2501.00001",
          title: "HF Paper About LLM",
          summary: "A paper about large language models and LLM.",
          authors: [{ name: "Author B" }],
          publishedAt: "2025-01-10T00:00:00Z",
        },
      },
    ];

    // Use URL-based mock to handle concurrent calls
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("arxiv")) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(arxivXml),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(hfData),
      });
    });

    const result = await searchArticles({
      keywords: ["llm"],
    });

    expect(result.totalCount).toBeGreaterThanOrEqual(1);
    expect(result.articles.length).toBeGreaterThanOrEqual(1);
  });

  it("returns errors when a source fails", async () => {
    const { searchArticles } = await import("./index");

    // Use URL-based mock to handle concurrent calls
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("arxiv")) {
        return Promise.resolve({
          ok: false,
          status: 503,
          statusText: "Unavailable",
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      });
    });

    const result = await searchArticles({
      keywords: ["test"],
      sources: ["arxiv", "huggingface"],
    });

    expect(result.errors).toBeDefined();
    expect(result.errors!["arxiv"]).toContain("503");
  });
});

describe("findRelatedArticles", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.resetModules();
  });

  it("finds related articles based on title keywords", async () => {
    const { findRelatedArticles } = await import("./index");

    const arxivXml = `<feed>
  <entry>
    <id>http://arxiv.org/abs/2401.11111v1</id>
    <title>Related Transformer Paper</title>
    <summary>Another paper about transformers</summary>
    <published>2025-02-01T00:00:00Z</published>
    <author><name>Author C</name></author>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2401.22222v1</id>
    <title>Unrelated Paper</title>
    <summary>Something else</summary>
    <published>2025-02-01T00:00:00Z</published>
    <author><name>Author D</name></author>
  </entry>
</feed>`;

    const hfData: unknown[] = [];

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(arxivXml),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(hfData),
      });

    const sourceArticle: Article = {
      id: "original-id",
      title: "Efficient Transformer Architectures for Language Understanding",
      authors: ["Author X"],
      abstract: "A study on efficient transformers.",
      url: "https://example.com",
      publishedDate: "2025-01-01",
      source: "arxiv",
    };

    const related = await findRelatedArticles(sourceArticle, 3);

    // Should return articles and exclude the source article
    expect(related.every((a) => a.id !== sourceArticle.id)).toBe(true);
  });
});
