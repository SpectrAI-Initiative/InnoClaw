import type { DeepResearchArtifact, DeepResearchNode } from "./types";

export function canGenerateFinalReport(nodes: DeepResearchNode[]): { allowed: boolean; reason?: string } {
  const activePending = nodes.filter((node) =>
    node.status !== "superseded" &&
    node.status !== "skipped" &&
    node.status !== "completed" &&
    node.status !== "failed" &&
    node.nodeType !== "final_report"
  );

  if (activePending.length > 0) {
    const labels = activePending.slice(0, 5).map((node) => `"${node.label}" (${node.status})`).join(", ");
    return {
      allowed: false,
      reason: `Cannot generate final report: ${activePending.length} required node(s) still pending/running: ${labels}`,
    };
  }

  return { allowed: true };
}

export function canCompleteSession(nodes: DeepResearchNode[]): { allowed: boolean; reason?: string } {
  const activeNodes = nodes.filter((node) =>
    node.status !== "superseded" &&
    node.status !== "skipped" &&
    node.status !== "completed" &&
    node.status !== "failed"
  );

  if (activeNodes.length > 0) {
    const labels = activeNodes.slice(0, 5).map((node) => `"${node.label}" (${node.status})`).join(", ");
    return {
      allowed: false,
      reason: `Cannot complete session: ${activeNodes.length} node(s) still active: ${labels}`,
    };
  }

  return { allowed: true };
}

export function checkEvidenceSufficiency(
  nodes: DeepResearchNode[],
  artifacts: DeepResearchArtifact[],
): {
  canSynthesize: boolean;
  emptyStreams: string[];
  totalSources: number;
} {
  const evidenceNodes = nodes.filter((node) =>
    node.nodeType === "evidence_gather" &&
    (node.status === "completed" || node.status === "failed")
  );

  let totalSources = 0;
  const emptyStreams: string[] = [];

  for (const node of evidenceNodes) {
    const nodeArtifacts = artifacts.filter(
      (artifact) => artifact.nodeId === node.id && artifact.artifactType === "evidence_card",
    );
    if (nodeArtifacts.length === 0) {
      emptyStreams.push(node.label);
      continue;
    }

    const content = nodeArtifacts[0].content;
    const sources = (content.sources as unknown[]) ?? (content.claims as unknown[]) ?? [];
    const totalFound = (content.totalFound as number) ?? (content.papersFound as number) ?? sources.length;
    if (totalFound === 0 && sources.length === 0) {
      emptyStreams.push(node.label);
      continue;
    }

    totalSources += Math.max(totalFound, sources.length);
  }

  return {
    canSynthesize: totalSources > 0,
    emptyStreams,
    totalSources,
  };
}
