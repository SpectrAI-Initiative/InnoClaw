import * as store from "./event-store";
import { createInitialRequirements } from "./requirement-tracker";
import { validateDAG, autoRepairDAG } from "./dag-validator";
import { checkConsistency } from "./consistency-checker";
import { executeNode } from "./node-executor";
import { isFinalReportExecutionError } from "./final-report-runtime";
import { buildWorkstationPlanningContext } from "./workstation-context";
import { buildNodeContext, callMainBrain } from "./researcher-runtime";
import { buildNodeCreationSpecDispatchPreviews } from "./node-spec-templates";
import {
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
} from "./dispatch-policy";
import { canonicalizeArtifactReferenceFields } from "./artifact-references";
import { assessFinalReportRetry } from "./final-report-retry-policy";
import {
  resolveContextTagFromSpecs,
  resolveLegacyContextFromNodes,
} from "./context-tag";
import {
  canGenerateFinalReport,
  checkEvidenceSufficiency,
} from "./session-guards";
import {
  buildSessionHygienePromptBlock,
  reconcileSessionState,
  type SessionHygieneSummary,
} from "./session-hygiene";
import { resolveCheckpointInteractionMode } from "./orchestrator-checkpoint";
import type {
  BrainDecision,
  CheckpointInteractionMode,
  ContextTag,
  DeepResearchArtifact,
  DeepResearchNode,
  DeepResearchSession,
  LanguageState,
  NodeCreationSpec,
  RequirementState,
} from "./types";

export type WorkflowRuntimeState = {
  messages: Awaited<ReturnType<typeof store.getMessages>>;
  artifacts: Awaited<ReturnType<typeof store.getArtifacts>>;
  workstationContext: Awaited<ReturnType<typeof buildWorkstationPlanningContext>>;
  workflowPolicy: WorkflowPolicy;
};

export type ResearcherDispatchStepResult = {
  completedNode: DeepResearchNode;
  suggestedNextContextTag: ContextTag;
  isFinalStep: boolean;
  interactionMode: CheckpointInteractionMode;
  plannedNodesToCreate: NodeCreationSpec[];
  requiresCheckpoint: boolean;
};

export async function executeApprovedNode(
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
              candidate.nodeType !== "final_report",
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

export async function createResearcherDispatchStep(
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

export async function runPostStepChecks(
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

export async function createNodesFromSpecs(
  sessionId: string,
  specs: NodeCreationSpec[],
  defaultContextTag: ContextTag,
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

export async function loadWorkflowRuntimeState(
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
