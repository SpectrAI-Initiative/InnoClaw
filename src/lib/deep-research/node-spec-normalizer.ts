import { getStructuredRoleDefinition } from "./role-registry";
import { alignNodeCreationSpecWithTemplate } from "./node-spec-templates";
import type { ContextTag, ModelRole, NodeCreationSpec, NodeType } from "./types";
import { VALID_CONTEXT_TAGS } from "./types";

const VALID_NODE_TYPES = new Set<NodeType>([
  "intake",
  "plan",
  "evidence_gather",
  "evidence_extract",
  "summarize",
  "synthesize",
  "review",
  "audit",
  "validation_plan",
  "resource_request",
  "execute",
  "monitor",
  "result_collect",
  "result_compare",
  "approve",
  "final_report",
  "retrieve",
  "synthesize_claims",
  "data_download",
  "preprocess",
  "skill_route",
]);

const VALID_MODEL_ROLES = new Set<ModelRole>([
  "main_brain",
  "researcher",
  "literature_intelligence_analyst",
  "experiment_architecture_designer",
  "research_software_engineer",
  "experiment_operations_engineer",
  "results_and_evidence_analyst",
  "research_asset_reuse_specialist",
  "worker",
  "synthesizer",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function buildTaskText(rawSpec: Record<string, unknown>): string {
  const input = asRecord(rawSpec.input);
  return [
    asString(rawSpec.label),
    asString(rawSpec.title),
    asString(rawSpec.name),
    asString(rawSpec.objective),
    asString(rawSpec.task),
    asString(rawSpec.description),
    asString(input?.task),
    asString(input?.objective),
    asString(input?.description),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}

function isSynthesisLikeLiteratureTask(taskText: string): boolean {
  return /synthesi[sz]e|summari[sz]e|summary|analy[sz]e|analysis|claim map|gap analysis|综合|汇总|总结|分析/.test(taskText);
}

function normalizeContextTag(rawContextTag: string | undefined, defaultContextTag: ContextTag): ContextTag {
  if (!rawContextTag) return defaultContextTag;
  const normalized = rawContextTag.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (VALID_CONTEXT_TAGS.includes(normalized as ContextTag)) {
    return normalized as ContextTag;
  }
  if (normalized === "final_report" || normalized === "report") return "final_report";
  if (normalized === "plan") return "planning";
  if (normalized === "start") return "intake";
  return "planning";
}

function normalizeRole(rawRole: string | undefined): ModelRole | undefined {
  if (!rawRole) return undefined;
  return VALID_MODEL_ROLES.has(rawRole as ModelRole) ? rawRole as ModelRole : undefined;
}

function inferNodeType(role: ModelRole | undefined, contextTag: ContextTag): NodeType | undefined {
  if (!role) return undefined;

  if (role === "literature_intelligence_analyst") {
    return "evidence_gather";
  }
  if (role === "results_and_evidence_analyst") {
    return "review";
  }
  if (role === "experiment_architecture_designer") {
    return "validation_plan";
  }
  if (role === "experiment_operations_engineer") {
    return "execute";
  }
  if (contextTag === "planning" && role === "research_software_engineer") {
    return "execute";
  }
  if (contextTag === "planning" && role === "researcher") {
    return "plan";
  }
  if (contextTag === "final_report" && role === "research_asset_reuse_specialist") {
    return "final_report";
  }
  if (contextTag === "final_report") {
    return "final_report";
  }
  if (contextTag === "planning" && role === "worker") {
    return "resource_request";
  }

  return getStructuredRoleDefinition(role)?.defaultNodeType;
}

function normalizeNodeType(
  rawNodeType: string | undefined,
  role: ModelRole | undefined,
  contextTag: ContextTag,
): NodeType | undefined {
  if (rawNodeType && VALID_NODE_TYPES.has(rawNodeType as NodeType)) {
    if (rawNodeType === "deliberate") {
      return "audit";
    }
    if (
      rawNodeType === "retrieve" &&
      role === "literature_intelligence_analyst"
    ) {
      return "evidence_gather";
    }
    return rawNodeType as NodeType;
  }

  return inferNodeType(role, contextTag);
}

export function normalizeNodeCreationSpec(
  rawSpec: unknown,
  defaultContextTag: ContextTag,
): NodeCreationSpec | null {
  if (!isRecord(rawSpec)) {
    return null;
  }

  let contextTag = normalizeContextTag(
    asString(rawSpec.contextTag) ?? asString(rawSpec.phase) ?? asString(rawSpec.nextContextTag) ?? asString(rawSpec.nextPhase),
    defaultContextTag,
  );
  const assignedRole = normalizeRole(
    asString(rawSpec.assignedRole) ??
    asString(rawSpec.role) ??
    asString(rawSpec.owner) ??
    asString(rawSpec.responsibleRole),
  );
  const taskText = buildTaskText(rawSpec);
  let nodeType = normalizeNodeType(
    asString(rawSpec.nodeType) ??
    asString(rawSpec.type) ??
    asString(rawSpec.taskType) ??
    asString(rawSpec.stepType),
    assignedRole,
    contextTag,
  );

  if (!assignedRole || !nodeType) {
    return null;
  }

  if (
    assignedRole === "literature_intelligence_analyst" &&
    (nodeType === "evidence_gather" || nodeType === "retrieve")
  ) {
    if (isSynthesisLikeLiteratureTask(taskText)) {
      nodeType = "summarize";
    } else if (contextTag !== "planning") {
      contextTag = "planning";
    }
  }

  const label =
    asString(rawSpec.label) ??
    asString(rawSpec.title) ??
    asString(rawSpec.name) ??
    asString(rawSpec.objective) ??
    asString(rawSpec.task) ??
    `${nodeType.replace(/_/g, " ")} task`;

  return alignNodeCreationSpecWithTemplate({
    nodeType,
    label,
    assignedRole,
    input: asRecord(rawSpec.input),
    dependsOn: asStringArray(rawSpec.dependsOn),
    parentId: asString(rawSpec.parentId),
    branchKey: asString(rawSpec.branchKey),
    contextTag,
  });
}

export function normalizeNodeCreationSpecs(
  rawSpecs: unknown[],
  defaultContextTag: ContextTag,
): {
  validSpecs: NodeCreationSpec[];
  droppedSpecs: unknown[];
} {
  const validSpecs: NodeCreationSpec[] = [];
  const droppedSpecs: unknown[] = [];

  for (const rawSpec of rawSpecs) {
    const normalized = normalizeNodeCreationSpec(rawSpec, defaultContextTag);
    if (normalized) {
      validSpecs.push(normalized);
    } else {
      droppedSpecs.push(rawSpec);
    }
  }

  return { validSpecs, droppedSpecs };
}
