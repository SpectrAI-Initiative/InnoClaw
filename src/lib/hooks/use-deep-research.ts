import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import type {
  DeepResearchSession,
  DeepResearchMessage,
  DeepResearchNode,
  DeepResearchArtifact,
  DeepResearchEvent,
  PersistedExecutionRecord,
  RequirementState,
} from "@/lib/deep-research/types";

export function useDeepResearchSessions(workspaceId: string | undefined) {
  const url = workspaceId
    ? `/api/deep-research/sessions?workspaceId=${encodeURIComponent(workspaceId)}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<DeepResearchSession[]>(url, fetcher, {
    refreshInterval: 30_000,
  });

  return {
    sessions: Array.isArray(data) ? data : [],
    isLoading,
    error,
    mutate,
  };
}

export function useDeepResearchSession(sessionId: string | undefined) {
  const url = sessionId ? `/api/deep-research/sessions/${sessionId}` : null;

  const { data, error, isLoading, mutate } = useSWR<DeepResearchSession>(url, fetcher, {
    refreshInterval: (latestData) => {
      if (!latestData) return 5000;
      const terminal = ["completed", "stopped_by_user", "failed", "cancelled"].includes(latestData.status);
      return terminal ? 30000 : 5000;
    },
  });

  return {
    session: data ?? null,
    isLoading,
    error,
    mutate,
  };
}

export function useDeepResearchMessages(sessionId: string | undefined) {
  const url = sessionId ? `/api/deep-research/sessions/${sessionId}/messages` : null;

  const { data, error, isLoading, mutate } = useSWR<DeepResearchMessage[]>(url, fetcher, {
    refreshInterval: 8000,
  });

  return {
    messages: Array.isArray(data) ? data : [],
    isLoading,
    error,
    mutate,
  };
}

export function useDeepResearchNodes(sessionId: string | undefined) {
  const url = sessionId ? `/api/deep-research/sessions/${sessionId}/nodes` : null;

  const { data, error, isLoading, mutate } = useSWR<DeepResearchNode[]>(url, fetcher, {
    refreshInterval: 8000,
  });

  return {
    nodes: Array.isArray(data) ? data : [],
    isLoading,
    error,
    mutate,
  };
}

export function useDeepResearchArtifacts(
  sessionId: string | undefined,
  filters?: { nodeId?: string; type?: string }
) {
  let url = sessionId ? `/api/deep-research/sessions/${sessionId}/artifacts` : null;
  if (url && filters) {
    const params = new URLSearchParams();
    if (filters.nodeId) params.set("nodeId", filters.nodeId);
    if (filters.type) params.set("type", filters.type);
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const { data, error, isLoading, mutate } = useSWR<DeepResearchArtifact[]>(url, fetcher, {
    refreshInterval: 15000,
  });

  return {
    artifacts: Array.isArray(data) ? data : [],
    isLoading,
    error,
    mutate,
  };
}

export function useDeepResearchEvents(sessionId: string | undefined, since?: string) {
  let url = sessionId ? `/api/deep-research/sessions/${sessionId}/events` : null;
  if (url && since) {
    url += `?since=${encodeURIComponent(since)}`;
  }

  const { data, error, isLoading, mutate } = useSWR<DeepResearchEvent[]>(url, fetcher, {
    refreshInterval: 5000,
  });

  return {
    events: Array.isArray(data) ? data : [],
    isLoading,
    error,
    mutate,
  };
}

export function useDeepResearchExecutions(sessionId: string | undefined) {
  const url = sessionId ? `/api/deep-research/sessions/${sessionId}/executions` : null;

  const { data, error, isLoading, mutate } = useSWR<PersistedExecutionRecord[]>(url, fetcher, {
    refreshInterval: (latestData) => {
      if (!latestData) return 5000;
      const hasActive = latestData.some((r) =>
        ["pending", "submitted", "running"].includes(r.status)
      );
      return hasActive ? 5000 : 30000;
    },
  });

  return {
    executions: Array.isArray(data) ? data : [],
    isLoading,
    error,
    mutate,
  };
}
