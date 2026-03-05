import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

// ---- Types (mirroring API responses) ----

export interface ClusterNode {
  name: string;
  ready: boolean;
  roles: string[];
  cpu: string;
  memory: string;
  gpu: string;
}

export interface ClusterJob {
  name: string;
  namespace: string;
  active: number;
  succeeded: number;
  failed: number;
  createdAt: string;
}

export interface ClusterPod {
  name: string;
  namespace: string;
  phase: string;
  nodeName: string;
}

export interface ClusterStatus {
  configured: boolean;
  nodes?: ClusterNode[];
  jobs?: ClusterJob[];
  pods?: ClusterPod[];
  timestamp?: string;
  error?: string;
}

export interface ClusterOperation {
  id: string;
  workspaceId: string | null;
  toolName: string;
  subcommand: string | null;
  jobName: string | null;
  namespace: string | null;
  status: "success" | "error" | "blocked";
  exitCode: number | null;
  summary: string | null;
  inputJson: string | null;
  outputJson: string | null;
  createdAt: string;
}

// ---- Hooks ----

export function useClusterStatus() {
  const { data, error, isLoading, mutate } = useSWR<ClusterStatus>(
    "/api/cluster/status",
    fetcher,
    { refreshInterval: 60_000 } // auto-refresh every 60s
  );

  return {
    status: data ?? null,
    isLoading,
    error,
    mutate,
  };
}

export function useClusterOperations(workspaceId?: string) {
  const url = workspaceId
    ? `/api/cluster/operations?workspaceId=${encodeURIComponent(workspaceId)}&limit=100`
    : `/api/cluster/operations?limit=100`;

  const { data, error, isLoading, mutate } = useSWR<ClusterOperation[]>(
    url,
    fetcher,
    { refreshInterval: 15_000 }
  );

  return {
    operations: Array.isArray(data) ? data : [],
    isLoading,
    error,
    mutate,
  };
}
