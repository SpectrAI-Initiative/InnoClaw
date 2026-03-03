import useSWR from "swr";
import type { Note } from "@/types";
import { fetcher } from "@/lib/fetcher";

export function useNotes(workspaceId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Note[]>(
    workspaceId ? `/api/notes?workspaceId=${workspaceId}` : null,
    fetcher
  );

  return {
    notes: Array.isArray(data) ? data : [],
    isLoading,
    error,
    mutate,
  };
}
