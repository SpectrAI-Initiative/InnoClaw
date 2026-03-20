// Phase: Validation Planning
import * as store from "../event-store";
import { executeNode } from "../node-executor";
import type { PhaseContext } from "../types";
import type { PhaseHandlerResult } from "./types";
import { callMainBrain, createNodesFromSpecs, buildNodeContext } from "./shared";

export async function handleValidationPlanning(ctx: PhaseContext): Promise<PhaseHandlerResult> {
  const { session, abortSignal } = ctx;

  const decision = await callMainBrain(session, abortSignal, ctx.requirementState);

  if (decision.nodesToCreate?.length) {
    await createNodesFromSpecs(session.id, decision.nodesToCreate, "validation_planning");
  }
  if (decision.messageToUser) {
    await store.addMessage(session.id, "main_brain", decision.messageToUser);
  }

  const planNode = await store.createNode(session.id, {
    nodeType: "validation_plan",
    label: "Validation plan",
    assignedRole: "main_brain",
    phase: "validation_planning",
  });

  const nodeCtx = await buildNodeContext(session.id);
  await executeNode(planNode, nodeCtx, abortSignal);

  return { completedNode: planNode, suggestedNextPhase: "resource_acquisition" };
}
