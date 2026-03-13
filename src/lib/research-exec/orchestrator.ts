import { generateText } from "ai";
import type { LanguageModel } from "ai";
import type {
  WorkflowTurn,
  WorkflowSessionState,
} from "./types";
import { WORKFLOW_STAGES, RESEARCH_EXEC_ROLES } from "./roles";
import { buildResearchExecPrompt } from "./prompts";

// =============================================================
// Run a single workflow stage
// =============================================================
export async function runWorkflowStage(
  state: WorkflowSessionState,
  model: LanguageModel,
  abortSignal?: AbortSignal,
): Promise<WorkflowTurn> {
  const stage = state.stages[state.currentStageIndex];
  if (!stage) {
    throw new Error(`No stage at index ${state.currentStageIndex}`);
  }

  // Approval stages don't generate AI content — they pause for user input
  if (stage.requiresApproval) {
    return {
      stageId: stage.id,
      roleId: stage.roleId,
      content: `[Awaiting user approval for: ${stage.labelKey}]`,
      timestamp: new Date().toISOString(),
    };
  }

  const roleConfig = RESEARCH_EXEC_ROLES[stage.roleId];
  const systemPrompt = buildResearchExecPrompt(
    roleConfig,
    state.workspaceId,
    state.transcript,
    stage.id,
  );

  const result = await generateText({
    model,
    system: systemPrompt,
    prompt: `Execute stage "${stage.id}" for this research execution workflow.`,
    maxOutputTokens: 4096,
    abortSignal,
  });

  return {
    stageId: stage.id,
    roleId: stage.roleId,
    content: result.text,
    timestamp: new Date().toISOString(),
  };
}

// =============================================================
// Run the full workflow pipeline (stops at approval gates)
// =============================================================
export async function runWorkflowUntilApproval(
  state: WorkflowSessionState,
  model: LanguageModel,
  onTurnComplete: (turn: WorkflowTurn) => void,
  abortSignal?: AbortSignal,
): Promise<WorkflowTurn[]> {
  const turns: WorkflowTurn[] = [];

  for (let i = state.currentStageIndex; i < state.stages.length; i++) {
    if (abortSignal?.aborted) break;

    state.currentStageIndex = i;
    const stage = state.stages[i];

    // Stop at approval gates
    if (stage.requiresApproval) {
      state.status = "awaiting_approval";
      const approvalTurn: WorkflowTurn = {
        stageId: stage.id,
        roleId: stage.roleId,
        content: `[Awaiting user approval for: ${stage.labelKey}]`,
        timestamp: new Date().toISOString(),
      };
      state.transcript.push(approvalTurn);
      onTurnComplete(approvalTurn);
      turns.push(approvalTurn);
      break;
    }

    state.status = "running";
    const turn = await runWorkflowStage(state, model, abortSignal);
    state.transcript.push(turn);
    onTurnComplete(turn);
    turns.push(turn);
  }

  // If we reached the end without hitting an approval gate
  if (
    state.currentStageIndex >= state.stages.length - 1 &&
    state.status === "running"
  ) {
    state.status = "completed";
  }

  return turns;
}

// =============================================================
// Create initial workflow state
// =============================================================
export function createWorkflowState(
  runId: string,
  workspaceId: string,
): WorkflowSessionState {
  return {
    id: `ws-${Date.now()}`,
    runId,
    workspaceId,
    stages: WORKFLOW_STAGES,
    currentStageIndex: 0,
    transcript: [],
    status: "idle",
  };
}

// =============================================================
// Resume workflow after approval
// =============================================================
export async function resumeAfterApproval(
  state: WorkflowSessionState,
  model: LanguageModel,
  approved: boolean,
  onTurnComplete: (turn: WorkflowTurn) => void,
  abortSignal?: AbortSignal,
): Promise<WorkflowTurn[]> {
  if (state.status !== "awaiting_approval") {
    throw new Error("Workflow is not awaiting approval");
  }

  if (!approved) {
    state.status = "completed";
    const cancelTurn: WorkflowTurn = {
      stageId: state.stages[state.currentStageIndex].id,
      roleId: state.stages[state.currentStageIndex].roleId,
      content: "[User declined — workflow stopped]",
      timestamp: new Date().toISOString(),
    };
    state.transcript.push(cancelTurn);
    onTurnComplete(cancelTurn);
    return [cancelTurn];
  }

  // Advance past the approval stage
  state.currentStageIndex += 1;
  state.status = "running";

  return runWorkflowUntilApproval(state, model, onTurnComplete, abortSignal);
}
