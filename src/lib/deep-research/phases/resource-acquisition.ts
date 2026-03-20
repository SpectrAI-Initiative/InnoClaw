// Phase: Resource Acquisition
import * as store from "../event-store";
import type { PhaseContext } from "../types";
import type { PhaseHandlerResult } from "./types";
import { callMainBrain, createNodesFromSpecs, executeReadyWorkers } from "./shared";

export async function handleResourceAcquisition(ctx: PhaseContext): Promise<PhaseHandlerResult> {
  const { session, abortSignal } = ctx;

  await store.updateSession(session.id, { status: "awaiting_resource" });

  const nodes = await store.getNodes(session.id);
  let resourceNodes = nodes.filter(n => n.nodeType === "resource_request" && n.status === "pending");

  if (resourceNodes.length === 0) {
    const decision = await callMainBrain(session, abortSignal, ctx.requirementState);
    if (decision.nodesToCreate?.length) {
      await createNodesFromSpecs(session.id, decision.nodesToCreate, "resource_acquisition");
    }
    if (decision.messageToUser) {
      await store.addMessage(session.id, "main_brain", decision.messageToUser);
    }
    resourceNodes = (await store.getNodes(session.id))
      .filter(n => n.nodeType === "resource_request" && n.status === "pending");
  }

  await store.updateSession(session.id, { status: "running" });
  await executeReadyWorkers(session, abortSignal);

  const lastResourceNode = (await store.getNodes(session.id))
    .filter(n => n.phase === "resource_acquisition")
    .pop() ?? resourceNodes[0] ?? (await store.getNodes(session.id)).slice(-1)[0];

  return { completedNode: lastResourceNode, suggestedNextPhase: "experiment_execution" };
}
