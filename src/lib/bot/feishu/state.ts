/**
 * In-memory per-chat state management for Feishu agent integration.
 *
 * Stores workspace bindings, conversation history, and processing locks
 * for each Feishu chat. State is ephemeral and lost on server restart.
 */

import type { UIMessage } from "ai";
import { getWorkspaceRoots } from "@/lib/files/filesystem";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentMode = "agent" | "plan" | "ask";

export interface FeishuChatState {
  chatId: string;
  workspacePath: string | null;
  conversationHistory: UIMessage[];
  mode: AgentMode;
  lastActivity: number;
  processingLock: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** State TTL: evict chats inactive for over 2 hours */
const STATE_TTL_MS = 2 * 60 * 60 * 1000;

/** Maximum messages retained per chat */
const MAX_HISTORY_LENGTH = 50;

/** Cleanup interval: run eviction every 10 minutes */
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const chatStates = new Map<string, FeishuChatState>();

// Periodic cleanup of expired states
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanupTimer() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, state] of chatStates) {
      if (now - state.lastActivity > STATE_TTL_MS) {
        chatStates.delete(id);
      }
    }
    // Stop timer if no states remain
    if (chatStates.size === 0 && cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, CLEANUP_INTERVAL_MS);
  // Allow process to exit even if timer is running
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the default workspace path from WORKSPACE_ROOTS.
 * Returns the first configured root, or null if none configured.
 */
function getDefaultWorkspacePath(): string | null {
  try {
    const roots = getWorkspaceRoots();
    return roots.length > 0 ? roots[0] : null;
  } catch {
    return null;
  }
}

/**
 * Get (or create) the state for a chat.
 * New chats automatically bind to the first WORKSPACE_ROOTS path
 * so the Agent pipeline (with tools) is used by default.
 */
export function getChatState(chatId: string): FeishuChatState {
  let state = chatStates.get(chatId);
  if (!state) {
    state = {
      chatId,
      workspacePath: getDefaultWorkspacePath(),
      conversationHistory: [],
      mode: "agent",
      lastActivity: Date.now(),
      processingLock: false,
    };
    chatStates.set(chatId, state);
    ensureCleanupTimer();
  }
  state.lastActivity = Date.now();
  return state;
}

/**
 * Bind a workspace path to a chat.
 */
export function setChatWorkspace(chatId: string, workspacePath: string): void {
  const state = getChatState(chatId);
  state.workspacePath = workspacePath;
}

/**
 * Set the agent mode for a chat.
 */
export function setChatMode(chatId: string, mode: AgentMode): void {
  const state = getChatState(chatId);
  state.mode = mode;
}

/**
 * Append a message to the conversation history.
 * Evicts the oldest messages when the limit is reached.
 */
export function appendMessage(chatId: string, message: UIMessage): void {
  const state = getChatState(chatId);
  state.conversationHistory.push(message);
  while (state.conversationHistory.length > MAX_HISTORY_LENGTH) {
    state.conversationHistory.shift();
  }
}

/**
 * Try to acquire the processing lock for a chat.
 * Returns true if lock was acquired, false if already locked.
 */
export function acquireProcessingLock(chatId: string): boolean {
  const state = getChatState(chatId);
  if (state.processingLock) return false;
  state.processingLock = true;
  return true;
}

/**
 * Release the processing lock for a chat.
 */
export function releaseProcessingLock(chatId: string): void {
  const state = getChatState(chatId);
  state.processingLock = false;
}

/**
 * Clear all state for a chat (conversation history, workspace, etc.).
 */
export function clearChatState(chatId: string): void {
  const state = getChatState(chatId);
  state.conversationHistory = [];
  // Keep workspace and mode bindings
}

/**
 * Fully remove a chat from the state store.
 */
export function removeChatState(chatId: string): void {
  chatStates.delete(chatId);
}
