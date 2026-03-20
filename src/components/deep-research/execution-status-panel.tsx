"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle, XCircle, Clock, Play, ExternalLink } from "lucide-react";
import type { PersistedExecutionRecord } from "@/lib/deep-research/types";

interface ExecutionStatusPanelProps {
  executions: PersistedExecutionRecord[];
}

export function ExecutionStatusPanel({ executions }: ExecutionStatusPanelProps) {
  if (executions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        No execution records yet. They will appear during the experiment execution phase.
      </div>
    );
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case "running":
        return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin shrink-0" />;
      case "completed":
        return <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />;
      case "failed":
        return <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
      case "submitted":
        return <Play className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
      case "cancelled":
        return <XCircle className="h-3.5 w-3.5 text-gray-400 shrink-0" />;
      default:
        return <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "running": return "text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-950/30";
      case "completed": return "text-green-600 border-green-300 bg-green-50 dark:bg-green-950/30";
      case "failed": return "text-red-600 border-red-300 bg-red-50 dark:bg-red-950/30";
      case "submitted": return "text-blue-600 border-blue-300";
      default: return "text-gray-600 border-gray-300";
    }
  };

  const activeCount = executions.filter(e =>
    ["pending", "submitted", "running"].includes(e.status)
  ).length;

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-3">
        {/* Summary */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">
            {executions.length} execution record{executions.length !== 1 ? "s" : ""}
          </span>
          {activeCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-blue-600">
              <Loader2 className="h-3 w-3 animate-spin" />
              {activeCount} active
            </div>
          )}
        </div>

        {/* Records list */}
        {executions.map((exec) => (
          <div key={exec.id} className="border rounded p-2.5 space-y-1.5">
            <div className="flex items-center gap-2">
              {statusIcon(exec.status)}
              <Badge variant="outline" className={`text-[10px] ${statusColor(exec.status)}`}>
                {exec.status}
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                {exec.recordType}
              </Badge>
              {exec.remoteJobId && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <ExternalLink className="h-2.5 w-2.5" />
                  {exec.remoteJobId}
                </span>
              )}
            </div>

            {/* Command */}
            {exec.command && (
              <div className="p-1.5 bg-muted rounded font-mono text-[10px] leading-relaxed overflow-x-auto max-h-[60px]">
                {exec.command.slice(0, 200)}
                {exec.command.length > 200 && "..."}
              </div>
            )}

            {/* Timestamps */}
            <div className="flex gap-3 text-[10px] text-muted-foreground">
              {exec.submittedAt && (
                <span>Submitted: {new Date(exec.submittedAt).toLocaleTimeString()}</span>
              )}
              {exec.startedAt && (
                <span>Started: {new Date(exec.startedAt).toLocaleTimeString()}</span>
              )}
              {exec.completedAt && (
                <span>Completed: {new Date(exec.completedAt).toLocaleTimeString()}</span>
              )}
            </div>

            {/* Result summary */}
            {exec.resultJson && (
              <div className="text-[10px] text-muted-foreground p-1.5 bg-green-50 dark:bg-green-950/30 rounded">
                Result: {JSON.stringify(exec.resultJson).slice(0, 150)}
                {JSON.stringify(exec.resultJson).length > 150 && "..."}
              </div>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
