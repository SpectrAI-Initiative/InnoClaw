import useSWR from "swr";
import type { ScheduledTask } from "@/types";
import { fetcher } from "@/lib/fetcher";

export function useScheduledTasks() {
  const { data, error, isLoading, mutate } = useSWR<ScheduledTask[]>(
    "/api/scheduled-tasks",
    fetcher
  );

  return {
    tasks: Array.isArray(data) ? data : [],
    isLoading,
    error,
    mutate,
  };
}
