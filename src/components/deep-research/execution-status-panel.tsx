"use client";

import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  ExternalLink,
  Server,
  Plus,
  Pencil,
  Unlink,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { useRemoteProfiles } from "@/lib/hooks/use-remote-profiles";
import { RemoteProfileForm } from "@/components/research-exec/remote-profile-form";
import type { PersistedExecutionRecord } from "@/lib/deep-research/types";
import type { RemoteExecutionProfile, RJobProfileConfig } from "@/lib/research-exec/types";

interface ExecutionStatusPanelProps {
  executions: PersistedExecutionRecord[];
  workspaceId: string;
  sessionId: string;
  remoteProfileId: string | null;
  onBindProfile: (profileId: string | null) => void;
}

function rjobSummary(jsonStr: string | null | undefined): string | null {
  if (!jsonStr) return null;
  try {
    const cfg = JSON.parse(jsonStr) as RJobProfileConfig;
    const parts: string[] = [];
    if (cfg.defaultGpu) parts.push(`${cfg.defaultGpu} GPU`);
    if (cfg.defaultCpu) parts.push(`${cfg.defaultCpu} CPU`);
    if (cfg.defaultMemoryMb) parts.push(`${Math.round(cfg.defaultMemoryMb / 1024)}GB`);
    if (cfg.image) {
      const short = cfg.image.split("/").pop() ?? cfg.image;
      parts.push(short.length > 30 ? short.slice(0, 27) + "..." : short);
    }
    return parts.length > 0 ? parts.join(" | ") : null;
  } catch {
    return null;
  }
}

export function ExecutionStatusPanel({
  executions,
  workspaceId,
  sessionId,
  remoteProfileId,
  onBindProfile,
}: ExecutionStatusPanelProps) {
  const { profiles, mutate: mutateProfiles } = useRemoteProfiles(workspaceId);
  const [showForm, setShowForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<RemoteExecutionProfile | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);

  const boundProfile = profiles.find((p) => p.id === remoteProfileId) ?? null;

  const handleSelectProfile = useCallback(
    (profileId: string) => {
      onBindProfile(profileId);
    },
    [onBindProfile],
  );

  const handleUnbind = useCallback(() => {
    onBindProfile(null);
  }, [onBindProfile]);

  const handleProfileCreated = useCallback(() => {
    mutateProfiles();
    setShowForm(false);
    setEditingProfile(null);
  }, [mutateProfiles]);

  const handleTestConnection = useCallback(async () => {
    if (!boundProfile) return;
    setTestingConnection(true);
    try {
      const res = await fetch("/api/research-exec/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: boundProfile.id }),
      });
      const data = await res.json();
      if (data.connected) {
        toast.success(`Connected to ${boundProfile.host}`);
      } else {
        toast.error(`Connection failed: ${data.message || "Unknown error"}`);
      }
    } catch {
      toast.error("Failed to test connection");
    } finally {
      setTestingConnection(false);
    }
  }, [boundProfile]);

  // --- Status helpers ---
  const statusIcon = (status: string) => {
    switch (status) {
      case "running":
        return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin shrink-0" />;
      case "completed":
        return <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />;
      case "failed":
        return <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
      case "submitted":
        return <Play className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
      case "cancelled":
        return <XCircle className="h-3.5 w-3.5 text-gray-400 shrink-0" />;
      default:
        return <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "running": return "text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-950/30";
      case "completed": return "text-green-600 border-green-300 bg-green-50 dark:bg-green-950/30";
      case "failed": return "text-red-600 border-red-300 bg-red-50 dark:bg-red-950/30";
      case "submitted": return "text-blue-600 border-blue-300";
      default: return "text-gray-600 border-gray-300";
    }
  };

  const activeCount = executions.filter((e) =>
    ["pending", "submitted", "running"].includes(e.status),
  ).length;

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-3">
        {/* ============== Remote Target Section ============== */}
        <div className="space-y-2 rounded-lg border p-3 bg-muted/20">
          <div className="flex items-center gap-2">
            <Server className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold">Remote Target</span>
          </div>

          {/* Profile selector */}
          {!showForm && !editingProfile && (
            <div className="flex items-center gap-2">
              <Select
                value={remoteProfileId ?? ""}
                onValueChange={handleSelectProfile}
              >
                <SelectTrigger className="h-7 flex-1 text-xs">
                  <SelectValue placeholder="Select a remote profile..." />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.name} ({p.username}@{p.host})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 gap-1"
                onClick={() => {
                  setShowForm(true);
                  setEditingProfile(null);
                }}
              >
                <Plus className="h-3 w-3" />
                <span className="text-xs">New</span>
              </Button>
            </div>
          )}

          {/* Bound profile details */}
          {boundProfile && !showForm && !editingProfile && (
            <div className="space-y-1.5 rounded-md border p-2 bg-background">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium truncate">{boundProfile.name}</span>
                <Badge variant="outline" className="text-[10px]">
                  {boundProfile.schedulerType}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {boundProfile.username}@{boundProfile.host}:{boundProfile.port} &rarr; {boundProfile.remotePath}
              </p>
              {boundProfile.schedulerType === "rjob" && (() => {
                const summary = rjobSummary(boundProfile.rjobConfigJson);
                return summary ? (
                  <p className="text-[10px] text-muted-foreground/70 truncate">{summary}</p>
                ) : null;
              })()}
              <div className="flex gap-1.5 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 gap-1 text-[10px]"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                >
                  {testingConnection ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Wifi className="h-3 w-3" />
                  )}
                  Test
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 gap-1 text-[10px]"
                  onClick={() => setEditingProfile(boundProfile)}
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 gap-1 text-[10px] text-destructive"
                  onClick={handleUnbind}
                >
                  <Unlink className="h-3 w-3" />
                  Unbind
                </Button>
              </div>
            </div>
          )}

          {/* No profile bound placeholder */}
          {!boundProfile && !showForm && !editingProfile && (
            <p className="text-[11px] text-muted-foreground">
              No remote target configured. Select an existing profile or create a new one.
            </p>
          )}

          {/* Inline profile form */}
          {(showForm || editingProfile) && (
            <div className="pt-1">
              <RemoteProfileForm
                workspaceId={workspaceId}
                editProfile={editingProfile}
                onCreated={handleProfileCreated}
                onCancelEdit={() => {
                  setShowForm(false);
                  setEditingProfile(null);
                }}
              />
            </div>
          )}
        </div>

        {/* ============== Execution Records Section ============== */}
        {executions.length === 0 ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            No execution records yet. They will appear during the experiment execution phase.
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">
                {executions.length} execution record{executions.length !== 1 ? "s" : ""}
              </span>
              {activeCount > 0 && (
                <div className="flex items-center gap-1 text-xs text-blue-600">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {activeCount} active
                </div>
              )}
            </div>

            {/* Records list */}
            {executions.map((exec) => (
              <div key={exec.id} className="border rounded p-2.5 space-y-1.5">
                <div className="flex items-center gap-2">
                  {statusIcon(exec.status)}
                  <Badge variant="outline" className={`text-[10px] ${statusColor(exec.status)}`}>
                    {exec.status}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {exec.recordType}
                  </Badge>
                  {exec.remoteJobId && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <ExternalLink className="h-2.5 w-2.5" />
                      {exec.remoteJobId}
                    </span>
                  )}
                </div>

                {/* Command */}
                {exec.command && (
                  <div className="p-1.5 bg-muted rounded font-mono text-[10px] leading-relaxed overflow-x-auto max-h-[60px]">
                    {exec.command.slice(0, 200)}
                    {exec.command.length > 200 && "..."}
                  </div>
                )}

                {/* Timestamps */}
                <div className="flex gap-3 text-[10px] text-muted-foreground">
                  {exec.submittedAt && (
                    <span>Submitted: {new Date(exec.submittedAt).toLocaleTimeString()}</span>
                  )}
                  {exec.startedAt && (
                    <span>Started: {new Date(exec.startedAt).toLocaleTimeString()}</span>
                  )}
                  {exec.completedAt && (
                    <span>Completed: {new Date(exec.completedAt).toLocaleTimeString()}</span>
                  )}
                </div>

                {/* Result summary */}
                {exec.resultJson && (
                  <div className="text-[10px] text-muted-foreground p-1.5 bg-green-50 dark:bg-green-950/30 rounded">
                    Result: {JSON.stringify(exec.resultJson).slice(0, 150)}
                    {JSON.stringify(exec.resultJson).length > 150 && "..."}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </ScrollArea>
  );
}
