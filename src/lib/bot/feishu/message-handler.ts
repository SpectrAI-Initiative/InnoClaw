/**
 * Shared Feishu message handler.
 *
 * Contains the dispatch logic used by both the HTTP webhook route
 * and the WebSocket client to avoid duplicating the same flow.
 */

import type { BotAdapter, BotMessage } from "../types";
import { parseAndHandleCommand } from "./commands";
import { processAgentMessage } from "./agent-processor";
import { processMessage, sendReplies } from "../processor";
import {
  getChatState,
  acquireProcessingLock,
  releaseProcessingLock,
} from "./state";

/**
 * Process a single Feishu message through the full dispatch pipeline:
 * 1. Slash commands (/workspace, /status, etc.)
 * 2. Agent processing (when workspace is bound)
 * 3. Simple AI chat fallback
 */
export async function handleFeishuMessage(
  adapter: BotAdapter,
  message: BotMessage,
  logPrefix: string = "[feishu]"
): Promise<void> {
  try {
    console.log(
      `${logPrefix} Processing ${message.type} message from ${message.senderId}`
    );

    // --- Text messages: check for commands or agent processing ---
    if (message.type === "text") {
      // 1. Check for slash commands (/workspace, /status, etc.)
      const cmdResult = await parseAndHandleCommand(
        message.chatId,
        message.text
      );
      if (cmdResult.handled) {
        if (cmdResult.card && adapter.sendInteractiveCard) {
          await adapter.sendInteractiveCard(message.chatId, cmdResult.card);
        } else if (cmdResult.text) {
          await adapter.sendText(message.chatId, cmdResult.text);
        }
        return;
      }

      // 2. Check if workspace is bound for agent processing
      const state = getChatState(message.chatId);
      if (state.workspacePath) {
        // Acquire processing lock to prevent concurrent agent executions
        if (!acquireProcessingLock(message.chatId)) {
          await adapter.sendText(
            message.chatId,
            "I'm still processing your previous request. Please wait."
          );
          return;
        }

        try {
          await processAgentMessage({
            adapter,
            chatId: message.chatId,
            userMessage: message.text,
            workspacePath: state.workspacePath,
            mode: state.mode,
          });
        } finally {
          releaseProcessingLock(message.chatId);
        }
        return;
      }

      // 3. No workspace bound — fall back to simple AI chat
    }

    // --- File messages or text without workspace: use simple processor ---
    const replies = await processMessage(adapter, message);
    await sendReplies(adapter, message.chatId, replies);
  } catch (error) {
    console.error(`${logPrefix} Message processing error:`, error);
    try {
      await adapter.sendText(
        message.chatId,
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } catch {
      // Last resort — log only
    }
  }
}
