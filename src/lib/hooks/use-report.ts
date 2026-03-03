"use client";

import { useState, useEffect, useCallback } from "react";
import type { UIMessage } from "ai";
import type { ReportData } from "@/types/report";
import { buildReportData } from "@/lib/report/extract-report";

export function useReport(workspaceId: string) {
  const [report, setReport] = useState<ReportData | null>(null);

  const refresh = useCallback(() => {
    const storageKey = `agent-messages:${workspaceId}:agent`;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setReport(null);
        return;
      }
      const messages: UIMessage[] = JSON.parse(raw);
      const data = buildReportData(workspaceId, messages);
      setReport(data);
    } catch {
      setReport(null);
    }
  }, [workspaceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  return {
    report,
    isAvailable: report !== null,
    refresh,
  };
}
