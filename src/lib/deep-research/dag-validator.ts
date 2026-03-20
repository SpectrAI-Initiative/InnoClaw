// =============================================================
// Deep Research — DAG Validator (Phase 7)
// =============================================================

import type { DeepResearchNode, DAGValidationResult, DAGError } from "./types";

/**
 * Validate the node DAG for structural integrity.
 * Checks: no cycles, no orphans, no dangling dependencies, no duplicate IDs.
 */
export function validateDAG(nodes: DeepResearchNode[]): DAGValidationResult {
  const errors: DAGError[] = [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Check for duplicate IDs
  const idCounts = new Map<string, number>();
  for (const node of nodes) {
    idCounts.set(node.id, (idCounts.get(node.id) ?? 0) + 1);
  }
  for (const [id, count] of idCounts) {
    if (count > 1) {
      errors.push({
        type: "duplicate",
        nodeIds: [id],
        message: `Duplicate node ID "${id}" appears ${count} times`,
      });
    }
  }

  // Check for dangling dependencies (referencing non-existent nodes)
  for (const node of nodes) {
    for (const depId of node.dependsOn) {
      if (!nodeMap.has(depId)) {
        errors.push({
          type: "dangling",
          nodeIds: [node.id, depId],
          message: `Node "${node.id}" depends on non-existent node "${depId}"`,
        });
      }
    }
  }

  // Check for cycles using topological sort (Kahn's algorithm)
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    if (!inDegree.has(node.id)) inDegree.set(node.id, 0);
    if (!adjacency.has(node.id)) adjacency.set(node.id, []);

    for (const depId of node.dependsOn) {
      if (!nodeMap.has(depId)) continue; // Skip dangling (already reported)
      if (!adjacency.has(depId)) adjacency.set(depId, []);
      adjacency.get(depId)!.push(node.id);
      inDegree.set(node.id, (inDegree.get(node.id) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const neighbor of adjacency.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  if (sorted.length < nodes.length) {
    const cycleNodes = nodes
      .filter((n) => !sorted.includes(n.id))
      .map((n) => n.id);
    errors.push({
      type: "cycle",
      nodeIds: cycleNodes,
      message: `Cycle detected involving ${cycleNodes.length} nodes: ${cycleNodes.slice(0, 5).join(", ")}${cycleNodes.length > 5 ? "..." : ""}`,
    });
  }

  // Check for orphans — nodes unreachable from roots (nodes with no dependencies)
  const roots = nodes.filter((n) => n.dependsOn.length === 0);
  if (roots.length > 0) {
    const reachable = new Set<string>();
    const visitQueue = [...roots.map((n) => n.id)];

    while (visitQueue.length > 0) {
      const current = visitQueue.shift()!;
      if (reachable.has(current)) continue;
      reachable.add(current);
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!reachable.has(neighbor)) visitQueue.push(neighbor);
      }
    }

    const orphans = nodes.filter(
      (n) => !reachable.has(n.id) && n.status !== "superseded"
    );
    if (orphans.length > 0) {
      errors.push({
        type: "orphan",
        nodeIds: orphans.map((n) => n.id),
        message: `${orphans.length} orphan node(s) unreachable from root nodes`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Attempt to auto-repair common DAG issues.
 * Returns list of repairs made.
 */
export function autoRepairDAG(
  nodes: DeepResearchNode[],
  errors: DAGError[]
): string[] {
  const repairs: string[] = [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  for (const error of errors) {
    if (error.type === "dangling") {
      // Remove dangling dependency references
      const [nodeId, danglingDepId] = error.nodeIds;
      const node = nodeMap.get(nodeId);
      if (node) {
        node.dependsOn = node.dependsOn.filter((d) => d !== danglingDepId);
        repairs.push(`Removed dangling dependency ${danglingDepId} from node ${nodeId}`);
      }
    }
  }

  return repairs;
}
