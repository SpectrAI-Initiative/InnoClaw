import type { DeepResearchArtifact, DeepResearchNode } from "./types";

const SUPPORTING_FINAL_REPORT_ARTIFACT_TYPES = new Set<DeepResearchArtifact["artifactType"]>([
  "evidence_card",
  "structured_summary",
  "provisional_conclusion",
  "review_assessment",
  "reviewer_packet",
  "literature_round_summary",
  "claim_map",
  "validation_report",
  "experiment_result",
  "step_result",
]);

export interface FinalReportRetryAssessment {
  allowed: boolean;
  failedAttemptCount: number;
  newSupportingArtifactCount: number;
  latestFailureNodeId: string | null;
  reason?: string;
}

export function assessFinalReportRetry(input: {
  nodes: DeepResearchNode[];
  artifacts: DeepResearchArtifact[];
  maxRepeatedFailuresWithoutNewMaterial?: number;
}): FinalReportRetryAssessment {
  const maxRepeatedFailuresWithoutNewMaterial = input.maxRepeatedFailuresWithoutNewMaterial ?? 2;
  const failedFinalReports = input.nodes
    .filter((node) => node.nodeType === "final_report" && node.status === "failed")
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  if (failedFinalReports.length === 0) {
    return {
      allowed: true,
      failedAttemptCount: 0,
      newSupportingArtifactCount: 0,
      latestFailureNodeId: null,
    };
  }

  const latestSupportingArtifactAt = input.artifacts
    .filter((artifact) => SUPPORTING_FINAL_REPORT_ARTIFACT_TYPES.has(artifact.artifactType))
    .map((artifact) => artifact.createdAt)
    .sort()
    .at(-1);
  const latestFailure = failedFinalReports[failedFinalReports.length - 1];
  const latestFailureWasCoverageOnly = /coverage_revision/i.test(latestFailure.error ?? "");

  if (latestFailureWasCoverageOnly) {
    return {
      allowed: true,
      failedAttemptCount: 0,
      newSupportingArtifactCount: 0,
      latestFailureNodeId: latestFailure.id,
    };
  }

  if (latestSupportingArtifactAt && latestSupportingArtifactAt > latestFailure.createdAt) {
    return {
      allowed: true,
      failedAttemptCount: 0,
      newSupportingArtifactCount: input.artifacts.filter(
        (artifact) =>
          SUPPORTING_FINAL_REPORT_ARTIFACT_TYPES.has(artifact.artifactType)
          && artifact.createdAt > latestFailure.createdAt,
      ).length,
      latestFailureNodeId: latestFailure.id,
    };
  }

  const resetTimestamp = latestSupportingArtifactAt ?? "";
  const failedAttemptCount = failedFinalReports.filter((node) => node.createdAt >= resetTimestamp).length;

  if (failedAttemptCount < maxRepeatedFailuresWithoutNewMaterial) {
    return {
      allowed: true,
      failedAttemptCount,
      newSupportingArtifactCount: 0,
      latestFailureNodeId: latestFailure.id,
    };
  }

  return {
    allowed: false,
    failedAttemptCount,
    newSupportingArtifactCount: 0,
    latestFailureNodeId: latestFailure.id,
    reason: `Blocked repeated final_report dispatch because ${failedAttemptCount} recent final_report attempt(s) already failed and no new evidence/synthesis artifact was added after the latest failure.`,
  };
}
