// =============================================================
// Deep Research — Post-Step Consistency Checker
// =============================================================
// Enforces runtime invariants after each context transition.

import type {
  DeepResearchSession,
  DeepResearchNode,
  DeepResearchArtifact,
  ConsistencyReport,
} from "./types";

/**
 * Check state machine integrity after each context transition.
 * Returns warnings (logged) and errors (halt-worthy).
 */
export function checkConsistency(
  session: DeepResearchSession,
  nodes: DeepResearchNode[],
  artifacts: DeepResearchArtifact[]
): ConsistencyReport {
  const warnings: string[] = [];
  const errors: string[] = [];

  // 1. No running nodes if session is paused/awaiting
  const pausedStatuses = new Set(["paused", "awaiting_user_confirmation", "awaiting_approval", "awaiting_resource"]);
  if (pausedStatuses.has(session.status)) {
    const runningNodes = nodes.filter((n) => n.status === "running");
    if (runningNodes.length > 0) {
      errors.push(
        `Session is ${session.status} but ${runningNodes.length} node(s) are still running: ${runningNodes.map((n) => n.id).join(", ")}`
      );
    }
  }

  // 2. All completed nodes should have at least one output artifact
  const noArtifactTypes = new Set(["plan", "audit"]);
  for (const node of nodes) {
    if (node.status !== "completed") continue;
    if (noArtifactTypes.has(node.nodeType)) continue;

    const nodeArtifacts = artifacts.filter((a) => a.nodeId === node.id);
    if (nodeArtifacts.length === 0 && !node.output) {
      warnings.push(
        `Completed node "${node.label}" (${node.id}) has no artifacts and no output`
      );
    }
  }

  // 3. Budget usage <= limits
  if (session.budget.totalTokens > session.config.budget.maxTotalTokens) {
    warnings.push(
      `Total token usage (${session.budget.totalTokens}) exceeds budget limit (${session.config.budget.maxTotalTokens})`
    );
  }
  if (session.budget.opusTokens > session.config.budget.maxOpusTokens) {
    warnings.push(
      `Opus token usage (${session.budget.opusTokens}) exceeds budget limit (${session.config.budget.maxOpusTokens})`
    );
  }

  // 4. Literature round counter consistency
  if (session.literatureRound > session.config.literature.maxLiteratureRounds + 1) {
    warnings.push(
      `Literature round counter (${session.literatureRound}) exceeds max (${session.config.literature.maxLiteratureRounds})`
    );
  }

  // 5. Reviewer round counter consistency
  if (session.reviewerRound > session.config.maxReviewerRounds + 1) {
    warnings.push(
      `Reviewer round counter (${session.reviewerRound}) exceeds max (${session.config.maxReviewerRounds})`
    );
  }

  // 6. Execution loop counter consistency
  if (session.executionLoop > session.config.maxExecutionLoops + 1) {
    warnings.push(
      `Execution loop counter (${session.executionLoop}) exceeds max (${session.config.maxExecutionLoops})`
    );
  }

  // 7. INVARIANT B: Session context should be consistent with node statuses
  if (session.status === "completed") {
    const pendingNodes = nodes.filter((n) =>
      !["completed", "failed", "skipped", "superseded"].includes(n.status)
    );
    if (pendingNodes.length > 0) {
      errors.push(
        `CRITICAL: Session is completed but ${pendingNodes.length} node(s) are not in terminal state: ${pendingNodes.map(n => `"${n.label}" (${n.status})`).join(", ")}`
      );
    }
  }

  // 8. INVARIANT A: No final_report while active required nodes remain pending
  const finalReportNodes = nodes.filter(n => n.nodeType === "final_report");
  const hasFinalReport = finalReportNodes.some(n => n.status === "completed" || n.status === "running");
  if (hasFinalReport) {
    const activeRequiredPending = nodes.filter(n =>
      n.nodeType !== "final_report" &&
      n.status !== "superseded" &&
      n.status !== "skipped" &&
      n.status !== "completed" &&
      n.status !== "failed"
    );
    if (activeRequiredPending.length > 0) {
      warnings.push(
        `Final report is active but ${activeRequiredPending.length} non-terminal node(s) are still pending: ${activeRequiredPending.map(n => `"${n.label}" (${n.status}, context=${n.contextTag})`).join(", ")}`
      );
    }
  }

  // 9. INVARIANT D: No synthesis claims from empty evidence
  const synthNodes = nodes.filter(n => n.nodeType === "synthesize" && n.status === "completed");
  for (const synthNode of synthNodes) {
    const evidenceNodes = nodes.filter(n =>
      n.nodeType === "evidence_gather" &&
      (n.status === "completed" || n.status === "failed")
    );
    const evidenceArtifacts = artifacts.filter(a =>
      a.artifactType === "evidence_card" &&
      evidenceNodes.some(en => en.id === a.nodeId)
    );
    const hasAnyEvidence = evidenceArtifacts.some(a => {
      const content = a.content;
      const sources = (content.sources as unknown[]) ?? (content.claims as unknown[]) ?? [];
      const totalFound = (content.totalFound as number) ?? sources.length;
      return totalFound > 0 || sources.length > 0;
    });
    if (!hasAnyEvidence && evidenceNodes.length > 0) {
      warnings.push(
        `Synthesis node "${synthNode.label}" completed but ALL evidence streams returned empty — findings may be fabricated`
      );
    }
  }

  // 10. Check for nodes stuck in running state
  const now = Date.now();
  for (const node of nodes) {
    if (node.status === "running" && node.startedAt) {
      const runTime = now - new Date(node.startedAt).getTime();
      const tenMinutes = 10 * 60 * 1000;
      if (runTime > tenMinutes) {
        warnings.push(
          `Node "${node.label}" (${node.id}) has been running for ${Math.round(runTime / 60000)} minutes`
        );
      }
    }
  }

  // 11. INVARIANT C: Check for auto-confirm events (should never exist)
  // This is checked at the event level — if any confirmation event lacks explicitUserAction, flag it

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}
