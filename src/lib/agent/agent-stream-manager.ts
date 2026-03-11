/**
 * AgentStreamManager — singleton that keeps agent fetch streams alive
 * independently of React component lifecycle.
 *
 * When the Agent panel's component unmounts (e.g. user navigates to Settings),
 * the manager continues reading the response stream, accumulates UIMessage
 * objects via the AI SDK's own parsing pipeline, and persists them to
 * localStorage.  When the component re-mounts it picks up the latest messages.
 */

import { readUIMessageStream, uiMessageChunkSchema } from "ai";
import type { UIMessage } from "ai";
import { parseJsonEventStream } from "@ai-sdk/provider-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StreamStatus = "idle" | "streaming" | "done" | "error";

export interface StreamEntry {
  /** Our own AbortController – NOT tied to the React component. */
  abortController: AbortController;
  /** Current status. */
  status: StreamStatus;
  /** Accumulated UIMessage objects (updated as the stream progresses). */
  messages: UIMessage[];
  /** localStorage key for persisting messages. */
  storageKey: string;
  /** Optional error text. */
  error?: string;
  /** Subscriber callbacks fired on every message update. */
  subscribers: Set<() => void>;
  /** Subscriber callbacks fired when the stream completes. */
  doneSubscribers: Set<() => void>;
}

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

class AgentStreamManager {
  private streams = new Map<string, StreamEntry>();

  // ---- Query API ----------------------------------------------------------

  /** Is there an active (not yet finished) stream for this key? */
  isActive(key: string): boolean {
    const e = this.streams.get(key);
    return !!e && e.status === "streaming";
  }

  /** Get current status for this key. */
  getStatus(key: string): StreamStatus {
    return this.streams.get(key)?.status ?? "idle";
  }

  /** Get accumulated messages. */
  getMessages(key: string): UIMessage[] {
    return this.streams.get(key)?.messages ?? [];
  }

  // ---- Lifecycle ----------------------------------------------------------

  /**
   * Register (or re-register) a stream for the given key.
   * Returns the AbortController whose signal should be used for the actual
   * fetch – NOT the component's signal.
   */
  register(key: string, storageKey: string): AbortController {
    // Abort any previous stream for this key.
    this.stop(key);

    const abortController = new AbortController();
    const entry: StreamEntry = {
      abortController,
      status: "streaming",
      messages: [],
      storageKey,
      subscribers: new Set(),
      doneSubscribers: new Set(),
    };
    this.streams.set(key, entry);
    return abortController;
  }

  /** Abort the background stream. */
  stop(key: string): void {
    const e = this.streams.get(key);
    if (e) {
      e.abortController.abort();
      e.status = e.status === "streaming" ? "done" : e.status;
    }
  }

  // ---- Background consumption ---------------------------------------------

  /**
   * Consume a raw response-body branch in the background.
   *
   * Uses the AI SDK's own parsing pipeline (parseJsonEventStream →
   * readUIMessageStream) to produce proper UIMessage objects, then persists
   * them to localStorage periodically.
   */
  async consumeInBackground(
    key: string,
    stream: ReadableStream<Uint8Array>,
  ): Promise<void> {
    const entry = this.streams.get(key);
    if (!entry) return;

    try {
      // Step 1: Parse raw bytes into UIMessageChunk stream
      // (same pipeline as DefaultChatTransport.processResponseStream)
      const chunkStream = parseJsonEventStream({
        stream,
        schema: uiMessageChunkSchema,
      }).pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            if (chunk.success) {
              controller.enqueue(chunk.value);
            }
          },
        })
      );

      // Step 2: Convert UIMessageChunk stream → UIMessage stream
      const messageStream = readUIMessageStream({ stream: chunkStream });

      let lastSaveTime = 0;
      const SAVE_INTERVAL = 800; // save at most every 800ms

      // Step 3: Iterate over the message stream – each yield is the latest
      // snapshot of the assistant message being built.
      for await (const message of messageStream) {
        // Update or add this message in the entry
        const existingIdx = entry.messages.findIndex((m) => m.id === message.id);
        if (existingIdx >= 0) {
          entry.messages[existingIdx] = message;
        } else {
          entry.messages.push(message);
        }

        // Periodically persist to localStorage
        const now = Date.now();
        if (now - lastSaveTime > SAVE_INTERVAL) {
          lastSaveTime = now;
          this.saveToLocalStorage(entry);
          this.notifyUpdate(entry);
        }
      }

      // Final persist
      this.saveToLocalStorage(entry);
      entry.status = "done";
      this.notifyUpdate(entry);
      this.notifyDone(entry);
    } catch (err) {
      if (entry.status === "streaming") {
        const isAbort =
          err instanceof DOMException && err.name === "AbortError";
        if (!isAbort) {
          entry.status = "error";
          entry.error =
            err instanceof Error ? err.message : "Background stream failed";
        } else {
          entry.status = "done";
        }
        // Persist whatever we have so far
        this.saveToLocalStorage(entry);
        this.notifyDone(entry);
      }
    }
  }

  /**
   * Merge the manager's accumulated messages into localStorage.
   *
   * Reads existing messages (saved by the component before unmount),
   * then replaces/appends the manager's assistant messages so tool calls,
   * text, and other parts are faithfully preserved.
   */
  private saveToLocalStorage(entry: StreamEntry): void {
    try {
      // Read existing messages from localStorage (saved by the component)
      let existingMessages: UIMessage[] = [];
      const raw = localStorage.getItem(entry.storageKey);
      if (raw) {
        try {
          existingMessages = JSON.parse(raw) as UIMessage[];
        } catch {
          existingMessages = [];
        }
      }

      // Merge: for each manager message, update or append in existing
      for (const mgMsg of entry.messages) {
        const idx = existingMessages.findIndex((m) => m.id === mgMsg.id);
        if (idx >= 0) {
          existingMessages[idx] = mgMsg;
        } else {
          existingMessages.push(mgMsg);
        }
      }

      localStorage.setItem(entry.storageKey, JSON.stringify(existingMessages));
    } catch {
      // localStorage might be full – silently ignore
    }
  }

  // ---- Subscriptions ------------------------------------------------------

  /**
   * Subscribe to message updates for the given key.
   * Returns an unsubscribe function.
   */
  subscribe(key: string, onUpdate: () => void, onDone: () => void): () => void {
    const entry = this.streams.get(key);
    if (!entry) return () => {};
    entry.subscribers.add(onUpdate);
    entry.doneSubscribers.add(onDone);
    return () => {
      entry.subscribers.delete(onUpdate);
      entry.doneSubscribers.delete(onDone);
    };
  }

  private notifyUpdate(entry: StreamEntry): void {
    for (const cb of entry.subscribers) {
      try { cb(); } catch { /* ignore */ }
    }
    // Fire the cross-tab event used by the existing persistence logic
    try {
      window.dispatchEvent(
        new CustomEvent("agent-messages-updated", {
          detail: { key: entry.storageKey },
        })
      );
    } catch { /* SSR safety */ }
  }

  private notifyDone(entry: StreamEntry): void {
    for (const cb of entry.doneSubscribers) {
      try { cb(); } catch { /* ignore */ }
    }
  }

  // ---- Cleanup ------------------------------------------------------------

  /** Remove the stream entry entirely (called after successful remount). */
  cleanup(key: string): void {
    const e = this.streams.get(key);
    if (e && e.status !== "streaming") {
      this.streams.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const agentStreamManager = new AgentStreamManager();
