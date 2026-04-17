import type { UIMessage } from "ai";
import { getMessageTextLength } from "@/lib/ai/models";

export type CompactionTrigger = "overflow" | "clear";

export interface OverflowCompactionPlan {
  toSummarize: UIMessage[];
  toKeep: UIMessage[];
}

export function getRenderableMessages(messages: UIMessage[]): UIMessage[] {
  return messages.filter((message) => getMessageTextLength(message) > 0);
}

export function buildOverflowCompactionPlan(input: {
  messages: UIMessage[];
  overflowThreshold: number;
  failedAtCount: number;
  minimumMessageCount?: number;
  keepRatio?: number;
  minimumKeepCount?: number;
}): OverflowCompactionPlan | null {
  const minimumMessageCount = input.minimumMessageCount ?? 4;
  const keepRatio = input.keepRatio ?? 0.2;
  const minimumKeepCount = input.minimumKeepCount ?? 2;
  const { messages, overflowThreshold, failedAtCount } = input;

  if (messages.length < minimumMessageCount) return null;
  if (messages.length === failedAtCount) return null;

  const messageSizes = messages.map((message) => getMessageTextLength(message));
  const totalChars = messageSizes.reduce((sum, size) => sum + size, 0);
  if (totalChars <= overflowThreshold) return null;

  let keepFromIndex = messages.length;
  let accumulatedChars = 0;
  const targetKeepChars = totalChars * keepRatio;

  for (let index = messages.length - 1; index >= 0; index--) {
    accumulatedChars += messageSizes[index];
    if (accumulatedChars >= targetKeepChars) {
      keepFromIndex = index;
      break;
    }
  }

  keepFromIndex = Math.min(keepFromIndex, messages.length - minimumKeepCount);
  if (keepFromIndex <= 0) return null;

  return {
    toSummarize: messages.slice(0, keepFromIndex),
    toKeep: messages.slice(keepFromIndex),
  };
}

export function excludeKeptMessages(
  messages: UIMessage[],
  messagesToKeep: UIMessage[],
): UIMessage[] {
  const keepIds = new Set(messagesToKeep.map((message) => message.id));
  return messages.filter((message) => !keepIds.has(message.id));
}

export async function requestConversationSummaryPreview(input: {
  workspaceId: string;
  messages: UIMessage[];
  trigger: CompactionTrigger;
  locale?: string;
  sessionName?: string;
  compact?: boolean;
}): Promise<{ title: string; content: string }> {
  const response = await fetch("/api/agent/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      messages: input.messages,
      trigger: input.trigger,
      preview: true,
      compact: input.compact,
      locale: input.locale,
      sessionName: input.sessionName,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: "Summarization failed" }));
    throw new Error(data.error || "Summarization failed");
  }

  const data = await response.json();
  return {
    title: typeof data.title === "string" ? data.title : "",
    content: typeof data.content === "string" ? data.content : "",
  };
}

export async function saveConversationMemoryNote(input: {
  workspaceId: string;
  title: string;
  content: string;
}): Promise<void> {
  const response = await fetch("/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      title: input.title,
      content: input.content,
      type: "memory",
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const errorMessage = data && typeof data.error === "string"
      ? data.error
      : "Failed to save memory note";
    throw new Error(errorMessage);
  }
}
