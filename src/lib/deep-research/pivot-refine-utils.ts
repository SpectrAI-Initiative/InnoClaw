// =============================================================
// Deep Research — Pivot/Refine Utility Functions (pure, no server deps)
// =============================================================
// Extracted from pivot-refine-loop.ts to avoid pulling model-router
// and database dependencies into client bundles.

import type {
  ResearchDecision,
  PivotDecision,
  RefineDecision,
  ReviewAssessment,
  ClaimVerificationReport,
} from "./types";

/**
 * Quick rule-based decision before calling the LLM.
 * Returns null if rules are inconclusive.
 */
export function tryQuickDecision(ctx: {
  reviewAssessments: ReviewAssessment[];
  claimVerification: ClaimVerificationReport | null;
  executionLoops: number;
  maxExecutionLoops: number;
  budgetRemaining: number;
  maxBudget: number;
}): ResearchDecision | null {
  // Rule 1: If claim verification shows fabricated claims, PIVOT or REQUEST_REVIEW
  if (
    ctx.claimVerification &&
    ctx.claimVerification.fabricatedCount > 0
  ) {
    if (ctx.executionLoops >= ctx.maxExecutionLoops) {
      return {
        action: "request_review",
        rationale: "Fabricated claims detected and execution budget exhausted. Need human review.",
        confidence: 0.9,
        suggestedNextNodes: ["review"],
      };
    }
    return {
      action: "pivot",
      rationale: `${ctx.claimVerification.fabricatedCount} fabricated claims detected. Current direction is unreliable.`,
      confidence: 0.85,
      suggestedNextNodes: ["intake", "plan"],
      newDirection: "Re-evaluate research direction with verified evidence",
      failureAnalysis: "Claims contradicted by collected evidence",
      alternativeHypotheses: [],
    } as PivotDecision;
  }

  // Rule 2: If review confidence is very low (< 0.3), PIVOT
  const lastReview = ctx.reviewAssessments[ctx.reviewAssessments.length - 1];
  if (lastReview && lastReview.combinedConfidence < 0.3) {
    return {
      action: "pivot",
      rationale: `Review confidence is critically low (${(lastReview.combinedConfidence * 100).toFixed(0)}%). Current direction is not promising.`,
      confidence: 0.8,
      suggestedNextNodes: ["intake", "plan"],
      newDirection: "Explore alternative research directions",
      failureAnalysis: "Review assessment indicates insufficient or contradictory results",
      alternativeHypotheses: [],
    } as PivotDecision;
  }

  // Rule 3: If review confidence is moderate (0.3-0.6), REFINE
  if (
    lastReview &&
    lastReview.combinedConfidence >= 0.3 &&
    lastReview.combinedConfidence < 0.6
  ) {
    return {
      action: "refine",
      rationale: `Review confidence is moderate (${(lastReview.combinedConfidence * 100).toFixed(0)}%). Refinement needed.`,
      confidence: 0.7,
      suggestedNextNodes: ["execute", "review"],
      refinementTargets: lastReview.suggestedExperiments ?? [],
      parameterChanges: {},
      expectedImprovement: "Improve metric quality and review confidence to >= 0.6",
    } as RefineDecision;
  }

  // Rule 4: If review confidence is high and no issues, PROCEED
  if (
    lastReview &&
    lastReview.combinedConfidence >= 0.6 &&
    lastReview.combinedVerdict === "approve" &&
    !lastReview.needsMoreLiterature &&
    !lastReview.needsExperimentalValidation
  ) {
    return {
      action: "proceed",
      rationale: `Review confidence is high (${(lastReview.combinedConfidence * 100).toFixed(0)}%) with no outstanding issues. Ready to finalize.`,
      confidence: 0.9,
      suggestedNextNodes: ["final_report"],
    };
  }

  // Rule 5: If out of execution loops, force PROCEED
  if (ctx.executionLoops >= ctx.maxExecutionLoops) {
    return {
      action: "proceed",
      rationale: "Maximum execution loops reached. Proceeding with available results.",
      confidence: 0.6,
      suggestedNextNodes: ["final_report"],
    };
  }

  // Rule 6: Budget nearly exhausted
  if (ctx.budgetRemaining < ctx.maxBudget * 0.1) {
    return {
      action: "proceed",
      rationale: `Budget nearly exhausted (${ctx.budgetRemaining} tokens remaining). Finalizing with current results.`,
      confidence: 0.7,
      suggestedNextNodes: ["final_report"],
    };
  }

  // Inconclusive — need LLM decision
  return null;
}

/**
 * Generate a version suffix for artifacts when pivoting or refining.
 */
export function getArtifactVersionSuffix(
  decision: ResearchDecision,
  currentVersion: number = 1,
): string {
  if (decision.action === "proceed") return "";

  const newVersion =
    (decision.artifactVersionIncrement ?? 1) + currentVersion;

  if (decision.action === "pivot") {
    return `_pivot_v${newVersion}`;
  }
  if (decision.action === "refine") {
    return `_refine_v${newVersion}`;
  }
  return `_v${newVersion}`;
}

/**
 * Build prompt overlay describing the PIVOT/REFINE decision.
 */
export function buildPivotRefineOverlay(
  decision: ResearchDecision,
): string {
  let overlay = "\n\n## Research Decision: ";

  switch (decision.action) {
    case "proceed":
      overlay += "PROCEED\n\n";
      overlay += `**Rationale**: ${decision.rationale}\n`;
      overlay += `**Confidence**: ${(decision.confidence * 100).toFixed(0)}%\n`;
      overlay += "Continuing with current research direction.\n";
      break;

    case "refine": {
      const refine = decision as RefineDecision;
      overlay += "REFINE\n\n";
      overlay += `**Rationale**: ${refine.rationale}\n`;
      overlay += `**Confidence**: ${(refine.confidence * 100).toFixed(0)}%\n`;
      overlay += `**Refinement Targets**:\n`;
      for (const target of refine.refinementTargets) {
        overlay += `  - ${target}\n`;
      }
      if (Object.keys(refine.parameterChanges).length > 0) {
        overlay += `**Parameter Changes**:\n`;
        for (const [key, value] of Object.entries(refine.parameterChanges)) {
          overlay += `  - ${key}: ${JSON.stringify(value)}\n`;
        }
      }
      overlay += `**Expected Improvement**: ${refine.expectedImprovement}\n`;
      overlay += "Apply these refinements and re-run the experiment.\n";
      break;
    }

    case "pivot": {
      const pivot = decision as PivotDecision;
      overlay += "PIVOT\n\n";
      overlay += `**Rationale**: ${pivot.rationale}\n`;
      overlay += `**Confidence**: ${(pivot.confidence * 100).toFixed(0)}%\n`;
      overlay += `**New Direction**: ${pivot.newDirection}\n`;
      overlay += `**Failure Analysis**: ${pivot.failureAnalysis}\n`;
      if (pivot.alternativeHypotheses.length > 0) {
        overlay += `**Alternative Hypotheses**:\n`;
        for (const h of pivot.alternativeHypotheses) {
          overlay += `  - ${h}\n`;
        }
      }
      overlay += "Change research direction and explore alternatives.\n";
      break;
    }

    case "request_review":
      overlay += "REQUEST_REVIEW\n\n";
      overlay += `**Rationale**: ${decision.rationale}\n`;
      overlay += "Results are ambiguous — requesting additional expert review.\n";
      break;
  }

  return overlay;
}
