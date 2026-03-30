// =============================================================
// Deep Research — Reviewer Deliberation Summary
// =============================================================

import * as store from "./event-store";
import { executeNode } from "./node-executor";
import type {
  DeepResearchArtifact,
  ReviewerPacket,
  ReviewAssessment,
  ReviewAssessmentExtended,
  ReviewRound,
} from "./types";

export interface ReviewAssessmentConfig {
  maxRounds: number;
  convergenceThreshold: number;
}

const DEFAULT_REVIEW_ASSESSMENT_CONFIG: ReviewAssessmentConfig = {
  maxRounds: 3,
  convergenceThreshold: 0.7,
};

/**
 * Run a single Results and Evidence Analyst review pass and summarize it into
 * a first-class review assessment artifact.
 */
export async function runReviewAssessment(
  sessionId: string,
  targetArtifacts: DeepResearchArtifact[],
  config: ReviewAssessmentConfig = DEFAULT_REVIEW_ASSESSMENT_CONFIG,
  abortSignal?: AbortSignal
): Promise<ReviewAssessmentExtended> {
  const session = await store.getSession(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  await store.appendEvent(sessionId, "review_started", undefined, "system", undefined, undefined, {
    maxRounds: 1,
    reviewerRole: "results_and_evidence_analyst",
  });

  const reviewerNode = await store.createNode(sessionId, {
    nodeType: "review",
    label: "Results and Evidence Analyst review",
    assignedRole: "results_and_evidence_analyst",
    input: {
      round: 1,
      targetArtifactIds: targetArtifacts.map((artifact) => artifact.id),
      requestedMaxRounds: config.maxRounds,
    },
    contextTag: session.contextTag,
  });

  const ctx = {
    session,
    messages: await store.getMessages(sessionId),
    allNodes: await store.getNodes(sessionId),
    allArtifacts: await store.getArtifacts(sessionId),
  };
  await executeNode(reviewerNode, ctx, abortSignal);

  const artifacts = await store.getArtifacts(sessionId);
  const packetArtifact = artifacts.find((artifact) =>
    artifact.nodeId === reviewerNode.id && artifact.artifactType === "reviewer_packet"
  );
  const packet: ReviewerPacket = packetArtifact
    ? (packetArtifact.content as unknown as ReviewerPacket)
    : createFallbackPacket();

  const rounds: ReviewRound[] = [{ round: 1, reviewerPacket: packet }];
  const extendedResult: ReviewAssessmentExtended = {
    ...buildReviewAssessment(packet),
    rounds,
    reviewRounds: 1,
    reviewerRole: packet.reviewerRole,
    reviewerSummary: packet.critique,
    reviewHighlights: packet.suggestions ?? [],
    openIssues: packet.identifiedGaps ?? [],
    reviewHistory: rounds,
  };

  await store.createArtifact(
    sessionId,
    null,
    "review_assessment",
    `Reviewer Assessment (${rounds.length} round)`,
    extendedResult as unknown as Record<string, unknown>
  );

  await store.appendEvent(sessionId, "review_completed", undefined, "system", undefined, undefined, {
    rounds: 1,
    reviewerRole: "results_and_evidence_analyst",
    verdict: extendedResult.combinedVerdict,
  });

  return extendedResult;
}

function buildReviewAssessment(packet: ReviewerPacket): ReviewAssessment {
  return {
    reviewerSummary: packet.critique,
    reviewHighlights: packet.suggestions ?? [],
    openIssues: packet.identifiedGaps ?? [],
    combinedVerdict: packet.verdict,
    combinedConfidence: packet.confidence,
    uncertaintyReducers: packet.suggestions ?? [],
    needsMoreLiterature: Boolean(packet.identifiedGaps?.length),
    literatureGaps: packet.identifiedGaps ?? [],
    needsExperimentalValidation: packet.needsExperimentalValidation ?? false,
    suggestedExperiments: packet.suggestedExperiments ?? [],
  };
}

function createFallbackPacket(): ReviewerPacket {
  return {
    reviewerRole: "results_and_evidence_analyst",
    verdict: "revise",
    critique: "No review response was produced.",
    suggestions: [],
    confidence: 0,
    identifiedGaps: [],
    needsExperimentalValidation: false,
    suggestedExperiments: [],
  };
}
