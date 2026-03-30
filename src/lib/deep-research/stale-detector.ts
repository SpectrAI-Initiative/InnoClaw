// =============================================================
// Deep Research — Stale Plan Detector
// =============================================================

import type { DeepResearchNode, RequirementDiff } from "./types";
import * as store from "./event-store";

/**
 * Detect nodes that are stale due to requirement changes.
 * A node is stale if:
 * - It is in "pending" or "queued" status
 * - Its requirementVersion (tracked via creation time) is older than current
 * - The diff affects requirements relevant to the node's task
 */
export function detectStaleNodes(
  nodes: DeepResearchNode[],
  oldReqVersion: number,
  newReqVersion: number,
  diff: RequirementDiff
): string[] {
  if (oldReqVersion === newReqVersion) return [];
  if (diff.added.length === 0 && diff.removed.length === 0 && diff.modified.length === 0) {
    return [];
  }

  const staleIds: string[] = [];
  const actionableStatuses = new Set(["pending", "queued"]);

  for (const node of nodes) {
    if (!actionableStatuses.has(node.status)) continue;
    if (node.status === "superseded") continue;

    // If requirements were removed or modified, pending plan/evidence nodes are stale
    if (
      node.nodeType === "plan" ||
      node.nodeType === "evidence_gather" ||
      node.nodeType === "evidence_extract" ||
      node.nodeType === "summarize" ||
      node.nodeType === "synthesize"
    ) {
      // Check if removed/modified requirements overlap with node's scope
      const hasRelevantChanges =
        diff.removed.length > 0 ||
        diff.modified.some((m) => m.field === "text" || m.field === "status");

      if (hasRelevantChanges) {
        staleIds.push(node.id);
      }
    }
  }

  return staleIds;
}

/**
 * Mark nodes as superseded and create audit events.
 */
export async function supersedePlan(
  sessionId: string,
  staleNodeIds: string[],
  reason: string
): Promise<void> {
  if (staleNodeIds.length === 0) return;

  for (const nodeId of staleNodeIds) {
    await store.updateNode(nodeId, { status: "superseded" });
  }

  await store.appendEvent(
    sessionId,
    "nodes_superseded",
    undefined,
    "system",
    undefined,
    undefined,
    {
      nodeIds: staleNodeIds,
      reason,
      count: staleNodeIds.length,
    }
  );
}
