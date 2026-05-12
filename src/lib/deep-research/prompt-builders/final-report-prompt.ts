import { buildRuntimeRoleContract } from "../role-registry";
import { extractChapterPacketsFromArtifacts, selectChapterPacketsForSection } from "../summary-packets";
import type {
  ChapterPacket,
  DeepResearchArtifact,
  DeepResearchMessage,
  DeepResearchNode,
  DeepResearchSession,
} from "../types";

interface FinalReportCitationEntry {
  citationKey: string;
  title: string;
  year?: number;
  venue?: string;
  url?: string;
  doi?: string;
  query: string;
}

export interface FinalReportCitationCoverage {
  availableCitationCount: number;
  citedCitationCount: number;
  minimumRequiredCitationCount: number;
  hasReferencesSection: boolean;
  meetsCoverage: boolean;
  missingCitationKeys: string[];
}

export type FinalReportSectionKind = "introduction" | "body" | "conclusion";

export interface FinalReportSectionPlanItem {
  id: string;
  title: string;
  kind: FinalReportSectionKind;
  summary: string;
  targetTakeaway: string;
  citationFocus: string[];
}

export interface FinalReportSectionPlan {
  reportTitle: string;
  sections: FinalReportSectionPlanItem[];
}

export type FinalReportDigestMode = "standard" | "compact";

export interface FinalReportReadiness {
  canDraft: boolean;
  status: "ready" | "thin_evidence" | "insufficient_evidence";
  summary: string;
  recommendedAction: string;
  totalRelevantArtifactCount: number;
  selectedArtifactCount: number;
  evidenceCardCount: number;
  synthesisArtifactCount: number;
  availableCitationCount: number;
  totalSourceCount: number;
}

export interface FinalReportPromptBundle {
  digestMode: FinalReportDigestMode;
  artifactDigest: string;
  citationRegistry: string;
  readiness: FinalReportReadiness;
}

export function isSurveyLikeResearchRequest(sessionTitle: string, userMessages: string[]): boolean {
  const requestText = [sessionTitle, ...userMessages].join("\n");
  return /(综述|调研|梳理|总结|review|survey|taxonomy|landscape|comparison|mechanism)/i.test(requestText);
}

export function buildFinalReportSystemPrompt(
  node: DeepResearchNode,
): string {
  const roleContract = buildRuntimeRoleContract(node.assignedRole, "final_report", {
    includeResponsibilities: true,
    includeCollaboration: true,
    includePerformance: true,
    maxItemsPerSection: 3,
  });

  return `You are the Research Asset Reuse Specialist responsible for writing the final research deliverable.

## Core Mission
- Produce the actual final report for the user, not a short status update.
- Synthesize prior evidence, summaries, and critiques into a coherent markdown document.
- Keep every substantive claim grounded in the provided artifacts.
- State uncertainty explicitly where evidence is weak, missing, or contradictory.

## Structured Role Contract
${roleContract || "  (no structured role contract available)"}

## Output Rules
- Write the final answer as raw markdown only.
- Do NOT return JSON.
- Do NOT wrap the report in code fences.
- Do NOT output a short chat reply, checklist, or planning memo.
- Prefer a complete report with clear sections, comparisons, limitations, and future directions.
- The report must read like a serious academic survey or rigorous research review, not a blog post or lightweight memo.
- Prefer substantial prose and analytical argumentation over bullet-heavy exposition.
- Each major section must contain a coherent argumentative arc rather than a loose collection of observations.
- When the user asked for a survey / review / overview / taxonomy / mechanism summary, produce a literature-review-style report rather than a brief conclusion note.
- Cite provenance inline when possible using source titles, model names, benchmark names, years, or artifact labels from the provided context.
- If some parts of the request are under-supported, explicitly label them as uncertain instead of inventing details.`;
}

export function buildFinalReportPlannerSystemPrompt(
  node: DeepResearchNode,
): string {
  const roleContract = buildRuntimeRoleContract(node.assignedRole, "final_report", {
    includeResponsibilities: true,
    includeCollaboration: true,
    includePerformance: true,
    maxItemsPerSection: 3,
  });

  return `You are the planning coordinator for a multi-agent final-report writing workflow.

## Structured Role Contract
${roleContract || "  (no structured role contract available)"}

## Mission
- Decide how many major sections the final report should contain.
- Produce a section-by-section writing plan before drafting begins.
- Ensure the outline is coherent, academically rigorous, and suitable for parallel section drafting.
- Treat introduction and conclusion as special sections.

## Output Rules
- Return valid JSON only.
- Do NOT write the report body yet.
- The plan must include one introduction section and one conclusion section.
- Body sections should be specific enough that independent section-writing agents can draft them without guessing.
- The outline must be complete enough to support a full paper-level draft, not a sparse or skeletal report.
- The full outline should progress logically from motivation and setup to taxonomy, core comparisons, empirical or critical analysis, and synthesis.
- The final report will be drafted in this order: body sections first, introduction second-to-last, conclusion last.
- Even though introduction is drafted late, it will appear at the beginning of the final assembled paper.`;
}

export function buildFinalReportPrompt(
  session: DeepResearchSession,
  messages: DeepResearchMessage[],
  artifacts: DeepResearchArtifact[],
  node: DeepResearchNode,
): string {
  const userMessages = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter((content) => content.length > 0);
  const latestUserMessage = userMessages[userMessages.length - 1] ?? session.title;
  const shouldRespondInChinese = /[\u4e00-\u9fff]/.test(latestUserMessage) || /[\u4e00-\u9fff]/.test(session.title);
  const isSurveyLikeRequest = isSurveyLikeResearchRequest(session.title, userMessages);

  const promptBundle = buildFinalReportPromptBundle(session, messages, artifacts);
  const citationEntries = buildFinalReportCitationEntries(artifacts);
  const artifactDigest = promptBundle.artifactDigest;
  const citationRegistry = promptBundle.citationRegistry;
  const minimumRequiredCitations = getMinimumRequiredCitationCount(citationEntries.length, isSurveyLikeRequest);
  const requestedSections = Array.isArray(node.input?.deliverableSections)
    ? (node.input.deliverableSections as unknown[])
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const requestedAudience = typeof node.input?.targetAudience === "string" && node.input.targetAudience.trim().length > 0
    ? node.input.targetAudience
    : "research stakeholders";

  const surveySectionGuide = shouldRespondInChinese
    ? [
        "1. 摘要",
        "2. 问题定义与任务背景",
        "3. 时间序列 Transformer 架构谱系 / 分类框架",
        "4. 代表性模型与关键设计选择比较",
        "5. 数据集、评测协议与常见指标",
        "6. 优势、局限与适用场景",
        "7. 证据缺口、争议点与开放问题",
        "8. 结论",
        "9. 参考线索（列出主要论文/模型/工件来源）",
      ].join("\n")
    : [
        "1. Executive Summary",
        "2. Problem Setting And Background",
        "3. Taxonomy Of Time-Series Transformer Architectures",
        "4. Representative Models And Design Trade-offs",
        "5. Datasets, Evaluation Protocols, And Metrics",
        "6. Strengths, Limitations, And Best-Fit Scenarios",
        "7. Evidence Gaps, Disagreements, And Open Problems",
        "8. Conclusion",
        "9. Reference Trail (major papers/models/artifacts used)",
      ].join("\n");

  const generalSectionGuide = shouldRespondInChinese
    ? [
        "1. 摘要",
        "2. 研究范围与目标",
        "3. 证据基础",
        "4. 核心发现",
        "5. 对比分析与局限",
        "6. 结论与后续建议",
        "7. 参考线索",
      ].join("\n")
    : [
        "1. Executive Summary",
        "2. Scope And Objective",
        "3. Evidence Base",
        "4. Main Findings",
        "5. Comparative Analysis And Limitations",
        "6. Conclusion And Next Steps",
        "7. Reference Trail",
      ].join("\n");

  return `Write the final research report for this Deep Research session.

## Session
- Session title: ${session.title}
- Deliverable node: ${node.label}
- Target audience: ${requestedAudience}
- Preferred output language: ${shouldRespondInChinese ? "Chinese" : "Match the user's language; default to English"}
- Report style: ${isSurveyLikeRequest ? "Detailed survey / literature review" : "Detailed analytical report"}

## User Request
${userMessages.length > 0 ? userMessages.map((content, index) => `${index + 1}. ${content}`).join("\n") : session.title}

## Report Inputs
${artifactDigest || "(No supporting artifacts were available. If so, explicitly state that the evidence base is thin.)"}

## Citation Registry
${citationRegistry || "(No structured citation registry available. If so, cite artifact titles and make uncertainty explicit.)"}

## Citation Coverage Target
- Unique citations available in registry: ${citationEntries.length}
- Minimum unique citations expected in this report: ${minimumRequiredCitations}
- Do not concentrate references only on the most famous 8-15 papers if the registry is much larger.
- Spread citations across major subtopics / technical routes / architecture families when the evidence supports it.

## Required Report Properties
- Produce a detailed markdown report, not a short note.
- Keep the report concrete: mention actual architectures, models, datasets, benchmarks, evidence patterns, and limitations when the artifacts support them.
- Explicitly reconcile conflicting evidence instead of averaging it away.
- When evidence is insufficient, say exactly what is missing.
- Include a clear evidence-coverage section or paragraphs that explain what the report is based on.
- Make the report self-contained enough that a reader can understand the topic without reopening the raw artifacts.
- Use headings and subheadings; do not collapse the answer into a few bullet points.
- Prefer direct statements over vague phrases like "some studies" or "various methods".

## Requested Deliverable Sections
${requestedSections.length > 0 ? requestedSections.map((section, index) => `${index + 1}. ${section}`).join("\n") : "(none explicitly provided)"}

## Minimum Section Structure
${isSurveyLikeRequest ? surveySectionGuide : generalSectionGuide}

## Important Writing Rules
- Output raw markdown only.
- Do not output JSON.
- Do not output code fences around the entire report.
- ${shouldRespondInChinese ? "请直接使用中文撰写报告；论文名、模型名、数据集名可保留英文。" : "Write in the user's language when clear from context."}
- If the user asked for a survey or overview, make the document comprehensive and structured like a real survey, not a brief recap.
- The paper must be detailed, complete, and logically strong.
- Each major section should have enough depth to stand on its own rather than being a short placeholder.
- Build explicit logical bridges between sections so the report reads as one coherent academic paper.
- Prefer paragraph-level argument development: claim -> evidence -> comparison -> implication.
- When comparing methods, explain not only what differs, but why those differences matter.
- Do not leave major subtopics merely implied; make the structure and reasoning explicit.
- Use inline citations throughout the report, not only in a final bibliography.
- For factual claims, comparisons, historical statements, benchmark summaries, or architecture descriptions, append an inline citation immediately after the relevant sentence or clause.
- Prefer citation forms like ${shouldRespondInChinese ? "`[Informer, 2021]`、`[Autoformer, 2021]`、`[FEDformer, 2022]`" : "`[Informer, 2021]`, `[Autoformer, 2021]`, `[FEDformer, 2022]`"}; if a URL is important, include it in the References section rather than cluttering the main text.
- Include a dedicated "References" / "参考文献与来源线索" section at the end, listing the main cited papers, models, repositories, or artifacts with year and URL/venue when available.
- Keep the survey logically progressive: background -> taxonomy -> representative methods -> empirical patterns -> limitations -> open problems.
- Avoid unsupported omnibus claims. If evidence is mixed, say so and cite the competing sources inline.
- If the citation registry is large, ensure the report references a broad representative subset instead of a narrow canonical core.
- End with a concise synthesis of what is well-supported, what remains uncertain, and what future work is most justified.`;
}

export function buildFinalReportSectionPlanPrompt(
  session: DeepResearchSession,
  messages: DeepResearchMessage[],
  artifacts: DeepResearchArtifact[],
  node: DeepResearchNode,
  options?: {
    digestMode?: FinalReportDigestMode;
    artifactDigestOverride?: string;
    preferredArtifactIds?: string[];
  },
): string {
  const userMessages = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter((content) => content.length > 0);
  const shouldRespondInChinese = /[\u4e00-\u9fff]/.test(session.title) || userMessages.some((message) => /[\u4e00-\u9fff]/.test(message));
  const isSurveyLikeRequest = isSurveyLikeResearchRequest(session.title, userMessages);
  const promptBundle = buildFinalReportPromptBundle(session, messages, artifacts, {
    digestMode: options?.digestMode,
    preferredArtifactIds: options?.preferredArtifactIds,
  });
  const citationEntries = buildFinalReportCitationEntries(artifacts);
  const artifactDigest = options?.artifactDigestOverride ?? promptBundle.artifactDigest;

  return `Plan the final report before drafting any section.

## Session
- Title: ${session.title}
- Preferred language: ${shouldRespondInChinese ? "Chinese" : "English"}
- Report style: ${isSurveyLikeRequest ? "Academic survey / literature review" : "Analytical report"}
- Target audience: ${typeof node.input?.targetAudience === "string" && node.input.targetAudience.trim().length > 0 ? node.input.targetAudience : "research stakeholders"}

## User Request
${userMessages.length > 0 ? userMessages.map((content, index) => `${index + 1}. ${content}`).join("\n") : session.title}

## Available Evidence
${artifactDigest || "(No structured artifact digest available.)"}

## Citation Inventory
- Unique citations available: ${citationEntries.length}

## Planning Rules
- Decide the final paper's major sections first.
- Include one introduction and one conclusion.
- Use 3-7 body sections by default unless the evidence clearly justifies a different count.
- The outline must be complete enough to support a full paper-level draft, not a sparse or skeletal report.
- Each body section should correspond to a real analytical unit with its own central question and conclusion.
- The full outline should progress logically from motivation and setup to taxonomy, core comparisons, empirical or critical analysis, and synthesis.
- For every section, provide:
  - title
  - kind: introduction | body | conclusion
  - summary: what the section should cover
  - targetTakeaway: what the reader should learn from the section
  - citationFocus: the main topics / papers / evidence clusters the writer should prioritize
- Introduction should be drafted second-to-last and must synthesize the body sections.
- Conclusion should be drafted last and must synthesize the entire paper.
- Body sections should be mutually non-overlapping and logically ordered.

## Output JSON Schema
{
  "reportTitle": "title",
  "sections": [
    {
      "id": "section_1",
      "title": "section title",
      "kind": "introduction|body|conclusion",
      "summary": "what this section covers",
      "targetTakeaway": "what the section should conclude or make clear",
      "citationFocus": ["topic or citation cluster 1", "topic or citation cluster 2"]
    }
  ]
}`;
}

export function buildFinalReportPromptBundle(
  session: DeepResearchSession,
  messages: DeepResearchMessage[],
  artifacts: DeepResearchArtifact[],
  options?: {
    digestMode?: FinalReportDigestMode;
    preferredArtifactIds?: string[];
  },
): FinalReportPromptBundle {
  const userMessages = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter((content) => content.length > 0);
  const isSurveyLikeRequest = isSurveyLikeResearchRequest(session.title, userMessages);
  const digestMode = options?.digestMode ?? "standard";
  const relevantArtifacts = selectArtifactsForFinalReport(artifacts, {
    digestMode,
    preferredArtifactIds: options?.preferredArtifactIds,
  });
  const citationEntries = buildFinalReportCitationEntries(artifacts);

  return {
    digestMode,
    artifactDigest: relevantArtifacts.map((artifact) => formatArtifactForFinalReport(artifact, { digestMode })).join("\n\n"),
    citationRegistry: buildCitationRegistry(
      citationEntries,
      digestMode === "compact" ? 18 : 40,
    ),
    readiness: assessFinalReportReadiness({
      artifacts,
      relevantArtifacts,
      citationEntries,
      isSurveyLikeRequest,
    }),
  };
}

export function buildFinalReportSectionDraftPrompt(input: {
  sessionTitle: string;
  preferredOutputLanguage: "zh" | "en";
  section: FinalReportSectionPlanItem;
  sectionPlan: FinalReportSectionPlan;
  artifactDigest: string;
  citationRegistry: string;
  sectionPackets?: ChapterPacket[];
  draftedBodySections?: Array<{ title: string; content: string }>;
  draftedFullSections?: Array<{ title: string; content: string }>;
  referenceExcerptLimit?: number;
}): string {
  const planOutline = input.sectionPlan.sections.map((section, index) =>
    `${index + 1}. ${section.title} [${section.kind}] - ${section.summary}`
  ).join("\n");
  const relevantPacketDigest = formatChapterPacketReferences(input.sectionPackets ?? []);

  if (input.section.kind === "introduction") {
    const bodyReference = formatDraftedSectionReferences(
      input.draftedBodySections ?? [],
      input.referenceExcerptLimit ?? 1200,
    );
    return `Draft the introduction section for the final report.

## Writing Order Note
- This introduction is being drafted after the body sections.
- In the final paper it must appear at the beginning.

## Report Title
${input.sessionTitle}

## Full Outline
${planOutline}

## Introduction Plan
- Title: ${input.section.title}
- Summary: ${input.section.summary}
- Target takeaway: ${input.section.targetTakeaway}
- Citation focus: ${input.section.citationFocus.join(", ") || "(use the most relevant body-grounding citations)"}

## Drafted Body Sections To Reference
${bodyReference || "(No body drafts available; fall back to the report plan and evidence digest.)"}

## Relevant Chapter Packets
${relevantPacketDigest || "(No chapter packets available.)"}

## Evidence Digest
${input.artifactDigest || "(No evidence digest available.)"}

## Citation Registry
${input.citationRegistry || "(No citation registry available.)"}

## Output Rules
- Output markdown for this section only.
- Start with a level-2 heading: \`## ${input.section.title}\`
- Do not write the conclusion.
- Use the body sections as the main reference frame for scope, framing, and terminology.
- Write a full academic introduction, not a short abstract-like preface.
- The introduction should explain motivation, scope, organization, and the analytical lens used by the body sections.
- Use the drafted body sections to make the introduction logically aligned with the actual paper content.
- Use citation keys from the relevant chapter packets when making concrete claims.
- ${input.preferredOutputLanguage === "zh" ? "请直接使用中文撰写。" : "Write in English."}`;
  }

  if (input.section.kind === "conclusion") {
    const fullReference = formatDraftedSectionReferences(
      input.draftedFullSections ?? [],
      input.referenceExcerptLimit ?? 1200,
    );
    return `Draft the conclusion section for the final report.

## Writing Order Note
- This conclusion is being drafted last.
- It must synthesize the full paper rather than repeating one section.

## Report Title
${input.sessionTitle}

## Full Outline
${planOutline}

## Conclusion Plan
- Title: ${input.section.title}
- Summary: ${input.section.summary}
- Target takeaway: ${input.section.targetTakeaway}
- Citation focus: ${input.section.citationFocus.join(", ") || "(draw from the strongest whole-paper evidence)"}

## Drafted Full Paper To Reference
${fullReference || "(No prior draft sections available.)"}

## Relevant Chapter Packets
${relevantPacketDigest || "(No chapter packets available.)"}

## Citation Registry
${input.citationRegistry || "(No citation registry available.)"}

## Output Rules
- Output markdown for this section only.
- Start with a level-2 heading: \`## ${input.section.title}\`
- Reference the full paper, not just the final body section.
- The conclusion must synthesize the entire paper instead of merely repeating the last section.
- Summarize the strongest findings, remaining uncertainties, and the most justified future directions.
- Keep the conclusion tightly coupled to the logic and evidence developed across the full paper.
- Use citation keys from the relevant chapter packets when grounding concrete claims.
- ${input.preferredOutputLanguage === "zh" ? "请直接使用中文撰写。" : "Write in English."}`;
  }

  return `Draft one body section for the final report.

## Report Title
${input.sessionTitle}

## Full Outline
${planOutline}

## Target Section
- Title: ${input.section.title}
- Summary: ${input.section.summary}
- Target takeaway: ${input.section.targetTakeaway}
- Citation focus: ${input.section.citationFocus.join(", ") || "(use the most relevant citations for this topic)"}

## Relevant Chapter Packets
${relevantPacketDigest || "(No chapter packets available.)"}

## Evidence Digest
${input.artifactDigest || "(No evidence digest available.)"}

## Citation Registry
${input.citationRegistry || "(No citation registry available.)"}

## Output Rules
- Output markdown for this section only.
- Start with a level-2 heading: \`## ${input.section.title}\`
- Stay within this section's scope; do not write introduction or conclusion content.
- Write this as a substantial academic section, not a few summary bullets or short notes.
- Use coherent paragraphs with strong internal logical flow.
- Make the section analytically complete: define the claim, cite evidence, compare alternatives where relevant, and explain implications.
- You MUST use the available citation keys from the relevant chapter packets for concrete factual claims whenever evidence exists.
- ${input.preferredOutputLanguage === "zh" ? "请直接使用中文撰写。" : "Write in English."}`;
}

export function buildFinalReportCoverageRevisionPrompt(input: {
  sessionTitle: string;
  preferredOutputLanguage: "zh" | "en";
  existingReport: string;
  coverage: FinalReportCitationCoverage;
  citationEntries: FinalReportCitationEntry[];
}): string {
  const missingCitations = input.coverage.missingCitationKeys.slice(0, 40).join(", ");
  const referencesInstruction = input.preferredOutputLanguage === "zh"
    ? "保留已有高质量内容，但扩大引文覆盖，补足参考文献与行内引用。"
    : "Preserve the high-quality parts of the draft, but broaden citation coverage and expand inline citations plus the references section.";

  return `Revise the existing final report to improve citation coverage.

## Session
- Title: ${input.sessionTitle}
- Available unique citations: ${input.coverage.availableCitationCount}
- Current cited unique citations: ${input.coverage.citedCitationCount}
- Minimum required unique citations: ${input.coverage.minimumRequiredCitationCount}
- References section present: ${input.coverage.hasReferencesSection ? "yes" : "no"}

## Revision Goal
${referencesInstruction}

## Existing Report
${input.existingReport}

## Missing Citation Candidates
${missingCitations || "(No explicit missing citations listed, but the draft still needs broader coverage.)"}

## Instructions
- Return a full revised markdown report, not partial patches or notes.
- Keep the structure coherent.
- Increase the number of distinct cited sources meaningfully.
- Add citations in sections that currently rely on too few sources.
- Ensure there is a dedicated References / 参考文献与来源线索 section.
- Do not invent citations outside the registry.`;
}

export function analyzeFinalReportCitationCoverage(
  reportText: string,
  artifacts: DeepResearchArtifact[],
  sessionTitle: string,
  userMessages: string[],
): FinalReportCitationCoverage {
  const citationEntries = buildFinalReportCitationEntries(artifacts);
  const citationKeys = new Set(citationEntries.map((entry) => entry.citationKey));
  const bracketMatches = [...reportText.matchAll(/\[([^\]]+)\]/g)];
  const citedKeys = new Set<string>();

  for (const match of bracketMatches) {
    const key = match[1]?.trim();
    if (key && citationKeys.has(key)) {
      citedKeys.add(key);
    }
  }

  const isSurveyLikeRequest = isSurveyLikeResearchRequest(sessionTitle, userMessages);
  const minimumRequiredCitationCount = getMinimumRequiredCitationCount(citationEntries.length, isSurveyLikeRequest);
  const hasReferencesSection = /(^|\n)#{1,6}\s*(references|reference trail|参考文献|参考文献与来源线索)\b/i.test(reportText);
  const missingCitationKeys = citationEntries
    .map((entry) => entry.citationKey)
    .filter((key) => !citedKeys.has(key));

  return {
    availableCitationCount: citationEntries.length,
    citedCitationCount: citedKeys.size,
    minimumRequiredCitationCount,
    hasReferencesSection,
    meetsCoverage: citedKeys.size >= minimumRequiredCitationCount && hasReferencesSection,
    missingCitationKeys,
  };
}

export function buildFinalReportCitationEntries(
  artifacts: DeepResearchArtifact[],
): FinalReportCitationEntry[] {
  const entries: FinalReportCitationEntry[] = [];
  const seen = new Set<string>();

  for (const artifact of artifacts) {
    if (artifact.artifactType !== "evidence_card" || !Array.isArray(artifact.content.sources)) {
      continue;
    }

    const query = typeof artifact.content.query === "string" ? artifact.content.query : artifact.title;
    for (const source of artifact.content.sources) {
      if (!source || typeof source !== "object") {
        continue;
      }

      const entry = source as Record<string, unknown>;
      const title = typeof entry.title === "string" && entry.title.trim().length > 0
        ? entry.title.trim()
        : null;
      if (!title) {
        continue;
      }

      const year = typeof entry.year === "number" ? entry.year : undefined;
      const citationKey = year ? `${title}, ${year}` : title;
      if (seen.has(citationKey)) {
        continue;
      }
      seen.add(citationKey);

      entries.push({
        citationKey,
        title,
        year,
        venue: typeof entry.venue === "string" && entry.venue.trim().length > 0 ? entry.venue.trim() : undefined,
        url: typeof entry.url === "string" && entry.url.trim().length > 0 ? entry.url.trim() : undefined,
        doi: typeof entry.doi === "string" && entry.doi.trim().length > 0 ? entry.doi.trim() : undefined,
        query,
      });
    }
  }

  return entries;
}

export function getMinimumRequiredCitationCount(
  availableCitationCount: number,
  isSurveyLikeRequest: boolean,
): number {
  if (availableCitationCount <= 0) {
    return 0;
  }

  const ratio = isSurveyLikeRequest ? 0.28 : 0.18;
  const floor = isSurveyLikeRequest ? 12 : 8;
  const cap = isSurveyLikeRequest ? 36 : 20;
  return Math.min(availableCitationCount, Math.min(cap, Math.max(floor, Math.ceil(availableCitationCount * ratio))));
}

export function normalizeFinalReportSectionPlan(input: {
  rawPlan: Record<string, unknown>;
  sessionTitle: string;
  preferredOutputLanguage: "zh" | "en";
  isSurveyLikeRequest: boolean;
  maxBodySections?: number;
}): FinalReportSectionPlan {
  const rawSections = Array.isArray(input.rawPlan.sections) ? input.rawPlan.sections : [];
  const normalizedSections = rawSections
    .map((section, index) => normalizeSectionPlanItem(section, index))
    .filter((section): section is FinalReportSectionPlanItem => Boolean(section));

  const intro = normalizedSections.find((section) => section.kind === "introduction")
    ?? createFallbackSection("introduction", input.preferredOutputLanguage, input.isSurveyLikeRequest);
  const conclusion = normalizedSections.find((section) => section.kind === "conclusion")
    ?? createFallbackSection("conclusion", input.preferredOutputLanguage, input.isSurveyLikeRequest);
  const bodySections = normalizedSections.filter((section) => section.kind === "body");

  const effectiveBodySections = bodySections.length > 0
    ? bodySections
    : createFallbackBodySections(input.preferredOutputLanguage, input.isSurveyLikeRequest);
  const cappedBodySections = input.maxBodySections && input.maxBodySections > 0
    ? effectiveBodySections.slice(0, input.maxBodySections)
    : effectiveBodySections;

  return {
    reportTitle: typeof input.rawPlan.reportTitle === "string" && input.rawPlan.reportTitle.trim().length > 0
      ? input.rawPlan.reportTitle.trim()
      : input.sessionTitle,
    sections: [intro, ...cappedBodySections, conclusion],
  };
}

export function getFinalReportDraftingOrder(plan: FinalReportSectionPlan): FinalReportSectionPlanItem[] {
  const intro = plan.sections.find((section) => section.kind === "introduction");
  const conclusion = plan.sections.find((section) => section.kind === "conclusion");
  const bodySections = plan.sections.filter((section) => section.kind === "body");

  return [
    ...bodySections,
    ...(intro ? [intro] : []),
    ...(conclusion ? [conclusion] : []),
  ];
}

export function getRelevantChapterPacketsForSection(input: {
  section: FinalReportSectionPlanItem;
  artifacts: DeepResearchArtifact[];
  limit?: number;
}): ChapterPacket[] {
  const chapterPackets = extractChapterPacketsFromArtifacts(input.artifacts);
  if (chapterPackets.length === 0) {
    return [];
  }

  return selectChapterPacketsForSection({
    sectionTitle: input.section.title,
    sectionSummary: input.section.summary,
    citationFocus: input.section.citationFocus,
    chapterPackets,
    limit: input.limit ?? 2,
  });
}

export function assembleFinalReportFromSections(input: {
  reportTitle: string;
  sectionPlan: FinalReportSectionPlan;
  sectionDrafts: Map<string, string>;
}): string {
  const intro = input.sectionPlan.sections.find((section) => section.kind === "introduction");
  const conclusion = input.sectionPlan.sections.find((section) => section.kind === "conclusion");
  const bodySections = input.sectionPlan.sections.filter((section) => section.kind === "body");

  const orderedSections = [
    ...(intro ? [intro] : []),
    ...bodySections,
    ...(conclusion ? [conclusion] : []),
  ];

  const sectionTexts = orderedSections
    .map((section) => input.sectionDrafts.get(section.id)?.trim())
    .filter((text): text is string => typeof text === "string" && text.length > 0);

  return [
    `# ${input.reportTitle}`,
    "",
    ...sectionTexts.flatMap((text) => [text, ""]),
  ].join("\n").trim();
}

export function extractRecognizedCitationKeys(
  text: string,
  citationEntries: Array<{ citationKey: string }>,
): string[] {
  const knownCitationKeys = new Set(citationEntries.map((entry) => entry.citationKey));
  const citedKeys = new Set<string>();

  for (const match of text.matchAll(/\[([^\]]+)\]/g)) {
    const key = match[1]?.trim();
    if (key && knownCitationKeys.has(key)) {
      citedKeys.add(key);
    }
  }

  return [...citedKeys];
}

export function buildFinalReportSectionCitationRevisionPrompt(input: {
  sectionTitle: string;
  preferredOutputLanguage: "zh" | "en";
  existingSection: string;
  relevantPackets: ChapterPacket[];
  allowedCitationKeys: string[];
}): string {
  return `Revise this report section by inserting inline citations.

## Section Title
${input.sectionTitle}

## Existing Section
${input.existingSection}

## Allowed Citation Keys
${input.allowedCitationKeys.join(", ") || "(none available)"}

## Relevant Chapter Packets
${formatChapterPacketReferences(input.relevantPackets)}

## Rules
- Return the full revised section only.
- Preserve the structure, logic, and level-2 heading.
- Add inline citations like [Informer, 2021] immediately after supported factual or comparative claims.
- Use only the allowed citation keys listed above.
- Do not add a references section here.
- ${input.preferredOutputLanguage === "zh" ? "请直接使用中文输出修订后的章节。" : "Write in English."}`;
}

export function appendDeterministicReferencesSection(input: {
  reportText: string;
  citationEntries: FinalReportCitationEntry[];
  preferredOutputLanguage: "zh" | "en";
  fallbackCitationKeys?: string[];
  minimumReferenceCount?: number;
}): {
  reportText: string;
  citedCitationKeys: string[];
  referencesAdded: boolean;
} {
  const citedCitationKeys = extractRecognizedCitationKeys(input.reportText, input.citationEntries);
  const minimumReferenceCount = Math.max(1, input.minimumReferenceCount ?? 12);
  const registryFallbackKeys = input.citationEntries
    .map((entry) => entry.citationKey)
    .slice(0, Math.min(Math.max(minimumReferenceCount, 8), 24));
  const keysToRender = [
    ...new Set([
      ...citedCitationKeys,
      ...(input.fallbackCitationKeys ?? []),
      ...registryFallbackKeys,
    ]),
  ].slice(0, Math.max(minimumReferenceCount, citedCitationKeys.length, 8));

  if (keysToRender.length === 0) {
    return {
      reportText: input.reportText,
      citedCitationKeys,
      referencesAdded: false,
    };
  }

  const hasReferencesSection = /(^|\n)#{1,6}\s*(references|reference trail|参考文献|参考文献与来源线索)\b/i.test(input.reportText);
  if (hasReferencesSection) {
    return {
      reportText: input.reportText,
      citedCitationKeys,
      referencesAdded: false,
    };
  }

  const entries = input.citationEntries.filter((entry) => keysToRender.includes(entry.citationKey));
  if (entries.length === 0) {
    return {
      reportText: input.reportText,
      citedCitationKeys,
      referencesAdded: false,
    };
  }

  const heading = input.preferredOutputLanguage === "zh"
    ? "## 参考文献与来源线索"
    : "## References";
  const references = entries
    .map((entry) => {
      const metadata = [
        entry.year?.toString(),
        entry.venue,
      ].filter(Boolean).join(". ");
      const link = entry.url
        ? `[Link](${entry.url})`
        : entry.doi
          ? `DOI: ${entry.doi}`
          : "";
      return `- [${entry.citationKey}] ${metadata ? `${metadata}. ` : ""}${link}`.trim();
    })
    .join("\n");

  return {
    reportText: `${input.reportText.trim()}\n\n${heading}\n${references}`.trim(),
    citedCitationKeys,
    referencesAdded: true,
  };
}

function selectArtifactsForFinalReport(
  artifacts: DeepResearchArtifact[],
  options?: {
    digestMode?: FinalReportDigestMode;
    preferredArtifactIds?: string[];
  },
): DeepResearchArtifact[] {
  const preferredTypes = new Set([
    "structured_summary",
    "provisional_conclusion",
    "review_assessment",
    "reviewer_packet",
    "evidence_card",
    "validation_report",
    "experiment_result",
    "step_result",
    "literature_round_summary",
    "claim_map",
  ]);

  const selected = artifacts
    .filter((artifact) => preferredTypes.has(artifact.artifactType))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const preferredArtifactIdSet = new Set(options?.preferredArtifactIds ?? []);
  const preferredArtifacts = selected.filter((artifact) => preferredArtifactIdSet.has(artifact.id));
  const nonPreferredArtifacts = selected.filter((artifact) => !preferredArtifactIdSet.has(artifact.id));

  const digestMode = options?.digestMode ?? "standard";
  const nonEvidenceLimit = digestMode === "compact" ? 6 : 8;
  const evidenceLimit = digestMode === "compact" ? 4 : 8;
  const nonEvidence = nonPreferredArtifacts.filter((artifact) => artifact.artifactType !== "evidence_card");
  const evidence = nonPreferredArtifacts.filter((artifact) => artifact.artifactType === "evidence_card").slice(-evidenceLimit);

  const merged: DeepResearchArtifact[] = [];
  const seen = new Set<string>();

  for (const artifact of [...preferredArtifacts, ...nonEvidence.slice(-nonEvidenceLimit), ...evidence]) {
    if (seen.has(artifact.id)) {
      continue;
    }
    seen.add(artifact.id);
    merged.push(artifact);
  }

  return merged;
}

function normalizeSectionPlanItem(rawSection: unknown, index: number): FinalReportSectionPlanItem | null {
  if (!rawSection || typeof rawSection !== "object") {
    return null;
  }

  const record = rawSection as Record<string, unknown>;
  const title = typeof record.title === "string" && record.title.trim().length > 0
    ? record.title.trim()
    : null;
  if (!title) {
    return null;
  }

  const explicitKind = typeof record.kind === "string" ? record.kind.trim().toLowerCase() : "";
  const normalizedTitle = title.toLowerCase();
  const kind = explicitKind === "introduction" || /^(introduction|intro|引言|导论)/i.test(title)
    ? "introduction"
    : explicitKind === "conclusion" || /^(conclusion|结论|总结)/i.test(title)
      ? "conclusion"
      : "body";

  const summary = typeof record.summary === "string" && record.summary.trim().length > 0
    ? record.summary.trim()
    : typeof record.objective === "string" && record.objective.trim().length > 0
      ? record.objective.trim()
      : `Cover the main content of ${normalizedTitle}.`;
  const targetTakeaway = typeof record.targetTakeaway === "string" && record.targetTakeaway.trim().length > 0
    ? record.targetTakeaway.trim()
    : typeof record.conclusion === "string" && record.conclusion.trim().length > 0
      ? record.conclusion.trim()
      : summary;
  const citationFocus = Array.isArray(record.citationFocus)
    ? record.citationFocus.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  return {
    id: typeof record.id === "string" && record.id.trim().length > 0 ? record.id.trim() : `section_${index + 1}`,
    title,
    kind,
    summary,
    targetTakeaway,
    citationFocus,
  };
}

function createFallbackSection(
  kind: "introduction" | "conclusion",
  preferredOutputLanguage: "zh" | "en",
  isSurveyLikeRequest: boolean,
): FinalReportSectionPlanItem {
  if (kind === "introduction") {
    return preferredOutputLanguage === "zh"
      ? {
          id: "section_intro",
          title: "引言",
          kind: "introduction",
          summary: isSurveyLikeRequest ? "说明问题背景、研究范围、综述组织方式与核心技术路线。" : "说明问题背景、目标和文章结构。",
          targetTakeaway: "让读者理解本文的研究对象、范围和后续组织逻辑。",
          citationFocus: ["background", "scope", "taxonomy framing"],
        }
      : {
          id: "section_intro",
          title: "Introduction",
          kind: "introduction",
          summary: isSurveyLikeRequest ? "Introduce the problem setting, scope of the survey, and the major technical routes." : "Introduce the problem setting, objective, and paper structure.",
          targetTakeaway: "Orient the reader to the scope and organizing logic of the paper.",
          citationFocus: ["background", "scope", "taxonomy framing"],
        };
  }

  return preferredOutputLanguage === "zh"
    ? {
        id: "section_conclusion",
        title: "结论",
        kind: "conclusion",
        summary: "综合全文发现，概括主结论、不确定性与未来工作方向。",
        targetTakeaway: "让读者明确什么结论最稳健、哪些问题仍未解决。",
        citationFocus: ["full-paper synthesis", "open problems"],
      }
    : {
        id: "section_conclusion",
        title: "Conclusion",
        kind: "conclusion",
        summary: "Synthesize the paper's findings, limitations, and future directions.",
        targetTakeaway: "Clarify what is most supported, what remains uncertain, and what comes next.",
        citationFocus: ["full-paper synthesis", "open problems"],
      };
}

function createFallbackBodySections(
  preferredOutputLanguage: "zh" | "en",
  isSurveyLikeRequest: boolean,
): FinalReportSectionPlanItem[] {
  if (preferredOutputLanguage === "zh") {
    return isSurveyLikeRequest
      ? [
          {
            id: "section_body_1",
            title: "任务背景与问题定义",
            kind: "body",
            summary: "界定任务、输入输出形式与时间序列 Transformer 研究问题。",
            targetTakeaway: "明确综述对象和分析边界。",
            citationFocus: ["background", "problem setting"],
          },
          {
            id: "section_body_2",
            title: "架构谱系与技术路线",
            kind: "body",
            summary: "按主要技术路线梳理时间序列 Transformer 的架构分类。",
            targetTakeaway: "给出结构化 taxonomy。",
            citationFocus: ["taxonomy", "architecture families"],
          },
          {
            id: "section_body_3",
            title: "代表模型与关键设计选择",
            kind: "body",
            summary: "比较代表模型、关键模块设计与建模取舍。",
            targetTakeaway: "解释不同模型为什么有效、差异在哪里。",
            citationFocus: ["representative methods", "design trade-offs"],
          },
          {
            id: "section_body_4",
            title: "实验规律、局限与开放问题",
            kind: "body",
            summary: "总结经验规律、局限性和未来值得研究的问题。",
            targetTakeaway: "给出证据支持下的批判性判断。",
            citationFocus: ["benchmarks", "limitations", "open problems"],
          },
        ]
      : [
          {
            id: "section_body_1",
            title: "核心发现",
            kind: "body",
            summary: "总结主要证据和发现。",
            targetTakeaway: "突出最重要的研究结论。",
            citationFocus: ["main findings"],
          },
          {
            id: "section_body_2",
            title: "对比分析与局限",
            kind: "body",
            summary: "比较不同方法并解释局限。",
            targetTakeaway: "说明证据的边界和不确定性。",
            citationFocus: ["comparative analysis", "limitations"],
          },
        ];
  }

  return isSurveyLikeRequest
    ? [
        {
          id: "section_body_1",
          title: "Problem Setting And Background",
          kind: "body",
          summary: "Define the task setting, inputs/outputs, and the core problem addressed by time-series Transformers.",
          targetTakeaway: "Clarify the survey's scope and analytical boundary.",
          citationFocus: ["background", "problem setting"],
        },
        {
          id: "section_body_2",
          title: "Architecture Taxonomy And Technical Routes",
          kind: "body",
          summary: "Organize the main architecture families and technical routes in time-series Transformers.",
          targetTakeaway: "Provide a structured taxonomy of the field.",
          citationFocus: ["taxonomy", "architecture families"],
        },
        {
          id: "section_body_3",
          title: "Representative Models And Design Trade-offs",
          kind: "body",
          summary: "Compare representative models, core modules, and design choices.",
          targetTakeaway: "Explain where the main methods differ and why those differences matter.",
          citationFocus: ["representative methods", "design trade-offs"],
        },
        {
          id: "section_body_4",
          title: "Empirical Patterns, Limitations, And Open Problems",
          kind: "body",
          summary: "Summarize benchmark patterns, limitations, and open research questions.",
          targetTakeaway: "Ground the survey in evidence-backed strengths, weaknesses, and future directions.",
          citationFocus: ["benchmarks", "limitations", "open problems"],
        },
      ]
    : [
        {
          id: "section_body_1",
          title: "Main Findings",
          kind: "body",
          summary: "Summarize the main evidence and findings.",
          targetTakeaway: "Highlight the most important conclusions.",
          citationFocus: ["main findings"],
        },
        {
          id: "section_body_2",
          title: "Comparative Analysis And Limitations",
          kind: "body",
          summary: "Compare methods and explain limitations.",
          targetTakeaway: "Clarify the boundary conditions of the evidence.",
          citationFocus: ["comparative analysis", "limitations"],
        },
      ];
}

function formatArtifactForFinalReport(
  artifact: DeepResearchArtifact,
  options?: { digestMode?: FinalReportDigestMode },
): string {
  const digestMode = options?.digestMode ?? "standard";
  const previewLimit = digestMode === "compact" ? 500 : 900;
  const evidenceSourceLimit = digestMode === "compact" ? 3 : 6;

  if (artifact.artifactType === "evidence_card") {
    const query = typeof artifact.content.query === "string" ? artifact.content.query : artifact.title;
    const coverageSummary = typeof artifact.content.coverageSummary === "string"
      ? truncateText(artifact.content.coverageSummary, digestMode === "compact" ? 180 : 260)
      : "";
    const sources = Array.isArray(artifact.content.sources)
      ? artifact.content.sources
          .filter((source): source is Record<string, unknown> => Boolean(source) && typeof source === "object")
          .slice(0, evidenceSourceLimit)
          .map((source) => {
            const title = typeof source.title === "string" ? source.title : "Untitled source";
            const year = typeof source.year === "number" ? ` (${source.year})` : "";
            const relevance = typeof source.relevance === "string" ? ` - ${source.relevance}` : "";
            return `  - ${truncateText(title, 120)}${year}${truncateText(relevance, 80)}`;
          })
          .join("\n")
      : "";

    return [
      `### ${artifact.title} [${artifact.artifactType}]`,
      `- Query: ${query}`,
      typeof artifact.content.sourcesFound === "number" ? `- Sources found: ${artifact.content.sourcesFound}` : null,
      coverageSummary ? `- Coverage: ${coverageSummary}` : null,
      sources ? `- Representative sources:\n${sources}` : null,
    ].filter((line): line is string => Boolean(line)).join("\n");
  }

  if (artifact.artifactType === "review_assessment") {
    return [
      `### ${artifact.title} [${artifact.artifactType}]`,
      `- Verdict: ${String(artifact.content.combinedVerdict ?? "unknown")}`,
      `- Confidence: ${String(artifact.content.combinedConfidence ?? "unknown")}`,
      Array.isArray(artifact.content.openIssues) && artifact.content.openIssues.length > 0
        ? `- Open issues: ${(artifact.content.openIssues as string[]).join("; ")}`
        : null,
      Array.isArray(artifact.content.literatureGaps) && artifact.content.literatureGaps.length > 0
        ? `- Literature gaps: ${(artifact.content.literatureGaps as string[]).join("; ")}`
        : null,
      typeof artifact.content.reviewerSummary === "string" ? `- Summary: ${artifact.content.reviewerSummary}` : null,
    ].filter((line): line is string => Boolean(line)).join("\n");
  }

  if (artifact.artifactType === "structured_summary" && Array.isArray(artifact.content.chapterPackets)) {
    const chapterPackets = extractChapterPacketsFromArtifacts([artifact]).slice(0, digestMode === "compact" ? 2 : 4);
    const chapterDigest = chapterPackets
      .map((packet) => [
        `#### ${packet.title}`,
        `- Summary: ${truncateText(packet.summary, digestMode === "compact" ? 160 : 240)}`,
        packet.citationKeys.length > 0 ? `- Citation keys: ${packet.citationKeys.slice(0, 6).join(", ")}` : null,
        packet.keyTakeaways.length > 0 ? `- Takeaways: ${packet.keyTakeaways.slice(0, 4).join("; ")}` : null,
        packet.recommendedSectionText
          ? `- Section seed: ${truncateText(packet.recommendedSectionText, digestMode === "compact" ? 220 : 360)}`
          : null,
      ].filter((line): line is string => Boolean(line)).join("\n"))
      .join("\n\n");

    return [
      `### ${artifact.title} [${artifact.artifactType}]`,
      typeof artifact.content.summary === "string" ? truncateText(artifact.content.summary, previewLimit) : null,
      chapterDigest,
    ].filter((line): line is string => Boolean(line)).join("\n");
  }

  const preferredText = [
    artifact.content.report,
    artifact.content.summary,
    artifact.content.messageToUser,
    artifact.content.content,
    artifact.content.text,
    artifact.content.currentFindings,
  ].find((value): value is string => typeof value === "string" && value.trim().length > 0);

  const preview = preferredText
    ? truncateText(preferredText, previewLimit)
    : truncateText(JSON.stringify(artifact.content, null, 2), previewLimit);

  return `### ${artifact.title} [${artifact.artifactType}]\n${preview}`;
}

function buildCitationRegistry(entries: FinalReportCitationEntry[], maxEntries = 40): string {
  return entries
    .slice(0, maxEntries)
    .map((entry) => [
      `- [${entry.citationKey}]`,
      entry.venue ? `venue=${entry.venue}` : null,
      entry.url ? `url=${entry.url}` : null,
      entry.doi ? `doi=${entry.doi}` : null,
      `query=${entry.query}`,
    ].filter((item): item is string => Boolean(item)).join(" | "))
    .join("\n");
}

function assessFinalReportReadiness(input: {
  artifacts: DeepResearchArtifact[];
  relevantArtifacts: DeepResearchArtifact[];
  citationEntries: FinalReportCitationEntry[];
  isSurveyLikeRequest: boolean;
}): FinalReportReadiness {
  const evidenceCardCount = input.artifacts.filter((artifact) => artifact.artifactType === "evidence_card").length;
  const synthesisArtifactCount = input.artifacts.filter((artifact) =>
    artifact.artifactType === "structured_summary"
    || artifact.artifactType === "provisional_conclusion"
    || artifact.artifactType === "review_assessment"
    || artifact.artifactType === "reviewer_packet"
    || artifact.artifactType === "literature_round_summary"
    || artifact.artifactType === "claim_map"
    || artifact.artifactType === "validation_report"
  ).length;
  const totalSourceCount = estimateTotalSourceCount(input.artifacts);
  const availableCitationCount = input.citationEntries.length;

  let status: FinalReportReadiness["status"] = "ready";
  let canDraft = true;
  let recommendedAction = "Proceed with final report drafting.";

  if (totalSourceCount === 0 && synthesisArtifactCount === 0) {
    status = "insufficient_evidence";
    canDraft = false;
    recommendedAction = "Add a targeted evidence or synthesis pass before retrying the final report.";
  } else if (
    input.isSurveyLikeRequest
      ? totalSourceCount < 4 && availableCitationCount < 4 && synthesisArtifactCount === 0
      : totalSourceCount < 2 && synthesisArtifactCount === 0
  ) {
    status = "insufficient_evidence";
    canDraft = false;
    recommendedAction = "Collect more targeted evidence for the uncovered subtopics before another final-report attempt.";
  } else if (
    input.isSurveyLikeRequest
      ? totalSourceCount < 8 || availableCitationCount < 6
      : totalSourceCount < 4 || availableCitationCount < 2
  ) {
    status = "thin_evidence";
    recommendedAction = "The report can be drafted, but a targeted supplement for weakly covered subtopics would improve reliability.";
  }

  return {
    canDraft,
    status,
    summary: `Final-report readiness: ${status}. Selected ${input.relevantArtifacts.length}/${input.artifacts.length} relevant artifacts, ${evidenceCardCount} evidence cards, ${synthesisArtifactCount} synthesis artifacts, ${availableCitationCount} citations, ${totalSourceCount} total source signals.`,
    recommendedAction,
    totalRelevantArtifactCount: input.artifacts.length,
    selectedArtifactCount: input.relevantArtifacts.length,
    evidenceCardCount,
    synthesisArtifactCount,
    availableCitationCount,
    totalSourceCount,
  };
}

function estimateTotalSourceCount(artifacts: DeepResearchArtifact[]): number {
  return artifacts.reduce((sum, artifact) => {
    if (artifact.artifactType !== "evidence_card") {
      return sum;
    }

    const sources = Array.isArray(artifact.content.sources) ? artifact.content.sources : [];
    const explicitCount = [
      artifact.content.sourcesFound,
      artifact.content.totalFound,
      artifact.content.papersFound,
    ].find((value): value is number => typeof value === "number" && Number.isFinite(value));

    return sum + Math.max(explicitCount ?? 0, sources.length);
  }, 0);
}

function formatDraftedSectionReferences(
  sections: Array<{ title: string; content: string }>,
  excerptLimit: number,
): string {
  return sections
    .filter((section) => section.content.trim().length > 0)
    .map((section) => `### ${section.title}\n${truncateText(section.content.trim(), excerptLimit)}`)
    .join("\n\n");
}

function formatChapterPacketReferences(chapterPackets: ChapterPacket[]): string {
  return chapterPackets
    .map((packet) => [
      `### ${packet.title}`,
      `- Objective: ${packet.objective}`,
      `- Summary: ${packet.summary}`,
      packet.keyTakeaways.length > 0 ? `- Key takeaways: ${packet.keyTakeaways.join("; ")}` : null,
      packet.citationKeys.length > 0 ? `- Citation keys: ${packet.citationKeys.join(", ")}` : null,
      packet.supportingQuotes.length > 0
        ? `- Supporting quotes: ${packet.supportingQuotes.slice(0, 3).map((quote) => `${quote.sourceTitle}: ${truncateText(quote.quote, 120)} [${quote.citationKey}]`).join(" | ")}`
        : null,
      packet.recommendedSectionText ? `- Section seed: ${truncateText(packet.recommendedSectionText, 420)}` : null,
    ].filter((line): line is string => Boolean(line)).join("\n"))
    .join("\n\n");
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}
