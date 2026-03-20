// =============================================================
// Deep Research Orchestrator — Step-Gated Dispatcher
// =============================================================
// Invariants enforced:
// A. No final_report while active branch has pending required nodes
// B. No session completion while active work remains
// C. No auto-confirmation — only explicit user action
// D. No synthesis from empty evidence
// E. Real-time graph state consistency
// F. Sequential ordering enforced via stage numbers
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
import type {
  DeepResearchSession,
  DeepResearchNode,
  DeepResearchArtifact,
  Phase,
  ConfirmationDecision,
  ConfirmationOutcome,
  CheckpointPackage,
  NodeCreationSpec,
  MainBrainAudit,
  ReviewerBattleResult,
  LanguageState,
  PHASE_STAGE_NUMBER as _PSN,
} from "./types";
import { PHASE_ORDER, PHASE_STAGE_NUMBER } from "./types";

// Phase handlers
import { handleIntake } from "./phases/intake";
import { handlePlanning } from "./phases/planning";
import { handleEvidenceCollection } from "./phases/evidence-collection";
import { handleLiteratureSynthesis } from "./phases/literature-synthesis";
import { handleReviewerDeliberation } from "./phases/reviewer-deliberation";
import { handleDecision } from "./phases/decision";
import { handleAdditionalLiterature } from "./phases/additional-literature";
import { handleValidationPlanning } from "./phases/validation-planning";
import { handleResourceAcquisition } from "./phases/resource-acquisition";
import { handleExperimentExecution } from "./phases/experiment-execution";
import { handleValidationReview } from "./phases/validation-review";
import { handleFinalReport } from "./phases/final-report";
import type { PhaseHandlerResult } from "./phases/types";

type OnEvent = (event: { type: string; payload?: unknown }) => void;

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
function canGenerateFinalReport(nodes: DeepResearchNode[], session: DeepResearchSession): { allowed: boolean; reason?: string } {
  // Check active-branch pending required nodes
  const activePending = nodes.filter(n =>
    n.status !== "superseded" &&
    n.status !== "skipped" &&
    n.status !== "completed" &&
    n.status !== "failed" &&
    n.nodeType !== "final_report" &&
    // Only block on phases that should come BEFORE final_report
    PHASE_STAGE_NUMBER[n.phase] < PHASE_STAGE_NUMBER["final_report"]
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
function canCompleteSession(nodes: DeepResearchNode[], session: DeepResearchSession): { allowed: boolean; reason?: string } {
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
  _onEvent?: OnEvent
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
    "reviewer_battle_in_progress", "awaiting_additional_literature",
    "validation_planning_in_progress", "execution_prepared",
    "execution_in_progress", "final_report_generated", "reviewing", "awaiting_resource"]);
  if (startableStatuses.has(session.status)) {
    await store.updateSession(sessionId, { status: "running" });
  }

  if (abortSignal?.aborted) throw new Error("Aborted");

  try {
    await routePhase(session, abortSignal);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown orchestrator error";
    console.error(`[deep-research] Phase error in "${session.phase}":`, message);
    await store.updateSession(sessionId, {
      status: "failed",
      error: message,
    });
    await store.appendEvent(sessionId, "session_failed", undefined, "system", undefined, undefined, {
      error: message,
      phase: session.phase,
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
      phase: session.phase,
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

  // Update language if user provided feedback
  if (feedback) {
    const lang = detectLanguage(feedback);
    await store.appendEvent(sessionId, "phase_changed", undefined, "system", undefined, undefined, {
      languageUpdate: lang,
    });
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
    // deterministic transition based on current phase.
    console.warn("[deep-research] No checkpoint found — using deterministic recovery path");

    if (outcome === "confirmed") {
      // Resume: set to running in the current phase and re-enter orchestrator
      await store.updateSession(sessionId, { status: "running", pendingCheckpointId: null });
      await store.addMessage(sessionId, "system",
        `Resuming research in phase: ${session.phase}`);
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
      ? { action: "continue", reasoning: "User confirmed. Following transition resolver.", nextPhase: transitionAction.nextPhase }
      : outcome === "rejected"
        ? { action: "stop", reasoning: "User rejected." }
        : { action: "revise", reasoning: `User requested ${outcome}.` };
  }

  await store.updateSession(sessionId, { pendingCheckpointId: null });

  if (decision.messageToUser) {
    await store.addMessage(sessionId, "main_brain", decision.messageToUser, undefined, nodeId);
  }

  // INVARIANT B: Before completing, verify all work is done
  if (checkpoint.isFinalStep && (outcome === "confirmed" || decision.action === "continue")) {
    const nodes = await store.getNodes(sessionId);
    const completionCheck = canCompleteSession(nodes, session);
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
      const targetPhase = decision.nextPhase
        ? validatePhase(decision.nextPhase, transitionAction.nextPhase)
        : transitionAction.nextPhase;
      await store.updateSession(sessionId, { status: "running", phase: targetPhase });
      break;
    }
    case "revise": {
      if (decision.nodesToCreate?.length) {
        await createNodesFromSpecs(sessionId, decision.nodesToCreate, session.phase);
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
        await createNodesFromSpecs(sessionId, decision.nodesToCreate, session.phase);
      }
      await store.updateSession(sessionId, { status: "running" });
      break;
    }
    case "supersede": {
      if (decision.nodesToCreate?.length) {
        await createNodesFromSpecs(sessionId, decision.nodesToCreate, session.phase);
      }
      const targetPhase = decision.nextPhase ? validatePhase(decision.nextPhase, session.phase) : session.phase;
      await store.updateSession(sessionId, { status: "running", phase: targetPhase });
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
      await store.updateSession(sessionId, { status: "running", phase: transitionAction.nextPhase });
    }
  }

  await runDeepResearch(sessionId, abortSignal);
}

// =============================================================
// PHASE ROUTER — Thin Dispatcher
// =============================================================

async function routePhase(session: DeepResearchSession, abortSignal?: AbortSignal): Promise<void> {
  const fresh = await store.getSession(session.id);
  if (!fresh) return;

  // Load requirement state
  const requirementState = await store.getLatestRequirementState(fresh.id);

  // Build context
  const nodes = await store.getNodes(fresh.id);
  const artifacts = await store.getArtifacts(fresh.id);
  const messages = await store.getMessages(fresh.id);

  // Resolve language state from user messages
  const languageState = resolveLanguageState(messages);

  // INVARIANT A: Block final_report if required nodes are still pending
  if (fresh.phase === "final_report") {
    const frCheck = canGenerateFinalReport(nodes, fresh);
    if (!frCheck.allowed) {
      console.warn("[deep-research] Final report blocked:", frCheck.reason);

      // Auto-supersede pending nodes from earlier phases when the session
      // has explicitly decided to advance (experimental pivot, etc.)
      const pendingEarlierNodes = nodes.filter(n =>
        n.status === "pending" &&
        (PHASE_STAGE_NUMBER[n.phase] ?? 0) < PHASE_STAGE_NUMBER["final_report"]
      );

      if (pendingEarlierNodes.length > 0) {
        // Supersede them — the orchestrator decided to go to final_report
        for (const node of pendingEarlierNodes) {
          await store.updateNode(node.id, {
            status: "superseded",
            output: { reason: `Auto-superseded: session advanced to final_report` },
            completedAt: new Date().toISOString(),
          });
        }
        await store.addMessage(fresh.id, "system",
          `${pendingEarlierNodes.length} pending node(s) from earlier phases were superseded to unblock final report generation.`);
        await store.appendEvent(fresh.id, "nodes_superseded", undefined, "system", undefined, undefined, {
          count: pendingEarlierNodes.length,
          reason: "Auto-superseded for final_report",
          supersededNodeIds: pendingEarlierNodes.map(n => n.id),
        });
        // Re-check — should now pass
        const recheck = canGenerateFinalReport(
          await store.getNodes(fresh.id), fresh
        );
        if (!recheck.allowed) {
          // Still blocked (running nodes?) — halt for user
          await store.addMessage(fresh.id, "system",
            `Final report still blocked after superseding pending nodes: ${recheck.reason}`);
          await store.updateSession(fresh.id, { status: "awaiting_user_confirmation" });
          return;
        }
        // Fall through to normal final_report handling
      } else {
        // No pending nodes to supersede — might be running nodes
        await store.addMessage(fresh.id, "system",
          `Final report generation blocked: ${frCheck.reason}. Waiting for active work to complete.`);
        await store.updateSession(fresh.id, { status: "awaiting_user_confirmation" });
        return;
      }
    }
  }

  // INVARIANT D: Block literature_synthesis if evidence is empty
  if (fresh.phase === "literature_synthesis") {
    const evidenceCheck = checkEvidenceSufficiency(nodes, artifacts);
    if (!evidenceCheck.canSynthesize) {
      console.warn("[deep-research] Synthesis blocked: no evidence found");
      await store.addMessage(fresh.id, "main_brain",
        `Evidence retrieval returned zero usable sources. Cannot synthesize findings from empty evidence. ` +
        `Failed/empty streams: ${evidenceCheck.emptyStreams.join(", ")}. ` +
        `Please decide: retry evidence collection or stop the research.`);
      await store.updateSession(fresh.id, {
        status: "awaiting_user_confirmation",
        phase: "evidence_collection",
      });
      // Create a checkpoint so user can act
      const lastNode = nodes.filter(n => n.nodeType === "evidence_gather").pop() ?? nodes[nodes.length - 1];
      if (lastNode) {
        const ckpt: CheckpointPackage = {
          checkpointId: nanoid(),
          sessionId: fresh.id,
          nodeId: lastNode.id,
          stepType: "evidence_gather",
          phase: "evidence_collection",
          title: "Evidence Retrieval Failed — No Sources Found",
          humanSummary: `All evidence retrieval streams returned zero usable sources (${evidenceCheck.emptyStreams.length} empty streams). Synthesis cannot proceed without evidence.`,
          machineSummary: `evidence_sufficiency_check_failed: totalSources=0, emptyStreams=${evidenceCheck.emptyStreams.length}`,
          mainBrainAudit: {
            whatWasCompleted: "Evidence collection attempted",
            resultAssessment: "problematic",
            issuesAndRisks: ["Zero sources retrieved", "Synthesis would be fabrication without evidence"],
            recommendedNextAction: "Retry evidence collection with different search terms",
            continueWillDo: "Retry evidence collection with broader search terms",
            alternativeActions: [
              { label: "Retry Search", description: "Try again with broader keywords", actionType: "retry" },
              { label: "Stop", description: "End research due to insufficient evidence", actionType: "stop" },
            ],
            canProceed: false,
          },
          artifactsToReview: [],
          currentFindings: "No evidence retrieved.",
          openQuestions: ["Why did search return zero results?"],
          recommendedNextAction: "Retry with broader search terms",
          continueWillDo: "Retry evidence collection with adjusted search strategy",
          alternativeNextActions: ["Stop research"],
          requiresUserConfirmation: true,
          transitionAction: { nextPhase: "evidence_collection", nodesToCreate: [], nodesToSupersede: [], description: "Retry evidence collection" },
          createdAt: new Date().toISOString(),
        };
        const ckptArt = await store.createCheckpoint(fresh.id, lastNode.id, ckpt);
        await store.updateSession(fresh.id, { pendingCheckpointId: ckptArt.id });
      }
      return;
    }
  }

  const ctx = {
    session: fresh,
    nodes,
    artifacts,
    messages,
    requirementState,
    languageState,
    config: fresh.config,
    abortSignal,
  };

  // Route to phase handler
  const handler = getPhaseHandler(fresh.phase);
  const result = await handler(ctx);

  // Post-step: DAG validation
  const freshNodes = await store.getNodes(fresh.id);
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

  // Post-step: Consistency check (enhanced)
  const freshArtifacts = await store.getArtifacts(fresh.id);
  const consistency = checkConsistency(fresh, freshNodes, freshArtifacts);
  if (consistency.warnings.length > 0) {
    console.warn("[deep-research] Consistency warnings:", consistency.warnings);
  }
  if (!consistency.valid) {
    console.error("[deep-research] Consistency errors:", consistency.errors);
    await store.appendEvent(fresh.id, "consistency_check", undefined, "system", undefined, undefined, {
      valid: false,
      errors: consistency.errors,
      warnings: consistency.warnings,
    });
    // Block advancement on critical consistency errors
    if (consistency.errors.some(e => e.includes("CRITICAL"))) {
      await store.updateSession(fresh.id, { status: "failed", error: `Consistency check failed: ${consistency.errors[0]}` });
      return;
    }
  }

  // Post-step: Save initial requirements after intake
  if (fresh.phase === "intake" && !requirementState) {
    const intakeArtifacts = freshArtifacts.filter(a => a.artifactType === "research_brief");
    if (intakeArtifacts.length > 0) {
      const reqState = createInitialRequirements(intakeArtifacts[0].content, "intake");
      await store.saveRequirementState(fresh.id, reqState);
    }
  }

  // Generate checkpoint and HALT — always wait for user
  await generateCheckpointAndHalt(
    fresh,
    result.completedNode,
    result.suggestedNextPhase,
    languageState,
    abortSignal,
    result.isFinalStep ?? false
  );
}

function getPhaseHandler(phase: Phase): (ctx: import("./types").PhaseContext) => Promise<PhaseHandlerResult> {
  switch (phase) {
    case "intake": return handleIntake;
    case "planning": return handlePlanning;
    case "evidence_collection": return handleEvidenceCollection;
    case "literature_synthesis": return handleLiteratureSynthesis;
    case "reviewer_deliberation": return handleReviewerDeliberation;
    case "decision": return handleDecision;
    case "additional_literature": return handleAdditionalLiterature;
    case "validation_planning": return handleValidationPlanning;
    case "resource_acquisition": return handleResourceAcquisition;
    case "experiment_execution": return handleExperimentExecution;
    case "validation_review": return handleValidationReview;
    case "final_report": return handleFinalReport;
    default: throw new Error(`Unknown phase: ${phase}`);
  }
}

// =============================================================
// CHECKPOINT GENERATION WITH MAIN BRAIN AUDIT
// =============================================================

async function generateCheckpointAndHalt(
  session: DeepResearchSession,
  completedNode: DeepResearchNode,
  suggestedNextPhase: Phase,
  languageState: LanguageState,
  abortSignal?: AbortSignal,
  isFinalStep = false
): Promise<void> {
  const freshNodes = await store.getNodes(session.id);
  const freshNode = freshNodes.find(n => n.id === completedNode.id) ?? completedNode;
  const artifacts = await store.getArtifacts(session.id);

  // Compute transition action
  const transitionAction = resolveTransition(
    session,
    { phase: session.phase } as CheckpointPackage,
    "confirmed"
  );

  // If this is flagged as final step, verify completion is actually allowed
  if (isFinalStep) {
    const completionCheck = canCompleteSession(freshNodes, session);
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
    session, freshNode, artifacts, freshNodes, suggestedNextPhase, langInstruction, abortSignal
  );

  const stageNumber = PHASE_STAGE_NUMBER[session.phase] ?? 0;

  const checkpointPkg: CheckpointPackage = {
    checkpointId: nanoid(),
    sessionId: session.id,
    nodeId: freshNode.id,
    stepType: freshNode.nodeType,
    phase: session.phase,
    title: checkpointContent.title || `${freshNode.label} completed`,
    humanSummary: checkpointContent.humanSummary || `Completed: ${freshNode.label}`,
    machineSummary: checkpointContent.machineSummary || "",
    mainBrainAudit: checkpointContent.mainBrainAudit || {
      whatWasCompleted: freshNode.label,
      resultAssessment: "acceptable",
      issuesAndRisks: [],
      recommendedNextAction: `Proceed to ${suggestedNextPhase}`,
      continueWillDo: transitionAction.description,
      alternativeActions: [
        { label: "Revise", description: "Revise current step", actionType: "revise" },
        { label: "Stop", description: "End research", actionType: "stop" },
      ],
      canProceed: true,
    },
    artifactsToReview: artifacts.filter(a => a.nodeId === freshNode.id).map(a => a.id),
    currentFindings: checkpointContent.currentFindings || "",
    openQuestions: checkpointContent.openQuestions || [],
    recommendedNextAction: checkpointContent.recommendedNextAction || `Proceed to ${suggestedNextPhase}`,
    continueWillDo: transitionAction.description,
    alternativeNextActions: checkpointContent.alternativeNextActions || [],
    requiresUserConfirmation: true,
    isFinalStep,
    transitionAction,
    literatureRoundInfo: session.literatureRound > 0 ? {
      roundNumber: session.literatureRound,
      papersCollected: freshNodes.filter(n => n.nodeType === "evidence_gather" && n.status === "completed").length,
      coverageSummary: checkpointContent.currentFindings || "",
    } : undefined,
    reviewerBattleInfo: await getLatestBattleResult(session.id),
    createdAt: new Date().toISOString(),
  };

  const checkpointArtifact = await store.createCheckpoint(session.id, freshNode.id, checkpointPkg);

  // ALWAYS halt at awaiting_user_confirmation — no auto-continue
  await store.updateSession(session.id, {
    status: "awaiting_user_confirmation",
    phase: suggestedNextPhase,
    pendingCheckpointId: checkpointArtifact.id,
  });

  const audit = checkpointPkg.mainBrainAudit;
  const auditSuffix = audit
    ? `\n\n**Assessment:** ${audit.resultAssessment}\n**Stage:** ${stageNumber}/11\n**Recommended:** ${audit.recommendedNextAction}\n**"Continue" will:** ${checkpointPkg.continueWillDo}`
    : "";
  await store.addMessage(
    session.id,
    "main_brain",
    `**${checkpointPkg.title}**\n\n${checkpointPkg.humanSummary}${auditSuffix}`,
    { checkpointId: checkpointArtifact.id, stageNumber },
    freshNode.id,
    checkpointPkg.artifactsToReview
  );
}

async function generateCheckpointContent(
  session: DeepResearchSession,
  completedNode: DeepResearchNode,
  artifacts: DeepResearchArtifact[],
  nodes: DeepResearchNode[],
  phase: Phase,
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
        continueWillDo: `Advance to ${phase}`,
        alternativeActions: [],
        canProceed: true,
      },
    };
  }

  try {
    const prompt = buildCheckpointPrompt(session, completedNode, artifacts, nodes, phase);
    const result = await generateText({
      model,
      system: `You are the Main Brain. Produce a checkpoint summary with your audit/opinion as JSON.${langInstruction}`,
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
      humanSummary: `Step completed in phase ${phase}.`,
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

  const result = await generateText({
    model,
    system: `You are the Main Brain. Interpret the user's confirmation and decide how to proceed. Respond with JSON.${langNote}`,
    messages: [{ role: "user", content: prompt }],
    abortSignal,
  });

  const budget = trackUsage(session.budget, "main_brain", `confirm_${session.phase}`, result.usage?.totalTokens ?? 0);
  await store.updateSession(session.id, { budget });

  try {
    return extractJsonFromLLMResponse<ConfirmationDecision>(result.text);
  } catch {
    // Deterministic fallback: follow transition resolver
    const transitionAction = resolveTransition(session, checkpoint, outcome);
    return outcome === "confirmed"
      ? { action: "continue", reasoning: "User confirmed.", nextPhase: transitionAction.nextPhase }
      : { action: "revise", reasoning: "User requested changes." };
  }
}

// =============================================================
// HELPERS
// =============================================================

async function getLatestBattleResult(sessionId: string): Promise<ReviewerBattleResult | undefined> {
  const arts = await store.getArtifacts(sessionId, { type: "reviewer_battle_result" });
  if (arts.length === 0) return undefined;
  return arts[arts.length - 1].content as unknown as ReviewerBattleResult;
}

async function createNodesFromSpecs(
  sessionId: string,
  specs: NodeCreationSpec[],
  defaultPhase: Phase
): Promise<DeepResearchNode[]> {
  const created: DeepResearchNode[] = [];
  for (const spec of specs) {
    const node = await store.createNode(sessionId, {
      ...spec,
      phase: spec.phase ?? defaultPhase,
    });
    created.push(node);
  }
  return created;
}

function getNextPhase(current: Phase): Phase | null {
  const idx = PHASE_ORDER.indexOf(current);
  if (idx < 0 || idx >= PHASE_ORDER.length - 1) return null;
  return PHASE_ORDER[idx + 1];
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

function extractJsonFromLLMResponse<T>(text: string): T {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    return JSON.parse(fenceMatch[1].trim()) as T;
  }

  const firstBrace = text.indexOf("{");
  if (firstBrace >= 0) {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = firstBrace; i < text.length; i++) {
      const ch = text[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") depth++;
      if (ch === "}") {
        depth--;
        if (depth === 0) {
          return JSON.parse(text.slice(firstBrace, i + 1)) as T;
        }
      }
    }
  }

  return JSON.parse(text.trim()) as T;
}

function safeParseJson(text: string): Record<string, unknown> {
  try {
    return extractJsonFromLLMResponse<Record<string, unknown>>(text);
  } catch {
    return { text };
  }
}
