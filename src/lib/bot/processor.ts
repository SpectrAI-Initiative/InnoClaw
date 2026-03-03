/**
 * Bot message processor.
 *
 * Bridges IM bot messages to the Agent's AI capabilities.
 * Handles text messages directly and processes file messages by
 * downloading the file first, then forwarding to the AI for processing.
 */

import path from "path";
import os from "os";
import fsp from "fs/promises";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { getConfiguredModel, isAIAvailable } from "@/lib/ai/provider";
import type { BotAdapter, BotMessage, BotReply } from "./types";

/** Directory where downloaded bot files are stored */
const BOT_FILES_DIR = path.join(os.tmpdir(), "notebooklm-bot-files");

/** Maximum size for reading text file content inline (100 KB) */
const MAX_TEXT_READ_SIZE = 100_000;

/**
 * Process an incoming bot message and generate replies.
 *
 * For text messages: forwards the text to the AI model and returns the response.
 * For file messages: downloads the file, then forwards a summary to the AI model.
 *
 * @param adapter  The bot adapter for the source platform
 * @param message  The parsed bot message
 * @returns Array of replies to send back
 */
export async function processMessage(
  adapter: BotAdapter,
  message: BotMessage
): Promise<BotReply[]> {
  const replies: BotReply[] = [];

  if (!isAIAvailable()) {
    replies.push({
      type: "text",
      text: "AI is not configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY.",
    });
    return replies;
  }

  try {
    if (message.type === "file") {
      // Sanitize chatId to prevent path traversal (chatId comes from webhook payload)
      const sanitized = message.chatId.replace(/[^a-zA-Z0-9_-]/g, "_");
      const safeChatId = sanitized || "unknown";
      const destDir = path.join(BOT_FILES_DIR, safeChatId);
      let localPath: string;

      try {
        localPath = await adapter.fileHandler.downloadFile(
          message.fileKey,
          message.fileName,
          destDir
        );
      } catch (downloadError) {
        const errMsg =
          downloadError instanceof Error
            ? downloadError.message
            : "Unknown download error";
        console.error(`[bot-processor] File download failed: ${errMsg}`);
        replies.push({
          type: "text",
          text: `Failed to download file "${message.fileName}": ${errMsg}`,
        });
        return replies;
      }

      // Read file content (for text-based files)
      let fileContent = "";
      try {
        const stat = await fsp.stat(localPath);
        const textExtensions = [
          ".txt", ".md", ".csv", ".json", ".xml", ".yaml", ".yml",
          ".log", ".py", ".js", ".ts", ".java", ".c", ".cpp", ".h",
          ".html", ".css", ".sql", ".sh", ".bat", ".ini", ".conf",
          ".toml", ".env", ".gitignore", ".dockerfile",
        ];
        const ext = path.extname(message.fileName).toLowerCase();
        if (textExtensions.includes(ext) && stat.size < MAX_TEXT_READ_SIZE) {
          fileContent = await fsp.readFile(localPath, "utf-8");
        }
      } catch {
        // Non-text file or read error — proceed without content
      }

      // Build prompt with file info
      const userText = message.text
        ? `${message.text}\n\n[File: ${message.fileName} (${message.fileType}, ${message.fileSize} bytes)]`
        : `User sent a file: ${message.fileName} (${message.fileType}, ${message.fileSize} bytes). Please describe what you can do with this file.`;

      const fullPrompt = fileContent
        ? `${userText}\n\nFile content:\n${fileContent.slice(0, 30000)}`
        : userText;

      const aiResponse = await callAI(fullPrompt);
      replies.push({ type: "text", text: aiResponse });

      // Clean up downloaded file to avoid unbounded disk growth
      try {
        await fsp.unlink(localPath);
      } catch {
        // Best-effort cleanup; ignore if file was already removed
      }
    } else {
      // Text message — forward to AI
      const aiResponse = await callAI(message.text);
      replies.push({ type: "text", text: aiResponse });
    }
  } catch (error) {
    const errMsg =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`[bot-processor] Processing error: ${errMsg}`);
    replies.push({
      type: "text",
      text: `Sorry, an error occurred while processing your message: ${errMsg}`,
    });
  }

  return replies;
}

/**
 * Send all replies through the adapter.
 */
export async function sendReplies(
  adapter: BotAdapter,
  chatId: string,
  replies: BotReply[]
): Promise<void> {
  for (const reply of replies) {
    try {
      if (reply.type === "text") {
        await adapter.sendText(chatId, reply.text);
      } else if (reply.type === "file") {
        await adapter.fileHandler.sendFile(reply.filePath, reply.fileName, chatId);
      }
    } catch (sendError) {
      const errMsg =
        sendError instanceof Error ? sendError.message : "Unknown send error";
      console.error(
        `[bot-processor] Failed to send ${reply.type} reply: ${errMsg}`
      );
      // Try to send error notification as text
      if (reply.type !== "text") {
        try {
          await adapter.sendText(
            chatId,
            `Failed to send file "${reply.fileName}": ${errMsg}`
          );
        } catch {
          // Last resort — log only
          console.error("[bot-processor] Failed to send error notification");
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// AI helper
// ---------------------------------------------------------------------------

/**
 * Call the configured AI model with a user message and return the full text response.
 */
async function callAI(userMessage: string): Promise<string> {
  const model = await getConfiguredModel();

  const uiMessages: UIMessage[] = [
    {
      id: `bot-${Date.now()}`,
      role: "user",
      parts: [{ type: "text", text: userMessage }],
    },
  ];

  const modelMessages = await convertToModelMessages(uiMessages);

  const result = streamText({
    model,
    system:
      "You are a helpful AI assistant integrated with an IM bot. " +
      "Respond concisely and helpfully. When the user sends a file, " +
      "describe what you see and offer relevant analysis or actions.",
    messages: modelMessages,
  });

  // Collect the full streamed text
  let fullText = "";
  const reader = result.textStream;
  for await (const chunk of reader) {
    fullText += chunk;
  }

  return fullText || "Sorry, I could not generate a response.";
}
