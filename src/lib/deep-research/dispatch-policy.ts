import * as store from "./event-store";
import { normalizeNodeCreationSpecs } from "./node-spec-normalizer";
import { filterNodeSpecsForWorkflowPolicy, type WorkflowPolicy } from "./workflow-policy";
import type { ContextTag, DeepResearchNode, NodeCreationSpec } from "./types";

export function countNodesByType(specs: NodeCreationSpec[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const spec of specs) {
    counts[spec.nodeType] = (counts[spec.nodeType] ?? 0) + 1;
  }
  return counts;
}

export async function normalizeAndLimitNodeSpecs(
  sessionId: string,
  rawSpecs: unknown[],
  defaultContextTag: ContextTag,
  workflowPolicy: WorkflowPolicy,
  source: string,
): Promise<NodeCreationSpec[]> {
  const { validSpecs, droppedSpecs } = normalizeNodeCreationSpecs(rawSpecs, defaultContextTag);
  if (droppedSpecs.length > 0) {
    await store.addMessage(
      sessionId,
      "system",
      `${droppedSpecs.length} malformed task(s) were ignored before ${source}.`,
    );
  }

  const { rewrittenSpecs, rewrites } = rewriteNodeSpecsForWorkflowPolicy(validSpecs, workflowPolicy);
  if (rewrites.length > 0) {
    await store.addMessage(
      sessionId,
      "system",
      `Rewrote ${rewrites.length} conceptual analysis task(s) during ${source} to fit the current workflow policy: ${rewrites.join(", ")}.`,
    );
  }

  const { allowedSpecs, blockedSpecs } = filterNodeSpecsForWorkflowPolicy(rewrittenSpecs, workflowPolicy);
  if (blockedSpecs.length > 0) {
    await store.addMessage(
      sessionId,
      "system",
      `Blocked ${blockedSpecs.length} task(s) during ${source} because they do not fit the current workflow policy: ${blockedSpecs.map((spec) => `${spec.label} (${spec.nodeType})`).join(", ")}.`,
    );
  }

  return enforceSingleWorkerDispatch(sessionId, allowedSpecs, source);
}

export function rewriteNodeSpecsForWorkflowPolicy(
  specs: NodeCreationSpec[],
  workflowPolicy: WorkflowPolicy,
): {
  rewrittenSpecs: NodeCreationSpec[];
  rewrites: string[];
} {
  if (workflowPolicy.mode !== "analysis_only") {
    return { rewrittenSpecs: specs, rewrites: [] };
  }

  const rewrites: string[] = [];
  const rewrittenSpecs = specs.map((spec) => {
    if (spec.nodeType !== "validation_plan" || !looksLikeConceptualFrameworkTask(spec)) {
      return spec;
    }

    rewrites.push(`${spec.label} (validation_plan -> summarize)`);
    const rewrittenSpec: NodeCreationSpec = {
      ...spec,
      nodeType: "summarize",
      assignedRole: "results_and_evidence_analyst",
    };
    return rewrittenSpec;
  });

  return {
    rewrittenSpecs,
    rewrites,
  };
}

export async function selectNextReadyNodeForWorkflow(
  sessionId: string,
  workflowPolicy: WorkflowPolicy,
): Promise<DeepResearchNode | undefined> {
  const readyNodes = (await store.getReadyNodes(sessionId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const blockedReadyNodes = readyNodes.filter((node) => workflowPolicy.blockedNodeTypes.has(node.nodeType));
  if (blockedReadyNodes.length > 0) {
    const completedAt = new Date().toISOString();
    for (const node of blockedReadyNodes) {
      await store.updateNode(node.id, {
        status: "skipped",
        completedAt,
        error: `Skipped by workflow policy (${workflowPolicy.mode}).`,
      });
    }

    await store.addMessage(
      sessionId,
      "system",
      `Skipped ${blockedReadyNodes.length} ready node(s) because the session is currently in ${workflowPolicy.mode} mode: ${blockedReadyNodes.map((node) => `${node.label} (${node.nodeType})`).join(", ")}.`,
    );
  }

  return readyNodes.find((node) => !workflowPolicy.blockedNodeTypes.has(node.nodeType));
}

export function resolveNodeDependencies(
  dependsOn: string[],
  existingNodeIds: Set<string>,
  existingNodeIdsByLabel: Map<string, string>,
  createdNodeIdsByLabel: Map<string, string>,
): string[] {
  const resolved = new Set<string>();
  const createdNodeIds = [...createdNodeIdsByLabel.values()];
  const knownNodeIds = [
    ...existingNodeIds,
    ...createdNodeIds,
  ];

  for (const dependency of dependsOn) {
    const normalizedDependency = dependency.trim();
    if (!normalizedDependency) {
      continue;
    }

    if (existingNodeIds.has(normalizedDependency)) {
      resolved.add(normalizedDependency);
      continue;
    }

    if (createdNodeIds.includes(normalizedDependency)) {
      resolved.add(normalizedDependency);
      continue;
    }

    const prefixMatches = knownNodeIds.filter((nodeId) => nodeId.startsWith(normalizedDependency));
    if (prefixMatches.length === 1) {
      resolved.add(prefixMatches[0]);
      continue;
    }

    const existingMatch = existingNodeIdsByLabel.get(normalizedDependency);
    if (existingMatch) {
      resolved.add(existingMatch);
      continue;
    }

    const createdMatch = createdNodeIdsByLabel.get(normalizedDependency);
    if (createdMatch) {
      resolved.add(createdMatch);
      continue;
    }
  }

  return [...resolved];
}

async function enforceSingleWorkerDispatch(
  sessionId: string,
  specs: NodeCreationSpec[],
  source: string,
): Promise<NodeCreationSpec[]> {
  if (specs.length <= 1) {
    return specs;
  }

  await store.addMessage(
    sessionId,
    "system",
    `${specs.length - 1} extra task(s) from ${source} were dropped. Deep Research now dispatches at most one worker task at a time.`,
  );

  return specs.slice(0, 1);
}

function looksLikeConceptualFrameworkTask(spec: NodeCreationSpec): boolean {
  const input = spec.input && typeof spec.input === "object" ? spec.input : {};
  const text = [
    spec.label,
    typeof input.objective === "string" ? input.objective : "",
    typeof input.description === "string" ? input.description : "",
    typeof input.query === "string" ? input.query : "",
    Array.isArray(input.deliverables) ? input.deliverables.join(" ") : "",
    Array.isArray(input.completionCriteria) ? input.completionCriteria.join(" ") : "",
  ]
    .join(" ")
    .toLowerCase();

  const conceptualSignals = [
    /综述|调研|梳理|框架|架构|谱系|路线|机制|比较|分类|taxonomy|survey|review|framework|landscape|architecture|comparison|mechanism/,
  ].some((pattern) => pattern.test(text));

  const experimentalSignals = [
    /实验|评测|验证|跑实验|benchmark|evaluate|evaluation|ablation|training|train|reproduce|replicate|execution/,
  ].some((pattern) => pattern.test(text));

  return conceptualSignals && !experimentalSignals;
}
