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
import { isCompletedSessionStatus } from "@/lib/deep-research/session-status";

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
    30_000,
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
    refreshInterval: (latestData) => {
      if (!latestData) return 5000;
      return isCompletedSessionStatus(latestData.status)
        || latestData.status === "stopped_by_user"
        || latestData.status === "failed"
        || latestData.status === "cancelled"
        ? 30_000
        : 5_000;
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
  const { data, error, isLoading, mutate } = useDeepResearchListResource<DeepResearchMessage>(
    url,
    2_000,
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
    2_000,
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
    4_000,
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
    2_000,
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
      refreshInterval: (latestData) => {
        if (!latestData) return 5000;
        const hasActive = latestData.some((r) =>
          ["pending", "submitted", "running"].includes(r.status)
        );
        return hasActive ? 5000 : 30000;
      },
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

const TERMINAL_STATUSES = new Set(["completed", "stopped_by_user", "failed", "cancelled"]);
const AWAITING_STATUSES = new Set(["awaiting_user_confirmation", "execution_prepared", "awaiting_additional_literature"]);

export function useDeepResearchSessionFull(sessionId: string | undefined) {
  const url = sessionId ? `/api/deep-research/sessions/${sessionId}/full` : null;

  const { data, error, isLoading, mutate } = useSWR<FullSessionData>(url, fetcher, {
    refreshInterval: (latestData) => {
      if (!latestData?.session) return 5000;
      const status = latestData.session.status;
      if (TERMINAL_STATUSES.has(status)) return 60000;
      if (AWAITING_STATUSES.has(status)) return 15000;
      return 5000;
    },
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
