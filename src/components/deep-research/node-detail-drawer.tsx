"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArtifactViewer } from "./artifact-viewer";
import { Bot, CheckCircle, Clock, Loader2, Send, User, XCircle, Zap } from "lucide-react";
import {
  buildNodeTranscriptMetadata,
  getNodeTranscriptKind,
  hasNodeTranscriptKind,
  serializeTranscriptPayload,
  type NodeTranscriptKind,
} from "@/lib/deep-research/node-transcript";
import { getNodeDisplayLabel, getStructuredRoleDisplayName } from "@/lib/deep-research/role-registry";
import type {
  DeepResearchMessage,
  DeepResearchNode,
  DeepResearchArtifact,
  DeepResearchEvent,
} from "@/lib/deep-research/types";

interface NodeDetailDrawerProps {
  node: DeepResearchNode | null;
  messages: DeepResearchMessage[];
  artifacts: DeepResearchArtifact[];
  events: DeepResearchEvent[];
  open: boolean;
  onClose: () => void;
  onApprove?: (nodeId: string, approved: boolean, feedback?: string) => Promise<void>;
  onSendMessage?: (
    content: string,
    options?: {
      relatedNodeId?: string;
      metadata?: Record<string, unknown>;
      relatedArtifactIds?: string[];
    },
  ) => Promise<void>;
}

type TranscriptEntry = {
  id: string;
  kind: NodeTranscriptKind;
  content: string;
  createdAt: string;
  relatedArtifactIds: string[];
  synthetic: boolean;
};

const STATUS_BADGES: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; label: string }> = {
  pending: { variant: "secondary", label: "Pending" },
  queued: { variant: "secondary", label: "Queued" },
  running: { variant: "default", label: "Running" },
  completed: { variant: "default", label: "Completed" },
  failed: { variant: "destructive", label: "Failed" },
  skipped: { variant: "secondary", label: "Skipped" },
  awaiting_approval: { variant: "outline", label: "Awaiting Approval" },
  awaiting_user_confirmation: { variant: "outline", label: "Awaiting Confirmation" },
  superseded: { variant: "secondary", label: "Superseded" },
};

function inferTranscriptKind(message: DeepResearchMessage): NodeTranscriptKind {
  const explicitKind = getNodeTranscriptKind(message);
  if (explicitKind) {
    return explicitKind;
  }
  if (message.role === "user") {
    return "input";
  }
  if (message.role === "main_brain") {
    return "output";
  }
  return "status";
}

function buildTranscriptEntries(
  node: DeepResearchNode,
  nodeMessages: DeepResearchMessage[],
): TranscriptEntry[] {
  const entries: TranscriptEntry[] = nodeMessages.map((message) => ({
    id: message.id,
    kind: inferTranscriptKind(message),
    content: message.content,
    createdAt: message.createdAt,
    relatedArtifactIds: message.relatedArtifactIds,
    synthetic: false,
  }));

  if (node.input && !hasNodeTranscriptKind(nodeMessages, "input")) {
    entries.push({
      id: `${node.id}-input`,
      kind: "input",
      content: serializeTranscriptPayload(node.input),
      createdAt: node.createdAt,
      relatedArtifactIds: [],
      synthetic: true,
    });
  }

  if (node.output && !hasNodeTranscriptKind(nodeMessages, "output")) {
    entries.push({
      id: `${node.id}-output`,
      kind: "output",
      content: serializeTranscriptPayload(node.output),
      createdAt: node.completedAt ?? node.updatedAt,
      relatedArtifactIds: [],
      synthetic: true,
    });
  }

  if (node.error && !hasNodeTranscriptKind(nodeMessages, "error")) {
    entries.push({
      id: `${node.id}-error`,
      kind: "error",
      content: node.error,
      createdAt: node.completedAt ?? node.updatedAt,
      relatedArtifactIds: [],
      synthetic: true,
    });
  }

  if (
    node.status === "running"
    && !hasNodeTranscriptKind(nodeMessages, "status")
  ) {
    entries.push({
      id: `${node.id}-running`,
      kind: "status",
      content: `Agent is running ${node.nodeType}.`,
      createdAt: node.startedAt ?? node.updatedAt,
      relatedArtifactIds: [],
      synthetic: true,
    });
  }

  return entries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function DrawerSection({
  title,
  children,
  titleClassName = "text-xs font-semibold uppercase text-muted-foreground",
}: {
  title: string;
  children: React.ReactNode;
  titleClassName?: string;
}) {
  return (
    <div className="space-y-1">
      <h4 className={titleClassName}>{title}</h4>
      {children}
    </div>
  );
}

function DrawerEmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-8 text-center text-xs text-muted-foreground">
      {children}
    </div>
  );
}

function TranscriptBubble({
  entry,
  artifactLabels,
  actorLabel,
}: {
  entry: TranscriptEntry;
  artifactLabels: string[];
  actorLabel: string;
}) {
  if (entry.kind === "status") {
    return (
      <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
        <Badge variant="outline" className="text-[9px] uppercase">
          Status
        </Badge>
        <span>{entry.content}</span>
      </div>
    );
  }

  const isInput = entry.kind === "input";
  const isError = entry.kind === "error";

  return (
    <div className={`flex gap-2 ${isInput ? "justify-end" : "justify-start"}`}>
      {isInput && (
        <div className="order-2 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <User className="h-3.5 w-3.5" />
        </div>
      )}
      {!isInput && (
        <div className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isError ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"}`}>
          {isError ? <XCircle className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
        </div>
      )}
      <div className={`max-w-[88%] space-y-1 ${isInput ? "order-1" : ""}`}>
        <div
          className={`rounded-lg border px-3 py-2 ${
            isInput
              ? "border-primary/20 bg-primary text-primary-foreground"
              : isError
                ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
                : "border-border bg-muted"
          }`}
        >
          <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wide opacity-80">
            <span>{isInput ? "Human" : isError ? "Error" : actorLabel}</span>
            {entry.synthetic && <span>Snapshot</span>}
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[11px] font-mono">
            {entry.content}
          </pre>
        </div>
        {(artifactLabels.length > 0 || entry.createdAt) && (
          <div className={`flex flex-wrap items-center gap-1 px-1 text-[10px] text-muted-foreground ${isInput ? "justify-end" : "justify-start"}`}>
            <span>{new Date(entry.createdAt).toLocaleTimeString()}</span>
            {artifactLabels.map((label) => (
              <Badge key={`${entry.id}-${label}`} variant="outline" className="text-[9px]">
                {label}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function NodeDetailDrawer({
  node,
  messages,
  artifacts,
  events,
  open,
  onClose,
  onApprove,
  onSendMessage,
}: NodeDetailDrawerProps) {
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const nodeArtifacts = useMemo(
    () => (node ? artifacts.filter((artifact) => artifact.nodeId === node.id) : []),
    [artifacts, node],
  );
  const nodeEvents = useMemo(
    () => (node ? events.filter((event) => event.nodeId === node.id) : []),
    [events, node],
  );
  const nodeMessages = useMemo(
    () => (node ? messages.filter((message) => message.relatedNodeId === node.id) : []),
    [messages, node],
  );
  const transcriptEntries = useMemo(
    () => (node ? buildTranscriptEntries(node, nodeMessages) : []),
    [node, nodeMessages],
  );
  const artifactTypeById = useMemo(
    () => new Map(nodeArtifacts.map((artifact) => [artifact.id, artifact.artifactType])),
    [nodeArtifacts],
  );

  useEffect(() => {
    if (open && transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [open, transcriptEntries.length]);

  useEffect(() => {
    setDraft("");
    setSending(false);
  }, [node?.id, open]);

  if (!node) return null;

  const statusInfo = STATUS_BADGES[node.status] || STATUS_BADGES.pending;
  const actorLabel = getStructuredRoleDisplayName(node.assignedRole, node.nodeType);
  const canSendMessage = Boolean(onSendMessage);

  const handleSendTranscriptMessage = async () => {
    const content = draft.trim();
    if (!content || !onSendMessage || sending) {
      return;
    }

    setSending(true);
    try {
      await onSendMessage(content, {
        relatedNodeId: node.id,
        metadata: buildNodeTranscriptMetadata(node, "input", {
          source: "node_detail_drawer_user",
        }),
      });
      setDraft("");
    } finally {
      setSending(false);
    }
  };

  const handleDraftKeyDown = async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      await handleSendTranscriptMessage();
    }
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="w-[500px] sm:w-[620px] border-l-2 p-0 shadow-[-18px_0_48px_rgba(15,23,42,0.14)]">
        <SheetHeader className="px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-sm flex-1 truncate">{getNodeDisplayLabel(node.label)}</SheetTitle>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{node.nodeType}</span>
            <span>&middot;</span>
            <span>{getStructuredRoleDisplayName(node.assignedRole, node.nodeType)}</span>
            {node.assignedModel && (
              <>
                <span>&middot;</span>
                <span>{node.assignedModel}</span>
              </>
            )}
          </div>
        </SheetHeader>

        {/* Approval buttons */}
        {node.status === "awaiting_approval" && onApprove && (
          <div className="px-4 py-2 border-b bg-yellow-50 dark:bg-yellow-950 flex items-center gap-2">
            <Button
              size="sm"
              className="h-7 px-3 text-xs gap-1"
              onClick={() => onApprove(node.id, true)}
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-3 text-xs gap-1 text-red-600"
              onClick={() => onApprove(node.id, false)}
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject
            </Button>
          </div>
        )}

        <Tabs key={node.id} defaultValue="conversation" className="flex-1">
          <TabsList className="w-full justify-start rounded-none border-b px-4">
            <TabsTrigger value="conversation" className="text-xs">
              Conversation ({transcriptEntries.length})
            </TabsTrigger>
            <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
            <TabsTrigger value="artifacts" className="text-xs">
              Artifacts ({nodeArtifacts.length})
            </TabsTrigger>
            <TabsTrigger value="events" className="text-xs">
              Events ({nodeEvents.length})
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[calc(100vh-260px)]" ref={transcriptRef}>
            <TabsContent value="conversation" className="px-4 py-3 mt-0">
              <div className="space-y-3">
                {transcriptEntries.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                    No agent transcript for this node yet
                  </div>
                ) : (
                  transcriptEntries.map((entry) => {
                    const artifactLabels = entry.relatedArtifactIds.flatMap((artifactId) => {
                      const artifactType = artifactTypeById.get(artifactId);
                      return artifactType ? [artifactType] : [];
                    });

                    return (
                      <TranscriptBubble
                        key={entry.id}
                        entry={entry}
                        artifactLabels={artifactLabels}
                        actorLabel={actorLabel}
                      />
                    );
                  })
                )}
                {node.status === "running" && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Live updates are polling while this agent is running.</span>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="details" className="px-4 py-3 space-y-4 mt-0">
              {/* Timing */}
              <DrawerSection title="Timing" titleClassName="text-xs font-semibold uppercase text-muted-foreground">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Created:</span>
                    <span>{new Date(node.createdAt).toLocaleTimeString()}</span>
                  </div>
                  {node.startedAt && (
                    <div className="flex items-center gap-1">
                      <Zap className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Started:</span>
                      <span>{new Date(node.startedAt).toLocaleTimeString()}</span>
                    </div>
                  )}
                  {node.completedAt && (
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Completed:</span>
                      <span>{new Date(node.completedAt).toLocaleTimeString()}</span>
                    </div>
                  )}
                </div>
              </DrawerSection>

              {/* Dependencies */}
              {node.dependsOn.length > 0 && (
                <DrawerSection title="Depends On">
                  <div className="flex flex-wrap gap-1">
                    {node.dependsOn.map((id) => (
                      <Badge key={id} variant="outline" className="text-[10px] font-mono">
                        {id.slice(0, 8)}
                      </Badge>
                    ))}
                  </div>
                </DrawerSection>
              )}

              {/* Retry info */}
              {node.retryCount > 0 && (
                <DrawerSection title="Retry Info">
                  <div className="text-xs">Attempt #{node.retryCount + 1}</div>
                </DrawerSection>
              )}

              {/* Error */}
              {node.error && (
                <DrawerSection title="Error" titleClassName="text-xs font-semibold uppercase text-red-600">
                  <pre className="text-xs bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200 p-2 rounded">
                    {node.error}
                  </pre>
                </DrawerSection>
              )}
            </TabsContent>

            <TabsContent value="artifacts" className="px-4 py-3 space-y-4 mt-0">
              {nodeArtifacts.length === 0 ? (
                <DrawerEmptyState>No artifacts for this node</DrawerEmptyState>
              ) : (
                nodeArtifacts.map((artifact) => (
                  <div key={artifact.id} className="border rounded-lg p-3">
                    <ArtifactViewer artifact={artifact} />
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="events" className="px-4 py-3 mt-0">
              {nodeEvents.length === 0 ? (
                <DrawerEmptyState>No events for this node</DrawerEmptyState>
              ) : (
                <div className="space-y-2">
                  {nodeEvents.map((event) => (
                    <div key={event.id} className="flex items-start gap-2 text-xs">
                      <span className="text-muted-foreground shrink-0 font-mono">
                        {new Date(event.createdAt).toLocaleTimeString()}
                      </span>
                      <Badge variant="outline" className="text-[9px] shrink-0">
                        {event.eventType}
                      </Badge>
                      {event.payload && (
                        <span className="text-muted-foreground truncate">
                          {JSON.stringify(event.payload).slice(0, 80)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
        <div className="border-t bg-background/95 px-4 py-3">
          <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Send a node-scoped message into this transcript.</span>
            <span>{canSendMessage ? "Cmd/Ctrl+Enter to send" : "Messaging unavailable"}</span>
          </div>
          <div className="flex items-end gap-2">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleDraftKeyDown}
              placeholder={`Message ${getNodeDisplayLabel(node.label)}...`}
              className="min-h-[84px] resize-none text-xs"
              disabled={!canSendMessage || sending}
            />
            <Button
              type="button"
              size="sm"
              className="h-9 shrink-0 gap-1.5"
              disabled={!canSendMessage || sending || draft.trim().length === 0}
              onClick={() => void handleSendTranscriptMessage()}
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              <span className="text-xs">Send</span>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
