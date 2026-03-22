"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, MessageSquare } from "lucide-react";
import { useState } from "react";
import type { ReviewerBattleResultExtended } from "@/lib/deep-research/types";

interface ReviewerBattlePanelProps {
  battleResult: ReviewerBattleResultExtended | null;
}

export function ReviewerBattlePanel({ battleResult }: ReviewerBattlePanelProps) {
  const [activeRound, setActiveRound] = useState(0);

  if (!battleResult) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        No reviewer battle has occurred yet. It will appear during the reviewer deliberation phase.
      </div>
    );
  }

  const rounds = battleResult.rounds ?? [];
  const currentRound = rounds[activeRound];

  const verdictColor = (verdict: string) => {
    switch (verdict) {
      case "approve": return "text-green-600 border-green-300 bg-green-50 dark:bg-green-950/30";
      case "revise": return "text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30";
      case "reject": return "text-red-600 border-red-300 bg-red-50 dark:bg-red-950/30";
      default: return "";
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-4">
        {/* Summary bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={`text-xs ${verdictColor(battleResult.combinedVerdict)}`}>
            {battleResult.combinedVerdict}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Confidence: {(battleResult.combinedConfidence * 100).toFixed(0)}%
          </span>
          {battleResult.convergedAtRound !== null && (
            <div className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle className="h-3 w-3" />
              Converged at round {battleResult.convergedAtRound}
            </div>
          )}
          <Badge variant="secondary" className="text-[10px]">
            Agreement: {(battleResult.agreementScore * 100).toFixed(0)}%
          </Badge>
        </div>

        {/* Round tabs */}
        {rounds.length > 1 && (
          <div className="flex gap-1">
            {rounds.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveRound(i)}
                className={`px-2 py-1 text-xs rounded ${
                  activeRound === i
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                Round {i + 1}
              </button>
            ))}
          </div>
        )}

        {/* Side-by-side reviewer packets */}
        {currentRound && (
          <div className="grid grid-cols-2 gap-2">
            {/* Reviewer A */}
            <div className="border rounded p-2 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="h-3 w-3 text-blue-500" />
                <span className="text-xs font-semibold">Reviewer A</span>
                <Badge variant="outline" className={`text-[9px] ${verdictColor(currentRound.reviewerAPacket.verdict)}`}>
                  {currentRound.reviewerAPacket.verdict}
                </Badge>
              </div>
              <div className="text-[11px] leading-relaxed text-muted-foreground">
                {currentRound.reviewerAPacket.critique.slice(0, 300)}
                {currentRound.reviewerAPacket.critique.length > 300 && "..."}
              </div>
              <div className="text-[10px] text-muted-foreground">
                Confidence: {(currentRound.reviewerAPacket.confidence * 100).toFixed(0)}%
              </div>
            </div>

            {/* Reviewer B */}
            <div className="border rounded p-2 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="h-3 w-3 text-purple-500" />
                <span className="text-xs font-semibold">Reviewer B</span>
                <Badge variant="outline" className={`text-[9px] ${verdictColor(currentRound.reviewerBPacket.verdict)}`}>
                  {currentRound.reviewerBPacket.verdict}
                </Badge>
              </div>
              <div className="text-[11px] leading-relaxed text-muted-foreground">
                {currentRound.reviewerBPacket.critique.slice(0, 300)}
                {currentRound.reviewerBPacket.critique.length > 300 && "..."}
              </div>
              <div className="text-[10px] text-muted-foreground">
                Confidence: {(currentRound.reviewerBPacket.confidence * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        )}

        {/* Agreements & Disagreements */}
        {battleResult.agreements.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-semibold text-green-700 dark:text-green-400">
              Agreements ({battleResult.agreements.length})
            </div>
            <ul className="text-xs space-y-0.5 pl-4 list-disc text-muted-foreground">
              {battleResult.agreements.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        )}

        {battleResult.disagreements.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-semibold text-red-700 dark:text-red-400">
              Disagreements ({battleResult.disagreements.length})
            </div>
            <ul className="text-xs space-y-0.5 pl-4 list-disc text-muted-foreground">
              {battleResult.disagreements.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          </div>
        )}

        {/* Unresolved gaps */}
        {battleResult.unresolvedGaps.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              Unresolved Gaps
            </div>
            <ul className="text-xs space-y-0.5 pl-4 list-disc text-muted-foreground">
              {battleResult.unresolvedGaps.map((g, i) => <li key={i}>{g}</li>)}
            </ul>
          </div>
        )}

        {/* Flags */}
        <div className="flex flex-wrap gap-1.5">
          {battleResult.needsMoreLiterature && (
            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
              Needs more literature
            </Badge>
          )}
          {battleResult.needsExperimentalValidation && (
            <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-300">
              Needs experimental validation
            </Badge>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
