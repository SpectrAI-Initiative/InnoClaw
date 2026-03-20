"use client";

import { PHASE_ORDER, PHASE_STAGE_NUMBER, type Phase, type BudgetUsage, type BudgetLimits, type SessionStatus } from "@/lib/deep-research/types";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Loader2, PauseCircle, AlertTriangle, StopCircle, BookX, SkipForward } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PHASE_LABELS: Record<Phase, string> = {
  intake: "Intake",
  planning: "Planning",
  evidence_collection: "Evidence",
  literature_synthesis: "Synthesis",
  reviewer_deliberation: "Review",
  decision: "Decision",
  additional_literature: "More Lit.",
  validation_planning: "Val. Plan",
  resource_acquisition: "Resources",
  experiment_execution: "Experiment",
  validation_review: "Val. Review",
  final_report: "Report",
};

const STATUS_MESSAGES: Partial<Record<SessionStatus, { text: string; color: string; icon: "pause" | "alert" | "stop" | "blocked" }>> = {
  awaiting_user_confirmation: { text: "Halted — waiting for your confirmation", color: "text-amber-600 dark:text-amber-400", icon: "pause" },
  stopped_by_user: { text: "Stopped by user", color: "text-red-600 dark:text-red-400", icon: "stop" },
  literature_blocked: { text: "Literature blocked — no evidence retrieved", color: "text-orange-600 dark:text-orange-400", icon: "blocked" },
  awaiting_additional_literature: { text: "Awaiting additional literature approval", color: "text-amber-600 dark:text-amber-400", icon: "pause" },
  reviewer_battle_in_progress: { text: "Reviewer deliberation in progress", color: "text-blue-600 dark:text-blue-400", icon: "alert" },
  execution_prepared: { text: "Execution prepared — awaiting approval", color: "text-amber-600 dark:text-amber-400", icon: "pause" },
};

interface PhaseProgressProps {
  currentPhase: Phase;
  sessionStatus: SessionStatus;
  budget: BudgetUsage;
  budgetLimits: BudgetLimits;
  completedPhases?: Set<string>;
  onRunPhase?: (phase: Phase) => void;
  onSkipPhase?: (phase: Phase) => void;
  isRunning?: boolean;
}

export function PhaseProgress({
  currentPhase,
  sessionStatus,
  budget,
  budgetLimits,
  completedPhases,
  onRunPhase,
  onSkipPhase,
  isRunning,
}: PhaseProgressProps) {
  const currentIndex = PHASE_ORDER.indexOf(currentPhase);
  const currentStage = PHASE_STAGE_NUMBER[currentPhase] ?? 0;
  const budgetPercent = Math.min(
    100,
    Math.round((budget.totalTokens / budgetLimits.maxTotalTokens) * 100)
  );
  const isBlocked = sessionStatus === "awaiting_user_confirmation" || sessionStatus === "literature_blocked" || sessionStatus === "execution_prepared";
  const statusMsg = STATUS_MESSAGES[sessionStatus];
  const hasActions = onRunPhase && onSkipPhase && !isRunning;

  return (
    <div className="space-y-2 px-3 py-2 border-b border-border/50">
      {/* Status indicator */}
      {statusMsg && (
        <div className={cn("flex items-center gap-1.5 text-[10px] font-medium", statusMsg.color)}>
          {statusMsg.icon === "pause" ? <PauseCircle className="h-3 w-3" /> :
           statusMsg.icon === "stop" ? <StopCircle className="h-3 w-3" /> :
           statusMsg.icon === "blocked" ? <BookX className="h-3 w-3" /> :
           <AlertTriangle className="h-3 w-3" />}
          {statusMsg.text}
        </div>
      )}

      {/* Stage counter */}
      <div className="text-[10px] text-muted-foreground">
        Stage {currentStage}/11 — {PHASE_LABELS[currentPhase]}
      </div>

      {/* Phase steps */}
      <div className="flex items-center gap-0.5 overflow-x-auto">
        {PHASE_ORDER.map((phase, i) => {
          const isCompleted = completedPhases ? completedPhases.has(phase) : i < currentIndex;
          const isCurrent = i === currentIndex;
          const isFuture = !isCompleted && !isCurrent;

          const pill = (
            <div
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
                hasActions && "cursor-pointer hover:ring-1 hover:ring-border",
                isCompleted && "text-green-600 dark:text-green-400",
                isCurrent && !isBlocked && "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950",
                isCurrent && isBlocked && "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950",
                !isCompleted && !isCurrent && "text-muted-foreground"
              )}
            >
              {isCompleted ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : isCurrent && isBlocked ? (
                <PauseCircle className="h-3 w-3" />
              ) : isCurrent ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Circle className="h-3 w-3" />
              )}
              <span className="hidden xl:inline">{PHASE_LABELS[phase]}</span>
            </div>
          );

          return (
            <div
              key={phase}
              className={cn(
                "flex items-center gap-0.5 shrink-0",
                i < PHASE_ORDER.length - 1 && "after:content-[''] after:w-2 after:h-px after:bg-border"
              )}
            >
              {hasActions ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    {pill}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="min-w-[120px]">
                    {isCompleted && (
                      <DropdownMenuItem onClick={() => onRunPhase(phase)}>
                        Re-run
                      </DropdownMenuItem>
                    )}
                    {isCurrent && isBlocked && (
                      <>
                        <DropdownMenuItem onClick={() => onRunPhase(phase)}>
                          Run
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onSkipPhase(phase)}>
                          <SkipForward className="h-3 w-3 mr-1.5" />
                          Skip
                        </DropdownMenuItem>
                      </>
                    )}
                    {isFuture && (
                      <DropdownMenuItem onClick={() => onRunPhase(phase)}>
                        Jump to
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                pill
              )}
            </div>
          );
        })}
      </div>

      {/* Budget bar */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground shrink-0">Budget</span>
        <Progress value={budgetPercent} className="h-1.5 flex-1" />
        <span className="text-[10px] text-muted-foreground shrink-0">{budgetPercent}%</span>
      </div>
    </div>
  );
}
