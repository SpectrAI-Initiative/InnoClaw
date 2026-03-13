import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import type { ExperimentRun } from "@/lib/research-exec/types";

export function useExperimentRuns(workspaceId: string | undefined) {
  const url = workspaceId
    ? `/api/research-exec/runs?workspaceId=${encodeURIComponent(workspaceId)}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<ExperimentRun[]>(url, fetcher, {
    refreshInterval: 15_000,
  });

  return {
    runs: Array.isArray(data) ? data : [],
    isLoading,
    error,
    mutate,
  };
}
