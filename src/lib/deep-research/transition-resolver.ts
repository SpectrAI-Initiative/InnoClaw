// =============================================================
// Deep Research — Transition Resolver (Phase 3)
// =============================================================
// Pure function: no side effects, fully testable.
// Computes what happens when user clicks Continue at each checkpoint.

import type {
  DeepResearchSession,
  CheckpointPackage,
  ConfirmationOutcome,
  TransitionAction,
  Phase,
} from "./types";

/**
 * Resolve what transition should occur given a checkpoint and outcome.
 * This is a pure function — no DB calls, no side effects.
 */
export function resolveTransition(
  session: DeepResearchSession,
  checkpoint: CheckpointPackage,
  outcome: ConfirmationOutcome
): TransitionAction {
  if (outcome === "stopped") {
    return {
      nextPhase: session.phase,
      nodesToCreate: [],
      nodesToSupersede: [],
      description: "Stop the research session.",
    };
  }

  if (outcome === "rejected") {
    return {
      nextPhase: session.phase,
      nodesToCreate: [],
      nodesToSupersede: [],
      description: "Reject the current result and halt.",
    };
  }

  // For "confirmed" — compute the natural next phase
  const phase = checkpoint.phase;
  return resolvePhaseTransition(session, phase);
}

function resolvePhaseTransition(
  session: DeepResearchSession,
  phase: Phase
): TransitionAction {
  switch (phase) {
    case "intake":
      return {
        nextPhase: "planning",
        nodesToCreate: [],
        nodesToSupersede: [],
        description: "Proceed to the planning phase. The Main Brain will decompose the research question into a task graph with specific sub-questions.",
      };

    case "planning":
      return {
        nextPhase: "evidence_collection",
        nodesToCreate: [],
        nodesToSupersede: [],
        description: "Proceed to evidence collection. Workers will search for papers and gather evidence for each sub-question.",
      };

    case "evidence_collection": {
      const litRound = session.literatureRound;
      const maxRounds = session.config.literature.maxLiteratureRounds;
      if (litRound < maxRounds) {
        return {
          nextPhase: "literature_synthesis",
          nodesToCreate: [],
          nodesToSupersede: [],
          description: `Proceed to literature synthesis. The Main Brain will synthesize evidence from round ${litRound} into a structured understanding.`,
        };
      }
      return {
        nextPhase: "literature_synthesis",
        nodesToCreate: [],
        nodesToSupersede: [],
        description: "Proceed to literature synthesis (final round). Max literature rounds reached.",
      };
    }

    case "literature_synthesis":
      return {
        nextPhase: "reviewer_deliberation",
        nodesToCreate: [],
        nodesToSupersede: [],
        description: "Proceed to reviewer deliberation. Two reviewers will critique the synthesis and debate.",
      };

    case "reviewer_deliberation":
      return {
        nextPhase: "decision",
        nodesToCreate: [],
        nodesToSupersede: [],
        description: "Proceed to the decision phase. The Main Brain will decide next steps based on reviewer feedback.",
      };

    case "decision":
      return {
        nextPhase: "final_report",
        nodesToCreate: [],
        nodesToSupersede: [],
        description: "Proceed based on the Main Brain's decision. This may lead to additional literature, validation planning, or final report.",
      };

    case "additional_literature":
      return {
        nextPhase: "evidence_collection",
        nodesToCreate: [],
        nodesToSupersede: [],
        description: `Proceed to additional evidence collection (round ${session.literatureRound + 1}). Workers will search for papers addressing reviewer-identified gaps.`,
      };

    case "validation_planning":
      return {
        nextPhase: "resource_acquisition",
        nodesToCreate: [],
        nodesToSupersede: [],
        description: "Proceed to resource acquisition. Workers will prepare execution manifests for the validation plan.",
      };

    case "resource_acquisition":
      return {
        nextPhase: "experiment_execution",
        nodesToCreate: [],
        nodesToSupersede: [],
        description: "Proceed to experiment execution. Workers will run the validated experiments.",
      };

    case "experiment_execution":
      return {
        nextPhase: "validation_review",
        nodesToCreate: [],
        nodesToSupersede: [],
        description: "Proceed to validation review. Reviewers will critique the experiment results.",
      };

    case "validation_review": {
      const execLoop = session.executionLoop;
      const maxLoops = session.config.maxExecutionLoops;
      if (execLoop < maxLoops) {
        return {
          nextPhase: "final_report",
          nodesToCreate: [],
          nodesToSupersede: [],
          description: "Proceed to final report. Combined literature and experimental evidence will be synthesized.",
        };
      }
      return {
        nextPhase: "final_report",
        nodesToCreate: [],
        nodesToSupersede: [],
        description: "Proceed to final report (max execution loops reached).",
      };
    }

    case "final_report":
      return {
        nextPhase: "final_report",
        nodesToCreate: [],
        nodesToSupersede: [],
        description: "This is the final step. Confirming will complete the research session.",
      };

    default:
      return {
        nextPhase: "final_report",
        nodesToCreate: [],
        nodesToSupersede: [],
        description: "Proceed to final report.",
      };
  }
}
