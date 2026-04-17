"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  useDeepResearchSessions,
  useDeepResearchSession,
  useDeepResearchMessages,
  useDeepResearchNodes,
  useDeepResearchArtifacts,
  useDeepResearchEvents,
} from "@/lib/hooks/use-deep-research";
import { SessionList } from "./session-list";
import { IntakeScreen } from "./intake-screen";
import { ResearchChat } from "./research-chat";
import { FinalReportView } from "./final-report-view";
import { WorkflowGraph } from "./workflow-graph";
import { NodeDetailDrawer } from "./node-detail-drawer";
import { DeleteSessionDialog } from "./delete-session-dialog";
import { RoleStudioPanel } from "./role-studio-panel";
import type { ConfirmationOutcome } from "@/lib/deep-research/types";
import {
  canStartSession,
  isAwaitingConfirmationSessionStatus,
  isCompletedSessionStatus,
} from "@/lib/deep-research/session-status";

type PanelView = "list" | "intake" | "session";
type TabView = "chat" | "roadmap" | "roles";
type SessionMessageOptions = {
  relatedNodeId?: string;
  metadata?: Record<string, unknown>;
  relatedArtifactIds?: string[];
};

interface DeepResearchPanelProps {
  workspaceId: string;
}

const TAB_LABELS: Record<TabView, string> = {
  chat: "Chat",
  roadmap: "Roadmap",
  roles: "Roles",
};

const TAB_ORDER = Object.keys(TAB_LABELS) as TabView[];

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => null);
  return (data && typeof data.error === "string" && data.error) || fallback;
}

export function DeepResearchPanel({
  workspaceId,
}: DeepResearchPanelProps) {
  const [view, setView] = useState<PanelView>("list");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabView>("chat");

  const { sessions, mutate: mutateSessions } = useDeepResearchSessions(workspaceId);
  const { session, mutate: mutateSession } = useDeepResearchSession(activeSessionId ?? undefined);
  const { messages, mutate: mutateMessages } = useDeepResearchMessages(activeSessionId ?? undefined);
  const { nodes, mutate: mutateNodes } = useDeepResearchNodes(activeSessionId ?? undefined);
  const { artifacts, mutate: mutateArtifacts } = useDeepResearchArtifacts(activeSessionId ?? undefined);
  const { events } = useDeepResearchEvents(activeSessionId ?? undefined);
  const activeSessionPath = activeSessionId ? `/api/deep-research/sessions/${activeSessionId}` : null;

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const isInterfaceOnly = session?.config.interfaceOnly === true;
  const refreshActiveSessionResources = useCallback(async () => {
    await Promise.all([
      mutateSession(),
      mutateMessages(),
      mutateNodes(),
      mutateArtifacts(),
    ]);
  }, [mutateArtifacts, mutateMessages, mutateNodes, mutateSession]);
  const resetSessionChrome = useCallback(() => {
    setSelectedNodeId(null);
    setDrawerOpen(false);
  }, []);
  const resetToSessionList = useCallback(() => {
    setActiveSessionId(null);
    setView("list");
    resetSessionChrome();
  }, [resetSessionChrome]);

  const runSessionRequest = useCallback(
    async <T,>(
      pathSuffix: string,
      init: RequestInit,
      fallbackError: string,
    ): Promise<T | null> => {
      if (!activeSessionPath) {
        return null;
      }

      try {
        const response = await fetch(`${activeSessionPath}${pathSuffix}`, init);
        if (!response.ok) {
          throw new Error(await readErrorMessage(response, fallbackError));
        }
        return response.status === 204 ? null : ((await response.json().catch(() => null)) as T | null);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : fallbackError);
        return null;
      }
    },
    [activeSessionPath],
  );

  // --- Navigation ---

  const handleOpenSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setView("session");
    resetSessionChrome();
  }, [resetSessionChrome]);

  const handleBackToList = useCallback(() => {
    resetToSessionList();
  }, [resetToSessionList]);

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
      if (activeSessionId === deletedId) {
        resetToSessionList();
      }
    },
    [activeSessionId, mutateSessions, resetToSessionList]
  );

  const handleDeleteActiveSession = useCallback(() => {
    setDeleteDialogOpen(true);
  }, []);

  const handleActiveSessionDeleted = useCallback(() => {
    mutateSessions();
    resetToSessionList();
    setDeleteDialogOpen(false);
  }, [mutateSessions, resetToSessionList]);

  // --- Session actions ---

  const handleSendMessage = useCallback(
    async (content: string, options?: SessionMessageOptions) => {
      const response = await runSessionRequest<{ message: unknown; reply: unknown; autoAction: unknown }>(
        "/message",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            relatedNodeId: options?.relatedNodeId,
            metadata: options?.metadata,
            relatedArtifactIds: options?.relatedArtifactIds,
          }),
        },
        "Failed to send message",
      );
      if (response) {
        await refreshActiveSessionResources();
      }
    },
    [refreshActiveSessionResources, runSessionRequest],
  );

  const handleApprove = useCallback(
    async (nodeId: string, approved: boolean, feedback?: string) => {
      const response = await runSessionRequest<{ success: boolean; message?: string; applied?: boolean }>(
        "/approve",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodeId, approved, feedback }),
        },
        "Failed to process approval",
      );
      if (response) {
        await refreshActiveSessionResources();
        if (response.message) {
          toast(response.message);
        }
      }
    },
    [refreshActiveSessionResources, runSessionRequest],
  );

  const handleConfirm = useCallback(
    async (nodeId: string, outcome: ConfirmationOutcome, feedback?: string) => {
      const response = await runSessionRequest<{ started: boolean; running: boolean; message?: string; applied?: boolean }>(
        "/confirm",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodeId, outcome, feedback }),
        },
        "Failed to process confirmation",
      );
      if (response) {
        await refreshActiveSessionResources();

        window.setTimeout(() => {
          void refreshActiveSessionResources();
        }, 800);

        window.setTimeout(() => {
          void refreshActiveSessionResources();
        }, 2200);

        if (response.message) {
          toast(response.message);
          return;
        }
        toast.success(
          outcome === "confirmed"
            ? "Confirmed — continuing research"
            : outcome === "stopped"
              ? "Research stopped"
              : `Feedback sent: ${outcome.replace("_", " ")}`
        );
      }
    },
    [refreshActiveSessionResources, runSessionRequest],
  );

  const handleStartRun = useCallback(async () => {
    const response = await runSessionRequest<{ started: boolean; running: boolean; disabled?: boolean; message?: string }>(
      "/run",
      { method: "POST" },
      "Failed to start research",
    );
    if (response) {
      await refreshActiveSessionResources();
      if (response.disabled) {
        toast(response.message ?? "Deep Research is running in interface-only mode.");
        return;
      }
      toast.success("Research started");
    }
  }, [refreshActiveSessionResources, runSessionRequest]);

  const handleNodeSelect = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setDrawerOpen(true);
  }, []);

  const handleRoleNodeSelect = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, []);

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

  const isAwaitingConfirmation = isAwaitingConfirmationSessionStatus(session.status);
  const isCompleted = isCompletedSessionStatus(session.status);
  const isFailed = session.status === "failed";
  const isLiteratureBlocked = session.status === "literature_blocked";
  const isStopped = session.status === "stopped_by_user";
  const canStart = canStartSession(session.status);

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

        {isInterfaceOnly && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            Interface shell only
          </div>
        )}

        {!isInterfaceOnly && canStart && !isFailed && (
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

        {!isInterfaceOnly && isFailed && (
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
        <div className="flex h-full flex-col">
          {isCompleted ? (
            <FinalReportView session={session} artifacts={artifacts} />
          ) : (
            <>
              <div className="flex gap-0.5 px-2 py-1 border-b border-border/50 bg-muted/20 shrink-0">
                {TAB_ORDER.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-2 py-1 text-[11px] rounded transition-colors ${
                      activeTab === tab
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {TAB_LABELS[tab]}
                  </button>
                ))}
              </div>
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
                {activeTab === "roadmap" && (
                  <WorkflowGraph nodes={nodes} onNodeSelect={handleNodeSelect} />
                )}
                {activeTab === "roles" && (
                  <RoleStudioPanel
                    nodes={nodes}
                    artifacts={artifacts}
                    selectedNode={selectedNode}
                    resolvedModel={session.config.resolvedModel ?? null}
                    modelOverrides={session.config.modelOverrides ?? null}
                    onSelectRoleNode={handleRoleNodeSelect}
                    onSendMessage={handleSendMessage}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Node detail drawer */}
      <NodeDetailDrawer
        node={selectedNode}
        messages={messages}
        artifacts={artifacts}
        events={events}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onApprove={handleApprove}
        onSendMessage={handleSendMessage}
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
