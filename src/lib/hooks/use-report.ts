"use client";

import { useState, useEffect, useCallback } from "react";
import type { UIMessage } from "ai";
import type { ReportData } from "@/types/report";
import { buildReportData } from "@/lib/report/extract-report";

/**
 * Read the latest report from localStorage.
 *
 * Reports are always extracted from the "agent" mode messages because only
 * agent mode runs the full tool-calling pipeline that produces structured
 * reports. "plan" and "ask" modes are lightweight Q&A conversations.
 */
function readReportFromStorage(workspaceId: string): ReportData | null {
  try {
    const raw = localStorage.getItem(`agent-messages:${workspaceId}:agent`);
    if (!raw) return null;
    const messages: UIMessage[] = JSON.parse(raw);
    return buildReportData(workspaceId, messages);
  } catch {
    return null;
  }
}

export function useReport(workspaceId: string) {
  const storageKey = `agent-messages:${workspaceId}:agent`;

  const [report, setReport] = useState<ReportData | null>(() =>
    typeof window !== "undefined" ? readReportFromStorage(workspaceId) : null
  );

  // Re-read storage immediately when workspaceId changes (render-time update)
  const [prevWorkspaceId, setPrevWorkspaceId] = useState(workspaceId);
  if (workspaceId !== prevWorkspaceId) {
    setPrevWorkspaceId(workspaceId);
    setReport(readReportFromStorage(workspaceId));
  }

  const refresh = useCallback(() => {
    setReport(readReportFromStorage(workspaceId));
  }, [workspaceId]);

  // Listen for cross-tab localStorage changes
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === storageKey) {
        refresh();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [storageKey, refresh]);

  // Listen for same-tab updates dispatched by AgentPanel
  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const detail = (e as CustomEvent<{ key: string }>).detail;
      if (detail?.key === storageKey) {
        refresh();
      }
    };
    window.addEventListener("agent-messages-updated", handleUpdate);
    return () => window.removeEventListener("agent-messages-updated", handleUpdate);
  }, [storageKey, refresh]);

  return {
    report,
    isAvailable: report !== null,
    refresh,
  };
}
