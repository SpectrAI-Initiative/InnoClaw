import useSWR from "swr";
import type { Note } from "@/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useNotes(workspaceId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Note[]>(
    workspaceId ? `/api/notes?workspaceId=${workspaceId}` : null,
    fetcher
  );

  return {
    notes: data || [],
    isLoading,
    error,
    mutate,
  };
}
