import type { CheckpointInteractionMode } from "./types";

export function shouldPauseAfterCompletedNode(input: {
  isFinalStep?: boolean;
}): boolean {
  return Boolean(input.isFinalStep);
}

export function shouldPauseAfterResearcherStep(input: {
  interactionMode: CheckpointInteractionMode;
  isFinalStep?: boolean;
  requiresInitialPlanConfirmation: boolean;
  plannedNodeCount: number;
}): boolean {
  if (input.isFinalStep) {
    return true;
  }

  if (input.requiresInitialPlanConfirmation) {
    return true;
  }

  if (input.interactionMode === "answer_required") {
    return true;
  }

  return input.plannedNodeCount === 0;
}
