"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArtifactViewer } from "./artifact-viewer";
import { CheckCircle, XCircle, Clock, Zap } from "lucide-react";
import type {
  DeepResearchNode,
  DeepResearchArtifact,
  DeepResearchEvent,
} from "@/lib/deep-research/types";

interface NodeDetailDrawerProps {
  node: DeepResearchNode | null;
  artifacts: DeepResearchArtifact[];
  events: DeepResearchEvent[];
  open: boolean;
  onClose: () => void;
  onApprove?: (nodeId: string, approved: boolean, feedback?: string) => Promise<void>;
}

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

export function NodeDetailDrawer({
  node,
  artifacts,
  events,
  open,
  onClose,
  onApprove,
}: NodeDetailDrawerProps) {
  if (!node) return null;

  const nodeArtifacts = artifacts.filter((a) => a.nodeId === node.id);
  const nodeEvents = events.filter((e) => e.nodeId === node.id);
  const statusInfo = STATUS_BADGES[node.status] || STATUS_BADGES.pending;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="w-[450px] sm:w-[500px] p-0">
        <SheetHeader className="px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-sm flex-1 truncate">{node.label}</SheetTitle>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{node.nodeType}</span>
            <span>&middot;</span>
            <span>{node.assignedRole}</span>
            {node.phase && (
              <>
                <span>&middot;</span>
                <Badge variant="outline" className="text-[9px]">{node.phase}</Badge>
              </>
            )}
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

        <Tabs defaultValue="overview" className="flex-1">
          <TabsList className="w-full justify-start rounded-none border-b px-4">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="artifacts" className="text-xs">
              Artifacts ({nodeArtifacts.length})
            </TabsTrigger>
            <TabsTrigger value="events" className="text-xs">
              Events ({nodeEvents.length})
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[calc(100vh-180px)]">
            <TabsContent value="overview" className="px-4 py-3 space-y-4 mt-0">
              {/* Timing */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">Timing</h4>
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
              </div>

              {/* Dependencies */}
              {node.dependsOn.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">Depends On</h4>
                  <div className="flex flex-wrap gap-1">
                    {node.dependsOn.map((id) => (
                      <Badge key={id} variant="outline" className="text-[10px] font-mono">
                        {id.slice(0, 8)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Retry info */}
              {node.retryCount > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">Retry Info</h4>
                  <div className="text-xs">Attempt #{node.retryCount + 1}</div>
                </div>
              )}

              {/* Input */}
              {node.input && (
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">Input</h4>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-[200px]">
                    {JSON.stringify(node.input, null, 2)}
                  </pre>
                </div>
              )}

              {/* Output */}
              {node.output && (
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">Output</h4>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-[200px]">
                    {JSON.stringify(node.output, null, 2)}
                  </pre>
                </div>
              )}

              {/* Error */}
              {node.error && (
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase text-red-600">Error</h4>
                  <pre className="text-xs bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200 p-2 rounded">
                    {node.error}
                  </pre>
                </div>
              )}
            </TabsContent>

            <TabsContent value="artifacts" className="px-4 py-3 space-y-4 mt-0">
              {nodeArtifacts.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-8">
                  No artifacts for this node
                </div>
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
                <div className="text-xs text-muted-foreground text-center py-8">
                  No events for this node
                </div>
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
      </SheetContent>
    </Sheet>
  );
}
