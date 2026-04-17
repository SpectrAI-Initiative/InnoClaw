import { generateText } from "ai";
import { nanoid } from "nanoid";
import { getModelForRole, checkBudget, trackUsage } from "./model-router";
import * as store from "./event-store";
import { buildCheckpointPrompt } from "./prompts";
import { normalizeNodeCreationSpecs } from "./node-spec-normalizer";
import { consolidateResearchMemory } from "./memory-fabric";
import { buildResearcherDoctrinePromptBlock } from "./researcher-doctrine";
import {
  applyFinalReportCheckpointGuard,
  getCheckpointReviewArtifacts,
  getEvidencePhaseSummary,
  getFinalReportCheckpointCopy,
  getRecommendedDispatch,
} from "./checkpoint-runtime";
import { canCompleteSession } from "./session-guards";
import { safeParseJson } from "./json-response";
import type {
  BrainDecision,
  CheckpointInteractionMode,
  CheckpointPackage,
  ContextTag,
  DeepResearchArtifact,
  DeepResearchNode,
  DeepResearchSession,
  LanguageState,
  MainBrainAudit,
  NodeCreationSpec,
  ReviewAssessment,
} from "./types";

export function resolveCheckpointInteractionMode(
  decision: BrainDecision,
  plannedNodesToCreate: NodeCreationSpec[],
): CheckpointInteractionMode {
  if (decision.action === "respond_to_user" && plannedNodesToCreate.length === 0) {
    return "answer_required";
  }
  return "confirmation";
}

export async function generateCheckpointAndHalt(input: {
  session: DeepResearchSession;
  completedNode: DeepResearchNode;
  suggestedNextContextTag: ContextTag;
  languageState: LanguageState;
  abortSignal?: AbortSignal;
  isFinalStep?: boolean;
  interactionMode?: CheckpointInteractionMode;
}): Promise<void> {
  const {
    session,
    completedNode,
    suggestedNextContextTag,
    languageState,
    abortSignal,
  } = input;
  let isFinalStep = input.isFinalStep ?? false;
  const interactionMode = input.interactionMode ?? "confirmation";

  const freshNodes = await store.getNodes(session.id);
  const freshNode = freshNodes.find((node) => node.id === completedNode.id) ?? completedNode;
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

  if (isFinalStep) {
    const completionCheck = canCompleteSession(freshNodes);
    if (!completionCheck.allowed) {
      console.warn("[deep-research] isFinalStep=true but completion blocked:", completionCheck.reason);
      isFinalStep = false;
    }
  }

  const langInstruction = languageState.preferredOutputLanguage !== "en"
    ? `\n\nIMPORTANT: The user communicates in ${languageState.preferredOutputLanguage}. Write all user-facing text (title, humanSummary, recommendedNextAction, continueWillDo) in ${languageState.preferredOutputLanguage}. Technical terms may remain in English.`
    : "";

  const checkpointContent = await generateCheckpointContent({
    session,
    completedNode: freshNode,
    artifacts,
    nodes: freshNodes,
    contextTag: suggestedNextContextTag,
    langInstruction,
    abortSignal,
  });
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
    artifactsToReview: checkpointReviewArtifacts.map((artifact) => artifact.id),
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
    checkpointPkg.artifactsToReview,
  );
}

async function generateCheckpointContent(input: {
  session: DeepResearchSession;
  completedNode: DeepResearchNode;
  artifacts: DeepResearchArtifact[];
  nodes: DeepResearchNode[];
  contextTag: ContextTag;
  langInstruction: string;
  abortSignal?: AbortSignal;
}): Promise<{
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
  const { session, completedNode, artifacts, nodes, contextTag, langInstruction, abortSignal } = input;
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

    const budget = trackUsage(session.budget, "main_brain", `${completedNode.id}_ckpt`, result.usage?.totalTokens ?? 0);
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

async function getLatestReviewAssessment(sessionId: string): Promise<ReviewAssessment | undefined> {
  const artifacts = await store.getArtifacts(sessionId, { type: "review_assessment" });
  if (artifacts.length === 0) return undefined;
  return artifacts[artifacts.length - 1].content as unknown as ReviewAssessment;
}
