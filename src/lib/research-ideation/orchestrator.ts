import { generateText } from "ai";
import type { LanguageModel } from "ai";
import type {
  IdeationTurn,
  IdeationStageId,
  IdeationSharedContext,
  IdeationSessionState,
} from "./types";
import { IDEATION_STAGES, IDEATION_AGENTS } from "./roles";
import { buildIdeationPrompt } from "./prompts";

// =============================================================
// PER-STAGE TOKEN LIMITS — each role has different output needs
// =============================================================
const STAGE_TOKEN_LIMITS: Record<IdeationStageId, { quick: number; full: number }> = {
  hypothesis_generation: { quick: 2500, full: 5000 },
  feasibility_review:    { quick: 2500, full: 5000 },
  experiment_design:     { quick: 2500, full: 5000 },
  review:                { quick: 2000, full: 4000 },
  final_report:          { quick: 4000, full: 8000 },
};

// =============================================================
// Retry helpers
// =============================================================
const MAX_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================
// Run a single ideation stage
// =============================================================
export async function runIdeationStage(
  state: IdeationSessionState,
  model: LanguageModel,
  abortSignal?: AbortSignal,
): Promise<IdeationTurn> {
  const stage = state.stages[state.currentStageIndex];
  if (!stage) {
    throw new Error(`No stage at index ${state.currentStageIndex}`);
  }

  const agentConfig = IDEATION_AGENTS[stage.roleId];
  const systemPrompt = buildIdeationPrompt(
    agentConfig,
    state.context,
    state.transcript,
    stage.id,
  );

  const tokenLimit = STAGE_TOKEN_LIMITS[stage.id][state.context.mode];

  const result = await generateText({
    model,
    system: systemPrompt,
    prompt: `Begin your analysis of the paper "${state.context.article.title}".${state.context.userSeed ? ` The user's research seed idea: "${state.context.userSeed}"` : ""}`,
    maxOutputTokens: tokenLimit,
    abortSignal,
  });

  const text = result.text.trim();
  if (text.length < 20) {
    throw new Error("Model returned empty or trivially short response");
  }

  return {
    stageId: stage.id,
    roleId: stage.roleId,
    content: text,
    timestamp: new Date().toISOString(),
  };
}

// =============================================================
// Run the full 5-stage ideation pipeline with per-stage retry
// =============================================================
export async function runFullIdeation(
  context: IdeationSharedContext,
  model: LanguageModel,
  onTurnComplete: (turn: IdeationTurn) => void,
  abortSignal?: AbortSignal,
): Promise<IdeationTurn[]> {
  const state: IdeationSessionState = {
    id: "",
    context,
    stages: IDEATION_STAGES,
    currentStageIndex: 0,
    transcript: [],
    report: null,
    status: "running",
  };

  for (let i = 0; i < IDEATION_STAGES.length; i++) {
    if (abortSignal?.aborted) break;

    state.currentStageIndex = i;
    const stage = IDEATION_STAGES[i];

    let turn: IdeationTurn | null = null;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        turn = await runIdeationStage(state, model, abortSignal);
        break;
      } catch (err) {
        lastError = err as Error;
        if (abortSignal?.aborted) break;
        if (attempt < MAX_RETRIES - 1) {
          await sleep(1000 * (attempt + 1));
        }
      }
    }

    if (abortSignal?.aborted) break;

    if (!turn) {
      // Emit error turn so frontend knows this stage failed
      const errorTurn: IdeationTurn = {
        stageId: stage.id,
        roleId: stage.roleId,
        content: `[Error: ${lastError?.message || "Generation failed after retries"}]`,
        timestamp: new Date().toISOString(),
        error: true,
      };
      state.transcript.push(errorTurn);
      onTurnComplete(errorTurn);
      continue;
    }

    state.transcript.push(turn);
    onTurnComplete(turn);
  }

  state.status = "completed";
  return state.transcript;
}
