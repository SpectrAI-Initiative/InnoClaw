import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import type { RemoteExecutionProfile } from "@/lib/research-exec/types";

export function useRemoteProfiles(workspaceId: string | undefined) {
  const url = workspaceId
    ? `/api/research-exec/profiles?workspaceId=${encodeURIComponent(workspaceId)}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<RemoteExecutionProfile[]>(url, fetcher);

  return {
    profiles: Array.isArray(data) ? data : [],
    isLoading,
    error,
    mutate,
  };
}
