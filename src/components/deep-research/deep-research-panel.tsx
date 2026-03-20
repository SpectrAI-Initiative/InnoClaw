"use client";

import { useState, useCallback } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Brain, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  useDeepResearchSessions,
  useDeepResearchSession,
  useDeepResearchMessages,
  useDeepResearchNodes,
  useDeepResearchArtifacts,
  useDeepResearchEvents,
  useDeepResearchExecutions,
} from "@/lib/hooks/use-deep-research";
import { SessionList } from "./session-list";
import { IntakeScreen } from "./intake-screen";
import { ResearchChat } from "./research-chat";
import { FinalReportView } from "./final-report-view";
import { PhaseProgress } from "./phase-progress";
import { WorkflowGraph } from "./workflow-graph";
import { NodeDetailDrawer } from "./node-detail-drawer";
import { DeleteSessionDialog } from "./delete-session-dialog";
import { RequirementPanel } from "./requirement-panel";
import { ReviewerBattlePanel } from "./reviewer-battle-panel";
import { ExecutionStatusPanel } from "./execution-status-panel";
import type { ConfirmationOutcome, ReviewerBattleResultExtended, RequirementState, Phase } from "@/lib/deep-research/types";

type PanelView = "list" | "intake" | "session";
type TabView = "chat" | "requirements" | "reviewers" | "execution";

interface DeepResearchPanelProps {
  workspaceId: string;
}

export function DeepResearchPanel({ workspaceId }: DeepResearchPanelProps) {
  const [view, setView] = useState<PanelView>("list");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabView>("chat");

  const { sessions, mutate: mutateSessions } = useDeepResearchSessions(workspaceId);
  const { session, mutate: mutateSession } = useDeepResearchSession(activeSessionId ?? undefined);
  const { messages, mutate: mutateMessages } = useDeepResearchMessages(activeSessionId ?? undefined);
  const { nodes } = useDeepResearchNodes(activeSessionId ?? undefined);
  const { artifacts } = useDeepResearchArtifacts(activeSessionId ?? undefined);
  const { events } = useDeepResearchEvents(activeSessionId ?? undefined);
  const { executions } = useDeepResearchExecutions(activeSessionId ?? undefined);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  // Extract requirement state and battle result from artifacts for panels
  const requirementStateArtifact = artifacts.find(a => a.artifactType === "checkpoint" && (a.content as Record<string, unknown>).requirementState);
  const latestBattleArtifact = [...artifacts].reverse().find(a => a.artifactType === "reviewer_battle_result");
  const battleResult = latestBattleArtifact?.content as unknown as ReviewerBattleResultExtended | null ?? null;

  // Auto-switch tab based on phase
  const autoTabForPhase = useCallback((phase: string) => {
    if (phase === "reviewer_deliberation" || phase === "validation_review") return "reviewers";
    if (phase === "experiment_execution" || phase === "resource_acquisition") return "execution";
    return null;
  }, []);

  // Requirement state from SWR - placeholder (would need its own API endpoint or derive from artifacts)
  const requirementState: RequirementState | null = null;

  // --- Navigation ---

  const handleOpenSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setView("session");
    setSelectedNodeId(null);
    setDrawerOpen(false);
  }, []);

  const handleBackToList = useCallback(() => {
    setActiveSessionId(null);
    setView("list");
    setSelectedNodeId(null);
    setDrawerOpen(false);
  }, []);

  // --- Intake ---

  const handleStartIntake = useCallback(() => {
    setView("intake");
  }, []);

  const handleIntakeCreated = useCallback(
    (sessionId: string) => {
      mutateSessions();
      setActiveSessionId(sessionId);
      setView("session");
    },
    [mutateSessions]
  );

  const handleIntakeCancel = useCallback(() => {
    setView("list");
  }, []);

  // --- Delete ---

  const handleSessionDeleted = useCallback(
    (deletedId: string) => {
      mutateSessions();
      // If the currently active session was deleted, go back to list
      if (activeSessionId === deletedId) {
        setActiveSessionId(null);
        setView("list");
      }
    },
    [activeSessionId, mutateSessions]
  );

  const handleDeleteActiveSession = useCallback(() => {
    setDeleteDialogOpen(true);
  }, []);

  const handleActiveSessionDeleted = useCallback(() => {
    mutateSessions();
    setActiveSessionId(null);
    setView("list");
    setDeleteDialogOpen(false);
  }, [mutateSessions]);

  // --- Session actions ---

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!activeSessionId) return;
      try {
        await fetch(`/api/deep-research/sessions/${activeSessionId}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        mutateMessages();
        mutateSession();
      } catch {
        toast.error("Failed to send message");
      }
    },
    [activeSessionId, mutateMessages, mutateSession]
  );

  const handleApprove = useCallback(
    async (nodeId: string, approved: boolean, feedback?: string) => {
      if (!activeSessionId) return;
      try {
        await fetch(`/api/deep-research/sessions/${activeSessionId}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodeId, approved, feedback }),
        });
        mutateSession();
      } catch {
        toast.error("Failed to process approval");
      }
    },
    [activeSessionId, mutateSession]
  );

  const handleConfirm = useCallback(
    async (nodeId: string, outcome: ConfirmationOutcome, feedback?: string) => {
      if (!activeSessionId) return;
      try {
        const res = await fetch(`/api/deep-research/sessions/${activeSessionId}/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodeId, outcome, feedback }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to confirm");
        }
        mutateSession();
        toast.success(
          outcome === "confirmed"
            ? "Confirmed — continuing research"
            : outcome === "stopped"
              ? "Research stopped"
              : `Feedback sent: ${outcome.replace("_", " ")}`
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to process confirmation");
      }
    },
    [activeSessionId, mutateSession]
  );

  const handleStartRun = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      const res = await fetch(`/api/deep-research/sessions/${activeSessionId}/run`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start");
      }
      mutateSession();
      toast.success("Research started");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start research");
    }
  }, [activeSessionId, mutateSession]);

  const handleRunPhase = useCallback(async (phase: Phase) => {
    if (!activeSessionId) return;
    try {
      const res = await fetch(`/api/deep-research/sessions/${activeSessionId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPhase: phase, action: "run" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to run phase");
      }
      mutateSession();
      toast.success(`Running phase: ${phase}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to run phase");
    }
  }, [activeSessionId, mutateSession]);

  const handleSkipPhase = useCallback(async (phase: Phase) => {
    if (!activeSessionId) return;
    try {
      const res = await fetch(`/api/deep-research/sessions/${activeSessionId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPhase: phase, action: "skip" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to skip phase");
      }
      mutateSession();
      toast.success(`Skipped phase: ${phase}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to skip phase");
    }
  }, [activeSessionId, mutateSession]);

  const handleNodeSelect = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setDrawerOpen(true);
  }, []);

  const handleBindProfile = useCallback(
    async (profileId: string | null) => {
      if (!activeSessionId) return;
      try {
        await fetch(`/api/deep-research/sessions/${activeSessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ remoteProfileId: profileId }),
        });
        mutateSession();
      } catch {
        toast.error("Failed to bind remote profile");
      }
    },
    [activeSessionId, mutateSession],
  );

  // --- Render views ---

  if (view === "intake") {
    return (
      <IntakeScreen
        workspaceId={workspaceId}
        onCreated={handleIntakeCreated}
        onCancel={handleIntakeCancel}
      />
    );
  }

  if (view === "list" || !activeSessionId || !session) {
    return (
      <SessionList
        sessions={sessions}
        onSelect={handleOpenSession}
        onCreateNew={handleStartIntake}
        onDeleted={handleSessionDeleted}
      />
    );
  }

  // Active session view
  const isRunning = session.status === "running" || session.status === "reviewing" || session.status === "awaiting_resource" || session.status === "literature_in_progress" || session.status === "planning_in_progress" || session.status === "reviewer_battle_in_progress" || session.status === "execution_in_progress" || session.status === "validation_planning_in_progress";
  const isAwaitingConfirmation = session.status === "awaiting_user_confirmation" || session.status === "execution_prepared" || session.status === "awaiting_additional_literature";
  const isCompleted = session.status === "completed" || session.status === "final_report_generated";
  const isFailed = session.status === "failed";
  const isLiteratureBlocked = session.status === "literature_blocked";
  const isStopped = session.status === "stopped_by_user";
  const canStart = ["intake", "paused", "awaiting_approval", "failed"].includes(session.status);
  const completedPhases = new Set(
    nodes.filter(n => n.status === "completed").map(n => n.phase)
  );

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/50 bg-muted/30 shrink-0">
        <Select
          value={activeSessionId}
          onValueChange={(v) => handleOpenSession(v)}
        >
          <SelectTrigger className="h-7 w-[200px] text-xs">
            <SelectValue placeholder="Select session" />
          </SelectTrigger>
          <SelectContent>
            {sessions.map((s) => (
              <SelectItem key={s.id} value={s.id} className="text-xs">
                {s.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        {canStart && !isFailed && (
          <Button size="sm" className="h-7 px-2 gap-1" onClick={handleStartRun}>
            <Play className="h-3 w-3" />
            <span className="text-xs">{session.status === "intake" ? "Start" : "Resume"}</span>
          </Button>
        )}

        {isAwaitingConfirmation && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            Awaiting your confirmation
          </div>
        )}

        {isCompleted && (
          <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            Completed
          </div>
        )}

        {isFailed && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              Failed
            </div>
            <Button size="sm" variant="outline" className="h-7 px-2 gap-1" onClick={handleStartRun}>
              <RotateCcw className="h-3 w-3" />
              <span className="text-xs">Retry</span>
            </Button>
          </div>
        )}

        {isStopped && (
          <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
            <div className="h-2 w-2 rounded-full bg-gray-500" />
            Stopped by user
          </div>
        )}

        {isLiteratureBlocked && (
          <div className="flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400">
            <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
            Literature blocked — no evidence
          </div>
        )}

        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
          onClick={handleDeleteActiveSession}
          title="Delete session"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>

        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 gap-1"
          onClick={handleBackToList}
        >
          <span className="text-xs">Back</span>
        </Button>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup orientation="horizontal">
          {/* Left: Tabs + Content */}
          <ResizablePanel defaultSize={45} minSize={25}>
            <div className="flex flex-col h-full">
              {isCompleted ? (
                <FinalReportView session={session} artifacts={artifacts} />
              ) : (
                <>
                  <PhaseProgress
                    currentPhase={session.phase}
                    sessionStatus={session.status}
                    budget={session.budget}
                    budgetLimits={session.config.budget}
                    completedPhases={completedPhases}
                    onRunPhase={handleRunPhase}
                    onSkipPhase={handleSkipPhase}
                    isRunning={isRunning}
                  />
                  {/* Tab bar */}
                  <div className="flex gap-0.5 px-2 py-1 border-b border-border/50 bg-muted/20 shrink-0">
                    {(["chat", "requirements", "reviewers", "execution"] as TabView[]).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-2 py-1 text-[11px] rounded transition-colors ${
                          activeTab === tab
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        {tab === "chat" ? "Chat" : tab === "requirements" ? "Requirements" : tab === "reviewers" ? "Reviewers" : "Execution"}
                      </button>
                    ))}
                  </div>
                  {/* Tab content */}
                  <div className="flex-1 min-h-0">
                    {activeTab === "chat" && (
                      <ResearchChat
                        session={session}
                        messages={messages}
                        nodes={nodes}
                        artifacts={artifacts}
                        onSendMessage={handleSendMessage}
                        onApprove={handleApprove}
                        onConfirm={handleConfirm}
                      />
                    )}
                    {activeTab === "requirements" && (
                      <RequirementPanel requirementState={requirementState} />
                    )}
                    {activeTab === "reviewers" && (
                      <ReviewerBattlePanel battleResult={battleResult} />
                    )}
                    {activeTab === "execution" && (
                      <ExecutionStatusPanel
                        executions={executions}
                        workspaceId={workspaceId}
                        sessionId={activeSessionId!}
                        remoteProfileId={session.remoteProfileId}
                        onBindProfile={handleBindProfile}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right: Workflow graph */}
          <ResizablePanel defaultSize={55} minSize={25}>
            <WorkflowGraph nodes={nodes} onNodeSelect={handleNodeSelect} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Node detail drawer */}
      <NodeDetailDrawer
        node={selectedNode}
        artifacts={artifacts}
        events={events}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onApprove={handleApprove}
      />

      {/* Delete dialog for active session */}
      <DeleteSessionDialog
        sessionId={session.id}
        sessionTitle={session.title}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onDeleted={handleActiveSessionDeleted}
      />
    </div>
  );
}
