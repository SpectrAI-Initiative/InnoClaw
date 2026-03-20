// =============================================================
// Phase: Reviewer Deliberation
// =============================================================
// Supports two review paths:
//   1. Scientific Review (structured, dimension-based) — when scientificReview config is set
//      - Includes synthesizer-facing revision loop: reviewer "revise" → synthesizer revision → re-review
//      - Acceptance-gated progression: cannot pass with unresolved critical issues
//   2. Classic Reviewer Battle (multi-round debate) — fallback

import * as store from "../event-store";
import { runReviewerBattle } from "../reviewer-battle";
import type {
  PhaseContext,
  ScientificReviewConfig,
  ClaimMap,
  ScientificReviewResult,
  ReviewRevisionRequest,
} from "../types";
import type { PhaseHandlerResult } from "./types";

// Dynamic imports to avoid circular deps at load time
async function getScientificReviewer() {
  return await import("../scientific-reviewer");
}

async function getSynthesizer() {
  return await import("../synthesizer");
}

const DEFAULT_SCIENTIFIC_REVIEW_CONFIG: ScientificReviewConfig = {
  maxRounds: 3,
  convergenceThreshold: 1,
  minimumDimensionScore: 3,
  earlyStopOnAllPassing: true,
};

export async function handleReviewerDeliberation(ctx: PhaseContext): Promise<PhaseHandlerResult> {
  const { session, abortSignal } = ctx;

  await store.updateSession(session.id, {
    status: "reviewing",
    reviewerRound: session.reviewerRound + 1,
  });

  const artifacts = await store.getArtifacts(session.id);

  // Determine which review path to use
  const useScientificReview = session.config.scientificReview !== undefined;

  if (useScientificReview) {
    // ---------------------------------------------------------------
    // Path A: Structured Scientific Review with Revision Loop
    // ---------------------------------------------------------------
    const config = {
      ...DEFAULT_SCIENTIFIC_REVIEW_CONFIG,
      ...session.config.scientificReview,
    };

    // Collect ClaimMap and synthesis artifacts for the reviewer
    let claimMapArtifacts = artifacts.filter(a => a.artifactType === "claim_map");
    let synthesisArtifacts = artifacts.filter(a =>
      ["structured_summary", "provisional_conclusion", "claim_map"].includes(a.artifactType)
    );

    try {
      const reviewer = await getScientificReviewer();
      const synthesizer = await getSynthesizer();

      // Run the review → revision loop
      // Each iteration: review → if "revise" → synthesizer revision → re-review
      let result: ScientificReviewResult | null = null;
      const maxRevisionLoops = Math.min(config.maxRounds, 3); // Cap total revision loops

      for (let loop = 0; loop < maxRevisionLoops; loop++) {
        result = await reviewer.executeScientificReview(
          session,
          claimMapArtifacts,
          synthesisArtifacts,
          config,
          abortSignal,
        );

        // If verdict is not "revise", we're done with the loop
        if (result.finalVerdict !== "revise") {
          break;
        }

        // Build a revision request for the synthesizer
        const lastRound = result.rounds[result.rounds.length - 1];
        const latestClaimMap = claimMapArtifacts[claimMapArtifacts.length - 1];
        if (!latestClaimMap) break;

        const revisionRequest: ReviewRevisionRequest = reviewer.buildRevisionRequest(
          lastRound.round,
          lastRound.reviewerAPacket,
          lastRound.reviewerBPacket,
          result.issueLedger ?? [],
          latestClaimMap.id,
        );

        // Skip revision if no actionable points
        if (revisionRequest.revisionPoints.length === 0) {
          break;
        }

        // Run synthesizer revision
        try {
          const existingClaimMap = latestClaimMap.content as unknown as ClaimMap;
          const { artifacts: newArtifacts } = await synthesizer.executeRevisionSynthesis(
            session,
            existingClaimMap,
            revisionRequest,
            abortSignal,
          );

          await store.addMessage(
            session.id,
            "system",
            `Synthesizer revised claim map (addressing ${revisionRequest.revisionPoints.length} point(s), ` +
            `${revisionRequest.issueIds.length} issue(s)). Re-reviewing...`,
          );

          // Update artifacts for next review iteration
          const freshArtifacts = await store.getArtifacts(session.id);
          claimMapArtifacts = freshArtifacts.filter(a => a.artifactType === "claim_map");
          synthesisArtifacts = freshArtifacts.filter(a =>
            ["structured_summary", "provisional_conclusion", "claim_map"].includes(a.artifactType)
          );
        } catch (revisionError) {
          console.warn("[reviewer-deliberation] Synthesizer revision failed:", revisionError);
          break; // Stop revision loop, proceed with current review result
        }
      }

      // Log the final result
      if (result) {
        const blockersMsg = result.canProceed
          ? "No critical blockers remain."
          : `${result.actionableRepairs.length} actionable repair(s) needed.`;
        const gatedMsg = result.acceptanceGated
          ? " [ACCEPTANCE-GATED: pass criteria not met]"
          : "";

        await store.addMessage(
          session.id,
          "system",
          `Scientific review completed (${result.rounds.length} round(s), ` +
          `verdict: ${result.finalVerdict}, ` +
          `converged: ${result.convergedAtRound !== null ? `round ${result.convergedAtRound}` : "no"}, ` +
          `issues: ${(result.issueLedger ?? []).filter(i => i.status === "open").length} open). ` +
          blockersMsg + gatedMsg,
        );
      }
    } catch (error) {
      // If scientific review module fails, fall back to classic battle
      console.warn("[reviewer-deliberation] Scientific review failed, falling back to classic battle:", error);
      await runClassicBattle(session.id, artifacts, session.config.maxReviewerRounds, abortSignal);
    }
  } else {
    // ---------------------------------------------------------------
    // Path B: Classic Reviewer Battle (unchanged behavior)
    // ---------------------------------------------------------------
    await runClassicBattle(session.id, artifacts, session.config.maxReviewerRounds, abortSignal);
  }

  // Get the last reviewer node for checkpoint reference
  const nodes = await store.getNodes(session.id);
  const reviewerNode = nodes
    .filter(n =>
      (n.nodeType === "review" || n.nodeType === "scientific_review") &&
      n.phase === "reviewer_deliberation"
    )
    .pop() ?? nodes.slice(-1)[0];

  return { completedNode: reviewerNode, suggestedNextPhase: "decision" };
}

async function runClassicBattle(
  sessionId: string,
  artifacts: Awaited<ReturnType<typeof store.getArtifacts>>,
  maxRounds: number,
  abortSignal?: AbortSignal,
) {
  // Classic battle reviews structured_summary / provisional_conclusion artifacts
  const targetArtifacts = artifacts.filter(a =>
    ["structured_summary", "provisional_conclusion", "claim_map"].includes(a.artifactType)
  );

  await runReviewerBattle(
    sessionId,
    targetArtifacts,
    { maxRounds, convergenceThreshold: 0.7 },
    abortSignal,
  );
}
