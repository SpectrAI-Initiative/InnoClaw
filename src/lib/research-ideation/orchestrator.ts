import { generateText } from "ai";
import type { LanguageModel } from "ai";
import type {
  IdeationTurn,
  IdeationSharedContext,
  IdeationSessionState,
} from "./types";
import { IDEATION_STAGES, IDEATION_AGENTS } from "./roles";
import { buildIdeationPrompt } from "./prompts";
import { IDEATION } from "@/lib/constants";

// =============================================================
// TOKEN LIMITS per stage by mode
// =============================================================
const MAX_TOKENS: Record<"quick" | "full", number> = {
  quick: IDEATION.TOKENS_QUICK,
  full: IDEATION.TOKENS_FULL,
};

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

  const result = await generateText({
    model,
    system: systemPrompt,
    prompt: `Begin your analysis of the paper "${state.context.article.title}".${state.context.userSeed ? ` The user's research seed idea: "${state.context.userSeed}"` : ""}`,
    maxOutputTokens: MAX_TOKENS[state.context.mode],
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
// Run the full 5-stage ideation pipeline
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

    const turn = await runIdeationStage(state, model, abortSignal);

    state.transcript.push(turn);
    onTurnComplete(turn);
  }

  state.status = "completed";
  return state.transcript;
}
