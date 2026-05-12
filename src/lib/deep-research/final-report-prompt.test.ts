import { describe, expect, it } from "vitest";
import {
  analyzeFinalReportCitationCoverage,
  appendDeterministicReferencesSection,
  assembleFinalReportFromSections,
  buildFinalReportPlannerSystemPrompt,
  buildFinalReportPromptBundle,
  buildFinalReportSectionCitationRevisionPrompt,
  buildFinalReportSectionDraftPrompt,
  buildFinalReportPrompt,
  extractRecognizedCitationKeys,
  getRelevantChapterPacketsForSection,
  getFinalReportDraftingOrder,
  getMinimumRequiredCitationCount,
  normalizeFinalReportSectionPlan,
} from "./prompts";
import type {
  DeepResearchArtifact,
  DeepResearchMessage,
  DeepResearchNode,
  DeepResearchSession,
} from "./types";

function createSession(): DeepResearchSession {
  return {
    id: "session-1",
    workspaceId: "workspace-1",
    title: "时间序列 Transformer 架构综述",
    status: "running",
    contextTag: "final_report",
    config: {
      budget: { maxTotalTokens: 100000, maxOpusTokens: 100000 },
      maxWorkerFanOut: 1,
      maxReviewerRounds: 2,
      maxExecutionLoops: 1,
      maxWorkerConcurrency: 1,
      literature: {
        maxLiteratureRounds: 3,
        maxPapersPerRound: 10,
        maxTotalPapers: 30,
        maxReviewerRequestedExpansionRounds: 1,
        maxSearchRetries: 2,
      },
      execution: {
        defaultLauncherType: "local_shell",
        defaultResources: { gpu: 0, memoryMb: 0, cpu: 1, privateMachine: "no" },
        defaultMounts: [],
        defaultChargedGroup: "",
      },
    },
    budget: {
      totalTokens: 1000,
      opusTokens: 0,
      byRole: {},
      byNode: {},
    },
    pendingCheckpointId: null,
    literatureRound: 1,
    reviewerRound: 0,
    executionLoop: 0,
    error: null,
    remoteProfileId: null,
    createdAt: "2026-04-15T00:00:00.000Z",
    updatedAt: "2026-04-15T00:00:00.000Z",
  };
}

function createNode(): DeepResearchNode {
  return {
    id: "node-1",
    sessionId: "session-1",
    parentId: null,
    nodeType: "final_report",
    label: "Generate final research report",
    status: "pending",
    assignedRole: "research_asset_reuse_specialist",
    assignedModel: null,
    input: {
      targetAudience: "research engineers",
    },
    output: null,
    error: null,
    dependsOn: [],
    supersedesId: null,
    supersededById: null,
    branchKey: null,
    retryOfId: null,
    retryCount: 0,
    contextTag: "final_report",
    stageNumber: 0,
    requiresConfirmation: true,
    confirmedAt: null,
    confirmedBy: null,
    confirmationOutcome: null,
    positionX: null,
    positionY: null,
    startedAt: null,
    completedAt: null,
    createdAt: "2026-04-15T00:00:00.000Z",
    updatedAt: "2026-04-15T00:00:00.000Z",
  };
}

function createMessage(content: string): DeepResearchMessage {
  return {
    id: "message-1",
    sessionId: "session-1",
    role: "user",
    content,
    metadata: null,
    relatedNodeId: null,
    relatedArtifactIds: [],
    createdAt: "2026-04-15T00:00:00.000Z",
  };
}

function createArtifact(overrides: Partial<DeepResearchArtifact>): DeepResearchArtifact {
  return {
    id: overrides.id ?? "artifact-1",
    sessionId: overrides.sessionId ?? "session-1",
    nodeId: overrides.nodeId ?? "node-upstream",
    artifactType: overrides.artifactType ?? "evidence_card",
    title: overrides.title ?? "Evidence Card",
    content: overrides.content ?? {},
    provenance: overrides.provenance ?? null,
    version: overrides.version ?? 1,
    createdAt: overrides.createdAt ?? "2026-04-15T00:00:00.000Z",
  };
}

describe("buildFinalReportPrompt", () => {
  it("requires a detailed survey-style markdown report for review requests", () => {
    const prompt = buildFinalReportPrompt(
      createSession(),
      [createMessage("请给我一个详细的时间序列 Transformer 架构综述，强调分类、代表模型和局限。")],
      [
        createArtifact({
          artifactType: "evidence_card",
          title: "Evidence: Collect papers",
          content: {
            query: "time series transformer survey",
            sourcesFound: 3,
            coverageSummary: "Collected representative papers on forecasting, anomaly detection, and long-horizon modeling.",
            sources: [
              { title: "Informer", year: 2021, relevance: "efficient long-sequence forecasting", url: "https://arxiv.org/abs/2012.07436", venue: "AAAI" },
              { title: "Autoformer", year: 2021, relevance: "decomposition and autocorrelation", url: "https://arxiv.org/abs/2106.13008", venue: "NeurIPS" },
            ],
          },
        }),
      ],
      createNode(),
    );

    expect(prompt).toContain("Produce a detailed markdown report, not a short note.");
    expect(prompt).toContain("时间序列 Transformer 架构谱系 / 分类框架");
    expect(prompt).toContain("代表性模型与关键设计选择比较");
    expect(prompt).toContain("Representative sources");
    expect(prompt).toContain("请直接使用中文撰写报告");
    expect(prompt).toContain("Use inline citations throughout the report");
    expect(prompt).toContain("- [Informer, 2021]");
    expect(prompt).toContain("- [Autoformer, 2021]");
    expect(prompt).toContain("References");
    expect(prompt).toContain("query=time series transformer survey");
    expect(prompt).toContain("Minimum unique citations expected in this report");
    expect(prompt).toContain("The paper must be detailed, complete, and logically strong.");
    expect(prompt).toContain("Prefer paragraph-level argument development: claim -> evidence -> comparison -> implication.");
  });

  it("computes a higher citation floor for large survey evidence pools", () => {
    expect(getMinimumRequiredCitationCount(118, true)).toBeGreaterThanOrEqual(30);
    expect(getMinimumRequiredCitationCount(10, true)).toBe(10);
    expect(getMinimumRequiredCitationCount(10, false)).toBe(8);
  });

  it("detects under-covered reports against the citation registry", () => {
    const artifacts = [
      createArtifact({
        artifactType: "evidence_card",
        title: "Evidence: Collect papers",
        content: {
          query: "time series transformer survey",
          sourcesFound: 4,
          coverageSummary: "Collected representative papers.",
          sources: [
            { title: "Informer", year: 2021, url: "https://arxiv.org/abs/2012.07436" },
            { title: "Autoformer", year: 2021, url: "https://arxiv.org/abs/2106.13008" },
            { title: "FEDformer", year: 2022, url: "https://arxiv.org/abs/2201.12740" },
            { title: "PatchTST", year: 2023, url: "https://arxiv.org/abs/2211.14730" },
          ],
        },
      }),
    ];

    const coverage = analyzeFinalReportCitationCoverage(
      "# Report\n\nThis section cites [Informer, 2021] and [Autoformer, 2021].",
      artifacts,
      "时间序列 Transformer 架构综述",
      ["请写综述"],
    );

    expect(coverage.availableCitationCount).toBe(4);
    expect(coverage.citedCitationCount).toBe(2);
    expect(coverage.hasReferencesSection).toBe(false);
    expect(coverage.meetsCoverage).toBe(false);
    expect(coverage.missingCitationKeys).toContain("FEDformer, 2022");
  });

  it("normalizes section plans and drafts introduction/conclusion last", () => {
    const sectionPlan = normalizeFinalReportSectionPlan({
      rawPlan: {
        reportTitle: "时间序列 Transformer 架构综述",
        sections: [
          { id: "intro", title: "引言", kind: "introduction", summary: "介绍背景", targetTakeaway: "明确范围", citationFocus: ["background"] },
          { id: "body-1", title: "架构谱系与路线", kind: "body", summary: "分类技术路线", targetTakeaway: "给出 taxonomy", citationFocus: ["taxonomy"] },
          { id: "body-2", title: "代表模型比较", kind: "body", summary: "比较模型", targetTakeaway: "解释设计差异", citationFocus: ["representative methods"] },
          { id: "conclusion", title: "结论", kind: "conclusion", summary: "总结全文", targetTakeaway: "收束结论", citationFocus: ["synthesis"] },
        ],
      },
      sessionTitle: "时间序列 Transformer 架构综述",
      preferredOutputLanguage: "zh",
      isSurveyLikeRequest: true,
    });

    const draftingOrder = getFinalReportDraftingOrder(sectionPlan);
    expect(draftingOrder.map((section) => section.kind)).toEqual([
      "body",
      "body",
      "introduction",
      "conclusion",
    ]);

    const report = assembleFinalReportFromSections({
      reportTitle: sectionPlan.reportTitle,
      sectionPlan,
      sectionDrafts: new Map([
        ["intro", "## 引言\n导论内容"],
        ["body-1", "## 架构谱系与路线\n主体一"],
        ["body-2", "## 代表模型比较\n主体二"],
        ["conclusion", "## 结论\n总结内容"],
      ]),
    });

    expect(report).toContain("# 时间序列 Transformer 架构综述");
    expect(report.indexOf("## 引言")).toBeLessThan(report.indexOf("## 架构谱系与路线"));
    expect(report.indexOf("## 结论")).toBeGreaterThan(report.indexOf("## 代表模型比较"));
  });

  it("requires academically strong planning and section drafting prompts", () => {
    const plannerPrompt = buildFinalReportPlannerSystemPrompt(createNode());
    expect(plannerPrompt).toContain("The outline must be complete enough to support a full paper-level draft");
    expect(plannerPrompt).toContain("The full outline should progress logically");

    const sectionPlan = normalizeFinalReportSectionPlan({
      rawPlan: {
        reportTitle: "时间序列 Transformer 架构综述",
        sections: [
          { id: "body-1", title: "架构谱系与路线", kind: "body", summary: "分类技术路线", targetTakeaway: "给出 taxonomy", citationFocus: ["taxonomy"] },
          { id: "intro", title: "引言", kind: "introduction", summary: "介绍背景", targetTakeaway: "明确范围", citationFocus: ["background"] },
          { id: "conclusion", title: "结论", kind: "conclusion", summary: "总结全文", targetTakeaway: "收束结论", citationFocus: ["synthesis"] },
        ],
      },
      sessionTitle: "时间序列 Transformer 架构综述",
      preferredOutputLanguage: "zh",
      isSurveyLikeRequest: true,
    });

    const bodyPrompt = buildFinalReportSectionDraftPrompt({
      sessionTitle: "时间序列 Transformer 架构综述",
      preferredOutputLanguage: "zh",
      section: sectionPlan.sections.find((section) => section.kind === "body")!,
      sectionPlan,
      artifactDigest: "evidence digest",
      citationRegistry: "citation registry",
    });
    expect(bodyPrompt).toContain("Write this as a substantial academic section");
    expect(bodyPrompt).toContain("Use coherent paragraphs with strong internal logical flow");

    const introductionPrompt = buildFinalReportSectionDraftPrompt({
      sessionTitle: "时间序列 Transformer 架构综述",
      preferredOutputLanguage: "zh",
      section: sectionPlan.sections.find((section) => section.kind === "introduction")!,
      sectionPlan,
      artifactDigest: "evidence digest",
      citationRegistry: "citation registry",
      draftedBodySections: [{ title: "架构谱系与路线", content: "正文" }],
    });
    expect(introductionPrompt).toContain("Write a full academic introduction");

    const conclusionPrompt = buildFinalReportSectionDraftPrompt({
      sessionTitle: "时间序列 Transformer 架构综述",
      preferredOutputLanguage: "zh",
      section: sectionPlan.sections.find((section) => section.kind === "conclusion")!,
      sectionPlan,
      artifactDigest: "evidence digest",
      citationRegistry: "citation registry",
      draftedFullSections: [{ title: "架构谱系与路线", content: "正文" }],
    });
    expect(conclusionPrompt).toContain("The conclusion must synthesize the entire paper");
  });

  it("blocks survey-style drafting when the evidence base is too thin", () => {
    const bundle = buildFinalReportPromptBundle(
      createSession(),
      [createMessage("请写一个系统综述，覆盖代表模型和实验规律。")],
      [
        createArtifact({
          artifactType: "evidence_card",
          title: "Evidence: single paper",
          content: {
            query: "time series transformer",
            sourcesFound: 1,
            sources: [
              { title: "Informer", year: 2021, url: "https://arxiv.org/abs/2012.07436" },
            ],
          },
        }),
      ],
      { digestMode: "compact" },
    );

    expect(bundle.readiness.canDraft).toBe(false);
    expect(bundle.readiness.status).toBe("insufficient_evidence");
    expect(bundle.readiness.recommendedAction).toContain("targeted");
  });

  it("caps overly granular body plans to a safer number of sections", () => {
    const sectionPlan = normalizeFinalReportSectionPlan({
      rawPlan: {
        reportTitle: "时间序列 Transformer 架构综述",
        sections: [
          { id: "intro", title: "引言", kind: "introduction", summary: "介绍背景", targetTakeaway: "明确范围", citationFocus: ["background"] },
          { id: "body-1", title: "一", kind: "body", summary: "一", targetTakeaway: "一", citationFocus: ["a"] },
          { id: "body-2", title: "二", kind: "body", summary: "二", targetTakeaway: "二", citationFocus: ["b"] },
          { id: "body-3", title: "三", kind: "body", summary: "三", targetTakeaway: "三", citationFocus: ["c"] },
          { id: "body-4", title: "四", kind: "body", summary: "四", targetTakeaway: "四", citationFocus: ["d"] },
          { id: "body-5", title: "五", kind: "body", summary: "五", targetTakeaway: "五", citationFocus: ["e"] },
          { id: "conclusion", title: "结论", kind: "conclusion", summary: "总结全文", targetTakeaway: "收束结论", citationFocus: ["synthesis"] },
        ],
      },
      sessionTitle: "时间序列 Transformer 架构综述",
      preferredOutputLanguage: "zh",
      isSurveyLikeRequest: true,
      maxBodySections: 3,
    });

    expect(sectionPlan.sections.filter((section) => section.kind === "body")).toHaveLength(3);
    expect(sectionPlan.sections.map((section) => section.id)).toEqual([
      "intro",
      "body-1",
      "body-2",
      "body-3",
      "conclusion",
    ]);
  });

  it("truncates long drafted-section references in section prompts", () => {
    const longContent = "A".repeat(2000);
    const sectionPlan = normalizeFinalReportSectionPlan({
      rawPlan: {
        reportTitle: "时间序列 Transformer 架构综述",
        sections: [
          { id: "intro", title: "引言", kind: "introduction", summary: "介绍背景", targetTakeaway: "明确范围", citationFocus: ["background"] },
          { id: "body-1", title: "主体", kind: "body", summary: "主体总结", targetTakeaway: "主体结论", citationFocus: ["taxonomy"] },
          { id: "conclusion", title: "结论", kind: "conclusion", summary: "总结全文", targetTakeaway: "收束结论", citationFocus: ["synthesis"] },
        ],
      },
      sessionTitle: "时间序列 Transformer 架构综述",
      preferredOutputLanguage: "zh",
      isSurveyLikeRequest: true,
    });

    const prompt = buildFinalReportSectionDraftPrompt({
      sessionTitle: "时间序列 Transformer 架构综述",
      preferredOutputLanguage: "zh",
      section: sectionPlan.sections[0],
      sectionPlan,
      artifactDigest: "digest",
      citationRegistry: "registry",
      draftedBodySections: [{ title: "主体", content: longContent }],
      referenceExcerptLimit: 80,
    });

    expect(prompt).toContain("### 主体");
    expect(prompt).toContain("A".repeat(40));
    expect(prompt).not.toContain("A".repeat(500));
  });

  it("prioritizes explicitly referenced artifacts in the final-report digest", () => {
    const bundle = buildFinalReportPromptBundle(
      createSession(),
      [createMessage("请生成终稿")],
      [
        createArtifact({
          id: "artifact-evidence",
          artifactType: "evidence_card",
          title: "Evidence: 主要证据",
          content: {
            query: "time series transformer",
            sourcesFound: 2,
            sources: [
              { title: "Informer", year: 2021, url: "https://arxiv.org/abs/2012.07436" },
              { title: "iTransformer", year: 2024, url: "https://arxiv.org/abs/2310.06625" },
            ],
          },
        }),
        createArtifact({
          id: "artifact-summary",
          artifactType: "structured_summary",
          title: "Summary: 架构综述",
          content: {
            summary: "这是显式指定给 final_report 的结构化总结。",
          },
        }),
      ],
      {
        preferredArtifactIds: ["artifact-summary"],
      },
    );

    expect(bundle.artifactDigest).toContain("Summary: 架构综述");
    expect(bundle.artifactDigest.indexOf("Summary: 架构综述")).toBeLessThan(
      bundle.artifactDigest.indexOf("Evidence: 主要证据"),
    );
  });

  it("adds a deterministic references section when the draft lacks one", () => {
    const citationEntries = [
      { citationKey: "Informer, 2021", title: "Informer", year: 2021, url: "https://arxiv.org/abs/2012.07436", query: "time series transformer" },
      { citationKey: "Autoformer, 2021", title: "Autoformer", year: 2021, url: "https://arxiv.org/abs/2106.13008", query: "time series transformer" },
    ];

    const appended = appendDeterministicReferencesSection({
      reportText: "# Report\n\nSection text citing [Informer, 2021].",
      citationEntries,
      preferredOutputLanguage: "en",
    });

    expect(appended.reportText).toContain("## References");
    expect(appended.reportText).toContain("[Informer, 2021]");
    expect(appended.referencesAdded).toBe(true);
  });

  it("still appends references when the draft contains no recognized citations", () => {
    const citationEntries = [
      { citationKey: "Informer, 2021", title: "Informer", year: 2021, url: "https://arxiv.org/abs/2012.07436", query: "time series transformer" },
      { citationKey: "Autoformer, 2021", title: "Autoformer", year: 2021, url: "https://arxiv.org/abs/2106.13008", query: "time series transformer" },
    ];

    const appended = appendDeterministicReferencesSection({
      reportText: "# Report\n\nSection text with no inline citations yet.",
      citationEntries,
      preferredOutputLanguage: "en",
      minimumReferenceCount: 2,
    });

    expect(appended.reportText).toContain("## References");
    expect(appended.reportText).toContain("[Informer, 2021]");
    expect(appended.reportText).toContain("[Autoformer, 2021]");
    expect(appended.referencesAdded).toBe(true);
  });

  it("extracts recognized citation keys and exposes relevant chapter packets", () => {
    const artifacts = [
      createArtifact({
        artifactType: "structured_summary",
        title: "Summary: 架构综述",
        content: {
          summary: "summary",
          chapterPackets: [
            {
              id: "chapter_1",
              title: "架构谱系与路线",
              objective: "taxonomy",
              summary: "梳理 Informer 与 Autoformer 的稀疏注意力谱系",
              keyTakeaways: ["稀疏注意力路线"],
              claims: [],
              supportingQuotes: [],
              citationKeys: ["Informer, 2021", "Autoformer, 2021"],
              openQuestions: [],
              recommendedSectionText: "Section seed [Informer, 2021].",
            },
          ],
        },
      }),
    ];

    const sectionPlan = normalizeFinalReportSectionPlan({
      rawPlan: {
        reportTitle: "时间序列 Transformer 架构综述",
        sections: [
          { id: "body-1", title: "架构谱系与路线", kind: "body", summary: "分类技术路线", targetTakeaway: "给出 taxonomy", citationFocus: ["taxonomy", "Informer"] },
        ],
      },
      sessionTitle: "时间序列 Transformer 架构综述",
      preferredOutputLanguage: "zh",
      isSurveyLikeRequest: true,
    });

    const packets = getRelevantChapterPacketsForSection({
      section: sectionPlan.sections[1]!,
      artifacts,
    });

    expect(packets).toHaveLength(1);
    expect(extractRecognizedCitationKeys("正文 [Informer, 2021]", citationEntriesFromArtifacts(artifacts))).toEqual(["Informer, 2021"]);

    const prompt = buildFinalReportSectionCitationRevisionPrompt({
      sectionTitle: "架构谱系与路线",
      preferredOutputLanguage: "zh",
      existingSection: "## 架构谱系与路线\n正文",
      relevantPackets: packets,
      allowedCitationKeys: ["Informer, 2021", "Autoformer, 2021"],
    });

    expect(prompt).toContain("Allowed Citation Keys");
    expect(prompt).toContain("Informer, 2021");
  });
});

function citationEntriesFromArtifacts(artifacts: DeepResearchArtifact[]) {
  return artifacts.flatMap((artifact) => {
    if (!Array.isArray(artifact.content.chapterPackets)) {
      return [];
    }

    return artifact.content.chapterPackets.flatMap((packet) => {
      if (!packet || typeof packet !== "object" || !Array.isArray((packet as Record<string, unknown>).citationKeys)) {
        return [];
      }

      return ((packet as Record<string, unknown>).citationKeys as string[]).map((citationKey) => ({ citationKey }));
    });
  });
}
