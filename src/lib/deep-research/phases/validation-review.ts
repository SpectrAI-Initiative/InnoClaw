// Phase: Validation Review (delegates to reviewer-battle.ts)
import * as store from "../event-store";
import { runReviewerBattle } from "../reviewer-battle";
import type { PhaseContext, Phase } from "../types";
import type { PhaseHandlerResult } from "./types";
import { callMainBrain, createNodesFromSpecs } from "./shared";

export async function handleValidationReview(ctx: PhaseContext): Promise<PhaseHandlerResult> {
  const { session, abortSignal } = ctx;

  await store.updateSession(session.id, { status: "reviewing" });

  const artifacts = await store.getArtifacts(session.id);
  const targetArtifacts = artifacts.filter(a =>
    ["step_result", "experiment_result", "execution_manifest"].includes(a.artifactType)
  );

  await runReviewerBattle(
    session.id,
    targetArtifacts,
    { maxRounds: session.config.maxReviewerRounds, convergenceThreshold: 0.7 },
    abortSignal
  );

  await store.updateSession(session.id, { status: "running" });

  const decision = await callMainBrain(session, abortSignal, ctx.requirementState);
  if (decision.messageToUser) {
    await store.addMessage(session.id, "main_brain", decision.messageToUser);
  }

  let nextPhase: Phase = "final_report";
  if (decision.action === "revise_plan" && decision.nodesToCreate?.length) {
    if (session.executionLoop < session.config.maxExecutionLoops) {
      await createNodesFromSpecs(session.id, decision.nodesToCreate, "experiment_execution");
      nextPhase = "experiment_execution";
    }
  }

  const nodes = await store.getNodes(session.id);
  const reviewerNode = nodes
    .filter(n => n.nodeType === "review" && n.phase === "validation_review")
    .pop() ?? nodes.slice(-1)[0];

  return { completedNode: reviewerNode, suggestedNextPhase: nextPhase };
}
