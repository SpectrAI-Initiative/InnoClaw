// =============================================================
// Deep Research Orchestrator — Adaptive Dispatcher
// =============================================================
// Invariants enforced:
// A. No final_report while active branch has pending required nodes
// B. No session completion while active work remains
// C. No auto-confirmation — only explicit user action
// D. No synthesis from empty evidence
// E. Real-time graph state consistency
// F. Workflow routing is driven by active state, not fixed stage ordering
// G. Language follows user

import * as store from "./event-store";
import { resolveLanguageState } from "./language-state";
import {
  shouldPauseAfterCompletedNode,
} from "./checkpoint-policy";
import {
  selectNextReadyNodeForWorkflow,
} from "./dispatch-policy";
import {
  reconcileSessionState,
} from "./session-hygiene";
import {
  generateCheckpointAndHalt,
} from "./orchestrator-checkpoint";
import { resumeAfterConfirmationInner } from "./orchestrator-confirmation";
import {
  createNodesFromSpecs,
  createResearcherDispatchStep,
  executeApprovedNode,
  loadWorkflowRuntimeState,
  type ResearcherDispatchStepResult,
  type WorkflowRuntimeState,
} from "./orchestrator-runtime";
import type {
  DeepResearchSession,
  ConfirmationOutcome,
} from "./types";

type RouteNextActionResult = {
  shouldContinue: boolean;
};

// =============================================================
// PUBLIC API
// =============================================================

/**
 * Run the deep research workflow until a user gate or terminal state is reached.
 * INVARIANT C: This function NEVER auto-confirms. It only halts when explicit
 * user input is required or the final report needs review.
 */
export async function runDeepResearch(
  sessionId: string,
  abortSignal?: AbortSignal,
): Promise<void> {
  const session = await store.getSession(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  // Terminal states — do nothing
  const terminalStatuses = new Set(["completed", "failed", "cancelled", "stopped_by_user"]);
  if (terminalStatuses.has(session.status)) return;

  // INVARIANT C: If awaiting user confirmation, do NOT proceed.
  // The session must stay blocked until explicit user action.
  if (session.status === "awaiting_user_confirmation") {
    console.log(`[deep-research] Session ${sessionId} is awaiting user confirmation — not auto-continuing`);
    return;
  }

  // Transition to running
  const startableStatuses = new Set(["intake", "paused", "awaiting_approval", "planning", "running",
    "planning_in_progress", "literature_in_progress", "literature_blocked",
    "awaiting_additional_literature",
    "validation_planning_in_progress", "execution_prepared",
    "execution_in_progress", "final_report_generated", "reviewing", "awaiting_resource"]);
  if (startableStatuses.has(session.status)) {
    await store.updateSession(sessionId, { status: "running" });
  }

  if (abortSignal?.aborted) throw new Error("Aborted");

  try {
    while (true) {
      if (abortSignal?.aborted) throw new Error("Aborted");

      const currentSession = await store.getSession(sessionId);
      if (!currentSession) return;

      if (terminalStatuses.has(currentSession.status)) return;
      if (
        currentSession.status === "awaiting_user_confirmation"
        || currentSession.status === "awaiting_approval"
        || currentSession.status === "awaiting_resource"
      ) {
        return;
      }

      if (startableStatuses.has(currentSession.status) && currentSession.status !== "running") {
        await store.updateSession(sessionId, { status: "running" });
      }

      const result = await routeNextAction(currentSession, abortSignal);
      if (!result.shouldContinue) {
        return;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown orchestrator error";
    console.error(`[deep-research] Context error in "${session.contextTag}":`, message);
    await store.updateSession(sessionId, {
      status: "failed",
      error: message,
    });
    await store.appendEvent(sessionId, "session_failed", undefined, "system", undefined, undefined, {
      error: message,
      contextTag: session.contextTag,
    });
  }
}

/**
 * Resume after user confirms/rejects/revises a checkpoint.
 * This is the ONLY path for user confirmation — no synthetic confirmations.
 */
export async function resumeAfterConfirmation(
  sessionId: string,
  nodeId: string,
  outcome: ConfirmationOutcome,
  feedback?: string,
  abortSignal?: AbortSignal
): Promise<void> {
  const session = await store.getSession(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);
  if (session.status !== "awaiting_user_confirmation") {
    throw new Error(`Session is not awaiting confirmation (status: ${session.status})`);
  }

  if (outcome !== "stopped") {
    await store.updateSession(sessionId, {
      status: "running",
      pendingCheckpointId: null,
    });
  }

  try {
    await resumeAfterConfirmationInner({
      session,
      sessionId,
      nodeId,
      outcome,
      feedback,
      abortSignal,
      continueRun: runDeepResearch,
      loadWorkflowRuntimeState,
      createNodesFromSpecs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error during confirmation";
    console.error(`[deep-research] resumeAfterConfirmation error:`, message);
    await store.updateSession(sessionId, {
      status: "failed",
      error: `Confirmation handling failed: ${message}`,
    });
    await store.appendEvent(sessionId, "session_failed", nodeId, "system", undefined, undefined, {
      error: message,
      contextTag: session.contextTag,
    });
  }
}

// =============================================================
// NODE ROUTER — Researcher-Decided Dispatch
// =============================================================

async function routeNextAction(
  session: DeepResearchSession,
  abortSignal?: AbortSignal,
): Promise<RouteNextActionResult> {
  const fresh = await store.getSession(session.id);
  if (!fresh) {
    return { shouldContinue: false };
  }

  const hygieneSummary = await reconcileSessionState(fresh.id);

  // Load requirement state
  const requirementState = await store.getLatestRequirementState(fresh.id);

  // Build context
  const nodes = await store.getNodes(fresh.id);
  const workflowState = await loadWorkflowRuntimeState(fresh);
  const { artifacts, messages, workflowPolicy } = workflowState;

  // Resolve language state from user messages
  const languageState = resolveLanguageState(messages);
  const nextReadyNode = await selectNextReadyNodeForWorkflow(fresh.id, workflowPolicy);

  if (nextReadyNode) {
    const executed = await executeApprovedNode(
      fresh,
      nextReadyNode,
      nodes,
      artifacts,
      requirementState,
      languageState,
      abortSignal,
    );

    if (executed.requiresCheckpoint || shouldPauseAfterCompletedNode({ isFinalStep: executed.isFinalStep })) {
      await generateCheckpointAndHalt({
        session: { ...fresh, contextTag: executed.suggestedNextContextTag },
        completedNode: executed.completedNode,
        suggestedNextContextTag: executed.suggestedNextContextTag,
        languageState,
        abortSignal,
        isFinalStep: executed.isFinalStep,
        interactionMode: executed.interactionMode,
      });
      return { shouldContinue: false };
    }

    await store.updateSession(fresh.id, {
      status: "running",
      contextTag: executed.suggestedNextContextTag,
      pendingCheckpointId: null,
    });
    return { shouldContinue: true };
  }

  const researcherStep = await createResearcherDispatchStep(
    fresh,
    nodes,
    requirementState,
    languageState,
    hygieneSummary,
    workflowState,
    abortSignal,
  );

  if (researcherStep.requiresCheckpoint) {
    await generateCheckpointAndHalt({
      session: { ...fresh, contextTag: researcherStep.suggestedNextContextTag },
      completedNode: researcherStep.completedNode,
      suggestedNextContextTag: researcherStep.suggestedNextContextTag,
      languageState,
      abortSignal,
      isFinalStep: researcherStep.isFinalStep,
      interactionMode: researcherStep.interactionMode,
    });
    return { shouldContinue: false };
  }

  if (researcherStep.plannedNodesToCreate.length > 0) {
    await createNodesFromSpecs(
      fresh.id,
      researcherStep.plannedNodesToCreate,
      researcherStep.suggestedNextContextTag,
    );
  }

  await store.updateSession(fresh.id, {
    status: "running",
    contextTag: researcherStep.suggestedNextContextTag,
    pendingCheckpointId: null,
  });

  return { shouldContinue: true };
}
