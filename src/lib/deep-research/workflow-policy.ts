import type { DeepResearchArtifact, NodeCreationSpec } from "./types";
import type { WorkstationPlanningContext } from "./workstation-context";

export type WorkflowMode = "analysis_only" | "mixed" | "execution_required";

export interface WorkflowPolicy {
  mode: WorkflowMode;
  requiresInitialPlanConfirmation: boolean;
  blockedNodeTypes: Set<NodeCreationSpec["nodeType"]>;
  reasoning: string[];
  promptBlock: string;
}

const ANALYSIS_ONLY_NODE_TYPES = new Set<NodeCreationSpec["nodeType"]>([
  "validation_plan",
  "resource_request",
  "execute",
  "monitor",
  "result_collect",
  "result_compare",
  "data_download",
  "preprocess",
]);

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce((sum, pattern) => sum + (pattern.test(text) ? 1 : 0), 0);
}

function buildIntentText(input: {
  sessionTitle: string;
  userMessages: string[];
  workstationContext?: WorkstationPlanningContext | null;
}): string {
  const workstationBits = input.workstationContext
    ? [
        input.workstationContext.searchQuery,
        ...input.workstationContext.topLevelEntries,
        ...input.workstationContext.rootFileHighlights.map((item) => item.label),
        ...input.workstationContext.indexedFileHighlights.map((item) => item.label),
        ...input.workstationContext.noteHighlights.map((item) => item.label),
      ]
    : [];

  return [input.sessionTitle, ...input.userMessages, ...workstationBits]
    .join(" ")
    .toLowerCase();
}

export function deriveWorkflowPolicy(input: {
  sessionTitle: string;
  userMessages: string[];
  workstationContext?: WorkstationPlanningContext | null;
  artifacts?: DeepResearchArtifact[];
}): WorkflowPolicy {
  const text = buildIntentText(input);
  const explicitNoExperimentPatterns = [
    /不需要实验|无需实验|不做实验|先不做实验/,
    /no experiment|without experiment|not an experiment|do not run experiments|desk research|literature only|analysis only/,
  ];
  const analysisPatterns = [
    /调研|综述|机制|原理|比较|分析|总结|梳理|现状|谱系/,
    /survey|review|mechanism|landscape|taxonomy|comparison|analy[sz]e|analysis|conceptual/,
  ];
  const executionPatterns = [
    /实验|评测|验证|复现|训练|实现|部署|跑实验|基准|消融/,
    /experiment|benchmark|evaluate|evaluation|reproduce|replicate|train|fine[-\s]?tune|implement|ablation|execute|monitor/,
  ];

  const explicitNoExperiment = countMatches(text, explicitNoExperimentPatterns) > 0;
  const analysisSignalCount = countMatches(text, analysisPatterns);
  const executionSignalCount = countMatches(text, executionPatterns);

  let mode: WorkflowMode = "mixed";
  const reasoning: string[] = [];

  if (explicitNoExperiment) {
    mode = "analysis_only";
    reasoning.push("The request explicitly says experiments are not needed.");
  } else if (analysisSignalCount > 0 && executionSignalCount === 0) {
    mode = "analysis_only";
    reasoning.push("The request reads like a literature/conceptual investigation rather than an empirical run.");
  } else if (executionSignalCount > 0) {
    mode = "execution_required";
    reasoning.push("The request includes explicit experiment, evaluation, implementation, or execution intent.");
  } else {
    reasoning.push("The request does not clearly force a pure literature-only or execution-heavy workflow.");
  }

  const requiresInitialPlanConfirmation = !(
    input.artifacts?.some((artifact) => artifact.artifactType === "checkpoint") ?? false
  );
  if (requiresInitialPlanConfirmation) {
    reasoning.push("No prior checkpoint exists, so the Researcher must first present a plan for confirmation.");
  }

  const blockedNodeTypes = mode === "analysis_only"
    ? new Set(ANALYSIS_ONLY_NODE_TYPES)
    : new Set<NodeCreationSpec["nodeType"]>();

  const promptBlock = [
    "## Workflow Policy",
    `- Workflow mode: ${mode}`,
    `- Initial plan confirmation required: ${requiresInitialPlanConfirmation ? "yes" : "no"}`,
    `- Policy reasoning: ${reasoning.join(" ")}`,
    mode === "analysis_only"
      ? `- Experimental execution is blocked unless the user later explicitly requests it. Blocked node types: ${Array.from(blockedNodeTypes).join(", ")}`
      : "- Experimental execution is allowed when justified by the confirmed plan.",
    "- For conceptual framework design, taxonomy building, architecture comparison, or literature-structuring tasks, use summarize/review/final_report style nodes rather than validation_plan.",
    "- On the first planning pass, you MUST produce a complete plan in messageToUser, explain which phases are needed, and explicitly name any phases you are skipping.",
    "- Do not treat experiment design/execution as mandatory. Choose only the phases required by the user's question and the workstation evidence.",
  ].join("\n");

  return {
    mode,
    requiresInitialPlanConfirmation,
    blockedNodeTypes,
    reasoning,
    promptBlock,
  };
}

export function filterNodeSpecsForWorkflowPolicy(
  specs: NodeCreationSpec[],
  policy: WorkflowPolicy,
): {
  allowedSpecs: NodeCreationSpec[];
  blockedSpecs: NodeCreationSpec[];
} {
  const allowedSpecs: NodeCreationSpec[] = [];
  const blockedSpecs: NodeCreationSpec[] = [];

  for (const spec of specs) {
    if (policy.blockedNodeTypes.has(spec.nodeType)) {
      blockedSpecs.push(spec);
      continue;
    }
    allowedSpecs.push(spec);
  }

  return { allowedSpecs, blockedSpecs };
}
