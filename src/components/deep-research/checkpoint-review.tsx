"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArtifactViewer } from "./artifact-viewer";
import {
  CheckCircle,
  XCircle,
  RotateCcw,
  GitBranch,
  Square,
  ChevronDown,
  ChevronUp,
  FileText,
  HelpCircle,
  ArrowRight,
} from "lucide-react";
import type {
  CheckpointPackage,
  ConfirmationOutcome,
  DeepResearchArtifact,
  MainBrainAudit,
} from "@/lib/deep-research/types";

interface CheckpointReviewProps {
  checkpoint: CheckpointPackage;
  artifacts: DeepResearchArtifact[];
  onConfirm: (outcome: ConfirmationOutcome, feedback?: string) => Promise<void>;
}

const ASSESSMENT_BADGE_CLASS: Record<MainBrainAudit["resultAssessment"], string> = {
  good: "border-green-300 text-green-600",
  acceptable: "border-blue-300 text-blue-600",
  concerning: "border-yellow-300 text-yellow-600",
  problematic: "border-red-300 text-red-600",
};

const ACTION_BUTTONS: Array<{
  outcome: ConfirmationOutcome;
  label: string;
  icon: typeof CheckCircle;
  variant?: "default" | "outline";
  className?: string;
}> = [
  { outcome: "confirmed", label: "Continue", icon: CheckCircle },
  { outcome: "revision_requested", label: "Revise", icon: RotateCcw, variant: "outline" },
  { outcome: "branch_requested", label: "Branch", icon: GitBranch, variant: "outline" },
  { outcome: "rejected", label: "Reject", icon: XCircle, variant: "outline", className: "text-red-600" },
  { outcome: "stopped", label: "Stop", icon: Square, variant: "outline", className: "text-red-600" },
];

function CheckpointCallout({
  icon: Icon,
  label,
  children,
  tone,
}: {
  icon: typeof ArrowRight;
  label: string;
  children: React.ReactNode;
  tone: "blue" | "green" | "emerald" | "slate";
}) {
  const styles = {
    blue: {
      container: "bg-blue-50 dark:bg-blue-950/50",
      icon: "text-blue-600 dark:text-blue-400",
      label: "text-blue-800 dark:text-blue-200",
      body: "text-blue-700 dark:text-blue-300",
    },
    green: {
      container: "bg-green-50 dark:bg-green-950/50",
      icon: "text-green-600 dark:text-green-400",
      label: "text-green-800 dark:text-green-200",
      body: "text-green-700 dark:text-green-300",
    },
    emerald: {
      container: "bg-emerald-50 dark:bg-emerald-950/40",
      icon: "text-emerald-600 dark:text-emerald-400",
      label: "text-emerald-800 dark:text-emerald-200",
      body: "text-emerald-700 dark:text-emerald-300",
    },
    slate: {
      container: "bg-slate-50 dark:bg-slate-900/50",
      icon: "text-slate-600 dark:text-slate-400",
      label: "text-slate-800 dark:text-slate-200",
      body: "text-slate-700 dark:text-slate-300",
    },
  }[tone];

  return (
    <div className={`flex items-start gap-2 rounded p-2 text-xs ${styles.container}`}>
      <Icon className={`mt-0.5 h-3 w-3 shrink-0 ${styles.icon}`} />
      <div>
        <span className={`font-medium ${styles.label}`}>{label}</span>
        <span className={styles.body}>{children}</span>
      </div>
    </div>
  );
}

export function CheckpointReview({ checkpoint, artifacts, onConfirm }: CheckpointReviewProps) {
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showFindings, setShowFindings] = useState(false);
  const isAnswerRequired = checkpoint.interactionMode === "answer_required";

  const relatedArtifacts = artifacts.filter((a) =>
    checkpoint.artifactsToReview.includes(a.id)
  );
  const taskGraphArtifacts = relatedArtifacts.filter((artifact) => artifact.artifactType === "task_graph");
  const evidenceArtifacts = relatedArtifacts.filter((artifact) => artifact.artifactType === "evidence_card");
  const finalReportArtifacts = relatedArtifacts.filter((artifact) => artifact.artifactType === "final_report");
  const otherArtifacts = relatedArtifacts.filter((artifact) => !["evidence_card", "task_graph", "final_report"].includes(artifact.artifactType));

  const handleAction = async (outcome: ConfirmationOutcome) => {
    setSubmitting(true);
    try {
      await onConfirm(outcome, feedback.trim() || undefined);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border border-amber-300 dark:border-amber-700 rounded-lg bg-amber-50/50 dark:bg-amber-950/30 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-colors"
      >
        <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
        <span className="text-sm font-semibold flex-1 text-amber-900 dark:text-amber-100">
          {checkpoint.title}
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Summary */}
          <div className="text-sm text-foreground leading-relaxed">
            {checkpoint.humanSummary}
          </div>

          {/* Current findings (collapsible) */}
          {checkpoint.currentFindings && (
            <div>
              <button
                onClick={() => setShowFindings(!showFindings)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <FileText className="h-3 w-3" />
                Current findings
                {showFindings ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {showFindings && (
                <div className="mt-1 p-2 bg-background rounded text-xs leading-relaxed max-h-[200px] overflow-auto">
                  {checkpoint.currentFindings}
                </div>
              )}
            </div>
          )}

          {/* Open questions */}
          {checkpoint.openQuestions.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <HelpCircle className="h-3 w-3" />
                Open questions
              </div>
              <ul className="text-xs space-y-0.5 pl-4 list-disc text-muted-foreground">
                {checkpoint.openQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Researcher Audit */}
          {checkpoint.mainBrainAudit && (
            <div className="p-2 border rounded space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold">Researcher Assessment:</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${ASSESSMENT_BADGE_CLASS[checkpoint.mainBrainAudit.resultAssessment]}`}
                >
                  {checkpoint.mainBrainAudit.resultAssessment}
                </Badge>
                {checkpoint.mainBrainAudit.canProceed ? (
                  <Badge variant="outline" className="text-[10px] text-green-600">Can proceed</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-red-600">Blocked</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">{checkpoint.mainBrainAudit.whatWasCompleted}</div>
              {checkpoint.mainBrainAudit.issuesAndRisks.length > 0 && (
                <div className="text-xs p-1.5 bg-yellow-50 dark:bg-yellow-950/50 rounded">
                  <span className="font-medium text-yellow-800 dark:text-yellow-200">Issues: </span>
                  {checkpoint.mainBrainAudit.issuesAndRisks.join("; ")}
                </div>
              )}
            </div>
          )}

          {/* Literature / Reviewer / Execution context */}
          {checkpoint.literatureRoundInfo && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-[10px]">
                Lit. Round {checkpoint.literatureRoundInfo.roundNumber}
              </Badge>
              <span>
                {checkpoint.literatureRoundInfo.papersCollected} papers across {checkpoint.literatureRoundInfo.retrievalTaskCount} retrieval task(s)
              </span>
              <Badge variant="outline" className="text-[10px] text-green-600 border-green-300">
                {checkpoint.literatureRoundInfo.successfulTaskCount} with evidence
              </Badge>
              {checkpoint.literatureRoundInfo.emptyTaskCount > 0 && (
                <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-300">
                  {checkpoint.literatureRoundInfo.emptyTaskCount} empty
                </Badge>
              )}
              {checkpoint.literatureRoundInfo.failedTaskCount > 0 && (
                <Badge variant="outline" className="text-[10px] text-red-600 border-red-300">
                  {checkpoint.literatureRoundInfo.failedTaskCount} failed
                </Badge>
              )}
            </div>
          )}

          {checkpoint.reviewInfo && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-[10px]">
                Reviewer: {checkpoint.reviewInfo.combinedVerdict}
              </Badge>
              <span>Confidence: {((checkpoint.reviewInfo.combinedConfidence) * 100).toFixed(0)}%</span>
              {checkpoint.reviewInfo.needsMoreLiterature && (
                <Badge variant="outline" className="text-[10px] text-amber-600">Need more lit.</Badge>
              )}
            </div>
          )}

          {checkpoint.executionInfo && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-[10px]">
                Execution: {checkpoint.executionInfo.stepsCompleted}/{checkpoint.executionInfo.stepsTotal}
              </Badge>
              <span>{checkpoint.executionInfo.currentStatus}</span>
            </div>
          )}

          {/* "Continue will do" — mandatory per spec */}
          {(checkpoint.transitionAction?.description || checkpoint.continueWillDo || checkpoint.mainBrainAudit?.continueWillDo) && (
            <CheckpointCallout
              icon={ArrowRight}
              label={isAnswerRequired ? "Next step after your reply: " : "Continue will: "}
              tone="blue"
            >
              {checkpoint.transitionAction?.description || checkpoint.continueWillDo || checkpoint.mainBrainAudit?.continueWillDo}
            </CheckpointCallout>
          )}

          {/* Recommended action */}
          <CheckpointCallout icon={ArrowRight} label="Next step: " tone="green">
            {checkpoint.recommendedNextAction}
          </CheckpointCallout>

          {checkpoint.recommendedWorker && (
            <CheckpointCallout icon={ArrowRight} label="Next task owner: " tone="emerald">
              {checkpoint.recommendedWorker.roleName} ({checkpoint.recommendedWorker.nodeType}) - {checkpoint.recommendedWorker.label}
            </CheckpointCallout>
          )}

          {checkpoint.promptUsed && (
            <CheckpointCallout icon={FileText} label="Prompt used: " tone="slate">
              <>
                {checkpoint.promptUsed.title}
                <div className="mt-1 text-muted-foreground">
                  {checkpoint.promptUsed.kind} - {checkpoint.promptUsed.objective}
                </div>
              </>
            </CheckpointCallout>
          )}

          {/* Alternative actions */}
          {checkpoint.alternativeNextActions.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Alternatives: </span>
              {checkpoint.alternativeNextActions.join(" · ")}
            </div>
          )}

          {evidenceArtifacts.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Evidence Cards
              </div>
              <div className="space-y-3">
                {evidenceArtifacts.map((artifact) => (
                  <div key={artifact.id} className="rounded-lg border bg-background p-3">
                    <ArtifactViewer
                      artifact={artifact}
                      disableScroll
                      evidenceExcerptLimit={Number.POSITIVE_INFINITY}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {taskGraphArtifacts.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Planned Worker Payload
              </div>
              <div className="space-y-3">
                {taskGraphArtifacts.map((artifact) => (
                  <div key={artifact.id} className="rounded-lg border bg-background p-3">
                    <ArtifactViewer artifact={artifact} disableScroll />
                  </div>
                ))}
              </div>
            </div>
          )}

          {finalReportArtifacts.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Final Report Draft
              </div>
              <div className="space-y-3">
                {finalReportArtifacts.map((artifact) => (
                  <div key={artifact.id} className="rounded-lg border bg-background p-3">
                    <ArtifactViewer artifact={artifact} disableScroll />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related artifacts */}
          {otherArtifacts.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {otherArtifacts.map((a) => (
                <Badge key={a.id} variant="secondary" className="text-[10px]">
                  {a.artifactType}: {a.title}
                </Badge>
              ))}
            </div>
          )}

          {isAnswerRequired ? (
            <div className="rounded border border-amber-300 bg-amber-100/60 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
              This checkpoint is waiting for your reply in chat. Once you answer the clarification questions below, the Researcher will resume automatically.
            </div>
          ) : (
            <>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Optional: Add feedback, instructions, or corrections..."
                className="text-sm min-h-[60px] max-h-[120px] resize-none bg-background"
                rows={2}
              />

              <div className="flex flex-wrap gap-2">
                {ACTION_BUTTONS.map(({ outcome, label, icon: Icon, variant, className }) => (
                  <Button
                    key={outcome}
                    size="sm"
                    variant={variant}
                    className={`h-7 gap-1.5 px-3 text-xs ${className ?? ""}`.trim()}
                    onClick={() => handleAction(outcome)}
                    disabled={submitting}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </Button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
