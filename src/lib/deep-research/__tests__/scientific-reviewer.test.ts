// =============================================================
// Tests: Enhanced Scientific Reviewer
// =============================================================
// Covers: issue tracking, acceptance gating, anti-pattern detection,
// pass/revise/block routing, anti-loop enforcement, revision requests,
// example fixtures (weak → critique → revision → pass)

import { describe, it, expect, beforeEach } from "vitest";

import type {
  ScientificReviewPacket,
  ScientificBlocker,
  RepairPath,
  DimensionScore,
  ReviewDimension,
  ScientificVerdict,
  ReviewIssue,
  AntiPatternFlag,
  AntiPatternType,
  ReviewRevisionRequest,
  ClaimMap,
} from "../types";

import {
  ALL_DIMENSIONS,
  DIMENSION_LABELS,
  ALL_ANTI_PATTERNS,
  PASS_RUBRIC,
  resetIssueCounter,
  generateIssueId,
  blockerToIssue,
  mergeIssueLedger,
  finalizeIssueStatuses,
  checkAcceptanceGate,
  buildRevisionRequest,
  enforceAntiLoop,
  checkDimensionConvergence,
  buildScientificReviewPrompt,
} from "../scientific-reviewer";

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function makeBlocker(issue: string, severity: "critical" | "major" | "minor" = "critical"): ScientificBlocker {
  return {
    issue,
    severity,
    whyItMatters: `${issue} matters`,
    evidenceForIssue: "evidence",
    repairAction: `fix ${issue}`,
    passCondition: `${issue} is fixed`,
  };
}

function makePacket(overrides: Partial<ScientificReviewPacket> = {}): ScientificReviewPacket {
  return {
    reviewerRole: "reviewer_a",
    round: 1,
    dimensions: ALL_DIMENSIONS.map(dim => ({
      dimension: dim,
      score: 4,
      justification: `${dim} is fine`,
    })),
    overallScore: 4.0,
    verdict: "pass",
    criticalBlockers: [],
    majorIssues: [],
    minorSuggestions: [],
    repairPaths: [],
    passConditions: [],
    antiPatternFlags: [],
    ...overrides,
  };
}

// -------------------------------------------------------------------
// Dimension coverage
// -------------------------------------------------------------------

describe("Dimensions", () => {
  it("has 13 dimensions", () => {
    expect(ALL_DIMENSIONS.length).toBe(13);
  });

  it("includes the 3 new dimensions", () => {
    expect(ALL_DIMENSIONS).toContain("novelty_positioning");
    expect(ALL_DIMENSIONS).toContain("reproducibility");
    expect(ALL_DIMENSIONS).toContain("overclaiming_risk");
  });

  it("has a label for every dimension", () => {
    for (const dim of ALL_DIMENSIONS) {
      expect(DIMENSION_LABELS[dim]).toBeDefined();
      expect(typeof DIMENSION_LABELS[dim]).toBe("string");
    }
  });
});

// -------------------------------------------------------------------
// Anti-pattern detection
// -------------------------------------------------------------------

describe("Anti-pattern detection", () => {
  it("defines 10 anti-pattern types", () => {
    expect(ALL_ANTI_PATTERNS.length).toBe(10);
  });

  it("includes key anti-patterns", () => {
    expect(ALL_ANTI_PATTERNS).toContain("citation_hallucination");
    expect(ALL_ANTI_PATTERNS).toContain("benchmark_mismatch");
    expect(ALL_ANTI_PATTERNS).toContain("metric_cherry_picking");
    expect(ALL_ANTI_PATTERNS).toContain("unfounded_generalization");
    expect(ALL_ANTI_PATTERNS).toContain("circular_reasoning");
  });

  it("anti-pattern flags are included in prompt", () => {
    const prompt = buildScientificReviewPrompt(
      "reviewer_a", [], [], 1, 3,
    );
    for (const ap of ALL_ANTI_PATTERNS) {
      expect(prompt).toContain(ap);
    }
    expect(prompt).toContain("Anti-Pattern Checklist");
  });
});

// -------------------------------------------------------------------
// Issue tracking
// -------------------------------------------------------------------

describe("Issue tracking", () => {
  beforeEach(() => {
    resetIssueCounter();
  });

  it("generates sequential issue IDs", () => {
    expect(generateIssueId()).toBe("ISS-001");
    expect(generateIssueId()).toBe("ISS-002");
    expect(generateIssueId()).toBe("ISS-003");
  });

  it("resets issue counter", () => {
    generateIssueId();
    generateIssueId();
    resetIssueCounter();
    expect(generateIssueId()).toBe("ISS-001");
  });

  it("creates an issue from a blocker", () => {
    const blocker = makeBlocker("Missing baselines");
    const issue = blockerToIssue(blocker, 1, "reviewer_a");

    expect(issue.issueId).toBe("ISS-001");
    expect(issue.raisedInRound).toBe(1);
    expect(issue.raisedBy).toBe("reviewer_a");
    expect(issue.status).toBe("open");
    expect(issue.severity).toBe("critical");
    expect(issue.title).toBe("Missing baselines");
    expect(issue.statusHistory).toHaveLength(1);
    expect(issue.statusHistory[0].status).toBe("open");
  });

  it("merges new blockers into empty ledger", () => {
    const blockers = [
      makeBlocker("Issue A"),
      makeBlocker("Issue B", "major"),
    ];
    const { ledger, blockerToIssueMap } = mergeIssueLedger([], blockers, 1, "reviewer_a");

    expect(ledger).toHaveLength(2);
    expect(blockerToIssueMap.size).toBe(2);
    expect(ledger[0].issueId).toBe("ISS-001");
    expect(ledger[1].issueId).toBe("ISS-002");
  });

  it("matches existing issues by title in round 2", () => {
    const round1Blockers = [makeBlocker("Missing baselines")];
    const { ledger: ledger1 } = mergeIssueLedger([], round1Blockers, 1, "reviewer_a");

    // Same blocker in round 2 — should match, not create new
    const round2Blockers = [makeBlocker("Missing baselines")];
    const { ledger: ledger2, blockerToIssueMap } = mergeIssueLedger(ledger1, round2Blockers, 2, "reviewer_a");

    expect(ledger2).toHaveLength(1);
    expect(blockerToIssueMap.get(0)).toBe("ISS-001");
    expect(ledger2[0].statusHistory).toHaveLength(2);
  });

  it("marks issues as partially_resolved when not re-raised", () => {
    const round1Blockers = [makeBlocker("Issue A"), makeBlocker("Issue B")];
    const { ledger: ledger1 } = mergeIssueLedger([], round1Blockers, 1, "reviewer_a");

    // Only re-raise Issue A in round 2
    const round2Blockers = [makeBlocker("Issue A")];
    const { ledger: ledger2 } = mergeIssueLedger(ledger1, round2Blockers, 2, "reviewer_a");

    const issueA = ledger2.find(i => i.title === "Issue A");
    const issueB = ledger2.find(i => i.title === "Issue B");

    expect(issueA!.status).toBe("open");
    expect(issueB!.status).toBe("partially_resolved");
  });

  it("finalizes issues as resolved when neither reviewer raises them", () => {
    const blockers = [makeBlocker("Issue X")];
    const { ledger } = mergeIssueLedger([], blockers, 1, "reviewer_a");

    // Neither reviewer raises it in round 2
    const finalized = finalizeIssueStatuses(ledger, 2, new Set(), new Set());

    expect(finalized[0].status).toBe("resolved");
    expect(finalized[0].statusHistory.slice(-1)[0].status).toBe("resolved");
  });

  it("keeps issues open when at least one reviewer raises them", () => {
    const blockers = [makeBlocker("Issue X")];
    const { ledger } = mergeIssueLedger([], blockers, 1, "reviewer_a");

    const finalized = finalizeIssueStatuses(ledger, 2, new Set(["ISS-001"]), new Set());
    expect(finalized[0].status).not.toBe("resolved");
  });

  it("tracks full status history across multiple rounds", () => {
    // Round 1: Issue raised
    const { ledger: r1 } = mergeIssueLedger([], [makeBlocker("Flawed metric")], 1, "reviewer_a");
    expect(r1[0].statusHistory).toHaveLength(1);

    // Round 2: Still raised
    const { ledger: r2 } = mergeIssueLedger(r1, [makeBlocker("Flawed metric")], 2, "reviewer_a");
    expect(r2[0].statusHistory).toHaveLength(2);

    // Round 3: Not raised anymore → finalized as resolved
    const r3 = finalizeIssueStatuses(r2, 3, new Set(), new Set());
    expect(r3[0].statusHistory).toHaveLength(3);
    expect(r3[0].status).toBe("resolved");
  });
});

// -------------------------------------------------------------------
// Acceptance gating
// -------------------------------------------------------------------

describe("Acceptance gating", () => {
  beforeEach(() => {
    resetIssueCounter();
  });

  it("accepts when all criteria met", () => {
    const packetA = makePacket({ reviewerRole: "reviewer_a" });
    const packetB = makePacket({ reviewerRole: "reviewer_b" });
    const { accepted, reasons } = checkAcceptanceGate(packetA, packetB, []);

    expect(accepted).toBe(true);
    expect(reasons).toHaveLength(0);
  });

  it("rejects when critical issues are open", () => {
    const packetA = makePacket();
    const packetB = makePacket({ reviewerRole: "reviewer_b" });
    const issue: ReviewIssue = {
      ...blockerToIssue(makeBlocker("Critical problem"), 1, "reviewer_a"),
      status: "open",
    };

    const { accepted, reasons } = checkAcceptanceGate(packetA, packetB, [issue]);
    expect(accepted).toBe(false);
    expect(reasons.some(r => r.includes("critical issue"))).toBe(true);
  });

  it("rejects when dimension scores are below minimum", () => {
    const packetA = makePacket({
      dimensions: ALL_DIMENSIONS.map(dim => ({
        dimension: dim,
        score: dim === "reproducibility" ? 2 : 4,
        justification: "test",
      })),
    });
    const packetB = makePacket({ reviewerRole: "reviewer_b" });

    const { accepted, reasons } = checkAcceptanceGate(packetA, packetB, []);
    expect(accepted).toBe(false);
    expect(reasons.some(r => r.includes("reproducibility"))).toBe(true);
  });

  it("rejects when critical anti-patterns are detected", () => {
    const packetA = makePacket({
      antiPatternFlags: [{
        pattern: "citation_hallucination",
        location: "Claim c3",
        description: "Fabricated source",
        severity: "critical",
        suggestedFix: "Remove claim",
      }],
    });
    const packetB = makePacket({ reviewerRole: "reviewer_b" });

    const { accepted, reasons } = checkAcceptanceGate(packetA, packetB, []);
    expect(accepted).toBe(false);
    expect(reasons.some(r => r.includes("anti-pattern"))).toBe(true);
  });

  it("rejects when overall average is too low", () => {
    const lowDims = ALL_DIMENSIONS.map(dim => ({
      dimension: dim,
      score: 3,
      justification: "barely acceptable",
    }));
    const packetA = makePacket({ dimensions: lowDims, overallScore: 3.0 });
    const packetB = makePacket({ reviewerRole: "reviewer_b", dimensions: lowDims, overallScore: 3.0 });

    const { accepted, reasons } = checkAcceptanceGate(packetA, packetB, []);
    expect(accepted).toBe(false);
    expect(reasons.some(r => r.includes("average"))).toBe(true);
  });

  it("rejects when too many major issues are open", () => {
    const issues: ReviewIssue[] = Array.from({ length: 4 }, (_, i) => ({
      ...blockerToIssue(makeBlocker(`Major issue ${i}`, "major"), 1, "reviewer_a"),
      status: "open" as const,
    }));

    const packetA = makePacket();
    const packetB = makePacket({ reviewerRole: "reviewer_b" });

    const { accepted } = checkAcceptanceGate(packetA, packetB, issues);
    expect(accepted).toBe(false);
  });

  it("prevents unjustified pass when critical blockers remain", () => {
    // Reviewer says "pass" but there's an open critical issue
    const packetA = makePacket({ verdict: "pass" });
    const packetB = makePacket({ reviewerRole: "reviewer_b", verdict: "pass" });
    const issue: ReviewIssue = {
      ...blockerToIssue(makeBlocker("Unfixed critical"), 1, "reviewer_a"),
      status: "open",
    };

    const gate = checkAcceptanceGate(packetA, packetB, [issue]);
    expect(gate.accepted).toBe(false);
    // The enforceAntiLoop + applyAcceptanceGate would downgrade the verdict
  });
});

// -------------------------------------------------------------------
// Anti-loop enforcement
// -------------------------------------------------------------------

describe("Anti-loop enforcement (enhanced)", () => {
  it("round 1 caps critical blockers at 5", () => {
    const packet = makePacket({
      verdict: "revise",
      criticalBlockers: Array.from({ length: 7 }, (_, i) => makeBlocker(`Blocker ${i}`)),
    });
    const enforced = enforceAntiLoop(packet, 1, 3, []);
    expect(enforced.criticalBlockers.length).toBe(5);
  });

  it("round 2 limits new critical blockers to 1", () => {
    const round1Packet = makePacket({
      verdict: "revise",
      criticalBlockers: [makeBlocker("Prior issue")],
    });

    const round2Packet = makePacket({
      verdict: "revise",
      criticalBlockers: [
        makeBlocker("Prior issue"),      // carried over
        makeBlocker("New issue 1"),      // new
        makeBlocker("New issue 2"),      // new — should be dropped
      ],
    });

    const enforced = enforceAntiLoop(round2Packet, 2, 3, [round1Packet]);
    // Should have: 1 carried + 1 new = 2
    expect(enforced.criticalBlockers.length).toBe(2);
  });

  it("final round forces terminal verdict — no revise", () => {
    const packet = makePacket({
      verdict: "revise",
      dimensions: ALL_DIMENSIONS.map(dim => ({ dimension: dim, score: 4, justification: "ok" })),
    });
    const enforced = enforceAntiLoop(packet, 3, 3, []);
    expect(enforced.verdict).not.toBe("revise");
    expect(["pass", "experimental_pivot", "reject"]).toContain(enforced.verdict);
  });

  it("final round clears all blockers", () => {
    const packet = makePacket({
      verdict: "revise",
      criticalBlockers: [makeBlocker("Something")],
      majorIssues: [makeBlocker("Major thing", "major")],
    });
    const enforced = enforceAntiLoop(packet, 3, 3, []);
    expect(enforced.criticalBlockers).toHaveLength(0);
    expect(enforced.majorIssues).toHaveLength(0);
  });

  it("final round with low scores forces reject", () => {
    const packet = makePacket({
      verdict: "revise",
      dimensions: ALL_DIMENSIONS.map(dim => ({ dimension: dim, score: 2, justification: "bad" })),
    });
    const enforced = enforceAntiLoop(packet, 3, 3, []);
    expect(enforced.verdict).toBe("reject");
  });

  it("final round with adequate scores forces experimental_pivot", () => {
    const packet = makePacket({
      verdict: "revise",
      dimensions: ALL_DIMENSIONS.map(dim => ({ dimension: dim, score: 3, justification: "ok" })),
    });
    const enforced = enforceAntiLoop(packet, 3, 3, []);
    expect(enforced.verdict).toBe("experimental_pivot");
  });

  it("prevents endless reject loops by forcing decision at max round", () => {
    // Even if a reviewer keeps saying "revise", round 3 forces a terminal choice
    const round1 = makePacket({ round: 1, verdict: "revise" });
    const round2 = makePacket({ round: 2, verdict: "revise" });
    const round3 = makePacket({
      round: 3,
      verdict: "revise",
      dimensions: ALL_DIMENSIONS.map(dim => ({ dimension: dim, score: 4, justification: "ok" })),
    });
    const enforced = enforceAntiLoop(round3, 3, 3, [round1, round2]);
    expect(enforced.verdict).not.toBe("revise");
  });
});

// -------------------------------------------------------------------
// Convergence checking
// -------------------------------------------------------------------

describe("Convergence", () => {
  it("converges when same verdict and close scores", () => {
    const a = makePacket({ verdict: "pass", reviewerRole: "reviewer_a" });
    const b = makePacket({ verdict: "pass", reviewerRole: "reviewer_b" });
    expect(checkDimensionConvergence(a, b, 1)).toBe(true);
  });

  it("does not converge with different verdicts", () => {
    const a = makePacket({ verdict: "pass" });
    const b = makePacket({ verdict: "revise", reviewerRole: "reviewer_b" });
    expect(checkDimensionConvergence(a, b, 1)).toBe(false);
  });

  it("does not converge with divergent scores", () => {
    const a = makePacket({
      dimensions: ALL_DIMENSIONS.map(dim => ({ dimension: dim, score: 5, justification: "great" })),
    });
    const b = makePacket({
      reviewerRole: "reviewer_b",
      dimensions: ALL_DIMENSIONS.map(dim => ({ dimension: dim, score: 2, justification: "bad" })),
    });
    expect(checkDimensionConvergence(a, b, 1)).toBe(false);
  });
});

// -------------------------------------------------------------------
// Revision request building
// -------------------------------------------------------------------

describe("Revision request building", () => {
  beforeEach(() => {
    resetIssueCounter();
  });

  it("builds revision request from review packets", () => {
    const blockerA = makeBlocker("Missing baselines");
    const blockerB = makeBlocker("Overclaiming on dataset X", "major");

    const packetA = makePacket({
      verdict: "revise",
      criticalBlockers: [blockerA],
    });
    const packetB = makePacket({
      reviewerRole: "reviewer_b",
      verdict: "revise",
      majorIssues: [blockerB],
    });

    const issueA = blockerToIssue(blockerA, 1, "reviewer_a");
    const issueB = blockerToIssue(blockerB, 1, "reviewer_b");

    const request = buildRevisionRequest(1, packetA, packetB, [issueA, issueB], "artifact-123");

    expect(request.fromRound).toBe(1);
    expect(request.targetClaimMapId).toBe("artifact-123");
    expect(request.issueIds).toContain(issueA.issueId);
    expect(request.issueIds).toContain(issueB.issueId);
    expect(request.revisionPoints.length).toBeGreaterThanOrEqual(2);
  });

  it("includes low-scoring dimensions as revision points", () => {
    const packetA = makePacket({
      verdict: "revise",
      dimensions: ALL_DIMENSIONS.map(dim => ({
        dimension: dim,
        score: dim === "reproducibility" ? 2 : 4,
        justification: dim === "reproducibility" ? "No reproduction details" : "Fine",
        suggestedImprovement: dim === "reproducibility" ? "Add reproduction steps" : undefined,
      })),
    });
    const packetB = makePacket({ reviewerRole: "reviewer_b", verdict: "revise" });

    const request = buildRevisionRequest(1, packetA, packetB, [], "artifact-123");
    const reproPoint = request.revisionPoints.find(rp => rp.target.includes("reproducibility"));
    expect(reproPoint).toBeDefined();
    expect(reproPoint!.expectedOutcome).toContain("reproduction");
  });

  it("includes anti-patterns to fix", () => {
    const flag: AntiPatternFlag = {
      pattern: "citation_hallucination",
      location: "Claim c5",
      description: "Source does not exist",
      severity: "critical",
      suggestedFix: "Remove claim",
    };
    const packetA = makePacket({ verdict: "revise", antiPatternFlags: [flag] });
    const packetB = makePacket({ reviewerRole: "reviewer_b", verdict: "revise" });

    const request = buildRevisionRequest(1, packetA, packetB, [], "artifact-123");
    expect(request.antiPatternsToFix).toHaveLength(1);
    expect(request.antiPatternsToFix[0].pattern).toBe("citation_hallucination");
  });

  it("deduplicates revision points by target", () => {
    const blocker = makeBlocker("Same issue");
    const packetA = makePacket({ verdict: "revise", criticalBlockers: [blocker] });
    const packetB = makePacket({ reviewerRole: "reviewer_b", verdict: "revise", criticalBlockers: [blocker] });

    const request = buildRevisionRequest(1, packetA, packetB, [], "artifact-123");
    const matching = request.revisionPoints.filter(rp => rp.target === "Same issue");
    expect(matching).toHaveLength(1);
  });
});

// -------------------------------------------------------------------
// Pass rubric
// -------------------------------------------------------------------

describe("Pass rubric", () => {
  it("defines minimum thresholds", () => {
    expect(PASS_RUBRIC.minimumPerDimension).toBe(3);
    expect(PASS_RUBRIC.minimumOverallAverage).toBe(3.5);
    expect(PASS_RUBRIC.zeroCriticalBlockers).toBe(true);
    expect(PASS_RUBRIC.zeroCriticalAntiPatterns).toBe(true);
    expect(PASS_RUBRIC.maxOpenMajorIssues).toBe(2);
  });

  it("prompt includes pass rubric", () => {
    const prompt = buildScientificReviewPrompt("reviewer_a", [], [], 1, 3);
    expect(prompt).toContain("Pass Rubric");
    expect(prompt).toContain(String(PASS_RUBRIC.minimumPerDimension));
    expect(prompt).toContain(String(PASS_RUBRIC.minimumOverallAverage));
    expect(prompt).toContain("MUST NOT verdict \"pass\"");
  });
});

// -------------------------------------------------------------------
// Prompt structure
// -------------------------------------------------------------------

describe("Prompt structure", () => {
  it("includes issue ledger when provided", () => {
    resetIssueCounter();
    const issue: ReviewIssue = {
      ...blockerToIssue(makeBlocker("Test issue"), 1, "reviewer_a"),
    };

    const prompt = buildScientificReviewPrompt(
      "reviewer_a", [], [], 2, 3,
      undefined,
      [issue],
    );

    expect(prompt).toContain("Issue Ledger");
    expect(prompt).toContain("ISS-001");
    expect(prompt).toContain("Test issue");
  });

  it("includes all 13 dimensions in prompt", () => {
    const prompt = buildScientificReviewPrompt("reviewer_a", [], [], 1, 3);
    for (const dim of ALL_DIMENSIONS) {
      expect(prompt).toContain(dim);
    }
  });

  it("final round prompt disallows revise", () => {
    const prompt = buildScientificReviewPrompt("reviewer_a", [], [], 3, 3);
    expect(prompt).toContain("FORCED DECISION");
    expect(prompt).toContain("\"revise\" is NOT allowed");
  });
});

// -------------------------------------------------------------------
// Example fixture: weak synthesis → critique → revision → pass
// -------------------------------------------------------------------

describe("Example fixture: review lifecycle", () => {
  beforeEach(() => {
    resetIssueCounter();
  });

  it("models a full weak → critique → revision → pass cycle", () => {
    // === Round 1: Weak synthesis gets critiqued ===

    // Reviewer A finds critical issues
    const round1A = makePacket({
      reviewerRole: "reviewer_a",
      round: 1,
      verdict: "revise",
      overallScore: 2.5,
      dimensions: ALL_DIMENSIONS.map(dim => ({
        dimension: dim,
        score: dim === "baseline_coverage" ? 1 : dim === "overclaiming_risk" ? 2 : 3,
        justification: `Round 1 assessment of ${dim}`,
      })),
      criticalBlockers: [
        makeBlocker("No baseline comparison with SOTA methods"),
      ],
      majorIssues: [
        makeBlocker("Claims exceed evidence strength", "major"),
      ],
      antiPatternFlags: [{
        pattern: "unfounded_generalization",
        location: "Claim c2",
        description: "Generalizes from single dataset",
        severity: "major",
        suggestedFix: "Add caveat about limited scope",
      }],
    });

    // Reviewer B concurs
    const round1B = makePacket({
      reviewerRole: "reviewer_b",
      round: 1,
      verdict: "revise",
      overallScore: 2.8,
      criticalBlockers: [
        makeBlocker("No baseline comparison with SOTA methods"),
      ],
    });

    // Build issue ledger from round 1
    // Merge reviewer A's blockers first, then reviewer B's
    const merge1A = mergeIssueLedger([], round1A.criticalBlockers, 1, "reviewer_a");
    const merge1B = mergeIssueLedger(merge1A.ledger, round1B.criticalBlockers, 1, "reviewer_b");
    const merge1MajorA = mergeIssueLedger(merge1B.ledger, round1A.majorIssues, 1, "reviewer_a");

    // Finalize: both reviewers raised the baseline issue
    const aIds1 = new Set(merge1A.blockerToIssueMap.values());
    const bIds1 = new Set(merge1B.blockerToIssueMap.values());
    let ledger = finalizeIssueStatuses(merge1MajorA.ledger, 1, aIds1, bIds1);

    expect(ledger.length).toBeGreaterThanOrEqual(2);

    const baselineIssue = ledger.find(i => i.title.includes("baseline"));
    expect(baselineIssue).toBeDefined();
    // Both reviewers raised it, so it stays open
    expect(["open", "partially_resolved"]).toContain(baselineIssue!.status);

    // Acceptance gate should FAIL for round 1
    const gate1 = checkAcceptanceGate(round1A, round1B, ledger);
    expect(gate1.accepted).toBe(false);

    // Build revision request
    const revisionReq = buildRevisionRequest(1, round1A, round1B, ledger, "claim-map-v1");
    expect(revisionReq.revisionPoints.length).toBeGreaterThan(0);
    expect(revisionReq.antiPatternsToFix.length).toBeGreaterThan(0);

    // === Round 2: After synthesizer revision, issues are addressed ===

    // Reviewer A sees improvement
    const round2A = makePacket({
      reviewerRole: "reviewer_a",
      round: 2,
      verdict: "pass",
      overallScore: 4.0,
      dimensions: ALL_DIMENSIONS.map(dim => ({
        dimension: dim,
        score: 4,
        justification: `Improved in round 2`,
      })),
      criticalBlockers: [], // Baseline issue resolved!
      majorIssues: [],
      antiPatternFlags: [],
    });

    const round2B = makePacket({
      reviewerRole: "reviewer_b",
      round: 2,
      verdict: "pass",
      overallScore: 4.2,
      dimensions: ALL_DIMENSIONS.map(dim => ({
        dimension: dim,
        score: 4,
        justification: `Improved in round 2`,
      })),
      criticalBlockers: [],
    });

    // Finalize issue statuses — nobody raised baseline issue
    const aIds = new Set<string>();
    const bIds = new Set<string>();
    ledger = finalizeIssueStatuses(ledger, 2, aIds, bIds);

    const resolvedBaseline = ledger.find(i => i.title.includes("baseline"));
    expect(resolvedBaseline!.status).toBe("resolved");

    // Acceptance gate should PASS for round 2
    const gate2 = checkAcceptanceGate(round2A, round2B, ledger);
    expect(gate2.accepted).toBe(true);

    // Convergence should be true (same verdict, close scores)
    expect(checkDimensionConvergence(round2A, round2B, 1)).toBe(true);
  });

  it("models rejection when critical issues persist through all rounds", () => {
    // Persistent critical issue that never gets fixed
    const persistentBlocker = makeBlocker("Fundamental methodology flaw");

    // Round 1
    const r1A = makePacket({ verdict: "revise", criticalBlockers: [persistentBlocker] });
    const r1B = makePacket({ reviewerRole: "reviewer_b", verdict: "revise", criticalBlockers: [persistentBlocker] });

    const { ledger: ledger1 } = mergeIssueLedger([], [...r1A.criticalBlockers, ...r1B.criticalBlockers], 1, "reviewer_a");

    // Round 2: Still not fixed
    const r2A = makePacket({ round: 2, verdict: "revise", criticalBlockers: [persistentBlocker] });
    const { ledger: ledger2 } = mergeIssueLedger(ledger1, r2A.criticalBlockers, 2, "reviewer_a");

    // Issue still open
    expect(ledger2[0].status).toBe("open");

    // Round 3: Forced terminal — with low scores → reject
    const r3A = makePacket({
      round: 3,
      verdict: "revise",
      dimensions: ALL_DIMENSIONS.map(dim => ({ dimension: dim, score: 2, justification: "still bad" })),
      criticalBlockers: [persistentBlocker],
    });

    const enforced = enforceAntiLoop(r3A, 3, 3, [r1A, r2A]);
    expect(enforced.verdict).toBe("reject");
    expect(enforced.criticalBlockers).toHaveLength(0); // Cleared by anti-loop
  });
});

// -------------------------------------------------------------------
// Schema validation (updated for 13 dimensions)
// -------------------------------------------------------------------

describe("ScientificReviewPacket schema (13 dimensions)", () => {
  it("validates a packet with all 13 dimensions", () => {
    const packet = makePacket({
      dimensions: ALL_DIMENSIONS.map(dim => ({
        dimension: dim,
        score: 4,
        justification: `${dim} assessed`,
      })),
    });

    expect(packet.dimensions).toHaveLength(13);
    for (const dim of ALL_DIMENSIONS) {
      expect(packet.dimensions.find(d => d.dimension === dim)).toBeDefined();
    }
  });

  it("includes optional trackedIssues and antiPatternFlags", () => {
    const packet = makePacket({
      trackedIssues: [blockerToIssue(makeBlocker("test"), 1, "reviewer_a")],
      antiPatternFlags: [{
        pattern: "citation_hallucination",
        location: "c1",
        description: "fake",
        severity: "critical",
        suggestedFix: "remove",
      }],
    });

    expect(packet.trackedIssues).toHaveLength(1);
    expect(packet.antiPatternFlags).toHaveLength(1);
  });
});
