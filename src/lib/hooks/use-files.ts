import useSWR from "swr";
import type { FileEntry } from "@/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useFiles(dirPath: string | null) {
  const { data, error, isLoading, mutate } = useSWR<FileEntry[]>(
    dirPath ? `/api/files/browse?path=${encodeURIComponent(dirPath)}` : null,
    fetcher
  );

  return {
    files: data || [],
    isLoading,
    error,
    mutate,
  };
}
