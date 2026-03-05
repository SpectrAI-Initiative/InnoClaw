import useSWR from "swr";
import type { Workspace } from "@/types";
import { fetcher } from "@/lib/fetcher";

export function useWorkspaces() {
  const { data, error, isLoading, mutate } = useSWR<Workspace[]>(
    "/api/workspaces",
    fetcher
  );

  return {
    workspaces: Array.isArray(data) ? data : [],
    isLoading,
    error,
    mutate,
  };
}

export function useWorkspace(workspaceId: string) {
  const { data, error, isLoading, mutate } = useSWR<
    Workspace & { sourceCount: number; noteCount: number }
  >(workspaceId ? `/api/workspaces/${workspaceId}` : null, fetcher);

  return {
    workspace: data,
    isLoading,
    error,
    mutate,
  };
}
