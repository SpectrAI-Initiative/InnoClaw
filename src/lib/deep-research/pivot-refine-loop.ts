// =============================================================
// Deep Research — PIVOT / REFINE Decision Loop
// =============================================================
// Autonomous research decision system that decides whether to:
//   PROCEED — continue with current direction
//   REFINE — tweak parameters and re-run
//   PIVOT  — change research direction entirely
// Ported from AutoResearchClaw's Stage 15 (RESEARCH_DECISION).

import { generateText } from "ai";
import type { LanguageModel } from "ai";
import { safeParseJson } from "./json-response";
import type {
  DeepResearchArtifact,
  DeepResearchSession,
  ResearchDecision,
  PivotDecision,
  RefineDecision,
  ResearchDecisionAction,
  ReviewAssessment,
  ClaimVerificationReport,
} from "./types";
import { tryQuickDecision as quickRuleDecision } from "./pivot-refine-utils";

// =============================================================
// Decision System Prompt
// =============================================================

const DECISION_SYSTEM_PROMPT = `You are an autonomous research decision engine. Your job is to analyze the current state of research and decide the next action.

You have three options:

1. **PROCEED** — The current direction is working well. Results are promising and the hypothesis is supported. Continue to final report generation.
   - Use when: Review confidence >= 0.6, results are consistent, no major issues

2. **REFINE** — The current direction is promising but needs adjustment. Tweak parameters and re-run.
   - Use when: Results are mixed, metrics can be improved, specific parameter changes are identified
   - Specify: Which parameters to change, what improvements are expected

3. **PIVOT** — The current direction is not working. Change the research direction.
   - Use when: Results are negative, hypothesis is contradicted, or a more promising alternative is identified
   - Specify: New direction, alternative hypotheses, what failed

4. **REQUEST_REVIEW** — Need more expert review before deciding.
   - Use when: Results are ambiguous, conflicting signals, need another review round

Consider:
- Review assessment scores and confidence
- Experiment results and metric quality
- Literature support for claims
- Budget remaining and time constraints
- Quality of evidence collected

Output as JSON:
{
  "action": "proceed" | "refine" | "pivot" | "request_review",
  "rationale": "Detailed reasoning for this decision",
  "confidence": 0.0-1.0,
  "newDirection": "New research direction (if pivoting)",
  "refinementTargets": ["specific target 1", "target 2"],
  "parameterChanges": {"param": "new_value"},
  "expectedImprovement": "What improvement is expected from refine/pivot",
  "suggestedNextNodes": ["node_type_1", "node_type_2"],
  "failureAnalysis": "What went wrong (if pivoting)",
  "alternativeHypotheses": ["alt hypothesis 1"]
}`;

// =============================================================
// Decision Context Builder
// =============================================================

interface DecisionContext {
  session: DeepResearchSession;
  reviewAssessments: ReviewAssessment[];
  experimentResults: DeepResearchArtifact[];
  claimVerification: ClaimVerificationReport | null;
  executionLoops: number;
  reviewerRounds: number;
  budgetRemaining: number;
}

function buildDecisionPrompt(ctx: DecisionContext): string {
  let prompt = "## Current Research State\n\n";

  // Review assessments
  if (ctx.reviewAssessments.length > 0) {
    prompt += "### Review Assessments\n";
    for (const review of ctx.reviewAssessments.slice(-2)) {
      prompt += `- **Verdict**: ${review.combinedVerdict}\n`;
      prompt += `- **Confidence**: ${(review.combinedConfidence * 100).toFixed(0)}%\n`;
      if (review.openIssues?.length) {
        prompt += `- **Open Issues**: ${review.openIssues.join(", ")}\n`;
      }
      if (review.needsMoreLiterature) {
        prompt += `- **Needs More Literature**: Yes (gaps: ${(review.literatureGaps ?? []).join(", ")})\n`;
      }
      if (review.needsExperimentalValidation) {
        prompt += `- **Needs Experimental Validation**: Yes\n`;
      }
      prompt += "\n";
    }
  }

  // Experiment results
  if (ctx.experimentResults.length > 0) {
    prompt += "### Experiment Results Summary\n";
    for (const exp of ctx.experimentResults.slice(-3)) {
      const content = exp.content as Record<string, unknown> | null;
      prompt += `- **${exp.title}**: ${JSON.stringify(content).slice(0, 300)}\n`;
    }
    prompt += "\n";
  }

  // Claim verification
  if (ctx.claimVerification) {
    prompt += "### Claim Verification\n";
    prompt += `- **Total Claims**: ${ctx.claimVerification.totalClaims}\n`;
    prompt += `- **Verified**: ${ctx.claimVerification.verifiedCount}\n`;
    prompt += `- **Unverified**: ${ctx.claimVerification.unverifiedCount}\n`;
    prompt += `- **Fabricated**: ${ctx.claimVerification.fabricatedCount}\n`;
    prompt += `- **Trust Score**: ${(ctx.claimVerification.overallTrustScore * 100).toFixed(0)}%\n`;
    if (ctx.claimVerification.recommendations.length > 0) {
      prompt += `- **Recommendations**: ${ctx.claimVerification.recommendations[0]}\n`;
    }
    prompt += "\n";
  }

  // Resource state
  prompt += "### Resource State\n";
  prompt += `- Execution loops used: ${ctx.executionLoops}/${ctx.session.config.maxExecutionLoops}\n`;
  prompt += `- Reviewer rounds used: ${ctx.reviewerRounds}/${ctx.session.config.maxReviewerRounds}\n`;
  prompt += `- Budget remaining: ${ctx.budgetRemaining.toLocaleString()} tokens\n`;
  prompt += `- Pivot count: ${(ctx.session as unknown as Record<string, unknown>).pivotCount ?? 0}\n`;
  prompt += "\n";

  prompt += "Based on this state, decide: PROCEED, REFINE, PIVOT, or REQUEST_REVIEW.";

  return prompt;
}

// =============================================================
// Main Decision Function
// =============================================================

export async function makeResearchDecision(
  ctx: DecisionContext,
  model: LanguageModel,
): Promise<ResearchDecision> {
  const userPrompt = buildDecisionPrompt(ctx);

  const result = await generateText({
    model,
    system: DECISION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    maxOutputTokens: 2048,
  });

  const parsed = safeParseJson(result.text);
  const action = (parsed.action as ResearchDecisionAction) ?? "proceed";

  const base: ResearchDecision = {
    action,
    rationale: (parsed.rationale as string) ?? "No rationale provided",
    confidence: (parsed.confidence as number) ?? 0.5,
    suggestedNextNodes: (parsed.suggestedNextNodes as string[]) ?? [],
    artifactVersionIncrement: action !== "proceed" ? 1 : 0,
  };

  if (action === "pivot") {
    return {
      ...base,
      action: "pivot",
      newDirection: (parsed.newDirection as string) ?? "Unspecified new direction",
      failureAnalysis: (parsed.failureAnalysis as string) ?? "No failure analysis",
      alternativeHypotheses: (parsed.alternativeHypotheses as string[]) ?? [],
    } as PivotDecision;
  }

  if (action === "refine") {
    return {
      ...base,
      action: "refine",
      refinementTargets: (parsed.refinementTargets as string[]) ?? [],
      parameterChanges: (parsed.parameterChanges as Record<string, unknown>) ?? {},
      expectedImprovement: (parsed.expectedImprovement as string) ?? "No expected improvement specified",
    } as RefineDecision;
  }

  return base;
}

// =============================================================
// Auto-Decision (Rule-Based Quick Path)
// =============================================================

/**
 * Quick rule-based decision (adapter for pivot-refine-utils).
 * Returns null if rules are inconclusive — caller should then call the LLM.
 */
export function tryQuickDecision(ctx: DecisionContext): ResearchDecision | null {
  return quickRuleDecision({
    reviewAssessments: ctx.reviewAssessments,
    claimVerification: ctx.claimVerification,
    executionLoops: ctx.executionLoops,
    maxExecutionLoops: ctx.session.config.maxExecutionLoops,
    budgetRemaining: ctx.budgetRemaining,
    maxBudget: ctx.session.config.budget.maxTotalTokens,
  });
}

// =============================================================
// PIVOT/REFINE Artifact Versioning
// =============================================================

// Re-exported from pivot-refine-utils.ts (pure functions, no server deps)
export { getArtifactVersionSuffix, buildPivotRefineOverlay } from "./pivot-refine-utils";
