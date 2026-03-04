/**
 * Shared Feishu message-routing logic.
 *
 * Used by both the HTTP webhook handler (`src/app/api/bot/feishu/route.ts`)
 * and the WebSocket long-connection client (`src/lib/bot/feishu/ws-client.ts`)
 * so that any change to the routing logic (new slash command, lock messaging,
 * error handling, etc.) only needs to be made in one place.
 */

import { type BotAdapter, type BotMessage } from "../types";
import { parseAndHandleCommand } from "./commands";
import { processAgentMessage } from "./agent-processor";
import { processMessage, sendReplies } from "../processor";
import {
  getChatState,
  acquireProcessingLock,
  releaseProcessingLock,
} from "./state";

/**
 * Route a single Feishu message through the standard pipeline:
 *  1. Slash-command detection → immediate card / text reply.
 *  2. Agent processing when a workspace is bound to the chat.
 *  3. Simple AI-chat fallback for everything else.
 *
 * @param adapter  Platform adapter used to send replies.
 * @param message  The normalised bot message to process.
 * @param logTag   Short label used in console output (e.g. "[feishu-ws]").
 */
export async function routeMessage(
  adapter: BotAdapter,
  message: BotMessage,
  logTag: string
): Promise<void> {
  try {
    console.log(
      `${logTag} Processing ${message.type} message from ${message.senderId}`
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
    const correlationId = crypto.randomUUID().slice(0, 8);
    console.error(
      `${logTag} Message processing error (id=${correlationId}):`,
      error
    );
    try {
      await adapter.sendText(
        message.chatId,
        `Something went wrong while processing your request. Please try again later. (error id: ${correlationId})`
      );
    } catch {
      // Last resort — log only
    }
  }
}
