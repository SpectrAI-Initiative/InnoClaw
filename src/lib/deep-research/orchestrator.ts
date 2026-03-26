// =============================================================
// Deep Research Orchestrator — Step-Gated Dispatcher
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
import { executeNode } from "./node-executor";
import { buildWorkstationPlanningContext } from "./workstation-context";
import { buildNodeContext, callMainBrain } from "./researcher-runtime";
import { extractJsonFromLLMResponse, safeParseJson } from "./json-response";
import { consolidateResearchMemory } from "./memory-fabric";
import { buildResearcherDoctrinePromptBlock } from "./researcher-doctrine";
import { buildNodeCreationSpecDispatchPreviews } from "./node-spec-templates";
import {
  deriveWorkflowPolicy,
  filterNodeSpecsForWorkflowPolicy,
  type WorkflowPolicy,
} from "./workflow-policy";
import { getStructuredPromptForNode, getStructuredRoleDisplayName } from "./role-registry";
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
import { VALID_CONTEXT_TAGS } from "./types";

type WorkflowRuntimeState = {
  messages: Awaited<ReturnType<typeof store.getMessages>>;
  artifacts: Awaited<ReturnType<typeof store.getArtifacts>>;
  workstationContext: Awaited<ReturnType<typeof buildWorkstationPlanningContext>>;
  workflowPolicy: WorkflowPolicy;
};

// =============================================================
// LANGUAGE DETECTION
// =============================================================

/** Detect primary language from text using simple heuristics. */
function detectLanguage(text: string): string {
  // Check for CJK characters (Chinese/Japanese/Korean)
  const cjkChars = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g);
  const totalChars = text.replace(/\s/g, "").length;
  if (cjkChars && cjkChars.length > totalChars * 0.1) return "zh";

  // Check for Japanese-specific characters (hiragana/katakana)
  const jpChars = text.match(/[\u3040-\u309f\u30a0-\u30ff]/g);
  if (jpChars && jpChars.length > 5) return "ja";

  // Check for Korean
  const krChars = text.match(/[\uac00-\ud7af]/g);
  if (krChars && krChars.length > 5) return "ko";

  return "en";
}

/** Get or create language state from user messages. */
function resolveLanguageState(messages: { role: string; content: string }[]): LanguageState {
  const userMessages = messages.filter(m => m.role === "user");
  const latestUserMsg = userMessages[userMessages.length - 1];
  const lang = latestUserMsg ? detectLanguage(latestUserMsg.content) : "en";
  return {
    currentUserLanguage: lang,
    preferredOutputLanguage: lang,
    lastDetectedUserLanguage: lang,
    lastLanguageUpdateAt: new Date().toISOString(),
  };
}

// =============================================================
// INVARIANT CHECKS
// =============================================================

/** Invariant A: Check if final_report can proceed. */
function canGenerateFinalReport(nodes: DeepResearchNode[]): { allowed: boolean; reason?: string } {
  const activePending = nodes.filter(n =>
    n.status !== "superseded" &&
    n.status !== "skipped" &&
    n.status !== "completed" &&
    n.status !== "failed" &&
    n.nodeType !== "final_report"
  );

  if (activePending.length > 0) {
    const labels = activePending.slice(0, 5).map(n => `"${n.label}" (${n.status})`).join(", ");
    return {
      allowed: false,
      reason: `Cannot generate final report: ${activePending.length} required node(s) still pending/running: ${labels}`,
    };
  }

  return { allowed: true };
}

/** Invariant B: Check if session can be marked completed. */
function canCompleteSession(nodes: DeepResearchNode[]): { allowed: boolean; reason?: string } {
  // Check for any non-terminal nodes that are NOT superseded
  const activeNodes = nodes.filter(n =>
    n.status !== "superseded" &&
    n.status !== "skipped" &&
    n.status !== "completed" &&
    n.status !== "failed"
  );

  if (activeNodes.length > 0) {
    const labels = activeNodes.slice(0, 5).map(n => `"${n.label}" (${n.status})`).join(", ");
    return {
      allowed: false,
      reason: `Cannot complete session: ${activeNodes.length} node(s) still active: ${labels}`,
    };
  }

  return { allowed: true };
}

/** Invariant D: Check evidence sufficiency for synthesis. */
function checkEvidenceSufficiency(nodes: DeepResearchNode[], artifacts: DeepResearchArtifact[]): {
  canSynthesize: boolean;
  emptyStreams: string[];
  totalSources: number;
} {
  const evidenceNodes = nodes.filter(n =>
    n.nodeType === "evidence_gather" &&
    (n.status === "completed" || n.status === "failed")
  );

  let totalSources = 0;
  const emptyStreams: string[] = [];

  for (const node of evidenceNodes) {
    const nodeArtifacts = artifacts.filter(a => a.nodeId === node.id && a.artifactType === "evidence_card");
    if (nodeArtifacts.length === 0) {
      emptyStreams.push(node.label);
      continue;
    }
    const content = nodeArtifacts[0].content;
    const sources = (content.sources as unknown[]) ?? (content.claims as unknown[]) ?? [];
    const totalFound = (content.totalFound as number) ?? (content.papersFound as number) ?? sources.length;
    if (totalFound === 0 && sources.length === 0) {
      emptyStreams.push(node.label);
    } else {
      totalSources += Math.max(totalFound, sources.length);
    }
  }

  return {
    canSynthesize: totalSources > 0,
    emptyStreams,
    totalSources,
  };
}

// =============================================================
// PUBLIC API
// =============================================================

/**
 * Run ONE step of the deep research workflow, then halt at checkpoint.
 * INVARIANT C: This function NEVER auto-confirms. It always halts at checkpoint.
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
    await routeNextAction(session, abortSignal);
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

async function routeNextAction(session: DeepResearchSession, abortSignal?: AbortSignal): Promise<void> {
  const fresh = await store.getSession(session.id);
  if (!fresh) return;

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
    await generateCheckpointAndHalt(
      { ...fresh, contextTag: executed.suggestedNextContextTag },
      executed.completedNode,
      executed.suggestedNextContextTag,
      languageState,
      abortSignal,
      executed.isFinalStep,
      "confirmation",
    );
    return;
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

  await generateCheckpointAndHalt(
    { ...fresh, contextTag: researcherStep.suggestedNextContextTag },
    researcherStep.completedNode,
    researcherStep.suggestedNextContextTag,
    languageState,
    abortSignal,
    researcherStep.isFinalStep,
    researcherStep.interactionMode,
  );
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
      };
    }
  }

  const nodeContext = await buildNodeContext(session.id);
  await executeNode(node, nodeContext, abortSignal);

  const { freshNodes } = await runPostStepChecks(session, requirementState, node.contextTag);
  const refreshedCompletedNode = freshNodes.find((candidate) => candidate.id === node.id) ?? node;

  return {
    completedNode: refreshedCompletedNode,
    suggestedNextContextTag: resolveLegacyContextFromNodes(freshNodes, node.contextTag),
    isFinalStep: node.nodeType === "final_report",
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
): Promise<{
  completedNode: DeepResearchNode;
  suggestedNextContextTag: ContextTag;
  isFinalStep: boolean;
  interactionMode: CheckpointInteractionMode;
}> {
  const { workstationContext, workflowPolicy } = workflowState;
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

  const limitedPlannedNodesToCreate = await normalizeAndLimitNodeSpecs(
    session.id,
    decision.nodesToCreate ?? [],
    session.contextTag,
    workflowPolicy,
    "researcher planning",
  );
  const interactionMode = resolveCheckpointInteractionMode(decision, limitedPlannedNodesToCreate);

  if (decision.messageToUser) {
    await store.addMessage(session.id, "main_brain", decision.messageToUser);
  }

  if (
    decision.action === "complete"
    && limitedPlannedNodesToCreate.length === 0
    && !workflowPolicy.requiresInitialPlanConfirmation
  ) {
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
      interactionMode: "confirmation",
    };
  }

  const suggestedNextContextTag = resolveContextTagFromSpecs(
    limitedPlannedNodesToCreate,
    resolveLegacyContextFromNodes(nodes, session.contextTag),
  );

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
      requiresUserConfirmation: true,
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
        requiresUserConfirmation: true,
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

function resolveLegacyContextFromNodes(nodes: DeepResearchNode[], fallback: ContextTag): ContextTag {
  const activeNode = [...nodes]
    .filter((node) =>
      node.status !== "superseded" &&
      node.status !== "skipped" &&
      node.status !== "completed" &&
      node.status !== "failed"
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];

  return activeNode?.contextTag ?? fallback;
}

function countNodesByType(specs: NodeCreationSpec[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const spec of specs) {
    counts[spec.nodeType] = (counts[spec.nodeType] ?? 0) + 1;
  }
  return counts;
}

function getRecommendedDispatch(
  freshNodes: DeepResearchNode[],
  plannedSpecs: NodeCreationSpec[],
): {
  roleId: NodeCreationSpec["assignedRole"];
  roleName: string;
  nodeType: NodeCreationSpec["nodeType"];
  label: string;
  promptUsed?: {
    title: string;
    kind: ReturnType<typeof getStructuredPromptForNode> extends infer T
      ? T extends { kind: infer K } ? K : never
      : never;
    objective: string;
  };
} | null {
  const pendingNode = freshNodes
    .filter((node) => node.status === "pending" || node.status === "queued")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];

  const candidate = pendingNode
    ? {
        assignedRole: pendingNode.assignedRole,
        nodeType: pendingNode.nodeType,
        label: pendingNode.label,
      }
    : plannedSpecs[0];

  if (!candidate) {
    return null;
  }

  const prompt = getStructuredPromptForNode(candidate.assignedRole, candidate.nodeType);
  return {
    roleId: candidate.assignedRole,
    roleName: getStructuredRoleDisplayName(candidate.assignedRole, candidate.nodeType),
    nodeType: candidate.nodeType,
    label: candidate.label,
    promptUsed: prompt
      ? {
          title: prompt.title,
          kind: prompt.kind,
          objective: prompt.objective,
        }
      : undefined,
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

function applyFinalReportCheckpointGuard(
  checkpointContent: {
    title?: string;
    humanSummary?: string;
    machineSummary?: string;
    mainBrainAudit?: MainBrainAudit;
    currentFindings?: string;
    openQuestions?: string[];
    recommendedNextAction?: string;
    continueWillDo?: string;
    alternativeNextActions?: string[];
  },
  preferredOutputLanguage: string,
): {
  title?: string;
  humanSummary?: string;
  machineSummary?: string;
  mainBrainAudit?: MainBrainAudit;
  currentFindings?: string;
  openQuestions?: string[];
  recommendedNextAction?: string;
  continueWillDo?: string;
  alternativeNextActions?: string[];
} {
  const copy = getFinalReportCheckpointCopy(preferredOutputLanguage);
  return {
    ...checkpointContent,
    recommendedNextAction: copy.recommendedNextAction,
    continueWillDo: copy.continueWillDo,
    alternativeNextActions: copy.alternativeNextActions,
    mainBrainAudit: checkpointContent.mainBrainAudit
      ? {
          ...checkpointContent.mainBrainAudit,
          recommendedNextAction: copy.recommendedNextAction,
          continueWillDo: copy.continueWillDo,
          alternativeActions: checkpointContent.mainBrainAudit.alternativeActions.filter(
            (action) => action.actionType !== "more_literature"
          ),
        }
      : undefined,
  };
}

function getFinalReportCheckpointCopy(preferredOutputLanguage: string): {
  recommendedNextAction: string;
  continueWillDo: string;
  alternativeNextActions: string[];
} {
  if (preferredOutputLanguage.startsWith("zh")) {
    return {
      recommendedNextAction: "请审阅最终报告，并选择接受为本次研究结论，或提出定向修改意见；不要回退到早期的大范围文献检索轮次。",
      continueWillDo: "继续将把这份最终报告作为当前研究交付物并结束本次会话；如果你希望补充内容，请选择修订并指出需要补充的具体证据或段落。",
      alternativeNextActions: [
        "接受最终报告并结束本次研究",
        "要求定向修订最终报告中的具体段落、论证或证据",
      ],
    };
  }

  return {
    recommendedNextAction: "Review the final report and either accept it as the session outcome or request targeted revisions; do not restart broad literature rounds from earlier phases.",
    continueWillDo: "Continue will finalize this report as the current research deliverable and close the session unless you request targeted revisions.",
    alternativeNextActions: [
      "Accept the final report and close the session",
      "Request targeted revisions to specific sections, claims, or supporting evidence",
    ],
  };
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
    const node = await store.createNode(sessionId, {
      ...normalizedSpec,
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

function validateContextTag(contextTag: string | undefined, fallback: ContextTag): ContextTag {
  if (!contextTag) return fallback;
  const normalized = contextTag.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (VALID_CONTEXT_TAGS.includes(normalized as ContextTag)) return normalized as ContextTag;
  if (normalized === "report") return "final_report";
  if (normalized === "plan") return "planning";
  if (normalized === "start") return "intake";
  return "planning";
}

function getCheckpointReviewArtifacts(
  contextTag: ContextTag,
  completedNode: DeepResearchNode,
  nodes: DeepResearchNode[],
  artifacts: DeepResearchArtifact[],
): DeepResearchArtifact[] {
  if (!isLiteratureExecutionContext(contextTag, completedNode, nodes)) {
    return artifacts.filter((artifact) => artifact.nodeId === completedNode.id);
  }

  const relevantNodeIds = new Set(
    nodes
      .filter((node) =>
        node.nodeType === "evidence_gather" &&
        node.contextTag === contextTag &&
        ["completed", "failed", "skipped"].includes(node.status)
      )
      .map((node) => node.id)
  );

  const evidenceArtifacts = artifacts.filter((artifact) =>
    artifact.artifactType === "evidence_card" &&
    Boolean(artifact.nodeId) &&
    relevantNodeIds.has(artifact.nodeId as string)
  );

  return evidenceArtifacts.length > 0
    ? evidenceArtifacts
    : artifacts.filter((artifact) => artifact.nodeId === completedNode.id);
}

function aggregateSourceCount(artifacts: DeepResearchArtifact[]): number {
  return artifacts.reduce((sum, artifact) => {
    const sources = Array.isArray(artifact.content.sources) ? artifact.content.sources : [];
    const totalFound = typeof artifact.content.totalFound === "number"
      ? artifact.content.totalFound
      : typeof artifact.content.papersFound === "number"
        ? artifact.content.papersFound
        : sources.length;
    return sum + Math.max(totalFound, sources.length);
  }, 0);
}

function getEvidencePhaseSummary(
  contextTag: ContextTag,
  nodes: DeepResearchNode[],
  artifacts: DeepResearchArtifact[],
): {
  papersCollected: number;
  retrievalTaskCount: number;
  successfulTaskCount: number;
  failedTaskCount: number;
  emptyTaskCount: number;
} | null {
  const relevantCompletedNode = nodes.find((node) =>
    node.contextTag === contextTag &&
    ["completed", "failed", "skipped"].includes(node.status)
  );
  if (!isLiteratureExecutionContext(contextTag, relevantCompletedNode, nodes)) {
    return null;
  }

  const relevantNodes = nodes.filter((node) =>
    node.nodeType === "evidence_gather" &&
    node.contextTag === contextTag &&
    ["completed", "failed", "skipped"].includes(node.status)
  );

  const artifactByNodeId = new Map(
    artifacts
      .filter((artifact) => artifact.artifactType === "evidence_card" && artifact.nodeId)
      .map((artifact) => [artifact.nodeId as string, artifact])
  );

  let successfulTaskCount = 0;
  let failedTaskCount = 0;
  let emptyTaskCount = 0;

  for (const node of relevantNodes) {
    if (node.status === "failed") {
      failedTaskCount += 1;
      continue;
    }

    const artifact = artifactByNodeId.get(node.id);
    const sources = Array.isArray(artifact?.content.sources) ? artifact.content.sources : [];
    const totalFound = typeof artifact?.content.totalFound === "number"
      ? artifact.content.totalFound
      : typeof artifact?.content.papersFound === "number"
        ? artifact.content.papersFound
        : sources.length;

    if (Math.max(totalFound, sources.length) > 0) {
      successfulTaskCount += 1;
    } else {
      emptyTaskCount += 1;
    }
  }

  return {
    papersCollected: aggregateSourceCount(artifacts),
    retrievalTaskCount: relevantNodes.length,
    successfulTaskCount,
    failedTaskCount,
    emptyTaskCount,
  };
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

async function normalizeAndLimitNodeSpecs(
  sessionId: string,
  rawSpecs: unknown[],
  defaultContextTag: ContextTag,
  workflowPolicy: WorkflowPolicy,
  source: string,
): Promise<NodeCreationSpec[]> {
  const { validSpecs, droppedSpecs } = normalizeNodeCreationSpecs(rawSpecs, defaultContextTag);
  if (droppedSpecs.length > 0) {
    await store.addMessage(
      sessionId,
      "system",
      `${droppedSpecs.length} malformed task(s) were ignored before ${source}.`,
    );
  }

  const { allowedSpecs, blockedSpecs } = filterNodeSpecsForWorkflowPolicy(validSpecs, workflowPolicy);
  if (blockedSpecs.length > 0) {
    await store.addMessage(
      sessionId,
      "system",
      `Blocked ${blockedSpecs.length} task(s) during ${source} because they do not fit the current workflow policy: ${blockedSpecs.map((spec) => `${spec.label} (${spec.nodeType})`).join(", ")}.`,
    );
  }

  return enforceSingleWorkerDispatch(sessionId, allowedSpecs, source);
}

async function selectNextReadyNodeForWorkflow(
  sessionId: string,
  workflowPolicy: WorkflowPolicy,
): Promise<DeepResearchNode | undefined> {
  const readyNodes = (await store.getReadyNodes(sessionId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const blockedReadyNodes = readyNodes.filter((node) => workflowPolicy.blockedNodeTypes.has(node.nodeType));
  if (blockedReadyNodes.length > 0) {
    const completedAt = new Date().toISOString();
    for (const node of blockedReadyNodes) {
      await store.updateNode(node.id, {
        status: "skipped",
        completedAt,
        error: `Skipped by workflow policy (${workflowPolicy.mode}).`,
      });
    }
    await store.addMessage(
      sessionId,
      "system",
      `Skipped ${blockedReadyNodes.length} ready node(s) because the session is currently in ${workflowPolicy.mode} mode: ${blockedReadyNodes.map((node) => `${node.label} (${node.nodeType})`).join(", ")}.`,
    );
  }

  return readyNodes.find((node) => !workflowPolicy.blockedNodeTypes.has(node.nodeType));
}

async function enforceSingleWorkerDispatch(
  sessionId: string,
  specs: NodeCreationSpec[],
  source: string,
): Promise<NodeCreationSpec[]> {
  if (specs.length <= 1) {
    return specs;
  }

  await store.addMessage(
    sessionId,
    "system",
    `${specs.length - 1} extra task(s) from ${source} were dropped. Deep Research now dispatches at most one worker task at a time.`,
  );

  return specs.slice(0, 1);
}

function resolveContextTagFromSpecs(specs: NodeCreationSpec[], fallback: ContextTag): ContextTag {
  const explicitContextTag = specs.find((spec): spec is NodeCreationSpec & { contextTag: ContextTag } => Boolean(spec.contextTag))?.contextTag;
  return explicitContextTag ? validateContextTag(explicitContextTag, fallback) : fallback;
}

function isLiteratureExecutionContext(
  contextTag: ContextTag,
  completedNode: DeepResearchNode | undefined,
  nodes: DeepResearchNode[],
): boolean {
  if (contextTag !== "planning") {
    return false;
  }

  if (completedNode?.nodeType === "evidence_gather") {
    return true;
  }

  return nodes.some((node) =>
    node.nodeType === "evidence_gather" &&
    node.contextTag === "planning" &&
    ["completed", "failed", "skipped"].includes(node.status)
  );
}

function resolveNodeDependencies(
  dependsOn: string[],
  existingNodeIds: Set<string>,
  existingNodeIdsByLabel: Map<string, string>,
  createdNodeIdsByLabel: Map<string, string>,
): string[] {
  const resolved = new Set<string>();

  for (const dependency of dependsOn) {
    if (existingNodeIds.has(dependency)) {
      resolved.add(dependency);
      continue;
    }

    const existingMatch = existingNodeIdsByLabel.get(dependency);
    if (existingMatch) {
      resolved.add(existingMatch);
      continue;
    }

    const createdMatch = createdNodeIdsByLabel.get(dependency);
    if (createdMatch) {
      resolved.add(createdMatch);
    }
  }

  return [...resolved];
}
