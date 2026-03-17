"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  FlaskConical,
  Activity,
} from "lucide-react";
import { useExperimentRuns } from "@/lib/hooks/use-experiment-runs";
import type { ExperimentRunStatus } from "@/lib/research-exec/types";

interface RunHistoryProps {
  workspaceId: string;
}

function statusIcon(status: ExperimentRunStatus) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />;
    case "failed":
    case "cancelled":
    case "timed_out":
      return <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />;
    case "monitoring":
    case "needs_attention":
      return <Activity className="h-3.5 w-3.5 animate-pulse text-blue-600 dark:text-blue-400" />;
    case "planning":
    case "patching":
    case "syncing":
    case "submitted":
    case "queued":
    case "running":
    case "collecting":
    case "analyzing":
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-yellow-600 dark:text-yellow-400" />;
    default:
      return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function statusColor(status: ExperimentRunStatus) {
  switch (status) {
    case "completed":
      return "border-green-500/20 bg-green-500/15 text-green-700 dark:text-green-400";
    case "failed":
    case "cancelled":
    case "timed_out":
      return "border-red-500/20 bg-red-500/15 text-red-700 dark:text-red-400";
    case "monitoring":
    case "needs_attention":
      return "border-blue-500/20 bg-blue-500/15 text-blue-700 dark:text-blue-400";
    default:
      return "border-yellow-500/20 bg-yellow-500/15 text-yellow-700 dark:text-yellow-400";
  }
}

export function RunHistory({ workspaceId }: RunHistoryProps) {
  const t = useTranslations("researchExec");
  const { runs, isLoading } = useExperimentRuns(workspaceId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("loading")}
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-8 text-muted-foreground">
        <FlaskConical className="h-8 w-8" />
        <p className="text-sm">{t("noRuns")}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 p-4">
        {runs.map((run) => (
          <div
            key={run.id}
            className="flex items-center gap-3 rounded-lg border p-3"
          >
            {statusIcon(run.status)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">
                  {run.id.slice(0, 8)}
                </span>
                <Badge className={`text-[10px] ${statusColor(run.status)}`}>
                  {run.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(run.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
