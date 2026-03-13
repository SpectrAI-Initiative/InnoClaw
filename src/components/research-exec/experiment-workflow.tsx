"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WORKFLOW_STAGES, RESEARCH_EXEC_ROLES } from "@/lib/research-exec/roles";
import {
  CheckCircle2,
  Circle,
  Loader2,
  PauseCircle,
} from "lucide-react";

interface ExperimentWorkflowProps {
  currentStageIndex: number;
  status: "idle" | "running" | "awaiting_approval" | "completed" | "error";
}

function StageIcon({ index, currentIndex, status }: {
  index: number;
  currentIndex: number;
  status: string;
}) {
  if (index < currentIndex) {
    return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
  }
  if (index === currentIndex) {
    if (status === "awaiting_approval") {
      return <PauseCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
    }
    if (status === "running") {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />;
    }
  }
  return <Circle className="h-4 w-4 text-muted-foreground/40" />;
}

export function ExperimentWorkflow({ currentStageIndex, status }: ExperimentWorkflowProps) {
  const t = useTranslations("researchExec");

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-1">
        <h3 className="text-sm font-semibold mb-3">{t("workflowStages")}</h3>
        {WORKFLOW_STAGES.map((stage, i) => {
          const role = RESEARCH_EXEC_ROLES[stage.roleId];
          return (
            <div
              key={stage.id}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                i === currentStageIndex
                  ? "bg-primary/5 border border-primary/20"
                  : ""
              }`}
            >
              <StageIcon index={i} currentIndex={currentStageIndex} status={status} />
              <div className="flex-1 min-w-0">
                <span className="text-sm">{t(stage.labelKey)}</span>
                {stage.requiresApproval && (
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    {t("requiresApproval")}
                  </Badge>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">{role.displayName}</span>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
