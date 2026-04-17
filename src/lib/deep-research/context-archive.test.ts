import { describe, expect, it } from "vitest";
import {
  buildArchiveSourceFingerprint,
  formatResearchContextArchivePromptBlock,
  retrieveResearchContextArchive,
  splitContextTextIntoExcerpts,
  type ResearchContextArchiveManifest,
} from "./context-archive";

describe("context-archive", () => {
  it("splits long context into bounded excerpts", () => {
    const text = [
      "# Overview",
      "",
      "Sparse attention improves long-range efficiency in Transformers by reducing quadratic attention cost.",
      "",
      "## Benchmarks",
      "",
      "Long-horizon forecasting benchmarks commonly include ETT, Electricity, Exchange, Traffic, and Weather.",
    ].join("\n");

    const excerpts = splitContextTextIntoExcerpts(text, 60);
    expect(excerpts.length).toBeGreaterThan(2);
    expect(excerpts[0]?.heading).toBe("Overview");
    expect(excerpts.every((excerpt) => excerpt.text.length <= 60)).toBe(true);
  });

  it("retrieves the most relevant persisted excerpts for a query", () => {
    const manifest: ResearchContextArchiveManifest = {
      manifestKind: "context_archive",
      sessionId: "session-1",
      generatedAt: "2026-04-16T00:00:00.000Z",
      archiveDir: "/tmp/deep-research-memory/session-1",
      fileCount: 2,
      sourceFingerprint: "fingerprint",
      records: [
        {
          id: "artifact-a",
          title: "Sparse Attention Survey",
          category: "artifact",
          artifactId: "artifact-a",
          artifactType: "structured_summary",
          nodeId: "node-a",
          createdAt: "2026-04-16T00:00:00.000Z",
          updatedAt: "2026-04-16T00:00:00.000Z",
          importance: 0.9,
          summary: "Compares sparse attention mechanisms and their scaling properties.",
          keywords: ["sparse", "attention", "long", "sequence"],
          charCount: 600,
          filePath: "/tmp/deep-research-memory/session-1/artifact-a.md",
          excerptCount: 1,
          excerpts: [
            {
              id: "artifact-a:excerpt:1",
              title: "Sparse Attention Survey",
              heading: "Mechanisms",
              text: "Sparse attention reduces quadratic complexity and is central to long-context Transformer efficiency.",
              keywords: ["sparse", "attention", "transformer", "long", "context"],
              charCount: 98,
            },
          ],
        },
        {
          id: "artifact-b",
          title: "Benchmark Dataset Notes",
          category: "artifact",
          artifactId: "artifact-b",
          artifactType: "evidence_card",
          nodeId: "node-b",
          createdAt: "2026-04-16T00:00:00.000Z",
          updatedAt: "2026-04-16T00:00:00.000Z",
          importance: 0.7,
          summary: "Lists time-series forecasting datasets and metrics.",
          keywords: ["dataset", "benchmark", "ett", "weather"],
          charCount: 480,
          filePath: "/tmp/deep-research-memory/session-1/artifact-b.md",
          excerptCount: 1,
          excerpts: [
            {
              id: "artifact-b:excerpt:1",
              title: "Benchmark Dataset Notes",
              heading: "Datasets",
              text: "Representative benchmarks include ETT, Electricity, Exchange, Traffic, and Weather.",
              keywords: ["ett", "electricity", "traffic", "weather", "dataset"],
              charCount: 86,
            },
          ],
        },
      ],
    };

    const retrieved = retrieveResearchContextArchive(manifest, "sparse attention for long context", 1);
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0]?.title).toBe("Sparse Attention Survey");
    expect(retrieved[0]?.filePath).toContain("artifact-a.md");
  });

  it("formats a compact archive prompt block with file references", () => {
    const prompt = formatResearchContextArchivePromptBlock({
      query: "benchmark datasets",
      archiveDir: "/tmp/deep-research-memory/session-1",
      maxChars: 500,
      excerpts: [
        {
          id: "artifact-b:excerpt:1",
          title: "Benchmark Dataset Notes",
          heading: "Datasets",
          text: "Representative benchmarks include ETT, Electricity, Exchange, Traffic, and Weather.",
          keywords: ["ett", "electricity", "traffic", "weather", "dataset"],
          charCount: 86,
          filePath: "/tmp/deep-research-memory/session-1/artifact-b.md",
          artifactId: "artifact-b",
          artifactType: "evidence_card",
          nodeId: "node-b",
          summary: "Lists time-series forecasting datasets and metrics.",
          retrievalScore: 9.2,
        },
      ],
    });

    expect(prompt).toContain("Persisted Context Archive");
    expect(prompt).toContain("artifact-b.md");
    expect(prompt).toContain("benchmark datasets");
  });

  it("creates stable source fingerprints from archived documents", () => {
    const fingerprint = buildArchiveSourceFingerprint([
      {
        id: "artifact-a",
        title: "Sparse Attention Survey",
        category: "artifact",
        artifactId: "artifact-a",
        artifactType: "structured_summary",
        nodeId: "node-a",
        createdAt: "2026-04-16T00:00:00.000Z",
        updatedAt: "2026-04-16T00:00:00.000Z",
        importance: 0.9,
        content: "Sparse attention summary",
        summary: "Sparse attention summary",
        keywords: ["sparse", "attention"],
      },
    ]);

    expect(fingerprint).toContain("artifact-a");
    expect(fingerprint).toContain("2026-04-16T00:00:00.000Z");
  });
});
