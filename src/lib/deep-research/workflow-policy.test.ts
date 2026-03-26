import { describe, expect, it } from "vitest";
import {
  deriveWorkflowPolicy,
  filterNodeSpecsForWorkflowPolicy,
} from "./workflow-policy";
import type { DeepResearchArtifact, NodeCreationSpec } from "./types";

function createSpec(overrides: Partial<NodeCreationSpec>): NodeCreationSpec {
  return {
    nodeType: overrides.nodeType ?? "evidence_gather",
    label: overrides.label ?? "Test task",
    assignedRole: overrides.assignedRole ?? "literature_intelligence_analyst",
    input: overrides.input,
    dependsOn: overrides.dependsOn,
    parentId: overrides.parentId,
    branchKey: overrides.branchKey,
    contextTag: overrides.contextTag ?? "planning",
  };
}

function createArtifact(overrides: Partial<DeepResearchArtifact>): DeepResearchArtifact {
  return {
    id: overrides.id ?? "artifact-1",
    sessionId: overrides.sessionId ?? "session-1",
    nodeId: overrides.nodeId ?? null,
    artifactType: overrides.artifactType ?? "checkpoint",
    title: overrides.title ?? "Checkpoint",
    content: overrides.content ?? {},
    provenance: overrides.provenance ?? null,
    version: overrides.version ?? 1,
    createdAt: overrides.createdAt ?? "2026-03-26T00:00:00.000Z",
  };
}

describe("workflow policy", () => {
  it("classifies conceptual literature requests as analysis-only and requires an initial plan checkpoint", () => {
    const policy = deriveWorkflowPolicy({
      sessionTitle: "调研大模型的记忆机制",
      userMessages: ["请梳理大模型记忆机制的主要路线、优缺点和代表工作。"],
      artifacts: [],
    });

    expect(policy.mode).toBe("analysis_only");
    expect(policy.requiresInitialPlanConfirmation).toBe(true);
    expect(policy.blockedNodeTypes.has("execute")).toBe(true);
    expect(policy.blockedNodeTypes.has("validation_plan")).toBe(true);
  });

  it("stops experiment nodes from entering an analysis-only workflow", () => {
    const policy = deriveWorkflowPolicy({
      sessionTitle: "Survey of LLM memory mechanisms",
      userMessages: ["Need a literature review, not an experiment run."],
      artifacts: [],
    });

    const { allowedSpecs, blockedSpecs } = filterNodeSpecsForWorkflowPolicy([
      createSpec({ nodeType: "evidence_gather", label: "Collect papers" }),
      createSpec({ nodeType: "execute", assignedRole: "experiment_operations_engineer", label: "Run benchmark" }),
    ], policy);

    expect(allowedSpecs).toHaveLength(1);
    expect(allowedSpecs[0]?.nodeType).toBe("evidence_gather");
    expect(blockedSpecs).toHaveLength(1);
    expect(blockedSpecs[0]?.nodeType).toBe("execute");
  });

  it("turns off the initial plan requirement once the session already has a checkpoint", () => {
    const policy = deriveWorkflowPolicy({
      sessionTitle: "LLM memory benchmark",
      userMessages: ["Design experiments and run evaluations."],
      artifacts: [createArtifact({ artifactType: "checkpoint" })],
    });

    expect(policy.requiresInitialPlanConfirmation).toBe(false);
    expect(policy.mode).toBe("execution_required");
  });
});
