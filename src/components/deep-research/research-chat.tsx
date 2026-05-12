"use client";

import { useState, useRef, useEffect, memo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, Brain, User, CheckCircle, XCircle, Loader2, FileText, PlayCircle, Square, RotateCcw } from "lucide-react";
import { CheckpointReview } from "./checkpoint-review";
import { ArtifactViewer } from "./artifact-viewer";
import { isNodeDetailOnlyMessage } from "@/lib/deep-research/node-transcript";
import {
  isActiveSessionStatus,
  isAwaitingConfirmationSessionStatus,
  isCompletedSessionStatus,
  isTerminalSessionStatus,
} from "@/lib/deep-research/session-status";
import { getNodeDisplayLabel, getStructuredRoleDisplayName, RESEARCHER_ROLE_ID } from "@/lib/deep-research/role-registry";
import {
  getLatestFinalReportArtifact,
  resolveFinalReportPresentation,
} from "@/lib/deep-research/final-report";
import type {
  DeepResearchMessage,
  DeepResearchSession,
  DeepResearchNode,
  DeepResearchArtifact,
  ConfirmationOutcome,
  CheckpointPackage,
} from "@/lib/deep-research/types";

interface ResearchChatProps {
  session: DeepResearchSession;
  messages: DeepResearchMessage[];
  nodes: DeepResearchNode[];
  artifacts: DeepResearchArtifact[];
  onSendMessage: (content: string) => Promise<void>;
  onApprove: (nodeId: string, approved: boolean, feedback?: string) => Promise<void>;
  onConfirm: (nodeId: string, outcome: ConfirmationOutcome, feedback?: string) => Promise<void>;
}

export const ResearchChat = memo(function ResearchChat({
  session,
  messages,
  nodes,
  artifacts,
  onSendMessage,
  onApprove,
  onConfirm,
}: ResearchChatProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const awaitingApprovalNodes = nodes.filter((n) => n.status === "awaiting_approval");
  const isRunning = isActiveSessionStatus(session.status);
  const isAwaitingConfirmation = isAwaitingConfirmationSessionStatus(session.status);
  const isCompleted = isCompletedSessionStatus(session.status);
  const isFailed = session.status === "failed";
  const isCancelled = session.status === "cancelled";
  const isStopped = session.status === "stopped_by_user";
  const isTerminal = isTerminalSessionStatus(session.status);
  const assistantLabel = getStructuredRoleDisplayName(RESEARCHER_ROLE_ID);

  // Get the pending checkpoint data
  const pendingCheckpoint = isAwaitingConfirmation && session.pendingCheckpointId
    ? artifacts.find((a) => a.id === session.pendingCheckpointId)
    : null;
  const pendingCheckpointData = pendingCheckpoint?.content as CheckpointPackage | undefined;

  // Get the final report artifact (for completed sessions)
  const finalReportArtifact = getLatestFinalReportArtifact(artifacts);
  const { citationCoverage: finalReportCitationCoverage } = resolveFinalReportPresentation(finalReportArtifact, artifacts);
  const visibleMessages = messages.filter((message) => !isNodeDetailOnlyMessage(message));

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleMessages.length, isAwaitingConfirmation, isCompleted]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setInput("");
    try {
      await onSendMessage(content);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCheckpointConfirm = async (outcome: ConfirmationOutcome, feedback?: string) => {
    // Use the checkpoint's nodeId directly, fall back to first awaiting node
    const awaitingConfirmationNodes = nodes.filter((n) => n.status === "awaiting_user_confirmation");
    const checkpointNodeId = pendingCheckpointData?.nodeId;
    const targetNodeId = checkpointNodeId || awaitingConfirmationNodes[0]?.id;
    if (!targetNodeId) return;
    await onConfirm(targetNodeId, outcome, feedback);
  };

  // Fallback resume handler — for awaiting_user_confirmation with no checkpoint
  const handleFallbackResume = async (outcome: ConfirmationOutcome, feedback?: string) => {
    // Find ANY node we can use as target — prefer awaiting_user_confirmation, then last completed
    const awaitingNodes = nodes.filter((n) => n.status === "awaiting_user_confirmation");
    const lastCompleted = [...nodes].reverse().find((n) => n.status === "completed");
    const targetNodeId = awaitingNodes[0]?.id || lastCompleted?.id;
    if (!targetNodeId) return;
    await onConfirm(targetNodeId, outcome, feedback);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <Brain className="h-4 w-4 text-purple-500" />
        <span className="text-sm font-medium flex-1">{assistantLabel}</span>
        <Badge
          variant={
            isRunning ? "default"
              : isAwaitingConfirmation ? "outline"
                : isCompleted ? "secondary"
                  : isFailed ? "destructive"
                    : "secondary"
          }
          className="text-[10px]"
        >
          {session.status.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
        <div className="p-3 space-y-3">
          {visibleMessages.map((msg) => {
            const relatedNode = msg.relatedNodeId
              ? nodes.find(n => n.id === msg.relatedNodeId) ?? null
              : null;
            const relatedArts = msg.relatedArtifactIds.length > 0
              ? artifacts.filter(a => msg.relatedArtifactIds.includes(a.id))
              : [];

            return (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role !== "user" && (
                  <div className="shrink-0 h-6 w-6 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                    <Brain className="h-3.5 w-3.5 text-purple-600 dark:text-purple-300" />
                  </div>
                )}
                <div className="max-w-[85%] space-y-1">
                  <div
                    className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {msg.content}
                  </div>
                  {/* Related node/artifact chips */}
                  {msg.role !== "user" && (relatedNode || relatedArts.length > 0) && (
                    <div className="flex flex-wrap gap-1 px-1">
                      {relatedNode && (
                        <Badge variant="outline" className="text-[9px]">
                          {getNodeDisplayLabel(relatedNode.label).slice(0, 30)}{getNodeDisplayLabel(relatedNode.label).length > 30 ? "..." : ""}
                        </Badge>
                      )}
                      {relatedArts.map(a => (
                        <Badge key={a.id} variant="outline" className="text-[9px]">
                          {a.artifactType}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="shrink-0 h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-300" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Running indicator */}
          {isRunning && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Processing...</span>
            </div>
          )}

          {/* Checkpoint review panel */}
          {isAwaitingConfirmation && pendingCheckpoint && (
            <CheckpointReview
              checkpoint={pendingCheckpointData!}
              artifacts={artifacts}
              onConfirm={handleCheckpointConfirm}
            />
          )}

          {/* Fallback confirmation panel — awaiting but no checkpoint artifact */}
          {isAwaitingConfirmation && !pendingCheckpoint && (
            <div className="border border-amber-300 dark:border-amber-700 rounded-lg bg-amber-50/50 dark:bg-amber-950/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                <span className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  Awaiting your decision
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                The session is paused and waiting for your input. You can continue and let the Researcher choose the next workflow, or stop the research.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="h-7 px-3 text-xs gap-1.5"
                  onClick={() => handleFallbackResume("confirmed")}
                >
                  <PlayCircle className="h-3.5 w-3.5" />
                  Continue
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-3 text-xs gap-1.5"
                  onClick={() => handleFallbackResume("revision_requested")}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Revise
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-3 text-xs gap-1.5 text-red-600"
                  onClick={() => handleFallbackResume("stopped")}
                >
                  <Square className="h-3.5 w-3.5" />
                  Stop
                </Button>
              </div>
            </div>
          )}

          {/* Completed state — show final report */}
          {isCompleted && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/50 rounded-lg border border-green-200 dark:border-green-800">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                <div className="min-w-0">
                  <span className="text-sm font-medium text-green-800 dark:text-green-200">
                    Research completed
                  </span>
                  {finalReportCitationCoverage && (
                    <div className="mt-1 text-[11px] text-green-700 dark:text-green-300">
                      Citations {finalReportCitationCoverage.citedCitationCount}/{finalReportCitationCoverage.availableCitationCount}
                      {" · "}
                      target {finalReportCitationCoverage.minimumRequiredCitationCount}
                      {" · "}
                      {finalReportCitationCoverage.hasReferencesSection ? "references present" : "references missing"}
                    </div>
                  )}
                </div>
              </div>

              {finalReportArtifact ? (
                <div className="border rounded-lg p-4 bg-background">
                  <ArtifactViewer artifact={finalReportArtifact} />
                </div>
              ) : (
                <div className="text-xs text-muted-foreground p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-3.5 w-3.5" />
                    <span className="font-medium">No final report artifact found.</span>
                  </div>
                  <p>
                    You can view all research artifacts by opening nodes from the Roadmap tab.
                    Look for nodes of type &quot;final_report&quot; or &quot;synthesize&quot; to find the research conclusions.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Failed state */}
          {isFailed && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/50 rounded-lg border border-red-200 dark:border-red-800">
              <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
              <div className="text-sm">
                <span className="font-medium text-red-800 dark:text-red-200">Research failed</span>
                {session.error && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">{session.error}</p>
                )}
              </div>
            </div>
          )}

          {/* Cancelled state */}
          {isCancelled && (
            <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <XCircle className="h-4 w-4 text-gray-500 shrink-0" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Research was cancelled
              </span>
            </div>
          )}

          {/* Stopped by user */}
          {isStopped && (
            <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <XCircle className="h-4 w-4 text-gray-500 shrink-0" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Research was stopped by user
              </span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Approval panel (legacy, for awaiting_approval nodes) */}
      {awaitingApprovalNodes.length > 0 && (
        <div className="px-3 py-2 border-t border-border/50 bg-yellow-50 dark:bg-yellow-950 space-y-2">
          <div className="text-xs font-medium text-yellow-800 dark:text-yellow-200">
            Approval Required
          </div>
          {awaitingApprovalNodes.map((node) => (
            <div key={node.id} className="flex items-center gap-2">
              <span className="text-xs flex-1 truncate">{getNodeDisplayLabel(node.label)}</span>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[10px] text-green-600"
                onClick={() => onApprove(node.id, true)}
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[10px] text-red-600"
                onClick={() => onApprove(node.id, false)}
              >
                <XCircle className="h-3 w-3 mr-1" />
                Reject
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Input — hidden when session is in a terminal state */}
      {!isTerminal && (
        <div className="p-3 border-t border-border/50">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message the ${assistantLabel}...`}
              className="min-h-[40px] max-h-[120px] resize-none text-sm"
              rows={1}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="shrink-0 h-10 w-10"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});
