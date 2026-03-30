import type { ContextTag, ModelRole, NodeCreationSpec, NodeType } from "./types";

interface WorkerNodeTemplate {
  role: Exclude<ModelRole, "main_brain" | "researcher" | "worker" | "synthesizer">;
  nodeType: NodeType;
  defaultContextTag: ContextTag;
  purpose: string;
  inputShape: Record<string, unknown>;
}

export interface NodeDispatchPreview {
  label: string;
  assignedRole: ModelRole;
  nodeType: NodeType;
  contextTag?: ContextTag;
  templatePurpose: string;
  workerPayload: Record<string, unknown>;
  requiredInputKeys: string[];
  deliverables: string[];
  completionCriteria: string[];
}

const COMMON_INPUT_SHAPE = {
  objective: "clear task objective",
  deliverables: ["expected artifact or deliverable"],
  completionCriteria: ["what counts as done"],
  targetArtifactIds: ["artifact ids or upstream references when relevant"],
};

const WORKER_NODE_TEMPLATES: WorkerNodeTemplate[] = [
  {
    role: "literature_intelligence_analyst",
    nodeType: "evidence_gather",
    defaultContextTag: "planning",
    purpose: "Retrieve targeted scientific evidence for a confirmed research question.",
    inputShape: {
      ...COMMON_INPUT_SHAPE,
      query: "specific literature search question",
      focusAreas: ["subtopics or comparison axes"],
      maxSources: 8,
      inclusionCriteria: ["what evidence should be included"],
      comparisonAxes: ["how returned papers should be compared"],
    },
  },
  {
    role: "experiment_architecture_designer",
    nodeType: "validation_plan",
    defaultContextTag: "planning",
    purpose: "Translate the approved objective into an experiment blueprint.",
    inputShape: {
      ...COMMON_INPUT_SHAPE,
      hypotheses: ["hypotheses or design claims to test"],
      baselineTargets: ["required baselines or controls"],
      constraints: ["compute, data, or methodological constraints"],
      evaluationRequirements: ["metrics, splits, controls, ablations"],
      requiredEvidenceArtifactIds: ["supporting literature or prior artifacts"],
    },
  },
  {
    role: "research_software_engineer",
    nodeType: "execute",
    defaultContextTag: "planning",
    purpose: "Implement the approved blueprint into runnable research code.",
    inputShape: {
      ...COMMON_INPUT_SHAPE,
      implementationScope: ["modules, scripts, or interfaces to build"],
      blueprintArtifactIds: ["validation plan or design artifact ids"],
      testRequirements: ["smoke tests, sanity checks, validation checks"],
      constraints: ["non-goals, compatibility, or scope limits"],
    },
  },
  {
    role: "experiment_operations_engineer",
    nodeType: "execute",
    defaultContextTag: "planning",
    purpose: "Execute or monitor approved runs under explicit resource controls.",
    inputShape: {
      ...COMMON_INPUT_SHAPE,
      runPlan: ["ordered execution or monitoring steps"],
      resourceRequests: ["gpu/cpu/memory/runtime requirements"],
      expectedOutputs: ["paths, metrics, or files expected from the run"],
      commandHints: ["launcher or command hints when known"],
    },
  },
  {
    role: "results_and_evidence_analyst",
    nodeType: "review",
    defaultContextTag: "planning",
    purpose: "Assess whether evidence and results support the active claims.",
    inputShape: {
      ...COMMON_INPUT_SHAPE,
      reviewQuestions: ["questions the analysis must answer"],
      comparisonFocus: ["metrics, baselines, contradictions, or error slices"],
      targetArtifactIds: ["evidence cards, run outputs, summaries, or reports"],
    },
  },
  {
    role: "research_asset_reuse_specialist",
    nodeType: "final_report",
    defaultContextTag: "final_report",
    purpose: "Package validated findings into final deliverables and reusable assets.",
    inputShape: {
      ...COMMON_INPUT_SHAPE,
      targetAudience: "who the deliverable is for",
      deliverableSections: ["required report or documentation sections"],
      sourceArtifactIds: ["claims, evidence, analysis, or code artifacts to cite"],
      packagingRequirements: ["formatting, provenance, or reuse expectations"],
    },
  },
];

export function buildNodeSpecTemplatePromptBlock(
  contextTag: ContextTag,
  query: string,
): string | null {
  const selectedTemplates = selectWorkerTemplates(contextTag, query);
  if (selectedTemplates.length === 0) {
    return null;
  }

  const lines: string[] = [];
  lines.push("### Worker NodeCreationSpec Templates");
  lines.push("- When creating a worker task, follow the closest template below and keep the `input` payload structured.");
  lines.push("- Reuse these field names instead of inventing new top-level keys when possible.");

  for (const template of selectedTemplates) {
    lines.push(`#### ${template.role}`);
    lines.push(`- nodeType: ${template.nodeType}`);
    lines.push(`- defaultContextTag: ${template.defaultContextTag}`);
    lines.push(`- purpose: ${template.purpose}`);
    lines.push("```json");
    lines.push(JSON.stringify({
      nodeType: template.nodeType,
      assignedRole: template.role,
      label: `specific ${template.role.replace(/_/g, " ")} task`,
      contextTag: template.defaultContextTag,
      input: template.inputShape,
    }, null, 2));
    lines.push("```");
  }

  return lines.join("\n");
}

export function alignNodeCreationSpecWithTemplate(spec: NodeCreationSpec): NodeCreationSpec {
  const template = getTemplateForRole(spec.assignedRole);
  if (!template) {
    return spec;
  }

  const input = isRecord(spec.input) ? { ...spec.input } : {};
  applyCommonAliases(input, spec.label);

  switch (template.role) {
    case "literature_intelligence_analyst":
      input.query = firstDefinedString(input.query, input.researchQuestion, input.topic, input.objective, spec.label);
      input.maxSources = firstDefinedNumber(input.maxSources, input.maxPapers) ?? 8;
      input.focusAreas = firstDefinedStringArray(input.focusAreas, input.topics, input.comparisonAxes) ?? [];
      input.inclusionCriteria = firstDefinedStringArray(input.inclusionCriteria) ?? [];
      input.comparisonAxes = firstDefinedStringArray(input.comparisonAxes) ?? [];
      break;
    case "experiment_architecture_designer":
      input.hypotheses = firstDefinedStringArray(input.hypotheses, input.researchQuestions) ?? [];
      input.baselineTargets = firstDefinedStringArray(input.baselineTargets, input.baselines) ?? [];
      input.constraints = firstDefinedStringArray(input.constraints, input.requirements) ?? [];
      input.evaluationRequirements = firstDefinedStringArray(input.evaluationRequirements, input.metrics, input.comparisonFocus) ?? [];
      input.requiredEvidenceArtifactIds = firstDefinedStringArray(
        input.requiredEvidenceArtifactIds,
        input.targetArtifactIds,
        input.sourceArtifactIds,
        input.artifactIds,
      ) ?? [];
      break;
    case "research_software_engineer":
      input.implementationScope = firstDefinedStringArray(input.implementationScope, input.tasks, input.workItems) ?? [];
      input.blueprintArtifactIds = firstDefinedStringArray(
        input.blueprintArtifactIds,
        input.targetArtifactIds,
        input.sourceArtifactIds,
        input.artifactIds,
      ) ?? [];
      input.testRequirements = firstDefinedStringArray(input.testRequirements, input.qualityChecks, input.validationChecks) ?? [];
      input.constraints = firstDefinedStringArray(input.constraints, input.nonGoals, input.requirements) ?? [];
      break;
    case "experiment_operations_engineer":
      input.runPlan = firstDefinedStringArray(input.runPlan, input.steps, input.commands) ?? [];
      input.resourceRequests = firstDefinedStringArray(input.resourceRequests) ?? [];
      input.expectedOutputs = firstDefinedStringArray(input.expectedOutputs, input.deliverables) ?? [];
      input.commandHints = firstDefinedStringArray(input.commandHints, input.launcherHints) ?? [];
      break;
    case "results_and_evidence_analyst":
      input.reviewQuestions = firstDefinedStringArray(input.reviewQuestions, input.questions, input.openQuestions) ?? [];
      input.comparisonFocus = firstDefinedStringArray(input.comparisonFocus, input.metrics, input.evaluationRequirements) ?? [];
      input.targetArtifactIds = firstDefinedStringArray(
        input.targetArtifactIds,
        input.sourceArtifactIds,
        input.artifactIds,
      ) ?? [];
      break;
    case "research_asset_reuse_specialist":
      input.targetAudience = firstDefinedString(input.targetAudience, input.audience) ?? "research stakeholders";
      input.deliverableSections = firstDefinedStringArray(input.deliverableSections, input.sections, input.requiredSections) ?? [];
      input.sourceArtifactIds = firstDefinedStringArray(
        input.sourceArtifactIds,
        input.targetArtifactIds,
        input.artifactIds,
      ) ?? [];
      input.packagingRequirements = firstDefinedStringArray(input.packagingRequirements, input.reuseRequirements) ?? [];
      break;
  }

  return {
    ...spec,
    input,
    contextTag: spec.contextTag ?? template.defaultContextTag,
  };
}

export function buildNodeCreationSpecDispatchPreview(spec: NodeCreationSpec): NodeDispatchPreview {
  const aligned = alignNodeCreationSpecWithTemplate(spec);
  const template = getTemplateForRole(aligned.assignedRole);
  const input = isRecord(aligned.input) ? aligned.input : {};

  return {
    label: aligned.label,
    assignedRole: aligned.assignedRole,
    nodeType: aligned.nodeType,
    contextTag: aligned.contextTag,
    templatePurpose: template?.purpose ?? "Structured worker task",
    workerPayload: input,
    requiredInputKeys: Object.keys(template?.inputShape ?? {}),
    deliverables: firstDefinedStringArray(input.deliverables, input.expectedOutputs) ?? [],
    completionCriteria: firstDefinedStringArray(input.completionCriteria) ?? [],
  };
}

export function buildNodeCreationSpecDispatchPreviews(specs: NodeCreationSpec[]): NodeDispatchPreview[] {
  return specs.map((spec) => buildNodeCreationSpecDispatchPreview(spec));
}

function selectWorkerTemplates(contextTag: ContextTag, query: string): WorkerNodeTemplate[] {
  const queryText = query.toLowerCase();
  const scored = WORKER_NODE_TEMPLATES.map((template) => {
    let score = 0;
    if (contextTag === "planning" || contextTag === "intake") {
      score += 10;
    }
    if (contextTag === "final_report" && template.role === "research_asset_reuse_specialist") {
      score += 50;
    }
    if (queryText.includes("literature") || queryText.includes("evidence") || queryText.includes("paper")) {
      if (template.role === "literature_intelligence_analyst") score += 40;
      if (template.role === "results_and_evidence_analyst") score += 15;
    }
    if (queryText.includes("design") || queryText.includes("validation") || queryText.includes("experiment")) {
      if (template.role === "experiment_architecture_designer") score += 40;
    }
    if (queryText.includes("implement") || queryText.includes("code") || queryText.includes("engineer")) {
      if (template.role === "research_software_engineer") score += 40;
    }
    if (queryText.includes("run") || queryText.includes("execute") || queryText.includes("monitor")) {
      if (template.role === "experiment_operations_engineer") score += 40;
    }
    if (queryText.includes("analysis") || queryText.includes("review") || queryText.includes("result")) {
      if (template.role === "results_and_evidence_analyst") score += 40;
    }
    if (queryText.includes("report") || queryText.includes("reuse") || queryText.includes("deliverable")) {
      if (template.role === "research_asset_reuse_specialist") score += 40;
    }
    return { template, score };
  });

  const ranked = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.template.role.localeCompare(b.template.role));

  return (ranked.length > 0 ? ranked : scored)
    .slice(0, contextTag === "planning" || contextTag === "intake" ? 4 : 2)
    .map((item) => item.template);
}

function getTemplateForRole(role: ModelRole): WorkerNodeTemplate | null {
  return WORKER_NODE_TEMPLATES.find((template) => template.role === role) ?? null;
}

function applyCommonAliases(input: Record<string, unknown>, label: string): void {
  input.objective = firstDefinedString(input.objective, input.task, input.description, label) ?? label;
  input.deliverables = firstDefinedStringArray(input.deliverables, input.outputs, input.expectedOutputs) ?? [];
  input.completionCriteria = firstDefinedStringArray(
    input.completionCriteria,
    input.qualityChecks,
    input.successCriteria,
    input.acceptanceCriteria,
  ) ?? [];
  input.targetArtifactIds = firstDefinedStringArray(
    input.targetArtifactIds,
    input.artifactIds,
    input.sourceArtifactIds,
    input.requiredArtifactIds,
  ) ?? [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstDefinedString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function firstDefinedNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function firstDefinedStringArray(...values: unknown[]): string[] | undefined {
  for (const value of values) {
    if (Array.isArray(value)) {
      const normalized = value
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim());
      if (normalized.length > 0) {
        return normalized;
      }
    }
  }
  return undefined;
}
