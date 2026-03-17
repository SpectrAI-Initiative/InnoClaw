"use client";

import { useState, useEffect, useCallback } from "react";
import type { UIMessage } from "ai";
import type { ReportData } from "@/types/report";
import { buildReportData } from "@/lib/report/extract-report";

/**
 * Compute the session-aware localStorage key for agent messages.
 * Falls back to legacy (pre-session) key format if no active session is set.
 */
function getStorageKey(workspaceId: string): string {
  try {
    const activeSession = localStorage.getItem(`agent-active-session:${workspaceId}`);
    if (activeSession) {
      return `agent-messages:${workspaceId}:${activeSession}`;
    }
  } catch {
    // ignore
  }
  return `agent-messages:${workspaceId}:agent`;
}

/**
 * Read the latest report from localStorage.
 *
 * Reports are always extracted from the "agent" mode messages because only
 * agent mode runs the full tool-calling pipeline that produces structured
 * reports. "plan" and "ask" modes are lightweight Q&A conversations.
 */
function readReportFromStorage(workspaceId: string): ReportData | null {
  try {
    const key = getStorageKey(workspaceId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const messages: UIMessage[] = JSON.parse(raw);
    return buildReportData(workspaceId, messages);
  } catch {
    return null;
  }
}

export function useReport(workspaceId: string) {
  const [report, setReport] = useState<ReportData | null>(() =>
    typeof window !== "undefined" ? readReportFromStorage(workspaceId) : null
  );

  // Re-read storage when workspaceId changes
  useEffect(() => {
    setReport(readReportFromStorage(workspaceId));
  }, [workspaceId]);

  const refresh = useCallback(() => {
    setReport(readReportFromStorage(workspaceId));
  }, [workspaceId]);

  // Listen for cross-tab localStorage changes
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      // Refresh on any agent-messages key change for this workspace
      if (e.key?.startsWith(`agent-messages:${workspaceId}:`)) {
        refresh();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [workspaceId, refresh]);

  // Listen for same-tab updates dispatched by AgentPanel
  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const detail = (e as CustomEvent<{ key: string }>).detail;
      if (detail?.key?.startsWith(`agent-messages:${workspaceId}:`)) {
        refresh();
      }
    };
    window.addEventListener("agent-messages-updated", handleUpdate);
    return () => window.removeEventListener("agent-messages-updated", handleUpdate);
  }, [workspaceId, refresh]);

  return {
    report,
    isAvailable: report !== null,
    refresh,
  };
}
