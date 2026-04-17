import { describe, expect, it } from "vitest";
import {
  resolveNodeDependencies,
  rewriteNodeSpecsForWorkflowPolicy,
} from "./dispatch-policy";
import type { NodeCreationSpec } from "./types";

function createSpec(overrides: Partial<NodeCreationSpec>): NodeCreationSpec {
  return {
    nodeType: overrides.nodeType ?? "validation_plan",
    label: overrides.label ?? "时间序列Transformer综述架构设计：三大技术路线的结构化框架构建",
    assignedRole: overrides.assignedRole ?? "experiment_architecture_designer",
    input: overrides.input,
    dependsOn: overrides.dependsOn,
    parentId: overrides.parentId,
    branchKey: overrides.branchKey,
    contextTag: overrides.contextTag ?? "planning",
  };
}

describe("dispatch-policy", () => {
  it("rewrites conceptual validation-plan specs in analysis-only mode", () => {
    const { rewrittenSpecs, rewrites } = rewriteNodeSpecsForWorkflowPolicy(
      [createSpec({})],
      {
        mode: "analysis_only",
        requiresInitialPlanConfirmation: false,
        blockedNodeTypes: new Set(["validation_plan"]),
        reasoning: [],
        promptBlock: "",
      },
    );

    expect(rewrites).toEqual([
      "时间序列Transformer综述架构设计：三大技术路线的结构化框架构建 (validation_plan -> summarize)",
    ]);
    expect(rewrittenSpecs[0]).toMatchObject({
      nodeType: "summarize",
      assignedRole: "results_and_evidence_analyst",
    });
  });

  it("does not rewrite genuine experiment planning requests", () => {
    const { rewrittenSpecs, rewrites } = rewriteNodeSpecsForWorkflowPolicy(
      [createSpec({
        label: "设计消融实验与验证计划",
        input: { objective: "benchmark and ablation evaluation" },
      })],
      {
        mode: "analysis_only",
        requiresInitialPlanConfirmation: false,
        blockedNodeTypes: new Set(["validation_plan"]),
        reasoning: [],
        promptBlock: "",
      },
    );

    expect(rewrites).toHaveLength(0);
    expect(rewrittenSpecs[0]?.nodeType).toBe("validation_plan");
    expect(rewrittenSpecs[0]?.assignedRole).toBe("experiment_architecture_designer");
  });

  it("resolves short node ids in dependsOn references", () => {
    const resolved = resolveNodeDependencies(
      ["yQzevwDS", "Generate summary"],
      new Set(["yQzevwDScO3hWTd7QkBWe"]),
      new Map([["Generate summary", "full-summary-node-id"]]),
      new Map(),
    );

    expect(resolved).toEqual([
      "yQzevwDScO3hWTd7QkBWe",
      "full-summary-node-id",
    ]);
  });
});
