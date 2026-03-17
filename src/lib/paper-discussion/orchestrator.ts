import { generateText } from "ai";
import type { LanguageModel } from "ai";
import type {
  DiscussionTurn,
  DiscussionStageId,
  PaperDiscussionSharedContext,
  PaperDiscussionSessionState,
} from "./types";
import { DISCUSSION_STAGES, DISCUSSION_AGENTS } from "./roles";
import { buildDiscussionPrompt } from "./prompts";

// =============================================================
// PER-STAGE TOKEN LIMITS — each role has different output needs
// =============================================================
const STAGE_TOKEN_LIMITS: Record<DiscussionStageId, { quick: number; full: number }> = {
  agenda:                { quick: 1000, full: 1500 },
  evidence_summary:      { quick: 2500, full: 5000 },
  critique:              { quick: 2500, full: 5000 },
  reproducibility_check: { quick: 2500, full: 5000 },
  convergence:           { quick: 1200, full: 2500 },
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
// Run a single discussion stage
// =============================================================
export async function runPaperDiscussionStage(
  state: PaperDiscussionSessionState,
  model: LanguageModel,
  abortSignal?: AbortSignal,
): Promise<DiscussionTurn> {
  const stage = state.stages[state.currentStageIndex];
  if (!stage) {
    throw new Error(`No stage at index ${state.currentStageIndex}`);
  }

  const agentConfig = DISCUSSION_AGENTS[stage.roleId];
  const systemPrompt = buildDiscussionPrompt(
    agentConfig,
    state.context,
    state.transcript,
    stage.id,
  );

  const tokenLimit = STAGE_TOKEN_LIMITS[stage.id][state.context.mode];

  const result = await generateText({
    model,
    system: systemPrompt,
    prompt: `Begin your analysis of the paper "${state.context.article.title}".`,
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
// Run the full 6-stage discussion with per-stage retry
// =============================================================
export async function runFullPaperDiscussion(
  context: PaperDiscussionSharedContext,
  model: LanguageModel,
  onTurnComplete: (turn: DiscussionTurn) => void,
  abortSignal?: AbortSignal,
): Promise<DiscussionTurn[]> {
  const state: PaperDiscussionSessionState = {
    id: "",
    context,
    stages: DISCUSSION_STAGES,
    currentStageIndex: 0,
    transcript: [],
    report: null,
    status: "running",
  };

  for (let i = 0; i < DISCUSSION_STAGES.length; i++) {
    if (abortSignal?.aborted) break;

    state.currentStageIndex = i;
    const stage = DISCUSSION_STAGES[i];

    let turn: DiscussionTurn | null = null;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        turn = await runPaperDiscussionStage(state, model, abortSignal);
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
      const errorTurn: DiscussionTurn = {
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
