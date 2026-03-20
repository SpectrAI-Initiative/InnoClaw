// =============================================================
// Deep Research — Consolidated Project State Tracker
// =============================================================
// Provides a single-view snapshot of an entire research session:
//   - Evidence ledger (what was retrieved)
//   - Synthesis state (what was synthesized)
//   - Review state (what reviewers objected to / approved)
//   - Execution state (what was planned / run / collected)
//
// Makes the workflow fully auditable and inspectable.

import * as store from "./event-store";
import { assessEvidenceHonesty } from "./evidence-cards";
import type {
  DeepResearchSession,
  DeepResearchNode,
  DeepResearchArtifact,
  Phase,
  EvidenceCard,
  ClaimMap,
  ScientificReviewPacket,
  ReviewerBattleResult,
  BudgetUsage,
} from "./types";

// -------------------------------------------------------------------
// State interfaces
// -------------------------------------------------------------------

export interface EvidenceLedger {
  totalCards: number;
  totalSources: number;
  totalExcerpts: number;
  retrievalRounds: number;
  successRate: number;
  cardsByQuery: Record<string, { sourcesFound: number; status: string }>;
  honestyIssues: string[];
}

export interface SynthesisState {
  hasClaimMap: boolean;
  totalClaims: number;
  strongClaims: number;
  weakClaims: number;
  unsupportedClaims: number;
  contradictions: number;
  gaps: number;
  lastSynthesizedAt: string | null;
}

export interface ReviewState {
  totalRounds: number;
  currentVerdict: string | null;
  criticalBlockers: number;
  majorIssues: number;
  resolvedBlockers: number;
  unresolvedBlockers: number;
  dimensionScores: Record<string, number>;
  lastReviewedAt: string | null;
}

export interface ExecutionState {
  hasExecutionPlan: boolean;
  totalStages: number;
  completedStages: number;
  failedStages: number;
  totalGPUHoursPlanned: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  artifacts: string[];
  /** Execution round tracking. */
  currentRound: number;
  totalRounds: number;
  /** Per-round summaries. */
  roundSummaries: Array<{
    round: number;
    verdict: string;
    workersTotal: number;
    workersSucceeded: number;
    workersFailed: number;
    primaryMetrics: Record<string, number>;
  }>;
  /** Latest validation verdict. */
  latestValidationVerdict: string | null;
  /** Latest analysis recommendation. */
  latestAnalysisRecommendation: string | null;
  /** Whether any round has passed validation. */
  hasPassingRound: boolean;
  /** Consecutive failure count. */
  consecutiveFailures: number;
}

export interface ProjectState {
  sessionId: string;
  sessionTitle: string;
  currentPhase: Phase;
  status: string;
  budget: BudgetUsage;
  evidence: EvidenceLedger;
  synthesis: SynthesisState;
  review: ReviewState;
  execution: ExecutionState;
  phaseHistory: Array<{ phase: Phase; enteredAt: string }>;
  lastUpdated: string;
}

// -------------------------------------------------------------------
// Build full project state
// -------------------------------------------------------------------

/**
 * Build a complete ProjectState snapshot from the database.
 */
export async function buildProjectState(sessionId: string): Promise<ProjectState> {
  const session = await store.getSession(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  const nodes = await store.getNodes(sessionId);
  const artifacts = await store.getArtifacts(sessionId);

  return {
    sessionId: session.id,
    sessionTitle: session.title,
    currentPhase: session.phase,
    status: session.status,
    budget: session.budget,
    evidence: buildEvidenceLedger(nodes, artifacts),
    synthesis: buildSynthesisState(artifacts),
    review: buildReviewState(artifacts),
    execution: buildExecutionState(nodes, artifacts),
    phaseHistory: buildPhaseHistory(nodes),
    lastUpdated: new Date().toISOString(),
  };
}

// -------------------------------------------------------------------
// Evidence ledger
// -------------------------------------------------------------------

function buildEvidenceLedger(nodes: DeepResearchNode[], artifacts: DeepResearchArtifact[]): EvidenceLedger {
  const evidenceArtifacts = artifacts.filter(a =>
    a.artifactType === "evidence_card" || a.artifactType === "evidence_card_collection"
  );

  const cards: EvidenceCard[] = [];
  for (const art of evidenceArtifacts) {
    if (art.content.cards && Array.isArray(art.content.cards)) {
      cards.push(...(art.content.cards as EvidenceCard[]));
    } else if (art.content.query) {
      cards.push(art.content as unknown as EvidenceCard);
    }
  }

  const honestyIssues: string[] = [];
  for (const card of cards) {
    if (card.sources && card.rawExcerpts) {
      const honesty = assessEvidenceHonesty(card);
      if (!honesty.honest) {
        honestyIssues.push(...honesty.issues);
      }
    }
  }

  const totalSources = cards.reduce((s, c) => s + (c.sourcesFound ?? 0), 0);
  const totalAttempted = cards.reduce((s, c) => s + (c.sourcesAttempted ?? 1), 0);

  const cardsByQuery: Record<string, { sourcesFound: number; status: string }> = {};
  for (const card of cards) {
    cardsByQuery[card.query ?? "unknown"] = {
      sourcesFound: card.sourcesFound ?? 0,
      status: card.retrievalStatus ?? "unknown",
    };
  }

  const evidenceNodes = nodes.filter(n => n.nodeType === "evidence_gather");
  const completedRounds = new Set(evidenceNodes.map(n => n.phase)).size;

  return {
    totalCards: cards.length,
    totalSources,
    totalExcerpts: cards.reduce((s, c) => s + (c.rawExcerpts?.length ?? 0), 0),
    retrievalRounds: completedRounds,
    successRate: totalAttempted > 0 ? totalSources / totalAttempted : 0,
    cardsByQuery,
    honestyIssues,
  };
}

// -------------------------------------------------------------------
// Synthesis state
// -------------------------------------------------------------------

function buildSynthesisState(artifacts: DeepResearchArtifact[]): SynthesisState {
  const claimMapArtifacts = artifacts.filter(a => a.artifactType === "claim_map");

  if (claimMapArtifacts.length === 0) {
    return {
      hasClaimMap: false,
      totalClaims: 0,
      strongClaims: 0,
      weakClaims: 0,
      unsupportedClaims: 0,
      contradictions: 0,
      gaps: 0,
      lastSynthesizedAt: null,
    };
  }

  const latest = claimMapArtifacts[claimMapArtifacts.length - 1];
  const content = latest.content as unknown as ClaimMap;
  const claims = content.claims ?? [];

  return {
    hasClaimMap: true,
    totalClaims: claims.length,
    strongClaims: claims.filter(c => c.strength === "strong").length,
    weakClaims: claims.filter(c => c.strength === "weak").length,
    unsupportedClaims: claims.filter(c => c.strength === "unsupported").length,
    contradictions: (content.contradictions ?? []).length,
    gaps: (content.gaps ?? []).length,
    lastSynthesizedAt: latest.createdAt,
  };
}

// -------------------------------------------------------------------
// Review state
// -------------------------------------------------------------------

function buildReviewState(artifacts: DeepResearchArtifact[]): ReviewState {
  // Try scientific review first
  const scientificResults = artifacts.filter(a => a.artifactType === "scientific_review_result");
  const scientificPackets = artifacts.filter(a => a.artifactType === "scientific_review_packet");

  if (scientificResults.length > 0) {
    const latest = scientificResults[scientificResults.length - 1].content as Record<string, unknown>;
    const rounds = (latest.rounds as unknown[]) ?? [];

    // Build dimension scores from latest packets
    const dimScores: Record<string, number> = {};
    if (scientificPackets.length > 0) {
      const lastPacket = scientificPackets[scientificPackets.length - 1].content as unknown as ScientificReviewPacket;
      for (const dim of lastPacket.dimensions ?? []) {
        dimScores[dim.dimension] = dim.score;
      }
    }

    return {
      totalRounds: rounds.length,
      currentVerdict: latest.finalVerdict as string ?? null,
      criticalBlockers: (latest.actionableRepairs as unknown[])?.length ?? 0,
      majorIssues: 0,
      resolvedBlockers: 0,
      unresolvedBlockers: (latest.actionableRepairs as unknown[])?.length ?? 0,
      dimensionScores: dimScores,
      lastReviewedAt: scientificResults[scientificResults.length - 1].createdAt,
    };
  }

  // Fall back to classic battle results
  const battleResults = artifacts.filter(a => a.artifactType === "reviewer_battle_result");
  if (battleResults.length === 0) {
    return {
      totalRounds: 0,
      currentVerdict: null,
      criticalBlockers: 0,
      majorIssues: 0,
      resolvedBlockers: 0,
      unresolvedBlockers: 0,
      dimensionScores: {},
      lastReviewedAt: null,
    };
  }

  const latest = battleResults[battleResults.length - 1].content as unknown as ReviewerBattleResult;

  return {
    totalRounds: battleResults.length,
    currentVerdict: latest.combinedVerdict,
    criticalBlockers: latest.unresolvedGaps?.length ?? 0,
    majorIssues: latest.disagreements?.length ?? 0,
    resolvedBlockers: latest.agreements?.length ?? 0,
    unresolvedBlockers: latest.unresolvedGaps?.length ?? 0,
    dimensionScores: {},
    lastReviewedAt: battleResults[battleResults.length - 1].createdAt,
  };
}

// -------------------------------------------------------------------
// Execution state
// -------------------------------------------------------------------

function buildExecutionState(nodes: DeepResearchNode[], artifacts: DeepResearchArtifact[]): ExecutionState {
  const execPlanArtifacts = artifacts.filter(a => a.artifactType === "execution_plan");
  const hasExecutionPlan = execPlanArtifacts.length > 0;

  let totalStages = 0;
  let totalGPUHours = 0;
  if (hasExecutionPlan) {
    const latest = execPlanArtifacts[execPlanArtifacts.length - 1].content;
    const stages = (latest.stages as unknown[]) ?? [];
    totalStages = stages.length;
    totalGPUHours = (latest.totalEstimatedGPUHours as number) ?? 0;
  }

  const execNodes = nodes.filter(n =>
    n.nodeType === "execute" || n.nodeType === "data_download" || n.nodeType === "preprocess" ||
    n.nodeType === "monitor" || n.nodeType === "result_collect"
  );

  const completedStages = execNodes.filter(n => n.status === "completed").length;
  const failedStages = execNodes.filter(n => n.status === "failed").length;
  const activeJobs = execNodes.filter(n => n.status === "running").length;

  const resultArtifacts = artifacts.filter(a =>
    a.artifactType === "step_result" || a.artifactType === "experiment_result"
  );

  // Extract execution round info from validation_report artifacts
  const validationReports = artifacts.filter(a => a.artifactType === "validation_report");
  const roundSummaries: ExecutionState["roundSummaries"] = [];
  let latestValidationVerdict: string | null = null;
  let latestAnalysisRecommendation: string | null = null;
  let hasPassingRound = false;
  let consecutiveFailures = 0;

  for (const report of validationReports) {
    const content = report.content as Record<string, unknown>;
    const verdict = (content.verdict as string) ?? "unknown";
    if (verdict === "pass") hasPassingRound = true;

    roundSummaries.push({
      round: roundSummaries.length + 1,
      verdict,
      workersTotal: (content.totalWorkers as number) ?? 0,
      workersSucceeded: (content.succeededWorkers as number) ?? 0,
      workersFailed: (content.failedWorkers as number) ?? 0,
      primaryMetrics: (content.primaryMetrics as Record<string, number>) ?? {},
    });
  }

  if (validationReports.length > 0) {
    const lastReport = validationReports[validationReports.length - 1].content as Record<string, unknown>;
    latestValidationVerdict = (lastReport.verdict as string) ?? null;
    latestAnalysisRecommendation = (lastReport.analysisRecommendation as string) ?? null;
  }

  // Count consecutive failures from the end
  for (let i = roundSummaries.length - 1; i >= 0; i--) {
    if (roundSummaries[i].verdict === "fail") consecutiveFailures++;
    else break;
  }

  return {
    hasExecutionPlan,
    totalStages,
    completedStages,
    failedStages,
    totalGPUHoursPlanned: totalGPUHours,
    activeJobs,
    completedJobs: completedStages,
    failedJobs: failedStages,
    artifacts: resultArtifacts.map(a => a.id),
    currentRound: roundSummaries.length,
    totalRounds: roundSummaries.length,
    roundSummaries,
    latestValidationVerdict,
    latestAnalysisRecommendation,
    hasPassingRound,
    consecutiveFailures,
  };
}

// -------------------------------------------------------------------
// Phase history
// -------------------------------------------------------------------

function buildPhaseHistory(nodes: DeepResearchNode[]): Array<{ phase: Phase; enteredAt: string }> {
  const phaseEntries = new Map<Phase, string>();

  for (const node of nodes) {
    const existing = phaseEntries.get(node.phase);
    if (!existing || node.createdAt < existing) {
      phaseEntries.set(node.phase, node.createdAt);
    }
  }

  return Array.from(phaseEntries.entries())
    .map(([phase, enteredAt]) => ({ phase, enteredAt }))
    .sort((a, b) => a.enteredAt.localeCompare(b.enteredAt));
}

// -------------------------------------------------------------------
// Summary generation
// -------------------------------------------------------------------

/**
 * Generate a human-readable markdown summary of the project state.
 */
export function summarizeProjectState(state: ProjectState): string {
  const lines: string[] = [];

  lines.push(`# Project State: ${state.sessionTitle}`);
  lines.push(`**Phase:** ${state.currentPhase} | **Status:** ${state.status}`);
  lines.push(`**Budget:** ${state.budget.totalTokens} tokens used`);
  lines.push("");

  // Evidence
  lines.push("## Evidence");
  lines.push(`- Cards: ${state.evidence.totalCards} | Sources: ${state.evidence.totalSources} | Excerpts: ${state.evidence.totalExcerpts}`);
  lines.push(`- Retrieval rounds: ${state.evidence.retrievalRounds} | Success rate: ${(state.evidence.successRate * 100).toFixed(0)}%`);
  if (state.evidence.honestyIssues.length > 0) {
    lines.push(`- Honesty warnings: ${state.evidence.honestyIssues.length}`);
  }
  lines.push("");

  // Synthesis
  lines.push("## Synthesis");
  if (state.synthesis.hasClaimMap) {
    lines.push(`- Claims: ${state.synthesis.totalClaims} (${state.synthesis.strongClaims} strong, ${state.synthesis.weakClaims} weak, ${state.synthesis.unsupportedClaims} unsupported)`);
    lines.push(`- Contradictions: ${state.synthesis.contradictions} | Gaps: ${state.synthesis.gaps}`);
  } else {
    lines.push("- No claim map generated yet");
  }
  lines.push("");

  // Review
  lines.push("## Review");
  if (state.review.totalRounds > 0) {
    lines.push(`- Rounds: ${state.review.totalRounds} | Verdict: ${state.review.currentVerdict ?? "pending"}`);
    lines.push(`- Critical blockers: ${state.review.criticalBlockers} | Major issues: ${state.review.majorIssues}`);
    if (Object.keys(state.review.dimensionScores).length > 0) {
      const dimStr = Object.entries(state.review.dimensionScores)
        .map(([d, s]) => `${d}=${s}`)
        .join(", ");
      lines.push(`- Dimension scores: ${dimStr}`);
    }
  } else {
    lines.push("- No review completed yet");
  }
  lines.push("");

  // Execution
  lines.push("## Execution");
  if (state.execution.hasExecutionPlan) {
    lines.push(`- Stages: ${state.execution.completedStages}/${state.execution.totalStages} completed`);
    lines.push(`- GPU hours planned: ${state.execution.totalGPUHoursPlanned}`);
    lines.push(`- Active jobs: ${state.execution.activeJobs} | Failed: ${state.execution.failedJobs}`);
    lines.push(`- Artifacts collected: ${state.execution.artifacts.length}`);
    if (state.execution.currentRound > 0) {
      lines.push(`- Execution rounds: ${state.execution.currentRound}`);
      lines.push(`- Latest verdict: ${state.execution.latestValidationVerdict ?? "pending"}`);
      lines.push(`- Has passing round: ${state.execution.hasPassingRound}`);
      lines.push(`- Consecutive failures: ${state.execution.consecutiveFailures}`);
      if (state.execution.latestAnalysisRecommendation) {
        lines.push(`- Latest recommendation: ${state.execution.latestAnalysisRecommendation}`);
      }
    }
  } else {
    lines.push("- No execution plan yet");
  }

  return lines.join("\n");
}

// -------------------------------------------------------------------
// Phase readiness check
// -------------------------------------------------------------------

/**
 * Check if the project is ready to enter a given phase.
 */
export function getPhaseReadiness(state: ProjectState, targetPhase: Phase): { ready: boolean; blockers: string[] } {
  const blockers: string[] = [];

  switch (targetPhase) {
    case "literature_synthesis":
      if (state.evidence.totalSources === 0) {
        blockers.push("No evidence sources retrieved — cannot synthesize");
      }
      break;

    case "reviewer_deliberation":
      if (!state.synthesis.hasClaimMap) {
        blockers.push("No claim map available — reviewers need synthesis to audit");
      }
      break;

    case "validation_planning":
      if (state.review.totalRounds === 0) {
        blockers.push("No review completed — need reviewer approval before planning experiments");
      }
      break;

    case "resource_acquisition":
      if (!state.execution.hasExecutionPlan) {
        blockers.push("No execution plan — need a plan before acquiring resources");
      }
      break;

    case "experiment_execution":
      if (!state.execution.hasExecutionPlan) {
        blockers.push("No execution plan available");
      }
      break;

    case "final_report":
      if (state.evidence.totalSources === 0 && !state.synthesis.hasClaimMap) {
        blockers.push("No evidence or synthesis — final report needs content");
      }
      break;
  }

  return { ready: blockers.length === 0, blockers };
}

// -------------------------------------------------------------------
// State diff
// -------------------------------------------------------------------

/**
 * Compare two project states and return human-readable changes.
 */
export function diffProjectStates(before: ProjectState, after: ProjectState): string[] {
  const changes: string[] = [];

  if (before.currentPhase !== after.currentPhase) {
    changes.push(`Phase changed: ${before.currentPhase} → ${after.currentPhase}`);
  }
  if (before.status !== after.status) {
    changes.push(`Status changed: ${before.status} → ${after.status}`);
  }

  // Evidence changes
  const newSources = after.evidence.totalSources - before.evidence.totalSources;
  if (newSources > 0) {
    changes.push(`+${newSources} new evidence sources retrieved`);
  }

  // Synthesis changes
  if (!before.synthesis.hasClaimMap && after.synthesis.hasClaimMap) {
    changes.push(`Claim map created (${after.synthesis.totalClaims} claims)`);
  }

  // Review changes
  if (after.review.totalRounds > before.review.totalRounds) {
    changes.push(`New review round completed (verdict: ${after.review.currentVerdict})`);
  }

  // Execution changes
  if (!before.execution.hasExecutionPlan && after.execution.hasExecutionPlan) {
    changes.push(`Execution plan created (${after.execution.totalStages} stages)`);
  }
  const newCompleted = after.execution.completedStages - before.execution.completedStages;
  if (newCompleted > 0) {
    changes.push(`+${newCompleted} execution stages completed`);
  }

  // Budget
  const tokenDiff = after.budget.totalTokens - before.budget.totalTokens;
  if (tokenDiff > 0) {
    changes.push(`+${tokenDiff} tokens consumed`);
  }

  return changes;
}
