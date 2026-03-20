// =============================================================
// Deep Research — Scientific Reviewer Skill (Enhanced)
// =============================================================
// Structured, dimension-based scientific review with:
//   - 13 review dimensions scored 1-5
//   - Anti-pattern detection checklist
//   - Persistent issue tracking with IDs across rounds
//   - Acceptance-gated progression (not just max-rounds-reached)
//   - Anti-loop logic: round progression with forced decisions
//   - Support for pass / revise / experimental_pivot / reject
//   - Synthesizer-facing revision request generation

import { generateText } from "ai";
import { getModelForRole, checkBudget, trackUsage } from "./model-router";
import * as store from "./event-store";
import type {
  DeepResearchSession,
  DeepResearchArtifact,
  ArtifactProvenance,
  ScientificReviewConfig,
  ScientificReviewPacket,
  ScientificReviewResult,
  ScientificBlocker,
  RepairPath,
  DimensionScore,
  ReviewDimension,
  ScientificVerdict,
  ReviewIssue,
  ReviewIssueStatus,
  AntiPatternFlag,
  AntiPatternType,
  ReviewRevisionRequest,
  RevisionPoint,
  ValidationCriteria,
  ExperimentResources,
  ExperimentAnalysisResult,
  WorkerFanoutPlan,
  ExecutionValidationResult,
} from "./types";

// -------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------

export const ALL_DIMENSIONS: ReviewDimension[] = [
  "problem_definition",
  "literature_grounding",
  "mechanism_validity",
  "baseline_coverage",
  "falsifiability",
  "metric_design",
  "compute_feasibility",
  "data_feasibility",
  "engineering_readiness",
  "domain_mismatch_risk",
  "novelty_positioning",
  "reproducibility",
  "overclaiming_risk",
];

export const DIMENSION_LABELS: Record<ReviewDimension, string> = {
  problem_definition: "Problem Definition",
  literature_grounding: "Literature Grounding",
  mechanism_validity: "Mechanism Validity",
  baseline_coverage: "Baseline Coverage",
  falsifiability: "Falsifiability",
  metric_design: "Metric Design",
  compute_feasibility: "Compute Feasibility",
  data_feasibility: "Data Feasibility",
  engineering_readiness: "Engineering Readiness",
  domain_mismatch_risk: "Domain Mismatch Risk",
  novelty_positioning: "Novelty Positioning",
  reproducibility: "Reproducibility",
  overclaiming_risk: "Overclaiming Risk",
};

export const ALL_ANTI_PATTERNS: AntiPatternType[] = [
  "citation_hallucination",
  "benchmark_mismatch",
  "metric_cherry_picking",
  "unfounded_generalization",
  "missing_ablation",
  "dataset_contamination_risk",
  "p_hacking_risk",
  "survivorship_bias",
  "scope_creep",
  "circular_reasoning",
];

/** Max critical blockers allowed per round (anti-loop). */
const MAX_CRITICAL_BLOCKERS_ROUND_1 = 5;
const MAX_NEW_CRITICAL_BLOCKERS_ROUND_2 = 1;

const DEFAULT_CONFIG: ScientificReviewConfig = {
  maxRounds: 3,
  convergenceThreshold: 1,
  minimumDimensionScore: 3,
  earlyStopOnAllPassing: true,
};

// -------------------------------------------------------------------
// Pass rubric — dimensions required for each verdict
// -------------------------------------------------------------------

export const PASS_RUBRIC = {
  /** All dimensions must be >= this score for "pass". */
  minimumPerDimension: 3,
  /** Overall average must be >= this for "pass". */
  minimumOverallAverage: 3.5,
  /** No critical blockers may remain open. */
  zeroCriticalBlockers: true,
  /** No anti-patterns with severity "critical" may remain. */
  zeroCriticalAntiPatterns: true,
  /** Max open major issues allowed for "pass". */
  maxOpenMajorIssues: 2,
};

// -------------------------------------------------------------------
// Issue tracking helpers
// -------------------------------------------------------------------

let issueCounter = 0;

export function resetIssueCounter(): void {
  issueCounter = 0;
}

export function generateIssueId(): string {
  issueCounter++;
  return `ISS-${String(issueCounter).padStart(3, "0")}`;
}

/**
 * Create a new ReviewIssue from a ScientificBlocker.
 */
export function blockerToIssue(
  blocker: ScientificBlocker,
  round: number,
  raisedBy: "reviewer_a" | "reviewer_b",
): ReviewIssue {
  return {
    issueId: generateIssueId(),
    raisedInRound: round,
    raisedBy,
    status: "open",
    severity: blocker.severity,
    title: blocker.issue,
    description: blocker.whyItMatters,
    resolutionCriteria: blocker.passCondition,
    statusHistory: [
      { round, status: "open", note: `Raised by ${raisedBy}: ${blocker.issue}` },
    ],
    linkedBlockerIds: [],
  };
}

/**
 * Merge new issues into an existing ledger. Matches by title similarity.
 * Returns the updated ledger and a mapping from blocker index to issue ID.
 */
export function mergeIssueLedger(
  existingLedger: ReviewIssue[],
  newBlockers: ScientificBlocker[],
  round: number,
  raisedBy: "reviewer_a" | "reviewer_b",
): { ledger: ReviewIssue[]; blockerToIssueMap: Map<number, string> } {
  const ledger = existingLedger.map(i => ({ ...i, statusHistory: [...i.statusHistory] }));
  const blockerToIssueMap = new Map<number, string>();

  for (let bi = 0; bi < newBlockers.length; bi++) {
    const blocker = newBlockers[bi];
    const matchIdx = findMatchingIssue(ledger, blocker);

    if (matchIdx >= 0) {
      // Update existing issue
      const existing = ledger[matchIdx];
      const wasResolved = existing.status === "resolved";
      if (wasResolved) {
        // Reopened
        existing.status = "open";
        existing.statusHistory.push({
          round,
          status: "open",
          note: `Reopened by ${raisedBy}: issue persists after revision`,
        });
      } else if (existing.status === "open") {
        existing.statusHistory.push({
          round,
          status: "open",
          note: `Still open per ${raisedBy}`,
        });
      }
      blockerToIssueMap.set(bi, existing.issueId);
    } else {
      // New issue
      const issue = blockerToIssue(blocker, round, raisedBy);
      ledger.push(issue);
      blockerToIssueMap.set(bi, issue.issueId);
    }
  }

  // Mark issues NOT raised this round as potentially resolved
  for (const issue of ledger) {
    const raisedThisRound = Array.from(blockerToIssueMap.values()).includes(issue.issueId);
    if (!raisedThisRound && issue.status === "open" && issue.raisedBy === raisedBy) {
      issue.status = "partially_resolved";
      issue.statusHistory.push({
        round,
        status: "partially_resolved",
        note: `Not raised by ${raisedBy} in round ${round} — may be resolved`,
      });
    }
  }

  return { ledger, blockerToIssueMap };
}

/**
 * Mark issues as resolved when both reviewers stop raising them.
 */
export function finalizeIssueStatuses(
  ledger: ReviewIssue[],
  round: number,
  aBlockerIssueIds: Set<string>,
  bBlockerIssueIds: Set<string>,
): ReviewIssue[] {
  return ledger.map(issue => {
    const updated = { ...issue, statusHistory: [...issue.statusHistory] };
    const stillRaisedByA = aBlockerIssueIds.has(issue.issueId);
    const stillRaisedByB = bBlockerIssueIds.has(issue.issueId);

    if (!stillRaisedByA && !stillRaisedByB && updated.status !== "resolved" && updated.status !== "deferred") {
      updated.status = "resolved";
      updated.statusHistory.push({
        round,
        status: "resolved",
        note: "Neither reviewer raised this issue — considered resolved",
      });
    }
    return updated;
  });
}

function findMatchingIssue(ledger: ReviewIssue[], blocker: ScientificBlocker): number {
  const needle = blocker.issue.toLowerCase().trim();
  for (let i = 0; i < ledger.length; i++) {
    const title = ledger[i].title.toLowerCase().trim();
    if (title === needle) return i;
    // Fuzzy: check if first 40 chars overlap
    if (needle.length >= 20 && title.length >= 20) {
      const prefix = needle.slice(0, 40);
      if (title.includes(prefix) || prefix.includes(title.slice(0, 40))) return i;
    }
  }
  return -1;
}

// -------------------------------------------------------------------
// Acceptance gating
// -------------------------------------------------------------------

/**
 * Check whether the review result meets the pass rubric.
 * Returns { accepted, reasons } where reasons lists any failing criteria.
 */
export function checkAcceptanceGate(
  packetA: ScientificReviewPacket,
  packetB: ScientificReviewPacket,
  issueLedger: ReviewIssue[],
): { accepted: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Check critical blockers
  const openCritical = issueLedger.filter(i => i.status === "open" && i.severity === "critical");
  if (openCritical.length > 0 && PASS_RUBRIC.zeroCriticalBlockers) {
    reasons.push(`${openCritical.length} critical issue(s) still open: ${openCritical.map(i => i.issueId).join(", ")}`);
  }

  // Check critical anti-patterns
  const criticalAntiPatterns = [
    ...(packetA.antiPatternFlags ?? []),
    ...(packetB.antiPatternFlags ?? []),
  ].filter(f => f.severity === "critical");
  if (criticalAntiPatterns.length > 0 && PASS_RUBRIC.zeroCriticalAntiPatterns) {
    reasons.push(`${criticalAntiPatterns.length} critical anti-pattern(s) detected`);
  }

  // Check open major issues
  const openMajor = issueLedger.filter(i => i.status === "open" && i.severity === "major");
  if (openMajor.length > PASS_RUBRIC.maxOpenMajorIssues) {
    reasons.push(`${openMajor.length} major issue(s) still open (max ${PASS_RUBRIC.maxOpenMajorIssues})`);
  }

  // Check dimension minimums
  for (const packet of [packetA, packetB]) {
    for (const dim of packet.dimensions) {
      if (dim.score < PASS_RUBRIC.minimumPerDimension) {
        reasons.push(`${packet.reviewerRole} scored ${dim.dimension}=${dim.score} (min ${PASS_RUBRIC.minimumPerDimension})`);
      }
    }
  }

  // Check overall average
  const avgA = packetA.dimensions.reduce((s, d) => s + d.score, 0) / Math.max(packetA.dimensions.length, 1);
  const avgB = packetB.dimensions.reduce((s, d) => s + d.score, 0) / Math.max(packetB.dimensions.length, 1);
  const combinedAvg = (avgA + avgB) / 2;
  if (combinedAvg < PASS_RUBRIC.minimumOverallAverage) {
    reasons.push(`Combined average ${combinedAvg.toFixed(1)} below minimum ${PASS_RUBRIC.minimumOverallAverage}`);
  }

  return { accepted: reasons.length === 0, reasons };
}

// -------------------------------------------------------------------
// Revision request builder (synthesizer-facing)
// -------------------------------------------------------------------

/**
 * Build a revision request from review results to send back to the Synthesizer.
 */
export function buildRevisionRequest(
  round: number,
  packetA: ScientificReviewPacket,
  packetB: ScientificReviewPacket,
  issueLedger: ReviewIssue[],
  claimMapArtifactId: string,
): ReviewRevisionRequest {
  const openIssues = issueLedger.filter(i =>
    i.status === "open" || i.status === "partially_resolved"
  );

  const revisionPoints: RevisionPoint[] = [];

  // Collect revision points from both reviewers' blockers
  for (const packet of [packetA, packetB]) {
    for (const blocker of [...packet.criticalBlockers, ...packet.majorIssues]) {
      const matchingIssue = openIssues.find(i =>
        i.title.toLowerCase().trim() === blocker.issue.toLowerCase().trim()
      );
      revisionPoints.push({
        target: blocker.issue,
        problem: blocker.whyItMatters,
        expectedOutcome: blocker.passCondition,
        issueId: matchingIssue?.issueId,
      });
    }
  }

  // Collect revision points from low-scoring dimensions
  for (const packet of [packetA, packetB]) {
    for (const dim of packet.dimensions) {
      if (dim.score < PASS_RUBRIC.minimumPerDimension && dim.suggestedImprovement) {
        revisionPoints.push({
          target: `Dimension: ${dim.dimension}`,
          problem: dim.justification,
          expectedOutcome: dim.suggestedImprovement,
        });
      }
    }
  }

  // Deduplicate by target
  const seen = new Set<string>();
  const uniquePoints: RevisionPoint[] = [];
  for (const rp of revisionPoints) {
    const key = rp.target.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      uniquePoints.push(rp);
    }
  }

  const antiPatternsToFix = [
    ...(packetA.antiPatternFlags ?? []),
    ...(packetB.antiPatternFlags ?? []),
  ].filter(f => f.severity === "critical" || f.severity === "major");

  return {
    fromRound: round,
    issueIds: openIssues.map(i => i.issueId),
    revisionPoints: uniquePoints,
    targetClaimMapId: claimMapArtifactId,
    antiPatternsToFix,
  };
}

// -------------------------------------------------------------------
// Prompt builders
// -------------------------------------------------------------------

/**
 * Build a detailed prompt for dimension-based scientific review.
 */
export function buildScientificReviewPrompt(
  role: "reviewer_a" | "reviewer_b",
  claimMapArtifacts: DeepResearchArtifact[],
  synthesisArtifacts: DeepResearchArtifact[],
  round: number,
  maxRounds: number,
  previousReviewPackets?: ScientificReviewPacket[],
  issueLedger?: ReviewIssue[],
): string {
  const roleLabel = role === "reviewer_a" ? "Reviewer A" : "Reviewer B";

  // Artifacts to review
  const artifactSection = [...claimMapArtifacts, ...synthesisArtifacts]
    .map(a => {
      const contentStr = JSON.stringify(a.content, null, 2);
      const preview = contentStr.length > 3000 ? contentStr.slice(0, 3000) + "\n... (truncated)" : contentStr;
      return `### ${a.title} (${a.artifactType})\n${preview}`;
    })
    .join("\n\n");

  // Previous round context
  let previousSection = "";
  if (previousReviewPackets && previousReviewPackets.length > 0) {
    const prevByRound = new Map<number, ScientificReviewPacket[]>();
    for (const p of previousReviewPackets) {
      const arr = prevByRound.get(p.round) ?? [];
      arr.push(p);
      prevByRound.set(p.round, arr);
    }

    const sections: string[] = [];
    for (const [r, packets] of prevByRound) {
      for (const p of packets) {
        sections.push(`#### Round ${r} — ${p.reviewerRole}\n` +
          `Verdict: ${p.verdict}, Score: ${p.overallScore}\n` +
          `Critical Blockers: ${p.criticalBlockers.length}\n` +
          `Major Issues: ${p.majorIssues.length}\n` +
          `Anti-Patterns: ${(p.antiPatternFlags ?? []).length}\n` +
          JSON.stringify(p, null, 2).slice(0, 1500));
      }
    }
    previousSection = `\n## Previous Review Rounds\n${sections.join("\n\n")}`;
  }

  // Issue ledger context
  let issueLedgerSection = "";
  if (issueLedger && issueLedger.length > 0) {
    const issueLines = issueLedger.map(i =>
      `- **${i.issueId}** [${i.status}] (${i.severity}) ${i.title} — raised round ${i.raisedInRound} by ${i.raisedBy}`
    );
    issueLedgerSection = `\n## Issue Ledger — Track These Issues\nEach issue has a persistent ID. Update status for each:\n${issueLines.join("\n")}\n\nFor each issue, assess: resolved / partially_resolved / open / deferred / blocked.`;
  }

  // Round-specific instructions (ANTI-LOOP)
  let roundInstructions: string;
  if (round === 1) {
    roundInstructions = `## Round 1 Instructions
This is the FIRST review round. Your job is to find ALL significant issues.
- Identify up to ${MAX_CRITICAL_BLOCKERS_ROUND_1} critical blockers (the most important ones)
- Identify major issues (no cap)
- For each blocker: specify issue, severity, why it matters, evidence, repair action, and pass condition
- Score all ${ALL_DIMENSIONS.length} dimensions on a 1-5 scale with justification
- Run the ANTI-PATTERN CHECKLIST below
- Choose verdict: pass / revise / experimental_pivot / reject`;
  } else if (round === 2) {
    roundInstructions = `## Round 2 Instructions — FOCUS ON PRIOR BLOCKERS
This is the SECOND review round. Your PRIMARY job is to verify whether Round 1 blockers were addressed.
- Check each prior issue in the ledger: was it fixed? partially fixed? not addressed?
- You may add at most ${MAX_NEW_CRITICAL_BLOCKERS_ROUND_2} NEW critical blocker (only if something truly critical was missed)
- Re-score all dimensions — note improvements or regressions
- Re-run the ANTI-PATTERN CHECKLIST
- If all prior critical blockers are resolved and scores improved → consider "pass"
- If blockers remain but progress is clear → "revise"
- If foundational issues prevent literature resolution but a pilot experiment is tractable → "experimental_pivot"`;
  } else {
    roundInstructions = `## Round ${round} Instructions — FORCED DECISION
This is the FINAL review round (Round ${round} of ${maxRounds}).
You MUST choose one of: pass / experimental_pivot / reject
- "revise" is NOT allowed in the final round
- NO new blockers may be introduced
- Evaluate based on the current state of evidence and prior fixes
- Choose "experimental_pivot" if: foundational literature remains unresolved BUT construct validity can be tested via a tractable pilot experiment
- Choose "pass" if: all critical blockers are resolved and dimensions are acceptable
- Choose "reject" ONLY if: fundamental, irreparable flaws remain`;
  }

  const dimensionList = ALL_DIMENSIONS.map(d =>
    `- **${d}** (${DIMENSION_LABELS[d]}): Score 1-5, where 1=critical_failure, 2=major_weakness, 3=acceptable, 4=good, 5=excellent`
  ).join("\n");

  const antiPatternChecklist = ALL_ANTI_PATTERNS.map(p =>
    `- **${p}**: Check if synthesis exhibits this pattern`
  ).join("\n");

  const passRubricSection = `## Pass Rubric
A verdict of "pass" requires ALL of the following:
- Every dimension score >= ${PASS_RUBRIC.minimumPerDimension}
- Overall average >= ${PASS_RUBRIC.minimumOverallAverage}
- Zero open critical issues
- Zero critical anti-patterns
- At most ${PASS_RUBRIC.maxOpenMajorIssues} open major issues
If these criteria are not met, you MUST NOT verdict "pass".`;

  return `You are ${roleLabel} performing a structured scientific review (Round ${round} of ${maxRounds}).

## YOUR ROLE AND LIMITS
- You CRITIQUE the research synthesis using structured dimensions.
- You CANNOT dispatch workers, search papers, or run experiments.
- You MUST be specific — never say "evidence insufficient" without specifying WHAT is missing.
- You MUST distinguish:
  - retrieved_evidence: claims backed by sources in the synthesis
  - background_knowledge: general domain knowledge not from retrieved sources
  - assumptions: reasonable but unverified inferences
  - unsupported_claims: claims with no backing

## Artifacts to Review
${artifactSection}
${previousSection}
${issueLedgerSection}

${roundInstructions}

${passRubricSection}

## Review Dimensions
Score each dimension 1-5 with justification:
${dimensionList}

## Anti-Pattern Checklist
Flag any detected anti-patterns:
${antiPatternChecklist}

## Output Format
Respond with valid JSON:
{
  "reviewerRole": "${role}",
  "round": ${round},
  "dimensions": [
    {
      "dimension": "problem_definition",
      "score": 4,
      "justification": "Clear problem statement with well-defined scope...",
      "suggestedImprovement": "Could strengthen by..."
    }
  ],
  "overallScore": 3.5,
  "verdict": "pass|revise|experimental_pivot|reject",
  "criticalBlockers": [
    {
      "issue": "Specific description of the blocking issue",
      "severity": "critical",
      "whyItMatters": "Why this blocks scientific validity",
      "evidenceForIssue": "What in the synthesis shows this problem",
      "repairAction": "Concrete action to fix this",
      "passCondition": "What would make this blocker pass"
    }
  ],
  "majorIssues": [...],
  "minorSuggestions": ["Suggestion 1", "Suggestion 2"],
  "repairPaths": [
    {
      "blockerId": "b1",
      "action": "Concrete repair action",
      "estimatedEffort": "low|medium|high",
      "prerequisite": "optional dependency"
    }
  ],
  "passConditions": ["Condition 1 that would make this pass", "Condition 2"],
  "trackedIssues": [
    {
      "issueId": "ISS-001",
      "status": "open|partially_resolved|resolved|deferred|blocked",
      "note": "Assessment of this issue in the current round"
    }
  ],
  "antiPatternFlags": [
    {
      "pattern": "citation_hallucination",
      "location": "Claim c3",
      "description": "Cites Smith et al. 2023 but no such source in evidence cards",
      "severity": "critical",
      "suggestedFix": "Remove claim or find actual source"
    }
  ]
}

## CRITICAL RULES
1. Every blocker MUST have a repair action and pass condition
2. Never reject vaguely — always specify what is wrong and how to fix it
3. "experimental_pivot" means: literature gaps are real but a pilot experiment can test the core hypothesis
4. Distinguish retrieved evidence from assumptions in your justifications
5. ${round >= maxRounds ? "You MUST choose pass/experimental_pivot/reject. 'revise' is NOT allowed." : "Be thorough but constructive."}
6. Do NOT verdict "pass" unless the Pass Rubric is fully satisfied
7. Update tracked issue statuses accurately — do not mark as resolved unless genuinely fixed`;
}

// -------------------------------------------------------------------
// Execute scientific review
// -------------------------------------------------------------------

/**
 * Run the full multi-round scientific review process.
 * Implements anti-loop logic with forced decisions by max round.
 * Uses acceptance-gated progression: cannot pass with open critical issues.
 */
export async function executeScientificReview(
  session: DeepResearchSession,
  claimMapArtifacts: DeepResearchArtifact[],
  synthesisArtifacts: DeepResearchArtifact[],
  config: ScientificReviewConfig = DEFAULT_CONFIG,
  abortSignal?: AbortSignal,
): Promise<ScientificReviewResult> {
  const allRounds: ScientificReviewResult["rounds"] = [];
  let convergedAtRound: number | null = null;
  const allPreviousPackets: ScientificReviewPacket[] = [];
  let issueLedger: ReviewIssue[] = [];

  resetIssueCounter();

  await store.appendEvent(session.id, "scientific_review_completed", undefined, "system", undefined, undefined, {
    event: "scientific_review_started",
    maxRounds: config.maxRounds,
    dimensions: ALL_DIMENSIONS,
  });

  for (let round = 1; round <= config.maxRounds; round++) {
    if (abortSignal?.aborted) throw new Error("Aborted");

    // Run both reviewers in parallel
    const [packetA, packetB] = await Promise.all([
      runSingleReviewer("reviewer_a", session, claimMapArtifacts, synthesisArtifacts, round, config.maxRounds, allPreviousPackets, issueLedger, abortSignal),
      runSingleReviewer("reviewer_b", session, claimMapArtifacts, synthesisArtifacts, round, config.maxRounds, allPreviousPackets, issueLedger, abortSignal),
    ]);

    // Apply anti-loop enforcement
    const enforcedA = enforceAntiLoop(packetA, round, config.maxRounds, allPreviousPackets.filter(p => p.reviewerRole === "reviewer_a"));
    const enforcedB = enforceAntiLoop(packetB, round, config.maxRounds, allPreviousPackets.filter(p => p.reviewerRole === "reviewer_b"));

    // Update issue ledger with both reviewers' blockers
    const mergeA = mergeIssueLedger(issueLedger, enforcedA.criticalBlockers, round, "reviewer_a");
    const mergeB = mergeIssueLedger(mergeA.ledger, enforcedB.criticalBlockers, round, "reviewer_b");

    // Also track major issues
    const mergeMajorA = mergeIssueLedger(mergeB.ledger, enforcedA.majorIssues, round, "reviewer_a");
    const mergeMajorB = mergeIssueLedger(mergeMajorA.ledger, enforcedB.majorIssues, round, "reviewer_b");

    // Finalize statuses: issues not raised by either reviewer are resolved
    const aIssueIds = new Set([...mergeA.blockerToIssueMap.values(), ...mergeMajorA.blockerToIssueMap.values()]);
    const bIssueIds = new Set([...mergeB.blockerToIssueMap.values(), ...mergeMajorB.blockerToIssueMap.values()]);
    issueLedger = finalizeIssueStatuses(mergeMajorB.ledger, round, aIssueIds, bIssueIds);

    // Attach tracked issues to packets
    enforcedA.trackedIssues = issueLedger.filter(i => i.raisedBy === "reviewer_a");
    enforcedB.trackedIssues = issueLedger.filter(i => i.raisedBy === "reviewer_b");

    // Apply acceptance gating: override "pass" if rubric not met
    applyAcceptanceGate(enforcedA, enforcedB, issueLedger);

    allRounds.push({ round, reviewerAPacket: enforcedA, reviewerBPacket: enforcedB });
    allPreviousPackets.push(enforcedA, enforcedB);

    // Check convergence
    if (checkDimensionConvergence(enforcedA, enforcedB, config.convergenceThreshold)) {
      convergedAtRound = round;

      // Early stop if both pass with no critical blockers
      if (config.earlyStopOnAllPassing &&
        enforcedA.verdict === "pass" && enforcedB.verdict === "pass" &&
        enforcedA.criticalBlockers.length === 0 && enforcedB.criticalBlockers.length === 0) {
        break;
      }

      // Also stop if converged on same verdict
      if (enforcedA.verdict === enforcedB.verdict) {
        break;
      }
    }
  }

  // Build final result with acceptance gating info
  const result = buildScientificReviewResult(allRounds, convergedAtRound, config, issueLedger);

  // Save result artifact
  await store.createArtifact(
    session.id,
    null,
    "scientific_review_result",
    `Scientific Review Result (${allRounds.length} rounds, verdict: ${result.finalVerdict})`,
    result as unknown as Record<string, unknown>,
  );

  await store.appendEvent(session.id, "scientific_review_completed", undefined, "system", undefined, undefined, {
    rounds: allRounds.length,
    converged: convergedAtRound !== null,
    finalVerdict: result.finalVerdict,
    canProceed: result.canProceed,
    acceptanceGated: result.acceptanceGated,
    openIssues: issueLedger.filter(i => i.status === "open").length,
  });

  return result;
}

/**
 * Apply acceptance gating: if a reviewer says "pass" but the rubric isn't satisfied,
 * downgrade to "revise" (or "reject" in final round).
 */
function applyAcceptanceGate(
  packetA: ScientificReviewPacket,
  packetB: ScientificReviewPacket,
  issueLedger: ReviewIssue[],
): void {
  const gate = checkAcceptanceGate(packetA, packetB, issueLedger);
  if (!gate.accepted) {
    if (packetA.verdict === "pass") {
      packetA.verdict = "revise";
    }
    if (packetB.verdict === "pass") {
      packetB.verdict = "revise";
    }
  }
}

// -------------------------------------------------------------------
// Single reviewer execution
// -------------------------------------------------------------------

async function runSingleReviewer(
  role: "reviewer_a" | "reviewer_b",
  session: DeepResearchSession,
  claimMapArtifacts: DeepResearchArtifact[],
  synthesisArtifacts: DeepResearchArtifact[],
  round: number,
  maxRounds: number,
  previousPackets: ScientificReviewPacket[],
  issueLedger: ReviewIssue[],
  abortSignal?: AbortSignal,
): Promise<ScientificReviewPacket> {
  const { model } = getModelForRole(role, session.config);
  const budgetCheck = checkBudget(role, session.budget, session.config.budget);

  if (!budgetCheck.allowed) {
    return createFallbackPacket(role, round);
  }

  // Create review node
  const reviewNode = await store.createNode(session.id, {
    nodeType: "scientific_review",
    label: `${role === "reviewer_a" ? "Reviewer A" : "Reviewer B"}: Scientific Review Round ${round}`,
    assignedRole: role,
    input: { round, maxRounds, previousRounds: previousPackets.length, openIssues: issueLedger.filter(i => i.status === "open").length },
    phase: "reviewer_deliberation",
  });

  await store.updateNode(reviewNode.id, {
    status: "running",
    startedAt: new Date().toISOString(),
  });

  try {
    const prompt = buildScientificReviewPrompt(
      role, claimMapArtifacts, synthesisArtifacts, round, maxRounds,
      previousPackets.length > 0 ? previousPackets : undefined,
      issueLedger.length > 0 ? issueLedger : undefined,
    );

    const result = await generateText({
      model,
      system: `You are a scientific reviewer performing a structured dimension-based audit. Respond ONLY with valid JSON matching the ScientificReviewPacket schema.`,
      messages: [{ role: "user", content: prompt }],
      abortSignal,
    });

    const tokens = result.usage?.totalTokens ?? 0;
    const budget = trackUsage(session.budget, role, reviewNode.id, tokens);
    await store.updateSession(session.id, { budget });

    // Parse the packet
    const packet = parseScientificReviewPacket(result.text, role, round);

    // Mark node completed
    await store.updateNode(reviewNode.id, {
      status: "completed",
      output: packet as unknown as Record<string, unknown>,
      completedAt: new Date().toISOString(),
    });

    // Save artifact
    const provenance: ArtifactProvenance = {
      sourceNodeId: reviewNode.id,
      sourceArtifactIds: [...claimMapArtifacts, ...synthesisArtifacts].map(a => a.id),
      model: role,
      generatedAt: new Date().toISOString(),
    };

    await store.createArtifact(
      session.id,
      reviewNode.id,
      "scientific_review_packet",
      `Scientific Review: ${role} Round ${round} (verdict: ${packet.verdict}, score: ${packet.overallScore.toFixed(1)})`,
      packet as unknown as Record<string, unknown>,
      provenance,
    );

    return packet;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Review failed";
    await store.updateNode(reviewNode.id, {
      status: "failed",
      error: message,
      completedAt: new Date().toISOString(),
    });
    return createFallbackPacket(role, round);
  }
}

// -------------------------------------------------------------------
// Anti-loop enforcement
// -------------------------------------------------------------------

/**
 * Enforce anti-loop rules on a review packet.
 * - Round 1: cap critical blockers
 * - Round 2: limit new critical blockers, focus on prior fixes
 * - Round 3+: force terminal verdict, no new blockers
 */
export function enforceAntiLoop(
  packet: ScientificReviewPacket,
  round: number,
  maxRounds: number,
  previousPacketsForRole: ScientificReviewPacket[],
): ScientificReviewPacket {
  const enforced = { ...packet };

  if (round === 1) {
    // Cap critical blockers at max
    if (enforced.criticalBlockers.length > MAX_CRITICAL_BLOCKERS_ROUND_1) {
      enforced.criticalBlockers = enforced.criticalBlockers.slice(0, MAX_CRITICAL_BLOCKERS_ROUND_1);
    }
  } else if (round === 2) {
    // Identify which blockers are new vs. carried over
    const priorBlockerIssues = new Set(
      previousPacketsForRole.flatMap(p => p.criticalBlockers.map(b => b.issue.toLowerCase().trim()))
    );

    const carriedOver: ScientificBlocker[] = [];
    const newBlockers: ScientificBlocker[] = [];

    for (const blocker of enforced.criticalBlockers) {
      const isCarried = priorBlockerIssues.has(blocker.issue.toLowerCase().trim()) ||
        Array.from(priorBlockerIssues).some(prior =>
          blocker.issue.toLowerCase().includes(prior.slice(0, 30)) ||
          prior.includes(blocker.issue.toLowerCase().slice(0, 30))
        );

      if (isCarried) {
        carriedOver.push(blocker);
      } else {
        newBlockers.push(blocker);
      }
    }

    // Allow all carried-over blockers + limited new ones
    enforced.criticalBlockers = [
      ...carriedOver,
      ...newBlockers.slice(0, MAX_NEW_CRITICAL_BLOCKERS_ROUND_2),
    ];
  } else if (round >= maxRounds) {
    // FORCED DECISION: no "revise" allowed, no new blockers
    if (enforced.verdict === "revise") {
      // Upgrade to experimental_pivot or reject based on scores
      const avgScore = enforced.dimensions.reduce((sum, d) => sum + d.score, 0) / Math.max(enforced.dimensions.length, 1);
      enforced.verdict = avgScore >= 3.0 ? "experimental_pivot" : "reject";
    }

    // No new blockers in final round
    enforced.criticalBlockers = [];
    enforced.majorIssues = [];
  }

  return enforced;
}

// -------------------------------------------------------------------
// Convergence checking
// -------------------------------------------------------------------

/**
 * Check if two reviewers have converged based on dimension score differences.
 */
export function checkDimensionConvergence(
  a: ScientificReviewPacket,
  b: ScientificReviewPacket,
  threshold: number,
): boolean {
  // Must have same verdict
  if (a.verdict !== b.verdict) return false;

  // Check dimension score differences
  for (const dim of ALL_DIMENSIONS) {
    const aScore = a.dimensions.find(d => d.dimension === dim)?.score ?? 3;
    const bScore = b.dimensions.find(d => d.dimension === dim)?.score ?? 3;
    if (Math.abs(aScore - bScore) > threshold) return false;
  }

  return true;
}

// -------------------------------------------------------------------
// Build final result
// -------------------------------------------------------------------

function buildScientificReviewResult(
  rounds: ScientificReviewResult["rounds"],
  convergedAtRound: number | null,
  config: ScientificReviewConfig,
  issueLedger: ReviewIssue[],
): ScientificReviewResult {
  if (rounds.length === 0) {
    return {
      canProceed: false,
      proceedConditions: [],
      actionableRepairs: [],
      dimensionAggregates: buildEmptyAggregates(),
      rounds: [],
      convergedAtRound: null,
      finalVerdict: "reject",
      issueLedger: [],
      acceptanceGated: false,
    };
  }

  const lastRound = rounds[rounds.length - 1];
  const lastA = lastRound.reviewerAPacket;
  const lastB = lastRound.reviewerBPacket;

  // Aggregate dimension scores across rounds
  const dimensionAggregates = buildDimensionAggregates(rounds);

  // Check acceptance gate
  const gate = checkAcceptanceGate(lastA, lastB, issueLedger);

  // Determine final verdict
  let finalVerdict = determineFinalVerdict(lastA, lastB, config);

  // Acceptance gating: if verdict is "pass" but gate fails, downgrade
  const acceptanceGated = finalVerdict === "pass" && !gate.accepted;
  if (acceptanceGated) {
    // At max rounds, cannot use "revise" — use experimental_pivot or reject
    if (rounds.length >= config.maxRounds) {
      const avgScore = (lastA.overallScore + lastB.overallScore) / 2;
      finalVerdict = avgScore >= config.minimumDimensionScore ? "experimental_pivot" : "reject";
    } else {
      finalVerdict = "revise";
    }
  }

  // Collect all unresolved blockers from last round
  const allRepairs = [...lastA.repairPaths, ...lastB.repairPaths];

  // Deduplicate repairs by action
  const seenActions = new Set<string>();
  const uniqueRepairs: RepairPath[] = [];
  for (const repair of allRepairs) {
    const key = repair.action.toLowerCase().trim();
    if (!seenActions.has(key)) {
      seenActions.add(key);
      uniqueRepairs.push(repair);
    }
  }

  // Collect pass conditions
  const allPassConditions = [...new Set([
    ...lastA.passConditions,
    ...lastB.passConditions,
  ])];

  // If acceptance-gated, include gate reasons as conditions
  if (acceptanceGated) {
    allPassConditions.push(...gate.reasons);
  }

  const canProceed = finalVerdict === "pass" || finalVerdict === "experimental_pivot";

  return {
    canProceed,
    proceedConditions: canProceed ? allPassConditions : [],
    actionableRepairs: uniqueRepairs,
    dimensionAggregates,
    rounds,
    convergedAtRound,
    finalVerdict,
    issueLedger,
    acceptanceGated,
  };
}

function determineFinalVerdict(
  a: ScientificReviewPacket,
  b: ScientificReviewPacket,
  config: ScientificReviewConfig,
): ScientificVerdict {
  // If both agree, use that
  if (a.verdict === b.verdict) return a.verdict;

  // If one passes and one says experimental_pivot, go with experimental_pivot
  if ((a.verdict === "pass" && b.verdict === "experimental_pivot") ||
    (a.verdict === "experimental_pivot" && b.verdict === "pass")) {
    return "experimental_pivot";
  }

  // If one rejects, need consensus
  if (a.verdict === "reject" || b.verdict === "reject") {
    const avgA = a.overallScore;
    const avgB = b.overallScore;
    const combined = (avgA + avgB) / 2;
    if (combined >= config.minimumDimensionScore) return "experimental_pivot";
    return "reject";
  }

  // Default: use the more conservative verdict
  const priority: Record<ScientificVerdict, number> = { reject: 0, revise: 1, experimental_pivot: 2, pass: 3 };
  return priority[a.verdict] < priority[b.verdict] ? a.verdict : b.verdict;
}

function buildDimensionAggregates(
  rounds: ScientificReviewResult["rounds"],
): Record<ReviewDimension, { avgScore: number; trend: "improving" | "stable" | "declining" }> {
  const result = {} as Record<ReviewDimension, { avgScore: number; trend: "improving" | "stable" | "declining" }>;

  for (const dim of ALL_DIMENSIONS) {
    const scoresPerRound: number[] = [];

    for (const round of rounds) {
      const aScore = round.reviewerAPacket.dimensions.find(d => d.dimension === dim)?.score ?? 3;
      const bScore = round.reviewerBPacket.dimensions.find(d => d.dimension === dim)?.score ?? 3;
      scoresPerRound.push((aScore + bScore) / 2);
    }

    const avgScore = scoresPerRound.reduce((s, v) => s + v, 0) / Math.max(scoresPerRound.length, 1);

    let trend: "improving" | "stable" | "declining" = "stable";
    if (scoresPerRound.length >= 2) {
      const first = scoresPerRound[0];
      const last = scoresPerRound[scoresPerRound.length - 1];
      if (last - first >= 0.5) trend = "improving";
      else if (first - last >= 0.5) trend = "declining";
    }

    result[dim] = { avgScore, trend };
  }

  return result;
}

function buildEmptyAggregates(): Record<ReviewDimension, { avgScore: number; trend: "improving" | "stable" | "declining" }> {
  const result = {} as Record<ReviewDimension, { avgScore: number; trend: "improving" | "stable" | "declining" }>;
  for (const dim of ALL_DIMENSIONS) {
    result[dim] = { avgScore: 0, trend: "stable" };
  }
  return result;
}

// -------------------------------------------------------------------
// Parsing
// -------------------------------------------------------------------

function parseScientificReviewPacket(
  text: string,
  role: "reviewer_a" | "reviewer_b",
  round: number,
): ScientificReviewPacket {
  const parsed = extractJsonFromText(text);

  if (!parsed) {
    return createFallbackPacket(role, round);
  }

  // Validate and normalize dimensions
  const dimensions: DimensionScore[] = [];
  if (Array.isArray(parsed.dimensions)) {
    for (const d of parsed.dimensions) {
      if (d && typeof d === "object" && d.dimension && typeof d.score === "number") {
        dimensions.push({
          dimension: d.dimension as ReviewDimension,
          score: Math.max(1, Math.min(5, Math.round(d.score))),
          justification: d.justification ?? "",
          suggestedImprovement: d.suggestedImprovement,
        });
      }
    }
  }

  // Ensure all dimensions are present
  for (const dim of ALL_DIMENSIONS) {
    if (!dimensions.find(d => d.dimension === dim)) {
      dimensions.push({
        dimension: dim,
        score: 3,
        justification: "Not explicitly evaluated",
      });
    }
  }

  const overallScore = typeof parsed.overallScore === "number"
    ? parsed.overallScore
    : dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length;

  const verdict = validateVerdict(parsed.verdict as string);

  // Parse anti-pattern flags
  const antiPatternFlags: AntiPatternFlag[] = [];
  if (Array.isArray(parsed.antiPatternFlags)) {
    for (const f of parsed.antiPatternFlags) {
      if (f && typeof f === "object" && f.pattern) {
        antiPatternFlags.push({
          pattern: f.pattern as AntiPatternType,
          location: String(f.location ?? ""),
          description: String(f.description ?? ""),
          severity: (f.severity as "critical" | "major" | "minor") ?? "minor",
          suggestedFix: String(f.suggestedFix ?? f.suggested_fix ?? ""),
        });
      }
    }
  }

  return {
    reviewerRole: role,
    round,
    dimensions,
    overallScore,
    verdict,
    criticalBlockers: parseBlockers(parsed.criticalBlockers, "critical"),
    majorIssues: parseBlockers(parsed.majorIssues, "major"),
    minorSuggestions: Array.isArray(parsed.minorSuggestions) ? parsed.minorSuggestions.filter((s: unknown) => typeof s === "string") : [],
    repairPaths: parseRepairPaths(parsed.repairPaths),
    passConditions: Array.isArray(parsed.passConditions) ? parsed.passConditions.filter((s: unknown) => typeof s === "string") : [],
    antiPatternFlags,
  };
}

function parseBlockers(raw: unknown, defaultSeverity: "critical" | "major"): ScientificBlocker[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((b: unknown) => b && typeof b === "object" && (b as Record<string, unknown>).issue)
    .map((b: Record<string, unknown>) => ({
      issue: String(b.issue ?? ""),
      severity: (b.severity as "critical" | "major" | "minor") ?? defaultSeverity,
      whyItMatters: String(b.whyItMatters ?? b.why_it_matters ?? ""),
      evidenceForIssue: String(b.evidenceForIssue ?? b.evidence_for_issue ?? ""),
      repairAction: String(b.repairAction ?? b.repair_action ?? ""),
      passCondition: String(b.passCondition ?? b.pass_condition ?? ""),
    }));
}

function parseRepairPaths(raw: unknown): RepairPath[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r: unknown) => r && typeof r === "object")
    .map((r: Record<string, unknown>) => ({
      blockerId: String(r.blockerId ?? r.blocker_id ?? ""),
      action: String(r.action ?? ""),
      estimatedEffort: (r.estimatedEffort ?? r.estimated_effort ?? "medium") as "low" | "medium" | "high",
      prerequisite: r.prerequisite ? String(r.prerequisite) : undefined,
    }));
}

function validateVerdict(raw: string | undefined): ScientificVerdict {
  const valid: ScientificVerdict[] = ["pass", "revise", "experimental_pivot", "reject"];
  if (raw && valid.includes(raw as ScientificVerdict)) return raw as ScientificVerdict;
  return "revise";
}

function createFallbackPacket(role: "reviewer_a" | "reviewer_b", round: number): ScientificReviewPacket {
  return {
    reviewerRole: role,
    round,
    dimensions: ALL_DIMENSIONS.map(dim => ({
      dimension: dim,
      score: 3,
      justification: "Review could not be completed — using neutral default",
    })),
    overallScore: 3.0,
    verdict: "revise",
    criticalBlockers: [],
    majorIssues: [],
    minorSuggestions: ["Review generation failed — manual review recommended"],
    repairPaths: [],
    passConditions: ["Complete manual scientific review"],
    antiPatternFlags: [],
  };
}

function extractJsonFromText(text: string): Record<string, unknown> | null {
  try {
    const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fenceMatch) return JSON.parse(fenceMatch[1].trim());

    const firstBrace = text.indexOf("{");
    if (firstBrace >= 0) {
      let depth = 0;
      let inString = false;
      let escape = false;
      for (let i = firstBrace; i < text.length; i++) {
        const ch = text[i];
        if (escape) { escape = false; continue; }
        if (ch === "\\") { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === "{") depth++;
        if (ch === "}") {
          depth--;
          if (depth === 0) return JSON.parse(text.slice(firstBrace, i + 1));
        }
      }
    }
    return JSON.parse(text.trim());
  } catch {
    return null;
  }
}

// =============================================================
// Execution-Awareness Review Functions
// =============================================================
// Extend the scientific reviewer to evaluate execution-related
// artifacts: readiness, validation criteria, resource assumptions,
// experiment analysis quality, and rerun/replan justification.

// -------------------------------------------------------------------
// Execution Readiness Review
// -------------------------------------------------------------------

export interface ExecutionReadinessReview {
  ready: boolean;
  blockers: ExecutionReadinessBlocker[];
  warnings: string[];
  score: number; // 1-5
  recommendation: "proceed" | "fix_blockers" | "redesign";
}

export interface ExecutionReadinessBlocker {
  category: "data" | "resource" | "environment" | "validation" | "design";
  issue: string;
  severity: "critical" | "major" | "minor";
  suggestedFix: string;
}

/**
 * Review whether an experiment is ready for execution.
 * Checks data availability, resource realism, environment setup,
 * validation criteria adequacy, and experiment design soundness.
 */
export function reviewExecutionReadiness(
  fanoutPlan: WorkerFanoutPlan,
): ExecutionReadinessReview {
  const blockers: ExecutionReadinessBlocker[] = [];
  const warnings: string[] = [];

  const spec = fanoutPlan.parentSpec;

  // --- Data checks ---
  if (spec.dataSources.length === 0) {
    blockers.push({
      category: "data",
      issue: "No data sources specified",
      severity: "critical",
      suggestedFix: "Add at least one data source to the experiment spec",
    });
  }
  for (const ds of spec.dataSources) {
    if (!ds.identifier) {
      blockers.push({
        category: "data",
        issue: `Data source "${ds.name}" has no identifier`,
        severity: "critical",
        suggestedFix: `Provide a valid identifier (e.g., HuggingFace dataset ID or URL)`,
      });
    }
    if (ds.estimatedSizeGb > 100) {
      warnings.push(`Data source "${ds.name}" is very large (${ds.estimatedSizeGb} GB) — ensure sufficient disk space`);
    }
  }

  // --- Resource checks ---
  if (spec.resources.gpu === 0 && spec.commands.some(c => c.stage === "train")) {
    blockers.push({
      category: "resource",
      issue: "Training commands specified but no GPU allocated",
      severity: "critical",
      suggestedFix: "Allocate at least 1 GPU for training workloads",
    });
  }
  if (spec.resources.memoryMb < 8000 && spec.resources.gpu > 0) {
    warnings.push(`Memory allocation (${spec.resources.memoryMb} MB) may be too low for GPU workloads`);
  }

  const walltimeHours = parseWalltimeHours(spec.resources.walltime);
  if (walltimeHours > 72) {
    warnings.push(`Walltime of ${walltimeHours}h is very long — consider checkpointing and shorter jobs`);
  }

  // Total GPU hours across all workers
  if (fanoutPlan.estimatedTotalGPUHours > 500) {
    warnings.push(`Total estimated GPU hours (${fanoutPlan.estimatedTotalGPUHours}) is very high — consider a pilot run first`);
  }

  // --- Environment checks ---
  if (spec.commands.length === 0) {
    blockers.push({
      category: "environment",
      issue: "No commands specified in the experiment",
      severity: "critical",
      suggestedFix: "Add training/evaluation commands to the experiment spec",
    });
  }

  // --- Validation criteria checks ---
  const vc = fanoutPlan.validationCriteria;
  if (vc.metricThresholds.length === 0) {
    warnings.push("No metric thresholds defined — experiment will pass without quantitative validation");
  }
  if (vc.minSuccessfulWorkers > fanoutPlan.totalWorkers) {
    blockers.push({
      category: "validation",
      issue: `Min successful workers (${vc.minSuccessfulWorkers}) exceeds total workers (${fanoutPlan.totalWorkers})`,
      severity: "major",
      suggestedFix: "Set minSuccessfulWorkers <= totalWorkers",
    });
  }

  // --- Design checks ---
  if (fanoutPlan.strategy === "seed_sweep" && fanoutPlan.totalWorkers < 3) {
    warnings.push("Seed sweep with fewer than 3 seeds provides weak variance estimates");
  }
  if (fanoutPlan.strategy === "hyperparameter_sweep" && fanoutPlan.totalWorkers > 50) {
    warnings.push("Hyperparameter sweep with >50 workers is expensive — consider Bayesian optimization");
  }

  // Score: 5 if no blockers or warnings, deduct for issues
  const criticalCount = blockers.filter(b => b.severity === "critical").length;
  const majorCount = blockers.filter(b => b.severity === "major").length;
  const score = Math.max(1, 5 - criticalCount * 2 - majorCount - Math.floor(warnings.length / 3));

  const ready = criticalCount === 0;
  const recommendation = criticalCount > 0 ? "fix_blockers"
    : majorCount > 2 ? "redesign"
    : "proceed";

  return { ready, blockers, warnings, score, recommendation };
}

// -------------------------------------------------------------------
// Validation Criteria Adequacy Review
// -------------------------------------------------------------------

export interface ValidationCriteriaReview {
  adequate: boolean;
  issues: string[];
  suggestions: string[];
  score: number; // 1-5
}

/**
 * Review whether validation criteria are sufficient to make
 * a scientific judgment about the experiment results.
 */
export function reviewValidationCriteria(
  criteria: ValidationCriteria,
  totalWorkers: number,
  strategy: string,
): ValidationCriteriaReview {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Check metric thresholds
  if (criteria.metricThresholds.length === 0) {
    issues.push("No quantitative metric thresholds defined");
    suggestions.push("Add at least one metric threshold (e.g., accuracy >= 0.8)");
  }

  // Check for conflicting thresholds
  const metricNames = criteria.metricThresholds.map(t => t.metric);
  const duplicates = metricNames.filter((m, i) => metricNames.indexOf(m) !== i);
  if (duplicates.length > 0) {
    issues.push(`Duplicate thresholds for metrics: ${[...new Set(duplicates)].join(", ")}`);
  }

  // Check worker success requirement
  if (criteria.minSuccessfulWorkers < 1) {
    issues.push("minSuccessfulWorkers is 0 — at least one worker must succeed");
  }
  if (criteria.minSuccessfulWorkers > totalWorkers) {
    issues.push(`minSuccessfulWorkers (${criteria.minSuccessfulWorkers}) exceeds total workers (${totalWorkers})`);
  }

  // Check variance for seed sweeps
  if (strategy === "seed_sweep" && criteria.maxVariance === null) {
    suggestions.push("Consider setting maxVariance for seed sweep to detect unstable results");
  }

  // Check baseline comparison
  if (criteria.baselineRequired && Object.keys(criteria.baselineMetrics).length === 0) {
    issues.push("Baseline comparison required but no baseline metrics provided");
    suggestions.push("Provide baseline metric values for comparison");
  }

  // Check required artifacts
  if (criteria.requiredArtifacts.length === 0) {
    suggestions.push("Consider requiring at least 'metrics.json' as an artifact");
  }

  const score = Math.max(1, 5 - issues.length - Math.floor(suggestions.length / 2));
  const adequate = issues.length === 0;

  return { adequate, issues, suggestions, score };
}

// -------------------------------------------------------------------
// Resource Assumptions Review
// -------------------------------------------------------------------

export interface ResourceAssumptionsReview {
  realistic: boolean;
  issues: string[];
  suggestions: string[];
  estimatedCostCategory: "low" | "medium" | "high" | "very_high";
}

/**
 * Review resource assumptions for realism.
 */
export function reviewResourceAssumptions(
  resources: ExperimentResources,
  totalWorkers: number,
  estimatedGPUHours: number,
): ResourceAssumptionsReview {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // GPU sanity checks
  if (resources.gpu > 8) {
    issues.push(`${resources.gpu} GPUs per worker is unusual — verify multi-node setup`);
  }

  // Memory sanity
  if (resources.gpu > 0 && resources.memoryMb < 16_000) {
    suggestions.push("GPU workloads typically need >= 16 GB memory per node");
  }
  if (resources.memoryMb > 512_000) {
    issues.push(`${resources.memoryMb} MB memory is extremely high — verify this is correct`);
  }

  // Walltime
  const hours = parseWalltimeHours(resources.walltime);
  if (hours > 168) {
    issues.push(`Walltime of ${hours}h exceeds 1 week — most clusters have shorter limits`);
    suggestions.push("Use checkpointing and shorter walltime with restart support");
  }

  // Total cost estimate
  const totalGPUHours = estimatedGPUHours;
  const costCategory = totalGPUHours <= 10 ? "low"
    : totalGPUHours <= 100 ? "medium"
    : totalGPUHours <= 1000 ? "high"
    : "very_high";

  if (costCategory === "very_high") {
    suggestions.push("Total GPU hours exceed 1000 — consider running a pilot first and narrowing the search space");
  }

  const realistic = issues.length === 0;
  return { realistic, issues, suggestions, estimatedCostCategory: costCategory };
}

// -------------------------------------------------------------------
// Experiment Analysis Quality Review
// -------------------------------------------------------------------

export interface AnalysisQualityReview {
  quality: "good" | "acceptable" | "weak" | "poor";
  issues: string[];
  suggestions: string[];
}

/**
 * Review the quality of an experiment failure analysis.
 * Checks whether root causes are well-supported, recommendations
 * are actionable, and the analysis is thorough.
 */
export function reviewExperimentAnalysis(
  analysis: ExperimentAnalysisResult,
  validationResult: ExecutionValidationResult,
): AnalysisQualityReview {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Check root causes
  if (analysis.rootCauses.length === 0) {
    issues.push("No root causes identified — analysis is incomplete");
  } else {
    const highConfidence = analysis.rootCauses.filter(rc => rc.confidence > 0.7);
    if (highConfidence.length === 0) {
      issues.push("No high-confidence root causes — analysis is uncertain");
      suggestions.push("Collect more data (logs, metrics) to increase diagnostic confidence");
    }
  }

  // Check recommendations
  if (analysis.recommendations.length === 0) {
    issues.push("No recommendations provided");
  } else {
    const hasActionable = analysis.recommendations.some(r =>
      r.action === "rerun_with_fixes" || r.action === "redesign_experiment" || r.action === "increase_resources"
    );
    if (!hasActionable) {
      suggestions.push("Consider providing more specific actionable recommendations");
    }
  }

  // Check consistency with validation result
  if (validationResult.verdict === "pass" && analysis.rootCauses.length > 0) {
    issues.push("Analysis found root causes for a passing validation — inconsistent");
  }

  // Check for missing evidence
  if (analysis.rootCauses.some(rc => rc.supportingEvidence.length === 0)) {
    issues.push("Some root causes lack supporting evidence");
  }

  const issueCount = issues.length;
  const quality = issueCount === 0 ? "good"
    : issueCount <= 1 ? "acceptable"
    : issueCount <= 2 ? "weak"
    : "poor";

  return { quality, issues, suggestions };
}

// -------------------------------------------------------------------
// Rerun/Replan Justification Review
// -------------------------------------------------------------------

export interface RerunJustificationReview {
  justified: boolean;
  reasons: string[];
  concerns: string[];
  recommendation: "approve_rerun" | "approve_with_changes" | "stop" | "needs_discussion";
}

/**
 * Review whether a proposed rerun or replan is scientifically justified.
 */
export function reviewRerunJustification(
  analysis: ExperimentAnalysisResult,
  currentRound: number,
  maxRounds: number,
  consecutiveFailures: number,
): RerunJustificationReview {
  const reasons: string[] = [];
  const concerns: string[] = [];

  // Check if rerun makes sense
  const topCause = analysis.rootCauses[0];
  if (topCause) {
    if (topCause.category === "infrastructure_failure" || topCause.category === "oom") {
      reasons.push(`Infrastructure/resource issue (${topCause.category}) is fixable — rerun justified`);
    } else if (topCause.category === "negative_scientific_result") {
      concerns.push("Root cause is a negative scientific result — rerun unlikely to help");
    } else if (topCause.category === "data_issue") {
      reasons.push("Data issue detected — fix data pipeline and rerun");
    }
  }

  // Check round budget
  if (currentRound >= maxRounds) {
    concerns.push(`Already at max rounds (${maxRounds}) — no more reruns allowed`);
  } else if (currentRound >= maxRounds - 1) {
    concerns.push("Last available round — make changes count");
  }

  // Check consecutive failures
  if (consecutiveFailures >= 3) {
    concerns.push(`${consecutiveFailures} consecutive failures — likely a fundamental issue, not transient`);
  }

  // Check if recommendations include meaningful changes
  const hasChanges = analysis.recommendations.some(r =>
    r.action === "rerun_with_fixes" || r.action === "redesign_experiment"
  );
  if (!hasChanges) {
    concerns.push("No concrete changes proposed — rerun would repeat the same failure");
  } else {
    reasons.push("Analysis proposes specific changes for the rerun");
  }

  // Determine recommendation
  let recommendation: RerunJustificationReview["recommendation"];
  if (concerns.some(c => c.includes("no more reruns") || c.includes("negative scientific result"))) {
    recommendation = "stop";
  } else if (concerns.length > reasons.length) {
    recommendation = "needs_discussion";
  } else if (hasChanges) {
    recommendation = "approve_with_changes";
  } else {
    recommendation = "approve_rerun";
  }

  const justified = recommendation === "approve_rerun" || recommendation === "approve_with_changes";

  return { justified, reasons, concerns, recommendation };
}

// -------------------------------------------------------------------
// Helper
// -------------------------------------------------------------------

function parseWalltimeHours(walltime: string): number {
  const match = walltime.match(/^(\d+)h/);
  return match ? parseInt(match[1], 10) : 24;
}
