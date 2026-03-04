import useSWR from "swr";
import type { FileEntry } from "@/types";
import { fetcher } from "@/lib/fetcher";

export function useFiles(dirPath: string | null) {
  const { data, error, isLoading, mutate } = useSWR<FileEntry[]>(
    dirPath ? `/api/files/browse?path=${encodeURIComponent(dirPath)}` : null,
    fetcher
  );

  return {
    files: Array.isArray(data) ? data : [],
    isLoading,
    error,
    mutate,
  };
}
