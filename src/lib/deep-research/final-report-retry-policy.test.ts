import { describe, expect, it } from "vitest";
import { assessFinalReportRetry } from "./final-report-retry-policy";
import type { DeepResearchArtifact, DeepResearchNode } from "./types";

function createNode(overrides: Partial<DeepResearchNode>): DeepResearchNode {
  return {
    id: overrides.id ?? "node-1",
    sessionId: overrides.sessionId ?? "session-1",
    parentId: overrides.parentId ?? null,
    nodeType: overrides.nodeType ?? "final_report",
    label: overrides.label ?? "Generate final report",
    status: overrides.status ?? "failed",
    assignedRole: overrides.assignedRole ?? "research_asset_reuse_specialist",
    assignedModel: overrides.assignedModel ?? null,
    input: overrides.input ?? null,
    output: overrides.output ?? null,
    error: overrides.error ?? null,
    dependsOn: overrides.dependsOn ?? [],
    supersedesId: overrides.supersedesId ?? null,
    supersededById: overrides.supersededById ?? null,
    branchKey: overrides.branchKey ?? null,
    retryOfId: overrides.retryOfId ?? null,
    retryCount: overrides.retryCount ?? 0,
    contextTag: overrides.contextTag ?? "final_report",
    stageNumber: overrides.stageNumber ?? 0,
    requiresConfirmation: overrides.requiresConfirmation ?? true,
    confirmedAt: overrides.confirmedAt ?? null,
    confirmedBy: overrides.confirmedBy ?? null,
    confirmationOutcome: overrides.confirmationOutcome ?? null,
    positionX: overrides.positionX ?? null,
    positionY: overrides.positionY ?? null,
    startedAt: overrides.startedAt ?? null,
    completedAt: overrides.completedAt ?? null,
    createdAt: overrides.createdAt ?? "2026-04-16T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-04-16T00:00:00.000Z",
  };
}

function createArtifact(overrides: Partial<DeepResearchArtifact>): DeepResearchArtifact {
  return {
    id: overrides.id ?? "artifact-1",
    sessionId: overrides.sessionId ?? "session-1",
    nodeId: overrides.nodeId ?? "node-upstream",
    artifactType: overrides.artifactType ?? "structured_summary",
    title: overrides.title ?? "Summary",
    content: overrides.content ?? {},
    provenance: overrides.provenance ?? null,
    version: overrides.version ?? 1,
    createdAt: overrides.createdAt ?? "2026-04-16T00:00:00.000Z",
  };
}

describe("final-report retry policy", () => {
  it("blocks repeated final_report retries when no new supporting artifact exists", () => {
    const assessment = assessFinalReportRetry({
      nodes: [
        createNode({ id: "fr-1", createdAt: "2026-04-16T08:00:00.000Z" }),
        createNode({ id: "fr-2", createdAt: "2026-04-16T09:00:00.000Z" }),
      ],
      artifacts: [
        createArtifact({ id: "sum-1", createdAt: "2026-04-16T07:00:00.000Z" }),
      ],
    });

    expect(assessment.allowed).toBe(false);
    expect(assessment.failedAttemptCount).toBe(2);
    expect(assessment.reason).toContain("no new evidence/synthesis artifact");
  });

  it("allows another final_report attempt after new synthesis material is added", () => {
    const assessment = assessFinalReportRetry({
      nodes: [
        createNode({ id: "fr-1", createdAt: "2026-04-16T08:00:00.000Z" }),
        createNode({ id: "fr-2", createdAt: "2026-04-16T09:00:00.000Z" }),
      ],
      artifacts: [
        createArtifact({ id: "sum-1", createdAt: "2026-04-16T07:00:00.000Z" }),
        createArtifact({ id: "sum-2", createdAt: "2026-04-16T09:30:00.000Z" }),
      ],
    });

    expect(assessment.allowed).toBe(true);
    expect(assessment.newSupportingArtifactCount).toBe(1);
  });

  it("does not block a retry when the latest failure only happened in coverage revision", () => {
    const assessment = assessFinalReportRetry({
      nodes: [
        createNode({
          id: "fr-1",
          createdAt: "2026-04-16T08:00:00.000Z",
          error: "All models failed. Last error: Final report coverage_revision failed in standard mode.",
        }),
        createNode({
          id: "fr-2",
          createdAt: "2026-04-16T09:00:00.000Z",
          error: "All models failed. Last error: Final report coverage_revision failed in standard mode.",
        }),
      ],
      artifacts: [
        createArtifact({ id: "sum-1", createdAt: "2026-04-16T07:00:00.000Z" }),
      ],
    });

    expect(assessment.allowed).toBe(true);
    expect(assessment.failedAttemptCount).toBe(0);
  });
});
