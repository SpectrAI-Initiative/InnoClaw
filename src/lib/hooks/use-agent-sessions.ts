"use client";

import { useState, useCallback } from "react";
import { nanoid } from "nanoid";
import { seedAgentSessions } from "@/lib/demo-seed";
import { useStorageScope, scopeKey } from "@/lib/hooks/use-storage-scope";

export interface AgentSession {
  id: string;
  name: string;
  createdAt: string;
}

const MODES = ["agent", "plan", "ask"] as const;

function sessionsKey(scope: string, workspaceId: string) {
  return scopeKey(scope, `agent-sessions:${workspaceId}`);
}

function activeKey(scope: string, workspaceId: string) {
  return scopeKey(scope, `agent-active-session:${workspaceId}`);
}

function messageKey(scope: string, workspaceId: string, sessionId: string) {
  return scopeKey(scope, `agent-messages:${workspaceId}:${sessionId}`);
}

/** Old-format key (pre-session, with mode) */
function legacyMessageKey(scope: string, workspaceId: string, mode: string) {
  return scopeKey(scope, `agent-messages:${workspaceId}:${mode}`);
}

/** Old-format key (with session and mode) */
function legacySessionModeKey(scope: string, workspaceId: string, sessionId: string, mode: string) {
  return scopeKey(scope, `agent-messages:${workspaceId}:${sessionId}:${mode}`);
}

function readSessions(scope: string, workspaceId: string): AgentSession[] {
  try {
    const raw = localStorage.getItem(sessionsKey(scope, workspaceId));
    if (raw) return JSON.parse(raw);
  } catch {
    // corrupt data
  }
  return [];
}

function writeSessions(scope: string, workspaceId: string, sessions: AgentSession[]) {
  try {
    localStorage.setItem(sessionsKey(scope, workspaceId), JSON.stringify(sessions));
  } catch {
    // storage full
  }
}

function readActiveId(scope: string, workspaceId: string): string | null {
  try {
    return localStorage.getItem(activeKey(scope, workspaceId));
  } catch {
    return null;
  }
}

function writeActiveId(scope: string, workspaceId: string, id: string) {
  try {
    localStorage.setItem(activeKey(scope, workspaceId), id);
  } catch {
    // storage full
  }
}

/** Compute the next "Agent N" name based on existing sessions */
function nextName(sessions: AgentSession[]): string {
  let max = 0;
  for (const s of sessions) {
    const m = s.name.match(/^Agent (\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `Agent ${max + 1}`;
}

/**
 * Migrate old-format localStorage keys to the new session-scoped format.
 * Creates a "default" session if legacy data exists but no sessions are stored yet.
 */
function migrateIfNeeded(scope: string, workspaceId: string): AgentSession[] | null {
  const existing = readSessions(scope, workspaceId);
  if (existing.length > 0) {
    // Migrate existing sessions from mode-specific keys to unified key
    for (const session of existing) {
      const unifiedKey = messageKey(scope, workspaceId, session.id);
      if (localStorage.getItem(unifiedKey)) continue; // already migrated
      // Pick the first mode that has data (prefer "agent")
      for (const mode of MODES) {
        const oldKey = legacySessionModeKey(scope, workspaceId, session.id, mode);
        const data = localStorage.getItem(oldKey);
        if (data) {
          localStorage.setItem(unifiedKey, data);
          break;
        }
      }
      // Clean up all old mode-specific keys
      for (const mode of MODES) {
        try { localStorage.removeItem(legacySessionModeKey(scope, workspaceId, session.id, mode)); } catch { /* ignore */ }
      }
    }
    return null;
  }

  let hasLegacy = false;
  for (const mode of MODES) {
    const oldKey = legacyMessageKey(scope, workspaceId, mode);
    const data = localStorage.getItem(oldKey);
    if (data) {
      hasLegacy = true;
      // Copy to new key format (unified, no mode)
      const newKey = messageKey(scope, workspaceId, "default");
      if (!localStorage.getItem(newKey)) {
        localStorage.setItem(newKey, data);
      }
      localStorage.removeItem(oldKey);
    }
  }

  if (hasLegacy) {
    const defaultSession: AgentSession = {
      id: "default",
      name: "Agent 1",
      createdAt: new Date().toISOString(),
    };
    return [defaultSession];
  }

  return null;
}

export function useAgentSessions(workspaceId: string) {
  const { scope, ready, isAuthDisabled } = useStorageScope();
  const [sessions, setSessionsState] = useState<AgentSession[]>([]);
  const [activeSessionId, setActiveSessionIdState] = useState<string>("");
  const [prevKey, setPrevKey] = useState("");

  // Re-initialize when workspace OR account changes. Account switch must not
  // reuse the previous account's in-memory session list.
  const initKey = `${scope ?? ""}::${workspaceId}`;
  if (typeof window !== "undefined" && ready && scope && prevKey !== initKey) {
    setPrevKey(initKey);

    // Try migration first; seed demo sessions only in single-user demo mode.
    const migrated = migrateIfNeeded(scope, workspaceId);
    const seeded = isAuthDisabled ? seedAgentSessions(scope, workspaceId) : null;
    let loadedSessions = seeded ?? migrated ?? readSessions(scope, workspaceId);

    // No sessions at all — create a fresh default
    if (loadedSessions.length === 0) {
      const first: AgentSession = {
        id: nanoid(),
        name: "Agent 1",
        createdAt: new Date().toISOString(),
      };
      loadedSessions = [first];
    }

    writeSessions(scope, workspaceId, loadedSessions);

    // Determine active session
    let active = readActiveId(scope, workspaceId);
    if (!active || !loadedSessions.some((s) => s.id === active)) {
      active = loadedSessions[0].id;
    }
    writeActiveId(scope, workspaceId, active);

    setSessionsState(loadedSessions);
    setActiveSessionIdState(active);
  }

  const setActiveSessionId = useCallback(
    (id: string) => {
      setActiveSessionIdState(id);
      if (scope) writeActiveId(scope, workspaceId, id);
    },
    [scope, workspaceId]
  );

  const createSession = useCallback((): AgentSession => {
    const current = scope ? readSessions(scope, workspaceId) : [];
    const session: AgentSession = {
      id: nanoid(),
      name: nextName(current),
      createdAt: new Date().toISOString(),
    };
    const updated = [...current, session];
    if (scope) {
      writeSessions(scope, workspaceId, updated);
      writeActiveId(scope, workspaceId, session.id);
    }
    setSessionsState(updated);
    setActiveSessionIdState(session.id);
    return session;
  }, [scope, workspaceId]);

  const closeSession = useCallback(
    (id: string) => {
      if (!scope) return;
      const current = readSessions(scope, workspaceId);
      if (current.length <= 1) return; // don't close the last session

      // Clear localStorage for this session's messages
      try {
        localStorage.removeItem(messageKey(scope, workspaceId, id));
      } catch {
        // ignore
      }
      // Also clean up any leftover legacy mode-specific keys
      for (const mode of MODES) {
        try {
          localStorage.removeItem(legacySessionModeKey(scope, workspaceId, id, mode));
        } catch {
          // ignore
        }
      }

      const updated = current.filter((s) => s.id !== id);
      writeSessions(scope, workspaceId, updated);

      // If we closed the active session, switch to the first remaining
      const currentActive = readActiveId(scope, workspaceId);
      if (currentActive === id) {
        const newActive = updated[0].id;
        writeActiveId(scope, workspaceId, newActive);
        setActiveSessionIdState(newActive);
      }

      setSessionsState(updated);
    },
    [scope, workspaceId]
  );

  const renameSession = useCallback(
    (id: string, name: string) => {
      if (!scope) return;
      const current = readSessions(scope, workspaceId);
      const updated = current.map((s) =>
        s.id === id ? { ...s, name } : s
      );
      writeSessions(scope, workspaceId, updated);
      setSessionsState(updated);
    },
    [scope, workspaceId]
  );

  return {
    sessions,
    activeSessionId,
    setActiveSessionId,
    createSession,
    closeSession,
    renameSession,
  } as const;
}
