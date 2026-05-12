import useSWR from "swr";
import type { SWRConfiguration } from "swr";
import { fetcher } from "@/lib/fetcher";
import type {
  DeepResearchSession,
  DeepResearchMessage,
  DeepResearchNode,
  DeepResearchArtifact,
  DeepResearchEvent,
  PersistedExecutionRecord,
} from "@/lib/deep-research/types";
import {
  ACTIVE_DEEP_RESEARCH_REFRESH_MS,
  IDLE_DEEP_RESEARCH_REFRESH_MS,
  getArtifactRefreshInterval,
  getExecutionRefreshInterval,
  getFullSessionRefreshInterval,
  getSessionRefreshInterval,
} from "@/lib/deep-research/refresh-policy";

type DeepResearchResourceResult<T> = {
  data: T | undefined;
  error: Error | undefined;
  isLoading: boolean;
  mutate: () => Promise<T | undefined>;
};

function buildDeepResearchUrl(
  basePath: string,
  params?: Record<string, string | undefined>,
): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function useDeepResearchResource<T>(
  url: string | null,
  config?: SWRConfiguration<T, Error>,
): DeepResearchResourceResult<T> {
  const { data, error, isLoading, mutate } = useSWR<T>(url, fetcher, config);
  return { data, error, isLoading, mutate };
}

function useDeepResearchListResource<T>(
  url: string | null,
  refreshInterval: SWRConfiguration<T[], Error>["refreshInterval"],
) {
  const { data, error, isLoading, mutate } = useDeepResearchResource<T[]>(url, { refreshInterval });

  return {
    data: Array.isArray(data) ? data : [],
    error,
    isLoading,
    mutate,
  };
}

export function useDeepResearchSessions(workspaceId: string | undefined) {
  const url = workspaceId
    ? buildDeepResearchUrl("/api/deep-research/sessions", { workspaceId })
    : null;
  const { data, error, isLoading, mutate } = useDeepResearchListResource<DeepResearchSession>(
    url,
    IDLE_DEEP_RESEARCH_REFRESH_MS,
  );

  return {
    sessions: data,
    isLoading,
    error,
    mutate,
  };
}

export function useDeepResearchSession(sessionId: string | undefined) {
  const url = sessionId ? `/api/deep-research/sessions/${sessionId}` : null;

  const { data, error, isLoading, mutate } = useDeepResearchResource<DeepResearchSession>(url, {
    refreshInterval: (latestData) => getSessionRefreshInterval(latestData ?? null),
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
  const { data, error, isLoading, mutate } = useDeepResearchListResource<DeepResearchMessage>(
    url,
    ACTIVE_DEEP_RESEARCH_REFRESH_MS,
  );

  return {
    messages: data,
    isLoading,
    error,
    mutate,
  };
}

export function useDeepResearchNodes(sessionId: string | undefined) {
  const url = sessionId ? `/api/deep-research/sessions/${sessionId}/nodes` : null;
  const { data, error, isLoading, mutate } = useDeepResearchListResource<DeepResearchNode>(
    url,
    ACTIVE_DEEP_RESEARCH_REFRESH_MS,
  );

  return {
    nodes: data,
    isLoading,
    error,
    mutate,
  };
}

export function useDeepResearchArtifacts(
  sessionId: string | undefined,
  filters?: { nodeId?: string; type?: string }
) {
  const url = sessionId
    ? buildDeepResearchUrl(`/api/deep-research/sessions/${sessionId}/artifacts`, filters)
    : null;
  const { data, error, isLoading, mutate } = useDeepResearchListResource<DeepResearchArtifact>(
    url,
    getArtifactRefreshInterval(),
  );

  return {
    artifacts: data,
    isLoading,
    error,
    mutate,
  };
}

export function useDeepResearchEvents(sessionId: string | undefined, since?: string) {
  const url = sessionId
    ? buildDeepResearchUrl(`/api/deep-research/sessions/${sessionId}/events`, { since })
    : null;
  const { data, error, isLoading, mutate } = useDeepResearchListResource<DeepResearchEvent>(
    url,
    ACTIVE_DEEP_RESEARCH_REFRESH_MS,
  );

  return {
    events: data,
    isLoading,
    error,
    mutate,
  };
}

export function useDeepResearchExecutions(sessionId: string | undefined) {
  const url = sessionId ? `/api/deep-research/sessions/${sessionId}/executions` : null;

  const { data, error, isLoading, mutate } = useDeepResearchResource<PersistedExecutionRecord[]>(
    url,
    {
      refreshInterval: (latestData) => getExecutionRefreshInterval(latestData ?? null),
    },
  );

  return {
    executions: Array.isArray(data) ? data : [],
    isLoading,
    error,
    mutate,
  };
}

// --- Consolidated hook: fetches everything in one request ---

interface FullSessionData {
  session: DeepResearchSession;
  messages: DeepResearchMessage[];
  nodes: DeepResearchNode[];
  artifacts: DeepResearchArtifact[];
  events: DeepResearchEvent[];
  executions: PersistedExecutionRecord[];
}

export function useDeepResearchSessionFull(sessionId: string | undefined) {
  const url = sessionId ? `/api/deep-research/sessions/${sessionId}/full` : null;

  const { data, error, isLoading, mutate } = useSWR<FullSessionData>(url, fetcher, {
    refreshInterval: (latestData) => getFullSessionRefreshInterval(latestData?.session ?? null),
  });

  return {
    session: data?.session ?? null,
    messages: data?.messages ?? [],
    nodes: data?.nodes ?? [],
    artifacts: data?.artifacts ?? [],
    events: data?.events ?? [],
    executions: data?.executions ?? [],
    isLoading,
    error,
    mutate,
  };
}
