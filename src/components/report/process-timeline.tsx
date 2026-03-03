"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Check,
  Loader2,
  AlertCircle,
  Terminal,
  FileText,
  Search,
  FolderOpen,
  Circle,
} from "lucide-react";
import type { ReportProcessStep } from "@/types/report";

const TOOL_ICONS: Record<string, React.ElementType> = {
  bash: Terminal,
  readFile: FileText,
  writeFile: FileText,
  listDirectory: FolderOpen,
  grep: Search,
};

function StepStatusIcon({ status }: { status: ReportProcessStep["status"] }) {
  switch (status) {
    case "completed":
      return (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500/15">
          <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
        </div>
      );
    case "running":
      return (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/15">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 dark:text-blue-400" />
        </div>
      );
    case "error":
      return (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500/15">
          <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
        </div>
      );
    default:
      return (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
          <Circle className="h-3 w-3 text-muted-foreground" />
        </div>
      );
  }
}

interface ProcessTimelineProps {
  steps: ReportProcessStep[];
}

export function ProcessTimeline({ steps }: ProcessTimelineProps) {
  const t = useTranslations("report");

  if (steps.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p className="text-sm">{t("noProcessSteps")}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="px-6 py-4">
        <div className="relative">
          {/* Connecting line */}
          <div className="absolute left-3 top-3 bottom-3 w-px bg-border" />

          <div className="space-y-1">
            {steps.map((step) => {
              const ToolIcon = TOOL_ICONS[step.toolName ?? ""] ?? Terminal;
              return (
                <div key={step.id} className="relative flex items-start gap-3 py-2">
                  <StepStatusIcon status={step.status} />
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2">
                      <ToolIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="text-sm font-medium truncate">
                        {step.label}
                      </span>
                    </div>
                    {step.detail && (
                      <p className="mt-0.5 text-xs text-muted-foreground font-mono truncate">
                        {step.detail}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
