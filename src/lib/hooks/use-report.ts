"use client";

import { useState, useEffect, useCallback } from "react";
import type { UIMessage } from "ai";
import type { ReportData } from "@/types/report";
import { buildReportData } from "@/lib/report/extract-report";

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

  // Listen for localStorage changes (from AgentPanel writing messages)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === `agent-messages:${workspaceId}:agent`) {
        refresh();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [workspaceId, refresh]);

  // Also poll periodically to catch same-tab localStorage updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        refresh();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  return {
    report,
    isAvailable: report !== null,
    refresh,
  };
}
