// Phase: Experiment Execution
import * as store from "../event-store";
import type { PhaseContext } from "../types";
import type { PhaseHandlerResult } from "./types";
import { callMainBrain, createNodesFromSpecs, executeReadyWorkers } from "./shared";

export async function handleExperimentExecution(ctx: PhaseContext): Promise<PhaseHandlerResult> {
  const { session, abortSignal } = ctx;

  await store.updateSession(session.id, { executionLoop: session.executionLoop + 1 });

  const nodes = await store.getNodes(session.id);
  const execNodes = nodes.filter(n => n.nodeType === "execute" && n.status === "pending");

  if (execNodes.length === 0) {
    const decision = await callMainBrain(session, abortSignal, ctx.requirementState);
    if (decision.nodesToCreate?.length) {
      await createNodesFromSpecs(session.id, decision.nodesToCreate, "experiment_execution");
    }
    if (decision.messageToUser) {
      await store.addMessage(session.id, "main_brain", decision.messageToUser);
    }
  }

  await executeReadyWorkers(session, abortSignal);

  const freshNodes = await store.getNodes(session.id);
  const allExec = freshNodes.filter(n => n.nodeType === "execute");
  const terminalStatuses = new Set(["completed", "failed", "skipped"]);
  const allDone = allExec.length > 0 && allExec.every(n => terminalStatuses.has(n.status));

  const lastExec = allExec.filter(n => n.status === "completed").pop()
    ?? allExec[0]
    ?? freshNodes.slice(-1)[0];

  if (allDone) {
    return { completedNode: lastExec, suggestedNextPhase: "validation_review" };
  } else {
    return { completedNode: lastExec, suggestedNextPhase: "experiment_execution" };
  }
}
