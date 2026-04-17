import { describe, expect, it } from "vitest";
import {
  buildClaimMapFromStructuredSummary,
  normalizeStructuredSummaryArtifact,
  selectChapterPacketsForSection,
} from "./summary-packets";
import type { DeepResearchArtifact } from "./types";

function createArtifact(overrides: Partial<DeepResearchArtifact>): DeepResearchArtifact {
  return {
    id: overrides.id ?? "artifact-1",
    sessionId: overrides.sessionId ?? "session-1",
    nodeId: overrides.nodeId ?? "node-1",
    artifactType: overrides.artifactType ?? "evidence_card",
    title: overrides.title ?? "Artifact",
    content: overrides.content ?? {},
    provenance: overrides.provenance ?? null,
    version: overrides.version ?? 1,
    createdAt: overrides.createdAt ?? "2026-04-17T00:00:00.000Z",
  };
}

describe("summary packets", () => {
  it("falls back to evidence-card derived chapter packets when summarize output is unstructured", () => {
    const summary = normalizeStructuredSummaryArtifact({
      rawOutput: { text: "plain text summary" },
      parentArtifacts: [
        createArtifact({
          title: "Evidence: sparse attention",
          content: {
            query: "稀疏注意力技术路线",
            coverageSummary: "Sparse attention methods reduce long-sequence complexity.",
            sources: [
              {
                title: "Informer",
                url: "https://arxiv.org/abs/2012.07436",
                year: 2021,
                retrievalMethod: "search",
                retrievedAt: "2026-04-17T00:00:00.000Z",
              },
            ],
            rawExcerpts: [
              { text: "ProbSparse selects dominant queries for efficient long sequence forecasting.", sourceIndex: 0 },
            ],
          },
        }),
      ],
      label: "时间序列综述",
    });

    expect(summary.chapterPackets).toHaveLength(1);
    expect(summary.chapterPackets[0]?.title).toContain("稀疏注意力");
    expect(summary.chapterPackets[0]?.citationKeys).toContain("Informer, 2021");
    expect(summary.chapterPackets[0]?.supportingQuotes[0]?.citationKey).toBe("Informer, 2021");
  });

  it("builds a claim map from chapter packets", () => {
    const summary = normalizeStructuredSummaryArtifact({
      rawOutput: {
        summary: "overall summary",
        chapterPackets: [
          {
            id: "chapter_1",
            title: "架构谱系",
            objective: "梳理技术路线",
            summary: "Summarize architecture families.",
            claims: [
              {
                id: "claim_1",
                text: "Informer opened the sparse-attention line.",
                strength: "strong",
                citationKeys: ["Informer, 2021"],
                supportingSourceTitles: ["Informer"],
                counterpoints: [],
              },
            ],
            supportingQuotes: [],
            citationKeys: ["Informer, 2021"],
            keyTakeaways: ["sparse attention mattered"],
            openQuestions: ["how to unify later architectures"],
            recommendedSectionText: "Section seed [Informer, 2021].",
          },
        ],
      },
      parentArtifacts: [
        createArtifact({
          content: {
            sources: [
              {
                title: "Informer",
                url: "https://arxiv.org/abs/2012.07436",
                year: 2021,
                retrievalMethod: "search",
                retrievedAt: "2026-04-17T00:00:00.000Z",
              },
            ],
          },
        }),
      ],
      label: "时间序列综述",
    });

    const claimMap = buildClaimMapFromStructuredSummary(summary, [
      createArtifact({
        content: {
          sources: [
            {
              title: "Informer",
              url: "https://arxiv.org/abs/2012.07436",
              year: 2021,
              retrievalMethod: "search",
              retrievedAt: "2026-04-17T00:00:00.000Z",
            },
          ],
        },
      }),
    ]);

    expect(claimMap.claims).toHaveLength(1);
    expect(claimMap.claims[0]?.supportingSources).toEqual([0]);
    expect(claimMap.gaps[0]?.topic).toContain("unify");
  });

  it("selects the most relevant chapter packets for a section", () => {
    const packets = selectChapterPacketsForSection({
      sectionTitle: "稀疏注意力技术演进",
      sectionSummary: "分析 ProbSparse 与频域分解",
      citationFocus: ["sparse attention", "Informer", "FEDformer"],
      chapterPackets: [
        {
          id: "chapter_1",
          title: "稀疏注意力路线",
          objective: "梳理 Informer 和 FEDformer",
          summary: "Sparse attention and frequency-domain methods.",
          keyTakeaways: [],
          claims: [],
          supportingQuotes: [],
          citationKeys: ["Informer, 2021", "FEDformer, 2022"],
          openQuestions: [],
          recommendedSectionText: "",
        },
        {
          id: "chapter_2",
          title: "反向嵌入路线",
          objective: "梳理 PatchTST 和 iTransformer",
          summary: "Inverted embedding and channel-first views.",
          keyTakeaways: [],
          claims: [],
          supportingQuotes: [],
          citationKeys: ["PatchTST, 2023", "iTransformer, 2024"],
          openQuestions: [],
          recommendedSectionText: "",
        },
      ],
    });

    expect(packets[0]?.title).toBe("稀疏注意力路线");
  });
});
