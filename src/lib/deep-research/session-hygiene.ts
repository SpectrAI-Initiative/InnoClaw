import * as store from "./event-store";
import type {
  DeepResearchArtifact,
  DeepResearchNode,
  PersistedExecutionRecord,
} from "./types";

const ACTIVE_NODE_STATUSES = new Set<DeepResearchNode["status"]>(["pending", "queued"]);
const TERMINAL_NODE_STATUSES = new Set<DeepResearchNode["status"]>([
  "completed",
  "failed",
  "skipped",
  "superseded",
]);
const ACTIVE_EXECUTION_STATUSES = new Set<PersistedExecutionRecord["status"]>([
  "pending",
  "submitted",
  "running",
]);

export interface DuplicatePendingGroup {
  keeperNodeId: string;
  duplicateNodeIds: string[];
  label: string;
  nodeType: DeepResearchNode["nodeType"];
}

export interface SuspiciousEvidenceYear {
  artifactId: string;
  nodeId: string | null;
  sourceTitle: string;
  year: number;
  reason: string;
}

export interface SessionHygieneSummary {
  duplicatePendingGroups: DuplicatePendingGroup[];
  supersededDuplicateNodeIds: string[];
  cancelledExecutionRecordIds: string[];
  failedNodeIdsNeedingAttention: string[];
  suspiciousEvidenceYears: SuspiciousEvidenceYear[];
}

export interface FailedNodeCleanupResult {
  cleanedFailedNodeIds: string[];
  cleanedBlockedNodeIds: string[];
  cancelledExecutionRecordIds: string[];
}

export function findDuplicatePendingGroups(nodes: DeepResearchNode[]): DuplicatePendingGroup[] {
  const grouped = new Map<string, DeepResearchNode[]>();

  for (const node of nodes) {
    if (!ACTIVE_NODE_STATUSES.has(node.status)) continue;

    const key = [
      node.nodeType,
      node.assignedRole,
      node.contextTag,
      normalizeText(node.label),
      node.parentId ?? "",
      node.branchKey ?? "",
      stableStringify(node.input ?? null),
      stableStringify([...node.dependsOn].sort()),
    ].join("::");

    const bucket = grouped.get(key) ?? [];
    bucket.push(node);
    grouped.set(key, bucket);
  }

  const duplicates: DuplicatePendingGroup[] = [];
  for (const bucket of grouped.values()) {
    if (bucket.length < 2) continue;

    const ordered = [...bucket].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    duplicates.push({
      keeperNodeId: ordered[0].id,
      duplicateNodeIds: ordered.slice(1).map((node) => node.id),
      label: ordered[0].label,
      nodeType: ordered[0].nodeType,
    });
  }

  return duplicates;
}

export function detectSuspiciousEvidenceYears(
  artifacts: DeepResearchArtifact[],
  currentYear = new Date().getUTCFullYear(),
): SuspiciousEvidenceYear[] {
  const findings: SuspiciousEvidenceYear[] = [];

  for (const artifact of artifacts) {
    if (artifact.artifactType !== "evidence_card") continue;
    const sources = Array.isArray(artifact.content.sources)
      ? artifact.content.sources as Array<Record<string, unknown>>
      : [];

    for (const source of sources) {
      const year = typeof source.year === "number" ? source.year : null;
      if (year === null) continue;

      const venue = typeof source.venue === "string" ? source.venue.trim() : "";
      const doi = typeof source.doi === "string" ? source.doi.trim() : "";
      const title = typeof source.title === "string" ? source.title : "Untitled source";

      let reason: string | null = null;
      if (year > currentYear) {
        reason = `source year ${year} is later than the current year ${currentYear}`;
      } else if (year === currentYear && (!venue || !doi)) {
        reason = `current-year source ${year} is missing venue or DOI metadata`;
      }

      if (reason) {
        findings.push({
          artifactId: artifact.id,
          nodeId: artifact.nodeId,
          sourceTitle: title,
          year,
          reason,
        });
      }
    }
  }

  return findings;
}

export function buildSessionHygienePromptBlock(summary: SessionHygieneSummary): string | null {
  const lines: string[] = [];

  if (summary.failedNodeIdsNeedingAttention.length > 0) {
    lines.push(
      `- Failed worker nodes still needing cleanup/retry: ${summary.failedNodeIdsNeedingAttention.join(", ")}`
    );
  }
  if (summary.supersededDuplicateNodeIds.length > 0) {
    lines.push(
      `- Duplicate pending nodes already superseded: ${summary.supersededDuplicateNodeIds.join(", ")}`
    );
  }
  if (summary.cancelledExecutionRecordIds.length > 0) {
    lines.push(
      `- Lingering execution records cancelled during cleanup: ${summary.cancelledExecutionRecordIds.join(", ")}`
    );
  }
  if (summary.suspiciousEvidenceYears.length > 0) {
    const preview = summary.suspiciousEvidenceYears
      .slice(0, 6)
      .map((item) => `${item.sourceTitle} (${item.year}; ${item.reason})`)
      .join("; ");
    lines.push(`- Evidence metadata requiring year verification: ${preview}`);
  }

  if (lines.length === 0) {
    return null;
  }

  return [
    "## Session Hygiene / Recovery Signals",
    ...lines,
    "IMPORTANT:",
    "- Clean or supersede redundant pending tasks before dispatching new work.",
    "- If failed worker processes exist, prefer cleanup or narrowly scoped retry before starting new retrieval branches.",
    "- Treat suspicious source years as unverified metadata until corroborated by venue/DOI or source content.",
    "- If the current evidence is already sufficient after cleanup, it is acceptable to produce an interim review/report instead of forcing another broad retry.",
  ].join("\n");
}

export async function reconcileSessionState(sessionId: string): Promise<SessionHygieneSummary> {
  const nodes = await store.getNodes(sessionId);
  const artifacts = await store.getArtifacts(sessionId);
  const executionRecords = await store.getExecutionRecords(sessionId);

  const duplicateGroups = findDuplicatePendingGroups(nodes);
  const supersededDuplicateNodeIds: string[] = [];
  const now = new Date().toISOString();

  for (const group of duplicateGroups) {
    for (const nodeId of group.duplicateNodeIds) {
      await store.updateNode(nodeId, {
        status: "superseded",
        supersededById: group.keeperNodeId,
        completedAt: now,
      });
      supersededDuplicateNodeIds.push(nodeId);
    }
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const cancelledExecutionRecordIds: string[] = [];
  for (const record of executionRecords) {
    if (!ACTIVE_EXECUTION_STATUSES.has(record.status)) continue;
    const node = nodeById.get(record.nodeId);
    if (!node || !TERMINAL_NODE_STATUSES.has(node.status)) continue;
    if (node.status === "completed") continue;

    await store.updateExecutionRecord(record.id, {
      status: "cancelled",
      completedAt: now,
      resultJson: {
        cleanupReason: `Cancelled during session hygiene because node ${node.id} is ${node.status}.`,
      },
    });
    cancelledExecutionRecordIds.push(record.id);
  }

  if (
    supersededDuplicateNodeIds.length > 0 ||
    cancelledExecutionRecordIds.length > 0
  ) {
    await store.appendEvent(sessionId, "consistency_check", undefined, "system", undefined, undefined, {
      sessionHygiene: true,
      supersededDuplicateNodeIds,
      cancelledExecutionRecordIds,
    });
  }

  return {
    duplicatePendingGroups: duplicateGroups,
    supersededDuplicateNodeIds,
    cancelledExecutionRecordIds,
    failedNodeIdsNeedingAttention: nodes
      .filter((node) => node.status === "failed" && node.nodeType === "evidence_extract")
      .map((node) => node.id),
    suspiciousEvidenceYears: detectSuspiciousEvidenceYears(artifacts),
  };
}

export async function cleanupFailedNodesFromFeedback(
  sessionId: string,
  feedback?: string,
): Promise<FailedNodeCleanupResult> {
  const normalizedFeedback = (feedback ?? "").trim();
  if (!looksLikeFailedTaskCleanupRequest(normalizedFeedback)) {
    return {
      cleanedFailedNodeIds: [],
      cleanedBlockedNodeIds: [],
      cancelledExecutionRecordIds: [],
    };
  }

  const nodes = await store.getNodes(sessionId);
  const executionRecords = await store.getExecutionRecords(sessionId);
  const mentionedIds = extractMentionedNodeIds(normalizedFeedback);
  const targetFailedNodeIds = resolveFailedNodeCleanupTargets(nodes, mentionedIds, normalizedFeedback);

  if (targetFailedNodeIds.length === 0) {
    return {
      cleanedFailedNodeIds: [],
      cleanedBlockedNodeIds: [],
      cancelledExecutionRecordIds: [],
    };
  }

  const blockedNodeIds = resolveBlockedDescendantNodeIds(nodes, new Set(targetFailedNodeIds));
  const now = new Date().toISOString();

  for (const nodeId of [...targetFailedNodeIds, ...blockedNodeIds]) {
    await store.updateNode(nodeId, {
      status: "superseded",
      completedAt: now,
    });
  }

  const cancelledExecutionRecordIds: string[] = [];
  for (const record of executionRecords) {
    if (!ACTIVE_EXECUTION_STATUSES.has(record.status)) continue;
    if (!targetFailedNodeIds.includes(record.nodeId)) continue;

    await store.updateExecutionRecord(record.id, {
      status: "cancelled",
      completedAt: now,
      resultJson: {
        cleanupReason: `Cancelled during failed-task cleanup for node ${record.nodeId}.`,
      },
    });
    cancelledExecutionRecordIds.push(record.id);
  }

  await store.appendEvent(sessionId, "nodes_superseded", undefined, "system", undefined, undefined, {
    reason: "Failed-task cleanup requested by user feedback",
    cleanedFailedNodeIds: targetFailedNodeIds,
    cleanedBlockedNodeIds: blockedNodeIds,
    cancelledExecutionRecordIds,
  });

  return {
    cleanedFailedNodeIds: targetFailedNodeIds,
    cleanedBlockedNodeIds: blockedNodeIds,
    cancelledExecutionRecordIds,
  };
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function looksLikeFailedTaskCleanupRequest(feedback: string): boolean {
  if (!feedback) return false;
  const hasCleanupIntent = /清理|cleanup|remove|archive|cancel|close|归档|移除|清除/.test(feedback.toLowerCase());
  const hasFailureIntent = /失败|failed|error|异常|进程|任务/.test(feedback.toLowerCase());
  return hasCleanupIntent && hasFailureIntent;
}

function extractMentionedNodeIds(feedback: string): string[] {
  return [...new Set(feedback.match(/\b[A-Za-z0-9]{8}\b/g) ?? [])];
}

export function resolveFailedNodeCleanupTargets(
  nodes: DeepResearchNode[],
  mentionedIds: string[],
  feedback = "",
): string[] {
  const mentionedIdSet = new Set(mentionedIds);
  const lowerFeedback = feedback.toLowerCase();
  const allFailedRequested = /所有|全部|\ball\b/.test(lowerFeedback);

  return nodes
    .filter((node) => node.status === "failed")
    .filter((node) => isCleanupEligibleFailedNode(node))
    .filter((node) => allFailedRequested || mentionedIdSet.has(node.id))
    .map((node) => node.id);
}

export function resolveBlockedDescendantNodeIds(
  nodes: DeepResearchNode[],
  cleanedNodeIds: Set<string>,
): string[] {
  const blocked = new Set<string>();
  let changed = true;

  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (!ACTIVE_NODE_STATUSES.has(node.status)) continue;
      if (blocked.has(node.id)) continue;
      if (!node.dependsOn.some((depId) => cleanedNodeIds.has(depId) || blocked.has(depId))) {
        continue;
      }
      blocked.add(node.id);
      changed = true;
    }
  }

  return [...blocked];
}

function isCleanupEligibleFailedNode(node: DeepResearchNode): boolean {
  return !["audit", "plan", "final_report", "approve", "intake"].includes(node.nodeType);
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortValue(nested)])
    );
  }

  return value;
}
