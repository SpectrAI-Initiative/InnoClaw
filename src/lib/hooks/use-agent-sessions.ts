"use client";

import { useState, useCallback } from "react";
import { nanoid } from "nanoid";

export interface AgentSession {
  id: string;
  name: string;
  createdAt: string;
}

const MODES = ["agent", "plan", "ask"] as const;

function sessionsKey(workspaceId: string) {
  return `agent-sessions:${workspaceId}`;
}

function activeKey(workspaceId: string) {
  return `agent-active-session:${workspaceId}`;
}

function messageKey(workspaceId: string, sessionId: string, mode: string) {
  return `agent-messages:${workspaceId}:${sessionId}:${mode}`;
}

/** Old-format key (pre-session) */
function legacyMessageKey(workspaceId: string, mode: string) {
  return `agent-messages:${workspaceId}:${mode}`;
}

function readSessions(workspaceId: string): AgentSession[] {
  try {
    const raw = localStorage.getItem(sessionsKey(workspaceId));
    if (raw) return JSON.parse(raw);
  } catch {
    // corrupt data
  }
  return [];
}

function writeSessions(workspaceId: string, sessions: AgentSession[]) {
  try {
    localStorage.setItem(sessionsKey(workspaceId), JSON.stringify(sessions));
  } catch {
    // storage full
  }
}

function readActiveId(workspaceId: string): string | null {
  try {
    return localStorage.getItem(activeKey(workspaceId));
  } catch {
    return null;
  }
}

function writeActiveId(workspaceId: string, id: string) {
  try {
    localStorage.setItem(activeKey(workspaceId), id);
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
function migrateIfNeeded(workspaceId: string): AgentSession[] | null {
  const existing = readSessions(workspaceId);
  if (existing.length > 0) return null; // already migrated

  let hasLegacy = false;
  for (const mode of MODES) {
    const oldKey = legacyMessageKey(workspaceId, mode);
    const data = localStorage.getItem(oldKey);
    if (data) {
      hasLegacy = true;
      // Copy to new key format
      const newKey = messageKey(workspaceId, "default", mode);
      localStorage.setItem(newKey, data);
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
  const [sessions, setSessionsState] = useState<AgentSession[]>([]);
  const [activeSessionId, setActiveSessionIdState] = useState<string>("");
  const [prevWorkspaceId, setPrevWorkspaceId] = useState("");

  // Initialize / re-initialize when workspaceId changes.
  // Uses "adjust state during render" pattern instead of useEffect to avoid
  // cascading renders (react-hooks/set-state-in-effect).
  if (typeof window !== "undefined" && prevWorkspaceId !== workspaceId) {
    setPrevWorkspaceId(workspaceId);

    // Try migration first
    const migrated = migrateIfNeeded(workspaceId);
    let loadedSessions = migrated ?? readSessions(workspaceId);

    // No sessions at all — create a fresh default
    if (loadedSessions.length === 0) {
      const first: AgentSession = {
        id: nanoid(),
        name: "Agent 1",
        createdAt: new Date().toISOString(),
      };
      loadedSessions = [first];
    }

    writeSessions(workspaceId, loadedSessions);

    // Determine active session
    let active = readActiveId(workspaceId);
    if (!active || !loadedSessions.some((s) => s.id === active)) {
      active = loadedSessions[0].id;
    }
    writeActiveId(workspaceId, active);

    setSessionsState(loadedSessions);
    setActiveSessionIdState(active);
  }

  const setActiveSessionId = useCallback(
    (id: string) => {
      setActiveSessionIdState(id);
      writeActiveId(workspaceId, id);
    },
    [workspaceId]
  );

  const createSession = useCallback((): AgentSession => {
    const current = readSessions(workspaceId);
    const session: AgentSession = {
      id: nanoid(),
      name: nextName(current),
      createdAt: new Date().toISOString(),
    };
    const updated = [...current, session];
    writeSessions(workspaceId, updated);
    writeActiveId(workspaceId, session.id);
    setSessionsState(updated);
    setActiveSessionIdState(session.id);
    return session;
  }, [workspaceId]);

  const closeSession = useCallback(
    (id: string) => {
      const current = readSessions(workspaceId);
      if (current.length <= 1) return; // don't close the last session

      // Clear localStorage for this session's messages
      for (const mode of MODES) {
        try {
          localStorage.removeItem(messageKey(workspaceId, id, mode));
        } catch {
          // ignore
        }
      }

      const updated = current.filter((s) => s.id !== id);
      writeSessions(workspaceId, updated);

      // If we closed the active session, switch to the first remaining
      const currentActive = readActiveId(workspaceId);
      if (currentActive === id) {
        const newActive = updated[0].id;
        writeActiveId(workspaceId, newActive);
        setActiveSessionIdState(newActive);
      }

      setSessionsState(updated);
    },
    [workspaceId]
  );

  const renameSession = useCallback(
    (id: string, name: string) => {
      const current = readSessions(workspaceId);
      const updated = current.map((s) =>
        s.id === id ? { ...s, name } : s
      );
      writeSessions(workspaceId, updated);
      setSessionsState(updated);
    },
    [workspaceId]
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
