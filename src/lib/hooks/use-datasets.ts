import useSWR from "swr";
import type { HfDataset, HfDownloadProgress } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useDatasets() {
  const { data, error, isLoading, mutate } = useSWR<HfDataset[]>(
    "/api/datasets",
    fetcher,
    { refreshInterval: 5000 }
  );

  return {
    datasets: Array.isArray(data) ? data : [],
    isLoading,
    error,
    mutate,
  };
}

export function useDatasetProgress(datasetId: string | null) {
  const { data } = useSWR<HfDownloadProgress>(
    datasetId ? `/api/datasets/${datasetId}/status` : null,
    fetcher,
    { refreshInterval: 2000 }
  );

  return data ?? null;
}

/**
 * Hook to poll progress for all active (downloading/pending) datasets.
 */
export function useActiveProgress(datasets: HfDataset[]) {
  const activeIds = datasets
    .filter((d) => d.status === "downloading" || d.status === "pending" || d.status === "paused")
    .map((d) => d.id);

  // Create a stable key for SWR
  const key = activeIds.length > 0
    ? `/api/datasets/active-progress?ids=${activeIds.join(",")}`
    : null;

  const { data } = useSWR<Record<string, HfDownloadProgress>>(
    key,
    async () => {
      const results: Record<string, HfDownloadProgress> = {};
      await Promise.all(
        activeIds.map(async (id) => {
          try {
            const res = await fetch(`/api/datasets/${id}/status`);
            if (res.ok) {
              results[id] = await res.json();
            }
          } catch {
            // ignore individual failures
          }
        })
      );
      return results;
    },
    { refreshInterval: 2000 }
  );

  return data ?? {};
}

interface NetworkSpeed {
  rxBytesPerSecond: number;
  txBytesPerSecond: number;
}

/**
 * Hook to poll server network speed.
 */
export function useNetworkSpeed() {
  const { data } = useSWR<NetworkSpeed>(
    "/api/system/network",
    fetcher,
    { refreshInterval: 3000 }
  );

  return data ?? null;
}
