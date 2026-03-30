import type {
  DeepResearchSession,
  CheckpointPackage,
  ConfirmationOutcome,
  TransitionAction,
} from "./types";

export function resolveTransition(
  session: DeepResearchSession,
  checkpoint: CheckpointPackage,
  outcome: ConfirmationOutcome
): TransitionAction {
  if (outcome === "stopped") {
    return {
      nextContextTag: session.contextTag,
      nodesToCreate: [],
      nodesToSupersede: [],
      description: "Stop the research session.",
    };
  }

  if (outcome === "rejected") {
    return {
      nextContextTag: session.contextTag,
      nodesToCreate: [],
      nodesToSupersede: [],
      description: "Reject the current result and halt.",
    };
  }

  const checkpointTransition = checkpoint.transitionAction;
  if (checkpointTransition) {
    return checkpointTransition;
  }

  return {
    nextContextTag: session.contextTag,
    nodesToCreate: [],
    nodesToSupersede: [],
    description: "Proceed with the Researcher's next workflow decision.",
  };
}
