import { generateText } from "ai";
import { getModelForRole, checkBudget, trackUsage } from "./model-router";
import * as store from "./event-store";
import { buildConfirmationInterpretationPrompt } from "./prompts";
import { resolveTransition } from "./transition-resolver";
import { normalizeAndLimitNodeSpecs } from "./dispatch-policy";
import { buildResearcherDoctrinePromptBlock } from "./researcher-doctrine";
import { extractJsonFromLLMResponse } from "./json-response";
import { resolveLanguageState } from "./language-state";
import { validateContextTag, resolveContextTagFromSpecs } from "./context-tag";
import { canCompleteSession } from "./session-guards";
import { cleanupFailedNodesFromFeedback } from "./session-hygiene";
import type { WorkflowPolicy } from "./workflow-policy";
import type {
  CheckpointPackage,
  ConfirmationDecision,
  ConfirmationOutcome,
  ContextTag,
  DeepResearchNode,
  DeepResearchSession,
  NodeCreationSpec,
} from "./types";

type WorkflowRuntimeState = {
  workflowPolicy: WorkflowPolicy;
};

export async function resumeAfterConfirmationInner(input: {
  session: DeepResearchSession;
  sessionId: string;
  nodeId: string;
  outcome: ConfirmationOutcome;
  feedback: string | undefined;
  abortSignal?: AbortSignal;
  continueRun: (sessionId: string, abortSignal?: AbortSignal) => Promise<void>;
  loadWorkflowRuntimeState: (session: DeepResearchSession) => Promise<WorkflowRuntimeState>;
  createNodesFromSpecs: (sessionId: string, specs: NodeCreationSpec[], defaultContextTag: ContextTag) => Promise<DeepResearchNode[]>;
}): Promise<void> {
  const {
    session,
    sessionId,
    nodeId,
    outcome,
    feedback,
    abortSignal,
    continueRun,
    loadWorkflowRuntimeState,
    createNodesFromSpecs,
  } = input;

  try {
    await store.updateNode(nodeId, {
      confirmedAt: new Date().toISOString(),
      confirmedBy: "user",
      confirmationOutcome: outcome,
    });
  } catch {
    console.warn(`[deep-research] Could not update node ${nodeId} with confirmation — may be a recovery path`);
  }

  const eventMap: Record<ConfirmationOutcome, string> = {
    confirmed: "user_confirmed",
    revision_requested: "user_requested_revision",
    branch_requested: "user_requested_branch",
    rejected: "user_rejected_result",
    stopped: "user_requested_stop",
  };
  await store.appendEvent(
    sessionId,
    eventMap[outcome] as Parameters<typeof store.appendEvent>[1],
    nodeId,
    "user",
    undefined,
    undefined,
    { outcome, feedback, explicitUserAction: true },
  );

  const cleanupResult = await cleanupFailedNodesFromFeedback(sessionId, feedback);
  if (
    cleanupResult.cleanedFailedNodeIds.length > 0 ||
    cleanupResult.cleanedBlockedNodeIds.length > 0 ||
    cleanupResult.cancelledExecutionRecordIds.length > 0
  ) {
    await store.addMessage(
      sessionId,
      "system",
      [
        cleanupResult.cleanedFailedNodeIds.length > 0
          ? `Cleaned failed nodes: ${cleanupResult.cleanedFailedNodeIds.join(", ")}.`
          : null,
        cleanupResult.cleanedBlockedNodeIds.length > 0
          ? `Cleaned blocked downstream nodes: ${cleanupResult.cleanedBlockedNodeIds.join(", ")}.`
          : null,
        cleanupResult.cancelledExecutionRecordIds.length > 0
          ? `Cancelled execution records: ${cleanupResult.cancelledExecutionRecordIds.join(", ")}.`
          : null,
      ].filter((line): line is string => Boolean(line)).join(" "),
    );
  }

  if (outcome === "stopped") {
    await store.updateSession(sessionId, { status: "stopped_by_user" });
    await store.addMessage(sessionId, "system", "Research stopped by user.");
    return;
  }

  const checkpoint = await loadCheckpointForConfirmation(sessionId, session.pendingCheckpointId);
  if (!checkpoint) {
    console.warn("[deep-research] No checkpoint found — using deterministic recovery path");

    if (outcome === "confirmed") {
      await store.updateSession(sessionId, { status: "running", pendingCheckpointId: null });
      await store.addMessage(sessionId, "system", `Resuming research in context: ${session.contextTag}`);
      await continueRun(sessionId, abortSignal);
      return;
    }

    await store.addMessage(
      sessionId,
      "system",
      "No checkpoint context available for revision. Please use 'Continue' to resume or 'Stop' to end the session.",
    );
    return;
  }

  const transitionAction = resolveTransition(session, checkpoint, outcome);

  let decision: ConfirmationDecision;
  try {
    decision = await callMainBrainForConfirmation(
      session,
      checkpoint,
      outcome,
      feedback,
      abortSignal,
    );
  } catch (err) {
    console.error("[deep-research] callMainBrainForConfirmation failed, using deterministic fallback:", err);
    decision = outcome === "confirmed"
      ? { action: "continue", reasoning: "User confirmed. Following transition resolver.", nextContextTag: transitionAction.nextContextTag }
      : outcome === "rejected"
        ? { action: "stop", reasoning: "User rejected." }
        : { action: "revise", reasoning: `User requested ${outcome}.` };
  }

  const confirmationWorkflowState = await loadWorkflowRuntimeState(session);
  const limitedConfirmationSpecs = await normalizeAndLimitNodeSpecs(
    sessionId,
    decision.nodesToCreate ?? [],
    session.contextTag,
    confirmationWorkflowState.workflowPolicy,
    "confirmation dispatch",
  );
  decision = {
    ...decision,
    nodesToCreate: limitedConfirmationSpecs,
  };

  await store.updateSession(sessionId, { pendingCheckpointId: null });

  if (decision.messageToUser) {
    await store.addMessage(sessionId, "main_brain", decision.messageToUser, undefined, nodeId);
  }

  if (checkpoint.isFinalStep && (outcome === "confirmed" || decision.action === "continue")) {
    const nodes = await store.getNodes(sessionId);
    const completionCheck = canCompleteSession(nodes);
    if (completionCheck.allowed) {
      await store.updateSession(sessionId, { status: "completed" });
      await store.appendEvent(sessionId, "session_completed", undefined, "system", undefined, undefined, {
        completionReason: "User confirmed final step and all work complete",
      });
      return;
    }

    console.warn("[deep-research] Final step confirmed but work remains:", completionCheck.reason);
    await store.addMessage(
      sessionId,
      "main_brain",
      `Note: There is still pending work that should be addressed before full completion. ${completionCheck.reason}`,
    );
    await store.updateSession(sessionId, { status: "final_report_generated" });
    return;
  }

  switch (decision.action) {
    case "continue": {
      const nodesToCreate = decision.nodesToCreate?.length
        ? decision.nodesToCreate
        : transitionAction.nodesToCreate;
      const targetContextTag = decision.nextContextTag
        ? validateContextTag(decision.nextContextTag, resolveContextTagFromSpecs(nodesToCreate, transitionAction.nextContextTag))
        : resolveContextTagFromSpecs(nodesToCreate, transitionAction.nextContextTag);
      if (nodesToCreate.length > 0) {
        await createNodesFromSpecs(sessionId, nodesToCreate, targetContextTag);
      }
      await store.updateSession(sessionId, { status: "running", contextTag: targetContextTag });
      break;
    }
    case "revise": {
      if (decision.nodesToCreate?.length) {
        await createNodesFromSpecs(sessionId, decision.nodesToCreate, session.contextTag);
      }
      await store.updateSession(sessionId, { status: "running" });
      break;
    }
    case "retry": {
      await store.updateSession(sessionId, { status: "running" });
      break;
    }
    case "branch": {
      if (decision.nodesToCreate?.length) {
        await createNodesFromSpecs(sessionId, decision.nodesToCreate, session.contextTag);
      }
      await store.updateSession(sessionId, { status: "running" });
      break;
    }
    case "supersede": {
      if (decision.nodesToCreate?.length) {
        await createNodesFromSpecs(sessionId, decision.nodesToCreate, session.contextTag);
      }
      const targetContextTag = decision.nextContextTag ? validateContextTag(decision.nextContextTag, session.contextTag) : session.contextTag;
      await store.updateSession(sessionId, { status: "running", contextTag: targetContextTag });
      break;
    }
    case "stop": {
      await store.updateSession(sessionId, { status: "stopped_by_user" });
      return;
    }
    default: {
      console.warn(`[deep-research] Unknown confirmation action: "${decision.action}", following transition resolver`);
      await store.updateSession(sessionId, { status: "running", contextTag: transitionAction.nextContextTag });
    }
  }

  await continueRun(sessionId, abortSignal);
}

async function callMainBrainForConfirmation(
  session: DeepResearchSession,
  checkpoint: CheckpointPackage,
  outcome: ConfirmationOutcome,
  feedback: string | undefined,
  abortSignal?: AbortSignal,
): Promise<ConfirmationDecision> {
  const budgetCheck = checkBudget("main_brain", session.budget, session.config.budget);
  if (!budgetCheck.allowed) {
    return { action: "stop", reasoning: "Budget limit reached" };
  }

  const nodes = await store.getNodes(session.id);
  const artifacts = await store.getArtifacts(session.id);
  const { model } = getModelForRole("main_brain", session.config);
  const messages = await store.getMessages(session.id);
  const langState = resolveLanguageState(messages);
  const langNote = langState.preferredOutputLanguage !== "en"
    ? `\nIMPORTANT: Respond in ${langState.preferredOutputLanguage} for any messageToUser field.`
    : "";

  const prompt = buildConfirmationInterpretationPrompt(
    session,
    checkpoint,
    outcome,
    feedback,
    nodes,
    artifacts,
  );
  const doctrineContext = await buildResearcherDoctrinePromptBlock({
    contextTag: checkpoint.contextTag,
    query: `${checkpoint.contextTag} ${checkpoint.title} ${feedback ?? ""}`.trim(),
  });

  const result = await generateText({
    model,
    system: `You are the Researcher. Interpret the user's confirmation and decide how to proceed. Respond with JSON.${langNote}${doctrineContext ? `\n\n${doctrineContext}` : ""}`,
    messages: [{ role: "user", content: prompt }],
    abortSignal,
  });

  const budget = trackUsage(session.budget, "main_brain", `confirm_${session.contextTag}`, result.usage?.totalTokens ?? 0);
  await store.updateSession(session.id, { budget });

  try {
    return extractJsonFromLLMResponse<ConfirmationDecision>(result.text);
  } catch {
    const transitionAction = resolveTransition(session, checkpoint, outcome);
    return outcome === "confirmed"
      ? { action: "continue", reasoning: "User confirmed.", nextContextTag: transitionAction.nextContextTag }
      : { action: "revise", reasoning: "User requested changes." };
  }
}

async function loadCheckpointForConfirmation(
  sessionId: string,
  pendingCheckpointId: string | null,
): Promise<CheckpointPackage | null> {
  if (pendingCheckpointId) {
    const artifact = await store.getArtifact(pendingCheckpointId);
    if (artifact) {
      return artifact.content as unknown as CheckpointPackage;
    }
  }

  const latest = await store.getLatestCheckpoint(sessionId);
  return latest ? latest.content as unknown as CheckpointPackage : null;
}
