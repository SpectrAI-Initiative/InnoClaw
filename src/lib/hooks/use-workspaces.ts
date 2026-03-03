import useSWR from "swr";
import type { Workspace } from "@/types";

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    return res.json();
  });

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
