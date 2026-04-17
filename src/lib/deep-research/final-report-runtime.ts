import { generateText } from "ai";
import { buildResearchContextArchivePromptBlock } from "./context-archive";
import { safeParseJson } from "./json-response";
import {
  analyzeFinalReportCitationCoverage,
  appendDeterministicReferencesSection,
  assembleFinalReportFromSections,
  buildFinalReportCitationEntries,
  buildFinalReportCoverageRevisionPrompt,
  buildFinalReportPromptBundle,
  buildFinalReportPlannerSystemPrompt,
  buildFinalReportSectionCitationRevisionPrompt,
  buildFinalReportSectionDraftPrompt,
  buildFinalReportSectionPlanPrompt,
  buildFinalReportSystemPrompt,
  extractRecognizedCitationKeys,
  getFinalReportDraftingOrder,
  getRelevantChapterPacketsForSection,
  isSurveyLikeResearchRequest,
  normalizeFinalReportSectionPlan,
} from "./prompts";
import { resolveArtifactReferenceIds } from "./artifact-references";
import type {
  ArtifactProvenance,
  ArtifactType,
  DeepResearchArtifact,
  DeepResearchMessage,
  DeepResearchNode,
  DeepResearchSession,
} from "./types";
import type { LanguageModel } from "ai";

type FinalReportFailureCode = "insufficient_evidence" | "context_overflow" | "draft_failed";

export class FinalReportExecutionError extends Error {
  readonly code: FinalReportFailureCode;
  readonly stage: string;
  readonly recommendedAction: string;
  readonly details: Record<string, unknown>;

  constructor(input: {
    code: FinalReportFailureCode;
    stage: string;
    message: string;
    recommendedAction: string;
    details?: Record<string, unknown>;
  }) {
    super(input.message);
    this.name = "FinalReportExecutionError";
    this.code = input.code;
    this.stage = input.stage;
    this.recommendedAction = input.recommendedAction;
    this.details = input.details ?? {};
  }
}

export function isFinalReportExecutionError(error: unknown): error is FinalReportExecutionError {
  return error instanceof FinalReportExecutionError;
}

export interface FinalReportExecutionContext {
  session: DeepResearchSession;
  messages: DeepResearchMessage[];
  allArtifacts: DeepResearchArtifact[];
}

export async function executeFinalReportNode(
  node: DeepResearchNode,
  ctx: FinalReportExecutionContext,
  model: LanguageModel,
  abortSignal?: AbortSignal,
): Promise<{
  output: Record<string, unknown>;
  artifacts: Array<{
    artifactType: ArtifactType;
    title: string;
    content: Record<string, unknown>;
    provenance: ArtifactProvenance | null;
  }>;
  tokensUsed: number;
}> {
  const userMessages = ctx.messages
    .filter((message) => message.role === "user")
    .map((message) => message.content);
  const shouldRespondInChinese = /[\u4e00-\u9fff]/.test(ctx.session.title)
    || userMessages.some((message) => /[\u4e00-\u9fff]/.test(message));
  const preferredOutputLanguage = shouldRespondInChinese ? "zh" : "en";
  const isSurveyLikeRequest = isSurveyLikeResearchRequest(ctx.session.title, userMessages);
  const reportSystemPrompt = buildFinalReportSystemPrompt(node);
  const citationEntries = buildFinalReportCitationEntries(ctx.allArtifacts);
  const archiveQuery = `final_report ${ctx.session.title} ${node.label} ${userMessages.slice(-2).join(" ")}`.trim();
  const preferredArtifactIds = resolveArtifactReferenceIds(node.input, ctx.allArtifacts);

  const runDraftPipeline = async (
    digestMode: "standard" | "compact",
  ): Promise<{
    artifactContent: Record<string, unknown>;
    tokensUsed: number;
  }> => {
    const promptBundle = buildFinalReportPromptBundle(
      ctx.session,
      ctx.messages,
      ctx.allArtifacts,
      { digestMode, preferredArtifactIds },
    );
    const archiveContext = await buildResearchContextArchivePromptBlock({
      session: ctx.session,
      messages: ctx.messages,
      artifacts: ctx.allArtifacts,
      query: archiveQuery,
      topK: digestMode === "compact" ? 6 : 4,
      maxChars: digestMode === "compact" ? 2800 : 1800,
    });
    const artifactDigest = digestMode === "compact" && archiveContext
      ? archiveContext
      : promptBundle.artifactDigest;
    if (!promptBundle.readiness.canDraft) {
      throw new FinalReportExecutionError({
        code: "insufficient_evidence",
        stage: "preflight",
        message: `Final report blocked before drafting. ${promptBundle.readiness.summary}`,
        recommendedAction: promptBundle.readiness.recommendedAction,
        details: {
          digestMode,
          readiness: promptBundle.readiness,
        },
      });
    }

    const sectionPlanPrompt = buildFinalReportSectionPlanPrompt(
      ctx.session,
      ctx.messages,
      ctx.allArtifacts,
      node,
      {
        digestMode,
        artifactDigestOverride: artifactDigest,
        preferredArtifactIds,
      },
    );

    let tokensUsed = 0;
    let sectionPlanResult;
    try {
      sectionPlanResult = await generateText({
        model,
        system: buildFinalReportPlannerSystemPrompt(node),
        messages: [{ role: "user", content: sectionPlanPrompt }],
        abortSignal,
      });
    } catch (error) {
      throw buildFinalReportStageError({
        error,
        stage: "planning",
        digestMode,
        readiness: promptBundle.readiness,
      });
    }

    tokensUsed += sectionPlanResult.usage?.totalTokens ?? 0;
    const rawSectionPlan = safeParseJson(sectionPlanResult.text);
    const sectionPlan = normalizeFinalReportSectionPlan({
      rawPlan: rawSectionPlan,
      sessionTitle: ctx.session.title,
      preferredOutputLanguage,
      isSurveyLikeRequest,
      maxBodySections: digestMode === "compact" ? 3 : 4,
    });
    const draftingOrder = getFinalReportDraftingOrder(sectionPlan);
    const sectionDrafts = new Map<string, string>();
    const fallbackReferenceKeys = new Set<string>();
    const bodySections = draftingOrder.filter((section) => section.kind === "body");
    const draftConcurrency = digestMode === "compact"
      ? 1
      : Math.max(1, Math.min(ctx.session.config.maxWorkerConcurrency || 1, 2));
    const referenceExcerptLimit = digestMode === "compact" ? 700 : 1200;

    const bodyDraftResults = await mapWithConcurrency(bodySections, draftConcurrency, async (section) => {
      const sectionPackets = getRelevantChapterPacketsForSection({
        section,
        artifacts: ctx.allArtifacts,
        limit: 2,
      });
      for (const packet of sectionPackets) {
        for (const citationKey of packet.citationKeys) {
          fallbackReferenceKeys.add(citationKey);
        }
      }
      const prompt = buildFinalReportSectionDraftPrompt({
        sessionTitle: ctx.session.title,
        preferredOutputLanguage,
        section,
        sectionPlan,
        artifactDigest,
        citationRegistry: promptBundle.citationRegistry,
        sectionPackets,
        referenceExcerptLimit,
      });

      let result;
      try {
        result = await generateText({
          model,
          system: reportSystemPrompt,
          messages: [{ role: "user", content: prompt }],
          abortSignal,
        });
      } catch (error) {
        throw buildFinalReportStageError({
          error,
          stage: `body:${section.title}`,
          digestMode,
          readiness: promptBundle.readiness,
        });
      }

      let content = result.text.trim();
      if (!content) {
        throw new FinalReportExecutionError({
          code: "draft_failed",
          stage: `body:${section.title}`,
          message: `Final report body draft returned empty content for section "${section.title}". ${promptBundle.readiness.summary}`,
          recommendedAction: "Retry with a narrower section scope or add an intermediate structured summary for this topic before regenerating the final report.",
          details: {
            digestMode,
            sectionId: section.id,
            sectionTitle: section.title,
            readiness: promptBundle.readiness,
          },
        });
      }

      const citedKeys = extractRecognizedCitationKeys(content, citationEntries);
      const allowedCitationKeys = [...new Set(sectionPackets.flatMap((packet) => packet.citationKeys))];
      if (citedKeys.length === 0 && allowedCitationKeys.length > 0) {
        try {
          const citationRevisionResult = await generateText({
            model,
            system: reportSystemPrompt,
            messages: [{
              role: "user",
              content: buildFinalReportSectionCitationRevisionPrompt({
                sectionTitle: section.title,
                preferredOutputLanguage,
                existingSection: content,
                relevantPackets: sectionPackets,
                allowedCitationKeys,
              }),
            }],
            abortSignal,
          });
          const revisedContent = citationRevisionResult.text.trim();
          if (revisedContent) {
            content = revisedContent;
          }
          return {
            section,
            content,
            tokensUsed: (result.usage?.totalTokens ?? 0) + (citationRevisionResult.usage?.totalTokens ?? 0),
          };
        } catch {
          // Keep the original section draft if the citation rescue pass fails.
        }
      }

      return {
        section,
        content,
        tokensUsed: result.usage?.totalTokens ?? 0,
      };
    });

    for (const draft of bodyDraftResults) {
      tokensUsed += draft.tokensUsed;
      sectionDrafts.set(draft.section.id, draft.content);
    }

    const introductionSection = draftingOrder.find((section) => section.kind === "introduction");
    if (introductionSection) {
      const introductionPackets = getRelevantChapterPacketsForSection({
        section: introductionSection,
        artifacts: ctx.allArtifacts,
        limit: 2,
      });
      for (const packet of introductionPackets) {
        for (const citationKey of packet.citationKeys) {
          fallbackReferenceKeys.add(citationKey);
        }
      }
      const introductionPrompt = buildFinalReportSectionDraftPrompt({
        sessionTitle: ctx.session.title,
        preferredOutputLanguage,
        section: introductionSection,
        sectionPlan,
        artifactDigest,
        citationRegistry: promptBundle.citationRegistry,
        sectionPackets: introductionPackets,
        draftedBodySections: bodySections.map((section) => ({
          title: section.title,
          content: sectionDrafts.get(section.id) ?? "",
        })),
        referenceExcerptLimit,
      });

      let introductionResult;
      try {
        introductionResult = await generateText({
          model,
          system: reportSystemPrompt,
          messages: [{ role: "user", content: introductionPrompt }],
          abortSignal,
        });
      } catch (error) {
        throw buildFinalReportStageError({
          error,
          stage: "introduction",
          digestMode,
          readiness: promptBundle.readiness,
        });
      }

      let introductionContent = introductionResult.text.trim();
      let introductionTokens = introductionResult.usage?.totalTokens ?? 0;
      const introCitedKeys = extractRecognizedCitationKeys(introductionContent, citationEntries);
      const introAllowedCitationKeys = [...new Set(introductionPackets.flatMap((packet) => packet.citationKeys))];
      if (introCitedKeys.length === 0 && introAllowedCitationKeys.length > 0) {
        try {
          const introductionCitationRevision = await generateText({
            model,
            system: reportSystemPrompt,
            messages: [{
              role: "user",
              content: buildFinalReportSectionCitationRevisionPrompt({
                sectionTitle: introductionSection.title,
                preferredOutputLanguage,
                existingSection: introductionContent,
                relevantPackets: introductionPackets,
                allowedCitationKeys: introAllowedCitationKeys,
              }),
            }],
            abortSignal,
          });
          const revisedIntroduction = introductionCitationRevision.text.trim();
          if (revisedIntroduction) {
            introductionContent = revisedIntroduction;
          }
          introductionTokens += introductionCitationRevision.usage?.totalTokens ?? 0;
        } catch {
          // Preserve the original introduction draft on rescue failure.
        }
      }

      tokensUsed += introductionTokens;
      sectionDrafts.set(introductionSection.id, introductionContent);
    }

    const conclusionSection = draftingOrder.find((section) => section.kind === "conclusion");
    if (conclusionSection) {
      const conclusionPackets = getRelevantChapterPacketsForSection({
        section: conclusionSection,
        artifacts: ctx.allArtifacts,
        limit: 3,
      });
      for (const packet of conclusionPackets) {
        for (const citationKey of packet.citationKeys) {
          fallbackReferenceKeys.add(citationKey);
        }
      }
      const draftedFullSections = sectionPlan.sections
        .filter((section) => section.kind !== "conclusion")
        .map((section) => ({
          title: section.title,
          content: sectionDrafts.get(section.id) ?? "",
        }));
      const conclusionPrompt = buildFinalReportSectionDraftPrompt({
        sessionTitle: ctx.session.title,
        preferredOutputLanguage,
        section: conclusionSection,
        sectionPlan,
        artifactDigest,
        citationRegistry: promptBundle.citationRegistry,
        sectionPackets: conclusionPackets,
        draftedFullSections,
        referenceExcerptLimit,
      });

      let conclusionResult;
      try {
        conclusionResult = await generateText({
          model,
          system: reportSystemPrompt,
          messages: [{ role: "user", content: conclusionPrompt }],
          abortSignal,
        });
      } catch (error) {
        throw buildFinalReportStageError({
          error,
          stage: "conclusion",
          digestMode,
          readiness: promptBundle.readiness,
        });
      }

      let conclusionContent = conclusionResult.text.trim();
      let conclusionTokens = conclusionResult.usage?.totalTokens ?? 0;
      const conclusionCitedKeys = extractRecognizedCitationKeys(conclusionContent, citationEntries);
      const conclusionAllowedCitationKeys = [...new Set(conclusionPackets.flatMap((packet) => packet.citationKeys))];
      if (conclusionCitedKeys.length === 0 && conclusionAllowedCitationKeys.length > 0) {
        try {
          const conclusionCitationRevision = await generateText({
            model,
            system: reportSystemPrompt,
            messages: [{
              role: "user",
              content: buildFinalReportSectionCitationRevisionPrompt({
                sectionTitle: conclusionSection.title,
                preferredOutputLanguage,
                existingSection: conclusionContent,
                relevantPackets: conclusionPackets,
                allowedCitationKeys: conclusionAllowedCitationKeys,
              }),
            }],
            abortSignal,
          });
          const revisedConclusion = conclusionCitationRevision.text.trim();
          if (revisedConclusion) {
            conclusionContent = revisedConclusion;
          }
          conclusionTokens += conclusionCitationRevision.usage?.totalTokens ?? 0;
        } catch {
          // Preserve the original conclusion draft on rescue failure.
        }
      }

      tokensUsed += conclusionTokens;
      sectionDrafts.set(conclusionSection.id, conclusionContent);
    }

    let output: Record<string, unknown> = {};
    let reportText = assembleFinalReportFromSections({
      reportTitle: sectionPlan.reportTitle,
      sectionPlan,
      sectionDrafts,
    });
    const deterministicReferences = appendDeterministicReferencesSection({
      reportText,
      citationEntries,
      preferredOutputLanguage,
      fallbackCitationKeys: [...fallbackReferenceKeys],
      minimumReferenceCount: citationEntries.length > 0
        ? Math.min(citationEntries.length, isSurveyLikeRequest ? 12 : 8)
        : undefined,
    });
    reportText = deterministicReferences.reportText;
    let revisedForCoverage = false;
    let coverageRevisionSkippedReason: string | null = null;

    const initialCoverage = analyzeFinalReportCitationCoverage(
      reportText,
      ctx.allArtifacts,
      ctx.session.title,
      userMessages,
    );

    if (
      citationEntries.length > 0 &&
      !initialCoverage.meetsCoverage &&
      initialCoverage.minimumRequiredCitationCount > 0
    ) {
      const revisionInputLimit = digestMode === "compact" ? 18_000 : 28_000;
      if (reportText.length > revisionInputLimit) {
        coverageRevisionSkippedReason = `Skipped citation-coverage revision because the assembled report is ${reportText.length} chars, above the ${revisionInputLimit}-char safety limit for an extra rewrite pass.`;
      } else {
        const revisionPrompt = buildFinalReportCoverageRevisionPrompt({
          sessionTitle: ctx.session.title,
          preferredOutputLanguage,
          existingReport: reportText,
          coverage: initialCoverage,
          citationEntries,
        });

        let revisionResult;
        try {
          revisionResult = await generateText({
            model,
            system: reportSystemPrompt,
            messages: [{ role: "user", content: revisionPrompt }],
            abortSignal,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          coverageRevisionSkippedReason = `Coverage revision failed; preserved the assembled report instead. Provider error: ${message}`;
          revisionResult = null;
        }

        if (revisionResult) {
          tokensUsed += revisionResult.usage?.totalTokens ?? 0;

          const revisedOutput = safeParseJson(revisionResult.text);
          const revisedReportText = (revisedOutput.report as string)
            || (revisedOutput.messageToUser as string)
            || (revisedOutput.text as string)
            || revisionResult.text;
          const revisedCoverage = analyzeFinalReportCitationCoverage(
            revisedReportText,
            ctx.allArtifacts,
            ctx.session.title,
            userMessages,
          );

          if (revisedCoverage.citedCitationCount >= initialCoverage.citedCitationCount) {
            output = revisedOutput;
            reportText = revisedReportText;
            revisedForCoverage = true;
          }
        }
      }
    }

    const finalCoverage = analyzeFinalReportCitationCoverage(
      reportText,
      ctx.allArtifacts,
      ctx.session.title,
      userMessages,
    );

    return {
      artifactContent: {
        report: reportText.trim(),
        sectionPlan,
        draftingOrder: draftingOrder.map((section) => ({
          id: section.id,
          title: section.title,
          kind: section.kind,
        })),
        citationCoverage: finalCoverage,
        revisedForCoverage,
        readiness: promptBundle.readiness,
        generationStrategy: {
          digestMode,
          draftConcurrency,
          bodySectionCount: bodySections.length,
          referenceExcerptLimit,
          deterministicReferencesAdded: deterministicReferences.referencesAdded,
          deterministicReferenceKeyCount: deterministicReferences.citedCitationKeys.length,
          usedPersistedContextArchive: Boolean(archiveContext),
          coverageRevisionSkippedReason,
        },
        ...output,
      },
      tokensUsed,
    };
  };

  let draftResult: {
    artifactContent: Record<string, unknown>;
    tokensUsed: number;
  };
  let compactFallbackUsed = false;

  try {
    draftResult = await runDraftPipeline("standard");
  } catch (error) {
    if (!shouldRetryFinalReportInCompactMode(error)) {
      throw error;
    }
    compactFallbackUsed = true;
    draftResult = await runDraftPipeline("compact");
  }

  const artifactContent = {
    ...draftResult.artifactContent,
    compactFallbackUsed,
  };

  return {
    output: artifactContent,
    artifacts: [{
      artifactType: "final_report" as ArtifactType,
      title: node.label,
      content: artifactContent,
      provenance: {
        sourceNodeId: node.id,
        sourceArtifactIds: ctx.allArtifacts.map((artifact) => artifact.id),
        model: node.assignedModel || "unknown",
        generatedAt: new Date().toISOString(),
      } as ArtifactProvenance,
    }],
    tokensUsed: draftResult.tokensUsed,
  };
}

function buildFinalReportStageError(input: {
  error: unknown;
  stage: string;
  digestMode: "standard" | "compact";
  readiness: {
    summary: string;
    recommendedAction: string;
  };
}): FinalReportExecutionError {
  const message = input.error instanceof Error ? input.error.message : String(input.error);
  const code: FinalReportFailureCode = /context|token|too long|maximum context|input.*large|prompt.*large|length/i.test(message)
    ? "context_overflow"
    : "draft_failed";

  return new FinalReportExecutionError({
    code,
    stage: input.stage,
    message: `Final report ${input.stage} failed in ${input.digestMode} mode. ${input.readiness.summary ?? "Readiness summary unavailable."} Provider error: ${message}`,
    recommendedAction: code === "context_overflow"
      ? "Retry with a more compact synthesis context, fewer body sections, or add an intermediate structured summary before another final-report attempt."
      : input.readiness.recommendedAction ?? "Inspect the upstream synthesis artifacts and retry with a narrower, better-structured final-report task.",
    details: {
      digestMode: input.digestMode,
      readiness: input.readiness,
      providerError: message,
    },
  });
}

function shouldRetryFinalReportInCompactMode(error: unknown): boolean {
  if (isFinalReportExecutionError(error)) {
    return error.code === "context_overflow";
  }

  const message = error instanceof Error ? error.message : String(error);
  return /context|token|too long|maximum context|input.*large|prompt.*large|rate limit|overload|capacity/i.test(message);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) {
        return;
      }
      results[index] = await mapper(items[index], index);
    }
  }));

  return results;
}
