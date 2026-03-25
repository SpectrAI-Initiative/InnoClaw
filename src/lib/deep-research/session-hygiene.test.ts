import { describe, expect, it } from "vitest";
import {
  buildSessionHygienePromptBlock,
  detectSuspiciousEvidenceYears,
  findDuplicatePendingGroups,
  resolveBlockedDescendantNodeIds,
  resolveFailedNodeCleanupTargets,
} from "./session-hygiene";
import type { DeepResearchArtifact, DeepResearchNode } from "./types";

function makeNode(overrides: Partial<DeepResearchNode> = {}): DeepResearchNode {
  return {
    id: overrides.id ?? "node-1",
    sessionId: overrides.sessionId ?? "session-1",
    parentId: overrides.parentId ?? null,
    nodeType: overrides.nodeType ?? "evidence_gather",
    label: overrides.label ?? "Collect evidence",
    status: overrides.status ?? "pending",
    assignedRole: overrides.assignedRole ?? "literature_intelligence_analyst",
    assignedModel: overrides.assignedModel ?? null,
    input: overrides.input ?? { topic: "kv cache" },
    output: overrides.output ?? null,
    error: overrides.error ?? null,
    dependsOn: overrides.dependsOn ?? [],
    supersedesId: overrides.supersedesId ?? null,
    supersededById: overrides.supersededById ?? null,
    branchKey: overrides.branchKey ?? null,
    retryOfId: overrides.retryOfId ?? null,
    retryCount: overrides.retryCount ?? 0,
    contextTag: overrides.contextTag ?? "planning",
    requiresConfirmation: overrides.requiresConfirmation ?? true,
    confirmedAt: overrides.confirmedAt ?? null,
    confirmedBy: overrides.confirmedBy ?? null,
    confirmationOutcome: overrides.confirmationOutcome ?? null,
    positionX: overrides.positionX ?? null,
    positionY: overrides.positionY ?? null,
    startedAt: overrides.startedAt ?? null,
    completedAt: overrides.completedAt ?? null,
    stageNumber: overrides.stageNumber ?? 0,
    createdAt: overrides.createdAt ?? "2026-03-25T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-03-25T00:00:00.000Z",
  };
}

function makeArtifact(overrides: Partial<DeepResearchArtifact> = {}): DeepResearchArtifact {
  return {
    id: overrides.id ?? "artifact-1",
    sessionId: overrides.sessionId ?? "session-1",
    nodeId: overrides.nodeId ?? "node-1",
    artifactType: overrides.artifactType ?? "evidence_card",
    title: overrides.title ?? "Evidence Card",
    content: overrides.content ?? {},
    provenance: overrides.provenance ?? null,
    version: overrides.version ?? 1,
    createdAt: overrides.createdAt ?? "2026-03-25T00:00:00.000Z",
  };
}

describe("session-hygiene", () => {
  it("finds redundant pending nodes with the same task fingerprint", () => {
    const duplicates = findDuplicatePendingGroups([
      makeNode({ id: "node-a", createdAt: "2026-03-25T00:00:00.000Z" }),
      makeNode({ id: "node-b", createdAt: "2026-03-25T00:01:00.000Z" }),
      makeNode({ id: "node-c", label: "Different task" }),
    ]);

    expect(duplicates).toEqual([
      {
        keeperNodeId: "node-a",
        duplicateNodeIds: ["node-b"],
        label: "Collect evidence",
        nodeType: "evidence_gather",
      },
    ]);
  });

  it("flags future or weakly-attributed current-year source metadata for verification", () => {
    const findings = detectSuspiciousEvidenceYears([
      makeArtifact({
        content: {
          sources: [
            { title: "Future paper", year: 2027, venue: "NeurIPS", doi: "10.1/abc" },
            { title: "Weak 2026 source", year: 2026, venue: "", doi: "" },
            { title: "Verified 2026 source", year: 2026, venue: "ICLR", doi: "10.1/ok" },
          ],
        },
      }),
    ], 2026);

    expect(findings).toHaveLength(2);
    expect(findings.map((item) => item.sourceTitle)).toEqual([
      "Future paper",
      "Weak 2026 source",
    ]);
  });

  it("builds a recovery prompt block when cleanup issues are present", () => {
    const block = buildSessionHygienePromptBlock({
      duplicatePendingGroups: [],
      supersededDuplicateNodeIds: ["dup-1"],
      cancelledExecutionRecordIds: ["exec-1"],
      failedNodeIdsNeedingAttention: ["6n24UNOY", "1rU6Grfm"],
      suspiciousEvidenceYears: [
        {
          artifactId: "artifact-1",
          nodeId: "node-1",
          sourceTitle: "Weak 2026 source",
          year: 2026,
          reason: "current-year source 2026 is missing venue or DOI metadata",
        },
      ],
    });

    expect(block).toContain("6n24UNOY");
    expect(block).toContain("exec-1");
    expect(block).toContain("Weak 2026 source");
  });

  it("selects failed worker nodes mentioned in feedback for cleanup", () => {
    const cleaned = resolveFailedNodeCleanupTargets(
      [
        makeNode({ id: "6n24UNOY", status: "failed", nodeType: "evidence_extract" }),
        makeNode({ id: "1rU6Grfm", status: "failed", nodeType: "evidence_extract" }),
        makeNode({ id: "audit123", status: "failed", nodeType: "audit" }),
      ],
      ["6n24UNOY", "1rU6Grfm", "audit123"],
      "清理失败任务 6n24UNOY, 1rU6Grfm, audit123",
    );

    expect(cleaned).toEqual(["6n24UNOY", "1rU6Grfm"]);
  });

  it("cleans pending descendants blocked by cleaned failed nodes", () => {
    const blocked = resolveBlockedDescendantNodeIds(
      [
        makeNode({ id: "failed-1", status: "failed" }),
        makeNode({ id: "pending-1", status: "pending", dependsOn: ["failed-1"] }),
        makeNode({ id: "queued-1", status: "queued", dependsOn: ["pending-1"] }),
        makeNode({ id: "done-1", status: "completed", dependsOn: ["failed-1"] }),
      ],
      new Set(["failed-1"]),
    );

    expect(blocked).toEqual(["pending-1", "queued-1"]);
  });
});
