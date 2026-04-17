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

import { generateText } from "ai";
import { nanoid } from "nanoid";
import { getModelForRole, checkBudget, trackUsage } from "./model-router";
import * as store from "./event-store";
import {
  buildCheckpointPrompt,
  buildConfirmationInterpretationPrompt,
} from "./prompts";
import { resolveTransition } from "./transition-resolver";
import { createInitialRequirements } from "./requirement-tracker";
import { validateDAG, autoRepairDAG } from "./dag-validator";
import { checkConsistency } from "./consistency-checker";
import { normalizeNodeCreationSpecs } from "./node-spec-normalizer";
import {
  executeNode,
  isFinalReportExecutionError,
} from "./node-executor";
import { buildWorkstationPlanningContext } from "./workstation-context";
import { buildNodeContext, callMainBrain } from "./researcher-runtime";
import { extractJsonFromLLMResponse, safeParseJson } from "./json-response";
import { consolidateResearchMemory } from "./memory-fabric";
import { buildResearcherDoctrinePromptBlock } from "./researcher-doctrine";
import { buildNodeCreationSpecDispatchPreviews } from "./node-spec-templates";
import { resolveLanguageState } from "./language-state";
import {
  shouldPauseAfterCompletedNode,
  shouldPauseAfterResearcherStep,
} from "./checkpoint-policy";
import {
  deriveWorkflowPolicy,
  type WorkflowPolicy,
} from "./workflow-policy";
import {
  countNodesByType,
  normalizeAndLimitNodeSpecs,
  resolveNodeDependencies,
  selectNextReadyNodeForWorkflow,
} from "./dispatch-policy";
import { canonicalizeArtifactReferenceFields } from "./artifact-references";
import {
  applyFinalReportCheckpointGuard,
  getCheckpointReviewArtifacts,
  getEvidencePhaseSummary,
  getFinalReportCheckpointCopy,
  getRecommendedDispatch,
} from "./checkpoint-runtime";
import { assessFinalReportRetry } from "./final-report-retry-policy";
import {
  resolveContextTagFromSpecs,
  resolveLegacyContextFromNodes,
  validateContextTag,
} from "./context-tag";
import {
  canCompleteSession,
  canGenerateFinalReport,
  checkEvidenceSufficiency,
} from "./session-guards";
import {
  buildSessionHygienePromptBlock,
  cleanupFailedNodesFromFeedback,
  reconcileSessionState,
  type SessionHygieneSummary,
} from "./session-hygiene";
import type {
  DeepResearchSession,
  DeepResearchNode,
  DeepResearchArtifact,
  ContextTag,
  ConfirmationDecision,
  ConfirmationOutcome,
  CheckpointPackage,
  NodeCreationSpec,
  MainBrainAudit,
  ReviewAssessment,
  LanguageState,
  RequirementState,
  BrainDecision,
  CheckpointInteractionMode,
} from "./types";

type WorkflowRuntimeState = {
  messages: Awaited<ReturnType<typeof store.getMessages>>;
  artifacts: Awaited<ReturnType<typeof store.getArtifacts>>;
  workstationContext: Awaited<ReturnType<typeof buildWorkstationPlanningContext>>;
  workflowPolicy: WorkflowPolicy;
};

type RouteNextActionResult = {
  shouldContinue: boolean;
};

type ResearcherDispatchStepResult = {
  completedNode: DeepResearchNode;
  suggestedNextContextTag: ContextTag;
  isFinalStep: boolean;
  interactionMode: CheckpointInteractionMode;
  plannedNodesToCreate: NodeCreationSpec[];
  requiresCheckpoint: boolean;
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
    await _resumeAfterConfirmationInner(session, sessionId, nodeId, outcome, feedback, abortSignal);
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

async function _resumeAfterConfirmationInner(
  session: DeepResearchSession,
  sessionId: string,
  nodeId: string,
  outcome: ConfirmationOutcome,
  feedback: string | undefined,
  abortSignal?: AbortSignal
): Promise<void> {
  // Record the explicit user action (nodeId may be a fallback — update only if the node exists)
  try {
    await store.updateNode(nodeId, {
      confirmedAt: new Date().toISOString(),
      confirmedBy: "user",
      confirmationOutcome: outcome,
    });
  } catch {
    // Node may not exist if this is a fallback/recovery scenario — that's OK
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
    nodeId, "user", undefined, undefined,
    { outcome, feedback, explicitUserAction: true }
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

  // Load checkpoint
  let checkpoint: CheckpointPackage | null = null;
  if (session.pendingCheckpointId) {
    const art = await store.getArtifact(session.pendingCheckpointId);
    if (art) checkpoint = art.content as unknown as CheckpointPackage;
  }
  if (!checkpoint) {
    const latest = await store.getLatestCheckpoint(sessionId);
    if (latest) checkpoint = latest.content as unknown as CheckpointPackage;
  }

  if (!checkpoint) {
    // No checkpoint found — this can happen if session was manually recovered
    // or checkpoint was lost. Allow user to continue or stop, but use
    // deterministic transition based on current context tag.
    console.warn("[deep-research] No checkpoint found — using deterministic recovery path");

    if (outcome === "confirmed") {
      // Resume: set to running in the current context and re-enter orchestrator
      await store.updateSession(sessionId, { status: "running", pendingCheckpointId: null });
      await store.addMessage(sessionId, "system",
        `Resuming research in context: ${session.contextTag}`);
      await runDeepResearch(sessionId, abortSignal);
      return;
    }

    // For revision/rejection without a checkpoint — stay blocked, inform user
    await store.addMessage(sessionId, "system",
      "No checkpoint context available for revision. Please use 'Continue' to resume or 'Stop' to end the session.");
    return;
  }

  // Compute transition
  const transitionAction = resolveTransition(session, checkpoint, outcome);

  // Ask main brain to interpret
  let decision: ConfirmationDecision;
  try {
    decision = await callMainBrainForConfirmation(
      session, checkpoint, outcome, feedback, abortSignal
    );
  } catch (err) {
    console.error("[deep-research] callMainBrainForConfirmation failed, using deterministic fallback:", err);
    // Deterministic fallback: follow the transition resolver exactly
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

  // INVARIANT B: Before completing, verify all work is done
  if (checkpoint.isFinalStep && (outcome === "confirmed" || decision.action === "continue")) {
    const nodes = await store.getNodes(sessionId);
    const completionCheck = canCompleteSession(nodes);
    if (completionCheck.allowed) {
      await store.updateSession(sessionId, { status: "completed" });
      await store.appendEvent(sessionId, "session_completed", undefined, "system", undefined, undefined, {
        completionReason: "User confirmed final step and all work complete",
      });
      return;
    } else {
      // Cannot complete yet — inform user and stay in a working state
      console.warn("[deep-research] Final step confirmed but work remains:", completionCheck.reason);
      await store.addMessage(sessionId, "main_brain",
        `Note: There is still pending work that should be addressed before full completion. ${completionCheck.reason}`);
      // Set to final_report_generated instead of completed
      await store.updateSession(sessionId, { status: "final_report_generated" });
      return;
    }
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
      // INVARIANT C: Do NOT auto-advance on unknown action.
      // Default to following the transition resolver deterministically.
      console.warn(`[deep-research] Unknown confirmation action: "${decision.action}", following transition resolver`);
      await store.updateSession(sessionId, { status: "running", contextTag: transitionAction.nextContextTag });
    }
  }

  await runDeepResearch(sessionId, abortSignal);
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
      await generateCheckpointAndHalt(
        { ...fresh, contextTag: executed.suggestedNextContextTag },
        executed.completedNode,
        executed.suggestedNextContextTag,
        languageState,
        abortSignal,
        executed.isFinalStep,
        executed.interactionMode,
      );
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
    await generateCheckpointAndHalt(
      { ...fresh, contextTag: researcherStep.suggestedNextContextTag },
      researcherStep.completedNode,
      researcherStep.suggestedNextContextTag,
      languageState,
      abortSignal,
      researcherStep.isFinalStep,
      researcherStep.interactionMode,
    );
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

async function executeApprovedNode(
  session: DeepResearchSession,
  node: DeepResearchNode,
  nodes: DeepResearchNode[],
  artifacts: DeepResearchArtifact[],
  requirementState: RequirementState | null,
  languageState: LanguageState,
  abortSignal?: AbortSignal,
): Promise<{
  completedNode: DeepResearchNode;
  suggestedNextContextTag: ContextTag;
  isFinalStep: boolean;
  requiresCheckpoint: boolean;
  interactionMode: CheckpointInteractionMode;
}> {
  if (node.nodeType === "final_report") {
    const finalReportCheck = canGenerateFinalReport(nodes);
    if (!finalReportCheck.allowed) {
      const blockedNode = await createCompletedResearcherNode(
        session.id,
        "audit",
        "Final report blocked — pending work remains",
        {
          blocked: true,
          reason: finalReportCheck.reason,
          pendingNodes: nodes
            .filter((candidate) =>
              candidate.status !== "superseded" &&
              candidate.status !== "skipped" &&
              candidate.status !== "completed" &&
              candidate.status !== "failed" &&
              candidate.nodeType !== "final_report"
            )
            .map((candidate) => ({
              id: candidate.id,
              label: candidate.label,
              status: candidate.status,
              role: candidate.assignedRole,
            })),
        },
        "final_report",
      );
      await store.addMessage(
        session.id,
        "main_brain",
        `Cannot generate final report yet: ${finalReportCheck.reason}`,
      );
      return {
        completedNode: blockedNode,
        suggestedNextContextTag: resolveLegacyContextFromNodes(nodes, session.contextTag),
        isFinalStep: false,
        requiresCheckpoint: true,
        interactionMode: "confirmation",
      };
    }
  }

  if (node.nodeType === "synthesize") {
    const evidenceCheck = checkEvidenceSufficiency(nodes, artifacts);
    if (!evidenceCheck.canSynthesize) {
      const blockedNode = await createCompletedResearcherNode(
        session.id,
        "audit",
        "Evidence retrieval failed — no usable sources found",
        {
          blocked: true,
          emptyStreams: evidenceCheck.emptyStreams,
          recommendedAction: "Retry the approved literature tasks with adjusted search terms.",
        },
        "planning",
      );
      await store.addMessage(
        session.id,
        "main_brain",
        `Evidence retrieval returned zero usable sources. Cannot synthesize findings from empty evidence. Failed/empty streams: ${evidenceCheck.emptyStreams.join(", ")}.`,
      );
      return {
        completedNode: blockedNode,
        suggestedNextContextTag: "planning",
        isFinalStep: false,
        requiresCheckpoint: true,
        interactionMode: "confirmation",
      };
    }
  }

  const nodeContext = await buildNodeContext(session.id);
  try {
    await executeNode(node, nodeContext, abortSignal);
  } catch (error) {
    if (node.nodeType === "final_report" && isFinalReportExecutionError(error)) {
      const shouldReturnToPlanning = error.code === "insufficient_evidence";
      const blockedNode = await createCompletedResearcherNode(
        session.id,
        "audit",
        shouldReturnToPlanning
          ? "Final report blocked — targeted evidence supplement required"
          : "Final report blocked — synthesis strategy needs revision",
        {
          blocked: true,
          errorCode: error.code,
          stage: error.stage,
          reason: error.message,
          recommendedAction: error.recommendedAction,
          diagnostics: error.details,
          failedNodeId: node.id,
        },
        shouldReturnToPlanning ? "planning" : "final_report",
      );
      await store.addMessage(
        session.id,
        "main_brain",
        `${error.message}\n\nRecommended next action: ${error.recommendedAction}`,
      );
      return {
        completedNode: blockedNode,
        suggestedNextContextTag: shouldReturnToPlanning ? "planning" : "final_report",
        isFinalStep: false,
        requiresCheckpoint: true,
        interactionMode: "confirmation",
      };
    }
    throw error;
  }

  const { freshNodes } = await runPostStepChecks(session, requirementState, node.contextTag);
  const refreshedCompletedNode = freshNodes.find((candidate) => candidate.id === node.id) ?? node;

  return {
    completedNode: refreshedCompletedNode,
    suggestedNextContextTag: resolveLegacyContextFromNodes(freshNodes, node.contextTag),
    isFinalStep: node.nodeType === "final_report",
    requiresCheckpoint: false,
    interactionMode: "confirmation",
  };
}

async function createResearcherDispatchStep(
  session: DeepResearchSession,
  nodes: DeepResearchNode[],
  requirementState: RequirementState | null,
  languageState: LanguageState,
  hygieneSummary: SessionHygieneSummary,
  workflowState: WorkflowRuntimeState,
  abortSignal?: AbortSignal,
): Promise<ResearcherDispatchStepResult> {
  const { workstationContext, workflowPolicy, artifacts } = workflowState;
  const sessionHygienePromptBlock = buildSessionHygienePromptBlock(hygieneSummary);
  const coordinationContext = [sessionHygienePromptBlock, workstationContext.promptBlock, workflowPolicy.promptBlock]
    .filter((block): block is string => Boolean(block))
    .join("\n\n");
  const decision = await callMainBrain(
    session,
    abortSignal,
    requirementState,
    languageState.preferredOutputLanguage,
    coordinationContext,
  );

  let limitedPlannedNodesToCreate = await normalizeAndLimitNodeSpecs(
    session.id,
    decision.nodesToCreate ?? [],
    session.contextTag,
    workflowPolicy,
    "researcher planning",
  );
  const finalReportRetry = assessFinalReportRetry({ nodes, artifacts });
  if (!finalReportRetry.allowed) {
    const blockedFinalReportSpecs = limitedPlannedNodesToCreate.filter((spec) => spec.nodeType === "final_report");
    if (blockedFinalReportSpecs.length > 0) {
      limitedPlannedNodesToCreate = limitedPlannedNodesToCreate.filter((spec) => spec.nodeType !== "final_report");
      await store.addMessage(
        session.id,
        "system",
        `${finalReportRetry.reason} Remove the retry loop by adding new evidence/synthesis artifacts or by narrowing the requested deliverable before creating another final_report node.`,
      );
    }
  }
  const interactionMode = resolveCheckpointInteractionMode(decision, limitedPlannedNodesToCreate);

  if (decision.messageToUser) {
    await store.addMessage(session.id, "main_brain", decision.messageToUser);
  }

  if (
    decision.action === "complete"
    && limitedPlannedNodesToCreate.length === 0
    && !workflowPolicy.requiresInitialPlanConfirmation
  ) {
    if (!finalReportRetry.allowed) {
      const blockedNode = await createCompletedResearcherNode(
        session.id,
        "audit",
        "Final report retry blocked — no new upstream material",
        {
          blocked: true,
          reason: finalReportRetry.reason,
          failedAttemptCount: finalReportRetry.failedAttemptCount,
          latestFailureNodeId: finalReportRetry.latestFailureNodeId,
        },
        "final_report",
      );
      await store.addMessage(
        session.id,
        "main_brain",
        `${finalReportRetry.reason}\n\nAdd a new evidence/synthesis artifact or request a narrower deliverable before another final_report attempt.`,
      );
      return {
        completedNode: blockedNode,
        suggestedNextContextTag: "final_report",
        isFinalStep: false,
        interactionMode: "confirmation",
        plannedNodesToCreate: [],
        requiresCheckpoint: true,
      };
    }

    const finalReportCheck = canGenerateFinalReport(nodes);
    if (!finalReportCheck.allowed) {
      const blockedNode = await createCompletedResearcherNode(
        session.id,
        "audit",
        "Researcher completion request blocked by active work",
        {
          blocked: true,
          reason: finalReportCheck.reason,
          decision,
        },
        resolveLegacyContextFromNodes(nodes, session.contextTag),
      );
      return {
        completedNode: blockedNode,
        suggestedNextContextTag: resolveLegacyContextFromNodes(nodes, session.contextTag),
        isFinalStep: false,
        interactionMode: "confirmation",
        plannedNodesToCreate: [],
        requiresCheckpoint: true,
      };
    }

    const finalReportNode = await store.createNode(session.id, {
      nodeType: "final_report",
      label: "Generate final research report",
      assignedRole: "research_asset_reuse_specialist",
      input: {
        decision,
        workstationContext,
        hygieneSummary,
      },
      contextTag: "final_report",
    });
    const executed = await executeApprovedNode(
      session,
      finalReportNode,
      [...nodes, finalReportNode],
      await store.getArtifacts(session.id),
      requirementState,
      languageState,
      abortSignal,
    );
    return {
      ...executed,
      plannedNodesToCreate: [],
      requiresCheckpoint: true,
      interactionMode: "confirmation",
    };
  }

  const suggestedNextContextTag = resolveContextTagFromSpecs(
    limitedPlannedNodesToCreate,
    resolveLegacyContextFromNodes(nodes, session.contextTag),
  );
  const requiresCheckpoint = shouldPauseAfterResearcherStep({
    interactionMode,
    requiresInitialPlanConfirmation: workflowPolicy.requiresInitialPlanConfirmation,
    plannedNodeCount: limitedPlannedNodesToCreate.length,
  });

  const completedNode = await createCompletedResearcherNode(
    session.id,
    "audit",
    workflowPolicy.requiresInitialPlanConfirmation
      ? "Researcher initial research plan"
      : limitedPlannedNodesToCreate.length > 0
      ? "Researcher next-task recommendation"
      : interactionMode === "answer_required"
        ? "Researcher clarification request"
        : "Researcher coordination audit",
    {
      decision,
      workstationContext,
      workflowPolicy: {
        mode: workflowPolicy.mode,
        reasoning: workflowPolicy.reasoning,
        blockedNodeTypes: Array.from(workflowPolicy.blockedNodeTypes),
        requiresInitialPlanConfirmation: workflowPolicy.requiresInitialPlanConfirmation,
      },
      hygieneSummary,
      proposedNodeSpecs: limitedPlannedNodesToCreate,
      suggestedNextContextTag,
      requiresUserConfirmation: requiresCheckpoint,
      interactionMode,
    },
    suggestedNextContextTag,
  );

  if (workflowPolicy.requiresInitialPlanConfirmation || limitedPlannedNodesToCreate.length > 0) {
    const dispatchPreviews = buildNodeCreationSpecDispatchPreviews(limitedPlannedNodesToCreate);
    await store.createArtifact(
      session.id,
      completedNode.id,
      "task_graph",
      workflowPolicy.requiresInitialPlanConfirmation ? "Researcher Initial Plan" : "Researcher Next Task",
      {
        nextTaskCount: limitedPlannedNodesToCreate.length,
        nextTask: limitedPlannedNodesToCreate[0] ?? null,
        nextTaskByType: countNodesByType(limitedPlannedNodesToCreate),
        workstationContext,
        workflowPolicy: {
          mode: workflowPolicy.mode,
          reasoning: workflowPolicy.reasoning,
          blockedNodeTypes: Array.from(workflowPolicy.blockedNodeTypes),
          requiresInitialPlanConfirmation: workflowPolicy.requiresInitialPlanConfirmation,
        },
        hygieneSummary,
        proposedNodeSpecs: limitedPlannedNodesToCreate,
        dispatchPreviews,
        suggestedNextContextTag,
        requiresUserConfirmation: requiresCheckpoint,
        interactionMode,
        decision,
      },
    );
  }

  await runPostStepChecks(session, requirementState, suggestedNextContextTag);

  return {
    completedNode,
    suggestedNextContextTag,
    isFinalStep: false,
    interactionMode,
    plannedNodesToCreate: limitedPlannedNodesToCreate,
    requiresCheckpoint,
  };
}

async function createCompletedResearcherNode(
  sessionId: string,
  nodeType: DeepResearchNode["nodeType"],
  label: string,
  output: Record<string, unknown>,
  contextTag: ContextTag,
): Promise<DeepResearchNode> {
  const node = await store.createNode(sessionId, {
    nodeType,
    label,
    assignedRole: "researcher",
    input: output,
    contextTag,
  });
  await store.updateNode(node.id, {
    status: "completed",
    output,
    completedAt: new Date().toISOString(),
  });
  return node;
}

async function runPostStepChecks(
  session: DeepResearchSession,
  requirementState: RequirementState | null,
  contextTagFallback: ContextTag,
): Promise<{
  freshNodes: DeepResearchNode[];
  freshArtifacts: DeepResearchArtifact[];
}> {
  const freshNodes = await store.getNodes(session.id);
  const dagResult = validateDAG(freshNodes);
  if (!dagResult.valid) {
    const repairs = autoRepairDAG(freshNodes, dagResult.errors);
    if (repairs.length > 0) {
      console.warn("[deep-research] DAG auto-repaired:", repairs);
    }
    for (const err of dagResult.errors) {
      if (err.type === "cycle") {
        console.error("[deep-research] DAG cycle detected:", err.message);
      }
    }
  }

  const freshArtifacts = await store.getArtifacts(session.id);
  const consistency = checkConsistency({ ...session, contextTag: contextTagFallback }, freshNodes, freshArtifacts);
  if (consistency.warnings.length > 0) {
    console.warn("[deep-research] Consistency warnings:", consistency.warnings);
  }
  if (!consistency.valid) {
    console.error("[deep-research] Consistency errors:", consistency.errors);
    await store.appendEvent(session.id, "consistency_check", undefined, "system", undefined, undefined, {
      valid: false,
      errors: consistency.errors,
      warnings: consistency.warnings,
    });
    if (consistency.errors.some((error) => error.includes("CRITICAL"))) {
      await store.updateSession(session.id, {
        status: "failed",
        error: `Consistency check failed: ${consistency.errors[0]}`,
      });
      throw new Error(`Consistency check failed: ${consistency.errors[0]}`);
    }
  }

  if (!requirementState) {
    const intakeArtifacts = freshArtifacts.filter((artifact) => artifact.artifactType === "research_brief");
    if (intakeArtifacts.length > 0) {
      const reqState = createInitialRequirements(intakeArtifacts[0].content, "intake");
      await store.saveRequirementState(session.id, reqState);
    }
  }

  await reconcileSessionState(session.id);

  return {
    freshNodes: await store.getNodes(session.id),
    freshArtifacts: await store.getArtifacts(session.id),
  };
}

// =============================================================
// CHECKPOINT GENERATION WITH MAIN BRAIN AUDIT
// =============================================================

async function generateCheckpointAndHalt(
  session: DeepResearchSession,
  completedNode: DeepResearchNode,
  suggestedNextContextTag: ContextTag,
  languageState: LanguageState,
  abortSignal?: AbortSignal,
  isFinalStep = false,
  interactionMode: CheckpointInteractionMode = "confirmation",
): Promise<void> {
  const freshNodes = await store.getNodes(session.id);
  const freshNode = freshNodes.find(n => n.id === completedNode.id) ?? completedNode;
  const checkpointContextTag = freshNode.contextTag ?? session.contextTag;
  const artifacts = await store.getArtifacts(session.id);
  const isFinalReportingCheckpoint = isFinalStep || freshNode.nodeType === "final_report" || checkpointContextTag === "final_report";
  const finalReportCheckpointCopy = isFinalReportingCheckpoint
    ? getFinalReportCheckpointCopy(languageState.preferredOutputLanguage)
    : null;
  const checkpointReviewArtifacts = getCheckpointReviewArtifacts(checkpointContextTag, freshNode, freshNodes, artifacts);
  const literatureSummary = getEvidencePhaseSummary(checkpointContextTag, freshNodes, checkpointReviewArtifacts);
  const planArtifact = artifacts.find((artifact) =>
    artifact.nodeId === freshNode.id && artifact.artifactType === "task_graph"
  );
  const plannedSpecs = planArtifact && Array.isArray(planArtifact.content.proposedNodeSpecs)
    ? normalizeNodeCreationSpecs(planArtifact.content.proposedNodeSpecs as unknown[], checkpointContextTag).validSpecs
    : [];
  const plannedNodeCount = typeof planArtifact?.content.nextTaskCount === "number"
    ? planArtifact.content.nextTaskCount
    : typeof planArtifact?.content.totalNodes === "number"
      ? planArtifact.content.totalNodes
    : 0;
  const recommendedDispatch = getRecommendedDispatch(freshNodes, plannedSpecs);

  const transitionAction = {
    nextContextTag: suggestedNextContextTag,
    nodesToCreate: plannedSpecs,
    nodesToSupersede: [],
    description: isFinalReportingCheckpoint && finalReportCheckpointCopy
      ? finalReportCheckpointCopy.continueWillDo
      : interactionMode === "answer_required"
      ? "Wait for the user to answer the Researcher's clarification questions in chat before any further work."
      : plannedNodeCount > 0
        ? `If you confirm this next task, the Researcher will authorize it and continue coordination from ${suggestedNextContextTag}.`
        : `Resume the session and let the Researcher choose the next work dynamically. Current recommendation: ${suggestedNextContextTag}.`,
  };

  // If this is flagged as final step, verify completion is actually allowed
  if (isFinalStep) {
    const completionCheck = canCompleteSession(freshNodes);
    if (!completionCheck.allowed) {
      console.warn("[deep-research] isFinalStep=true but completion blocked:", completionCheck.reason);
      isFinalStep = false; // Downgrade — don't allow premature completion
    }
  }

  // Language instruction for checkpoint generation
  const langInstruction = languageState.preferredOutputLanguage !== "en"
    ? `\n\nIMPORTANT: The user communicates in ${languageState.preferredOutputLanguage}. Write all user-facing text (title, humanSummary, recommendedNextAction, continueWillDo) in ${languageState.preferredOutputLanguage}. Technical terms may remain in English.`
    : "";

  const checkpointContent = await generateCheckpointContent(
    session, freshNode, artifacts, freshNodes, suggestedNextContextTag, langInstruction, abortSignal
  );
  const guardedCheckpointContent = isFinalReportingCheckpoint
    ? applyFinalReportCheckpointGuard(checkpointContent, languageState.preferredOutputLanguage)
    : checkpointContent;

  const checkpointPkg: CheckpointPackage = {
    checkpointId: nanoid(),
    sessionId: session.id,
    nodeId: freshNode.id,
    stepType: freshNode.nodeType,
    contextTag: checkpointContextTag,
    title: guardedCheckpointContent.title || `${freshNode.label} completed`,
    humanSummary: guardedCheckpointContent.humanSummary || `Completed: ${freshNode.label}`,
    machineSummary: guardedCheckpointContent.machineSummary || "",
    mainBrainAudit: guardedCheckpointContent.mainBrainAudit || {
      whatWasCompleted: freshNode.label,
      resultAssessment: "acceptable",
      issuesAndRisks: [],
      recommendedNextAction: isFinalReportingCheckpoint && finalReportCheckpointCopy
        ? finalReportCheckpointCopy.recommendedNextAction
        : recommendedDispatch
        ? `Proceed to ${recommendedDispatch.roleName}: ${recommendedDispatch.label}`
        : `Proceed to ${suggestedNextContextTag}`,
      continueWillDo: transitionAction.description,
      alternativeActions: [
        { label: "Revise", description: "Revise current step", actionType: "revise" },
        { label: "Stop", description: "End research", actionType: "stop" },
      ],
      canProceed: true,
    },
    artifactsToReview: checkpointReviewArtifacts.map(artifact => artifact.id),
    currentFindings: guardedCheckpointContent.currentFindings || "",
    openQuestions: guardedCheckpointContent.openQuestions || [],
    recommendedNextAction: guardedCheckpointContent.recommendedNextAction || (
      isFinalReportingCheckpoint && finalReportCheckpointCopy
        ? finalReportCheckpointCopy.recommendedNextAction
        : recommendedDispatch
        ? `Proceed to ${recommendedDispatch.roleName}: ${recommendedDispatch.label}`
        : `Proceed to ${suggestedNextContextTag}`
    ),
    recommendedWorker: recommendedDispatch
      ? {
          roleId: recommendedDispatch.roleId,
          roleName: recommendedDispatch.roleName,
          nodeType: recommendedDispatch.nodeType,
          label: recommendedDispatch.label,
        }
      : undefined,
    promptUsed: recommendedDispatch?.promptUsed,
    continueWillDo: transitionAction.description,
    alternativeNextActions: guardedCheckpointContent.alternativeNextActions || [],
    requiresUserConfirmation: true,
    interactionMode,
    isFinalStep,
    transitionAction,
    literatureRoundInfo: !isFinalReportingCheckpoint && session.literatureRound > 0 && literatureSummary ? {
      roundNumber: session.literatureRound,
      papersCollected: literatureSummary.papersCollected,
      retrievalTaskCount: literatureSummary.retrievalTaskCount,
      successfulTaskCount: literatureSummary.successfulTaskCount,
      failedTaskCount: literatureSummary.failedTaskCount,
      emptyTaskCount: literatureSummary.emptyTaskCount,
      coverageSummary: guardedCheckpointContent.currentFindings || "",
    } : undefined,
    reviewInfo: isFinalReportingCheckpoint ? undefined : await getLatestReviewAssessment(session.id),
    createdAt: new Date().toISOString(),
  };

  const checkpointArtifact = await store.createCheckpoint(session.id, freshNode.id, checkpointPkg);
  await consolidateResearchMemory(session.id, { triggerNodeId: freshNode.id });

  // ALWAYS halt at awaiting_user_confirmation — no auto-continue
  await store.updateSession(session.id, {
    status: "awaiting_user_confirmation",
    contextTag: suggestedNextContextTag,
    pendingCheckpointId: checkpointArtifact.id,
  });

  const audit = checkpointPkg.mainBrainAudit;
  const auditSuffix = audit
    ? interactionMode === "answer_required"
      ? `\n\n**Assessment:** ${audit.resultAssessment}\n**Recommended:** ${audit.recommendedNextAction}\n**Reply required:** Answer the Researcher's clarification questions in chat before any task will continue.`
      : `\n\n**Assessment:** ${audit.resultAssessment}\n**Recommended:** ${audit.recommendedNextAction}\n**"Continue" will:** ${checkpointPkg.continueWillDo}`
    : "";
  await store.addMessage(
    session.id,
    "main_brain",
    `**${checkpointPkg.title}**\n\n${checkpointPkg.humanSummary}${auditSuffix}`,
    { checkpointId: checkpointArtifact.id },
    freshNode.id,
    checkpointPkg.artifactsToReview
  );
}

function resolveCheckpointInteractionMode(
  decision: BrainDecision,
  plannedNodesToCreate: NodeCreationSpec[],
): CheckpointInteractionMode {
  if (decision.action === "respond_to_user" && plannedNodesToCreate.length === 0) {
    return "answer_required";
  }
  return "confirmation";
}

async function generateCheckpointContent(
  session: DeepResearchSession,
  completedNode: DeepResearchNode,
  artifacts: DeepResearchArtifact[],
  nodes: DeepResearchNode[],
  contextTag: ContextTag,
  langInstruction: string,
  abortSignal?: AbortSignal
): Promise<{
  title?: string;
  humanSummary?: string;
  machineSummary?: string;
  mainBrainAudit?: MainBrainAudit;
  currentFindings?: string;
  openQuestions?: string[];
  recommendedNextAction?: string;
  continueWillDo?: string;
  alternativeNextActions?: string[];
}> {
  const { model } = getModelForRole("main_brain", session.config);
  const budgetCheck = checkBudget("main_brain", session.budget, session.config.budget);
  if (!budgetCheck.allowed) {
    return {
      title: "Budget limit reached",
      humanSummary: `Step "${completedNode.label}" completed but checkpoint generation budget exceeded.`,
      mainBrainAudit: {
        whatWasCompleted: completedNode.label,
        resultAssessment: "acceptable",
        issuesAndRisks: ["Budget limit reached"],
        recommendedNextAction: "Review manually and decide",
        continueWillDo: `Advance to ${contextTag}`,
        alternativeActions: [],
        canProceed: true,
      },
    };
  }

  try {
    const prompt = buildCheckpointPrompt(session, completedNode, artifacts, nodes, contextTag);
    const doctrineContext = await buildResearcherDoctrinePromptBlock({
      contextTag,
      query: `${completedNode.nodeType} ${completedNode.label}`.trim(),
    });
    const result = await generateText({
      model,
      system: `You are the Researcher. Produce a checkpoint summary with your audit/opinion as JSON.${langInstruction}${doctrineContext ? `\n\n${doctrineContext}` : ""}`,
      messages: [{ role: "user", content: prompt }],
      abortSignal,
    });

    const budget = trackUsage(session.budget, "main_brain", completedNode.id + "_ckpt", result.usage?.totalTokens ?? 0);
    await store.updateSession(session.id, { budget });

    return safeParseJson(result.text);
  } catch (err) {
    console.error("[deep-research] Checkpoint generation failed:", err);
    return {
      title: `${completedNode.label} completed`,
      humanSummary: `Step completed in context ${contextTag}.`,
    };
  }
}

// =============================================================
// MAIN BRAIN CALLS
// =============================================================

async function callMainBrainForConfirmation(
  session: DeepResearchSession,
  checkpoint: CheckpointPackage,
  outcome: ConfirmationOutcome,
  feedback: string | undefined,
  abortSignal?: AbortSignal
): Promise<ConfirmationDecision> {
  const budgetCheck = checkBudget("main_brain", session.budget, session.config.budget);
  if (!budgetCheck.allowed) {
    return { action: "stop", reasoning: "Budget limit reached" };
  }

  const nodes = await store.getNodes(session.id);
  const artifacts = await store.getArtifacts(session.id);
  const { model } = getModelForRole("main_brain", session.config);

  // Add language context
  const messages = await store.getMessages(session.id);
  const langState = resolveLanguageState(messages);
  const langNote = langState.preferredOutputLanguage !== "en"
    ? `\nIMPORTANT: Respond in ${langState.preferredOutputLanguage} for any messageToUser field.`
    : "";

  const prompt = buildConfirmationInterpretationPrompt(
    session, checkpoint, outcome, feedback, nodes, artifacts
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
    // Deterministic fallback: follow transition resolver
    const transitionAction = resolveTransition(session, checkpoint, outcome);
    return outcome === "confirmed"
      ? { action: "continue", reasoning: "User confirmed.", nextContextTag: transitionAction.nextContextTag }
      : { action: "revise", reasoning: "User requested changes." };
  }
}

// =============================================================
// HELPERS
// =============================================================

async function getLatestReviewAssessment(sessionId: string): Promise<ReviewAssessment | undefined> {
  const arts = await store.getArtifacts(sessionId, { type: "review_assessment" });
  if (arts.length === 0) return undefined;
  return arts[arts.length - 1].content as unknown as ReviewAssessment;
}

async function createNodesFromSpecs(
  sessionId: string,
  specs: NodeCreationSpec[],
  defaultContextTag: ContextTag
): Promise<DeepResearchNode[]> {
  const session = await store.getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }
  const existingNodes = await store.getNodes(sessionId);
  const existingArtifacts = await store.getArtifacts(sessionId);
  const existingNodeIds = new Set(existingNodes.map((node) => node.id));
  const existingNodeIdsByLabel = new Map<string, string>();
  for (const node of existingNodes) {
    existingNodeIdsByLabel.set(node.label, node.id);
  }

  const created: DeepResearchNode[] = [];
  const createdNodeIdsByLabel = new Map<string, string>();
  const workflowState = await loadWorkflowRuntimeState(session);
  const limitedSpecs = await normalizeAndLimitNodeSpecs(
    sessionId,
    specs,
    defaultContextTag,
    workflowState.workflowPolicy,
    "node creation",
  );

  for (const normalizedSpec of limitedSpecs) {
    const normalizedInput = normalizedSpec.input && typeof normalizedSpec.input === "object"
      ? canonicalizeArtifactReferenceFields(normalizedSpec.input, existingArtifacts)
      : normalizedSpec.input;
    const node = await store.createNode(sessionId, {
      ...normalizedSpec,
      input: normalizedInput,
      dependsOn: resolveNodeDependencies(
        normalizedSpec.dependsOn ?? [],
        existingNodeIds,
        existingNodeIdsByLabel,
        createdNodeIdsByLabel,
      ),
      contextTag: normalizedSpec.contextTag ?? defaultContextTag,
    });
    createdNodeIdsByLabel.set(normalizedSpec.label, node.id);
    created.push(node);
  }

  for (let i = 0; i < created.length; i++) {
    const normalizedSpec = limitedSpecs[i];
    const resolvedDependsOn = resolveNodeDependencies(
      normalizedSpec.dependsOn ?? [],
      existingNodeIds,
      existingNodeIdsByLabel,
      createdNodeIdsByLabel,
    );
    if (JSON.stringify(created[i].dependsOn) !== JSON.stringify(resolvedDependsOn)) {
      await store.updateNode(created[i].id, { dependsOn: resolvedDependsOn });
    }
  }

  return created;
}

async function loadWorkflowRuntimeState(
  session: DeepResearchSession,
  provided?: Partial<Pick<WorkflowRuntimeState, "messages" | "artifacts">>,
): Promise<WorkflowRuntimeState> {
  const messages = provided?.messages ?? await store.getMessages(session.id);
  const artifacts = provided?.artifacts ?? await store.getArtifacts(session.id);
  const workstationContext = await buildWorkstationPlanningContext(session, messages);
  const workflowPolicy = deriveWorkflowPolicy({
    sessionTitle: session.title,
    userMessages: getUserMessageContents(messages),
    workstationContext,
    artifacts,
  });

  return {
    messages,
    artifacts,
    workstationContext,
    workflowPolicy,
  };
}

function getUserMessageContents(messages: Awaited<ReturnType<typeof store.getMessages>>): string[] {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => message.content);
}
