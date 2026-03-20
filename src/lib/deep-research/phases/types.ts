// =============================================================
// Phase Handler Types (shared by all phase handlers)
// =============================================================

export type { PhaseContext, PhaseResult } from "../types";

import type { DeepResearchNode, DeepResearchArtifact, Phase } from "../types";

/**
 * Utility type for phase handler function signature.
 */
export type PhaseHandler = (ctx: import("../types").PhaseContext) => Promise<PhaseHandlerResult>;

/**
 * Result returned by each phase handler back to the orchestrator.
 */
export interface PhaseHandlerResult {
  /** Node that was the primary output of this phase (for checkpoint). */
  completedNode: DeepResearchNode;
  /** Suggested next phase if the handler completed successfully. */
  suggestedNextPhase: Phase;
  /** Whether this is the final step of the session. */
  isFinalStep?: boolean;
}
