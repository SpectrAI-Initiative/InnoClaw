/**
 * Feishu agent message processor.
 *
 * Bridges Feishu bot messages to the full Agent pipeline with tool support.
 * Uses generateText with onStepFinish to provide real-time progress updates
 * via Feishu interactive card patching.
 */

import {
  generateText,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
} from "ai";
import { getConfiguredModel, isAIAvailable } from "@/lib/ai/provider";
import { createAgentTools } from "@/lib/ai/agent-tools";
import {
  buildAgentSystemPrompt,
  buildPlanSystemPrompt,
  buildAskSystemPrompt,
} from "@/lib/ai/prompts";
import type { BotAdapter } from "../types";
import {
  buildProgressCard,
  buildFinalCard,
  buildErrorCard,
  type ToolCallEvent,
} from "./cards";
import {
  getChatState,
  appendMessage,
  type AgentMode,
} from "./state";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum interval between card patches to avoid rate limiting (ms) */
const MIN_PATCH_INTERVAL_MS = 1_000;

/** Maximum total execution time before force-terminating (ms) */
const MAX_EXECUTION_TIME_MS = 5 * 60 * 1000;

/** Maximum steps for the agent tool loop */
const MAX_STEPS = 50;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProcessAgentMessageOptions {
  adapter: BotAdapter;
  chatId: string;
  userMessage: string;
  workspacePath: string;
  mode?: AgentMode;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSystemPrompt(mode: AgentMode, cwd: string): string {
  switch (mode) {
    case "plan":
      return buildPlanSystemPrompt(cwd);
    case "ask":
      return buildAskSystemPrompt(cwd);
    default:
      return buildAgentSystemPrompt(cwd);
  }
}

async function getTools(mode: AgentMode, cwd: string) {
  if (mode === "plan" || mode === "ask") {
    return createAgentTools(cwd, ["readFile", "listDirectory", "grep"]);
  }
  return createAgentTools(cwd);
}

// ---------------------------------------------------------------------------
// Main processor
// ---------------------------------------------------------------------------

/**
 * Process a Feishu message through the agent pipeline with full tool support.
 * Sends an initial progress card and patches it as each tool step completes.
 */
export async function processAgentMessage(
  options: ProcessAgentMessageOptions
): Promise<void> {
  const { adapter, chatId, userMessage, workspacePath } = options;
  const state = getChatState(chatId);
  const mode = options.mode || state.mode;

  if (!isAIAvailable()) {
    await adapter.sendText(
      chatId,
      "AI is not configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY."
    );
    return;
  }

  // Ensure card methods are available
  if (!adapter.sendInteractiveCard || !adapter.patchInteractiveCard) {
    await adapter.sendText(
      chatId,
      "Interactive cards not supported by this adapter."
    );
    return;
  }

  const model = await getConfiguredModel();
  const systemPrompt = getSystemPrompt(mode, workspacePath);
  const tools = await getTools(mode, workspacePath);

  // Build messages with conversation history
  const userMsg: UIMessage = {
    id: `feishu-${Date.now()}`,
    role: "user",
    parts: [{ type: "text", text: userMessage }],
  };

  const allMessages = [...state.conversationHistory, userMsg];
  const modelMessages = await convertToModelMessages(allMessages);

  // Track tool call events and timing
  const toolCallEvents: ToolCallEvent[] = [];
  const startTime = Date.now();
  let lastPatchTime = 0;

  // Send initial "processing" card
  let cardMessageId: string;
  try {
    const initialCard = buildProgressCard({
      toolCalls: [],
      currentStep: 0,
      maxSteps: MAX_STEPS,
      workspace: workspacePath,
    });
    cardMessageId = await adapter.sendInteractiveCard(chatId, initialCard);
  } catch (err) {
    console.error("[feishu-agent] Failed to send initial card:", err);
    await adapter.sendText(chatId, "Failed to start agent processing.");
    return;
  }

  // Set up abort for timeout
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, MAX_EXECUTION_TIME_MS);

  try {
    const result = await generateText({
      model,
      system: systemPrompt,
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(MAX_STEPS),
      abortSignal: abortController.signal,
      onStepFinish: async (step) => {
        // Collect tool results from this step
        for (const tr of step.toolResults) {
          toolCallEvents.push({
            toolName: tr.toolName,
            args: (tr.input || {}) as Record<string, unknown>,
            result: (tr.output || {}) as Record<string, unknown>,
            state: "completed",
          });
        }

        // Rate-limit card patches
        const now = Date.now();
        if (now - lastPatchTime < MIN_PATCH_INTERVAL_MS) return;
        lastPatchTime = now;

        // Patch progress card
        try {
          const progressCard = buildProgressCard({
            toolCalls: toolCallEvents,
            currentStep: toolCallEvents.length,
            maxSteps: MAX_STEPS,
            workspace: workspacePath,
          });
          await adapter.patchInteractiveCard!(cardMessageId, progressCard);
        } catch (patchErr) {
          console.error("[feishu-agent] Card patch failed:", patchErr);
        }
      },
    });

    // Build and send final card
    const finalCard = buildFinalCard({
      toolCalls: toolCallEvents,
      finalText: result.text || "No response generated.",
      workspace: workspacePath,
      durationMs: Date.now() - startTime,
    });

    try {
      await adapter.patchInteractiveCard(cardMessageId, finalCard);
    } catch {
      // Fallback: send as text if card patch fails
      await adapter.sendText(
        chatId,
        result.text || "No response generated."
      );
    }

    // Update conversation history
    appendMessage(chatId, userMsg);
    appendMessage(chatId, {
      id: `feishu-assistant-${Date.now()}`,
      role: "assistant",
      parts: [{ type: "text", text: result.text || "" }],
    });

    console.log(
      `[feishu-agent] Completed: ${toolCallEvents.length} tool calls, ` +
        `${((Date.now() - startTime) / 1000).toFixed(1)}s`
    );
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : "Unknown error";

    console.error("[feishu-agent] Processing error:", errMsg);

    // Try to patch card with error
    try {
      const errorCard = buildErrorCard(errMsg);
      await adapter.patchInteractiveCard(cardMessageId, errorCard);
    } catch {
      await adapter
        .sendText(chatId, `Agent error: ${errMsg}`)
        .catch(() => {});
    }
  } finally {
    clearTimeout(timeoutId);
  }
}
