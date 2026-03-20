// Phase: Decision
import * as store from "../event-store";
import type { PhaseContext, Phase, ReviewerBattleResult } from "../types";
import { PHASE_ORDER, PHASE_STAGE_NUMBER } from "../types";
import type { PhaseHandlerResult } from "./types";
import { callMainBrain, createNodesFromSpecs } from "./shared";

/**
 * When advancing to a phase that is LATER than some pending nodes' phases,
 * supersede those pending nodes — they are no longer needed.
 */
async function supersedeSkippedNodes(sessionId: string, targetPhase: Phase): Promise<number> {
  const targetStage = PHASE_STAGE_NUMBER[targetPhase] ?? 99;
  const nodes = await store.getNodes(sessionId);
  const toSupersede = nodes.filter(n =>
    n.status === "pending" &&
    (PHASE_STAGE_NUMBER[n.phase] ?? 0) < targetStage
  );
  for (const node of toSupersede) {
    await store.updateNode(node.id, {
      status: "superseded",
      output: { reason: `Superseded: session advanced to ${targetPhase} (stage ${targetStage})` },
      completedAt: new Date().toISOString(),
    });
  }
  if (toSupersede.length > 0) {
    await store.appendEvent(sessionId, "nodes_superseded", undefined, "system", undefined, undefined, {
      count: toSupersede.length,
      reason: `Phase advanced to ${targetPhase}`,
      supersededNodeIds: toSupersede.map(n => n.id),
    });
  }
  return toSupersede.length;
}

export async function handleDecision(ctx: PhaseContext): Promise<PhaseHandlerResult> {
  const { session, abortSignal } = ctx;

  const decision = await callMainBrain(session, abortSignal, ctx.requirementState);

  if (decision.messageToUser) {
    await store.addMessage(session.id, "main_brain", decision.messageToUser);
  }

  const decisionNode = await store.createNode(session.id, {
    nodeType: "deliberate",
    label: "Main brain decision",
    assignedRole: "main_brain",
    input: { decision },
    phase: "decision",
  });
  await store.updateNode(decisionNode.id, {
    status: "completed",
    output: decision as unknown as Record<string, unknown>,
    completedAt: new Date().toISOString(),
  });

  if (decision.nodesToCreate?.length) {
    await createNodesFromSpecs(session.id, decision.nodesToCreate, session.phase);
  }

  // Determine next phase based on decision + state
  let nextPhase: Phase;
  switch (decision.action) {
    case "advance_phase": {
      nextPhase = validatePhase(decision.nextPhase, "validation_planning");
      // Supersede any pending nodes from phases we're skipping past
      const superseded = await supersedeSkippedNodes(session.id, nextPhase);
      if (superseded > 0) {
        await store.addMessage(session.id, "system",
          `Advanced to ${nextPhase}: ${superseded} pending node(s) from earlier phases were superseded.`);
      }
      break;
    }
    case "revise_plan": {
      const battleArtifacts = await store.getArtifacts(session.id, { type: "reviewer_battle_result" });
      const latestBattle = battleArtifacts[battleArtifacts.length - 1];
      const battleContent = latestBattle?.content as unknown as ReviewerBattleResult | undefined;

      if (battleContent?.needsMoreLiterature &&
          session.literatureRound < session.config.literature.maxLiteratureRounds) {
        nextPhase = "additional_literature";
      } else if (session.reviewerRound >= session.config.maxReviewerRounds) {
        // Max reviewer rounds reached — move to validation or final report
        nextPhase = battleContent?.needsExperimentalValidation ? "validation_planning" : "final_report";
        await supersedeSkippedNodes(session.id, nextPhase);
      } else {
        nextPhase = "evidence_collection";
      }
      break;
    }
    case "complete": {
      // INVARIANT A: Before jumping to final_report, check if there's pending work
      const nodes = await store.getNodes(session.id);
      const pendingAdditionalLit = nodes.filter(n =>
        n.phase === "additional_literature" &&
        n.status === "pending"
      );
      if (pendingAdditionalLit.length > 0) {
        // Supersede pending additional literature — the decision was to complete
        for (const node of pendingAdditionalLit) {
          await store.updateNode(node.id, {
            status: "superseded",
            output: { reason: "Superseded: decision to complete/advance past literature phase" },
            completedAt: new Date().toISOString(),
          });
        }
        await store.addMessage(session.id, "system",
          `${pendingAdditionalLit.length} pending additional literature node(s) superseded — proceeding to final report.`);
      }
      // Also supersede any other pending nodes from phases before final_report
      await supersedeSkippedNodes(session.id, "final_report");
      nextPhase = "final_report";
      break;
    }
    default:
      // Don't default to final_report — stay in decision
      nextPhase = "decision";
      break;
  }

  return { completedNode: decisionNode, suggestedNextPhase: nextPhase };
}

function validatePhase(phase: string | undefined, fallback: Phase): Phase {
  if (!phase) return fallback;
  if (PHASE_ORDER.includes(phase as Phase)) return phase as Phase;
  const fuzzyMap: Record<string, Phase> = {
    evidence_gathering: "evidence_collection",
    evidence: "evidence_collection",
    review: "reviewer_deliberation",
    reviewing: "reviewer_deliberation",
    understanding: "literature_synthesis",
    structured_understanding: "literature_synthesis",
    synthesis: "literature_synthesis",
    report: "final_report",
    execute: "experiment_execution",
    execution: "experiment_execution",
    plan: "planning",
    execution_planning: "validation_planning",
    review_correction: "validation_review",
    resource: "resource_acquisition",
  };
  return fuzzyMap[phase] ?? fallback;
}
