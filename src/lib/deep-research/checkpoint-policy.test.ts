import { describe, expect, it } from "vitest";
import {
  shouldPauseAfterCompletedNode,
  shouldPauseAfterResearcherStep,
} from "./checkpoint-policy";

describe("checkpoint-policy", () => {
  it("keeps the initial plan checkpoint before any worker dispatch", () => {
    expect(shouldPauseAfterResearcherStep({
      interactionMode: "confirmation",
      requiresInitialPlanConfirmation: true,
      plannedNodeCount: 1,
    })).toBe(true);
  });

  it("keeps clarification checkpoints when user input is required", () => {
    expect(shouldPauseAfterResearcherStep({
      interactionMode: "answer_required",
      requiresInitialPlanConfirmation: false,
      plannedNodeCount: 0,
    })).toBe(true);
  });

  it("auto-continues after planning when concrete work is queued", () => {
    expect(shouldPauseAfterResearcherStep({
      interactionMode: "confirmation",
      requiresInitialPlanConfirmation: false,
      plannedNodeCount: 1,
    })).toBe(false);
  });

  it("still pauses if the researcher has no concrete next task to run", () => {
    expect(shouldPauseAfterResearcherStep({
      interactionMode: "confirmation",
      requiresInitialPlanConfirmation: false,
      plannedNodeCount: 0,
    })).toBe(true);
  });

  it("keeps the final report checkpoint", () => {
    expect(shouldPauseAfterCompletedNode({ isFinalStep: true })).toBe(true);
    expect(shouldPauseAfterResearcherStep({
      interactionMode: "confirmation",
      isFinalStep: true,
      requiresInitialPlanConfirmation: false,
      plannedNodeCount: 0,
    })).toBe(true);
  });
});
