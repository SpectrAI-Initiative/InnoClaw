"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  RefreshCw,
  Server,
  Activity,
  History,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Container,
  Cpu,
} from "lucide-react";
import {
  useClusterStatus,
  useClusterOperations,
} from "@/lib/hooks/use-cluster";
import type {
  ClusterNode,
  ClusterJob,
  ClusterPod,
  ClusterOperation,
} from "@/lib/hooks/use-cluster";

interface ClusterPanelProps {
  workspaceId?: string;
}

// ---- Sub-components ----

function NodeCard({ node }: { node: ClusterNode }) {
  const t = useTranslations("cluster");
  return (
    <div className="rounded-lg border bg-card p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium truncate">{node.name}</span>
        <Badge
          variant={node.ready ? "default" : "destructive"}
          className={
            node.ready
              ? "border-green-500/20 bg-green-500/15 text-green-700 dark:text-green-400"
              : ""
          }
        >
          {node.ready ? t("ready") : t("notReady")}
        </Badge>
      </div>
      <div className="flex gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Cpu className="h-3 w-3" /> {node.cpu}
        </span>
        <span>{node.memory}</span>
        {node.gpu !== "0" && (
          <span className="text-amber-600 dark:text-amber-400">
            GPU: {node.gpu}
          </span>
        )}
      </div>
      {node.roles.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {node.roles.map((r) => (
            <Badge key={r} variant="secondary" className="text-[10px] px-1.5 py-0">
              {r}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function JobRow({ job }: { job: ClusterJob }) {
  const t = useTranslations("cluster");
  const statusColor =
    job.failed > 0
      ? "text-red-600 dark:text-red-400"
      : job.succeeded > 0
        ? "text-green-600 dark:text-green-400"
        : "text-yellow-600 dark:text-yellow-400";

  return (
    <div className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
      <Container className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate font-medium">{job.name}</span>
      <Badge variant="outline" className="text-[10px] shrink-0">
        {job.namespace}
      </Badge>
      <span className="ml-auto shrink-0 flex gap-2">
        {job.active > 0 && (
          <span className="text-yellow-600 dark:text-yellow-400">
            {t("active")}: {job.active}
          </span>
        )}
        <span className={statusColor}>
          ✓{job.succeeded} ✗{job.failed}
        </span>
      </span>
    </div>
  );
}

function PodRow({ pod }: { pod: ClusterPod }) {
  const phaseColor =
    pod.phase === "Running"
      ? "text-green-600 dark:text-green-400"
      : pod.phase === "Pending"
        ? "text-yellow-600 dark:text-yellow-400"
        : pod.phase === "Failed"
          ? "text-red-600 dark:text-red-400"
          : "text-muted-foreground";

  return (
    <div className="flex items-center gap-2 rounded border px-3 py-1.5 text-xs">
      <span className="truncate flex-1">{pod.name}</span>
      <Badge variant="outline" className="text-[10px]">{pod.namespace}</Badge>
      <span className={`shrink-0 font-medium ${phaseColor}`}>{pod.phase}</span>
    </div>
  );
}

function OperationRow({ op }: { op: ClusterOperation }) {
  const t = useTranslations("cluster");
  const statusIcon =
    op.status === "success" ? (
      <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
    ) : op.status === "blocked" ? (
      <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
    ) : (
      <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
    );

  const label =
    op.toolName === "kubectl"
      ? op.subcommand ?? "kubectl"
      : op.toolName === "submitK8sJob"
        ? `${t("submitJob")} ${op.jobName ?? ""}`
        : op.toolName === "collectJobResults"
          ? `${t("collectResults")} ${op.jobName ?? ""}`
          : op.toolName;

  return (
    <div className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
      {statusIcon}
      <span className="truncate flex-1">{label}</span>
      {op.namespace && (
        <Badge variant="outline" className="text-[10px]">{op.namespace}</Badge>
      )}
      <span className="text-[10px] text-muted-foreground shrink-0">
        {new Date(op.createdAt).toLocaleString()}
      </span>
    </div>
  );
}

// ---- Main component ----

export function ClusterPanel({ workspaceId }: ClusterPanelProps) {
  const t = useTranslations("cluster");
  const [activeTab, setActiveTab] = useState("status");
  const {
    status: clusterStatus,
    isLoading: statusLoading,
    error: statusError,
    mutate: refreshStatus,
  } = useClusterStatus();
  const {
    operations,
    isLoading: opsLoading,
    mutate: refreshOps,
  } = useClusterOperations(workspaceId);

  const handleRefresh = () => {
    refreshStatus();
    refreshOps();
  };

  // Not configured state
  if (clusterStatus && !clusterStatus.configured) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center px-8">
        <Server className="h-12 w-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground max-w-sm">
          {t("notConfigured")}
        </p>
      </div>
    );
  }

  const nodes = clusterStatus?.nodes ?? [];
  const jobs = clusterStatus?.jobs ?? [];
  const pods = clusterStatus?.pods ?? [];
  const readyNodes = nodes.filter((n) => n.ready).length;

  return (
    <div className="flex h-full min-w-0 flex-col bg-background">
      {/* Top Bar */}
      <div className="flex items-center gap-3 border-b px-4 py-2">
        {/* Left: Status summary */}
        <div className="flex items-center gap-2">
          {statusLoading ? (
            <Badge variant="secondary">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              {t("loading")}
            </Badge>
          ) : statusError || clusterStatus?.error ? (
            <Badge variant="destructive">{t("error")}</Badge>
          ) : !clusterStatus ? (
            <Badge variant="secondary">{t("loading")}</Badge>
          ) : (
            <Badge className="border-green-500/20 bg-green-500/15 text-green-700 dark:text-green-400">
              {t("nodesReady", { ready: readyNodes, total: nodes.length })}
            </Badge>
          )}
        </div>

        {/* Center: Tabs */}
        <div className="flex-1 flex justify-start">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
            <TabsList variant="line">
              <TabsTrigger value="status" className="text-sm">
                <Server className="mr-1 h-3.5 w-3.5" />
                {t("tabStatus")}
              </TabsTrigger>
              <TabsTrigger value="jobs" className="text-sm">
                <Activity className="mr-1 h-3.5 w-3.5" />
                {t("tabJobs")}
              </TabsTrigger>
              <TabsTrigger value="history" className="text-sm">
                <History className="mr-1 h-3.5 w-3.5" />
                {t("tabHistory")}
                {operations.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1">
                    {operations.length >= 100 ? "100+" : operations.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Right: Refresh */}
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" />
          {t("refresh")}
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "status" && (
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {/* Nodes */}
              <div>
                <h3 className="text-sm font-semibold mb-2">{t("nodes")}</h3>
                {nodes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("noNodes")}</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {nodes.map((n) => (
                      <NodeCard key={n.name} node={n} />
                    ))}
                  </div>
                )}
              </div>

              {/* Active Pods */}
              <div>
                <h3 className="text-sm font-semibold mb-2">
                  {t("activePods")} ({pods.length})
                </h3>
                {pods.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("noPods")}</p>
                ) : (
                  <div className="space-y-1">
                    {pods.slice(0, 50).map((p) => (
                      <PodRow key={`${p.namespace}/${p.name}`} pod={p} />
                    ))}
                    {pods.length > 50 && (
                      <p className="text-xs text-muted-foreground text-center pt-1">
                        +{pods.length - 50} more
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        )}

        {activeTab === "jobs" && (
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              <h3 className="text-sm font-semibold mb-2">
                {t("clusterJobs")} ({jobs.length})
              </h3>
              {jobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noJobs")}</p>
              ) : (
                jobs.map((j) => (
                  <JobRow key={`${j.namespace}/${j.name}`} job={j} />
                ))
              )}
            </div>
          </ScrollArea>
        )}

        {activeTab === "history" && (
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              <h3 className="text-sm font-semibold mb-2">
                {t("operationHistory")} ({operations.length})
              </h3>
              {opsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("loading")}
                </div>
              ) : operations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("noHistory")}
                </p>
              ) : (
                operations.map((op) => <OperationRow key={op.id} op={op} />)
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
